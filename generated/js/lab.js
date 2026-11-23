/* The Lab: type generators in cycle notation; get the group's order, name, structure and Cayley graph. */
(function () {
  'use strict';
  const P = window.Perm, B = window.Board;
  const PRESETS = [
    ['Cyclic C₆', 'a = (1 2 3 4 5 6)'],
    ['Klein four-group', 'a = (1 2)(3 4)\nb = (1 3)(2 4)'],
    ['D₄, symmetries of a square', 'r = (1 2 3 4)\nf = (2 4)'],
    ['C₂ × C₄ (abelian, not cyclic)', 'a = (1 2 3 4)\nb = (5 6)'],
    ['Q₈, the quaternions', 'i = (1 2 3 4)(5 6 7 8)\nj = (1 5 3 7)(2 8 4 6)'],
    ['S₃ = D₃', 'a = (1 2 3)\nb = (1 2)'],
    ['S₄ by adjacent swaps (permutohedron)', 'a = (1 2)\nb = (2 3)\nc = (3 4)'],
    ['A₄, the tetrahedron', 'a = (1 2 3)\nb = (2 3 4)'],
    ['A₅, the bow tie', 'a = (1 2 3)\nb = (3 4 5)'],
    ['Cube rotations (on faces U L F R B D)', 'y = (3 2 5 4)\nx = (3 1 5 6)'],
    ['S₅ by a swap and a 5-cycle', 't = (1 2)\nc = (1 2 3 4 5)'],
    ['Linked rings (S₇, too big to draw)', 'a = (1 2 3 4)\nb = (4 5 6 7)'],
    ['C₃ × C₃', 'a = (1 2 3)\nb = (4 5 6)'],
    ['The exotic S₅ inside S₆ (puzzle 5-3)', 'a = (1 2 5 4)\nb = (2 3 6 5)'],
    ['GL(3,2): symmetries of the Fano plane', 'a = (1 2 3 4 5 6 7)\nb = (1 2)(3 6)'],
    ['Frobenius group of order 20', 'a = (1 2 3 4 5)\nb = (2 3 5 4)'],
  ];
  const COLORS = B.GEN_COLORS.concat(['#c27c0e', '#1b998b', '#8d6a9f']);
  let view = null, built = false, A = null, names = [];

  function parse(text) {
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    if (!lines.length) throw new Error('Write at least one generator, like  a = (1 2 3)');
    const gens = [], ns = [];
    lines.forEach((l, i) => {
      let name, rhs;
      const m = l.match(/^([a-zA-Z])\s*=\s*(.*)$/);
      if (m) { name = m[1]; rhs = m[2]; } else { name = 'abcdefgh'[i]; rhs = l; }
      if (name !== name.toLowerCase()) throw new Error('Use lower-case names; upper case means inverse in words.');
      if (ns.includes(name)) throw new Error('Two generators are called ' + name + '.');
      ns.push(name); gens.push(P.parseCycles(rhs));
    });
    const n = Math.max(...gens.map((g) => g.length), 1);
    return { gens: gens.map((g) => P.pad(g, n)), names: ns, n };
  }

  function evalWord(word) {
    let p = P.identity(A.n);
    const w = word.replace(/\s+/g, '');
    if (!w) return p;
    // supports letters, upper case = inverse, and powers like a^3 or (ab)^2
    let i = 0;
    function atom() {
      let q;
      if (w[i] === '(') { i++; q = seq(); if (w[i] !== ')') throw new Error('Missing )'); i++; }
      else {
        const c = w[i];
        const k = names.indexOf(c.toLowerCase());
        if (k < 0) throw new Error('Unknown letter "' + c + '". Generators: ' + names.join(', '));
        q = c === c.toLowerCase() ? A.gens[k] : P.inverse(A.gens[k]); i++;
      }
      if (w[i] === '^') {
        i++; let neg = false; if (w[i] === '-') { neg = true; i++; }
        const m = w.slice(i).match(/^\d+/); if (!m) throw new Error('Expected a number after ^');
        i += m[0].length; let r = P.identity(A.n); for (let t = 0; t < +m[0]; t++) r = P.compose(r, q); q = neg ? P.inverse(r) : r;
      }
      return q;
    }
    function seq() { let r = P.identity(A.n); while (i < w.length && w[i] !== ')') r = P.compose(r, atom()); return r; }
    p = seq(); if (i < w.length) throw new Error('Unexpected ' + w[i]);
    return p;
  }

  function wordFor(p) {
    const k = A.bfs.index.get(P.key(p));
    if (k === undefined) return null;
    return P.wordTo(A.bfs, k).map((g) => names[g]);
  }
  const fmtWord = (ws) => {
    if (!ws.length) return 'e';
    const parts = []; ws.forEach((k) => { const l = parts[parts.length - 1]; if (l && l[0] === k) l[1]++; else parts.push([k, 1]); });
    const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    return parts.map(([k, n]) => k + (n > 1 ? String(n).split('').map((d) => SUP[+d]).join('') : '')).join('');
  };

  function build(root) {
    root.innerHTML = `<div class="lab-grid">
      <div class="card">
        <h2 style="margin:0 0 4px">The Lab</h2>
        <p class="muted small" style="margin:0">Type permutations in cycle notation, one per line. Points are numbered from 1. The rightmost cycle acts first.</p>
        <label>Preset</label><select id="lab-preset"><option value="">Choose an example…</option>${PRESETS.map((p, i) => `<option value="${i}">${p[0]}</option>`).join('')}</select>
        <label>Generators</label><textarea id="lab-gens" spellcheck="false"></textarea>
        <div class="row"><button id="lab-go">Generate ⟨…⟩</button><button id="lab-play">Play it as a puzzle</button></div>
        <div class="err" id="lab-err"></div>
        <label>Evaluate a word</label>
        <input type="text" id="lab-word" placeholder="e.g. abAB   (A = a⁻¹,  (ab)^3 allowed)">
        <div class="res" id="lab-word-res"></div>
        <label>Is this permutation in the group?</label>
        <input type="text" id="lab-mem" placeholder="e.g. (1 2)">
        <div class="res" id="lab-mem-res"></div>
      </div>
      <div class="card">
        <div id="lab-out"></div>
        <div class="lens-wrap"><canvas id="lab-graph"></canvas><div id="lab-tip" class="tip"></div></div>
        <div class="legend" id="lab-legend"></div>
      </div>
    </div>
    <div class="lab-more">
      <div class="card"><h3>Conjugacy classes</h3><div id="lab-classes"></div></div>
      <div class="card"><h3>Counting colourings (Burnside / Pólya)</h3><div id="lab-polya"></div></div>
      <div class="card wide"><h3>Subgroup lattice</h3><div id="lab-lattice"></div></div>
      <div class="card wide"><h3>Cayley table</h3><div id="lab-table"></div></div>
    </div>`;
    const ta = root.querySelector('#lab-gens');
    let saved = null; try { saved = localStorage.getItem('generated.lab'); } catch (e) {}
    ta.value = saved || PRESETS[2][1];
    root.querySelector('#lab-preset').onchange = (e) => { if (e.target.value !== '') { ta.value = PRESETS[+e.target.value][1]; run(); } };
    root.querySelector('#lab-go').onclick = run;
    root.querySelector('#lab-play').onclick = playIt;
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run(); });
    root.querySelector('#lab-word').addEventListener('input', word);
    root.querySelector('#lab-mem').addEventListener('input', member);
    view = new window.GraphView(root.querySelector('#lab-graph'), { onHover: hover });
    run();
  }

  function run() {
    const err = document.querySelector('#lab-err'), out = document.querySelector('#lab-out');
    err.textContent = '';
    let parsed;
    try { parsed = parse(document.querySelector('#lab-gens').value); } catch (e) { err.textContent = e.message; return; }
    names = parsed.names;
    try { localStorage.setItem('generated.lab', document.querySelector('#lab-gens').value); } catch (e) {}
    const t0 = performance.now();
    const a = P.analyse(parsed.gens);
    if (a.overflow) { err.textContent = 'This group has more than 60 000 elements, which is too many to list here.'; return; }
    A = a;
    const ms = Math.round(performance.now() - t0);
    const ords = Object.keys(a.orderCount).map(Number).sort((x, y) => x - y);
    const maxC = Math.max(...ords.map((o) => a.orderCount[o]));
    const hist = ords.map((o) => `<div style="height:${Math.max(3, (a.orderCount[o] / maxC) * 80)}px"><b>${a.orderCount[o]}</b><span>${o}</span></div>`).join('');
    const lag = divisors(a.N).map((d) => (a.orderCount[d] ? `<b>${d}</b>` : `<span class="muted">${d}</span>`)).join(', ');
    out.innerHTML = `<div class="gname">${a.names.length ? a.names.join('<br>≅ ') : 'A group of order ' + a.N}</div>
      <table class="stats">
        <tr><td>Order |G|</td><td>${a.N}${a.N === 1 ? '' : ' = ' + factorStr(a.N)}</td></tr>
        <tr><td>Acts on</td><td>${a.k} of ${a.n} points</td></tr>
        <tr><td>Abelian?</td><td>${a.abelian ? 'yes: all generators commute' : 'no: ' + firstNoncommuting(parsed)}</td></tr>
        <tr><td>Centre Z(G)</td><td>${a.centre} element${a.centre === 1 ? '' : 's'}</td></tr>
        <tr><td>Even permutations</td><td>${a.even} of ${a.N}${a.even === a.N ? ' (G ⊆ Aₙ)' : ' (exactly half, as always when G has an odd element)'}</td></tr>
        <tr><td>Generator orders</td><td>${parsed.gens.map((g, i) => names[i] + ': ' + P.order(g)).join(', ')}</td></tr>
        <tr><td>Divisors of |G| (bold = some element has this order)</td><td>${lag}</td></tr>
      </table>
      <h4 class="muted small" style="margin:16px 0 4px;font-family:var(--sans);text-transform:uppercase;letter-spacing:.07em">Elements by order</h4>
      <div class="hist">${hist}</div>
      <p class="muted small" style="margin:-4px 0 6px">Computed in ${ms} ms. ${a.N <= 240 ? 'Hover a node to see that element. Edges show right-multiplication by each generator.' : 'With more than 240 elements the Cayley graph is too dense to draw.'}</p>`;
    const canvas = document.querySelector('#lab-graph');
    canvas.style.display = a.N <= 240 ? 'block' : 'none';
    if (a.N <= 240) {
      const edges = [];
      a.elements.forEach((x, i) => a.gens.forEach((g, gi) => { const j = a.bfs.index.get(P.key(P.compose(x, g))); if (j !== i) edges.push([i, j, gi]); }));
      const dpr = window.devicePixelRatio || 1; canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
      view.set(a.N, edges, a.gens.map((g, i) => ({ color: COLORS[i % COLORS.length], involution: P.order(g) === 2 })), 5);
      view.visited = new Set(); view.marks = { 0: { ring: '#e0a526' } };
      document.querySelector('#lab-legend').innerHTML = names.map((n, i) => `<span><i style="background:${COLORS[i % COLORS.length]}"></i>${n}</span>`).join('') + '<span><i class="dot" style="border:2.5px solid #e0a526;width:12px;height:12px"></i>identity e</span>';
    } else { view.N = 0; document.querySelector('#lab-legend').innerHTML = ''; }
    classes(); polya(); table(); lattice();
    word(); member();
  }

  /* ---- conjugacy classes and the class equation ---- */
  const cycleType = (p) => P.cycles(p, true).map((c) => c.length).sort((x, y) => y - x);
  function classes() {
    const box = document.querySelector('#lab-classes');
    if (A.N > 5000) { box.innerHTML = '<p class="muted">Too large to split into classes here.</p>'; return; }
    const seen = new Map(), cls = [];
    const inv = A.elements.map(P.inverse);
    A.elements.forEach((x) => {
      if (seen.has(P.key(x))) return;
      const c = new Map();
      A.elements.forEach((g, gi) => { const y = P.compose(P.compose(inv[gi], x), g); c.set(P.key(y), y); });
      c.forEach((_, k) => seen.set(k, cls.length));
      cls.push({ rep: x, size: c.size, order: P.order(x), type: cycleType(x) });
    });
    cls.sort((a, b) => a.order - b.order || a.size - b.size);
    const typeStr = (t) => { const f = t.filter((l) => l > 1); return f.length ? f.join('+') + (t.length > f.length ? ' (+' + (t.length - f.length) + ' fixed)' : '') : 'identity'; };
    box.innerHTML = `<p class="m" style="font-style:normal;margin:0 0 8px">|G| = ${cls.map((c) => c.size).join(' + ')} = ${A.N}</p>
      <p class="muted small" style="margin:0 0 8px">The <b>class equation</b>: G splits into ${cls.length} conjugacy classes. Every class size divides |G|, and the classes of size 1 make up the centre.</p>
      <table class="stats"><tr><td>size</td><td>order · cycle type · example</td></tr>${cls.map((c) => `<tr><td>${c.size}</td><td>${c.order} · ${typeStr(c.type)} · <span class="m" style="font-style:normal">${P.toCycles(c.rep)}</span></td></tr>`).join('')}</table>`;
  }

  /* ---- Burnside / Pólya: colourings of the n points up to the group ---- */
  function polya() {
    const box = document.querySelector('#lab-polya');
    const n = A.n, mono = new Map();
    A.elements.forEach((g) => {
      const counts = {}; cycleType(g).forEach((l) => { counts[l] = (counts[l] || 0) + 1; });
      const k = Object.keys(counts).map(Number).sort((a, b) => a - b).map((l) => l + ':' + counts[l]).join(',');
      mono.set(k, (mono.get(k) || 0) + 1);
    });
    const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹', sup = (x) => (x === 1 ? '' : String(x).split('').map((d) => SUP[+d]).join(''));
    const terms = [...mono.entries()].map(([k, c]) => (c > 1 ? c : '') + k.split(',').map((t) => { const [l, e] = t.split(':').map(Number); return 'x' + P.sub(l) + sup(e); }).join(''));
    const cyclesOf = [...mono.entries()].map(([k, c]) => [c, k.split(',').reduce((s, t) => s + Number(t.split(':')[1]), 0)]);
    box.innerHTML = `<p class="muted small" style="margin:0 0 6px">Paint the ${n} points with k colours. Two colourings count as the same if some element of G turns one into the other. By Burnside's lemma, the number of distinct colourings is the average number of colourings fixed by an element, and an element with c cycles fixes kᶜ colourings.</p>
      <p class="m" style="font-style:normal;overflow-wrap:anywhere">Z(G) = (1/${A.N}) · ( ${terms.join(' + ')} )</p>
      <p style="margin:10px 0 4px">k = <input type="number" id="lab-k" min="1" max="12" value="2" style="width:60px;font:inherit;padding:2px 6px;border:1px solid #cfc5b0;border-radius:6px;background:#fffdf8"> colours →
        <b id="lab-k-out"></b></p>
      <div class="muted small" id="lab-k-list"></div>`;
    const update = () => {
      const k = Math.max(1, Math.min(12, parseInt(document.querySelector('#lab-k').value, 10) || 1));
      let total = 0; cyclesOf.forEach(([c, cyc]) => { total += c * Math.pow(k, cyc); });
      document.querySelector('#lab-k-out').textContent = (total / A.N).toLocaleString() + ' distinct colourings';
      const row = []; for (let q = 1; q <= 5; q++) { let t = 0; cyclesOf.forEach(([c, cyc]) => { t += c * Math.pow(q, cyc); }); row.push(q + ' → ' + (t / A.N).toLocaleString()); }
      document.querySelector('#lab-k-list').textContent = 'k = ' + row.join(',  ');
    };
    document.querySelector('#lab-k').addEventListener('input', update); update();
  }

  /* ---- Cayley table (multiplication table) ---- */
  function table() {
    const box = document.querySelector('#lab-table');
    if (A.N > 60) { box.innerHTML = '<p class="muted">Shown for groups of order at most 60; this one has ' + A.N + ' elements.</p>'; return; }
    const N = A.N, idx = A.bfs.index;
    const label = A.elements.map((x, i) => fmtWord(P.wordTo(A.bfs, i).map((g) => names[g])));
    const col = (i) => (i === 0 ? '#fffdf8' : 'hsl(' + Math.round((i * 137.508) % 360) + ',' + (45 + (i % 3) * 10) + '%,' + (62 + (i % 4) * 5) + '%)');
    const cell = N <= 12 ? 34 : N <= 24 ? 22 : 11;
    let h = `<p class="muted small" style="margin:0 0 8px">Row element first, then column element. Each element has its own colour, and the identity is white. Every row and every column contains every element exactly once, so the table is a <b>Latin square</b>. ${A.abelian ? 'This table is symmetric across the diagonal because G is abelian.' : 'It is not symmetric across the diagonal, because G is not abelian.'}</p>`;
    h += `<div class="ctable" style="grid-template-columns:${cell * 1.6}px repeat(${N}, ${cell}px)"><div></div>`;
    for (let j = 0; j < N; j++) h += `<div class="hd" title="${label[j]}">${cell >= 22 ? label[j] : ''}</div>`;
    for (let i = 0; i < N; i++) {
      h += `<div class="hd row" title="${label[i]}">${cell >= 22 ? label[i] : ''}</div>`;
      for (let j = 0; j < N; j++) {
        const k = idx.get(P.key(P.compose(A.elements[i], A.elements[j])));
        h += `<div style="background:${col(k)};width:${cell}px;height:${cell}px" title="${label[i]} · ${label[j]} = ${label[k]}">${cell >= 34 ? label[k] : ''}</div>`;
      }
    }
    box.innerHTML = h + '</div>';
  }


  /* ---- subgroup lattice (Hasse diagram) ---- */
  let subs = null, selected = -1;
  function lattice() {
    const box = document.querySelector('#lab-lattice');
    selected = -1; subs = null;
    if (A.N > 120) { box.innerHTML = '<p class="muted">Shown for groups of order at most 120; this one has ' + A.N + ' elements.</p>'; return; }
    subs = window.Lattice.subgroups(A, 1500);
    if (!subs) { box.innerHTML = '<p class="muted">Too many subgroups to draw.</p>'; return; }
    const orders = [...new Set(subs.map((x) => x.order))].sort((a, b) => a - b);
    const layers = orders.map((o) => subs.filter((x) => x.order === o));
    const W = Math.max(640, Math.min(1200, Math.max(...layers.map((l) => l.length)) * 34 + 80)), LH = 64, H = layers.length * LH + 30;
    // x positions: barycentre of the covered subgroups, then spread evenly
    const X = new Array(subs.length).fill(W / 2), Y = new Array(subs.length);
    layers.forEach((layer, li) => {
      layer.forEach((S) => { Y[S.id] = H - 25 - li * LH; if (S.cover.length) S.bx = S.cover.reduce((t, j) => t + X[j], 0) / S.cover.length; else S.bx = W / 2; });
      layer.sort((a, b) => a.bx - b.bx);
      const gap = (W - 80) / Math.max(1, layer.length);
      layer.forEach((S, k) => { X[S.id] = layer.length === 1 ? W / 2 : 40 + gap * (k + 0.5); });
    });
    let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block;margin:0 auto" id="lat-svg">`;
    subs.forEach((S) => S.cover.forEach((j) => { svg += `<line x1="${X[S.id]}" y1="${Y[S.id]}" x2="${X[j]}" y2="${Y[j]}" stroke="#d6ccb7" stroke-width="1" data-a="${S.id}" data-b="${j}"/>`; }));
    orders.forEach((o, li) => { svg += `<text x="6" y="${H - 21 - li * LH}" font-size="11" fill="#a39b8b" font-family="system-ui">${o}</text>`; });
    subs.forEach((S) => {
      svg += `<circle cx="${X[S.id]}" cy="${Y[S.id]}" r="${S.order === 1 || S.order === A.N ? 8 : 6.5}" fill="${S.normal ? '#3b3a36' : '#fbf8f1'}" stroke="#3b3a36" stroke-width="1.3" data-s="${S.id}" style="cursor:pointer"><title>order ${S.order}${S.normal ? ' · normal' : ''}</title></circle>`;
    });
    svg += '</svg>';
    const nNormal = subs.filter((x) => x.normal).length;
    box.innerHTML = `<p class="muted small" style="margin:0 0 6px">All <b>${subs.length}</b> subgroups, arranged by order (left margin), with a line wherever one subgroup sits directly inside another. Filled dots are the <b>${nNormal}</b> normal subgroups. <b>Click a subgroup</b> to colour the Cayley graph above by its cosets.</p>${svg}<div class="res" id="lat-info">Lagrange's theorem says every order in the margin divides ${A.N}. Its converse is false: try A₄, which has no subgroup of order 6.</div>`;
    box.querySelectorAll('circle').forEach((c) => c.addEventListener('click', () => pickSub(+c.dataset.s)));
  }
  const subNames = new Map();
  function pickSub(i) {
    selected = i;
    const S = subs[i];
    document.querySelectorAll('#lat-svg circle').forEach((c) => { const on = +c.dataset.s === i; c.setAttribute('stroke', on ? '#c8553d' : '#3b3a36'); c.setAttribute('stroke-width', on ? 3 : 1.3); });
    document.querySelectorAll('#lat-svg line').forEach((l) => { const on = +l.dataset.a === i || +l.dataset.b === i; l.setAttribute('stroke', on ? '#c8553d' : '#d6ccb7'); });
    if (!subNames.has(S)) {
      const gens = S.gens.map((g) => A.elements[g]);
      const a = gens.length ? P.analyse(gens) : { names: ['trivial'], N: 1 };
      subNames.set(S, a.names.length ? a.names[0] : 'order ' + S.order);
    }
    const cs = window.Lattice.cosets(A, S);
    const marks = {};
    for (let x = 0; x < A.N; x++) marks[x] = { fill: 'hsl(' + Math.round((cs.label[x] * 137.508) % 360) + ',55%,' + (55 + (cs.label[x] % 3) * 8) + '%)' };
    if (A.N <= 240 && view) { view.marks = marks; view.marks[0] = Object.assign({}, marks[0], { ring: '#e0a526' }); }
    document.querySelector('#lat-info').innerHTML = `H = ⟨${S.gens.map((g) => P.toCycles(A.elements[g])).join(', ') || 'e'}⟩ ≅ ${subNames.get(S)} · |H| = ${S.order} · index [G : H] = ${A.N / S.order}` +
      `<br>${S.normal ? '<b>Normal</b>: gH = Hg for every g, so the cosets form the quotient group G/H, of order ' + A.N / S.order + '.' : 'Not normal: some conjugate gHg⁻¹ is a different subgroup, so the left and right cosets differ.'}` +
      `<br><span class="muted">The Cayley graph above now shows the ${cs.count} cosets in ${cs.count} colours, all of the same size ${S.order}. This is Lagrange's theorem.</span>`;
  }

  function playIt() {
    run();
    const err = document.querySelector('#lab-err');
    if (!A) return;
    if (A.N > 5040) { err.textContent = 'Puzzles are limited to groups with at most 5040 elements.'; return; }
    if (A.N < 3) { err.textContent = 'This group is too small to make a puzzle.'; return; }
    const n = A.n, TAU = Math.PI * 2;
    const pos = Array.from({ length: n }, (_, i) => [0.74 * Math.cos(-Math.PI / 2 + (TAU * i) / n), 0.74 * Math.sin(-Math.PI / 2 + (TAU * i) / n)]);
    const lv = {
      id: 'lab', title: 'Lab puzzle', pos, tokens: Array.from({ length: n }, (_, i) => i), style: 'numbers',
      gens: A.gens.map((g, i) => ({ key: names[i], name: P.toCycles(g), cycles: P.cycles(g) })),
    };
    lv.base = lv;
    window.Generated.playCustom(lv, { title: 'Lab puzzle: ⟨' + names.join(', ') + '⟩', from: '#/lab', base: lv,
      intro: '<p>Your Lab group, as a puzzle: positions 1 to ' + n + ' around a circle, one button per generator. The target is a random arrangement you can reach.</p>' });
  }
  function firstNoncommuting(p) {
    for (let i = 0; i < p.gens.length; i++) for (let j = i + 1; j < p.gens.length; j++) {
      if (!P.equal(P.compose(p.gens[i], p.gens[j]), P.compose(p.gens[j], p.gens[i]))) return names[i] + names[j] + ' ≠ ' + names[j] + names[i];
    }
    return '';
  }
  function divisors(N) { const d = []; for (let i = 1; i <= N; i++) if (N % i === 0) d.push(i); return d; }
  function factorStr(N) {
    const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹', f = []; let n = N;
    for (let p = 2; p * p <= n; p++) { let k = 0; while (n % p === 0) { n /= p; k++; } if (k) f.push(p + (k > 1 ? String(k).split('').map((d) => SUPS[+d]).join('') : '')); }
    if (n > 1) f.push(String(n));
    return f.join(' · ');
  }

  function describe(p) {
    const w = wordFor(p);
    return `<b>${P.toCycles(p)}</b> · order ${P.order(p)} · ${P.sign(p) === 1 ? 'even' : 'odd'}` + (w ? ` · shortest word: <i>${fmtWord(w)}</i>` : '');
  }
  function word() {
    const box = document.querySelector('#lab-word-res'), v = document.querySelector('#lab-word').value;
    if (!A || !v.trim()) { box.innerHTML = '<span class="muted">Try the commutator abAB, or (ab)^2.</span>'; return; }
    try { box.innerHTML = describe(evalWord(v)); } catch (e) { box.innerHTML = '<span class="err">' + e.message + '</span>'; }
  }
  function member() {
    const box = document.querySelector('#lab-mem-res'), v = document.querySelector('#lab-mem').value;
    if (!A || !v.trim()) { box.innerHTML = '<span class="muted">Type a permutation to see whether it can be built from the generators, and how.</span>'; return; }
    try {
      const p = P.pad(P.parseCycles(v), A.n);
      if (p.length > A.n) { box.innerHTML = 'No: it moves a point the group never touches.'; return; }
      const w = wordFor(p);
      box.innerHTML = w ? 'Yes: ' + P.toCycles(p) + ' = <i>' + fmtWord(w) + '</i> (apply left to right)' : 'No: ' + P.toCycles(p) + ' is not in G.' + (A.even === A.N && P.sign(p) === -1 ? ' (It is odd, and every element of G is even.)' : '');
    } catch (e) { box.innerHTML = '<span class="err">' + e.message + '</span>'; }
  }
  function hover(i, e) {
    const tip = document.querySelector('#lab-tip');
    if (i < 0 || !A) { tip.style.display = 'none'; return; }
    const p = A.elements[i];
    tip.innerHTML = describe(p);
    const r = document.querySelector('#lab-graph').getBoundingClientRect();
    tip.style.display = 'block';
    tip.style.left = Math.min(r.width - 260, e.clientX - r.left + 14) + 'px';
    tip.style.top = (e.clientY - r.top + 10) + 'px';
  }

  window.Lab = {
    show(root) {
      if (!built) { build(root); built = true; }
      if (this.pending) { const t = this.pending; this.pending = null; document.querySelector('#lab-gens').value = t; document.querySelector('#lab-preset').value = ''; run(); return; }
      if (A && A.N <= 240) { const c = document.querySelector('#lab-graph'), d = window.devicePixelRatio || 1; c.width = c.clientWidth * d; c.height = c.clientHeight * d; }
    },
    frame(now) { if (view && view.N) view.draw(now); },
    load(text) { document.querySelector('#lab-gens').value = text; run(); },
  };
})();
