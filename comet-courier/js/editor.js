/* Comet Courier — route editor with shareable links. */
(function (root) {
  'use strict';
  const CC = (root.CC = root.CC || {});
  const R = CC.render, A = CC.audio;
  const { W, H } = CC.PHYS;
  const TAU = Math.PI * 2;
  const SNAP = 10;

  const TOOLS = ['select', 'start', 'goal', 'planet', 'giant', 'moon', 'sun', 'repulsor', 'blackhole', 'asteroid', 'dust', 'wall', 'worm', 'erase'];
  const snap = (v) => Math.round(v / SNAP) * SNAP;

  function blankRoute() {
    return {
      start: { x: 200, y: 450 }, goal: { x: 1400, y: 450 },
      bodies: [{ type: 'planet', x: 800, y: 450 }], dust: [], walls: [], worms: [],
    };
  }

  function encode(lv) {
    const c = {
      s: [lv.start.x, lv.start.y], g: [lv.goal.x, lv.goal.y, lv.goal.r || 40],
      b: lv.bodies.map((b) => [b.type, b.x, b.y, b.r, b.m]),
      d: lv.dust.map((d) => [d.x, d.y]),
      w: lv.walls.map((w) => [w.x1, w.y1, w.x2, w.y2]),
      h: lv.worms.map((w) => [w.ax, w.ay, w.bx, w.by]),
      n: lv.title || '',
    };
    const json = JSON.stringify(c);
    return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(str) {
    try {
      const json = decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
      const c = JSON.parse(json);
      const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
      const okType = (t) => (CC.BODY_DEFAULTS[t] ? t : 'planet');
      return {
        start: { x: num(c.s[0], 200), y: num(c.s[1], 450) },
        goal: { x: num(c.g[0], 1400), y: num(c.g[1], 450), r: Math.max(20, Math.min(80, num(c.g[2], 40))) },
        bodies: (c.b || []).slice(0, 40).map((b) => {
          const type = okType(b[0]), d = CC.BODY_DEFAULTS[type];
          return { type, x: num(b[1], 800), y: num(b[2], 450), r: Math.max(8, Math.min(160, num(b[3], d.r))), m: Math.max(-40, Math.min(60, num(b[4], d.m))) };
        }),
        dust: (c.d || []).slice(0, 12).map((d) => ({ x: num(d[0], 0), y: num(d[1], 0) })),
        walls: (c.w || []).slice(0, 30).map((w) => ({ x1: num(w[0], 0), y1: num(w[1], 0), x2: num(w[2], 0), y2: num(w[3], 0) })),
        worms: (c.h || []).slice(0, 6).map((w) => ({ ax: num(w[0], 0), ay: num(w[1], 0), bx: num(w[2], 0), by: num(w[3], 0), r: 32 })),
        title: String(c.n || '').slice(0, 40),
      };
    } catch (e) { return null; }
  }

  function Editor(route) {
    this.lv = route || loadDraft() || blankRoute();
    this.tool = 'planet';
    this.sel = null;     // { kind, i, part }
    this.drag = null;
    this.pending = null; // worm first end / wall start
    this.undoStack = [];
    this.time = 0;
    this.pal = { a: '#fbd38d', b: '#90cdf4', bg1: '#0d1020', bg2: '#1a1530' };
    this.status = '';
  }

  function loadDraft() { try { const s = localStorage.getItem('cometCourier.draft'); return s ? decode(s) : null; } catch (e) { return null; } }
  Editor.prototype.saveDraft = function () { try { localStorage.setItem('cometCourier.draft', encode(this.lv)); } catch (e) {} };
  Editor.prototype.snapshot = function () { this.undoStack.push(JSON.stringify(this.lv)); if (this.undoStack.length > 60) this.undoStack.shift(); };
  Editor.prototype.undo = function () { const s = this.undoStack.pop(); if (s) { this.lv = JSON.parse(s); this.sel = null; this.saveDraft(); } };
  Editor.prototype.clear = function () { this.snapshot(); this.lv = blankRoute(); this.lv.bodies = []; this.sel = null; this.saveDraft(); };

  Editor.prototype.hit = function (p) {
    const lv = this.lv;
    for (let i = lv.bodies.length - 1; i >= 0; i--) {
      const b = lv.bodies[i], r = b.r || CC.BODY_DEFAULTS[b.type].r;
      if (Math.hypot(b.x - p.x, b.y - p.y) < r + 8) return { kind: 'body', i };
    }
    for (let i = 0; i < lv.dust.length; i++) if (Math.hypot(lv.dust[i].x - p.x, lv.dust[i].y - p.y) < 20) return { kind: 'dust', i };
    for (let i = 0; i < lv.worms.length; i++) {
      const w = lv.worms[i];
      if (Math.hypot(w.ax - p.x, w.ay - p.y) < 34) return { kind: 'worm', i, part: 'a' };
      if (Math.hypot(w.bx - p.x, w.by - p.y) < 34) return { kind: 'worm', i, part: 'b' };
    }
    for (let i = 0; i < lv.walls.length; i++) {
      const w = lv.walls[i];
      if (Math.hypot(w.x1 - p.x, w.y1 - p.y) < 16) return { kind: 'wall', i, part: 1 };
      if (Math.hypot(w.x2 - p.x, w.y2 - p.y) < 16) return { kind: 'wall', i, part: 2 };
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1, l2 = dx * dx + dy * dy || 1;
      const u = Math.max(0, Math.min(1, ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / l2));
      if (Math.hypot(w.x1 + u * dx - p.x, w.y1 + u * dy - p.y) < 12) return { kind: 'wall', i, part: 0 };
    }
    if (Math.hypot(lv.goal.x - p.x, lv.goal.y - p.y) < (lv.goal.r || 40) + 6) return { kind: 'goal' };
    if (Math.hypot(lv.start.x - p.x, lv.start.y - p.y) < 26) return { kind: 'start' };
    return null;
  };

  Editor.prototype.remove = function (h) {
    const lv = this.lv;
    if (!h) return;
    if (h.kind === 'body') lv.bodies.splice(h.i, 1);
    else if (h.kind === 'dust') lv.dust.splice(h.i, 1);
    else if (h.kind === 'worm') lv.worms.splice(h.i, 1);
    else if (h.kind === 'wall') lv.walls.splice(h.i, 1);
    else return;
    A.play('pop');
  };

  Editor.prototype.pointerDown = function (w) {
    const p = { x: snap(w.x), y: snap(w.y) };
    const lv = this.lv;
    const t = this.tool;
    if (t === 'select') {
      const h = this.hit(w);
      this.sel = h;
      if (h) { this.snapshot(); this.drag = { h, last: p }; }
      return true;
    }
    if (t === 'erase') { const h = this.hit(w); if (h) { this.snapshot(); this.remove(h); this.sel = null; this.saveDraft(); } return true; }
    this.snapshot();
    if (t === 'start') lv.start = p;
    else if (t === 'goal') lv.goal = Object.assign({}, lv.goal, p);
    else if (t === 'dust') { if (lv.dust.length < 12) lv.dust.push(p); }
    else if (t === 'wall') { this.drag = { wall: true, a: p, b: p }; }
    else if (t === 'worm') {
      if (!this.pending) { this.pending = p; this.undoStack.pop(); }
      else { if (lv.worms.length < 6) lv.worms.push({ ax: this.pending.x, ay: this.pending.y, bx: p.x, by: p.y, r: 32 }); this.pending = null; }
    } else if (CC.BODY_DEFAULTS[t]) {
      if (lv.bodies.length < 40) {
        const d = CC.BODY_DEFAULTS[t];
        lv.bodies.push({ type: t, x: p.x, y: p.y, r: d.r, m: d.m });
        this.sel = { kind: 'body', i: lv.bodies.length - 1 };
      }
    }
    A.play('pop');
    R.ring(p.x, p.y, '255,255,255', 40);
    this.saveDraft();
    return true;
  };
  Editor.prototype.pointerMove = function (w) {
    const d = this.drag; if (!d) return;
    const p = { x: snap(w.x), y: snap(w.y) };
    if (d.wall) { d.b = p; return; }
    const dx = p.x - d.last.x, dy = p.y - d.last.y; d.last = p;
    const lv = this.lv, h = d.h;
    if (h.kind === 'body') { lv.bodies[h.i].x += dx; lv.bodies[h.i].y += dy; }
    else if (h.kind === 'dust') { lv.dust[h.i].x += dx; lv.dust[h.i].y += dy; }
    else if (h.kind === 'goal') { lv.goal.x += dx; lv.goal.y += dy; }
    else if (h.kind === 'start') { lv.start.x += dx; lv.start.y += dy; }
    else if (h.kind === 'worm') { const o = lv.worms[h.i]; o[h.part + 'x'] += dx; o[h.part + 'y'] += dy; }
    else if (h.kind === 'wall') {
      const o = lv.walls[h.i];
      if (h.part !== 2) { o.x1 += dx; o.y1 += dy; }
      if (h.part !== 1) { o.x2 += dx; o.y2 += dy; }
    }
  };
  Editor.prototype.pointerUp = function () {
    const d = this.drag; this.drag = null;
    if (d && d.wall && Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y) > 20 && this.lv.walls.length < 30) {
      this.lv.walls.push({ x1: d.a.x, y1: d.a.y, x2: d.b.x, y2: d.b.y });
    }
    this.saveDraft();
  };

  // resize / restrength the selected body
  Editor.prototype.adjust = function (what, dir) {
    const s = this.sel; if (!s) return;
    const lv = this.lv;
    this.snapshot();
    if (s.kind === 'body') {
      const b = lv.bodies[s.i];
      if (what === 'size') b.r = Math.max(8, Math.min(160, Math.round(b.r * (dir > 0 ? 1.15 : 0.87))));
      else {
        const step = Math.max(0.5, Math.abs(b.m) * 0.2);
        if (b.type === 'asteroid') b.m = 0;
        else if (b.type === 'repulsor') b.m = Math.max(-40, Math.min(-0.5, b.m - dir * step));
        else b.m = Math.max(0.5, Math.min(60, +(b.m + dir * step).toFixed(1)));
      }
    } else if (s.kind === 'goal' && what === 'size') {
      lv.goal.r = Math.max(20, Math.min(80, (lv.goal.r || 40) + dir * 5));
    }
    this.saveDraft();
  };

  Editor.prototype.key = function (e, down) {
    if (!down) return false;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { this.undo(); return true; }
    if (e.key === 'Delete' || e.key === 'Backspace') { if (this.sel) { this.snapshot(); this.remove(this.sel); this.sel = null; this.saveDraft(); } return true; }
    if (e.key === '[') { this.adjust('size', -1); return true; }
    if (e.key === ']') { this.adjust('size', 1); return true; }
    if (e.key === '-') { this.adjust('mass', -1); return true; }
    if (e.key === '=' || e.key === '+') { this.adjust('mass', 1); return true; }
    if (e.key === 'Escape') { this.pending = null; this.sel = null; return true; }
    return false;
  };

  Editor.prototype.update = function (dt) { this.time += dt; };

  Editor.prototype.draw = function () {
    const g = R.ctx;
    // grid
    g.strokeStyle = 'rgba(255,255,255,0.04)'; g.lineWidth = 1;
    for (let x = 0; x <= W; x += 50) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y <= H; y += 50) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    R.frame(this.pal);
    const L = CC.normalizeLevel(this.lv);
    R.drawLevel(L, 0, this.pal, this.time, { highlight: this.sel && this.sel.kind === 'body' ? this.sel.i : -1 });
    R.drawComet(L.start.x, L.start.y, 1, 0, this.time, this.pal);
    if (this.sel && this.sel.kind !== 'body') {
      const s = this.sel, lv = this.lv;
      let p = null;
      if (s.kind === 'goal') p = lv.goal; else if (s.kind === 'start') p = lv.start; else if (s.kind === 'dust') p = lv.dust[s.i];
      else if (s.kind === 'worm') { const w = lv.worms[s.i]; if (w) p = { x: w[s.part + 'x'], y: w[s.part + 'y'] }; }
      else if (s.kind === 'wall') { const w = lv.walls[s.i]; if (w) p = { x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 }; }
      if (p) { g.strokeStyle = '#fff'; g.setLineDash([4, 4]); g.beginPath(); g.arc(p.x, p.y, 30, 0, TAU); g.stroke(); g.setLineDash([]); }
    }
    if (this.drag && this.drag.wall) R.drawWall({ x1: this.drag.a.x, y1: this.drag.a.y, x2: this.drag.b.x, y2: this.drag.b.y }, this.pal);
    if (this.pending) R.drawWorm(this.pending.x, this.pending.y, 32, this.time, 200);
    R.drawParticles(); R.drawRings(1 / 60);
  };

  Editor.prototype.toLevel = function () {
    return Object.assign({ id: 'custom', world: 4, name: { en: this.lv.title || CC.t('customRoute'), ko: this.lv.title || CC.t('customRoute') }, from: { en: 'You', ko: '나' }, note: { en: 'A route of your own making.', ko: '직접 만든 경로.' }, preview: 1.2, par: 3 }, JSON.parse(JSON.stringify(this.lv)));
  };

  CC.Editor = Editor;
  CC.EDITOR_TOOLS = TOOLS;
  CC.route = { encode, decode };
})(window);
