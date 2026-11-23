#!/usr/bin/env node
/* Level checker / stardust placer.
 *   node tools/check.js            -> verify every level is winnable (and winnable with all dust)
 *   node tools/check.js --write    -> place stardust for levels that say `autoDust: N` and rewrite levels.js
 *   node tools/check.js 2-3        -> only that level
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CC = require('../js/physics.js');
require('../js/levels.js');

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const only = args.filter((a) => !a.startsWith('--'));
const NA = 720, NP = 28, PMIN = 0.15;
const TAU = Math.PI * 2;

function grid(L, K) {
  const res = []; // res[pi][ai] = flight summary
  for (let pi = 0; pi < NP; pi++) {
    const row = [];
    const power = PMIN + ((1 - PMIN) * (pi + 0.5)) / NP;
    for (let ai = 0; ai < NA; ai++) {
      const angle = (TAU * ai) / NA;
      const f = CC.simulate(L, K, angle, power);
      row.push({ state: f.state, dust: f.dustCount, t: f.t, angle, power, orbits: f.orbits, worms: f.worms, closest: f.closest });
    }
    res.push(row);
  }
  return res;
}

function robustness(G, pi, ai, pred) {
  let c = 0;
  for (let dp = -1; dp <= 1; dp++) for (let da = -3; da <= 3; da++) {
    const p = pi + dp; if (p < 0 || p >= NP) continue;
    const a = (ai + da + NA) % NA;
    if (pred(G[p][a])) c++;
  }
  return c; // max 21
}

function pathOf(L, K, angle, power) {
  const f = CC.newFlight(L, angle, power);
  const pts = [{ x: f.x, y: f.y }];
  while (f.state === 'flying') { CC.step(L, K, f, null); pts.push({ x: f.x, y: f.y }); }
  return { pts, f };
}

const out = {};
let failures = 0;
for (const raw of CC.LEVELS) {
  if (only.length && !only.includes(raw.id)) continue;
  const t0 = Date.now();
  const L = CC.normalizeLevel(raw);
  const K = new CC.Kinematics(L);
  const G = grid(L, K);
  let wins = 0; const winners = [];
  for (let pi = 0; pi < NP; pi++) for (let ai = 0; ai < NA; ai++) {
    const g = G[pi][ai];
    if (g.state === 'won') { wins++; winners.push({ pi, ai, g }); }
  }
  const total = NA * NP;
  let msg = `${raw.id.padEnd(4)} ${raw.name.en.padEnd(22)} wins ${String(wins).padStart(5)}/${total} (${((100 * wins) / total).toFixed(2)}%)`;

  if (!wins) { console.log(msg + '  ✗ UNWINNABLE'); failures++; continue; }

  if (raw.autoDust) {
    // pick a robust, interesting winner
    let best = null;
    for (const w of winners) {
      const rob = robustness(G, w.pi, w.ai, (x) => x.state === 'won');
      if (rob < 7) continue;
      const tt = w.g.t > 9 ? 9 - (w.g.t - 9) : w.g.t;
      const score = rob * Math.max(0.5, Math.min(tt, 6)) * (1 + 0.3 * w.g.orbits + 0.3 * w.g.worms) * (1 + (w.g.closest < 120 ? 0.4 : 0));
      if (!best || score > best.score) best = { ...w, rob, score };
    }
    if (!best) { console.log(msg + '  ✗ no robust winner to place dust on'); failures++; continue; }
    const { pts } = pathOf(L, K, best.g.angle, best.g.power);
    // arc-length positions
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const len = cum[cum.length - 1];
    const n = raw.autoDust;
    const dust = [];
    for (let k = 1; k <= n; k++) {
      const target = (len * k) / (n + 1);
      let i = cum.findIndex((c) => c >= target);
      const p = pts[Math.max(0, i)];
      dust.push({ x: Math.round(p.x), y: Math.round(p.y) });
    }
    out[raw.id] = dust;
    // re-verify with dust
    const L2 = CC.normalizeLevel(Object.assign({}, raw, { dust }));
    const K2 = new CC.Kinematics(L2);
    const s = CC.solve(L2, { K: K2, angles: NA, powers: NP, pMin: PMIN });
    msg += `  dust→ path ${Math.round(len)}px t=${best.g.t.toFixed(1)}s rob=${best.rob} full-wins=${s.full ? '✓' : '✗'}`;
  } else {
    const fullWins = winners.filter((w) => w.g.dust === L.dust.length).length;
    msg += `  full-dust wins ${fullWins}` + (fullWins ? '  ✓' : '  ✗');
    if (!fullWins) failures++;
  }
  console.log(msg + `  (${Date.now() - t0}ms)`);
}

if (WRITE && Object.keys(out).length) {
  const file = path.join(__dirname, '../js/levels.js');
  let src = fs.readFileSync(file, 'utf8');
  for (const [id, dust] of Object.entries(out)) {
    const re = new RegExp(`(id: '${id}'[\\s\\S]*?)autoDust: \\d+`);
    const dustSrc = 'dust: [' + dust.map((d) => `{ x: ${d.x}, y: ${d.y} }`).join(', ') + ']';
    src = src.replace(re, `$1${dustSrc}`);
  }
  fs.writeFileSync(file, src);
  console.log('wrote dust for', Object.keys(out).join(', '));
}
process.exit(failures ? 1 : 0);
