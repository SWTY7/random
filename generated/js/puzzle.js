/* Turns a level description into a solvable model: generator permutations, start/target states,
 * the orbit (Schreier graph) of the start, and the distance of every state to the target. */
(function (root) {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('./perm.js') : root.Perm;

  function prepare(lv) {
    const n = lv.pos.length;
    const gens = lv.gens.map((g) => P.fromCycles(g.cycles, n));
    const start = lv.tokens.slice();
    let target;
    if (Array.isArray(lv.target)) target = lv.target.slice();
    else {
      target = start;
      for (const ch of lv.target) {
        const gi = lv.gens.findIndex((g) => g.key === ch);
        if (gi < 0) throw new Error(lv.id + ': unknown move ' + ch);
        target = P.act(target, gens[gi]);
      }
    }
    // Orbit of the start under forward moves: nodes, BFS tree, and edge list for drawing.
    const orbit = P.bfs(start, gens, P.act, 50000);
    if (orbit.overflow) throw new Error(lv.id + ': orbit too large');
    const edges = [];
    orbit.nodes.forEach((s, i) => gens.forEach((g, gi) => {
      const j = orbit.index.get(P.key(P.act(s, g)));
      if (j !== i) edges.push([i, j, gi]);
    }));
    // Distance to target: BFS from the target using inverse moves.
    const inv = gens.map(P.inverse);
    const back = P.bfs(target, inv, P.act, 50000);
    const distTo = orbit.nodes.map((s) => { const k = back.index.get(P.key(s)); return k === undefined ? Infinity : back.dist[k]; });
    const reachable = distTo[0] !== Infinity;
    const group = P.generate(gens, 50000);
    const genOrders = gens.map(P.order);
    const relation = lv.goal === 'relation' ? shortestRelation(gens, genOrders) : null;
    return {
      relation,
      lv, n, gens, genOrders, start, target, orbit, edges, distTo, reachable,
      par: relation ? relation.length : reachable ? distTo[0] : null,
      groupOrder: group.overflow ? null : group.size,
      stabiliser: group.overflow ? null : group.size / orbit.size,
    };
  }

  /* A word is "lazy" if it collapses to nothing by cancelling runs g^k with k a multiple of g's order. */
  function isTrivial(word, orders) {
    const st = [];
    for (const g of word) {
      const top = st[st.length - 1];
      if (top && top[0] === g) { top[1]++; if (top[1] % orders[g] === 0) st.pop(); }
      else st.push([g, 1]);
    }
    return st.length === 0;
  }
  /* Shortest word that returns to the start without being lazy (iterative deepening). */
  function shortestRelation(gens, orders, maxLen) {
    const n = gens[0].length, P_ = P;
    for (let L = 1; L <= (maxLen || 12); L++) {
      const w = [];
      const found = (function dfs(p) {
        if (w.length === L) return P_.isIdentity(p) && !isTrivial(w, orders) ? w.slice() : null;
        for (let g = 0; g < gens.length; g++) { w.push(g); const r = dfs(P_.compose(p, gens[g])); w.pop(); if (r) return r; }
        return null;
      })(P_.identity(n));
      if (found) return found;
    }
    return null;
  }

  const api = { prepare, isTrivial, shortestRelation };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Puzzle = api;
})(typeof window !== 'undefined' ? window : this);
