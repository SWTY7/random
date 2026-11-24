// Primordial: the world. Plants, meat, creatures, physics, senses, metabolism, breeding, speciation.
'use strict';
(function (G) {
  const PR = G.PR;
  const { clamp, wrapAngle, TAU, NS, NCH, NI, NH, NO, IN } = PR;

  const DEFAULTS = {
    plantRate: 1,        // how often plants sprout
    plantMax: 25,        // energy in a full-grown plant
    plantGrowth: 0.03,   // energy a plant gains per tick
    plantCap: 2600,      // most plants the world holds
    seasonAmp: 0.6,      // how strongly seasons swing plant growth (north and south are opposite)
    seasonLen: 6000,     // ticks per year
    meatDecay: 1,        // how fast carcasses rot
    mutScale: 1,         // multiplies every lineage's own mutation rate
    attack: 1,           // multiplies bite damage
    basal: 1,            // multiplies the cost of simply being alive
    minPop: 16,          // below this, new life drifts in
    sexual: true,        // allow mating between relatives
    specThresh: 0.45,    // genetic distance from the founder at which a new species is named
  };
  const PARAM_INFO = {
    plantRate:  { min: 0, max: 3, step: 0.05, label: 'Plant sprouting' },
    plantGrowth:{ min: 0, max: 0.1, step: 0.002, label: 'Plant growth' },
    plantCap:   { min: 200, max: 6000, step: 100, label: 'Plant limit' },
    seasonAmp:  { min: 0, max: 1, step: 0.05, label: 'Seasons' },
    seasonLen:  { min: 1000, max: 30000, step: 500, label: 'Year length' },
    meatDecay:  { min: 0.2, max: 4, step: 0.1, label: 'Rot' },
    mutScale:   { min: 0, max: 4, step: 0.05, label: 'Mutation' },
    attack:     { min: 0, max: 3, step: 0.05, label: 'Bite strength' },
    basal:      { min: 0.3, max: 3, step: 0.05, label: 'Cost of living' },
    minPop:     { min: 0, max: 100, step: 1, label: 'Immigration floor' },
    specThresh: { min: 0.15, max: 1.2, step: 0.01, label: 'Species split at' },
  };

  const FOOD_CAP = 14000;
  const MAX_CREATURES = 2000;
  const PLANT = 0, MEAT = 1;
  const MEAT_VALUE = 1.35;  // meat is richer than algae
  const FS = 40;          // fertility cell size
  const CS = 64;          // spatial grid cell size

  // Counting-sort spatial grid, rebuilt every tick.
  class Grid {
    constructor(W, H, cs) {
      this.cs = cs; this.nx = Math.ceil(W / cs); this.ny = Math.ceil(H / cs);
      const nc = this.nx * this.ny;
      this.start = new Int32Array(nc + 1); this.cur = new Int32Array(nc);
      this.idx = new Int32Array(1024); this.cell = new Int32Array(1024);
    }
    cx(x) { const c = (x / this.cs) | 0; return c < 0 ? 0 : c >= this.nx ? this.nx - 1 : c; }
    cy(y) { const c = (y / this.cs) | 0; return c < 0 ? 0 : c >= this.ny ? this.ny - 1 : c; }
    build(xs, ys, n) {
      const nc = this.nx * this.ny, st = this.start;
      if (this.idx.length < n) { this.idx = new Int32Array(n * 2); this.cell = new Int32Array(n * 2); }
      st.fill(0);
      for (let i = 0; i < n; i++) { const c = this.cx(xs[i]) + this.cy(ys[i]) * this.nx; this.cell[i] = c; st[c + 1]++; }
      for (let c = 0; c < nc; c++) st[c + 1] += st[c];
      this.cur.set(st.subarray(0, nc));
      for (let i = 0; i < n; i++) this.idx[this.cur[this.cell[i]]++] = i;
    }
  }

  // atan2 to within ~0.005 rad, several times faster than Math.atan2.
  function fastAtan2(y, x) {
    const ax = Math.abs(x), ay = Math.abs(y);
    const a = Math.min(ax, ay) / (Math.max(ax, ay) + 1e-12), s = a * a;
    let r = ((-0.0464964749 * s + 0.15931422) * s - 0.327622764) * s * a + a;
    if (ay > ax) r = 1.57079637 - r;
    if (x < 0) r = 3.14159274 - r;
    return y < 0 ? -r : r;
  }

  // Landscapes: how fertile each patch of sea floor is. Each sets up a different evolutionary situation.
  function fillFert(w, fn) {
    const noise = PR.makeNoise(w.seed ^ 0x5bd1e995), noise2 = PR.makeNoise(w.seed ^ 0x1b873593), sc = 1 / 14;
    const aspect = w.W / w.H;
    for (let j = 0; j < w.fh; j++) for (let i = 0; i < w.fw; i++) {
      const u = (i + 0.5) / w.fw, v = (j + 0.5) / w.fh;
      const n = noise(i * sc, j * sc, 5), n2 = noise2(i * sc * 0.5, j * sc * 0.5, 2);
      const ex = Math.min(u, 1 - u), ey = Math.min(v, 1 - v), edge = clamp(Math.min(ex, ey) * 9, 0, 1);
      w.fert[i + j * w.fw] = clamp(fn(u, v, n, n2, edge, aspect), 0, 1);
    }
  }
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const LANDSCAPES = {
    meadows: {
      name: 'Patchy meadows', blurb: 'Meadows of algae separated by open water. The usual place to start.',
      make: w => fillFert(w, (u, v, n, n2, edge) => clamp((n - 0.42) * 2.6 + (n2 - 0.5) * 0.8, 0, 1) * (0.35 + 0.65 * edge)),
    },
    islands: {
      name: 'Archipelago', blurb: 'Lush islands far apart in a barren sea. Lineages stranded on different islands drift apart: speciation by isolation.',
      make: (w, rng) => {
        const isl = [], aspect = w.W / w.H;
        for (let k = 0, tries = 0; k < 8 && tries < 2000; tries++) {
          const x = rng.range(0.1, 0.9), y = rng.range(0.15, 0.85), r = rng.range(0.1, 0.14);
          if (isl.every(o => Math.hypot((o.x - x) * aspect, o.y - y) > o.r + r + 0.1)) { isl.push({ x, y, r }); k++; }
        }
        fillFert(w, (u, v, n) => {
          let f = 0;
          for (const o of isl) f = Math.max(f, smooth(1.6 - 1.2 * Math.hypot((u - o.x) * aspect, v - o.y) / o.r));
          return f * (0.75 + 0.5 * n);
        });
      },
    },
    strait: {
      name: 'Two seas', blurb: 'Two rich seas divided by a barren strait. Crossing is possible but costly, so the two sides evolve largely apart.',
      make: w => fillFert(w, (u, v, n, n2, edge) => {
        const sea = clamp((n - 0.4) * 2.4 + (n2 - 0.5) * 0.8, 0, 1) * (0.35 + 0.65 * edge);
        return sea * smooth((Math.abs(u - 0.5) - 0.05) / 0.08);
      }),
    },
    gradient: {
      name: 'Gradient', blurb: 'Barren in the west, lush in the east. Populations along the slope face different hunger, so traits can change gradually across the map (a cline).',
      make: w => fillFert(w, (u, v, n, n2, edge) => Math.pow(u, 1.3) * (0.55 + 0.6 * n) * (0.4 + 0.6 * edge)),
    },
    ring: {
      name: 'Ring reef', blurb: 'A circular reef around a deep, empty lagoon. Lineages spread both ways around the ring; where the two fronts meet, they may no longer be kin.',
      make: w => fillFert(w, (u, v, n, n2, edge, aspect) => {
        const d = Math.hypot((u - 0.5) * aspect, v - 0.5);
        return Math.exp(-(((d - 0.35) / 0.09) ** 2)) * (0.7 + 0.6 * n);
      }),
    },
  };

  let nextUid = 1;
  class Creature {
    constructor(genome, x, y, a, species, gen) {
      this.id = nextUid++;
      this.genome = genome; this.ph = PR.express(genome.genes);
      this.species = species; this.gen = gen;
      this.x = x; this.y = y; this.a = a; this.vx = 0; this.vy = 0;
      this.age = 0; this.r = this.ph.adultR * 0.55; this.mass = (this.r / 8) ** 2;
      this.energy = 0; this.maxHealth = 15 + 35 * this.mass; this.health = this.maxHealth;
      this.cooldown = 0; this.phase = 0; this.pain = 0; this.painNow = 0;
      this.h = new Float32Array(NH); this.inp = new Float32Array(NI); this.out = new Float32Array(NO);
      this.alive = true; this.biting = 0; this.ate = 0; this.wantsBreed = false; this.cause = '';
      this.kids = 0; this.kills = 0; this.plantE = 0; this.meatE = 0; this.dist = 0; this.born = 0;
      this.parents = [];
      this.tail = 0;
    }
  }

  class World {
    constructor(opts = {}) {
      this.seedName = opts.seed != null ? String(opts.seed) : 'primordial';
      this.seed = PR.hashSeed(this.seedName);
      this.W = opts.W || 2400; this.H = opts.H || 1600;
      this.p = Object.assign({}, DEFAULTS, opts.params || {});
      this.rng = new PR.RNG(this.seed);
      this.t = 0;
      this.creatures = [];
      this.fx = new Float32Array(FOOD_CAP); this.fy = new Float32Array(FOOD_CAP);
      this.fe = new Float32Array(FOOD_CAP); this.fk = new Uint8Array(FOOD_CAP); this.nf = 0;
      this.fgrid = new Grid(this.W, this.H, CS); this.cgrid = new Grid(this.W, this.H, CS);
      this.cxs = new Float32Array(MAX_CREATURES * 2); this.cys = new Float32Array(MAX_CREATURES * 2);
      this.fw = Math.ceil(this.W / FS); this.fh = Math.ceil(this.H / FS);
      this.fert = new Float32Array(this.fw * this.fh);
      this.fertVersion = 0;
      this.phylo = new PR.Phylo(this.seed);
      this.history = []; this.sampleEvery = 25;
      this.events = [];
      this.stats = { births: 0, sexual: 0, starved: 0, killed: 0, old: 0, smitten: 0, plantE: 0, meatE: 0, immigrants: 0, speciations: 0 };
      this.records = { pop: 0, species: 0, gen: 0, firstPredator: false };
      this.tmpH = new Float32Array(NH);
      this.newborns = [];
      this.plantAcc = 0;
      if (!opts.empty) this.genesis(opts);
    }

    // ---------------- setup ----------------
    genesis(opts) {
      const rng = this.rng;
      this.landscape = LANDSCAPES[opts.landscape] ? opts.landscape : 'meadows';
      LANDSCAPES[this.landscape].make(this, rng);
      this.fertVersion++;
      // Plants: start the meadows about half full.
      let tries = 0;
      while (this.nf < this.p.plantCap * 0.3 && tries++ < 200000) {
        const x = rng.next() * this.W, y = rng.next() * this.H;
        if (rng.next() < this.fertAt(x, y)) this.addFood(x, y, rng.range(5, this.p.plantMax), PLANT);
      }
      const nFound = opts.founders || 6, perFounder = opts.perFounder || 24;
      for (let k = 0; k < nFound; k++) {
        // One founding lineage in six starts out as a scavenger that can learn to hunt.
        const hunter = nFound >= 4 && k === nFound - 1;
        const g0 = PR.randomGenome(rng, { hue: (k / nFound + rng.next() * 0.08) % 1, diet: hunter ? rng.range(0.72, 0.85) : undefined });
        if (hunter) { g0.genes[PR.T.size] = rng.range(0.5, 0.7); g0.genes[PR.T.speed] = rng.range(0.55, 0.75); g0.genes[PR.T.sight] = rng.range(0.5, 0.8); }
        const sp = this.phylo.create(0, g0, 0);
        sp.established = true;
        const [cx, cy] = this.fertileSpot();
        for (let i = 0; i < perFounder; i++) {
          const g = i === 0 ? g0.clone() : PR.mutate(g0, rng, 1);
          const c = this.spawn(g, clamp(cx + rng.gauss() * 80, 10, this.W - 10), clamp(cy + rng.gauss() * 80, 10, this.H - 10), sp.id, 0);
          c.energy = c.ph.cap * 0.6; c.age = rng.int(c.ph.matureAge);
          this.grow(c);
        }
      }
      this.log('dawn', `Life begins in ${LANDSCAPES[this.landscape].name.toLowerCase()}: ${nFound} founding lineages among ${this.nf} patches of algae.`);
      this.sample();
    }

    fertileSpot() {
      let best = null, bf = -1;
      for (let k = 0; k < 40; k++) {
        const x = this.rng.range(60, this.W - 60), y = this.rng.range(60, this.H - 60), f = this.fertAt(x, y);
        if (f > bf) { bf = f; best = [x, y]; }
      }
      return best;
    }

    // ---------------- environment ----------------
    get year() { return this.t / this.p.seasonLen; }
    seasonPhase() { return Math.sin(TAU * this.t / this.p.seasonLen); }
    seasonal(y) { return 1 + this.p.seasonAmp * this.seasonPhase() * ((y / this.H) * 2 - 1) * -1; }
    baseFert(x, y) {
      const i = clamp((x / FS) | 0, 0, this.fw - 1), j = clamp((y / FS) | 0, 0, this.fh - 1);
      return this.fert[i + j * this.fw];
    }
    fertAt(x, y) { return this.baseFert(x, y) * this.seasonal(y); }

    addFood(x, y, e, k) {
      if (this.nf >= FOOD_CAP) return -1;
      const i = this.nf++;
      this.fx[i] = x; this.fy[i] = y; this.fe[i] = e; this.fk[i] = k;
      return i;
    }
    compactFood() {
      let n = 0;
      const { fx, fy, fe, fk } = this;
      for (let i = 0; i < this.nf; i++) {
        if (fe[i] <= 0.05) continue;
        if (n !== i) { fx[n] = fx[i]; fy[n] = fy[i]; fe[n] = fe[i]; fk[n] = fk[i]; }
        n++;
      }
      this.nf = n;
    }

    environment() {
      const p = this.p, rng = this.rng;
      let plants = 0;
      const decay = 1 - 0.002 * p.meatDecay, decayLin = 0.01 * p.meatDecay;
      for (let i = 0; i < this.nf; i++) {
        if (this.fk[i] === PLANT) {
          plants++;
          if (this.fe[i] < p.plantMax) this.fe[i] = Math.min(p.plantMax, this.fe[i] + p.plantGrowth * (0.5 + this.seasonal(this.fy[i]) * 0.5));
        } else this.fe[i] = this.fe[i] * decay - decayLin;
      }
      this.plantCount = plants;
      // Sprouting: random spots, accepted in proportion to local fertility.
      this.plantAcc += p.plantRate * this.W * this.H / 160000;
      const room = p.plantCap - plants;
      while (this.plantAcc >= 1) {
        this.plantAcc -= 1;
        if (plants >= p.plantCap || room <= 0) continue;
        const x = rng.next() * this.W, y = rng.next() * this.H;
        if (rng.next() < this.fertAt(x, y)) { this.addFood(x, y, 3, PLANT); plants++; }
      }
    }

    // ---------------- creatures ----------------
    spawn(genome, x, y, speciesId, gen) {
      const a = this.rng.next() * TAU;
      const c = new Creature(genome, x, y, a, speciesId, gen);
      c.born = this.t;
      c.phase = this.rng.next() * TAU;
      this.creatures.push(c);
      this.phylo.born(speciesId, this.t);
      return c;
    }
    grow(c) {
      const g = Math.min(1, c.age / c.ph.matureAge);
      const r = c.ph.adultR * (0.55 + 0.45 * g);
      if (r !== c.r) {
        const hf = c.health / c.maxHealth;
        c.r = r; c.mass = (r / 8) ** 2; c.maxHealth = 15 + 35 * c.mass; c.health = hf * c.maxHealth;
      }
    }

    sense(c) {
      const inp = c.inp, ph = c.ph;
      const R = ph.sightR, R2 = R * R, half = ph.fov * 0.5, secW = ph.fov / NS;
      for (let i = 0; i < NS * NCH; i++) inp[i] = 0;
      const cx = c.x, cy = c.y, ca = c.a;
      const cs = Math.cos(ca), sn = Math.sin(ca);
      const front = half < Math.PI / 2;   // narrow eyes cannot see anything behind them
      // Food
      {
        const g = this.fgrid, gs = g.cs, x0 = g.cx(cx - R), x1 = g.cx(cx + R), y0 = g.cy(cy - R), y1 = g.cy(cy + R);
        const { fx, fy, fe, fk } = this, st = g.start, idx = g.idx;
        for (let gy = y0; gy <= y1; gy++) {
          const ddy = Math.max(0, gy * gs - cy, cy - (gy + 1) * gs);
          for (let gx = x0; gx <= x1; gx++) {
            const ddx = Math.max(0, gx * gs - cx, cx - (gx + 1) * gs);
            if (ddx * ddx + ddy * ddy > R2) continue;
            const cell = gx + gy * g.nx;
            for (let k = st[cell], e = st[cell + 1]; k < e; k++) {
              const i = idx[k];
              if (fe[i] <= 0) continue;
              const dx = fx[i] - cx, dy = fy[i] - cy, d2 = dx * dx + dy * dy;
              if (d2 > R2 || d2 < 1e-6) continue;
              const along = dx * cs + dy * sn;
              if (front && along <= 0) continue;
              const rel = fastAtan2(dy * cs - dx * sn, along);
              if (rel < -half || rel > half) continue;
              let s = ((rel + half) / secW) | 0; if (s >= NS) s = NS - 1;
              const cl = 1 - Math.sqrt(d2) / R, slot = s * NCH + fk[i];
              if (cl > inp[slot]) inp[slot] = cl;
            }
          }
        }
      }
      // Other creatures
      {
        const g = this.cgrid, x0 = g.cx(cx - R), x1 = g.cx(cx + R), y0 = g.cy(cy - R), y1 = g.cy(cy + R);
        const st = g.start, idx = g.idx, cr = this.creatures, hue = ph.hue * Math.PI / 180;
        for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
          const cell = gx + gy * g.nx;
          for (let k = st[cell], e = st[cell + 1]; k < e; k++) {
            const o = cr[idx[k]];
            if (o === c || !o.alive) continue;
            const dx = o.x - cx, dy = o.y - cy, d2 = dx * dx + dy * dy;
            if (d2 > R2) continue;
            const along = dx * cs + dy * sn;
            if (front && along <= 0) continue;
            const rel = fastAtan2(dy * cs - dx * sn, along);
            if (rel < -half || rel > half) continue;
            let s = ((rel + half) / secW) | 0; if (s >= NS) s = NS - 1;
            const cl = Math.max(0, 1 - (Math.sqrt(d2) - o.r) / R), b = s * NCH;
            if (cl > inp[b + 2]) {
              inp[b + 2] = cl;
              inp[b + 3] = Math.cos(hue - o.ph.hue * Math.PI / 180);
              inp[b + 4] = Math.tanh(2 * (o.r - c.r) / c.r);
            }
          }
        }
      }
      const tx = cs > 1e-6 ? (this.W - cx) / cs : cs < -1e-6 ? -cx / cs : 1e9;
      const ty = sn > 1e-6 ? (this.H - cy) / sn : sn < -1e-6 ? -cy / sn : 1e9;
      inp[IN.energy] = c.energy / ph.cap;
      inp[IN.health] = c.health / c.maxHealth;
      inp[IN.age] = Math.min(1.5, c.age / ph.maxAge);
      inp[IN.speed] = Math.min(1.5, Math.hypot(c.vx, c.vy) / 3);
      inp[IN.wall] = Math.max(0, 1 - Math.min(tx, ty) / R);
      inp[IN.pain] = Math.min(1, c.pain * 6 / c.maxHealth);
      inp[IN.clock] = Math.sin(c.phase);
      inp[IN.fertility] = this.baseFert(cx, cy);
      inp[IN.bias] = 1;
    }

    // Movement, eating, fighting, metabolism. Returns nothing; marks deaths and breeding wishes.
    act(c) {
      const p = this.p, ph = c.ph, out = c.out;
      let fwd = out[0]; if (fwd < 0) fwd *= 0.4;
      const turn = out[1];
      c.a = wrapAngle(c.a + turn * ph.turnRate);
      const cs = Math.cos(c.a), sn = Math.sin(c.a);
      c.vx = (c.vx + cs * fwd * ph.accel) * 0.88;
      c.vy = (c.vy + sn * fwd * ph.accel) * 0.88;
      const ox = c.x, oy = c.y;
      c.x += c.vx; c.y += c.vy;
      const r = c.r;
      if (c.x < r) { c.x = r; c.vx = Math.abs(c.vx) * 0.3; } else if (c.x > this.W - r) { c.x = this.W - r; c.vx = -Math.abs(c.vx) * 0.3; }
      if (c.y < r) { c.y = r; c.vy = Math.abs(c.vy) * 0.3; } else if (c.y > this.H - r) { c.y = this.H - r; c.vy = -Math.abs(c.vy) * 0.3; }
      c.dist += Math.hypot(c.x - ox, c.y - oy);
      c.tail += 0.15 + Math.abs(fwd) * 0.5;

      const m = c.mass;
      let cost = p.basal * 0.022 * Math.pow(m, 0.75);
      cost += 0.03 * m * fwd * fwd * (0.4 + ph.muscle);
      cost += 0.004 * m * turn * turn;
      cost += 0.000012 * ph.sightR * ph.fov;
      cost += 0.00004 * c.genome.nnz;
      cost += 0.012 * ph.armor * m;

      // Mouth
      const mx = c.x + cs * r * 0.85, my = c.y + sn * r * 0.85, reach = r * 0.5 + 2;
      c.ate = Math.max(0, c.ate - 1);
      let appetite = 2.5 * Math.sqrt(m);
      if (c.energy < ph.cap) {
        const g = this.fgrid, rr = reach + 6;
        const x0 = g.cx(mx - rr), x1 = g.cx(mx + rr), y0 = g.cy(my - rr), y1 = g.cy(my + rr);
        const { fx, fy, fe, fk } = this, st = g.start, idx = g.idx;
        for (let gy = y0; gy <= y1 && appetite > 0; gy++) for (let gx = x0; gx <= x1 && appetite > 0; gx++) {
          const cell = gx + gy * g.nx;
          for (let k = st[cell], e = st[cell + 1]; k < e && appetite > 0; k++) {
            const i = idx[k];
            const ev = fe[i]; if (ev <= 0) continue;
            const kind = fk[i], eff = kind === PLANT ? ph.plantEff : ph.meatEff;
            if (eff < 0.03) continue;
            const fr = kind === PLANT ? 1.2 + Math.sqrt(ev) * 0.45 : 1.5 + Math.sqrt(ev) * 0.35;
            const dx = fx[i] - mx, dy = fy[i] - my;
            if (dx * dx + dy * dy > (reach + fr) * (reach + fr)) continue;
            const value = kind === PLANT ? eff : eff * MEAT_VALUE;
            const room = (ph.cap - c.energy) / value;
            const take = Math.min(ev, appetite, room);
            if (take <= 0) continue;
            fe[i] = ev - take; appetite -= take;
            const gain = take * value;
            c.energy += gain; c.ate = 6; c.ateKind = kind;
            if (kind === PLANT) { c.plantE += gain; this.stats.plantE += gain; } else { c.meatE += gain; this.stats.meatE += gain; }
          }
        }
      }

      // Bite
      c.biting = Math.max(0, c.biting - 1);
      if (out[2] > 0) {
        cost += 0.01 * m;
        const g = this.cgrid, rr = reach + 16;
        const x0 = g.cx(mx - rr), x1 = g.cx(mx + rr), y0 = g.cy(my - rr), y1 = g.cy(my + rr);
        const st = g.start, idx = g.idx, cr = this.creatures;
        let target = null;
        for (let gy = y0; gy <= y1 && !target; gy++) for (let gx = x0; gx <= x1 && !target; gx++) {
          const cell = gx + gy * g.nx;
          for (let k = st[cell], e = st[cell + 1]; k < e; k++) {
            const o = cr[idx[k]];
            if (o === c || !o.alive) continue;
            const dx = o.x - mx, dy = o.y - my, rad = o.r + reach;
            if (dx * dx + dy * dy <= rad * rad) { target = o; break; }
          }
        }
        if (target) {
          const dmg = p.attack * 2 * Math.sqrt(m) * (0.15 + ph.diet) * (1 - 0.75 * target.ph.armor) * out[2];
          target.health -= dmg; target.painNow += dmg;
          const drained = Math.min(Math.max(0, target.energy), dmg * 0.6);
          target.energy -= drained;
          const gain = Math.min(ph.cap - c.energy, (dmg * 1.1 + drained) * ph.meatEff);
          if (gain > 0) { c.energy += gain; c.meatE += gain; this.stats.meatE += gain; }
          c.health -= dmg * target.ph.armor * 0.6;   // spines
          c.biting = 5;
          if (target.health <= 0 && target.alive) { target.cause = 'killed'; c.kills++; target.alive = false; target.killer = c.species; }
        }
      }

      // Healing, ageing
      if (c.health < c.maxHealth && c.energy > 0) { const hl = Math.min(c.maxHealth - c.health, 0.02 * c.maxHealth / 15); c.health += hl; cost += hl * 0.5; }
      c.energy -= cost;
      c.age++; c.phase += ph.clockFreq; if (c.phase > TAU) c.phase -= TAU;
      if (c.cooldown > 0) c.cooldown--;
      if (c.age > ph.maxAge) c.health -= 0.002 * c.maxHealth * (1 + (c.age - ph.maxAge) / 300);
      c.pain = c.pain * 0.8 + c.painNow; c.painNow = 0;
      if ((c.age & 15) === 0) this.grow(c);
      c.wantsBreed = out[3] > 0;
      if (c.alive) {
        if (c.energy <= 0) { c.alive = false; c.cause = 'starved'; }
        else if (c.health <= 0) { c.alive = false; c.cause = c.age > ph.maxAge ? 'old' : 'killed'; }
      }
    }

    canBreed(c, frac) { return c.alive && c.wantsBreed && c.age >= c.ph.matureAge && c.cooldown <= 0 && c.energy >= c.ph.cap * frac; }

    breed(c) {
      const rng = this.rng, p = this.p;
      if (this.creatures.length + this.newborns.length >= MAX_CREATURES) return;
      let mate = null;
      if (p.sexual && this.canBreed(c, 0.4)) {
        const g = this.cgrid, rr = c.r + 20;
        const x0 = g.cx(c.x - rr), x1 = g.cx(c.x + rr), y0 = g.cy(c.y - rr), y1 = g.cy(c.y + rr);
        const st = g.start, idx = g.idx, cr = this.creatures;
        for (let gy = y0; gy <= y1 && !mate; gy++) for (let gx = x0; gx <= x1 && !mate; gx++) {
          const cell = gx + gy * g.nx;
          for (let k = st[cell], e = st[cell + 1]; k < e; k++) {
            const o = cr[idx[k]];
            if (o === c || !this.canBreed(o, 0.4)) continue;
            const dx = o.x - c.x, dy = o.y - c.y, rad = o.r + c.r + 5;
            if (dx * dx + dy * dy > rad * rad) continue;
            if (o.species !== c.species && PR.distance(o.genome, c.genome) > p.specThresh * 1.5) continue;
            mate = o; break;
          }
        }
      }
      let genome, energy, gen, parents;
      if (mate) {
        genome = PR.mutate(PR.crossover(c.genome, mate.genome, rng), rng, p.mutScale);
        const e1 = c.energy * c.ph.invest * 0.5, e2 = mate.energy * mate.ph.invest * 0.5;
        c.energy -= e1 * 1.05; mate.energy -= e2 * 1.05;
        energy = e1 + e2;
        gen = Math.max(c.gen, mate.gen) + 1;
        mate.cooldown = Math.round(60 + mate.ph.matureAge * 0.2); mate.kids++;
        parents = [c.id, mate.id];
        this.stats.sexual++;
      } else {
        if (!this.canBreed(c, 0.55)) return;
        genome = PR.mutate(c.genome, rng, p.mutScale);
        energy = c.energy * c.ph.invest;
        c.energy -= energy * 1.1;
        gen = c.gen + 1;
        parents = [c.id];
      }
      c.cooldown = Math.round(60 + c.ph.matureAge * 0.2); c.kids++;
      // Which species is the child? Compare with the founder of the parent's species.
      let spId = c.species;
      const sp = this.phylo.get(spId);
      if (sp.founder && PR.distance(genome, sp.founder) > p.specThresh) {
        const ns = this.phylo.create(spId, genome.clone(), this.t);
        spId = ns.id; this.stats.speciations++;
      }
      const ph = PR.express(genome.genes);
      const back = c.r + ph.adultR * 0.55 + 1;
      const ch = new Creature(genome, clamp(c.x - Math.cos(c.a) * back, 2, this.W - 2), clamp(c.y - Math.sin(c.a) * back, 2, this.H - 2), c.a + rng.gauss() * 0.5, spId, gen);
      ch.energy = Math.min(ph.cap, energy);
      ch.born = this.t; ch.phase = rng.next() * TAU; ch.parents = parents;
      this.newborns.push(ch);
      this.stats.births++;
    }

    collide() {
      const g = this.cgrid, st = g.start, idx = g.idx, cr = this.creatures;
      for (let gy = 0; gy < g.ny; gy++) for (let gx = 0; gx < g.nx; gx++) {
        const cell = gx + gy * g.nx;
        for (let k = st[cell], e = st[cell + 1]; k < e; k++) {
          const a = cr[idx[k]];
          for (let ny = gy; ny <= gy + 1 && ny < g.ny; ny++) for (let nx = gx - 1; nx <= gx + 1; nx++) {
            if (nx < 0 || nx >= g.nx || (ny === gy && nx < gx)) continue;
            const c2 = nx + ny * g.nx;
            for (let k2 = (c2 === cell ? k + 1 : st[c2]), e2 = st[c2 + 1]; k2 < e2; k2++) {
              const b = cr[idx[k2]];
              const dx = b.x - a.x, dy = b.y - a.y, rad = a.r + b.r, d2 = dx * dx + dy * dy;
              if (d2 >= rad * rad || d2 < 1e-9) continue;
              const d = Math.sqrt(d2), ov = (rad - d) * 0.5, wa = b.mass / (a.mass + b.mass), wb = 1 - wa;
              const ux = dx / d, uy = dy / d;
              a.x -= ux * ov * wa * 2; a.y -= uy * ov * wa * 2;
              b.x += ux * ov * wb * 2; b.y += uy * ov * wb * 2;
            }
          }
        }
      }
    }

    kill(c) {
      const meat = 25 * c.mass + 0.4 * Math.max(0, c.energy);
      if (meat > 1) this.addFood(c.x, c.y, Math.min(meat, 160), MEAT);
      const cause = c.cause || 'killed';
      this.stats[cause] = (this.stats[cause] || 0) + 1;
      const sp = this.phylo.get(c.species);
      if (this.phylo.died(c.species, this.t) && sp.peak >= 8) {
        const by = cause === 'killed' && c.killer && c.killer !== c.species ? `, the last one killed by ${this.phylo.get(c.killer).name}` : cause === 'smitten' ? ', struck down by a divine hand' : '';
        this.log('extinct', `${sp.name} is extinct after ${PR.fmt(this.t - sp.born)} ticks (peak ${sp.peak})${by}.`, sp.id);
      }
    }

    immigrate() {
      const rng = this.rng;
      const g0 = PR.randomGenome(rng, { diet: rng.chance(0.2) ? rng.range(0.6, 0.9) : undefined });
      const sp = this.phylo.create(0, g0, this.t, { immigrant: true });
      sp.established = true;
      const [cx, cy] = this.fertileSpot();
      for (let i = 0; i < 10; i++) {
        const c = this.spawn(i ? PR.mutate(g0, rng, 1) : g0.clone(), clamp(cx + rng.gauss() * 50, 10, this.W - 10), clamp(cy + rng.gauss() * 50, 10, this.H - 10), sp.id, 0);
        c.energy = c.ph.cap * 0.7; c.age = c.ph.matureAge; this.grow(c);
      }
      this.stats.immigrants++;
      this.log('immigrant', `New life drifts in: ${sp.name}.`, sp.id);
    }

    // ---------------- main step ----------------
    step() {
      this.environment();
      const cr = this.creatures, n = cr.length;
      this.fgrid.build(this.fx, this.fy, this.nf);
      for (let i = 0; i < n; i++) { this.cxs[i] = cr[i].x; this.cys[i] = cr[i].y; }
      this.cgrid.build(this.cxs, this.cys, n);

      for (let i = 0; i < n; i++) { const c = cr[i]; this.sense(c); PR.think(c.genome.brain, c.inp, c.h, this.tmpH, c.out); }
      for (let i = 0; i < n; i++) { const c = cr[i]; if (c.alive) this.act(c); }
      for (let i = 0; i < n; i++) { const c = cr[i]; if (c.alive && c.wantsBreed) this.breed(c); }
      this.collide();

      // Deaths and births
      let w = 0;
      for (let i = 0; i < n; i++) { const c = cr[i]; if (c.alive) cr[w++] = c; else this.kill(c); }
      cr.length = w;
      for (const c of this.newborns) {
        cr.push(c);
        this.phylo.born(c.species, this.t);
        const sp = this.phylo.get(c.species);
        if (!sp.established && sp.count >= 8) this.announce(sp);
      }
      this.newborns.length = 0;
      this.compactFood();

      this.t++;
      if (cr.length < this.p.minPop && this.t % 60 === 0) this.immigrate();
      if (this.t % this.sampleEvery === 0) this.sample();
    }

    announce(sp) {
      sp.established = true;
      const parent = this.phylo.get(sp.parent);
      const T = PR.T, g = sp.genes, pg = parent.genes;
      const notes = [];
      if (pg) {
        const d = (k, lo, hi) => g[T[k]] - pg[T[k]] > 0.12 ? hi : pg[T[k]] - g[T[k]] > 0.12 ? lo : null;
        for (const s of [d('diet', 'more of a grazer', 'more of a hunter'), d('size', 'smaller', 'larger'), d('speed', 'weaker swimmers', 'stronger swimmers'), d('armor', 'less armoured', 'more armoured'), d('sight', 'shorter-sighted', 'longer-sighted')]) if (s) notes.push(s);
      }
      this.log('species', `${sp.name} branches off from ${parent.name}${notes.length ? ': ' + notes.slice(0, 2).join(', ') : ''}.`, sp.id);
      if (!this.records.firstPredator && g[T.diet] > 0.65) {
        this.records.firstPredator = true;
        this.log('milestone', `The first true predator: ${sp.name}.`, sp.id);
      }
    }

    log(type, text, sp) {
      this.events.push({ t: this.t, type, text, sp: sp || 0 });
      if (this.events.length > 400) this.events.splice(0, this.events.length - 400);
    }

    // ---------------- history ----------------
    sample() {
      const cr = this.creatures, n = cr.length;
      const counts = new Map();
      let diet = 0, size = 0, speed = 0, sight = 0, fov = 0, armor = 0, nnz = 0, mut = 0, gen = 0, maxGen = 0, herb = 0, omni = 0, carn = 0, energy = 0;
      for (const c of cr) {
        counts.set(c.species, (counts.get(c.species) || 0) + 1);
        const ph = c.ph;
        diet += ph.diet; size += ph.adultR; speed += ph.muscle; sight += ph.sightR; fov += ph.fov; armor += ph.armor;
        nnz += c.genome.nnz; mut += Math.log10(ph.mutRate); gen += c.gen; if (c.gen > maxGen) maxGen = c.gen;
        energy += c.energy;
        if (ph.diet < 0.35) herb++; else if (ph.diet > 0.6) carn++; else omni++;
      }
      let plantE = 0, meatE = 0, plants = 0;
      for (let i = 0; i < this.nf; i++) { if (this.fk[i] === PLANT) { plantE += this.fe[i]; plants++; } else meatE += this.fe[i]; }
      const d = Math.max(1, n);
      const sp = [];
      for (const [id, c] of counts) sp.push(id, c);
      this.history.push({
        t: this.t, pop: n, plants, plantE, meatE, species: counts.size, sp,
        diet: diet / d, size: size / d, speed: speed / d, sight: sight / d, fov: fov / d, armor: armor / d,
        nnz: nnz / d, mut: mut / d, gen: gen / d, maxGen, herb, omni, carn, energy,
        births: this.stats.births, killed: this.stats.killed, starved: this.stats.starved,
      });
      this.milestones(n, maxGen, carn);
      if (n > this.records.pop) this.records.pop = n;
      if (counts.size > this.records.species) this.records.species = counts.size;
      if (maxGen > this.records.gen) this.records.gen = maxGen;
      // Crash detection
      const H = this.history, back = H.length - 1 - Math.round(1500 / this.sampleEvery);
      if (back >= 0 && H[back].pop > 60 && n < H[back].pop * 0.35 && (!this._lastCrash || this.t - this._lastCrash > 4000)) {
        this._lastCrash = this.t;
        this.log('crash', `Population crash: from ${H[back].pop} to ${n} in ${this.t - H[back].t} ticks.`);
      }
      if (H.length > 1600) {
        this.history = H.filter((_, i) => i % 2 === 0 || i === H.length - 1);
        this.sampleEvery *= 2;
      }
    }

    milestones(n, maxGen, carn) {
      const rc = this.records;
      for (const g of [10, 25, 50, 100, 200, 500, 1000]) {
        if (maxGen >= g && (rc.genMark || 0) < g) { rc.genMark = g; this.log('milestone', `Generation ${g} is born.`); }
      }
      const share = n ? carn / n : 0, levels = [0.1, 0.25, 0.4];
      let lv = rc.hunterLevel || 0;
      if (this.t < 1500) {   // the founding hunters are not news; settle silently
        lv = 0; while (lv < levels.length && share >= levels[lv]) lv++;
      } else if (lv < levels.length && share >= levels[lv] && n > 50) {
        while (lv < levels.length && share >= levels[lv]) lv++;
        this.log('milestone', `Hunters now make up ${Math.round(share * 100)}% of all life.`);
      } else if (lv > 0 && share < levels[lv - 1] * 0.4) {
        while (lv > 0 && share < levels[lv - 1] * 0.4) lv--;
        this.log('crash', `Hunters dwindle to ${Math.round(share * 100)}% of all life.`);
      }
      rc.hunterLevel = lv;
    }

    // ---------------- tools ----------------
    feed(x, y, rad, n) {
      for (let i = 0; i < n; i++) {
        const a = this.rng.next() * TAU, r = Math.sqrt(this.rng.next()) * rad;
        this.addFood(clamp(x + Math.cos(a) * r, 1, this.W - 1), clamp(y + Math.sin(a) * r, 1, this.H - 1), this.p.plantMax * 0.8, PLANT);
      }
    }
    paintFertility(x, y, rad, amt) {
      const i0 = clamp(((x - rad) / FS) | 0, 0, this.fw - 1), i1 = clamp(((x + rad) / FS) | 0, 0, this.fw - 1);
      const j0 = clamp(((y - rad) / FS) | 0, 0, this.fh - 1), j1 = clamp(((y + rad) / FS) | 0, 0, this.fh - 1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) * FS - x, dy = (j + 0.5) * FS - y, d = Math.sqrt(dx * dx + dy * dy);
        if (d > rad) continue;
        const k = i + j * this.fw, f = 1 - d / rad;
        this.fert[k] = clamp(this.fert[k] + amt * f * f, 0, 1);
      }
      this.fertVersion++;
    }
    // Remove every creature the predicate picks. Used by tools; never during a step.
    cull(pred, cause) {
      let n = 0;
      for (const c of this.creatures) if (c.alive && pred(c)) { c.alive = false; c.cause = cause; n++; }
      if (!n) return 0;
      const cr = this.creatures; let w = 0;
      for (let i = 0; i < cr.length; i++) { const c = cr[i]; if (c.alive) cr[w++] = c; else this.kill(c); }
      cr.length = w;
      return n;
    }
    smite(x, y, rad) {
      return this.cull(c => (c.x - x) ** 2 + (c.y - y) ** 2 < (rad + c.r) ** 2, 'smitten');
    }
    // Release copies of a genome (e.g. from the specimen jar) as a new immigrant species.
    release(genome, x, y, n = 6, label) {
      const sp = this.phylo.create(0, genome.clone(), this.t, { immigrant: true });
      sp.established = true;
      for (let i = 0; i < n; i++) {
        const c = this.spawn(i ? PR.mutate(genome, this.rng, 0.5) : genome.clone(), clamp(x + this.rng.gauss() * 30, 5, this.W - 5), clamp(y + this.rng.gauss() * 30, 5, this.H - 5), sp.id, 0);
        c.energy = c.ph.cap * 0.7; c.age = c.ph.matureAge; this.grow(c);
      }
      this.log('immigrant', `${label || 'A specimen'} is released as ${sp.name}.`, sp.id);
      return sp;
    }

    creatureAt(x, y, slop = 6) {
      let best = null, bd = Infinity;
      for (const c of this.creatures) {
        const d = Math.hypot(c.x - x, c.y - y) - c.r;
        if (d < slop && d < bd) { bd = d; best = c; }
      }
      return best;
    }

    // ---------------- save / load ----------------
    toJSON() {
      const nf = this.nf;
      return {
        app: 'primordial', v: 1, landscape: this.landscape, seedName: this.seedName, seed: this.seed, W: this.W, H: this.H, t: this.t, p: this.p,
        rng: this.rng.state(), fert: PR.f32ToB64(this.fert),
        food: { x: PR.f32ToB64(this.fx.slice(0, nf)), y: PR.f32ToB64(this.fy.slice(0, nf)), e: PR.f32ToB64(this.fe.slice(0, nf)), k: Array.from(this.fk.subarray(0, nf)).join('') },
        creatures: this.creatures.map(c => ({
          // Full precision, so a loaded world continues exactly as the saved one would have.
          g: c.genome.toJSON(), s: c.species, gen: c.gen, x: c.x, y: c.y, a: c.a, vx: c.vx, vy: c.vy, age: c.age,
          e: c.energy, hp: c.health, r: c.r, cd: c.cooldown, ph: c.phase, pain: c.pain, pn: c.painNow, h: Array.from(c.h), born: c.born,
          id: c.id, par: c.parents, kids: c.kids, kills: c.kills, pE: +c.plantE.toFixed(1), mE: +c.meatE.toFixed(1), dist: Math.round(c.dist),
        })),
        phylo: this.phylo.toJSON(), history: this.history, sampleEvery: this.sampleEvery, events: this.events,
        stats: this.stats, records: this.records, plantAcc: this.plantAcc,
      };
    }
    static fromJSON(o) {
      if (!o || o.app !== 'primordial') throw new Error('Not a Primordial save file');
      const w = new World({ seed: o.seedName, W: o.W, H: o.H, params: o.p, empty: true });
      w.seed = o.seed; w.t = o.t; w.rng.setState(o.rng); w.landscape = o.landscape || 'meadows';
      w.fert = PR.b64ToF32(o.fert); w.fertVersion++;
      const fx = PR.b64ToF32(o.food.x), fy = PR.b64ToF32(o.food.y), fe = PR.b64ToF32(o.food.e);
      for (let i = 0; i < fx.length && i < FOOD_CAP; i++) w.addFood(fx[i], fy[i], fe[i], +o.food.k[i]);
      w.phylo = PR.Phylo.fromJSON(o.phylo);
      for (const r of o.creatures) {
        const c = new Creature(PR.Genome.fromJSON(r.g), r.x, r.y, r.a, r.s, r.gen);
        Object.assign(c, { vx: r.vx, vy: r.vy, age: r.age, energy: r.e, cooldown: r.cd, phase: r.ph, pain: r.pain || 0, painNow: r.pn || 0, born: r.born, kids: r.kids, kills: r.kills, plantE: r.pE, meatE: r.mE, dist: r.dist });
        if (r.id) { c.id = r.id; if (r.id >= nextUid) nextUid = r.id + 1; }
        c.parents = r.par || [];
        c.h.set(r.h);
        if (r.r) { c.r = r.r; c.mass = (c.r / 8) ** 2; c.maxHealth = 15 + 35 * c.mass; } else w.grow(c);
        c.health = r.hp;
        w.creatures.push(c);
        w.phylo.get(c.species).count++;
      }
      w.phylo.alive = w.phylo.list.filter(s => s.count > 0).length;
      w.history = o.history; w.sampleEvery = o.sampleEvery; w.events = o.events;
      Object.assign(w.stats, o.stats); Object.assign(w.records, o.records); w.plantAcc = o.plantAcc || 0;
      return w;
    }
  }

  PR.World = World;
  PR.Creature = Creature;
  PR.DEFAULTS = DEFAULTS;
  PR.LANDSCAPES = LANDSCAPES;
  PR.PARAM_INFO = PARAM_INFO;
  PR.FOOD = { PLANT, MEAT, CAP: FOOD_CAP };
  PR.FS = FS;
  PR.MAX_CREATURES = MAX_CREATURES;
})(globalThis);
