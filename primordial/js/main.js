// Primordial: UI, input and the main loop.
(function () {
  'use strict';
  const PR = window.PR, C = PR.Charts;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  const SIZES = { s: [1600, 1100], m: [2400, 1600], l: [3400, 2200] };
  const JAR_KEY = 'primordial.jar.v1';

  const cv = $('#cv');
  const R = new PR.Renderer(cv);
  let world = null;
  const ui = {
    selected: null, follow: true, tool: 'inspect', brushR: 90, speed: 3, running: true,
    hl: 0, mullerMode: 'abs', treeMin: 10, tab: 'life', brush: null, lastDeathNote: '',
  };
  let mullerL = null, mullerKey = '', treeL = null, treeT = -1;
  let tps = 0, tickCount = 0, tpsT = performance.now();
  let lastHud = 0, lastPanel = 0, lastBrain = 0, lastEvents = -1;

  const fmt = PR.fmt;
  const pct = v => Math.round(v * 100) + '%';
  const dietWord = d => d < 0.2 ? 'grazer' : d < 0.42 ? 'mostly grazes' : d < 0.6 ? 'omnivore' : d < 0.8 ? 'mostly hunts' : 'hunter';
  const dietIcon = d => d < 0.42 ? '🌿' : d < 0.6 ? '🍽️' : '🦷';
  const yearOf = t => world ? Math.floor(t / world.p.seasonLen) + 1 : 1;
  const when = t => `year ${yearOf(t)}`;

  let toastTimer = 0;
  function toast(msg, ms = 2600) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  // ---------------- world lifecycle ----------------
  function measureMargins() {
    const st = $('#stage').getBoundingClientRect();
    const tb = $('#topbar').getBoundingClientRect(), vb = $('#viewbar').getBoundingClientRect(), tl = $('#toolbar').getBoundingClientRect();
    R.margins = { t: tb.bottom - st.top + 6, b: st.bottom - vb.top + 6, l: tl.right - st.left + 6, r: 10 };
  }
  function startWorld(w) {
    world = w;
    ui.selected = null; ui.hl = 0;
    mullerL = null; mullerKey = ''; treeL = null; treeT = -1; lastEvents = -1;
    R.resize(); measureMargins(); R.fit(world); R.fertKey = '';
    $('#seed').value = world.seedName;
    $('#wland').value = world.landscape || 'meadows'; landBlurb();
    syncParams();
    refreshPanel(true);
  }
  function newWorld(seed, size) {
    seed = seed || PR.randomSeedName();
    size = size || $('#wsize').value;
    const [W, H] = SIZES[size] || SIZES.m;
    const params = currentParams();
    const area = (W * H) / (2400 * 1600);
    params.plantCap = Math.round(params.plantCap * area);
    const land = $('#wland').value;
    const w = new PR.World({ seed, W, H, params, landscape: land, founders: 6, perFounder: Math.round(24 * Math.sqrt(area)) });
    startWorld(w);
    try { history.replaceState(null, '', '#seed=' + encodeURIComponent(seed) + '&size=' + size + '&land=' + land); } catch (e) { /* file:// */ }
  }
  function currentParams() {
    if (!world) return Object.assign({}, PR.DEFAULTS);
    const p = Object.assign({}, world.p);
    const area = (world.W * world.H) / (2400 * 1600);
    p.plantCap = Math.round(p.plantCap / area);   // the slider shows plants per standard sea
    return p;
  }

  // ---------------- main loop ----------------
  function frame(now) {
    requestAnimationFrame(frame);
    if (!world) return;
    if (ui.running) {
      if (ui.speed > 0) { for (let i = 0; i < ui.speed; i++) { world.step(); tickCount++; } }
      else { const t0 = performance.now(); do { world.step(); tickCount++; } while (performance.now() - t0 < 14); }
    }
    applyHeldTool();
    const sel = ui.selected;
    if (sel && !sel.alive && ui.lastDeathNote !== sel.id) {
      ui.lastDeathNote = sel.id;
      const why = { starved: 'starved', killed: 'was killed', old: 'died of old age', smitten: 'was smitten', plague: 'died of plague' }[sel.cause] || 'died';
      toast(`#${sel.id} ${why} at age ${fmt(sel.age)}.`);
    }
    if (sel && sel.alive && ui.follow) {
      R.cam.x += (sel.x - R.cam.x) * 0.15; R.cam.y += (sel.y - R.cam.y) * 0.15;
    }
    R.clampCam(world);
    R.draw(world, ui);
    if (now - tpsT > 1000) { tps = tickCount * 1000 / (now - tpsT); tickCount = 0; tpsT = now; }
    if (now - lastHud > 150) { lastHud = now; hud(); }
    if (now - lastPanel > 450) { lastPanel = now; refreshPanel(false); }
    if (ui.tab === 'creature' && now - lastBrain > 90) { lastBrain = now; liveCreature(); }
  }

  function hud() {
    const t = world.t, yr = Math.floor(t / world.p.seasonLen) + 1;
    const ph = (t % world.p.seasonLen) / world.p.seasonLen;
    const seasons = ['spring', 'summer', 'autumn', 'winter'];
    const north = seasons[Math.floor(ph * 4) % 4];
    $('#clk-year').textContent = 'Year ' + yr;
    $('#clk-season').textContent = world.p.seasonAmp > 0.02 ? `${north} in the north` : 'no seasons';
    $('#clk-tick').textContent = 'tick ' + fmt(t);
    $('#st-pop').textContent = world.creatures.length;
    $('#st-sp').textContent = world.phylo.alive;
    let mg = 0; for (const c of world.creatures) if (c.gen > mg) mg = c.gen;
    $('#st-gen').textContent = mg;
    $('#st-tps').textContent = ui.running ? `${fmt(tps)} ticks/s` : 'paused';
    $('#btn-play').textContent = ui.running ? '❚❚' : '▶';
    $('#btn-play').classList.toggle('paused', !ui.running);
  }

  // ---------------- input on the canvas ----------------
  const ptr = { down: false, x: 0, y: 0, sx: 0, sy: 0, moved: false, id: null, camX: 0, camY: 0 };
  const pinch = new Map();
  let pinchD = 0;
  function brushColor(tool) { return { feed: '#8fe36a', fertile: '#9fd3ff', barren: '#d0a070', smite: '#ff5a4a' }[tool] || '#fff'; }

  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    pinch.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pinch.size === 2) { const [a, b] = Array.from(pinch.values()); pinchD = Math.hypot(a[0] - b[0], a[1] - b[1]); return; }
    Object.assign(ptr, { down: true, x: e.offsetX, y: e.offsetY, sx: e.offsetX, sy: e.offsetY, moved: false, id: e.pointerId, camX: R.cam.x, camY: R.cam.y, button: e.button });
    if (ui.tool === 'smite' && e.button === 0) doSmite();
  });
  cv.addEventListener('pointermove', e => {
    if (pinch.has(e.pointerId)) pinch.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pinch.size === 2) {
      const [a, b] = Array.from(pinch.values()), d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinchD > 0) R.zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinchD, world);
      pinchD = d; ptr.down = false; return;
    }
    ptr.x = e.offsetX; ptr.y = e.offsetY;
    const [wx, wy] = R.toWorld(e.offsetX, e.offsetY);
    ui.brush = ui.tool !== 'inspect' ? { x: wx, y: wy, r: ui.brushR, color: brushColor(ui.tool) } : null;
    if (ptr.down) {
      if (Math.hypot(e.offsetX - ptr.sx, e.offsetY - ptr.sy) > 4) ptr.moved = true;
      const pan = ui.tool === 'inspect' || ptr.button === 1 || ptr.button === 2;
      if (pan && ptr.moved) {
        R.cam.x = ptr.camX - (e.offsetX - ptr.sx) / R.cam.z;
        R.cam.y = ptr.camY - (e.offsetY - ptr.sy) / R.cam.z;
        if (ui.follow && ui.selected) { ui.follow = false; $('#cr-follow').checked = false; }
        cv.classList.add('dragging');
      }
      if (ui.tool === 'smite' && ptr.button === 0) doSmite();
      hideTip();
    } else hoverTip(e.offsetX, e.offsetY, wx, wy);
  });
  const endPtr = e => {
    pinch.delete(e.pointerId);
    if (pinch.size < 2) pinchD = 0;
    if (!ptr.down || e.pointerId !== ptr.id) return;
    ptr.down = false; cv.classList.remove('dragging');
    if (!ptr.moved && ui.tool === 'inspect' && e.type === 'pointerup') {
      const [wx, wy] = R.toWorld(e.offsetX, e.offsetY);
      const c = world.creatureAt(wx, wy, 8 / R.cam.z);
      select(c);
    }
  };
  cv.addEventListener('pointerup', endPtr);
  cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('pointerleave', () => { ui.brush = null; hideTip(); });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
    R.zoomAt(e.offsetX, e.offsetY, f, world);
  }, { passive: false });

  function applyHeldTool() {
    if (!ptr.down || ptr.button !== 0 || !world) return;
    const [wx, wy] = R.toWorld(ptr.x, ptr.y);
    if (ui.tool === 'feed') world.feed(wx, wy, ui.brushR, Math.max(1, Math.round(ui.brushR / 25)));
    else if (ui.tool === 'fertile') world.paintFertility(wx, wy, ui.brushR, 0.04);
    else if (ui.tool === 'barren') world.paintFertility(wx, wy, ui.brushR, -0.05);
  }
  function doSmite() {
    const [wx, wy] = R.toWorld(ptr.x, ptr.y);
    world.smite(wx, wy, ui.brushR);
  }

  function hoverTip(sx, sy, wx, wy) {
    if (ui.tool !== 'inspect' || !world) return hideTip();
    const c = world.creatureAt(wx, wy, 8 / R.cam.z);
    if (!c) return hideTip();
    const sp = world.phylo.get(c.species);
    const r = cv.getBoundingClientRect();
    showTip(r.left + sx, r.top + sy,
      `<b style="color:${sp.color()}"><i>${esc(sp.name)}</i></b><br>#${c.id} · gen ${c.gen} · ${dietWord(c.ph.diet)}<br>` +
      `energy ${pct(c.energy / c.ph.cap)} · health ${pct(c.health / c.maxHealth)} · age ${fmt(c.age)}`);
  }
  function showTip(x, y, html) {
    const t = $('#tip'); t.innerHTML = html; t.hidden = false;
    const w = t.offsetWidth, h = t.offsetHeight;
    t.style.left = Math.min(window.innerWidth - w - 8, x + 14) + 'px';
    t.style.top = Math.min(window.innerHeight - h - 8, y + 14) + 'px';
  }
  function hideTip() { $('#tip').hidden = true; }

  // ---------------- selection ----------------
  function select(c, opts = {}) {
    ui.selected = c || null;
    if (c) {
      ui.follow = opts.follow !== false; $('#cr-follow').checked = ui.follow;
      if (ui.tab !== 'creature' && !opts.stay) setTab('creature');
      if (opts.zoom && R.cam.z < 1.4) R.cam.z = 1.6;
      ui.lastDeathNote = '';
    }
    refreshPanel(true);
  }
  function selectSpecies(id, opts = {}) {
    ui.hl = ui.hl === id && !opts.force ? 0 : id;
    refreshPanel(true);
  }
  function memberOf(id) {
    let best = null;
    for (const c of world.creatures) if (c.species === id && (!best || c.energy > best.energy)) best = c;
    return best;
  }

  // ---------------- tabs ----------------
  function setTab(name) {
    ui.tab = name;
    $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    $$('.tab').forEach(s => { s.hidden = s.id !== 'tab-' + name; });
    if (name === 'chronicle') $('#tabs [data-tab=chronicle]').classList.remove('ping');
    refreshPanel(true);
  }
  $$('#tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

  function refreshPanel(force) {
    if (!world) return;
    if (world.events.length !== lastEvents && ui.tab !== 'chronicle' && lastEvents >= 0) {
      const last = world.events[world.events.length - 1];
      if (last && last.type !== 'immigrant') $('#tabs [data-tab=chronicle]').classList.add('ping');
    }
    switch (ui.tab) {
      case 'life': lifeTab(force); break;
      case 'tree': treeTab(force); break;
      case 'trends': trendsTab(); break;
      case 'creature': creatureTab(); break;
      case 'chronicle': chronicleTab(force); break;
      default: break;
    }
    if (ui.tab !== 'chronicle') lastEvents = world.events.length;
  }

  // ---------------- species info ----------------
  function speciesAgg() {
    const m = new Map();
    for (const c of world.creatures) {
      let a = m.get(c.species);
      if (!a) { a = { n: 0, diet: 0, r: 0, sight: 0, armor: 0, muscle: 0, gen: 0, kills: 0 }; m.set(c.species, a); }
      a.n++; a.diet += c.ph.diet; a.r += c.ph.adultR; a.sight += c.ph.sightR; a.armor += c.ph.armor; a.muscle += c.ph.muscle; a.gen += c.gen;
    }
    for (const a of m.values()) { a.diet /= a.n; a.r /= a.n; a.sight /= a.n; a.armor /= a.n; a.muscle /= a.n; a.gen /= a.n; }
    return m;
  }
  const spLink = sp => `<a data-sp="${sp.id}"><span class="swatch" style="background:${sp.color()}"></span>${esc(sp.id ? sp.short : 'soup')}</a>`;
  function speciesCard(id, agg) {
    const sp = world.phylo.get(id);
    if (!sp || id === 0) return '';
    const T = PR.T, g = sp.genes;
    const par = world.phylo.get(sp.parent);
    const a = agg.get(id);
    const kids = sp.children.map(k => world.phylo.get(k)).filter(k => k.established || k.count > 0);
    const now = a
      ? `<span>Alive</span><b>${a.n}, ${dietWord(a.diet)}</b><span>Typical body</span><b>radius ${a.r.toFixed(1)} · muscle ${a.muscle.toFixed(2)}</b><span>Defences</span><b>armour ${a.armor.toFixed(2)} · sight ${Math.round(a.sight)}</b>`
      : `<span>Extinct</span><b>${when(sp.died)}, tick ${fmt(sp.died)}</b>`;
    return `<div class="card">
      <button class="close" data-close-card title="Close">✕</button>
      <h3><span class="swatch" style="background:${sp.color()}"></span>${esc(sp.name)}</h3>
      <div class="sub">${sp.immigrant ? 'arrived from elsewhere' : sp.parent === 0 ? 'a founding lineage' : 'descended from ' + spLink(par)} · appeared ${when(sp.born)}</div>
      <div class="kv">
        ${now}
        <span>Peak</span><b>${sp.peak} (${when(sp.peakAt)})</b>
        <span>Ever born</span><b>${fmt(sp.total)}</b>
        <span>Founder</span><b>${dietWord(g[T.diet])}, radius ${(4 + 10 * g[T.size]).toFixed(1)}, muscle ${g[T.speed].toFixed(2)}</b>
        ${kids.length ? `<span>Daughters</span><b class="lineage" style="justify-content:flex-end">${kids.slice(0, 8).map(spLink).join(' ')}${kids.length > 8 ? ' <em>+' + (kids.length - 8) + '</em>' : ''}</b>` : ''}
      </div>
      <div class="btnrow">${a ? `<button class="small" data-follow-sp="${id}">Follow one</button>` : ''}<button class="small" data-close-card>Stop highlighting</button></div>
    </div>`;
  }

  // ---------------- Life tab ----------------
  function lifeTab(force) {
    const key = world.history.length + ':' + world.t + ':' + ui.mullerMode;
    const cm = $('#cv-muller');
    if (force || key !== mullerKey) {
      if (!mullerL || mullerL.n !== world.history.length || force || mullerL.relative !== (ui.mullerMode === 'rel')) mullerL = C.mullerLayout(world, ui.mullerMode === 'rel');
      mullerKey = key;
    }
    C.drawMuller(cm, world, mullerL, ui.hl);
    const agg = speciesAgg();
    $('#species-card').hidden = !ui.hl;
    if (ui.hl) $('#species-card').innerHTML = speciesCard(ui.hl, agg);
    const rows = Array.from(agg.entries()).sort((a, b) => b[1].n - a[1].n);
    const top = rows.slice(0, 14);
    $('#species-list').innerHTML = top.map(([id, a]) => {
      const sp = world.phylo.get(id);
      return `<div class="sprow${ui.hl === id ? ' on' : ''}" data-sp="${id}"><span class="swatch" style="background:${sp.color()}"></span><span class="nm">${esc(sp.name)}</span><span class="dt">${dietIcon(a.diet)} ${dietWord(a.diet)}</span><span class="ct">${a.n}</span></div>`;
    }).join('') + (rows.length > top.length ? `<div class="more">and ${rows.length - top.length} more with a few members each</div>` : '') + (rows.length ? '' : '<div class="more">Nothing lives. New life will drift in.</div>');
    C.drawTraitSpace($('#cv-traits'), world, +$('#ts-x').value, +$('#ts-y').value, ui.hl, ui.selected);
  }
  $$('#seg-muller button').forEach(b => b.addEventListener('click', () => {
    ui.mullerMode = b.dataset.m;
    $$('#seg-muller button').forEach(x => x.classList.toggle('on', x === b));
    refreshPanel(true);
  }));
  {
    const cm = $('#cv-muller');
    cm.addEventListener('mousemove', e => {
      const id = C.mullerHit(mullerL, world, cm.clientWidth, cm.clientHeight, e.offsetX, e.offsetY);
      if (!id) return hideTip();
      const sp = world.phylo.get(id);
      showTip(e.clientX, e.clientY, `<b style="color:${sp.color()}"><i>${esc(sp.name)}</i></b><br>${sp.count ? sp.count + ' alive' : 'extinct'} · peak ${sp.peak}`);
    });
    cm.addEventListener('mouseleave', hideTip);
    cm.addEventListener('click', e => {
      const id = C.mullerHit(mullerL, world, cm.clientWidth, cm.clientHeight, e.offsetX, e.offsetY);
      if (id) selectSpecies(id, { force: true });
    });
  }
  for (const id of ['#ts-x', '#ts-y']) {
    const s = $(id);
    s.innerHTML = PR.TRAITS.map((t, i) => `<option value="${i}">${t.name}</option>`).join('');
    s.addEventListener('change', () => refreshPanel(true));
  }
  $('#ts-x').value = PR.T.diet; $('#ts-y').value = PR.T.size;

  // ---------------- Tree tab ----------------
  function treeTab(force) {
    const ct = $('#cv-tree');
    if (force || !treeL || world.t - treeT > 200) {
      treeL = C.treeLayout(world, ui.treeMin); treeT = world.t;
      ct.style.height = PR.clamp(treeL.nRows * 15 + 36, 160, 640) + 'px';
    }
    C.drawTree(ct, world, treeL, ui.hl);
    const agg = speciesAgg();
    $('#tree-card').innerHTML = ui.hl ? speciesCard(ui.hl, agg) : `<p class="note">${world.phylo.size - 1} species named so far; ${world.phylo.alive} alive. Click a line to learn about that species.</p>`;
  }
  {
    const ct = $('#cv-tree');
    ct.addEventListener('mousemove', e => {
      const id = C.treeHit(treeL, world, e.offsetX, e.offsetY);
      if (!id) return hideTip();
      const sp = world.phylo.get(id);
      showTip(e.clientX, e.clientY, `<b style="color:${sp.color()}"><i>${esc(sp.name)}</i></b><br>${when(sp.born)} – ${sp.count ? 'now, ' + sp.count + ' alive' : when(sp.died)} · peak ${sp.peak}`);
    });
    ct.addEventListener('mouseleave', hideTip);
    ct.addEventListener('click', e => { const id = C.treeHit(treeL, world, e.offsetX, e.offsetY); if (id) selectSpecies(id, { force: true }); });
    $('#tree-min').addEventListener('change', e => { ui.treeMin = +e.target.value; treeL = null; refreshPanel(true); });
  }

  // ---------------- Trends tab ----------------
  const trendCanvases = C.SERIES.map((S, i) => {
    const c = document.createElement('canvas');
    c.className = 'chart trend' + (i === 0 ? ' tall' : '');
    $('#trends').appendChild(c);
    return c;
  });
  function trendsTab() {
    C.SERIES.forEach((S, i) => C.drawTrend(trendCanvases[i], world, S));
    const st = world.stats, rc = world.records;
    const deaths = st.starved + st.killed + st.old + (st.smitten || 0) + (st.plague || 0);
    $('#records').innerHTML = [
      ['Births', fmt(st.births)], ['…of them from mating', `${fmt(st.sexual)} (${pct(st.sexual / Math.max(1, st.births))})`],
      ['Deaths', fmt(deaths)], ['…starved', fmt(st.starved)], ['…killed', fmt(st.killed)], ['…of old age', fmt(st.old)],
      ['Species named', fmt(world.phylo.size - 1)], ['Most at once', `${rc.pop} creatures, ${rc.species} species`],
      ['Deepest generation', fmt(rc.gen)], ['Energy eaten as plants', fmt(st.plantE)], ['…as meat', fmt(st.meatE)], ['Immigrations', fmt(st.immigrants)],
    ].map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
  }

  // ---------------- Creature tab ----------------
  function creatureTab() {
    const c = ui.selected;
    $('#cr-empty').hidden = !!c; $('#cr-body').hidden = !c;
    if (!c) return;
    const sp = world.phylo.get(c.species);
    $('#cr-swatch').style.background = sp.color();
    $('#cr-name').innerHTML = esc(sp.name);
    const dead = !c.alive ? ` · <span style="color:#ff9b85">${{ starved: 'starved', killed: 'killed', old: 'died of old age', smitten: 'smitten', plague: 'plague' }[c.cause] || 'dead'}</span>` : '';
    $('#cr-sub').innerHTML = `#${c.id} · generation ${c.gen} · ${dietWord(c.ph.diet)}${dead}`;
    const ph = c.ph;
    const parents = c.parents.length === 2 ? 'two parents (mated)' : c.parents.length ? 'budded from one parent' : 'founder';
    $('#cr-stats').innerHTML = [
      ['Born', `${when(c.born)}, tick ${fmt(c.born)}`], ['Origin', parents], ['Children', c.kids], ['Kills', c.kills],
      ['Eaten as plants', fmt(c.plantE)], ['Eaten as meat', fmt(c.meatE)], ['Swum', fmt(c.dist) + ' units'],
      ['Body', `radius ${c.r.toFixed(1)} of ${ph.adultR.toFixed(1)}, mass ${c.mass.toFixed(2)}`],
      ['Digests', `plants ${pct(ph.plantEff)} · meat ${pct(ph.meatEff * 1.35)}`],
      ['Brain', `${c.genome.nnz} connections`],
    ].map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
    const T = PR.T, g = c.genome.genes, fg = sp.genes;
    const show = {
      size: () => 'r ' + ph.adultR.toFixed(1), speed: () => g[T.speed].toFixed(2), diet: () => g[T.diet].toFixed(2),
      sight: () => Math.round(ph.sightR) + ' u', fov: () => Math.round(ph.fov * 180 / Math.PI) + '°', armor: () => g[T.armor].toFixed(2),
      invest: () => pct(ph.invest), mature: () => fmt(ph.matureAge) + ' t', clock: () => ph.clockFreq.toFixed(3),
      hue: () => `<span class="swatch" style="background:hsl(${ph.hue},60%,55%)"></span>`, mut: () => (ph.mutRate * 100).toFixed(2) + '%',
    };
    $('#cr-genes').innerHTML = PR.TRAITS.map((t, i) => `<div class="gene" title="${esc(t.desc)}"><span>${t.name}</span><div class="track">${fg ? `<u style="left:${fg[i] * 100}%" title="species founder"></u>` : ''}<i style="left:${g[i] * 100}%"></i></div><b>${show[t.key]()}</b></div>`).join('');
    $('#cr-lineage').innerHTML = world.phylo.lineage(c.species).reverse().map(spLink).join(' <em>›</em> ');
    liveCreature();
  }
  function liveCreature() {
    const c = ui.selected;
    if (!c || ui.tab !== 'creature') return;
    const ph = c.ph;
    const set = (id, frac, txt) => { $('#' + id).style.width = (PR.clamp(frac, 0, 1) * 100).toFixed(1) + '%'; $('#' + id + '-v').textContent = txt; };
    set('cr-energy', c.energy / ph.cap, `${Math.max(0, c.energy).toFixed(0)} / ${ph.cap.toFixed(0)}`);
    set('cr-health', c.health / c.maxHealth, pct(Math.max(0, c.health) / c.maxHealth));
    set('cr-age', c.age / ph.maxAge, `${fmt(c.age)}`);
    $('#cr-doing').textContent = doing(c);
    C.drawBrain($('#cv-brain'), c);
  }
  // A plain reading of what the creature's senses and outputs add up to right now.
  function doing(c) {
    if (!c.alive) return '';
    const o = c.out, x = c.inp, N = PR.NCH, ph = c.ph;
    let bodyAhead = 0, food = 0;
    for (let s = 1; s <= 3; s++) bodyAhead = Math.max(bodyAhead, x[s * N + 2]);
    for (let s = 0; s < PR.NS; s++) food = Math.max(food, ph.plantEff > 0.3 ? x[s * N] : 0, ph.meatEff > 0.3 ? x[s * N + 1] : 0);
    if (c.biting) return 'Biting something';
    if (c.pain > c.maxHealth * 0.05 && o[0] > 0.3) return 'Hurt, and fleeing';
    if (c.ate) return c.ateKind === 1 ? 'Eating carrion' : 'Grazing';
    if (o[2] > 0 && bodyAhead > 0.3) return 'Closing in for a bite';
    if (o[3] > 0 && c.age >= ph.matureAge && c.cooldown <= 0 && c.energy >= ph.cap * 0.4) return 'Ready to breed';
    if (c.age < ph.matureAge && c.energy > ph.cap * 0.8) return 'Growing up';
    if (x[PR.IN.wall] > 0.5) return 'Turning away from the edge';
    if (food > 0.2 && o[0] > 0.2) return 'Heading for food';
    if (Math.abs(o[0]) < 0.12) return 'Drifting';
    return 'Searching';
  }
  $('#cr-follow').addEventListener('change', e => { ui.follow = e.target.checked; });
  $('#cr-parent').addEventListener('click', () => {
    const c = ui.selected; if (!c) return;
    const p = world.creatures.find(o => c.parents.includes(o.id));
    if (p) select(p); else toast(c.parents.length ? 'Its parents are no longer alive.' : 'This one was a founder.');
  });
  $('#cr-child').addEventListener('click', () => {
    const c = ui.selected; if (!c) return;
    const k = world.creatures.filter(o => o.parents.includes(c.id));
    if (k.length) select(k[Math.floor(Math.random() * k.length)]); else toast('No living children.');
  });
  $('#cr-kill').addEventListener('click', () => {
    const c = ui.selected; if (!c || !c.alive) return;
    world.smite(c.x, c.y, 0.01);
  });
  $('#cr-jar').addEventListener('click', () => {
    const c = ui.selected; if (!c) return;
    const sp = world.phylo.get(c.species);
    const jar = loadJar();
    jar.unshift({ name: sp.name, hue: c.ph.hue, diet: c.ph.diet, gen: c.gen, from: world.seedName, t: world.t, g: c.genome.toJSON() });
    if (jar.length > 30) jar.length = 30;
    saveJar(jar); renderJar();
    toast(`A specimen of ${sp.name} is in the jar (World tab).`);
  });
  const pickBy = fn => { const pool = world.creatures.filter(fn); if (pool.length) select(pool[Math.floor(Math.random() * pool.length)], { zoom: true }); else toast('Nobody fits that description right now.'); };
  $('#btn-random').addEventListener('click', () => pickBy(() => true));
  $('#btn-random-hunter').addEventListener('click', () => pickBy(c => c.ph.diet > 0.6));
  $('#btn-oldest').addEventListener('click', () => { let b = null; for (const c of world.creatures) if (!b || c.age > b.age) b = c; if (b) select(b, { zoom: true }); });

  // ---------------- Chronicle ----------------
  function chronicleTab(force) {
    if (!force && world.events.length === lastEvents && lastEvents >= 0) return;
    lastEvents = world.events.length;
    const on = {}; $$('#ev-filter input').forEach(i => { on[i.dataset.ev] = i.checked; });
    const evs = world.events.filter(e => e.type === 'species' ? on.species : e.type === 'extinct' ? on.extinct : on.other);
    $('#events').innerHTML = evs.slice().reverse().map(e => {
      let text = esc(e.text);
      if (e.sp) { const sp = world.phylo.get(e.sp); if (sp) text = text.replace(esc(sp.name), `<a data-sp="${sp.id}" style="color:${sp.color()}"><i>${esc(sp.name)}</i></a>`); }
      return `<li class="${e.type}"><time>yr ${yearOf(e.t)}<br>${fmt(e.t)}</time><span>${text}</span></li>`;
    }).join('') || '<li><span class="dim">Nothing yet.</span></li>';
  }
  $$('#ev-filter input').forEach(i => i.addEventListener('change', () => chronicleTab(true)));

  // Clicks on species links anywhere in the panel.
  $('#panel').addEventListener('click', e => {
    const close = e.target.closest('[data-close-card]');
    if (close) { ui.hl = 0; refreshPanel(true); return; }
    const f = e.target.closest('[data-follow-sp]');
    if (f) { const m = memberOf(+f.dataset.followSp); if (m) select(m, { zoom: true }); return; }
    const a = e.target.closest('[data-sp]');
    if (a) {
      const id = +a.dataset.sp;
      if (!id) return;
      if (ui.tab === 'chronicle' || ui.tab === 'creature') { ui.hl = id; setTab('life'); }
      else selectSpecies(id, { force: a.tagName === 'A' });
    }
  });

  // ---------------- World tab ----------------
  function buildParams() {
    const box = $('#params');
    box.innerHTML = Object.entries(PR.PARAM_INFO).map(([k, info]) =>
      `<label class="slider"><span>${info.label}</span><output id="o-${k}"></output><input type="range" id="p-${k}" min="${info.min}" max="${info.max}" step="${info.step}"></label>`).join('');
    for (const k of Object.keys(PR.PARAM_INFO)) {
      $('#p-' + k).addEventListener('input', e => {
        let v = +e.target.value;
        if (k === 'plantCap') v = Math.round(v * world.W * world.H / (2400 * 1600));
        world.p[k] = v;
        showParam(k);
        if (k === 'seasonAmp') R.fertKey = '';
      });
    }
    $('#p-sexual').addEventListener('change', e => { world.p.sexual = e.target.checked; });
  }
  function showParam(k) {
    let v = world.p[k];
    if (k === 'plantCap') v = Math.round(v / (world.W * world.H / (2400 * 1600)));
    const o = $('#o-' + k);
    o.textContent = k === 'seasonLen' || k === 'plantCap' || k === 'minPop' ? fmt(v) : k === 'plantGrowth' ? v.toFixed(3) : (+v).toFixed(2);
    return v;
  }
  function syncParams() {
    for (const k of Object.keys(PR.PARAM_INFO)) $('#p-' + k).value = showParam(k);
    $('#p-sexual').checked = !!world.p.sexual;
  }
  $('#btn-reset-params').addEventListener('click', () => {
    const area = world.W * world.H / (2400 * 1600);
    Object.assign(world.p, PR.DEFAULTS); world.p.plantCap = Math.round(PR.DEFAULTS.plantCap * area);
    syncParams(); R.fertKey = ''; toast('Default rules restored.');
  });
  $('#btn-new').addEventListener('click', () => newWorld($('#seed').value.trim() || PR.randomSeedName(), $('#wsize').value));
  $('#btn-dice').addEventListener('click', () => { $('#seed').value = PR.randomSeedName(); });
  $('#seed').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-new').click(); });

  $('#btn-immigrate').addEventListener('click', () => { world.immigrate(); toast('A new lineage drifts in.'); });
  $('#btn-plague').addEventListener('click', () => {
    const agg = speciesAgg(); let best = 0, bn = 0;
    for (const [id, a] of agg) if (a.n > bn) { bn = a.n; best = id; }
    if (!best) return;
    const n = world.cull(c => c.species === best && world.rng.chance(0.5), 'plague');
    world.log('crash', `A plague strikes ${world.phylo.get(best).name}: ${n} die.`, best);
    toast(`Plague: ${n} of ${bn} ${world.phylo.get(best).name} die.`);
  });
  $('#btn-bloom').addEventListener('click', () => {
    let n = 0;
    for (let k = 0; k < 40000 && n < 2500; k++) {
      const x = world.rng.next() * world.W, y = world.rng.next() * world.H;
      if (world.rng.next() < world.baseFert(x, y) && world.addFood(x, y, world.p.plantMax, 0) >= 0) n++;
    }
    world.log('milestone', `An algal bloom: ${n} new plants.`); toast(`Algal bloom: ${n} plants.`);
  });
  $('#btn-winter').addEventListener('click', () => {
    let n = 0;
    for (let i = 0; i < world.nf; i++) if (world.fk[i] === 0 && world.rng.chance(0.85)) { world.fe[i] = 0; n++; }
    world.compactFood();
    world.log('crash', `A hard winter kills ${n} plants.`); toast(`Hard winter: ${n} plants die.`);
  });

  // Specimen jar
  function loadJar() { try { return JSON.parse(localStorage.getItem(JAR_KEY) || '[]'); } catch (e) { return []; } }
  function saveJar(j) { try { localStorage.setItem(JAR_KEY, JSON.stringify(j)); } catch (e) { toast('Could not save the jar in this browser.'); } }
  function renderJar() {
    const jar = loadJar();
    $('#jar').innerHTML = jar.length ? jar.map((s, i) => `<div class="jaritem"><span class="swatch" style="background:hsl(${s.hue},60%,55%)"></span>
      <span class="nm">${esc(s.name)}<small>${dietWord(s.diet)} · gen ${s.gen} · from ${esc(s.from)}</small></span>
      <button class="small" data-release="${i}" title="Release six at the centre of the view">Release</button><button class="small" data-drop="${i}" title="Remove">✕</button></div>`).join('')
      : '<p class="note">Empty. Select a creature and press “Save to jar”.</p>';
  }
  $('#jar').addEventListener('click', e => {
    const r = e.target.closest('[data-release]'), d = e.target.closest('[data-drop]');
    const jar = loadJar();
    if (r) {
      const s = jar[+r.dataset.release];
      try {
        const sp = world.release(PR.Genome.fromJSON(s.g), R.cam.x, R.cam.y, 6, `A specimen of ${s.name}`);
        toast(`Released as ${sp.name}.`);
      } catch (err) { toast('That specimen could not be read.'); }
    } else if (d) { jar.splice(+d.dataset.drop, 1); saveJar(jar); renderJar(); }
  });

  // Save / load / picture
  function download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  $('#btn-save').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(world)], { type: 'application/json' });
    download(`primordial-${world.seedName}-t${world.t}.json`, blob);
  });
  $('#btn-load').addEventListener('click', () => $('#file').click());
  $('#file').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const w = PR.World.fromJSON(JSON.parse(await f.text()));
      startWorld(w);
      toast(`Loaded ${w.seedName}, ${when(w.t)}.`);
    } catch (err) { toast('Could not load that file: ' + err.message, 4000); }
    e.target.value = '';
  });
  $('#btn-shot').addEventListener('click', () => cv.toBlob(b => download(`primordial-${world.seedName}-t${world.t}.png`, b)));

  // ---------------- top and view bars ----------------
  $('#btn-play').addEventListener('click', () => { ui.running = !ui.running; hud(); });
  $('#btn-step').addEventListener('click', () => { ui.running = false; world.step(); hud(); });
  function setSpeed(s) {
    ui.speed = s; ui.running = true;
    $$('#seg-speed button').forEach(b => b.classList.toggle('on', +b.dataset.speed === s));
  }
  $$('#seg-speed button').forEach(b => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
  function setTool(t) {
    ui.tool = t;
    $$('#toolbar button').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
    cv.classList.toggle('tool', t !== 'inspect');
    if (t === 'inspect') ui.brush = null;
  }
  $$('#toolbar button').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $('#brush').addEventListener('input', e => { ui.brushR = +e.target.value; });
  $('#colorby').addEventListener('change', e => { R.opts.colorBy = e.target.value; });
  $('#opt-vision').addEventListener('change', e => { R.opts.vision = e.target.checked; });
  $('#opt-trails').addEventListener('change', e => { R.opts.trails = e.target.checked; });
  $('#opt-fert').addEventListener('change', e => { R.opts.fertility = e.target.checked; });
  $('#btn-fit').addEventListener('click', () => { ui.follow = false; $('#cr-follow').checked = false; R.fit(world); });
  $('#btn-about').addEventListener('click', () => { $('#welcome').hidden = false; });
  $('#btn-welcome').addEventListener('click', () => { $('#welcome').hidden = true; try { localStorage.setItem('primordial.welcomed', '1'); } catch (e) { /* ignore */ } });

  window.addEventListener('keydown', e => {
    if (e.target.matches('input:not([type=range]):not([type=checkbox]), select, textarea')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === ' ') { e.preventDefault(); ui.running = !ui.running; hud(); }
    else if (k === '.') { ui.running = false; world.step(); hud(); }
    else if (k >= '1' && k <= '5') setSpeed([1, 3, 8, 20, 0][+k - 1]);
    else if (k === 'q' || k === 'Q') setTool('inspect');
    else if (k === 'w' || k === 'W') setTool('feed');
    else if (k === 'e' || k === 'E') setTool('fertile');
    else if (k === 'r' || k === 'R') setTool('barren');
    else if (k === 'x' || k === 'X') setTool('smite');
    else if (k === 'f' || k === 'F') { ui.follow = !ui.follow; $('#cr-follow').checked = ui.follow; }
    else if (k === 'Escape') { select(null); ui.hl = 0; refreshPanel(true); }
    else if (k === '0') $('#btn-fit').click();
    else if (k === '[' || k === ']') { ui.brushR = PR.clamp(ui.brushR * (k === ']' ? 1.2 : 1 / 1.2), 20, 300); $('#brush').value = ui.brushR; }
    else return;
  });

  window.addEventListener('resize', () => { R.resize(); measureMargins(); refreshPanel(true); });

  // ---------------- boot ----------------
  $('#wland').innerHTML = Object.entries(PR.LANDSCAPES).map(([k, l]) => `<option value="${k}">${l.name}</option>`).join('');
  function landBlurb() { $('#wland-blurb').textContent = PR.LANDSCAPES[$('#wland').value].blurb; }
  $('#wland').addEventListener('change', landBlurb);
  buildParams();
  renderJar();
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get('size') && SIZES[hash.get('size')]) $('#wsize').value = hash.get('size');
  if (hash.get('land') && PR.LANDSCAPES[hash.get('land')]) $('#wland').value = hash.get('land');
  newWorld(hash.get('seed') || PR.randomSeedName(), $('#wsize').value);
  try { if (!localStorage.getItem('primordial.welcomed')) $('#welcome').hidden = false; } catch (e) { $('#welcome').hidden = false; }
  requestAnimationFrame(frame);
})();
