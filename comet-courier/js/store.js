/* Comet Courier — save data + badges. */
(function (root) {
  'use strict';
  const CC = (root.CC = root.CC || {});
  const KEY = 'cometCourier.v1';

  const blank = () => ({
    progress: {},          // levelId -> { stars:[bool,bool,bool], bestAttempts, bestTime }
    settings: { sound: true, music: true, lang: null, trails: true, reduce: false },
    badges: {},            // id -> timestamp
    stats: { launches: 0, crashes: 0, swallowed: 0, lost: 0, drifted: 0, deliveries: 0, dust: 0, orbits: 0, worms: 0, sandboxBodies: 0, maxSpeed: 0, flightTime: 0 },
    daily: {},             // 'YYYY-MM-DD' -> { won, attempts, stars }
    seenHowTo: false,
  });

  let data = blank();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw), b = blank();
      data = Object.assign(b, d);
      data.settings = Object.assign(b.settings, d.settings);
      data.stats = Object.assign(b.stats, d.stats);
    }
  } catch (e) { /* private mode etc. */ }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }

  const BADGES = [
    { id: 'first',     icon: '📦', name: { en: 'First Parcel', ko: '첫 소포' }, desc: { en: 'Complete your first delivery.', ko: '첫 배달을 완료하세요.' } },
    { id: 'ace',       icon: '🎯', name: { en: 'Hole in One', ko: '홀인원' }, desc: { en: 'Deliver on the very first attempt (from world 2 on).', ko: '첫 시도에 배달 성공 (월드 2부터).' } },
    { id: 'orbit',     icon: '🪐', name: { en: 'Kepler Would Approve', ko: '케플러도 인정' }, desc: { en: 'Make a full lap around something during a flight.', ko: '비행 중에 무언가를 한 바퀴 완전히 도세요.' } },
    { id: 'speed',     icon: '⚡', name: { en: 'Gravity Assist', ko: '중력 도움닫기' }, desc: { en: 'Hit 1500 px/s. Planets are free fuel.', ko: '1500 px/s 돌파. 행성은 공짜 연료.' } },
    { id: 'graze',     icon: '🪶', name: { en: 'Close Shave', ko: '아슬아슬' }, desc: { en: 'Pass within 6 px of a surface and still deliver.', ko: '표면 6px 이내로 스치고도 배달 성공.' } },
    { id: 'spaghetti', icon: '🍝', name: { en: 'Al Dente', ko: '알 덴테' }, desc: { en: 'Get swallowed by a black hole 5 times.', ko: '블랙홀에 5번 삼켜지세요.' } },
    { id: 'splat',     icon: '💥', name: { en: 'Abstract Art', ko: '추상 미술' }, desc: { en: 'Crash 25 times. It\'s a process.', ko: '25번 충돌. 과정일 뿐이에요.' } },
    { id: 'worm3',     icon: '🌀', name: { en: 'Frequent Flyer', ko: '단골 승객' }, desc: { en: 'Use 3 wormholes in a single flight.', ko: '한 번의 비행에서 웜홀 3번 통과.' } },
    { id: 'world1',    icon: '🏡', name: { en: 'Local Hero', ko: '동네 영웅' }, desc: { en: 'Deliver every parcel in The Backyard.', ko: '뒷마당 은하의 모든 소포 배달.' } },
    { id: 'world2',    icon: '⏱️', name: { en: 'Punctual', ko: '시간 엄수' }, desc: { en: 'Deliver every parcel in Clockwork Lane.', ko: '태엽 골목의 모든 소포 배달.' } },
    { id: 'world3',    icon: '🕳️', name: { en: 'Strange Charm', ko: '이상한 매력' }, desc: { en: 'Deliver every parcel in Strange Places.', ko: '이상한 동네의 모든 소포 배달.' } },
    { id: 'world4',    icon: '🌌', name: { en: 'Courier of the Year', ko: '올해의 배달부' }, desc: { en: 'Deliver the Last Parcel.', ko: '마지막 소포 배달.' } },
    { id: 'perfect',   icon: '🌟', name: { en: 'Perfectionist', ko: '완벽주의자' }, desc: { en: 'Get all 3 ★ on 10 deliveries.', ko: '10개 배달에서 ★ 3개.' } },
    { id: 'allstars',  icon: '👑', name: { en: 'Postmaster General', ko: '우정총국장' }, desc: { en: 'Every star in the game.', ko: '게임의 모든 별.' } },
    { id: 'daily',     icon: '📅', name: { en: 'Daily Grind', ko: '꾸준함' }, desc: { en: 'Finish a Daily Route.', ko: '오늘의 경로 완료.' } },
    { id: 'streak3',   icon: '🔥', name: { en: 'On a Roll', ko: '연속 배달' }, desc: { en: 'Daily Route 3 days in a row.', ko: '오늘의 경로 3일 연속.' } },
    { id: 'creator',   icon: '🛠️', name: { en: 'Urban Planner', ko: '도시 계획가' }, desc: { en: 'Test-deliver your own route in the editor.', ko: '에디터에서 만든 경로로 배달 성공.' } },
    { id: 'god',       icon: '☀️', name: { en: 'Small God', ko: '작은 신' }, desc: { en: 'Place 50 bodies in the Orrery Sandbox.', ko: '태양계 놀이터에 천체 50개 배치.' } },
    { id: 'night',     icon: '🦉', name: { en: 'Night Owl', ko: '올빼미' }, desc: { en: 'Deliver something between 1 and 5 a.m.', ko: '새벽 1시~5시 사이에 배달.' } },
    { id: 'marathon',  icon: '🧭', name: { en: 'Scenic Route', ko: '경치 좋은 길' }, desc: { en: 'Deliver after a flight longer than 12 seconds.', ko: '12초 넘게 비행한 뒤 배달.' } },
  ];

  const listeners = [];
  function award(id) {
    if (data.badges[id]) return false;
    data.badges[id] = Date.now();
    save();
    const b = BADGES.find((x) => x.id === id);
    listeners.forEach((fn) => fn(b));
    return true;
  }

  function starCount() {
    let n = 0;
    for (const k in data.progress) n += data.progress[k].stars.filter(Boolean).length;
    return n;
  }

  function recordLevel(id, stars, attempts, time) {
    const p = data.progress[id] || { stars: [false, false, false], bestAttempts: Infinity, bestTime: Infinity };
    p.stars = p.stars.map((s, i) => s || !!stars[i]);
    p.bestAttempts = Math.min(p.bestAttempts || Infinity, attempts);
    p.bestTime = Math.min(p.bestTime || Infinity, time);
    data.progress[id] = p;
    save();
    return p;
  }

  CC.store = {
    get data() { return data; }, save, BADGES, award, starCount, recordLevel,
    onBadge(fn) { listeners.push(fn); },
    reset() { const s = data.settings; data = blank(); data.settings = s; save(); },
  };
})(window);
