// Cognate: puzzle generation. Three kinds:
//   reconstruct  - see a word in three daughter languages and work out the ancestor (the comparative method)
//   law          - see words before and after a change, pick the sound law that did it
//   order        - see three sound laws and their combined result, put them in the order they happened
'use strict';
(function (G) {
  const CG = G.CG;
  const NO_PUZZLE = new Set(['stress', 'clusterassim']);

  function protoSet(rng, n) {
    const ph = CG.makeProtoPhonology(rng);
    ph.pCluster = 0;
    const lex = CG.makeProtoLexicon(ph, rng);
    const ms = rng.shuffle(CG.MEANINGS.filter(m => lex[m.i] && m.cat !== 'culture').map(m => m.i)).slice(0, n);
    return { ph, lex, ms, forms: ms.map(mi => lex[mi]) };
  }

  // ---- reconstruct
  CG.makeReconstruct = (seed, level = 1) => {
    const rng = new CG.RNG(CG.hashSeed('rec' + seed + ':' + level));
    const nRules = [2, 3, 4][level] ?? 3, nWords = 8;
    for (let attempt = 0; attempt < 30; attempt++) {
      const P = protoSet(rng, nWords);
      const lang = { stress: P.ph.stress };
      const daughters = [];
      const used = new Set();
      let ok = true;
      for (let d = 0; d < 3 && ok; d++) {
        let forms = P.forms.slice();
        const rules = [];
        const excl = new Set([...NO_PUZZLE, ...used]);
        for (let r = 0; r < nRules; r++) {
          const prop = CG.proposeRule(lang, forms, rng, { exclude: excl, minHits: 2, maxFrac: 0.8 });
          if (!prop) break;
          excl.add(prop.rule.key); used.add(prop.rule.key);
          const before = forms;
          forms = forms.map(f => CG.applyRule(prop.rule, f, lang.stress));
          rules.push({ rule: prop.rule, ex: before.map((f, i) => [f, forms[i]]).filter(([a, b]) => a !== b).slice(0, 3) });
        }
        if (rules.length < Math.min(2, nRules)) ok = false;
        daughters.push({ name: ['Northern', 'Island', 'Hill'][d], forms, rules });
      }
      if (!ok) continue;
      // reject if two daughters ended up identical or if a proto word is too long
      if (P.forms.some(f => f.length > 8)) continue;
      return { kind: 'reconstruct', seed, level, stress: P.ph.stress, meanings: P.ms, proto: P.forms, daughters, palette: paletteOf([P.forms, ...daughters.map(d => d.forms)]) };
    }
    return null;
  };
  const paletteOf = lists => {
    const inv = CG.inventory(lists.flat());
    const ord = s => (CG.isV(s) ? 1000 : 0) + Object.keys(CG.FEAT).indexOf(s);
    return [...inv.keys()].sort((a, b) => ord(a) - ord(b));
  };
  // Score a guess: 1 for exact, partial credit by edit distance
  // Compared sound by sound, after tokenising both sides, so tie bars and precomposed letters don't matter.
  CG.scoreGuess = (guess, truth) => {
    const g = CG.tokenize(guess);
    if (!g.length) return 0;
    const t = CG.tokenize(CG.str(truth));
    const d = CG.levenshtein(g, t);
    return Math.max(0, 1 - d / Math.max(t.length, 1));
  };

  // ---- spot the law
  function effect(rule, forms, stress) { return forms.map(f => CG.str(CG.applyRule(rule, f, stress))).join('|'); }
  CG.makeLaw = (seed, level = 1) => {
    const rng = new CG.RNG(CG.hashSeed('law' + seed + ':' + level));
    for (let attempt = 0; attempt < 40; attempt++) {
      const P = protoSet(rng, 24);
      const lang = { stress: P.ph.stress };
      const prop = CG.proposeRule(lang, P.forms, rng, { exclude: NO_PUZZLE, minHits: 3, maxFrac: 0.7 });
      if (!prop) continue;
      const rule = prop.rule;
      // show the changed words and a few unchanged ones
      const changed = prop.changes.slice(0, 6).map(c => c[0]);
      const same = rng.shuffle(P.forms.map((f, i) => i).filter(i => !changed.includes(i) && !prop.changes.some(c => c[0] === i))).slice(0, level >= 1 ? 3 : 2);
      const show = rng.shuffle(changed.concat(same));
      const shown = show.map(i => P.forms[i]);
      const eff = effect(rule, shown, lang.stress);
      // distractors: other laws that would have done something different to these very words
      const ds = [], seen = new Set([eff, rule.note]);
      for (let k = 0; k < 200 && ds.length < 3; k++) {
        const near = level >= 1 && rng.chance(0.5);
        const p2 = CG.proposeRule(lang, P.forms, rng, near ? { only: [rule.key], minHits: 1 } : { exclude: NO_PUZZLE, minHits: 1 });
        if (!p2) continue;
        const e2 = effect(p2.rule, shown, lang.stress);
        if (seen.has(e2) || seen.has(p2.rule.note)) continue;
        seen.add(e2); seen.add(p2.rule.note);
        ds.push(p2.rule);
      }
      if (ds.length < 3) continue;
      const options = rng.shuffle([rule, ...ds]);
      return { kind: 'law', seed, level, stress: lang.stress, meanings: show.map(i => P.ms[i]), before: shown, after: shown.map(f => CG.applyRule(rule, f, lang.stress)), options, answer: options.indexOf(rule) };
    }
    return null;
  };

  // ---- relative chronology
  const PERMS3 = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const runOrder = (rules, order, forms, stress) => forms.map(f => { for (const k of order) f = CG.applyRule(rules[k], f, stress); return f; });
  CG.runOrder = runOrder;
  CG.makeOrder = (seed, level = 1) => {
    const rng = new CG.RNG(CG.hashSeed('ord' + seed + ':' + level));
    for (let attempt = 0; attempt < 120; attempt++) {
      const P = protoSet(rng, 30);
      const lang = { stress: P.ph.stress };
      let forms = P.forms;
      const rules = [], excl = new Set(NO_PUZZLE);
      for (let r = 0; r < 3; r++) {
        const prop = CG.proposeRule(lang, forms, rng, { exclude: excl, minHits: 2, maxFrac: 0.6 });
        if (!prop) break;
        excl.add(prop.rule.key);
        rules.push(prop.rule);
        forms = forms.map(f => CG.applyRule(prop.rule, f, lang.stress));
      }
      if (rules.length < 3) continue;
      const truth = runOrder(rules, [0, 1, 2], P.forms, lang.stress).map(CG.str);
      // words that tell the orders apart
      const informative = new Set();
      for (const p of PERMS3.slice(1)) runOrder(rules, p, P.forms, lang.stress).forEach((f, i) => { if (CG.str(f) !== truth[i]) informative.add(i); });
      const changedByEach = rules.map(r => P.forms.map((f, i) => i).filter(i => CG.applyRule(r, P.forms[i], lang.stress) !== P.forms[i]));
      let show = [...informative];
      for (const list of changedByEach) for (const i of list.slice(0, 2)) if (!show.includes(i)) show.push(i);
      show = show.slice(0, level >= 2 ? 8 : 10);
      const sub = show.map(i => P.forms[i]);
      const want = runOrder(rules, [0, 1, 2], sub, lang.stress).map(CG.str).join('|');
      const matches = PERMS3.filter(p => runOrder(rules, p, sub, lang.stress).map(CG.str).join('|') === want);
      if (matches.length !== 1) continue;
      // need at least two of the three pairs to actually interact, otherwise it is too easy
      const inter = [[0, 1], [0, 2], [1, 2]].filter(([a, b]) => {
        const x = runOrder(rules, [a, b], sub, lang.stress).map(CG.str).join('|'), y = runOrder(rules, [b, a], sub, lang.stress).map(CG.str).join('|');
        return x !== y;
      }).length;
      if (inter < (level >= 1 ? 2 : 1)) continue;
      const shuffled = rng.shuffle([0, 1, 2]);
      return { kind: 'order', seed, level, stress: lang.stress, meanings: show.map(i => P.ms[i]), before: sub, after: runOrder(rules, [0, 1, 2], sub, lang.stress), rules: shuffled.map(k => rules[k]), answer: [0, 1, 2].map(k => shuffled.indexOf(k)) };
    }
    return null;
  };
})(globalThis);
