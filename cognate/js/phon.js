// Cognate: segments and their features, tokenising, romanisation, stress.
'use strict';
(function (G) {
  const CG = G.CG;

  // ---- Consonants: [symbol, place, manner, voice]
  const PLACES = ['lab', 'lbd', 'den', 'alv', 'pa', 'pal', 'vel', 'uvu', 'glo'];
  const PLACE_NAME = { lab: 'bilabial', lbd: 'labiodental', den: 'dental', alv: 'alveolar', pa: 'postalveolar', pal: 'palatal', vel: 'velar', uvu: 'uvular', glo: 'glottal' };
  const MANNERS = ['stop', 'aff', 'fric', 'nas', 'trill', 'lat', 'gli'];
  const MANNER_NAME = { stop: 'stop', aff: 'affricate', fric: 'fricative', nas: 'nasal', trill: 'trill', lat: 'lateral', gli: 'glide' };
  const CONS = [
    ['p', 'lab', 'stop', 0], ['b', 'lab', 'stop', 1], ['ɸ', 'lab', 'fric', 0], ['β', 'lab', 'fric', 1], ['m', 'lab', 'nas', 1], ['w', 'lab', 'gli', 1],
    ['p͡f', 'lbd', 'aff', 0], ['f', 'lbd', 'fric', 0], ['v', 'lbd', 'fric', 1],
    ['θ', 'den', 'fric', 0], ['ð', 'den', 'fric', 1],
    ['t', 'alv', 'stop', 0], ['d', 'alv', 'stop', 1], ['t͡s', 'alv', 'aff', 0], ['d͡z', 'alv', 'aff', 1], ['s', 'alv', 'fric', 0], ['z', 'alv', 'fric', 1],
    ['n', 'alv', 'nas', 1], ['r', 'alv', 'trill', 1], ['l', 'alv', 'lat', 1],
    ['t͡ʃ', 'pa', 'aff', 0], ['d͡ʒ', 'pa', 'aff', 1], ['ʃ', 'pa', 'fric', 0], ['ʒ', 'pa', 'fric', 1],
    ['c', 'pal', 'stop', 0], ['ɟ', 'pal', 'stop', 1], ['ç', 'pal', 'fric', 0], ['ʝ', 'pal', 'fric', 1], ['ɲ', 'pal', 'nas', 1], ['ʎ', 'pal', 'lat', 1], ['j', 'pal', 'gli', 1],
    ['k', 'vel', 'stop', 0], ['g', 'vel', 'stop', 1], ['x', 'vel', 'fric', 0], ['ɣ', 'vel', 'fric', 1], ['ŋ', 'vel', 'nas', 1],
    ['q', 'uvu', 'stop', 0], ['χ', 'uvu', 'fric', 0], ['ʁ', 'uvu', 'fric', 1],
    ['ʔ', 'glo', 'stop', 0], ['h', 'glo', 'fric', 0],
  ];

  // ---- Vowels: base [symbol, height(0 high..3 low), back(0 front,1 central,2 back), round]
  const VBASE = [
    ['i', 0, 0, 0], ['y', 0, 0, 1], ['ɨ', 0, 1, 0], ['u', 0, 2, 1],
    ['e', 1, 0, 0], ['ø', 1, 0, 1], ['ə', 1, 1, 0], ['o', 1, 2, 1],
    ['ɛ', 2, 0, 0], ['œ', 2, 0, 1], ['ɔ', 2, 2, 1],
    ['æ', 3, 0, 0], ['a', 3, 1, 0], ['ɑ', 3, 2, 0],
  ];
  const NAS = '̃', LONG = 'ː';

  const FEAT = Object.create(null);
  const consKey = (p, m, v) => p + '|' + m + '|' + v;
  const vowKey = (h, b, r, l, n) => [h, b, r, l, n].join('|');
  const CONS_BY = Object.create(null), VOW_BY = Object.create(null);
  for (const [s, p, m, v] of CONS) {
    FEAT[s] = { type: 'C', place: p, manner: m, voice: v, son: (m === 'nas' || m === 'trill' || m === 'lat' || m === 'gli') ? 1 : 0, obs: (m === 'stop' || m === 'aff' || m === 'fric') ? 1 : 0 };
    CONS_BY[consKey(p, m, v)] = s;
  }
  for (const [b, h, bk, r] of VBASE) for (const n of [0, 1]) for (const l of [0, 1]) {
    const s = b + (n ? NAS : '') + (l ? LONG : '');
    FEAT[s] = { type: 'V', height: h, back: bk, round: r, long: l, nasal: n, base: b, voice: 1, son: 1, obs: 0 };
    VOW_BY[vowKey(h, bk, r, l, n)] = s;
  }
  // Affricates are written with a tie bar (t͡s) so they can't be confused with clusters (t + s).
  // When reading typed input, untied digraphs are taken as affricates too.
  const ALIAS = { ts: 't͡s', dz: 'd͡z', 'tʃ': 't͡ʃ', 'dʒ': 'd͡ʒ', pf: 'p͡f' };
  const SYMS = Object.keys(FEAT).concat(Object.keys(ALIAS)).sort((a, b) => b.length - a.length);
  CG.FEAT = FEAT; CG.PLACES = PLACES; CG.MANNERS = MANNERS; CG.PLACE_NAME = PLACE_NAME; CG.MANNER_NAME = MANNER_NAME;
  CG.CONS_LIST = CONS.map(c => c[0]);
  CG.VOWEL_BASES = VBASE.map(v => v[0]);
  CG.VBASE = VBASE;

  CG.isV = s => FEAT[s] && FEAT[s].type === 'V';
  CG.isC = s => FEAT[s] && FEAT[s].type === 'C';

  // Find the symbol with a segment's features changed, or null if no such segment exists.
  CG.alter = (sym, set) => {
    const f = FEAT[sym];
    if (!f) return null;
    if (f.type === 'C') {
      const p = set.place ?? f.place, m = set.manner ?? f.manner, v = set.voice ?? f.voice;
      return CONS_BY[consKey(p, m, v)] || null;
    }
    const h = set.height ?? f.height, b = set.back ?? f.back, r = set.round ?? f.round, l = set.long ?? f.long, n = set.nasal ?? f.nasal;
    return VOW_BY[vowKey(h, b, r, l, n)] || null;
  };
  CG.cons = (p, m, v) => CONS_BY[consKey(p, m, v)] || null;
  CG.vowel = (h, b, r, l = 0, n = 0) => VOW_BY[vowKey(h, b, r, l, n)] || null;

  // Split an IPA string into known segments (longest match first). Unknown characters are skipped.
  CG.tokenize = str => {
    const out = [];
    str = String(str).replace(/[ãẽĩõũỹ]/g, c => c.normalize('NFD')).replace(/[\s*\-\/\[\]]/g, '').replace(/:/g, LONG).replace(/\u0261/g, 'g');
    let i = 0;
    while (i < str.length) {
      let hit = null;
      for (const s of SYMS) if (str.startsWith(s, i)) { hit = s; break; }
      if (hit) { out.push(ALIAS[hit] || hit); i += hit.length; } else i++;
    }
    return out;
  };
  CG.str = f => f.join('');

  // Feature distance, used to adapt loanwords to a language's inventory.
  CG.segDist = (a, b) => {
    if (a === b) return 0;
    const A = FEAT[a], B = FEAT[b];
    if (A.type !== B.type) return 10;
    if (A.type === 'V') return Math.abs(A.height - B.height) * 1.2 + Math.abs(A.back - B.back) + (A.round !== B.round ? 0.8 : 0) + (A.long !== B.long ? 0.4 : 0) + (A.nasal !== B.nasal ? 0.6 : 0);
    const pi = PLACES.indexOf(A.place), pj = PLACES.indexOf(B.place);
    const mm = A.manner === B.manner ? 0 : (A.obs && B.obs) ? 1 : (A.son && B.son) ? 1.2 : 2.2;
    return Math.abs(pi - pj) * 0.6 + mm + (A.voice !== B.voice ? 0.7 : 0);
  };

  // ---- Stress. Returns the index (into the form) of the stressed vowel, or -1.
  CG.stressIndex = (form, type) => {
    const vs = [];
    for (let i = 0; i < form.length; i++) if (FEAT[form[i]] && FEAT[form[i]].type === 'V') vs.push(i);
    if (!vs.length) return -1;
    if (type === 'final') return vs[vs.length - 1];
    if (type === 'penult') return vs.length >= 2 ? vs[vs.length - 2] : vs[0];
    return vs[0];
  };
  CG.STRESS_NAME = { initial: 'first syllable', penult: 'next-to-last syllable', final: 'last syllable' };

  // Syllabify for display / speech: split before each consonant that precedes a vowel (onset maximisation, one C).
  CG.syllables = form => {
    const sy = []; let cur = [];
    for (let i = 0; i < form.length; i++) {
      const s = form[i];
      if (cur.length && CG.isC(s) && i + 1 < form.length && CG.isV(form[i + 1]) && cur.some(CG.isV)) { sy.push(cur); cur = []; }
      cur.push(s);
    }
    if (cur.length) {
      if (!cur.some(CG.isV) && sy.length) sy[sy.length - 1].push(...cur); else sy.push(cur);
    }
    return sy;
  };

  // ---- Romanisation, for names and the plain-spelling view
  const ROM = {
    'ɸ': 'ph', 'β': 'bh', 'θ': 'th', 'ð': 'dh', 't͡s': 'ts', 'd͡z': 'dz', 't͡ʃ': 'ch', 'd͡ʒ': 'j', 'ʃ': 'sh', 'ʒ': 'zh',
    'c': 'ky', 'ɟ': 'gy', 'ç': 'hy', 'ʝ': 'y', 'ɲ': 'ny', 'ʎ': 'ly', 'j': 'y', 'x': 'kh', 'ɣ': 'gh', 'ŋ': 'ng',
    'q': 'q', 'χ': 'kh', 'ʁ': 'gh', 'ʔ': "'", 'p͡f': 'pf',
  };
  const ROMV = { 'i': 'i', 'y': 'ü', 'ɨ': 'ï', 'u': 'u', 'e': 'e', 'ø': 'ö', 'ə': 'ë', 'o': 'o', 'ɛ': 'è', 'œ': 'ö', 'ɔ': 'ò', 'æ': 'ä', 'a': 'a', 'ɑ': 'â' };
  const ROMV_PLAIN = { 'y': 'u', 'ɨ': 'i', 'ø': 'o', 'ə': 'e', 'ɛ': 'e', 'œ': 'o', 'ɔ': 'o', 'æ': 'a', 'ɑ': 'a' };
  CG.romanize = (form, plain) => {
    let s = '';
    for (let i = 0; i < form.length; i++) {
      const seg = form[i], f = FEAT[seg];
      if (!f) continue;
      if (f.type === 'V') {
        let v = plain ? (ROMV_PLAIN[f.base] || f.base) : ROMV[f.base];
        if (f.long) v = plain ? v + v : ({ a: 'ā', e: 'ē', i: 'ī', o: 'ō', u: 'ū' }[v] || v + v);
        if (f.nasal) v += plain ? 'n' : '̃';
        s += v;
      } else {
        let c = ROM[seg] || seg;
        if (plain && c === "'") c = '';
        s += c;
      }
    }
    return s.normalize('NFC');
  };
  CG.cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

  // Make a language name out of a word: keep about two syllables and give it an English-looking ending.
  CG.nameFromForm = (form, rng) => {
    const syl = CG.syllables(form);
    let core = syl.slice(0, Math.min(syl.length, 2)).flat();
    let r = CG.romanize(core, true).replace(/[^a-z]/g, '');
    if (r.length < 3) r = CG.romanize(form, true).replace(/[^a-z]/g, '');
    if (r.length < 2) return null;
    r = r.replace(/(.)\1+/g, '$1$1').slice(0, 8);
    const last = r[r.length - 1];
    const vowelEnd = 'aeiou'.includes(last);
    const suf = vowelEnd ? rng.pick(['n', 'ri', 'nic', 'ran', 'sh', 'lian']) : rng.pick(['ic', 'ish', 'ian', 'i', 'an', 'ese']);
    if (r.endsWith('y') && !vowelEnd) r = r.slice(0, -1) + 'i';
    return CG.cap(r + suf);
  };

  // Describe a segment in words
  CG.describe = seg => {
    const f = FEAT[seg];
    if (!f) return seg;
    if (f.type === 'C') return `${f.voice ? 'voiced' : 'voiceless'} ${PLACE_NAME[f.place]} ${MANNER_NAME[f.manner]}`.replace('voiced bilabial nasal', 'bilabial nasal').replace(/voiced (\w+) (nasal|trill|lateral|glide)/, '$1 $2');
    const H = ['close', 'close-mid', 'open-mid', 'open'][f.height], B = ['front', 'central', 'back'][f.back];
    return `${f.long ? 'long ' : ''}${f.nasal ? 'nasal ' : ''}${H} ${B} ${f.round ? 'rounded' : 'unrounded'} vowel`;
  };
})(globalThis);
