# 🧬 Primordial

*Evolution in a shallow sea.*

An artificial-life ecosystem. Every creature steers with a small recurrent neural network it inherited from its
parents. It grazes or hunts, grows up, buds or mates when it is well fed, and dies of hunger, teeth or old age.
Copies are imperfect, so lineages drift apart. When one drifts far enough from its founder it is named as a new
species, and the panel tracks every species that has ever lived.

Nothing is scripted. Herbivores, scavengers, ambush hunters, armoured grazers and arms races appear (or don't)
because of selection alone.

**Run it:** open `index.html` in a browser. It has no build step, no dependencies and no network calls.
If your browser blocks local files, run `python3 -m http.server` in this folder and go to <http://localhost:8000>.

## What you can do

| | |
|---|---|
| 🔍 **Watch any creature** | Click one to follow it. You see its field of view (five eye sectors, shaded by what each sees), its trail, a plain reading of what it is doing, its energy, health and age, every gene against its species' founder, and its brain firing live. Jump to its parent or one of its children. |
| ⑂ **Life** | A Muller plot: each species is a band nested inside its parent's band, so you see descent and abundance at once. Below it, the living species and a trait-space scatter (any two genes) where species show up as clusters. |
| 🌳 **Tree** | A timeline phylogeny of every species that reached a chosen size, from the moment it split to its extinction. |
| 📈 **Trends** | Grazers, omnivores and hunters over time, plant and carrion energy, and the mean of every evolving trait. |
| 📜 **Chronicle** | New species (with how they differ from their parent), extinctions (and who ate the last one), population crashes, generation milestones and the rise and fall of predators. |
| 🗺️ **Five landscapes** | Patchy meadows; an archipelago (speciation by isolation); two seas divided by a barren strait; a fertility gradient (clines); a ring reef around an empty lagoon. |
| ✋ **Interventions** | Scatter algae, paint the ground fertile or barren, smite, release a plague on the commonest species, an algal bloom, a hard winter, or new life from outside. |
| ⚙️ **Rules of nature** | Plant sprouting and growth, seasons and year length, rot, mutation, bite strength, cost of living, the immigration floor, the species threshold, and whether relatives may mate. All change live. |
| 🫙 **Specimen jar** | Save a creature's genome in your browser and release it into any other world. |
| 💾 **Save** | Save a world to a file and load it later. A loaded world continues exactly as the saved one would have. Or save a picture. |

Keys: `Space` pause · `.` one tick · `1`–`5` speed · `Q W E R X` tools · `F` follow · `Esc` let go · `0` fit view · `[` `]` brush size.

## How it works

**Genome** (`js/genome.js`). Eleven body genes in [0, 1] and 752 network weights.

- *Body:* size, muscle, diet (0 plants, 1 meat), sight range, field of view, armour, brood energy, life history
  (late maturity means a long life), clock rate, colour and the lineage's own mutation rate, which also evolves.
- *Brain:* 34 inputs → 12 recurrent tanh neurons → 4 outputs (forward, turn, bite, breed), plus direct input → output
  links for reflexes. Inputs: for each of five eye sectors, how close the nearest plant, carcass and creature are,
  how alike that creature's colour is and how much bigger it is; then energy, health, age, speed, a wall ahead,
  pain, an internal clock and the ground's fertility. Zero weights are absent links and cost nothing to run, so brains
  grow and prune connections over time.
- *Mutation:* each weight mutates with the lineage's own probability (geometric skipping keeps this cheap): nudged,
  pruned, or a new link grown. *Crossover* inherits whole neurons (incoming weights, bias and outgoing weights) from one
  parent or the other, so working circuits stay together.
- *Founders* get a weak ancestral wiring (swim forward, steer toward food on either side, keep the jaws shut unless
  carnivorous, breed when fed) on top of sparse random weights. Everything else is evolved.

**Metabolism and trade-offs** (`js/world.js`). Basal cost scales with mass^0.75 (Kleiber's law). Swimming costs grow
with thrust² and muscle; eyes cost range × field of view; each brain link costs a little; armour costs upkeep.
Digestion is a trade-off: plant efficiency is 1 − diet^1.4 and meat efficiency diet^1.4, and meat is richer.
Biting damages in proportion to size and carnivory, is blunted by the target's armour, and armour spikes the biter.
Corpses become carrion that rots.

**Breeding and species.** A creature breeds when its network says so, it is mature, off cooldown and has enough energy.
If a willing relative is touching it, they mate and recombine; otherwise it buds. A child is compared with the
*founder* of its parent's species; past a genetic distance threshold (weighted trait distance plus mean weight
difference) it founds a new species. Species get generated Latin names, inherit their parent's genus for a few
splits, and sometimes take an epithet from the founder's body (*herbi-*, *sarco-*, *scuto-*, *mega-*…).

**World.** Plants sprout where the ground is fertile, grow, and follow the seasons, which are opposite in the north and
south. Senses and collisions use counting-sort spatial grids rebuilt every tick; vision works in each creature's own
frame with a fast `atan2`. The simulation is deterministic from its seed, including after a save and load.

**Charts** (`js/charts.js`). The Muller plot nests each species' clade inside its parent's band at every sampled moment.
The tree places each parent in the middle of its daughters. History is down-sampled as it grows, so long runs stay light.

`node tools/check.js` runs three seeds for 24,000 ticks, checks invariants as it goes (no NaN, energy within
capacity, species counts consistent, founders kept), checks the brain and genome machinery and the tools, and checks
that a saved world reloads and continues bit-for-bit. `node tools/run.js <seed> <ticks> [param=value…]` prints a
running summary, for tuning.
