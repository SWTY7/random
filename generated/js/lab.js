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
    ['Dicyclic-ish: a 4-cycle and a twist', 'a = (1 2 3 4)\nb = (1 3)(5 6)'],
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
        <div class="row"><button id="lab-go">Generate ⟨…⟩</button></div>
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
    </div>`;
    const ta = root.querySelector('#lab-gens');
    ta.value = PRESETS[2][1];
    root.querySelector('#lab-preset').onchange = (e) => { if (e.target.value !== '') { ta.value = PRESETS[+e.target.value][1]; run(); } };
    root.querySelector('#lab-go').onclick = run;
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
    word(); member();
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
    show(root) { if (!built) { build(root); built = true; } else if (A && A.N <= 240) { const c = document.querySelector('#lab-graph'); const d = window.devicePixelRatio || 1; c.width = c.clientWidth * d; c.height = c.clientHeight * d; } },
    frame(now) { if (view && view.N) view.draw(now); },
    load(text) { document.querySelector('#lab-gens').value = text; run(); },
  };
})();
