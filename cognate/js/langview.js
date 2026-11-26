// Cognate: the language card and the etymology card.
'use strict';
(function (G) {
  const CG = G.CG, esc = CG.esc;
  const ipa = f => `<span class="ipa">${esc(typeof f === 'string' ? f : CG.str(f))}</span>`;
  const gl = mi => `‘${esc(CG.MEANINGS[mi].g)}’`;
  const yr = t => `year ${CG.fmtYear(t)}`;
  const say = (lang, f) => `<button class="say" data-say="${esc(CG.str(f))}" data-stress="${lang ? lang.stress : 'initial'}" title="Listen">🔊</button>`;
  const lname = (w, id) => `<button class="link" data-lang="${id}">${esc(w.langs[id].name)}</button>`;
  CG.ui = { ipa, gl, yr, say, lname };

  // Which language was the one speaking at time t on the lineage of L (for labelling inherited changes)
  // ----------------------------------------------------------------------------------------------- etymology
  function originItems(w, o, e, mi, depth) {
    const E = w.etyma[e];
    const items = [];
    const k = o ? o.k : 'inh';
    if (k === 'inh' || (k !== 'loan' && k !== 'shift' && E && E.kind === 'proto')) {
      if (E.kind === 'proto') items.push({ t: 0, cls: 'origin', html: `<span class="yr">${yr(0)}</span>${lname(w, 0)} <span class="form">*${esc(CG.str(E.f))}</span> ${gl(E.m)} ${say(w.langs[0], E.f)}` });
      else items.push(...originItems(w, { k: E.kind, t: E.t, lang: E.lang, parts: E.parts }, e, mi, depth));
      return items;
    }
    if (k === 'coin') {
      items.push({ t: o.t, cls: 'origin', html: `<span class="yr">${yr(o.t)}</span>A new word appears in ${lname(w, o.lang ?? E.lang)}: <span class="form">${esc(CG.str(E.f))}</span> ${gl(E.m)}${E.wander ? ', for something new to its speakers' : ''} ${say(w.langs[E.lang], E.f)}` });
      return items;
    }
    if (k === 'comp') {
      const [a, b] = o.parts || E.parts;
      items.push({ t: o.t, cls: 'origin', html: `<span class="yr">${yr(o.t)}</span>${lname(w, o.lang ?? E.lang)} makes a compound: ${gl(a)} + ${gl(b)} → <span class="form">${esc(CG.str(E.f))}</span> ${gl(E.m)} ${say(w.langs[E.lang], E.f)}` });
      return items;
    }
    if (k === 'shift') {
      items.push(...originItems(w, o.via, e, o.from, depth));
      items.push({ t: o.t, cls: 'shift', html: `<span class="yr">${yr(o.t)}</span>In ${lname(w, o.lang)} the word for ${gl(o.from)} comes to mean ${gl(mi)}.` });
      return items;
    }
    if (k === 'loan') {
      const D = w.langs[o.from];
      const why = { culture: 'together with the thing itself', substrate: 'from the people who gave up their language for it', contact: 'through contact between neighbours' }[o.why] || '';
      let sub = '';
      if (depth < 3) {
        const inner = originItems(w, o.srcO, e, mi, depth + 1).concat(lawItems(w, o.srcH, o.src));
        inner.sort((a, b) => a.t - b.t);
        sub = `<div class="subchain"><span class="in">How ${esc(D.name)} got it:</span><ol class="chain">${inner.map(it => `<li class="${it.cls || ''}">${it.html}</li>`).join('')}</ol></div>`;
      }
      items.push({ t: o.t, cls: 'borrow', html: `<span class="yr">${yr(o.t)}</span>Borrowed into ${lname(w, o.lang)} from ${lname(w, o.from)} <span class="form">${esc(CG.str(o.src))}</span>, ${why}.${sub}` });
      return items;
    }
    return items;
  }
  function lawItems(w, h, finalForm) {
    const out = [];
    for (let i = 0; i < h.length; i++) {
      const [t, rid, before] = h[i];
      const after = i + 1 < h.length ? h[i + 1][2] : finalForm;
      const R = w.rules[rid];
      out.push({ t, html: `<span class="yr">${yr(t)}</span><span class="form">${esc(CG.str(before))} → ${esc(CG.str(after))}</span><br><span class="law">${esc(R.name)}: ${ipa(R.note)} <span class="in">in ${esc(w.langs[R.lang].name)}</span></span>` });
    }
    return out;
  }
  CG.etymologyHTML = (w, L, mi) => {
    const wd = L.lex[mi];
    if (!wd) return `<div class="ety"><h1>—</h1><p>${esc(L.name)} has no word for ${gl(mi)}.</p></div>`;
    const items = originItems(w, wd.o, wd.e, mi, 0).concat(lawItems(w, wd.h, wd.f));
    // laws inherited through a shift are in wd.h already; keep everything in time order (stable)
    items.forEach((it, i) => it.i = i);
    items.sort((a, b) => a.t - b.t || a.i - b.i);
    items.push({ cls: 'now', html: `<span class="yr">${L.died == null ? 'today' : yr(L.died)}</span>${lname(w, L.id)} <span class="form">${esc(CG.str(wd.f))}</span> ${gl(mi)} ${say(L, wd.f)} <span class="in">· spelled “${esc(CG.romanize(wd.f))}”</span>` });
    // relatives
    const cogs = [];
    for (const M of w.living()) {
      if (M.id === L.id) continue;
      M.lex.forEach((x, j) => { if (x && x.e === wd.e) cogs.push(`<span data-l="${M.id}" data-m="${j}">${esc(M.name)} ${ipa(x.f)}${j !== mi ? ' ' + gl(j) : ''}${x.o.k === 'loan' ? ' <span class="dim">(loan)</span>' : ''}</span>`); });
    }
    const nLaws = wd.h.length;
    const E = w.etyma[wd.e];
    let sum = '';
    if (wd.o.k === 'inh' && E.kind === 'proto') sum = `Inherited from ${esc(w.langs[0].name)} through ${w.ancestors(L).length - 1} generations of languages, reshaped by ${nLaws} sound law${nLaws === 1 ? '' : 's'}.`;
    else if (wd.o.k === 'loan') sum = `A loanword from ${esc(w.langs[wd.o.from].name)}.`;
    else if (wd.o.k === 'shift') sum = `An old word that changed its meaning.`;
    else sum = `A word made up after the proto-language.`;
    return `<div class="ety"><h1>${ipa(wd.f)} ${say(L, wd.f)}</h1><div class="gloss">${esc(L.name)} ${gl(mi)} · ${sum}</div>
      <ol class="chain">${items.map(it => `<li class="${it.cls || ''}">${it.html}</li>`).join('')}</ol>
      <h2>Relatives in living languages</h2>${cogs.length ? `<div class="cogs">${cogs.join('')}</div>` : '<p class="note">None. This word survives only here.</p>'}
      ${wd.o.prev ? `<p class="note">It replaced an older word ${ipa(wd.o.prev)}.</p>` : ''}</div>`;
  };

  // ----------------------------------------------------------------------------------------------- inventory
  function inventoryHTML(w, L) {
    const inv = CG.inventory(L.lex.map(x => x && x.f));
    const pinv = CG.inventory(w.langs[0].lex.map(x => x && x.f));
    const cons = [...inv.keys()].filter(CG.isC), lostC = [...pinv.keys()].filter(s => CG.isC(s) && !inv.has(s));
    const places = CG.PLACES.filter(p => cons.concat(lostC).some(s => CG.FEAT[s].place === p));
    const manners = CG.MANNERS.filter(m => cons.concat(lostC).some(s => CG.FEAT[s].manner === m));
    const ab = { lab: 'lab', lbd: 'l-d', den: 'dent', alv: 'alv', pa: 'p-a', pal: 'pal', vel: 'vel', uvu: 'uvu', glo: 'glot' };
    let h = '<table class="inv"><tr><th></th>' + places.map(p => `<th title="${CG.PLACE_NAME[p]}">${ab[p]}</th>`).join('') + '</tr>';
    for (const m of manners) {
      h += `<tr><th>${CG.MANNER_NAME[m]}</th>`;
      for (const p of places) {
        const here = cons.filter(s => CG.FEAT[s].place === p && CG.FEAT[s].manner === m).sort((a, b) => CG.FEAT[a].voice - CG.FEAT[b].voice);
        const gone = L.id ? lostC.filter(s => CG.FEAT[s].place === p && CG.FEAT[s].manner === m) : [];
        h += '<td>' + here.map(s => `<span data-snd="${esc(s)}" class="${L.id && !pinv.has(s) ? 'new' : ''}" title="${esc(CG.describe(s))}${L.id && !pinv.has(s) ? ' · new since the proto-language' : ''}">${esc(s)}</span>`).join('') + gone.map(s => `<span class="lost" title="lost since the proto-language">${esc(s)}</span>`).join('') + '</td>';
      }
      h += '</tr>';
    }
    h += '</table>';
    const vs = [...inv.keys()].filter(CG.isV).sort((a, b) => { const A = CG.FEAT[a], B = CG.FEAT[b]; return A.height - B.height || A.back - B.back || A.round - B.round || A.long - B.long || A.nasal - B.nasal; });
    const lostV = L.id ? [...pinv.keys()].filter(s => CG.isV(s) && !inv.has(s)) : [];
    h += '<div class="vowels">' + vs.map(s => `<span data-snd="${esc(s)}" class="${L.id && !pinv.has(s) ? 'new' : ''}" title="${esc(CG.describe(s))}">${esc(s)}</span>`).join('') + lostV.map(s => `<span class="lost" title="lost since the proto-language">${esc(s)}</span>`).join('') + '</div>';
    return h;
  }

  // ----------------------------------------------------------------------------------------------- language card
  const SAMPLE = ['I', 'you', 'two', 'water', 'fire', 'sun', 'eye', 'hand', 'mother', 'dog', 'fish', 'stone', 'name', 'eat', 'see', 'night', 'tree', 'horse', 'iron', 'king'].map(g => CG.MI[g]).filter(x => x != null);
  CG.langHTML = (w, L) => {
    const P = w.langs[0];
    const anc = w.ancestors(L);
    let status;
    if (L.died == null) status = L.id === 0 ? `The ancestor of the whole family, still one language.` : `A living language, spoken across ${L.cells} lands.`;
    else if (L.fate === 'split') status = `Spoken from year ${CG.fmtYear(L.born)} until year ${CG.fmtYear(L.died)}, when it broke up into ${L.children.map(c => lname(w, c)).join(', ')}.`;
    else status = `Died out in year ${CG.fmtYear(L.died)}${L.absorbedBy >= 0 ? `, when its speakers went over to ${lname(w, L.absorbedBy)}` : ''}.`;
    let h = `<div class="lhead"><span class="sw" style="background:${CG.hsl(L.hue, 52, 50)}"></span><h1>${esc(L.name)}</h1></div><p class="status">${status}</p>`;
    h += '<dl class="kv">';
    if (anc.length > 1) h += `<dt>Lineage</dt><dd>${anc.slice(0, -1).map(A => lname(w, A.id)).join(' › ')}</dd>`;
    h += `<dt>Since</dt><dd>year ${CG.fmtYear(L.born)}</dd>`;
    if (L.endonym) h += `<dt>Named after</dt><dd>its word ${ipa(L.endonym.f)} ${gl(L.endonym.m)} ${say(L, L.endonym.f)}</dd>`;
    h += `<dt>Stress</dt><dd>on the ${CG.STRESS_NAME[L.stress]}</dd>`;
    if (L.id) {
      let n = 0, k = 0, loans = 0;
      for (const m of CG.MEANINGS) { const a = L.lex[m.i], p = P.lex[m.i]; if (a && a.o.k === 'loan') loans++; if (m.cat === 'culture' || !a || !p) continue; n++; if (a.e === p.e && a.o.k !== 'loan') k++; }
      h += `<dt>Kept</dt><dd>${k} of ${n} basic proto words</dd><dt>Loanwords</dt><dd>${loans}</dd>`;
    }
    h += '</dl>';
    if (L.died == null && L.id) {
      const rel = w.living().filter(M => M.id !== L.id).map(M => [M, w.similarity(L, M)]).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (rel.length) h += `<h2>Closest relatives</h2><div class="chips">${rel.map(([M, s]) => `<span class="chip" data-lang="${M.id}"><span class="sw" style="background:${CG.hsl(M.hue, 52, 50)}"></span>${esc(M.name)} <span class="dim">${Math.round(s * 100)}%</span></span>`).join('')}</div><p class="note">Share of basic meanings expressed by inherited words of the same origin.</p>`;
    }
    h += `<div class="headrow"><h2>Words</h2></div><div class="words">`;
    for (const mi of SAMPLE) { const wd = L.lex[mi]; if (!wd) continue; h += `<span class="g">${esc(CG.MEANINGS[mi].g)}</span><span><span class="ipa" data-ety="${L.id}:${mi}" title="Show its history">${esc(CG.str(wd.f))}</span>${wd.o.k === 'loan' ? ' <span class="dim">‹ ' + esc(w.langs[wd.o.from].name) + '</span>' : ''} ${say(L, wd.f)}</span>`; }
    h += `</div><p class="note">Click a word for its history, or open the <button class="link" data-act="lexbranch">lexicon</button> for all ${CG.MEANINGS.length} meanings.</p>`;
    h += `<h2>Sounds</h2>${inventoryHTML(w, L)}<p class="note">${L.id ? '<span class="new">Red</span>: new since the proto-language. <span class="lost">Struck</span>: lost. ' : ''}Click a sound to see where it is used on the map.</p>`;
    // sound laws
    const chain = w.ruleChain(L);
    h += `<h2>Sound laws <span class="dim" style="text-transform:none;letter-spacing:0">(${chain.length}, oldest first)</span></h2><ol class="laws">`;
    let cur = -1;
    for (const rid of chain) {
      const R = w.rules[rid];
      if (R.lang !== cur) { cur = R.lang; h += `<li class="from" style="border:none;padding-left:0">${R.lang === L.id ? 'Its own' : 'Inherited from ' + lname(w, R.lang)}</li>`; }
      const ex = (R.ex || []).slice(0, 2).map(([mi, a, b]) => `${ipa(a)} → ${ipa(b)} ${gl(mi)}`).join(', ');
      h += `<li class="${R.lang === L.id ? 'own' : ''}"><span class="yr">${yr(R.t)}</span> <span class="nm">${esc(R.name)}</span><span class="rn">${esc(R.note)}</span>${ex ? `<span class="ex">${ex}${R.hits > 2 ? ` and ${R.hits - 2} more` : ''}</span>` : ''}${R.why ? `<div class="ex">${esc(R.why)}</div>` : ''}</li>`;
    }
    if (!chain.length) h += '<li class="from" style="border:none;padding-left:0">None yet.</li>';
    h += '</ol>';
    return h;
  };

  CG.overviewHTML = w => {
    const live = w.living();
    let h = `<h2>${esc(w.langs[0].name)} and its daughters</h2>`;
    h += `<p class="status">Year ${CG.fmtYear(w.t)}. ${live.length} living language${live.length === 1 ? '' : 's'}, ${w.langs.filter(L => L.fate === 'absorbed').length} died out, ${w.rules.length} sound laws so far.</p>`;
    h += `<p class="note">Click a language on the map or the tree to read about it. Click any word to see where it came from.</p>`;
    h += `<div class="chips">${live.map(L => `<span class="chip" data-lang="${L.id}"><span class="sw" style="background:${CG.hsl(L.hue, 52, 50)}"></span>${esc(L.name)}</span>`).join('')}</div>`;
    h += CG.langHTML(w, w.langs[0]).replace(/^<div class="lhead">/, '<div class="lhead" style="margin-top:22px">');
    return h;
  };
})(globalThis);
