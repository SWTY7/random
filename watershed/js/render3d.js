// Oblique 3D view: a height-field ray caster that draws columns front to back.
var WS = globalThis.WS || (globalThis.WS = {});

(function () {
  WS.Voxel = class {
    constructor() { this.w = 0; this.h = 0; }

    resize(w, h) {
      if (w === this.w && h === this.h) return;
      this.w = w; this.h = h;
      this.canvas = this.canvas || document.createElement('canvas');
      this.canvas.width = w; this.canvas.height = h;
      this.ctx = this.canvas.getContext('2d');
      this.img = this.ctx.createImageData(w, h);
      this.buf = new Uint32Array(this.img.data.buffer);
      this.ybuf = new Float32Array(w);
      this.sky = new Uint32Array(h);
    }

    // cam: { yaw, elev, dist } with dist in map widths; vex: vertical exaggeration
    render(world, cmap, cam, vex) {
      const n = world.n, H = world.h, Wt = world.W, sea = world.sea;
      const w = this.w, h = this.h, buf = this.buf, yb = this.ybuf;
      if (!this.surf || this.surf.length !== n * n) { this.surf = new Float32Array(n * n); this.wet = new Uint8Array(n * n); }
      const surf = this.surf, wet = this.wet;
      const VS = WS.Z * n * vex;
      for (let i = 0; i < n * n; i++) {
        const hv = H[i];
        if (hv < sea) { surf[i] = sea * VS; wet[i] = 1; }
        else if (world.lake[i] === 1) { surf[i] = Wt[i] * VS; wet[i] = 1; }
        else { surf[i] = hv * VS; wet[i] = 0; }
      }
      // camera
      const c = n / 2, d = cam.dist * n;
      const cx = c + Math.sin(cam.yaw) * d, cy = c + Math.cos(cam.yaw) * d;
      const fx = c - cx, fy = c - cy, fl = Math.hypot(fx, fy) || 1;
      const ux = fx / fl, uy = fy / fl;           // forward
      const rx = -uy, ry = ux;                    // right
      const centerH = world.hmax * VS * 0.45;
      const camH = centerH + Math.tan(cam.elev) * d + n * 0.04;
      const tanHalf = Math.tan(0.5 * 0.95);        // ~54° horizontal field of view
      const focal = (w / 2) / tanHalf;
      const horizon = h * 0.52 - ((camH - centerH) / fl) * focal;
      const far = d + n * 1.6;

      // sky
      for (let y = 0; y < h; y++) {
        const t = Math.min(1, Math.max(0, (y - horizon + h * 0.6) / (h * 0.9)));
        const r = 120 + 110 * t, g = 160 + 75 * t, b = 205 + 35 * t;
        this.sky[y] = (255 << 24) | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
      }
      for (let x = 0; x < w; x++) yb[x] = h;
      for (let y = 0; y < h; y++) buf.fill(this.sky[y], y * w, y * w + w);

      const FR = 214, FG = 226, FB = 236; // haze
      let z = 1, dz = 0.35;
      while (z < far) {
        const lx = cx + ux * z - rx * z * tanHalf, ly = cy + uy * z - ry * z * tanHalf;
        const sx = (rx * 2 * z * tanHalf) / w, sy = (ry * 2 * z * tanHalf) / w;
        const inv = focal / z;
        const fog = Math.min(1, Math.max(0, (z - d * 0.85) / (far - d * 0.85))) ** 1.4 * 0.85;
        let px = lx, py = ly;
        for (let x = 0; x < w; x++, px += sx, py += sy) {
          if (px < 0 || py < 0 || px >= n || py >= n) continue;
          const i = (py | 0) * n + (px | 0);
          const top = (camH - surf[i]) * inv + horizon;
          const yt = top < 0 ? 0 : top | 0;
          const ybot = yb[x];
          if (yt >= ybot) continue;
          let col = cmap[i];
          let r = col & 255, g = (col >> 8) & 255, b = (col >> 16) & 255;
          if (wet[i]) { const s = 0.18 + 0.25 * Math.min(1, z / far); r += (200 - r) * s; g += (222 - g) * s; b += (240 - b) * s; }
          r += (FR - r) * fog; g += (FG - g) * fog; b += (FB - b) * fog;
          col = (255 << 24) | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
          // the near edge of the map shows its strata
          const edge = ybot === h && (px < 1.5 || py < 1.5 || px > n - 1.5 || py > n - 1.5);
          if (edge) {
            for (let y = yt, o = yt * w + x; y < ybot; y++, o += w) {
              const t = y - yt;
              if (t < 2) { buf[o] = col; continue; }
              const k = (0.82 - Math.min(0.4, t / h)) * ((((t + (x >> 5)) / 7) | 0) & 1 ? 0.88 : 1);
              buf[o] = (255 << 24) | (((70 * k) | 0) << 16) | (((96 * k) | 0) << 8) | ((128 * k) | 0);
            }
          } else {
            for (let y = yt, o = yt * w + x; y < ybot; y++, o += w) buf[o] = col;
          }
          yb[x] = yt;
        }
        z += dz;
        dz *= 1.006;
        if (dz > 2.5) dz = 2.5;
      }
      this.ctx.putImageData(this.img, 0, 0);
      return this.canvas;
    }
  };
})();
