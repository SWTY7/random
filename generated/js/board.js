/* Drawing the puzzle board: slots, guide circles, tokens, move arrows, and move animation. */
(function (root) {
  'use strict';
  const TOKEN_COLORS = ['#c8553d', '#2f6690', '#e0a526', '#588157', '#7b4b94', '#d17a9e', '#3a7d7c'];
  const GEN_COLORS = ['#b23a48', '#2f6690', '#3f7d20', '#7b4b94'];
  const LETTERS = 'ABCDEFGHIJKL';

  function tokenColor(lv, t) {
    if (lv.look && lv.look[t]) return lv.look[t].color;
    if (lv.style === 'clock') return 'hsl(' + Math.round((t / 12) * 330) + ',45%,' + (t === 0 ? 38 : 52) + '%)';
    if (lv.style === 'numbers') return 'hsl(' + Math.round((t / lv.tokens.length) * 330) + ',45%,48%)';
    return TOKEN_COLORS[t % TOKEN_COLORS.length];
  }
  function tokenLabel(lv, t, distinct) {
    if (lv.look && lv.look[t]) return lv.look[t].label;
    if (lv.style === 'clock') return String(t === 0 ? 12 : t);
    if (lv.style === 'numbers') return String(t + 1);
    if (!distinct) return '';
    return LETTERS[t];
  }

  /* Geometry of a move: how a token travels from position a to position b. */
  function makePaths(lv, pos, gens) {
    // returns paths[g][i] = function(t) -> [x, y]  (board coords)
    return gens.map((g, gi) => {
      const spec = lv.gens[gi];
      const fns = new Array(pos.length);
      const cyc = spec.cycles;
      cyc.forEach((c) => {
        let center = null;
        if (spec.rot) center = [0, 0];
        else if (c.length >= 3) {
          const cx = c.reduce((s, i) => s + pos[i][0], 0) / c.length, cy = c.reduce((s, i) => s + pos[i][1], 0) / c.length;
          const ds = c.map((i) => Math.hypot(pos[i][0] - cx, pos[i][1] - cy));
          if (Math.max(...ds) - Math.min(...ds) < 1e-3) center = [cx, cy];
        }
        c.forEach((a, k) => {
          const b = c[(k + 1) % c.length];
          const A = pos[a], B = pos[b];
          if (center) {
            const ra = Math.hypot(A[0] - center[0], A[1] - center[1]), rb = Math.hypot(B[0] - center[0], B[1] - center[1]);
            const a0 = Math.atan2(A[1] - center[1], A[0] - center[0]);
            let d;
            if (spec.rot) d = (spec.rot * Math.PI) / 180;
            else { d = Math.atan2(B[1] - center[1], B[0] - center[0]) - a0; while (d <= -Math.PI) d += 2 * Math.PI; while (d > Math.PI) d -= 2 * Math.PI; }
            fns[a] = (t) => { const r = ra + (rb - ra) * t, an = a0 + d * t; return [center[0] + r * Math.cos(an), center[1] + r * Math.sin(an)]; };
          } else {
            const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, dx = B[0] - A[0], dy = B[1] - A[1];
            const bend = c.length === 2 ? 0.3 : 0.18;
            const C = [mx - dy * bend, my + dx * bend];
            fns[a] = (t) => [(1 - t) * (1 - t) * A[0] + 2 * (1 - t) * t * C[0] + t * t * B[0], (1 - t) * (1 - t) * A[1] + 2 * (1 - t) * t * C[1] + t * t * B[1]];
          }
        });
      });
      for (let i = 0; i < pos.length; i++) if (!fns[i]) { const A = pos[i]; fns[i] = () => A; }
      return fns;
    });
  }

  function guideShapes(lv, pos) {
    // circles for rings / polygons, so the board reads as a physical object
    const shapes = [];
    const seen = new Set();
    lv.gens.forEach((g) => g.cycles.forEach((c) => {
      if (c.length < 3) return;
      const cx = c.reduce((s, i) => s + pos[i][0], 0) / c.length, cy = c.reduce((s, i) => s + pos[i][1], 0) / c.length;
      const ds = c.map((i) => Math.hypot(pos[i][0] - cx, pos[i][1] - cy));
      if (Math.max(...ds) - Math.min(...ds) > 1e-3) return;
      const k = cx.toFixed(3) + ',' + cy.toFixed(3) + ',' + ds[0].toFixed(3);
      if (seen.has(k)) return; seen.add(k);
      shapes.push({ cx, cy, r: ds[0] });
    }));
    return shapes;
  }

  function drawToken(ctx, lv, t, x, y, R, distinct, label) {
    const col = tokenColor(lv, t);
    ctx.save();
    ctx.shadowColor = 'rgba(40,30,20,0.25)'; ctx.shadowBlur = R * 0.35; ctx.shadowOffsetY = R * 0.12;
    ctx.fillStyle = col;
    const square = lv.look && lv.look[t] ? lv.look[t].square : lv.style === 'faces';
    if (square) { const s = R * 1.5; roundRect(ctx, x - s / 2 * 1.05, y - s / 2 * 1.05, s * 1.05, s * 1.05, R * 0.18); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    if (!square) { ctx.beginPath(); ctx.arc(x - R * 0.3, y - R * 0.35, R * 0.45, 0, Math.PI * 2); ctx.fill(); }
    const txt = label !== undefined ? label : tokenLabel(lv, t, distinct);
    if (txt) {
      ctx.fillStyle = '#fffaf0'; ctx.font = '600 ' + Math.round(R * (txt.length > 1 ? 0.75 : 0.9)) + 'px Georgia, serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y + R * 0.04);
    }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* opts: { state, anim: {gen, from (state before), t}, hoverGen, target (for match ticks), small } */
  function drawBoard(canvas, model, paths, opts) {
    const lv = model.lv, pos = lv.pos, ctx = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr, h = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const S = Math.min(w, h) * (opts.small ? 0.44 : 0.46);
    const X = (p) => [w / 2 + p[0] * S, h / 2 + p[1] * S];
    let minD = Infinity;
    for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) minD = Math.min(minD, Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]));
    const R = Math.min(S * 0.17, minD * S * 0.36);
    const distinct = new Set(model.start).size === model.start.length;
    // guides
    ctx.strokeStyle = '#d9d1c1'; ctx.lineWidth = opts.small ? 1 : 2;
    guideShapes(lv, pos).forEach((s) => { const c = X([s.cx, s.cy]); ctx.beginPath(); ctx.arc(c[0], c[1], s.r * S, 0, Math.PI * 2); ctx.stroke(); });
    if (lv.labels && !opts.small) {
      ctx.fillStyle = '#9b927f'; ctx.font = '13px Georgia, serif'; ctx.textAlign = 'center';
      pos.forEach((p, i) => { const q = X(p); if (lv.labels[i]) ctx.fillText(lv.labels[i], q[0], q[1] + R * 1.15 + 12); });
      if (lv.captions) lv.captions.forEach(([x, y, text]) => { const q = X([x, y]); ctx.fillText(text, q[0], q[1]); });
    }
    // slots
    pos.forEach((p, i) => {
      const q = X(p);
      ctx.beginPath(); ctx.arc(q[0], q[1], R * 1.12, 0, Math.PI * 2);
      ctx.fillStyle = '#ece5d6'; if (lv.style !== 'faces') ctx.fill();
      if (opts.target && !opts.anim && opts.state[i] === opts.target[i] && !opts.small) {
        ctx.beginPath(); ctx.arc(q[0], q[1], R * 1.25, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(88,129,87,0.55)'; ctx.lineWidth = 2; ctx.stroke();
      }
    });
    // tokens
    if (opts.anim) {
      const { gen, from, t } = opts.anim, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      from.forEach((tok, i) => { const p = paths[gen][i](e); const q = X(p); drawToken(ctx, lv, tok, q[0], q[1], R, distinct); });
    } else {
      opts.state.forEach((tok, i) => { const q = X(pos[i]); drawToken(ctx, lv, tok, q[0], q[1], R, distinct); });
    }
    // arrows for a hovered move
    if (opts.hoverGen !== undefined && opts.hoverGen !== null && !opts.anim) {
      const g = opts.hoverGen, col = GEN_COLORS[g % GEN_COLORS.length];
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.9;
      model.gens[g].forEach((b, a) => {
        if (a === b) return;
        const f = paths[g][a], steps = 24, t0 = 0.22, t1 = 0.78;
        ctx.beginPath();
        for (let k = 0; k <= steps; k++) { const q = X(f(t0 + (t1 - t0) * (k / steps))); if (k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
        ctx.stroke();
        const q1 = X(f(t1)), q0 = X(f(t1 - 0.03)), ang = Math.atan2(q1[1] - q0[1], q1[0] - q0[0]);
        ctx.beginPath(); ctx.moveTo(q1[0] + Math.cos(ang) * 8, q1[1] + Math.sin(ang) * 8);
        ctx.lineTo(q1[0] + Math.cos(ang + 2.5) * 9, q1[1] + Math.sin(ang + 2.5) * 9);
        ctx.lineTo(q1[0] + Math.cos(ang - 2.5) * 9, q1[1] + Math.sin(ang - 2.5) * 9); ctx.closePath(); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
  }

  root.Board = { drawBoard, makePaths, drawToken, tokenColor, GEN_COLORS, TOKEN_COLORS };
})(window);
