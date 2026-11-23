/* Subgroup lattice of a small permutation group: every subgroup, inclusions, normality.
 * Works on the element list of Perm.analyse(). Subgroups are bitsets over element indices. */
(function (root) {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('./perm.js') : root.Perm;

  function subgroups(A, limit) {
    const N = A.N, els = A.elements, idx = A.bfs.index;
    const mul = (i, j) => idx.get(P.key(P.compose(els[i], els[j])));
    // closure of a set of element indices
    function close(gens) {
      const seen = new Uint8Array(N), list = [0]; seen[0] = 1;
      for (let h = 0; h < list.length; h++) for (const g of gens) { const k = mul(list[h], g); if (!seen[k]) { seen[k] = 1; list.push(k); } }
      return { seen, list, gens };
    }
    const subs = [], keys = new Map();
    const keyOf = (seen) => { let s = ''; for (let i = 0; i < N; i += 16) { let v = 0; for (let j = 0; j < 16 && i + j < N; j++) if (seen[i + j]) v |= 1 << j; s += String.fromCharCode(v); } return s; };
    function add(S) {
      const k = keyOf(S.seen);
      if (keys.has(k)) return false;
      keys.set(k, subs.length);
      S.gens = minimiseGens(S); S.order = S.list.length; subs.push(S);
      return true;
    }
    function minimiseGens(S) { // drop generators that are not needed
      let gens = S.gens.slice();
      for (let i = gens.length - 1; i >= 0 && gens.length > 1; i--) {
        const g2 = gens.slice(0, i).concat(gens.slice(i + 1));
        if (close(g2).list.length === S.list.length) gens = g2;
      }
      return gens;
    }
    add(close([]));
    for (let i = 1; i < N; i++) add(close([i]));
    // joins until nothing new appears
    for (let a = 1; a < subs.length; a++) {
      for (let b = 1; b < a; b++) {
        if (subs.length > limit) return null;
        const A_ = subs[a], B_ = subs[b];
        if (A_.seen.every((v, i) => !v || B_.seen[i]) || B_.seen.every((v, i) => !v || A_.seen[i])) continue; // nested
        add(close(A_.gens.concat(B_.gens)));
      }
    }
    // inclusions and normality
    const inv = els.map((x) => idx.get(P.key(P.inverse(x))));
    const Ggens = A.gens.map((g) => idx.get(P.key(g)));
    subs.forEach((S) => {
      S.normal = Ggens.every((g) => S.gens.every((h) => S.seen[mul(mul(inv[g], h), g)]));
    });
    subs.sort((x, y) => x.order - y.order);
    const contains = (X, Y) => X.order % Y.order === 0 && Y.list.every((i) => X.seen[i]);
    subs.forEach((S, i) => {
      S.id = i;
      S.below = [];
      for (let j = 0; j < i; j++) if (subs[j].order < S.order && contains(S, subs[j])) S.below.push(j);
    });
    // covering relation (Hasse edges): j below i with nothing in between
    subs.forEach((S) => {
      const below = new Set(S.below);
      S.cover = S.below.filter((j) => !S.below.some((k) => k !== j && subs[k].below.includes(j)));
      S.belowSet = below;
    });
    return subs;
  }

  /* cosets of H: x ~ y iff x and y lie in the same set { h·x } (h first, then x) */
  function cosets(A, S) {
    const N = A.N, idx = A.bfs.index, els = A.elements, label = new Int32Array(N).fill(-1);
    let c = 0;
    for (let x = 0; x < N; x++) {
      if (label[x] >= 0) continue;
      S.list.forEach((h) => { label[idx.get(P.key(P.compose(els[h], els[x])))] = c; });
      c++;
    }
    return { label, count: c };
  }

  const api = { subgroups, cosets };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Lattice = api;
})(typeof window !== 'undefined' ? window : this);
