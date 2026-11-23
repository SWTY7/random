#!/usr/bin/env node
/* Verifies every level: impossible levels really are impossible, possible ones are reachable.
 * Prints group order, orbit size, stabiliser size and par (fewest moves). */
'use strict';
const P = require('../js/perm.js');
const { LEVELS } = require('../js/levels.js');
const { prepare } = require('../js/puzzle.js');
let bad = 0;
for (const lv of LEVELS) {
  const m = prepare(lv);
  const ok = (lv.goal === 'relation' ? m.relation && !lv.impossible : !!lv.impossible === !m.reachable) && lv.tokens.length === lv.pos.length && m.target.length === lv.pos.length;
  const sameMultiset = lv.tokens.slice().sort().join() === m.target.slice().sort().join();
  const names = P.analyse(m.gens).names.join(' / ');
  if (!ok || !sameMultiset || (m.reachable && m.par === 0)) bad++;
  console.log(
    (ok && sameMultiset ? 'ok ' : 'BAD') + ' ' + lv.id.padEnd(4) + lv.title.padEnd(26) +
    ' |G|=' + String(m.groupOrder).padEnd(5) + ' orbit=' + String(m.orbit.size).padEnd(4) +
    ' stab=' + String(m.stabiliser).padEnd(3) + ' par=' + String(m.par).padEnd(5) + ' ' + names +
    (m.relation ? '  relation: ' + m.relation.map((g) => lv.gens[g].key).join('') : '')
  );
}
if (bad) { console.error(bad + ' problem(s)'); process.exit(1); }
console.log('All ' + LEVELS.length + ' levels check out.');
