/* Comet Courier — tiny i18n (English / 한국어). */
(function (root) {
  'use strict';
  const CC = (root.CC = root.CC || {});

  const S = {
    en: {
      title: 'COMET COURIER',
      tagline: 'Interplanetary parcel delivery. Gravity included, free of charge.',
      play: 'Deliver', daily: 'Daily Route', sandbox: 'Orrery Sandbox', editor: 'Build a Route',
      achievements: 'Badges', settings: 'Settings', back: 'Back', menu: 'Menu',
      retry: 'Retry', next: 'Next delivery', replay: 'Watch replay', share: 'Copy link',
      attempts: 'Attempts', dust: 'Stardust', par: 'Par', time: 'Time',
      world: 'World', locked: 'Deliver {n} more ★ to unlock',
      aimHint: 'Drag anywhere to aim · release to launch',
      aimHintKeys: '← → aim · ↑ ↓ power · Space launch · R retry',
      clockHint: 'Orbits freeze while you aim — the clock starts at launch',
      delivered: 'Delivered!', deliveredSub: ['Right on time.', 'Signed, sealed, delivered.', 'Five stars on the app. Well, three.', 'The recipient is crying happy tears.', 'Not a single dent.'],
      fail: {
        crashed: ['Splat.', 'That planet now has your parcel. Forever.', 'Return to sender (in pieces).'],
        swallowed: ['Spaghettified.', 'The black hole says thank you.', 'Delivered… to the wrong singularity.'],
        lost: ['Lost in space.', 'Bon voyage, parcel.', 'That parcel is now somebody else\'s problem.'],
        drifted: ['Still orbiting. Still not delivered.', 'Ran out of patience (18 s).', 'The parcel is enjoying the view.'],
      },
      star1: 'Delivered', star2: 'All stardust in one flight', star3: 'Within {n} attempt(s)',
      sound: 'Sound', music: 'Music', lang: 'Language', trails: 'Ghost trails', reduce: 'Reduced motion', reset: 'Reset progress',
      resetConfirm: 'Erase all progress? This cannot be undone.',
      on: 'On', off: 'Off',
      ff: 'Hold F or ⏩ to fast-forward',
      dailyTitle: 'Daily Route', dailySub: 'A new delivery every day. Same route for everyone.',
      dailyGenerating: 'Charting today\'s route…', streak: 'Streak', best: 'Best',
      sandboxHelp: 'Pick a tool, then click (or drag to throw). Everything pulls on everything.',
      editorHelp: 'Place things, set the start and the goal, then test it. Share the link with a friend.',
      test: 'Test', clear: 'Clear', copied: 'Link copied!', undo: 'Undo',
      tools: { select: 'Move', start: 'Start', goal: 'Goal', planet: 'Planet', giant: 'Giant', moon: 'Moon', sun: 'Sun', repulsor: 'Bumper star', blackhole: 'Black hole', asteroid: 'Asteroid', dust: 'Stardust', wall: 'Wall', worm: 'Wormhole', erase: 'Erase', comet: 'Comet', spray: 'Comet spray' },
      stars: 'stars', of: 'of', from: 'From', unlockedBadge: 'Badge unlocked',
      credits: 'Made in two hours by Claude, for you.',
      howTo: 'How to play',
      how: [
        'Drag anywhere on screen and let go — the comet flies the opposite way, like a slingshot.',
        'Planets and suns pull you in. White bumper stars push you away. Black holes eat you.',
        'Blue swirls are wormholes: in one, out the other, same speed, same direction.',
        'Fly into the glowing ring to deliver. Grab all stardust in the same flight for a ★.',
        'Your last flights leave ghost trails. Use them. Learn from them. Laugh at them.',
      ],
      editorSolvable: 'Checking if it can be delivered…', editorOk: 'Deliverable ✓', editorNo: 'No winning shot found (yet)',
      customRoute: 'Custom route', play2: 'Play',
      total: 'Total', resume: 'Resume', paused: 'Paused',
      speed: 'Speed',
    },
    ko: {
      title: '혜성 택배',
      tagline: '행성 간 소포 배달. 중력은 무료로 드립니다.',
      play: '배달 시작', daily: '오늘의 경로', sandbox: '태양계 놀이터', editor: '경로 만들기',
      achievements: '배지', settings: '설정', back: '뒤로', menu: '메뉴',
      retry: '다시', next: '다음 배달', replay: '리플레이', share: '링크 복사',
      attempts: '시도', dust: '별가루', par: '기준', time: '시간',
      world: '월드', locked: '★ {n}개 더 모으면 열림',
      aimHint: '아무 데나 드래그해서 조준 · 놓으면 발사',
      aimHintKeys: '← → 방향 · ↑ ↓ 세기 · Space 발사 · R 다시',
      clockHint: '조준하는 동안 궤도는 멈춰 있어요 — 발사하면 시간이 흐릅니다',
      delivered: '배달 완료!', deliveredSub: ['정시 도착.', '서명, 봉인, 배달 완료.', '앱 별점 다섯 개. 아니 세 개.', '받는 분이 감동의 눈물을 흘립니다.', '찌그러진 곳 하나 없음.'],
      fail: {
        crashed: ['퍽.', '이제 그 소포는 행성 거예요. 영원히.', '반송 처리 (조각조각).'],
        swallowed: ['스파게티화.', '블랙홀이 고맙대요.', '배달 완료… 엉뚱한 특이점에.'],
        lost: ['우주 미아.', '잘 가, 소포야.', '이제 그 소포는 남의 문제예요.'],
        drifted: ['아직 도는 중. 아직 미배달.', '인내심 바닥 (18초).', '소포가 경치를 즐기는 중.'],
      },
      star1: '배달 완료', star2: '한 번에 별가루 전부', star3: '{n}번 안에 성공',
      sound: '효과음', music: '음악', lang: '언어', trails: '유령 궤적', reduce: '움직임 줄이기', reset: '진행 초기화',
      resetConfirm: '모든 진행을 지울까요? 되돌릴 수 없어요.',
      on: '켬', off: '끔',
      ff: 'F 키나 ⏩ 를 누르고 있으면 빨리감기',
      dailyTitle: '오늘의 경로', dailySub: '매일 새로운 배달. 모두에게 같은 경로.',
      dailyGenerating: '오늘의 경로를 그리는 중…', streak: '연속', best: '최고',
      sandboxHelp: '도구를 고르고 클릭하세요 (드래그하면 던지기). 모든 것이 서로를 끌어당깁니다.',
      editorHelp: '물체를 놓고, 출발점과 목표를 정한 뒤 테스트하세요. 친구에게 링크를 보내보세요.',
      test: '테스트', clear: '비우기', copied: '링크 복사됨!', undo: '되돌리기',
      tools: { select: '이동', start: '출발', goal: '목표', planet: '행성', giant: '거대 행성', moon: '달', sun: '태양', repulsor: '튕김 별', blackhole: '블랙홀', asteroid: '소행성', dust: '별가루', wall: '벽', worm: '웜홀', erase: '지우기', comet: '혜성', spray: '혜성 뿌리기' },
      stars: '별', of: '/', from: '보낸 이', unlockedBadge: '배지 획득',
      credits: '두 시간 동안 Claude가 당신을 위해 만들었어요.',
      howTo: '플레이 방법',
      how: [
        '화면 아무 데나 드래그했다 놓으면 — 새총처럼 반대 방향으로 날아가요.',
        '행성과 태양은 끌어당기고, 하얀 튕김 별은 밀어내고, 블랙홀은 삼켜요.',
        '파란 소용돌이는 웜홀: 한쪽으로 들어가면 다른 쪽으로, 같은 속도와 방향으로 나와요.',
        '빛나는 고리에 들어가면 배달 완료. 한 번의 비행에 별가루를 전부 모으면 ★ 추가.',
        '지난 비행은 유령 궤적으로 남아요. 참고하세요. 배우세요. 웃어도 돼요.',
      ],
      editorSolvable: '배달 가능한지 확인 중…', editorOk: '배달 가능 ✓', editorNo: '아직 성공하는 발사를 못 찾았어요',
      customRoute: '사용자 경로', play2: '플레이',
      total: '합계', resume: '계속', paused: '일시정지',
      speed: '속도',
    },
  };

  let lang = 'en';
  CC.i18n = {
    S,
    get lang() { return lang; },
    set(l) { lang = S[l] ? l : 'en'; document.documentElement.lang = lang; },
    t(key, vars) {
      let v = key.split('.').reduce((o, k) => (o ? o[k] : undefined), S[lang]);
      if (v === undefined) v = key.split('.').reduce((o, k) => (o ? o[k] : undefined), S.en);
      if (typeof v === 'string' && vars) v = v.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
      return v;
    },
    pick(obj) { return obj ? obj[lang] || obj.en : ''; },
  };
  CC.t = CC.i18n.t;
  CC.pick = CC.i18n.pick;
})(window);
