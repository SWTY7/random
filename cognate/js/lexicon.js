// Cognate: meanings, proto-language generation, coining new words.
'use strict';
(function (G) {
  const CG = G.CG;

  // The Swadesh-100 core plus some cultural words. `rel` lists meanings a word may drift into.
  // `len` is the typical length in syllables (pronouns and particles are short).
  const M = [
    ['I', 'pron', 1, []], ['you', 'pron', 1, []], ['we', 'pron', 1, ['person']], ['this', 'pron', 1, ['that']], ['that', 'pron', 1, ['this']],
    ['who', 'pron', 1, ['what']], ['what', 'pron', 1, ['who']], ['not', 'pron', 1, []], ['all', 'qual', 2, ['many']], ['many', 'qual', 2, ['all', 'big']],
    ['one', 'num', 2, []], ['two', 'num', 2, []], ['three', 'num', 2, []],
    ['big', 'qual', 2, ['long', 'many']], ['long', 'qual', 2, ['big']], ['small', 'qual', 2, []],
    ['woman', 'body', 2, ['person']], ['man', 'body', 2, ['person']], ['person', 'body', 2, ['man']],
    ['fish', 'nature', 2, []], ['bird', 'nature', 2, ['feather']], ['dog', 'nature', 2, []], ['louse', 'nature', 2, []],
    ['tree', 'nature', 2, ['wood']], ['seed', 'nature', 2, ['egg']], ['leaf', 'nature', 2, ['feather']], ['root', 'nature', 2, []], ['bark', 'nature', 2, ['skin']],
    ['skin', 'body', 2, ['bark']], ['flesh', 'body', 2, []], ['blood', 'body', 2, ['red']], ['bone', 'body', 2, []], ['grease', 'body', 2, []],
    ['egg', 'nature', 2, ['seed']], ['horn', 'body', 2, []], ['tail', 'body', 2, []], ['feather', 'body', 2, ['hair', 'leaf']], ['hair', 'body', 2, ['feather']],
    ['head', 'body', 2, []], ['ear', 'body', 2, []], ['eye', 'body', 2, []], ['nose', 'body', 2, []], ['mouth', 'body', 2, ['tongue']],
    ['tooth', 'body', 2, []], ['tongue', 'body', 2, ['mouth', 'say']], ['claw', 'body', 2, []], ['foot', 'body', 2, ['knee']], ['knee', 'body', 2, ['foot']],
    ['hand', 'body', 2, []], ['belly', 'body', 2, ['heart']], ['neck', 'body', 2, []], ['breast', 'body', 2, ['heart']], ['heart', 'body', 2, ['belly', 'liver']], ['liver', 'body', 2, ['heart']],
    ['drink', 'verb', 2, []], ['eat', 'verb', 2, ['bite']], ['bite', 'verb', 2, ['eat']], ['see', 'verb', 2, ['know']], ['hear', 'verb', 2, ['know']],
    ['know', 'verb', 2, ['see']], ['sleep', 'verb', 2, ['lie']], ['die', 'verb', 2, ['kill']], ['kill', 'verb', 2, ['die']], ['swim', 'verb', 2, []],
    ['fly', 'verb', 2, []], ['walk', 'verb', 2, ['come']], ['come', 'verb', 2, ['walk']], ['lie', 'verb', 2, ['sleep']], ['sit', 'verb', 2, []],
    ['stand', 'verb', 2, []], ['give', 'verb', 2, []], ['say', 'verb', 2, ['tongue']],
    ['sun', 'nature', 2, ['day']], ['moon', 'nature', 2, []], ['star', 'nature', 2, []], ['water', 'nature', 2, ['rain']], ['rain', 'nature', 2, ['water']],
    ['stone', 'nature', 2, ['mountain']], ['sand', 'nature', 2, ['earth']], ['earth', 'nature', 2, ['sand']], ['cloud', 'nature', 2, ['smoke']], ['smoke', 'nature', 2, ['cloud']],
    ['fire', 'nature', 2, []], ['ash', 'nature', 2, ['sand']], ['burn', 'verb', 2, []], ['path', 'nature', 2, []], ['mountain', 'nature', 2, ['stone']],
    ['red', 'qual', 2, ['blood']], ['green', 'qual', 2, ['yellow']], ['yellow', 'qual', 2, ['green']], ['white', 'qual', 2, []], ['black', 'qual', 2, ['night']],
    ['night', 'nature', 2, ['black']], ['hot', 'qual', 2, []], ['cold', 'qual', 2, []], ['full', 'qual', 2, []], ['new', 'qual', 2, []],
    ['good', 'qual', 2, []], ['round', 'qual', 2, []], ['dry', 'qual', 2, []], ['name', 'nature', 2, []],
    ['day', 'nature', 2, ['sun']], ['river', 'nature', 2, ['water']], ['wood', 'nature', 2, ['tree']], ['sea', 'nature', 2, []],
    // cultural words: invented somewhere and spread by borrowing
    ['horse', 'culture', 2, []], ['iron', 'culture', 2, []], ['salt', 'culture', 2, []], ['wheel', 'culture', 2, []], ['wine', 'culture', 2, []],
    ['bread', 'culture', 2, []], ['boat', 'culture', 2, []], ['king', 'culture', 2, []], ['silver', 'culture', 2, []], ['book', 'culture', 3, []],
    ['tea', 'culture', 1, []], ['coin', 'culture', 2, []],
  ];
  CG.MEANINGS = M.map(([g, cat, len, rel], i) => ({ i, g, cat, len, rel }));
  CG.MI = Object.fromEntries(CG.MEANINGS.map(m => [m.g, m.i]));
  for (const m of CG.MEANINGS) m.reli = m.rel.map(g => CG.MI[g]);
  CG.CULTURE = CG.MEANINGS.filter(m => m.cat === 'culture').map(m => m.i);
  CG.PROTO_CULTURE = ['salt', 'boat'].map(g => CG.MI[g]); // the proto-language already has these

  // Transparent compounds languages coin new words with: meaning <- [part, part]
  CG.COMPOUNDS = {
    moon: [['night', 'sun']], star: [['night', 'eye'], ['sun', 'seed']], tear: [], cloud: [['sky', 'water'], ['rain', 'smoke']],
    feather: [['bird', 'hair'], ['bird', 'leaf']], bark: [['tree', 'skin']], egg: [['bird', 'seed']], root: [['tree', 'foot']],
    claw: [['hand', 'tooth'], ['foot', 'tooth']], knee: [['foot', 'head']], seed: [['tree', 'egg']], mountain: [['big', 'stone']],
    ash: [['fire', 'sand'], ['fire', 'earth']], smoke: [['fire', 'cloud']], sand: [['small', 'stone']], river: [['big', 'water'], ['water', 'path']],
    sea: [['big', 'water']], liver: [['red', 'belly']], grease: [['flesh', 'water']], tongue: [['mouth', 'flesh']], tail: [['dog', 'hair']],
    boat: [['wood', 'fish'], ['water', 'horse']], wheel: [['round', 'wood']], king: [['big', 'man'], ['head', 'man']], coin: [['round', 'silver']],
    silver: [['white', 'iron']], horse: [['big', 'dog']], book: [['name', 'leaf']], bread: [['seed', 'flesh']], wine: [['red', 'water']],
    day: [['sun', 'path']], night: [['black', 'sun']], green: [['leaf', 'red']], yellow: [['sun', 'red']], heart: [['blood', 'stone']],
    hair: [['head', 'feather']], fly: [['bird', 'walk']], swim: [['fish', 'walk']], kill: [['give', 'die']], drink: [['water', 'eat']],
  };
  CG.COMP_I = {};
  for (const [k, list] of Object.entries(CG.COMPOUNDS)) {
    if (CG.MI[k] == null) continue;
    CG.COMP_I[CG.MI[k]] = list.filter(p => CG.MI[p[0]] != null && CG.MI[p[1]] != null).map(p => [CG.MI[p[0]], CG.MI[p[1]]]);
  }

  // ---- Proto-language phonology
  CG.makeProtoPhonology = rng => {
    const cons = ['p', 't', 'k', 'm', 'n', 's'];
    const opt = [['b', 0.65], ['d', 0.65], ['g', 0.6], ['l', 0.85], ['r', 0.7], ['j', 0.8], ['w', 0.75], ['h', 0.45], ['ŋ', 0.35], ['q', 0.15],
      ['x', 0.2], ['ʔ', 0.18], ['t͡ʃ', 0.3], ['t͡s', 0.12], ['f', 0.2], ['z', 0.08], ['ʃ', 0.25], ['ɲ', 0.15], ['d͡ʒ', 0.12], ['ɣ', 0.08], ['θ', 0.07]];
    for (const [s, p] of opt) if (rng.chance(p)) cons.push(s);
    const vs = rng.weighted([[['a', 'i', 'u'], 2], [['a', 'e', 'i', 'o', 'u'], 6], [['a', 'e', 'i', 'o', 'u', 'ə'], 2], [['a', 'e', 'i', 'o', 'u', 'ɛ', 'ɔ'], 1.5], [['a', 'e', 'i', 'o', 'u', 'ɨ'], 1]]);
    const vowels = vs.slice();
    if (rng.chance(0.25)) for (const v of ['a', 'i', 'u']) vowels.push(v + 'ː');
    // frequency weights: a few sounds are much commoner than the rest
    const wC = {}, wV = {};
    const common = { t: 3, k: 3, n: 3, m: 2.4, s: 2.2, p: 2, l: 2, r: 1.8, j: 1.2, w: 1.1 };
    for (const c of cons) wC[c] = (common[c] || 1) * rng.range(0.5, 1.6);
    for (const v of vowels) wV[v] = ({ a: 3, i: 2.2, u: 2, e: 1.6, o: 1.5 }[v] || 0.8) * (v.includes('ː') ? 0.35 : 1) * rng.range(0.6, 1.5);
    const codas = cons.filter(c => ['m', 'n', 'ŋ', 'l', 'r', 's', 't', 'k', 'p', 'h', 'ʔ'].includes(c));
    return {
      cons, vowels, wC, wV, codas,
      pCoda: rng.range(0.05, 0.35), pFinalCoda: rng.range(0.05, 0.5), pCluster: rng.chance(0.5) ? rng.range(0.04, 0.14) : 0,
      pOnsetless: rng.range(0.03, 0.15), stress: rng.weighted([['initial', 5], ['penult', 4], ['final', 1.2]]),
    };
  };

  const pickW = (rng, w) => rng.weighted(Object.entries(w));
  CG.protoRoot = (ph, rng, nsyl) => {
    const f = [];
    for (let s = 0; s < nsyl; s++) {
      const onsetless = s === 0 ? rng.chance(ph.pOnsetless) : false;
      if (!onsetless) {
        f.push(pickW(rng, ph.wC));
        if (ph.pCluster && rng.chance(ph.pCluster) && ['p', 't', 'k', 'b', 'd', 'g', 'f'].includes(f[f.length - 1])) {
          const liq = ['r', 'l', 'w', 'j'].filter(x => ph.cons.includes(x));
          if (liq.length) f.push(rng.pick(liq));
        }
      }
      f.push(pickW(rng, ph.wV));
      const last = s === nsyl - 1;
      if (ph.codas.length && rng.chance(last ? ph.pFinalCoda : ph.pCoda)) f.push(rng.pick(ph.codas));
    }
    return f;
  };

  // Generate a whole proto-lexicon with distinct forms
  CG.makeProtoLexicon = (ph, rng) => {
    const lex = new Array(CG.MEANINGS.length).fill(null);
    const seen = new Set();
    for (const m of CG.MEANINGS) {
      if (m.cat === 'culture' && !CG.PROTO_CULTURE.includes(m.i)) continue;
      let f, tries = 0;
      do {
        const n = m.len === 1 ? (rng.chance(0.8) ? 1 : 2) : m.len === 3 ? 3 : rng.weighted([[1, 1.2], [2, 5], [3, 1.6]]);
        f = CG.protoRoot(ph, rng, n);
      } while ((seen.has(f.join('')) || (f.length < 2)) && ++tries < 30);
      seen.add(f.join(''));
      lex[m.i] = f;
    }
    return lex;
  };

  // Coin a fresh root in the style of a living language: borrow the consonant/vowel skeleton of one of its
  // words and fill it with sounds in proportion to how often the language uses them.
  CG.coinRoot = (forms, rng, nsylHint) => {
    const live = forms.filter(Boolean);
    const inv = CG.inventory(live);
    const wC = [], wV = [];
    for (const [s, n] of inv) (CG.isV(s) ? wV : wC).push([s, n]);
    if (!wC.length || !wV.length) return null;
    let tmpl = rng.pick(live);
    for (let k = 0; k < 6; k++) {
      const t = rng.pick(live);
      const ns = t.filter(CG.isV).length;
      if (nsylHint && ns === nsylHint) { tmpl = t; break; }
    }
    return tmpl.map(s => CG.isV(s) ? rng.weighted(wV) : rng.weighted(wC));
  };

  // Adapt a foreign form to a language's sound inventory: each sound the borrower lacks becomes its nearest native sound.
  CG.adapt = (form, inv) => {
    const native = [...inv.keys()];
    const out = form.map(s => {
      if (inv.has(s)) return s;
      let best = null, bd = 1e9;
      for (const n of native) { const d = CG.segDist(s, n); if (d < bd) { bd = d; best = n; } }
      return bd < 9 ? best : s;
    });
    return out;
  };
})(globalThis);
