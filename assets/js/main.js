/* ==========================================================================
 * 만기수산셀프매장 — 화면 동작
 * --------------------------------------------------------------------------
 * 구성 (각 기능은 독립적으로 실행되며, 하나가 실패해도 나머지는 동작합니다)
 *   initBusinessStatus  현재 영업 상태 · 오늘 요일 강조 · 예외 일정 공지
 *   initNavigation      섹션 바로가기 현재 위치 표시
 *   initQuickBar        모바일 하단 버튼 (첫 화면 버튼이 보일 때는 숨김)
 *   initDialogs         길찾기 선택 창 · 닫기 동작
 *   initCopyButtons     주소·전화번호 복사
 *   renderMenu          메뉴·가격표 (site-data.js → menu)
 *   renderGuide         이용 방법 (site-data.js → guide)
 *   renderGallery       매장 사진 + 크게 보기 (site-data.js → gallery)
 *   renderReviews       블로그 후기 카드 (site-data.js → reviews)
 *   injectStructuredData 검색엔진용 매장 정보(JSON-LD)
 * ========================================================================== */
(function () {
  'use strict';

  var DATA = window.SITE_DATA || {};
  var BH = window.BusinessHours;
  var PHONE = '054-976-8892';

  /* ---------- 공통 도우미 ---------- */

  /** DOM 요소 생성 (innerHTML 을 쓰지 않아 데이터에 HTML 이 섞여도 안전) */
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

  /** 요소 내용 교체 (구형 브라우저 호환을 위해 replaceChildren 대신 사용) */
  function setContent(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    for (var i = 1; i < arguments.length; i++) {
      var node = arguments[i];
      if (Array.isArray(node)) node.forEach(function (n) { el.appendChild(n); });
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

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 안내 메시지(토스트) ---------- */
  var toastTimer = null;
  function showToast(message) {
    var toast = document.querySelector('[data-toast]');
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.hidden = true;
    }, 2400);
  }

  /* ======================================================================
   * 영업시간 · 현재 영업 상태
   * ==================================================================== */

  /** index.html 영업시간 표의 data 속성을 읽어 주간 일정 생성 (표 = 유일한 원본) */
  function readWeeklySchedule() {
    var rows = document.querySelectorAll('#hours-table tbody tr[data-day]');
    var schedule = {};
    Array.prototype.forEach.call(rows, function (row) {
      var day = row.getAttribute('data-day');
      if (row.hasAttribute('data-closed')) {
        schedule[day] = { closed: true, reason: '정기휴무' };
        return;
      }
      schedule[day] = {
        open: row.getAttribute('data-open'),
        close: row.getAttribute('data-close'),
        lastOrder: row.getAttribute('data-last-order')
      };
      // 화면 글자와 data 값이 다르면 개발자 도구에 경고 (수정 실수 방지)
      var text = row.textContent;
      if (text.indexOf(schedule[day].open) === -1 || text.indexOf(schedule[day].close) === -1) {
        console.warn('[만기수산] 영업시간 표의 글자와 data 값이 다릅니다:', day);
      }
    });
    return schedule;
  }

  function initBusinessStatus() {
    if (!BH) return;
    var schedule = readWeeklySchedule();
    if (Object.keys(schedule).length !== 7) return;

    var specialDays = Array.isArray(DATA.specialDays) ? DATA.specialDays : [];
    var statusBox = document.querySelector('[data-status]');
    var badges = document.querySelectorAll('[data-status-badge]');
    var messageEl = document.querySelector('[data-status-message]');
    var todayEl = document.querySelector('[data-status-today]');
    var noticeEl = document.querySelector('[data-special-notice]');
    var lastKey = '';

    function update() {
      var result = BH.computeStatus(new Date(), schedule, specialDays);
      var key = result.status + '|' + result.message + '|' + result.today.dateKey;
      if (key === lastKey) return; // 바뀐 것이 없으면 다시 그리지 않음 (화면낭독기 반복 방지)
      lastKey = key;

      Array.prototype.forEach.call(badges, function (badge) {
        badge.setAttribute('data-state', result.status);
        var label = badge.querySelector('[data-status-label]');
        if (label) label.textContent = result.label;
        badge.hidden = false;
      });
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
    var rows = document.querySelectorAll('#hours-table tbody tr[data-day]');
    Array.prototype.forEach.call(rows, function (row) {
      var isToday = row.getAttribute('data-day') === weekdayKey;
      row.classList.toggle('is-today', isToday);
      var th = row.querySelector('th');
      var pill = th && th.querySelector('.today-pill');
      if (isToday) {
        row.setAttribute('aria-current', 'date');
        if (th && !pill) th.appendChild(h('span', { className: 'today-pill', text: '오늘' }));
      } else {
        row.removeAttribute('aria-current');
        if (pill) pill.remove();
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
      var text = BH.formatDateKey(item.date) + ' ';
      text += item.closed ? (item.label || '임시휴무') : (item.label || '특별 영업') + ' ' + item.open + '~' + item.close;
      return text;
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

    function setActive(id) {
      links.forEach(function (link) {
        var active = link.getAttribute('href') === '#' + id;
        if (active) {
          link.setAttribute('aria-current', 'true');
          // 모바일: 가로로 넘치는 목록에서 현재 항목이 보이도록 이동
          var left = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
          list.scrollTo({ left: Math.max(0, left), behavior: reducedMotion ? 'auto' : 'smooth' });
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }

    var visible = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible[entry.target.id] = entry.isIntersecting;
      });
      var current = sections.filter(function (section) { return visible[section.id]; })[0];
      if (current) setActive(current.id);
      else links.forEach(function (link) { link.removeAttribute('aria-current'); });
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
    var observer = new IntersectionObserver(function (entries) {
      bar.classList.toggle('is-hidden', entries[0].isIntersecting);
    });
    observer.observe(heroActions);
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
    var dialogs = document.querySelectorAll('dialog');
    Array.prototype.forEach.call(dialogs, function (dialog) {
      dialog.addEventListener('close', function () {
        document.documentElement.classList.remove('has-dialog');
      });
      // 바깥(어두운 영역) 누르면 닫기
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) dialog.close();
      });
      Array.prototype.forEach.call(dialog.querySelectorAll('[data-close-dialog]'), function (button) {
        button.addEventListener('click', function () { dialog.close(); });
      });
    });

    var directions = document.getElementById('directions-dialog');
    Array.prototype.forEach.call(document.querySelectorAll('[data-open-directions]'), function (trigger) {
      trigger.addEventListener('click', function (event) {
        // 대화상자를 지원하지 않는 브라우저는 링크 기본 동작(#location 이동)을 그대로 사용
        if (openDialog(directions)) event.preventDefault();
      });
    });
  }

  /* ======================================================================
   * 복사 버튼
   * ==================================================================== */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    var area = h('textarea', { readonly: true, 'aria-hidden': 'true', style: 'position:fixed;top:-1000px;opacity:0' });
    area.value = text;
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    area.remove();
    return ok;
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
   * 메뉴·가격표
   * ==================================================================== */
  var priceFormatter = window.Intl ? new Intl.NumberFormat('ko-KR') : null;

  function formatPrice(option) {
    if (option.amountText) return option.amountText;
    if (typeof option.amount === 'number') {
      return (priceFormatter ? priceFormatter.format(option.amount) : String(option.amount)) + '원';
    }
    return null; // 확인 후 입력
  }

  function renderMenuItem(item) {
    var options = Array.isArray(item.options) && item.options.length ? item.options : [{ label: null, amount: null }];
    var prices = h('ul', { className: 'menu-item__prices' }, options.map(function (option) {
      var formatted = formatPrice(option);
      var label = option.label || (item.priceType === 'weight' ? '중량 기준' : item.priceType === 'per-person' ? '1인' : null);
      return h('li', { className: 'price-row' }, [
        label ? h('span', { className: 'price-row__label', text: label }) : null,
        formatted
          ? h('span', { className: 'price-row__amount', text: formatted })
          : h('span', { className: 'price-row__amount price-row__amount--pending', text: '가격 확인 중' })
      ]);
    }));

    return h('li', { className: 'menu-item' }, [
      h('div', null, [
        h('p', { className: 'menu-item__name' }, [
          item.name,
          item.soldOut ? h('span', { className: 'menu-item__badge', text: '품절' }) : null
        ]),
        item.description ? h('p', { className: 'menu-item__desc', text: item.description }) : null
      ]),
      prices
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
    var categories = menu.categories;

    var fragment = document.createDocumentFragment();

    if (!hasAnyPrice(categories)) {
      fragment.appendChild(h('p', { className: 'menu-notice' }, [
        icon('info'),
        h('span', null, [
          '메뉴판과 가격을 정리하고 있습니다. 정확한 가격은 ',
          h('a', { href: 'tel:' + PHONE, text: PHONE }),
          '로 문의해 주세요.'
        ])
      ]));
    }

    var tabList = h('div', { className: 'tabs', role: 'tablist', 'aria-label': '메뉴 분류' });
    var panels = [];
    var tabs = categories.map(function (category, index) {
      var tabId = 'menu-tab-' + category.id;
      var panelId = 'menu-panel-' + category.id;
      var selected = index === 0;
      var tab = h('button', {
        type: 'button',
        className: 'tab',
        role: 'tab',
        id: tabId,
        'aria-controls': panelId,
        'aria-selected': selected ? 'true' : 'false',
        tabindex: selected ? '0' : '-1',
        text: category.label
      });

      var items = category.items || [];
      var panel = h('div', {
        className: 'menu-panel',
        role: 'tabpanel',
        id: panelId,
        'aria-labelledby': tabId,
        tabindex: '0',
        hidden: !selected
      }, [
        category.note ? h('p', { className: 'menu-panel__note' }, [icon('info', 'icon--xs'), category.note]) : null,
        items.length
          ? h('ul', { className: 'menu-list' }, items.map(renderMenuItem))
          : h('p', { className: 'menu-panel__empty', text: category.label + ' 메뉴를 준비하고 있습니다.' })
      ]);
      panels.push(panel);
      tabList.appendChild(tab);
      return tab;
    });

    function select(index, focus) {
      tabs.forEach(function (tab, i) {
        var on = i === index;
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.setAttribute('tabindex', on ? '0' : '-1');
        panels[i].hidden = !on;
      });
      if (focus) tabs[index].focus();
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () { select(index, false); });
      tab.addEventListener('keydown', function (event) {
        var next = null;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        if (next !== null) {
          event.preventDefault();
          select(next, true);
        }
      });
    });

    fragment.appendChild(tabList);
    panels.forEach(function (panel) { fragment.appendChild(panel); });

    if (menu.lastUpdated && BH) {
      fragment.appendChild(h('p', { className: 'menu-updated', text: '가격 기준일: ' + menu.lastUpdated.slice(0, 4) + '년 ' + BH.formatDateKey(menu.lastUpdated) }));
    }

    setContent(root, fragment);
  }

  /* ======================================================================
   * 이용 방법
   * ==================================================================== */
  function renderGuide() {
    var root = document.querySelector('[data-guide-root]');
    var guide = DATA.guide;
    if (!root || !guide || !Array.isArray(guide.steps) || !guide.steps.length) return;

    if (!guide.published) {
      // 순서가 확인되지 않았으므로 번호 없이 '안내 예정 항목'만 보여 줌
      setContent(root, h('div', { className: 'empty-state' }, [
        icon('fish', 'empty-state__icon'),
        h('p', { className: 'empty-state__title', text: '처음 오신 분을 위한 이용 방법을 준비하고 있습니다' }),
        h('p', { className: 'empty-state__desc', text: '아래 내용을 사진과 함께 안내할 예정입니다. 궁금한 점은 전화로 물어보세요.' }),
        h('ul', { className: 'chip-list', 'aria-label': '안내 예정 항목' }, guide.steps.map(function (step) {
          return h('li', { className: 'chip', text: step.title });
        })),
        h('a', { className: 'btn btn--outline', href: 'tel:' + PHONE }, [icon('phone'), '전화 문의 ' + PHONE])
      ]));
      return;
    }

    setContent(root, h('ol', { className: 'steps' }, guide.steps.map(function (step) {
      var photo = step.photo && isSafeUrl(step.photo.src)
        ? h('figure', { className: 'step__photo' }, h('img', { src: step.photo.src, alt: step.photo.alt || '', loading: 'lazy', decoding: 'async' }))
        : h('div', { className: 'step__photo step__photo--empty', 'aria-hidden': 'true', text: '사진 준비 중' });
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
      setContent(root, h('div', { className: 'empty-state' }, [
        icon('camera', 'empty-state__icon'),
        h('p', { className: 'empty-state__title', text: '매장 사진을 준비하고 있습니다' }),
        h('ul', { className: 'chip-list', 'aria-label': '준비 중인 사진 분류' }, gallery.categories.map(function (c) {
          return h('li', { className: 'chip', text: c.label });
        }))
      ]));
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

    /* 크게 보기 */
    var lightbox = document.getElementById('lightbox');
    var lbImg = null;
    var lbCaption = lightbox && lightbox.querySelector('[data-lightbox-caption]');
    var lbIndex = 0;

    function showPhoto(index) {
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
      // 모바일 좌우 밀기
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
   * 오시는 길 지도 (네이버 Dynamic Map)
   * - 매장 주소는 화면의 주소 블록(.location__value)에서 읽음 (index.html 에 직접 적혀 있음)
   * - 좌표는 서버리스 함수(/api/geocode)로 변환 (네이버 API 키는 서버에만 존재)
   * ==================================================================== */
  function initMap() {
    var slot = document.querySelector('[data-map-slot]');
    if (!slot || typeof naver === 'undefined' || !naver.maps) return;

    var addressEl = document.querySelector('.location__value');
    var address = (addressEl && addressEl.textContent.trim()) || '경상북도 칠곡군 북삼읍 북삼로 58';

    var mapEl = h('div', { className: 'store-map', id: 'storeMap' });
    setContent(slot, mapEl);

    fetch('/api/geocode?query=' + encodeURIComponent(address))
      .then(function (res) {
        if (!res.ok) throw new Error('지오코딩 실패');
        return res.json();
      })
      .then(function (data) {
        var center = new naver.maps.LatLng(data.lat, data.lng);
        var map = new naver.maps.Map(mapEl, { center: center, zoom: 17 });
        new naver.maps.Marker({ position: center, map: map, title: '만기수산셀프매장' });
      })
      .catch(function () {
        setContent(slot, h('div', { className: 'empty-state' }, [
          icon('pin', 'empty-state__icon'),
          h('p', { className: 'empty-state__title', text: '지도를 불러오지 못했습니다' }),
          h('p', { className: 'empty-state__desc', text: '위의 네이버 지도·카카오맵 버튼으로 길찾기를 이용해 주세요.' })
        ]));
      });
  }

  /* ======================================================================
   * 네이버 블로그 후기
   * ==================================================================== */
  function renderReviews() {
    var reviews = DATA.reviews || {};
    var placeLink = document.querySelector('[data-naver-place-link]');
    if (placeLink && isSafeUrl(reviews.naverPlaceUrl)) placeLink.href = reviews.naverPlaceUrl;

    var root = document.querySelector('[data-reviews-root]');
    if (!root) return;
    var posts = (reviews.blogPosts || []).filter(function (post) { return post && post.title && isSafeUrl(post.url); }).slice(0, 5);

    if (!posts.length) {
      setContent(root, h('div', { className: 'empty-state' }, [
        icon('message', 'empty-state__icon'),
        h('p', { className: 'empty-state__title', text: '블로그 후기를 모으고 있습니다' }),
        h('p', { className: 'empty-state__desc', text: '작성자의 허락을 받은 후기만 원문 링크와 함께 소개합니다.' })
      ]));
      return;
    }

    setContent(root, h('ul', { className: 'review-grid' }, posts.map(function (post) {
      var meta = ['네이버 블로그', post.author, post.publishedAt ? post.publishedAt.replace(/-/g, '.') : null].filter(Boolean).join(' · ');
      return h('li', null, h('article', { className: 'review-card' }, [
        h('p', { className: 'review-card__meta', text: meta }),
        h('h3', { className: 'review-card__title', text: post.title }),
        post.summary ? h('p', { className: 'review-card__summary', text: post.summary }) : null,
        h('a', { className: 'text-link', href: post.url, target: '_blank', rel: 'noopener' }, [
          '원문 보기',
          h('span', { className: 'visually-hidden', text: ' (새 창)' }),
          icon('external', 'icon--xs')
        ])
      ]));
    })));
  }

  /* ======================================================================
   * 검색엔진용 매장 정보 (schema.org Restaurant)
   * 영업시간은 화면의 표에서 읽어 오므로 별도로 수정할 필요가 없습니다.
   * ==================================================================== */
  function injectStructuredData() {
    var schedule = readWeeklySchedule();
    var dayNames = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
    var groups = {};
    Object.keys(schedule).forEach(function (day) {
      var s = schedule[day];
      if (s.closed) return;
      var key = s.open + '-' + s.close;
      (groups[key] = groups[key] || { opens: s.open, closes: s.close, dayOfWeek: [] }).dayOfWeek.push(dayNames[day]);
    });

    var origin = location.origin && location.origin !== 'null' ? location.origin : '';
    var data = {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: '만기수산셀프매장',
      alternateName: '만기수산',
      telephone: '+82-54-976-8892',
      servesCuisine: '민물장어',
      acceptsReservations: true,
      address: {
        '@type': 'PostalAddress',
        streetAddress: '북삼읍 북삼로 58',
        addressLocality: '칠곡군',
        addressRegion: '경상북도',
        addressCountry: 'KR'
      },
      openingHoursSpecification: Object.keys(groups).map(function (key) {
        return { '@type': 'OpeningHoursSpecification', dayOfWeek: groups[key].dayOfWeek, opens: groups[key].opens, closes: groups[key].closes };
      })
    };
    if (origin) {
      data.url = origin + '/';
      data.image = origin + '/assets/img/og-image.jpg';
    }
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
    safely('후기', renderReviews);
    safely('지도', initMap);
    safely('구조화 데이터', injectStructuredData);
    safely('연도', function () {
      var year = document.querySelector('[data-current-year]');
      if (year) year.textContent = String(new Date().getFullYear());
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
