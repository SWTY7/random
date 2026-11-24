// Primordial: genomes. Body traits plus a small recurrent neural network.
'use strict';
(function (G) {
  const PR = G.PR;
  const { clamp } = PR;

  // ---- Body traits. Every gene lives in [0, 1]; express() maps it to a phenotype. ----
  const TRAITS = [
    { key: 'size',   name: 'Body size',      w: 1.0, desc: 'Bigger bodies hold more energy and bite harder, but cost more to run and turn slowly.' },
    { key: 'speed',  name: 'Muscle',         w: 0.8, desc: 'Stronger thrust. Swimming costs more energy for muscular bodies.' },
    { key: 'diet',   name: 'Diet',           w: 1.6, desc: '0 eats plants, 1 eats meat. Generalists digest both poorly.' },
    { key: 'sight',  name: 'Sight range',    w: 0.6, desc: 'How far the eyes reach. Eyes cost energy in proportion to range times field of view.' },
    { key: 'fov',    name: 'Field of view',  w: 0.6, desc: 'Width of the visual field, split into five sectors.' },
    { key: 'armor',  name: 'Armour',         w: 0.8, desc: 'Blocks bite damage and spikes attackers, at a metabolic cost.' },
    { key: 'invest', name: 'Brood energy',   w: 0.5, desc: 'Share of energy handed to each offspring. Few well-fed young, or many hungry ones.' },
    { key: 'mature', name: 'Life history',   w: 0.5, desc: 'Slow life histories mature late and live long. Fast ones breed young and die young.' },
    { key: 'clock',  name: 'Clock rate',     w: 0.3, desc: 'Frequency of an internal oscillator the brain can read.' },
    { key: 'hue',    name: 'Colour',         w: 1.0, wrap: true, desc: 'Body colour. Others see it, so it can serve as a kin marker.' },
    { key: 'mut',    name: 'Mutability',     w: 0.3, desc: 'This lineage\'s own mutation rate, which also evolves.' },
  ];
  const NT = TRAITS.length;
  const T = {}; TRAITS.forEach((t, i) => { T[t.key] = i; });

  // ---- Brain layout ----
  const NS = 5;                                   // eye sectors
  const CHANNELS = ['plant', 'meat', 'body', 'kin', 'size'];
  const NCH = CHANNELS.length;
  const EXTRA = ['energy', 'health', 'age', 'speed', 'wall', 'pain', 'clock', 'fertility', 'bias'];
  const NI = NS * NCH + EXTRA.length;            // 34
  const NH = 12;                                  // recurrent hidden neurons
  const OUTPUTS = ['forward', 'turn', 'bite', 'breed'];
  const NO = OUTPUTS.length;
  const OFF_W1 = 0;                               // NH x (NI + NH): inputs and previous hidden -> hidden
  const OFF_B1 = OFF_W1 + NH * (NI + NH);
  const OFF_W2 = OFF_B1 + NH;                     // NO x NH: hidden -> output
  const OFF_W3 = OFF_W2 + NO * NH;                // NO x NI: input -> output (reflexes)
  const OFF_B2 = OFF_W3 + NO * NI;
  const NB = OFF_B2 + NO;

  const INPUT_NAMES = [];
  for (let s = 0; s < NS; s++) for (const ch of CHANNELS) INPUT_NAMES.push(ch + ' ' + ['far left', 'left', 'ahead', 'right', 'far right'][s]);
  for (const e of EXTRA) INPUT_NAMES.push(e);
  const IN = {}; EXTRA.forEach((e, i) => { IN[e] = NS * NCH + i; });

  class Genome {
    constructor(genes, brain) {
      this.genes = genes || new Float32Array(NT);
      this.brain = brain || new Float32Array(NB);
      this.nnz = 0;
      this.countNnz();
    }
    countNnz() { let n = 0; const b = this.brain; for (let i = 0; i < NB; i++) if (b[i] !== 0) n++; this.nnz = n; return n; }
    clone() { return new Genome(this.genes.slice(), this.brain.slice()); }
    toJSON() { return { g: Array.from(this.genes), b: PR.f32ToB64(this.brain) }; }
    static fromJSON(o) {
      const g = new Float32Array(NT); for (let i = 0; i < NT && i < o.g.length; i++) g[i] = o.g[i];
      const b = PR.b64ToF32(o.b);
      if (b.length !== NB) throw new Error('Brain layout mismatch');
      return new Genome(g, b);
    }
  }

  // A founder: plausible body, sparse random brain with a slight urge to swim forward.
  function randomGenome(rng, opts = {}) {
    const g = new Float32Array(NT);
    g[T.size] = rng.range(0.25, 0.55);
    g[T.speed] = rng.range(0.3, 0.6);
    g[T.diet] = opts.diet != null ? opts.diet : rng.range(0.0, 0.25);
    g[T.sight] = rng.range(0.3, 0.6);
    g[T.fov] = rng.range(0.3, 0.6);
    g[T.armor] = rng.range(0.0, 0.2);
    g[T.invest] = rng.range(0.3, 0.6);
    g[T.mature] = rng.range(0.2, 0.5);
    g[T.clock] = rng.next();
    g[T.hue] = opts.hue != null ? opts.hue : rng.next();
    g[T.mut] = rng.range(0.4, 0.6);
    const b = new Float32Array(NB);
    // Background noise: a sparse, weak random network for evolution to work with.
    const density = opts.density || 0.12;
    for (let i = 0; i < NB; i++) if (rng.chance(density)) b[i] = rng.gauss() * 0.35;
    if (!opts.blank) ancestralWiring(b, rng, g[T.diet]);
    return new Genome(g, b);
  }

  // The common ancestor's reflexes: swim forward, steer toward food seen to either side, avoid walls,
  // keep the jaws shut unless meat-eating, and bud when fed. Each weight is jittered so founders differ.
  function ancestralWiring(b, rng, diet) {
    const j = (v, s = 0.25) => v * (1 + rng.gauss() * s);
    const fwd = OFF_W3 + 0 * NI, turn = OFF_W3 + 1 * NI, bite = OFF_W3 + 2 * NI, breed = OFF_W3 + 3 * NI;
    const food = diet > 0.5 ? 1 : 0;           // channel: 0 plant, 1 meat
    b[OFF_B2 + 0] = j(0.9);
    b[turn + 0 * NCH + food] = j(-1.6); b[turn + 1 * NCH + food] = j(-1.0);
    b[turn + 3 * NCH + food] = j(1.0);  b[turn + 4 * NCH + food] = j(1.6);
    b[fwd + 2 * NCH + food] = j(0.5);
    b[turn + IN.wall] = j(1.8) * (rng.chance(0.5) ? 1 : -1);
    b[fwd + IN.wall] = j(-0.6);
    b[OFF_B2 + 2] = diet > 0.5 ? j(0.3) : j(-1.2);
    if (diet > 0.5) { b[turn + 0 * NCH + 2] = j(-1.2); b[turn + 4 * NCH + 2] = j(1.2); b[bite + 2 * NCH + 2] = j(1.5); }
    b[OFF_B2 + 3] = j(-0.6);
    b[breed + IN.energy] = j(1.6);
  }

  const mutRateOf = genes => Math.pow(10, -3 + 2 * genes[T.mut]);  // 0.001 .. 0.1 per weight

  // Copy with mutations. Brain mutations use geometric skipping so the cost is proportional to the
  // number of mutations, not the size of the brain.
  function mutate(src, rng, scale = 1) {
    const c = src.clone();
    const g = c.genes, b = c.brain;
    const m = Math.min(0.5, mutRateOf(src.genes) * scale);
    if (m <= 0) return c;
    const pt = Math.min(0.6, m * 5);
    for (let i = 0; i < NT; i++) {
      if (!rng.chance(pt)) continue;
      const sd = i === T.hue ? 0.03 : 0.05;
      let v = g[i] + rng.gauss() * sd;
      if (TRAITS[i].wrap) v -= Math.floor(v);
      else v = clamp(v, 0, 1);
      g[i] = v;
    }
    const lq = Math.log(1 - m);
    let i = Math.floor(Math.log(1 - rng.next()) / lq);
    while (i < NB) {
      const w = b[i];
      if (w === 0) { if (rng.chance(0.35)) b[i] = rng.gauss() * 0.6; }   // new connection
      else if (rng.chance(0.07)) b[i] = 0;                               // prune
      else b[i] = clamp(w + rng.gauss() * 0.35, -4, 4);                 // nudge
      i += 1 + Math.floor(Math.log(1 - rng.next()) / lq);
    }
    c.countNnz();
    return c;
  }

  // Sexual recombination. Whole neurons are inherited as units (their incoming weights, bias and
  // outgoing weights), which keeps working circuits together.
  function crossover(a, b, rng) {
    const genes = new Float32Array(NT);
    for (let i = 0; i < NT; i++) genes[i] = rng.chance(0.5) ? a.genes[i] : b.genes[i];
    const br = new Float32Array(NB);
    const A = a.brain, B = b.brain;
    for (let j = 0; j < NH; j++) {
      const s = rng.chance(0.5) ? A : B;
      const row = OFF_W1 + j * (NI + NH);
      for (let k = 0; k < NI + NH; k++) br[row + k] = s[row + k];
      br[OFF_B1 + j] = s[OFF_B1 + j];
      for (let o = 0; o < NO; o++) br[OFF_W2 + o * NH + j] = s[OFF_W2 + o * NH + j];
    }
    for (let o = 0; o < NO; o++) {
      const s = rng.chance(0.5) ? A : B;
      const row = OFF_W3 + o * NI;
      for (let k = 0; k < NI; k++) br[row + k] = s[row + k];
      br[OFF_B2 + o] = s[OFF_B2 + o];
    }
    return new Genome(genes, br);
  }

  // Genetic distance: weighted trait distance plus mean absolute weight difference.
  function traitDistance(a, b) {
    let s = 0;
    for (let i = 0; i < NT; i++) {
      let d = Math.abs(a.genes[i] - b.genes[i]);
      if (TRAITS[i].wrap) d = Math.min(d, 1 - d);
      s += TRAITS[i].w * d * d;
    }
    return Math.sqrt(s);
  }
  function brainDistance(a, b) {
    let s = 0; const A = a.brain, B = b.brain;
    for (let i = 0; i < NB; i++) s += Math.abs(A[i] - B[i]);
    return s / NB;
  }
  const distance = (a, b) => traitDistance(a, b) + 1.5 * brainDistance(a, b);

  // Phenotype: what the genes mean in world units.
  function express(genes) {
    const size = genes[T.size];
    const adultR = 4 + 10 * size;
    const adultMass = (adultR / 8) ** 2;
    const matureAge = Math.round(150 + 1100 * genes[T.mature]);
    return {
      adultR, adultMass,
      muscle: genes[T.speed],
      accel: (0.04 + 0.2 * genes[T.speed]) / Math.pow(adultMass, 0.25),
      turnRate: 0.2 / Math.pow(adultMass, 0.3),
      diet: genes[T.diet],
      plantEff: 1 - Math.pow(genes[T.diet], 1.4),
      meatEff: Math.pow(genes[T.diet], 1.4),
      sightR: 40 + 200 * genes[T.sight],
      fov: 0.6 + 4.8 * genes[T.fov],
      armor: genes[T.armor],
      invest: 0.2 + 0.6 * genes[T.invest],
      matureAge,
      maxAge: Math.round(2200 + matureAge * 3.5),
      clockFreq: 0.01 + 0.15 * genes[T.clock],
      hue: genes[T.hue] * 360,
      mutRate: mutRateOf(genes),
      cap: 150 * adultMass,
    };
  }

  // Run the network one step. x: inputs (NI), h: previous hidden state (NH, updated in place),
  // tmp: scratch (NH), out: outputs (NO).
  function think(brain, x, h, tmp, out) {
    const stride = NI + NH;
    for (let j = 0; j < NH; j++) {
      let s = brain[OFF_B1 + j];
      const row = OFF_W1 + j * stride;
      for (let i = 0; i < NI; i++) s += brain[row + i] * x[i];
      for (let k = 0; k < NH; k++) s += brain[row + NI + k] * h[k];
      tmp[j] = Math.tanh(s);
    }
    for (let j = 0; j < NH; j++) h[j] = tmp[j];
    for (let o = 0; o < NO; o++) {
      let s = brain[OFF_B2 + o];
      const r2 = OFF_W2 + o * NH, r3 = OFF_W3 + o * NI;
      for (let j = 0; j < NH; j++) s += brain[r2 + j] * h[j];
      for (let i = 0; i < NI; i++) s += brain[r3 + i] * x[i];
      out[o] = Math.tanh(s);
    }
  }

  PR.Genome = Genome;
  Object.assign(PR, {
    TRAITS, NT, T, NS, CHANNELS, NCH, EXTRA, NI, NH, NO, OUTPUTS, NB, IN, INPUT_NAMES,
    OFF_W1, OFF_B1, OFF_W2, OFF_W3, OFF_B2,
    randomGenome, mutate, crossover, distance, traitDistance, brainDistance, express, think, mutRateOf,
  });
})(globalThis);
