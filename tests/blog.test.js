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

test('강조 태그와 엔티티를 지운다', () => {
  assert.equal(blog.cleanText('<b>만기수산</b> &amp; &quot;장어&quot; &#39;굿&#39;'), '만기수산 & "장어" \'굿\'');
});

test('지역명이 없는 동명 업체 글은 제외', () => {
  const posts = blog.filterPosts([
    item(),
    item({ link: 'https://blog.naver.com/b/2', title: '부산 만기수산 횟집', description: '부산 해운대 횟집' }),
    item({ link: 'https://blog.naver.com/c/3', title: '장어 먹방', description: '구미 장어집' })
  ]);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, 'https://blog.naver.com/a/1');
  assert.equal(posts[0].date, '2026-11-01');
  assert.equal(posts[0].summary, '칠곡 북삼 장어 맛집 "만기수산"');
});

test('띄어쓰기가 달라도 인식 ("만기 수산", "셀프 매장")', () => {
  const posts = blog.filterPosts([item({ title: '만기 수산 셀프 매장 후기', description: '장어' })]);
  assert.equal(posts.length, 1);
});

test('중복·위험 링크 제거, 최신순 정렬', () => {
  const posts = blog.filterPosts([
    item({ postdate: '20260101', link: 'https://blog.naver.com/x/1' }),
    item({ postdate: '20261020', link: 'https://blog.naver.com/x/2' }),
    item({ postdate: '20261020', link: 'https://blog.naver.com/x/2' }),
    item({ link: 'javascript:alert(1)' })
  ]);
  assert.deepEqual(posts.map((p) => p.url), ['https://blog.naver.com/x/2', 'https://blog.naver.com/x/1']);
});

test('키가 없으면 503 과 필요한 환경 변수 이름만 알려 줌', async () => {
  await assert.rejects(blog.fetchPosts({}), (err) => err.statusCode === 503);
});

test('첫 번째 키가 실패하면 다음 키로 시도, 키 값은 응답에 남기지 않음', async () => {
  const calls = [];
  blog._setRequester(async (opts) => {
    calls.push(opts.hostname);
    if (opts.hostname === 'openapi.naver.com') return { status: 401, body: '{}' };
    return { status: 200, body: JSON.stringify({ items: [item()] }) };
  });
  const result = await blog.fetchPosts({
    NAVER_CLIENT_ID: 'id1', NAVER_CLIENT_SECRET: 'secret1',
    NAVER_API_HUB_KEY_ID: 'id2', NAVER_API_HUB_KEY: 'secret2'
  });
  assert.deepEqual(calls, ['openapi.naver.com', 'naverapihub.apigw.ntruss.com']);
  assert.equal(result.source, 'apihub');
  assert.equal(result.items.length, 1);
  blog._setRequester(null);
});

test('모든 키가 실패하면 502 와 시도 기록(키 값 제외)', async () => {
  blog._setRequester(async () => ({ status: 401, body: '{}' }));
  await assert.rejects(blog.fetchPosts({ NAVER_CLIENT_ID: 'abc', NAVER_CLIENT_SECRET: 'def' }), (err) => {
    assert.equal(err.statusCode, 502);
    assert.equal(JSON.stringify(err.attempts).includes('def'), false);
    return true;
  });
  blog._setRequester(null);
});

test('핸들러: 성공 시 캐시 헤더와 결과', async () => {
  blog._setRequester(async () => ({ status: 200, body: JSON.stringify({ items: [item()] }) }));
  process.env.NAVER_CLIENT_ID = 'x';
  process.env.NAVER_CLIENT_SECRET = 'y';
  const headers = {};
  let statusCode = 0;
  let payload = null;
  const res = {
    setHeader: (k, v) => { headers[k] = v; },
    status(code) { statusCode = code; return this; },
    json(body) { payload = body; return this; }
  };
  await blog({ method: 'GET' }, res);
  assert.equal(statusCode, 200);
  assert.equal(payload.ok, true);
  assert.match(headers['Cache-Control'], /s-maxage=3600/);
  delete process.env.NAVER_CLIENT_ID;
  delete process.env.NAVER_CLIENT_SECRET;
  blog._setRequester(null);
});
