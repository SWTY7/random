// Headless sanity check: node tools/check.js
const fs = require('fs'), path = require('path'), vm = require('vm');
globalThis.performance = globalThis.performance || require('perf_hooks').performance;
for (const f of ['noise.js', 'terrain.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), { filename: f });
const WS = globalThis.WS;
let fail = 0;
const ok = (c, msg) => { if (!c) { fail++; console.log('  FAIL', msg); } };
const n = 256;
for (const preset of Object.keys(WS.PRESETS)) {
  const t0 = Date.now();
  const g = WS.generate(preset, WS.hashSeed('check-' + preset), n);
  const w = new WS.World(n);
  w.load(g.h, g.sea);
  const sum0 = w.h.reduce((a, b) => a + b, 0);
  const seaFrac0 = g.h.filter(v => v < g.sea).length / g.h.length;
  for (let f = 0; f < 40; f++) { w.rain(3000, 1e9); if (f % 2) w.thermal(0.15); }
  w.hydrology();
  let nan = 0, lo = Infinity, hi = -Infinity, change = 0;
  for (let i = 0; i < w.h.length; i++) {
    const v = w.h[i]; if (!Number.isFinite(v)) nan++;
    lo = Math.min(lo, v); hi = Math.max(hi, v); change += Math.abs(v - w.orig[i]);
  }
  const sum1 = w.h.reduce((a, b) => a + b, 0);
  console.log(`${preset.padEnd(12)} sea ${(seaFrac0 * 100).toFixed(0).padStart(3)}%  range ${lo.toFixed(3)}..${hi.toFixed(3)}  ` +
    `eroded ${w.stats.eroded.toFixed(1)}  toSea ${w.stats.toSea.toFixed(1)}  net ${(sum1 - sum0).toFixed(2)}  ` +
    `mean|dh| ${(change / w.h.length).toExponential(2)}  lakes ${w.stats.lakeCells}  maxAcc ${w.stats.maxAcc}  ${Date.now() - t0}ms`);
  ok(nan === 0, preset + ' has NaN');
  ok(lo > -0.5 && hi < 1.6, preset + ' heights blew up');
  ok(change > 0, preset + ' nothing eroded');
  ok(w.stats.maxAcc > n, preset + ' no rivers');
}
// Speed: droplets per ms
{
  const g = WS.generate('highlands', 1, 384), w = new WS.World(384); w.load(g.h, g.sea);
  const t0 = performance.now(); w.rain(20000, 1e9); const dt = performance.now() - t0;
  const t1 = performance.now(); w.hydrology(); const dh = performance.now() - t1;
  console.log(`384²: ${(20000 / dt).toFixed(0)} drops/ms, hydrology ${dh.toFixed(1)} ms`);
}
console.log(fail ? `${fail} failure(s)` : 'all good');
process.exit(fail ? 1 : 0);
