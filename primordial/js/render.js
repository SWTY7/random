// Primordial: drawing the world.
'use strict';
(function (G) {
  const PR = G.PR;
  const { clamp, TAU, NS, NCH } = PR;

  class Renderer {
    constructor(canvas) {
      this.cv = canvas; this.ctx = canvas.getContext('2d');
      this.cam = { x: 0, y: 0, z: 1 };
      this.dpr = 1; this.w = 1; this.h = 1;
      this.fertCv = document.createElement('canvas');
      this.fertKey = '';
      this.opts = { colorBy: 'species', vision: true, trails: true, fertility: true, highlight: 0 };
      this.trail = []; this.trailId = 0;
    }
    resize() {
      const r = this.cv.getBoundingClientRect();
      this.dpr = Math.min(2, G.devicePixelRatio || 1);
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
      this.cv.width = Math.round(this.w * this.dpr); this.cv.height = Math.round(this.h * this.dpr);
    }
    // Fit the world into the part of the stage not covered by the floating bars.
    fit(world) {
      const m = this.margins || { t: 0, r: 0, b: 0, l: 0 };
      const aw = Math.max(50, this.w - m.l - m.r), ah = Math.max(50, this.h - m.t - m.b);
      const z = Math.min(aw / world.W, ah / world.H) * 0.98;
      this.cam = { x: world.W / 2 - (m.l - m.r) / 2 / z, y: world.H / 2 - (m.t - m.b) / 2 / z, z };
    }
    toWorld(sx, sy) { const c = this.cam; return [(sx - this.w / 2) / c.z + c.x, (sy - this.h / 2) / c.z + c.y]; }
    toScreen(wx, wy) { const c = this.cam; return [(wx - c.x) * c.z + this.w / 2, (wy - c.y) * c.z + this.h / 2]; }
    zoomAt(sx, sy, f, world) {
      const [wx, wy] = this.toWorld(sx, sy);
      const minZ = Math.min(this.w / world.W, this.h / world.H) * 0.5;
      this.cam.z = clamp(this.cam.z * f, minZ, 12);
      const [wx2, wy2] = this.toWorld(sx, sy);
      this.cam.x += wx - wx2; this.cam.y += wy - wy2;
    }
    clampCam(world) {
      const c = this.cam, mx = this.w / 2 / c.z, my = this.h / 2 / c.z;
      c.x = world.W > 2 * mx ? clamp(c.x, mx * 0.3, world.W - mx * 0.3) : clamp(c.x, world.W - mx, mx);
      c.y = world.H > 2 * my ? clamp(c.y, my * 0.3, world.H - my * 0.3) : clamp(c.y, world.H - my, my);
    }

    updateFertility(world) {
      const season = Math.round(world.seasonPhase() * 40);
      const key = world.fertVersion + ':' + season + ':' + world.p.seasonAmp;
      if (key === this.fertKey) return;
      this.fertKey = key;
      const fc = this.fertCv, fw = world.fw, fh = world.fh;
      if (fc.width !== fw || fc.height !== fh) { fc.width = fw; fc.height = fh; }
      const fctx = fc.getContext('2d'), img = fctx.createImageData(fw, fh), d = img.data;
      for (let j = 0; j < fh; j++) {
        const s = world.seasonal((j + 0.5) * PR.FS);
        for (let i = 0; i < fw; i++) {
          const f = world.fert[i + j * fw], v = clamp(f * s, 0, 1.4), k = (i + j * fw) * 4;
          // Barren deep water to lush shallows.
          d[k] = 10 + v * 22; d[k + 1] = 28 + v * 62; d[k + 2] = 42 + v * 34; d[k + 3] = 255;
        }
      }
      fctx.putImageData(img, 0, 0);
    }

    colorOf(c, world, mode, maxGen) {
      switch (mode) {
        case 'diet': { const h = 125 - c.ph.diet * 125; return `hsl(${h},70%,55%)`; }
        case 'gen': { const t = maxGen ? c.gen / maxGen : 0; return `hsl(${260 - t * 220},65%,${45 + t * 15}%)`; }
        case 'energy': { const t = clamp(c.energy / c.ph.cap, 0, 1); return `hsl(${45},${30 + t * 60}%,${22 + t * 50}%)`; }
        case 'age': { const t = clamp(c.age / c.ph.maxAge, 0, 1.2); return `hsl(${190 - t * 150},55%,${65 - t * 25}%)`; }
        default: return world.phylo.get(c.species).color();
      }
    }

    draw(world, ui) {
      const ctx = this.ctx, cam = this.cam, z = cam.z, dpr = this.dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#050d14';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (this.w / 2 - cam.x * z), dpr * (this.h / 2 - cam.y * z));

      // Ground
      if (this.opts.fertility) {
        this.updateFertility(world);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this.fertCv, 0, 0, world.fw * PR.FS, world.fh * PR.FS);
      } else { ctx.fillStyle = '#0b1e2a'; ctx.fillRect(0, 0, world.W, world.H); }
      ctx.strokeStyle = 'rgba(160,220,255,0.25)'; ctx.lineWidth = 2 / z;
      ctx.strokeRect(0, 0, world.W, world.H);

      // Visible bounds
      const [vx0, vy0] = this.toWorld(0, 0), [vx1, vy1] = this.toWorld(this.w, this.h);
      const pad = 20;
      const inView = (x, y) => x > vx0 - pad && x < vx1 + pad && y > vy0 - pad && y < vy1 + pad;

      // Food
      const { fx, fy, fe, fk, nf } = world;
      const pm = world.p.plantMax;
      const tiny = z < 0.6;
      for (let pass = 0; pass < 3; pass++) {
        ctx.beginPath();
        for (let i = 0; i < nf; i++) {
          const x = fx[i], y = fy[i];
          if (!inView(x, y)) continue;
          const e = fe[i], meat = fk[i] === 1;
          if (pass === 2 ? !meat : meat) continue;
          if (!meat && (pass === 0) !== (e < pm * 0.6)) continue;
          const r = meat ? 1.5 + Math.sqrt(e) * 0.35 : 1.2 + Math.sqrt(e) * 0.45;
          if (tiny) ctx.rect(x - r, y - r, r * 2, r * 2);
          else { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
        }
        ctx.fillStyle = pass === 0 ? 'rgba(120,200,110,0.75)' : pass === 1 ? '#8fe36a' : '#d0644a';
        ctx.fill();
      }

      // Creatures
      const sel = ui.selected;
      const hl = this.opts.highlight;
      let maxGen = 0;
      if (this.opts.colorBy === 'gen') for (const c of world.creatures) if (c.gen > maxGen) maxGen = c.gen;
      const detail = z > 0.55;

      // Selected: trail and vision underneath
      if (sel && sel.alive) {
        if (this.trailId !== sel.id) { this.trail = []; this.trailId = sel.id; }
        const last = this.trail[this.trail.length - 1];
        if (!last || Math.hypot(last[0] - sel.x, last[1] - sel.y) > 3) { this.trail.push([sel.x, sel.y]); if (this.trail.length > 240) this.trail.shift(); }
        if (this.opts.trails && this.trail.length > 1) {
          ctx.lineWidth = 1.2 / z; ctx.lineCap = 'round';
          for (let i = 1; i < this.trail.length; i++) {
            ctx.strokeStyle = `rgba(255,255,255,${(i / this.trail.length) * 0.35})`;
            ctx.beginPath(); ctx.moveTo(this.trail[i - 1][0], this.trail[i - 1][1]); ctx.lineTo(this.trail[i][0], this.trail[i][1]); ctx.stroke();
          }
        }
        if (this.opts.vision) this.drawVision(ctx, sel, z);
      }

      for (const c of world.creatures) {
        if (!inView(c.x, c.y)) continue;
        const dim = hl && c.species !== hl;
        ctx.globalAlpha = dim ? 0.18 : 1;
        const col = this.colorOf(c, world, this.opts.colorBy, maxGen);
        if (!detail || c.r * z < 2.5) {
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1 / z;
          ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(c.a) * c.r * 1.3, c.y + Math.sin(c.a) * c.r * 1.3); ctx.stroke();
        } else this.drawCreature(ctx, c, col, z);
      }
      ctx.globalAlpha = 1;

      if (sel && sel.alive) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 / z; ctx.setLineDash([4 / z, 3 / z]);
        ctx.beginPath(); ctx.arc(sel.x, sel.y, sel.r + 6 / z + 2, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }

      // Tool brush
      if (ui.brush) {
        ctx.strokeStyle = ui.brush.color; ctx.lineWidth = 1.5 / z;
        ctx.beginPath(); ctx.arc(ui.brush.x, ui.brush.y, ui.brush.r, 0, TAU); ctx.stroke();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    drawCreature(ctx, c, col, z) {
      const ph = c.ph, r = c.r;
      ctx.save();
      ctx.translate(c.x, c.y); ctx.rotate(c.a);
      const youth = Math.min(1, c.age / ph.matureAge);
      // Tail: waves faster with stronger strokes.
      const wig = Math.sin(c.tail) * 0.45;
      ctx.fillStyle = col; ctx.globalAlpha *= 0.8;
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 0.35);
      ctx.quadraticCurveTo(-r * 1.4, wig * r, -r * (1.6 + ph.muscle * 0.6), wig * r * 1.6 - r * 0.45);
      ctx.lineTo(-r * (1.6 + ph.muscle * 0.6), wig * r * 1.6 + r * 0.45);
      ctx.quadraticCurveTo(-r * 1.4, wig * r, -r * 0.7, r * 0.35);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha /= 0.8;
      // Armour spines
      if (ph.armor > 0.15) {
        const n = 5 + Math.round(ph.armor * 9), L = r * (0.15 + ph.armor * 0.45);
        ctx.strokeStyle = 'rgba(230,230,210,0.75)'; ctx.lineWidth = Math.max(0.6, r * 0.09);
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const a = Math.PI * 0.25 + (i / (n - 1)) * Math.PI * 1.5;
          const ca = Math.cos(a), sa = Math.sin(a);
          ctx.moveTo(ca * r * 1.1 * 0.95, sa * r * 0.88 * 0.95); ctx.lineTo(ca * (r * 1.1 + L), sa * (r * 0.88 + L));
        }
        ctx.stroke();
      }
      // Body
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.12, r * 0.88, 0, 0, TAU); ctx.fill();
      ctx.lineWidth = Math.max(0.5, 1.2 / z);
      ctx.strokeStyle = c.biting ? '#ff4a3a' : c.ate ? 'rgba(200,255,170,0.95)' : 'rgba(0,0,0,0.45)';
      ctx.stroke();
      // Belly shading and youth paleness
      ctx.fillStyle = `rgba(255,255,255,${0.12 + (1 - youth) * 0.25})`;
      ctx.beginPath(); ctx.ellipse(r * 0.1, -r * 0.15, r * 0.65, r * 0.4, 0, 0, TAU); ctx.fill();
      // Jaws for meat-eaters
      if (ph.diet > 0.45) {
        const open = c.biting ? 0.55 : 0.22, L = r * (0.35 + ph.diet * 0.45);
        ctx.strokeStyle = 'rgba(250,240,230,0.9)'; ctx.lineWidth = Math.max(0.7, r * 0.13); ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.95, -r * 0.25); ctx.lineTo(r * 0.95 + Math.cos(open) * L, -r * 0.25 + Math.sin(open) * L * 0.4 - L * 0.15);
        ctx.moveTo(r * 0.95, r * 0.25); ctx.lineTo(r * 0.95 + Math.cos(open) * L, r * 0.25 - Math.sin(open) * L * 0.4 + L * 0.15);
        ctx.stroke();
      }
      // Eyes, placed by field of view, sized by sight range.
      const ea = Math.min(1.25, ph.fov / 4), er = Math.max(0.8, r * (0.16 + ph.sightR / 240 * 0.14));
      for (const s of [-1, 1]) {
        const ex = Math.cos(ea) * r * 0.72, ey = Math.sin(ea) * r * 0.62 * s;
        ctx.fillStyle = '#f4f7f2'; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(ex + er * 0.35, ey, er * 0.55, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    drawVision(ctx, c, z) {
      const ph = c.ph, R = ph.sightR, half = ph.fov / 2, sw = ph.fov / NS, inp = c.inp;
      for (let s = 0; s < NS; s++) {
        const a0 = c.a - half + s * sw, a1 = a0 + sw;
        const plant = inp[s * NCH], meat = inp[s * NCH + 1], body = inp[s * NCH + 2];
        const m = Math.max(plant, meat, body);
        const col = body >= m && body > 0 ? '255,255,255' : meat >= m && meat > 0 ? '255,110,80' : '140,255,120';
        ctx.fillStyle = `rgba(${col},${0.04 + m * 0.22})`;
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.arc(c.x, c.y, R, a0, a1); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1 / z;
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.arc(c.x, c.y, R, c.a - half, c.a + half); ctx.closePath(); ctx.stroke();
    }
  }

  PR.Renderer = Renderer;
})(globalThis);
