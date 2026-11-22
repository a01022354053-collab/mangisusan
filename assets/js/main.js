/* ==========================================================================
 * 만기수산셀프매장 — 화면 동작
 * --------------------------------------------------------------------------
 * 구성 (각 기능은 따로 실행되며, 하나가 실패해도 나머지는 동작합니다)
 *   initBusinessStatus  오늘 날짜 · 현재 영업 상태 · 오늘 요일 강조 · 예외 일정 공지
 *   initNavigation      섹션 바로가기 현재 위치 표시
 *   initCallFab         떠 있는 전화 버튼 (첫 화면 전화 버튼이 보이는 동안 숨김)
 *   initDialogs         길찾기 선택 창 · 닫기
 *   initCopyButtons     주소·전화번호 복사
 *   renderMenu          메뉴판 (site-data.js → menu, 대표 가격은 맨 위에 크게)
 *   renderEvents        이벤트 (site-data.js → events, 진행 중인 것만)
 *   renderIntro         장어 소개·사장님 인사말 (내용이 있을 때만)
 *   renderSelfbar       반찬 셀프바
 *   renderGuide         이용 방법 (site-data.js → guide)
 *   renderGallery       매장 사진 + 크게 보기 (site-data.js → gallery)
 *   initMap             네이버 지도 (site-data.js → map, 좌표는 /api/geocode)
 *   initReviews         리뷰 버튼 + 블로그 후기 (/api/blog)
 *   initReveal          스크롤 등장 효과 (위에서 차례로 떨어지기, 메뉴판은 '쿵')
 *   initEmbers          메뉴판 아래 숯불 불티
 *   injectStructuredData 검색엔진용 매장 정보(JSON-LD)
 * ========================================================================== */
(function () {
  'use strict';

  var DATA = window.SITE_DATA || {};
  var BH = window.BusinessHours;
  var PHONE = '054-976-8892';
  var NAVER_MAP_KEY_ID = 'nxqvyoh8f9'; // 네이버 지도 Client ID (등록한 도메인에서만 작동하므로 공개돼도 안전)

  /* ---------- 공통 도우미 ---------- */

  /** DOM 요소 생성 (innerHTML 을 쓰지 않아 외부 글에 HTML 이 섞여도 안전) */
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'className') el.className = value;
        else if (key === 'text') el.textContent = value;
        else if (key.indexOf('on') === 0 && typeof value === 'function') el.addEventListener(key.slice(2), value);
        else el.setAttribute(key, value === true ? '' : value);
      });
    }
    (Array.isArray(children) ? children : children != null ? [children] : []).forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return el;
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  function icon(name, extraClass) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon' + (extraClass ? ' ' + extraClass : ''));
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }

  /** 요소 내용 교체 (구형 브라우저 호환) */
  function setContent(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    for (var i = 1; i < arguments.length; i++) {
      var node = arguments[i];
      if (Array.isArray(node)) node.forEach(function (n) { if (n) el.appendChild(n); });
      else if (node) el.appendChild(node);
    }
  }

  function isSafeUrl(url) {
    return typeof url === 'string' && /^(https:\/\/|assets\/|\/assets\/)/.test(url);
  }

  function safely(name, fn) {
    try {
      fn();
    } catch (error) {
      if (window.console) console.error('[만기수산] ' + name + ' 실행 중 오류', error);
    }
  }

  /** 화면에 가까워지면 한 번 실행 (지도·블로그처럼 무거운 기능을 늦게 불러올 때) */
  function whenNear(el, fn) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      fn();
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) {
        observer.disconnect();
        fn();
      }
    }, { rootMargin: '600px 0px' });
    observer.observe(el);
  }

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var toastTimer = null;
  function showToast(message) {
    var toast = document.querySelector('[data-toast]');
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 2400);
  }

  /* ======================================================================
   * 영업시간 · 오늘 날짜 · 현재 영업 상태
   * ==================================================================== */

  /** index.html 영업시간 표의 data 속성으로 주간 일정 생성 (표 = 유일한 원본) */
  function readWeeklySchedule() {
    var rows = document.querySelectorAll('#hours-table tbody tr[data-days]');
    var schedule = {};
    Array.prototype.forEach.call(rows, function (row) {
      var days = row.getAttribute('data-days').split(/\s+/).filter(Boolean);
      var entry;
      if (row.hasAttribute('data-closed')) {
        entry = { closed: true, reason: '정기휴무' };
      } else {
        entry = {
          open: row.getAttribute('data-open'),
          close: row.getAttribute('data-close'),
          lastOrder: row.getAttribute('data-last-order')
        };
        // 화면 글자와 data 값이 다르면 개발자 도구에 경고 (수정 실수 방지)
        var text = row.textContent;
        if (text.indexOf(entry.open) === -1 || text.indexOf(entry.close) === -1) {
          console.warn('[만기수산] 영업시간 표의 글자와 data 값이 다릅니다:', days.join(','));
        }
      }
      days.forEach(function (day) { schedule[day] = entry; });
    });
    return schedule;
  }

  function initBusinessStatus() {
    if (!BH) return;
    var schedule = readWeeklySchedule();
    if (Object.keys(schedule).length !== 7) {
      console.warn('[만기수산] 영업시간 표에 7개 요일이 모두 있어야 합니다.');
      return;
    }

    var specialDays = Array.isArray(DATA.specialDays) ? DATA.specialDays : [];
    var statusBox = document.querySelector('[data-status]');
    var badges = document.querySelectorAll('[data-status-badge]');
    var messageEl = document.querySelector('[data-status-message]');
    var todayEl = document.querySelector('[data-status-today]');
    var dateEl = document.querySelector('[data-today-date]');
    var noticeEl = document.querySelector('[data-special-notice]');
    var lastKey = '';

    function update() {
      var now = new Date();
      var result = BH.computeStatus(now, schedule, specialDays);
      var key = result.status + '|' + result.message + '|' + result.today.dateKey;
      if (key === lastKey) return; // 바뀐 것이 없으면 다시 그리지 않음 (화면낭독기 반복 방지)
      lastKey = key;

      Array.prototype.forEach.call(badges, function (badge) {
        badge.setAttribute('data-state', result.status);
        var label = badge.querySelector('[data-status-label]');
        if (label) label.textContent = result.label;
        badge.hidden = false;
      });
      if (dateEl) dateEl.textContent = BH.formatTodayLabel(now);
      if (messageEl) messageEl.textContent = result.message;
      if (todayEl) todayEl.textContent = BH.describeToday(result);
      if (statusBox) statusBox.hidden = false;

      highlightToday(result.today.weekdayKey);
      renderSpecialNotice(noticeEl, specialDays);
    }

    update();
    setInterval(update, 30 * 1000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) update();
    });
  }

  function highlightToday(weekdayKey) {
    var rows = document.querySelectorAll('#hours-table tbody tr[data-days]');
    Array.prototype.forEach.call(rows, function (row) {
      var isToday = row.getAttribute('data-days').split(/\s+/).indexOf(weekdayKey) !== -1;
      row.classList.toggle('is-today', isToday);
      var th = row.querySelector('th');
      var pill = th && th.querySelector('.today-pill');
      if (isToday) {
        row.setAttribute('aria-current', 'date');
        if (th && !pill) th.appendChild(h('span', { className: 'today-pill', text: '오늘' }));
      } else {
        row.removeAttribute('aria-current');
        if (pill) pill.parentNode.removeChild(pill);
      }
    });
  }

  function renderSpecialNotice(el, specialDays) {
    if (!el || !BH) return;
    var upcoming = BH.getUpcomingSpecialDays(new Date(), specialDays, 14);
    if (!upcoming.length) {
      el.hidden = true;
      return;
    }
    el.textContent = '안내: ' + upcoming.map(function (item) {
      return BH.formatDateKey(item.date) + ' ' +
        (item.closed ? (item.label || '임시휴무') : (item.label || '특별 영업') + ' ' + item.open + '~' + item.close);
    }).join(' · ');
    el.hidden = false;
  }

  /* ======================================================================
   * 섹션 바로가기 — 현재 보고 있는 섹션 표시
   * ==================================================================== */
  function initNavigation() {
    // PC 위쪽 바로가기와 휴대폰 하단 탭바 모두에 현재 위치 표시
    var lists = Array.prototype.slice.call(document.querySelectorAll('[data-nav-list]'));
    if (!lists.length || !('IntersectionObserver' in window)) return;
    var links = [];
    lists.forEach(function (list) {
      Array.prototype.forEach.call(list.querySelectorAll('a[href^="#"]'), function (link) { links.push(link); });
    });
    var sections = [];
    links.forEach(function (link) {
      var section = document.querySelector(link.getAttribute('href'));
      if (section && sections.indexOf(section) === -1) sections.push(section);
    });
    var current = null;

    function setActive(id) {
      if (id === current) return;
      current = id;
      links.forEach(function (link) {
        if (link.getAttribute('href') === '#' + id) {
          link.setAttribute('aria-current', 'true');
          var list = link.closest('[data-nav-list]');
          if (list && list.scrollWidth > list.clientWidth + 2) { // 가로로 넘치는 목록이면 현재 항목이 보이게
            var left = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
            list.scrollTo({ left: Math.max(0, left), behavior: reducedMotion ? 'auto' : 'smooth' });
          }
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }

    var visible = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { visible[entry.target.id] = entry.isIntersecting; });
      var section = sections.filter(function (s) { return visible[s.id]; })[0];
      if (section) setActive(section.id);
      else {
        current = null;
        links.forEach(function (link) { link.removeAttribute('aria-current'); });
      }
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (section) { observer.observe(section); });
  }

  /* ======================================================================
   * 떠 있는 전화 버튼 — 첫 화면의 전화 버튼이 보이는 동안은 숨김 (같은 버튼이 두 개 보이지 않게)
   * ==================================================================== */
  function initCallFab() {
    var fab = document.querySelector('[data-call-fab]');
    var heroActions = document.getElementById('hero-actions');
    if (!fab || !heroActions || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      fab.classList.toggle('is-hidden', entries[0].isIntersecting);
    }).observe(heroActions);
  }

  /* ======================================================================
   * 대화상자 (길찾기 선택 · 사진 크게 보기)
   * ==================================================================== */
  function openDialog(dialog) {
    if (!dialog || typeof dialog.showModal !== 'function') return false;
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add('has-dialog');
    return true;
  }

  function initDialogs() {
    Array.prototype.forEach.call(document.querySelectorAll('dialog'), function (dialog) {
      dialog.addEventListener('close', function () {
        document.documentElement.classList.remove('has-dialog');
      });
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) dialog.close(); // 바깥(어두운 영역) 누르면 닫기
      });
      Array.prototype.forEach.call(dialog.querySelectorAll('[data-close-dialog]'), function (button) {
        button.addEventListener('click', function () { dialog.close(); });
      });
    });

    var directions = document.getElementById('directions-dialog');
    Array.prototype.forEach.call(document.querySelectorAll('[data-open-directions]'), function (trigger) {
      trigger.addEventListener('click', function (event) {
        // 대화상자를 지원하지 않는 브라우저는 링크 기본 동작(#location 이동) 사용
        if (openDialog(directions)) event.preventDefault();
      });
    });

    var placeUrl = DATA.map && DATA.map.naverPlaceUrl;
    if (isSafeUrl(placeUrl)) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-naver-place-link]'), function (link) {
        link.href = placeUrl;
      });
    }
  }

  /* ======================================================================
   * 복사 버튼
   * ==================================================================== */
  function legacyCopy(text) {
    var area = h('textarea', { readonly: true, 'aria-hidden': 'true', style: 'position:fixed;top:-1000px;opacity:0' });
    area.value = text;
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(area);
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function initCopyButtons() {
    document.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('[data-copy]');
      if (!button) return;
      var text = button.getAttribute('data-copy');
      copyText(text).then(function (ok) {
        showToast(ok ? (button.getAttribute('data-copy-done') || '복사했습니다.') : '복사하지 못했습니다. 길게 눌러 직접 복사해 주세요: ' + text);
      });
    });
  }

  /* ======================================================================
   * 가격 표시 공통
   * ==================================================================== */
  var priceFormatter = window.Intl ? new Intl.NumberFormat('ko-KR') : null;

  function won(amount) {
    return (priceFormatter ? priceFormatter.format(amount) : String(amount)) + '원';
  }

  function formatPrice(option) {
    if (option.amountText) return option.amountText;
    if (typeof option.amount === 'number') return won(option.amount);
    return null; // 확인 후 입력
  }

  /** 가격 + (할인 전 가격에 줄) */
  function priceSpan(option) {
    var formatted = formatPrice(option);
    if (!formatted) return h('span', { className: 'menu-row__price menu-row__price--pending', text: '가격 확인 중' });
    var was = typeof option.originalAmount === 'number' && option.originalAmount > option.amount;
    return h('span', { className: 'menu-row__price' }, [
      was ? h('s', { className: 'menu-row__was' }, [h('span', { className: 'visually-hidden', text: '할인 전 ' }), won(option.originalAmount)]) : null,
      was ? h('span', { className: 'visually-hidden', text: ', 할인 가격 ' }) : null,
      formatted
    ]);
  }

  /* ======================================================================
   * 사진 크게 보기 (매장 사진·이벤트 포스터 공용)
   *   openLightbox([{ src, alt, caption, isSample }], 시작 번호)
   * ==================================================================== */
  var lightboxState = { items: [], index: 0, img: null };

  function showLightboxItem(index) {
    var lightbox = document.getElementById('lightbox');
    var caption = lightbox && lightbox.querySelector('[data-lightbox-caption]');
    var items = lightboxState.items;
    if (!caption || !items.length) return;
    if (!lightboxState.img) {
      lightboxState.img = h('img', { className: 'lightbox__img', alt: '' });
      caption.parentNode.insertBefore(lightboxState.img, caption);
    }
    lightboxState.index = (index + items.length) % items.length;
    var item = items[lightboxState.index];
    var img = lightboxState.img;
    img.classList.remove('is-shown');
    img.onload = function () { img.classList.add('is-shown'); }; // 사진이 바뀔 때 부드럽게 나타남
    img.src = item.src;
    img.alt = item.alt || '';
    if (img.complete) img.classList.add('is-shown');
    var text = (item.caption || '') + (items.length > 1 ? '  ' + (lightboxState.index + 1) + ' / ' + items.length : '');
    caption.textContent = (item.isSample ? '[예시 이미지] ' : '') + text.trim();
    var single = items.length < 2;
    lightbox.querySelector('[data-lightbox-prev]').hidden = single;
    lightbox.querySelector('[data-lightbox-next]').hidden = single;
  }

  function openLightbox(items, index) {
    var lightbox = document.getElementById('lightbox');
    if (!lightbox || typeof lightbox.showModal !== 'function') {
      window.open(items[index].src, '_blank', 'noopener');
      return;
    }
    lightboxState.items = items;
    showLightboxItem(index);
    openDialog(lightbox);
  }

  function initLightbox() {
    var lightbox = document.getElementById('lightbox');
    if (!lightbox) return;
    lightbox.querySelector('[data-lightbox-prev]').addEventListener('click', function () { showLightboxItem(lightboxState.index - 1); });
    lightbox.querySelector('[data-lightbox-next]').addEventListener('click', function () { showLightboxItem(lightboxState.index + 1); });
    lightbox.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') showLightboxItem(lightboxState.index - 1);
      if (event.key === 'ArrowRight') showLightboxItem(lightboxState.index + 1);
    });
    var startX = null;
    lightbox.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    lightbox.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) showLightboxItem(lightboxState.index + (dx < 0 ? 1 : -1));
      startX = null;
    });
  }

  /* ======================================================================
   * 메뉴판 — 대표 가격(장어 100g당)을 맨 위에 크게
   * ==================================================================== */
  function defaultOptionLabel(item) {
    if (item.priceType === 'weight') return '중량별';
    if (item.priceType === 'per-person') return '1인';
    return null;
  }

  function renderMenuItem(item) {
    var options = Array.isArray(item.options) && item.options.length ? item.options : [{ label: null, amount: null }];
    var nameEl = h('span', { className: 'menu-row__name' }, [
      item.name,
      item.soldOut ? h('span', { className: 'menu-row__badge', text: '품절' }) : null
    ]);
    // '할인 세트' 같은 표시와 설명은 이름 아래 줄에 (휴대폰에서 이름이 밀리지 않게)
    var desc = item.badge || item.description ? h('p', { className: 'menu-row__desc' }, [
      item.badge ? h('span', { className: 'menu-row__tag', text: item.badge }) : null,
      item.description || null
    ]) : null;

    // 가격이 하나면 이름 옆에 바로, 여러 개(현금가·카드가 등)면 아래에 줄마다 표시
    if (options.length === 1) {
      var label = options[0].label || defaultOptionLabel(item);
      return h('li', { className: 'menu-row' }, [
        h('div', { className: 'menu-row__line' }, [
          nameEl,
          label ? h('span', { className: 'menu-row__label', text: '(' + label + ')' }) : null,
          h('span', { className: 'menu-row__dots', 'aria-hidden': 'true' }),
          priceSpan(options[0])
        ]),
        desc
      ]);
    }
    return h('li', { className: 'menu-row' }, [
      h('div', { className: 'menu-row__line' }, nameEl),
      desc,
      h('ul', { className: 'menu-options' }, options.map(function (option) {
        return h('li', { className: 'menu-row__line' }, [
          h('span', { className: 'menu-row__label', text: option.label || '' }),
          h('span', { className: 'menu-row__dots', 'aria-hidden': 'true' }),
          priceSpan(option)
        ]);
      }))
    ]);
  }

  function hasAnyPrice(categories) {
    return categories.some(function (category) {
      return (category.items || []).some(function (item) {
        return (item.options || []).some(function (option) { return formatPrice(option) !== null; });
      });
    });
  }

  /** 대표 가격 띠: '민물장어 100g당 9,500원' */
  function renderMenuHighlight(item) {
    var option = (item.options || [])[0] || {};
    var price = formatPrice(option);
    return h('div', { className: 'menu-hero' }, [
      h('p', { className: 'menu-hero__name', text: item.name }),
      h('p', { className: 'menu-hero__price' }, [
        option.label ? h('span', { className: 'menu-hero__unit', text: option.label }) : null,
        h('strong', { className: 'menu-hero__amount', text: price || '가격 확인 중' })
      ]),
      item.description ? h('p', { className: 'menu-hero__desc', text: item.description }) : null
    ]);
  }

  function renderMenu() {
    var root = document.querySelector('[data-menu-root]');
    var menu = DATA.menu;
    if (!root || !menu || !Array.isArray(menu.categories) || !menu.categories.length) return;

    var head = h('div', { className: 'menu-board__head' }, [
      h('img', { className: 'menu-board__seal', src: 'assets/img/logo-seal.webp', width: '304', height: '351', alt: '', loading: 'lazy' }),
      h('p', { className: 'menu-board__title', text: '만기수산 차림표' })
    ]);

    var notice = hasAnyPrice(menu.categories) ? null : h('p', { className: 'menu-board__notice' }, [
      '메뉴판을 정리하고 있습니다. 정확한 가격은 ',
      h('a', { href: 'tel:' + PHONE, text: PHONE }),
      '로 문의해 주세요.'
    ]);

    // 대표 가격(highlight)은 위쪽 띠로, 나머지는 분류별 차림표로
    var highlights = [];
    var categories = menu.categories.map(function (category) {
      var items = (category.items || []).filter(function (item) {
        if (item.highlight) { highlights.push(item); return false; }
        return true;
      });
      return { label: category.label, note: category.note, items: items, hadHighlight: items.length !== (category.items || []).length };
    });

    var filled = categories.filter(function (c) { return c.items.length; });
    var empty = categories.filter(function (c) { return !c.items.length && !c.hadHighlight; });
    var blocks = filled.map(function (category) {
      return h('section', { className: 'menu-cat', 'aria-label': category.label }, [
        h('h3', { className: 'menu-cat__title', text: category.label }),
        category.note ? h('p', { className: 'menu-cat__note', text: category.note }) : null,
        h('ul', { className: 'menu-list' }, category.items.map(renderMenuItem))
      ]);
    });
    if (empty.length) {
      blocks.push(h('section', { className: 'menu-cat menu-soon', 'aria-label': '가격 확인 중인 메뉴' }, [
        h('h3', { className: 'menu-cat__title', text: '가격 확인 중' }),
        h('ul', { className: 'chip-list menu-soon__list' }, empty.map(function (c) {
          return h('li', { className: 'chip', text: c.label });
        })),
        h('p', { className: 'menu-cat__note', text: '확인되는 대로 올려 드릴게요. 궁금하시면 전화로 문의해 주세요.' })
      ]));
    }
    var cats = h('div', { className: 'menu-cats' }, blocks);

    var updated = menu.lastUpdated && BH
      ? h('p', { className: 'menu-updated', text: '가격 기준일: ' + menu.lastUpdated.slice(0, 4) + '년 ' + BH.formatDateKey(menu.lastUpdated) })
      : null;

    setContent(root, head, notice, highlights.map(renderMenuHighlight), cats, updated);
  }

  /* ======================================================================
   * 이벤트 — 진행 중인 것만 (active, startsAt~endsAt)
   * ==================================================================== */
  function eventIsLive(event) {
    if (!event || event.active === false) return false;
    if (!BH || (!event.startsAt && !event.endsAt)) return true;
    var today = BH.getZonedNow(new Date()).dateKey;
    if (event.startsAt && today < event.startsAt) return false;
    if (event.endsAt && today > event.endsAt) return false;
    return true;
  }

  function eventPeriod(event) {
    if (!BH || (!event.startsAt && !event.endsAt)) return null;
    var from = event.startsAt ? BH.formatDateKey(event.startsAt) : '';
    var to = event.endsAt ? BH.formatDateKey(event.endsAt) : '';
    return '기간: ' + from + (from || to ? ' ~ ' : '') + to;
  }

  function eventPoster(event, onOpen) {
    if (!isSafeUrl(event.image)) return null;
    return h('button', {
      type: 'button',
      className: 'event-poster',
      'aria-label': (event.alt || event.title) + ' — 포스터 크게 보기',
      onclick: onOpen
    }, [
      h('img', { src: event.image, alt: '', loading: 'lazy', decoding: 'async' }),
      h('span', { className: 'event-poster__zoom', 'aria-hidden': 'true' }, icon('zoom'))
    ]);
  }

  function eventPrice(event) {
    if (Array.isArray(event.prices) && event.prices.length) {
      return h('ul', { className: 'event-prices' }, event.prices.map(function (p, i) {
        return h('li', { className: 'event-prices__row' + (i === 0 ? ' is-best' : '') }, [
          h('span', { className: 'event-prices__label', text: p.label }),
          h('strong', { text: won(p.amount) })
        ]);
      }));
    }
    if (typeof event.price !== 'number') return null;
    var hasDiscount = typeof event.originalPrice === 'number' && event.originalPrice > event.price;
    return h('div', { className: 'event-price' }, [
      hasDiscount ? h('s', { className: 'event-price__was' }, [h('span', { className: 'visually-hidden', text: '할인 전 ' }), won(event.originalPrice)]) : null,
      h('strong', { className: 'event-price__now' }, [hasDiscount ? h('span', { className: 'visually-hidden', text: '할인 가격 ' }) : null, won(event.price)]),
      hasDiscount ? h('span', { className: 'event-price__save', text: won(event.originalPrice - event.price) + ' 할인' }) : null
    ]);
  }

  function renderEvents() {
    var root = document.querySelector('[data-events-root]');
    var section = document.getElementById('events');
    var events = (DATA.events || []).filter(eventIsLive);
    if (!root) return;
    if (!events.length) {
      // 진행 중인 이벤트가 하나도 없으면 섹션과 바로가기를 숨김
      if (section) section.hidden = true;
      Array.prototype.forEach.call(document.querySelectorAll('a[href="#events"]'), function (a) {
        var li = a.closest('li');
        if (li) li.hidden = true;
      });
      return;
    }

    var posters = events.filter(function (e) { return isSafeUrl(e.imageLarge || e.image); }).map(function (e) {
      return { src: e.imageLarge || e.image, alt: e.alt || e.title, caption: e.title };
    });
    function opener(event) {
      return function () {
        var index = 0;
        posters.forEach(function (p, i) { if (p.caption === event.title) index = i; });
        openLightbox(posters, index);
      };
    }

    var features = events.filter(function (e) { return e.kind === 'feature'; });
    var deals = events.filter(function (e) { return e.kind !== 'feature'; });

    var featureEls = features.map(function (event) {
      return h('article', { className: 'event-feature' }, [
        eventPoster(event, opener(event)),
        h('div', { className: 'event-feature__body' }, [
          h('p', { className: 'event-badge', text: event.badge || '이벤트' }),
          h('h3', { className: 'event-feature__title', text: event.title }),
          event.reward ? h('p', { className: 'event-feature__reward' }, ['참여하시면 ', h('strong', { text: event.reward })]) : null,
          Array.isArray(event.steps) && event.steps.length
            ? h('ol', { className: 'event-steps' }, event.steps.map(function (step) { return h('li', { text: step }); }))
            : null,
          eventPeriod(event) ? h('p', { className: 'event-period', text: eventPeriod(event) }) : null
        ])
      ]);
    });

    var dealList = deals.length ? h('ul', { className: 'event-grid' }, deals.map(function (event) {
      return h('li', null, h('article', { className: 'event-card' }, [
        eventPoster(event, opener(event)),
        h('div', { className: 'event-card__body' }, [
          h('p', { className: 'event-badge', text: event.badge || '이벤트' }),
          h('h3', { className: 'event-card__title', text: event.title }),
          event.description ? h('p', { className: 'event-card__desc', text: event.description }) : null,
          eventPrice(event),
          eventPeriod(event) ? h('p', { className: 'event-period', text: eventPeriod(event) }) : null
        ])
      ]));
    })) : null;

    setContent(root, featureEls, dealList,
      h('p', { className: 'event-note' }, [icon('info', 'icon--xs'), '행사 기간과 세부 조건은 매장에 문의해 주세요. 포스터를 누르면 크게 볼 수 있습니다.']));
  }

  /* ======================================================================
   * 장어 소개 · 사장님 인사말 (확인된 글이 있을 때만 섹션을 보여 줌)
   * ==================================================================== */
  function renderIntro() {
    var section = document.querySelector('[data-intro-section]');
    var root = document.querySelector('[data-intro-root]');
    var intro = DATA.intro;
    var greeting = DATA.greeting;
    if (!section || !root || (!intro && !greeting)) return;

    var parts = [];
    if (intro) {
      parts.push(h('div', { className: 'intro__story' }, [
        intro.photo && isSafeUrl(intro.photo.src)
          ? h('figure', { className: 'intro__photo' }, h('img', { src: intro.photo.src, alt: intro.photo.alt || '', loading: 'lazy', decoding: 'async' }))
          : null,
        h('div', { className: 'intro__text' }, [
          intro.title ? h('h3', { className: 'intro__title', text: intro.title }) : null,
          (intro.paragraphs || []).map(function (p) { return h('p', { text: p }); }),
          Array.isArray(intro.points) && intro.points.length
            ? h('ul', { className: 'intro__points' }, intro.points.map(function (p) { return h('li', { text: p }); }))
            : null
        ])
      ]));
    }
    if (greeting && greeting.text) {
      parts.push(h('blockquote', { className: 'intro__greeting' }, [
        h('p', { text: greeting.text }),
        greeting.name ? h('footer', { text: greeting.name }) : null
      ]));
    }
    setContent(root, parts);
    section.hidden = false;
  }

  /* ======================================================================
   * 반찬 셀프바 — 사진·반찬 이름은 확인된 것만
   * ==================================================================== */
  function renderSelfbar() {
    var root = document.querySelector('[data-selfbar-root]');
    var selfbar = DATA.selfbar || {};
    if (!root) return;
    var photo = selfbar.photo && isSafeUrl(selfbar.photo.src)
      ? h('button', {
          type: 'button',
          className: 'selfbar__photo',
          'aria-label': (selfbar.photo.alt || '반찬 셀프바 사진') + ' — 크게 보기',
          onclick: function () { openLightbox([{ src: selfbar.photo.src, alt: selfbar.photo.alt, caption: '반찬 셀프바' }], 0); }
        }, h('img', { src: selfbar.photo.thumb || selfbar.photo.src, alt: '', loading: 'lazy', decoding: 'async' }))
      : h('div', { className: 'selfbar__photo selfbar__photo--empty', 'aria-hidden': 'true' }, [icon('camera'), '사진 준비 중']);
    var items = (selfbar.items || []).filter(Boolean);
    setContent(root,
      photo,
      h('p', { className: 'selfbar__text', text: '반찬은 셀프바에서 직접 가져다 드세요.' }),
      items.length ? h('ul', { className: 'chip-list selfbar__items' }, items.map(function (name) { return h('li', { className: 'chip', text: name }); })) : null
    );
  }

  /* ======================================================================
   * 이용 방법 (매장 안내 안의 카드)
   * ==================================================================== */
  var GUIDE_ICONS = { door: 'door', fish: 'fish', scale: 'scale', flame: 'flame', table: 'table', bowl: 'bowl', card: 'card' };

  function renderGuide() {
    var root = document.querySelector('[data-guide-root]');
    var guide = DATA.guide;
    if (!root || !guide || !Array.isArray(guide.steps) || !guide.steps.length) return;

    if (!guide.published) {
      // 실제 순서가 확인되지 않았으므로 번호 없이 '안내 예정 항목'만 표시
      setContent(root,
        // 휴대폰에서는 옆으로 넘기는 줄이 되므로 키보드로도 넘길 수 있게 tabindex
        h('ul', { className: 'guide-topics', 'aria-label': '안내 예정 항목', tabindex: '0' }, guide.steps.map(function (step) {
          return h('li', { className: 'guide-topic' + (step.id === 'self-bar' ? ' guide-topic--self' : '') }, [
            h('span', { className: 'guide-topic__icon', 'aria-hidden': 'true' }, icon(GUIDE_ICONS[step.icon] || 'info')),
            h('span', { className: 'guide-topic__name', text: step.title }),
            step.id === 'self-bar' ? h('span', { className: 'guide-topic__tag', text: '셀프' }) : null
          ]);
        })),
        h('p', { className: 'guide-note', text: '자세한 이용 순서와 사진은 확인 후 안내해 드릴게요. 처음 오시면 직원에게 편하게 물어보세요.' })
      );
      return;
    }

    setContent(root, h('ol', { className: 'steps' }, guide.steps.map(function (step) {
      var photo = step.photo && isSafeUrl(step.photo.src)
        ? h('figure', { className: 'step__photo' }, h('img', { src: step.photo.src, alt: step.photo.alt || '', loading: 'lazy', decoding: 'async' }))
        : h('div', { className: 'step__photo step__photo--empty', 'aria-hidden': 'true' }, [icon(GUIDE_ICONS[step.icon] || 'camera'), '사진 준비 중']);
      return h('li', { className: 'step' }, [
        photo,
        h('h3', { className: 'step__title', text: step.title }),
        step.description ? h('p', { className: 'step__desc', text: step.description }) : null
      ]);
    })));
  }

  /* ======================================================================
   * 매장 사진 — 같은 비율의 틀, 누르면 크게 보기
   * ==================================================================== */
  function renderGallery() {
    var root = document.querySelector('[data-gallery-root]');
    var gallery = DATA.gallery;
    if (!root || !gallery || !Array.isArray(gallery.categories)) return;

    var photos = (gallery.photos || []).filter(function (photo) { return photo && isSafeUrl(photo.src); });
    var categoryLabel = {};
    gallery.categories.forEach(function (c) { categoryLabel[c.id] = c.label; });

    if (!photos.length) {
      // 사진이 오기 전: 분류별 사진 자리 (실제 사진처럼 보이지 않도록 빈 틀로 표시)
      setContent(root, h('ul', { className: 'photo-frames', 'aria-label': '준비 중인 사진', tabindex: '0' }, gallery.categories.map(function (c) {
        return h('li', { className: 'photo-frame' }, [
          icon('camera'),
          h('span', { className: 'photo-frame__label', text: c.label }),
          h('span', { className: 'photo-frame__desc', text: '사진 준비 중' })
        ]);
      })));
      return;
    }

    var currentFilter = 'all';
    var visiblePhotos = photos;
    var grid = h('ul', { className: 'gallery-grid', 'aria-label': '매장 사진 목록', tabindex: '0' });
    var chips = h('div', { className: 'filter-chips', role: 'group', 'aria-label': '사진 분류' });

    function countOf(id) {
      return photos.filter(function (p) { return p.category === id; }).length;
    }
    var filters = [{ id: 'all', label: '전체', count: photos.length }].concat(
      gallery.categories
        .map(function (c) { return { id: c.id, label: c.label, count: countOf(c.id) }; })
        .filter(function (c) { return c.count > 0; })
    );

    function asItems(list) {
      return list.map(function (photo) {
        return { src: photo.src, alt: photo.alt, caption: photo.caption || categoryLabel[photo.category] || '', isSample: photo.isSample };
      });
    }

    function drawGrid() {
      visiblePhotos = currentFilter === 'all' ? photos : photos.filter(function (p) { return p.category === currentFilter; });
      setContent(grid, visiblePhotos.map(function (photo, index) {
        var label = photo.caption || categoryLabel[photo.category] || '';
        return h('li', null, h('button', {
          type: 'button',
          className: 'gallery-item',
          'aria-label': (photo.alt || label) + (photo.isSample ? ' (예시 이미지)' : '') + ' — 크게 보기',
          onclick: function () { openLightbox(asItems(visiblePhotos), index); }
        }, [
          h('img', { src: photo.thumb && isSafeUrl(photo.thumb) ? photo.thumb : photo.src, alt: '', loading: 'lazy', decoding: 'async' }),
          label ? h('span', { className: 'gallery-item__label', 'aria-hidden': 'true', text: label }) : null,
          photo.isSample ? h('span', { className: 'sample-badge', 'aria-hidden': 'true', text: '예시 이미지' }) : null
        ]));
      }));
      observeReveal(grid);
    }

    filters.forEach(function (filter) {
      chips.appendChild(h('button', {
        type: 'button',
        className: 'filter-chip',
        'aria-pressed': filter.id === 'all' ? 'true' : 'false',
        onclick: function (event) {
          currentFilter = filter.id;
          Array.prototype.forEach.call(chips.children, function (chip) { chip.setAttribute('aria-pressed', 'false'); });
          event.currentTarget.setAttribute('aria-pressed', 'true');
          drawGrid();
        }
      }, [filter.label, h('span', { className: 'filter-chip__count', text: String(filter.count) })]));
    });

    drawGrid();
    setContent(root, chips, grid);
  }

  /* ======================================================================
   * 네이버 지도 — 매장과 인평체육공원 주차장을 함께 표시
   * - 스크립트를 나중에 불러올 때는 공식 방식대로 callback 으로 '준비 완료'를 받아야 합니다.
   *   (onload 만 기다리면 지도 기능이 덜 준비된 상태일 수 있음)
   * - 주소 → 좌표는 서버(/api/geocode)로 먼저 하고, 실패하면 브라우저용 지오코더로 한 번 더 시도합니다.
   * - 실패하면 원인을 작게 표시합니다: 인증 / 스크립트 연결 / 응답 지연 / 좌표 변환 / 표시 오류
   * ==================================================================== */
  var MAP_ERRORS = {
    auth: '네이버 지도 인증 실패',
    script: '지도 스크립트 연결 실패',
    timeout: '지도 응답 지연',
    geocode: '주소 좌표 변환 실패',
    render: '지도 표시 오류'
  };
  var naverMapsPromise = null;

  function mapError(code) {
    var error = new Error(MAP_ERRORS[code] || code);
    error.code = code;
    return error;
  }

  function naverReady() {
    return !!(window.naver && window.naver.maps && typeof window.naver.maps.Map === 'function');
  }

  function loadNaverMaps(onAuthFailure) {
    if (naverReady()) return Promise.resolve();
    if (naverMapsPromise) return naverMapsPromise;
    naverMapsPromise = new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () { finish(mapError('timeout')); }, 15000);
      function finish(error) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve();
      }
      // 네이버가 정한 인증 실패 알림 함수 (지도를 그린 뒤에 호출될 수도 있음)
      window.navermap_authFailure = function () {
        finish(mapError('auth'));
        if (onAuthFailure) onAuthFailure();
      };
      window.__mangisusanMapReady = function () {
        finish(naverReady() ? null : mapError('script'));
      };
      var script = document.createElement('script');
      script.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=' + encodeURIComponent(NAVER_MAP_KEY_ID) +
        '&submodules=geocoder&callback=__mangisusanMapReady';
      script.async = true;
      script.onerror = function () { finish(mapError('script')); };
      document.head.appendChild(script);
    });
    return naverMapsPromise;
  }

  function serverGeocode(address) {
    return fetch('/api/geocode?query=' + encodeURIComponent(address))
      .then(function (res) {
        if (!res.ok) throw mapError('geocode');
        return res.json();
      })
      .then(function (data) {
        if (typeof data.lat !== 'number' || typeof data.lng !== 'number' || isNaN(data.lat) || isNaN(data.lng)) throw mapError('geocode');
        return { lat: data.lat, lng: data.lng };
      });
  }

  /** 서버 변환이 안 될 때: 네이버 지도 브라우저용 지오코더 (공식 submodules=geocoder) */
  function browserGeocode(address) {
    return new Promise(function (resolve, reject) {
      var service = window.naver && window.naver.maps && window.naver.maps.Service;
      if (!service || typeof service.geocode !== 'function') return reject(mapError('geocode'));
      service.geocode({ query: address }, function (status, response) {
        var first = response && response.v2 && response.v2.addresses && response.v2.addresses[0];
        if (status !== service.Status.OK || !first) return reject(mapError('geocode'));
        resolve({ lat: parseFloat(first.y), lng: parseFloat(first.x) });
      });
    });
  }

  function geocode(address) {
    return serverGeocode(address).catch(function () { return browserGeocode(address); });
  }

  function pinContent(place) {
    var parking = place.kind === 'parking';
    return '<div class="map-pin ' + (parking ? 'map-pin--parking' : 'map-pin--store') + '">' +
      '<span class="map-pin__label">' + (parking ? '<span class="map-p">P</span>' : '') + escapeHtml(place.label || place.name) + '</span>' +
      '<span class="map-pin__stem"></span><span class="map-pin__dot"></span></div>';
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function updateKakaoRoute(store) {
    var link = document.querySelector('[data-kakao-route]');
    if (!link) return;
    // 카카오맵 공식 URL 규칙: /link/to/이름,위도,경도 → 길찾기 화면
    link.href = 'https://map.kakao.com/link/to/' + encodeURIComponent('만기수산셀프매장') + ',' + store.lat + ',' + store.lng;
    var desc = document.querySelector('[data-kakao-route-desc]');
    if (desc) desc.textContent = '길찾기 화면으로 바로 이동';
  }

  function showMapFallback(slot, statusEl, error) {
    var target = statusEl || h('div', { className: 'map-frame__status' });
    var code = (error && error.code) || 'render';
    setContent(target,
      icon('map'),
      h('p', { text: '지도를 불러오지 못했습니다.' }),
      h('p', { text: '아래 \'네이버 지도에서 보기\' 버튼을 이용해 주세요.' }),
      h('p', { className: 'map-frame__reason', text: '(' + (MAP_ERRORS[code] || MAP_ERRORS.render) + ')' })
    );
    if (!statusEl) slot.appendChild(target);
    target.hidden = false;
    slot.setAttribute('data-map-error', code);
    if (window.console) console.warn('[만기수산] 지도:', MAP_ERRORS[code] || code, error);
  }

  function drawMap(slot, statusEl, located) {
    var maps = window.naver.maps;
    var store = located.filter(function (p) { return p.place.kind === 'store'; })[0];
    var canvas = h('div', { className: 'map-frame__canvas' });
    slot.appendChild(canvas);
    var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var center = new maps.LatLng(store.lat, store.lng);
    var map = new maps.Map(canvas, {
      center: center,
      zoom: 17,
      minZoom: 13,
      zoomControl: true,
      zoomControlOptions: { position: maps.Position.TOP_RIGHT },
      scrollWheel: false,          // 페이지 스크롤이 지도에 걸리지 않도록
      draggable: !touch,           // 휴대폰에서는 한 손가락 스크롤을 페이지에 양보
      pinchZoom: !touch,
      disableDoubleTapZoom: touch
    });
    if (statusEl) statusEl.hidden = true; // 지도가 만들어졌으면 안내 문구는 바로 치움

    located.forEach(function (p) {
      try {
        new maps.Marker({
          position: new maps.LatLng(p.lat, p.lng),
          map: map,
          title: p.place.name,
          zIndex: p.place.kind === 'store' ? 100 : 50,
          icon: { content: pinContent(p.place), anchor: new maps.Point(0, 0) }
        });
      } catch (e) {
        new maps.Marker({ position: new maps.LatLng(p.lat, p.lng), map: map, title: p.place.name });
      }
    });

    // 두 곳이 다 보이도록 범위 맞추기 (실패해도 지도는 그대로 둠)
    if (located.length > 1) {
      try {
        var bounds = new maps.LatLngBounds(center, center);
        located.forEach(function (p) { bounds.extend(new maps.LatLng(p.lat, p.lng)); });
        map.fitBounds(bounds, { top: 80, right: 100, bottom: 50, left: 100 });
        var keepZoom = function () {
          if (map.getZoom() > 18) map.setZoom(18);
          if (map.getZoom() < 16) map.setZoom(16);
        };
        if (maps.Event && typeof maps.Event.once === 'function') maps.Event.once(map, 'idle', keepZoom);
        else setTimeout(keepZoom, 600);
      } catch (e) {
        map.setCenter(center);
        map.setZoom(17);
      }
    }

    if (touch) slot.appendChild(h('p', { className: 'map-frame__hint', text: '확대·축소는 오른쪽 위 버튼' }));
  }

  function initMap() {
    var slot = document.querySelector('[data-map-slot]');
    var statusEl = document.querySelector('[data-map-status]');
    var places = (DATA.map && DATA.map.places) || [];
    if (!slot || !places.length) return;

    whenNear(slot, function () {
      loadNaverMaps(function () { showMapFallback(slot, statusEl, mapError('auth')); })
        .then(function () {
          return Promise.all(places.map(function (place) {
            return geocode(place.address).then(
              function (pos) { return { place: place, lat: pos.lat, lng: pos.lng }; },
              function () { return null; } // 하나가 실패해도 나머지는 표시
            );
          }));
        })
        .then(function (results) {
          var located = results.filter(Boolean);
          var store = located.filter(function (p) { return p.place.kind === 'store'; })[0];
          if (!store) throw mapError('geocode');
          updateKakaoRoute(store);
          try {
            drawMap(slot, statusEl, located);
          } catch (e) {
            throw e && e.code ? e : mapError('render');
          }
        })
        .catch(function (error) {
          showMapFallback(slot, statusEl, error);
        });
    });
  }

  /* ======================================================================
   * 리뷰 버튼 + 네이버 블로그 후기
   * ==================================================================== */
  function blogSkeleton(count) {
    var items = [];
    for (var i = 0; i < count; i++) {
      items.push(h('li', null, h('div', { className: 'blog-card blog-card--skeleton', 'aria-hidden': 'true' }, [
        h('span', { className: 'skeleton-line skeleton-line--short' }),
        h('span', { className: 'skeleton-line skeleton-line--title' }),
        h('span', { className: 'skeleton-line' }),
        h('span', { className: 'skeleton-line' })
      ])));
    }
    return h('ul', { className: 'blog-grid' }, items);
  }

  function blogFallback(message) {
    return h('div', { className: 'empty-state' }, [
      icon('message', 'empty-state__icon'),
      h('p', { className: 'empty-state__desc', text: message }),
      h('a', {
        className: 'text-link',
        href: 'https://search.naver.com/search.naver?where=blog&query=' + encodeURIComponent('만기수산 북삼'),
        target: '_blank',
        rel: 'noopener'
      }, ['네이버 블로그에서 직접 찾아보기', icon('external', 'icon--xs')])
    ]);
  }

  function blogCard(post) {
    var date = post.date ? post.date.replace(/-/g, '.') : '';
    return h('li', null, h('article', { className: 'blog-card' }, [
      h('p', { className: 'blog-card__meta' }, [
        h('span', { className: 'blog-card__source', text: '블로그' }),
        date ? h('time', { datetime: post.date, text: date }) : null
      ]),
      h('h4', { className: 'blog-card__title' }, h('a', { href: post.url, target: '_blank', rel: 'noopener' }, [
        post.title,
        h('span', { className: 'visually-hidden', text: ' (새 창)' })
      ])),
      post.summary ? h('p', { className: 'blog-card__summary', text: post.summary }) : null,
      h('div', { className: 'blog-card__foot' }, [
        h('span', { text: post.author ? post.author : '네이버 블로그' }),
        h('span', { className: 'blog-card__more', 'aria-hidden': 'true' }, ['원문 보기', icon('arrow-right', 'icon--xs')])
      ])
    ]));
  }

  function initReviews() {
    var reviews = DATA.reviews || {};
    var reviewLink = document.querySelector('[data-review-link]');
    if (reviewLink && isSafeUrl(reviews.reviewUrl)) reviewLink.href = reviews.reviewUrl;

    var root = document.querySelector('[data-blog-root]');
    if (!root) return;
    var count = reviews.blogCount || 3;
    var hidden = (reviews.hiddenPosts || []).map(function (u) { return String(u).replace(/^http:/, 'https:'); });
    var squash = function (text) { return String(text || '').replace(/\s+/g, '').toLowerCase(); };
    var hiddenWords = (reviews.hiddenKeywords || []).map(squash).filter(Boolean);
    function isHidden(post) {
      if (hidden.indexOf(post.url) !== -1) return true;
      var text = squash(post.title) + '|' + squash(post.author);
      return hiddenWords.some(function (word) { return text.indexOf(word) !== -1; });
    }
    var hint = document.querySelector('.blog__hint');

    whenNear(root, function () {
      setContent(root, blogSkeleton(3));
      fetch('/api/blog')
        .then(function (res) {
          if (!res.ok) throw new Error('blog ' + res.status);
          return res.json();
        })
        .then(function (data) {
          var pinned = (reviews.pinnedPosts || []).map(function (u) { return String(u).replace(/^http:/, 'https:'); });
          var posts = (data.items || [])
            .filter(function (post) { return post && post.title && /^https:\/\//.test(post.url) && !isHidden(post); })
            .sort(function (a, b) {
              // 사장님이 고른 대표 글을 먼저, 나머지는 서버가 준 최신순 그대로
              var pa = pinned.indexOf(a.url); var pb = pinned.indexOf(b.url);
              return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb);
            })
            .slice(0, count);
          if (!posts.length) {
            setContent(root, blogFallback('아직 소개할 블로그 후기가 없습니다.'));
            return;
          }
          if (hint) hint.hidden = posts.length < 2; // 휴대폰에서 '옆으로 넘겨 보세요'
          setContent(root,
            h('ul', { className: 'blog-grid' }, posts.map(blogCard)),
            h('p', { className: 'blog__more' }, h('a', {
              className: 'text-link',
              href: 'https://search.naver.com/search.naver?where=blog&query=' + encodeURIComponent('만기수산 북삼 후기'),
              target: '_blank',
              rel: 'noopener'
            }, ['네이버에서 후기 더 보기', h('span', { className: 'visually-hidden', text: ' (새 창)' }), icon('external', 'icon--xs')]))
          );
          observeReveal(root);
        })
        .catch(function () {
          setContent(root, blogFallback('블로그 후기를 불러오지 못했습니다.'));
        });
    });
  }

  /* ======================================================================
   * 스크롤 등장 효과 — 위에서 떨어지기
   * - 화면에 함께 들어온 것들은 위에서부터 차례로 '슥슥슥' 떨어집니다.
   * - 메뉴판은 위에서 '쿵' 떨어지며 섹션이 흔들리고 먼지·불티가 튑니다.
   * - 숨김은 <head> 의 작은 스크립트가 첫 화면 전에 걸어 둡니다(깜빡임 방지).
   *   그 스크립트가 숨기지 않은 경우(동작 줄이기·구형 브라우저)에는 아무것도 하지 않습니다.
   * ==================================================================== */
  var REVEAL_SELECTOR = '.section__head, .card, .location__map, .location__info, .menu-board, .menu-cat, .menu-hero, ' +
    '.event-feature, .event-card, .intro__story, .intro__greeting, ' +
    '.guide-topic, .step, .photo-frame, .gallery-item, .review-cta, .blog-card, .blog__head';
  var THUD_IMPACT_MS = 520; // 메뉴판이 바닥에 닿는 순간 (style.css 의 thud 와 맞춤)
  var STEP_MS = 110;        // '슥슥슥' 간격
  var revealObserver = null;
  var thudLandsAt = 0;

  function observeReveal(scope) {
    if (!revealObserver || !scope) return;
    Array.prototype.forEach.call(scope.querySelectorAll(REVEAL_SELECTOR), function (el) {
      if (el.hasAttribute('data-reveal-watch')) return;
      el.setAttribute('data-reveal-watch', '');
      revealObserver.observe(el);
    });
  }

  function thudImpact(board) {
    // 메뉴판이 화면보다 길면(휴대폰) 바닥이 안 보이므로, 보이는 부분의 아래쪽에서 먼지·불티가 일어나게 함
    // 위치는 움직이는 중인 상자가 아니라 원래 자리(레이아웃) 기준으로 계산
    var top = 0;
    for (var node = board; node; node = node.offsetParent) top += node.offsetTop;
    var bar = document.querySelector('[data-tabbar]');
    var barH = bar ? bar.offsetHeight : 0; // PC 에서는 숨겨져 0
    var scrollY = window.pageYOffset || document.documentElement.scrollTop;
    var visibleBottom = scrollY + (window.innerHeight || document.documentElement.clientHeight) - barH - 20 - top;
    board.style.setProperty('--impact-y', Math.max(60, Math.min(board.offsetHeight, visibleBottom)) + 'px');

    var container = board.closest('.container');
    if (container) {
      container.classList.remove('is-quaking');
      void container.offsetWidth; // 다시 흔들 수 있도록 초기화
      container.classList.add('is-quaking');
      setTimeout(function () { container.classList.remove('is-quaking'); }, 600);
    }
    var bits = [];
    ['l', 'r'].forEach(function (side) {
      bits.push(h('span', { className: 'thud-dust thud-dust--' + side, 'aria-hidden': 'true' }));
    });
    for (var i = 0; i < 16; i++) {
      var spark = h('span', { className: 'thud-spark', 'aria-hidden': 'true' });
      spark.style.setProperty('--sx', (6 + Math.random() * 88).toFixed(1) + '%');
      spark.style.setProperty('--bx', Math.round((Math.random() - 0.5) * 180) + 'px');
      spark.style.setProperty('--by', Math.round(-30 - Math.random() * 110) + 'px');
      spark.style.setProperty('--d', (0.55 + Math.random() * 0.55).toFixed(2) + 's');
      bits.push(spark);
    }
    bits.forEach(function (bit) { board.appendChild(bit); });
    setTimeout(function () {
      bits.forEach(function (bit) { if (bit.parentNode) bit.parentNode.removeChild(bit); });
    }, 1400);
  }

  function revealBatch(entries) {
    var now = Date.now();
    var batch = entries
      .filter(function (entry) { return entry.isIntersecting; })
      .map(function (entry) { return entry.target; })
      .sort(function (a, b) { return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1; });

    var step = 0;
    var catStep = 0;
    batch.forEach(function (el) {
      revealObserver.unobserve(el);
      var delay;
      if (el.classList.contains('menu-board')) {
        delay = 0;
        thudLandsAt = now + THUD_IMPACT_MS;
        // 애니메이션이 실제로 시작된 순간부터 재야 '쿵'과 흔들림이 정확히 맞음
        el.addEventListener('animationstart', function onStart(event) {
          if (event.animationName !== 'thud') return;
          el.removeEventListener('animationstart', onStart);
          setTimeout(function () { thudImpact(el); }, THUD_IMPACT_MS);
        });
      } else if (el.classList.contains('menu-cat') || el.classList.contains('menu-hero')) {
        // 메뉴판이 '쿵' 하고 닿은 뒤에 메뉴 분류가 차례로 내려앉음
        delay = Math.max(0, thudLandsAt + 140 - now) + catStep * 90;
        catStep++;
      } else {
        delay = Math.min(step, 7) * STEP_MS;
        step++;
      }
      el.style.setProperty('--reveal-delay', delay + 'ms');
      el.classList.add('is-revealed');
    });
  }

  function initReveal() {
    if (!document.documentElement.classList.contains('js-reveal')) return;
    revealObserver = new IntersectionObserver(revealBatch, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
    window.__revealReady = true;
    observeReveal(document);
  }

  /* ======================================================================
   * 메뉴판 아래 숯불 불티 (동작 줄이기 설정이면 만들지 않음)
   * ==================================================================== */
  function initEmbers() {
    var section = document.querySelector('.section--menu');
    if (!section || reducedMotion) return;
    var box = h('div', { className: 'embers', 'aria-hidden': 'true' });
    var count = window.innerWidth < 640 ? 10 : 18;
    for (var i = 0; i < count; i++) {
      var spark = h('span', { className: 'ember' });
      spark.style.setProperty('--x', (4 + Math.random() * 92).toFixed(1) + '%');
      spark.style.setProperty('--size', (2 + Math.random() * 3).toFixed(1) + 'px');
      spark.style.setProperty('--dur', (6 + Math.random() * 6).toFixed(1) + 's');
      spark.style.setProperty('--delay', (-Math.random() * 12).toFixed(1) + 's');
      spark.style.setProperty('--drift', Math.round((Math.random() - 0.5) * 80) + 'px');
      box.appendChild(spark);
    }
    section.appendChild(box);
  }

  /* ======================================================================
   * 검색엔진용 매장 정보 (schema.org Restaurant)
   * ==================================================================== */
  function injectStructuredData() {
    var dayNames = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
    var specs = [];
    Array.prototype.forEach.call(document.querySelectorAll('#hours-table tbody tr[data-days]'), function (row) {
      if (row.hasAttribute('data-closed')) return;
      specs.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: row.getAttribute('data-days').split(/\s+/).map(function (d) { return dayNames[d]; }),
        opens: row.getAttribute('data-open'),
        closes: row.getAttribute('data-close')
      });
    });

    var data = {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: '만기수산셀프매장',
      alternateName: '만기수산',
      url: 'https://xn--ok0b43tiqfepb.kro.kr/',
      image: 'https://xn--ok0b43tiqfepb.kro.kr/assets/img/og-image.jpg',
      telephone: '+82-54-976-8892',
      servesCuisine: '민물장어',
      acceptsReservations: true,
      paymentAccepted: '신용카드, 체크카드, 현금, 지역화폐, 간편결제',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '북삼읍 북삼로 58',
        addressLocality: '칠곡군',
        addressRegion: '경상북도',
        addressCountry: 'KR'
      },
      openingHoursSpecification: specs
    };
    document.head.appendChild(h('script', { type: 'application/ld+json', text: JSON.stringify(data) }));
  }

  /* ---------- 실행 ---------- */
  function start() {
    safely('영업 상태', initBusinessStatus);
    safely('바로가기', initNavigation);
    safely('전화 버튼', initCallFab);
    safely('대화상자', initDialogs);
    safely('복사 버튼', initCopyButtons);
    safely('크게 보기', initLightbox);
    safely('장어 소개', renderIntro);
    safely('메뉴', renderMenu);
    safely('이벤트', renderEvents);
    safely('셀프바', renderSelfbar);
    safely('이용 방법', renderGuide);
    safely('사진', renderGallery);
    safely('지도', initMap);
    safely('리뷰', initReviews);
    safely('불티', initEmbers);
    safely('등장 효과', initReveal);
    safely('구조화 데이터', injectStructuredData);
    safely('연도', function () {
      var year = document.querySelector('[data-current-year]');
      if (year) year.textContent = String(new Date().getFullYear());
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
