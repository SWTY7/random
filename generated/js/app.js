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
  const graph = new window.GraphView($('#graph'), { onHover: onGraphHover });

  function startLevel(id) {
    const lv = LEVELS.find((l) => l.id === id);
    if (!lv) { location.hash = '#/'; return; }
    const m = modelOf(lv);
    G = {
      lv, m, paths: B.makePaths(lv, lv.pos, m.gens),
      state: m.start.slice(), node: 0, history: [], presses: 0, hints: 0, falseClaims: 0,
      anim: null, queue: [], done: false, hoverGen: null, hintGen: null,
    };
    $('.lvl-id').textContent = lv.id;
    $('.lvl-title').textContent = lv.title;
    $('#intro').innerHTML = lv.intro;
    $('#outcome').innerHTML = '';
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
    const h = G.history.pop();
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
  function say(html) { $('#outcome').innerHTML = html; }

  function claim() {
    if (!G || G.done) return;
    const m = G.m;
    if (m.reachable) {
      G.falseClaims++;
      say(`<div class="outcome bad"><div class="big">Actually, it can be done.</div><p>The target is in the orbit: it can be reached in ${m.par} move${m.par === 1 ? '' : 's'}. Keep looking, because the graph on the right contains it (the gold ring).</p></div>`);
      return;
    }
    const exhausted = G.visitedAll;
    finish({ claimed: true, exhausted });
  }

  function finish(info) {
    G.done = true;
    const lv = G.lv, m = G.m;
    let stars, list;
    if (lv.impossible) {
      const s2 = G.hints === 0, s3 = !info.exhausted;
      stars = 1 + (s2 ? 1 : 0) + (s3 ? 1 : 0);
      list = [['Correct: unreachable', true], ['No hints', s2], ['Proof, not exhaustion (did not visit every state)', s3]];
    } else {
      const moves = G.history.length;
      const s2 = moves === m.par, s3 = G.hints === 0 && G.falseClaims === 0;
      stars = 1 + (s2 ? 1 : 0) + (s3 ? 1 : 0);
      list = [['Reached the target', true], [`Fewest moves (${moves} / ${m.par})`, s2], ['No hints or false claims', s3]];
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
      <button onclick="location.hash='#/'">All puzzles</button></div></div>`);
    $('#board').classList.remove('won'); void $('#board').offsetWidth; $('#board').classList.add('won');
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
      ['Fewest moves to the target', reveal ? (m.reachable ? m.par : '∞ (unreachable)') : '?'],
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
          if (!G.done && P.key(G.state) === P.key(G.m.target)) finish({});
          else if (G.queue.length) press(G.queue.shift());
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
    if (h.startsWith('level/')) view = 'play';
    else if (h === 'lab') view = 'lab';
    else if (h === 'about') view = 'about';
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('on', v.id === view));
    document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('on', a.dataset.nav === (view === 'play' ? 'home' : view)));
    current = view;
    if (view === 'home') renderHome();
    if (view === 'play') startLevel(h.slice(6));
    if (view === 'lab') window.Lab.show($('#lab'));
    if (view === 'about') window.Notes.show($('#about'));
    window.scrollTo(0, 0);
  }

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
