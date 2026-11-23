/* Generated: app shell, level select, and the puzzle screen. */
(function () {
  'use strict';
  const P = window.Perm, { LEVELS, CHAPTERS } = window.GLevels, B = window.Board;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

  /* ---------- progress ---------- */
  const KEY = 'generated.v1';
  let progress = {};
  try { progress = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { progress = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) {} };
  const starsOf = (id) => (progress[id] && progress[id].stars) || 0;

  /* ---------- canvas helpers ---------- */
  function fit(canvas, w, h) {
    const dpr = window.devicePixelRatio || 1;
    const cw = w || canvas.clientWidth, ch = h || canvas.clientHeight;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
  }

  const models = {};
  const modelOf = (lv) => models[lv.id] || (models[lv.id] = window.Puzzle.prepare(lv));

  /* ---------- home ---------- */
  function renderHome() {
    const home = $('#home');
    home.innerHTML = '';
    const total = LEVELS.reduce((s, l) => s + starsOf(l.id), 0);
    const hero = el('div', 'hero');
    hero.innerHTML = `<div>
      <h1>Every puzzle here is a walk on a group.</h1>
      <p>Each level gives you a few moves. Each move is a <b>permutation</b>, and the arrangements those moves can reach form an orbit of the <b>group they generate</b>. While you play, the right-hand panel draws the whole graph of that group and shows where you are in it.</p>
      <p>Some targets can't be reached. For those the answer is <i>Can't be done</i>, and the reward is understanding why.</p>
      <p><button class="go" onclick="location.hash='#/level/${(LEVELS.find((l) => !(progress[l.id] && progress[l.id].solved)) || LEVELS[0]).id}'">${total ? 'Continue' : 'Start with puzzle 1-1'} →</button></p>
      <p class="totals">${total} / ${LEVELS.length * 3} stars · ${LEVELS.filter((l) => progress[l.id] && progress[l.id].solved).length} / ${LEVELS.length} solved · <a href="#/lab">open the Lab</a> · <a href="#/about">notes and glossary</a></p>
    </div><canvas id="hero-graph"></canvas>`;
    home.appendChild(hero);
    CHAPTERS.forEach((ch, ci) => {
      const head = el('div', 'chapter', `<h2>${ch.title}</h2><span>${ch.blurb}</span>`);
      home.appendChild(head);
      const grid = el('div', 'levels');
      LEVELS.filter((l) => l.chapter === ci).forEach((lv) => {
        const m = modelOf(lv), s = starsOf(lv.id);
        const a = el('a', 'lvcard' + (progress[lv.id] && progress[lv.id].solved ? ' done' : ''));
        a.href = '#/level/' + lv.id;
        a.innerHTML = `<span class="stars">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</span><div class="id">${lv.id}</div><div class="t">${lv.title}</div><canvas></canvas><div class="grp">${progress[lv.id] && progress[lv.id].solved ? groupName(m) : '|G| = ?'}</div>`;
        grid.appendChild(a);
        requestAnimationFrame(() => {
          const c = a.querySelector('canvas'); fit(c);
          B.drawBoard(c, m, null, { state: m.start, small: true });
        });
      });
      home.appendChild(grid);
    });
    // hero: the permutohedron, slowly turning
    const hv = new window.GraphView($('#hero-graph'));
    const m = modelOf(LEVELS.find((l) => l.id === '3-1'));
    requestAnimationFrame(() => {
      fit($('#hero-graph'));
      hv.set(m.orbit.size, m.edges, m.gens.map((g, i) => ({ color: B.GEN_COLORS[i], involution: m.genOrders[i] === 2 })), 3);
      hv.visited = new Set(); hv.cur = 0;
      heroView = hv;
    });
  }
  let heroView = null;

  const nameCache = {};
  function groupName(m) {
    const k = m.lv.id;
    if (!(k in nameCache)) { const a = P.analyse(m.gens); nameCache[k] = a.names.length ? a.names[0].split(' (')[0] : 'order ' + a.N; }
    return nameCache[k];
  }

  /* ---------- play ---------- */
  let G = null; // current game
  const graph = new window.GraphView($('#graph'), { onHover: onGraphHover, onClick: onGraphClick });
  /* click a neighbouring dot to walk along that edge */
  function onGraphClick(j) {
    if (!G || G.anim) return;
    const gi = G.m.gens.findIndex((g) => G.m.orbit.index.get(P.key(P.act(G.state, g))) === j);
    if (gi >= 0) press(gi);
  }

  /* Custom puzzles: random targets for solved levels, and groups sent over from the Lab. */
  let custom = null, customN = 0;
  function randomTarget(base) {
    const m = window.Puzzle.prepare(Object.assign({}, base, { target: base.tokens.slice() }));
    // pick a state from the farther half of the orbit, so it is never trivial
    const far = Math.max(...m.orbit.dist);
    const pool = m.orbit.nodes.filter((_, i) => m.orbit.dist[i] >= Math.max(1, Math.ceil(far / 2)));
    return pool[Math.floor(Math.random() * pool.length)].slice();
  }
  function playCustom(base, extra) {
    custom = Object.assign({}, base, {
      id: 'custom-' + (++customN), custom: true, impossible: false, target: randomTarget(base),
      intro: '<p>A random reachable target. Can you find the shortest route?</p>',
      insight: '',
    }, extra || {});
    if (location.hash === '#/play') route(); else location.hash = '#/play';
  }
  window.Generated = { playCustom };

  function startLevel(id) {
    const lv = id === 'custom' ? custom : LEVELS.find((l) => l.id === id);
    if (!lv) { location.hash = '#/'; return; }
    const m = modelOf(lv);
    G = {
      lv, m, paths: B.makePaths(lv, lv.pos, m.gens),
      state: m.start.slice(), node: 0, history: [], presses: 0, hints: 0, falseClaims: 0,
      anim: null, queue: [], done: false, hoverGen: null, hintGen: null,
    };
    $('.lvl-id').textContent = lv.custom ? '∗' : lv.id;
    $('.lvl-title').textContent = lv.title;
    $('#intro').innerHTML = lv.intro;
    $('#outcome').innerHTML = '';
    $('#claim').style.display = lv.goal === 'relation' ? 'none' : '';
    $('.target-wrap').style.visibility = lv.goal === 'relation' ? 'hidden' : '';
    // moves
    const box = $('#moves'); box.innerHTML = '';
    lv.gens.forEach((g, i) => {
      const b = el('button', 'mv', `<span class="k" style="background:${B.GEN_COLORS[i]}">${g.key}</span><span>${g.name}<br><span class="o">order ${m.genOrders[i]} · key ${i + 1}</span></span>`);
      b.title = g.about || '';
      b.onclick = () => press(i);
      b.onmouseenter = () => { G.hoverGen = i; };
      b.onmouseleave = () => { G.hoverGen = null; };
      box.appendChild(b);
    });
    // lens
    const involution = m.genOrders.map((o) => o === 2);
    const fullGroup = m.orbit.size === m.groupOrder;
    $('#lens-title').textContent = fullGroup ? 'Cayley graph' : 'Schreier graph (orbit)';
    G.hintNodes = null;
    const drawable = m.orbit.size <= 200;
    $('#too-big').style.display = drawable ? 'none' : 'flex';
    $('#too-big').innerHTML = drawable ? '' : `<div><b>${m.orbit.size.toLocaleString()} states</b><br>That is too many to draw: a dot for every arrangement would fill this panel ${Math.round(m.orbit.size / 120)} times over.<br><span class="muted">You navigate by algebra here, not by map.</span></div>`;
    if (drawable) graph.set(m.orbit.size, m.edges, m.gens.map((g, i) => ({ color: B.GEN_COLORS[i], involution: involution[i] })), 11);
    else graph.set(0, [], []);
    refreshMarks();
    requestAnimationFrame(() => fit($('#graph')));
    $('#legend').innerHTML = lv.gens.map((g, i) => `<span><i style="background:${B.GEN_COLORS[i]}"></i>${g.key}</span>`).join('') +
      `<span><i class="dot" style="background:#c8553d"></i>you</span><span><i class="dot" style="background:#3b3a36"></i>visited</span>` +
      (m.reachable ? `<span><i class="dot" style="border:2.5px solid #e0a526;width:12px;height:12px"></i>target</span>` : '');
    fit($('#board')); fit($('#target'));
    B.drawBoard($('#target'), m, G.paths, { state: m.target, small: true });
    updateStats(); updateWord();
  }

  function refreshMarks() {
    const m = G.m, marks = {};
    if (m.reachable) {
      const t = m.orbit.index.get(P.key(m.target));
      marks[t] = { ring: '#e0a526' };
    }
    if (G.hintNodes) G.hintNodes.forEach((i) => { marks[i] = Object.assign({}, marks[i], { fill: '#e8c36a' }); });
    graph.marks = marks;
  }

  function press(gi) {
    if (!G) return;
    if (G.anim) { G.queue.push(gi); return; }
    window.Sound.move(gi);
    const from = G.state, to = P.act(from, G.m.gens[gi]);
    G.history.push({ state: from, node: G.node, gen: gi });
    G.state = to; G.presses++;
    G.node = G.m.orbit.index.get(P.key(to));
    G.anim = { gen: gi, from, t0: performance.now() };
    G.hintGen = null; document.querySelectorAll('.mv.hint').forEach((b) => b.classList.remove('hint'));
    graph.moveTo(G.node);
    updateStats(); updateWord();
  }
  function undo() {
    if (!G || !G.history.length || G.anim) return;
    const h = G.history.pop(); window.Sound.undo();
    G.state = h.state; G.node = h.node; graph.moveTo(G.node);
    updateStats(); updateWord();
  }
  function reset() {
    if (!G || G.anim) return;
    G.state = G.m.start.slice(); G.node = 0; G.history = []; graph.moveTo(0);
    updateStats(); updateWord();
  }
  function hint() {
    if (!G || G.done) return;
    G.hints++;
    const m = G.m;
    if (lv_isRel()) {
      const w = m.relation.map((g) => G.lv.gens[g].key);
      say(`<p class="muted">Hint: a shortest relation has length <b>${w.length}</b> and starts with <i>${w.slice(0, Math.ceil(w.length / 3)).join('')}…</i>. In the graph, look for a short loop that uses both colours.</p>`);
      return;
    }
    if (m.reachable) {
      const d = m.distTo[G.node];
      const gi = m.gens.findIndex((g) => m.distTo[m.orbit.index.get(P.key(P.act(G.state, g)))] === d - 1);
      if (gi >= 0) { G.hintGen = gi; document.querySelectorAll('.mv')[gi].classList.add('hint'); }
      say(`<p class="muted">Hint: the flashing move is on a shortest path. From here the target is <b>${d}</b> move${d === 1 ? '' : 's'} away.</p>`);
    } else {
      G.hintNodes = m.orbit.nodes.map((_, i) => i); refreshMarks();
      say(`<p class="muted">Hint: every arrangement you can reach is a dot in the graph on the right, ${m.orbit.size} in all, and they are now highlighted. Is the target one of them? Think about what every move <i>preserves</i>.</p>`);
    }
  }
  const lv_isRel = () => G && G.lv.goal === 'relation';
  function say(html) { $('#outcome').innerHTML = html; }

  function claim() {
    if (!G || G.done) return;
    const m = G.m;
    if (m.reachable) {
      G.falseClaims++; window.Sound.nope();
      say(`<div class="outcome bad"><div class="big">Actually, it can be done.</div><p>The target is in the orbit: it can be reached in ${m.par} move${m.par === 1 ? '' : 's'}. Keep looking, because the graph on the right contains it (the gold ring).</p></div>`);
      return;
    }
    // Ask for the reason: one correct argument and two plausible wrong ones.
    const rs = G.lv.reasons.map((r, i) => ({ text: r[0], why: r[1], ok: i === 0 }));
    const hash = [...G.lv.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const order = (hash >> 2) & 1 ? [2, 1] : [1, 2];
    order.splice(hash % 3, 0, 0); // where the correct argument goes
    say(`<div class="outcome"><div class="big">Correct, it can't be done. But why?</div><p class="muted small">Pick the argument that actually proves it.</p>
      <div class="reasons">${order.map((i) => `<button class="reason" data-i="${i}">${rs[i].text}</button>`).join('')}</div><div id="reason-fb"></div></div>`);
    document.querySelectorAll('.reason').forEach((b) => b.onclick = () => {
      const r = rs[+b.dataset.i];
      if (r.ok) { finish({ claimed: true, reasonFirst: !G.reasonWrong }); return; }
      G.reasonWrong = true; b.disabled = true; b.classList.add('wrong'); window.Sound.nope();
      $('#reason-fb').innerHTML = `<p class="muted"><b>Not quite.</b> ${r.why}</p>`;
    });
  }

  function checkRelation() {
    if (G.node !== 0 || !G.history.length) return;
    const w = G.history.map((h) => h.gen);
    if (window.Puzzle.isTrivial(w, G.m.genOrders)) {
      say(`<p class="muted">Back at the start, but <i>${fmtWord(w.map((g) => G.lv.gens[g].key))}</i> is lazy: it collapses because each move undoes itself after ${[...new Set(G.m.genOrders)].join(' or ')} presses. Reset and try a word that mixes the moves.</p>`);
      return;
    }
    finish({});
  }

  function finish(info) {
    G.done = true;
    const lv = G.lv, m = G.m;
    let stars, list;
    if (lv.impossible) {
      const s2 = !!info.reasonFirst, s3 = G.hints === 0;
      stars = 1 + (s2 ? 1 : 0) + (s3 ? 1 : 0);
      list = [['Correct: unreachable', true], ['Right reason on the first try', s2], ['No hints', s3]];
    } else if (lv.goal === 'relation') {
      const moves = G.history.length;
      const s2 = moves === m.par, s3 = G.hints === 0 && G.falseClaims === 0;
      stars = 1 + (s2 ? 1 : 0) + (s3 ? 1 : 0);
      list = [['Found a relation: ' + fmtWord(G.history.map((h) => lv.gens[h.gen].key)) + ' = e', true], [`Shortest possible (${moves} / ${m.par})`, s2], ['No hints', s3]];
    } else {
      const moves = G.history.length;
      const s2 = moves === m.par, s3 = G.hints === 0 && G.falseClaims === 0;
      stars = 1 + (s2 ? 1 : 0) + (s3 ? 1 : 0);
      list = [['Reached the target', true], [`Fewest moves (${moves} / ${m.par})`, s2], ['No hints or false claims', s3]];
    }
    if (lv.custom) {
      const moves = G.history.length;
      say(`<div class="outcome"><div class="big">Solved in ${moves} move${moves === 1 ? '' : 's'}. ${moves === m.par ? '<span class="stars3">★</span> That is optimal.' : '(Fewest possible: ' + m.par + '.)'}</div>
        <p class="muted small">|G| = ${m.groupOrder}, and the orbit of the start has ${m.orbit.size} states.</p>
        <div class="next"><button id="again">Another random target →</button> ${lv.from ? `<button onclick="location.hash='${lv.from}'">Back</button>` : ''}</div></div>`);
      $('#again').onclick = () => playCustom(lv.base, { title: lv.title, from: lv.from, base: lv.base, intro: lv.intro });
      $('#board').classList.remove('won'); void $('#board').offsetWidth; $('#board').classList.add('won');
      window.Sound.win();
      updateStats();
      return;
    }
    const prev = progress[lv.id] || {};
    progress[lv.id] = { solved: true, stars: Math.max(prev.stars || 0, stars) };
    save();
    const idx = LEVELS.indexOf(lv), next = LEVELS[idx + 1];
    const head = lv.impossible ? 'Right: it can’t be done.' : 'Solved.';
    say(`<div class="outcome"><div class="big">${head} <span class="stars3">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span></div>
      <div class="starlist">${list.map(([t, ok]) => (ok ? '✓ ' : '· ') + t).join(' &nbsp; ')}</div>
      <h4>${lv.impossible ? 'Why' : 'What just happened'}</h4>${lv.impossible ? lv.proof : lv.insight}
      <div class="next">${next ? `<button onclick="location.hash='#/level/${next.id}'">Next: ${next.id} ${next.title} →</button>` : `<button onclick="location.hash='#/lab'">All levels done. Open the Lab →</button>`}
      <button id="to-lab">Open this group in the Lab</button>
      ${m.orbit.size > 2 && !lv.goal ? '<button id="random">Random target</button>' : ''}
      <button onclick="location.hash='#/'">All puzzles</button></div></div>`);
    if ($('#random')) $('#random').onclick = () => playCustom(lv, { title: lv.title + ' · random target', from: '#/level/' + lv.id, base: lv });
    $('#to-lab').onclick = () => {
      const text = lv.gens.map((g) => (/^[a-z]$/.test(g.key) ? g.key : 'abcdefgh'[lv.gens.indexOf(g)]) + ' = ' + P.toCycles(P.fromCycles(g.cycles, lv.pos.length))).join('\n');
      window.Lab.pending = text; location.hash = '#/lab';
    };
    // colour the graph by distance to the target: the breadth-first layers
    if (m.orbit.size <= 200) {
      const far = Math.max(...m.distTo.filter((d) => d !== Infinity), 1);
      const marks = {};
      m.orbit.nodes.forEach((_, i) => {
        const d = m.distTo[i];
        if (d !== Infinity) marks[i] = { fill: 'hsl(' + Math.round(40 + (d / far) * 180) + ',55%,' + (45 + (d / far) * 25) + '%)' };
      });
      if (m.reachable) marks[m.orbit.index.get(P.key(m.target))].ring = '#e0a526';
      graph.marks = marks;
      $('#legend').insertAdjacentHTML('beforeend', lv.goal === 'relation' ? '<span>dots coloured by distance from the start: your relation is a loop</span>' : m.reachable ? '<span>dots coloured by distance to the target (gold = 0)</span>' : '');
    }
    $('#board').classList.remove('won'); void $('#board').offsetWidth; $('#board').classList.add('won');
    window.Sound.win();
    updateStats();
  }

  function updateStats() {
    const m = G.m, lv = G.lv, solved = progress[lv.id] && progress[lv.id].solved;
    const visited = graph.visited.size;
    G.visitedAll = visited >= m.orbit.size;
    const reveal = G.done || solved;
    const rows = [
      ['Group generated, |G|', m.groupOrder + (reveal ? ' — ' + groupName(m) : '')],
      ['States you can reach, |orbit|', m.orbit.size],
      ['Stabiliser of the start', m.stabiliser === 1 ? '1 (trivial)' : m.stabiliser],
      ['All arrangements of these tokens', multinomial(m.start)],
      ['States visited', visited + ' / ' + m.orbit.size],
      ['Distance travelled from start', m.orbit.dist[G.node]],
      ['Where you are (shortest word)', '<i class="m">' + (fmtWord(P.wordTo(m.orbit, G.node).map((g) => lv.gens[g].key)) || 'e') + '</i>' + (G.history.length > m.orbit.dist[G.node] ? ' <span class="muted small">(' + G.history.length + ' presses, same state)</span>' : '')],
      [lv.goal === 'relation' ? 'Shortest relation' : 'Fewest moves to the target', reveal ? (lv.goal === 'relation' ? m.par + ': ' + fmtWord(m.relation.map((g) => lv.gens[g].key)) + ' = e' : m.reachable ? m.par : '∞ (unreachable)') : '?'],
    ];
    $('#stats').innerHTML = rows.map(([a, b]) => `<tr${b === '?' ? ' class="hidden-row"' : ''}><td>${a}</td><td>${b}</td></tr>`).join('');
    $('#counter').textContent = G.history.length + (G.history.length === 1 ? ' move' : ' moves');
    $('#undo').disabled = !G.history.length;
  }
  function multinomial(tokens) {
    const c = {}; tokens.forEach((t) => { c[t] = (c[t] || 0) + 1; });
    let r = P.fact(tokens.length); Object.values(c).forEach((k) => { r /= P.fact(k); });
    return r;
  }
  function fmtWord(keys) {
    const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹', parts = [];
    keys.forEach((k) => { const l = parts[parts.length - 1]; if (l && l[0] === k) l[1]++; else parts.push([k, 1]); });
    return parts.map(([k, n]) => k + (n > 1 ? String(n).split('').map((d) => SUP[+d]).join('') : '')).join(' ');
  }
  function updateWord() {
    const keys = G.history.map((h) => G.lv.gens[h.gen].key);
    // compress runs: r r r -> r³
    const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    const sup = (n) => String(n).split('').map((d) => SUP[+d]).join('');
    const parts = [];
    keys.forEach((k) => { const l = parts[parts.length - 1]; if (l && l[0] === k) l[1]++; else parts.push([k, 1]); });
    const w = parts.map(([k, n]) => k + (n > 1 ? sup(n) : '')).join(' ');
    $('#word').innerHTML = keys.length ? 'word so far: <b>' + w + '</b> (read left to right)' : 'Hover a move to see its arrows. Keys: 1–' + G.lv.gens.length + ' or the move letters · Z undo · 0 reset · H hint.';
  }

  /* graph hover: preview the arrangement at that node */
  const tipC = document.createElement('canvas');
  function onGraphHover(i, e) {
    const tip = $('#tip');
    if (!G || i < 0) { tip.style.display = 'none'; return; }
    const m = G.m, s = m.orbit.nodes[i];
    const d = m.orbit.dist[i], dt = m.distTo[i];
    tip.innerHTML = '';
    tip.appendChild(tipC); tipC.style.width = '72px'; tipC.style.height = '72px';
    fit(tipC, 72, 72);
    B.drawBoard(tipC, m, G.paths, { state: s, small: true });
    const word = P.wordTo(m.orbit, i).map((g) => G.lv.gens[g].key).join('') || 'e';
    tip.appendChild(el('div', '', `from start: ${d} · word <i>${word}</i>` + (m.reachable ? `<br>to target: ${dt}` : '')));
    const r = $('#graph').getBoundingClientRect();
    tip.style.display = 'block';
    tip.style.left = Math.min(r.width - 150, e.clientX - r.left + 14) + 'px';
    tip.style.top = (e.clientY - r.top + 10) + 'px';
  }

  /* ---------- loop ---------- */
  function frame(now) {
    if (current === 'play' && G) {
      let anim = null;
      if (G.anim) {
        const t = Math.min(1, (now - G.anim.t0) / 330);
        anim = { gen: G.anim.gen, from: G.anim.from, t };
        if (t >= 1) {
          G.anim = null; anim = null;
          if (!G.done && G.lv.goal === 'relation') { if (!G.queue.length) checkRelation(); }
          else if (!G.done && P.key(G.state) === P.key(G.m.target)) finish({});
          if (!G.done && G.queue.length) press(G.queue.shift());
        }
      }
      B.drawBoard($('#board'), G.m, G.paths, { state: G.state, anim, hoverGen: G.hoverGen, target: G.m.target });
      graph.draw(now);
    } else if (current === 'home' && heroView) {
      heroView.draw(now);
    }
    if (window.Lab && current === 'lab') window.Lab.frame(now);
    requestAnimationFrame(frame);
  }

  /* ---------- routing ---------- */
  let current = '';
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    let view = 'home';
    if (h.startsWith('level/') || h === 'play') view = 'play';
    else if (h === 'lab') view = 'lab';
    else if (h === 'about') view = 'about';
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('on', v.id === view));
    document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('on', a.dataset.nav === (view === 'play' ? 'home' : view)));
    current = view;
    if (view === 'home') renderHome();
    if (view === 'play') startLevel(h === 'play' ? 'custom' : h.slice(6));
    if (view === 'lab') window.Lab.show($('#lab'));
    if (view === 'about') window.Notes.show($('#about'));
    window.scrollTo(0, 0);
  }

  const muteBtn = $('#mute');
  const paintMute = () => { muteBtn.textContent = window.Sound.muted ? '🔇' : '🔊'; muteBtn.title = window.Sound.muted ? 'Sound off' : 'Sound on'; };
  muteBtn.onclick = () => { window.Sound.toggle(); paintMute(); }; paintMute();
  $('#undo').onclick = undo; $('#reset').onclick = reset; $('#hint').onclick = hint; $('#claim').onclick = claim;
  document.addEventListener('keydown', (e) => {
    if (current !== 'play' || !G || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= G.lv.gens.length) { press(n - 1); e.preventDefault(); return; }
    const gk = G.lv.gens.findIndex((g) => g.key === e.key && !/\d/.test(e.key));
    if (gk >= 0) { press(gk); return; }
    if (e.key === 'z' || e.key === 'Backspace') { undo(); e.preventDefault(); }
    else if (e.key === '0' || e.key === 'Escape') reset();
    else if (e.key === 'h') hint();
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', () => { if (current === 'play' && G) { fit($('#board')); fit($('#graph')); } });
  route();
  requestAnimationFrame(frame);
})();
