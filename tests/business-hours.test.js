/**
 * 영업 상태 계산 테스트
 * 실행: node --test tests/*.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const BH = require('../assets/js/business-hours.js');

// index.html 영업시간 표와 동일한 정기 일정
const WEEKLY = {
  mon: { closed: true, reason: '정기휴무' },
  tue: { open: '16:00', close: '22:00', lastOrder: '21:00' },
  wed: { open: '16:00', close: '22:00', lastOrder: '21:00' },
  thu: { open: '16:00', close: '22:00', lastOrder: '21:00' },
  fri: { open: '16:00', close: '22:00', lastOrder: '21:00' },
  sat: { open: '11:00', close: '22:00', lastOrder: '21:00' },
  sun: { open: '11:00', close: '22:00', lastOrder: '21:00' }
};

const seoul = (isoLocal) => new Date(`${isoLocal}+09:00`);
const statusAt = (isoLocal, special) => BH.computeStatus(seoul(isoLocal), WEEKLY, special);

test('요일 계산: 2026-11-24 는 화요일', () => {
  assert.equal(BH.weekdayOf('2026-11-24'), 2);
  assert.equal(BH.weekdayOf('2026-11-23'), 1);
});

test('평일(화) 오픈 전 → 영업 준비 중', () => {
  const r = statusAt('2026-11-24T15:59:00');
  assert.equal(r.status, 'preparing');
  assert.equal(r.label, '영업 준비 중');
  assert.match(r.message, /오늘 16:00 오픈/);
});

test('평일(화) 16:00 정각 → 영업 중', () => {
  assert.equal(statusAt('2026-11-24T16:00:00').status, 'open');
});

test('20:59 → 영업 중, 21:00 → 주문 마감', () => {
  assert.equal(statusAt('2026-11-24T20:59:00').status, 'open');
  const r = statusAt('2026-11-24T21:00:00');
  assert.equal(r.status, 'order-closed');
  assert.equal(r.label, '주문 마감');
});

test('22:00 이후 → 영업 종료, 다음 영업일 안내', () => {
  const r = statusAt('2026-11-24T22:00:00');
  assert.equal(r.status, 'closed');
  assert.match(r.message, /내일\(수\) 16:00 오픈/);
});

test('토요일 오전 → 11시 오픈 기준 적용', () => {
  assert.equal(statusAt('2026-11-21T10:30:00').status, 'preparing');
  assert.equal(statusAt('2026-11-21T11:00:00').status, 'open');
});

test('월요일 정기휴무 → 하루 종일 영업 종료', () => {
  for (const t of ['00:30', '12:00', '18:00', '23:30']) {
    const r = statusAt(`2026-11-23T${t}:00`);
    assert.equal(r.status, 'closed');
    assert.match(r.message, /오늘은 정기휴무입니다/);
    assert.match(r.message, /내일\(화\) 16:00 오픈/);
  }
});

test('일요일 마감 후 → 월요일을 건너뛰고 화요일 안내', () => {
  const r = statusAt('2026-11-22T22:30:00');
  assert.equal(r.status, 'closed');
  assert.match(r.message, /화요일 16:00 오픈/);
});

test('자정 직후(화 00:10) → 오늘 16:00 오픈 준비 중', () => {
  const r = statusAt('2026-11-25T00:10:00');
  assert.equal(r.status, 'preparing');
});

test('방문자 기기 시간대와 무관하게 서울 기준으로 판단', () => {
  // 같은 순간을 UTC 로 표현: 서울 2026-11-24 16:30 = UTC 07:30
  const r = BH.computeStatus(new Date('2026-11-24T07:30:00Z'), WEEKLY);
  assert.equal(r.status, 'open');
  assert.equal(r.today.weekdayKey, 'tue');
});

test('예외 일정: 임시휴무가 정기 일정보다 우선', () => {
  const special = [{ date: '2026-11-24', closed: true, label: '임시휴무' }];
  const r = statusAt('2026-11-24T18:00:00', special);
  assert.equal(r.status, 'closed');
  assert.match(r.message, /오늘은 임시휴무입니다/);
});

test('예외 일정: 정기휴무일(월) 특별 영업', () => {
  const special = [{ date: '2026-11-23', open: '11:00', close: '20:00', lastOrder: '19:00', label: '특별 영업' }];
  assert.equal(statusAt('2026-11-23T12:00:00', special).status, 'open');
  assert.equal(statusAt('2026-11-23T19:30:00', special).status, 'order-closed');
});

test('예외 일정이 없으면 정기 일정만 사용', () => {
  assert.deepEqual(BH.getUpcomingSpecialDays(seoul('2026-11-24T12:00:00'), []), []);
});

test('오늘 요약 문구', () => {
  assert.equal(BH.describeToday(statusAt('2026-11-21T12:00:00')), '오늘(토) 11:00~22:00 · 라스트오더 21:00');
  assert.equal(BH.describeToday(statusAt('2026-11-23T12:00:00')), '오늘(월) 정기휴무');
});
