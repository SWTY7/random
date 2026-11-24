// Primordial: shared utilities. Seeded RNG, noise, maths, encoding.
'use strict';
(function (G) {
  const PR = G.PR = G.PR || {};

  PR.clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  PR.lerp = (a, b, t) => a + (b - a) * t;
  PR.TAU = Math.PI * 2;
  PR.wrapAngle = a => {
    a = (a + Math.PI) % PR.TAU;
    if (a < 0) a += PR.TAU;
    return a - Math.PI;
  };

  // FNV-1a hash of a string to a 32-bit seed.
  PR.hashSeed = str => {
    let h = 0x811c9dc5;
    str = String(str);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  };

  // sfc32 seeded through splitmix32. Small, fast, and its state fits in four integers so it can be saved.
  function splitmix(x) {
    return () => {
      x = (x + 0x9e3779b9) | 0;
      let z = x;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      return (z ^ (z >>> 16)) >>> 0;
    };
  }
  class RNG {
    constructor(seed = 1) {
      const sm = splitmix(seed >>> 0);
      this.a = sm(); this.b = sm(); this.c = sm(); this.d = sm();
      this._g = null;
      for (let i = 0; i < 12; i++) this.u32();
    }
    u32() {
      let a = this.a, b = this.b, c = this.c, d = this.d;
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
    int(n) { return (this.next() * n) | 0; }
    chance(p) { return this.next() < p; }
    pick(arr) { return arr[this.int(arr.length)]; }
    gauss() {
      if (this._g !== null) { const g = this._g; this._g = null; return g; }
      let u, v, s;
      do { u = this.next() * 2 - 1; v = this.next() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
      const m = Math.sqrt(-2 * Math.log(s) / s);
      this._g = v * m;
      return u * m;
    }
    // The cached second gaussian is part of the state too.
    state() { return [this.a | 0, this.b | 0, this.c | 0, this.d | 0, this._g]; }
    setState(s) { this.a = s[0] | 0; this.b = s[1] | 0; this.c = s[2] | 0; this.d = s[3] | 0; this._g = s[4] == null ? null : s[4]; }
  }
  PR.RNG = RNG;

  // Value-noise fBm in [0, 1].
  PR.makeNoise = seed => {
    seed |= 0;
    const hash = (ix, iy) => {
      let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 2246822519)) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const vn = (x, y) => {
      const ix = Math.floor(x), iy = Math.floor(y);
      const fx = x - ix, fy = y - iy;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
    return (x, y, oct = 4) => {
      let s = 0, amp = 1, f = 1, norm = 0;
      for (let o = 0; o < oct; o++) { s += amp * vn(x * f + o * 17.3, y * f - o * 9.1); norm += amp; amp *= 0.5; f *= 2.03; }
      return s / norm;
    };
  };

  // Float32Array <-> base64, for compact saves.
  PR.f32ToB64 = a => {
    const u8 = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64');
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  };
  PR.b64ToF32 = str => {
    let u8;
    if (typeof Buffer !== 'undefined') u8 = new Uint8Array(Buffer.from(str, 'base64'));
    else { const bin = atob(str); u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); }
    return new Float32Array(u8.buffer, 0, u8.length >> 2).slice();
  };

  // Words for seeds that are easy to say out loud.
  const SEED_A = ['amber', 'brine', 'coral', 'delta', 'ember', 'fern', 'glass', 'heron', 'iris', 'jade', 'kelp', 'lumen', 'moss', 'nacre', 'ochre', 'pearl', 'quartz', 'reef', 'silt', 'tidal', 'umber', 'vent', 'whorl', 'xylem', 'yolk', 'zephyr'];
  const SEED_B = ['basin', 'bloom', 'cradle', 'drift', 'eddy', 'flats', 'grotto', 'hollow', 'inlet', 'lagoon', 'marsh', 'pool', 'shoal', 'soup', 'spring', 'tarn', 'trench', 'well'];
  PR.randomSeedName = () => SEED_A[(Math.random() * SEED_A.length) | 0] + '-' + SEED_B[(Math.random() * SEED_B.length) | 0] + '-' + ((Math.random() * 90 + 10) | 0);

  PR.fmt = v => {
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (a >= 1e4) return (v / 1e3).toFixed(1) + 'k';
    return Math.round(v).toLocaleString('en-US');
  };
})(globalThis);
