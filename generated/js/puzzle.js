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
    return {
      lv, n, gens, genOrders, start, target, orbit, edges, distTo, reachable,
      par: reachable ? distTo[0] : null,
      groupOrder: group.overflow ? null : group.size,
      stabiliser: group.overflow ? null : group.size / orbit.size,
    };
  }

  const api = { prepare };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Puzzle = api;
})(typeof window !== 'undefined' ? window : this);
