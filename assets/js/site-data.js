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
   *      soldOut: false
   *    }
   * ---------------------------------------------------------------------- */
  menu: {
    lastUpdated: null, // 가격 기준일 'YYYY-MM-DD' (메뉴판 확인 후 입력)
    categories: [
      {
        id: 'eel',
        label: '장어 메뉴',
        note: '장어 가격은 중량에 따라 달라질 수 있습니다.',
        items: [
          { name: '민물장어', description: null, priceType: 'weight', options: [{ label: null, amount: null }] }
        ]
      },
      { id: 'meal', label: '식사류', note: null, items: [] },
      { id: 'drink', label: '주류·음료', note: null, items: [] },
      { id: 'table', label: '상차림비', note: null, items: [] },
      { id: 'extra', label: '기타 추가 메뉴', note: null, items: [] }
    ]
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
      { id: 'self-bar', icon: 'bowl', title: '셀프바 이용', description: null, photo: null },
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
      { id: 'exterior', label: '외관' },
      { id: 'interior', label: '내부' },
      { id: 'food', label: '음식' },
      { id: 'seats', label: '좌석' },
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
   *        예) 'https://blog.naver.com/someone/223000000000'
   * ---------------------------------------------------------------------- */
  reviews: {
    reviewUrl: 'https://map.naver.com/p/search/%EB%A7%8C%EA%B8%B0%EC%88%98%EC%82%B0/place/1004464648?placePath=%2Freview%3FabtExp%3DN-NMB-COV-26-MED%3A3%26bk_query%3D%EB%A7%8C%EA%B8%B0%EC%88%98%EC%82%B0%26entry%3Dpll%26from%3Dmap%26fromNxList%3Dtrue%26fromPanelNum%3D2%26locale%3Dko%26searchText%3D%EB%A7%8C%EA%B8%B0%EC%88%98%EC%82%B0%26svcName%3Dmap_pcv5%26timestamp%3D202611221422%26type%3DphotoView&bk_query=%EB%A7%8C%EA%B8%B0%EC%88%98%EC%82%B0&entry=pll&from=nx&fromNxList=true&searchType=place&c=15.00,0,0,0,dh',
    blogCount: 9,
    hiddenPosts: [],
    hiddenKeywords: ['틀림없이 행복해질꾸야']
  }
};
