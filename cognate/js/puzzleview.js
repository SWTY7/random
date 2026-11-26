// Cognate: the puzzle room.
'use strict';
(function (G) {
  const CG = G.CG, esc = CG.esc;
  const ipa = f => `<span class="ipa">${esc(typeof f === 'string' ? f : CG.str(f))}</span>`;
  const KEY = 'cognate.puzzles.v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ } };

  const KINDS = {
    reconstruct: { title: 'Reconstruct', make: CG.makeReconstruct, intro: `Three related languages descend from one lost ancestor. Each went through a few sound laws of its own, and sound laws are <i>regular</i>: they hit every word that fits. Compare the words row by row and write the ancestral form of each. Where the daughters disagree, ask which change is more natural (k → tʃ before i is common; the reverse is not) and which sound explains all three.` },
    law: { title: 'Spot the law', make: CG.makeLaw, intro: `These words went through a single sound change. Some changed and some did not, and the ones that stayed the same tell you as much as the ones that changed. Which law was it?` },
    order: { title: 'Chronology', make: CG.makeOrder, intro: `Three sound laws turned the words on the left into the words on the right, one after the other. The order matters: one law can create new inputs for another (feeding) or remove them first (bleeding). Put the laws in the order they happened.` },
  };
  const LEVELS = ['Easy', 'Medium', 'Hard'];

  class PuzzleView {
    constructor(el, app) {
      this.el = el; this.app = app;
      this.kind = 'reconstruct'; this.level = 0; this.n = 1;
      this.stats = load();
      const s = this.stats.last;
      if (s) { this.kind = s.kind in KINDS ? s.kind : 'reconstruct'; this.level = s.level | 0; this.n = s.n || 1; }
      this.focus = null;
      el.addEventListener('click', e => this.onClick(e));
      el.addEventListener('focusin', e => { if (e.target.matches('input.guess')) this.focus = e.target; });
      el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input.guess')) { const ins = [...this.el.querySelectorAll('input.guess')]; const i = ins.indexOf(e.target); if (i + 1 < ins.length) ins[i + 1].focus(); else this.check(); } });
    }
    open() { if (!this.p) this.make(); }
    make() {
      this.p = KINDS[this.kind].make(this.n, this.level);
      this.state = { checked: false, hints: 0, order: this.p && this.p.kind === 'order' ? [0, 1, 2] : null, picked: -1, revealed: false };
      this.stats.last = { kind: this.kind, level: this.level, n: this.n };
      save(this.stats);
      this.render();
    }
    rec(kind, field, v) { const s = this.stats[kind] = this.stats[kind] || {}; s[field] = (s[field] || 0) + v; save(this.stats); }

    head() {
      const st = this.stats;
      const r = st.reconstruct || {}, l = st.law || {}, o = st.order || {};
      const tally = this.kind === 'reconstruct' ? (r.played ? `${r.played} solved · average ${Math.round(100 * r.score / r.played)}%` : '') :
        this.kind === 'law' ? (l.tries ? `${l.right || 0} of ${l.tries} right first time` : '') : (o.tries ? `${o.right || 0} of ${o.tries} right first time` : '');
      return `<div class="pzhead"><h1>${KINDS[this.kind].title}</h1>
        <div class="seg" data-g="kind">${Object.entries(KINDS).map(([k, v]) => `<button data-kind="${k}" class="${k === this.kind ? 'on' : ''}">${v.title}</button>`).join('')}</div>
        <div class="seg" data-g="level">${LEVELS.map((v, i) => `<button data-level="${i}" class="${i === this.level ? 'on' : ''}">${v}</button>`).join('')}</div>
        <span><button class="small" data-act="prev" title="Previous puzzle">◀</button> <b>#${this.n}</b> <button class="small" data-act="next" title="Next puzzle">▶</button> <button class="small" data-act="rand" title="Random puzzle">🎲</button></span>
        <span class="dim">${tally}</span></div><p class="pzintro">${KINDS[this.kind].intro}</p>`;
    }

    render() {
      const p = this.p;
      if (!p) { this.el.innerHTML = `<div class="pz">${this.head()}<p>No puzzle could be made from this number. Try the next one.</p></div>`; return; }
      let body = '';
      if (p.kind === 'reconstruct') body = this.renderRec();
      else if (p.kind === 'law') body = this.renderLaw();
      else body = this.renderOrder();
      this.el.innerHTML = `<div class="pz">${this.head()}${body}</div>`;
    }
    sayBtn(f) { return `<button class="say" data-say="${esc(CG.str(f))}" data-stress="${this.p.stress}" title="Listen">🔊</button>`; }

    // ------------------------------------------------------------ reconstruct
    renderRec() {
      const p = this.p, s = this.state;
      const prev = this.el.querySelectorAll('input.guess');
      const vals = s.vals || [...prev].map(i => i.value);
      let h = `<table class="pzt"><tr><th>meaning</th>${p.daughters.map(d => `<th>${d.name}</th>`).join('')}<th>Ancestor</th>${s.checked ? '<th></th>' : ''}</tr>`;
      let tot = 0;
      p.meanings.forEach((mi, r) => {
        h += `<tr><td class="g">${esc(CG.MEANINGS[mi].g)}</td>`;
        for (const d of p.daughters) h += `<td class="f" data-say="${esc(CG.str(d.forms[r]))}" data-stress="${p.stress}">${esc(CG.str(d.forms[r]))}</td>`;
        const v = vals[r] || '';
        h += `<td>*<input class="guess" type="text" spellcheck="false" autocomplete="off" value="${esc(v)}" ${s.checked ? 'readonly' : ''}></td>`;
        if (s.checked) {
          const sc = CG.scoreGuess(v, p.proto[r]); tot += sc;
          h += `<td class="res">${sc === 1 ? '<span class="ok">✓</span>' : `<span class="${sc > 0.6 ? '' : 'no'}">${Math.round(sc * 100)}%</span>`} ${sc < 1 ? `answer *${ipa(p.proto[r])}` : ''} ${this.sayBtn(p.proto[r])}</td>`;
        }
        h += '</tr>';
      });
      h += '</table>';
      if (!s.checked) h += `<div class="palette">${p.palette.map(c => `<button data-ins="${esc(c)}" title="${esc(CG.describe(c))}">${esc(c)}</button>`).join('')}<button data-ins="ː" title="long vowel">ː</button></div>`;
      h += `<div class="pzactions">${s.checked ? `<button class="primary" data-act="next">Next puzzle ▶</button>` : `<button class="primary" data-act="check">Check</button><button data-act="hint">Hint (show a law)</button><button data-act="reveal">Give up</button>`}</div>`;
      if (s.checked) {
        const pct = Math.round(100 * tot / p.meanings.length);
        h += `<p class="score">Score: <b>${pct}%</b>${pct === 100 ? ' · a perfect reconstruction.' : pct >= 75 ? ' · a good reconstruction.' : ''}</p>`;
      }
      // laws: revealed after checking, or one at a time as hints
      const laws = [];
      p.daughters.forEach((d, di) => d.rules.forEach((r, ri) => laws.push({ di, ri, d, r })));
      const order = [];
      for (let ri = 0; ri < 6; ri++) for (const l of laws) if (l.ri === ri) order.push(l);
      const shown = s.checked ? order : order.slice(0, s.hints);
      if (shown.length) {
        h += `<div class="explain"><b>${s.checked ? 'What happened' : 'Hints'}</b>`;
        p.daughters.forEach((d, di) => {
          const ls = shown.filter(l => l.di === di).sort((a, b) => a.ri - b.ri);
          if (!ls.length) return;
          h += `<div style="margin-top:8px"><b>${d.name}</b>${s.checked ? '' : ' (not necessarily in order)'}: ` + ls.map(l => `<br>${s.checked ? (l.ri + 1) + '. ' : ''}${esc(l.r.rule.name)}: ${ipa(l.r.rule.note)} <span class="dim">${l.r.ex.map(([a, b]) => `${esc(CG.str(a))} → ${esc(CG.str(b))}`).join(', ')}</span>`).join('') + '</div>';
        });
        h += '</div>';
      }
      s.vals = null;
      return h;
    }
    // ------------------------------------------------------------ law
    renderLaw() {
      const p = this.p, s = this.state;
      let h = `<table class="pzt"><tr><th>meaning</th><th>before</th><th></th><th>after</th></tr>`;
      p.meanings.forEach((mi, r) => {
        const same = CG.str(p.before[r]) === CG.str(p.after[r]);
        h += `<tr><td class="g">${esc(CG.MEANINGS[mi].g)}</td><td class="f" data-say="${esc(CG.str(p.before[r]))}" data-stress="${p.stress}">${esc(CG.str(p.before[r]))}</td><td class="arrow">→</td><td class="f" data-say="${esc(CG.str(p.after[r]))}" data-stress="${p.stress}">${esc(CG.str(p.after[r]))}${same ? ' <span class="dim" style="font-family:var(--sans);font-size:12px">(unchanged)</span>' : ''}</td></tr>`;
      });
      h += `</table><p class="note">Stress falls on the ${CG.STRESS_NAME[p.stress]}. V = any vowel, C = any consonant, # = word edge, _ = where the sound is, ∅ = nothing, V̆ = unstressed vowel, C₀ = any number of consonants.</p><div class="opts">`;
      p.options.forEach((o, i) => {
        const cls = s.picked < 0 ? '' : i === p.answer ? 'right' : i === s.picked ? 'wrong' : '';
        h += `<button data-pick="${i}" class="${cls}" ${s.picked >= 0 ? 'disabled' : ''}>${esc(o.note)}</button>`;
      });
      h += '</div>';
      if (s.picked >= 0) {
        const R = p.options[p.answer];
        h += `<div class="explain">${s.picked === p.answer ? '<span class="ok">Right.</span>' : '<span class="no">Not quite.</span>'} <b>${esc(R.name)}</b>: ${ipa(R.note)}. ${esc(R.why)}`;
        if (s.picked !== p.answer) {
          const W = p.options[s.picked];
          const would = p.before.map(f => CG.str(CG.applyRule(W, f, p.stress)));
          const diff = p.before.map((f, i) => [f, would[i], CG.str(p.after[i])]).filter(x => x[1] !== x[2]).slice(0, 3);
          if (diff.length) h += `<br><span class="dim">Your choice would have given ${diff.map(([a, b, c]) => `${esc(CG.str(a))} → <b>${esc(b)}</b> (not ${esc(c)})`).join(', ')}.</span>`;
        }
        h += `</div><div class="pzactions"><button class="primary" data-act="next">Next puzzle ▶</button></div>`;
      }
      return h;
    }
    // ------------------------------------------------------------ order
    renderOrder() {
      const p = this.p, s = this.state;
      let h = `<table class="pzt"><tr><th>meaning</th><th>before</th><th></th><th>after</th>${s.checked ? '<th>your order gives</th>' : ''}</tr>`;
      const mine = s.checked ? CG.runOrder(p.rules, s.order, p.before, p.stress) : null;
      p.meanings.forEach((mi, r) => {
        h += `<tr><td class="g">${esc(CG.MEANINGS[mi].g)}</td><td class="f" data-say="${esc(CG.str(p.before[r]))}" data-stress="${p.stress}">${esc(CG.str(p.before[r]))}</td><td class="arrow">→</td><td class="f" data-say="${esc(CG.str(p.after[r]))}" data-stress="${p.stress}">${esc(CG.str(p.after[r]))}</td>`;
        if (mine) { const ok = CG.str(mine[r]) === CG.str(p.after[r]); h += `<td class="${ok ? 'ok' : 'no'}">${ipa(mine[r])} ${ok ? '✓' : '✗'}</td>`; }
        h += '</tr>';
      });
      h += `</table><p class="note">Stress falls on the ${CG.STRESS_NAME[p.stress]}. V = vowel, C = consonant, # = word edge, ∅ = nothing, V̆ = unstressed vowel.</p><div class="rcards">`;
      s.order.forEach((k, pos) => {
        const R = p.rules[k];
        h += `<div class="rcard"><span class="n">${pos + 1}</span><span class="r">${esc(R.note)}<br><span class="dim" style="font-family:var(--sans);font-size:12px">${esc(R.name)}</span></span><span class="btns"><button data-up="${pos}" ${pos === 0 ? 'disabled' : ''}>▲</button><button data-down="${pos}" ${pos === 2 ? 'disabled' : ''}>▼</button></span></div>`;
      });
      h += '</div>';
      const right = s.checked && s.order.every((k, i) => k === p.answer[i]);
      h += `<div class="pzactions">${right || s.revealed ? `<button class="primary" data-act="next">Next puzzle ▶</button>` : `<button class="primary" data-act="check">Check order</button><button data-act="reveal">Show me</button>`}</div>`;
      if (s.checked || s.revealed) {
        if (right) h += `<div class="explain"><span class="ok">Right!</span> ${s.tries > 1 ? `(after ${s.tries} tries)` : ''}</div>`;
        else if (!s.revealed) h += `<div class="explain"><span class="no">Not this order.</span> Look at the words marked ✗: which law got there first?</div>`;
        if (right || s.revealed) {
          // stages
          let forms = p.before;
          const stages = [forms];
          for (const k of p.answer) { forms = forms.map(f => CG.applyRule(p.rules[k], f, p.stress)); stages.push(forms); }
          h += `<div class="explain"><b>Step by step</b><table class="pzt"><tr><th></th><th>start</th>${p.answer.map((k, i) => `<th>${i + 1}. ${esc(p.rules[k].name)}</th>`).join('')}</tr>`;
          p.meanings.forEach((mi, r) => { h += `<tr><td class="g">${esc(CG.MEANINGS[mi].g)}</td>${stages.map((st, i) => `<td class="ipa" style="${i && CG.str(st[r]) !== CG.str(stages[i - 1][r]) ? 'color:var(--accent)' : 'color:var(--dim)'}">${esc(CG.str(st[r]))}</td>`).join('')}</tr>`; });
          h += '</table></div>';
        }
      }
      return h;
    }

    check() {
      const p = this.p, s = this.state;
      if (!p) return;
      if (p.kind === 'reconstruct') {
        s.vals = [...this.el.querySelectorAll('input.guess')].map(i => i.value);
        if (s.vals.every(v => !v.trim())) { this.app.toast('Write your reconstructions first. Use the buttons for special letters.'); s.vals = null; return; }
        s.checked = true;
        const tot = p.meanings.reduce((a, _, r) => a + CG.scoreGuess(s.vals[r] || '', p.proto[r]), 0) / p.meanings.length;
        this.rec('reconstruct', 'played', 1); this.rec('reconstruct', 'score', tot);
      } else if (p.kind === 'order') {
        s.tries = (s.tries || 0) + 1;
        s.checked = true;
        const right = s.order.every((k, i) => k === p.answer[i]);
        if (s.tries === 1) { this.rec('order', 'tries', 1); if (right) this.rec('order', 'right', 1); }
      }
      this.render();
    }

    onClick(e) {
      const b = e.target.closest('button, td.f');
      if (!b) return;
      const d = b.dataset;
      if (d.say) { CG.say(CG.tokenize(d.say), d.stress); return; }
      if (d.kind) { this.kind = d.kind; this.make(); return; }
      if (d.level) { this.level = +d.level; this.make(); return; }
      if (d.ins) {
        const inp = this.focus || this.el.querySelector('input.guess');
        if (!inp || inp.readOnly) return;
        const a = inp.selectionStart ?? inp.value.length, z = inp.selectionEnd ?? a;
        inp.value = inp.value.slice(0, a) + d.ins + inp.value.slice(z);
        inp.focus(); inp.setSelectionRange(a + d.ins.length, a + d.ins.length);
        return;
      }
      if (d.pick != null) {
        if (this.state.picked >= 0) return;
        this.state.picked = +d.pick;
        this.rec('law', 'tries', 1); if (+d.pick === this.p.answer) this.rec('law', 'right', 1);
        this.render(); return;
      }
      if (d.up != null || d.down != null) {
        const s = this.state, i = +(d.up ?? d.down), j = d.up != null ? i - 1 : i + 1;
        [s.order[i], s.order[j]] = [s.order[j], s.order[i]];
        s.checked = false; this.render(); return;
      }
      const act = d.act;
      if (act === 'check') this.check();
      else if (act === 'hint') { this.state.vals = [...this.el.querySelectorAll('input.guess')].map(i => i.value); this.state.hints++; this.render(); }
      else if (act === 'reveal') {
        if (this.p.kind === 'reconstruct') { this.state.vals = [...this.el.querySelectorAll('input.guess')].map(i => i.value); this.state.checked = true; this.rec('reconstruct', 'played', 1); this.rec('reconstruct', 'score', 0); }
        else { this.state.revealed = true; if (!this.state.tries) this.rec('order', 'tries', 1); }
        this.render();
      }
      else if (act === 'next') { this.n++; this.make(); }
      else if (act === 'prev') { this.n = Math.max(1, this.n - 1); this.make(); }
      else if (act === 'rand') { this.n = 1 + Math.floor(Math.random() * 9999); this.make(); }
    }
  }
  CG.PuzzleView = PuzzleView;
})(globalThis);
