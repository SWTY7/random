# ⑂ Cognate

*One language, five thousand years, a whole family.*

A historical-linguistics simulator. One proto-language starts in a small homeland on an invented continent. Its
speakers spread out. Languages that cover too much ground, or get cut off by the sea, drift apart and split into
daughters. Expanding peoples absorb their neighbours. Inventions like the horse, iron and the wheel carry their
names across family lines. Every word in every language keeps its full history, so you can trace each one back
through every sound law that touched it.

**Run it:** open `index.html` in a browser. It has no build step, no dependencies and no network calls.
If your browser blocks local files, run `python3 -m http.server` in this folder and go to <http://localhost:8000>.

## What you can do

| | |
|---|---|
| 🗺️ **Atlas** | Territories on a shaded parchment map, related languages in related colours. **Word map**: pick a meaning and see each language's word for it, coloured by origin, so cognate sets and spreading loanwords show up as regions. **Sound map**: where a sound such as ʃ or ã is used. |
| ⑂ **Tree** | The family tree on a time axis. Ticks on each branch mark its sound laws (hover to read them), ◆ marks inventions, and dashed lines are languages that died out. |
| 📖 **Lexicon** | Side-by-side table of 117 meanings (the Swadesh 100 plus later cultural words) for the living languages, one branch, or one lineage from the proto-language down to today. Replacements and loans stand out by colour. IPA or a rough Latin spelling. |
| 🔎 **Etymologies** | Click any word: where it came from (inherited, coined, compounded, shifted from another meaning, or borrowed, with the donor's own history nested inside), then each sound law in order with its year and notation, then its relatives in other living languages. |
| 🗣️ **Language cards** | Lineage, what the language is named after (its own word for 'person', 'earth', …), stress, how many proto words it kept, its closest relatives, a consonant chart and vowel list with sounds gained and lost, and every sound law it inherited or made. |
| 🔊 **Speech** | A small formant synthesiser (glottal pulse, three resonators, shaped noise) pronounces any word, stress included. |
| 🧩 **Puzzles** | **Reconstruct**: three daughter languages, find the ancestor (the comparative method). **Spot the law**: which sound change turned these words into those? **Chronology**: put three laws in the order that explains the data. Three levels and endless numbered puzzles, each checked to have one answer. |
| 📜 **Chronicle** | Splits, deaths, inventions and sound laws, with a chart of how many languages were alive at each point. |
| ⚙️ **World** | Seed, length of the run, and the rates of sound change, word replacement, contact and splitting. The address bar keeps the seed, so a link reproduces the same history. |

Keys: `Space` run/pause · `1`–`4` views · `Esc` close or deselect.

## How it works

- **Segments** (`js/phon.js`): about 100 sounds described by features (place, manner, voice; height, backness,
  rounding, length, nasality). A change like "become voiced" or "move to the place of the next consonant" is a feature
  edit that is looked up back into a symbol. Affricates use tie bars (t͡s) so they are never confused with clusters.
- **Sound laws** (`js/rules.js`): a rule is a list of rewrite steps (target sequence → outputs, with left and right
  environments that can include word edges, stress and "any number of consonants"). Steps apply simultaneously
  across the word, and every word in the language goes through them. That makes the laws regular, which is why the
  comparative method works. There are 62 templates: lenition, Grimm-style shifts, palatalisation, umlaut, apocope and
  syncope, nasal vowels, monophthongs and diphthongs, compensatory lengthening, prothesis, rhotacism, mergers, stress
  shifts and more. A language only takes a law that would actually change some of its words. Laws that shorten words
  get rarer as words get short, and laws that add sounds get commoner, so words neither vanish nor grow without bound.
- **Words** (`js/lexicon.js`): the proto-language gets a random sound system and phonotactics. New roots are coined
  by taking the consonant/vowel shape of an existing word and filling it with the language's own sounds, weighted by
  how often it uses them. Loans are adapted to the borrower by nearest-feature substitution.
- **World** (`js/world.js`): every 25 years, languages spread over a 168×108 grid (plains are easy, mountains hard,
  short sea crossings possible), take land from weaker neighbours, and split when they get too big or fall apart into
  pieces. Basic vocabulary is replaced at a glottochronology-like rate. Neighbours borrow from the more prestigious
  side. When a language dies, the language that replaced it keeps a few of its words.
- **Puzzles** (`js/puzzle.js`): built from the same engine. Distractor laws are kept only if they would give different
  results on the shown words. Chronology puzzles are kept only if exactly one of the six orders fits.

`node tools/check.js` tests the rule engine on hand-made cases and every template on evolved lexicons. It runs three
worlds and checks territory bookkeeping, that every word's recorded history replays exactly, that every recorded law
example reproduces, that runs are deterministic, and that every etymology renders. It also verifies 225 puzzles and
the synthesiser. `node tools/run.js [seed] [years]` prints a run's chronicle and a word table.

Grammar, dialect continua, analogy and sporadic change are not simulated. The Neogrammarians would approve.
