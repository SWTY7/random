// Cognate: the family tree on a time axis. Ticks on each branch mark its sound laws.
'use strict';
(function (G) {
  const CG = G.CG;

  class TreeView {
    constructor(canvas, app) {
      this.cv = canvas; this.app = app; this.ctx = canvas.getContext('2d');
      this.showDead = true;
      canvas.addEventListener('mousemove', e => this.onMove(e));
      canvas.addEventListener('mouseleave', () => { this.hover = null; this.app.hideTip(); this.draw(); });
      canvas.addEventListener('click', e => { const h = this.hit(e); if (h) this.app.select(h.L.id); });
    }
    setWorld(w) { this.w = w; }

    visible(L) {
      if (this.showDead) return true;
      if (L.died == null) return true;
      return L.children.some(c => this.visible(this.w.langs[c]));
    }

    layout() {
      const w = this.w, dpr = window.devicePixelRatio || 1, r = this.cv.getBoundingClientRect();
      if (this.cv.width !== Math.round(r.width * dpr) || this.cv.height !== Math.round(r.height * dpr)) { this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr); }
      this.dpr = dpr; this.cw = r.width; this.ch = r.height;
      const leaves = [];
      const pos = new Map();
      const walk = L => {
        const kids = L.children.map(c => w.langs[c]).filter(K => this.visible(K));
        if (!kids.length) { leaves.push(L); return; }
        kids.forEach(walk);
      };
      walk(w.langs[0]);
      const top = 58, bottom = 40;
      const rowH = CG.clamp((r.height - top - bottom) / Math.max(1, leaves.length), 10, 34);
      leaves.forEach((L, i) => pos.set(L.id, top + rowH * (i + 0.5)));
      const place = L => {
        if (pos.has(L.id)) return pos.get(L.id);
        const kids = L.children.map(c => w.langs[c]).filter(K => this.visible(K));
        const ys = kids.map(place);
        const y = (Math.min(...ys) + Math.max(...ys)) / 2;
        pos.set(L.id, y);
        return y;
      };
      place(w.langs[0]);
      this.pos = pos; this.rowH = rowH;
      const T = Math.max(w.t, 500);
      this.x0 = 30; this.x1 = r.width - 150;
      this.X = t => this.x0 + (t / T) * (this.x1 - this.x0);
      this.T = T;
    }

    draw() {
      if (!this.w) return;
      this.layout();
      const { ctx, w, dpr, X } = this, app = this.app;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#efe6d2'; ctx.fillRect(0, 0, this.cw, this.ch);
      const serif = getComputedStyle(document.body).getPropertyValue('--serif');
      // time axis
      ctx.strokeStyle = 'rgba(80,60,40,0.12)'; ctx.fillStyle = '#9a8f7b'; ctx.font = `11px ${serif}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const step = this.T > 6000 ? 1000 : 500;
      for (let t = 0; t <= this.T; t += step) {
        const x = X(t);
        ctx.beginPath(); ctx.moveTo(x, 50); ctx.lineTo(x, this.ch - 30); ctx.stroke();
        ctx.fillText(`year ${CG.fmtYear(t)}`, x, this.ch - 14);
      }
      const path = new Set();
      if (app.selected >= 0) for (const A of w.ancestors(w.langs[app.selected])) path.add(A.id);
      const sel = app.selected;
      // branches
      for (const L of w.langs) {
        if (!this.pos.has(L.id) || !this.visible(L)) continue;
        const y = this.pos.get(L.id), xa = X(L.born), xb = X(L.died ?? w.t);
        const live = L.died == null, absorbed = L.fate === 'absorbed';
        const on = path.has(L.id) || (sel >= 0 && this.isDesc(L, sel));
        const col = absorbed ? '#a69c88' : CG.hsl(L.hue, 48, on || sel < 0 ? 38 : 60);
        ctx.strokeStyle = col; ctx.lineWidth = on ? 4 : live ? 2.6 : 2;
        ctx.setLineDash(absorbed ? [4, 3] : []);
        ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke();
        ctx.setLineDash([]);
        if (L.fate === 'split') {
          const ys = L.children.filter(c => this.pos.has(c) && this.visible(w.langs[c])).map(c => this.pos.get(c));
          if (ys.length) { ctx.lineWidth = on ? 2.4 : 1.6; ctx.beginPath(); ctx.moveTo(xb, Math.min(...ys)); ctx.lineTo(xb, Math.max(...ys)); ctx.stroke(); }
        }
        // sound-law ticks
        ctx.strokeStyle = 'rgba(46,42,34,0.55)'; ctx.lineWidth = 1;
        for (const rid of L.rules) { const x = X(w.rules[rid].t); ctx.beginPath(); ctx.moveTo(x, y - 3.5); ctx.lineTo(x, y + 3.5); ctx.stroke(); }
        // inventions
        for (const inv of w.inventions) if (inv.lang === L.id) {
          const x = X(inv.t);
          ctx.fillStyle = '#c0803a'; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 4, y - 2); ctx.lineTo(x, y + 2); ctx.lineTo(x - 4, y - 2); ctx.closePath(); ctx.fill();
        }
        // labels
        ctx.textBaseline = 'middle';
        if (live) {
          ctx.textAlign = 'left'; ctx.fillStyle = L.id === sel ? '#7a3b2a' : '#2e2a22';
          ctx.font = `${L.id === sel ? '600 ' : ''}${CG.clamp(this.rowH * 0.62, 10, 14)}px ${serif}`;
          ctx.fillText(L.name, xb + 6, y);
        } else if (absorbed) {
          ctx.textAlign = 'left'; ctx.fillStyle = '#9a8f7b'; ctx.font = `italic ${CG.clamp(this.rowH * 0.58, 9.5, 13)}px ${serif}`;
          ctx.fillText('✝ ' + L.name, xb + 4, y);
        } else {
          ctx.textAlign = 'left'; ctx.fillStyle = L.id === sel ? '#7a3b2a' : '#6f6656'; ctx.font = `${L.id === sel ? '600 ' : ''}italic 11.5px ${serif}`;
          const tw = ctx.measureText(L.name).width;
          const lx = Math.max(xa + 3, Math.min(xb - tw - 4, (xa + xb) / 2 - tw / 2));
          ctx.fillText(L.name, lx, y - 8);
        }
      }
      if (this.hover && this.hover.rule) {
        const { x, y } = this.hover;
        ctx.strokeStyle = '#7a3b2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6); ctx.stroke();
      }
      document.getElementById('tree-note').textContent = `${w.living().length} living · ${w.langs.filter(L => L.fate === 'absorbed').length} died out · ticks mark sound laws, ◆ inventions`;
    }
    isDesc(L, id) { for (let X = L; X; X = X.parent >= 0 ? this.w.langs[X.parent] : null) if (X.id === id) return true; return false; }

    hit(e) {
      if (!this.pos) return null;
      const r = this.cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      let best = null, bd = 9;
      for (const L of this.w.langs) {
        if (!this.pos.has(L.id) || !this.visible(L)) continue;
        const y = this.pos.get(L.id), xa = this.X(L.born), xb = this.X(L.died ?? this.w.t);
        let d = Math.abs(my - y);
        if (mx < xa - 2) continue;
        if (mx > xb + 2) { if (L.died == null || L.fate === 'absorbed') { if (mx < xb + 150) d += 0; else continue; } else continue; }
        if (d < bd) { bd = d; best = { L, y }; }
      }
      if (!best) return null;
      let rb = 5;
      for (const rid of best.L.rules) { const x = this.X(this.w.rules[rid].t); const d = Math.abs(mx - x); if (d < rb) { rb = d; best.rule = this.w.rules[rid]; best.x = x; } }
      for (const inv of this.w.inventions) if (inv.lang === best.L.id) { const x = this.X(inv.t); if (Math.abs(mx - x) < 5) { best.inv = inv; best.x = x; best.rule = null; } }
      return best;
    }
    onMove(e) {
      const h = this.hit(e), app = this.app, w = this.w;
      this.hover = h;
      if (!h) { app.hideTip(); this.draw(); return; }
      const L = h.L;
      let html;
      if (h.inv) html = `<b>${CG.esc(L.name)}</b>, year ${CG.fmtYear(h.inv.t)}<br>New word for ‘${CG.esc(CG.MEANINGS[h.inv.mi].g)}’: <span class="ipa">${CG.esc(CG.str(w.etyma[h.inv.e].f))}</span>`;
      else if (h.rule) {
        const R = h.rule;
        html = `<b>${CG.esc(R.name)}</b> <span class="dim">in ${CG.esc(L.name)}, year ${CG.fmtYear(R.t)}</span><br><span class="ipa" style="font-size:14px">${CG.esc(R.note)}</span>` +
          (R.ex && R.ex.length ? `<br><span class="dim">${R.ex.slice(0, 2).map(([mi, a, b]) => `<span class="ipa">${CG.esc(CG.str(a))} → ${CG.esc(CG.str(b))}</span> ‘${CG.esc(CG.MEANINGS[mi].g)}’`).join(', ')}</span>` : '');
      } else {
        const st = L.died == null ? `living, ${L.cells} lands` : L.fate === 'split' ? `split in year ${CG.fmtYear(L.died)}` : `died out in year ${CG.fmtYear(L.died)}`;
        html = `<b>${CG.esc(L.name)}</b><br><span class="dim">from year ${CG.fmtYear(L.born)} · ${st} · ${L.rules.length} sound laws of its own</span>`;
      }
      app.showTip(e, html);
      this.draw();
    }
  }
  CG.TreeView = TreeView;
})(globalThis);
