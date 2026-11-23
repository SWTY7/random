/* Comet Courier — physics core.
 * Shared by the game, the daily-route generator and the offline level checker (node).
 * Everything is deterministic: same level + same launch = same flight. */
(function (root) {
  'use strict';
  const CC = (root.CC = root.CC || {});

  const W = 1600, H = 900;          // logical world size
  const DT = 1 / 240;               // fixed physics step
  const MAX_T = 18;                 // seconds before a comet "drifts off"
  const MU = 1e6;                   // mass unit
  const COMET_R = 5;
  const DUST_R = 20;
  const BOUNDS = 380;               // how far off-screen before we give up
  const TAU = Math.PI * 2;

  const PHYS = { W, H, DT, MAX_T, MU, COMET_R, DUST_R, BOUNDS };

  // default mass / radius by body type (level data may override)
  const BODY_DEFAULTS = {
    planet:    { r: 46, m: 6 },
    giant:     { r: 90, m: 16 },
    moon:      { r: 22, m: 2 },
    sun:       { r: 60, m: 14 },
    repulsor:  { r: 26, m: -7 },
    blackhole: { r: 16, m: 34 },
    asteroid:  { r: 18, m: 0 },
  };

  function normalizeLevel(lv) {
    const L = JSON.parse(JSON.stringify(lv));
    L.bodies = (L.bodies || []).map((b) => {
      const d = BODY_DEFAULTS[b.type] || BODY_DEFAULTS.planet;
      return Object.assign({ r: d.r, m: d.m }, b);
    });
    L.dust = L.dust || [];
    L.walls = L.walls || [];
    L.worms = L.worms || [];
    L.maxSpeed = L.maxSpeed || 640;
    L.goal = Object.assign({ r: 40 }, L.goal);
    L.preview = L.preview == null ? 1.2 : L.preview;
    L.par = L.par || 3;
    return L;
  }

  /* ---------- kinematics: bodies may follow circular orbits ---------- */
  function orbitCenter(L, o, t, cache) {
    if (o.around != null) return posOf(L, L.bodies[o.around], o.around, t, cache);
    return { x: o.cx, y: o.cy };
  }
  function posOf(L, obj, idx, t, cache) {
    if (!obj.orbit) return { x: obj.x, y: obj.y };
    if (cache && idx != null && cache[idx]) return cache[idx];
    const o = obj.orbit;
    const c = orbitCenter(L, o, t, cache);
    const a = (o.phase || 0) + (TAU * t) / o.period;
    const p = { x: c.x + o.R * Math.cos(a), y: c.y + o.R * Math.sin(a) };
    if (cache && idx != null) cache[idx] = p;
    return p;
  }

  // Returns Float64Array [x0,y0,x1,y1,...,gx,gy] of body + goal positions at time t.
  function snapshot(L, t) {
    const n = L.bodies.length;
    const out = new Float64Array(n * 2 + 2);
    const cache = [];
    for (let i = 0; i < n; i++) {
      const p = posOf(L, L.bodies[i], i, t, cache);
      out[i * 2] = p.x; out[i * 2 + 1] = p.y;
    }
    const g = posOf(L, L.goal, null, t, cache);
    out[n * 2] = g.x; out[n * 2 + 1] = g.y;
    return out;
  }

  // Lazily caches snapshots per step index — the solver reuses them across thousands of flights.
  function Kinematics(L) {
    this.L = L;
    this.moving = L.bodies.some((b) => b.orbit) || !!L.goal.orbit;
    this.cache = [];
    this.static = this.moving ? null : snapshot(L, 0);
  }
  Kinematics.prototype.at = function (step) {
    if (!this.moving) return this.static;
    let s = this.cache[step];
    if (!s) s = this.cache[step] = snapshot(this.L, step * DT);
    return s;
  };

  /* ---------- flight ---------- */
  function launchVelocity(L, angle, power) {
    const sp = Math.max(0, Math.min(1, power)) * L.maxSpeed;
    return { vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp };
  }

  function newFlight(L, angle, power) {
    const v = launchVelocity(L, angle, power);
    return {
      step: 0, t: 0,
      x: L.start.x, y: L.start.y, vx: v.vx, vy: v.vy,
      state: 'flying',      // flying | won | crashed | swallowed | lost | drifted
      dust: new Array(L.dust.length).fill(false),
      dustCount: 0,
      wormCD: 0,
      swept: new Float64Array(L.bodies.length), // signed angle swept around each body
      lastAng: null,
      maxSpeed: Math.hypot(v.vx, v.vy),
      orbits: 0,
      worms: 0,
      closest: Infinity,   // closest pass to any body surface
      hitBody: -1,
    };
  }

  function segDist2(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy || 1;
    let u = ((px - x1) * dx + (py - y1) * dy) / l2;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const qx = x1 + u * dx - px, qy = y1 + u * dy - py;
    return qx * qx + qy * qy;
  }

  // Advance one fixed step. `events` (optional array) receives notable things for audio/fx.
  function step(L, K, f, events) {
    if (f.state !== 'flying') return f.state;
    const P = K.at(f.step);
    const bodies = L.bodies;
    const n = bodies.length;

    // gravity
    let ax = 0, ay = 0;
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      if (!b.m) continue;
      const dx = P[i * 2] - f.x, dy = P[i * 2 + 1] - f.y;
      const soft = b.r * 0.5;
      const d2 = dx * dx + dy * dy + soft * soft;
      const inv = (b.m * MU) / (d2 * Math.sqrt(d2));
      ax += dx * inv; ay += dy * inv;
    }
    f.vx += ax * DT; f.vy += ay * DT;
    const px = f.x, py = f.y;
    f.x += f.vx * DT; f.y += f.vy * DT;
    f.step++; f.t = f.step * DT;
    const P2 = K.at(f.step);

    const sp = Math.hypot(f.vx, f.vy);
    if (sp > f.maxSpeed) f.maxSpeed = sp;

    // bodies: collisions + orbit counting
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      const dx = f.x - P2[i * 2], dy = f.y - P2[i * 2 + 1];
      const d = Math.hypot(dx, dy);
      const surf = d - b.r;
      if (surf < f.closest) f.closest = surf;
      if (d < b.r + COMET_R * (b.type === 'blackhole' ? 0.2 : 1)) {
        f.state = b.type === 'blackhole' ? 'swallowed' : 'crashed';
        f.hitBody = i;
        if (events) events.push({ type: f.state, body: i, x: f.x, y: f.y });
        return f.state;
      }
      if (b.m > 0 && d < 420) {
        const ang = Math.atan2(dy, dx);
        if (f.lastAng && f.lastAng[i] != null) {
          let da = ang - f.lastAng[i];
          if (da > Math.PI) da -= TAU; else if (da < -Math.PI) da += TAU;
          f.swept[i] += da;
          if (Math.abs(f.swept[i]) >= TAU) {
            f.swept[i] = 0; f.orbits++;
            if (events) events.push({ type: 'orbit', body: i });
          }
        }
        (f.lastAng || (f.lastAng = []))[i] = ang;
      } else if (f.lastAng) {
        f.lastAng[i] = null; f.swept[i] = 0;
      }
    }

    // walls
    for (let i = 0; i < L.walls.length; i++) {
      const w = L.walls[i];
      const lim = (w.w || 8) / 2 + COMET_R;
      if (segDist2(f.x, f.y, w.x1, w.y1, w.x2, w.y2) < lim * lim ||
          segDist2((px + f.x) / 2, (py + f.y) / 2, w.x1, w.y1, w.x2, w.y2) < lim * lim) {
        f.state = 'crashed';
        if (events) events.push({ type: 'crashed', wall: i, x: f.x, y: f.y });
        return f.state;
      }
    }

    // wormholes
    if (f.wormCD > 0) f.wormCD -= DT;
    else {
      for (let i = 0; i < L.worms.length; i++) {
        const w = L.worms[i];
        const r = w.r || 30;
        let from = null, to = null;
        if ((f.x - w.ax) ** 2 + (f.y - w.ay) ** 2 < r * r) { from = 'a'; to = { x: w.bx, y: w.by }; }
        else if ((f.x - w.bx) ** 2 + (f.y - w.by) ** 2 < r * r) { from = 'b'; to = { x: w.ax, y: w.ay }; }
        if (from) {
          const nx = f.vx / (sp || 1), ny = f.vy / (sp || 1);
          if (events) events.push({ type: 'worm', worm: i, fromX: f.x, fromY: f.y, x: to.x, y: to.y });
          f.x = to.x + nx * (r + 4); f.y = to.y + ny * (r + 4);
          f.wormCD = 0.25; f.worms++;
          f.lastAng = null;
          break;
        }
      }
    }

    // stardust
    for (let i = 0; i < L.dust.length; i++) {
      if (f.dust[i]) continue;
      const d = L.dust[i];
      if ((f.x - d.x) ** 2 + (f.y - d.y) ** 2 < DUST_R * DUST_R) {
        f.dust[i] = true; f.dustCount++;
        if (events) events.push({ type: 'dust', index: i, x: d.x, y: d.y, n: f.dustCount });
      }
    }

    // goal
    const gx = P2[n * 2], gy = P2[n * 2 + 1];
    if ((f.x - gx) ** 2 + (f.y - gy) ** 2 < L.goal.r * L.goal.r) {
      f.state = 'won';
      if (events) events.push({ type: 'won', x: f.x, y: f.y });
      return f.state;
    }

    if (f.x < -BOUNDS || f.x > W + BOUNDS || f.y < -BOUNDS || f.y > H + BOUNDS) {
      f.state = 'lost';
      if (events) events.push({ type: 'lost' });
    } else if (f.t >= MAX_T) {
      f.state = 'drifted';
      if (events) events.push({ type: 'drifted' });
    }
    return f.state;
  }

  function simulate(L, K, angle, power, maxSteps) {
    const f = newFlight(L, angle, power);
    const lim = maxSteps || Math.ceil(MAX_T / DT) + 2;
    while (f.state === 'flying' && f.step < lim) step(L, K, f, null);
    return f;
  }

  // Brute-force search over launches. Used by the daily generator and the level checker.
  // Returns { win, full } — a winning launch, and a winning launch that also collects all dust.
  function solve(L, opts) {
    opts = opts || {};
    const K = opts.K || new Kinematics(L);
    const NA = opts.angles || 360, NP = opts.powers || 24;
    const pMin = opts.pMin == null ? 0.15 : opts.pMin;
    let win = null, full = null, wins = 0, best = null;
    const total = L.dust.length;
    for (let pi = 0; pi < NP; pi++) {
      const power = pMin + ((1 - pMin) * (pi + 0.5)) / NP;
      for (let ai = 0; ai < NA; ai++) {
        const angle = (TAU * ai) / NA;
        const f = simulate(L, K, angle, power);
        if (f.state === 'won') {
          wins++;
          if (!win) win = { angle, power, dust: f.dustCount, t: f.t };
          if (!best || f.dustCount > best.dust) best = { angle, power, dust: f.dustCount, t: f.t };
          if (f.dustCount === total && !full) {
            full = { angle, power, t: f.t };
            if (opts.stopOnFull) return { win, full, wins, best, tried: (pi * NA + ai + 1) };
          }
        }
      }
    }
    return { win, full, wins, best, tried: NA * NP };
  }

  Object.assign(CC, {
    PHYS, BODY_DEFAULTS, normalizeLevel, snapshot, Kinematics, posOf,
    newFlight, step, simulate, solve, launchVelocity,
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = CC;
})(typeof window !== 'undefined' ? window : globalThis);
