/* ============================================================
   Layz - shared shell
   theme / intro / page transitions / custom cursor /
   reveals / toasts / clipboard / saved collection
   ============================================================ */
(function (global) {
  'use strict';

  var doc = document;
  var reduceMotion = global.matchMedia &&
    global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- storage ---------------- */
  function store(key, value) {
    try {
      if (value === undefined) { return localStorage.getItem(key); }
      localStorage.setItem(key, value);
    } catch (e) { /* private mode */ }
    return value;
  }

  /* ---------------- scroll lock ----------------
     Three separate things can freeze the page: the mobile menu, the intro,
     and any overlay panel. Each used to write body.style.overflow directly
     and clear it to '' on the way out, so whichever closed LAST unlocked the
     page even while another holder was still open. Count the holders and
     only release on the last one. */
  var scrollLocks = 0;

  function lockScroll() {
    scrollLocks++;
    doc.body.style.overflow = 'hidden';
  }

  function unlockScroll() {
    if (scrollLocks === 0) { return; }
    scrollLocks--;
    if (scrollLocks === 0) { doc.body.style.overflow = ''; }
  }

  /* ---------------- theme ---------------- */
  var THEME_KEY = 'layz.theme';

  function applyTheme(theme) {
    doc.documentElement.setAttribute('data-theme', theme);
    var btn = doc.querySelector('[data-theme-toggle]');
    if (btn) {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
    /* keep the browser chrome in step with the page, not with the OS */
    var meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) { meta.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#ffffff'); }
  }

  function initTheme() {
    /* Light is the default for everyone. The OS preference is deliberately
       ignored - only an explicit toggle, remembered in layz.theme, switches
       the site to dark. */
    var saved = store(THEME_KEY);
    applyTheme(saved === 'dark' ? 'dark' : 'light');

    /* footer entry point back into the consent choice */
    doc.addEventListener('click', function (e) {
      var open = e.target.closest && e.target.closest('[data-consent-open]');
      if (open && global.LayzConsent) {
        e.preventDefault();
        global.LayzConsent.open();
      }
    });

    doc.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-theme-toggle]');
      if (!btn) { return; }
      var next = doc.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      store(THEME_KEY, next);
    });
  }

  /* ---------------- toast ---------------- */
  var toastTimer = null;
  function toast(message) {
    var el = doc.querySelector('.toast');
    if (!el) {
      el = doc.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      doc.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-visible'); }, 2200);
  }

  /* ---------------- clipboard ---------------- */
  function legacyCopy(text) {
    var ta = doc.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0;';
    doc.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
    doc.body.removeChild(ta);
    return ok;
  }

  function copy(text, message) {
    var done = function () { toast(message || 'Copied'); };
    var fail = function () { toast('Could not copy'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        if (legacyCopy(text)) { done(); } else { fail(); }
      });
    } else if (legacyCopy(text)) { done(); } else { fail(); }
  }

  /* ---------------- reveals ---------------- */
  function reveal(el) {
    el.classList.remove('reveal-armed');
    el.classList.add('is-revealed');
  }

  function initReveal(root) {
    var nodes = (root || doc).querySelectorAll(
      '[data-reveal]:not(.is-revealed), .rule-draw:not(.is-revealed)');
    if (!nodes.length) { return; }

    /* No animation wanted or possible - leave everything as it already is. */
    if (reduceMotion || !('IntersectionObserver' in global)) {
      nodes.forEach(function (n) { n.classList.add('is-revealed'); });
      return;
    }

    var list = Array.prototype.slice.call(nodes);
    list.forEach(function (n) { n.classList.add('reveal-armed'); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        var el = entry.target;
        var delay = parseFloat(el.getAttribute('data-reveal-delay') || 0);
        setTimeout(function () { reveal(el); }, delay * 1000);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0 });

    list.forEach(function (n) { io.observe(n); });

    /* Backstop: anything still armed but on screen gets revealed anyway, so a
       missed observer callback can never leave real content invisible. */
    var sweep = function () {
      var vh = global.innerHeight || 0;
      for (var i = list.length - 1; i >= 0; i--) {
        var n = list[i];
        if (!n.classList.contains('reveal-armed')) { list.splice(i, 1); continue; }
        var r = n.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) { reveal(n); io.unobserve(n); list.splice(i, 1); }
      }
    };
    doc.addEventListener('scroll', debounce(sweep, 200), { passive: true });
    global.addEventListener('resize', debounce(sweep, 200));
    setTimeout(sweep, 1200);
    setTimeout(sweep, 3000);
  }

  /* ---------------- header ---------------- */
  function initHeader() {
    var header = doc.querySelector('.site-header');
    if (!header) { return; }

    var burger = header.querySelector('[data-nav-toggle]');
    if (burger) {
      burger.addEventListener('click', function () {
        var open = header.classList.toggle('is-open');
        burger.setAttribute('aria-expanded', String(open));
        if (open) { lockScroll(); } else { unlockScroll(); }
      });
      header.querySelectorAll('.nav a').forEach(function (a) {
        a.addEventListener('click', function () {
          /* On desktop the menu is never open, so without this guard every
             nav click would release a lock it never took. */
          if (!header.classList.contains('is-open')) { return; }
          header.classList.remove('is-open');
          unlockScroll();
          burger.setAttribute('aria-expanded', 'false');
        });
      });
    }

    /* Mark the active page. "Fonts" and "Saved" share fonts.html, so match
       the query string first and only fall back to the bare filename. */
    var file = location.pathname.split('/').pop() || 'index.html';
    var links = Array.prototype.slice.call(header.querySelectorAll('.nav a[href]'));
    var exact = links.filter(function (a) {
      return a.getAttribute('href').split('#')[0] === file + location.search;
    });
    if (exact.length) { exact[0].setAttribute('aria-current', 'page'); return; }
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href').split('#')[0];
      if (href.split('?')[0] === file && href.indexOf('?') === -1) {
        links[i].setAttribute('aria-current', 'page');
        return;
      }
    }
  }

  /* ---------------- page transitions ----------------
     The reference wipes the incoming page up behind a clip-path while the
     outgoing one scales back and dims. Same two moves, a little quicker. */
  function initTransitions() {
    /* page-enter clips the whole body, so the class must not outlive the
       animation - otherwise a stalled or unsupported animation leaves the
       page permanently invisible. Drop it on animationend, with a timer as
       the backstop. */
    doc.body.classList.add('page-in');
    var clearEnter = function () { doc.body.classList.remove('page-in'); };
    doc.body.addEventListener('animationend', function (e) {
      if (e.animationName === 'page-enter') { clearEnter(); }
    });
    setTimeout(clearEnter, 1600);

    if (reduceMotion) { return; }

    doc.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) { return; }
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) { return; }
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(https?:|mailto:|tel:)/.test(href)) { return; }
      if (a.href === location.href) { return; }
      e.preventDefault();
      doc.body.classList.remove('page-in');
      doc.body.classList.add('page-out');
      setTimeout(function () { location.href = a.href; }, 430);
    });

    global.addEventListener('pageshow', function (ev) {
      if (ev.persisted) { doc.body.classList.remove('page-out'); }
    });
  }

  /* ---------------- intro ----------------
     A hairline square that fills from the bottom, then lifts away.
     Once per session, so it never gets in the way of real work. */
  function initIntro() {
    var intro = doc.querySelector('.intro');
    if (!intro) { return; }

    var seen = false;
    try { seen = sessionStorage.getItem('layz.intro') === '1'; } catch (e) {}

    if (seen || reduceMotion) {
      intro.parentNode.removeChild(intro);
      return;
    }
    try { sessionStorage.setItem('layz.intro', '1'); } catch (e) {}

    lockScroll();
    requestAnimationFrame(function () { intro.classList.add('is-filling'); });

    var counter = intro.querySelector('.intro-count');
    var start = Date.now();
    var tick = setInterval(function () {
      var pct = Math.min(Math.round((Date.now() - start) / 10), 100);
      if (counter) { counter.textContent = String(pct).padStart(3, '0'); }
      if (pct >= 100) { clearInterval(tick); }
    }, 40);

    setTimeout(function () {
      intro.classList.add('is-done');
      unlockScroll();
      setTimeout(function () {
        if (intro.parentNode) { intro.parentNode.removeChild(intro); }
      }, 600);
    }, 1100);
  }

  /* ---------------- custom cursor ----------------
     8px square riding on mix-blend-mode: difference, with a label that
     slides up when it is over something interactive. */
  function initCursor() {
    if (reduceMotion) { return; }
    if (global.matchMedia && global.matchMedia('(pointer: coarse)').matches) { return; }

    var layer = doc.createElement('div');
    layer.className = 'cursor-layer';
    layer.innerHTML = '<div class="cursor-dot"></div><div class="cursor-label"><span></span></div>';
    doc.body.appendChild(layer);
    var labelEl = layer.querySelector('.cursor-label span');

    /* the system pointer is only hidden now that its replacement exists */
    doc.documentElement.classList.add('cursor-hidden');

    var HOT = 'a, button, [role="button"], input, select, textarea, [contenteditable="true"], [data-cursor]';

    var live = false;
    var lastTarget = null;

    /* The dot tracks the pointer 1:1. Any easing here reads as lag, which is
       the one thing a cursor must never do. Chrome already coalesces
       mousemove to one dispatch per frame, so writing the transform straight
       from the handler is both the cheapest and the most immediate option -
       and unlike a rAF loop it cannot stall if frames are throttled. */
    doc.addEventListener('mousemove', function (e) {
      layer.style.transform =
        'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0)';

      if (!live) {
        live = true;
        layer.classList.add('is-live');
      }

      /* Hit-testing walks the whole ancestor chain, so only redo it when the
         element under the pointer actually changes - not on every event. */
      if (e.target === lastTarget) { return; }
      lastTarget = e.target;

      var hot = e.target.closest(HOT);
      if (!hot) {
        layer.classList.remove('is-hot');
        return;
      }
      layer.classList.add('is-hot');
      var text = hot.getAttribute('data-cursor');
      if (!text) {
        var tag = hot.tagName;
        text = tag === 'A' ? 'Open'
          : (tag === 'INPUT' || tag === 'TEXTAREA' || hot.isContentEditable) ? 'Type'
          : 'Click';
      }
      if (labelEl.textContent !== text) { labelEl.textContent = text; }
    }, { passive: true });

    doc.addEventListener('mouseleave', function () { layer.classList.remove('is-live'); });
    doc.addEventListener('mouseenter', function () { layer.classList.add('is-live'); });
  }

  /* ---------------- saved collection ---------------- */
  var SAVE_KEY = 'layz.saved.v1';

  /* A blob written by an earlier version only carries the keys that existed
     then. Normalising on read lets a new collection be added later without
     every consumer having to guard against an undefined array - reading
     .palettes.length on a pre-existing shortlist would otherwise throw. */
  function normalizeSaved(d) {
    if (!d || typeof d !== 'object') { d = {}; }
    if (!Array.isArray(d.fonts)) { d.fonts = []; }
    if (!Array.isArray(d.pairs)) { d.pairs = []; }
    if (!Array.isArray(d.palettes)) { d.palettes = []; }
    return d;
  }

  function readSaved() {
    try { return normalizeSaved(JSON.parse(store(SAVE_KEY) || '{}')); }
    catch (e) { return normalizeSaved(null); }
  }
  function writeSaved(data) {
    store(SAVE_KEY, JSON.stringify(data));
    doc.dispatchEvent(new CustomEvent('layz:saved', { detail: data }));
  }

  var saved = {
    all: readSaved,
    hasFont: function (name) { return readSaved().fonts.indexOf(name) !== -1; },
    toggleFont: function (name) {
      var d = readSaved();
      var i = d.fonts.indexOf(name);
      if (i === -1) { d.fonts.push(name); } else { d.fonts.splice(i, 1); }
      writeSaved(d);
      return i === -1;
    },
    pairKey: function (p) { return p.title + '|' + p.body; },
    hasPair: function (p) {
      var key = saved.pairKey(p);
      return readSaved().pairs.some(function (x) { return saved.pairKey(x) === key; });
    },
    togglePair: function (p) {
      var d = readSaved();
      var key = saved.pairKey(p);
      var i = -1;
      d.pairs.forEach(function (x, idx) { if (saved.pairKey(x) === key) { i = idx; } });
      if (i === -1) { d.pairs.unshift(p); } else { d.pairs.splice(i, 1); }
      writeSaved(d);
      return i === -1;
    },
    removePair: function (p) {
      var d = readSaved();
      var key = saved.pairKey(p);
      d.pairs = d.pairs.filter(function (x) { return saved.pairKey(x) !== key; });
      writeSaved(d);
    },

    /* Palettes from the lab. Keyed on the whole recipe rather than the mood
       name, so two variants of the same mood are two separate saves. */
    paletteKey: function (p) {
      return [p.mood, p.title, p.body,
        p.light.bg, p.light.fg, p.light.accent,
        p.dark.bg, p.dark.fg, p.dark.accent].join('|');
    },
    palettes: function () { return readSaved().palettes; },
    hasPalette: function (p) {
      var key = saved.paletteKey(p);
      return readSaved().palettes.some(function (x) { return saved.paletteKey(x) === key; });
    },
    togglePalette: function (p) {
      var d = readSaved();
      var key = saved.paletteKey(p);
      var i = -1;
      d.palettes.forEach(function (x, idx) { if (saved.paletteKey(x) === key) { i = idx; } });
      if (i === -1) { d.palettes.unshift(p); } else { d.palettes.splice(i, 1); }
      writeSaved(d);
      return i === -1;
    },
    removePalette: function (p) {
      var d = readSaved();
      var key = saved.paletteKey(p);
      d.palettes = d.palettes.filter(function (x) { return saved.paletteKey(x) !== key; });
      writeSaved(d);
    }
  };

  /* ---------------- helpers ---------------- */
  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function param(name) { return new URLSearchParams(location.search).get(name); }

  /* Merge keys into the current query string instead of rebuilding it, so
     one feature writing its own state cannot wipe the params another feature
     owns. A null / undefined / '' value deletes the key.
     file:// documents have a null origin and reject history writes, so the
     whole thing is a no-op when the site is opened from disk. */
  function setParams(updates, opts) {
    var qs = new URLSearchParams(location.search);
    Object.keys(updates).forEach(function (k) {
      var v = updates[k];
      if (v === null || v === undefined || v === '') { qs.delete(k); }
      else { qs.set(k, v); }
    });
    var str = qs.toString();
    var url = location.pathname + (str ? '?' + str : '') + location.hash;
    try {
      if (opts && opts.push) { history.pushState(null, '', url); }
      else { history.replaceState(null, '', url); }
    } catch (e) { /* running from disk - skip */ }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pad(n, width) { return String(n).padStart(width || 3, '0'); }

  function countUp(el, to, duration) {
    if (reduceMotion) { el.textContent = to; return; }
    var start = null;
    function step(ts) {
      if (!start) { start = ts; }
      var p = Math.min((ts - start) / (duration || 1200), 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * eased);
      if (p < 1) { requestAnimationFrame(step); }
    }
    requestAnimationFrame(step);
  }

  /* ---------------- boot ---------------- */
  function init() {
    initTheme();
    initIntro();
    initHeader();
    initReveal();
    initTransitions();
    initCursor();
    var year = doc.querySelector('[data-year]');
    if (year) { year.textContent = new Date().getFullYear(); }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.Layz = {
    toast: toast,
    copy: copy,
    saved: saved,
    debounce: debounce,
    param: param,
    setParams: setParams,
    escapeHtml: escapeHtml,
    pad: pad,
    countUp: countUp,
    initReveal: initReveal,
    lockScroll: lockScroll,
    unlockScroll: unlockScroll,
    reduceMotion: reduceMotion
  };
})(window);
