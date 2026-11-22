/* ==========================================================================
 * 만기수산셀프매장 — 화면 동작
 * --------------------------------------------------------------------------
 * 구성 (각 기능은 따로 실행되며, 하나가 실패해도 나머지는 동작합니다)
 *   initBusinessStatus  오늘 날짜 · 현재 영업 상태 · 오늘 요일 강조 · 예외 일정 공지
 *   initNavigation      섹션 바로가기 현재 위치 표시
 *   initQuickBar        모바일 하단 버튼 (첫 화면 버튼이 보이는 동안 숨김)
 *   initDialogs         길찾기 선택 창 · 닫기
 *   initCopyButtons     주소·전화번호 복사
 *   renderMenu          메뉴판 (site-data.js → menu)
 *   renderGuide         이용 방법 (site-data.js → guide)
 *   renderGallery       매장 사진 + 크게 보기 (site-data.js → gallery)
 *   initMap             네이버 지도 (site-data.js → map, 좌표는 /api/geocode)
 *   initReviews         리뷰 버튼 + 블로그 후기 (/api/blog)
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
    var list = document.querySelector('[data-nav-list]');
    if (!list || !('IntersectionObserver' in window)) return;
    var links = Array.prototype.slice.call(list.querySelectorAll('a[href^="#"]'));
    var sections = links
      .map(function (link) { return document.querySelector(link.getAttribute('href')); })
      .filter(Boolean);
    var current = null;

    function setActive(id) {
      if (id === current) return;
      current = id;
      links.forEach(function (link) {
        if (link.getAttribute('href') === '#' + id) {
          link.setAttribute('aria-current', 'true');
          var left = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
          list.scrollTo({ left: Math.max(0, left), behavior: reducedMotion ? 'auto' : 'smooth' });
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
   * 모바일 하단 고정 버튼 — 첫 화면의 전화·길찾기 버튼이 보이는 동안 숨김
   * ==================================================================== */
  function initQuickBar() {
    var bar = document.querySelector('[data-quick-bar]');
    var heroActions = document.getElementById('hero-actions');
    if (!bar || !heroActions || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      bar.classList.toggle('is-hidden', entries[0].isIntersecting);
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
   * 메뉴판
   * ==================================================================== */
  var priceFormatter = window.Intl ? new Intl.NumberFormat('ko-KR') : null;

  function formatPrice(option) {
    if (option.amountText) return option.amountText;
    if (typeof option.amount === 'number') {
      return (priceFormatter ? priceFormatter.format(option.amount) : String(option.amount)) + '원';
    }
    return null; // 확인 후 입력
  }

  function priceSpan(option) {
    var formatted = formatPrice(option);
    return formatted
      ? h('span', { className: 'menu-row__price', text: formatted })
      : h('span', { className: 'menu-row__price menu-row__price--pending', text: '가격 확인 중' });
  }

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
    var desc = item.description ? h('p', { className: 'menu-row__desc', text: item.description }) : null;

    // 가격이 하나면 이름 옆에 바로, 여러 개(중량별 등)면 아래에 줄마다 표시
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

    var cats = h('div', { className: 'menu-cats' }, menu.categories.map(function (category) {
      var items = category.items || [];
      return h('section', { className: 'menu-cat', 'aria-label': category.label }, [
        h('h3', { className: 'menu-cat__title', text: category.label }),
        category.note ? h('p', { className: 'menu-cat__note', text: category.note }) : null,
        items.length
          ? h('ul', { className: 'menu-list' }, items.map(renderMenuItem))
          : h('p', { className: 'menu-cat__empty', text: '메뉴 준비 중' })
      ]);
    }));

    var updated = menu.lastUpdated && BH
      ? h('p', { className: 'menu-updated', text: '가격 기준일: ' + menu.lastUpdated.slice(0, 4) + '년 ' + BH.formatDateKey(menu.lastUpdated) })
      : null;

    setContent(root, head, notice, cats, updated);
  }

  /* ======================================================================
   * 이용 방법
   * ==================================================================== */
  var GUIDE_ICONS = { door: 'door', fish: 'fish', scale: 'scale', flame: 'flame', table: 'table', bowl: 'bowl', card: 'card' };

  function renderGuide() {
    var root = document.querySelector('[data-guide-root]');
    var guide = DATA.guide;
    if (!root || !guide || !Array.isArray(guide.steps) || !guide.steps.length) return;

    if (!guide.published) {
      // 실제 순서가 확인되지 않았으므로 번호 없이 '안내 예정 항목'만 표시
      setContent(root,
        h('ul', { className: 'guide-topics', 'aria-label': '안내 예정 항목' }, guide.steps.map(function (step) {
          return h('li', { className: 'guide-topic' }, [
            h('span', { className: 'guide-topic__icon', 'aria-hidden': 'true' }, icon(GUIDE_ICONS[step.icon] || 'info')),
            h('span', { className: 'guide-topic__name', text: step.title })
          ]);
        })),
        h('div', { className: 'guide-note' }, [
          h('p', { text: '실제 이용 순서와 사진은 확인 후 안내해 드릴게요. 처음 오시면 직원에게 편하게 물어보세요.' }),
          h('a', { className: 'btn btn--outline', href: 'tel:' + PHONE }, [icon('phone'), '전화 문의 ' + PHONE])
        ])
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
   * 매장 사진 + 크게 보기
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
      setContent(root, h('ul', { className: 'photo-frames', 'aria-label': '준비 중인 사진' }, gallery.categories.map(function (c) {
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
    var grid = h('ul', { className: 'gallery-grid' });
    var chips = h('div', { className: 'filter-chips', role: 'group', 'aria-label': '사진 분류' });

    function countOf(id) {
      return photos.filter(function (p) { return p.category === id; }).length;
    }
    var filters = [{ id: 'all', label: '전체', count: photos.length }].concat(
      gallery.categories
        .map(function (c) { return { id: c.id, label: c.label, count: countOf(c.id) }; })
        .filter(function (c) { return c.count > 0; })
    );

    function drawGrid() {
      visiblePhotos = currentFilter === 'all' ? photos : photos.filter(function (p) { return p.category === currentFilter; });
      setContent(grid, visiblePhotos.map(function (photo, index) {
        var label = photo.caption || categoryLabel[photo.category] || '';
        return h('li', null, h('button', {
          type: 'button',
          className: 'gallery-item',
          'aria-label': (photo.alt || label) + (photo.isSample ? ' (예시 이미지)' : '') + ' — 크게 보기',
          onclick: function () { openLightbox(index); }
        }, [
          h('img', { src: photo.thumb && isSafeUrl(photo.thumb) ? photo.thumb : photo.src, alt: '', loading: 'lazy', decoding: 'async' }),
          label ? h('span', { className: 'gallery-item__label', 'aria-hidden': 'true', text: label }) : null,
          photo.isSample ? h('span', { className: 'sample-badge', 'aria-hidden': 'true', text: '예시 이미지' }) : null
        ]));
      }));
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

    var lightbox = document.getElementById('lightbox');
    var lbCaption = lightbox && lightbox.querySelector('[data-lightbox-caption]');
    var lbImg = null;
    var lbIndex = 0;

    function showPhoto(index) {
      if (!lbCaption) return;
      if (!lbImg) {
        lbImg = h('img', { className: 'lightbox__img', alt: '' });
        lbCaption.parentNode.insertBefore(lbImg, lbCaption);
      }
      lbIndex = (index + visiblePhotos.length) % visiblePhotos.length;
      var photo = visiblePhotos[lbIndex];
      lbImg.src = photo.src;
      lbImg.alt = photo.alt || '';
      var caption = (photo.caption || categoryLabel[photo.category] || '') + '  ' + (lbIndex + 1) + ' / ' + visiblePhotos.length;
      lbCaption.textContent = (photo.isSample ? '[예시 이미지] ' : '') + caption.trim();
      var single = visiblePhotos.length < 2;
      lightbox.querySelector('[data-lightbox-prev]').hidden = single;
      lightbox.querySelector('[data-lightbox-next]').hidden = single;
    }

    function openLightbox(index) {
      if (!lightbox || typeof lightbox.showModal !== 'function') {
        window.open(visiblePhotos[index].src, '_blank', 'noopener');
        return;
      }
      showPhoto(index);
      openDialog(lightbox);
    }

    if (lightbox && !lightbox.hasAttribute('data-ready')) {
      lightbox.setAttribute('data-ready', '');
      lightbox.querySelector('[data-lightbox-prev]').addEventListener('click', function () { showPhoto(lbIndex - 1); });
      lightbox.querySelector('[data-lightbox-next]').addEventListener('click', function () { showPhoto(lbIndex + 1); });
      lightbox.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowLeft') showPhoto(lbIndex - 1);
        if (event.key === 'ArrowRight') showPhoto(lbIndex + 1);
      });
      var startX = null;
      lightbox.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
      lightbox.addEventListener('touchend', function (e) {
        if (startX === null) return;
        var dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 50) showPhoto(lbIndex + (dx < 0 ? 1 : -1));
        startX = null;
      });
    }

    drawGrid();
    setContent(root, chips, grid);
  }

  /* ======================================================================
   * 네이버 지도 — 매장과 인평체육공원 주차장을 함께 표시
   * ==================================================================== */
  var naverMapsPromise = null;
  function loadNaverMaps() {
    if (window.naver && window.naver.maps) return Promise.resolve();
    if (naverMapsPromise) return naverMapsPromise;
    naverMapsPromise = new Promise(function (resolve, reject) {
      window.navermap_authFailure = function () { reject(new Error('네이버 지도 인증 실패')); }; // 공식 인증 실패 알림
      var script = document.createElement('script');
      script.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=' + encodeURIComponent(NAVER_MAP_KEY_ID);
      script.async = true;
      script.onload = function () {
        if (window.naver && window.naver.maps) resolve();
        else reject(new Error('네이버 지도 스크립트를 읽지 못했습니다'));
      };
      script.onerror = function () { reject(new Error('네이버 지도 스크립트를 불러오지 못했습니다')); };
      document.head.appendChild(script);
    });
    return naverMapsPromise;
  }

  function geocode(address) {
    return fetch('/api/geocode?query=' + encodeURIComponent(address))
      .then(function (res) {
        if (!res.ok) throw new Error('좌표 변환 실패');
        return res.json();
      })
      .then(function (data) {
        if (typeof data.lat !== 'number' || typeof data.lng !== 'number' || isNaN(data.lat) || isNaN(data.lng)) throw new Error('좌표 없음');
        return data;
      });
  }

  function pinContent(place) {
    var parking = place.kind === 'parking';
    return '<div class="map-pin' + (parking ? ' map-pin--parking' : '') + '">' +
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

  function showMapFallback(slot, statusEl) {
    var target = statusEl || h('div', { className: 'map-frame__status' });
    setContent(target,
      icon('map'),
      h('p', { text: '지도를 불러오지 못했습니다.' }),
      h('p', { text: '아래 \'네이버 지도에서 보기\' 버튼을 이용해 주세요.' })
    );
    if (!statusEl) slot.appendChild(target);
    target.hidden = false;
  }

  function initMap() {
    var slot = document.querySelector('[data-map-slot]');
    var statusEl = document.querySelector('[data-map-status]');
    var places = (DATA.map && DATA.map.places) || [];
    if (!slot || !places.length) return;

    whenNear(slot, function () {
      Promise.all([
        loadNaverMaps(),
        Promise.all(places.map(function (place) {
          return geocode(place.address).then(
            function (pos) { return { place: place, lat: pos.lat, lng: pos.lng }; },
            function () { return null; } // 하나가 실패해도 나머지는 표시
          );
        }))
      ]).then(function (results) {
        var located = results[1].filter(Boolean);
        var store = located.filter(function (p) { return p.place.kind === 'store'; })[0];
        if (!store) throw new Error('매장 좌표 없음');
        updateKakaoRoute(store);

        var maps = window.naver.maps;
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

        located.forEach(function (p) {
          new maps.Marker({
            position: new maps.LatLng(p.lat, p.lng),
            map: map,
            title: p.place.name,
            zIndex: p.place.kind === 'store' ? 100 : 50,
            icon: { content: pinContent(p.place), anchor: new maps.Point(0, 0) }
          });
        });

        if (located.length > 1) {
          var bounds = new maps.LatLngBounds(center, center);
          located.forEach(function (p) { bounds.extend(new maps.LatLng(p.lat, p.lng)); });
          map.fitBounds(bounds, { top: 80, right: 100, bottom: 50, left: 100 }); // 이름표가 잘리지 않을 여백
          // 주변 건물과 도로가 보이는 범위로 유지
          maps.Event.once(map, 'idle', function () {
            if (map.getZoom() > 18) map.setZoom(18);
            if (map.getZoom() < 16) map.setZoom(16);
          });
        }

        if (touch) slot.appendChild(h('p', { className: 'map-frame__hint', text: '확대·축소는 오른쪽 위 버튼' }));
        if (statusEl) statusEl.hidden = true;
      }).catch(function () {
        showMapFallback(slot, statusEl);
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
    var count = reviews.blogCount || 4;
    var hidden = (reviews.hiddenPosts || []).map(function (u) { return String(u).replace(/^http:/, 'https:'); });

    whenNear(root, function () {
      setContent(root, blogSkeleton(Math.min(count, 2)));
      fetch('/api/blog')
        .then(function (res) {
          if (!res.ok) throw new Error('blog ' + res.status);
          return res.json();
        })
        .then(function (data) {
          var posts = (data.items || [])
            .filter(function (post) { return post && post.title && /^https:\/\//.test(post.url) && hidden.indexOf(post.url) === -1; })
            .slice(0, count);
          if (!posts.length) {
            setContent(root, blogFallback('아직 소개할 블로그 후기가 없습니다.'));
            return;
          }
          setContent(root, h('ul', { className: 'blog-grid' }, posts.map(blogCard)));
        })
        .catch(function () {
          setContent(root, blogFallback('블로그 후기를 불러오지 못했습니다.'));
        });
    });
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
    safely('하단 버튼', initQuickBar);
    safely('대화상자', initDialogs);
    safely('복사 버튼', initCopyButtons);
    safely('메뉴', renderMenu);
    safely('이용 방법', renderGuide);
    safely('사진', renderGallery);
    safely('지도', initMap);
    safely('리뷰', initReviews);
    safely('구조화 데이터', injectStructuredData);
    safely('연도', function () {
      var year = document.querySelector('[data-current-year]');
      if (year) year.textContent = String(new Date().getFullYear());
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
