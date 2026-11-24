// Rain on the roof: filtered noise whose loudness follows the rainfall.
var WS = globalThis.WS || (globalThis.WS = {});

(function () {
  let ctx = null, gain = null, lp = null, on = false;
  function start() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.04 * white) / 1.04;          // brownish body
        const patter = Math.random() < 0.0009 ? (Math.random() * 2 - 1) * 0.9 : 0; // single drops
        d[i] = last * 3.2 + white * 0.08 + patter;
      }
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.3;
    gain = ctx.createGain(); gain.gain.value = 0;
    src.connect(lp).connect(gain).connect(ctx.destination);
    src.start();
    return true;
  }
  WS.audio = {
    toggle() {
      if (!ctx && !start()) return false;
      on = !on;
      if (on) ctx.resume(); else gain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      return on;
    },
    get on() { return on; },
    // level: 0..1
    set(level) {
      if (!on || !ctx) return;
      gain.gain.setTargetAtTime(Math.min(0.6, level * 0.55), ctx.currentTime, 0.4);
      lp.frequency.setTargetAtTime(1200 + 2600 * level, ctx.currentTime, 0.4);
    },
  };
})();
