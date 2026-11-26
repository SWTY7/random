// Cognate: shared utilities. Seeded RNG, value noise, small helpers.
'use strict';
(function (G) {
  const CG = G.CG = G.CG || {};

  CG.clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  CG.lerp = (a, b, t) => a + (b - a) * t;

  CG.hashSeed = str => {
    let h = 0x811c9dc5;
    str = String(str);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  };

  // sfc32 seeded through splitmix32.
  class RNG {
    constructor(seed = 1) {
      let x = seed >>> 0;
      const sm = () => {
        x = (x + 0x9e3779b9) | 0;
        let z = x;
        z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
        z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
        return (z ^ (z >>> 16)) >>> 0;
      };
      this.a = sm(); this.b = sm(); this.c = sm(); this.d = sm();
      for (let i = 0; i < 12; i++) this.u32();
    }
    u32() {
      let { a, b, c, d } = this;
      const t = (((a + b) | 0) + d) | 0;
      d = (d + 1) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      c = (c + t) | 0;
      this.a = a; this.b = b; this.c = c; this.d = d;
      return t >>> 0;
    }
    next() { return this.u32() / 4294967296; }
    range(a, b) { return a + (b - a) * this.next(); }
    int(n) { return Math.floor(this.next() * n); }
    chance(p) { return this.next() < p; }
    pick(arr) { return arr[this.int(arr.length)]; }
    // Pick from [[item, weight], ...] or from items with a weight function.
    weighted(items, wf) {
      let tot = 0;
      const ws = items.map(it => { const w = Math.max(0, wf ? wf(it) : it[1]); tot += w; return w; });
      if (tot <= 0) return null;
      let r = this.next() * tot;
      for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r < 0) return wf ? items[i] : items[i][0]; }
      return wf ? items[items.length - 1] : items[items.length - 1][0];
    }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) { const j = this.int(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      return arr;
    }
    fork(tag) { return new RNG((this.u32() ^ CG.hashSeed(tag || '')) >>> 0); }
    get state() { return [this.a, this.b, this.c, this.d]; }
    set state(s) { [this.a, this.b, this.c, this.d] = s; }
  }
  CG.RNG = RNG;

  // Value noise with fBm, seeded.
  CG.makeNoise = seed => {
    const rng = new RNG(seed);
    const P = 256, perm = new Uint8Array(P * 2), val = new Float32Array(P);
    for (let i = 0; i < P; i++) { perm[i] = i; val[i] = rng.next(); }
    for (let i = P - 1; i > 0; i--) { const j = rng.int(i + 1); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < P; i++) perm[P + i] = perm[i];
    const h = (x, y) => val[perm[(perm[x & 255] + y) & 511] & 255];
    const sm = t => t * t * (3 - 2 * t);
    const n2 = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
      const u = sm(xf), v = sm(yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    return (x, y, oct = 5, lac = 2, gain = 0.5) => {
      let s = 0, amp = 1, f = 1, norm = 0;
      for (let o = 0; o < oct; o++) { s += amp * n2(x * f + o * 17.3, y * f - o * 9.1); norm += amp; amp *= gain; f *= lac; }
      return s / norm;
    };
  };

  CG.levenshtein = (a, b) => {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = new Array(n + 1), cur = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      [prev, cur] = [cur, prev];
    }
    return prev[n];
  };

  CG.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // HSL to CSS string
  CG.hsl = (h, s, l, a) => a == null ? `hsl(${h.toFixed(1)},${s}%,${l}%)` : `hsla(${h.toFixed(1)},${s}%,${l}%,${a})`;
  CG.hslRGB = (h, s, l) => {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  };

  CG.fmtYear = y => `${Math.round(y).toLocaleString('en-US')}`;
})(globalThis);
