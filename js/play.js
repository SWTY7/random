/* Comet Courier — the delivery scene (aim, fly, deliver). */
(function (root) {
  'use strict';
  const CC = (root.CC = root.CC || {});
  const R = CC.render, A = CC.audio;
  const { DT } = CC.PHYS;
  const TAU = Math.PI * 2;
  const DRAG_FULL = 230; // world px of drag for full power

  function Play(raw, opts) {
    this.raw = raw;
    this.opts = opts || {};
    this.L = CC.normalizeLevel(raw);
    this.K = new CC.Kinematics(this.L);
    this.world = raw.world != null ? raw.world : (this.opts.world || 0);
    this.pal = this.opts.palette || CC.WORLDS[this.world].palette;
    this.phase = 'aim';
    const gp = CC.snapshot(this.L, 0), n = this.L.bodies.length;
    this.angle = Math.atan2(gp[n * 2 + 1] - this.L.start.y, gp[n * 2] - this.L.start.x);
    this.power = 0.5;
    this.attempts = 0;
    this.ghosts = [];
    this.trail = [];
    this.flight = null;
    this.preview = null;
    this.dirty = true;
    this.drag = null;
    this.speed = 1;
    this.ff = false;
    this.acc = 0;
    this.time = 0;
    this.shake = 0;
    this.replaying = false;
    this.lastWin = null;
    this.doneTimer = 0;
    this.result = null;
    A.setWorld(Math.min(this.world, 3));
  }

  Play.prototype.computePreview = function () {
    const L = this.L, steps = Math.round(L.preview / DT);
    const f = CC.newFlight(L, this.angle, this.power);
    const pts = [];
    for (let i = 0; i < steps && f.state === 'flying'; i++) {
      CC.step(L, this.K, f, null);
      if (i % 7 === 0) pts.push({ x: f.x, y: f.y });
    }
    this.preview = pts;
    this.dirty = false;
  };

  Play.prototype.setAim = function (angle, power) {
    const p = Math.max(0.05, Math.min(1, power));
    if (Math.abs(p - this.power) > 0.04) A.play('aim', p);
    this.angle = angle; this.power = p; this.dirty = true;
  };

  Play.prototype.launch = function (replay) {
    if (this.phase !== 'aim') return;
    this.replaying = !!replay;
    if (!replay) {
      this.attempts++;
      CC.store.data.stats.launches++;
    }
    this.flight = CC.newFlight(this.L, this.angle, this.power);
    this.trail = [{ x: this.flight.x, y: this.flight.y }];
    this.phase = 'fly';
    this.acc = 0;
    A.play('launch', this.power);
    R.burst(this.L.start.x, this.L.start.y, '160,220,255', 24, 160, 0.6);
    if (this.opts.onLaunch) this.opts.onLaunch(this);
  };

  Play.prototype.retry = function () {
    if (this.phase === 'fly' && this.trail.length > 4) this.pushGhost();
    this.phase = 'aim';
    this.flight = null;
    this.trail = [];
    this.result = null;
    this.dirty = true;
    if (this.opts.onRetry) this.opts.onRetry(this);
  };

  Play.prototype.pushGhost = function () {
    this.ghosts.unshift(this.trail.slice());
    if (this.ghosts.length > 3) this.ghosts.pop();
  };

  Play.prototype.handleEvents = function (evs) {
    for (const e of evs) {
      switch (e.type) {
        case 'dust':
          A.play('dust', e.n);
          R.burst(e.x, e.y, '255,236,150', 18, 140, 0.7);
          R.ring(e.x, e.y, '255,236,150', 50);
          break;
        case 'orbit': A.play('orbit'); break;
        case 'worm':
          A.play('worm');
          R.burst(e.fromX, e.fromY, '140,180,255', 20, 120, 0.6);
          R.ring(e.x, e.y, '140,180,255', 80);
          this.trail.push(null); // break the trail line
          break;
        case 'crashed':
          A.play('crash'); this.shake = 0.35;
          R.burst(e.x, e.y, '255,170,90', 50, 260, 1.1); R.ring(e.x, e.y, '255,170,90', 120);
          break;
        case 'swallowed':
          A.play('swallowed');
          R.burst(e.x, e.y, '200,120,255', 30, 80, 1.4);
          break;
        case 'lost': case 'drifted': A.play('lost'); break;
        case 'won':
          A.play('win');
          R.burst(e.x, e.y, '255,236,150', 80, 320, 1.6);
          R.ring(e.x, e.y, '255,255,255', 260);
          break;
      }
    }
  };

  Play.prototype.finish = function () {
    const f = this.flight, st = CC.store.data.stats;
    st.flightTime += f.t;
    st.orbits += f.orbits; st.worms += f.worms;
    if (f.maxSpeed > st.maxSpeed) st.maxSpeed = Math.round(f.maxSpeed);
    if (f.orbits) CC.store.award('orbit');
    if (f.maxSpeed >= 1500) CC.store.award('speed');
    if (f.worms >= 3) CC.store.award('worm3');
    if (f.state === 'won') {
      if (this.replaying) { this.result = { replay: true }; return; }
      st.deliveries++; st.dust += f.dustCount;
      this.lastWin = { angle: this.angle, power: this.power };
      const total = this.L.dust.length;
      const stars = [true, f.dustCount === total, this.attempts <= this.L.par];
      this.result = { won: true, stars, attempts: this.attempts, time: f.t, dust: f.dustCount, total };
      CC.store.award('first');
      if (this.attempts === 1 && this.world >= 1 && !this.opts.custom) CC.store.award('ace');
      if (f.closest < 6) CC.store.award('graze');
      if (f.t > 12) CC.store.award('marathon');
      const h = new Date().getHours(); if (h >= 1 && h < 5) CC.store.award('night');
    } else {
      st[f.state] = (st[f.state] || 0) + 1;
      if (f.state === 'crashed') st.crashes++;
      if (st.swallowed >= 5) CC.store.award('spaghetti');
      if (st.crashes >= 25) CC.store.award('splat');
      this.result = { won: false, reason: f.state };
    }
    CC.store.save();
    if (this.opts.onResult) this.opts.onResult(this, this.result);
  };

  Play.prototype.update = function (dt) {
    this.time += dt;
    if (this.shake > 0) this.shake -= dt;
    if (this.phase === 'aim' && this.dirty) this.computePreview();
    if (this.phase === 'fly') {
      const mult = this.ff ? 4 : 1;
      this.acc += dt * mult;
      const evs = [];
      let n = 0;
      while (this.acc >= DT && this.flight.state === 'flying' && n < 2000) {
        CC.step(this.L, this.K, this.flight, evs);
        this.acc -= DT; n++;
        if (this.flight.step % 2 === 0) this.trail.push({ x: this.flight.x, y: this.flight.y });
        if (this.flight.step % 3 === 0) R.puff(this.flight.x, this.flight.y, this.flight.vx, this.flight.vy);
      }
      if (evs.length) this.handleEvents(evs);
      if (this.flight.state !== 'flying') {
        this.phase = 'done';
        this.doneTimer = 0;
        this.finish();
      }
    } else if (this.phase === 'done') {
      this.doneTimer += dt;
      if (this.result && !this.result.won && this.doneTimer > 1.25 && !this.opts.holdOnFail) {
        this.pushGhost();
        this.retry();
      }
    }
  };

  Play.prototype.draw = function () {
    const g = R.ctx;
    const t = this.flight ? this.flight.t : 0;
    if (this.shake > 0) g.translate((Math.random() - 0.5) * 14 * this.shake, (Math.random() - 0.5) * 14 * this.shake);
    R.frame(this.pal);
    // ghosts
    if (CC.store.data.settings.trails) {
      this.ghosts.forEach((gh, i) => drawPolyline(gh, `rgba(255,255,255,A)`, 0.22 - i * 0.06, 1.5, true));
    }
    R.drawLevel(this.L, t, this.pal, this.time, { dust: this.flight && this.flight.dust, arrows: this.phase === 'aim', hideGoal: this.flight && this.flight.state === 'won' });
    if (this.trail.length > 1) drawPolyline(this.trail, 'rgba(120,200,255,A)', 0.9, 3.5, false);
    R.drawParticles();
    R.drawRings(1 / 60);
    if (this.phase === 'aim') {
      R.drawAim(this.L, this.angle, this.power, this.preview, this.pal, this.time);
      R.drawComet(this.L.start.x, this.L.start.y, Math.cos(this.angle), Math.sin(this.angle), this.time, this.pal);
    } else if (this.flight && this.flight.state === 'flying') {
      R.drawComet(this.flight.x, this.flight.y, this.flight.vx, this.flight.vy, this.time, this.pal);
    }
  };

  // trail arrays may contain null breaks (wormholes)
  function drawPolyline(pts, color, alpha, width, dashed) {
    let seg = [];
    for (const p of pts) {
      if (p === null) { if (seg.length > 1) R.drawTrail(seg, color, alpha, width, dashed); seg = []; }
      else seg.push(p);
    }
    if (seg.length > 1) R.drawTrail(seg, color, alpha, width, dashed);
  }

  /* ---------- input ---------- */
  Play.prototype.pointerDown = function (w) {
    if (this.phase === 'done' && this.result && !this.result.won) { this.pushGhost(); this.retry(); }
    if (this.phase !== 'aim') return false;
    this.drag = { x: w.x, y: w.y, moved: false };
    return true;
  };
  Play.prototype.pointerMove = function (w) {
    if (!this.drag) return;
    const dx = this.drag.x - w.x, dy = this.drag.y - w.y;
    const d = Math.hypot(dx, dy);
    if (d > 10) this.drag.moved = true;
    if (this.drag.moved) this.setAim(Math.atan2(dy, dx), d / DRAG_FULL);
  };
  Play.prototype.pointerUp = function () {
    if (!this.drag) return;
    const moved = this.drag.moved;
    this.drag = null;
    if (moved) this.launch();
  };
  Play.prototype.key = function (e, down) {
    if (e.key === 'f' || e.key === 'F') { this.ff = down; return true; }
    if (!down) return false;
    const fine = e.shiftKey ? 0.1 : 1;
    switch (e.key) {
      case 'ArrowLeft': if (this.phase === 'aim') this.setAim(this.angle - 0.01 * fine, this.power); return true;
      case 'ArrowRight': if (this.phase === 'aim') this.setAim(this.angle + 0.01 * fine, this.power); return true;
      case 'ArrowUp': if (this.phase === 'aim') this.setAim(this.angle, this.power + 0.01 * fine); return true;
      case 'ArrowDown': if (this.phase === 'aim') this.setAim(this.angle, this.power - 0.01 * fine); return true;
      case ' ': case 'Enter':
        if (this.phase === 'aim') this.launch();
        else if (this.phase === 'fly') { this.pushGhost(); this.retry(); }
        return true;
      case 'r': case 'R': this.retry(); return true;
    }
    return false;
  };

  CC.Play = Play;
})(window);
