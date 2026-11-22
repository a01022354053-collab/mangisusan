# 만기수산셀프매장 홈페이지

칠곡 북삼 민물장어 셀프매장 **만기수산셀프매장** 원페이지 홈페이지 (https://만기수산.kro.kr)
정적 HTML/CSS/JavaScript + Vercel 서버 함수 2개(`api/`)로 동작하며, `main` 브랜치가 Vercel로 배포됩니다.

## 파일 구조

| 파일 | 역할 | 수정 빈도 |
|---|---|---|
| `index.html` | 화면 구조, 매장 기본 정보(영업시간·전화·주소·주차·결제·편의시설) | 가끔 |
| `assets/js/site-data.js` | 임시휴무, 메뉴판, 이벤트, 장어 소개·인사말, 반찬 셀프바, 이용 방법, 사진, 지도 위치, 리뷰·블로그 | **자주** |
| `assets/js/business-hours.js` | 오늘 날짜·영업 상태 계산 (서울 시간 기준) | 거의 없음 |
| `assets/js/hero-water.js` | 상단 장어·물결·물방울 움직임 (Canvas) | 거의 없음 |
| `assets/js/main.js` | 화면 동작 (상태 표시, 길찾기 창, 메뉴판, 지도, 블로그 카드 등) | 거의 없음 |
| `assets/css/style.css` | 디자인 | 거의 없음 |
| `api/geocode.js` | 주소 → 좌표 변환 (네이버 지도 Geocoding, 서버에서만 키 사용) | 거의 없음 |
| `api/blog.js` | 네이버 블로그 검색 (서버에서만 키 사용, 북삼·칠곡 글만 선별) | 거의 없음 |
| `assets/img/logo-text.webp`, `logo-seal.webp`, `logo-mangisusan.*` | 간판 로고에서 분리한 붓글씨·도장 (투명 배경) | - |
| `assets/img/favicon-*.png`, `apple-touch-icon.png` | 브라우저 탭·홈 화면 아이콘 (도장) | - |
| `assets/img/og-image.jpg` | 카카오톡 등 공유 미리보기 이미지 | - |
| `assets/img/events/` | 이벤트 포스터 (`이름.webp` 목록용 560px, `이름-lg.webp` 크게 보기용 1200px) | 이벤트 바뀔 때 |
| `logo.png` | 제공받은 원본 대표 이미지 (로고 추출 원본) | - |
| `tools/extract_logo.py` | 원본에서 로고를 다시 추출하는 스크립트 | - |
| `tests/` | 영업 상태·블로그 선별 테스트 (배포되지 않음) | - |

## Vercel 환경 변수

| 이름 | 용도 |
|---|---|
| `NAVER_MAPS_CLIENT_ID`, `NAVER_MAPS_CLIENT_SECRET` | 지도 좌표 변환(`/api/geocode`) |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 블로그 검색(`/api/blog`) — 네이버 개발자센터 검색 API |

블로그 키는 아래 이름 중 하나여도 됩니다: `NAVER_SEARCH_CLIENT_ID/SECRET`, `NAVER_BLOG_CLIENT_ID/SECRET`,
네이버 클라우드 API HUB 를 쓰는 경우 `NAVER_API_HUB_KEY_ID` / `NAVER_API_HUB_KEY`.
환경 변수를 바꾼 뒤에는 Vercel 에서 **재배포**해야 적용됩니다.

이름이 위와 달라도 `NAVER` 가 들어간 `...ID` / `...SECRET` 짝이면 자동으로 찾습니다.

**블로그가 안 보일 때:** `https://만기수산.kro.kr/api/blog?check=1` 을 열어 보세요. (키 값은 절대 표시되지 않습니다)

| 보이는 내용 | 뜻과 해결 |
|---|---|
| `"ok": true`, `matched` 가 0 이상 | 정상. `queries` 에 검색어별 건수가 나옵니다 |
| `키를 찾지 못했습니다` + `naverEnvNames` | 환경 변수가 없거나 이름이 다름 → 이름 확인 후 재배포 |
| `attempts` 에 `401`/`403`, `024` 등 | 키가 틀렸거나, 네이버 개발자센터 앱의 '사용 API'에 **검색**이 빠짐 |

## 자주 하는 수정

### 영업시간 — `index.html`
`id="hours-table"` 표에서 **화면 글자와 `data-` 값을 함께** 고칩니다.

```html
<tr data-days="tue wed thu fri" data-open="16:00" data-close="22:00" data-last-order="21:00">
  <th scope="row">화~금요일</th><td>16:00 ~ 22:00</td>
</tr>
```

- `data-days` 에는 요일을 `mon tue wed thu fri sat sun` 로 적습니다. 7개 요일이 모두 한 번씩 있어야 합니다.
- 표 아래 `라스트오더` 줄과 푸터의 영업시간 요약 문구도 함께 확인하세요.

### 임시휴무·명절 영업 — `site-data.js` 의 `specialDays`
```js
specialDays: [
  { date: '2026-12-31', closed: true, label: '임시휴무' },
  { date: '2027-01-01', open: '11:00', close: '20:00', lastOrder: '19:00', label: '단축 영업' }
],
```
등록하면 첫 화면 영업 상태와 공지(14일 전부터)에 자동 반영됩니다.

### 메뉴판 — `site-data.js` 의 `menu`
- 가격은 숫자: `amount: 50000` → `50,000원` / 모르면 `null` → `가격 확인 중`
- 장어처럼 중량별 가격은 `options` 에 여러 줄: `{ label: '100g당', amount: 9500 }`
- `highlight: true` 인 메뉴(민물장어)는 메뉴판 맨 위에 크게 표시됩니다.
- 할인 가격은 `{ amount: 27000, originalAmount: 30000 }` → 할인 전 가격에 취소선
- 메뉴가 하나도 없는 분류(식사류·상차림비)는 '가격 확인 중'으로 묶여 보입니다. 가격을 넣으면 자동으로 메뉴판에 나타납니다.
- 가격을 바꾼 날은 `lastUpdated: '2026-12-01'`

### 이벤트 — `assets/img/events/` + `site-data.js` 의 `events`
- 이벤트를 끝낼 때: `active: false` → 화면에서 바로 사라집니다. (지우지 않아도 됨)
- 기간이 정해진 이벤트: `startsAt: '2026-12-01', endsAt: '2026-12-31'` → 그 기간(서울 날짜)에만 표시
- `price` 판매가, `originalPrice` 할인 전 가격 → 'N원 할인' 이 자동 계산됩니다.
- 진행 중인 이벤트가 하나도 없으면 이벤트 섹션과 메뉴의 '이벤트' 버튼이 함께 숨겨집니다.
- 포스터를 바꿀 때는 새 파일 이름을 쓰세요. (캐시 때문에 이전 포스터가 보일 수 있음)

### 장어 소개·사장님 인사말 — `site-data.js` 의 `intro`, `greeting`
사장님께 확인한 글만 넣습니다. 둘 다 `null` 이면 섹션이 화면에 나오지 않습니다.

### 반찬 셀프바 — `site-data.js` 의 `selfbar`
`items` 에 반찬 이름, `photo` 에 셀프바 사진(`{ src, alt }`)을 넣으면 '사진 준비 중' 대신 표시됩니다.

### 사진 — `assets/img/gallery/` + `site-data.js` 의 `gallery.photos`
- 긴 변 1600px 이하 WebP/JPG 권장. 사진을 넣으면 '사진 준비 중' 틀 대신 사진 목록과 크게 보기가 나타납니다.
- `category` 는 `food`(장어구이) `exterior`(외관·입구) `interior`(매장 내부) `seats`(좌석·단체석) `selfbar`(반찬 셀프바) `parking`(주차장) 중 하나입니다.
- 실제 매장 사진이 아니면 `isSample: true` → '예시 이미지' 표시.
- 같은 이름으로 교체하면 최대 7일간 이전 사진이 보일 수 있으니 새 파일 이름을 쓰세요.

### 이용 방법 — `site-data.js` 의 `guide`
실제 순서·결제 시점을 확인한 뒤 `steps` 를 순서대로 정리하고 설명·사진을 채운 다음 `published: true`.

### 리뷰·블로그 — `site-data.js` 의 `reviews`
- `reviewUrl`: '리뷰' 버튼을 누르면 이동하는 주소
- `hiddenPosts`: 관련 없는 블로그 글 주소를 넣으면 숨겨집니다.
- `hiddenKeywords`: 제목이나 블로거 이름에 이 단어가 들어간 글은 숨겨집니다. 예) `['틀림없이 행복해질꾸야']`
- `blogCount`: 보여 줄 블로그 후기 개수 (현재 3, 같은 블로거는 1개씩)
- `pinnedPosts`: 대표로 먼저 보여 줄 블로그 글 주소. 나머지는 최신 후기로 채워집니다.

### 지도 — `site-data.js` 의 `map`
매장과 인평체육공원 주차장 주소로 좌표를 찾아 표시합니다. 주소를 바꾸면 지도 표시도 바뀝니다.
네이버 지도 Client ID 는 `main.js` 의 `NAVER_MAP_KEY_ID` 입니다.

### 로고를 원본 파일로 교체할 때
원본 디자인 파일에서 투명 배경 PNG 를 받으면 `assets/img/logo-text.webp`(붓글씨)와 `logo-seal.webp`(도장)를 교체합니다.
현재 이미지는 `python3 tools/extract_logo.py` 로 `logo.png` 에서 추출한 것입니다.

## 내 컴퓨터에서 미리 보기

```bash
python3 -m http.server 8000
```
`http://localhost:8000` (지도·블로그는 Vercel 서버 함수가 필요해 배포 환경에서만 표시됩니다)

## 테스트

```bash
node --test tests/*.test.js
```
