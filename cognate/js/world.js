// Cognate: the world. A continent, speech communities spreading over it, splitting, borrowing and dying out,
// while every language keeps changing its sounds and its words.
'use strict';
(function (G) {
  const CG = G.CG;

  const DEFAULTS = {
    years: 5000,       // how long a run lasts
    dt: 25,            // years per step
    soundRate: 0.4,    // sound changes per language per century
    lexRate: 0.16,     // share of core words replaced per millennium
    contact: 1,        // how readily neighbours borrow
    splitRate: 1,      // how readily big languages break up
    maxLiving: 26,
  };
  CG.WORLD_DEFAULTS = DEFAULTS;
  const DELETERS = new Set(['apocope', 'syncope', 'finalC', 'hloss', 'vfloss', 'schwaloss', 'degem', 'hiatus', 'glottal', 'complen', 'nasalise']);
  const BUILDERS = new Set(['epenth', 'prothesis', 'breaking', 'gvs', 'openlen']);

  class World {
    constructor(opts = {}) {
      this.seed = String(opts.seed ?? 'cognate');
      this.p = Object.assign({}, DEFAULTS, opts.params || {});
      this.rng = new CG.RNG(CG.hashSeed(this.seed));
      this.t = 0;
      this.langs = [];
      this.rules = [];      // id -> rule record
      this.etyma = [];      // id -> etymon record
      this.events = [];
      this.history = [];    // {t, living, families}
      this.names = new Set();
      this.inventions = [];
      this.version = 0;     // bumps whenever languages change; the UI uses it to know when to redraw
      this.genMap(this.rng.fork('map'));
      this.genProto(this.rng.fork('proto'));
      this.computeLabels();
      this.record();
    }

    // ---------------------------------------------------------------- map
    genMap(rng) {
      const W = this.W = 168, H = this.H = 108, N = W * H;
      const elev = this.elev = new Float32Array(N);
      const moist = this.moist = new Float32Array(N);
      const n1 = CG.makeNoise(rng.u32()), n2 = CG.makeNoise(rng.u32()), n3 = CG.makeNoise(rng.u32());
      const blobs = [];
      const nb = 3 + rng.int(3);
      for (let i = 0; i < nb; i++) blobs.push([rng.range(0.18, 0.82) * W, rng.range(0.2, 0.8) * H, rng.range(0.12, 0.3) * W, rng.range(0.6, 1.1)]);
      const ridgeA = rng.range(0, Math.PI), rx = Math.cos(ridgeA), ry = Math.sin(ridgeA);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let m = 0;
        for (const [bx, by, br, bw] of blobs) { const d = Math.hypot(x - bx, (y - by) * 1.25) / br; m = Math.max(m, bw * Math.max(0, 1 - d * d)); }
        const n = n1(x / 34, y / 34, 5);
        const ridge = 1 - Math.abs(n3((x * rx + y * ry) / 40, (y * rx - x * ry) / 40, 3) * 2 - 1);
        let e = m * 0.55 + (n - 0.5) * 1.5 + Math.pow(ridge, 5) * 0.4 * m;
        const ex = Math.min(x, W - 1 - x, y, H - 1 - y);
        if (ex < 6) e -= (6 - ex) * 0.05;
        elev[y * W + x] = e;
        moist[y * W + x] = n2(x / 26, y / 26, 4);
      }
      // normalise so that about 46% is land
      const sorted = Array.from(elev).sort((a, b) => a - b);
      const sea = sorted[Math.floor(N * 0.56)], top = sorted[N - 1];
      for (let i = 0; i < N; i++) elev[i] = elev[i] < sea ? (elev[i] - sea) / (sea - sorted[0]) : (elev[i] - sea) / (top - sea);
      const land = this.land = new Uint8Array(N);
      const cost = this.cost = new Float32Array(N);
      this.biome = new Uint8Array(N); // 0 sea, 1 grass, 2 forest, 3 desert, 4 tundra, 5 hills, 6 mountain
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, e = elev[i];
        if (e <= 0) { cost[i] = Infinity; continue; }
        land[i] = 1;
        const lat = Math.abs(y / H - 0.5) * 2, mo = moist[i];
        let b = 1;
        if (e > 0.62) b = 6; else if (e > 0.42) b = 5; else if (lat > 0.82) b = 4; else if (mo < 0.36 && lat < 0.6) b = 3; else if (mo > 0.56) b = 2;
        this.biome[i] = b;
        cost[i] = [0, 1, 1.5, 2.6, 2.8, 2.2, 7][b];
      }
      // remove specks of land smaller than 6 cells
      const seen = new Uint8Array(N);
      for (let i = 0; i < N; i++) if (land[i] && !seen[i]) {
        const comp = [i]; seen[i] = 1;
        for (let k = 0; k < comp.length; k++) for (const j of this.nbrs(comp[k])) if (land[j] && !seen[j]) { seen[j] = 1; comp.push(j); }
        if (comp.length < 6) for (const j of comp) { land[j] = 0; cost[j] = Infinity; this.biome[j] = 0; elev[j] = -0.05; }
      }
      this.owner = new Int16Array(N).fill(-1);
      this.landCount = land.reduce((a, b) => a + b, 0);
    }
    nbrs(i) {
      const W = this.W, x = i % W, y = (i / W) | 0, out = [];
      if (x > 0) out.push(i - 1); if (x < W - 1) out.push(i + 1);
      if (y > 0) out.push(i - W); if (y < this.H - 1) out.push(i + W);
      return out;
    }

    // ---------------------------------------------------------------- languages
    newLang(parent, lex) {
      const L = {
        id: this.langs.length, name: '', parent: parent ? parent.id : -1, children: [], born: this.t, died: null, fate: null,
        stress: parent ? parent.stress : this.phon.stress, lex, rules: [], vigor: parent ? parent.vigor * this.rng.range(0.7, 1.3) : 1,
        cells: 0, hue: 0, hueR: [0, 360], depth: parent ? parent.depth + 1 : 0, lostTo: {}, label: null, absorbedBy: -1, lastSplitCheck: 0,
        boost: 0, inventedT: {},
      };
      this.langs.push(L);
      if (parent) parent.children.push(L.id);
      return L;
    }
    nameLang(L, prefix) {
      const r = this.rng.fork('name' + L.id);
      const tryM = ['person', 'we', 'man', 'say', 'earth', 'tongue', 'name', 'good', 'river', 'mountain', 'sun', 'path', 'stone', 'woman', 'speak'].map(g => CG.MI[g]).filter(x => x != null);
      if (L.parent >= 0) r.shuffle(tryM);
      for (const mi of tryM) {
        const w = L.lex[mi];
        if (!w) continue;
        for (let k = 0; k < 3; k++) {
          const base = CG.nameFromForm(w.f, r);
          if (!base) break;
          const nm = (prefix || '') + base;
          if (!this.names.has(nm)) { this.names.add(nm); L.name = nm; L.endonym = { m: mi, f: w.f.slice() }; return; }
        }
      }
      let k = 2; while (this.names.has(`${L.name || 'Lang'} ${k}`)) k++;
      L.name = `Lang ${L.id}`; this.names.add(L.name);
    }

    genProto(rng) {
      const ph = this.phon = CG.makeProtoPhonology(rng);
      const forms = CG.makeProtoLexicon(ph, rng);
      const lex = forms.map((f, mi) => {
        if (!f) return null;
        const e = this.etyma.length;
        this.etyma.push({ id: e, kind: 'proto', f: f.slice(), m: mi, lang: 0, t: 0 });
        return { f, e, o: { k: 'inh' }, h: [] };
      });
      const P = this.newLang(null, lex);
      this.nameLang(P, 'Proto-');
      P.hueR = [rng.range(0, 360), 0]; P.hueR[1] = P.hueR[0] + 360; P.hue = (P.hueR[0] + 180) % 360;
      // homeland: a lowland cell well inside the land
      const W = this.W;
      let best = -1, bs = -1;
      for (let k = 0; k < 400; k++) {
        const i = rng.int(W * this.H);
        if (!this.land[i] || this.biome[i] >= 3) continue;
        let s = 0;
        for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const j = i + dy * W + dx; if (j >= 0 && j < W * this.H && this.land[j] && this.biome[j] < 5) s++; }
        s += rng.next() * 10;
        if (s > bs) { bs = s; best = i; }
      }
      this.homeland = best;
      const bx = best % W, by = (best / W) | 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const j = (by + dy) * W + bx + dx;
        if (this.land[j] && dx * dx + dy * dy <= 5) { this.owner[j] = P.id; P.cells++; }
      }
      this.event('origin', `${P.name} is spoken in a small homeland. Its people call themselves ${this.wordRef(P, P.endonym.m)}.`, [P.id]);
    }

    living() { return this.langs.filter(L => L.died == null); }
    get done() { return this.t >= this.p.years; }
    wordRef(L, mi) { const w = L.lex[mi]; return w ? `*${CG.str(w.f)}*` : '—'; }
    event(type, text, langs, extra) { this.events.push(Object.assign({ t: this.t, type, text, langs: langs || [] }, extra || {})); }

    // ---------------------------------------------------------------- one step
    step() {
      const dt = this.p.dt, rng = this.rng;
      this.t += dt;
      const live = this.living();
      for (const L of live) {
        L.vigor = CG.clamp(L.vigor * Math.exp(rng.range(-0.16, 0.16)) + (1 - L.vigor) * 0.015, 0.35, 2.2);
        if (L.boost > 0) L.boost--;
      }
      const borders = this.spread();
      this.splitAndPrune();
      for (const L of this.living()) {
        this.soundChange(L);
        this.lexicalChange(L, borders);
      }
      this.contact(borders);
      this.invent();
      this.computeLabels();
      this.record();
      this.version++;
    }

    // Territorial spread, conquest and seafaring. Returns border lengths between language pairs.
    spread() {
      const rng = this.rng, W = this.W, N = W * this.H, own = this.owner, next = Int16Array.from(own);
      const borders = new Map();
      const vig = L => L.vigor * (L.boost > 0 ? 2.2 : 1);
      const start = rng.int(N), stride = 7919;
      for (let k = 0; k < N; k++) {
        const i = (start + k * stride) % N;
        const o = own[i];
        if (o < 0) continue;
        const L = this.langs[o];
        const nb = this.nbrs(i);
        for (const j of nb) {
          const p = own[j];
          if (p >= 0 && p !== o) { const key = o < p ? o * 4096 + p : p * 4096 + o; borders.set(key, (borders.get(key) || 0) + 0.5); }
        }
        for (const q of nb) if (this.land[q] && own[q] < 0 && next[q] < 0 && rng.chance(0.22 * vig(L) / this.cost[q])) next[q] = o;
        const j = nb[rng.int(nb.length)];
        const p = own[j];
        if (this.land[j]) {
          if (p < 0) { /* handled above */ }
          else if (p !== o) {
            const M = this.langs[p];
            const r = vig(L) / vig(M) * Math.pow((L.cells + 5) / (M.cells + 5), 0.5);
            if (rng.chance(0.014 * Math.min(8, r * r * r) / this.cost[j])) { next[j] = o; M.lostTo[o] = (M.lostTo[o] || 0) + 1; }
          }
        } else if (rng.chance(0.03 * vig(L))) {
          const dx = (j % W) - (i % W), dy = ((j / W) | 0) - ((i / W) | 0);
          let x = i % W, y = (i / W) | 0;
          for (let s = 0; s < 14; s++) {
            x += dx; y += dy;
            if (x < 0 || y < 0 || x >= W || y >= this.H) break;
            const q = y * W + x;
            if (this.land[q]) { if (own[q] < 0 && next[q] < 0) next[q] = o; break; }
          }
        }
      }
      this.owner = next;
      for (const L of this.langs) L.cells = 0;
      for (let i = 0; i < N; i++) if (next[i] >= 0) this.langs[next[i]].cells++;
      return borders;
    }

    territory(L) {
      const out = [], own = this.owner;
      for (let i = 0; i < own.length; i++) if (own[i] === L.id) out.push(i);
      return out;
    }
    components(cells, id) {
      const seen = new Set(), comps = [];
      for (const c of cells) {
        if (seen.has(c)) continue;
        const comp = [c]; seen.add(c);
        for (let k = 0; k < comp.length; k++) for (const j of this.nbrs(comp[k])) if (this.owner[j] === id && !seen.has(j)) { seen.add(j); comp.push(j); }
        comps.push(comp);
      }
      return comps.sort((a, b) => b.length - a.length);
    }
    // BFS distances within a set of cells from some sources
    bfsWithin(set, sources) {
      const dist = new Map(); const q = [];
      for (const s of sources) { dist.set(s, 0); q.push(s); }
      for (let k = 0; k < q.length; k++) {
        const c = q[k], d = dist.get(c);
        for (const j of this.nbrs(c)) if (set.has(j) && !dist.has(j)) { dist.set(j, d + 1); q.push(j); }
      }
      return dist;
    }

    splitAndPrune() {
      const rng = this.rng, p = this.p;
      for (const L of this.living()) {
        if (L.cells === 0) { this.kill(L); continue; }
        const age = this.t - L.born;
        const nLive = this.living().length;
        const crowd = Math.max(0, 1 - nLive / p.maxLiving);
        // islands and cut-off pockets: separate speech communities drift apart
        if (age >= 150 && this.t - L.lastSplitCheck >= 100) {
          L.lastSplitCheck = this.t;
          const comps = this.components(this.territory(L), L.id);
          const big = comps.filter(c => c.length >= 14);
          for (const c of comps) if (c.length < 4) for (const i of c) { this.owner[i] = -1; L.cells--; }
          if (big.length >= 2 && crowd > 0.05 && rng.chance(0.5)) { this.split(L, big.slice(0, 3), 'isolation'); continue; }
        }
        if (age >= 300 && L.cells >= 70) {
          const pr = 0.035 * p.splitRate * Math.min(3, L.cells / 140) * crowd;
          if (rng.chance(pr)) {
            const cells = this.territory(L), set = new Set(cells);
            const k = (L.cells > 260 && rng.chance(0.45)) ? 3 : 2;
            const seeds = [cells[rng.int(cells.length)]];
            let d = this.bfsWithin(set, seeds);
            seeds.length = 0;
            for (let s = 0; s < k; s++) {
              let far = -1, fd = -1;
              for (const [c, v] of d) if (v > fd) { fd = v; far = c; }
              if (far < 0) break;
              seeds.push(far);
              d = this.bfsWithin(set, seeds);
            }
            if (seeds.length < 2) continue;
            // grow regions from each seed at the same pace (a weighted race over terrain would also work)
            const region = new Map(), q = [];
            seeds.forEach((s, r) => { region.set(s, r); q.push(s); });
            for (let a = 0; a < q.length; a++) for (const j of this.nbrs(q[a])) if (set.has(j) && !region.has(j)) { region.set(j, region.get(q[a])); q.push(j); }
            const parts = seeds.map(() => []);
            for (const c of cells) if (region.has(c)) parts[region.get(c)].push(c);
            if (parts.every(x => x.length >= 12)) this.split(L, parts, 'spread');
          }
        }
      }
    }

    split(L, parts, why) {
      const rng = this.rng;
      L.died = this.t; L.fate = 'split';
      const [h0, h1] = L.hueR, span = (h1 - h0) / parts.length;
      const kids = [];
      // which part is where, for names: compass direction relative to the parent's centre
      parts.forEach((cells, k) => {
        const lex = L.lex.map(w => w && { f: w.f.slice(), e: w.e, o: w.o, h: w.h.slice() });
        const D = this.newLang(L, lex);
        D.hueR = [h0 + span * k, h0 + span * (k + 1)];
        D.hue = ((h0 + span * (k + 0.5)) % 360 + 360) % 360;
        for (const c of cells) this.owner[c] = D.id;
        D.cells = cells.length;
        kids.push(D);
      });
      L.cells = 0;
      for (let i = 0; i < this.owner.length; i++) if (this.owner[i] === L.id) this.owner[i] = -1;
      // founder effect: each daughter starts with a change of its own
      for (const D of kids) { this.soundChange(D, true); this.nameLang(D); }
      const list = kids.map(D => D.name);
      const txt = list.length === 2 ? `${list[0]} and ${list[1]}` : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
      this.event('split', why === 'isolation' ? `${L.name} speakers are cut off from one another, and their speech drifts into ${txt}.` : `${L.name} has spread so far that it breaks up into ${txt}.`, [L.id, ...kids.map(D => D.id)]);
    }

    kill(L) {
      L.died = this.t; L.fate = 'absorbed';
      let best = -1, bn = 0;
      for (const [k, v] of Object.entries(L.lostTo)) { const M = this.langs[+k]; if (v > bn && M.died == null) { bn = v; best = +k; } }
      L.absorbedBy = best;
      if (best >= 0) {
        const M = this.langs[best];
        const taken = [];
        const cand = L.lex.map((w, mi) => [w, mi]).filter(([w, mi]) => w && M.lex[mi] && M.lex[mi].e !== w.e);
        const n = Math.min(cand.length, 1 + this.rng.int(3));
        this.rng.shuffle(cand);
        for (let k = 0; k < n; k++) { this.borrow(M, L, cand[k][1], 'substrate'); taken.push(CG.MEANINGS[cand[k][1]].g); }
        this.event('death', `The last speakers of ${L.name} shift to ${M.name}.` + (taken.length ? ` A few of its words live on there as loans: '${taken.join("', '")}'.` : ''), [L.id, M.id]);
      } else this.event('death', `${L.name} dies out.`, [L.id]);
    }

    // ---------------------------------------------------------------- sound change
    soundChange(L, force) {
      const rng = this.rng, p = this.p;
      if (!force && !rng.chance(p.soundRate * p.dt / 100)) return;
      const forms = L.lex.map(w => w && w.f);
      const live = forms.filter(Boolean);
      const avg = live.reduce((a, f) => a + f.length, 0) / Math.max(1, live.length);
      const recent = new Set(this.ruleChain(L).slice(-4).map(id => this.rules[id].key));
      const weight = t => (DELETERS.has(t.key) ? (avg < 3.6 ? 0.15 : avg > 6 ? 2.2 : 1) : 1) * (BUILDERS.has(t.key) ? (avg < 3.6 ? 2.5 : 1) : 1);
      const prop = CG.proposeRule(L, forms, rng, { exclude: recent, weight, maxFrac: 0.75 });
      if (!prop) return;
      const R = prop.rule;
      R.id = this.rules.length; R.lang = L.id; R.t = this.t; R.hits = prop.hits; R.stress = L.stress;
      R.ex = prop.changes.slice(0, 4).map(([mi, a, b]) => [mi, a, b]);
      this.rules.push(R);
      L.rules.push(R.id);
      if (R.stressTo) { L.stress = R.stressTo; return; }
      for (const [mi, a, b] of prop.changes) { const w = L.lex[mi]; w.h.push([this.t, R.id, a]); w.f = b; }
    }
    // All rules a language inherited and acquired, oldest first
    ruleChain(L) {
      const chain = [];
      for (let X = L; X; X = X.parent >= 0 ? this.langs[X.parent] : null) chain.unshift(...X.rules.filter(r => this.rules[r].t <= (L.died ?? Infinity)));
      return chain;
    }
    ancestors(L) { const a = []; for (let X = L; X; X = X.parent >= 0 ? this.langs[X.parent] : null) a.unshift(X); return a; }

    // ---------------------------------------------------------------- lexical change
    lexicalChange(L, borders) {
      const rng = this.rng, p = this.p;
      const base = 1 - Math.pow(1 - p.lexRate, p.dt / 1000);
      const neigh = this.neighbours(L, borders);
      for (let mi = 0; mi < L.lex.length; mi++) {
        const w = L.lex[mi];
        if (!w) continue;
        const m = CG.MEANINGS[mi];
        const r = base * (m.cat === 'pron' || m.cat === 'num' ? 0.35 : m.cat === 'culture' ? 0.5 : 1);
        if (!rng.chance(r)) continue;
        const how = rng.weighted([['coin', 3], ['comp', CG.COMP_I[mi] && CG.COMP_I[mi].length ? 2.5 : 0], ['shift', m.reli.length ? 2.5 : 0], ['loan', neigh.length ? 2.5 * p.contact : 0]]);
        if (how === 'coin') this.coin(L, mi);
        else if (how === 'comp') this.compound(L, mi);
        else if (how === 'shift') this.shift(L, mi);
        else if (how === 'loan') this.borrow(L, this.langs[rng.weighted(neigh)], mi, 'contact');
      }
    }
    neighbours(L, borders) {
      const out = [];
      for (const [key, n] of borders) {
        const a = Math.floor(key / 4096), b = key % 4096;
        if (a === L.id && this.langs[b].died == null) out.push([b, n]);
        else if (b === L.id && this.langs[a].died == null) out.push([a, n]);
      }
      return out;
    }
    newEtymon(kind, f, mi, L, extra) {
      const e = this.etyma.length;
      this.etyma.push(Object.assign({ id: e, kind, f: f.slice(), m: mi, lang: L.id, t: this.t }, extra || {}));
      return e;
    }
    coin(L, mi, quiet) {
      const f = CG.coinRoot(L.lex.map(w => w && w.f), this.rng, CG.MEANINGS[mi].len);
      if (!f || !f.some(CG.isV)) return false;
      const old = L.lex[mi];
      L.lex[mi] = { f, e: this.newEtymon('coin', f, mi, L), o: { k: 'coin', t: this.t, lang: L.id, prev: old ? old.f.slice() : null }, h: [] };
      return true;
    }
    compound(L, mi) {
      const opts = (CG.COMP_I[mi] || []).filter(([a, b]) => L.lex[a] && L.lex[b]);
      if (!opts.length) return this.coin(L, mi);
      const [a, b] = this.rng.pick(opts);
      const f = L.lex[a].f.concat(L.lex[b].f);
      const old = L.lex[mi];
      L.lex[mi] = { f, e: this.newEtymon('comp', f, mi, L, { parts: [a, b] }), o: { k: 'comp', t: this.t, lang: L.id, parts: [a, b], prev: old ? old.f.slice() : null }, h: [] };
      return true;
    }
    shift(L, mi) {
      // the word for a related meaning takes over this meaning, and that word's old slot is refilled by another
      const m = CG.MEANINGS[mi];
      const src = this.rng.pick(m.reli);
      const sw = L.lex[src];
      if (!sw || sw.e === (L.lex[mi] && L.lex[mi].e)) return this.coin(L, mi);
      const old = L.lex[mi];
      L.lex[mi] = { f: sw.f.slice(), e: sw.e, o: { k: 'shift', t: this.t, lang: L.id, from: src, prev: old ? old.f.slice() : null, via: sw.o }, h: sw.h.slice() };
      if (this.rng.chance(0.5)) this.coin(L, src); // the old meaning gets a new word, or keeps both senses
      return true;
    }
    borrow(L, D, mi, why) {
      const dw = D.lex[mi];
      if (!dw) return false;
      if (L.lex[mi] && L.lex[mi].e === dw.e) return false;
      const inv = CG.inventory(L.lex.map(w => w && w.f));
      const f = CG.adapt(dw.f, inv);
      const old = L.lex[mi];
      L.lex[mi] = { f, e: dw.e, o: { k: 'loan', t: this.t, lang: L.id, from: D.id, src: dw.f.slice(), why, srcO: dw.o, srcH: dw.h.slice(), prev: old ? old.f.slice() : null }, h: [] };
      return true;
    }

    // ---------------------------------------------------------------- contact and culture
    contact(borders) {
      const rng = this.rng, p = this.p;
      for (const [key, n] of borders) {
        const A = this.langs[Math.floor(key / 4096)], B = this.langs[key % 4096];
        if (A.died != null || B.died != null) continue;
        const prestige = X => X.vigor * Math.sqrt(X.cells + 1) * (X.boost > 0 ? 2 : 1);
        // cultural words flow towards whoever lacks them
        for (const mi of CG.CULTURE) {
          const a = A.lex[mi], b = B.lex[mi];
          if (!!a === !!b) continue;
          const [D, R] = a ? [A, B] : [B, A];
          if (rng.chance(0.12 * p.contact * Math.min(1, n / 8))) {
            this.borrow(R, D, mi, 'culture');
            const e = this.etyma[D.lex[mi].e];
            e.reach = (e.reach || 1) + 1;
          }
        }
        if (!rng.chance(0.03 * p.contact * Math.min(1, n / 25))) continue;
        const [D, R] = prestige(A) > prestige(B) * rng.range(0.6, 1.6) ? [A, B] : [B, A];
        const mi = rng.weighted(CG.MEANINGS.filter(m => D.lex[m.i]).map(m => [m.i, m.cat === 'culture' ? 6 : m.cat === 'pron' ? 0.1 : 1]));
        if (mi != null) this.borrow(R, D, mi, 'contact');
      }
    }
    invent() {
      const rng = this.rng;
      if (this.t < 800) return;
      const known = new Set();
      for (const L of this.living()) for (const mi of CG.CULTURE) if (L.lex[mi]) known.add(mi);
      const missing = CG.CULTURE.filter(mi => !known.has(mi));
      if (!missing.length || !rng.chance(0.045)) return;
      const live = this.living();
      const L = rng.weighted(live.map(X => [X, X.cells + 5]));
      const mi = rng.pick(missing);
      const g = CG.MEANINGS[mi].g;
      if ((CG.COMP_I[mi] || []).some(([a, b]) => L.lex[a] && L.lex[b]) && rng.chance(0.5)) this.compound(L, mi); else this.coin(L, mi);
      L.lex[mi].o.k = L.lex[mi].o.k === 'comp' ? 'comp' : 'coin';
      this.etyma[L.lex[mi].e].wander = true;
      this.inventions.push({ t: this.t, mi, lang: L.id, e: L.lex[mi].e });
      const what = { horse: 'tame the horse', iron: 'learn to smelt iron', wheel: 'build the first wheels', wine: 'make wine', bread: 'bake bread', king: 'crown a king', silver: 'mine silver', book: 'write the first books', tea: 'brew tea', coin: 'strike coins', salt: 'trade salt', boat: 'build boats' }[g] || `discover ${g}`;
      const strong = ['horse', 'iron', 'wheel', 'king'].includes(g);
      if (strong) { L.boost = 10; L.vigor = Math.min(2.2, L.vigor * 1.4); }
      this.event('invent', `The ${L.name} speakers ${what}, and call it ${this.wordRef(L, mi)}.` + (strong ? ' They begin to expand.' : ''), [L.id], { mi });
    }

    // ---------------------------------------------------------------- bookkeeping
    computeLabels() {
      const W = this.W, H = this.H, N = W * H, own = this.owner;
      const d = new Int16Array(N).fill(-1), q = new Int32Array(N);
      let qe = 0;
      for (let i = 0; i < N; i++) {
        if (own[i] < 0) continue;
        const x = i % W, y = (i / W) | 0;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || own[i - 1] !== own[i] || own[i + 1] !== own[i] || own[i - W] !== own[i] || own[i + W] !== own[i]) { d[i] = 0; q[qe++] = i; }
      }
      for (let k = 0; k < qe; k++) { const c = q[k]; for (const j of this.nbrs(c)) if (d[j] < 0 && own[j] === own[c]) { d[j] = d[c] + 1; q[qe++] = j; } }
      const best = new Map();
      for (let i = 0; i < N; i++) { const o = own[i]; if (o < 0) continue; const b = best.get(o); if (!b || d[i] > b[1]) best.set(o, [i, d[i]]); }
      for (const L of this.langs) {
        const b = best.get(L.id);
        L.label = b ? { x: b[0] % W + 0.5, y: ((b[0] / W) | 0) + 0.5, r: b[1] } : null;
      }
    }
    record() {
      const live = this.living();
      const fam = new Set(live.map(L => this.ancestors(L)[1] ? this.ancestors(L)[1].id : L.id));
      this.history.push({ t: this.t, living: live.length, branches: fam.size, rules: this.rules.length });
    }

    // Cognate-ness between two languages: share of core meanings with the same etymon
    similarity(A, B) {
      let same = 0, n = 0;
      for (const m of CG.MEANINGS) {
        if (m.cat === 'culture') continue;
        const a = A.lex[m.i], b = B.lex[m.i];
        if (!a || !b) continue;
        n++;
        if (a.e === b.e && a.o.k !== 'loan' && b.o.k !== 'loan') same++;
      }
      return n ? same / n : 0;
    }
  }
  CG.World = World;
})(globalThis);
