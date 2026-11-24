// Primordial: charts. Muller plot, phylogeny, trends, trait space, brain.
'use strict';
(function (G) {
  const PR = G.PR;
  const { clamp } = PR;
  const INK = '#cfe3ea', MUTED = '#6f8b96', GRID = 'rgba(160,200,220,0.10)';
  const FONT = '11px -apple-system, "Segoe UI", system-ui, sans-serif';

  function prep(cv) {
    const dpr = Math.min(2, G.devicePixelRatio || 1);
    const w = Math.max(1, cv.clientWidth), h = Math.max(1, cv.clientHeight);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = FONT;
    return { ctx, w, h };
  }
  const tickLabel = t => t >= 1e6 ? (t / 1e6).toFixed(1) + 'M' : t >= 1000 ? (t / 1000).toFixed(t >= 1e4 ? 0 : 1) + 'k' : String(Math.round(t));

  // ---------------- Muller plot ----------------
  // Each species is a band nested inside its parent's band; its height is the size of its whole clade.
  function mullerLayout(world, relative) {
    const H = world.history, n = H.length;
    if (n < 2) return null;
    const ph = world.phylo;
    const inc = new Set([0]);
    for (const s of H) for (let i = 0; i < s.sp.length; i += 2) {
      let a = s.sp[i];
      while (a > 0 && !inc.has(a)) { inc.add(a); a = ph.get(a).parent; }
    }
    const ids = Array.from(inc).sort((a, b) => a - b);
    const K = ids.length, kOf = new Map(ids.map((id, k) => [id, k]));
    const parentK = ids.map(id => id === 0 ? -1 : kOf.get(ph.get(id).parent));
    const kids = ids.map(() => []);
    for (let k = 1; k < K; k++) kids[parentK[k]].push(k);
    const top = ids.map(() => new Float32Array(n).fill(NaN)), bot = ids.map(() => new Float32Array(n).fill(NaN));
    const own = new Float64Array(K), clade = new Float64Array(K);
    let maxPop = 1;
    for (const s of H) if (s.pop > maxPop) maxPop = s.pop;
    for (let j = 0; j < n; j++) {
      const s = H[j];
      own.fill(0); clade.fill(0);
      for (let i = 0; i < s.sp.length; i += 2) own[kOf.get(s.sp[i])] = s.sp[i + 1];
      for (let k = K - 1; k >= 0; k--) { clade[k] += own[k]; if (k > 0) clade[parentK[k]] += clade[k]; }
      const scale = relative ? (clade[0] > 0 ? 1 / clade[0] : 0) : 1 / maxPop;
      const place = (k, y0) => {
        top[k][j] = y0 * scale; bot[k][j] = (y0 + clade[k]) * scale;
        let y = y0 + own[k] / 2;
        for (const c of kids[k]) if (clade[c] > 0) { place(c, y); y += clade[c]; }
      };
      if (clade[0] > 0) place(0, relative ? 0 : (maxPop - clade[0]) / 2);
    }
    // Drawing order: parents before children.
    const order = [];
    const walk = k => { order.push(k); for (const c of kids[k]) walk(c); };
    walk(0);
    return { ids, top, bot, order, n, t0: H[0].t, t1: H[n - 1].t, ts: H.map(s => s.t), maxPop, relative };
  }

  function drawMuller(cv, world, L, hl) {
    const { ctx, w, h } = prep(cv);
    const padB = 16, ph = h - padB;
    ctx.fillStyle = '#081620'; ctx.fillRect(0, 0, w, ph);
    if (!L) { ctx.fillStyle = MUTED; ctx.fillText('History appears after a few hundred ticks.', 10, 20); return; }
    const xs = L.ts.map(t => (t - L.t0) / Math.max(1, L.t1 - L.t0) * w);
    for (const k of L.order) {
      if (k === 0) continue;
      const sp = world.phylo.get(L.ids[k]), T = L.top[k], B = L.bot[k];
      ctx.fillStyle = sp.color(hl && hl !== sp.id ? 0.28 : 0.95);
      let j = 0;
      while (j < L.n) {
        while (j < L.n && (isNaN(T[j]) || B[j] - T[j] <= 0)) j++;
        if (j >= L.n) break;
        const j0 = j;
        while (j < L.n && !isNaN(T[j]) && B[j] - T[j] > 0) j++;
        ctx.beginPath();
        if (j0 > 0) ctx.moveTo(xs[j0 - 1], T[j0] * ph);
        else ctx.moveTo(xs[j0], T[j0] * ph);
        for (let q = j0; q < j; q++) ctx.lineTo(xs[q], T[q] * ph);
        if (j < L.n) ctx.lineTo(xs[j], (T[j - 1] + B[j - 1]) / 2 * ph);
        for (let q = j - 1; q >= j0; q--) ctx.lineTo(xs[q], B[q] * ph);
        ctx.closePath(); ctx.fill();
      }
    }
    if (hl) {
      const k = L.ids.indexOf(hl);
      if (k > 0) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        for (const arr of [L.top[k], L.bot[k]]) {
          ctx.beginPath(); let pen = false;
          for (let j = 0; j < L.n; j++) { if (isNaN(arr[j])) { pen = false; continue; } const y = arr[j] * ph; if (pen) ctx.lineTo(xs[j], y); else { ctx.moveTo(xs[j], y); pen = true; } }
          ctx.stroke();
        }
      }
    }
    axisTime(ctx, L.t0, L.t1, w, ph);
  }
  function mullerHit(L, world, w, h, x, y) {
    if (!L) return 0;
    const ph = h - 16, t = L.t0 + (x / w) * (L.t1 - L.t0);
    let j = 0; while (j < L.n - 1 && L.ts[j + 1] <= t) j++;
    if (j < L.n - 1 && t - L.ts[j] > L.ts[j + 1] - t) j++;
    const yy = y / ph;
    for (let q = L.order.length - 1; q >= 0; q--) {
      const k = L.order[q]; if (k === 0) continue;
      if (!isNaN(L.top[k][j]) && yy >= L.top[k][j] && yy <= L.bot[k][j]) return L.ids[k];
    }
    return 0;
  }
  function axisTime(ctx, t0, t1, w, y) {
    ctx.fillStyle = MUTED; ctx.strokeStyle = GRID; ctx.lineWidth = 1;
    const span = Math.max(1, t1 - t0), step = niceStep(span / 5);
    ctx.textAlign = 'center';
    for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) {
      const x = (t - t0) / span * w;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y); ctx.stroke();
      if (x > 14 && x < w - 14) ctx.fillText(tickLabel(t), x, y + 12);
    }
    ctx.textAlign = 'left';
  }
  function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(x))), m = x / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }

  // ---------------- Phylogeny ----------------
  function treeLayout(world, minPeak) {
    const ph = world.phylo, N = ph.size;
    const keep = new Uint8Array(N);
    for (let id = N - 1; id >= 1; id--) {
      const s = ph.get(id);
      if (s.count > 0 || s.peak >= minPeak || s.children.some(c => keep[c])) keep[id] = 1;
    }
    keep[0] = 1;
    const rows = new Map();
    let row = 0;
    const place = id => {
      const kids = ph.get(id).children.filter(c => keep[c]).sort((a, b) => ph.get(a).born - ph.get(b).born);
      const half = Math.ceil(kids.length / 2);
      for (let i = 0; i < half; i++) place(kids[i]);
      rows.set(id, row++);
      for (let i = half; i < kids.length; i++) place(kids[i]);
    };
    place(0);
    return { rows, nRows: row, keep, t1: Math.max(1, world.t) };
  }
  function drawTree(cv, world, L, hl) {
    const { ctx, w, h } = prep(cv);
    const ph = world.phylo;
    const padL = 6, padR = 8, padB = 16, padT = 14, ih = h - padB - padT - 4;
    const rowH = ih / Math.max(1, L.nRows - 1);
    const X = t => padL + (t / L.t1) * (w - padL - padR);
    const Y = id => padT + L.rows.get(id) * (L.nRows > 1 ? rowH : 0);
    L.X = X; L.Y = Y; L.rowH = rowH;
    axisTime(ctx, 0, L.t1, w, h - padB);
    for (const [id] of L.rows) {
      if (id === 0) continue;
      const s = ph.get(id), y = Y(id), x0 = X(s.born), x1 = X(s.count > 0 ? world.t : (s.died ?? world.t));
      const dim = hl && hl !== id;
      // connector from the parent
      ctx.strokeStyle = dim ? 'rgba(140,170,180,0.15)' : 'rgba(140,170,180,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, s.parent === 0 ? y : Y(s.parent)); ctx.lineTo(x0, y); ctx.stroke();
      ctx.strokeStyle = s.color(dim ? 0.25 : s.count > 0 ? 1 : 0.6);
      ctx.lineWidth = s.count > 0 ? clamp(1.5 + Math.sqrt(s.count) * 0.35, 2, 6) : clamp(rowH * 0.5, 1, 2.2);
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(Math.max(x1, x0 + 1), y); ctx.stroke();
      if (s.count > 0) { ctx.fillStyle = s.color(); ctx.beginPath(); ctx.arc(x1, y, 3, 0, PR.TAU); ctx.fill(); }
      if (id === hl) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(x0 - 2, y - 4, x1 - x0 + 4, 8); }
    }
    if (rowH >= 9) {
      ctx.textAlign = 'right';
      for (const [id] of L.rows) {
        if (id === 0) continue;
        const s = ph.get(id);
        if (s.count <= 0 && id !== hl) continue;
        const x1 = X(world.t);
        ctx.fillStyle = s.color(); ctx.fillText(s.short, x1 - 6, Y(id) - 3);
      }
      ctx.textAlign = 'left';
    }
  }
  function treeHit(L, world, x, y) {
    if (!L || !L.Y) return 0;
    let best = 0, bd = Math.max(5, L.rowH * 0.6);
    for (const [id] of L.rows) {
      if (id === 0) continue;
      const s = world.phylo.get(id), x0 = L.X(s.born), x1 = L.X(s.count > 0 ? world.t : (s.died ?? world.t));
      if (x < x0 - 6 || x > x1 + 6) continue;
      const d = Math.abs(L.Y(id) - y);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }

  // ---------------- Trends ----------------
  const SERIES = [
    { key: 'pop', label: 'Population', stack: true, fmt: v => Math.round(v) },
    { key: 'species', label: 'Living species', color: '#9fd3ff', fmt: v => Math.round(v), lo: 0 },
    { key: 'plantE', label: 'Plant energy', color: '#8fe36a', fmt: v => PR.fmt(v), lo: 0 },
    { key: 'meatE', label: 'Carrion energy', color: '#d0644a', fmt: v => PR.fmt(v), lo: 0 },
    { key: 'diet', label: 'Mean diet (0 plants, 1 meat)', color: '#f08a5d', fmt: v => v.toFixed(2), lo: 0, hi: 1 },
    { key: 'size', label: 'Mean body radius', color: '#e8d27a', fmt: v => v.toFixed(1) },
    { key: 'speed', label: 'Mean muscle', color: '#7ad0c8', fmt: v => v.toFixed(2), lo: 0, hi: 1 },
    { key: 'sight', label: 'Mean sight range', color: '#b5a4ff', fmt: v => Math.round(v) },
    { key: 'armor', label: 'Mean armour', color: '#d8d8c0', fmt: v => v.toFixed(2), lo: 0, hi: 1 },
    { key: 'nnz', label: 'Brain connections', color: '#ff9ed8', fmt: v => Math.round(v), lo: 0 },
    { key: 'mut', label: 'Mutation rate (log₁₀)', color: '#ffb35c', fmt: v => v.toFixed(2) },
    { key: 'gen', label: 'Mean generation', color: '#a8e0a0', fmt: v => Math.round(v) },
  ];
  function drawTrend(cv, world, S) {
    const { ctx, w, h } = prep(cv);
    const H = world.history, n = H.length;
    const top = 16, ih = h - top - 2;
    ctx.fillStyle = MUTED; ctx.fillText(S.label, 0, 11);
    if (n < 2) return;
    const last = H[n - 1];
    const t0 = H[0].t, t1 = last.t, X = t => (t - t0) / Math.max(1, t1 - t0) * w;
    ctx.fillStyle = GRID; ctx.fillRect(0, top, w, ih);
    if (S.stack) {
      let max = 1; for (const s of H) if (s.pop > max) max = s.pop;
      const layers = [['herb', '#6fcf6f'], ['omni', '#e7c65a'], ['carn', '#e2604a']];
      let base = new Float32Array(n);
      for (const [k, col] of layers) {
        ctx.beginPath(); ctx.moveTo(X(H[0].t), top + ih - base[0] / max * ih);
        const nb = new Float32Array(n);
        for (let j = 0; j < n; j++) { nb[j] = base[j] + (H[j][k] || 0); ctx.lineTo(X(H[j].t), top + ih - nb[j] / max * ih); }
        for (let j = n - 1; j >= 0; j--) ctx.lineTo(X(H[j].t), top + ih - base[j] / max * ih);
        ctx.closePath(); ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
        base = nb;
      }
      ctx.textAlign = 'right'; ctx.fillStyle = INK;
      ctx.fillText(`${last.pop}  ·  ${last.herb} grazers · ${last.omni} omnivores · ${last.carn} hunters`, w, 11);
      ctx.textAlign = 'left';
      return;
    }
    let lo = S.lo, hi = S.hi;
    if (lo == null || hi == null) {
      let a = Infinity, b = -Infinity;
      for (const s of H) { const v = s[S.key]; if (v < a) a = v; if (v > b) b = v; }
      const fixedLo = lo != null;
      if (lo == null) lo = a; if (hi == null) hi = b;
      if (hi - lo < 1e-6) { hi += 0.5; if (!fixedLo) lo -= 0.5; }
      const pad = (hi - lo) * 0.08; hi += pad; if (!fixedLo) lo -= pad;
    }
    ctx.strokeStyle = S.color; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let j = 0; j < n; j++) { const y = top + ih - (H[j][S.key] - lo) / (hi - lo) * ih; if (j) ctx.lineTo(X(H[j].t), y); else ctx.moveTo(X(H[j].t), y); }
    ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.fillText(S.fmt(last[S.key]), w, 11); ctx.textAlign = 'left';
  }

  // ---------------- Trait space ----------------
  function drawTraitSpace(cv, world, xi, yi, hl, selected) {
    const { ctx, w, h } = prep(cv);
    const pad = 22;
    ctx.fillStyle = '#081620'; ctx.fillRect(pad, 0, w - pad, h - pad);
    ctx.strokeStyle = GRID;
    for (let q = 1; q < 4; q++) {
      const x = pad + (w - pad) * q / 4, y = (h - pad) * q / 4;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h - pad); ctx.moveTo(pad, y); ctx.lineTo(w, y); ctx.stroke();
    }
    // Zoom to where the population actually is, but never closer than a fifth of the gene's range.
    const range = i => {
      let lo = 1, hi = 0;
      for (const c of world.creatures) { const v = c.genome.genes[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
      if (hi < lo) return [0, 1];
      const mid = (lo + hi) / 2, span = Math.max(0.2, (hi - lo) * 1.15);
      const a = clamp(mid - span / 2, 0, 1 - span);
      return [Math.max(0, a), Math.min(1, a + span)];
    };
    const [xl, xh] = range(xi), [yl, yh] = range(yi);
    const X = v => pad + (v - xl) / (xh - xl) * (w - pad - 4) + 2, Y = v => (h - pad) - (v - yl) / (yh - yl) * (h - pad - 4) - 2;
    ctx.fillStyle = MUTED;
    ctx.fillText(xl.toFixed(2), pad + 3, h - pad + 11); ctx.textAlign = 'right'; ctx.fillText(xh.toFixed(2), w - 2, h - pad + 11); ctx.textAlign = 'left';
    ctx.fillText(yh.toFixed(2), pad + 3, 11); ctx.fillText(yl.toFixed(2), pad + 3, h - pad - 4);
    for (const c of world.creatures) {
      const sp = world.phylo.get(c.species);
      ctx.fillStyle = sp.color(hl && hl !== c.species ? 0.15 : 0.8);
      ctx.fillRect(X(c.genome.genes[xi]) - 1.5, Y(c.genome.genes[yi]) - 1.5, 3, 3);
    }
    if (selected && selected.alive) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X(selected.genome.genes[xi]), Y(selected.genome.genes[yi]), 5, 0, PR.TAU); ctx.stroke();
    }
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'center'; ctx.fillText(PR.TRAITS[xi].name + ' →', pad + (w - pad) / 2, h - 6);
    ctx.save(); ctx.translate(11, (h - pad) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(PR.TRAITS[yi].name + ' →', 0, 0); ctx.restore();
    ctx.textAlign = 'left';
  }

  // ---------------- Brain ----------------
  const SECT = ['⇇', '←', '↑', '→', '⇉'];
  function drawBrain(cv, c) {
    const { ctx, w, h } = prep(cv);
    if (!c) return;
    const b = c.genome.brain, { NI, NH, NO, NCH, OFF_W1, OFF_W2, OFF_W3, OFF_B1, OFF_B2 } = PR;
    const xI = 64, xH = w * 0.55, xO = w - 58;
    const yI = i => 6 + i * (h - 22) / (NI - 1);
    const yH = j => h * 0.12 + j * (h * 0.76) / (NH - 1);
    const yO = o => h * 0.3 + o * (h * 0.4) / (NO - 1);
    const act = v => v > 0 ? `rgba(255,190,90,${0.25 + 0.75 * Math.min(1, v)})` : `rgba(90,170,255,${0.25 + 0.75 * Math.min(1, -v)})`;
    const edge = (x0, y0, x1, y1, wt) => {
      const a = Math.min(0.9, Math.abs(wt) * 0.45);
      if (a < 0.06) return;
      ctx.strokeStyle = wt > 0 ? `rgba(255,170,70,${a})` : `rgba(80,160,255,${a})`;
      ctx.lineWidth = Math.min(3, 0.4 + Math.abs(wt) * 0.8);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo((x0 + x1) / 2, y0, (x0 + x1) / 2, y1, x1, y1); ctx.stroke();
    };
    const stride = NI + NH;
    let rec = 0;
    for (let j = 0; j < NH; j++) {
      for (let i = 0; i < NI; i++) edge(xI, yI(i), xH, yH(j), b[OFF_W1 + j * stride + i]);
      for (let k = 0; k < NH; k++) if (b[OFF_W1 + j * stride + NI + k] !== 0) rec++;
    }
    for (let o = 0; o < NO; o++) {
      for (let j = 0; j < NH; j++) edge(xH, yH(j), xO, yO(o), b[OFF_W2 + o * NH + j]);
      for (let i = 0; i < NI; i++) edge(xI, yI(i), xO, yO(o), b[OFF_W3 + o * NI + i] * 0.8);
    }
    // nodes
    ctx.textBaseline = 'middle';
    ctx.font = '9.5px -apple-system, "Segoe UI", system-ui, sans-serif';
    for (let i = 0; i < NI; i++) {
      const y = yI(i);
      ctx.fillStyle = act(c.inp[i]); ctx.beginPath(); ctx.arc(xI, y, 3.6, 0, PR.TAU); ctx.fill();
      ctx.fillStyle = MUTED; ctx.textAlign = 'right';
      let label;
      if (i < PR.NS * NCH) label = PR.CHANNELS[i % NCH] + ' ' + SECT[(i / NCH) | 0];
      else label = PR.EXTRA[i - PR.NS * NCH];
      ctx.fillText(label, xI - 7, y);
    }
    for (let j = 0; j < NH; j++) {
      ctx.fillStyle = act(c.h[j]); ctx.beginPath(); ctx.arc(xH, yH(j), 5.5, 0, PR.TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.stroke();
      if (b[OFF_W1 + j * stride + NI + j] !== 0) { ctx.beginPath(); ctx.arc(xH + 7, yH(j) - 5, 4, Math.PI * 0.9, Math.PI * 2.4); ctx.stroke(); }
    }
    ctx.textAlign = 'left';
    for (let o = 0; o < NO; o++) {
      ctx.fillStyle = act(c.out[o]); ctx.beginPath(); ctx.arc(xO, yO(o), 7, 0, PR.TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
      ctx.fillStyle = INK; ctx.fillText(PR.OUTPUTS[o], xO + 11, yO(o) - 5);
      ctx.fillStyle = MUTED; ctx.fillText(c.out[o].toFixed(2), xO + 11, yO(o) + 7);
    }
    ctx.fillStyle = MUTED; ctx.textAlign = 'center';
    ctx.fillText(`${NH} neurons · ${rec} recurrent links`, xH, h - 6);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    void OFF_B1; void OFF_B2;
  }

  PR.Charts = { prep, mullerLayout, drawMuller, mullerHit, treeLayout, drawTree, treeHit, SERIES, drawTrend, drawTraitSpace, drawBrain };
})(globalThis);
