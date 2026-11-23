/* Tiny synthesized sounds (WebAudio). No audio files. */
(function () {
  'use strict';
  let ctx = null, muted = false;
  try { muted = localStorage.getItem('generated.muted') === '1'; } catch (e) {}
  function ac() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } return ctx; }
  function tone(freq, t0, dur, type, vol) {
    const c = ac(); if (!c || muted) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, c.currentTime + t0);
    g.gain.linearRampToValueAtTime(vol || 0.08, c.currentTime + t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.02);
  }
  // pentatonic pitches, one per generator, so a word becomes a little melody
  const SCALE = [392, 440, 523.25, 587.33, 659.25, 783.99];
  window.Sound = {
    move(gi) { tone(SCALE[gi % SCALE.length], 0, 0.18, 'triangle', 0.07); },
    undo() { tone(330, 0, 0.1, 'sine', 0.05); },
    win() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.5, 'triangle', 0.06)); },
    nope() { tone(196, 0, 0.25, 'sine', 0.07); tone(185, 0.12, 0.3, 'sine', 0.06); },
    toggle() { muted = !muted; try { localStorage.setItem('generated.muted', muted ? '1' : '0'); } catch (e) {} return muted; },
    get muted() { return muted; },
  };
})();
