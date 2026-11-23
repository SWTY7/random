/* A small 3D force-directed graph viewer for Cayley and Schreier graphs.
 * new GraphView(canvas, {onHover}) ; view.set(nodeCount, edges [[i,j,gen]], genInfo [{color, involution}])
 * Orthographic projection, slow auto-rotation, drag to turn. */
(function (root) {
  'use strict';
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  function layout3d(N, edges, seed) {
    const rand = rng(seed || 7);
    const P = Array.from({ length: N }, () => [rand() - 0.5, rand() - 0.5, rand() - 0.5]);
    const adj = new Set(); const E = [];
    edges.forEach(([a, b]) => { const k = a < b ? a + ',' + b : b + ',' + a; if (a !== b && !adj.has(k)) { adj.add(k); E.push([a, b]); } });
    const iters = N > 80 ? 700 : 500;
    const L = 1;
    let temp = 0.5;
    const F = P.map(() => [0, 0, 0]);
    for (let it = 0; it < iters; it++) {
      F.forEach((f) => { f[0] = f[1] = f[2] = 0; });
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1], dz = P[i][2] - P[j][2];
        const d2 = dx * dx + dy * dy + dz * dz + 1e-6, f = (L * L) / d2 * 0.3;
        F[i][0] += dx * f; F[i][1] += dy * f; F[i][2] += dz * f;
        F[j][0] -= dx * f; F[j][1] -= dy * f; F[j][2] -= dz * f;
      }
      E.forEach(([a, b]) => {
        const dx = P[a][0] - P[b][0], dy = P[a][1] - P[b][1], dz = P[a][2] - P[b][2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6, f = (d - L) * 0.5 / d;
        F[a][0] -= dx * f; F[a][1] -= dy * f; F[a][2] -= dz * f;
        F[b][0] += dx * f; F[b][1] += dy * f; F[b][2] += dz * f;
      });
      for (let i = 0; i < N; i++) {
        const m = Math.hypot(F[i][0], F[i][1], F[i][2]) + 1e-9, s = Math.min(m, temp) / m;
        P[i][0] += F[i][0] * s; P[i][1] += F[i][1] * s; P[i][2] += F[i][2] * s;
      }
      temp = Math.max(0.01, temp * 0.992);
    }
    // centre and normalise
    const c = [0, 0, 0]; P.forEach((p) => { c[0] += p[0] / N; c[1] += p[1] / N; c[2] += p[2] / N; });
    let r = 0; P.forEach((p) => { p[0] -= c[0]; p[1] -= c[1]; p[2] -= c[2]; r = Math.max(r, Math.hypot(p[0], p[1], p[2])); });
    if (N <= 3) { // tiny graphs: put them on a flat circle facing the viewer
      P.forEach((p, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / N; p[0] = N === 1 ? 0 : Math.cos(a); p[1] = N === 1 ? 0 : Math.sin(a); p[2] = 0; });
      r = 1;
    }
    P.forEach((p) => { p[0] /= r || 1; p[1] /= r || 1; p[2] /= r || 1; });
    return P;
  }

  function GraphView(canvas, opts) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.opts = opts || {};
    this.N = 0; this.P = []; this.edges = []; this.info = [];
    this.yaw = 0.6; this.pitch = 0.35; this.spin = true; this.hover = -1;
    this.marks = {}; this.visited = new Set(); this.flat = false;
    this.cur = 0; this.anim = null; // {from, to, t0}
    const self = this;
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw: self.yaw, pitch: self.pitch, moved: false }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) { drag.moved = true; self.spin = false; }
        self.yaw = drag.yaw + dx * 0.01; self.pitch = Math.max(-1.5, Math.min(1.5, drag.pitch + dy * 0.01));
      }
      self.pick(e);
    });
    canvas.addEventListener('pointerup', (e) => { if (drag && !drag.moved && self.hover >= 0 && self.opts.onClick) self.opts.onClick(self.hover); drag = null; });
    canvas.addEventListener('pointerleave', () => { self.hover = -1; if (self.opts.onHover) self.opts.onHover(-1); });
    canvas.addEventListener('dblclick', () => { self.spin = !self.spin; });
  }
  GraphView.prototype.set = function (N, edges, info, seed) {
    this.N = N; this.edges = edges; this.info = info;
    this.P = layout3d(N, edges, seed);
    this.flat = this.P.every((p) => Math.abs(p[2]) < 1e-9);
    if (this.flat) { this.yaw = 0; this.pitch = 0; }
    this.visited = new Set([0]); this.cur = 0; this.anim = null; this.hover = -1; this.spin = !this.flat;
    // edge list for drawing: merge i->j / j->i of an involution into one undirected segment
    const seen = new Set(); this.drawEdges = [];
    edges.forEach(([a, b, g]) => {
      if (info[g] && info[g].involution) { const k = Math.min(a, b) + ',' + Math.max(a, b) + ',' + g; if (seen.has(k)) return; seen.add(k); this.drawEdges.push([a, b, g, false]); }
      else this.drawEdges.push([a, b, g, true]);
    });
  };
  GraphView.prototype.project = function (p) {
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const x = p[0] * cy + p[2] * sy, z0 = -p[0] * sy + p[2] * cy;
    const y = p[1] * cp - z0 * sp, z = p[1] * sp + z0 * cp;
    const w = this.c.width / (window.devicePixelRatio || 1), h = this.c.height / (window.devicePixelRatio || 1);
    const s = Math.min(w, h) * 0.4;
    return [w / 2 + x * s, h / 2 + y * s, z];
  };
  GraphView.prototype.pick = function (e) {
    const r = this.c.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = -1, bd = 12 * 12;
    for (let i = 0; i < this.N; i++) { const q = this.project(this.P[i]); const d = (q[0] - mx) ** 2 + (q[1] - my) ** 2; if (d < bd) { bd = d; best = i; } }
    if (best !== this.hover) { this.hover = best; if (this.opts.onHover) this.opts.onHover(best, e); }
    else if (best >= 0 && this.opts.onHover) this.opts.onHover(best, e);
  };
  GraphView.prototype.moveTo = function (j) {
    if (j === this.cur) return;
    this.anim = { from: this.cur, to: j, t0: performance.now() };
    this.cur = j; this.visited.add(j);
  };
  GraphView.prototype.draw = function (now) {
    const ctx = this.ctx, dpr = window.devicePixelRatio || 1;
    const w = this.c.width / dpr, h = this.c.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!this.N) return;
    if (this.spin) this.yaw += 0.0025;
    const Q = this.P.map((p) => this.project(p));
    const N = this.N, big = N > 60;
    const depthAlpha = (z) => (this.flat ? 1 : 0.35 + 0.65 * (z + 1) / 2);
    // edges, back to front
    const es = this.drawEdges.map((e) => [e, (Q[e[0]][2] + Q[e[1]][2]) / 2]).sort((a, b) => a[1] - b[1]);
    ctx.lineCap = 'round';
    es.forEach(([[a, b, g, arrow], z]) => {
      const A = Q[a], B = Q[b], col = this.info[g].color;
      ctx.globalAlpha = depthAlpha(z) * (big ? 0.55 : 0.8);
      ctx.strokeStyle = col; ctx.lineWidth = big ? 1 : 1.6;
      // two arrows between the same pair (a->b with g and b->a with g') would overlap: bend directed edges slightly
      let mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
      if (arrow) { const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1; mx += (-dy / L) * L * 0.08; my += (dx / L) * L * 0.08; }
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(mx, my, B[0], B[1]); ctx.stroke();
      if (arrow) {
        // arrowhead at curve midpoint, pointing along the tangent
        const px = 0.25 * A[0] + 0.5 * mx + 0.25 * B[0], py = 0.25 * A[1] + 0.5 * my + 0.25 * B[1];
        const tx = B[0] - A[0], ty = B[1] - A[1], tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl, s = big ? 4 : 6;
        ctx.fillStyle = col; ctx.beginPath();
        ctx.moveTo(px + ux * s, py + uy * s); ctx.lineTo(px - ux * s - uy * s * 0.6, py - uy * s + ux * s * 0.6); ctx.lineTo(px - ux * s + uy * s * 0.6, py - uy * s - ux * s * 0.6);
        ctx.closePath(); ctx.fill();
      }
    });
    // nodes
    const order = Q.map((q, i) => i).sort((a, b) => Q[a][2] - Q[b][2]);
    const rad = N > 80 ? 3.2 : N > 30 ? 4.5 : 6.5;
    order.forEach((i) => {
      const q = Q[i]; ctx.globalAlpha = depthAlpha(q[2]);
      const mark = this.marks[i];
      ctx.beginPath(); ctx.arc(q[0], q[1], rad, 0, Math.PI * 2);
      ctx.fillStyle = mark && mark.fill ? mark.fill : this.visited.has(i) ? '#3b3a36' : '#fbf8f1';
      ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#3b3a36'; ctx.stroke();
      if (mark && mark.ring) { ctx.beginPath(); ctx.arc(q[0], q[1], rad + 4, 0, Math.PI * 2); ctx.strokeStyle = mark.ring; ctx.lineWidth = 2.5; ctx.stroke(); }
      if (i === this.hover) { ctx.beginPath(); ctx.arc(q[0], q[1], rad + 7, 0, Math.PI * 2); ctx.strokeStyle = '#8a8478'; ctx.lineWidth = 1; ctx.stroke(); }
    });
    ctx.globalAlpha = 1;
    // the "you are here" marker glides along the edge
    let cx, cy;
    const T = this.anim ? Math.min(1, (now - this.anim.t0) / 320) : 1;
    if (this.anim && T < 1) {
      const A = Q[this.anim.from], B = Q[this.anim.to], e = T * T * (3 - 2 * T);
      cx = A[0] + (B[0] - A[0]) * e; cy = A[1] + (B[1] - A[1]) * e;
    } else { this.anim = null; cx = Q[this.cur][0]; cy = Q[this.cur][1]; }
    ctx.beginPath(); ctx.arc(cx, cy, rad + 3.5, 0, Math.PI * 2); ctx.fillStyle = '#c8553d'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fbf8f1'; ctx.stroke();
  };

  root.GraphView = GraphView;
})(window);
