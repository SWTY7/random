/* Comet Courier — every sound is synthesized live with WebAudio. No files. */
(function (root) {
  'use strict';
  const CC = (root.CC = root.CC || {});

  let ctx = null, master, sfxBus, musicBus, reverb, noiseBuf;
  let musicOn = true, sfxOn = true;
  let musicTimer = null, musicWorld = 0, musicStep = 0, nextTime = 0;

  // per-world moods: root note (midi), scale degrees, chord progression (scale-degree roots), tempo
  const MOODS = [
    { root: 57, scale: [0, 2, 4, 7, 9], prog: [0, 3, 4, 2], bpm: 76 },            // A major pentatonic, cosy
    { root: 55, scale: [0, 2, 4, 6, 7, 9, 11], prog: [0, 4, 5, 3], bpm: 92 },     // G lydian, ticking
    { root: 50, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 5, 6, 3], bpm: 70 },     // D phrygian, strange
    { root: 52, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 6, 4], bpm: 64 },     // E dorian, deep
    { root: 60, scale: [0, 2, 4, 7, 9], prog: [0, 2, 3, 4], bpm: 84 },            // menu
  ];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 0.7 : 0; sfxBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.32 : 0; musicBus.connect(comp);
    // simple convolution reverb from decaying noise
    reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    reverb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.55; reverb.connect(wet); wet.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    startMusic();
  }

  function env(g, t, a, peak, d, sustain, r) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r);
  }

  function tone(freq, t, opts) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.glide) o.frequency.exponentialRampToValueAtTime(opts.glide, t + (opts.glideT || 0.3));
    if (opts.detune) o.detune.value = opts.detune;
    env(g, t, opts.a || 0.005, opts.peak || 0.3, opts.d || 0.1, opts.s || 0.05, opts.r || 0.3);
    o.connect(g);
    let out = g;
    if (opts.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; g.connect(f); out = f; }
    out.connect(opts.bus || sfxBus);
    if (opts.verb) out.connect(reverb);
    o.start(t); o.stop(t + (opts.a || 0.005) + (opts.d || 0.1) + (opts.r || 0.3) + 0.05);
  }

  function noise(t, dur, opts) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = opts.ft || 'bandpass';
    f.frequency.setValueAtTime(opts.f0 || 800, t);
    if (opts.f1) f.frequency.exponentialRampToValueAtTime(opts.f1, t + dur);
    f.Q.value = opts.q || 1;
    const g = ctx.createGain(); env(g, t, opts.a || 0.01, opts.peak || 0.3, dur * 0.4, opts.s || 0.05, dur * 0.6);
    s.connect(f); f.connect(g); g.connect(sfxBus); if (opts.verb) g.connect(reverb);
    s.start(t); s.stop(t + dur + 0.1);
  }

  const SFX = {
    click() { const t = ctx.currentTime; tone(880, t, { type: 'triangle', peak: 0.08, d: 0.03, r: 0.06 }); },
    aim(p) { const t = ctx.currentTime; tone(200 + p * 500, t, { type: 'sine', peak: 0.025, d: 0.02, r: 0.04 }); },
    launch(p) {
      const t = ctx.currentTime;
      noise(t, 0.5, { f0: 300, f1: 2500 + p * 3000, q: 2, peak: 0.25 + p * 0.2, verb: true });
      tone(110, t, { type: 'sine', glide: 220 + p * 200, glideT: 0.25, peak: 0.25, d: 0.1, r: 0.25 });
    },
    dust(n) {
      const t = ctx.currentTime, m = MOODS[musicWorld] || MOODS[0];
      const deg = (n * 2) % m.scale.length, oct = Math.floor((n * 2) / m.scale.length);
      const f = mtof(m.root + 24 + m.scale[deg] + 12 * oct);
      tone(f, t, { type: 'triangle', peak: 0.18, d: 0.08, s: 0.03, r: 0.6, verb: true });
      tone(f * 2, t + 0.04, { type: 'sine', peak: 0.07, d: 0.05, r: 0.5, verb: true });
    },
    crash() {
      const t = ctx.currentTime;
      noise(t, 0.6, { ft: 'lowpass', f0: 1800, f1: 120, peak: 0.6 });
      tone(90, t, { type: 'sine', glide: 35, glideT: 0.4, peak: 0.5, d: 0.2, r: 0.4 });
    },
    swallowed() {
      const t = ctx.currentTime;
      tone(600, t, { type: 'sawtooth', glide: 30, glideT: 1.2, peak: 0.12, d: 0.4, s: 0.08, r: 0.9, lp: 900, verb: true });
      tone(605, t, { type: 'sawtooth', glide: 28, glideT: 1.3, peak: 0.1, d: 0.4, s: 0.06, r: 0.9, lp: 700 });
    },
    lost() { const t = ctx.currentTime; tone(440, t, { type: 'sine', glide: 220, glideT: 0.8, peak: 0.1, d: 0.3, r: 0.6, verb: true }); },
    worm() {
      const t = ctx.currentTime;
      noise(t, 0.5, { f0: 3000, f1: 200, q: 8, peak: 0.25, verb: true });
      tone(300, t, { type: 'sine', glide: 1200, glideT: 0.35, peak: 0.1, d: 0.2, r: 0.3, verb: true });
    },
    orbit() {
      const t = ctx.currentTime, m = MOODS[musicWorld] || MOODS[0];
      [0, 2, 4].forEach((d, i) => tone(mtof(m.root + 12 + m.scale[d % m.scale.length]), t + i * 0.06, { type: 'sine', peak: 0.08, d: 0.1, r: 1.2, verb: true }));
    },
    win() {
      const t = ctx.currentTime, m = MOODS[musicWorld] || MOODS[0];
      const notes = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => m.root + 12 + m.scale[i % m.scale.length] + 12 * Math.floor(i / m.scale.length));
      notes.forEach((n, i) => tone(mtof(n), t + i * 0.07, { type: 'triangle', peak: 0.15, d: 0.1, s: 0.04, r: 0.8, verb: true }));
      tone(mtof(m.root), t, { type: 'sine', peak: 0.2, a: 0.02, d: 0.5, s: 0.1, r: 1.5 });
    },
    star(i) {
      const t = ctx.currentTime, m = MOODS[musicWorld] || MOODS[0];
      tone(mtof(m.root + 24 + m.scale[(i * 2) % m.scale.length]), t, { type: 'triangle', peak: 0.16, d: 0.08, r: 1, verb: true });
    },
    badge() {
      const t = ctx.currentTime;
      [72, 76, 79, 84].forEach((n, i) => tone(mtof(n), t + i * 0.09, { type: 'square', peak: 0.05, d: 0.06, r: 0.4, lp: 3000, verb: true }));
    },
    pop() { const t = ctx.currentTime; tone(300 + Math.random() * 300, t, { type: 'sine', glide: 900, glideT: 0.08, peak: 0.12, d: 0.04, r: 0.1 }); },
    merge(big) { const t = ctx.currentTime; tone(big ? 70 : 140, t, { type: 'sine', glide: 40, glideT: 0.4, peak: 0.3, d: 0.2, r: 0.5, verb: true }); noise(t, 0.3, { ft: 'lowpass', f0: 900, f1: 100, peak: 0.2 }); },
  };

  /* ---------- generative music ---------- */
  function startMusic() {
    if (musicTimer || !ctx) return;
    nextTime = ctx.currentTime + 0.1;
    musicTimer = setInterval(schedule, 120);
  }
  function schedule() {
    if (!ctx || !musicOn) return;
    const m = MOODS[musicWorld] || MOODS[0];
    const beat = 60 / m.bpm / 2; // eighth notes
    while (nextTime < ctx.currentTime + 0.4) {
      const bar = Math.floor(musicStep / 16), inBar = musicStep % 16;
      const chordDeg = m.prog[bar % m.prog.length];
      const deg = (k) => m.scale[(chordDeg + k) % m.scale.length] + 12 * Math.floor((chordDeg + k) / m.scale.length);
      if (inBar === 0) {
        // pad chord
        [0, 2, 4].forEach((k) => {
          const f = mtof(m.root - 12 + deg(k));
          tone(f, nextTime, { type: 'sawtooth', a: 1.2, peak: 0.035, d: 1, s: 0.025, r: 3.5, lp: 700, bus: musicBus, verb: true, detune: -6 });
          tone(f, nextTime, { type: 'sawtooth', a: 1.2, peak: 0.035, d: 1, s: 0.025, r: 3.5, lp: 700, bus: musicBus, detune: 7 });
        });
        tone(mtof(m.root - 24 + deg(0)), nextTime, { type: 'sine', a: 0.05, peak: 0.12, d: 1.5, s: 0.05, r: 1.5, bus: musicBus });
      }
      // sparse sparkle melody, seeded-ish
      const h = Math.sin(musicStep * 12.9898 + bar * 78.233) * 43758.5453;
      const rnd = h - Math.floor(h);
      if (rnd < 0.28 && inBar % 2 === 0) {
        const k = Math.floor(rnd * 100) % 5;
        tone(mtof(m.root + 12 + deg(k)), nextTime, { type: 'triangle', a: 0.01, peak: 0.05, d: 0.15, s: 0.02, r: 1.2, bus: musicBus, verb: true });
      }
      if (musicWorld === 1 && inBar % 4 === 2) { // clockwork tick
        tone(2400, nextTime, { type: 'square', peak: 0.012, d: 0.01, r: 0.02, lp: 5000, bus: musicBus });
      }
      nextTime += beat; musicStep++;
    }
  }

  CC.audio = {
    init,
    play(name, arg) { if (!ctx || !sfxOn) return; try { SFX[name] && SFX[name](arg); } catch (e) {} },
    setWorld(w) { if (w !== musicWorld) { musicWorld = w; musicStep = 0; } },
    setMusic(on) { musicOn = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.32 : 0, ctx.currentTime, 0.3); },
    setSfx(on) { sfxOn = on; if (sfxBus) sfxBus.gain.value = on ? 0.7 : 0; },
  };
})(window);
