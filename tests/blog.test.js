/**
 * 블로그 API 프록시 테스트 (실제 네이버 호출 없이 가짜 응답으로 확인)
 * 실행: node --test tests/*.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const blog = require('../api/blog.js');

const item = (over) => ({
  title: '<b>만기수산</b> 다녀왔어요',
  link: 'https://blog.naver.com/a/1',
  description: '칠곡 <b>북삼</b> 장어 맛집 &quot;만기수산&quot;',
  bloggername: '블로거A',
  postdate: '20261101',
  ...over
});

function fakeRes() {
  const res = { headers: {}, statusCode: 0, payload: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.payload = body; return res; };
  return res;
}

test('강조 태그와 엔티티를 지운다', () => {
  assert.equal(blog.cleanText('<b>만기수산</b> &amp; &quot;장어&quot; &#39;굿&#39;'), '만기수산 & "장어" \'굿\'');
});

test('제목·요약에 "만기수산"이 없으면 제외 (만기 적금·수산물 같은 엉뚱한 글)', () => {
  const posts = blog.filterPosts([
    item(),
    item({ link: 'https://blog.naver.com/b/2', title: '적금 만기 기념 북삼 수산시장', description: '칠곡 북삼 수산물' }),
    item({ link: 'https://blog.naver.com/c/3', title: '구미 장어 맛집', description: '북삼 만기 수산 셀프매장 후기', bloggername: '블로거C' })
  ]);
  assert.deepEqual(posts.map((p) => p.url), ['https://blog.naver.com/a/1', 'https://blog.naver.com/c/3']);
  assert.equal(posts[0].date, '2026-11-01');
  assert.equal(posts[0].summary, '칠곡 북삼 장어 맛집 "만기수산"');
});

test('중복·위험 링크 제거, 최신순 정렬', () => {
  const posts = blog.filterPosts([
    item({ postdate: '20260101', link: 'https://blog.naver.com/x/1', bloggername: '가' }),
    item({ postdate: '20261020', link: 'https://blog.naver.com/x/2', bloggername: '나' }),
    item({ postdate: '20261020', link: 'https://blog.naver.com/x/2', bloggername: '나' }),
    item({ link: 'javascript:alert(1)' })
  ]);
  assert.deepEqual(posts.map((p) => p.url), ['https://blog.naver.com/x/2', 'https://blog.naver.com/x/1']);
});

test('방문 후기만: 채용·부동산 글은 빼고, 후기 표현이 없는 글도 뺌', () => {
  const posts = blog.filterPosts([
    item({ link: 'https://blog.naver.com/r/1', title: '만기수산 홀서빙 알바 채용', description: '북삼 만기수산 직원 모집', bloggername: '사장' }),
    item({ link: 'https://blog.naver.com/r/2', title: '만기수산 앞 상가 임대', description: '북삼로 상가', bloggername: '부동산' }),
    item({ link: 'https://blog.naver.com/r/3', title: '만기수산', description: '북삼읍 북삼로', bloggername: '기록' }),
    item({ link: 'https://blog.naver.com/r/4', title: '북삼 만기수산 내돈내산 후기', description: '가족 외식', bloggername: '손님' })
  ]);
  assert.deepEqual(posts.map((p) => p.url), ['https://blog.naver.com/r/4']);
});

test('다양하게: 같은 블로거 글은 가장 최근 1개만', () => {
  const posts = blog.filterPosts([
    item({ link: 'https://blog.naver.com/s/1', postdate: '20260901', bloggername: '단골' }),
    item({ link: 'https://blog.naver.com/s/2', postdate: '20261101', bloggername: '단골' }),
    item({ link: 'https://blog.naver.com/s/3', postdate: '20261001', bloggername: '처음온손님' })
  ]);
  assert.deepEqual(posts.map((p) => p.url), ['https://blog.naver.com/s/2', 'https://blog.naver.com/s/3']);
});

test('키 이름이 달라도 NAVER ...ID / ...SECRET 짝을 찾아낸다', () => {
  const names = (env) => blog.findCredentials(env).map((c) => `${c.type}:${c.id}>${c.secret}`);
  assert.deepEqual(names({ NAVER_BLOG_ID: 'a', NAVER_BLOG_SECRET: 'b' }), ['openapi:NAVER_BLOG_ID>NAVER_BLOG_SECRET', 'apihub:NAVER_BLOG_ID>NAVER_BLOG_SECRET']);
  assert.deepEqual(names({ NAVER_SEARCH_API_CLIENTID: 'a', NAVER_SEARCH_API_CLIENT_SECRET: 'b' }).slice(0, 1), ['openapi:NAVER_SEARCH_API_CLIENTID>NAVER_SEARCH_API_CLIENT_SECRET']);
  // 표준 이름이 있으면 그것부터, 지도 키는 마지막(API HUB 로만)
  const order = names({ NAVER_MAPS_CLIENT_ID: 'm', NAVER_MAPS_CLIENT_SECRET: 'n', NAVER_CLIENT_ID: 'a', NAVER_CLIENT_SECRET: 'b' });
  assert.equal(order[0], 'openapi:NAVER_CLIENT_ID>NAVER_CLIENT_SECRET');
  assert.equal(order[order.length - 1], 'apihub:NAVER_MAPS_CLIENT_ID>NAVER_MAPS_CLIENT_SECRET');
  assert.equal(order.some((n) => n.startsWith('openapi:NAVER_MAPS')), false);
});

test('키가 없으면 503 과 NAVER 가 들어간 환경 변수 "이름"만 알려 줌', async () => {
  await assert.rejects(blog.fetchPosts({ NAVER_MAPS_CLIENT_ID: '', OTHER: 'x' }), (err) => {
    assert.equal(err.statusCode, 503);
    assert.deepEqual(err.configured, ['NAVER_MAPS_CLIENT_ID']);
    return true;
  });
});

test('세 가지 검색어로 찾아 합치고, 첫 키가 실패하면 다음 키로', async () => {
  const calls = [];
  blog._setRequester(async (opts) => {
    calls.push(opts.hostname + ' ' + decodeURIComponent(opts.path.split('query=')[1]));
    if (opts.hostname === 'openapi.naver.com') {
      return { status: 401, body: JSON.stringify({ errorCode: '024', errorMessage: 'Scope Status Invalid' }) };
    }
    if (opts.path.includes(encodeURIComponent('만기수산 칠곡'))) {
      return { status: 200, body: JSON.stringify({ items: [item({ link: 'https://blog.naver.com/z/9', postdate: '20261120', bloggername: '블로거Z' })] }) };
    }
    return { status: 200, body: JSON.stringify({ items: [item()] }) };
  });
  const result = await blog.fetchPosts({
    NAVER_CLIENT_ID: 'id1', NAVER_CLIENT_SECRET: 'secret1',
    NAVER_API_HUB_KEY_ID: 'id2', NAVER_API_HUB_KEY: 'secret2'
  });
  assert.deepEqual(calls, [
    'openapi.naver.com 만기수산 북삼',
    'naverapihub.apigw.ntruss.com 만기수산 북삼',
    'naverapihub.apigw.ntruss.com 만기수산 칠곡',
    'naverapihub.apigw.ntruss.com 만기수산셀프매장'
  ]);
  assert.equal(result.keyName, 'NAVER_API_HUB_KEY_ID');
  assert.deepEqual(result.items.map((p) => p.url), ['https://blog.naver.com/z/9', 'https://blog.naver.com/a/1']);
  blog._setRequester(null);
});

test('모든 키 실패 시 502, 네이버 오류 메시지는 보여 주되 키 값은 남기지 않음', async () => {
  blog._setRequester(async () => ({ status: 401, body: JSON.stringify({ errorCode: '024', errorMessage: 'Authentication failed' }) }));
  await assert.rejects(blog.fetchPosts({ NAVER_CLIENT_ID: 'abc', NAVER_CLIENT_SECRET: 'def' }), (err) => {
    assert.equal(err.statusCode, 502);
    assert.match(err.attempts[0].message, /024 Authentication failed/);
    assert.equal(JSON.stringify(err.attempts).includes('def'), false);
    assert.equal(JSON.stringify(err.attempts).includes('abc'), false);
    return true;
  });
  blog._setRequester(null);
});

test('핸들러: 평소에는 캐시, ?check=1 이면 진단 정보 + 캐시 안 함', async () => {
  blog._setRequester(async () => ({ status: 200, body: JSON.stringify({ items: [item()] }) }));
  process.env.NAVER_CLIENT_ID = 'x';
  process.env.NAVER_CLIENT_SECRET = 'y';

  const normal = fakeRes();
  await blog({ method: 'GET', query: {} }, normal);
  assert.equal(normal.statusCode, 200);
  assert.match(normal.headers['Cache-Control'], /s-maxage=3600/);
  assert.equal(normal.payload.queries, undefined);

  const check = fakeRes();
  await blog({ method: 'GET', query: { check: '1' } }, check);
  assert.equal(check.headers['Cache-Control'], 'no-store');
  assert.equal(check.payload.keyName, 'NAVER_CLIENT_ID');
  assert.equal(check.payload.queries.length, 3);
  assert.equal(JSON.stringify(check.payload).includes('"y"'), false);

  delete process.env.NAVER_CLIENT_ID;
  delete process.env.NAVER_CLIENT_SECRET;
  blog._setRequester(null);
});
