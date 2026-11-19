/* Comet Courier — hand-built deliveries.
 * Coordinates are in the 1600×900 world. Masses are in CC.PHYS.MU units.
 * Every level is checked by tools/check.js: it must be winnable, and winnable while
 * picking up every stardust in one flight. */
(function (root) {
  'use strict';
  const CC = (root.CC = root.CC || {});
  const PI = Math.PI;

  function ring(cx, cy, R, n, period, type, extra) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(Object.assign({ type: type || 'asteroid', orbit: { cx, cy, R, period, phase: (2 * PI * i) / n } }, extra || {}));
    }
    return out;
  }

  CC.WORLDS = [
    /* ===================================================== WORLD 1 */
    {
      id: 'w1',
      name: { en: 'The Backyard', ko: '뒷마당 은하' },
      blurb: { en: 'Planets pull. That is the whole trick.', ko: '행성은 끌어당긴다. 그게 전부다.' },
      palette: { a: '#4fd1c5', b: '#f6ad55', bg1: '#0b1a2b', bg2: '#132a3f' },
      levels: [
        {
          id: '1-1', name: { en: 'First Delivery', ko: '첫 배달' },
          from: { en: 'Postmaster Orbit', ko: '우체국장 오르빗' },
          note: { en: 'Welcome aboard, rookie. Drag back, let go, hit the ring. Easy money.', ko: '환영해, 신입. 뒤로 당기고, 놓고, 고리에 넣어. 쉬운 일이지.' },
          start: { x: 220, y: 640 }, goal: { x: 1380, y: 300 },
          dust: [{ x: 600, y: 529 }, { x: 900, y: 441 }, { x: 1150, y: 367 }],
          preview: 6, par: 1,
        },
        {
          id: '1-2', name: { en: 'Around the Bend', ko: '모퉁이 돌기' },
          from: { en: 'Mrs. Pebble', ko: '페블 할머니' },
          note: { en: 'There is a planet between us. Please do not deliver my parcel INTO it.', ko: '우리 사이에 행성이 하나 있어요. 소포를 행성에 꽂지는 말아줘요.' },
          start: { x: 200, y: 450 }, goal: { x: 1400, y: 450 },
          bodies: [{ type: 'planet', x: 800, y: 450, r: 60, m: 7 }],
          dust: [{ x: 488, y: 542 }, { x: 782, y: 601 }, { x: 1079, y: 557 }], preview: 3, par: 2,
        },
        {
          id: '1-3', name: { en: 'Two Hills', ko: '언덕 두 개' },
          from: { en: 'The Hilltop Twins', ko: '언덕 위 쌍둥이' },
          note: { en: 'We live on the high road. Bring snacks.', ko: '우린 높은 길에 살아. 간식도 가져와.' },
          start: { x: 200, y: 720 }, goal: { x: 1400, y: 180 },
          bodies: [{ type: 'planet', x: 640, y: 470, r: 50, m: 6 }, { type: 'planet', x: 1060, y: 360, r: 55, m: 7 }],
          dust: [{ x: 564, y: 927 }, { x: 982, y: 888 }, { x: 1308, y: 626 }], preview: 2.5, par: 2,
        },
        {
          id: '1-4', name: { en: 'Behind the Fence', ko: '울타리 너머' },
          from: { en: 'Grumpy Neighbor', ko: '까칠한 이웃' },
          note: { en: 'I built a fence so nobody bothers me. Deliver my newspaper anyway.', ko: '아무도 귀찮게 못 하게 울타리를 쳤어. 그래도 신문은 배달해.' },
          start: { x: 200, y: 450 }, goal: { x: 1420, y: 560, r: 50 },
          bodies: [{ type: 'planet', x: 1200, y: 560, r: 48, m: 12 }],
          walls: [{ x1: 1050, y1: 460, x2: 1050, y2: 900 }],
          dust: [{ x: 508, y: 381 }, { x: 819, y: 336 }, { x: 1133, y: 352 }], preview: 2, par: 3,
        },
        {
          id: '1-5', name: { en: 'Boomerang', ko: '부메랑' },
          from: { en: 'Your Own Mailbox', ko: '너의 우편함' },
          note: { en: 'Return to sender. Yes, the sender is right above you. No, you cannot go straight up.', ko: '반송입니다. 보낸 사람이 바로 위에 있지만, 위로 곧장 갈 수는 없어요.' },
          start: { x: 300, y: 620 }, goal: { x: 260, y: 200 },
          bodies: [{ type: 'planet', x: 1000, y: 420, r: 60, m: 14 }],
          walls: [{ x1: 40, y1: 400, x2: 640, y2: 400 }],
          dust: [{ x: 871, y: 792 }, { x: 1223, y: 347 }, { x: 793, y: -51 }], preview: 2, par: 3,
        },
        {
          id: '1-6', name: { en: 'Asteroid Alley', ko: '소행성 골목' },
          from: { en: 'Rocky & Sons', ko: '록키와 아들들' },
          note: { en: 'Shortcut through the rock yard. Mind the merchandise.', ko: '돌무더기 사이 지름길이야. 상품에 흠집 내지 마.' },
          start: { x: 180, y: 450 }, goal: { x: 1420, y: 450 },
          bodies: [
            { type: 'asteroid', x: 600, y: 250 }, { type: 'asteroid', x: 600, y: 450, r: 26 }, { type: 'asteroid', x: 600, y: 650 },
            { type: 'asteroid', x: 800, y: 150 }, { type: 'asteroid', x: 800, y: 350 }, { type: 'asteroid', x: 800, y: 550 }, { type: 'asteroid', x: 800, y: 750 },
            { type: 'asteroid', x: 1000, y: 250 }, { type: 'asteroid', x: 1000, y: 450, r: 26 }, { type: 'asteroid', x: 1000, y: 650 },
            { type: 'moon', x: 1220, y: 170, m: 3 },
          ],
          dust: [{ x: 482, y: 482 }, { x: 783, y: 507 }, { x: 1085, y: 511 }], preview: 1.6, par: 3,
        },
        {
          id: '1-7', name: { en: 'Figure Eight', ko: '8자 비행' },
          from: { en: 'Skating Club', ko: '스케이트 동호회' },
          note: { en: 'The middle lane is closed for repairs. Show off a little.', ko: '가운데 길은 공사 중이야. 실력 좀 뽐내 봐.' },
          start: { x: 800, y: 810 }, goal: { x: 800, y: 110 },
          bodies: [
            { type: 'planet', x: 520, y: 450, r: 50, m: 7 }, { type: 'planet', x: 1080, y: 450, r: 50, m: 7 },
            { type: 'asteroid', x: 800, y: 300, r: 34 }, { type: 'asteroid', x: 800, y: 470, r: 40 }, { type: 'asteroid', x: 800, y: 640, r: 34 },
          ],
          dust: [{ x: 611, y: 326 }, { x: 194, y: 462 }, { x: 589, y: 622 }], preview: 1.4, par: 3,
        },
        {
          id: '1-8', name: { en: 'The Big One', ko: '거대한 녀석' },
          from: { en: 'A Very Small Moon', ko: '아주 작은 달' },
          note: { en: 'I live right behind the gas giant. Everyone forgets about me.', ko: '나는 가스 행성 바로 뒤에 살아. 다들 나를 잊어버리지.' },
          start: { x: 180, y: 450 }, goal: { x: 1080, y: 450, r: 30 },
          bodies: [{ type: 'giant', x: 790, y: 450, r: 110, m: 20 }],
          walls: [{ x1: 1160, y1: 330, x2: 1160, y2: 570 }],
          dust: [{ x: 400, y: 538 }, { x: 626, y: 600 }, { x: 857, y: 588 }], preview: 1.2, par: 3,
        },
      ],
    },

    /* ===================================================== WORLD 2 */
    {
      id: 'w2',
      name: { en: 'Clockwork Lane', ko: '태엽 골목' },
      blurb: { en: 'Things move now. The clock starts when you launch.', ko: '이제 모든 게 움직인다. 발사하는 순간 시계가 돈다.' },
      palette: { a: '#b794f4', b: '#f6e05e', bg1: '#140f2b', bg2: '#21183f' },
      levels: [
        {
          id: '2-1', name: { en: 'Moon Errand', ko: '달 심부름' },
          from: { en: 'Planet Bob', ko: '행성 밥' },
          note: { en: 'My moon keeps stealing my mail. Dodge him. He is slow but smug.', ko: '내 달이 자꾸 편지를 훔쳐가. 피해 가. 느리지만 얄미운 녀석이야.' },
          start: { x: 200, y: 450 }, goal: { x: 1400, y: 450 },
          bodies: [
            { type: 'planet', x: 800, y: 450, r: 55, m: 8 },
            { type: 'moon', orbit: { around: 0, R: 160, period: 5, phase: PI } },
          ],
          dust: [{ x: 486, y: 331 }, { x: 784, y: 259 }, { x: 1087, y: 307 }], preview: 1.6, par: 3,
        },
        {
          id: '2-2', name: { en: 'Bouncy Star', ko: '통통 별' },
          from: { en: 'Upstairs Apartment', ko: '윗집' },
          note: { en: 'That white star pushes everything away. Rude, but useful.', ko: '저 하얀 별은 뭐든 밀어내. 무례하지만 쓸모 있지.' },
          start: { x: 200, y: 720 }, goal: { x: 1400, y: 720, r: 55 },
          bodies: [{ type: 'repulsor', x: 800, y: 250, r: 28, m: -14 }],
          walls: [{ x1: 800, y1: 620, x2: 800, y2: 900, w: 12 }],
          dust: [{ x: 484, y: 638 }, { x: 775, y: 585 }, { x: 1068, y: 619 }], preview: 1.6, par: 3,
        },
        {
          id: '2-3', name: { en: 'Moving Mailbox', ko: '움직이는 우편함' },
          from: { en: 'Satellite Sue', ko: '인공위성 수' },
          note: { en: 'I am always on the move. Aim where I will be, not where I am.', ko: '난 항상 돌아다녀. 지금 위치 말고 내가 갈 곳을 노려.' },
          start: { x: 200, y: 450 },
          goal: { r: 34, orbit: { cx: 950, cy: 450, R: 200, period: 7, phase: PI } },
          bodies: [{ type: 'planet', x: 950, y: 450, r: 50, m: 7 }],
          dust: [{ x: 445, y: 383 }, { x: 694, y: 335 }, { x: 944, y: 349 }], preview: 1.4, par: 3,
        },
        {
          id: '2-4', name: { en: 'Binary', ko: '쌍성' },
          from: { en: 'The Dancing Suns', ko: '춤추는 태양들' },
          note: { en: 'We have been waltzing for four billion years. Do not cut in.', ko: '우린 40억 년째 왈츠 중이야. 끼어들지 마.' },
          start: { x: 200, y: 760 }, goal: { x: 1400, y: 150 },
          bodies: [
            { type: 'sun', r: 44, m: 9, orbit: { cx: 800, cy: 450, R: 120, period: 5, phase: 0 } },
            { type: 'sun', r: 44, m: 9, orbit: { cx: 800, cy: 450, R: 120, period: 5, phase: PI } },
          ],
          dust: [{ x: 532, y: 689 }, { x: 808, y: 498 }, { x: 1102, y: 334 }], preview: 1.4, par: 3,
        },
        {
          id: '2-5', name: { en: 'Pinball', ko: '핀볼' },
          from: { en: 'Arcade Owner', ko: '오락실 사장님' },
          note: { en: 'High score gets a free parcel. Low score also gets a parcel. It is mail.', ko: '최고 점수엔 공짜 소포. 낮은 점수에도 소포. 우편이니까.' },
          start: { x: 150, y: 450 }, goal: { x: 1460, y: 450, r: 52 },
          bodies: [
            { type: 'repulsor', x: 520, y: 300, m: -6 }, { type: 'repulsor', x: 820, y: 620, m: -6 },
            { type: 'repulsor', x: 1120, y: 300, m: -6 },
          ],
          walls: [{ x1: 300, y1: 120, x2: 1350, y2: 120 }, { x1: 300, y1: 780, x2: 1350, y2: 780 }],
          dust: [{ x: 469, y: 451 }, { x: 781, y: 518 }, { x: 1091, y: 463 }], preview: 1.2, par: 3,
        },
        {
          id: '2-6', name: { en: 'Carousel', ko: '회전목마' },
          from: { en: 'Ticket Booth', ko: '매표소' },
          note: { en: 'The office is inside the ride. The ride does not stop.', ko: '사무실이 놀이기구 안에 있어. 놀이기구는 안 멈춰.' },
          start: { x: 200, y: 450 }, goal: { x: 860, y: 450, r: 32 },
          bodies: ring(860, 450, 160, 8, 9, 'asteroid', { r: 26 }),
          dust: [{ x: 358, y: 447 }, { x: 516, y: 444 }, { x: 673, y: 442 }], preview: 1.2, par: 3,
        },
        {
          id: '2-7', name: { en: 'Gear Train', ko: '톱니바퀴' },
          from: { en: 'Clockmaker Tock', ko: '시계공 톡' },
          note: { en: 'Two moons, opposite directions. I synchronised them. Personally.', ko: '반대로 도는 달 두 개. 내가 직접 맞췄지.' },
          start: { x: 150, y: 150 }, goal: { x: 1450, y: 750 },
          bodies: [
            { type: 'planet', x: 520, y: 450, r: 48, m: 7 },
            { type: 'moon', r: 24, m: 2, orbit: { around: 0, R: 150, period: 4, phase: 0 } },
            { type: 'planet', x: 1080, y: 450, r: 48, m: 7 },
            { type: 'moon', r: 24, m: 2, orbit: { around: 2, R: 150, period: -4, phase: PI } },
          ],
          dust: [{ x: 375, y: 554 }, { x: 813, y: 422 }, { x: 1260, y: 308 }], preview: 1.1, par: 3,
        },
        {
          id: '2-8', name: { en: 'Grand Orrery', ko: '거대한 태양계 모형' },
          from: { en: 'Museum Curator', ko: '박물관 큐레이터' },
          note: { en: 'Please do not touch the exhibit. Fly through it carefully.', ko: '전시물에 손대지 마세요. 조심히 통과해 주세요.' },
          start: { x: 150, y: 800 }, goal: { x: 1450, y: 110 },
          bodies: [
            { type: 'sun', x: 800, y: 450, r: 58, m: 12 },
            { type: 'planet', r: 30, m: 4, orbit: { cx: 800, cy: 450, R: 210, period: 9, phase: 2.2 } },
            { type: 'moon', r: 14, m: 1, orbit: { around: 1, R: 60, period: 2.5, phase: 0 } },
            { type: 'planet', r: 36, m: 5, orbit: { cx: 800, cy: 450, R: 340, period: -15, phase: 0.6 } },
          ],
          dust: [{ x: 570, y: 1005 }, { x: 1035, y: 937 }, { x: 1368, y: 611 }], preview: 1.0, par: 3,
        },
      ],
    },

    /* ===================================================== WORLD 3 */
    {
      id: 'w3',
      name: { en: 'Strange Places', ko: '이상한 동네' },
      blurb: { en: 'Holes that eat you. Holes that move you. Know the difference.', ko: '삼키는 구멍, 옮겨주는 구멍. 차이를 알아둬.' },
      palette: { a: '#f687b3', b: '#63b3ed', bg1: '#1a0b1f', bg2: '#2a1033' },
      levels: [
        {
          id: '3-1', name: { en: 'Shortcut', ko: '지름길' },
          from: { en: 'Wormhole Tourism Board', ko: '웜홀 관광청' },
          note: { en: 'Enter the blue swirl, exit the other one. Same speed, same direction. Magic!', ko: '파란 소용돌이로 들어가면 다른 쪽으로 나와. 속도도 방향도 그대로. 마법이지!' },
          start: { x: 200, y: 450 }, goal: { x: 1400, y: 430, r: 48 },
          walls: [{ x1: 800, y1: 0, x2: 800, y2: 900, w: 14 }],
          worms: [{ ax: 540, ay: 470, bx: 1060, by: 470, r: 40 }],
          bodies: [{ type: 'moon', x: 1250, y: 760, r: 26, m: 1 }],
          dust: [{ x: 494, y: 443 }, { x: 1104, y: 469 }, { x: 1104, y: 469 }], preview: 1.6, par: 3,
        },
        {
          id: '3-2', name: { en: 'Don\'t Look Down', ko: '아래를 보지 마' },
          from: { en: 'Brave Pigeon', ko: '용감한 비둘기' },
          note: { en: 'There is a black hole on the way. It is very hungry and very bad at sharing.', ko: '가는 길에 블랙홀이 있어. 아주 배고프고 나눠 먹을 줄 몰라.' },
          start: { x: 200, y: 450 }, goal: { x: 1400, y: 450 },
          bodies: [{ type: 'blackhole', x: 800, y: 450 }],
          dust: [{ x: 403, y: 798 }, { x: 777, y: 944 }, { x: 1160, y: 820 }], preview: 1.4, par: 3,
        },
        {
          id: '3-3', name: { en: 'Locked Room', ko: '밀실' },
          from: { en: 'Detective Nebula', ko: '탐정 네뷸라' },
          note: { en: 'A sealed box. No doors. And yet the parcel must arrive. Fascinating.', ko: '문 없는 밀폐된 상자. 그런데 소포는 도착해야 해. 흥미롭군.' },
          start: { x: 200, y: 700 }, goal: { x: 1150, y: 450 },
          walls: [
            { x1: 950, y1: 250, x2: 1350, y2: 250 }, { x1: 1350, y1: 250, x2: 1350, y2: 650 },
            { x1: 1350, y1: 650, x2: 950, y2: 650 }, { x1: 950, y1: 650, x2: 950, y2: 250 },
          ],
          worms: [{ ax: 620, ay: 160, bx: 1250, by: 560, r: 30 }],
          bodies: [{ type: 'planet', x: 520, y: 450, r: 50, m: 7 }],
          dust: [{ x: 597, y: 620 }, { x: 672, y: 238 }, { x: 1233, y: 531 }], preview: 1.4, par: 3,
        },
        {
          id: '3-4', name: { en: 'Horizon Hug', ko: '사건의 지평선 포옹' },
          from: { en: 'Daredevil Dot', ko: '무모한 점' },
          note: { en: 'Get close. Closer. Not THAT close.', ko: '가까이. 더 가까이. 아니 그렇게까진 말고.' },
          start: { x: 300, y: 700 }, goal: { x: 380, y: 200 },
          bodies: [{ type: 'blackhole', x: 900, y: 450, m: 30 }],
          walls: [{ x1: 40, y1: 450, x2: 680, y2: 450 }],
          dust: [{ x: 645, y: 667 }, { x: 937, y: 496 }, { x: 727, y: 276 }], preview: 1.2, par: 3,
        },
        {
          id: '3-5', name: { en: 'Relay', ko: '릴레이' },
          from: { en: 'Tunnel Workers Union', ko: '터널 노동조합' },
          note: { en: 'Two tunnels, three rooms. We dug them by hand. Use both, please.', ko: '터널 둘, 방 셋. 손으로 팠다고. 둘 다 써 줘.' },
          start: { x: 150, y: 450 }, goal: { x: 1420, y: 480, r: 52 },
          walls: [{ x1: 540, y1: 0, x2: 540, y2: 900, w: 12 }, { x1: 1060, y1: 0, x2: 1060, y2: 900, w: 12 }],
          worms: [{ ax: 380, ay: 200, bx: 680, by: 700, r: 40 }, { ax: 960, ay: 396, bx: 1200, by: 720, r: 40 }],
          bodies: [{ type: 'moon', x: 800, y: 330, r: 24, m: 2 }],
          dust: [{ x: 713, y: 671 }, { x: 748, y: 639 }, { x: 1227, y: 685 }], preview: 1.2, par: 3,
        },
        {
          id: '3-6', name: { en: 'Hole in One', ko: '홀인원' },
          from: { en: 'Galactic Golf Club', ko: '은하 골프 클럽' },
          note: { en: 'Two hazards on this hole. Both are bottomless.', ko: '이번 홀엔 해저드가 두 개. 둘 다 바닥이 없어.' },
          start: { x: 200, y: 760 }, goal: { x: 1400, y: 150 },
          bodies: [{ type: 'blackhole', x: 640, y: 330, m: 26 }, { type: 'blackhole', x: 980, y: 590, m: 26 }],
          dust: [{ x: 284, y: 220 }, { x: 809, y: 484 }, { x: 1362, y: 726 }], preview: 1.1, par: 3,
        },
        {
          id: '3-7', name: { en: 'Looking Glass', ko: '거울 나라' },
          from: { en: 'The Other You', ko: '또 다른 너' },
          note: { en: 'I am on the other side of the mirror. The mirror is a black hole. Sorry.', ko: '난 거울 반대편에 있어. 그 거울은 블랙홀이야. 미안.' },
          start: { x: 200, y: 450 }, goal: { x: 1400, y: 450 },
          bodies: [{ type: 'blackhole', x: 1150, y: 450, m: 30 }],
          walls: [{ x1: 800, y1: 0, x2: 800, y2: 900, w: 14 }],
          worms: [{ ax: 560, ay: 220, bx: 1000, by: 760, r: 30 }],
          dust: [{ x: 325, y: 901 }, { x: 776, y: 1062 }, { x: 1229, y: 895 }], preview: 1.0, par: 3,
        },
        {
          id: '3-8', name: { en: 'Spaghetti Junction', ko: '스파게티 교차로' },
          from: { en: 'Chef Singularity', ko: '셰프 특이점' },
          note: { en: 'My kitchen is a little chaotic. Dinner is at the far end. Do not be the noodle.', ko: '주방이 좀 정신없어. 저녁은 저 끝에 있어. 국수가 되진 마.' },
          start: { x: 150, y: 150 }, goal: { x: 1450, y: 760 },
          bodies: [
            { type: 'blackhole', x: 800, y: 450, m: 28 },
            { type: 'asteroid', r: 22, orbit: { cx: 800, cy: 450, R: 150, period: 6, phase: 0 } },
            { type: 'asteroid', r: 22, orbit: { cx: 800, cy: 450, R: 150, period: 6, phase: PI } },
            { type: 'repulsor', x: 1200, y: 250, m: -6 },
          ],
          walls: [{ x1: 360, y1: 560, x2: 640, y2: 820 }],
          worms: [{ ax: 400, ay: 420, bx: 1250, by: 560, r: 28 }],
          dust: [{ x: 1275, y: 579 }, { x: 1275, y: 579 }, { x: 1275, y: 579 }], preview: 1.0, par: 3,
        },
      ],
    },

    /* ===================================================== WORLD 4 */
    {
      id: 'w4',
      name: { en: 'Deep Field', ko: '깊은 우주' },
      blurb: { en: 'Everything at once, and the preview is getting shy.', ko: '모든 게 한꺼번에. 미리보기는 점점 수줍어진다.' },
      palette: { a: '#68d391', b: '#fc8181', bg1: '#06070f', bg2: '#0e1424' },
      levels: [
        {
          id: '4-1', name: { en: 'Night Shift', ko: '야간 근무' },
          from: { en: 'Lighthouse Keeper', ko: '등대지기' },
          note: { en: 'It is dark out here. Trust your gut. And gravity.', ko: '여긴 어두워. 직감을 믿어. 그리고 중력도.' },
          start: { x: 200, y: 200 }, goal: { x: 1400, y: 700 },
          bodies: [
            { type: 'planet', x: 600, y: 520, r: 50, m: 8 }, { type: 'planet', x: 1000, y: 330, r: 50, m: 8 },
            { type: 'repulsor', x: 1250, y: 520, m: -5 },
          ],
          dust: [{ x: 421, y: 457 }, { x: 708, y: 616 }, { x: 1045, y: 626 }], preview: 0.7, par: 3,
        },
        {
          id: '4-2', name: { en: 'Express Lane', ko: '급행 차선' },
          from: { en: 'Impatient Quasar', ko: '성급한 퀘이사' },
          note: { en: 'I needed this yesterday. Take the tunnel. Twice if you have to.', ko: '어제 필요했던 거야. 터널 타. 필요하면 두 번.' },
          start: { x: 150, y: 750 }, goal: { x: 1450, y: 150 },
          walls: [{ x1: 0, y1: 450, x2: 1300, y2: 450, w: 12 }],
          worms: [{ ax: 600, ay: 600, bx: 300, by: 300, r: 30 }],
          bodies: [{ type: 'sun', x: 950, y: 750, r: 50, m: 10 }, { type: 'planet', x: 900, y: 200, r: 40, m: 5 }],
          dust: [{ x: 332, y: 289 }, { x: 460, y: 246 }, { x: 930, y: 120 }], preview: 0.7, par: 3,
        },
        {
          id: '4-3', name: { en: 'Tidal Lock', ko: '조석 고정' },
          from: { en: 'Sleepy Moon', ko: '졸린 달' },
          note: { en: 'I only ever show one face. The mailbox is on the other side.', ko: '난 항상 한쪽 얼굴만 보여줘. 우편함은 반대쪽에 있어.' },
          start: { x: 180, y: 450 },
          goal: { r: 30, orbit: { cx: 900, cy: 450, R: 230, period: 8, phase: 0 } },
          bodies: [
            { type: 'giant', x: 900, y: 450, r: 90, m: 16 },
            { type: 'moon', r: 26, m: 2, orbit: { cx: 900, cy: 450, R: 230, period: 8, phase: PI } },
          ],
          dust: [{ x: 39, y: 829 }, { x: 486, y: 871 }, { x: 894, y: 658 }], preview: 0.7, par: 3,
        },
        {
          id: '4-4', name: { en: 'Minefield', ko: '지뢰밭' },
          from: { en: 'Bomb Squad Betty', ko: '폭탄 처리반 베티' },
          note: { en: 'Small black holes everywhere. Small is relative.', ko: '작은 블랙홀이 사방에. 작다는 건 상대적이야.' },
          start: { x: 150, y: 450 }, goal: { x: 1450, y: 450 },
          bodies: [
            { type: 'blackhole', x: 500, y: 260, m: 10, r: 12 }, { type: 'blackhole', x: 520, y: 640, m: 10, r: 12 },
            { type: 'blackhole', x: 800, y: 450, m: 12, r: 12 }, { type: 'blackhole', x: 1080, y: 260, m: 10, r: 12 },
            { type: 'blackhole', x: 1100, y: 640, m: 10, r: 12 },
          ],
          dust: [{ x: 566, y: -220 }, { x: 1266, y: 181 }, { x: 819, y: 501 }], preview: 0.6, par: 3,
        },
        {
          id: '4-5', name: { en: 'The Long Way', ko: '먼 길' },
          from: { en: 'Grandma Comet', ko: '혜성 할머니' },
          note: { en: 'Visit everyone on the way, dear. They miss you.', ko: '가는 길에 다들 들러, 얘야. 다들 보고 싶어 해.' },
          start: { x: 150, y: 800 }, goal: { x: 160, y: 120 },
          bodies: [
            { type: 'planet', x: 500, y: 600, r: 42, m: 6 }, { type: 'sun', x: 1100, y: 620, r: 54, m: 11 },
            { type: 'planet', x: 1250, y: 230, r: 42, m: 6 }, { type: 'moon', x: 700, y: 260, r: 26, m: 3 },
          ],
          walls: [{ x1: 20, y1: 460, x2: 520, y2: 460 }],
          dust: [{ x: -69, y: 684 }, { x: -189, y: 474 }, { x: -89, y: 255 }], preview: 0.6, par: 3,
        },
        {
          id: '4-6', name: { en: 'Clock Tower', ko: '시계탑' },
          from: { en: 'Clockmaker Tock (again)', ko: '시계공 톡 (또)' },
          note: { en: 'I built a bigger one. The hands are asteroids. Please be punctual.', ko: '더 큰 걸 만들었어. 시곗바늘이 소행성이야. 시간 엄수 부탁해.' },
          start: { x: 180, y: 780 }, goal: { x: 1400, y: 140 },
          bodies: [
            { type: 'sun', x: 800, y: 450, r: 40, m: 8 },
            { type: 'asteroid', r: 20, orbit: { cx: 800, cy: 450, R: 110, period: 3, phase: 0 } },
            { type: 'asteroid', r: 20, orbit: { cx: 800, cy: 450, R: 180, period: 3, phase: 0 } },
            { type: 'asteroid', r: 20, orbit: { cx: 800, cy: 450, R: 250, period: 3, phase: 0 } },
            { type: 'asteroid', r: 20, orbit: { cx: 800, cy: 450, R: 160, period: -12, phase: PI } },
            { type: 'asteroid', r: 20, orbit: { cx: 800, cy: 450, R: 250, period: -12, phase: PI } },
          ],
          dust: [{ x: 523, y: 718 }, { x: 856, y: 620 }, { x: 1135, y: 418 }], preview: 0.6, par: 3,
        },
        {
          id: '4-7', name: { en: 'Wormhole Roulette', ko: '웜홀 룰렛' },
          from: { en: 'Lucky Seven', ko: '럭키 세븐' },
          note: { en: 'Three tunnels, one right answer. Two hilarious wrong ones.', ko: '터널 셋, 정답 하나. 웃긴 오답 둘.' },
          start: { x: 150, y: 450 }, goal: { x: 1450, y: 450, r: 50 },
          walls: [{ x1: 700, y1: 0, x2: 700, y2: 900, w: 14 }, { x1: 1250, y1: 250, x2: 1250, y2: 650, w: 12 }],
          worms: [
            { ax: 450, ay: 180, bx: 1450, by: 760, r: 36 },
            { ax: 450, ay: 450, bx: 900, by: 200, r: 36 },
            { ax: 450, ay: 720, bx: 1450, by: 140, r: 36 },
          ],
          bodies: [{ type: 'blackhole', x: 1080, y: 450, m: 22 }, { type: 'repulsor', x: 1450, y: 900, m: -4 }],
          dust: [{ x: 415, y: 105 }, { x: 823, y: -49 }, { x: 1243, y: 55 }], preview: 0.6, par: 3,
        },
        {
          id: '4-8', name: { en: 'Last Parcel', ko: '마지막 소포' },
          from: { en: 'Postmaster Orbit', ko: '우체국장 오르빗' },
          note: { en: 'This one is for you. Come home, courier. Mind the furniture.', ko: '이건 너한테 온 거야. 집으로 와, 배달부. 가구 조심하고.' },
          start: { x: 150, y: 150 }, goal: { x: 800, y: 450, r: 30 },
          bodies: [
            { type: 'sun', r: 36, m: 7, orbit: { cx: 800, cy: 450, R: 150, period: 6, phase: 0 } },
            { type: 'sun', r: 36, m: 7, orbit: { cx: 800, cy: 450, R: 150, period: 6, phase: PI } },
            { type: 'blackhole', x: 1300, y: 220, m: 20 },
            { type: 'repulsor', x: 330, y: 650, m: -6 },
            { type: 'asteroid', r: 18, orbit: { cx: 800, cy: 450, R: 300, period: -10, phase: 1 } },
            { type: 'asteroid', r: 18, orbit: { cx: 800, cy: 450, R: 300, period: -10, phase: 3 } },
            { type: 'asteroid', r: 18, orbit: { cx: 800, cy: 450, R: 300, period: -10, phase: 5 } },
          ],
          dust: [{ x: 555, y: 369 }, { x: 969, y: 553 }, { x: 1245, y: 186 }, { x: 1272, y: 519 }], preview: 0.5, par: 3,
        },
      ],
    },
  ];

  // flat lookup
  CC.LEVELS = [];
  CC.WORLDS.forEach((w, wi) => w.levels.forEach((l, li) => {
    l.world = wi; l.index = li;
    CC.LEVELS.push(l);
  }));
  CC.levelById = (id) => CC.LEVELS.find((l) => l.id === id);
  if (typeof module !== 'undefined' && module.exports) module.exports = CC;
})(typeof window !== 'undefined' ? window : globalThis);
