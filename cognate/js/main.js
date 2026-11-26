// Cognate: the app. Wires the world to the views and runs the clock.
'use strict';
(function (G) {
  const CG = G.CG, esc = CG.esc;
  const $ = s => document.querySelector(s);
  const PARAMS = ['soundRate', 'lexRate', 'contact', 'splitRate'];
  const STEPS_PER_SEC = { 1: 2, 4: 8, 16: 32 };

  class App {
    constructor() {
      this.selected = -1; this.view = 'atlas'; this.mapMode = 'lang'; this.mapWord = CG.MI.water; this.mapSound = 'ʃ';
      this.running = true; this.speed = 4; this.acc = 0; this.last = performance.now();
      this.chronFilter = 'all'; this.tab = 'lang';
      this.atlas = new CG.Atlas($('#map'), this);
      this.tree = new CG.TreeView($('#treecv'), this);
      this.lex = new CG.LexView($('#view-lex'), this);
      this.puz = new CG.PuzzleView($('#view-puzzle'), this);
      this.readHash();
      this.bind();
      $('#tab-about').innerHTML = ABOUT;
      this.newWorld();
      requestAnimationFrame(t => this.frame(t));
    }

    readHash() {
      const h = new URLSearchParams(location.hash.slice(1));
      this.seed = h.get('seed') || randomSeed();
      this.years = +h.get('years') || 5000;
      this.params = {};
      for (const k of PARAMS) this.params[k] = h.has(k) ? +h.get(k) : CG.WORLD_DEFAULTS[k];
      if (h.get('view')) this.view = h.get('view');
    }
    writeHash() {
      const h = new URLSearchParams({ seed: this.seed, years: this.years });
      for (const k of PARAMS) if (this.params[k] !== CG.WORLD_DEFAULTS[k]) h.set(k, this.params[k]);
      try { history.replaceState(null, '', '#' + h.toString()); } catch (e) { /* file:// in some browsers */ }
    }

    newWorld() {
      this.w = new CG.World({ seed: this.seed, params: Object.assign({ years: this.years }, this.params) });
      this.selected = -1; this.drawnVersion = -1; this.sideVersion = -1;
      this.atlas.setWorld(this.w); this.tree.setWorld(this.w); this.lex.setWorld(this.w);
      $('#seed').value = this.seed; $('#years').value = String(this.years);
      for (const k of PARAMS) { $('#' + k).value = this.params[k]; $('#o-' + k).textContent = this.params[k]; }
      this.fillSoundSelect();
      this.writeHash();
      this.running = true;
      this.setView(this.view);
      this.redraw(true);
    }

    bind() {
      $('#views').addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.setView(b.dataset.view); });
      $('#sidetabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.setTab(b.dataset.tab); });
      $('#btn-play').addEventListener('click', () => this.toggleRun());
      $('#seg-speed').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; this.speed = +b.dataset.speed; segOn('#seg-speed', b); if (!this.running && !this.w.done) this.toggleRun(); });
      $('#btn-end').addEventListener('click', () => this.runToEnd());
      $('#seg-mapmode').addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.setMapMode(b.dataset.mode); });
      const ws = $('#map-word');
      ws.innerHTML = CG.MEANINGS.map(m => `<option value="${m.i}">‘${esc(m.g)}’</option>`).join('');
      ws.value = String(this.mapWord);
      ws.addEventListener('change', () => { this.mapWord = +ws.value; this.redraw(true); });
      $('#map-sound').addEventListener('change', e => { this.mapSound = e.target.value; this.redraw(true); });
      $('#tree-dead').addEventListener('change', e => { this.tree.showDead = e.target.checked; this.tree.draw(); });
      $('#chron-filter').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; this.chronFilter = b.dataset.f; segOn('#chron-filter', b); this.renderChron(); });
      $('#chron').addEventListener('click', e => { const li = e.target.closest('li[data-l]'); if (li && !e.target.closest('button')) this.select(+li.dataset.l); });
      for (const k of PARAMS) $('#' + k).addEventListener('input', e => { this.params[k] = +e.target.value; $('#o-' + k).textContent = e.target.value; this.w.p[k] = +e.target.value; this.writeHash(); });
      $('#btn-dice').addEventListener('click', () => { $('#seed').value = randomSeed(); });
      $('#btn-new').addEventListener('click', () => {
        this.seed = $('#seed').value.trim() || randomSeed(); this.years = +$('#years').value;
        this.newWorld(); this.setTab('lang');
        this.toast(`A new world: ${this.w.langs[0].name} begins in its homeland.`);
      });
      $('#years').addEventListener('change', e => { this.years = +e.target.value; this.w.p.years = Math.max(this.years, this.w.t); this.writeHash(); this.updateClock(); });
      $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.id === 'modal-x') this.closeModal(); });
      document.addEventListener('click', e => this.delegate(e));
      document.addEventListener('keydown', e => {
        if (e.target.matches('input, select, textarea')) return;
        if (e.key === ' ') { e.preventDefault(); this.toggleRun(); }
        else if (e.key === 'Escape') { if (!$('#modal').hidden) this.closeModal(); else this.select(-1); }
        else if (e.key.length === 1 && '1234'.includes(e.key)) this.setView(['atlas', 'tree', 'lex', 'puzzle'][+e.key - 1]);
      });
      window.addEventListener('resize', () => this.redraw(true));
    }

    setMapMode(m) {
      this.mapMode = m;
      segOn('#seg-mapmode', $(`#seg-mapmode [data-mode=${m}]`));
      $('#map-word').hidden = m !== 'word';
      $('#map-sound').hidden = m !== 'sound';
      if (m === 'sound') this.fillSoundSelect();
      this.redraw(true);
    }

    // clicks on things rendered as HTML anywhere outside the puzzle room
    delegate(e) {
      const t = e.target.closest('[data-say],[data-lang],[data-ety],[data-snd],[data-act],.cogs span[data-l]');
      if (!t || t.closest('#view-puzzle')) return;
      const d = t.dataset;
      if (d.say) { CG.say(CG.tokenize(d.say), d.stress); return; }
      if (d.lang) { this.closeModal(); this.select(+d.lang); return; }
      if (d.ety) { const [l, m] = d.ety.split(':').map(Number); this.etymology(l, m); return; }
      if (d.snd) { this.mapSound = d.snd; this.setView('atlas'); this.setMapMode('sound'); return; }
      if (d.l && d.m) { this.etymology(+d.l, +d.m); return; }
      if (d.act === 'lexbranch') {
        const L = this.selected >= 0 ? this.w.langs[this.selected] : null;
        this.lex.set = L && L.died == null ? 'living' : L ? 'branch' : 'living';
        this.lex.segOn('#lex-set', this.lex.el.querySelector(`[data-s=${this.lex.set}]`));
        this.setView('lex');
      }
    }

    fillSoundSelect() {
      const inv = new Set();
      for (const L of this.w.langs) for (const wd of L.lex) if (wd) for (const s of wd.f) inv.add(s);
      inv.add(this.mapSound);
      const keys = Object.keys(CG.FEAT);
      const syms = [...inv].sort((a, b) => (CG.isV(a) - CG.isV(b)) || keys.indexOf(a) - keys.indexOf(b));
      const sel = $('#map-sound');
      sel.innerHTML = syms.map(s => `<option value="${esc(s)}">${esc(s)}  (${esc(CG.describe(s))})</option>`).join('');
      sel.value = this.mapSound;
    }

    setView(v) {
      if (!['atlas', 'tree', 'lex', 'puzzle'].includes(v)) v = 'atlas';
      this.view = v;
      document.querySelectorAll('.view').forEach(el => el.classList.toggle('on', el.id === 'view-' + v));
      segOn('#views', $(`#views [data-view=${v}]`));
      if (v === 'puzzle') this.puz.open();
      this.redraw(true);
    }
    setTab(t) {
      document.querySelectorAll('#sidetabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
      document.querySelectorAll('.tab').forEach(el => el.classList.toggle('on', el.id === 'tab-' + t));
      this.tab = t;
      this.renderSide(true);
    }
    select(id) {
      this.selected = id;
      if (id >= 0 && this.tab !== 'lang') this.setTab('lang');
      this.redraw(true);
      $('#tab-lang').scrollTop = 0;
    }
    focusSet() {
      if (this.selected < 0) return null;
      const s = new Set(), w = this.w;
      const walk = L => { s.add(L.id); L.children.forEach(c => walk(w.langs[c])); };
      walk(w.langs[this.selected]);
      return s;
    }

    toggleRun() {
      if (this.w.done && !this.running) { this.w.p.years += 1000; this.years = this.w.p.years; this.writeHash(); this.toast('Another thousand years.'); }
      this.running = !this.running;
      this.updateClock();
    }
    runToEnd() {
      const t0 = performance.now();
      while (!this.w.done && performance.now() - t0 < 4000) this.w.step();
      this.running = false;
      this.redraw(true);
      this.toast(`Year ${CG.fmtYear(this.w.t)}. ${this.w.living().length} languages are spoken now.`);
    }

    frame(now) {
      const dt = Math.min(0.25, (now - this.last) / 1000);
      this.last = now;
      if (this.running && !this.w.done) {
        this.acc += dt * STEPS_PER_SEC[this.speed];
        let n = 0;
        while (this.acc >= 1 && n < 8) { this.w.step(); this.acc -= 1; n++; }
        if (this.acc > 8) this.acc = 0;
        if (this.w.done) {
          this.running = false;
          this.toast(`${CG.fmtYear(this.w.t)} years have passed. ${this.w.living().length} languages descend from ${this.w.langs[0].name}. Press ▶ for another thousand years.`, 6000);
        }
      }
      if (this.w.version !== this.drawnVersion) this.redraw(false);
      requestAnimationFrame(t => this.frame(t));
    }

    redraw(force) {
      const w = this.w;
      this.drawnVersion = w.version;
      if (this.view === 'atlas') this.atlas.draw();
      else if (this.view === 'tree') this.tree.draw();
      else if (this.view === 'lex' && (force || !this._lexT || performance.now() - this._lexT > 1500)) { this._lexT = performance.now(); this.lex.render(); }
      this.updateClock();
      this.renderSide(force);
    }
    updateClock() {
      const w = this.w;
      $('#year').textContent = `Year ${CG.fmtYear(w.t)}`;
      $('#progress i').style.width = `${Math.min(100, 100 * w.t / w.p.years)}%`;
      $('#btn-play').textContent = this.running ? '❚❚' : '▶';
      $('#btn-play').title = w.done && !this.running ? 'Run another thousand years (Space)' : 'Run / pause (Space)';
      $('#btn-end').disabled = w.done;
    }
    renderSide(force) {
      const now = performance.now();
      if (!force && this._sideT && now - this._sideT < 700) return;
      if (!force && this.sideVersion === this.w.version) return;
      this._sideT = now; this.sideVersion = this.w.version;
      if (this.tab === 'chron') { this.renderChron(); this.drawChart(); return; }
      if (this.tab !== 'lang') return;
      const el = $('#tab-lang'), st = el.scrollTop;
      el.innerHTML = this.selected >= 0 ? CG.langHTML(this.w, this.w.langs[this.selected]) : CG.overviewHTML(this.w);
      el.scrollTop = st;
    }

    renderChron() {
      const w = this.w, f = this.chronFilter;
      let items = w.events.map(e => ({ t: e.t, type: e.type, html: esc(e.text).replace(/\*([^*]+)\*/g, (_, x) => `<span class="ipa">${x}</span>`), l: e.langs[e.langs.length - 1] }));
      const rules = w.rules.filter(R => f === 'sound' || R.hits >= 12);
      if (f === 'all' || f === 'sound') items = items.concat(rules.map(R => ({ t: R.t, type: 'sound', html: `${esc(w.langs[R.lang].name)}: <b>${esc(R.name)}</b> <span class="ipa">${esc(R.note)}</span>`, l: R.lang })));
      if (f !== 'all') items = items.filter(i => i.type === f);
      items.sort((a, b) => b.t - a.t);
      const icon = { origin: '✶', split: '⑂', death: '✝', invent: '◆', sound: '∿' };
      $('#chron').innerHTML = items.slice(0, 400).map(i => `<li data-l="${i.l}"><span class="yr">${CG.fmtYear(i.t)}</span><span class="ty">${icon[i.type] || ''}</span>${i.html}</li>`).join('') || '<li class="dim">Nothing yet.</li>';
    }
    drawChart() {
      const cv = $('#chart'), dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
      if (!r.width) return;
      cv.width = r.width * dpr; cv.height = 90 * dpr;
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const H = this.w.history, T = Math.max(this.w.p.years, this.w.t), maxL = Math.max(4, ...H.map(h => h.living));
      ctx.fillStyle = '#fbf7ec'; ctx.fillRect(0, 0, r.width, 90);
      const X = t => 4 + (r.width - 8) * t / T, Y = v => 80 - 62 * v / maxL;
      ctx.strokeStyle = '#a4583f'; ctx.lineWidth = 2; ctx.beginPath();
      H.forEach((h, i) => i ? ctx.lineTo(X(h.t), Y(h.living)) : ctx.moveTo(X(h.t), Y(h.living)));
      ctx.stroke();
      ctx.fillStyle = '#c0803a';
      for (const inv of this.w.inventions) { const x = X(inv.t); ctx.beginPath(); ctx.moveTo(x, 83); ctx.lineTo(x + 3.5, 89); ctx.lineTo(x - 3.5, 89); ctx.fill(); }
      ctx.fillStyle = '#6f6656'; ctx.font = '11px sans-serif';
      ctx.fillText(`Living languages (peak ${maxL}) · ▲ inventions`, 8, 13);
    }

    etymology(l, mi) {
      $('#modal-body').innerHTML = CG.etymologyHTML(this.w, this.w.langs[l], mi);
      $('#modal').hidden = false;
      $('#modal-card').scrollTop = 0;
    }
    closeModal() { $('#modal').hidden = true; }
    showTip(e, html) {
      const t = $('#tip');
      t.innerHTML = html; t.hidden = false;
      const r = t.getBoundingClientRect();
      let x = e.clientX + 14, y = e.clientY + 14;
      if (x + r.width > innerWidth - 6) x = e.clientX - r.width - 14;
      if (y + r.height > innerHeight - 6) y = e.clientY - r.height - 14;
      t.style.left = x + 'px'; t.style.top = y + 'px';
    }
    hideTip() { $('#tip').hidden = true; }
    toast(msg, ms = 3200) {
      const t = $('#toast');
      t.textContent = msg; t.hidden = false;
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => { t.hidden = true; }, ms);
    }
  }

  function segOn(sel, b) { document.querySelectorAll(sel + ' button').forEach(x => x.classList.toggle('on', x === b)); }
  function randomSeed() {
    const a = ['amber', 'birch', 'cinder', 'delta', 'ember', 'fjord', 'gale', 'heath', 'iris', 'juniper', 'kestrel', 'lichen', 'moraine', 'nettle', 'osprey', 'quartz', 'rowan', 'sorrel', 'tundra', 'umber', 'willow'];
    return a[Math.floor(Math.random() * a.length)] + '-' + Math.floor(Math.random() * 1000);
  }

  const ABOUT = `
    <h2>What this is</h2>
    <p class="note" style="font-size:13px;color:var(--ink)">A single language is born in a homeland on an invented continent. Its speakers spread out. When they are spread too far, or cut off by the sea, their speech drifts apart and the language splits into daughters, then granddaughters. Some languages are swallowed by expanding neighbours. Every word in every language has a history you can trace.</p>
    <h2>How languages change here</h2>
    <p class="note"><b>Sound laws.</b> About sixty kinds of natural sound change (voicing between vowels, palatalisation before i, umlaut, loss of final vowels, nasal vowels, chain shifts, stress shifts and more) are written as rules over phonetic features, with environments like <span class="ipa">/ V_V</span> or <span class="ipa">/ _#</span>. A language only picks a change that would affect some of its words, and the change then applies to <i>every</i> word that fits. That regularity is what makes the comparative method work, here as in real historical linguistics.</p>
    <p class="note"><b>Words come and go.</b> Basic words are replaced at a slow, steady rate: by new coinages that sound like the rest of the language, by transparent compounds ('night' + 'sun' for moon), by shifts between related meanings, and by loans from neighbours. Loans are adapted to the borrower's sounds. When a language dies, a few of its words live on as loans in the language that replaced it.</p>
    <p class="note"><b>Wanderwörter.</b> Cultural words (horse, iron, wheel, wine, …) don't exist at first. When a people invents the thing, the word travels with it from neighbour to neighbour, across family lines. You can watch this on the word map. Horse, iron, wheel and king also make their inventors expand.</p>
    <h2>Things to try</h2>
    <p class="note">• On the <b>word map</b>, pick ‘horse’ late in a run, or ‘two’ (rarely replaced).<br>• Click a sound in a language's sound chart to see where it occurs.<br>• In the <b>tree</b>, hover the ticks to see each sound law.<br>• In the <b>lexicon</b>, choose a branch and read across a row: the colours are cognate sets.<br>• Click any word for its etymology, back to the proto-language, with each law that touched it.<br>• Every word can be heard: a small formant synthesiser speaks it, with stress.<br>• The <b>puzzles</b> give you the linguist's job: reconstruct a proto-language, identify a sound law, or put laws in historical order.</p>
    <h2>Limits</h2>
    <p class="note">Grammar is not simulated, only words and sounds. Dialect continua, analogy and sporadic changes are left out, so the sound laws are exceptionless (the Neogrammarian ideal). The speech is synthetic and approximate.</p>
    <p class="note">Keys: <b>Space</b> run/pause · <b>1–4</b> views · <b>Esc</b> close / deselect.</p>`;

  window.addEventListener('DOMContentLoaded', () => { G.app = new App(); });
})(globalThis);
