/* Comet Courier — screens, scene manager, input, main loop. */
(function () {
  'use strict';
  const CC = window.CC;
  const R = CC.render, A = CC.audio, S = CC.store, t = CC.t, pick = CC.pick;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const UNLOCK = [0, 8, 18, 30];  // stars needed to open each world
  let scene = null;               // active scene object (Play | Sandbox | Editor)
  let mode = 'title';             // title | worlds | play | sandbox | editor | daily
  let bg = null;                  // ambient sandbox for menus
  let editor = null;              // kept alive so "Test" can return to it
  let returnTo = 'worlds';
  let current = null;             // current level raw data
  let lastTime = performance.now();
  let globalTime = 0;

  /* ---------- boot ---------- */
  const settings = S.data.settings;
  CC.i18n.set(settings.lang || ((navigator.language || 'en').toLowerCase().startsWith('ko') ? 'ko' : 'en'));
  R.setup($('cv'));
  R.reduce = settings.reduce;
  A.setMusic(settings.music); A.setSfx(settings.sound);
  bg = new CC.Sandbox({ preset: 'solar', ambient: true, silent: true });

  S.onBadge((b) => {
    A.play('badge');
    const el = document.createElement('div');
    el.className = 'badge-pop panel';
    el.innerHTML = `<span class="ic">${b.icon}</span><div><small>${esc(t('unlockedBadge'))}</small><b>${esc(pick(b.name))}</b></div>`;
    $('badges-toast').appendChild(el);
    setTimeout(() => el.classList.add('out'), 3600);
    setTimeout(() => el.remove(), 4100);
  });

  /* ---------- helpers ---------- */
  function hideAll() {
    $('screen').innerHTML = ''; $('hud').hidden = true; $('toolbar').hidden = true; $('card').hidden = true; $('toast').hidden = true;
  }
  function starsHTML(stars) {
    return [0, 1, 2].map((i) => (stars && stars[i] ? '★' : '<span class="off">★</span>')).join('');
  }
  function totalStars() { return S.starCount(); }
  function maxStars() { return CC.LEVELS.length * 3; }
  function worldUnlocked(wi) { return totalStars() >= UNLOCK[wi]; }
  function levelUnlocked(lv) {
    if (!worldUnlocked(lv.world)) return false;
    if (lv.index === 0) return true;
    const prev = CC.WORLDS[lv.world].levels[lv.index - 1];
    return !!S.data.progress[prev.id];
  }
  let toastTimer = null;
  function toast(msg, ms) {
    const el = $('toast');
    el.hidden = false; el.textContent = msg;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms || 1400);
  }
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ---------- title ---------- */
  function showTitle() {
    mode = 'title'; scene = null; hideAll();
    A.setWorld(4);
    if (location.hash.startsWith('#route=')) history.replaceState(null, '', location.pathname + location.search);
    $('screen').innerHTML = `
      <div class="title-wrap">
        <div class="logo-comet">☄️</div>
        <h1 class="logo">${esc(t('title'))}</h1>
        <p class="tagline">${esc(t('tagline'))}</p>
        <div class="menu">
          <button class="primary" data-act="play">📦 ${esc(t('play'))}</button>
          <button data-act="daily">📅 ${esc(t('daily'))}</button>
          <button data-act="sandbox">🪐 ${esc(t('sandbox'))}</button>
          <button data-act="editor">🛠️ ${esc(t('editor'))}</button>
        </div>
        <div class="menu-small">
          <button data-act="how">❓ ${esc(t('howTo'))}</button>
          <button data-act="badges">🏅 ${esc(t('achievements'))} · ${Object.keys(S.data.badges).length}/${S.BADGES.length}</button>
          <button data-act="settings">⚙️ ${esc(t('settings'))}</button>
          <button data-act="lang">${CC.i18n.lang === 'en' ? '한국어' : 'English'}</button>
        </div>
        <div class="star-total">★ ${totalStars()} / ${maxStars()}</div>
        <div class="foot">${esc(t('credits'))}</div>
      </div>`;
    bind($('screen'), {
      play: showWorlds, daily: startDaily, sandbox: startSandbox, editor: () => startEditor(),
      how: showHowTo, badges: showBadges, settings: showSettings,
      lang: () => { settings.lang = CC.i18n.lang === 'en' ? 'ko' : 'en'; CC.i18n.set(settings.lang); S.save(); showTitle(); },
    });
  }

  function bind(root, handlers) {
    root.querySelectorAll('[data-act]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        A.init(); A.play('click');
        const h = handlers[el.dataset.act];
        if (h) h(el.dataset.arg, el);
      });
    });
  }

  /* ---------- world select ---------- */
  function showWorlds() {
    mode = 'worlds'; scene = null; hideAll();
    A.setWorld(4);
    const total = totalStars();
    let html = `<div class="worlds panel"><div class="worlds-head"><button data-act="back">← ${esc(t('back'))}</button><h2>📦 ${esc(t('play'))}</h2><div class="chip">★ ${total} / ${maxStars()}</div></div>`;
    CC.WORLDS.forEach((w, wi) => {
      const open = worldUnlocked(wi);
      const got = w.levels.reduce((n, l) => n + (S.data.progress[l.id] ? S.data.progress[l.id].stars.filter(Boolean).length : 0), 0);
      html += `<div class="world ${open ? '' : 'locked'}" style="--wa:${w.palette.a}">
        <h3>${wi + 1}. ${esc(pick(w.name))} <small>★ ${got}/${w.levels.length * 3}</small></h3>
        <p>${esc(pick(w.blurb))}</p>
        ${open ? '' : `<div class="lock-msg">🔒 ${esc(t('locked', { n: UNLOCK[wi] - total }))}</div>`}
        <div class="levels">`;
      w.levels.forEach((l) => {
        const p = S.data.progress[l.id];
        const ok = levelUnlocked(l);
        html += `<button class="lvl" data-act="level" data-arg="${l.id}" ${ok ? '' : 'disabled'}><b>${l.id}</b><span>${esc(pick(l.name))}</span><i>${starsHTML(p && p.stars)}</i></button>`;
      });
      html += `</div></div>`;
    });
    html += `</div>`;
    $('screen').innerHTML = html;
    bind($('screen'), { back: showTitle, level: (id) => startLevel(CC.levelById(id), 'worlds') });
  }

  /* ---------- play ---------- */
  function startLevel(raw, from, extra) {
    current = raw; returnTo = from || 'worlds';
    hideAll(); mode = 'play';
    R.clearParticles();
    const opts = Object.assign({
      onResult: onResult,
      onLaunch: () => { $('card').hidden = true; updateHud(); fadeHint(); },
      onRetry: () => updateHud(),
    }, extra || {});
    if (raw.palette) opts.palette = raw.palette;
    scene = new CC.Play(raw, opts);
    buildHud();
    showNote(raw);
  }

  function showNote(raw) {
    const card = $('card');
    card.hidden = false;
    const L = scene.L;
    const meta = [];
    if (L.dust.length) meta.push(`✨ ${L.dust.length} ${esc(t('dust'))}`);
    meta.push(`🎯 ${esc(t('par'))} ${L.par}`);
    if (L.bodies.some((b) => b.orbit) || L.goal.orbit) meta.push('⏱ ' + esc(t('clockHint')));
    const stamps = ['🪐', '☄️', '🌙', '⭐', '🌌', '🛰️', '🌍', '🔭'];
    card.innerHTML = `<div class="note clickable">
      <div class="stamp">${stamps[(raw.id || '').length * 7 % stamps.length]}</div>
      <h4>${esc(raw.id && raw.id.startsWith('daily') ? t('daily') : raw.id === 'custom' ? t('customRoute') : t('world') + ' ' + raw.id)}</h4>
      <h2>${esc(pick(raw.name))}</h2>
      <p>${esc(pick(raw.note))}</p>
      <div class="sign">— ${esc(pick(raw.from))}</div>
      <div class="meta">${meta.map((m) => `<span>${m}</span>`).join('')}</div>
      <button class="primary" data-act="go">${esc(t('play2'))} ☄️</button>
    </div>`;
    bind(card, { go: () => { card.hidden = true; } });
  }

  function buildHud() {
    const hud = $('hud');
    hud.hidden = false;
    hud.innerHTML = `
      <div class="hud-top">
        <button class="icon" data-act="menu" title="${esc(t('menu'))}">←</button>
        <div class="hud-title"><b>${esc(pick(current.name))}</b><small>${esc(t('from'))}: ${esc(pick(current.from))}</small></div>
        <div class="chip dust" id="hud-dust"></div>
        <div class="chip" id="hud-att"></div>
        <button class="icon" data-act="note" title="?">✉️</button>
        <button class="icon" data-act="retry" title="${esc(t('retry'))} (R)">↻</button>
        <button class="icon" data-act="mute" id="hud-mute">${settings.sound ? '🔊' : '🔈'}</button>
      </div>
      <div class="hud-bottom" id="hud-hint">${esc(t('aimHint'))}<br><span class="keys">${esc(t('aimHintKeys'))} · ${esc(t('ff'))}</span></div>
      <button class="icon ff-btn" id="ff">⏩</button>`;
    bind(hud, {
      menu: leavePlay,
      retry: () => { scene.retry(); $('card').hidden = true; },
      note: () => showNote(current),
      mute: () => { settings.sound = !settings.sound; settings.music = settings.sound; A.setSfx(settings.sound); A.setMusic(settings.music); S.save(); $('hud-mute').textContent = settings.sound ? '🔊' : '🔈'; },
    });
    const ff = $('ff');
    const on = (e) => { e.preventDefault(); if (scene && scene.ff !== undefined) scene.ff = true; ff.classList.add('on'); };
    const off = () => { if (scene && scene.ff !== undefined) scene.ff = false; ff.classList.remove('on'); };
    ff.addEventListener('pointerdown', on); ff.addEventListener('pointerup', off); ff.addEventListener('pointerleave', off);
    updateHud();
  }
  function fadeHint() { const h = $('hud-hint'); if (h) h.style.opacity = '0.25'; }

  function updateHud() {
    if (mode !== 'play' && mode !== 'daily') return;
    const p = scene;
    const d = $('hud-dust'), a = $('hud-att');
    if (!d) return;
    const total = p.L.dust.length;
    d.hidden = !total;
    d.textContent = `✨ ${p.flight ? p.flight.dustCount : 0}/${total}`;
    a.textContent = `${t('attempts')} ${p.attempts} · ${t('par')} ${p.L.par}`;
  }

  function leavePlay() {
    if (returnTo === 'editor' && editor) return startEditor(editor.lv);
    if (returnTo === 'title') return showTitle();
    showWorlds();
  }

  function onResult(play, res) {
    updateHud();
    if (res.replay) { setTimeout(() => showWin(play, play.lastResult), 600); return; }
    if (!res.won) { toast(rand(t('fail.' + res.reason)), 1300); return; }
    play.lastResult = res;
    const raw = current;
    if (raw.id && raw.id.startsWith('daily')) {
      const k = CC.daily.today();
      const prev = S.data.daily[k] || {};
      S.data.daily[k] = { won: true, attempts: Math.min(prev.attempts || 99, res.attempts), stars: [0, 1, 2].map((i) => (prev.stars && prev.stars[i]) || res.stars[i]) };
      S.save();
      S.award('daily');
      if (CC.daily.streak() >= 3) S.award('streak3');
    } else if (raw.id === 'custom') {
      if (returnTo === 'editor') S.award('creator');
    } else {
      S.recordLevel(raw.id, res.stars, res.attempts, res.time);
      const w = CC.WORLDS[raw.world];
      if (w.levels.every((l) => S.data.progress[l.id])) S.award(['world1', 'world2', 'world3', 'world4'][raw.world]);
      const perfect = Object.values(S.data.progress).filter((p) => p.stars.every(Boolean)).length;
      if (perfect >= 10) S.award('perfect');
      if (totalStars() === maxStars()) S.award('allstars');
    }
    setTimeout(() => showWin(play, res), 900);
  }

  function showWin(play, res) {
    if (scene !== play || !res) return;
    const card = $('card');
    card.hidden = false;
    const isLevel = current.id && !current.id.startsWith('daily') && current.id !== 'custom';
    const idx = isLevel ? CC.LEVELS.indexOf(current) : -1;
    const next = idx >= 0 ? CC.LEVELS[idx + 1] : null;
    const nextOk = next && levelUnlocked(next);
    const items = [t('star1'), t('star2'), t('star3', { n: play.L.par })];
    card.innerHTML = `<div class="win panel">
      <h2>${esc(t('delivered'))}</h2>
      <div class="sub">${esc(rand(t('deliveredSub')))}</div>
      <div class="stars">${[0, 1, 2].map((i) => `<span class="st ${res.stars[i] ? 'got' : ''}">★</span>`).join('')}</div>
      <ul class="star-list">${items.map((s, i) => `<li class="${res.stars[i] ? 'got' : ''}">${esc(s)}</li>`).join('')}</ul>
      <div class="row" style="margin-bottom:10px;color:var(--dim);font-size:13px">${esc(t('attempts'))}: ${res.attempts} · ${esc(t('time'))}: ${res.time.toFixed(1)}s · ✨ ${res.dust}/${res.total}</div>
      <div class="row">
        <button data-act="retry">↻ ${esc(t('retry'))}</button>
        <button data-act="replay">▶ ${esc(t('replay'))}</button>
        ${current.id === 'custom' && returnTo === 'editor' ? `<button data-act="share">🔗 ${esc(t('share'))}</button>` : ''}
        ${nextOk ? `<button class="primary" data-act="next">${esc(t('next'))} →</button>` : `<button class="primary" data-act="menu">${esc(t('menu'))}</button>`}
      </div></div>`;
    // star reveal
    card.querySelectorAll('.st').forEach((el, i) => setTimeout(() => {
      el.classList.add('show');
      if (res.stars[i]) A.play('star', i);
    }, 250 + i * 280));
    bind(card, {
      retry: () => { card.hidden = true; startLevel(current, returnTo); },
      replay: () => { card.hidden = true; const p = scene; p.retry(); p.angle = p.lastWin.angle; p.power = p.lastWin.power; p.dirty = true; p.launch(true); },
      next: () => startLevel(next, returnTo),
      menu: leavePlay,
      share: shareRoute,
    });
  }

  /* ---------- daily ---------- */
  function startDaily() {
    hideAll(); mode = 'daily-loading'; scene = null;
    const k = CC.daily.today();
    const d = S.data.daily[k];
    $('screen').innerHTML = `<div class="title-wrap"><h2>📅 ${esc(t('dailyTitle'))}</h2><p class="tagline">${esc(t('dailySub'))}</p>
      <div class="loading">${esc(t('dailyGenerating'))}</div>
      <p class="tagline">🔥 ${esc(t('streak'))}: ${CC.daily.streak()} ${d && d.won ? ' · ✓' : ''}</p></div>`;
    CC.daily.generate(k, (lv) => {
      if (mode !== 'daily-loading') return;
      lv.palette = { a: '#fbd38d', b: '#90cdf4', bg1: '#120d1f', bg2: '#1f1430' };
      startLevel(lv, 'title');
    });
  }

  /* ---------- sandbox ---------- */
  function startSandbox() {
    hideAll(); mode = 'sandbox'; R.clearParticles();
    A.setWorld(3);
    scene = new CC.Sandbox({ preset: 'solar' });
    buildSandboxBar();
  }
  function buildSandboxBar() {
    const sb = scene;
    const tb = $('toolbar');
    tb.hidden = false;
    const icon = { planet: '🌍', moon: '🌙', giant: '🪐', sun: '☀️', blackhole: '🕳️', repulsor: '💫', comet: '☄️', spray: '✨', erase: '🧽' };
    tb.innerHTML = `
      <div class="tb-top"><button data-act="back">← ${esc(t('back'))}</button><div class="help">${esc(t('sandboxHelp'))}</div></div>
      <div class="tools panel">
        ${CC.SANDBOX_TOOLS.map((k) => `<button data-act="tool" data-arg="${k}" class="${sb.tool === k ? 'on' : ''}">${icon[k]} ${esc(t('tools.' + k))}</button>`).join('')}
      </div>
      <div class="tools panel">
        <button data-act="preset" data-arg="solar">☀️ Solar</button>
        <button data-act="preset" data-arg="binary">♊ Binary</button>
        <button data-act="preset" data-arg="hole">🕳️ Vortex</button>
        <button data-act="preset" data-arg="chaos">🎲 Chaos</button>
        <span class="sep"></span>
        <button data-act="orbit" class="${sb.autoOrbit ? 'on' : ''}">🔄 Auto-orbit</button>
        <button data-act="trails" class="${sb.trails ? 'on' : ''}">〰️ Trails</button>
        <button data-act="pause" class="${sb.paused ? 'on' : ''}">⏸</button>
        <button data-act="clear">🗑️ ${esc(t('clear'))}</button>
      </div>`;
    bind(tb, {
      back: showTitle,
      tool: (k) => { sb.tool = k; buildSandboxBar(); },
      preset: (k) => { sb.preset(k); R.clearParticles(); },
      orbit: () => { sb.autoOrbit = !sb.autoOrbit; buildSandboxBar(); },
      trails: () => { sb.trails = !sb.trails; buildSandboxBar(); },
      pause: () => { sb.paused = !sb.paused; buildSandboxBar(); },
      clear: () => { sb.bodies = []; sb.comets = []; },
    });
  }

  /* ---------- editor ---------- */
  function startEditor(route) {
    hideAll(); mode = 'editor'; R.clearParticles();
    A.setWorld(1);
    if (!editor || route) editor = new CC.Editor(route ? JSON.parse(JSON.stringify(route)) : undefined);
    scene = editor;
    buildEditorBar();
  }
  function buildEditorBar() {
    const ed = editor;
    const tb = $('toolbar');
    tb.hidden = false;
    const icon = { select: '✋', start: '🚀', goal: '✉️', planet: '🌍', giant: '🪐', moon: '🌙', sun: '☀️', repulsor: '💫', blackhole: '🕳️', asteroid: '🪨', dust: '✨', wall: '🧱', worm: '🌀', erase: '🧽' };
    tb.innerHTML = `
      <div class="tb-top">
        <button data-act="back">← ${esc(t('back'))}</button>
        <input class="title-in" id="ed-title" maxlength="40" placeholder="${esc(t('customRoute'))}" value="${esc(ed.lv.title || '')}">
        <div class="help">${esc(t('editorHelp'))}</div>
        <button data-act="check">🔍</button>
        <button data-act="share">🔗 ${esc(t('share'))}</button>
        <button class="primary" data-act="test">▶ ${esc(t('test'))}</button>
      </div>
      <div class="status" id="ed-status">${esc(ed.status || '')}</div>
      <div class="tools panel">
        ${CC.EDITOR_TOOLS.map((k) => `<button data-act="tool" data-arg="${k}" class="${ed.tool === k ? 'on' : ''}">${icon[k]} ${esc(t('tools.' + k))}</button>`).join('')}
      </div>
      <div class="tools panel">
        <button data-act="size" data-arg="-1">◦ size −</button><button data-act="size" data-arg="1">○ size +</button>
        <button data-act="mass" data-arg="-1">pull −</button><button data-act="mass" data-arg="1">pull +</button>
        <span class="sep"></span>
        <button data-act="undo">↶ ${esc(t('undo'))}</button>
        <button data-act="clear">🗑️ ${esc(t('clear'))}</button>
      </div>`;
    const ti = $('ed-title');
    ti.addEventListener('input', () => { ed.lv.title = ti.value; ed.saveDraft(); });
    ti.addEventListener('keydown', (e) => e.stopPropagation());
    bind(tb, {
      back: showTitle,
      tool: (k) => { ed.tool = k; ed.pending = null; buildEditorBar(); },
      size: (d) => ed.adjust('size', +d),
      mass: (d) => ed.adjust('mass', +d),
      undo: () => ed.undo(),
      clear: () => ed.clear(),
      test: () => startLevel(ed.toLevel(), 'editor', { custom: true }),
      share: shareRoute,
      check: () => checkRoute(),
    });
  }
  function setEdStatus(s) { if (editor) editor.status = s; const el = $('ed-status'); if (el) el.textContent = s; }
  function checkRoute() {
    setEdStatus(t('editorSolvable'));
    setTimeout(() => {
      const L = CC.normalizeLevel(editor.toLevel());
      const s = CC.solve(L, { angles: 360, powers: 16, stopOnFull: true });
      setEdStatus(s.win ? `${t('editorOk')} (${((100 * s.wins) / s.tried).toFixed(2)}%)` + (L.dust.length ? (s.full ? ' ✨✓' : ' ✨✗') : '') : t('editorNo'));
    }, 50);
  }
  function shareRoute() {
    const code = CC.route.encode(editor.lv);
    const url = location.origin + location.pathname + '#route=' + code;
    const done = () => { toast(t('copied')); setEdStatus(url.length > 90 ? url.slice(0, 90) + '…' : url); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => setEdStatus(url));
    else setEdStatus(url);
  }

  /* ---------- modals ---------- */
  function modal(html, handlers) {
    const m = $('modal');
    m.hidden = false;
    m.querySelector('.modal-box').className = 'modal-box panel';
    m.querySelector('.modal-box').innerHTML = `<button class="close icon" data-act="close">✕</button>` + html;
    bind(m, Object.assign({ close: closeModal }, handlers || {}));
  }
  function closeModal() { $('modal').hidden = true; }
  $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

  function showHowTo() {
    const lg = [
      ['#7fd3c4', t('tools.planet')], ['#ffd27a', t('tools.sun')], ['#f7fbff', t('tools.repulsor')], ['#000; box-shadow:0 0 0 2px #ffb070', t('tools.blackhole')],
      ['#63b3ed', t('tools.worm')], ['#8a7867', t('tools.asteroid')], ['#fff6c8', t('tools.dust')], ['#4fd1c5', t('tools.goal')],
    ];
    modal(`<div class="how"><h2>❓ ${esc(t('howTo'))}</h2><ol>${t('how').map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <div class="legend">${lg.map(([c, n]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`).join('')}</div>
      <p style="color:var(--dim);font-size:13px">${esc(t('aimHintKeys'))} · ${esc(t('ff'))}</p>
      <button class="primary" data-act="close">${esc(t('play2'))}</button></div>`);
    S.data.seenHowTo = true; S.save();
  }

  function showBadges() {
    const st = S.data.stats;
    const fmt = (k, v) => `<div><b>${v}</b>${k}</div>`;
    modal(`<h2>🏅 ${esc(t('achievements'))}</h2>
      <div class="badge-grid">${S.BADGES.map((b) => `<div class="badge ${S.data.badges[b.id] ? 'got' : ''}"><span class="ic">${b.icon}</span><div><b>${esc(pick(b.name))}</b><small>${esc(pick(b.desc))}</small></div></div>`).join('')}</div>
      <div class="stats">
        ${fmt('🚀 launches', st.launches)}${fmt('📦 deliveries', st.deliveries)}${fmt('💥 crashes', st.crashes)}
        ${fmt('🕳️ swallowed', st.swallowed || 0)}${fmt('🪐 laps', st.orbits)}${fmt('🌀 wormholes', st.worms)}
        ${fmt('⚡ top speed', st.maxSpeed + ' px/s')}${fmt('⏱ airtime', Math.round(st.flightTime) + ' s')}${fmt('✨ stardust', st.dust)}
      </div>`);
  }

  function showSettings() {
    const row = (key, label) => `<div class="setting"><span>${esc(label)}</span><button data-act="toggle" data-arg="${key}" class="${settings[key] ? 'on' : ''}">${esc(settings[key] ? t('on') : t('off'))}</button></div>`;
    modal(`<h2>⚙️ ${esc(t('settings'))}</h2>
      ${row('sound', t('sound'))}${row('music', t('music'))}${row('trails', t('trails'))}${row('reduce', t('reduce'))}
      <div class="setting"><span>${esc(t('lang'))}</span><div class="row"><button data-act="lang" data-arg="en" class="${CC.i18n.lang === 'en' ? 'on' : ''}">English</button><button data-act="lang" data-arg="ko" class="${CC.i18n.lang === 'ko' ? 'on' : ''}">한국어</button></div></div>
      <div class="setting"><span>${esc(t('reset'))}</span><button data-act="reset">⚠️ ${esc(t('reset'))}</button></div>`, {
      toggle: (k) => {
        settings[k] = !settings[k]; S.save();
        A.setSfx(settings.sound); A.setMusic(settings.music); R.reduce = settings.reduce;
        showSettings();
      },
      lang: (l) => { settings.lang = l; CC.i18n.set(l); S.save(); showSettings(); if (mode === 'title') showTitle(); },
      reset: (a, el) => {
        if (el.dataset.armed) { S.reset(); closeModal(); showTitle(); return; }
        el.dataset.armed = '1'; el.textContent = t('resetConfirm'); el.classList.add('on');
      },
    });
  }

  /* ---------- input ---------- */
  const cv = $('cv');
  let activePointer = null;
  cv.addEventListener('pointerdown', (e) => {
    A.init();
    if (!scene || !scene.pointerDown) return;
    if (!$('card').hidden && mode === 'play') {
      // a click on empty space dismisses the note
      if ($('card').querySelector('.note')) $('card').hidden = true; else return;
    }
    activePointer = e.pointerId;
    cv.setPointerCapture(e.pointerId);
    scene.pointerDown(R.toWorld(e.clientX, e.clientY));
  });
  cv.addEventListener('pointermove', (e) => {
    if (activePointer !== e.pointerId || !scene || !scene.pointerMove) return;
    scene.pointerMove(R.toWorld(e.clientX, e.clientY));
  });
  const up = (e) => {
    if (activePointer !== e.pointerId) return;
    activePointer = null;
    if (scene && scene.pointerUp) scene.pointerUp(R.toWorld(e.clientX, e.clientY));
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    A.init();
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape' && !$('modal').hidden) { closeModal(); return; }
    if (mode === 'play' && !$('card').hidden && $('card').querySelector('.note') && (e.key === ' ' || e.key === 'Enter')) { $('card').hidden = true; e.preventDefault(); return; }
    if (scene && scene.key && scene.key(e, true)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { if (scene && scene.key) scene.key(e, false); });

  /* ---------- main loop ---------- */
  const titlePal = { a: '#90cdf4', b: '#fbd38d', bg1: '#060914', bg2: '#0f1428' };
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now; globalTime += dt;
    R.updateParticles(dt);
    let pal = titlePal;
    if (scene) {
      scene.update(dt);
      pal = scene.pal || titlePal;
      R.begin(pal, globalTime, null);
      scene.draw();
    } else {
      bg.update(dt);
      R.begin(pal, globalTime, null);
      R.ctx.globalAlpha = 0.85;
      bg.draw();
      R.ctx.globalAlpha = 1;
    }
    if ((mode === 'play') && scene && scene.flight) updateHudThrottled();
    requestAnimationFrame(loop);
  }
  let hudT = 0;
  function updateHudThrottled() { if (globalTime - hudT > 0.1) { hudT = globalTime; updateHud(); } }

  /* ---------- go ---------- */
  function route() {
    const h = location.hash;
    if (h.startsWith('#route=')) {
      const lv = CC.route.decode(h.slice(7));
      if (lv) {
        editor = new CC.Editor(lv);
        const lvl = editor.toLevel();
        return startLevel(lvl, 'editor', { custom: true });
      }
    }
    if (h === '#sandbox') return startSandbox();
    if (h === '#daily') return startDaily();
    showTitle();
    if (!S.data.seenHowTo) setTimeout(showHowTo, 600);
  }
  route();
  requestAnimationFrame(loop);
  window.CCdebug = { get scene() { return scene; }, startLevel, showWorlds, showTitle, startSandbox, startEditor, startDaily };
})();
