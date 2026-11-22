// 네이버 블로그 검색 API 서버 프록시
// ---------------------------------------------------------------------------
// - 키는 Vercel 환경 변수에서만 읽고, 방문자 브라우저로는 절대 보내지 않습니다.
// - '만기수산'으로 검색한 글 중, 제목·요약에 지역명(북삼·칠곡·인평) 또는 '셀프매장'이
//   함께 있는 글만 돌려줍니다. (다른 지역의 동명 업체 글을 거르기 위함)
// - 검색 API가 주지 않는 썸네일 이미지는 만들거나 가져오지 않습니다.
//
// 사용하는 환경 변수 (아래 중 먼저 찾은 한 쌍을 사용)
//   네이버 개발자센터 검색 API : NAVER_SEARCH_CLIENT_ID / NAVER_SEARCH_CLIENT_SECRET
//                               NAVER_BLOG_CLIENT_ID / NAVER_BLOG_CLIENT_SECRET
//                               NAVER_CLIENT_ID / NAVER_CLIENT_SECRET
//   네이버 클라우드 API HUB     : NAVER_API_HUB_KEY_ID / NAVER_API_HUB_KEY
//                               (없으면 지도용 NAVER_MAPS_CLIENT_ID / NAVER_MAPS_CLIENT_SECRET 로 시도)
const https = require('https');

const QUERY = '만기수산';
const MUST_INCLUDE = '만기수산';
const AREA_WORDS = ['북삼', '칠곡', '인평', '셀프매장'];
const MAX_ITEMS = 12;

const CREDENTIALS = [
  { type: 'openapi', id: 'NAVER_SEARCH_CLIENT_ID', secret: 'NAVER_SEARCH_CLIENT_SECRET' },
  { type: 'openapi', id: 'NAVER_BLOG_CLIENT_ID', secret: 'NAVER_BLOG_CLIENT_SECRET' },
  { type: 'openapi', id: 'NAVER_CLIENT_ID', secret: 'NAVER_CLIENT_SECRET' },
  { type: 'apihub', id: 'NAVER_API_HUB_KEY_ID', secret: 'NAVER_API_HUB_KEY' },
  { type: 'apihub', id: 'NAVER_MAPS_CLIENT_ID', secret: 'NAVER_MAPS_CLIENT_SECRET' }
];

const ENDPOINTS = {
  openapi: (q) => ({
    hostname: 'openapi.naver.com',
    path: '/v1/search/blog.json?display=100&sort=date&query=' + encodeURIComponent(q),
    headers: (id, secret) => ({ 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret })
  }),
  apihub: (q) => ({
    hostname: 'naverapihub.apigw.ntruss.com',
    path: '/search/v1/blog?display=100&sort=date&query=' + encodeURIComponent(q),
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
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch (e) {
    return false;
  }
}

/** 만기수산셀프매장(칠곡 북삼) 관련 글만 남기고 최신순으로 정리 */
function filterPosts(items) {
  const seen = new Set();
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
      const relevant = text.includes(MUST_INCLUDE) && AREA_WORDS.some((word) => text.includes(word));
      if (relevant) seen.add(post.url);
      return relevant;
    })
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, MAX_ITEMS);
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

function configuredCredentials(env) {
  return CREDENTIALS
    .map((c) => ({ ...c, idValue: (env[c.id] || '').trim(), secretValue: (env[c.secret] || '').trim() }))
    .filter((c) => c.idValue && c.secretValue);
}

async function fetchPosts(env) {
  const creds = configuredCredentials(env);
  if (!creds.length) {
    const error = new Error('블로그 검색 API 키가 설정되지 않았습니다.');
    error.statusCode = 503;
    throw error;
  }
  const attempts = [];
  for (const cred of creds) {
    const endpoint = ENDPOINTS[cred.type](QUERY);
    try {
      const res = await requester({
        hostname: endpoint.hostname,
        path: endpoint.path,
        headers: { Accept: 'application/json', ...endpoint.headers(cred.idValue, cred.secretValue) }
      });
      if (res.status >= 200 && res.status < 300) {
        const data = JSON.parse(res.body);
        return { source: cred.type, items: filterPosts(data.items) };
      }
      attempts.push({ source: `${cred.type}(${cred.id})`, status: res.status });
    } catch (err) {
      attempts.push({ source: `${cred.type}(${cred.id})`, status: 0, message: String(err.message || err).slice(0, 120) });
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
  try {
    const result = await fetchPosts(process.env);
    // 1시간 동안 같은 결과를 재사용 (API 호출 한도 보호), 이후 하루까지는 이전 결과를 보여 주며 갱신
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ ok: true, source: result.source, query: QUERY, items: result.items });
  } catch (err) {
    res.setHeader('Cache-Control', 's-maxage=300');
    const body = { ok: false, error: err.message };
    if (err.statusCode === 503) body.expectedEnv = CREDENTIALS.map((c) => `${c.id} / ${c.secret}`);
    if (err.attempts) body.attempts = err.attempts; // 키 값은 포함하지 않음
    return res.status(err.statusCode || 500).json(body);
  }
}

module.exports = handler;
module.exports.cleanText = cleanText;
module.exports.filterPosts = filterPosts;
module.exports.fetchPosts = fetchPosts;
module.exports._setRequester = (fn) => { requester = fn || defaultRequester; };
