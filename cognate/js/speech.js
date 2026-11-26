// Cognate: a small formant synthesiser, so that every word in every language can be heard.
// Source-filter model: a glottal pulse train through three cascaded resonators, plus filtered noise for
// fricatives, bursts and h. Parameters are set per 5 ms frame from segment targets and smoothed.
'use strict';
(function (G) {
  const CG = G.CG, FEAT = CG.FEAT;
  const SR = 22050, FR = 0.005, FS = Math.round(SR * FR);

  const VF = { i: [280, 2250, 2900], y: [280, 1850, 2300], ɨ: [320, 1500, 2400], u: [310, 850, 2250], e: [400, 2050, 2650], ø: [400, 1600, 2350],
    ə: [500, 1400, 2500], o: [440, 820, 2450], ɛ: [560, 1850, 2550], œ: [560, 1500, 2400], ɔ: [600, 900, 2450], æ: [700, 1700, 2500], a: [760, 1300, 2500], ɑ: [740, 1050, 2500] };
  const LOCUS = { lab: 850, lbd: 1100, den: 1450, alv: 1700, pa: 1950, pal: 2250, vel: 1600, uvu: 1250, glo: 0 };
  // fricative noise: [centre, bandwidth, amplitude]
  const FRIC = { 'ɸ': [1400, 3000, 0.22], 'β': [1400, 3000, 0.16], f: [5200, 6000, 0.2], v: [5200, 6000, 0.13], 'θ': [5600, 5000, 0.17], 'ð': [5600, 5000, 0.12],
    s: [6200, 2400, 0.42], z: [6200, 2400, 0.26], 'ʃ': [3200, 1600, 0.7], 'ʒ': [3200, 1600, 0.45], 'ç': [3900, 1500, 0.5], 'ʝ': [3900, 1500, 0.32],
    x: [1700, 1200, 0.45], 'ɣ': [1700, 1200, 0.28], 'χ': [1200, 900, 0.5], 'ʁ': [1200, 900, 0.3] };
  const BURST = { lab: [900, 2500, 0.45], lbd: [900, 2500, 0.45], den: [4200, 3000, 0.5], alv: [4200, 3000, 0.55], pa: [3000, 2000, 0.6], pal: [3200, 1800, 0.6], vel: [1900, 900, 0.65], uvu: [1300, 800, 0.6] };
  const AFF_FRIC = { 'p͡f': 'f', 't͡s': 's', 'd͡z': 'z', 't͡ʃ': 'ʃ', 'd͡ʒ': 'ʒ' };

  // Build per-frame parameter tracks for a form.
  function plan(form, stressType, rate = 1) {
    const st = CG.stressIndex(form, stressType);
    const segs = [];
    const vowelF = s => VF[FEAT[s].base];
    const nextV = i => { for (let k = i + 1; k < form.length; k++) if (CG.isV(form[k])) return vowelF(form[k]); for (let k = i - 1; k >= 0; k--) if (CG.isV(form[k])) return vowelF(form[k]); return VF['ə']; };
    const push = (ms, p) => segs.push(Object.assign({ n: Math.max(1, Math.round(ms / rate / 5)), F: null, AV: 0, AF: 0, FC: 3000, BW: 2000, AH: 0, nas: 0, trill: 0 }, p));
    form.forEach((s, i) => {
      const f = FEAT[s];
      if (!f) return;
      const nv = nextV(i);
      if (f.type === 'V') {
        let ms = f.long ? 200 : 115;
        if (i === st) ms *= 1.3;
        if (i === form.length - 1) ms *= 1.15;
        push(ms, { F: vowelF(s), AV: f.nasal ? 0.8 : 1, nas: f.nasal ? 0.5 : 0, stress: i === st });
        return;
      }
      const loc = LOCUS[f.place];
      const cF = loc ? [260, loc, nv[2]] : nv;
      const m = f.manner;
      if (m === 'gli') push(55, { F: s === 'w' ? [300, 700, 2200] : [260, 2250, 3000], AV: 0.75 });
      else if (m === 'lat') push(70, { F: s === 'ʎ' ? [300, 2000, 2800] : [360, 1250, 2700], AV: 0.55 });
      else if (m === 'trill') push(85, { F: [450, 1300, 1700], AV: 0.55, trill: 1 });
      else if (m === 'nas') push(80, { F: [270, { lab: 1000, alv: 1500, pal: 2000, vel: 2300 }[f.place] || 1500, 2600], AV: 0.45, nas: 1 });
      else if (m === 'stop' || m === 'aff') {
        if (f.place === 'glo') { push(70, { F: nv, AV: 0 }); return; }
        push(m === 'aff' ? 55 : 75, { F: cF, AV: f.voice ? 0.1 : 0 });
        if (m === 'aff') { const fr = FRIC[AFF_FRIC[s]] || FRIC.s; push(85, { F: cF, AV: f.voice ? 0.25 : 0, AF: fr[2], FC: fr[0], BW: fr[1] }); }
        else {
          const b = BURST[f.place] || BURST.alv;
          push(14, { F: cF, AV: 0, AF: b[2], FC: b[0], BW: b[1] });
          if (!f.voice && i + 1 < form.length && CG.isV(form[i + 1])) push(22, { F: nv, AH: 0.25 });
        }
      } else if (m === 'fric') {
        if (s === 'h') { push(85, { F: nv, AH: 0.3 }); return; }
        const fr = FRIC[s] || FRIC.s;
        push(110, { F: cF, AV: f.voice ? 0.3 : 0, AF: fr[2], FC: fr[0], BW: fr[1] });
      }
    });
    // flatten into frames, with 60 ms of silence at the end
    const frames = [];
    for (const sg of segs) for (let k = 0; k < sg.n; k++) frames.push(Object.assign({}, sg, { F: sg.F.slice() }));
    for (let k = 0; k < 12; k++) frames.push({ F: frames.length ? frames[frames.length - 1].F.slice() : VF['ə'], AV: 0, AF: 0, AH: 0, FC: 3000, BW: 2000, nas: 0, trill: 0 });
    // smooth formants (about 30 ms) and amplitudes (about 10 ms)
    const smooth = (get, set, r) => {
      const v = frames.map(get), out = v.slice();
      for (let i = 0; i < v.length; i++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const j = i + k; if (j >= 0 && j < v.length) { s += v[j]; n++; } } out[i] = s / n; }
      out.forEach((x, i) => set(frames[i], x));
    };
    for (let q = 0; q < 3; q++) smooth(f => f.F[q], (f, x) => f.F[q] = x, 3);
    smooth(f => f.AV, (f, x) => f.AV = x, 1);
    smooth(f => f.AH, (f, x) => f.AH = x, 1);
    smooth(f => f.nas, (f, x) => f.nas = x, 2);
    // pitch: gentle declination with a rise on the stressed vowel
    const n = frames.length;
    let stressAt = frames.findIndex(f => f.stress);
    frames.forEach((f, i) => {
      const bump = stressAt >= 0 ? 28 * Math.exp(-Math.pow((i - stressAt - 6) / 10, 2)) : 0;
      f.F0 = 128 - 26 * (i / n) + bump;
    });
    return frames;
  }

  function resonator() { return { a: 0, b: 0, c: 0, y1: 0, y2: 0 }; }
  function setRes(r, f, bw) {
    const T = 1 / SR;
    r.c = -Math.exp(-2 * Math.PI * bw * T);
    r.b = 2 * Math.exp(-Math.PI * bw * T) * Math.cos(2 * Math.PI * f * T);
    r.a = 1 - r.b - r.c;
  }
  const run = (r, x) => { const y = r.a * x + r.b * r.y1 + r.c * r.y2; r.y2 = r.y1; r.y1 = y; return y; };

  CG.synth = (form, stressType, opts = {}) => {
    const frames = plan(form, stressType, opts.rate || 1);
    const pitch = opts.pitch || 1;
    const out = new Float32Array(frames.length * FS);
    const R = [resonator(), resonator(), resonator(), resonator()], RN = resonator(), RF = resonator();
    setRes(R[3], 3500, 250);
    let phase = 0, prevG = 0, seed = 22222;
    const noise = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x3fffffff - 1; };
    let t = 0;
    for (let fi = 0; fi < frames.length; fi++) {
      const f = frames[fi];
      setRes(R[0], f.F[0], 70 + f.nas * 90); setRes(R[1], f.F[1], 90); setRes(R[2], f.F[2], 140);
      setRes(RN, 260, 100); setRes(RF, f.FC, f.BW);
      for (let k = 0; k < FS; k++, t++) {
        const F0 = f.F0 * pitch * (1 + 0.012 * Math.sin(t * 0.0021));
        phase += F0 / SR;
        if (phase >= 1) phase -= 1;
        const p = phase;
        const g = p < 0.4 ? 0.5 * (1 - Math.cos(Math.PI * p / 0.4)) : p < 0.56 ? Math.cos(Math.PI * (p - 0.4) / 0.32) : 0;
        let src = (g - prevG) * 12; prevG = g;
        let av = f.AV;
        if (f.trill) av *= 0.35 + 0.65 * (Math.sin(t * 2 * Math.PI * 26 / SR) > 0 ? 1 : 0);
        const nz = noise();
        let x = src * av + nz * f.AH * 0.9;
        let y = run(R[0], x);
        y = run(R[1], y); y = run(R[2], y); y = run(R[3], y);
        y = y * (1 - f.nas * 0.45) + run(RN, src * av) * f.nas * 0.9;
        y += run(RF, nz) * f.AF * 0.9;
        out[fi * FS + k] = y;
      }
    }
    // normalise and fade
    let peak = 1e-6;
    for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
    const g = 0.6 / peak;
    for (let i = 0; i < out.length; i++) out[i] *= g * Math.min(1, i / 80, (out.length - i) / 200);
    return out;
  };
  CG.SPEECH_RATE = SR;

  let ctx = null;
  CG.say = (form, stressType, opts) => {
    if (!form || !form.length) return;
    try {
      if (!ctx) ctx = new (G.AudioContext || G.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const data = CG.synth(form, stressType, opts);
      const buf = ctx.createBuffer(1, data.length, SR);
      buf.copyToChannel(data, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start();
    } catch (e) { /* audio unavailable */ }
  };
})(globalThis);
