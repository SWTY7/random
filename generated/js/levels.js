/* Levels. Board coordinates live in [-1, 1]². Generators are written as 0-indexed cycles.
 * target: either a word over the generator keys (applied to start, so it is reachable by construction)
 *         or an explicit arrangement (used for the impossible levels).
 * impossible: true marks levels whose correct answer is "it can't be done".
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  function polygon(n, r, rot) {
    r = r || 0.72; rot = rot === undefined ? -Math.PI / 2 : rot;
    return Array.from({ length: n }, (_, i) => [r * Math.cos(rot + (TAU * i) / n), r * Math.sin(rot + (TAU * i) / n)]);
  }
  /* Several rings of `count` points; points that coincide are merged. Returns positions and one cycle per ring. */
  function rings(specs) {
    const pts = [], cyc = [];
    const add = (x, y) => {
      const j = pts.findIndex((p) => Math.hypot(p[0] - x, p[1] - y) < 1e-6);
      if (j >= 0) return j;
      pts.push([x, y]); return pts.length - 1;
    };
    specs.forEach(([cx, cy, r, count, a0]) => {
      const c = [];
      for (let i = 0; i < count; i++) { const a = a0 + (TAU * i) / count; c.push(add(cx + r * Math.cos(a), cy + r * Math.sin(a))); }
      cyc.push(c);
    });
    return { pts, cyc };
  }
  const row = (n) => Array.from({ length: n }, (_, i) => [-0.78 + (1.56 * i) / (n - 1), 0]);

  const twoTri = rings([[-0.42, 0.06, 0.42, 3, 0], [0.42, 0.06, 0.42, 3, Math.PI]]);
  const twoSq = rings([[-0.4, 0, 0.4, 4, 0], [0.4, 0, 0.4, 4, Math.PI]]);
  // Cube net:     U
  //             L F R B
  //               D
  const cube = [[-0.3, -0.6], [-0.9, 0], [-0.3, 0], [0.3, 0], [0.9, 0], [-0.3, 0.6]];
  const cubeLabels = ['U', 'L', 'F', 'R', 'B', 'D'];
  const cubeGens = [
    { key: 'y', name: 'turn', cycles: [[2, 1, 4, 3]], about: 'quarter turn about the vertical axis (front → left)' },
    { key: 'x', name: 'tip', cycles: [[2, 0, 4, 5]], about: 'quarter turn about the left–right axis (front → up)' },
  ];

  const L = [];
  /* ---------------- Chapter I: Turning ---------------- */
  L.push({
    id: '1-1', chapter: 0, title: 'Order',
    pos: polygon(3), tokens: [0, 1, 2],
    gens: [{ key: 'r', name: 'rotate', cycles: [[0, 1, 2]], rot: 120 }],
    target: 'rr',
    intro: `<p>Each button is a <b>move</b>: a rule that sends the token at one position to another position. Hover a button to see its arrows on the board, then press it (or use the number keys).</p>
<p>Make the board match the small <b>target</b> picture.</p>`,
    insight: `<p>Press <b>r</b> three times and every token is back where it started: <span class="m">r³ = e</span>, where <span class="m">e</span> is the move that does nothing. The smallest such power is the <b>order</b> of <span class="m">r</span>, which here is 3.</p>
<p>So <span class="m">r² = r⁻¹</span>: turning twice forward is the same as turning once back. The three moves <span class="m">{e, r, r²}</span>, combined by "do one, then the other", form the <b>cyclic group</b> <span class="m">C₃</span>.</p>
<p>The panel on the right is the <b>Cayley graph</b>. Each dot is an arrangement you can reach, and each arrow is one press of a button. For <span class="m">C₃</span> it is a triangle. Every puzzle in this game is a walk on a graph like this.</p>`,
  });
  L.push({
    id: '1-2', chapter: 0, title: 'Too coarse',
    pos: polygon(6), tokens: [0, 1, 2, 3, 4, 5],
    gens: [{ key: 'q', name: 'rotate 120°', cycles: [[0, 2, 4], [1, 3, 5]], rot: 120 }],
    target: [5, 0, 1, 2, 3, 4], impossible: true,
    reasons: [
      ['Every reachable arrangement is a turn by a multiple of 120°, and 60° is not a multiple of 120°.'],
      ['A 60° turn would reverse the cyclic order of the tokens.', 'No turn reverses the cyclic order. The target is a plain rotation, so that is not the obstruction.'],
      ['A hexagon has only 3 rotations.', 'A hexagon has 6 rotations (0°, 60°, …, 300°). Your move only reaches 3 of them, and that is the real point.'],
    ],
    intro: `<p>Now there is one move, a turn by 120° of a hexagon. The target is the hexagon turned by 60°.</p>
<p>Some targets cannot be reached. When you are convinced, press <b>Can't be done</b>. You only get credit if you're right.</p>`,
    proof: `<p>The only moves you can make are the powers of <span class="m">q</span>: <span class="m">⟨q⟩ = {e, q, q²}</span>, which is 0°, 120° and 240°. A 60° turn is not in that list, so no sequence of presses gives it.</p>
<p>The rotations of a hexagon form <span class="m">C₆</span>, with 6 elements. <span class="m">⟨q⟩</span> is a <b>subgroup</b> of size 3. By <b>Lagrange's theorem</b>, the size of a subgroup always divides the size of the group, so here it could only ever be 1, 2, 3 or 6.</p>`,
  });
  L.push({
    id: '1-3', chapter: 0, title: 'Two gears',
    pos: polygon(6), tokens: [0, 1, 2, 3, 4, 5],
    gens: [
      { key: 'a', name: 'rotate 120°', cycles: [[0, 2, 4], [1, 3, 5]], rot: 120 },
      { key: 'b', name: 'rotate 180°', cycles: [[0, 3], [1, 4], [2, 5]], rot: 180 },
    ],
    target: [5, 0, 1, 2, 3, 4],
    intro: `<p>The same impossible target as before, but now you have two gears: 120° and 180°. Can you make 60°?</p>`,
    insight: `<p>A 120° turn is 2 steps of 60° and a 180° turn is 3 steps. You need <span class="m">2x + 3y ≡ 1 (mod 6)</span>, and <span class="m">x = 2, y = 1</span> gives <span class="m">7 ≡ 1</span>.</p>
<p>In general <span class="m">⟨rᵐ, rᵏ⟩ = ⟨r^gcd(m,k)⟩</span>. This is <b>Bézout's identity</b> as a statement about groups. Because <span class="m">gcd(2, 3) = 1</span>, the two gears together generate all of <span class="m">C₆</span>.</p>
<p>Look at the graph. The a-arrows make two triangles and the b-edges join them in pairs. This shows <span class="m">C₆ ≅ C₃ × C₂</span>, which is the Chinese remainder theorem in one picture.</p>`,
  });
  L.push({
    id: '1-4', chapter: 0, title: 'Clockwork',
    pos: polygon(12, 0.8), tokens: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], style: 'clock',
    gens: [
      { key: 'a', name: '+4 hours', cycles: [[0, 4, 8], [1, 5, 9], [2, 6, 10], [3, 7, 11]], rot: 120 },
      { key: 'b', name: '+6 hours', cycles: [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]], rot: 180 },
    ],
    target: [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8], impossible: true,
    reasons: [
      ['Every reachable turn is 4x + 6y hours, which is always even, and 3 is odd.'],
      ['4 and 6 are both even, so they can never add up to 12.', 'They can: 4 + 4 + 4 = 12, which is just the identity. The question is whether you can make 3.'],
      ['Moves only go forward, so you can never turn the clock backwards.', 'You can turn backwards: going back 4 hours is the same as going forward 8, which is a a. Forward moves are enough in a finite group.'],
    ],
    intro: `<p>A clock face. Your gears add 4 hours or 6 hours. The target is the clock turned by 3 hours.</p>`,
    proof: `<p>Every reachable turn is <span class="m">4x + 6y</span> hours (mod 12), and that number is always <b>even</b>. Three is odd.</p>
<p>The subgroup generated is <span class="m">⟨r⁴, r⁶⟩ = ⟨r^gcd(4,6)⟩ = ⟨r²⟩</span>: the six even turns. It has index 2 in <span class="m">C₁₂</span>. The odd turns form the other <b>coset</b>, <span class="m">r·⟨r²⟩</span>, and your moves can never take you from one coset to the other.</p>`,
  });

  /* ---------------- Chapter II: Mirrors ---------------- */
  const SQ = polygon(4);
  L.push({
    id: '2-1', chapter: 1, title: 'Mirror',
    pos: SQ, tokens: [0, 1, 2, 3],
    gens: [
      { key: 'r', name: 'rotate 90°', cycles: [[0, 1, 2, 3]], rot: 90 },
      { key: 'f', name: 'flip', cycles: [[1, 3]] },
    ],
    target: 'rrf',
    intro: `<p>A square with a rotation <b>r</b> and a flip <b>f</b> across the vertical axis. The target is a mirror image of the start, so no rotation alone can reach it.</p>`,
    insight: `<p>A square has 4 rotations (including <span class="m">e</span>) and 4 reflections, so 8 symmetries in all. They form the <b>dihedral group</b> <span class="m">D₄</span>, and every element can be written as <span class="m">rᵏ</span> or <span class="m">rᵏf</span>.</p>
<p>In the graph the r-arrows make two squares: the rotations of the start, and the rotations of its mirror image. The f-edges join each to its reflection. Undirected edges mean the move is its own inverse: <span class="m">f² = e</span>.</p>`,
  });
  L.push({
    id: '2-2', chapter: 1, title: 'Order matters',
    pos: SQ, tokens: [0, 1, 2, 3],
    gens: [
      { key: 'r', name: 'rotate 90°', cycles: [[0, 1, 2, 3]], rot: 90 },
      { key: 'f', name: 'flip', cycles: [[1, 3]] },
    ],
    target: 'fr',
    intro: `<p>Only two presses are needed: one <b>r</b> and one <b>f</b>. But in which order?</p>`,
    insight: `<p><span class="m">rf ≠ fr</span>. The group is <b>non-abelian</b>. In fact flipping, turning, then flipping back turns the other way: <span class="m">f r f = r⁻¹</span>.</p>
<p>The three facts <span class="m">r⁴ = e</span>, <span class="m">f² = e</span>, <span class="m">frf = r⁻¹</span> are a <b>presentation</b> of <span class="m">D₄</span>. Every true equation between these moves follows from those three.</p>`,
  });
  L.push({
    id: '2-3', chapter: 1, title: 'Two mirrors make a turn',
    pos: polygon(5), tokens: [0, 1, 2, 3, 4],
    gens: [
      { key: 'f', name: 'flip through 1', cycles: [[1, 4], [2, 3]] },
      { key: 's', name: 'flip through 4', cycles: [[0, 1], [2, 4]] },
    ],
    target: [4, 0, 1, 2, 3],
    intro: `<p>A pentagon, and two mirrors. There is no rotation button, yet the target is a pure rotation.</p>`,
    insight: `<p>Two reflections whose axes meet at angle <span class="m">θ</span> compose to a rotation by <span class="m">2θ</span>. Here the axes are <span class="m">36°</span> apart, which gives one <span class="m">72°</span> step.</p>
<p>So <span class="m">D₅</span> is generated by two reflections alone. A group generated by reflections is a <b>Coxeter group</b>, and here <span class="m">(fs)⁵ = e</span>. The Cayley graph is a single 10-cycle, with f and s edges alternating around it.</p>`,
  });
  L.push({
    id: '2-4', chapter: 1, title: 'Not a symmetry',
    pos: SQ, tokens: [0, 1, 2, 3],
    gens: [
      { key: 'r', name: 'rotate 90°', cycles: [[0, 1, 2, 3]], rot: 90 },
      { key: 'f', name: 'flip', cycles: [[1, 3]] },
    ],
    target: [1, 0, 2, 3], impossible: true,
    reasons: [
      ['Every symmetry keeps neighbouring corners neighbouring, and the target separates two neighbours.'],
      ['The target is an odd permutation and every symmetry of the square is even.', 'Not true: the flip f = (2 4) is a single swap, which is odd. The symmetries of the square include odd permutations, so parity can’t decide this.'],
      ['r and f commute, so you can only reach rotations of the start.', 'They don’t commute (see puzzle 2-2), and you can reach reflections too: puzzle 2-1 did exactly that.'],
    ],
    intro: `<p>Swap the top token with its right-hand neighbour, and leave the other two alone.</p>`,
    proof: `<p>Every symmetry of a square sends neighbouring corners to neighbouring corners. Tokens <b>A</b> and <b>D</b> start as neighbours, but in the target they are diagonally opposite.</p>
<p>Counting tells the same story. There are <span class="m">4! = 24</span> ways to place four tokens on the corners, and the symmetries reach only <span class="m">|D₄| = 8</span> of them. The target is in one of the other two <b>cosets</b>.</p>`,
  });
  L.push({
    id: '2-5', chapter: 1, title: 'Necklace',
    pos: polygon(6), tokens: [0, 0, 1, 2, 2, 1],
    gens: [
      { key: 'r', name: 'rotate 60°', cycles: [[0, 1, 2, 3, 4, 5]], rot: 60 },
      { key: 'f', name: 'flip', cycles: [[1, 5], [2, 4]] },
    ],
    target: 'rrrf',
    intro: `<p>Now some beads share a colour, so different moves can give the <b>same-looking</b> board. Watch how small the graph is.</p>`,
    insight: `<p><span class="m">D₆</span> has 12 elements, but only 6 different necklaces appear. One flip (the one whose axis passes between the two reds and between the two yellows) leaves the start looking unchanged. It belongs to the <b>stabiliser</b>, which has 2 elements.</p>
<p><b>Orbit–stabiliser theorem:</b> <span class="m">|orbit| · |stabiliser| = |G|</span>, here <span class="m">6 · 2 = 12</span>.</p>
<p>Because the dots are arrangements rather than group elements, this graph is no longer the Cayley graph. It is the <b>Schreier graph</b> of the action, a quotient of the Cayley graph.</p>`,
  });

  /* ---------------- Chapter III: Shuffles ---------------- */
  L.push({
    id: '3-1', chapter: 2, title: 'Bubble sort',
    pos: row(4), tokens: [3, 2, 1, 0],
    gens: [
      { key: '1', name: 'swap 1–2', cycles: [[0, 1]] },
      { key: '2', name: 'swap 2–3', cycles: [[1, 2]] },
      { key: '3', name: 'swap 3–4', cycles: [[2, 3]] },
    ],
    target: [0, 1, 2, 3],
    intro: `<p>Sort the row using only swaps of neighbours. What is the fewest swaps that works?</p>`,
    insight: `<p>The fewest swaps is the number of <b>inversions</b>: pairs that are in the wrong order. Reversed, all <span class="m">C(4,2) = 6</span> pairs are wrong. Each adjacent swap fixes exactly one inversion (or creates one), so you can't do better than 6. This is exactly why bubble sort is quadratic.</p>
<p>The adjacent swaps generate the whole <b>symmetric group</b> <span class="m">S₄</span>, with <span class="m">4! = 24</span> elements. Drawn with these generators, the Cayley graph is the <b>permutohedron</b>, a truncated octahedron: 24 vertices, square faces where swaps commute (<span class="m">s₁s₃ = s₃s₁</span>), and hexagons from the braid relation <span class="m">s₁s₂s₁ = s₂s₁s₂</span>.</p>`,
  });
  L.push({
    id: '3-2', chapter: 2, title: 'Two moves are enough',
    pos: polygon(5), tokens: [0, 1, 2, 3, 4],
    gens: [
      { key: 't', name: 'swap top pair', cycles: [[4, 0]] },
      { key: 'c', name: 'rotate', cycles: [[0, 1, 2, 3, 4]], rot: 72 },
    ],
    target: [0, 1, 3, 2, 4],
    intro: `<p>One swap and one rotation. Swap the two tokens at the bottom.</p>`,
    insight: `<p>Conjugation: to swap any neighbouring pair, rotate them to the top, swap, and rotate back. In symbols, <span class="m">c⁻ᵏ t cᵏ</span> is a swap somewhere else. Since adjacent swaps generate everything, <span class="m">⟨t, c⟩ = S₅</span>, all 120 arrangements.</p>
<p>In general a transposition of neighbours together with an n-cycle generates <span class="m">Sₙ</span>. The trick <span class="m">g⁻¹xg</span> ("go there, do it, come back") is the most useful idea in puzzle solving. It is also how Rubik's cube methods are built.</p>`,
  });
  L.push({
    id: '3-3', chapter: 2, title: 'Three-cycles',
    pos: SQ, tokens: [0, 1, 2, 3],
    gens: [
      { key: 'a', name: 'cycle 1→2→3', cycles: [[0, 1, 2]] },
      { key: 'b', name: 'cycle 1→3→4', cycles: [[0, 2, 3]] },
    ],
    target: [1, 0, 2, 3], impossible: true,
    reasons: [
      ['3-cycles are even, so everything reachable is even, and a single swap is odd.'],
      ['Each move leaves one token fixed, so some token can never move.', 'a fixes the 4th position and b fixes the 2nd, but together they move every token wherever you like.'],
      ['The moves generate only 12 of the 24 permutations.', 'True, but that alone doesn’t say whether this target is one of the 12. You need an invariant that tells you which half it lies in.'],
    ],
    intro: `<p>Two 3-cycles on a square. Swap the top and right tokens, and leave the other two alone.</p>`,
    proof: `<p>Every permutation is either <b>even</b> or <b>odd</b>: the parity of the number of swaps it takes to write it. The parity doesn't depend on how you write it.</p>
<p>A 3-cycle is even, because <span class="m">(1 2 3) = (1 3)(1 2)</span> is two swaps. Even followed by even is even, so every reachable arrangement is even. A single swap is odd.</p>
<p>The even permutations form the <b>alternating group</b> <span class="m">A₄</span>, exactly half of <span class="m">S₄</span>: 12 elements. The graph has 12 dots, and the target lives in the other half.</p>`,
  });
  L.push({
    id: '3-4', chapter: 2, title: 'Bow tie',
    pos: twoTri.pts, tokens: [0, 1, 2, 3, 4],
    gens: [
      { key: 'a', name: 'left triangle', cycles: [twoTri.cyc[0]] },
      { key: 'b', name: 'right triangle', cycles: [twoTri.cyc[1]] },
    ],
    target: [0, 4, 3, 2, 1],
    intro: `<p>Two triangles sharing a corner. Mirror the bow tie: swap the left pair with the right pair, top with top and bottom with bottom.</p>`,
    insight: `<p>Two 3-cycles that share one point generate <span class="m">A₅</span>, the 60 even permutations of 5 things. <span class="m">A₅</span> is the smallest <b>non-abelian simple group</b>: it has no normal subgroups except the trivial ones. It is also the rotation group of the icosahedron.</p>
<p>Its simplicity is the reason the general quintic equation has no formula in radicals (Abel–Ruffini, via Galois theory).</p>
<p>The graph has 60 dots and is made of triangles, one for each coset of <span class="m">⟨a⟩</span> and of <span class="m">⟨b⟩</span>.</p>`,
  });
  L.push({
    id: '3-5', chapter: 2, title: 'Bow tie, one swap',
    pos: twoTri.pts, tokens: [0, 1, 2, 3, 4],
    gens: [
      { key: 'a', name: 'left triangle', cycles: [twoTri.cyc[0]] },
      { key: 'b', name: 'right triangle', cycles: [twoTri.cyc[1]] },
    ],
    target: [0, 1, 2, 4, 3], impossible: true,
    reasons: [
      ['Both moves are even permutations, and the target is a single swap, which is odd.'],
      ['The token in the shared corner can never leave the centre.', 'It can: a single press of a moves it into the left triangle.'],
      ['A₅ is simple, so it can’t contain a transposition.', 'A₅ is simple, but that isn’t the reason. Simplicity is about normal subgroups. A₅ has no transpositions because they are odd.'],
    ],
    intro: `<p>Same bow tie. Swap just the two tokens on the right.</p>`,
    proof: `<p>Both moves are 3-cycles, which are even permutations. The target differs from the start by one swap, which is odd. Parity is an <b>invariant</b>, so 60 arrangements are reachable and the other 60 are not.</p>
<p>The parity map <span class="m">sgn: Sₙ → {±1}</span> is a <b>homomorphism</b>, and its kernel is <span class="m">Aₙ</span>. Many impossibility proofs for puzzles, including the classic 15-puzzle, come down to a homomorphism like this one.</p>`,
  });
  L.push({
    id: '3-6', chapter: 2, title: 'Linked rings',
    pos: twoSq.pts, tokens: [0, 1, 0, 1, 2, 0, 1],
    gens: [
      { key: 'a', name: 'left ring', cycles: [twoSq.cyc[0]] },
      { key: 'b', name: 'right ring', cycles: [twoSq.cyc[1]] },
    ],
    target: null, // filled in below
    intro: `<p>Two rings of four, sharing one spot. Gather each colour into its own ring, with the gold token at the far right.</p>`,
    insight: `<p>A 4-cycle is <b>odd</b>, because it takes three swaps. Two odd 4-cycles sharing a point generate all of <span class="m">S₇</span>: 5040 permutations.</p>
<p>Still, there were only <span class="m">7! / (3! · 3! · 1!) = 140</span> different-looking boards. The stabiliser shuffles the reds among themselves and the blues among themselves, so it is <span class="m">S₃ × S₃</span>, of size 36. And <span class="m">5040 / 36 = 140</span>, as the orbit–stabiliser theorem says.</p>`,
  });

  /* ---------------- Chapter IV: Rigid motions ---------------- */
  L.push({
    id: '4-1', chapter: 3, title: 'Rolling a die',
    pos: cube, tokens: [0, 1, 2, 3, 4, 5], style: 'faces', labels: cubeLabels,
    gens: cubeGens,
    target: 'xyyx',
    intro: `<p>An unfolded cube: Up, Left, Front, Right, Back, Down. Each move turns the whole cube a quarter turn. Find the target orientation.</p>`,
    insight: `<p>A cube can sit in <span class="m">6 × 4 = 24</span> orientations: choose which face is on top, then turn it about that axis. These rotations form a group of order 24, and it is a copy of <span class="m">S₄</span>.</p>
<p>Why <span class="m">S₄</span>? A cube has 4 long diagonals, joining opposite corners. Every rotation shuffles these diagonals, and different rotations shuffle them differently. Check it in the Lab with the preset "cube rotations".</p>`,
  });
  L.push({
    id: '4-2', chapter: 3, title: 'Mirror die',
    pos: cube, tokens: [0, 1, 2, 3, 4, 5], style: 'faces', labels: cubeLabels,
    gens: cubeGens,
    target: [0, 3, 2, 1, 4, 5], impossible: true,
    reasons: [
      ['Rotations preserve handedness (det = +1), and the target is the mirror image (det = −1).'],
      ['Left and right are opposite faces, so they can never swap.', 'They can: turning twice about the vertical axis (y y) swaps L and R. It also swaps F and B, which the target doesn’t.'],
      ['Every move is a 4-cycle, so parity forbids a single swap.', 'A 4-cycle is odd and so is a swap. Parity allows this target, so something else must rule it out.'],
    ],
    intro: `<p>Swap Left and Right, keeping everything else.</p>`,
    proof: `<p>That would turn the cube into its <b>mirror image</b>. Look at the corner where Up, Front and Right meet: going around it, the faces appear clockwise in the order U → F → R. Every rotation keeps that handedness, and a reflection reverses it.</p>
<p>In linear algebra terms, a rotation has <span class="m">det = +1</span> and a reflection has <span class="m">det = −1</span>, and det is a homomorphism. Of the <span class="m">6! = 720</span> ways to paint 6 colours on the faces, rotations relate them in groups of 24, so there are <span class="m">720 / 24 = 30</span> truly different dice. A die and its mirror image are two of the 30.</p>`,
  });
  L.push({
    id: '4-3', chapter: 3, title: 'Corner',
    pos: cube, tokens: [0, 1, 0, 0, 1, 1], style: 'faces', labels: cubeLabels,
    gens: cubeGens,
    target: 'xxy',
    intro: `<p>Three red faces around one corner and three blue faces around the opposite corner. Bring the reds to the target corner.</p>`,
    insight: `<p>The orbit has 8 states, one for each corner the reds can surround. The stabiliser is the 3-fold rotation about that corner's long diagonal. <span class="m">24 / 3 = 8</span>.</p>
<p><b>Burnside's lemma</b> extends this idea. The number of distinct colourings equals the average number of colourings fixed by a group element. With 2 colours on a cube's faces it gives <span class="m">(64 + 3·16 + 6·8 + 6·8 + 8·4) / 24 = 240 / 24 = 10</span>. The terms count the colourings fixed by the identity, the face half-turns, the face quarter-turns, the edge half-turns and the corner turns, so there are 10 different two-coloured cubes.</p>`,
  });

  L.push({
    id: '4-4', chapter: 3, title: 'Three axes',
    pos: cube, tokens: [0, 1, 2, 1, 2, 0], style: 'faces', labels: cubeLabels,
    gens: cubeGens,
    target: 'yx',
    intro: `<p>Opposite faces now share a colour, so all you can see is which axis (up–down, left–right, front–back) points where. How many different-looking cubes are there now?</p>`,
    insight: `<p>Only <b>6</b>, because the three axes can be permuted in <span class="m">3! = 6</span> ways. The 24 rotations collapse to 6 because the three half-turns about the face axes, together with <span class="m">e</span>, move every face to itself or to its opposite. They change nothing you can see. That set is a copy of the Klein four-group <span class="m">V₄</span>, and it is <b>normal</b>: conjugating a half-turn about an axis gives a half-turn about another axis.</p>
<p>So the graph on the right is the Cayley graph of the <b>quotient</b> <span class="m">S₄ / V₄ ≅ S₃</span>. "Forget everything except the axes" is a <b>homomorphism</b> from the rotation group onto <span class="m">S₃</span> with kernel <span class="m">V₄</span>. By the first isomorphism theorem, <span class="m">24 / 4 = 6</span>.</p>`,
  });

  /* ---------------- Chapter V: Commutators ---------------- */
  const ringGens = [
    { key: 'a', name: 'left ring', cycles: [twoSq.cyc[0]] },
    { key: 'b', name: 'right ring', cycles: [twoSq.cyc[1]] },
  ];
  L.push({
    id: '5-1', chapter: 4, title: 'Commutator',
    pos: twoSq.pts, tokens: [0, 1, 2, 3, 4, 5, 6],
    gens: ringGens,
    target: 'abaaabbb',
    intro: `<p>The linked rings again, but now every token is different. The target moves only <b>three</b> tokens and leaves the other four alone. Each turn moves four tokens at once, so you need a trick.</p>
<p>The full graph has 5040 dots, so the panel shows only your neighbourhood: every state within a few moves of you. Try this: do <i>a</i>, then <i>b</i>, then undo the <i>a</i> (that is <i>aaa</i>), then undo the <i>b</i> (<i>bbb</i>).</p>`,
    insight: `<p>You just applied the <b>commutator</b> <span class="m">[a, b] = a b a⁻¹ b⁻¹</span>. If <span class="m">a</span> and <span class="m">b</span> moved disjoint sets of tokens it would be <span class="m">e</span>. They share only one spot, so almost everything cancels, and what is left is a <b>3-cycle</b>.</p>
<p>This is how every Rubik's cube method works. When two moves overlap only a little, their commutator changes only a few pieces.</p>`,
  });
  L.push({
    id: '5-2', chapter: 4, title: 'Conjugate',
    pos: twoSq.pts, tokens: [0, 1, 2, 3, 4, 5, 6],
    gens: ringGens,
    target: 'b' + 'abaaabbb' + 'bbb',
    intro: `<p>Again cycle three tokens and leave the rest alone, but this time a <b>different</b> three.</p>
<p>Idea: first move the three tokens into the spots the commutator affects, then apply the commutator, then undo that first setup move.</p>`,
    insight: `<p>That's <b>conjugation</b>: <span class="m">g · x · g⁻¹</span> does "the same thing as <span class="m">x</span>", but to the tokens that <span class="m">g</span> brought into position. Conjugate permutations always have the same <b>cycle type</b>, so a 3-cycle conjugates to another 3-cycle.</p>
<p>Use a commutator to make a small change and a conjugate to aim it. With those two ideas you can solve almost any permutation puzzle one 3-cycle at a time, because 3-cycles generate <span class="m">Aₙ</span> and one odd move takes care of parity.</p>`,
  });
  // A 2×3 grid. Each move turns one 2×2 square; the squares overlap in the middle column.
  const grid = [[-0.62, -0.31], [0, -0.31], [0.62, -0.31], [-0.62, 0.31], [0, 0.31], [0.62, 0.31]];
  L.push({
    id: '5-3', chapter: 4, title: 'Exotic',
    pos: grid, tokens: [0, 1, 2, 3, 4, 5],
    gens: [
      { key: 'a', name: 'left square', cycles: [[0, 1, 4, 3]] },
      { key: 'b', name: 'right square', cycles: [[1, 2, 5, 4]] },
    ],
    target: [1, 0, 2, 3, 4, 5], impossible: true,
    reasons: [
      ['The moves generate only 120 of the 720 permutations, and none of those 120 is a single swap.'],
      ['Both moves are odd and a swap is odd, so the parity is wrong.', 'Odd matches odd, so parity allows this target. That’s what makes this puzzle tricky.'],
      ['The two outer columns can never exchange tokens, because only the middle column is shared.', 'They can: a then b carries a token from the left column all the way to the right column.'],
    ],
    intro: `<p>Two overlapping squares on a 2×3 grid. Swap the first two tokens of the top row.</p>
<p>Careful: both moves are 4-cycles, which are odd, and a swap is odd too. So parity doesn't rule it out.</p>`,
    proof: `<p>Look at the graph: <b>120</b> dots, not <span class="m">6! = 720</span>. The moves generate a group of order 120 inside <span class="m">S₆</span>. Its 25 elements of order 2 are 15 double swaps and 10 triple swaps. None is a single swap, so no invariant as simple as parity is needed. The target just isn't in the group.</p>
<p>The group is a celebrity. It is <span class="m">PGL(2, 5)</span>, the Möbius maps <span class="m">x ↦ (ax + b)/(cx + d)</span> over the field with 5 elements, acting on the 6 points <span class="m">{0, 1, 2, 3, 4, ∞}</span>. These maps preserve <b>cross-ratios</b>, and a single swap does not. That is the real invariant.</p>
<p>As an abstract group it is isomorphic to <span class="m">S₅</span>, acting on six things instead of five. This happens only for <span class="m">n = 6</span>, and it is why <span class="m">S₆</span> is the only symmetric group with an <b>outer automorphism</b>. Try it in the Lab: <span class="m">a = (1 2 5 4), b = (2 3 6 5)</span>.</p>`,
  });

  /* ---------------- Chapter VI: Relations ---------------- */
  const twoRings4 = rings([[-0.45, 0, 0.34, 4, -Math.PI / 2], [0.45, 0, 0.34, 4, -Math.PI / 2]]);
  L.push({
    id: '6-1', chapter: 5, title: 'Commuting',
    pos: row(4), tokens: [0, 1, 2, 3], goal: 'relation',
    gens: [
      { key: 'a', name: 'swap left pair', cycles: [[0, 1]] },
      { key: 'b', name: 'swap right pair', cycles: [[2, 3]] },
    ],
    target: '',
    intro: `<p>New goal: <b>find a relation</b>. Make a word that brings the board back to the start, but not a lazy one: <i>aa</i> just undoes itself and doesn't count. The word has to use both moves in a way that doesn't simply cancel out.</p>`,
    insight: `<p><span class="m">abab = e</span>. Since <span class="m">a = a⁻¹</span> and <span class="m">b = b⁻¹</span>, this says <span class="m">ab = ba</span>: the moves <b>commute</b>, because they touch disjoint tokens. In the graph, this relation is the square loop.</p>
<p>The group has the <b>presentation</b> <span class="m">⟨a, b | a² = b² = (ab)² = e⟩ ≅ C₂ × C₂</span>. Every loop in a Cayley graph is a relation, and a short list of relations is enough to generate all the others.</p>`,
  });
  L.push({
    id: '6-2', chapter: 5, title: 'Braid',
    pos: row(3), tokens: [0, 1, 2], goal: 'relation',
    gens: [
      { key: 'a', name: 'swap 1–2', cycles: [[0, 1]] },
      { key: 'b', name: 'swap 2–3', cycles: [[1, 2]] },
    ],
    target: '',
    intro: `<p>Now the two swaps overlap, so <span class="m">abab</span> no longer works. Find a relation anyway.</p>`,
    insight: `<p><span class="m">(ab)³ = e</span>. Equivalently <span class="m">aba = bab</span>: both sides reverse the row. This is the <b>braid relation</b>. Together with <span class="m">a² = b² = e</span> it gives a presentation of <span class="m">S₃</span>:</p>
<p class="m" style="font-style:normal">S₃ ≅ ⟨a, b | a² = b² = (ab)³ = e⟩.</p>
<p>The <b>Coxeter presentation</b> of every <span class="m">Sₙ</span> follows this pattern: <span class="m">(sᵢsⱼ)²</span> for swaps far apart and <span class="m">(sᵢsᵢ₊₁)³</span> for neighbours. These are exactly the square and hexagonal faces of the permutohedron in puzzle 3-1.</p>`,
  });
  L.push({
    id: '6-3', chapter: 5, title: 'Brougham Bridge',
    pos: twoRings4.pts, tokens: [0, 1, 2, 3, 4, 5, 6, 7], goal: 'relation',
    gens: [
      { key: 'i', name: 'turn both squares', cycles: [[0, 1, 2, 3], [4, 5, 6, 7]] },
      { key: 'j', name: 'swap across', cycles: [[0, 4, 2, 6], [1, 7, 3, 5]] },
    ],
    target: '',
    intro: `<p>Two strange moves on eight tokens. Each has order 4, so <i>iiii</i> and <i>jjjj</i> are lazy. Find a relation that mixes them.</p>`,
    insight: `<p>This is the <b>quaternion group</b> <span class="m">Q₈ = {±1, ±i, ±j, ±k}</span>, acting on itself. Here <span class="m">i² = j²</span>: both are <span class="m">−1</span>, the only element of order 2. Hamilton carved <span class="m">i² = j² = k² = ijk = −1</span> into Brougham Bridge in Dublin in 1843.</p>
<p><span class="m">Q₈</span> is non-abelian (<span class="m">ij = k = −ji</span>), yet <b>every</b> subgroup of it is normal. It is the smallest group with that property, and it shows that "all subgroups normal" doesn't imply abelian. Check the subgroup lattice in the Lab.</p>`,
  });

  // Linked rings target: reds left, blues right, gold at the far right of the right ring.
  (function () {
    const lv = L.find((l) => l.id === '3-6');
    const pts = lv.pos, left = new Set(twoSq.cyc[0]), right = new Set(twoSq.cyc[1]);
    const shared = twoSq.cyc[0].find((i) => right.has(i));
    const farRight = twoSq.cyc[1].reduce((b, i) => (pts[i][0] > pts[b][0] ? i : b));
    const t = pts.map(() => 0);
    pts.forEach((_, i) => {
      if (i === farRight) t[i] = 2;
      else if (left.has(i) && i !== shared) t[i] = 0;
      else t[i] = 1;
    });
    // 3 reds in the left ring (minus the shared spot), shared spot + 2 right spots blue.
    lv.target = t;
  })();

  const CHAPTERS = [
    { title: 'I · Turning', blurb: 'Cyclic groups, order, subgroups, cosets.' },
    { title: 'II · Mirrors', blurb: 'Dihedral groups, non-commutativity, orbits.' },
    { title: 'III · Shuffles', blurb: 'Symmetric and alternating groups, parity.' },
    { title: 'IV · Rigid motions', blurb: 'The rotation group of the cube.' },
    { title: 'V · Commutators', blurb: 'Commutators, conjugates, and an exotic group.' },
    { title: 'VI · Relations', blurb: 'Loops in the Cayley graph are equations in the group.' },
  ];

  const api = { LEVELS: L, CHAPTERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GLevels = api;
})(typeof window !== 'undefined' ? window : this);
