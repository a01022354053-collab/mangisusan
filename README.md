# 만기수산셀프매장 홈페이지

칠곡 북삼 셀프형 민물장어 전문점 **만기수산셀프매장** 원페이지 홈페이지입니다.
빌드 도구·서버·데이터베이스 없이 HTML/CSS/JavaScript 파일만으로 동작하며 Vercel에 그대로 배포됩니다.

## 파일 구조

| 파일 | 역할 | 수정 빈도 |
|---|---|---|
| `index.html` | 화면 전체 구조, 매장 기본 정보(영업시간·전화·주소·주차·편의시설·좌석·결제) | 가끔 |
| `assets/js/site-data.js` | 임시휴무, 메뉴·가격, 이용 방법, 사진, 블로그 후기 | **자주** |
| `assets/js/business-hours.js` | 현재 영업 상태 계산 (서울 시간 기준) | 거의 없음 |
| `assets/js/main.js` | 화면 동작 (상태 표시, 길찾기 창, 복사, 메뉴 탭, 사진 크게 보기 등) | 거의 없음 |
| `assets/css/style.css` | 디자인 | 거의 없음 |
| `assets/img/logo-*.webp`, `logo-1280.jpg` | 원본 `logo.png`(2.1MB)를 크기만 줄인 대표 이미지 (27~104KB) | - |
| `assets/img/og-image.jpg` | 카카오톡 등 공유 미리보기 이미지 | - |
| `logo.png` | 제공받은 원본 로고 이미지 (보관용) | - |
| `tests/` | 영업 상태 계산 테스트 (배포되지 않음) | - |

## 자주 하는 수정

### 영업시간 변경 — `index.html`
`id="hours-table"` 표에서 해당 요일 줄의 **화면 글자와 `data-` 값을 함께** 고칩니다.

```html
<tr data-day="tue" data-open="16:00" data-close="22:00" data-last-order="21:00">
  <th scope="row">화요일</th><td>16:00 ~ 22:00</td><td>21:00</td>
</tr>
```

- `data-` 값은 '영업 중/주문 마감' 상태 계산과 검색엔진용 정보에 자동으로 쓰입니다.
- 둘이 다르면 브라우저 개발자 도구에 경고가 표시됩니다.
- 표 아래 안내 문구(오픈 시각)와 예약 안내의 '매주 월요일 정기휴무' 문구도 함께 확인하세요.

### 임시휴무·명절 영업 — `assets/js/site-data.js`
```js
specialDays: [
  { date: '2026-12-31', closed: true, label: '임시휴무' },
  { date: '2027-01-01', open: '11:00', close: '20:00', lastOrder: '19:00', label: '단축 영업' }
],
```
등록하면 첫 화면 상태 표시와 공지(14일 전부터)에 자동 반영됩니다. **확인된 일정만** 넣어 주세요.

### 메뉴·가격 — `assets/js/site-data.js` 의 `menu`
- 가격은 숫자로 적습니다: `amount: 50000` → 화면에 `50,000원`
- 모르는 가격은 `null` → 화면에 `가격 확인 중`
- 장어처럼 중량별 가격은 `options` 에 여러 줄로 적습니다: `{ label: '1kg', amount: 50000 }`
- 가격을 바꾼 날은 `lastUpdated: '2026-12-01'` 로 기록합니다 (화면에 '가격 기준일' 표시).

### 사진 추가 — `assets/img/gallery/` + `site-data.js` 의 `gallery.photos`
- 긴 변 1600px 이하, WebP 또는 JPG 권장 (휴대폰 사진 원본은 너무 큽니다).
- 실제 매장 사진이 아닌 예시 이미지는 반드시 `isSample: true` → '예시 이미지' 표시.
- 같은 이름으로 사진을 교체하면 방문자 브라우저에 최대 7일간 이전 사진이 남을 수 있으니 **새 파일 이름**을 쓰세요.

### 이용 방법 공개 — `site-data.js` 의 `guide`
매장에서 실제 순서(특히 결제 시점)를 확인한 뒤 `steps` 순서·설명·사진을 채우고 `published: true` 로 바꿉니다.
그 전까지는 번호 없이 '안내 예정 항목'으로만 보입니다.

### 네이버 리뷰 링크·블로그 후기 — `site-data.js` 의 `reviews`
- 네이버 플레이스에서 '공유' → 링크 복사(`https://naver.me/...`) 후 `naverPlaceUrl` 에 넣으면 매장 상세로 바로 연결됩니다.
- 블로그 후기는 3~5개, 요약은 직접 작성하고 원문 링크만 겁니다. 블로그 사진·본문은 복제하지 않습니다.

### 전화번호·주소 변경 — `index.html`, `assets/js/main.js`
`054-976-8892`, `북삼로 58` 을 파일 전체에서 찾아 바꾸기 하세요. (`main.js` 의 `PHONE` 상수와 검색엔진용 정보 포함)

### 예약 버튼 추가
네이버 예약 등을 실제로 운영하게 되면 `index.html` 의 `id="reservation"` 섹션 `btn-row` 에 링크 버튼을 추가합니다.

## 내 컴퓨터에서 미리 보기

```bash
python3 -m http.server 8000
```
브라우저에서 `http://localhost:8000` 접속.

## 테스트

```bash
node --test tests/*.test.js
```
