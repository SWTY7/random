// Watershed: UI, input and the main loop.
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const cv = $('#cv'), ctx = cv.getContext('2d');
  const stage = $('#stage');

  const DEFAULTS = { erosion: 0.3, deposition: 0.3, capacity: 4, evaporation: 0.015, inertia: 0.05, thermal: 0.15, uplift: 0 };
  const params = Object.assign({ minCap: 0.01, gravity: 4, maxLife: 80, rainMode: 'uniform' }, DEFAULTS);

  const state = {
    preset: 'highlands', seed: '', n: 384,
    running: true, tool: 'rain', brush: 14, strength: 0.5,
    view: 'natural', mode: '2d', rivers: true, contours: false, before: false,
    riverV: 55, rainV: 46, vex: 1, orbit: true,
  };
  const cam = { yaw: 0.75, elev: 0.5, dist: 0.95 };

  let world = null;
  const off = document.createElement('canvas'), offCtx = off.getContext('2d');
  let img = null, buf = null;
  const voxel = new WS.Voxel();

  let dirtyPaint = true, sinceHydro = 0, hydroMs = 20, frameNo = 0;
  let undoH = null, undoO = null;
  let pointer = { over: false, down: false, x: 0, y: 0, mx: 0, my: 0, id: null, lastX: 0, lastY: 0, button: 0 };
  let flattenTo = 0;
  let mapRect = { x: 0, y: 0, s: 1 };
  let dpr = 1, cssW = 1, cssH = 1;
  let lastDropCount = 0, dropRate = 0, lastRateT = performance.now();

  // ---------- helpers ----------
  const fmt = v => v >= 1e9 ? (v / 1e9).toFixed(2) + ' B' : v >= 1e6 ? (v / 1e6).toFixed(2) + ' M' : v >= 1e4 ? (v / 1e3).toFixed(1) + ' k' : Math.round(v).toLocaleString();
  const cellM = () => WS.MAP_KM * 1000 / state.n;
  const cellKm2 = () => (WS.MAP_KM / state.n) ** 2;
  const volKm3 = units => units * cellM() * cellM() * WS.HEIGHT_M / 1e9;
  const rainPerFrame = () => state.rainV <= 0 ? 0 : Math.round(8 * Math.pow(10, state.rainV / 38));
  const riverThr = () => Math.pow(10, -4.6 + state.riverV / 100 * 3.2);

  let toastTimer = 0;
  function toast(msg, ms = 2200) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  // ---------- land ----------
  function newLand(opts = {}) {
    Object.assign(state, opts);
    if (!state.seed) state.seed = WS.randomSeedName();
    const n = state.n;
    if (!world || world.n !== n) {
      world = new WS.World(n);
      off.width = n; off.height = n;
      img = offCtx.createImageData(n, n);
      buf = new Uint32Array(img.data.buffer);
    }
    world.p = params;
    const g = WS.generate(state.preset, WS.hashSeed(state.seed), n);
    world.load(g.h, g.sea);
    undoH = undoO = null;
    syncLandUI();
    writeHash();
    dirtyPaint = true;
  }

  function syncLandUI() {
    $('#preset').value = state.preset;
    $('#seed').value = state.seed;
    $('#size').value = String(state.n);
    $('#preset-blurb').textContent = WS.PRESETS[state.preset].blurb;
    const s = $('#s-sea'); s.value = world.sea; showOut(s);
  }

  function writeHash() {
    const h = `#t=${state.preset}&s=${encodeURIComponent(state.seed)}&n=${state.n}`;
    try { history.replaceState(null, '', h); } catch (e) { /* sandboxed frames */ }
  }
  function readHash() {
    const q = new URLSearchParams(location.hash.slice(1));
    const t = q.get('t'), s = q.get('s'), n = parseInt(q.get('n'), 10);
    if (t && WS.PRESETS[t]) state.preset = t;
    if (s) state.seed = s.slice(0, 60);
    if ([256, 384, 512].includes(n)) state.n = n;
  }

  // ---------- controls ----------
  function showOut(input) {
    const o = input.parentElement.querySelector('output');
    if (!o) return;
    const v = parseFloat(input.value);
    switch (input.id || input.dataset.p) {
      case 's-rain': {
        const r = rainPerFrame();
        o.textContent = r === 0 ? 'dry' : (r < 60 ? 'drizzle' : r < 250 ? 'steady' : r < 900 ? 'heavy' : 'downpour') + ` · ${fmt(r * 60)}/s`;
        break;
      }
      case 's-sea': { const d = world ? Math.round((v - world.sea0) * WS.HEIGHT_M) : 0; o.textContent = d === 0 ? 'as raised' : d > 0 ? `${d} m higher` : `${-d} m lower`; break; }
      case 's-brush': o.textContent = `${(v * 2 * WS.MAP_KM / 384).toFixed(1)} km`; break;
      case 's-strength': o.textContent = Math.round(v * 100) + '%'; break;
      case 's-thr': o.textContent = `${(riverThr() * WS.MAP_KM * WS.MAP_KM).toFixed(1)} km² basin`; break;
      case 's-vex': o.textContent = `× ${v.toFixed(2)}`; break;
      case 'uplift': case 'thermal': o.textContent = v === 0 ? 'off' : Math.round(v * 100) + '%'; break;
      default: o.textContent = v.toFixed(v < 0.1 ? 3 : 2);
    }
  }

  function bindControls() {
    const sel = $('#preset');
    for (const [k, p] of Object.entries(WS.PRESETS)) { const o = document.createElement('option'); o.value = k; o.textContent = p.name; sel.appendChild(o); }
    sel.onchange = () => newLand({ preset: sel.value, seed: WS.randomSeedName() });
    $('#size').onchange = e => newLand({ n: parseInt(e.target.value, 10) });
    $('#btn-dice').onclick = () => newLand({ seed: WS.randomSeedName() });
    $('#seed').onchange = e => newLand({ seed: e.target.value.trim() || WS.randomSeedName() });
    $('#btn-gen').onclick = () => newLand({ seed: $('#seed').value.trim() || WS.randomSeedName() });

    const rain = $('#s-rain'); rain.value = state.rainV;
    rain.oninput = () => { state.rainV = +rain.value; showOut(rain); };
    $('#rainmode').onchange = e => { params.rainMode = e.target.value; };
    const sea = $('#s-sea');
    sea.oninput = () => { world.sea = +sea.value; showOut(sea); world.hydrology(); dirtyPaint = true; };

    for (const inp of $$('input[data-p]')) {
      inp.value = params[inp.dataset.p];
      inp.oninput = () => { params[inp.dataset.p] = +inp.value; showOut(inp); };
    }
    $('#btn-defaults').onclick = () => {
      Object.assign(params, DEFAULTS);
      for (const inp of $$('input[data-p]')) { inp.value = params[inp.dataset.p]; showOut(inp); }
      toast('Geology back to defaults');
    };

    for (const b of $$('#tools button')) b.onclick = () => setTool(b.dataset.tool);
    const br = $('#s-brush'); br.oninput = () => { state.brush = +br.value; showOut(br); };
    const st = $('#s-strength'); st.oninput = () => { state.strength = +st.value; showOut(st); };
    $('#btn-undo').onclick = undo;
    $('#btn-clear-springs').onclick = () => { world.springs = []; dirtyPaint = true; toast('Springs removed'); };

    const cr = $('#c-rivers'); cr.onchange = () => { state.rivers = cr.checked; dirtyPaint = true; };
    const cc = $('#c-contours'); cc.onchange = () => { state.contours = cc.checked; dirtyPaint = true; };
    const thr = $('#s-thr'); thr.value = state.riverV; thr.oninput = () => { state.riverV = +thr.value; showOut(thr); dirtyPaint = true; };
    const vex = $('#s-vex'); vex.oninput = () => { state.vex = +vex.value; showOut(vex); dirtyPaint = true; };
    const orb = $('#c-orbit'); orb.onchange = () => { state.orbit = orb.checked; };

    for (const b of $$('#seg-mode button')) b.onclick = () => setMode(b.dataset.mode);
    for (const b of $$('#seg-view button')) b.onclick = () => setView(b.dataset.view);

    const bb = $('#btn-before');
    const setBefore = v => { state.before = v; bb.classList.toggle('on', v); dirtyPaint = true; };
    bb.addEventListener('pointerdown', e => { e.preventDefault(); setBefore(true); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) bb.addEventListener(ev, () => setBefore(false));
    WS._setBefore = setBefore;

    $('#btn-play').onclick = togglePlay;
    $('#btn-reset').onclick = () => {
      undoH = Float32Array.from(world.h); undoO = Float32Array.from(world.orig);
      world.load(world.orig, world.sea); syncLandUI(); dirtyPaint = true; toast('Back to the start. Ctrl+Z brings the erosion back.');
    };
    $('#btn-png').onclick = savePNG;
    $('#btn-link').onclick = copyLink;
    $('#btn-sound').onclick = () => {
      const on = WS.audio.toggle();
      $('#btn-sound').textContent = on ? '🔊 Sound' : '🔈 Sound';
    };
    $('#btn-help').onclick = () => { $('#help').hidden = false; };
    $('#help-close').onclick = () => { $('#help').hidden = true; };
    $('#help').onclick = e => { if (e.target.id === 'help') $('#help').hidden = true; };

    for (const inp of $$('#panel input[type=range]')) showOut(inp);
  }

  const TOOL_BLURB = {
    rain: 'Hold on the map to pour a storm on one spot. Works while the rain is paused too.',
    spring: 'Click to place a spring that never runs dry. Click it again to remove it.',
    raise: 'Push the ground up. Hold still to build a mountain.',
    lower: 'Dig the ground down. A trench soon becomes a river bed.',
    smooth: 'Soften bumps, ridges and rough cliffs.',
    flatten: 'Level the ground to the height where you first pressed.',
    inspect: 'Hover to read elevation, slope and how much land drains through a spot.',
  };
  function setTool(t) {
    state.tool = t;
    for (const b of $$('#tools button')) b.classList.toggle('on', b.dataset.tool === t);
    $('#tool-blurb').textContent = TOOL_BLURB[t];
    if (t !== 'inspect') $('#tip').hidden = true;
    if (state.mode === '3d') setMode('2d');
  }
  function setMode(m) {
    state.mode = m;
    for (const b of $$('#seg-mode button')) b.classList.toggle('on', b.dataset.mode === m);
    $('#hint3d').hidden = m !== '3d';
    $('#tip').hidden = true;
    dirtyPaint = true;
  }
  function setView(v) {
    state.view = v;
    for (const b of $$('#seg-view button')) b.classList.toggle('on', b.dataset.view === v);
    dirtyPaint = true;
  }
  function togglePlay() {
    state.running = !state.running;
    const b = $('#btn-play');
    b.textContent = state.running ? '❚❚ Raining' : '▶ Let it rain';
    b.classList.toggle('paused', !state.running);
  }
  function undo() {
    if (!undoH) { toast('Nothing to undo'); return; }
    world.h.set(undoH); world.orig.set(undoO); undoH = undoO = null;
    world.hydrology(); dirtyPaint = true; toast('Undone');
  }

  function savePNG() {
    let src;
    if (state.mode === '3d') src = voxel.canvas;
    else {
      src = document.createElement('canvas');
      src.width = src.height = state.n * 2;
      const c = src.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(off, 0, 0, src.width, src.height);
    }
    src.toBlob(b => {
      if (!b) { toast('Could not make a picture here'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = `watershed-${state.seed}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Picture saved');
    });
  }
  function copyLink() {
    writeHash();
    const url = location.href.split('#')[0] + `#t=${state.preset}&s=${encodeURIComponent(state.seed)}&n=${state.n}`;
    const fallback = () => toast(url, 6000);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => toast('Link copied. It opens the same land, before any rain.'), fallback);
    else fallback();
  }

  // ---------- input ----------
  function toMap(px, py) {
    return { x: (px - mapRect.x) / mapRect.s * state.n, y: (py - mapRect.y) / mapRect.s * state.n };
  }
  function brushR() { return state.brush * state.n / 384; }

  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    pointer.down = true; pointer.id = e.pointerId; pointer.button = e.button;
    pointer.x = pointer.lastX = e.offsetX; pointer.y = pointer.lastY = e.offsetY;
    if (state.mode === '3d') return;
    const m = toMap(e.offsetX, e.offsetY); pointer.mx = m.x; pointer.my = m.y;
    const t = state.tool;
    if (['raise', 'lower', 'smooth', 'flatten', 'rain'].includes(t)) {
      undoH = Float32Array.from(world.h); undoO = Float32Array.from(world.orig);
    }
    if (t === 'flatten') flattenTo = world.heightAt(m.x, m.y);
    if (t === 'spring') {
      if (m.x < 1 || m.y < 1 || m.x > state.n - 2 || m.y > state.n - 2) return;
      const r = Math.max(4, brushR() * 0.5);
      const k = world.springs.findIndex(s => Math.hypot(s.x - m.x, s.y - m.y) < r);
      if (k >= 0 || e.shiftKey || e.button === 2) { if (k >= 0) world.springs.splice(k, 1); }
      else { world.springs.push({ x: m.x, y: m.y, t: performance.now() }); if (!state.running) toast('Spring placed. Start the rain to let it flow.'); }
      dirtyPaint = true;
    }
  });
  cv.addEventListener('pointermove', e => {
    pointer.over = true;
    const dx = e.offsetX - pointer.lastX, dy = e.offsetY - pointer.lastY;
    pointer.x = e.offsetX; pointer.y = e.offsetY; pointer.lastX = e.offsetX; pointer.lastY = e.offsetY;
    if (state.mode === '3d') {
      if (pointer.down) { cam.yaw -= dx * 0.008; cam.elev = Math.min(1.25, Math.max(0.08, cam.elev + dy * 0.004)); dirtyPaint = true; }
      return;
    }
    const m = toMap(e.offsetX, e.offsetY); pointer.mx = m.x; pointer.my = m.y;
    if (state.tool === 'inspect') showTip(); else dirtyPaint = true;
  });
  const up = () => { if (pointer.down) { pointer.down = false; sinceHydro = 999; } };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { pointer.over = false; $('#tip').hidden = true; dirtyPaint = true; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    if (state.mode === '3d') { cam.dist = Math.min(2.2, Math.max(0.3, cam.dist * Math.exp(e.deltaY * 0.001))); dirtyPaint = true; }
    else { const br = $('#s-brush'); br.value = Math.min(60, Math.max(3, state.brush - Math.sign(e.deltaY) * 2)); br.oninput(); dirtyPaint = true; }
  }, { passive: false });
  cv.addEventListener('dblclick', () => { if (state.mode === '3d') { cam.yaw = 0.75; cam.elev = 0.5; cam.dist = 0.95; dirtyPaint = true; } });

  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
    if (e.target.tagName === 'SELECT') return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === ' ') { e.preventDefault(); togglePlay(); }
    else if (k === 'v') setMode(state.mode === '2d' ? '3d' : '2d');
    else if (k === 'b' && !e.repeat) WS._setBefore(true);
    else if (k >= '1' && k <= '7') setTool(['rain', 'spring', 'raise', 'lower', 'smooth', 'flatten', 'inspect'][+k - 1]);
    else if (k === '[' || k === ']') { const br = $('#s-brush'); br.value = state.brush + (k === ']' ? 3 : -3); br.oninput(); dirtyPaint = true; }
    else if (k === 'r') { const c = $('#c-rivers'); c.checked = !c.checked; c.onchange(); }
    else if (k === 'c') { const c = $('#c-contours'); c.checked = !c.checked; c.onchange(); }
    else if (k === 'n') newLand({ seed: WS.randomSeedName() });
    else if (k === 'escape') $('#help').hidden = true;
  });
  window.addEventListener('keyup', e => { if (e.key.toLowerCase() === 'b') WS._setBefore(false); });

  function showTip() {
    const tip = $('#tip'), n = state.n;
    const x = pointer.mx, y = pointer.my;
    if (!pointer.over || x < 0 || y < 0 || x >= n - 1 || y >= n - 1) { tip.hidden = true; return; }
    const i = (y | 0) * n + (x | 0), h = world.h;
    const hv = world.heightAt(x, y);
    const gx = (world.heightAt(x + 1, y) - world.heightAt(x - 1, y)) / 2;
    const gy = (world.heightAt(x, y + 1) - world.heightAt(x, y - 1)) / 2;
    const slope = Math.atan(Math.hypot(gx, gy) * WS.HEIGHT_M / cellM()) * 180 / Math.PI;
    const elev = (hv - world.sea) * WS.HEIGHT_M;
    const lake = world.W[i] - h[i];
    const lines = [];
    if (hv < world.sea) lines.push(`<b>Sea</b>, ${Math.round(-elev)} m deep`);
    else if (world.lake[i] === 1) lines.push(`<b>Lake</b>, ${Math.round(lake * WS.HEIGHT_M)} m deep`, `Surface ${Math.round((world.W[i] - world.sea) * WS.HEIGHT_M)} m above sea`);
    else {
      lines.push(`<b>${Math.round(elev)} m</b> above sea · slope ${slope.toFixed(0)}°`);
      const area = world.acc[i] * cellKm2();
      lines.push(`Drains ${area < 1 ? area.toFixed(2) : area.toFixed(1)} km² of land`);
    }
    const d = (h[i] - world.orig[i]) * WS.HEIGHT_M;
    if (Math.abs(d) >= 1) lines.push(d < 0 ? `Worn down ${Math.round(-d)} m` : `Built up ${Math.round(d)} m`);
    tip.innerHTML = lines.join('<br>');
    tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = Math.min(cssW - tw - 8, pointer.x + 16) + 'px';
    tip.style.top = Math.max(8, pointer.y - 12 - tip.offsetHeight) + 'px';
  }

  // ---------- simulation step ----------
  function applyTool() {
    const n = state.n, h = world.h, o = world.orig, t = state.tool;
    const cx = pointer.mx, cy = pointer.my, r = brushR(), str = state.strength;
    if (cx < -r || cy < -r || cx > n + r || cy > n + r) return false;
    if (t === 'rain') { world.rainAt(cx, cy, r, Math.round(40 + str * 700)); return true; }
    if (!['raise', 'lower', 'smooth', 'flatten'].includes(t)) return false;
    const x0 = Math.max(1, Math.floor(cx - r)), x1 = Math.min(n - 2, Math.ceil(cx + r));
    const y0 = Math.max(1, Math.floor(cy - r)), y1 = Math.min(n - 2, Math.ceil(cy + r));
    const inv = 1 / (r * r * 0.35);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 > r * r) continue;
        const g = Math.exp(-d2 * inv), i = y * n + x;
        let dh;
        if (t === 'raise') dh = str * 0.004 * g;
        else if (t === 'lower') dh = -str * 0.004 * g;
        else if (t === 'smooth') {
          const avg = (h[i - 1] + h[i + 1] + h[i - n] + h[i + n] + h[i - n - 1] + h[i - n + 1] + h[i + n - 1] + h[i + n + 1]) / 8;
          dh = (avg - h[i]) * str * 0.6 * g;
        } else dh = (flattenTo - h[i]) * str * 0.25 * g;
        h[i] += dh; o[i] += dh;
      }
    }
    return true;
  }

  function step() {
    let changed = false;
    if (state.running) {
      const r = rainPerFrame();
      if (r > 0) { world.rain(r, 11); changed = true; }
      for (const s of world.springs) world.rainAt(s.x, s.y, 1.5, 30);
      if (world.springs.length) changed = true;
      if (params.thermal > 0 && frameNo % 2 === 0) { world.thermal(params.thermal); changed = true; }
      if (params.uplift > 0) { world.upliftStep(params.uplift); changed = true; }
    }
    if (pointer.down && state.mode === '2d' && applyTool()) changed = true;
    if (changed) { sinceHydro++; dirtyPaint = true; }
    const every = Math.max(6, Math.min(40, Math.round(hydroMs * 0.8)));
    if ((changed && sinceHydro >= every) || (!changed && sinceHydro > 0)) {
      const t0 = performance.now(); world.hydrology(); hydroMs = hydroMs * 0.7 + (performance.now() - t0) * 0.3;
      sinceHydro = 0; dirtyPaint = true;
    }
    const now = performance.now();
    if (now - lastRateT > 500) {
      dropRate = (world.stats.drops - lastDropCount) / ((now - lastRateT) / 1000);
      lastDropCount = world.stats.drops; lastRateT = now;
    }
    WS.audio.set(state.running ? Math.min(1, dropRate / 60000) ** 0.5 : (pointer.down && state.tool === 'rain' ? 0.5 : 0));
  }

  // ---------- drawing ----------
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = stage.getBoundingClientRect();
    cssW = Math.max(1, r.width); cssH = Math.max(1, r.height);
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
    dirtyPaint = true;
  }
  window.addEventListener('resize', resize);

  function draw() {
    WS.paint(world, buf, { view: state.view, before: state.before, rivers: state.rivers, contours: state.contours, riverThr: riverThr() });
    offCtx.putImageData(img, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    if (state.mode === '3d') draw3d(); else draw2d();
  }

  function draw2d() {
    const top = 56, bottom = 60, side = 20;
    const s = Math.max(50, Math.min(cssW - side * 2, cssH - top - bottom));
    mapRect = { x: Math.round((cssW - s) / 2), y: Math.round(top + (cssH - top - bottom - s) / 2), s };
    ctx.save();
    ctx.shadowColor = 'rgba(70,50,25,.35)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#d9cfb9'; ctx.fillRect(mapRect.x, mapRect.y, s, s);
    ctx.restore();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, mapRect.x, mapRect.y, s, s);
    ctx.strokeStyle = 'rgba(60,45,25,.55)'; ctx.lineWidth = 1;
    ctx.strokeRect(mapRect.x + 0.5, mapRect.y + 0.5, s - 1, s - 1);

    const k = s / state.n;
    // springs
    const now = performance.now();
    for (const sp of world.springs) {
      const px = mapRect.x + sp.x * k, py = mapRect.y + sp.y * k;
      const ph = ((now - sp.t) / 1400) % 1;
      ctx.beginPath(); ctx.arc(px, py, 4 + ph * 12, 0, 7);
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - ph)})`; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py, 4.5, 0, 7);
      ctx.fillStyle = '#2f7fd0'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // scale bar and north
    const km = WS.MAP_KM <= 30 ? 5 : 10, len = km / WS.MAP_KM * s;
    const bx = mapRect.x + s - len - 14, by = mapRect.y + s - 16;
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(bx - 6, by - 16, len + 12, 26);
    for (let q = 0; q < 5; q++) { ctx.fillStyle = q % 2 ? '#fff' : '#2f2a23'; ctx.fillRect(bx + q * len / 5, by, len / 5, 4); }
    ctx.strokeStyle = '#2f2a23'; ctx.lineWidth = 0.8; ctx.strokeRect(bx, by, len, 4);
    ctx.fillStyle = '#2f2a23'; ctx.font = '11px ' + getComputedStyle(document.body).fontFamily; ctx.textAlign = 'center';
    ctx.fillText(`${km} km`, bx + len / 2, by - 4);
    const nx = mapRect.x + s - 22, ny = mapRect.y + 22;
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(nx, ny, 14, 0, 7); ctx.fill();
    ctx.fillStyle = '#2f2a23'; ctx.beginPath(); ctx.moveTo(nx, ny - 11); ctx.lineTo(nx + 4, ny - 1); ctx.lineTo(nx, ny - 3); ctx.lineTo(nx - 4, ny - 1); ctx.closePath(); ctx.fill();
    ctx.font = 'bold 10px sans-serif'; ctx.fillText('N', nx, ny + 10);
    // brush
    if (pointer.over && state.tool !== 'inspect') {
      const px = mapRect.x + pointer.mx * k, py = mapRect.y + pointer.my * k;
      const rr = state.tool === 'spring' ? 6 : brushR() * k;
      ctx.beginPath(); ctx.arc(px, py, rr, 0, 7);
      ctx.setLineDash(state.tool === 'rain' ? [3, 4] : []);
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(30,25,20,.6)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.setLineDash([]);
    }
    if (state.before) {
      ctx.fillStyle = 'rgba(47,42,35,.85)'; ctx.font = 'italic 15px ' + getComputedStyle(document.body).fontFamily;
      ctx.textAlign = 'left'; ctx.fillText('The land before the rain', mapRect.x + 10, mapRect.y + 24);
    }
  }

  function draw3d() {
    const scale = Math.max(1, Math.max(cssW / 820, cssH / 560));
    const w = Math.max(160, Math.round(cssW / scale)), h = Math.max(100, Math.round(cssH / scale));
    voxel.resize(w, h);
    const c = voxel.render(world, buf, cam, state.vex);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(c, 0, 0, cssW, cssH);
  }

  function updateStats() {
    const s = world.stats, n = state.n;
    let land = 0; for (let i = 0; i < n * n; i++) if (world.h[i] >= world.sea) land++;
    const rows = [
      ['Raindrops', fmt(s.drops)],
      ['Soil moved', volKm3(s.eroded).toFixed(2) + ' km³'],
      ['Washed into the sea', volKm3(s.toSea).toFixed(2) + ' km³'],
      ['Highest point', Math.round((world.hmax - world.sea) * WS.HEIGHT_M) + ' m'],
      ['Land / sea', Math.round(land / (n * n) * 100) + '% / ' + Math.round(100 - land / (n * n) * 100) + '%'],
      ['Under lakes', (s.lakeCells * cellKm2()).toFixed(1) + ' km²'],
      ['Largest river basin', (s.maxAcc * cellKm2()).toFixed(0) + ' km²'],
      ['Springs', world.springs.length],
    ];
    $('#stats').innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
    $('#clock').textContent = state.running ? (dropRate > 0 ? `${fmt(dropRate)} drops a second` : '') : 'paused';
  }

  function frame() {
    requestAnimationFrame(frame);
    frameNo++;
    step();
    if (state.mode === '3d' && state.orbit && !pointer.down) { cam.yaw += 0.0018; dirtyPaint = true; }
    if (world.springs.length && state.mode === '2d') dirtyPaint = true;
    if (dirtyPaint) { draw(); dirtyPaint = false; }
    if (frameNo % 20 === 1) updateStats();
  }

  // ---------- go ----------
  readHash();
  bindControls();
  setTool(state.tool);
  resize();
  newLand();
  requestAnimationFrame(frame);
  WS.app = { state, params, cam, get world() { return world; }, setMode, setView, togglePlay, newLand };
})();
