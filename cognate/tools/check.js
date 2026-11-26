// Headless checks: node tools/check.js
// Sound-change engine, every rule template, world invariants and determinism, etymologies, puzzles, speech.
const fs = require('fs'), path = require('path'), vm = require('vm');
for (const f of ['core.js', 'phon.js', 'rules.js', 'lexicon.js', 'world.js', 'speech.js', 'puzzle.js', 'langview.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), { filename: f });
}
const CG = globalThis.CG;
let fail = 0, pass = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  FAIL', msg); } };
const S = f => CG.str(f), T = CG.tokenize;

console.log('phonology');
for (const s of Object.keys(CG.FEAT)) ok(S(T(s)) === s && T(s).length === 1, `tokenize ${s}`);
ok(T('tʃaːmbiʃõ').length === 7 && T('tʃaːmbiʃõ')[0] === 't͡ʃ', 'tokenize a mixed word, untied affricate');
ok(T('t͡sa').length === 2 && T('t͡sa')[0] === 't͡s', 'tied affricate');
ok(T('ã').length === 1 && CG.FEAT[T('ã')[0]].nasal === 1, 'precomposed nasal vowel');
ok(CG.alter('p', { voice: 1 }) === 'b' && CG.alter('k', { manner: 'fric' }) === 'x' && CG.alter('o', { back: 0 }) === 'ø', 'feature changes');
ok(CG.alter('a', { long: 1, nasal: 1 }) === T('ãː')[0], 'long nasal vowel');
ok(CG.alter('ʔ', { voice: 1 }) === null, 'impossible segment gives null');
ok(CG.stressIndex(T('kapita'), 'initial') === 1 && CG.stressIndex(T('kapita'), 'penult') === 3 && CG.stressIndex(T('kapita'), 'final') === 5, 'stress positions');
ok(CG.romanize(T('ʃaŋ')) === 'shang', 'romanisation');

console.log('sound-change engine');
const V = { type: 'V' }, C = { type: 'C' };
const rule = (steps, note) => ({ steps, note: note || '' });
const ap = (r, w, st = 'initial') => S(CG.applyRule(r, T(w), st));
const ivoice = rule([{ tgt: [{ syms: ['p', 't', 'k'] }], out: [{ from: 0, map: { p: 'b', t: 'd', k: 'g' } }], L: [V], R: [V] }]);
ok(ap(ivoice, 'kapata') === 'kabada', 'intervocalic voicing');
ok(ap(ivoice, 'pak') === 'pak', 'voicing leaves edges alone');
ok(ap(ivoice, 'apta') === 'apta', 'voicing needs vowels on both sides');
const fdev = rule([{ tgt: [{ obs: 1, voice: 1 }], out: [{ from: 0, set: { voice: 0 } }], R: ['#'] }]);
ok(ap(fdev, 'bad') === 'bat' && ap(fdev, 'dab') === 'dap' && ap(fdev, 'bada') === 'bada', 'final devoicing');
const proth = rule([{ tgt: [], out: [{ sym: 'e' }], L: ['#'], R: [{ syms: ['s'] }, C] }]);
ok(ap(proth, 'skola') === 'eskola' && ap(proth, 'sola') === 'sola', 'prothesis inserts at the word edge');
const epen = rule([{ tgt: [], out: [{ sym: 'ə' }], L: [C], R: [C, '#'] }]);
ok(ap(epen, 'kalt') === 'kalət', 'epenthesis before a final cluster');
const apoc = rule([{ tgt: [{ type: 'V', stress: 0 }], out: [], L: [V, C], R: ['#'] }]);
ok(ap(apoc, 'kapita') === 'kapit' && ap(apoc, 'ka') === 'ka', 'apocope keeps short words');
ok(ap(apoc, 'kapa', 'final') === 'kapa', 'apocope spares a stressed final vowel');
const assim = rule([{ tgt: [{ type: 'C', manner: 'nas' }], out: [{ from: 0, set: { place: '@R' } }], R: [{ type: 'C', manner: ['stop', 'aff'] }] }]);
ok(ap(assim, 'anpa') === 'ampa' && ap(assim, 'anka') === 'aŋka' && ap(assim, 'ana') === 'ana', 'nasal place assimilation');
const degem = rule([{ tgt: [{ type: 'C' }, { same: true }], out: [{ from: 0 }] }]);
ok(ap(degem, 'atta') === 'ata' && ap(degem, 'atka') === 'atka', 'degemination');
const uml = rule([{ tgt: [{ syms: ['o', 'u', 'a'] }], out: [{ from: 0, map: { o: 'ø', u: 'y', a: 'e' } }], R: [{ star: C }, { type: 'V', back: 0, height: 0 }] }]);
ok(ap(uml, 'kotki') === 'køtki' && ap(uml, 'koti') === 'køti' && ap(uml, 'kota') === 'kota', 'umlaut across any number of consonants');
const mono = rule([{ tgt: [{ syms: ['a'] }, { syms: ['j'] }], out: [{ sym: 'e' }], R: ['#'] }]);
ok(ap(mono, 'taj') === 'te' && ap(mono, 'taja') === 'taja', 'monophthongisation');
const nasal = rule([{ tgt: [{ type: 'V', nasal: 0 }, { type: 'C', manner: 'nas' }], out: [{ from: 0, set: { nasal: 1 } }], R: ['#'] }]);
ok(ap(nasal, 'bon') === S(T('bõ')), 'vowel nasalisation');
const killV = rule([{ tgt: [V], out: [] }]);
ok(ap(killV, 'ta') === 'ta', 'a word never loses its last vowel');
ok(ap(rule([{ tgt: [{ syms: ['k'] }], out: [{ sym: 't͡ʃ' }], R: [{ type: 'V', back: 0 }] }]), 'kiko') === 't͡ʃiko', 'simultaneous application reads the input');

console.log('rule templates');
{
  const rng = new CG.RNG(99);
  const seen = new Set();
  for (let k = 0; k < 120; k++) {
    const ph = CG.makeProtoPhonology(rng);
    let lex = CG.makeProtoLexicon(ph, rng).filter(Boolean);
    // age the lexicon with a few random laws so that later-stage templates have something to work on
    for (let a = 0; a < k % 12; a++) { const p = CG.proposeRule({ stress: ph.stress }, lex, rng, { maxFrac: 0.7 }); if (p) lex = lex.map(f => CG.applyRule(p.rule, f, ph.stress)); }
    for (const t of CG.RULE_TEMPLATES) {
      const p = CG.proposeRule({ stress: ph.stress }, lex, rng, { only: [t.key], minHits: 1 });
      if (!p) continue;
      seen.add(t.key);
      ok(typeof p.rule.note === 'string' && p.rule.note.length > 0, `${t.key} has a notation`);
      for (const [, a, b] of p.changes) {
        if (!b.every(s => CG.FEAT[s])) { ok(false, `${t.key}: unknown segment in ${S(b)}`); break; }
        if (!b.some(CG.isV)) { ok(false, `${t.key}: ${S(a)} > ${S(b)} lost every vowel`); break; }
      }
    }
  }
  const never = CG.RULE_TEMPLATES.filter(t => !seen.has(t.key)).map(t => t.key);
  ok(never.length <= 3, `templates that never fired: ${never.join(', ')}`);
  console.log(`  ${seen.size} of ${CG.RULE_TEMPLATES.length} templates fired`);
}

console.log('world');
const fingerprint = w => CG.hashSeed(w.living().map(L => L.name + ':' + L.lex.map(x => x ? S(x.f) : '-').join(',')).join('|') + w.events.length + w.rules.length);
for (const seed of ['alpha', 'basalt', 'cedar']) {
  const w = new CG.World({ seed, params: { years: 4000 } });
  while (!w.done) w.step();
  const live = w.living();
  ok(live.length >= 4, `${seed}: ${live.length} living languages`);
  ok(w.events.some(e => e.type === 'split'), `${seed}: languages split`);
  // territory bookkeeping
  const counts = new Map();
  for (const o of w.owner) if (o >= 0) counts.set(o, (counts.get(o) || 0) + 1);
  for (const [id, n] of counts) ok(w.langs[id].died == null && w.langs[id].cells === n, `${seed}: owner ${id} is a living language with ${n} cells`);
  for (const L of live) ok(L.cells > 0, `${seed}: ${L.name} has land`);
  for (let i = 0; i < w.owner.length; i++) if (w.owner[i] >= 0 && !w.land[i]) { ok(false, `${seed}: a language owns sea`); break; }
  // lexicons
  for (const L of live) {
    for (const m of CG.MEANINGS) {
      const wd = L.lex[m.i];
      if (m.cat !== 'culture' && !wd) { ok(false, `${seed}: ${L.name} has no word for ${m.g}`); continue; }
      if (!wd) continue;
      if (!wd.f.length || !wd.f.every(s => CG.FEAT[s]) || !wd.f.some(CG.isV)) ok(false, `${seed}: bad form ${S(wd.f)} in ${L.name}`);
      if (!w.etyma[wd.e]) ok(false, `${seed}: unknown etymon`);
      for (let k = 1; k < wd.h.length; k++) if (wd.h[k][0] < wd.h[k - 1][0]) { ok(false, `${seed}: sound-law history out of order`); break; }
      for (const [, rid] of wd.h) if (!w.rules[rid]) ok(false, `${seed}: unknown rule ${rid}`);
    }
  }
  // every recorded example of a law is reproduced by applying that law
  let checked = 0;
  for (const R of w.rules) {
    if (R.stressTo) continue;
    for (const [, a, b] of R.ex) { if (S(CG.applyRule(R, a, R.stress)) !== S(b)) ok(false, `${seed}: ${R.note} on ${S(a)}`); checked++; }
  }
  ok(checked > 100, `${seed}: ${checked} law examples replayed`);
  // the tree
  for (const L of w.langs) {
    if (L.fate === 'split') ok(L.children.length >= 2 && L.children.every(c => w.langs[c].born === L.died), `${seed}: ${L.name} split cleanly`);
    if (L.parent >= 0) ok(w.langs[L.parent].children.includes(L.id), `${seed}: parent link`);
  }
  ok(new Set(w.langs.map(L => L.name)).size === w.langs.length, `${seed}: language names are unique`);
  // etymologies and language cards render for everything
  let n = 0;
  try {
    for (const L of w.langs) { CG.langHTML(w, L); for (let mi = 0; mi < L.lex.length; mi++) { CG.etymologyHTML(w, L, mi); n++; } }
    CG.overviewHTML(w);
    ok(true, 'render');
  } catch (e) { ok(false, `${seed}: etymology rendering threw ${e.stack}`); }
  // inherited words: replaying the recorded laws from the etymon reproduces the word
  let replayed = 0, bad = 0;
  for (const L of live) for (const wd of L.lex) {
    if (!wd || wd.o.k !== 'inh') continue;
    let f = w.etyma[wd.e].f;
    for (let k = 0; k < wd.h.length; k++) {
      if (S(wd.h[k][2]) !== S(f)) { bad++; break; }
      f = k + 1 < wd.h.length ? wd.h[k + 1][2] : wd.f;
    }
    replayed++;
  }
  ok(bad === 0, `${seed}: ${bad} of ${replayed} inherited words have a broken history`);
  // determinism
  const w2 = new CG.World({ seed, params: { years: 4000 } });
  while (!w2.done) w2.step();
  ok(fingerprint(w) === fingerprint(w2), `${seed}: same seed, same history`);
  console.log(`  ${seed}: ${live.length} living, ${w.langs.length} in all, ${w.rules.length} laws, ${w.inventions.length} inventions, ${n} etymologies rendered`);
}
{
  const a = new CG.World({ seed: 'one', params: { years: 1000 } }), b = new CG.World({ seed: 'two', params: { years: 1000 } });
  ok(S(a.langs[0].lex[0].f) + S(a.langs[0].lex[20].f) !== S(b.langs[0].lex[0].f) + S(b.langs[0].lex[20].f), 'different seeds, different languages');
}

console.log('puzzles');
{
  let made = 0;
  for (let n = 1; n <= 25; n++) for (let lv = 0; lv < 3; lv++) {
    const r = CG.makeReconstruct(n, lv);
    ok(!!r, `reconstruct #${n}/${lv}`);
    if (r) {
      made++;
      for (const d of r.daughters) {
        let forms = r.proto.slice();
        for (const x of d.rules) forms = forms.map(f => CG.applyRule(x.rule, f, r.stress));
        ok(forms.map(S).join() === d.forms.map(S).join(), `reconstruct #${n}: ${d.name} follows from its laws`);
      }
      ok(r.proto.every(f => CG.scoreGuess(S(f), f) === 1), 'a correct guess scores 1');
    }
    const l = CG.makeLaw(n, lv);
    ok(!!l, `law #${n}/${lv}`);
    if (l) {
      made++;
      const eff = R => l.before.map(f => S(CG.applyRule(R, f, l.stress))).join();
      ok(eff(l.options[l.answer]) === l.after.map(S).join(), `law #${n}: answer reproduces the data`);
      ok(l.options.filter((R, i) => i !== l.answer).every(R => eff(R) !== l.after.map(S).join()), `law #${n}: distractors do not`);
    }
    const o = CG.makeOrder(n, lv);
    ok(!!o, `order #${n}/${lv}`);
    if (o) {
      made++;
      const want = o.after.map(S).join();
      const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
      const good = perms.filter(p => CG.runOrder(o.rules, p, o.before, o.stress).map(S).join() === want);
      ok(good.length === 1 && good[0].join() === o.answer.join(), `order #${n}: exactly one order works and it is the answer`);
    }
  }
  console.log(`  ${made} puzzles generated and verified`);
}

console.log('speech');
{
  for (const s of Object.keys(CG.FEAT)) {
    const d = CG.synth(['t', s, 'a'].filter(x => x !== 't' || CG.isC(s) === false), 'initial');
    if (!d.every(Number.isFinite)) { ok(false, `synth NaN for ${s}`); }
  }
  const d = CG.synth(T('kamuʃõːr'), 'penult');
  ok(d.length > 2000 && Math.max(...d) <= 0.61, 'synth output is normalised');
}

console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nall ${pass} checks passed`);
process.exit(fail ? 1 : 0);
