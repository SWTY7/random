// Seeded randomness and gradient noise.
var WS = globalThis.WS || (globalThis.WS = {});

(function () {
  WS.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  WS.hashSeed = function (str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return h >>> 0;
  };

  const A = ['amber', 'basalt', 'cedar', 'dusk', 'ember', 'fjord', 'granite', 'heath', 'iron', 'juniper', 'kelp', 'lichen', 'moss', 'nimbus', 'ochre', 'pine', 'quartz', 'rain', 'slate', 'tundra', 'umber', 'vale', 'willow', 'zephyr'];
  const B = ['basin', 'brook', 'cairn', 'delta', 'dune', 'falls', 'ford', 'gorge', 'hollow', 'isle', 'knoll', 'mesa', 'moor', 'pass', 'peak', 'ridge', 'scarp', 'shoal', 'spur', 'tarn', 'weald'];
  WS.randomSeedName = function () {
    const r = Math.random;
    return A[(r() * A.length) | 0] + '-' + B[(r() * B.length) | 0] + '-' + ((r() * 90 + 10) | 0);
  };

  // Classic 2D Perlin gradient noise with a seeded permutation.
  WS.Perlin = function (rand) {
    const p = new Uint8Array(512);
    const base = new Uint8Array(256);
    for (let i = 0; i < 256; i++) base[i] = i;
    for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = base[i]; base[i] = base[j]; base[j] = t; }
    for (let i = 0; i < 512; i++) p[i] = base[i & 255];
    const GX = new Float32Array(16), GY = new Float32Array(16);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + 0.1; GX[i] = Math.cos(a); GY[i] = Math.sin(a); }
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    this.noise = function (x, y) {
      const xf = Math.floor(x), yf = Math.floor(y);
      const X = xf & 255, Y = yf & 255;
      x -= xf; y -= yf;
      const u = fade(x), v = fade(y);
      const aa = p[p[X] + Y] & 15, ab = p[p[X] + Y + 1] & 15, ba = p[p[X + 1] + Y] & 15, bb = p[p[X + 1] + Y + 1] & 15;
      const n00 = GX[aa] * x + GY[aa] * y;
      const n10 = GX[ba] * (x - 1) + GY[ba] * y;
      const n01 = GX[ab] * x + GY[ab] * (y - 1);
      const n11 = GX[bb] * (x - 1) + GY[bb] * (y - 1);
      const nx0 = n00 + u * (n10 - n00), nx1 = n01 + u * (n11 - n01);
      return (nx0 + v * (nx1 - nx0)) * 1.4;
    };
    this.fbm = function (x, y, oct, lac = 2, gain = 0.5) {
      let s = 0, a = 1, f = 1, norm = 0;
      for (let o = 0; o < oct; o++) { s += a * this.noise(x * f, y * f); norm += a; a *= gain; f *= lac; }
      return s / norm;
    };
    // Ridged multifractal: sharp crests where noise crosses zero.
    this.ridged = function (x, y, oct, lac = 2.05, gain = 0.5) {
      let s = 0, a = 1, f = 1, w = 1, norm = 0;
      for (let o = 0; o < oct; o++) {
        let r = 1 - Math.abs(this.noise(x * f, y * f));
        r *= r; r *= w;
        w = Math.min(1, Math.max(0, r * 2));
        s += r * a; norm += a; a *= gain; f *= lac;
      }
      return s / norm;
    };
  };
})();
