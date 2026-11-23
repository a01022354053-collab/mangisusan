/* ==========================================================================
 * 메뉴판 움직이는 장식 (SVG) — 움직임은 style.css 의 '메뉴판 움직이는 장식'
 *   grill   : 숯불 위 석쇠 — 숯이 빛나고 연기·불티가 오름 (대표 가격 띠)
 *   pot     : 김이 오르는 뚝배기 (식사)
 *   fizz    : 기포가 오르는 잔 (음료)
 *   bag     : 살랑이는 포장 봉투 (포장)
 * 화면에 보일 때만 움직이고, '동작 줄이기' 설정이면 멈춰 있습니다.
 * ========================================================================== */
window.MENU_ART = {
  grill:
    '<svg class="art art--grill" viewBox="0 0 240 150" aria-hidden="true" focusable="false">' +
      '<defs>' +
        '<radialGradient id="art-coal-glow" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="#ff8a2b" stop-opacity=".9"/><stop offset=".55" stop-color="#e2541c" stop-opacity=".45"/><stop offset="1" stop-color="#e2541c" stop-opacity="0"/></radialGradient>' +
        '</defs>' +
      // 연기
      '<g class="art-smoke" fill="none" stroke="#8a7c70" stroke-width="2.4" stroke-linecap="round">' +
        '<path class="art-smoke__p art-smoke__p--1" d="M78 62 c-7 -7 6 -12 0 -20 c-6 -8 7 -12 1 -20"/>' +
        '<path class="art-smoke__p art-smoke__p--2" d="M120 58 c-7 -7 6 -12 0 -20 c-6 -8 7 -12 1 -20"/>' +
        '<path class="art-smoke__p art-smoke__p--3" d="M160 62 c-7 -7 6 -12 0 -20 c-6 -8 7 -12 1 -20"/>' +
      '</g>' +
      // 숯불 받침과 숯
      '<ellipse class="art-coal-halo" cx="120" cy="116" rx="112" ry="30" fill="url(#art-coal-glow)"/>' +
      '<path d="M14 120 h212 l-8 22 h-196 z" fill="#3a2a20"/>' +
      '<path d="M14 120 h212" stroke="#1e1612" stroke-width="2"/>' +
      '<g class="art-coals">' +
        '<path d="M22 122 l10 -12 l18 2 l6 12 z" fill="#1d1916"/><path class="art-ember art-ember--1" d="M30 118 l6 -6 l10 1" stroke="#ff7a2a" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
        '<path d="M52 122 l8 -14 l22 -2 l8 16 z" fill="#25201c"/><path class="art-ember art-ember--2" d="M62 112 l16 -2 l5 9" stroke="#ff9a3c" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
        '<path d="M86 122 l10 -13 l20 0 l8 13 z" fill="#1d1916"/><path class="art-ember art-ember--3" d="M98 113 l14 0" stroke="#ff7a2a" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
        '<path d="M120 122 l6 -15 l24 -1 l10 16 z" fill="#25201c"/><path class="art-ember art-ember--4" d="M128 112 l20 -1 l4 6" stroke="#ffb04a" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
        '<path d="M156 122 l10 -12 l20 1 l6 11 z" fill="#1d1916"/><path class="art-ember art-ember--5" d="M168 113 l14 1" stroke="#ff7a2a" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
        '<path d="M190 122 l8 -13 l16 1 l6 12 z" fill="#25201c"/><path class="art-ember art-ember--6" d="M199 113 l11 1 l3 5" stroke="#ff9a3c" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '</g>' +
      // 석쇠
      '<g fill="none" stroke="#2b2622" stroke-linecap="round">' +
        '<path d="M42 78 h156 l18 26 h-192 z" stroke-width="2.6"/>' +
        '<path d="M62 78 l-12 26 M82 78 l-8 26 M102 78 l-4 26 M122 78 l0 26 M142 78 l4 26 M162 78 l8 26 M182 78 l12 26" stroke-width="1.3" opacity=".8"/>' +
        '<path d="M33 91 h174" stroke-width="1.3" opacity=".8"/>' +
      '</g>' +
      // 튀는 불티
      '<g fill="#ffb347">' +
        '<circle class="art-spark art-spark--1" cx="44" cy="108" r="1.8"/><circle class="art-spark art-spark--2" cx="96" cy="106" r="1.6"/>' +
        '<circle class="art-spark art-spark--3" cx="146" cy="108" r="1.8"/><circle class="art-spark art-spark--4" cx="200" cy="106" r="1.6"/>' +
      '</g>' +
    '</svg>',

  pot:
    '<svg class="art art--pot" viewBox="0 0 96 84" aria-hidden="true" focusable="false">' +
      '<g class="art-steam" fill="none" stroke="#9c8f84" stroke-width="2.2" stroke-linecap="round">' +
        '<path class="art-steam__p art-steam__p--1" d="M34 34 c-5 -5 5 -9 0 -15 c-5 -6 5 -9 1 -15"/>' +
        '<path class="art-steam__p art-steam__p--2" d="M48 32 c-5 -5 5 -9 0 -15 c-5 -6 5 -9 1 -15"/>' +
        '<path class="art-steam__p art-steam__p--3" d="M62 34 c-5 -5 5 -9 0 -15 c-5 -6 5 -9 1 -15"/>' +
      '</g>' +
      '<path d="M10 46 h-4 a4 4 0 0 0 0 8 h6 M86 46 h4 a4 4 0 0 1 0 8 h-6" fill="none" stroke="#2c201b" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M11 46 C12 68 28 78 48 78 C68 78 84 68 85 46 Z" fill="#3b2a22"/>' +
      '<path d="M20 56 C24 66 34 71 44 72" fill="none" stroke="#6b5243" stroke-width="2" stroke-linecap="round"/>' +
      '<ellipse cx="48" cy="46" rx="38" ry="8" fill="#2c201b"/>' +
      '<ellipse class="art-broth" cx="48" cy="46" rx="32" ry="5.5" fill="#a4471c"/>' +
      '<circle cx="38" cy="45" r="1.6" fill="#7da34a"/><circle cx="52" cy="47" r="1.4" fill="#7da34a"/><circle cx="60" cy="44.5" r="1.5" fill="#7da34a"/><circle cx="45" cy="44" r="1.2" fill="#e9c27a"/>' +
      '<ellipse cx="48" cy="80" rx="30" ry="3" fill="#1b1714" opacity=".15"/>' +
    '</svg>',

  fizz:
    '<svg class="art art--fizz" viewBox="0 0 60 84" aria-hidden="true" focusable="false">' +
      '<defs><clipPath id="art-fizz-clip"><path d="M14 22 l4 54 h24 l4 -54 z"/></clipPath></defs>' +
      '<path d="M14 22 l4 54 h24 l4 -54 z" fill="#fff" fill-opacity=".7"/>' +
      '<g clip-path="url(#art-fizz-clip)">' +
        '<rect x="10" y="34" width="40" height="46" fill="#e3a83b"/>' +
        '<g fill="#fff6dc">' +
          '<circle class="art-bubble art-bubble--1" cx="24" cy="74" r="1.8"/><circle class="art-bubble art-bubble--2" cx="31" cy="74" r="1.4"/>' +
          '<circle class="art-bubble art-bubble--3" cx="37" cy="74" r="1.8"/><circle class="art-bubble art-bubble--4" cx="28" cy="74" r="1.2"/>' +
        '</g>' +
      '</g>' +
      '<path class="art-foam" d="M13 34 c3 -6 8 -6 10 -3 c2 -5 9 -5 11 -1 c2 -4 9 -4 13 2 l-1 5 h-32 z" fill="#fbf6ea" stroke="#d9cdb8" stroke-width="1"/>' +
      '<path d="M14 22 l4 54 h24 l4 -54" fill="none" stroke="#3a302a" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<path d="M19 40 l2 30" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>',

  bag:
    '<svg class="art art--bag" viewBox="0 0 64 80" aria-hidden="true" focusable="false">' +
      '<g class="art-bag">' +
        '<path d="M22 24 c0 -14 20 -14 20 0" fill="none" stroke="#3a302a" stroke-width="2.6" stroke-linecap="round"/>' +
        '<path d="M10 24 h44 l4 50 h-52 z" fill="#c9a274" stroke="#8a6a44" stroke-width="1.6" stroke-linejoin="round"/>' +
        '<path d="M10 24 l6 8 h32 l6 -8" fill="#b48d5e"/>' +
        '<circle cx="32" cy="52" r="11" fill="#a8141b"/>' +
        '<text x="32" y="55.5" font-size="9" font-weight="800" text-anchor="middle" fill="#f6efe3">포장</text>' +
      '</g>' +
    '</svg>'
};
