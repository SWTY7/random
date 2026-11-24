// Map rendering: shaded relief with biomes, rivers, lakes and sea.
var WS = globalThis.WS || (globalThis.WS = {});

(function () {
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const pack = (r, g, b) => (255 << 24) | ((b < 0 ? 0 : b > 255 ? 255 : b) << 16) | ((g < 0 ? 0 : g > 255 ? 255 : g) << 8) | (r < 0 ? 0 : r > 255 ? 255 : r);

  // Light from the north-west, fairly high.
  const L = (() => { const v = [-0.55, -0.6, 0.75]; const l = Math.hypot(...v); return v.map(x => x / l); })();

  // Hypsometric ramp for the "Relief" view.
  const HYPSO = [[0, [92, 140, 88]], [0.15, [148, 178, 108]], [0.35, [214, 204, 140]], [0.55, [196, 152, 100]], [0.75, [150, 112, 86]], [0.9, [200, 196, 190]], [1, [252, 252, 252]]];
  function ramp(stops, t, out) {
    for (let k = 1; k < stops.length; k++) {
      if (t <= stops[k][0] || k === stops.length - 1) {
        const [t0, a] = stops[k - 1], [t1, b] = stops[k];
        const f = clamp01((t - t0) / (t1 - t0));
        out[0] = a[0] + (b[0] - a[0]) * f; out[1] = a[1] + (b[1] - a[1]) * f; out[2] = a[2] + (b[2] - a[2]) * f;
        return out;
      }
    }
    return out;
  }

  WS.paint = function (world, out, opt) {
    const n = world.n, sea = world.sea, before = opt.before;
    const H = before ? world.orig : world.h, W = world.W, acc = world.acc, M = world.moist, O = world.orig;
    const S = WS.Z * n, span = Math.max(1e-4, world.hmax - sea);
    const view = opt.view, showRivers = opt.rivers && !before, contours = opt.contours;
    const thr = opt.riverThr * n * n, lthr = Math.log(thr), lrange = Math.log(40);
    const cInt = 40; // contour lines per unit height (100 m)
    const lakeMin = world.lakeMin;
    const c = [0, 0, 0];
    for (let y = 0; y < n; y++) {
      const ym = y > 0 ? -n : 0, yp = y < n - 1 ? n : 0;
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const xm = x > 0 ? -1 : 0, xp = x < n - 1 ? 1 : 0;
        const hv = H[i];
        const gx = (H[i + xp] - H[i + xm]) / ((xp - xm) || 1);
        const gy = (H[i + yp] - H[i + ym]) / (((yp - ym) / n) || 1);
        const sx = gx * S, sy = gy * S;
        const slope = Math.sqrt(sx * sx + sy * sy);
        const shade = clamp01((-sx * L[0] - sy * L[1] + L[2]) / Math.sqrt(sx * sx + sy * sy + 1));
        const isSea = hv < sea;
        const lakeD = before ? 0 : W[i] - hv;
        const isLake = !isSea && !before && world.lake[i] === 1;
        const e = (hv - sea) / span;
        let r, g, b;

        if (view === 'flow') {
          const k = 0.12 + 0.28 * shade;
          r = 30 * k + 8; g = 36 * k + 10; b = 44 * k + 14;
          if (isSea) { r = 6; g = 12; b = 24; }
          else if (isLake) { r = 20; g = 60; b = 110; }
          else {
            const a = clamp01((Math.log(acc[i]) - Math.log(n * 0.25)) / Math.log(n * n * 0.25 / (n * 0.25)));
            const a2 = a * a;
            r += a2 * 120 + a2 * a2 * 130; g += a2 * 200 + a2 * a2 * 55; b += a2 * 230 + a2 * a2 * 25;
          }
        } else if (view === 'change') {
          const d = (hv - O[i]) * 14; // ±0.07 (175 m) saturates
          const k = 0.45 + 0.6 * shade;
          if (isSea) { r = 200; g = 205; b = 210; } else { r = 232; g = 228; b = 220; }
          if (d < 0) { const t = clamp01(-d); r += (196 - r) * t; g += (64 - g) * t; b += (52 - b) * t; }
          else { const t = clamp01(d); r += (40 - r) * t; g += (120 - g) * t; b += (190 - b) * t; }
          r *= k; g *= k; b *= k;
        } else if (isSea) {
          const d = sea - hv, t = Math.sqrt(clamp01(d / 0.18));
          r = 82 + (16 - 82) * t; g = 170 + (52 - 170) * t; b = 182 + (92 - 182) * t;
          const k = 0.82 + 0.25 * shade; r *= k; g *= k; b *= k;
          if (d < 0.006) { const f = 1 - d / 0.006; r += (230 - r) * f * 0.45; g += (240 - g) * f * 0.45; b += (236 - b) * f * 0.45; }
        } else if (isLake) {
          const t = Math.sqrt(clamp01(lakeD / 0.08));
          r = 74 + (28 - 74) * t; g = 146 + (78 - 146) * t; b = 176 + (128 - 176) * t;
          if (lakeD < 0.009) { r += 22; g += 20; b += 10; }
        } else if (view === 'relief') {
          ramp(HYPSO, clamp01(e), c);
          const k = 0.38 + 0.8 * shade; r = c[0] * k; g = c[1] * k; b = c[2] * k;
        } else {
          // natural colours: moisture and altitude pick a biome, slope exposes rock
          const m = M[i];
          const hi = sstep(0.08, 0.5, e);
          const dryR = 200 + (150 - 200) * hi, dryG = 182 + (132 - 182) * hi, dryB = 118 + (96 - 118) * hi;
          const wetR = 92 + (46 - 92) * hi, wetG = 146 + (96 - 146) * hi, wetB = 68 + (58 - 68) * hi;
          const mm = sstep(0.12, 0.6, m);
          r = dryR + (wetR - dryR) * mm; g = dryG + (wetG - dryG) * mm; b = dryB + (wetB - dryB) * mm;
          const alp = sstep(0.55, 0.82, e);
          r += (138 - r) * alp; g += (126 - g) * alp; b += (110 - b) * alp;
          const rock = sstep(0.8, 1.5, slope);
          r += (122 - r) * rock; g += (110 - g) * rock; b += (98 - b) * rock;
          const dep = hv - O[i];
          if (dep > 0.002) { const t = sstep(0.002, 0.03, dep) * 0.5 * (1 - alp); r += (176 - r) * t; g += (170 - g) * t; b += (116 - b) * t; }
          if (sea > 0 && e < 0.02) { const t = 1 - sstep(0.004, 0.02, e); r += (220 - r) * t; g += (204 - g) * t; b += (156 - b) * t; }
          const snow = sstep(0.8, 0.88, e + m * 0.06) * (1 - sstep(0.9, 1.6, slope));
          r += (246 - r) * snow; g += (248 - g) * snow; b += (252 - b) * snow;
          const k = 0.42 + 0.72 * shade; r *= k; g *= k; b *= k;
        }

        if (showRivers && view !== 'flow' && !isSea && !isLake && acc[i] > thr) {
          const a = clamp01((Math.log(acc[i]) - lthr) / lrange);
          const t = 0.45 + 0.55 * a;
          r += (48 - r) * t; g += (104 - g) * t; b += (164 - b) * t;
        }
        if (contours && x < n - 1 && y < n - 1) {
          const l0 = Math.floor((hv - sea) * cInt);
          if (l0 !== Math.floor((H[i + 1] - sea) * cInt) || l0 !== Math.floor((H[i + n] - sea) * cInt)) {
            const major = ((Math.max(l0, Math.floor((H[i + 1] - sea) * cInt), Math.floor((H[i + n] - sea) * cInt))) % 5) === 0;
            const k = major ? 0.55 : 0.78; r *= k; g *= k; b *= k;
          }
        }
        out[i] = pack(r | 0, g | 0, b | 0);
      }
    }
  };
})();
