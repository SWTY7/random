/* Comet Courier — canvas renderer. World is 1600×900, letterboxed into the window. */
(function (root) {
  'use strict';
  const CC = (root.CC = root.CC || {});
  const { W, H } = CC.PHYS;
  const TAU = Math.PI * 2;

  let cv, g, dpr = 1;
  const view = { s: 1, ox: 0, oy: 0, cw: 0, ch: 0 };
  let stars = [], nebula = null, nebulaKey = '';
  const glowCache = {};
  const particles = [];
  let reduce = false;

  function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  function setup(canvas) {
    cv = canvas; g = cv.getContext('2d');
    window.addEventListener('resize', resize);
    resize();
    stars = [];
    for (let i = 0; i < 420; i++) {
      stars.push({ x: hash(i) * 2400 - 400, y: hash(i + 1000) * 1500 - 300, z: 0.2 + hash(i + 2000) * 0.8, tw: hash(i + 3000) * TAU, c: hash(i + 4000) });
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const s = Math.min(w / W, h / H);
    view.s = s; view.ox = (w - W * s) / 2; view.oy = (h - H * s) / 2; view.cw = w; view.ch = h;
  }

  function toWorld(cx, cy) { return { x: (cx - view.ox) / view.s, y: (cy - view.oy) / view.s }; }
  function toScreen(x, y) { return { x: x * view.s + view.ox, y: y * view.s + view.oy }; }

  function glow(color, size) {
    const k = color + size;
    if (glowCache[k]) return glowCache[k];
    const c = document.createElement('canvas'); c.width = c.height = size * 2;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(size, size, 0, size, size, size);
    gr.addColorStop(0, color); gr.addColorStop(0.25, color.replace(/[\d.]+\)$/, '0.35)')); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(0, 0, size * 2, size * 2);
    return (glowCache[k] = c);
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ---------- frame ---------- */
  function begin(pal, time, cam) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // background gradient fills the whole window
    const gr = g.createLinearGradient(0, 0, 0, view.ch);
    gr.addColorStop(0, pal.bg1); gr.addColorStop(1, pal.bg2);
    g.fillStyle = gr; g.fillRect(0, 0, view.cw, view.ch);
    // nebula (cached per palette)
    const key = pal.a + pal.b + view.cw + 'x' + view.ch;
    if (nebulaKey !== key) { nebula = makeNebula(pal); nebulaKey = key; }
    g.globalAlpha = 0.9; g.drawImage(nebula, 0, 0, view.cw, view.ch); g.globalAlpha = 1;
    // stars with parallax against the camera drift
    const px = cam ? cam.x : 0, py = cam ? cam.y : 0;
    for (const s of stars) {
      const x = (s.x - px * s.z * 0.04) * view.s + view.ox, y = (s.y - py * s.z * 0.04) * view.s + view.oy;
      if (x < -4 || y < -4 || x > view.cw + 4 || y > view.ch + 4) continue;
      const tw = reduce ? 0.8 : 0.55 + 0.45 * Math.sin(time * (0.6 + s.z) + s.tw);
      g.fillStyle = s.c > 0.85 ? `rgba(255,220,180,${tw * s.z})` : s.c > 0.7 ? `rgba(180,210,255,${tw * s.z})` : `rgba(255,255,255,${tw * s.z * 0.85})`;
      const r = s.z * 1.4 * Math.max(0.6, view.s);
      g.fillRect(x - r / 2, y - r / 2, r, r);
    }
    // world transform
    g.setTransform(dpr * view.s, 0, 0, dpr * view.s, dpr * view.ox, dpr * view.oy);
  }

  function makeNebula(pal) {
    const c = document.createElement('canvas');
    c.width = 480; c.height = 270;
    const x = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const cx = hash(i + 50) * 480, cy = hash(i + 80) * 270, r = 60 + hash(i + 90) * 140;
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, hexA(i % 2 ? pal.a : pal.b, 0.09 + hash(i) * 0.05));
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 480, 270);
    }
    return c;
  }

  // dim area outside the 1600×900 playfield so players know where "the world" is
  function frame(pal) {
    g.save();
    g.strokeStyle = hexA(pal.a, 0.08); g.lineWidth = 2; g.setLineDash([6, 10]);
    g.strokeRect(0, 0, W, H);
    g.restore();
  }

  /* ---------- level pieces ---------- */
  const PLANET_COLORS = [
    ['#7fd3c4', '#2c6e75'], ['#f6ad55', '#9c4221'], ['#90cdf4', '#2b4c7e'], ['#f687b3', '#7b2150'],
    ['#c6f6d5', '#2f6f4e'], ['#fbd38d', '#975a16'], ['#b794f4', '#44337a'], ['#feb2b2', '#822727'],
  ];

  function drawPlanet(b, x, y, i, time) {
    const [c1, c2] = PLANET_COLORS[(i * 3 + (b.r | 0)) % PLANET_COLORS.length];
    const r = b.r;
    g.drawImage(glow(hexA(c1, 0.5), 64), x - r * 1.9, y - r * 1.9, r * 3.8, r * 3.8);
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    // bands
    g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
    g.globalAlpha = 0.18; g.fillStyle = c2;
    const bands = b.type === 'giant' ? 6 : 3;
    for (let k = 0; k < bands; k++) {
      const yy = y - r + ((k + 0.5) * 2 * r) / bands + Math.sin(time * 0.3 + k) * 2;
      g.fillRect(x - r, yy, r * 2, r * (b.type === 'giant' ? 0.12 : 0.18));
    }
    g.globalAlpha = 1;
    // night side
    const sh = g.createLinearGradient(x - r, y - r, x + r, y + r);
    sh.addColorStop(0.45, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,10,0.55)');
    g.fillStyle = sh; g.fillRect(x - r, y - r, r * 2, r * 2);
    g.restore();
    if (b.type === 'giant') {
      g.save(); g.translate(x, y); g.rotate(-0.35);
      g.strokeStyle = hexA(c1, 0.55); g.lineWidth = 6; g.beginPath(); g.ellipse(0, 0, r * 1.7, r * 0.38, 0, Math.PI * 1.02, TAU * 0.99); g.stroke();
      g.strokeStyle = hexA(c1, 0.25); g.lineWidth = 12; g.beginPath(); g.ellipse(0, 0, r * 1.95, r * 0.46, 0, Math.PI * 1.02, TAU * 0.99); g.stroke();
      g.restore();
    }
  }

  function drawMoon(b, x, y, i) {
    const r = b.r;
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    gr.addColorStop(0, '#e2e8f0'); gr.addColorStop(1, '#4a5568');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.15)';
    for (let k = 0; k < 3; k++) {
      g.beginPath(); g.arc(x + (hash(i * 7 + k) - 0.5) * r, y + (hash(i * 9 + k) - 0.5) * r, r * (0.12 + hash(k + i) * 0.15), 0, TAU); g.fill();
    }
  }

  function drawSun(b, x, y, time) {
    const r = b.r;
    const pulse = reduce ? 1 : 1 + 0.05 * Math.sin(time * 2);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(glow('rgba(255,180,80,0.9)', 128), x - r * 3.4 * pulse, y - r * 3.4 * pulse, r * 6.8 * pulse, r * 6.8 * pulse);
    // corona flickers
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU + time * 0.15;
      const len = r * (1.15 + 0.15 * Math.sin(time * 3 + k * 1.7));
      g.strokeStyle = 'rgba(255,200,120,0.18)'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, '#fffbe6'); gr.addColorStop(0.5, '#ffd27a'); gr.addColorStop(1, '#ff8a3d');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }

  function drawRepulsor(b, x, y, time) {
    const r = b.r;
    g.globalCompositeOperation = 'lighter';
    g.drawImage(glow('rgba(220,240,255,0.9)', 64), x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
    const n = 3;
    for (let k = 0; k < n; k++) {
      const ph = ((time * 0.6 + k / n) % 1);
      g.strokeStyle = `rgba(220,240,255,${0.45 * (1 - ph)})`; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, r + ph * r * 4, 0, TAU); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#f7fbff'; g.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU + time * 0.4, rr = k % 2 ? r * 0.62 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
  }

  function drawBlackHole(b, x, y, time) {
    const r = b.r;
    g.save(); g.translate(x, y);
    // lensing halo
    g.drawImage(glow('rgba(140,60,200,0.6)', 96), -r * 6, -r * 6, r * 12, r * 12);
    // accretion disk (back half)
    g.rotate(-0.25);
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) {
      g.strokeStyle = `rgba(255,${140 + k * 25},${60 + k * 30},${0.35 - k * 0.06})`; g.lineWidth = 4 - k * 0.6;
      g.beginPath(); g.ellipse(0, 0, r * (2.2 + k * 0.45), r * (0.55 + k * 0.1), 0, Math.PI, TAU); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    // core
    g.rotate(0.25);
    g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, r * 1.15, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,200,140,0.9)'; g.lineWidth = 1.6;
    g.beginPath(); g.arc(0, 0, r * 1.18, 0, TAU); g.stroke();
    // front half of disk
    g.rotate(-0.25);
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) {
      g.strokeStyle = `rgba(255,${150 + k * 25},${70 + k * 30},${0.55 - k * 0.1})`; g.lineWidth = 4 - k * 0.6;
      g.beginPath(); g.ellipse(0, 0, r * (2.2 + k * 0.45), r * (0.55 + k * 0.1), 0, 0, Math.PI); g.stroke();
    }
    // orbiting sparks
    if (!reduce) for (let k = 0; k < 10; k++) {
      const a = time * (2.4 - k * 0.12) + k * 1.3, R = r * (2.1 + (k % 4) * 0.45);
      g.fillStyle = 'rgba(255,220,170,0.8)';
      g.fillRect(Math.cos(a) * R - 1, Math.sin(a) * R * 0.25 - 1, 2, 2);
    }
    g.globalCompositeOperation = 'source-over';
    g.restore();
  }

  function drawAsteroid(b, x, y, i, time) {
    const r = b.r;
    g.save(); g.translate(x, y); g.rotate(time * (0.2 + hash(i) * 0.4) * (hash(i + 5) > 0.5 ? 1 : -1));
    g.fillStyle = '#8a7867'; g.strokeStyle = '#4a3f36'; g.lineWidth = 2;
    g.beginPath();
    const n = 9;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU, rr = r * (0.82 + hash(i * 13 + k) * 0.3);
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath(); g.arc(r * 0.25, -r * 0.2, r * 0.22, 0, TAU); g.fill();
    g.beginPath(); g.arc(-r * 0.3, r * 0.3, r * 0.15, 0, TAU); g.fill();
    g.restore();
  }

  function drawWorm(x, y, r, time, hue) {
    g.save(); g.translate(x, y);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(glow(`hsla(${hue},90%,65%,0.8)`, 64), -r * 2.4, -r * 2.4, r * 4.8, r * 4.8);
    g.rotate(time * 2.2);
    for (let arm = 0; arm < 4; arm++) {
      g.strokeStyle = `hsla(${hue + arm * 12},90%,70%,0.75)`; g.lineWidth = 2.5;
      g.beginPath();
      for (let k = 0; k <= 24; k++) {
        const t = k / 24, a = arm * (TAU / 4) + t * 4, rr = r * (1 - t);
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#05010d'; g.beginPath(); g.arc(0, 0, r * 0.22, 0, TAU); g.fill();
    g.restore();
  }

  function drawGoal(x, y, r, time, pal) {
    g.save(); g.translate(x, y);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(glow(hexA(pal.a, 0.7), 64), -r * 2.2, -r * 2.2, r * 4.4, r * 4.4);
    g.rotate(time * 0.8);
    g.strokeStyle = pal.a; g.lineWidth = 3; g.setLineDash([10, 7]);
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
    g.rotate(-time * 1.6);
    g.strokeStyle = hexA(pal.b, 0.8); g.lineWidth = 1.5; g.setLineDash([3, 9]);
    g.beginPath(); g.arc(0, 0, r * 0.75, 0, TAU); g.stroke();
    g.setLineDash([]);
    g.globalCompositeOperation = 'source-over';
    g.restore();
    // little envelope
    const s = r * 0.42, bob = reduce ? 0 : Math.sin(time * 2) * 2;
    g.save(); g.translate(x, y + bob);
    g.fillStyle = '#fff8e7'; g.strokeStyle = '#c05621'; g.lineWidth = 1.5;
    g.fillRect(-s, -s * 0.65, s * 2, s * 1.3); g.strokeRect(-s, -s * 0.65, s * 2, s * 1.3);
    g.beginPath(); g.moveTo(-s, -s * 0.65); g.lineTo(0, s * 0.15); g.lineTo(s, -s * 0.65); g.stroke();
    g.fillStyle = '#e53e3e'; g.beginPath(); g.arc(0, s * 0.12, s * 0.16, 0, TAU); g.fill();
    g.restore();
  }

  function drawDust(x, y, time, i, taken) {
    if (taken) return;
    const s = 9 + (reduce ? 0 : Math.sin(time * 4 + i) * 2);
    g.save(); g.translate(x, y); g.rotate(time * 0.8 + i);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(glow('rgba(255,236,150,0.9)', 32), -s * 2.4, -s * 2.4, s * 4.8, s * 4.8);
    g.fillStyle = '#fff6c8';
    g.beginPath();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU, rr = k % 2 ? s * 0.3 : s; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.restore();
  }

  function drawWall(w, pal) {
    const wd = w.w || 8;
    g.lineCap = 'round';
    g.strokeStyle = hexA(pal.b, 0.25); g.lineWidth = wd + 10;
    g.beginPath(); g.moveTo(w.x1, w.y1); g.lineTo(w.x2, w.y2); g.stroke();
    g.strokeStyle = '#2d3748'; g.lineWidth = wd;
    g.beginPath(); g.moveTo(w.x1, w.y1); g.lineTo(w.x2, w.y2); g.stroke();
    g.strokeStyle = hexA(pal.b, 0.9); g.lineWidth = 1.5; g.setLineDash([12, 10]);
    g.beginPath(); g.moveTo(w.x1, w.y1); g.lineTo(w.x2, w.y2); g.stroke();
    g.setLineDash([]); g.lineCap = 'butt';
  }

  function drawStart(x, y, time, pal) {
    g.strokeStyle = hexA(pal.b, 0.5); g.lineWidth = 1.5; g.setLineDash([4, 6]);
    g.beginPath(); g.arc(x, y, 22 + (reduce ? 0 : Math.sin(time * 3) * 2), 0, TAU); g.stroke(); g.setLineDash([]);
  }

  // Draw the whole level at time t. opts: { dust: [bool], hideGoal, highlight }
  function drawLevel(L, t, pal, time, opts) {
    opts = opts || {};
    const P = CC.snapshot(L, t);
    const n = L.bodies.length;
    // orbit guides
    g.lineWidth = 1;
    const guide = (o, around) => {
      let c = { x: o.cx, y: o.cy };
      if (o.around != null) c = { x: P[o.around * 2], y: P[o.around * 2 + 1] };
      g.strokeStyle = hexA(pal.a, 0.13); g.setLineDash([3, 8]);
      g.beginPath(); g.arc(c.x, c.y, o.R, 0, TAU); g.stroke(); g.setLineDash([]);
      if (opts.arrows) {
        const a = (o.phase || 0) + (TAU * t) / o.period + (o.period > 0 ? 0.35 : -0.35);
        const ax = c.x + Math.cos(a) * o.R, ay = c.y + Math.sin(a) * o.R;
        const dir = a + (o.period > 0 ? Math.PI / 2 : -Math.PI / 2);
        g.fillStyle = hexA(pal.a, 0.5);
        g.beginPath();
        g.moveTo(ax + Math.cos(dir) * 7, ay + Math.sin(dir) * 7);
        g.lineTo(ax + Math.cos(dir + 2.5) * 6, ay + Math.sin(dir + 2.5) * 6);
        g.lineTo(ax + Math.cos(dir - 2.5) * 6, ay + Math.sin(dir - 2.5) * 6);
        g.fill();
      }
    };
    L.bodies.forEach((b) => b.orbit && guide(b.orbit));
    if (L.goal.orbit) guide(L.goal.orbit);

    L.walls.forEach((w) => drawWall(w, pal));
    L.worms.forEach((w, i) => {
      g.strokeStyle = 'rgba(120,170,255,0.12)'; g.setLineDash([2, 10]); g.lineWidth = 2;
      g.beginPath(); g.moveTo(w.ax, w.ay); g.lineTo(w.bx, w.by); g.stroke(); g.setLineDash([]);
      const hue = 200 + i * 45;
      drawWorm(w.ax, w.ay, w.r || 30, time, hue);
      drawWorm(w.bx, w.by, w.r || 30, -time, hue);
    });
    if (L.start && !opts.noStart) drawStart(L.start.x, L.start.y, time, pal);
    L.dust.forEach((d, i) => drawDust(d.x, d.y, time, i, opts.dust && opts.dust[i]));
    if (!opts.hideGoal) drawGoal(P[n * 2], P[n * 2 + 1], L.goal.r, time, pal);
    for (let i = 0; i < n; i++) {
      const b = L.bodies[i], x = P[i * 2], y = P[i * 2 + 1];
      switch (b.type) {
        case 'sun': drawSun(b, x, y, time); break;
        case 'repulsor': drawRepulsor(b, x, y, time); break;
        case 'blackhole': drawBlackHole(b, x, y, time); break;
        case 'asteroid': drawAsteroid(b, x, y, i, time); break;
        case 'moon': drawMoon(b, x, y, i); break;
        default: drawPlanet(b, x, y, i, time);
      }
      if (opts.highlight === i) {
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.setLineDash([4, 4]);
        g.beginPath(); g.arc(x, y, b.r + 8, 0, TAU); g.stroke(); g.setLineDash([]);
      }
    }
    return P;
  }

  /* ---------- comet, trails, aim ---------- */
  function drawTrail(pts, color, alpha, width, dashed) {
    if (pts.length < 2) return;
    g.save();
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (dashed) g.setLineDash([2, 7]);
    const N = pts.length;
    if (dashed) {
      g.strokeStyle = color.replace('A', alpha); g.lineWidth = width;
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < N; i++) g.lineTo(pts[i].x, pts[i].y);
      g.stroke();
    } else {
      g.globalCompositeOperation = 'lighter';
      const seg = 12;
      for (let s0 = 0; s0 < N - 1; s0 += seg) {
        const k = (s0 + seg / 2) / N;
        g.strokeStyle = color.replace('A', (alpha * k).toFixed(3));
        g.lineWidth = width * (0.25 + 0.75 * k);
        g.beginPath(); g.moveTo(pts[s0].x, pts[s0].y);
        for (let i = s0 + 1; i <= Math.min(N - 1, s0 + seg); i++) g.lineTo(pts[i].x, pts[i].y);
        g.stroke();
      }
    }
    g.restore();
  }

  function drawComet(x, y, vx, vy, time, pal) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.drawImage(glow('rgba(160,230,255,0.95)', 64), x - 30, y - 30, 60, 60);
    const sp = Math.hypot(vx, vy) || 1, nx = -vx / sp, ny = -vy / sp;
    const len = 18 + Math.min(40, sp * 0.04);
    const gr = g.createLinearGradient(x, y, x + nx * len, y + ny * len);
    gr.addColorStop(0, 'rgba(200,245,255,0.9)'); gr.addColorStop(1, 'rgba(80,160,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(x - ny * 5, y + nx * 5); g.lineTo(x + nx * len, y + ny * len); g.lineTo(x + ny * 5, y - nx * 5);
    g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill();
    g.restore();
  }

  function drawAim(L, angle, power, previewPts, pal, time) {
    const sx = L.start.x, sy = L.start.y;
    // power arc
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 6;
    g.beginPath(); g.arc(sx, sy, 46, 0, TAU); g.stroke();
    g.strokeStyle = hexA(pal.b, 0.85); g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.arc(sx, sy, 46, angle - power * Math.PI, angle + power * Math.PI); g.stroke();
    // arrow
    const len = 40 + power * 60;
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len); g.stroke();
    g.fillStyle = '#fff';
    const hx = sx + Math.cos(angle) * len, hy = sy + Math.sin(angle) * len;
    g.beginPath(); g.moveTo(hx + Math.cos(angle) * 10, hy + Math.sin(angle) * 10);
    g.lineTo(hx + Math.cos(angle + 2.4) * 9, hy + Math.sin(angle + 2.4) * 9);
    g.lineTo(hx + Math.cos(angle - 2.4) * 9, hy + Math.sin(angle - 2.4) * 9); g.fill();
    g.restore();
    // preview dots
    if (previewPts) {
      for (let i = 0; i < previewPts.length; i++) {
        const k = 1 - i / previewPts.length;
        const p = previewPts[i];
        g.fillStyle = `rgba(255,255,255,${0.85 * k})`;
        g.beginPath(); g.arc(p.x, p.y, 2.6 * k + 0.8, 0, TAU); g.fill();
      }
    }
  }

  /* ---------- particles ---------- */
  function burst(x, y, color, n, speed, life) {
    if (reduce) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = speed * (0.3 + Math.random() * 0.7);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life || 1, max: life || 1, color, size: 1.5 + Math.random() * 2.5 });
    }
  }
  function puff(x, y, vx, vy) {
    if (reduce || particles.length > 900) return;
    particles.push({ x, y, vx: -vx * 0.05 + (Math.random() - 0.5) * 30, vy: -vy * 0.05 + (Math.random() - 0.5) * 30, life: 0.6, max: 0.6, color: '150,210,255', size: 1 + Math.random() * 2 });
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt; if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; p.vy *= 0.985;
    }
  }
  function drawParticles() {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      g.fillStyle = `rgba(${p.color},${(p.life / p.max).toFixed(3)})`;
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    g.restore();
  }
  function clearParticles() { particles.length = 0; }

  // full-screen flash/shockwave ring
  const rings = [];
  function ring(x, y, color, maxR) { rings.push({ x, y, color, r: 4, maxR: maxR || 200, life: 1 }); }
  function drawRings(dt) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life -= dt * 1.4; r.r += (r.maxR - r.r) * dt * 4;
      if (r.life <= 0) { rings.splice(i, 1); continue; }
      g.strokeStyle = `rgba(${r.color},${r.life.toFixed(3)})`; g.lineWidth = 3 * r.life + 0.5;
      g.beginPath(); g.arc(r.x, r.y, r.r, 0, TAU); g.stroke();
    }
  }

  CC.render = {
    setup, resize, view, toWorld, toScreen, begin, frame, drawLevel, drawTrail, drawComet, drawAim,
    burst, puff, updateParticles, drawParticles, clearParticles, ring, drawRings,
    drawPlanet, drawSun, drawMoon, drawRepulsor, drawBlackHole, drawAsteroid, drawWorm, drawGoal, drawDust, drawWall,
    get ctx() { return g; },
    set reduce(v) { reduce = v; },
    hexA, glow,
  };
})(window);
