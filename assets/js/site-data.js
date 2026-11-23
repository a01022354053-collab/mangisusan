/* ==========================================================================
 * 만기수산셀프매장 홈페이지 콘텐츠 데이터
 * --------------------------------------------------------------------------
 * 자주 바뀌는 내용(임시휴무, 메뉴·가격, 이용 방법, 사진, 지도 위치, 리뷰·블로그)은
 * 이 파일만 수정하면 화면에 반영됩니다.
 *
 * ▶ 작성 원칙
 *   - 확인되지 않은 정보는 넣지 않습니다. 모르는 값은 null 로 둡니다.
 *   - null 인 가격은 화면에 '가격 확인 중'으로 표시됩니다. (= 확인 후 입력 상태)
 *   - 문자열은 작은따옴표('...')로 감싸고, 항목 사이에는 쉼표(,)를 넣습니다.
 *
 * ▶ 영업시간·전화번호·주소는 index.html 에 직접 적혀 있습니다. (README.md 참고)
 * ========================================================================== */
window.SITE_DATA = {
  /* ------------------------------------------------------------------------
   * 1) 예외 일정 — 공휴일·명절·임시휴무 (확인된 경우에만 추가)
   *    휴무 예)      { date: '2026-12-31', closed: true, label: '임시휴무' },
   *    특별 영업 예) { date: '2027-01-01', open: '11:00', close: '20:00', lastOrder: '19:00', label: '단축 영업' },
   * ---------------------------------------------------------------------- */
  specialDays: [],

  /* ------------------------------------------------------------------------
   * 2) 메뉴판
   *    메뉴 항목 형식
   *    {
   *      name: '메뉴 이름',
   *      description: '짧은 설명' 또는 null,
   *      priceType: 'weight' (중량별) | 'fixed' (단일 가격) | 'per-person' (1인 기준),
   *      options: [ { label: '1kg', amount: 50000 } ],   // amount: 숫자(원), 모르면 null
   *                     // 할인 중이면 { amount: 27000, originalAmount: 30000 } → 원래 가격에 줄
   *      highlight: true,  // 메뉴판 맨 위에 크게 보여 줄 대표 가격 (장어)
   *      badge: '대표', // 이름 아래 작은 표시 (선택)
   *      soldOut: false
   *    }
   *    분류의 deco: 분류 제목 옆 움직이는 장식 (assets/js/menu-art.js)
   *      'pot' 김 나는 뚝배기 · 'drinker' 술 마시는 장어 · 'fizz' 기포 오르는 잔 · 'bag' 포장 봉투
   *    분류의 strip: true → 대표 가격 아래 한 줄로 (상차림비)
   * ---------------------------------------------------------------------- */
  menu: {
    lastUpdated: '2026-11-19', // 가격 기준일 (네이버 플레이스 메뉴 최근 업데이트 26.11.19)
    categories: [
      {
        id: 'eel',
        label: '장어 메뉴',
        note: '장어는 중량에 따라 가격이 정해집니다.',
        items: [
          { name: '민물장어', description: null, priceType: 'weight', highlight: true, options: [{ label: '100g당', amount: 9500 }] }
        ]
      },
      {
        id: 'table',
        label: '상차림비',
        strip: true, // 메뉴판 맨 위 대표 가격 아래 한 줄로 표시
        note: null,
        items: [
          { name: '상차림비 (8세 이상)', priceType: 'fixed', options: [{ label: null, amount: 3000 }] }
        ]
      },
      {
        id: 'meal',
        label: '식사',
        deco: 'pot',
        note: null,
        items: [
          { name: '장어탕 (밥 포함)', badge: '대표', priceType: 'fixed', options: [{ label: null, amount: 8000 }] },
          { name: '장어탕 홀식사', priceType: 'fixed', options: [{ label: null, amount: 10000 }] },
          { name: '된장찌개 (밥 포함)', priceType: 'fixed', options: [{ label: null, amount: 4000 }] },
          { name: '열무국수', priceType: 'fixed', options: [{ label: null, amount: 5000 }] },
          { name: '공기밥', priceType: 'fixed', options: [{ label: null, amount: 1000 }] }
        ]
      },
      {
        id: 'takeout',
        label: '포장',
        deco: 'bag',
        note: null,
        items: [
          { name: '장어탕 포장', priceType: 'fixed', options: [{ label: null, amount: 15000 }] },
          { name: '장어즙 1박스', description: '80ml × 50포', priceType: 'fixed', options: [{ label: '현금가', amount: 120000 }, { label: '카드가', amount: 130000 }] }
        ]
      },
      {
        id: 'liquor',
        label: '주류',
        deco: 'drinker',
        note: null,
        items: [
          { name: '소주', priceType: 'fixed', options: [{ label: null, amount: 4000 }] },
          { name: '맥주', priceType: 'fixed', options: [{ label: null, amount: 4000 }] },
          { name: '청하', priceType: 'fixed', options: [{ label: null, amount: 5000 }] },
          { name: '별빛청하', priceType: 'fixed', options: [{ label: null, amount: 6000 }] },
          { name: '호랑이 막걸리', priceType: 'fixed', options: [{ label: null, amount: 5000 }] },
          { name: '벌떡주', description: '15가지 한약재를 달여 만든 술 · 375ml · 13%', priceType: 'fixed', options: [{ label: null, amount: 15000 }] },
          { name: '복분자', priceType: 'fixed', options: [{ label: null, amount: 15000 }] },
          { name: '복분자 세트', description: '토닉워터 2병 + 레몬', priceType: 'fixed', options: [{ label: null, amount: 17000 }] }
        ]
      },
      {
        id: 'spirits',
        label: '화요 · 일품진로 · 고량주',
        note: null,
        items: [
          { name: '화요 25도', priceType: 'fixed', options: [{ label: null, amount: 24000 }] },
          { name: '화요 세트', description: '토닉워터 2병 + 레몬', priceType: 'fixed', options: [{ label: null, amount: 26000 }] },
          { name: '일품진로 25도', priceType: 'fixed', options: [{ label: null, amount: 25000 }] },
          { name: '일품진로 세트', description: '토닉워터 2병 + 레몬', priceType: 'fixed', options: [{ label: null, amount: 27000 }] },
          { name: '일품진로 오크 41도', priceType: 'fixed', options: [{ label: null, amount: 50000 }] },
          { name: '일품진로 오크 세트', priceType: 'fixed', options: [{ label: null, amount: 52000 }] },
          { name: '연태고량주 (중)', priceType: 'fixed', options: [{ label: null, amount: 20000 }] },
          { name: '연태고량주 (대)', priceType: 'fixed', options: [{ label: null, amount: 35000 }] }
        ]
      },
      {
        id: 'beverage',
        label: '음료',
        deco: 'fizz',
        note: null,
        items: [
          { name: '음료수', priceType: 'fixed', options: [{ label: null, amount: 2000 }] },
          { name: '제로맥주', priceType: 'fixed', options: [{ label: null, amount: 4000 }] }
        ]
      }
    ]
  },

  /* ------------------------------------------------------------------------
   * 2-1) 이벤트 — 첫 화면 가로 배너(한 장씩 넘김)로 표시
   *    홍보 포스터(assets/img/events/)와 확인된 가격만 사용
   *    - 배너 순서 = 아래 적힌 순서. 배너를 누르면 포스터를 크게 볼 수 있습니다.
   *    - active: false 로 바꾸면 화면에서 바로 숨겨집니다. (종료된 이벤트)
   *    - startsAt / endsAt: 'YYYY-MM-DD' 를 넣으면 그 기간에만 보입니다. (서울 날짜 기준, 모르면 null)
   *    - price: 판매 가격, originalPrice: 할인 전 가격(있으면 할인 금액을 자동 계산해 강조)
   *    - prices: 결제수단별 가격처럼 가격이 여러 개일 때 [{ label, amount }]
   *    - steps / reward: 참여형 이벤트의 참여 방법과 혜택 (포스터에 적힌 그대로)
   * ---------------------------------------------------------------------- */
  events: [
    {
      id: 'sns-review', kind: 'feature', active: true, startsAt: null, endsAt: null,
      badge: 'SNS 리뷰 이벤트', title: 'SNS 인증 네이버 리뷰 이벤트',
      reward: '음료 1캔 무료',
      steps: ['영수증 및 음식 사진 촬영', '네이버 및 SNS에 리뷰 작성', '직원 확인 후 음료 증정'],
      image: 'assets/img/events/sns-review.webp', imageLarge: 'assets/img/events/sns-review-lg.webp',
      alt: 'SNS 인증 네이버 리뷰 이벤트 포스터: 참여하면 음료 1캔 무료'
    },
    {
      id: 'set-ilpum', kind: 'deal', active: true, startsAt: null, endsAt: null,
      badge: '주류 할인 세트', title: '일품진로25 + 토닉 2병 + 레몬',
      price: 27000, originalPrice: 30000,
      image: 'assets/img/events/set-ilpum.webp', imageLarge: 'assets/img/events/set-ilpum-lg.webp',
      alt: '일품진로25와 토닉워터 2병, 레몬 세트 포스터: 30,000원에서 27,000원'
    },
    {
      id: 'set-hwayo', kind: 'deal', active: true, startsAt: null, endsAt: null,
      badge: '주류 할인 세트', title: '화요25 + 토닉 2병 + 레몬',
      price: 26000, originalPrice: 29000,
      image: 'assets/img/events/set-hwayo.webp', imageLarge: 'assets/img/events/set-hwayo-lg.webp',
      alt: '화요25와 토닉워터 2병, 레몬 가성비 세트 포스터: 29,000원에서 26,000원'
    },
    {
      id: 'set-bokbunja', kind: 'deal', active: true, startsAt: null, endsAt: null,
      badge: '주류 할인 세트', title: '복분자 + 토닉 2병 + 레몬',
      price: 17000, originalPrice: 19000,
      image: 'assets/img/events/set-bokbunja.webp', imageLarge: 'assets/img/events/set-bokbunja-lg.webp',
      alt: '복분자주와 토닉워터 2병, 레몬 가성비 세트 포스터: 19,000원에서 17,000원'
    },
    {
      id: 'eel-juice', kind: 'deal', active: true, startsAt: null, endsAt: null,
      badge: '장어즙 판매', title: '장어즙 1박스 (80ml × 50포)',
      prices: [{ label: '현금가', amount: 120000 }, { label: '카드가', amount: 130000 }],
      image: 'assets/img/events/eel-juice.webp', imageLarge: 'assets/img/events/eel-juice-lg.webp',
      alt: '장어즙 1박스 50포 포스터: 카드가 130,000원, 현금가 120,000원'
    }
  ],

  /* ------------------------------------------------------------------------
   * 2-2) 장어 소개 · 사장님 인사말 — 사장님께 확인한 글만 넣습니다.
   *      둘 다 null 이면 '장어 소개' 섹션 자체가 화면에 나오지 않습니다.
   *    intro 예) { title: '...', paragraphs: ['...'], points: ['국내산 ...'], photo: { src, alt } }
   *    greeting 예) { text: '...', name: '만기수산 대표 ○○○' }
   * ---------------------------------------------------------------------- */
  intro: null,
  greeting: null,

  /* ------------------------------------------------------------------------
   * 2-3) 반찬 셀프바 — 셀프로 이용하는 것은 반찬입니다.
   *    items: 셀프바에 있는 반찬 이름 (확인 후 입력), photo: { src, alt }
   * ---------------------------------------------------------------------- */
  selfbar: {
    items: [],
    photo: null
  },

  /* ------------------------------------------------------------------------
   * 3) 처음 방문하는 손님을 위한 이용 방법
   *    - published: false 인 동안에는 순서 번호 없이 '안내 예정 항목'으로만 보입니다.
   *    - 실제 순서와 결제 시점을 매장에서 확인한 뒤 steps 순서·설명·사진을 채우고 true 로 바꾸세요.
   *    - icon: door, fish, scale, flame, table, bowl, card 중 하나
   *    - photo 예) { src: 'assets/img/guide/choose.webp', alt: '수조에서 장어를 고르는 모습' }
   * ---------------------------------------------------------------------- */
  guide: {
    published: false,
    steps: [
      { id: 'enter', icon: 'door', title: '매장 입장', description: null, photo: null },
      { id: 'choose', icon: 'fish', title: '장어 선택', description: null, photo: null },
      { id: 'weigh', icon: 'scale', title: '중량·가격 확인', description: null, photo: null },
      { id: 'pre-grill', icon: 'flame', title: '초벌구이', description: null, photo: null },
      { id: 'table', icon: 'table', title: '테이블 이용', description: null, photo: null },
      { id: 'self-bar', icon: 'bowl', title: '반찬 셀프바', description: null, photo: null },
      { id: 'order-pay', icon: 'card', title: '추가 주문·결제', description: null, photo: null }
    ]
  },

  /* ------------------------------------------------------------------------
   * 4) 매장 사진 — 파일은 assets/img/gallery/ 에 넣고 아래 photos 에 등록
   *    {
   *      src: 'assets/img/gallery/exterior-01.webp',
   *      thumb: 'assets/img/gallery/exterior-01-sm.webp', // 없으면 src 사용
   *      alt: '북삼로에서 본 매장 외관',
   *      category: 'exterior',                         // 아래 categories 의 id
   *      caption: '매장 외관',
   *      isSample: false                               // 실제 매장 사진이 아니면 반드시 true
   *    }
   * ---------------------------------------------------------------------- */
  gallery: {
    categories: [
      { id: 'exterior', label: '외관·입구' },
      { id: 'interior', label: '매장 내부' },
      { id: 'seats', label: '좌석·단체석' },
      { id: 'food', label: '장어구이' },
      { id: 'selfbar', label: '반찬 셀프바' },
      { id: 'parking', label: '주차장' }
    ],
    photos: []
  },

  /* ------------------------------------------------------------------------
   * 5) 지도 — 주소를 좌표로 바꾸는 일은 서버(/api/geocode)가 합니다.
   * ---------------------------------------------------------------------- */
  map: {
    naverPlaceUrl: 'https://map.naver.com/p/entry/place/1004464648', // '네이버 지도에서 보기'
    places: [
      { id: 'store', kind: 'store', name: '만기수산셀프매장', label: '만기수산', address: '경상북도 칠곡군 북삼읍 북삼로 58' },
      { id: 'park', kind: 'parking', name: '인평체육공원 주차장', label: '인평체육공원', address: '경상북도 칠곡군 북삼읍 북삼로 65' }
    ]
  },

  /* ------------------------------------------------------------------------
   * 6) 리뷰 · 블로그
   *    - reviewUrl: '리뷰' 버튼을 누르면 이동하는 주소
   *    - 블로그 글은 서버(/api/blog)가 네이버 블로그 검색 API 로 가져와
   *      '만기수산' + 지역명(북삼·칠곡·인평)이 함께 있는 글만 골라 보여 줍니다.
   *    - hiddenPosts: 관련 없거나 숨기고 싶은 글의 주소를 넣으면 보이지 않습니다.
   *    - hiddenKeywords: 제목이나 블로거 이름에 이 단어가 들어간 글은 보이지 않습니다. (띄어쓰기 무시)
   *    - pinnedPosts: 대표로 먼저 보여 줄 글 주소 (검색 결과에 있는 글만 적용, 나머지는 최신순으로 채움)
   *        예) 'https://blog.naver.com/someone/223000000000'
   * ---------------------------------------------------------------------- */
  reviews: {
    reviewUrl: 'https://map.naver.com/p/search/%EB%A7%8C%EA%B8%B0%EC%88%98%EC%82%B0/place/1004464648?placePath=%2Freview%3FabtExp%3DN-NMB-COV-26-MED%3A3%26bk_query%3D%EB%A7%8C%EA%B8%B0%EC%88%98%EC%82%B0%26entry%3Dpll%26from%3Dmap%26fromNxList%3Dtrue%26fromPanelNum%3D2%26locale%3Dko%26searchText%3D%EB%A7%8C%EA%B8%B0%EC%88%98%EC%82%B0%26svcName%3Dmap_pcv5%26timestamp%3D202611221422%26type%3DphotoView&bk_query=%EB%A7%8C%EA%B8%B0%EC%88%98%EC%82%B0&entry=pll&from=nx&fromNxList=true&searchType=place&c=15.00,0,0,0,dh',
    blogCount: 3,
    pinnedPosts: [],
    hiddenPosts: [],
    hiddenKeywords: ['틀림없이 행복해질꾸야', '양포 생아구']
  }
};
