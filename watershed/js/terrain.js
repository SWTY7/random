// The world: heightmap generation, droplet erosion, scree, uplift and drainage.
var WS = globalThis.WS || (globalThis.WS = {});

(function () {
  // Rendering scale: a height of 1 is a quarter of the map's width.
  WS.Z = 0.25;
  // Units shown to people: the map is 24 km across, a height of 1 is 2500 m.
  WS.MAP_KM = 24;
  WS.HEIGHT_M = 2500;

  WS.PRESETS = {
    highlands:   { name: 'Highlands',      seaQ: 0.05, blurb: 'Warped hills and ridges with a little coast.' },
    archipelago: { name: 'Archipelago',    seaQ: 0.64, blurb: 'A scatter of islands. Watch the deltas grow.' },
    volcano:     { name: 'Volcanic island', seaQ: 0.55, blurb: 'One cone with a crater lake, waiting for gullies.' },
    alps:        { name: 'Alpine ridges',  seaQ: 0.02, blurb: 'Sharp crests. Turn on scree for talus slopes.' },
    mesa:        { name: 'Mesa country',   seaQ: 0.04, blurb: 'Terraced tablelands that rain turns into canyons.' },
    rolling:     { name: 'Rolling hills',  seaQ: 0.12, blurb: 'Gentle and low. Rivers meander more here.' },
    plateau:     { name: 'Blank plateau',  seaQ: -1,   blurb: 'A tilted slab of clay for sculpting by hand.' },
  };

  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  WS.generate = function (preset, seed, n) {
    const rand = WS.rng(seed);
    const P = new WS.Perlin(rand), Q = new WS.Perlin(rand);
    const ox = rand() * 200, oy = rand() * 200;
    const h = new Float32Array(n * n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const u = x / (n - 1), v = y / (n - 1);
        const wx = u + 0.13 * Q.fbm(u * 2.1 + 5.2, v * 2.1 + 1.3, 4);
        const wy = v + 0.13 * Q.fbm(u * 2.1 + 9.7, v * 2.1 + 7.1, 4);
        const cx = u - 0.5, cy = v - 0.5;
        let val;
        switch (preset) {
          case 'archipelago': {
            const d = Math.sqrt(cx * cx + cy * cy) * 2;
            val = P.fbm(wx * 3.6 + ox, wy * 3.6 + oy, 7) + 0.25 * P.ridged(wx * 3 + oy, wy * 3 + ox, 5) - 0.55 * d * d;
            break;
          }
          case 'volcano': {
            const r = Math.sqrt((wx - 0.5) ** 2 + (wy - 0.5) ** 2);
            let cone = Math.max(0, 1 - r / 0.44); cone = Math.pow(cone, 1.7);
            const crater = 0.32 * Math.exp(-((r / 0.055) ** 2));
            const ang = Math.atan2(wy - 0.5, wx - 0.5);
            const gull = P.ridged(Math.cos(ang) * 3 + ox, Math.sin(ang) * 3 + r * 6 + oy, 4);
            val = cone - crater + 0.08 * gull * cone + 0.07 * P.fbm(wx * 5 + ox, wy * 5 + oy, 6);
            break;
          }
          case 'alps': {
            const r = P.ridged(wx * 2.7 + ox, wy * 2.7 + oy, 7);
            val = Math.pow(r, 1.4) + 0.18 * P.fbm(wx * 2 + oy, wy * 2 + ox, 4);
            break;
          }
          case 'mesa': {
            val = P.fbm(wx * 2.4 + ox, wy * 2.4 + oy, 6) + 0.15 * P.fbm(u * 9 + oy, v * 9 + ox, 3);
            break;
          }
          case 'rolling': {
            val = P.fbm(wx * 2.2 + ox, wy * 2.2 + oy, 5, 2, 0.45);
            break;
          }
          case 'plateau': {
            val = 0.5 + 0.1 * (1 - v) + 0.04 * u + 0.006 * P.fbm(u * 10 + ox, v * 10 + oy, 4);
            break;
          }
          default: { // highlands
            const a = P.fbm(wx * 3 + ox, wy * 3 + oy, 7);
            const r = P.ridged(wx * 2.4 + oy + 20, wy * 2.4 + ox, 6);
            val = a * 0.75 + r * 0.5;
          }
        }
        h[y * n + x] = val;
      }
    }
    if (preset !== 'plateau') {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < h.length; i++) { if (h[i] < lo) lo = h[i]; if (h[i] > hi) hi = h[i]; }
      const k = 1 / (hi - lo || 1);
      for (let i = 0; i < h.length; i++) h[i] = (h[i] - lo) * k;
      if (preset === 'highlands') for (let i = 0; i < h.length; i++) h[i] = Math.pow(h[i], 1.25);
      if (preset === 'mesa') {
        const steps = 6;
        for (let i = 0; i < h.length; i++) {
          const s = h[i] * steps, f = s - Math.floor(s);
          h[i] = (Math.floor(s) + smooth(0.4, 0.6, f)) / steps * 0.9 + h[i] * 0.1;
        }
      }
      if (preset === 'rolling') for (let i = 0; i < h.length; i++) h[i] = 0.1 + h[i] * 0.42;
    }
    const meta = WS.PRESETS[preset] || WS.PRESETS.highlands;
    let sea;
    if (meta.seaQ < 0) sea = 0.3;
    else {
      const s = Float32Array.from(h).sort();
      sea = s[Math.min(s.length - 1, Math.floor(meta.seaQ * s.length))] + 1e-4;
    }
    return { h, sea };
  };

  WS.World = class {
    constructor(n) {
      this.n = n;
      const N = n * n;
      this.h = new Float32Array(N);
      this.orig = new Float32Array(N);
      this.mask = new Float32Array(N);
      this.W = new Float32Array(N);      // water surface (filled terrain)
      this.acc = new Float32Array(N);    // upstream area in cells
      this.moist = new Float32Array(N);
      this.tmp = new Float32Array(N);
      this.rec = new Int32Array(N);
      this.order = new Int32Array(N);
      this.vis = new Uint8Array(N);
      this.lake = new Uint8Array(N);     // 1 where a lake big enough to draw
      this.stack = new Int32Array(N);
      this.heapK = new Float32Array(N);
      this.heapI = new Int32Array(N);
      this.sea = 0.2;
      this.hmax = 1;
      this.lakeMin = 0.006;
      this.springs = [];
      this.stats = { drops: 0, eroded: 0, toSea: 0, lakeCells: 0, maxAcc: 0 };
      this.p = {
        inertia: 0.05, capacity: 4, minCap: 0.01, erosion: 0.3, deposition: 0.3,
        evaporation: 0.015, gravity: 4, maxLife: 80, thermal: 0.15, uplift: 0, rainMode: 'uniform',
      };
      this.setRadius(3);
    }

    load(h, sea) {
      this.h.set(h); this.orig.set(h); this.sea = sea; this.sea0 = sea;
      const k = 1 / Math.max(1e-6, 1 - sea);
      for (let i = 0; i < h.length; i++) { const m = (h[i] - sea) * k; this.mask[i] = m <= 0 ? 0 : Math.pow(m, 0.8); }
      this.springs = [];
      this.stats = { drops: 0, eroded: 0, toSea: 0, lakeCells: 0, maxAcc: 0 };
      this.hydrology();
    }

    setRadius(r) {
      const dx = [], dy = [], w = [];
      let sum = 0;
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d < r) { dx.push(x); dy.push(y); w.push(r - d); sum += r - d; }
      }
      this.kdx = Int32Array.from(dx); this.kdy = Int32Array.from(dy);
      this.kw = Float32Array.from(w.map(v => v / sum));
    }

    heightAt(x, y) {
      const n = this.n;
      x = Math.max(0, Math.min(n - 1.001, x)); y = Math.max(0, Math.min(n - 1.001, y));
      const ix = x | 0, iy = y | 0, fx = x - ix, fy = y - iy, i = iy * n + ix, h = this.h;
      const i1 = ix + 1 < n ? i + 1 : i, i2 = iy + 1 < n ? i + n : i, i3 = ix + 1 < n && iy + 1 < n ? i + n + 1 : i;
      return h[i] * (1 - fx) * (1 - fy) + h[i1] * fx * (1 - fy) + h[i2] * (1 - fx) * fy + h[i3] * fx * fy;
    }

    spread(x, y, amt) {
      const n = this.n, h = this.h, KX = this.kdx, KY = this.kdy, KW = this.kw;
      for (let q = 0; q < KW.length; q++) {
        const xx = x + KX[q], yy = y + KY[q];
        if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
        h[yy * n + xx] += amt * KW[q];
      }
    }

    // One raindrop, after Hans Theobald Beyer's particle erosion model.
    drop(px, py) {
      const n = this.n, h = this.h, p = this.p, k = n / 256;
      const inertia = p.inertia, capF = p.capacity, minCap = p.minCap, eroS = p.erosion, depS = p.deposition;
      const evap = p.evaporation, grav = p.gravity, sea = this.sea, maxLife = p.maxLife;
      const KX = this.kdx, KY = this.kdy, KW = this.kw, KL = KW.length;
      let dx = 0, dy = 0, speed = 1, water = 1, sed = 0, eroded = 0;
      let alive = true;
      this.stats.drops++;
      for (let life = 0; life < maxLife; life++) {
        const nx = px | 0, ny = py | 0, i = ny * n + nx, ox = px - nx, oy = py - ny;
        const a = h[i], b = h[i + 1], c = h[i + n], d = h[i + n + 1];
        const gx = (b - a) * (1 - oy) + (d - c) * oy;
        const gy = (c - a) * (1 - ox) + (d - b) * ox;
        const hh = a * (1 - ox) * (1 - oy) + b * ox * (1 - oy) + c * (1 - ox) * oy + d * ox * oy;
        dx = dx * inertia - gx * (1 - inertia);
        dy = dy * inertia - gy * (1 - inertia);
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1e-12) { const t = Math.random() * 6.2832; dx = Math.cos(t); dy = Math.sin(t); }
        else { dx /= len; dy /= len; }
        px += dx; py += dy;
        if (px < 1 || py < 1 || px >= n - 2 || py >= n - 2) { alive = false; break; } // sediment leaves the map
        const mx = px | 0, my = py | 0, j = my * n + mx, qx = px - mx, qy = py - my;
        const nh = h[j] * (1 - qx) * (1 - qy) + h[j + 1] * qx * (1 - qy) + h[j + n] * (1 - qx) * qy + h[j + n + 1] * qx * qy;
        const dh = nh - hh;
        if (nh < sea) { // reached the sea: the load settles here and builds a delta
          if (sed > 0) { this.spread(mx, my, sed); this.stats.toSea += sed; }
          sed = 0; alive = false; break;
        }
        const cap = Math.max(-dh * k * speed * water * capF, minCap);
        if (sed > cap || dh > 0) {
          const amt = dh > 0 ? Math.min(dh, sed) : (sed - cap) * depS;
          sed -= amt;
          h[i] += amt * (1 - ox) * (1 - oy); h[i + 1] += amt * ox * (1 - oy);
          h[i + n] += amt * (1 - ox) * oy; h[i + n + 1] += amt * ox * oy;
        } else {
          const amt = Math.min((cap - sed) * eroS, -dh);
          for (let q = 0; q < KL; q++) {
            const xx = nx + KX[q], yy = ny + KY[q];
            if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
            h[yy * n + xx] -= amt * KW[q];
          }
          sed += amt; eroded += amt;
        }
        speed = Math.sqrt(Math.max(0, speed * speed - dh * k * grav));
        water *= 1 - evap;
        if (water < 0.01) break;
      }
      if (alive && sed > 0) { // evaporated: drop what is left where it stands
        const mx = px | 0, my = py | 0, i = my * n + mx, ox = px - mx, oy = py - my;
        h[i] += sed * (1 - ox) * (1 - oy); h[i + 1] += sed * ox * (1 - oy);
        h[i + n] += sed * (1 - ox) * oy; h[i + n + 1] += sed * ox * oy;
      }
      this.stats.eroded += eroded;
    }

    // Pick a landing spot for rain. Returns false when it fell into the sea.
    rain(count, budgetMs) {
      const n = this.n, h = this.h, sea = this.sea, oro = this.p.rainMode === 'mountains';
      const span = Math.max(1e-6, this.hmax - sea);
      const t0 = performance.now();
      for (let c = 0; c < count; c++) {
        const x = 1 + Math.random() * (n - 3), y = 1 + Math.random() * (n - 3);
        const hv = h[(y | 0) * n + (x | 0)];
        if (hv < sea) continue;
        if (oro && Math.random() > 0.15 + 0.85 * Math.min(1, (hv - sea) / span)) continue;
        this.drop(x, y);
        if ((c & 63) === 63 && performance.now() - t0 > budgetMs) return c;
      }
      return count;
    }

    rainAt(cx, cy, r, count) {
      const n = this.n;
      for (let c = 0; c < count; c++) {
        const a = Math.random() * 6.2832, d = r * Math.sqrt(Math.random());
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        if (x < 1 || y < 1 || x >= n - 2 || y >= n - 2) continue;
        if (this.h[(y | 0) * n + (x | 0)] < this.sea) continue;
        this.drop(x, y);
      }
    }

    // Material slumps from slopes steeper than the angle of repose.
    thermal(strength) {
      if (strength <= 0) return;
      const n = this.n, h = this.h;
      const talus = 1.1 / (WS.Z * n), talusD = talus * Math.SQRT2;
      const offs = [1, -1, n, -n, n + 1, n - 1, -n + 1, -n - 1];
      const lim = [talus, talus, talus, talus, talusD, talusD, talusD, talusD];
      const rate = 0.25 * strength;
      for (let y = 1; y < n - 1; y++) {
        for (let x = 1; x < n - 1; x++) {
          const i = y * n + x, hi = h[i];
          let best = 0, bj = -1;
          for (let k = 0; k < 8; k++) {
            const ex = hi - h[i + offs[k]] - lim[k];
            if (ex > best) { best = ex; bj = i + offs[k]; }
          }
          if (bj >= 0) { const m = best * rate; h[i] -= m; h[bj] += m; }
        }
      }
    }

    upliftStep(rate) {
      if (rate <= 0) return;
      const h = this.h, m = this.mask, r = rate * 2e-5;
      for (let i = 0; i < h.length; i++) h[i] += r * m[i];
    }

    // Priority-flood: fills pits into lakes, routes every cell to the sea or the edge,
    // then accumulates upstream area so rivers can be drawn.
    hydrology() {
      const n = this.n, N = n * n, h = this.h, W = this.W, rec = this.rec, order = this.order, vis = this.vis;
      const HK = this.heapK, HI = this.heapI, sea = this.sea;
      vis.fill(0);
      let size = 0;
      const push = (i, k) => {
        let c = size++;
        while (c > 0) {
          const p = (c - 1) >> 1;
          if (HK[p] <= k) break;
          HK[c] = HK[p]; HI[c] = HI[p]; c = p;
        }
        HK[c] = k; HI[c] = i;
      };
      const pop = () => {
        const top = HI[0];
        const lk = HK[--size], li = HI[size];
        let c = 0;
        for (;;) {
          let m = 2 * c + 1;
          if (m >= size) break;
          if (m + 1 < size && HK[m + 1] < HK[m]) m++;
          if (HK[m] >= lk) break;
          HK[c] = HK[m]; HI[c] = HI[m]; c = m;
        }
        HK[c] = lk; HI[c] = li;
        return top;
      };
      let hmax = -Infinity;
      for (let i = 0; i < N; i++) {
        if (h[i] > hmax) hmax = h[i];
        const x = i % n, y = (i / n) | 0;
        if (h[i] < sea || x === 0 || y === 0 || x === n - 1 || y === n - 1) {
          vis[i] = 1; W[i] = Math.max(h[i], sea); rec[i] = -1; push(i, W[i]);
        }
      }
      this.hmax = hmax;
      const eps = 2e-7;
      let k = 0;
      const NX = [1, -1, 0, 0, 1, -1, 1, -1], NY = [0, 0, 1, -1, 1, 1, -1, -1];
      while (size > 0) {
        const c = pop();
        order[k++] = c;
        const cx = c % n, cy = (c / n) | 0, wc = W[c];
        for (let q = 0; q < 8; q++) {
          const x = cx + NX[q], y = cy + NY[q];
          if (x < 0 || y < 0 || x >= n || y >= n) continue;
          const j = y * n + x;
          if (vis[j]) continue;
          vis[j] = 1;
          const w = h[j] > wc + eps ? h[j] : wc + eps;
          W[j] = w; rec[j] = c; push(j, w);
        }
      }
      const acc = this.acc;
      acc.fill(1);
      let maxAcc = 0, lakes = 0;
      for (let q = k - 1; q >= 0; q--) {
        const c = order[q], r = rec[c];
        if (r >= 0) acc[r] += acc[c];
      }
      // lakes: connected wet cells; tiny puddles are not drawn
      const lake = this.lake, st = this.stack, minArea = Math.max(6, Math.round(N / 4000));
      lake.fill(0);
      for (let i = 0; i < N; i++) if (h[i] >= sea && W[i] - h[i] > this.lakeMin) lake[i] = 2;
      for (let i = 0; i < N; i++) {
        if (lake[i] !== 2) continue;
        let sp = 0, cnt = 0, head = 0;
        st[sp++] = i; lake[i] = 3;
        while (head < sp) {
          const c = st[head++]; cnt++;
          const cx = c % n;
          if (cx > 0 && lake[c - 1] === 2) { lake[c - 1] = 3; st[sp++] = c - 1; }
          if (cx < n - 1 && lake[c + 1] === 2) { lake[c + 1] = 3; st[sp++] = c + 1; }
          if (c >= n && lake[c - n] === 2) { lake[c - n] = 3; st[sp++] = c - n; }
          if (c < N - n && lake[c + n] === 2) { lake[c + n] = 3; st[sp++] = c + n; }
        }
        const v = cnt >= minArea ? 1 : 0;
        for (let q = 0; q < sp; q++) lake[st[q]] = v;
        if (v) lakes += cnt;
      }
      for (let i = 0; i < N; i++) if (h[i] >= sea && !lake[i] && acc[i] > maxAcc) maxAcc = acc[i];
      this.stats.lakeCells = lakes; this.stats.maxAcc = maxAcc;
      this.moisture();
    }

    moisture() {
      const n = this.n, N = n * n, acc = this.acc, m = this.moist, t = this.tmp, h = this.h, W = this.W, sea = this.sea;
      const ref = Math.log(1 + n * n * 0.01);
      for (let i = 0; i < N; i++) {
        const wet = h[i] < sea || this.lake[i] === 1;
        m[i] = wet ? 1 : Math.min(1, Math.log(1 + acc[i]) / ref);
      }
      const r = Math.max(2, Math.round(n / 64));
      for (let pass = 0; pass < 2; pass++) { boxBlur(m, t, n, r, true); boxBlur(t, m, n, r, false); }
    }
  };

  // Separable running-sum box blur, clamped at the borders.
  function boxBlur(src, dst, n, r, horiz) {
    const inv = 1 / (2 * r + 1);
    for (let a = 0; a < n; a++) {
      let s = 0;
      const at = b => { b = b < 0 ? 0 : b >= n ? n - 1 : b; return horiz ? src[a * n + b] : src[b * n + a]; };
      for (let b = -r; b <= r; b++) s += at(b);
      for (let b = 0; b < n; b++) {
        if (horiz) dst[a * n + b] = s * inv; else dst[b * n + a] = s * inv;
        s += at(b + r + 1) - at(b - r);
      }
    }
  }
})();
