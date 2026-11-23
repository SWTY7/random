/* Comet Courier — Daily Route: a seeded, solver-verified level per calendar day. */
(function (root) {
  'use strict';
  const CC = (root.CC = root.CC || {});
  const { W, H } = CC.PHYS;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedOf(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  const SENDERS = [
    { en: 'A Lonely Lighthouse', ko: '외로운 등대' }, { en: 'Comet Club Treasurer', ko: '혜성 클럽 총무' },
    { en: 'Moon Bakery', ko: '달빛 빵집' }, { en: 'Retired Satellite', ko: '은퇴한 인공위성' },
    { en: 'The Asteroid Choir', ko: '소행성 합창단' }, { en: 'Nebula Florist', ko: '성운 꽃집' },
    { en: 'A Suspicious Space Cat', ko: '수상한 우주 고양이' }, { en: 'Dr. Perihelion', ko: '근일점 박사' },
    { en: 'Pluto (still upset)', ko: '명왕성 (아직 삐짐)' }, { en: 'Your Biggest Fan', ko: '너의 열성 팬' },
  ];
  const NOTES = [
    { en: 'Fragile. Please do not slingshot. (Please slingshot.)', ko: '깨지기 쉬움. 새총 금지. (새총 부탁해.)' },
    { en: 'It is a birthday present. It is a rock. They love rocks.', ko: '생일 선물이야. 돌멩이야. 걔 돌 좋아해.' },
    { en: 'Contains one (1) sandwich. Do not eat the sandwich.', ko: '샌드위치 한 (1) 개 들어있음. 먹지 마.' },
    { en: 'Urgent! Well, cosmically urgent. Within the next eon.', ko: '긴급! 우주적으로. 다음 영겁 안에만.' },
    { en: 'Today\'s route was drawn by a computer. It promises it is possible.', ko: '오늘 경로는 컴퓨터가 그렸어. 가능하다고 맹세했대.' },
    { en: 'Return address: unknown. Destination: very known. Go.', ko: '보낸 곳: 모름. 받는 곳: 아주 잘 앎. 출발.' },
  ];

  function generate(dateStr, onDone) {
    const rnd = mulberry32(seedOf('comet-courier:' + dateStr));
    const R = (a, b) => a + rnd() * (b - a);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    let attempt = 0;

    function build() {
      const left = rnd() < 0.5;
      const start = { x: left ? R(140, 260) : R(1340, 1460), y: R(150, 750) };
      const goal = { x: left ? R(1300, 1460) : R(140, 300), y: R(130, 770), r: 42 };
      const bodies = [];
      const nb = 2 + Math.floor(rnd() * 3);
      const types = ['planet', 'planet', 'giant', 'moon', 'sun', 'repulsor', 'blackhole', 'asteroid'];
      for (let i = 0; i < nb; i++) {
        for (let tries = 0; tries < 30; tries++) {
          const type = pick(types);
          const d = CC.BODY_DEFAULTS[type];
          const b = { type, x: R(420, 1180), y: R(140, 760) };
          const clear = (p, m) => Math.hypot(p.x - b.x, p.y - b.y) > d.r + m;
          if (!clear(start, 140) || !clear(goal, 140)) continue;
          if (bodies.some((o) => Math.hypot(o.x - b.x, o.y - b.y) < (o.r || 40) + d.r + 60)) continue;
          if (rnd() < 0.25 && type !== 'blackhole') {
            b.orbit = { cx: b.x, cy: b.y, R: R(60, 140), period: (rnd() < 0.5 ? -1 : 1) * R(5, 11), phase: R(0, 6.28) };
            delete b.x; delete b.y;
          }
          bodies.push(Object.assign({ r: d.r }, b));
          break;
        }
      }
      const worms = rnd() < 0.3 ? [{ ax: R(350, 700), ay: R(150, 750), bx: R(900, 1250), by: R(150, 750), r: 34 }] : [];
      const walls = [];
      if (rnd() < 0.45) {
        const x = R(650, 950), y0 = rnd() < 0.5 ? 0 : R(380, 520), len = R(300, 450);
        walls.push({ x1: x, y1: y0, x2: x, y2: Math.min(H, y0 + len) });
      }
      return {
        id: 'daily-' + dateStr, world: 4,
        name: { en: 'Daily Route · ' + dateStr, ko: '오늘의 경로 · ' + dateStr },
        from: pick(SENDERS), note: pick(NOTES),
        start, goal, bodies, worms, walls, dust: [], preview: 1.0, par: 4,
      };
    }

    function tryOne() {
      attempt++;
      const lv = build();
      const L = CC.normalizeLevel(lv);
      const K = new CC.Kinematics(L);
      // must not be a trivial straight shot: check with a quick solver that a win exists
      const s = CC.solve(L, { K, angles: 240, powers: 10 });
      const rate = s.wins / 2400;
      if (s.win && rate < 0.03 && rate > 0.0015) {
        // drop 3 stardust onto a real winning path
        const f = CC.newFlight(L, s.best.angle, s.best.power);
        const pts = [];
        while (f.state === 'flying') { CC.step(L, K, f, null); pts.push({ x: f.x, y: f.y }); }
        if (pts.length > 200) {
          lv.dust = [0.25, 0.5, 0.75].map((k) => { const p = pts[Math.floor(pts.length * k)]; return { x: Math.round(p.x), y: Math.round(p.y) }; });
          lv.solution = { angle: s.best.angle, power: s.best.power };
          return onDone(lv);
        }
      }
      if (attempt > 200) { // extremely unlikely; fall back to a calm layout
        return onDone({ id: 'daily-' + dateStr, world: 4, name: { en: 'Daily Route', ko: '오늘의 경로' }, from: SENDERS[0], note: NOTES[0], start: { x: 200, y: 450 }, goal: { x: 1400, y: 450 }, bodies: [{ type: 'planet', x: 800, y: 450 }], dust: [], par: 4 });
      }
      setTimeout(tryOne, 0);
    }
    setTimeout(tryOne, 30);
  }

  function streak() {
    const d = CC.store.data.daily;
    let n = 0;
    const day = new Date();
    for (;;) {
      const k = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0');
      if (d[k] && d[k].won) { n++; day.setDate(day.getDate() - 1); }
      else if (n === 0 && k === today()) { day.setDate(day.getDate() - 1); } // today not yet played: count from yesterday
      else break;
      if (n > 3650) break;
    }
    return n;
  }

  CC.daily = { generate, today, streak, mulberry32 };
})(window);
