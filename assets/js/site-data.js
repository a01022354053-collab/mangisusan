/* ==========================================================================
 * 만기수산셀프매장 홈페이지 콘텐츠 데이터
 * --------------------------------------------------------------------------
 * 자주 바뀌는 내용(예외 일정, 메뉴·가격, 이용 방법, 사진, 블로그 후기)은
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
   *    등록하면 '현재 영업 상태'와 상단 공지에 자동 반영됩니다.
   *
   *    휴무 예)  { date: '2026-12-31', closed: true, label: '임시휴무', note: '' },
   *    특별 영업 예) { date: '2027-01-01', open: '11:00', close: '20:00', lastOrder: '19:00', label: '단축 영업' },
   * ---------------------------------------------------------------------- */
  specialDays: [],

  /* ------------------------------------------------------------------------
   * 2) 메뉴 및 가격표
   *
   *    메뉴 항목 형식
   *    {
   *      name: '메뉴 이름',
   *      description: '짧은 설명' 또는 null,
   *      priceType: 'weight'      → 중량별 가격 (예: 1kg, 500g)
   *               | 'fixed'       → 단일 가격
   *               | 'per-person'  → 1인 기준 (상차림비 등)
   *      options: [
   *        { label: '1kg', amount: 50000 },     // amount: 숫자(원). 모르면 null
   *        { label: '시가', amount: null, amountText: '시가' }
   *      ],
   *      soldOut: false                        // 품절 시 true
   *    }
   * ---------------------------------------------------------------------- */
  menu: {
    lastUpdated: null, // 가격 기준일 'YYYY-MM-DD' (메뉴판 확인 후 입력)
    categories: [
      {
        id: 'eel',
        label: '민물장어',
        note: '장어 가격은 중량에 따라 달라질 수 있습니다.',
        items: [
          {
            name: '민물장어',
            description: null,
            priceType: 'weight',
            options: [{ label: null, amount: null }] // 중량 기준·가격 확인 후 입력
          }
        ]
      },
      { id: 'meal', label: '식사·추가 메뉴', note: null, items: [] },
      { id: 'liquor', label: '주류', note: null, items: [] },
      { id: 'drink', label: '음료', note: null, items: [] },
      { id: 'extra', label: '상차림비·추가 비용', note: null, items: [] }
    ]
  },

  /* ------------------------------------------------------------------------
   * 3) 처음 방문하는 손님을 위한 이용 방법
   *    - published: false 인 동안에는 순서 번호 없이 '안내 준비 중'으로만 표시됩니다.
   *    - 실제 순서와 내용(특히 결제 시점)을 매장에서 확인한 뒤
   *      steps 순서를 맞추고 description·photo 를 채운 다음 true 로 바꾸세요.
   *    - photo 예) { src: 'assets/img/guide/choose.webp', alt: '수조에서 장어를 고르는 모습' }
   * ---------------------------------------------------------------------- */
  guide: {
    published: false,
    steps: [
      { id: 'enter', title: '매장 입장', description: null, photo: null },
      { id: 'choose', title: '장어 선택', description: null, photo: null },
      { id: 'weigh', title: '중량 및 가격 확인', description: null, photo: null },
      { id: 'pre-grill', title: '초벌구이', description: null, photo: null },
      { id: 'table', title: '테이블 이용', description: null, photo: null },
      { id: 'self-bar', title: '셀프바 이용', description: null, photo: null },
      { id: 'order-pay', title: '추가 주문 및 결제', description: null, photo: null }
    ]
  },

  /* ------------------------------------------------------------------------
   * 4) 매장 사진
   *    사진 파일은 assets/img/gallery/ 에 넣고 아래에 등록합니다.
   *    {
   *      src: 'assets/img/gallery/exterior-01.webp',  // 큰 사진
   *      thumb: 'assets/img/gallery/exterior-01-sm.webp', // 목록용 작은 사진 (없으면 src 사용)
   *      alt: '북삼로에서 본 매장 외관',                // 사진 설명 (화면낭독기용)
   *      category: 'exterior',                        // 아래 categories 의 id
   *      caption: '매장 외관',
   *      isSample: false                              // 실제 매장 사진이 아니면 반드시 true → '예시 이미지' 표시
   *    }
   * ---------------------------------------------------------------------- */
  gallery: {
    categories: [
      { id: 'exterior', label: '매장 외관' },
      { id: 'entrance', label: '매장 입구' },
      { id: 'hall', label: '테이블·좌석' },
      { id: 'room', label: '룸·단체석' },
      { id: 'counter', label: '장어 판매 공간' },
      { id: 'food', label: '장어·음식' },
      { id: 'parking', label: '주차장' }
    ],
    photos: []
  },

  /* ------------------------------------------------------------------------
   * 5) 네이버 방문 후기 · 블로그
   *    - naverPlaceUrl: 네이버 플레이스 '공유' 버튼으로 받은 주소(naver.me/…)로 교체하면
   *      매장 상세(리뷰 탭)로 바로 연결됩니다. 지금은 매장명 검색 결과로 연결됩니다.
   *    - blogPosts: 3~5개 권장. 요약은 직접 작성하고, 블로그 사진·본문을 복제하지 않습니다.
   *      { title: '글 제목', summary: '직접 쓴 한두 문장 요약', author: '블로거 이름',
   *        publishedAt: '2026-10-01', url: 'https://blog.naver.com/…' }
   * ---------------------------------------------------------------------- */
  reviews: {
    naverPlaceUrl: 'https://map.naver.com/p/search/만기수산셀프매장',
    blogPosts: []
  }
};
