/* lifttracker.ca · shared script
   Plain JavaScript, no libraries. Each part only runs if its markup exists on
   the page, and nothing animates when the visitor has Reduce Motion turned on. */
(function () {
  'use strict';

  var root = document.documentElement;
  var params = new URLSearchParams(location.search);
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = function (s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  var onVisible = function (el, cb, opts) {
    // Calls cb(true/false) as el enters and leaves the screen.
    new IntersectionObserver(function (entries) { cb(entries[0].isIntersecting); }, opts || {}).observe(el);
  };

  /* ---------- Header: glass after scrolling, light or dark to match the section under it ---------- */
  var nav = $('.nav');
  if (nav) {
    var navTick = false;
    var updateNav = function () {
      navTick = false;
      nav.toggleAttribute('data-elevated', window.scrollY > 8);
      var el = document.elementFromPoint(window.innerWidth / 2, nav.offsetHeight + 2);
      var sec = el && el.closest('[data-nav]');
      nav.setAttribute('data-theme', sec ? sec.getAttribute('data-nav') : 'dark');
    };
    window.addEventListener('scroll', function () { if (!navTick) { navTick = true; requestAnimationFrame(updateNav); } }, { passive: true });
    window.addEventListener('resize', updateNav);
    updateNav();
  }

  /* ---------- Mobile menu ---------- */
  var toggle = $('.nav__toggle');
  var menu = $('#menu');
  if (toggle && menu) {
    var setMenu = function (open, focus) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.toggleAttribute('data-open', open);
      root.classList.toggle('menu-open', open);
      if (open && focus) menu.querySelector('a').focus({ preventScroll: true });
    };
    toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true', true); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); }
    });
    window.matchMedia('(min-width: 900px)').addEventListener('change', function (e) { if (e.matches) setMenu(false); });
  }

  /* ---------- Headlines rise in word by word ---------- */
  $$('[data-split]').forEach(function (el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'); w.className = 'w';
            var inner = document.createElement('span'); inner.textContent = part; inner.style.setProperty('--wi', i++);
            w.appendChild(inner); frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) { walk(child); }
      });
    })(el);
  });

  /* ---------- Reveal: the hero plays on load, everything else as it scrolls in ---------- */
  var intro = $$('.hero [data-reveal], .hero [data-split], .iphone-tilt[data-reveal]');
  var showIntro = function () { intro.forEach(function (el) { el.classList.add('is-in'); }); };
  if (reduce) {
    showIntro();
  } else {
    // Two frames so the fade has a starting point, plus a timer as a safety
    // net in case the browser holds back animation frames.
    requestAnimationFrame(function () { requestAnimationFrame(showIntro); });
    setTimeout(showIntro, 900);
  }
  var reveal = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); reveal.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
  $$('[data-reveal], [data-split]').forEach(function (el) { if (intro.indexOf(el) === -1) reveal.observe(el); });

  /* ---------- The phone: loops in the hero, follows the steps on desktop ---------- */
  var ui = $('#phone-ui');
  if (ui) {
    var desktop = window.matchMedia('(min-width: 1000px)');
    var rows = [1, 2, 3].map(function (n) { return ui.querySelector('[data-row="' + n + '"]'); });
    var TABLE = {
      prefill: ['done', '', ''],
      tap:     ['done', 'done', ''],
      rest:    ['done', 'done', ''],
      pr:      ['done', 'done', 'done pr'],
      warm:    ['', '', ''],
      swap:    ['done', '', '']
    };
    var restEl = ui.querySelector('[data-rest]'), restRing = ui.querySelector('[data-rest-ring]');
    var restTimer = null;
    var setState = function (s) {
      if (ui.getAttribute('data-state') === s) return;
      ui.setAttribute('data-state', s);
      rows.forEach(function (row, i) { row.className = 'ui-row' + (TABLE[s][i] ? ' ' + TABLE[s][i] : ''); });
      clearInterval(restTimer);
      var left = 90;
      restEl.textContent = '1:30'; restRing.style.strokeDashoffset = '0';
      if (s === 'rest' && !reduce) {
        restTimer = setInterval(function () {
          left = Math.max(0, left - 1);
          restEl.textContent = fmt(left);
          restRing.style.strokeDashoffset = (87.96 * (1 - left / 90)).toFixed(2);
        }, 1000);
      }
    };

    var clock = ui.querySelector('[data-clock]'), clockS = +clock.dataset.clock, clockTimer = null, phoneVisible = false;
    var LOOP = [['prefill', 1800], ['tap', 1300], ['rest', 3200], ['pr', 3200]];
    var loopI = 0, loopTimer = null, activeStep = null;
    var runLoop = function () {
      var item = LOOP[loopI % LOOP.length];
      setState(item[0]);
      loopTimer = setTimeout(function () { loopI++; runLoop(); }, item[1]);
    };
    var syncLoop = function () {
      var shouldLoop = phoneVisible && !reduce && !(desktop.matches && activeStep);
      if (shouldLoop && !loopTimer) runLoop();
      if (!shouldLoop && loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
    };
    onVisible($('#phone'), function (vis) {
      phoneVisible = vis;
      clearInterval(clockTimer);
      if (vis && !reduce) clockTimer = setInterval(function () { clock.textContent = fmt(++clockS); }, 1000);
      syncLoop();
    });
    if (reduce) setState('pr');

    // Desktop: whichever step crosses the middle of the screen drives the phone
    var steps = $$('.step');
    var stepTick = false;
    var pickStep = function () {
      stepTick = false;
      var mid = window.innerHeight / 2, found = null;
      for (var i = 0; i < steps.length; i++) {
        var r = steps[i].getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) { found = steps[i]; break; }
      }
      if (found === activeStep) return;
      activeStep = found;
      steps.forEach(function (s) { s.classList.toggle('is-active', s === activeStep); });
      if (desktop.matches && activeStep) {
        if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
        setState(activeStep.getAttribute('data-step'));
      }
      syncLoop();
    };
    window.addEventListener('scroll', function () { if (!stepTick) { stepTick = true; requestAnimationFrame(pickStep); } }, { passive: true });
    window.addEventListener('resize', pickStep);
    window.addEventListener('load', pickStep);
    pickStep();
    desktop.addEventListener('change', function () { activeStep = null; pickStep(); syncLoop(); });

    // Gentle tilt toward the pointer (desktop, fine pointers only)
    var phone = $('#phone');
    if (!reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
      var tilt = function () {
        cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
        phone.style.transform = 'rotateY(' + (cx * 7).toFixed(2) + 'deg) rotateX(' + (-cy * 5).toFixed(2) + 'deg)';
        raf = (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) ? requestAnimationFrame(tilt) : null;
      };
      var stageEl = $('.stage-bg');
      stageEl.addEventListener('pointermove', function (e) {
        var r = phone.getBoundingClientRect();
        tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
        ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
        if (!raf) raf = requestAnimationFrame(tilt);
      });
      stageEl.addEventListener('pointerleave', function () { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(tilt); });
    }

    // Review helper: ?state=rest freezes the phone on one state
    if (params.get('state')) { reduce = true; clearTimeout(loopTimer); loopTimer = null; setState(params.get('state')); }
  }

  /* ---------- Progress: the overview cycles through time ranges while on screen ---------- */
  var ranges = $('[data-ranges]');
  if (ranges && !reduce) {
    var labels = $$('.range span', ranges), vals = $$('[data-v]', ranges), sess = $$('[data-s]', ranges);
    var ri = 1, rt = null;
    var showRange = function (i) {
      labels.forEach(function (l, j) { l.classList.toggle('on', j === i); });
      vals.forEach(function (v, j) {
        v.style.opacity = '0';
        setTimeout(function () {
          v.textContent = v.dataset.v.split(',')[i] + ' lbs';
          sess[j].textContent = sess[j].dataset.s.split(',')[i] + ' sessions';
          v.style.opacity = '1';
        }, 220);
      });
    };
    onVisible(ranges, function (vis) {
      clearInterval(rt);
      if (vis) rt = setInterval(function () { ri = (ri + 1) % 4; showRange(ri); }, 2600);
    }, { threshold: 0.4 });
  }

  /* ---------- Strength card: the workout colour cycles through the app's palette ---------- */
  var sw = $('[data-swatches]');
  if (sw && !reduce) {
    var dots = $$('i', sw), target = $(sw.dataset.swatches), si = 0, st = null;
    var rgba = function (hex, a) {
      var n = parseInt(hex.slice(1), 16);
      return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    };
    var paint = function (i) {
      var hex = dots[i].dataset.hex;
      dots.forEach(function (d, j) { d.classList.toggle('on', j === i); });
      target.style.setProperty('--wc', hex);
      target.style.setProperty('--wc-tint', rgba(hex, 0.14));
      target.style.setProperty('--wc-line', rgba(hex, 0.26));
      target.style.setProperty('--wc-done', rgba(hex, 0.55));
    };
    onVisible(sw, function (vis) {
      clearInterval(st);
      if (vis) st = setInterval(function () { si = (si + 1) % dots.length; paint(si); }, 2200);
    });
  }

  /* ---------- Circuit card: a work timer that counts down, round by round ---------- */
  var circ = $('[data-circuit]');
  if (circ && !reduce) {
    var work = 40, t = work, round = 1, exI = 0, ct = null;
    var EX = ['Kettlebell Swing', 'Burpee', 'Thruster', 'Goblet Squat', 'Dumbbell Snatch'];
    var num = $('[data-c-time]', circ), ring = $('[data-c-ring]', circ), exEl = $('[data-c-ex]', circ), nextEl = $('[data-c-next]', circ);
    var roundEl = $('[data-c-round]', circ), rdots = $$('.circ__dots i', circ);
    var C = 2 * Math.PI * 74;
    var tick = function () {
      t -= 1;
      if (t < 0) {
        t = work; exI = (exI + 1) % EX.length;
        if (exI === 0) { round = round % 4 + 1; }
        exEl.textContent = EX[exI];
        nextEl.textContent = EX[(exI + 1) % EX.length];
        roundEl.textContent = 'ROUND ' + round + ' OF 4';
        rdots.forEach(function (d, j) { d.classList.toggle('on', j < round); });
      }
      num.textContent = t;
      ring.style.strokeDashoffset = (C * (1 - t / work)).toFixed(1);
    };
    onVisible(circ, function (vis) { clearInterval(ct); if (vis) ct = setInterval(tick, 1000); });
  }

  /* ---------- Library: count up to 277; the marquee only runs on screen ---------- */
  var count = $('[data-count]');
  if (count && !reduce) {
    var goal = +count.dataset.count;
    count.textContent = '0';
    var counted = false;
    onVisible(count, function (vis) {
      if (!vis || counted) return;
      counted = true;
      var t0 = performance.now(), dur = 1600;
      (function step(now) {
        var p = Math.min(1, (now - t0) / dur);
        count.textContent = Math.round(goal * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }, { threshold: 0.5 });
  }
  var marquee = $('.marquee');
  if (marquee) onVisible(marquee, function (vis) { marquee.classList.toggle('paused', !vis); });

  /* ---------- Review helpers (no effect for normal visitors) ---------- */
  if (params.has('menu') && toggle) toggle.click();
  if (params.has('static')) $$('[data-reveal], [data-split]').forEach(function (el) { el.classList.add('is-in'); });
})();
