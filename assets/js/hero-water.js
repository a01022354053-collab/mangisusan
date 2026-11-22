/* ==========================================================================
 * 상단 브랜드 영역 — 물속을 유영하는 장어 (Canvas)
 * --------------------------------------------------------------------------
 * - 먹으로 그린 듯한 장어 실루엣이 S자로 몸을 흔들며 천천히 지나가고,
 *   물결이 퍼지고, 작은 물방울이 떠오릅니다.
 * - 로고가 가려지지 않도록 옅은 농도로 그리고, 로고 바로 뒤는 더 옅게 지나갑니다.
 * - 화면에서 벗어나거나 다른 탭을 보면 멈추고,
 *   '동작 줄이기'를 켠 기기에서는 움직이지 않는 한 장면만 그립니다.
 * ========================================================================== */
(function () {
  'use strict';

  var canvas = document.querySelector('[data-hero-canvas]');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var hero = canvas.parentElement;
  var reduceQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var INK = '27, 23, 20';

  var width = 0;
  var height = 0;
  var eels = [];
  var ripples = [];
  var bubbles = [];
  var time = 0;
  var lastFrame = 0;
  var nextRipple = 0;
  var rafId = 0;
  var onScreen = true;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  /* ---------- 장어 ---------- */
  // lane: 화면 높이 대비 위치(0~1), depth: 농도·크기(멀수록 옅고 큼)
  function makeEel(lane, depth, direction, startProgress) {
    var mobile = width < 640;
    var length = Math.max(220, Math.min(width * (mobile ? 0.78 : 0.42), 560)) * (depth === 'far' ? 1.25 : 1);
    return {
      lane: lane,
      depth: depth,
      dir: direction,
      length: length,
      thickness: length * (depth === 'far' ? 0.06 : 0.05),
      speed: rand(22, 34) * (depth === 'far' ? 0.7 : 1),
      amplitude: length * rand(0.055, 0.075),
      waveCount: rand(1.3, 1.7),
      frequency: rand(0.45, 0.6),
      phase: rand(0, Math.PI * 2),
      drift: rand(0, Math.PI * 2),
      opacity: depth === 'far' ? 0.1 : depth === 'mid' ? 0.22 : 0.3,
      x: direction > 0 ? -length + (width + length) * startProgress : width + length - (width + length) * startProgress
    };
  }

  function bodyWidth(s) {
    // s: 0(머리) → 1(꼬리)
    if (s < 0.06) return 0.55 + 0.45 * Math.sqrt(s / 0.06);
    return Math.pow(1 - (s - 0.06) / 0.94, 0.85) * 0.98 + 0.02;
  }

  function spinePoint(eel, s, t) {
    var baseY = height * eel.lane + Math.sin(t * 0.18 + eel.drift) * height * 0.035;
    var x = eel.x - eel.dir * s * eel.length;
    var envelope = 0.3 + 0.7 * s; // 꼬리 쪽으로 갈수록 크게 흔들림
    var y = baseY + Math.sin(s * eel.waveCount * Math.PI * 2 - t * eel.frequency * Math.PI * 2 + eel.phase) * eel.amplitude * envelope;
    return { x: x, y: y };
  }

  function drawEel(eel, t) {
    var segments = 44;
    var points = [];
    for (var i = 0; i <= segments; i++) points.push(spinePoint(eel, i / segments, t));

    var left = [];
    var right = [];
    for (var j = 0; j <= segments; j++) {
      var prev = points[Math.max(0, j - 1)];
      var next = points[Math.min(segments, j + 1)];
      var dx = next.x - prev.x;
      var dy = next.y - prev.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len;
      var ny = dx / len;
      var half = (eel.thickness / 2) * bodyWidth(j / segments);
      left.push({ x: points[j].x + nx * half, y: points[j].y + ny * half });
      right.push({ x: points[j].x - nx * half, y: points[j].y - ny * half });
    }

    var head = points[0];
    var tail = points[segments];
    var gradient = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    gradient.addColorStop(0, 'rgba(' + INK + ',' + eel.opacity + ')');
    gradient.addColorStop(0.55, 'rgba(' + INK + ',' + eel.opacity * 0.75 + ')');
    gradient.addColorStop(1, 'rgba(' + INK + ',0)');

    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (var k = 1; k <= segments; k++) ctx.lineTo(left[k].x, left[k].y);
    for (var m = segments; m >= 0; m--) ctx.lineTo(right[m].x, right[m].y);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // 가슴지느러미 (머리 뒤 작은 잎 모양)
    var finBase = Math.round(segments * 0.1);
    var fb = points[finBase];
    var fn = right[finBase];
    var fAngle = Math.atan2(fn.y - fb.y, fn.x - fb.x) - eel.dir * 0.5;
    var fLen = eel.thickness * 0.9;
    ctx.beginPath();
    ctx.ellipse(fn.x + Math.cos(fAngle) * fLen * 0.5, fn.y + Math.sin(fAngle) * fLen * 0.5, fLen * 0.55, fLen * 0.22, fAngle, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + INK + ',' + eel.opacity * 0.7 + ')';
    ctx.fill();

    // 눈 (가까이 있는 장어만)
    if (eel.depth !== 'far') {
      var eyeBase = points[1];
      var eyeSide = left[1];
      ctx.beginPath();
      ctx.arc(eyeBase.x + (eyeSide.x - eyeBase.x) * 0.35, eyeBase.y + (eyeSide.y - eyeBase.y) * 0.35, Math.max(1.4, eel.thickness * 0.09), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251, 248, 242, ' + Math.min(0.9, eel.opacity * 3) + ')';
      ctx.fill();
    }

    // 등지느러미 쪽 먹선 (붓으로 한 번 그은 듯한 가는 선)
    ctx.beginPath();
    for (var n = 4; n <= segments - 4; n++) {
      var p = left[n];
      if (n === 4) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = 'rgba(' + INK + ',' + eel.opacity * 0.6 + ')';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function updateEel(eel, dt) {
    eel.x += eel.dir * eel.speed * dt;
    var gone = eel.dir > 0 ? eel.x - eel.length > width + 40 : eel.x + eel.length < -40;
    if (gone) {
      // 반대편에서 다시 등장 (높이·속도를 조금씩 바꿔 반복감을 줄임)
      eel.x = eel.dir > 0 ? -40 : width + 40;
      eel.phase = rand(0, Math.PI * 2);
      eel.speed = rand(22, 34) * (eel.depth === 'far' ? 0.7 : 1);
      spawnRipple(eel.dir > 0 ? rand(width * 0.05, width * 0.3) : rand(width * 0.7, width * 0.95), height * eel.lane);
    }
  }

  /* ---------- 물결 ---------- */
  function spawnRipple(x, y) {
    ripples.push({ x: x, y: y, age: 0, life: rand(3.2, 4.4), size: rand(60, 120) * (width < 640 ? 0.7 : 1) });
  }

  function drawRipple(r) {
    var progress = r.age / r.life;
    for (var ring = 0; ring < 3; ring++) {
      var p = progress - ring * 0.14;
      if (p <= 0 || p >= 1) continue;
      var radius = r.size * p;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, radius, radius * 0.32, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(' + INK + ',' + (1 - p) * 0.16 + ')';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  /* ---------- 물방울 ---------- */
  function makeBubble(fromBottom) {
    return {
      x: rand(0, width),
      y: fromBottom ? height + rand(0, height * 0.4) : rand(0, height),
      r: rand(1.4, 4.2),
      speed: rand(10, 24),
      wobble: rand(0, Math.PI * 2)
    };
  }

  function drawBubble(b, t) {
    var x = b.x + Math.sin(t * 0.8 + b.wobble) * 4;
    ctx.beginPath();
    ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(' + INK + ',0.2)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + INK + ',0.16)';
    ctx.fill();
  }

  /* ---------- 장면 구성 ---------- */
  function setup() {
    var rect = hero.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var mobile = width < 640;
    // 위·아래 띠를 지나가는 장어 2마리 + 로고 뒤를 아주 옅게 지나가는 큰 장어 1마리
    eels = [
      makeEel(mobile ? 0.12 : 0.1, 'near', 1, 0.55),
      makeEel(mobile ? 0.78 : 0.82, 'mid', -1, 0.25),
      makeEel(0.5, 'far', 1, 0.05)
    ];
    ripples = [];
    bubbles = [];
    var bubbleCount = mobile ? 10 : 18;
    for (var i = 0; i < bubbleCount; i++) bubbles.push(makeBubble(false));
    spawnRipple(width * 0.18, height * 0.72);
    spawnRipple(width * 0.82, height * 0.3);
    ripples[1].age = 1.6;
  }

  function render(dt) {
    ctx.clearRect(0, 0, width, height);
    time += dt;

    // 물결
    nextRipple -= dt;
    if (nextRipple <= 0) {
      spawnRipple(rand(width * 0.05, width * 0.95), rand(height * 0.1, height * 0.9));
      nextRipple = rand(1.4, 2.6);
    }
    ripples = ripples.filter(function (r) {
      r.age += dt;
      return r.age < r.life;
    });
    ripples.forEach(drawRipple);

    // 장어 (먼 것부터)
    for (var i = eels.length - 1; i >= 0; i--) {
      updateEel(eels[i], dt);
      drawEel(eels[i], time);
    }

    // 물방울
    bubbles.forEach(function (b, index) {
      b.y -= b.speed * dt;
      if (b.y < -10) bubbles[index] = makeBubble(true);
      drawBubble(b, time);
    });
  }

  function loop(now) {
    rafId = 0;
    var dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0.016;
    lastFrame = now;
    render(dt);
    schedule();
  }

  function schedule() {
    if (rafId || reduceQuery.matches || !onScreen || document.hidden) return;
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    lastFrame = 0;
  }

  function drawStill() {
    // 움직이지 않는 한 장면: 장어가 화면 안에 자리 잡은 모습
    time = 3.2;
    render(0);
  }

  function start() {
    setup();
    if (reduceQuery.matches) {
      drawStill();
      return;
    }
    render(0);
    schedule();
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var rect = hero.getBoundingClientRect();
      if (Math.abs(rect.width - width) < 2 && Math.abs(rect.height - height) < 40) return; // 모바일 주소창 높이 변화는 무시
      stop();
      start();
    }, 150);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else schedule();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      if (onScreen) schedule();
      else stop();
    }).observe(hero);
  }

  if (reduceQuery.addEventListener) {
    reduceQuery.addEventListener('change', function () {
      stop();
      start();
    });
  }

  start();
})();
