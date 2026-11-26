// Cognate: the comparative word table.
'use strict';
(function (G) {
  const CG = G.CG;
  const CATS = [['pron', 'Pronouns and particles'], ['num', 'Numbers'], ['body', 'People and the body'], ['nature', 'The world'], ['verb', 'Doing'], ['qual', 'Qualities'], ['culture', 'Culture words']];

  class LexView {
    constructor(el, app) {
      this.el = el; this.app = app;
      this.set = 'living'; this.q = ''; this.rom = false;
      el.innerHTML = `<div class="lexbar">
        <div class="seg" id="lex-set"><button data-s="living" class="on">Living languages</button><button data-s="branch">Selected branch</button><button data-s="lineage">Selected lineage</button></div>
        <input type="text" id="lex-q" placeholder="Filter meanings…" spellcheck="false">
        <div class="seg" id="lex-rom"><button data-r="0" class="on" title="Phonetic transcription">IPA</button><button data-r="1" title="A rough Latin spelling">Spelling</button></div>
        <span class="dim" id="lex-note"></span>
      </div><div id="lex-table"></div>`;
      el.querySelector('#lex-set').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; this.set = b.dataset.s; this.segOn('#lex-set', b); this.render(); });
      el.querySelector('#lex-rom').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; this.rom = b.dataset.r === '1'; this.segOn('#lex-rom', b); this.render(); });
      el.querySelector('#lex-q').addEventListener('input', e => { this.q = e.target.value.trim().toLowerCase(); this.render(); });
      el.querySelector('#lex-table').addEventListener('click', e => {
        const td = e.target.closest('td.w'); if (td && td.dataset.l) { this.app.etymology(+td.dataset.l, +td.dataset.m); return; }
        const th = e.target.closest('th[data-l]'); if (th) this.app.select(+th.dataset.l);
      });
    }
    segOn(sel, b) { this.el.querySelectorAll(sel + ' button').forEach(x => x.classList.toggle('on', x === b)); }
    setWorld(w) { this.w = w; }

    langs() {
      const w = this.w, app = this.app, sel = app.selected >= 0 ? w.langs[app.selected] : null;
      const order = [];
      const walk = L => { if (L.died == null) order.push(L); L.children.forEach(c => walk(w.langs[c])); };
      walk(w.langs[0]);
      if (this.set === 'lineage' && sel) {
        const anc = w.ancestors(sel);
        return { list: anc, note: `${CG.esc(sel.name)} and its ancestors. Each stage shows its words as they were when it split up.` };
      }
      if (this.set === 'branch' && sel) {
        const out = [];
        const walk2 = L => { if (L.died == null || L.id === sel.id) out.push(L); L.children.forEach(c => walk2(w.langs[c])); };
        walk2(sel);
        if (sel.died != null && sel.fate === 'split') return { list: out, note: `${CG.esc(sel.name)} (as it was when it split) and the living languages descended from it.` };
        return { list: out, note: sel.died == null ? `${CG.esc(sel.name)} is a living language. Pick an older branch in the tree to compare a whole subfamily.` : '' };
      }
      return { list: [w.langs[0], ...order], note: this.set !== 'living' ? 'Select a language first (on the map or the tree).' : `The proto-language and every living language, in family-tree order. Words of the commonest origin in each row are plain; other shared origins get a colour.` };
    }
    form(f) { return this.rom ? CG.romanize(f) : CG.str(f); }

    render() {
      if (!this.w) return;
      const w = this.w, { list, note } = this.langs();
      this.el.querySelector('#lex-note').innerHTML = note;
      const P = w.langs[0];
      const keep = L => {
        let n = 0, k = 0;
        for (const m of CG.MEANINGS) {
          if (m.cat === 'culture') continue;
          const a = L.lex[m.i], p = P.lex[m.i];
          if (!a || !p) continue;
          n++; if (a.e === p.e && a.o.k !== 'loan') k++;
        }
        return n ? Math.round(100 * k / n) : 0;
      };
      let h = '<table class="lex"><thead><tr><th class="gl">meaning</th>';
      for (const L of list) {
        const sub = L.id === 0 ? 'reconstructed' : L.died == null ? `${keep(L)}% of proto words kept` : L.fate === 'split' ? `split ${CG.fmtYear(L.died)}` : `✝ ${CG.fmtYear(L.died)}`;
        h += `<th data-l="${L.id}" title="Show ${CG.esc(L.name)}"><span style="border-bottom:3px solid ${CG.hsl(L.hue, 50, 50)}">${CG.esc(L.name)}</span><span class="sub">${sub}</span></th>`;
      }
      h += '</tr></thead><tbody>';
      const q = this.q;
      for (const [cat, title] of CATS) {
        const ms = CG.MEANINGS.filter(m => m.cat === cat && (!q || m.g.includes(q)));
        if (!ms.length) continue;
        h += `<tr class="cat"><td class="gl">${title}</td><td colspan="${list.length}"></td></tr>`;
        for (const m of ms) {
          // colour rank by frequency of etyma in this row
          const cnt = new Map();
          for (const L of list) { const wd = L.lex[m.i]; if (wd) cnt.set(wd.e, (cnt.get(wd.e) || 0) + 1); }
          const rank = new Map([...cnt.entries()].sort((a, b) => b[1] - a[1]).map((x, i) => [x[0], i]));
          h += `<tr><td class="gl"><b>${CG.esc(m.g)}</b></td>`;
          for (const L of list) {
            const wd = L.lex[m.i];
            if (!wd) { h += '<td class="w none">—</td>'; continue; }
            const k = rank.get(wd.e);
            const alone = cnt.get(wd.e) === 1 && list.length > 2;
            // the majority origin stays plain so replacements stand out; other cognate sets get colours
            const bg = alone || k === 0 ? 'transparent' : CG.ETY_COLORS[Math.min(k - 1, CG.ETY_COLORS.length - 1)] + '40';
            const mark = { loan: '‹', comp: '+', shift: '≈', coin: '∗' }[wd.o.k] || '';
            const k2 = wd.o.k;
            const tt = k2 === 'loan' ? `borrowed from ${w.langs[wd.o.from].name}` : k2 === 'comp' ? 'a compound' : k2 === 'shift' ? `used to mean ‘${CG.MEANINGS[wd.o.from].g}’` : k2 === 'coin' ? 'a new word' : 'inherited';
            h += `<td class="w${wd.o.k === 'loan' ? ' loan' : ''}" style="background:${bg}" data-l="${L.id}" data-m="${m.i}" title="${CG.esc(tt)} · click for its history">${CG.esc(this.form(wd.f))}${mark ? `<sup>${mark}</sup>` : ''}</td>`;
          }
          h += '</tr>';
        }
      }
      h += '</tbody></table><p class="note">‹ borrowed · + compound · ≈ shifted meaning · ∗ new word. Click a word for its full history. Within a row, plain cells hold the commonest origin or a word found in only one language; each colour marks another origin shared by several languages.</p>';
      this.el.querySelector('#lex-table').innerHTML = h;
    }
  }
  CG.LexView = LexView;
})(globalThis);
