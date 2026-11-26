// Cognate: the atlas. Terrain, language territories, word maps and sound maps.
'use strict';
(function (G) {
  const CG = G.CG;
  const K = 4; // terrain image pixels per cell

  // A palette for cognate sets on the word map: distinct, readable on parchment.
  const ETY_COLORS = ['#c0603a', '#3a7d8c', '#8c9a3a', '#8a4f9e', '#d39a2e', '#3f8f5f', '#b8486e', '#4f68b0', '#7d5a3a', '#4aa3a0', '#a07ad0', '#9a9a9a'];
  CG.ETY_COLORS = ETY_COLORS;

  class Atlas {
    constructor(canvas, app) {
      this.cv = canvas; this.app = app; this.ctx = canvas.getContext('2d');
      this.terrain = null; this.overlay = document.createElement('canvas');
      this.hoverLang = -1;
      canvas.addEventListener('mousemove', e => this.onMove(e));
      canvas.addEventListener('mouseleave', () => { this.hoverLang = -1; this.app.hideTip(); this.draw(); });
      canvas.addEventListener('click', e => { const L = this.langAt(e); if (L >= 0) this.app.select(L); });
    }
    setWorld(w) {
      this.w = w;
      this.terrain = this.makeTerrain(w);
      this.overlay.width = w.W; this.overlay.height = w.H;
      this.ovKey = '';
    }
    makeTerrain(w) {
      const c = document.createElement('canvas');
      const PW = w.W * K, PH = w.H * K;
      c.width = PW; c.height = PH;
      const ctx = c.getContext('2d'), img = ctx.createImageData(PW, PH), d = img.data;
      const samp = (arr, x, y) => {
        x = CG.clamp(x, 0, w.W - 1.001); y = CG.clamp(y, 0, w.H - 1.001);
        const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, i = yi * w.W + xi;
        return arr[i] * (1 - fx) * (1 - fy) + arr[i + 1] * fx * (1 - fy) + arr[i + w.W] * (1 - fx) * fy + arr[i + w.W + 1] * fx * fy;
      };
      const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
        const x = (px + 0.5) / K - 0.5, y = (py + 0.5) / K - 0.5;
        const e = samp(w.elev, x, y), mo = samp(w.moist, x, y);
        let col;
        if (e <= 0) {
          const t = CG.clamp(-e * 2.2, 0, 1);
          col = mix([176, 199, 198], [122, 152, 160], t);
          if (e > -0.035) col = mix(col, [120, 140, 140], 0.35);
        } else {
          const lat = Math.abs(y / w.H - 0.5) * 2;
          let base = [226, 216, 180];
          if (mo > 0.56) base = mix(base, [196, 204, 156], CG.clamp((mo - 0.56) * 6, 0, 1));
          if (mo < 0.36 && lat < 0.6) base = mix(base, [236, 214, 166], CG.clamp((0.36 - mo) * 6, 0, 1));
          if (lat > 0.8) base = mix(base, [236, 234, 226], CG.clamp((lat - 0.8) * 6, 0, 1));
          if (e > 0.42) base = mix(base, [204, 186, 150], CG.clamp((e - 0.42) * 5, 0, 1));
          if (e > 0.62) base = mix(base, [170, 150, 122], CG.clamp((e - 0.62) * 5, 0, 1));
          if (e > 0.85) base = mix(base, [240, 238, 232], CG.clamp((e - 0.85) * 6, 0, 1));
          // hill shading from the north-west
          const gx = samp(w.elev, x + 0.5, y) - samp(w.elev, x - 0.5, y), gy = samp(w.elev, x, y + 0.5) - samp(w.elev, x, y - 0.5);
          const sh = CG.clamp(1 + (-gx - gy) * 3.2, 0.62, 1.25);
          col = base.map(v => v * sh);
          if (e < 0.02) col = mix(col, [110, 100, 80], 0.45); // coastline ink
        }
        const k = (py * PW + px) * 4;
        d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return c;
    }

    layout() {
      const dpr = window.devicePixelRatio || 1;
      const r = this.cv.getBoundingClientRect();
      if (this.cv.width !== Math.round(r.width * dpr) || this.cv.height !== Math.round(r.height * dpr)) {
        this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
      }
      const w = this.w, pad = 14;
      const s = Math.min((r.width - pad * 2) / w.W, (r.height - pad * 2) / w.H);
      this.s = s; this.ox = (r.width - s * w.W) / 2; this.oy = (r.height - s * w.H) / 2 + 10;
      this.dpr = dpr; this.cw = r.width; this.ch = r.height;
    }

    // colour for each language id in the current mode; returns [r,g,b,alpha] or null
    colorFn() {
      const app = this.app, w = this.w, mode = app.mapMode;
      const focus = mode === 'lang' ? app.focusSet() : null;
      const dimF = id => focus && !focus.has(id) ? 0.35 : 1;
      if (mode === 'word') {
        const mi = app.mapWord, rank = this.etyRank();
        return id => {
          const L = w.langs[id], wd = L.lex[mi];
          if (!wd) return [150, 140, 120, 0.25 * dimF(id)];
          const k = rank.get(wd.e);
          const hex = ETY_COLORS[Math.min(k, ETY_COLORS.length - 1)];
          return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 0.62 * dimF(id)];
        };
      }
      if (mode === 'sound') {
        const sym = app.mapSound;
        return id => {
          const L = w.langs[id];
          const has = L.lex.some(wd => wd && wd.f.includes(sym));
          return has ? [168, 70, 46, 0.62 * dimF(id)] : [120, 120, 110, 0.12 * dimF(id)];
        };
      }
      return id => { const L = w.langs[id]; const [r, g, b] = CG.hslRGB(L.hue, 52, 50); return [r, g, b, 0.5 * dimF(id)]; };
    }
    // etyma for the word map, ordered by how many living languages use them
    etyRank() {
      const w = this.w, mi = this.app.mapWord, cnt = new Map();
      for (const L of w.living()) { const wd = L.lex[mi]; if (wd) cnt.set(wd.e, (cnt.get(wd.e) || 0) + L.cells); }
      const order = [...cnt.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]);
      this._etyOrder = order;
      return new Map(order.map((e, i) => [e, i]));
    }

    drawOverlay() {
      const w = this.w, W = w.W, H = w.H, own = w.owner;
      const ctx = this.overlay.getContext('2d');
      const img = ctx.createImageData(W, H), d = img.data;
      const col = this.colorFn(), cache = new Map();
      for (let i = 0; i < W * H; i++) {
        const o = own[i];
        if (o < 0) continue;
        let c = cache.get(o);
        if (!c) { c = col(o); cache.set(o, c); }
        const x = i % W, y = (i / W) | 0;
        const edge = (x > 0 && own[i - 1] !== o) || (x < W - 1 && own[i + 1] !== o) || (y > 0 && own[i - W] !== o) || (y < H - 1 && own[i + W] !== o);
        const k = i * 4;
        const dark = edge ? 0.62 : 1;
        d[k] = c[0] * dark; d[k + 1] = c[1] * dark; d[k + 2] = c[2] * dark;
        d[k + 3] = 255 * Math.min(1, c[3] * (edge ? 1.5 : 1));
      }
      ctx.putImageData(img, 0, 0);
    }

    draw() {
      if (!this.w) return;
      this.layout();
      const { ctx, s, ox, oy, w, dpr } = this;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#e8dec7'; ctx.fillRect(0, 0, this.cw, this.ch);
      ctx.imageSmoothingEnabled = true;
      // frame
      ctx.fillStyle = 'rgba(60,40,20,0.12)'; ctx.fillRect(ox + 3, oy + 4, w.W * s, w.H * s);
      ctx.drawImage(this.terrain, ox, oy, w.W * s, w.H * s);
      // graticule
      ctx.strokeStyle = 'rgba(80,60,40,0.10)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = 0; gx <= w.W; gx += 24) { ctx.moveTo(ox + gx * s, oy); ctx.lineTo(ox + gx * s, oy + w.H * s); }
      for (let gy = 0; gy <= w.H; gy += 24) { ctx.moveTo(ox, oy + gy * s); ctx.lineTo(ox + w.W * s, oy + gy * s); }
      ctx.stroke();
      const key = w.version + '|' + this.app.mapMode + '|' + this.app.mapWord + '|' + this.app.mapSound + '|' + this.app.selected;
      if (key !== this.ovKey) { this.drawOverlay(); this.ovKey = key; }
      ctx.drawImage(this.overlay, ox, oy, w.W * s, w.H * s);
      ctx.strokeStyle = 'rgba(70,50,30,0.55)'; ctx.lineWidth = 1.2; ctx.strokeRect(ox + 0.5, oy + 0.5, w.W * s - 1, w.H * s - 1);
      // homeland
      const hx = ox + (w.homeland % w.W + 0.5) * s, hy = oy + (((w.homeland / w.W) | 0) + 0.5) * s;
      ctx.fillStyle = '#7a3b2a'; ctx.font = `${Math.max(10, s * 2.4)}px ${getComputedStyle(document.body).getPropertyValue('--serif')}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✶', hx, hy);
      this.drawLabels();
      this.updateLegend();
    }

    drawLabels() {
      const { ctx, s, ox, oy, w } = this, app = this.app;
      const serif = getComputedStyle(document.body).getPropertyValue('--serif'), ipa = getComputedStyle(document.body).getPropertyValue('--ipa');
      const live = w.living().filter(L => L.label).sort((a, b) => b.cells - a.cells);
      const boxes = [];
      const focus = app.mapMode === 'lang' ? app.focusSet() : null;
      const overlaps = b => boxes.some(o => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const L of live) {
        const x = ox + L.label.x * s, y = oy + L.label.y * s;
        const fs = CG.clamp(9 + Math.sqrt(L.cells) * 0.45, 10, 17) * Math.min(1.2, Math.max(0.8, s / 5));
        const faded = focus && !focus.has(L.id);
        let lines;
        if (app.mapMode === 'word') {
          const wd = L.lex[app.mapWord];
          lines = [[wd ? CG.str(wd.f) : '—', `italic ${fs + 1}px ${ipa}`], [L.name, `${Math.max(9, fs - 4)}px ${serif}`]];
        } else lines = [[L.name, `${L.id === app.selected ? '600 ' : ''}italic ${fs}px ${serif}`]];
        let wmax = 0;
        for (const [t, f] of lines) { ctx.font = f; wmax = Math.max(wmax, ctx.measureText(t).width); }
        const h = lines.length === 2 ? fs * 2.1 : fs * 1.1;
        const b = { x0: x - wmax / 2 - 2, x1: x + wmax / 2 + 2, y0: y - h / 2, y1: y + h / 2 };
        if (overlaps(b) && L.id !== app.selected) { if (L.cells < 30 || app.mapMode !== 'word') continue; }
        boxes.push(b);
        let yy = lines.length === 2 ? y - fs * 0.5 : y;
        for (const [t, f] of lines) {
          ctx.font = f;
          ctx.lineWidth = 3.5; ctx.strokeStyle = faded ? 'rgba(240,232,214,0.5)' : 'rgba(248,242,228,0.92)'; ctx.lineJoin = 'round';
          ctx.strokeText(t, x, yy);
          ctx.fillStyle = faded ? 'rgba(46,42,34,0.35)' : (L.id === app.selected ? '#7a3b2a' : '#2e2a22');
          ctx.fillText(t, x, yy);
          yy += fs * 1.1;
        }
      }
    }

    updateLegend() {
      const el = document.getElementById('maplegend'), app = this.app, w = this.w;
      if (app.mapMode === 'lang') { el.hidden = true; return; }
      el.hidden = false;
      if (app.mapMode === 'sound') {
        const sym = app.mapSound;
        const has = w.living().filter(L => L.lex.some(wd => wd && wd.f.includes(sym)));
        const inProto = w.langs[0].lex.some(wd => wd && wd.f.includes(sym));
        const ex = has.slice(0, 3).map(L => { const wd = L.lex.find(x => x && x.f.includes(sym)); return `${CG.esc(L.name)} <span class="ipa">${CG.esc(CG.str(wd.f))}</span> ‘${CG.esc(CG.MEANINGS[L.lex.indexOf(wd)].g)}’`; });
        el.innerHTML = `<b class="ipa" style="font-size:18px">${CG.esc(sym)}</b> <span class="dim">${CG.esc(CG.describe(sym))}</span><br>Used by ${has.length} of ${w.living().length} living languages. ${inProto ? 'It was already in the proto-language.' : 'The proto-language did not have it; it arose later through sound change or borrowing.'}${ex.length ? '<br><span class="dim">e.g. ' + ex.join('; ') + '</span>' : ''}`;
        return;
      }
      const mi = app.mapWord;
      this.etyRank();
      const rows = this._etyOrder.slice(0, ETY_COLORS.length).map((e, k) => {
        const E = w.etyma[e];
        const users = w.living().filter(L => L.lex[mi] && L.lex[mi].e === e);
        const where = E.kind === 'proto' ? `${CG.esc(w.langs[0].name)} <span class="ipa">*${CG.esc(CG.str(E.f))}</span>${E.m !== mi ? ` ‘${CG.esc(CG.MEANINGS[E.m].g)}’` : ''}` :
          `${E.kind === 'comp' ? 'compound' : 'new word'} in ${CG.esc(w.langs[E.lang].name)}, year ${CG.fmtYear(E.t)}${E.m !== mi ? `, first meaning ‘${CG.esc(CG.MEANINGS[E.m].g)}’` : ''}`;
        return `<div class="lg"><span class="sw" style="background:${ETY_COLORS[Math.min(k, ETY_COLORS.length - 1)]}"></span><span>${users.length} × from ${where}</span></div>`;
      });
      const none = w.living().filter(L => !L.lex[mi]).length;
      el.innerHTML = `<b>‘${CG.esc(CG.MEANINGS[mi].g)}’</b> <span class="dim">same colour = same origin (cognates or loans)</span>${rows.join('')}${none ? `<div class="lg"><span class="sw" style="background:#ddd5c4"></span><span>${none} × no word yet</span></div>` : ''}`;
    }

    cellAt(e) {
      const r = this.cv.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left - this.ox) / this.s), y = Math.floor((e.clientY - r.top - this.oy) / this.s);
      if (x < 0 || y < 0 || x >= this.w.W || y >= this.w.H) return -1;
      return y * this.w.W + x;
    }
    langAt(e) { const c = this.cellAt(e); return c < 0 ? -1 : this.w.owner[c]; }
    onMove(e) {
      const id = this.langAt(e), app = this.app, w = this.w;
      if (id < 0) {
        const c = this.cellAt(e);
        if (c === w.homeland || (c >= 0 && Math.abs(c % w.W - w.homeland % w.W) <= 1 && Math.abs(((c / w.W) | 0) - ((w.homeland / w.W) | 0)) <= 1)) app.showTip(e, `✶ Homeland of ${CG.esc(w.langs[0].name)}`);
        else app.hideTip();
        return;
      }
      const L = w.langs[id];
      let html = `<b>${CG.esc(L.name)}</b>`;
      const anc = w.ancestors(L).slice(0, -1).reverse().slice(0, 3).map(A => CG.esc(A.name));
      if (anc.length) html += `<br><span class="dim">‹ ${anc.join(' ‹ ')}</span>`;
      if (app.mapMode === 'word') {
        const wd = L.lex[app.mapWord];
        html += `<br>‘${CG.esc(CG.MEANINGS[app.mapWord].g)}’: ` + (wd ? `<span class="ipa">${CG.esc(CG.str(wd.f))}</span> ${wd.o.k === 'loan' ? `<span class="dim">(borrowed from ${CG.esc(w.langs[wd.o.from].name)})</span>` : ''}` : '<span class="dim">no word</span>');
      } else if (app.mapMode === 'sound') {
        const wd = L.lex.find(x => x && x.f.includes(app.mapSound));
        html += '<br>' + (wd ? `has <span class="ipa">${CG.esc(app.mapSound)}</span>, e.g. <span class="ipa">${CG.esc(CG.str(wd.f))}</span> ‘${CG.esc(CG.MEANINGS[L.lex.indexOf(wd)].g)}’` : `<span class="dim">no ${CG.esc(app.mapSound)}</span>`);
      } else html += `<br><span class="dim">${L.cells} lands · since year ${CG.fmtYear(L.born)}</span>`;
      app.showTip(e, html);
    }
  }
  CG.Atlas = Atlas;
})(globalThis);
