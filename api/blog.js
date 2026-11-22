// 네이버 블로그 검색 API 서버 프록시
// ---------------------------------------------------------------------------
// - 키는 Vercel 환경 변수에서만 읽고, 방문자 브라우저로는 절대 보내지 않습니다.
// - '만기수산 북삼', '만기수산 칠곡', '만기수산셀프매장'으로 검색합니다.
//   검색어에 지역명이 들어가므로 네이버가 본문 전체에서 지역까지 맞는 글을 찾아 주고,
//   여기서는 제목·요약에 '만기수산'이 실제로 있는 글만 남깁니다. (다른 지역 동명 업체 방지)
// - 방문 후기만: 채용·부동산·광고 문의 같은 글은 빼고, 먹고 다녀온 이야기가 있는 글만 남깁니다.
// - 다양하게: 같은 블로거의 글은 가장 최근 1개만 보여 줍니다.
// - 검색 API가 주지 않는 썸네일 이미지는 만들거나 가져오지 않습니다.
//
// 키 찾는 순서
//   1) 네이버 개발자센터 검색 API : NAVER_CLIENT_ID / NAVER_CLIENT_SECRET
//                                  NAVER_SEARCH_CLIENT_ID / _SECRET, NAVER_BLOG_CLIENT_ID / _SECRET
//   2) 이름에 NAVER 가 들어간 ...ID / ...SECRET 짝 (이름이 달라도 자동으로 찾음)
//   3) 네이버 클라우드 API HUB   : NAVER_API_HUB_KEY_ID / NAVER_API_HUB_KEY (지도 키로도 시도)
//
// 문제 확인: /api/blog?check=1 → 찾은 키 '이름', 네이버 응답 코드·오류 메시지, 검색 건수 (키 값은 절대 표시 안 함)
const https = require('https');

const QUERIES = ['만기수산 북삼', '만기수산 칠곡', '만기수산셀프매장'];
const MUST_INCLUDE = '만기수산';
const MAX_ITEMS = 20;
// 후기로 볼 수 있는 표현 (하나라도 있으면 후기)
const REVIEW_WORDS = ['후기', '리뷰', '방문', '다녀', '다녀옴', '맛집', '먹', '장어', '내돈내산', '재방문', '외식',
  '데이트', '가족', '모임', '회식', '저녁', '점심', '추천', '셀프'];
// 후기가 아닌 글 (하나라도 있으면 제외)
const NOT_REVIEW_WORDS = ['채용', '구인', '구직', '알바', '아르바이트', '모집', '공고', '매매', '임대', '분양', '부동산',
  '상가', '양도', '광고문의', '협찬문의', '체험단모집'];

const KNOWN = [
  { type: 'openapi', id: 'NAVER_CLIENT_ID', secret: 'NAVER_CLIENT_SECRET' },
  { type: 'openapi', id: 'NAVER_SEARCH_CLIENT_ID', secret: 'NAVER_SEARCH_CLIENT_SECRET' },
  { type: 'apihub', id: 'NAVER_BLOG_CLIENT_ID', secret: 'NAVER_BLOG_CLIENT_SECRET' }, // NCP API HUB 에서 발급한 키
  { type: 'openapi', id: 'NAVER_BLOG_CLIENT_ID', secret: 'NAVER_BLOG_CLIENT_SECRET' },
  { type: 'apihub', id: 'NAVER_API_HUB_KEY_ID', secret: 'NAVER_API_HUB_KEY' },
  { type: 'apihub', id: 'NAVER_MAPS_CLIENT_ID', secret: 'NAVER_MAPS_CLIENT_SECRET' }
];

const ENDPOINTS = {
  openapi: (q) => ({
    hostname: 'openapi.naver.com',
    path: '/v1/search/blog.json?display=50&sort=sim&query=' + encodeURIComponent(q),
    headers: (id, secret) => ({ 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret })
  }),
  apihub: (q) => ({
    hostname: 'naverapihub.apigw.ntruss.com',
    path: '/search/v1/blog?display=50&sort=sim&query=' + encodeURIComponent(q),
    headers: (id, secret) => ({ 'X-NCP-APIGW-API-KEY-ID': id, 'X-NCP-APIGW-API-KEY': secret })
  })
};

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' };

/** 검색 결과의 <b> 강조 태그와 HTML 엔티티를 지워 순수 글자로 */
function cleanText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] || m)
    .replace(/&#(\d+);/g, (m, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** '20261101' → '2026-11-01' */
function formatPostDate(value) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(value || ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function isSafeLink(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function isReview(text) {
  if (NOT_REVIEW_WORDS.some((word) => text.includes(word))) return false;
  return REVIEW_WORDS.some((word) => text.includes(word));
}

/** '만기수산' 방문 후기만 남기고, 중복·같은 블로거 글을 정리해 최신순으로 */
function filterPosts(items) {
  const seen = new Set();
  const authors = new Set();
  return (items || [])
    .map((item) => ({
      title: cleanText(item.title),
      summary: cleanText(item.description),
      author: cleanText(item.bloggername),
      date: formatPostDate(item.postdate),
      url: String(item.link || '').replace(/^http:\/\//, 'https://')
    }))
    .filter((post) => {
      if (!post.title || !isSafeLink(post.url) || seen.has(post.url)) return false;
      const text = (post.title + ' ' + post.summary).replace(/\s+/g, '');
      const relevant = text.includes(MUST_INCLUDE) && isReview(text);
      if (relevant) seen.add(post.url);
      return relevant;
    })
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .filter((post) => {
      // 같은 블로거는 가장 최근 글 하나만
      const key = (post.author || post.url.split('/').slice(0, 4).join('/')).toLowerCase();
      if (authors.has(key)) return false;
      authors.add(key);
      return true;
    })
    .slice(0, MAX_ITEMS);
}

/** 사용할 수 있는 키 쌍 목록 (이름만 다를 때도 자동으로 찾음) */
function findCredentials(env) {
  const list = KNOWN.slice();
  Object.keys(env).forEach((name) => {
    if (!/NAVER/i.test(name) || /MAP/i.test(name)) return;
    if (!/(CLIENT_?ID|_ID|KEY_?ID)$/i.test(name)) return;
    const secretName = [
      name.replace(/CLIENT_?ID$/i, 'CLIENT_SECRET'),
      name.replace(/KEY_?ID$/i, 'KEY'),
      name.replace(/_ID$/i, '_SECRET'),
      name.replace(/ID$/i, 'SECRET')
    ].find((candidate) => candidate !== name && env[candidate]);
    if (!secretName || list.some((c) => c.id === name)) return;
    list.splice(3, 0, { type: 'openapi', id: name, secret: secretName }); // 개발자센터 키로 먼저 시도
    list.push({ type: 'apihub', id: name, secret: secretName });
  });
  return list
    .map((c) => ({ ...c, idValue: String(env[c.id] || '').trim(), secretValue: String(env[c.secret] || '').trim() }))
    .filter((c) => c.idValue && c.secretValue);
}

function defaultRequester(options) {
  return new Promise((resolve, reject) => {
    const req = https.request({ ...options, method: 'GET', timeout: 8000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

let requester = defaultRequester;

/** 네이버 오류 응답에서 원인 메시지만 꺼냄 (키 값은 들어 있지 않음) */
function naverError(body) {
  try {
    const data = JSON.parse(body);
    return [data.errorCode, data.errorMessage || data.error?.message].filter(Boolean).join(' ').slice(0, 200);
  } catch (e) {
    return String(body || '').slice(0, 120);
  }
}

async function search(cred, query) {
  const endpoint = ENDPOINTS[cred.type](query);
  const res = await requester({
    hostname: endpoint.hostname,
    path: endpoint.path,
    headers: { Accept: 'application/json', ...endpoint.headers(cred.idValue, cred.secretValue) }
  });
  if (res.status < 200 || res.status >= 300) {
    const error = new Error(naverError(res.body));
    error.status = res.status;
    throw error;
  }
  return JSON.parse(res.body).items || [];
}

async function fetchPosts(env) {
  const creds = findCredentials(env);
  if (!creds.length) {
    const error = new Error('블로그 검색 API 키를 찾지 못했습니다. Vercel 환경 변수 이름을 확인해 주세요.');
    error.statusCode = 503;
    error.configured = Object.keys(env).filter((n) => /NAVER/i.test(n)); // 이름만
    throw error;
  }

  const attempts = [];
  for (const cred of creds) {
    const label = `${cred.type}(${cred.id})`;
    try {
      const all = [];
      const queries = [];
      for (const query of QUERIES) {
        const items = await search(cred, query); // 첫 검색에서 인증이 실패하면 다음 키로 넘어감
        all.push(...items);
        queries.push({ query, fetched: items.length });
      }
      const items = filterPosts(all);
      return { source: cred.type, keyName: cred.id, queries, matched: items.length, items };
    } catch (err) {
      attempts.push({ key: label, status: err.status || 0, message: String(err.message || err).slice(0, 200) });
    }
  }
  const error = new Error('블로그 검색 API 호출에 실패했습니다.');
  error.statusCode = 502;
  error.attempts = attempts;
  throw error;
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }
  const check = req.query && (req.query.check === '1' || req.query.check === 'true');
  try {
    const result = await fetchPosts(process.env);
    // 1시간 동안 같은 결과를 재사용 (API 호출 한도 보호), 이후 하루까지는 이전 결과를 보여 주며 갱신
    res.setHeader('Cache-Control', check ? 'no-store' : 's-maxage=3600, stale-while-revalidate=86400');
    const body = { ok: true, items: result.items };
    if (check) Object.assign(body, { keyName: result.keyName, source: result.source, queries: result.queries, matched: result.matched });
    return res.status(200).json(body);
  } catch (err) {
    res.setHeader('Cache-Control', check ? 'no-store' : 's-maxage=120');
    const body = { ok: false, error: err.message };
    if (err.configured) body.naverEnvNames = err.configured;
    if (err.attempts) body.attempts = err.attempts; // 키 '이름'과 네이버 응답만, 값은 없음
    return res.status(err.statusCode || 500).json(body);
  }
}

module.exports = handler;
module.exports.cleanText = cleanText;
module.exports.filterPosts = filterPosts;
module.exports.isReview = isReview;
module.exports.findCredentials = findCredentials;
module.exports.fetchPosts = fetchPosts;
module.exports._setRequester = (fn) => { requester = fn || defaultRequester; };
