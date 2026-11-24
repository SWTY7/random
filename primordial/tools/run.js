// Headless run for tuning: node tools/run.js [seed] [ticks] [key=value ...]
const fs = require('fs'), path = require('path'), vm = require('vm');
for (const f of ['core.js', 'genome.js', 'species.js', 'world.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), { filename: f });
const PR = globalThis.PR;
const seed = process.argv[2] || 'tune', T = +(process.argv[3] || 30000);
const params = {};
for (const a of process.argv.slice(4)) { const [k, v] = a.split('='); params[k] = v === 'false' ? false : +v; }
const w = new PR.World({ seed, params });
const t0 = Date.now(); let last = t0;
for (let i = 1; i <= T; i++) {
  w.step();
  if (i % 2000 === 0) {
    const h = w.history[w.history.length - 1], now = Date.now();
    console.log(`t=${String(i).padStart(6)} pop ${String(w.creatures.length).padStart(4)} sp ${String(h.species).padStart(3)} named ${w.phylo.size - 1} plants ${h.plants} pE ${h.plantE.toFixed(0)} meat ${h.meatE.toFixed(0)} | h/o/c ${h.herb}/${h.omni}/${h.carn} diet ${h.diet.toFixed(2)} R ${h.size.toFixed(1)} mus ${h.speed.toFixed(2)} sight ${h.sight.toFixed(0)} arm ${h.armor.toFixed(2)} nnz ${h.nnz.toFixed(0)} mut ${h.mut.toFixed(2)} gen ${h.gen.toFixed(0)}/${h.maxGen} | imm ${w.stats.immigrants} sex ${w.stats.sexual}/${w.stats.births} st ${w.stats.starved} k ${w.stats.killed} old ${w.stats.old} | ${((now - last) / 2000).toFixed(2)}ms/t`);
    last = now;
  }
}
console.log('events:'); for (const e of w.events.slice(-25)) console.log('  ', e.t, e.type, e.text);
