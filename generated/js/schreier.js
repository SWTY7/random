/* Randomised Schreier–Sims: the order of a permutation group without listing its elements.
 * Builds a base b1, b2, … and transversals for the stabiliser chain G = G1 ≥ G2 ≥ … ≥ 1,
 * where G(i+1) fixes b1..bi. Then |G| = |orbit of b1 under G1| · |orbit of b2 under G2| · …
 * Random elements (product replacement) are sifted through the chain. A failed sift adds a new
 * strong generator. After K successes in a row, the chain is complete with probability ≥ 1 − 2^(−K). */
(function (root) {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('./perm.js') : root.Perm;

  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  function schreierSims(gens, opts) {
    opts = opts || {};
    const n = gens.reduce((m, g) => Math.max(m, g.length), 0);
    const gs = gens.map((g) => P.pad(g, n)).filter((g) => !P.isIdentity(g));
    const K = opts.confidence || 40, rand = rng(opts.seed || 1234567);
    const levels = []; // { b, gens, T: Map point -> [u, u^-1] }

    function orbit(L) {
      L.T = new Map([[L.b, [P.identity(n), P.identity(n)]]]);
      const queue = [L.b];
      for (let h = 0; h < queue.length; h++) {
        const y = queue[h], u = L.T.get(y)[0];
        for (const s of L.gens) {
          const z = s[y];
          if (!L.T.has(z)) { const v = P.compose(u, s); L.T.set(z, [v, P.inverse(v)]); queue.push(z); }
        }
      }
    }
    function sift(g) {
      for (let j = 0; j < levels.length; j++) {
        const t = levels[j].T.get(g[levels[j].b]);
        if (!t) return { g, j };
        g = P.compose(g, t[1]);
      }
      return { g, j: levels.length };
    }
    function add(g, j) {
      if (j === levels.length) levels.push({ b: g.findIndex((x, i) => x !== i), gens: [] });
      // a new strong generator fixes b1..b(j-1), so it belongs to every level from j down the chain where it moves the base point
      for (let k = j; k < levels.length; k++) {
        levels[k].gens.push(g);
        orbit(levels[k]);
        if (g[levels[k].b] !== levels[k].b) break;
      }
    }
    function siftIn(g) {
      const r = sift(g);
      if (P.isIdentity(r.g)) return true;
      add(r.g, r.j);
      return false;
    }
    gs.forEach((g) => siftIn(g));
    // product replacement for (nearly) uniform random elements
    const R = gs.length ? gs.slice() : [P.identity(n)];
    while (R.length < 10) R.push(R[R.length % Math.max(1, gs.length)] || P.identity(n));
    let acc = P.identity(n);
    const step = () => {
      const i = Math.floor(rand() * R.length); let j = Math.floor(rand() * (R.length - 1)); if (j >= i) j++;
      R[i] = rand() < 0.5 ? P.compose(R[i], R[j]) : P.compose(R[i], P.inverse(R[j]));
      acc = P.compose(acc, R[i]);
      return acc;
    };
    for (let k = 0; k < 50; k++) step();
    let ok = 0, rounds = 0;
    while (ok < K && rounds < 20000) { rounds++; if (siftIn(step())) ok++; else ok = 0; }
    let order = 1n;
    levels.forEach((L) => { order *= BigInt(L.T.size); });
    const contains = (g) => P.isIdentity(sift(P.pad(g, n)).g);
    return { order, base: levels.map((L) => L.b), orbitSizes: levels.map((L) => L.T.size), n, confidence: K, contains };
  }

  const api = { schreierSims };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Schreier = api;
})(typeof window !== 'undefined' ? window : this);
