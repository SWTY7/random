// Headless checks: node tools/check.js [ticks]
// Runs several seeds, checks invariants as it goes, then checks that a saved world reloads and continues identically.
const fs = require('fs'), path = require('path'), vm = require('vm');
globalThis.performance = globalThis.performance || require('perf_hooks').performance;
for (const f of ['core.js', 'genome.js', 'species.js', 'world.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), { filename: f });
const PR = globalThis.PR;
const T = +(process.argv[2] || 24000);
let fail = 0;
const ok = (c, msg) => { if (!c) { fail++; console.log('  FAIL', msg); } };

function invariants(w, tag) {
  const counts = new Map();
  for (const c of w.creatures) {
    if (![c.x, c.y, c.a, c.vx, c.vy, c.energy, c.health].every(Number.isFinite)) { ok(false, `${tag}: NaN in creature #${c.id}`); return; }
    if (c.x < 0 || c.x > w.W || c.y < 0 || c.y > w.H) { ok(false, `${tag}: #${c.id} outside the world`); return; }
    if (c.energy > c.ph.cap + 1e-6) { ok(false, `${tag}: #${c.id} over capacity`); return; }
    counts.set(c.species, (counts.get(c.species) || 0) + 1);
  }
  for (let i = 0; i < w.nf; i++) if (!Number.isFinite(w.fe[i]) || w.fe[i] <= 0) { ok(false, `${tag}: bad food ${i}`); return; }
  let alive = 0;
  for (const s of w.phylo.list) {
    if (s.id === 0) continue;
    if ((counts.get(s.id) || 0) !== s.count) { ok(false, `${tag}: species ${s.id} count ${s.count} vs ${counts.get(s.id) || 0}`); return; }
    if (s.count > 0) { alive++; if (!s.founder) { ok(false, `${tag}: living species ${s.id} lost its founder`); return; } }
  }
  ok(alive === w.phylo.alive, `${tag}: alive species ${w.phylo.alive} vs ${alive}`);
}

// Sanity of the brain and genome machinery
{
  const rng = new PR.RNG(7);
  const g = PR.randomGenome(rng);
  ok(g.brain.length === PR.NB && PR.NI === 34, 'brain layout');
  const m = PR.mutate(g, rng, 1);
  ok(PR.distance(g, g) === 0 && PR.distance(g, m) > 0, 'distance');
  const x = PR.crossover(g, m, rng);
  ok(x.brain.every((v, i) => v === g.brain[i] || v === m.brain[i]), 'crossover only copies parental weights');
  const back = PR.Genome.fromJSON(JSON.parse(JSON.stringify(g)));
  ok(back.brain.every((v, i) => v === g.brain[i]) && back.genes.every((v, i) => v === g.genes[i]), 'genome JSON round trip');
  const h = new Float32Array(PR.NH), tmp = new Float32Array(PR.NH), out = new Float32Array(PR.NO), inp = new Float32Array(PR.NI);
  inp[PR.IN.bias] = 1; inp[4 * PR.NCH] = 0.9;   // a plant far to the right
  PR.think(g.brain, inp, h, tmp, out);
  ok(out[1] > 0, 'ancestral wiring turns toward a plant on the right');
}

const seeds = ['amber-pool-11', 'reef-shoal-42', 'silt-marsh-77'];
for (const seed of seeds) {
  const t0 = Date.now();
  const w = new PR.World({ seed });
  let minPop = Infinity, maxPop = 0, maxCarn = 0, maxSpecies = 0, sumSpecies = 0, nSpecies = 0, sumCarnFrac = 0;
  for (let i = 1; i <= T; i++) {
    w.step();
    if (i % 1000 === 0) {
      invariants(w, `${seed}@${i}`);
      const n = w.creatures.length; minPop = Math.min(minPop, n); maxPop = Math.max(maxPop, n);
      maxCarn = Math.max(maxCarn, w.creatures.filter(c => c.ph.diet > 0.6).length);
      maxSpecies = Math.max(maxSpecies, w.phylo.alive); sumSpecies += w.phylo.alive; nSpecies++;
      sumCarnFrac += w.creatures.filter(c => c.ph.diet > 0.6).length / Math.max(1, n);
    }
  }
  const h = w.history[w.history.length - 1];
  console.log(`${seed.padEnd(14)} pop ${w.creatures.length} (min ${minPop}, max ${maxPop}) · species ${w.phylo.alive} (mean ${(sumSpecies / nSpecies).toFixed(1)}, max ${maxSpecies}) · named ${w.phylo.size - 1} · ` +
    `hunters max ${maxCarn}, mean share ${(sumCarnFrac / nSpecies * 100).toFixed(0)}% · gen ${h.maxGen} · kills ${w.stats.killed} · mated ${w.stats.sexual}/${w.stats.births} · immigrants ${w.stats.immigrants} · ${((Date.now() - t0) / T).toFixed(2)} ms/tick`);
  ok(minPop > 0, seed + ': life died out completely');
  ok(w.phylo.size - 1 > 8, seed + ': too little speciation');
  ok(h.maxGen >= 8, seed + ': evolution too slow');
  ok(w.stats.sexual > 0, seed + ': nobody ever mated');
  ok(w.history.length > 10 && w.events.length > 1, seed + ': no history');

  // Save, reload, and check both continue identically.
  const json = JSON.stringify(w);
  const w2 = PR.World.fromJSON(JSON.parse(json));
  invariants(w2, seed + ' reloaded');
  for (let i = 0; i < 400; i++) { w.step(); w2.step(); }
  const same = w.creatures.length === w2.creatures.length && w.creatures.every((c, i) => c.x === w2.creatures[i].x && c.energy === w2.creatures[i].energy);
  ok(same, seed + ': reloaded world diverged');
  console.log(`  save ${(json.length / 1024).toFixed(0)} kB, reload continues ${same ? 'identically' : 'DIFFERENTLY'}`);
}

// Every landscape should support life for a while.
for (const land of Object.keys(PR.LANDSCAPES)) {
  const w = new PR.World({ seed: 'land-' + land, landscape: land });
  for (let i = 1; i <= 4000; i++) { w.step(); if (i % 1000 === 0) invariants(w, land + '@' + i); }
  console.log(`${land.padEnd(9)} pop ${w.creatures.length} · species ${w.phylo.alive} · named ${w.phylo.size - 1}`);
  ok(w.creatures.length > 100 && w.stats.immigrants === 0, land + ': could not support its founders');
}

// Tools
{
  const w = new PR.World({ seed: 'tools' });
  for (let i = 0; i < 200; i++) w.step();
  const n0 = w.creatures.length, killed = w.smite(w.creatures[0].x, w.creatures[0].y, 200);
  ok(killed > 0 && w.creatures.length === n0 - killed, 'smite');
  const f0 = w.nf; w.feed(500, 500, 50, 30); ok(w.nf === f0 + 30, 'feed');
  const before = w.baseFert(800, 800); w.paintFertility(800, 800, 100, 0.5); ok(w.baseFert(800, 800) > before || before === 1, 'paint fertility');
  const sp = w.release(w.creatures[0].genome, 300, 300, 5, 'test'); ok(sp.count === 5, 'release');
  for (let i = 0; i < 50; i++) w.step();
  invariants(w, 'tools');
}

console.log(fail ? `${fail} failure(s)` : 'all good');
process.exit(fail ? 1 : 0);
