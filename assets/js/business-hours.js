/**
 * 영업 상태 계산 모듈
 * ------------------------------------------------------------------
 * - 기준 시간대: 대한민국 표준시(Asia/Seoul). 방문자 기기의 시간대와 무관하게 계산합니다.
 * - 화면(DOM)과 분리된 순수 함수만 모아 두었습니다. → Node 테스트(tests/)에서도 그대로 사용합니다.
 * - 브라우저에서는 window.BusinessHours 로, Node 에서는 require() 로 불러옵니다.
 *
 * 주간 영업시간(weeklySchedule) 형식
 *   {
 *     mon: { closed: true, reason: '정기휴무' },
 *     tue: { open: '16:00', close: '22:00', lastOrder: '21:00' },
 *     ...
 *   }
 *
 * 예외 일정(specialDays) 형식 — 공휴일·임시휴무 등 "확인된 경우에만" 입력
 *   [
 *     { date: '2026-12-31', closed: true, label: '임시휴무' },
 *     { date: '2027-01-01', open: '11:00', close: '20:00', lastOrder: '19:00', label: '신정 단축 영업' }
 *   ]
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.BusinessHours = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TIME_ZONE = 'Asia/Seoul';
  var WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
  var MAX_LOOKAHEAD_DAYS = 14;

  var STATUS = {
    PREPARING: 'preparing',
    OPEN: 'open',
    ORDER_CLOSED: 'order-closed',
    CLOSED: 'closed'
  };

  var STATUS_LABELS = {
    preparing: '영업 준비 중',
    open: '영업 중',
    'order-closed': '주문 마감',
    closed: '영업 종료'
  };

  /** 'HH:MM' → 자정 기준 분(minute) */
  function toMinutes(hhmm) {
    var match = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
    if (!match) return NaN;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function toDateKey(year, month, day) {
    return year + '-' + pad2(month) + '-' + pad2(day);
  }

  function parseDateKey(dateKey) {
    var parts = dateKey.split('-').map(Number);
    return { year: parts[0], month: parts[1], day: parts[2] };
  }

  /** 'YYYY-MM-DD' 의 요일 번호(0=일 … 6=토). 달력 계산이므로 시간대 영향을 받지 않습니다. */
  function weekdayOf(dateKey) {
    var d = parseDateKey(dateKey);
    return new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
  }

  function addDays(dateKey, days) {
    var d = parseDateKey(dateKey);
    var next = new Date(Date.UTC(d.year, d.month - 1, d.day + days));
    return toDateKey(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
  }

  /** 주어진 순간(Date)을 서울 기준 날짜·요일·분으로 변환 */
  function getZonedNow(date, timeZone) {
    var formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    });
    var parts = {};
    formatter.formatToParts(date).forEach(function (part) {
      parts[part.type] = part.value;
    });
    // 일부 구형 브라우저는 자정을 '24'로 표기하므로 보정
    var hour = Number(parts.hour) % 24;
    var dateKey = toDateKey(Number(parts.year), Number(parts.month), Number(parts.day));
    return {
      dateKey: dateKey,
      weekday: weekdayOf(dateKey),
      minutes: hour * 60 + Number(parts.minute)
    };
  }

  /** 특정 날짜의 영업 일정. 예외 일정이 있으면 정기 일정보다 우선합니다. */
  function getDaySchedule(dateKey, weeklySchedule, specialDays) {
    var weekday = weekdayOf(dateKey);
    var special = (specialDays || []).filter(function (item) {
      return item && item.date === dateKey;
    })[0];

    if (special) {
      if (special.closed) {
        return { closed: true, reason: special.label || '임시휴무', isSpecial: true, note: special.note || '' };
      }
      return {
        closed: false,
        open: special.open,
        close: special.close,
        lastOrder: special.lastOrder || special.close,
        isSpecial: true,
        label: special.label || '',
        note: special.note || ''
      };
    }

    var regular = weeklySchedule[WEEKDAY_KEYS[weekday]];
    if (!regular || regular.closed) {
      return { closed: true, reason: (regular && regular.reason) || '정기휴무', isSpecial: false };
    }
    return {
      closed: false,
      open: regular.open,
      close: regular.close,
      lastOrder: regular.lastOrder || regular.close,
      isSpecial: false
    };
  }

  /** 다음 영업 시작 시점 찾기 (offset: 오늘로부터 며칠 뒤인지) */
  function findNextOpening(fromDateKey, weeklySchedule, specialDays, startOffset) {
    for (var offset = startOffset; offset <= MAX_LOOKAHEAD_DAYS; offset++) {
      var dateKey = addDays(fromDateKey, offset);
      var schedule = getDaySchedule(dateKey, weeklySchedule, specialDays);
      if (!schedule.closed) {
        return { dateKey: dateKey, offset: offset, weekday: weekdayOf(dateKey), open: schedule.open };
      }
    }
    return null;
  }

  /** 다음 영업일 표시 문구: '오늘' / '내일(화)' / '화요일' / '12월 2일(화)' */
  function formatDayReference(opening) {
    var label = WEEKDAY_LABELS[opening.weekday];
    if (opening.offset === 0) return '오늘';
    if (opening.offset === 1) return '내일(' + label + ')';
    if (opening.offset < 7) return label + '요일';
    var d = parseDateKey(opening.dateKey);
    return d.month + '월 ' + d.day + '일(' + label + ')';
  }

  /**
   * 현재 영업 상태 계산
   * @param {Date} date 기준 시각 (보통 new Date())
   * @param {Object} weeklySchedule 주간 영업시간
   * @param {Array} [specialDays] 예외 일정
   * @returns {{status:string,label:string,message:string,today:Object,nextOpening:Object|null}}
   */
  function computeStatus(date, weeklySchedule, specialDays) {
    var now = getZonedNow(date);
    var today = getDaySchedule(now.dateKey, weeklySchedule, specialDays);
    var todayInfo = {
      dateKey: now.dateKey,
      weekday: now.weekday,
      weekdayKey: WEEKDAY_KEYS[now.weekday],
      weekdayLabel: WEEKDAY_LABELS[now.weekday],
      schedule: today
    };

    function closedResult(prefix) {
      var next = findNextOpening(now.dateKey, weeklySchedule, specialDays, 1);
      var message = prefix;
      if (next) message += ' · ' + formatDayReference(next) + ' ' + next.open + ' 오픈';
      return { status: STATUS.CLOSED, label: STATUS_LABELS.closed, message: message, today: todayInfo, nextOpening: next };
    }

    if (today.closed) {
      return closedResult('오늘은 ' + today.reason + '입니다');
    }

    var open = toMinutes(today.open);
    var close = toMinutes(today.close);
    var lastOrder = toMinutes(today.lastOrder);

    if (now.minutes < open) {
      return {
        status: STATUS.PREPARING,
        label: STATUS_LABELS.preparing,
        message: '오늘 ' + today.open + ' 오픈',
        today: todayInfo,
        nextOpening: { dateKey: now.dateKey, offset: 0, weekday: now.weekday, open: today.open }
      };
    }
    if (now.minutes < lastOrder) {
      return {
        status: STATUS.OPEN,
        label: STATUS_LABELS.open,
        message: '라스트오더 ' + today.lastOrder + ' · ' + today.close + '까지 영업',
        today: todayInfo,
        nextOpening: null
      };
    }
    if (now.minutes < close) {
      return {
        status: STATUS.ORDER_CLOSED,
        label: STATUS_LABELS['order-closed'],
        message: '라스트오더가 지났어요 · ' + today.close + ' 영업 종료',
        today: todayInfo,
        nextOpening: null
      };
    }
    return closedResult('오늘 영업이 끝났어요');
  }

  /** 오늘 운영 시간 한 줄 요약: '오늘(토) 11:00~22:00 · 라스트오더 21:00' */
  function describeToday(result) {
    var t = result.today;
    var prefix = '오늘(' + t.weekdayLabel + ') ';
    if (t.schedule.closed) return prefix + t.schedule.reason;
    var text = prefix + t.schedule.open + '~' + t.schedule.close + ' · 라스트오더 ' + t.schedule.lastOrder;
    if (t.schedule.isSpecial && t.schedule.label) text += ' (' + t.schedule.label + ')';
    return text;
  }

  /** 앞으로 N일 안의 예외 일정 (안내 배너용) */
  function getUpcomingSpecialDays(date, specialDays, withinDays) {
    var now = getZonedNow(date);
    var limit = addDays(now.dateKey, withinDays == null ? 14 : withinDays);
    return (specialDays || [])
      .filter(function (item) {
        return item && item.date >= now.dateKey && item.date <= limit;
      })
      .sort(function (a, b) {
        return a.date < b.date ? -1 : 1;
      });
  }

  function formatDateKey(dateKey) {
    var d = parseDateKey(dateKey);
    return d.month + '월 ' + d.day + '일(' + WEEKDAY_LABELS[weekdayOf(dateKey)] + ')';
  }

  return {
    TIME_ZONE: TIME_ZONE,
    STATUS: STATUS,
    STATUS_LABELS: STATUS_LABELS,
    WEEKDAY_KEYS: WEEKDAY_KEYS,
    WEEKDAY_LABELS: WEEKDAY_LABELS,
    toMinutes: toMinutes,
    addDays: addDays,
    weekdayOf: weekdayOf,
    getZonedNow: getZonedNow,
    getDaySchedule: getDaySchedule,
    computeStatus: computeStatus,
    describeToday: describeToday,
    getUpcomingSpecialDays: getUpcomingSpecialDays,
    formatDateKey: formatDateKey
  };
});
