// Headless run: node tools/run.js [seed] [years]
const fs = require('fs'), path = require('path'), vm = require('vm');
for (const f of ['core.js', 'phon.js', 'rules.js', 'lexicon.js', 'world.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), { filename: f });
const CG = globalThis.CG;
const seed = process.argv[2] || 'tune', years = +(process.argv[3] || 5000);
const t0 = Date.now();
const w = new CG.World({ seed, params: { years } });
while (!w.done) w.step();
console.log(`${Date.now() - t0} ms, ${w.langs.length} languages, ${w.living().length} living, ${w.rules.length} rules`);
for (const e of w.events) console.log(String(e.t).padStart(5), e.type.padEnd(7), e.text);
const live = w.living();
const ms = ['person', 'water', 'fire', 'two', 'eye', 'hand', 'horse', 'iron'].map(g => CG.MI[g]);
console.log('\n' + 'Proto'.padEnd(16) + ms.map(mi => (w.langs[0].lex[mi] ? CG.str(w.langs[0].lex[mi].f) : '-').padEnd(12)).join(''));
for (const L of live) console.log(L.name.padEnd(16) + ms.map(mi => (L.lex[mi] ? CG.str(L.lex[mi].f) + (L.lex[mi].o.k === 'loan' ? '<' : '') : '-').padEnd(12)).join('') + ' ' + w.ruleChain(L).length + 'r ' + L.cells);
