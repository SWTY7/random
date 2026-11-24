// Primordial: species, phylogeny and names.
'use strict';
(function (G) {
  const PR = G.PR;

  const ONSET = ['b', 'br', 'c', 'ch', 'cl', 'd', 'dr', 'g', 'gl', 'h', 'l', 'm', 'n', 'p', 'ph', 'pl', 'r', 's', 'sc', 'st', 't', 'th', 'tr', 'v', 'x', 'z'];
  const VOWEL = ['a', 'e', 'i', 'o', 'u', 'y', 'ae', 'io', 'eo', 'au'];
  const CODA = ['', '', '', 'n', 'r', 's', 'l', 'x', 'nth', 'st'];
  const GENUS_END = ['us', 'a', 'ia', 'odon', 'ops', 'ella', 'ix', 'ium', 'opsis', 'otherium', 'aster', 'ina', 'cystis', 'oides'];
  const EPI_END = ['ensis', 'alis', 'ifer', 'oides', 'us', 'a', 'i', 'atus', 'ica', 'ensis', 'ophila', 'ivorus', 'ans', 'escens'];
  const HERB = ['phyllo', 'chloro', 'herbi', 'algi'], CARN = ['sarco', 'carni', 'lyco', 'dino'], ARM = ['scuto', 'cerato', 'acantho'], BIG = ['mega', 'giganto', 'macro'], SMALL = ['micro', 'nano', 'pusillo'];

  function word(rng, syl) {
    let s = '';
    for (let i = 0; i < syl; i++) s += rng.pick(ONSET) + rng.pick(VOWEL) + (i === syl - 1 ? '' : rng.pick(CODA));
    return s;
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  // Genus names are invented; epithets sometimes describe the founder (diet, size, armour).
  function makeGenus(rng) { return cap(word(rng, 1 + rng.int(2)) + rng.pick(GENUS_END)); }
  function makeEpithet(rng, genes) {
    const T = PR.T;
    let prefix = '';
    if (genes && rng.chance(0.55)) {
      const opts = [];
      if (genes[T.diet] < 0.2) opts.push(...HERB);
      if (genes[T.diet] > 0.65) opts.push(...CARN);
      if (genes[T.armor] > 0.55) opts.push(...ARM);
      if (genes[T.size] > 0.75) opts.push(...BIG);
      if (genes[T.size] < 0.18) opts.push(...SMALL);
      if (opts.length) prefix = rng.pick(opts);
    }
    return prefix ? prefix + word(rng, 1) + rng.pick(EPI_END) : word(rng, 2) + rng.pick(EPI_END);
  }

  class Species {
    constructor(id, parent, born) {
      this.id = id; this.parent = parent; this.born = born; this.died = null;
      this.founder = null;          // Genome, kept only while the species lives (used to judge speciation)
      this.genes = null;            // founder's body genes, kept forever for descriptions
      this.genus = ''; this.epithet = ''; this.genusDepth = 0; this.depth = 0;
      this.count = 0; this.peak = 0; this.total = 0; this.peakAt = born;
      this.children = [];
      this.hue = 0; this.sat = 60; this.light = 55;
      this.established = false;     // reached a population worth announcing
      this.immigrant = false;
    }
    get name() { return this.id === 0 ? 'Primordial soup' : this.genus + ' ' + this.epithet; }
    get short() { return this.id === 0 ? 'soup' : this.genus.charAt(0) + '. ' + this.epithet; }
    color(alpha = 1) { return `hsla(${this.hue.toFixed(0)},${this.sat}%,${this.light}%,${alpha})`; }
  }

  class Phylo {
    constructor(seed) {
      this.seed = seed >>> 0;
      this.list = [];
      const root = new Species(0, -1, 0);
      root.hue = 0; root.sat = 0; root.light = 70;
      this.list.push(root);
      this.alive = 0;
    }
    get(id) { return this.list[id]; }
    get size() { return this.list.length; }

    create(parentId, founder, t, opts = {}) {
      const id = this.list.length;
      const sp = new Species(id, parentId, t);
      const parent = this.list[parentId];
      const rng = new PR.RNG((this.seed ^ Math.imul(id, 2654435761)) >>> 0);
      sp.founder = founder;
      sp.genes = founder.genes.slice();
      sp.depth = parent.depth + 1;
      sp.immigrant = !!opts.immigrant;
      if (parentId === 0 || parent.genusDepth >= 3 || rng.chance(0.12)) { sp.genus = makeGenus(rng); sp.genusDepth = 0; }
      else { sp.genus = parent.genus; sp.genusDepth = parent.genusDepth + 1; }
      sp.epithet = makeEpithet(rng, founder.genes);
      sp.hue = founder.genes[PR.T.hue] * 360;
      sp.sat = 48 + rng.int(30);
      sp.light = 46 + rng.int(18);
      parent.children.push(id);
      this.list.push(sp);
      return sp;
    }

    born(id, t) {
      const s = this.list[id];
      if (s.count === 0) this.alive++;
      s.count++; s.total++;
      if (s.count > s.peak) { s.peak = s.count; s.peakAt = t; }
      s.died = null;
    }
    // Returns true if this death made the species extinct.
    died(id, t) {
      const s = this.list[id];
      s.count--;
      if (s.count <= 0) { s.count = 0; s.died = t; s.founder = null; this.alive--; return true; }
      return false;
    }

    living() { return this.list.filter(s => s.count > 0); }

    // Does this species, or anything descended from it, still live?
    hasLivingDescendants(id) {
      const st = [id];
      while (st.length) { const s = this.list[st.pop()]; if (s.count > 0) return true; for (const c of s.children) st.push(c); }
      return false;
    }
    lineage(id) { const out = []; while (id > 0) { out.push(this.list[id]); id = this.list[id].parent; } return out; }

    toJSON() {
      return {
        seed: this.seed,
        list: this.list.slice(1).map(s => ({
          id: s.id, p: s.parent, b: s.born, d: s.died, gn: s.genus, ep: s.epithet, gd: s.genusDepth, dp: s.depth,
          c: s.count, pk: s.peak, pa: s.peakAt, tt: s.total, h: +s.hue.toFixed(1), sa: s.sat, l: s.light, e: s.established ? 1 : 0, im: s.immigrant ? 1 : 0,
          g: Array.from(s.genes, v => Math.round(v * 1e4) / 1e4), f: s.founder ? s.founder.toJSON() : null,
        })),
      };
    }
    static fromJSON(o) {
      const ph = new Phylo(o.seed);
      for (const r of o.list) {
        const s = new Species(r.id, r.p, r.b);
        s.died = r.d; s.genus = r.gn; s.epithet = r.ep; s.genusDepth = r.gd; s.depth = r.dp;
        s.count = 0; s.peak = r.pk; s.peakAt = r.pa; s.total = r.tt; s.hue = r.h; s.sat = r.sa; s.light = r.l;
        s.established = !!r.e; s.immigrant = !!r.im;
        s.genes = Float32Array.from(r.g);
        s.founder = r.f ? PR.Genome.fromJSON(r.f) : null;
        ph.list[s.id] = s;
        ph.list[s.parent].children.push(s.id);
      }
      return ph;
    }
  }

  PR.Phylo = Phylo;
  PR.Species = Species;
})(globalThis);
