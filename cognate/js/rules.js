// Cognate: the sound-change engine and a library of natural sound changes.
//
// A rule is a list of steps. Each step rewrites a sequence of target segments (possibly empty, for insertions)
// into a sequence of outputs, in a left and right environment. Steps apply simultaneously across a word
// (environments are read from the input), and every word in the language undergoes the rule: sound change is regular.
'use strict';
(function (G) {
  const CG = G.CG, FEAT = CG.FEAT;
  const FK = ['type', 'place', 'manner', 'voice', 'son', 'obs', 'height', 'back', 'round', 'long', 'nasal', 'base'];

  function matchSeg(m, seg, i, ctx) {
    if (seg == null) return false;
    const f = FEAT[seg];
    if (!f) return false;
    if (m.syms && !m.syms.includes(seg)) return false;
    for (let k = 0; k < FK.length; k++) {
      const key = FK[k], v = m[key];
      if (v === undefined) continue;
      if (Array.isArray(v) ? !v.includes(f[key]) : f[key] !== v) return false;
    }
    if (m.stress !== undefined && ((ctx.stress === i) !== !!m.stress)) return false;
    if (m.not && matchSeg(m.not, seg, i, ctx)) return false;
    return true;
  }
  CG.matchSeg = matchSeg;

  function matchR(R, k, w, pos, ctx) {
    if (k === R.length) return true;
    const el = R[k];
    if (el === '#') return pos === w.length && matchR(R, k + 1, w, pos, ctx);
    if (el.star) return matchR(R, k + 1, w, pos, ctx) || (pos < w.length && matchSeg(el.star, w[pos], pos, ctx) && matchR(R, k, w, pos + 1, ctx));
    return pos < w.length && matchSeg(el, w[pos], pos, ctx) && matchR(R, k + 1, w, pos + 1, ctx);
  }
  function matchL(L, k, w, pos, ctx) { // k counts down from L.length-1, pos is the index just left of the previous match
    if (k < 0) return true;
    const el = L[k];
    if (el === '#') return pos === -1 && matchL(L, k - 1, w, pos, ctx);
    if (el.star) return matchL(L, k - 1, w, pos, ctx) || (pos >= 0 && matchSeg(el.star, w[pos], pos, ctx) && matchL(L, k, w, pos - 1, ctx));
    return pos >= 0 && matchSeg(el, w[pos], pos, ctx) && matchL(L, k - 1, w, pos - 1, ctx);
  }

  function resolve(o, segs, w, after) {
    if (o.sym) return o.sym;
    const s = segs[o.from];
    if (o.map) return o.map[s] ?? s;
    if (o.set) {
      const set = Object.assign({}, o.set);
      if (set.place === '@R') { const nx = FEAT[w[after]]; if (!nx || nx.type !== 'C') return null; set.place = nx.place; }
      return CG.alter(s, set);
    }
    return s;
  }

  function applyStep(st, w, stressType) {
    const ctx = { stress: CG.stressIndex(w, stressType) };
    const T = st.tgt, n = T.length, L = st.L || [], R = st.R || [];
    const out = [];
    let i = 0;
    while (i <= w.length) {
      if (n === 0) {
        if (matchL(L, L.length - 1, w, i - 1, ctx) && matchR(R, 0, w, i, ctx)) for (const o of st.out) out.push(o.sym);
        if (i < w.length) out.push(w[i]);
        i++;
        continue;
      }
      if (i + n <= w.length) {
        let ok = true;
        for (let k = 0; k < n && ok; k++) {
          const m = T[k];
          if (m.same) ok = w[i + k] === w[i + k - 1];
          else ok = matchSeg(m, w[i + k], i + k, ctx);
        }
        if (ok && matchL(L, L.length - 1, w, i - 1, ctx) && matchR(R, 0, w, i + n, ctx)) {
          const segs = w.slice(i, i + n);
          const prod = st.out.map(o => resolve(o, segs, w, i + n));
          if (prod.every(x => x)) { out.push(...prod); i += n; continue; }
        }
      }
      if (i < w.length) out.push(w[i]);
      i++;
    }
    return out;
  }

  // Apply a whole rule. Returns the new form (a new array) or the same array if nothing changed.
  CG.applyRule = (rule, form, stressType) => {
    if (rule.stressTo) return form;
    let w = form;
    for (const st of rule.steps) w = applyStep(st, w, stressType);
    if (!w.some(CG.isV)) return form; // never leave a word without a vowel
    if (w.length === form.length && w.every((s, i) => s === form[i])) return form;
    return w;
  };

  // ------------------------------------------------------------------------------------------------
  // Rule library
  const V = { type: 'V', label: 'V' }, C = { type: 'C', label: 'C' };
  const Vstr = { type: 'V', stress: 1, label: 'V́' }, Vuns = { type: 'V', stress: 0, label: 'V̆' };
  const NAS = { type: 'C', manner: 'nas', label: 'N' };

  const labelOf = (el, inv) => {
    if (el === '#') return '#';
    if (el.star) return labelOf(el.star, inv) + '₀';
    if (el.label) return el.label;
    const ss = [...inv.keys()].filter(s => matchSeg(el, s, -9, { stress: -1 }) || (el.stress !== undefined && matchSeg(Object.assign({}, el, { stress: undefined }), s, 0, { stress: 0 })));
    if (el.syms && el.syms.length === 1) return el.syms[0];
    const list = (el.syms || ss);
    return list.length === 1 ? list[0] : '{' + list.join(',') + '}';
  };
  const envNote = (L, R, inv) => {
    if (!(L && L.length) && !(R && R.length)) return '';
    return ' / ' + (L || []).map(e => labelOf(e, inv)).join('') + '_' + (R || []).map(e => labelOf(e, inv)).join('');
  };

  // Substitution rule from a list of [from, to] pairs (to may be '' for deletion).
  // cls: optional [class, result] labels used instead of long segment lists, e.g. ['[voiced obstruent]', '[voiceless]']
  function subst(pairs, L, R, inv, cls) {
    pairs = pairs.filter(([a, b]) => a !== b && inv.has(a));
    if (!pairs.length) return null;
    const dels = pairs.filter(p => !p[1]), subs = pairs.filter(p => p[1]);
    const steps = [];
    if (subs.length) steps.push({ tgt: [{ syms: subs.map(p => p[0]) }], out: [{ from: 0, map: Object.fromEntries(subs) }], L, R });
    if (dels.length) steps.push({ tgt: [{ syms: dels.map(p => p[0]) }], out: [], L, R });
    const allDel = !subs.length;
    let note;
    if (cls && pairs.length > 4) note = cls[0] + ' > ' + (allDel ? '∅' : cls[1]);
    else if (allDel && pairs.length > 2) note = '{' + pairs.map(p => p[0]).join(',') + '} > ∅';
    else note = pairs.map(p => p[0]).join(' ') + ' > ' + pairs.map(p => p[1] || '∅').join(' ');
    note += envNote(L, R, inv);
    return { steps, note };
  }
  // Pairs from a feature change over the language's inventory.
  function shiftPairs(inv, filter, set) {
    const out = [];
    for (const s of inv.keys()) {
      const f = FEAT[s];
      if (!f || !filter(f, s)) continue;
      const t = CG.alter(s, set);
      if (t && t !== s) out.push([s, t]);
    }
    return out.sort((a, b) => order(a[0]) - order(b[0]));
  }
  const ORDER = Object.create(null);
  [...CG.CONS_LIST, ...Object.keys(FEAT).filter(CG.isV)].forEach((s, i) => ORDER[s] = i);
  const order = s => ORDER[s] ?? 999;

  const pickSome = (rng, pairs) => {
    if (pairs.length <= 1 || rng.chance(0.55)) return pairs;
    const n = 1 + rng.int(pairs.length - 1);
    return rng.shuffle(pairs.slice()).slice(0, n).sort((a, b) => order(a[0]) - order(b[0]));
  };
  const frontHi = { type: 'V', back: 0, height: [0, 1] };
  const hiFront = { type: 'V', back: 0, height: 0 };

  const T = [];
  const def = (key, name, w, why, fn) => T.push({ key, name, w, why, fn });

  def('ivoice', 'Intervocalic voicing', 9, 'Voiceless stops became voiced between vowels, where the vocal folds were vibrating anyway.',
    (inv, rng) => subst(pickSome(rng, shiftPairs(inv, f => f.manner === 'stop' && !f.voice && f.place !== 'glo', { voice: 1 })), [V], [V], inv));
  def('spirant', 'Spirantisation', 6, 'Between vowels the closure of voiced stops weakened, so they became fricatives.',
    (inv, rng) => subst(pickSome(rng, shiftPairs(inv, f => f.manner === 'stop' && f.voice, { manner: 'fric' })), [V], [V], inv));
  def('grimm', 'Stop fricativisation', 2.5, 'Voiceless stops turned into fricatives everywhere, the kind of chain that turned Latin pater into English father.',
    (inv, rng) => {
      const pairs = shiftPairs(inv, f => f.manner === 'stop' && !f.voice && f.place !== 'glo' && f.place !== 'pal', { manner: 'fric' }).map(([a, b]) => [a, a === 'p' ? 'f' : b]);
      return subst(pickSome(rng, pairs), rng.chance(0.4) ? [V] : [], [], inv);
    });
  def('devoice', 'Stop devoicing', 2.5, 'Voiced stops lost their voicing and merged with or replaced the voiceless ones.',
    (inv, rng) => subst(pickSome(rng, shiftPairs(inv, f => f.manner === 'stop' && f.voice, { voice: 0 })), [], [], inv));
  def('finaldevoice', 'Final devoicing', 6, 'Voiced obstruents became voiceless at the end of a word, as in German and Russian.',
    (inv) => subst(shiftPairs(inv, f => f.obs && f.voice, { voice: 0 }), [], ['#'], inv, ['[voiced obstruent]', '[voiceless]']));
  def('debucc', 'Debuccalisation', 4, 'A fricative lost its place of articulation and was reduced to a breath, h.',
    (inv, rng) => {
      const src = rng.pick(['s', 'x', 'θ', 'ɸ', 'χ', 'f'].filter(s => inv.has(s)) || []);
      if (!src) return null;
      const env = src === 's' ? rng.pick([[['#'], [V]], [[V], [V]], [[], [C]]]) : [[], []];
      return subst([[src, 'h']], env[0], env[1], inv);
    });
  def('hloss', 'Loss of h', 4, 'The weak consonant h faded away.',
    (inv, rng) => {
      if (!inv.has('h')) return null;
      if (rng.chance(0.4)) {
        const r = subst([['h', '']], [V], [C], inv);
        r.steps.unshift({ tgt: [{ type: 'V', long: 0 }, { syms: ['h'] }], out: [{ from: 0, set: { long: 1 } }, { from: 1 }], R: [C] });
        r.note = 'Vh > Vː / _C, h > ∅';
        r.name = 'Compensatory lengthening';
        r.why = 'h was lost before a consonant, and the vowel before it grew long to fill the gap.';
        return r;
      }
      return subst([['h', '']], rng.chance(0.5) ? [V] : [], rng.chance(0.5) ? [V] : [], inv);
    });
  def('fvoice', 'Fricative voicing', 4, 'Voiceless fricatives became voiced between vowels.',
    (inv, rng) => subst(pickSome(rng, shiftPairs(inv, f => f.manner === 'fric' && !f.voice && f.place !== 'glo', { voice: 1 })), [V], [V], inv, ['[voiceless fricative]', '[voiced]']));
  def('rhot', 'Rhotacism', 2.5, 'z between vowels became r, as it did in Latin (honos, honoris).',
    (inv, rng) => inv.has('z') ? subst([['z', 'r']], [V], [V], inv) : (inv.has('s') && rng.chance(0.3) ? subst([['s', 'r']], [V], [V], inv) : null));
  def('palvel', 'Palatalisation', 7, 'Velars were pulled forward towards front vowels, as Latin centum became Italian cento.',
    (inv, rng) => {
      const aff = rng.chance(0.65);
      const pairs = [['k', aff ? 't͡ʃ' : 'c'], ['g', aff ? 'd͡ʒ' : 'ɟ'], ['x', 'ç'], ['ɣ', 'ʝ']].filter(p => inv.has(p[0]));
      return subst(pickSome(rng, pairs), [], [rng.chance(0.5) ? frontHi : hiFront], inv);
    });
  def('assib', 'Assibilation', 3.5, 't and d before i turned into hissing affricates.',
    (inv, rng) => subst(pickSome(rng, [['t', 't͡s'], ['d', 'd͡z']]), [], [hiFront], inv));
  def('spal', 's-palatalisation', 2.5, 's became sh next to a high front vowel.',
    (inv) => subst([['s', 'ʃ']], [], [hiFront], inv));
  def('deaff', 'Deaffrication', 3.5, 'Affricates lost their stop element and became plain fricatives.',
    (inv, rng) => subst(pickSome(rng, shiftPairs(inv, f => f.manner === 'aff' && f.place !== 'lbd', { manner: 'fric' })), [], [], inv, ['[affricate]', '[fricative]']));
  def('palaff', 'Palatal stops to affricates', 3, 'Palatal stops shifted to postalveolar affricates.',
    (inv) => subst([['c', 't͡ʃ'], ['ɟ', 'd͡ʒ']], [], [], inv));
  def('nasassim', 'Nasal assimilation', 4, 'A nasal took on the place of articulation of the consonant after it (n+p → mp).',
    (inv) => ({ steps: [{ tgt: [{ type: 'C', manner: 'nas' }], out: [{ from: 0, set: { place: '@R' } }], R: [{ type: 'C', manner: ['stop', 'aff'] }] }], note: 'N > [αplace] / _[C, αplace]' }));
  def('clusterassim', 'Cluster assimilation', 3, 'In clusters of two stops the first became a copy of the second (kt → tt, as Latin octo became Italian otto).',
    (inv) => ({ steps: [{ tgt: [{ type: 'C', manner: 'stop' }, { type: 'C', manner: 'stop' }], out: [{ from: 1 }, { from: 1 }] }], note: 'C₁C₂ > C₂C₂ (stops)' }));
  def('degem', 'Degemination', 4, 'Double consonants were shortened to single ones.',
    (inv) => ({ steps: [{ tgt: [{ type: 'C' }, { same: true }], out: [{ from: 0 }] }], note: 'CᵢCᵢ > Cᵢ' }));
  def('finalC', 'Loss of final consonants', 3, 'Consonants at the end of words weakened and dropped off.',
    (inv, rng) => {
      const man = rng.pick([['stop'], ['stop', 'aff', 'fric'], ['nas'], ['stop', 'aff', 'fric', 'nas', 'trill', 'lat']]);
      const ss = [...inv.keys()].filter(s => CG.isC(s) && man.includes(FEAT[s].manner)).sort((a, b) => order(a) - order(b));
      return ss.length ? subst(ss.map(s => [s, '']), [], ['#'], inv, [man.length > 4 ? 'C' : man.length > 1 ? '[obstruent]' : man[0] === 'nas' ? 'N' : '[stop]', '∅']) : null;
    });
  def('apocope', 'Apocope', 4, 'Unstressed vowels at the ends of words were dropped.',
    (inv) => ({ steps: [{ tgt: [{ type: 'V', stress: 0 }], out: [], L: [V, C], R: ['#'] }], note: 'V̆ > ∅ / VC_#' }));
  def('syncope', 'Syncope', 3, 'Unstressed vowels in the middle of words were squeezed out.',
    (inv) => ({ steps: [{ tgt: [{ type: 'V', stress: 0 }], out: [], L: [V, C], R: [C, V] }], note: 'V̆ > ∅ / VC_CV' }));
  def('raise', 'Vowel raising', 4, 'Mid vowels rose towards the high vowels.',
    (inv, rng) => {
      const env = rng.pick([[[], []], [[], ['#']], [[], [{ star: C }, hiFront]]]);
      const pairs = shiftPairs(inv, f => f.height === 1 && f.back !== 1, { height: 0 });
      return subst(pickSome(rng, pairs), env[0], env[1], inv);
    });
  def('lower', 'Vowel lowering', 3, 'High vowels opened up into mid vowels.',
    (inv, rng) => subst(pickSome(rng, shiftPairs(inv, f => f.height === 0 && f.back !== 1 && !f.long, { height: 1 })), [], rng.chance(0.5) ? [] : [C, '#'], inv));
  def('afront', 'Fronting of a', 2, 'a moved forward in the mouth.',
    (inv, rng) => subst([['a', rng.chance(0.6) ? 'æ' : 'e'], ['aː', 'æː']], [], rng.chance(0.5) ? [] : [C, { type: 'V', back: 0 }], inv));
  def('aback', 'Backing and rounding of a', 2, 'a drifted back and rounded towards o, as Old English stān became stone.',
    (inv) => inv.has('ɑ') ? subst([['ɑ', 'ɔ'], ['ɑː', 'ɔː']], [], [], inv) : subst([['aː', 'ɔː']].concat(inv.has('aː') ? [] : [['a', 'ɑ']]), [], [], inv));
  def('ufront', 'Fronting of u', 2, 'Back rounded vowels moved forward, giving front rounded vowels like French u.',
    (inv, rng) => subst(pickSome(rng, shiftPairs(inv, f => f.back === 2 && f.round && f.height <= 1, { back: 0 })), [], [], inv));
  def('unround', 'Unrounding', 3, 'Front rounded vowels lost their rounding.',
    (inv) => subst(shiftPairs(inv, f => f.back === 0 && f.round, { round: 0 }), [], [], inv, ['[front rounded V]', '[unrounded]']));
  def('umlaut', 'Umlaut', 3, 'Back vowels were fronted when an i followed in the next syllable, as Germanic *fōtiz became feet.',
    (inv) => {
      const r = subst(shiftPairs(inv, f => f.back === 2 && f.height <= 2, { back: 0 }).concat(inv.has('a') ? [['a', 'e']] : []), [], [{ star: C }, hiFront], inv);
      return r;
    });
  def('reduce', 'Vowel reduction', 3.5, 'Unstressed vowels lost their colour and became schwa.',
    (inv) => ({ steps: [{ tgt: [{ type: 'V', stress: 0, height: [1, 2, 3], long: 0, nasal: 0, not: { syms: ['ə'] } }], out: [{ sym: 'ə' }] }], note: 'V̆ > ə (non-high)' }));
  def('schwaloss', 'Loss of schwa', 3, 'Schwa disappeared at the end of words.',
    (inv, rng) => inv.has('ə') ? subst([['ə', '']], [V, C], ['#'], inv) : null);
  def('schwacol', 'Schwa colouring', 2, 'Schwa took on a full vowel quality.',
    (inv, rng) => inv.has('ə') ? subst([['ə', rng.pick(['e', 'a', 'ɨ', 'o'])]], [], [], inv) : null);
  def('midmerge', 'Merger of mid vowels', 3, 'Open-mid and close-mid vowels fell together.',
    (inv) => subst(shiftPairs(inv, f => f.height === 2, { height: 1 }), [], [], inv, ['[open-mid V]', '[close-mid]']));
  def('nasalise', 'Vowel nasalisation', 3, 'A vowel before a nasal consonant absorbed its nasality, and the consonant vanished (as in French bon).',
    (inv, rng) => {
      const R = rng.chance(0.5) ? ['#'] : [{ type: 'C', manner: ['stop', 'aff', 'fric'], label: 'C' }];
      return { steps: [{ tgt: [{ type: 'V', nasal: 0 }, { type: 'C', manner: 'nas' }], out: [{ from: 0, set: { nasal: 1 } }], R }], note: 'VN > Ṽ' + envNote([], R, inv) };
    });
  def('denas', 'Denasalisation', 2, 'Nasal vowels lost their nasality.',
    (inv) => subst(shiftPairs(inv, f => f.type === 'V' && f.nasal, { nasal: 0 }), [], [], inv, ['Ṽ', 'V']));
  def('monoph', 'Monophthongisation', 4, 'Diphthongs were simplified into single vowels (ai → e, au → o).',
    (inv, rng) => {
      const cands = [['a', 'j', 'eː'], ['a', 'w', 'oː'], ['e', 'j', 'iː'], ['o', 'w', 'uː'], ['o', 'j', 'ø'], ['e', 'w', 'ø'], ['ɛ', 'j', 'e'], ['ɔ', 'w', 'o']];
      const sh = rng.chance(0.5);
      const steps = [], notes = [];
      for (const [v, g, o] of cands) {
        if (!inv.has(v) || !inv.has(g)) continue;
        const outV = sh ? o.replace('ː', '') : o;
        steps.push({ tgt: [{ syms: [v] }, { syms: [g] }], out: [{ sym: outV }], R: [{ not: { type: 'V' }, type: 'C' }] });
        steps.push({ tgt: [{ syms: [v] }, { syms: [g] }], out: [{ sym: outV }], R: ['#'] });
        notes.push(v + g + ' > ' + outV);
      }
      if (!steps.length) return null;
      const keep = rng.chance(0.5) ? steps.length : 2 * (1 + rng.int(steps.length / 2));
      return { steps: steps.slice(0, keep), note: notes.slice(0, keep / 2).join(', ') + ' / _{C,#}' };
    });
  def('breaking', 'Diphthongisation', 2, 'Stressed mid vowels broke into rising diphthongs, as Latin petra became Spanish piedra.',
    (inv, rng) => {
      const steps = [], notes = [];
      for (const [v, g] of [['e', 'j'], ['ɛ', 'j'], ['o', 'w'], ['ɔ', 'w']]) if (inv.has(v) && rng.chance(0.75)) {
        steps.push({ tgt: [{ syms: [v], stress: 1 }], out: [{ sym: g }, { sym: g === 'j' ? 'e' : 'o' }] });
        notes.push(v + ' > ' + g + (g === 'j' ? 'e' : 'o'));
      }
      return steps.length ? { steps, note: notes.join(', ') + ' (stressed)' } : null;
    });
  def('complen', 'Compensatory lengthening', 2, 'A consonant before another consonant was lost, and the vowel before it grew long to fill the gap.',
    (inv, rng) => {
      const src = rng.pick(['s', 'x', 'ɣ', 'ʔ', 'r', 'l', 'h'].filter(s => inv.has(s)));
      if (!src) return null;
      return { steps: [{ tgt: [{ type: 'V', long: 0 }, { syms: [src] }], out: [{ from: 0, set: { long: 1 } }], R: [C] }], note: `V${src} > Vː / _C` };
    });
  def('shorten', 'Loss of vowel length', 3, 'Long vowels were shortened and merged with short ones.',
    (inv) => subst(shiftPairs(inv, f => f.type === 'V' && f.long, { long: 0 }), [], [], inv, ['Vː', 'V']));
  def('gvs', 'Long vowel shift', 1.5, 'Long high vowels became diphthongs, the first step of a shift like the English Great Vowel Shift.',
    (inv) => {
      const steps = [], notes = [];
      if (inv.has('iː')) { steps.push({ tgt: [{ syms: ['iː'] }], out: [{ sym: 'a' }, { sym: 'j' }] }); notes.push('iː > aj'); }
      if (inv.has('uː')) { steps.push({ tgt: [{ syms: ['uː'] }], out: [{ sym: 'a' }, { sym: 'w' }] }); notes.push('uː > aw'); }
      return steps.length ? { steps, note: notes.join(', ') } : null;
    });
  def('openlen', 'Open-syllable lengthening', 2, 'Stressed vowels in open syllables grew long.',
    (inv) => ({ steps: [{ tgt: [{ type: 'V', stress: 1, long: 0 }], out: [{ from: 0, set: { long: 1 } }], R: [C, V] }], note: 'V́ > V́ː / _CV' }));
  def('prothesis', 'Prothesis', 2, 'Words starting with s plus a consonant gained a vowel in front, as Latin schola became Spanish escuela.',
    (inv, rng) => inv.has('s') ? { steps: [{ tgt: [], out: [{ sym: rng.pick(['e', 'i', 'ə']) }], L: ['#'], R: [{ syms: ['s', 'ʃ'] }, C] }], note: '∅ > V / #_sC' } : null);
  def('epenth', 'Epenthesis', 2.5, 'A vowel was inserted to break up consonant clusters at the end of words.',
    (inv, rng) => { const v = rng.pick(['e', 'ə', 'i', 'u', 'a'].filter(s => inv.has(s)).concat(['ə'])); return { steps: [{ tgt: [], out: [{ sym: v }], L: [C], R: [C, '#'] }], note: `∅ > ${v} / C_C#` }; });
  def('lvoc', 'l-vocalisation', 2, 'l after a vowel turned into w, as in French autre from Latin alter.',
    (inv, rng) => subst([['l', 'w']], [V], rng.chance(0.5) ? [C] : [{ not: { type: 'V' }, type: 'C' }], inv) || null);
  def('liquid', 'Liquid merger', 2.5, 'The two liquids l and r fell together.',
    (inv, rng) => (inv.has('l') && inv.has('r')) ? subst(rng.chance(0.5) ? [['l', 'r']] : [['r', 'l']], [], [], inv) : null);
  def('wv', 'w-fortition', 2.5, 'w hardened into a fricative, as it did in late Latin.',
    (inv, rng) => subst([['w', rng.chance(0.7) ? 'v' : 'β']], rng.chance(0.4) ? ['#'] : [], [], inv));
  def('jdz', 'j-fortition', 1.5, 'Initial j hardened into an affricate, as Latin iam became Italian già.',
    (inv, rng) => subst([['j', rng.chance(0.7) ? 'd͡ʒ' : 'ʒ']], ['#'], [], inv));
  def('interdental', 'Loss of interdentals', 2.5, 'The interdental fricatives th and dh shifted to more common sounds.',
    (inv, rng) => { const k = rng.int(3); return subst([['θ', ['t', 's', 'f'][k]], ['ð', ['d', 'z', 'v'][k]]], [], [], inv); });
  def('pinit', 'Initial p-weakening', 1.5, 'p at the start of words weakened to f or h, as in Celtic and in Japanese.',
    (inv, rng) => subst([['p', rng.pick(['f', 'h', 'ɸ'])]], ['#'], [], inv));
  def('phif', 'ɸ to f', 3, 'The bilabial fricative became labiodental.',
    (inv) => subst([['ɸ', 'f'], ['β', 'v']], [], [], inv));
  def('ng', 'Velar nasal fronting', 1.5, 'The velar nasal merged with n.',
    (inv, rng) => subst([['ŋ', 'n']], rng.chance(0.5) ? ['#'] : [], [], inv));
  def('uvular', 'Uvular merger', 2.5, 'Uvular consonants moved forward and merged with velars.',
    (inv) => subst([['q', 'k'], ['χ', 'x'], ['ʁ', 'ɣ']], [], [], inv));
  def('xh', 'Velar fricative weakening', 2.5, 'The velar fricatives weakened.',
    (inv, rng) => subst([['x', 'h'], ['ɣ', rng.chance(0.5) ? 'j' : '']], [], [], inv));
  def('vfloss', 'Intervocalic lenition to zero', 2.5, 'Voiced fricatives between vowels weakened until nothing was left.',
    (inv, rng) => subst(pickSome(rng, [['β', ''], ['ð', ''], ['ɣ', ''], ['ʝ', 'j'], ['v', '']].filter(p => inv.has(p[0]))), [V], [V], inv));
  def('glide', 'Glide formation', 2.5, 'High vowels before another vowel became glides (i → j, u → w).',
    (inv) => subst([['i', 'j'], ['u', 'w'], ['y', 'j']], [], [V], inv));
  def('contract', 'Vowel contraction', 2.5, 'Two identical vowels in a row merged into one long vowel.',
    (inv) => ({ steps: [{ tgt: [{ type: 'V', long: 0 }, { same: true }], out: [{ from: 0, set: { long: 1 } }] }], note: 'VᵢVᵢ > Vᵢː' }));
  def('hiatus', 'Hiatus resolution', 2, 'Where two different vowels met, the first was dropped.',
    (inv) => ({ steps: [{ tgt: [{ type: 'V', stress: 0 }], out: [], R: [V] }], note: 'V̆ > ∅ / _V' }));
  def('stress', 'Stress shift', 1.2, 'The accent moved to a different syllable. This changes nothing at once, but decides which vowels later changes treat as stressed.',
    (inv, rng, lang) => { const to = rng.pick(['initial', 'penult', 'final'].filter(s => s !== lang.stress && (s !== 'final' || rng.chance(0.4)))); return to ? { steps: [], stressTo: to, note: `stress: ${CG.STRESS_NAME[lang.stress]} → ${CG.STRESS_NAME[to]}` } : null; });
  def('glottal', 'Glottal stop loss', 2, 'The glottal stop disappeared.',
    (inv, rng) => subst([['ʔ', '']], [], [], inv));
  def('kglot', 'Glottalisation', 1, 'k between vowels was reduced to a glottal stop, as t is in many English accents.',
    (inv, rng) => subst([[rng.chance(0.6) ? 'k' : 't', 'ʔ']], [V], [V], inv));
  def('fort', 'Fortition', 2, 'Voiced fricatives hardened into stops at the start of words.',
    (inv, rng) => subst(pickSome(rng, shiftPairs(inv, f => f.manner === 'fric' && f.voice && f.place !== 'lbd' && f.place !== 'pa', { manner: 'stop' }).concat(inv.has('v') ? [['v', 'b']] : [])), ['#'], [], inv));
  def('ts2s', 'Affricate simplification', 1.5, 'ts lost its stop element.',
    (inv) => subst([['t͡s', 's'], ['d͡z', 'z']], [], [], inv));
  def('tʃk', 'Back-shift of sh', 1, 'sh moved back into the mouth and became a velar fricative, as in Spanish.',
    (inv, rng) => subst([['ʃ', 'x'], ['ʒ', 'x']], [], [], inv));
  def('initialvoice', 'Initial voicing', 1.5, 'Voiceless fricatives at the start of words became voiced.',
    (inv, rng) => subst(pickSome(rng, shiftPairs(inv, f => f.manner === 'fric' && !f.voice && f.place !== 'glo' && f.place !== 'uvu', { voice: 1 })), ['#'], [], inv, ['[voiceless fricative]', '[voiced]']));

  CG.RULE_TEMPLATES = T;

  // Inventory of a list of forms: symbol -> count.
  CG.inventory = forms => {
    const inv = new Map();
    for (const f of forms) if (f) for (const s of f) inv.set(s, (inv.get(s) || 0) + 1);
    return inv;
  };

  let RULE_ID = 1;
  CG.resetRuleIds = (n = 1) => { RULE_ID = n; };
  CG.ruleIdNext = () => RULE_ID;

  // Propose a sound change that does something to this language. `lang` needs .stress; forms is the lexicon.
  // opts.minHits (default 2), opts.exclude (set of template keys), opts.only (array of template keys)
  CG.proposeRule = (lang, forms, rng, opts = {}) => {
    const inv = CG.inventory(forms);
    const minHits = opts.minHits ?? 2;
    const pool = T.filter(t => (!opts.exclude || !opts.exclude.has(t.key)) && (!opts.only || opts.only.includes(t.key)));
    for (let tries = 0; tries < 40; tries++) {
      const t = rng.weighted(pool, x => x.w * (opts.weight ? opts.weight(x) : 1));
      if (!t) return null;
      const r = t.fn(inv, rng, lang);
      if (!r) continue;
      const rule = { id: 0, key: t.key, name: r.name || t.name, why: r.why || t.why, steps: r.steps, note: r.note, stressTo: r.stressTo };
      if (rule.stressTo) return { rule, hits: 0, changes: [] };
      const changes = [];
      for (let i = 0; i < forms.length; i++) {
        const f = forms[i];
        if (!f) continue;
        const g = CG.applyRule(rule, f, lang.stress);
        if (g !== f) changes.push([i, f, g]);
      }
      if (changes.length < minHits) continue;
      if (opts.maxFrac && changes.length > opts.maxFrac * forms.filter(Boolean).length) continue;
      rule.id = RULE_ID++;
      return { rule, hits: changes.length, changes };
    }
    return null;
  };

  // Serialisable form of a rule (rules hold only plain data, so JSON works directly).
  CG.ruleFromJSON = o => o;
})(globalThis);
