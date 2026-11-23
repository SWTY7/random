# ⟨g⟩ Generated: a puzzle book about groups

*Every puzzle here is a walk on a group.*

Each level gives you a few moves, and each move is a permutation of the board. Your job is to reach the target arrangement,
or to show that it **can't be done**. While you play, a live 3D **Cayley graph** (or Schreier graph) of the group your moves
generate turns beside the board, and a marker shows where you are in it.

**Play:** open `index.html`. It has no build step, no dependencies and no network calls.

## Contents

| Chapter | Ideas |
|---|---|
| I · Turning | order of an element, cyclic groups, subgroups, Lagrange, ⟨rᵃ, rᵇ⟩ = ⟨r^gcd⟩, cosets |
| II · Mirrors | dihedral groups, rf ≠ fr, presentations, two reflections make a rotation, orbit–stabiliser, Schreier graphs |
| III · Shuffles | Sₙ, inversions and the permutohedron, generating Sₙ with two moves, parity and Aₙ, A₅ |
| IV · Rigid motions | the rotation group of the cube (≅ S₄), handedness and det, Burnside's lemma, a quotient S₄/V₄ ≅ S₃ |
| V · Commutators | [a, b] makes a 3-cycle, conjugation aims it, and an exotic group: PGL(2, 5) ≅ S₅ acting on 6 points |
| VI · Relations | find a loop in the Cayley graph: ab = ba, the braid relation aba = bab, and Hamilton's i² = j² in Q₈ |
| VII · Isomorphism | the cube's rotations permute its 4 long diagonals: an isomorphism onto S₄, and why the action is faithful |

There are 27 puzzles. 8 of them are impossible on purpose, and 3 ask for a relation instead of a target. Once you've solved a level, *Random target* gives you endless variations on it. Each solved puzzle unlocks a short write-up of what just happened, and
each impossible one unlocks a proof.

**Stars.** A reachable target gives: ★ solve · ★ fewest moves (exact, by breadth-first search) · ★ no hints or false claims.
An unreachable target gives: ★ say so · ★ pick the right *reason* from three arguments (each wrong one explains where it fails) · ★ no hints.

**The Lab.** Type generators in cycle notation, such as `a = (1 2 3)` and `b = (3 4 5)`. The Lab returns:
- the group's order and a best-effort name: cyclic, every abelian group up to isomorphism, dihedral, Sₙ, Aₙ, Q₈, and ≅ S₄/S₅ by element-order profile
- whether it is abelian, the size of its centre, and how many elements are even
- a histogram of element orders, and the Lagrange divisors that actually occur as orders
- a drawn Cayley graph (up to 240 elements)
- the **subgroup lattice** as a Hasse diagram (up to order 120), with normal subgroups marked. Click a subgroup to colour the Cayley graph by its cosets.
- **conjugacy classes** and the class equation, with cycle types, plus the class sizes that could add up to a normal subgroup (enough to *prove* A₅ and PSL(2,7) simple). You can also colour the Cayley graph by class or by element order.
- the **cycle index** and Burnside/Pólya counts of k-colourings up to symmetry
- the **Cayley table** as a coloured Latin square (up to order 60)
- **Play it as a puzzle**, which turns any group you type into a playable board
- a word evaluator: `abAB` or `(ab)^3`, where capitals are inverses
- a membership test that also gives the **shortest word** for an element

## Controls

`1`–`4` or the move's letter apply a move · `Z` undo · `0` reset · `H` hint.
Drag the graph to turn it and double-click it to pause. Hover a dot to preview that arrangement and its word, and **click a neighbouring dot to walk there**.
Every generator has its own note, so a word plays as a short melody. 🔊 mutes it.

## Files

- `js/perm.js`: permutations, BFS over orbits and groups, and group identification. It runs in the browser and in Node.
- `js/levels.js`: the puzzles and their texts. `js/puzzle.js` turns a level into a solved model: orbit, distances to the target, and par.
- `js/lattice.js`: finds every subgroup by closing cyclic subgroups under joins, plus normality and cosets.
- `js/graph.js`: a small 3D force-directed graph viewer. `js/board.js` draws the board. `js/app.js` is the UI. `js/lab.js` is the Lab.
- `tools/check.js`: `node tools/check.js` checks that every "impossible" level is really impossible and every other level is reachable, and prints |G|, orbit, stabiliser and par.

Composition is read **left to right** in the game: the word `rf` means r first, then f. Cycle products in the Lab follow the usual
textbook convention, with the rightmost cycle acting first.
