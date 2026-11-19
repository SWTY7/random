/* Comet Courier — Orrery Sandbox: a tiny n-body universe. Also drives the title screen. */
(function (root) {
  'use strict';
  const CC = (root.CC = root.CC || {});
  const R = CC.render, A = CC.audio;
  const { W, H, MU } = CC.PHYS;
  const TAU = Math.PI * 2;
  const SUB = 4;

  const TYPES = {
    moon: { r: 14, m: 0.6 }, planet: { r: 26, m: 2.5 }, giant: { r: 44, m: 7 },
    sun: { r: 50, m: 16 }, blackhole: { r: 14, m: 40 }, repulsor: { r: 20, m: -5 },
  };

  function Sandbox(opts) {
    this.opts = opts || {};
    this.bodies = [];
    this.comets = [];
    this.tool = 'planet';
    this.time = 0;
    this.paused = false;
    this.autoOrbit = true;
    this.trails = true;
    this.drag = null;
    this.pal = { a: '#90cdf4', b: '#fbd38d', bg1: '#070b18', bg2: '#11182c' };
    this.spawned = 0;
    this.sprayT = 0;
    this.preset(this.opts.preset || 'solar');
  }

  Sandbox.prototype.add = function (type, x, y, vx, vy) {
    const d = TYPES[type];
    const b = { type, x, y, vx: vx || 0, vy: vy || 0, m: d.m, r: d.r, trail: [], id: Math.random(), fixed: false };
    this.bodies.push(b);
    return b;
  };

  Sandbox.prototype.orbitVelocity = function (x, y) {
    // circular orbit around the strongest attractor at this point
    let best = null, bestA = 0;
    for (const b of this.bodies) {
      if (b.m <= 0) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      const a = b.m / (d * d);
      if (a > bestA) { bestA = a; best = b; }
    }
    if (!best) return { vx: 0, vy: 0 };
    const dx = x - best.x, dy = y - best.y, d = Math.hypot(dx, dy) || 1;
    const v = Math.sqrt((best.m * MU) / d);
    return { vx: best.vx - (dy / d) * v, vy: best.vy + (dx / d) * v };
  };

  Sandbox.prototype.preset = function (name) {
    this.bodies = []; this.comets = [];
    const cx = W / 2, cy = H / 2;
    const orb = (type, R, ph) => {
      const x = cx + Math.cos(ph) * R, y = cy + Math.sin(ph) * R;
      const v = this.orbitVelocity(x, y);
      return this.add(type, x, y, v.vx, v.vy);
    };
    if (name === 'solar') {
      const s = this.add('sun', cx, cy); s.fixed = true;
      orb('moon', 110, 0.3); orb('planet', 190, 2.2); orb('planet', 290, 4.0); orb('giant', 400, 1.1);
      const p = this.bodies[4]; const mv = { x: p.x + 70, y: p.y };
      const dv = Math.sqrt((p.m * MU) / 70);
      this.add('moon', mv.x, mv.y, p.vx, p.vy + dv);
    } else if (name === 'binary') {
      const v = Math.sqrt((16 * MU) / (4 * 120));
      this.add('sun', cx - 120, cy, 0, -v); this.add('sun', cx + 120, cy, 0, v);
      orb('planet', 380, 0.5); orb('moon', 470, 3.5);
    } else if (name === 'chaos') {
      for (let i = 0; i < 12; i++) this.add(['planet', 'moon', 'giant'][i % 3], 200 + Math.random() * 1200, 150 + Math.random() * 600, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80);
    } else if (name === 'hole') {
      const h = this.add('blackhole', cx, cy); h.fixed = true;
      for (let i = 0; i < 14; i++) orb(i % 4 ? 'moon' : 'planet', 140 + i * 24, i * 2.4);
    }
  };

  Sandbox.prototype.step = function (dt) {
    const B = this.bodies;
    const n = B.length;
    // body-body gravity (repulsors push)
    for (let i = 0; i < n; i++) { B[i].ax = 0; B[i].ay = 0; }
    for (let i = 0; i < n; i++) {
      const a = B[i];
      for (let j = i + 1; j < n; j++) {
        const b = B[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const soft = (a.r + b.r) * 0.3;
        const d2 = dx * dx + dy * dy + soft * soft, inv = MU / (d2 * Math.sqrt(d2));
        // a repulsor pushes others but is only lightly pushed itself
        const ma = a.m, mb = b.m;
        a.ax += dx * inv * mb; a.ay += dy * inv * mb;
        b.ax -= dx * inv * ma; b.ay -= dy * inv * ma;
      }
    }
    for (const b of B) {
      if (b.fixed) { b.vx = 0; b.vy = 0; continue; }
      b.vx += b.ax * dt; b.vy += b.ay * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    }
    // collisions → merge
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
      const a = B[i], b = B[j];
      if (a.m < 0 || b.m < 0) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * 0.8) {
        const big = a.m >= b.m ? a : b, small = big === a ? b : a;
        const M = big.m + small.m;
        if (!big.fixed) { big.vx = (big.vx * big.m + small.vx * small.m) / M; big.vy = (big.vy * big.m + small.vy * small.m) / M; }
        if (big.type !== 'blackhole') {
          big.r = Math.min(110, Math.sqrt(big.r * big.r + small.r * small.r * 0.6));
          if (big.type === 'moon' && M > 2) big.type = 'planet';
          if (big.type === 'planet' && M > 6) big.type = 'giant';
          if (big.type === 'giant' && M > 14) { big.type = 'sun'; }
        }
        big.m = M;
        R.burst(small.x, small.y, big.type === 'blackhole' ? '200,120,255' : '255,190,120', 40, 200, 1.2);
        R.ring(small.x, small.y, '255,220,180', 140);
        if (!this.opts.silent) A.play('merge', M > 10);
        B.splice(B.indexOf(small), 1);
        j--; if (small === a) { i--; break; }
      }
    }
    // comets: massless
    for (let k = this.comets.length - 1; k >= 0; k--) {
      const c = this.comets[k];
      let ax = 0, ay = 0, dead = false;
      for (const b of B) {
        const dx = b.x - c.x, dy = b.y - c.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < b.r * b.r) { dead = true; break; }
        const soft = b.r * 0.5, e2 = d2 + soft * soft;
        const inv = (b.m * MU) / (e2 * Math.sqrt(e2));
        ax += dx * inv; ay += dy * inv;
      }
      c.vx += ax * dt; c.vy += ay * dt; c.x += c.vx * dt; c.y += c.vy * dt;
      c.age += dt;
      if (dead || c.age > 40 || c.x < -900 || c.x > W + 900 || c.y < -900 || c.y > H + 900) {
        if (dead) R.burst(c.x, c.y, `${c.col}`, 10, 90, 0.6);
        this.comets.splice(k, 1);
      }
    }
    // remove runaways
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i];
      if (b.x < -2500 || b.x > W + 2500 || b.y < -2500 || b.y > H + 2500) B.splice(i, 1);
    }
  };

  Sandbox.prototype.update = function (dt) {
    this.time += dt;
    if (this.paused) return;
    dt = Math.min(dt, 1 / 30);
    for (let s = 0; s < SUB; s++) this.step(dt / SUB);
    const trailOn = this.trails;
    for (const b of this.bodies) {
      if (trailOn) { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 220) b.trail.shift(); }
      else b.trail.length = 0;
    }
    for (const c of this.comets) { c.trail.push({ x: c.x, y: c.y }); if (c.trail.length > 70) c.trail.shift(); }
    // spray tool
    if (this.drag && this.tool === 'spray' && this.drag.cur) {
      this.sprayT += dt;
      while (this.sprayT > 0.03) { this.sprayT -= 0.03; this.spawnComet(this.drag.cur.x, this.drag.cur.y, true); }
    }
    // title-screen ambience: keep comets flowing
    if (this.opts.ambient && this.comets.length < 26 && Math.random() < dt * 3) {
      const side = Math.random() * TAU;
      const x = W / 2 + Math.cos(side) * 900, y = H / 2 + Math.sin(side) * 600;
      const toward = Math.atan2(H / 2 - y, W / 2 - x) + (Math.random() - 0.5) * 0.9;
      const sp = 150 + Math.random() * 180;
      this.comets.push({ x, y, vx: Math.cos(toward) * sp, vy: Math.sin(toward) * sp, trail: [], age: 0, col: Math.random() < 0.5 ? '140,210,255' : '255,210,150' });
    }
  };

  Sandbox.prototype.spawnComet = function (x, y, orbit) {
    const v = orbit && this.autoOrbit ? this.orbitVelocity(x, y) : { vx: 0, vy: 0 };
    const jitter = 0.08;
    this.comets.push({ x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10, vx: v.vx * (1 + (Math.random() - 0.5) * jitter), vy: v.vy * (1 + (Math.random() - 0.5) * jitter), trail: [], age: 0, col: `${150 + (Math.random() * 100) | 0},${190 + (Math.random() * 60) | 0},255` });
    if (this.comets.length > 400) this.comets.shift();
  };

  Sandbox.prototype.draw = function () {
    const g = R.ctx, t = this.time;
    // trails
    if (this.trails) for (const b of this.bodies) if (b.trail.length > 2) R.drawTrail(b.trail, b.m < 0 ? 'rgba(220,240,255,A)' : b.type === 'sun' ? 'rgba(255,190,110,A)' : 'rgba(140,200,255,A)', 0.35, 2, false);
    for (const c of this.comets) if (c.trail.length > 2) R.drawTrail(c.trail, `rgba(${c.col},A)`, 0.8, 2, false);
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      switch (b.type) {
        case 'sun': R.drawSun(b, b.x, b.y, t); break;
        case 'blackhole': R.drawBlackHole(b, b.x, b.y, t); break;
        case 'repulsor': R.drawRepulsor(b, b.x, b.y, t); break;
        case 'moon': R.drawMoon(b, b.x, b.y, i); break;
        default: R.drawPlanet(b, b.x, b.y, i, t);
      }
    }
    for (const c of this.comets) {
      g.fillStyle = `rgba(${c.col},1)`; g.beginPath(); g.arc(c.x, c.y, 2.5, 0, TAU); g.fill();
    }
    R.drawParticles(); R.drawRings(1 / 60);
    // throw indicator
    if (this.drag && this.drag.cur && this.tool !== 'spray' && this.tool !== 'erase') {
      const d = this.drag;
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.setLineDash([5, 5]);
      g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.cur.x, d.cur.y); g.stroke(); g.setLineDash([]);
      const ty = TYPES[this.tool] || { r: 4 };
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(d.x, d.y, ty.r, 0, TAU); g.stroke();
    }
  };

  Sandbox.prototype.pointerDown = function (w) {
    if (this.tool === 'erase') { this.eraseAt(w); this.drag = { x: w.x, y: w.y, cur: w }; return true; }
    this.drag = { x: w.x, y: w.y, cur: w };
    if (this.tool === 'spray') this.spawnComet(w.x, w.y, true);
    return true;
  };
  Sandbox.prototype.pointerMove = function (w) {
    if (!this.drag) return;
    this.drag.cur = w;
    if (this.tool === 'erase') this.eraseAt(w);
  };
  Sandbox.prototype.pointerUp = function () {
    const d = this.drag; this.drag = null;
    if (!d || this.tool === 'spray' || this.tool === 'erase') return;
    const dx = d.cur.x - d.x, dy = d.cur.y - d.y, thrown = Math.hypot(dx, dy) > 12;
    let v = thrown ? { vx: dx * 1.6, vy: dy * 1.6 } : (this.autoOrbit ? this.orbitVelocity(d.x, d.y) : { vx: 0, vy: 0 });
    if (this.tool === 'comet') {
      this.comets.push({ x: d.x, y: d.y, vx: v.vx, vy: v.vy, trail: [], age: 0, col: '160,230,255' });
      A.play('pop'); return;
    }
    this.add(this.tool, d.x, d.y, v.vx, v.vy);
    A.play('pop');
    R.ring(d.x, d.y, '255,255,255', 60);
    this.spawned++;
    const st = CC.store.data.stats; st.sandboxBodies++;
    if (st.sandboxBodies >= 50) CC.store.award('god');
    CC.store.save();
  };
  Sandbox.prototype.eraseAt = function (w) {
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const b = this.bodies[i];
      if (Math.hypot(b.x - w.x, b.y - w.y) < b.r + 12) { R.burst(b.x, b.y, '255,255,255', 20, 150, 0.6); this.bodies.splice(i, 1); A.play('pop'); }
    }
    for (let i = this.comets.length - 1; i >= 0; i--) if (Math.hypot(this.comets[i].x - w.x, this.comets[i].y - w.y) < 30) this.comets.splice(i, 1);
  };
  Sandbox.prototype.key = function (e, down) {
    if (!down) return false;
    if (e.key === ' ') { this.paused = !this.paused; return true; }
    return false;
  };

  CC.Sandbox = Sandbox;
  CC.SANDBOX_TOOLS = ['planet', 'moon', 'giant', 'sun', 'blackhole', 'repulsor', 'comet', 'spray', 'erase'];
})(window);
