/* ============================================================
   Layz - Lab / Colour & Font Contrast
   ------------------------------------------------------------
   Checks a text/background pair against WCAG 2.1 in real time,
   for both a light palette and its dark-mode counterpart, and
   shows the result at the three sizes the spec actually cares
   about (normal, large, and non-text UI).

   The preview surface carries data-palette and two inline custom
   properties. base.css re-derives the whole token set for any
   element with that attribute, so --line, --fg-50 and every
   component inside the canvas recolour with the palette instead
   of staying pinned to the site's own theme.

   No document-level key handlers live here on purpose: the site
   already binds single letters on other pages and the lab is
   full of buttons that would swallow them.
   ============================================================ */
(function () {
  'use strict';

  var D = window.LayzData;
  var L = window.Layz;
  var F = window.LayzFonts;
  var P = window.LayzPairs;
  var Lab = window.LayzLab;

  var $ = function (id) { return document.getElementById(id); };

  var panel = $('toolContrast');
  if (!panel) { return; }

  var el = {
    canvas: $('ctCanvas'),
    bg: $('ctBg'),
    fg: $('ctFg'),
    bgHex: $('ctBgHex'),
    fgHex: $('ctFgHex'),
    ratio: $('ctRatio'),
    verdict: $('ctVerdict'),
    other: $('ctOther'),
    titleFont: $('ctTitleFont'),
    bodyFont: $('ctBodyFont'),
    fontList: $('ctFontList'),
    grades: $('ctGrades'),
    code: $('ctCode')
  };

  /* Track whether the user has ever edited the dark palette. Until they
     have, flipping to dark seeds it from the light one - landing on the
     stock #0a0a0a would throw away the hue they just chose. */
  var darkTouched = false;
  try { darkTouched = localStorage.getItem('layz.lab.darkTouched') === '1'; }
  catch (e) {}

  /* ---------------- font pickers ---------------- */

  /* 336 curated families rather than all 1638 - a datalist that long makes
     the dropdown unusable. Any name in the catalogue still resolves if it
     is typed in full. */
  (function buildFontList() {
    var html = '';
    for (var i = 0; i < D.FONTS.length; i++) {
      if (D.FONTS[i].curated) {
        html += '<option value="' + L.escapeHtml(D.FONTS[i].name) + '"></option>';
      }
    }
    el.fontList.innerHTML = html;
  })();

  /* ---------------- rendering ---------------- */

  function rgbTriple(hex) { return Lab.toRgb(hex).join(', '); }

  function applyPalette(p) {
    el.canvas.style.setProperty('--bg-rgb', rgbTriple(p.bg));
    el.canvas.style.setProperty('--fg-rgb', rgbTriple(p.fg));
    el.canvas.style.setProperty('--accent', p.accent);

    el.bg.value = p.bg;
    el.fg.value = p.fg;
    /* Don't fight the user mid-keystroke in the hex field. */
    if (document.activeElement !== el.bgHex) { el.bgHex.value = p.bg; }
    if (document.activeElement !== el.fgHex) { el.fgHex.value = p.fg; }
  }

  function applyFonts(s) {
    var t = D.BY_NAME[s.title];
    var b = D.BY_NAME[s.body];
    if (!t || !b) { return; }

    /* The css2 endpoint silently ignores a weight a family does not ship, so
       ask for the nearest real cut and render the headline at that same one -
       otherwise the preview quietly lies on single-weight display faces. */
    var tw = P.headingWeight(t);
    F.load(t.name, { priority: true, weights: tw === 400 ? null : '400;' + tw });
    F.load(b.name, { priority: true, weights: '400;700' });

    /* Set on the canvas rather than per node. Everything inside it reads the
       pair from these three properties, so the component tester can drop new
       markup in later without touching this function. */
    el.canvas.style.setProperty('--ct-title', t.stack);
    el.canvas.style.setProperty('--ct-body', b.stack);
    el.canvas.style.setProperty('--ct-title-weight', String(tw));

    if (document.activeElement !== el.titleFont) { el.titleFont.value = t.name; }
    if (document.activeElement !== el.bodyFont) { el.bodyFont.value = b.name; }
  }

  function gradeRow(label, needed, pass, note) {
    return '<div class="ct-grade' + (pass ? ' is-pass' : ' is-fail') + '">' +
      '<span class="ct-grade-mark" aria-hidden="true">' + (pass ? '✓' : '✕') + '</span>' +
      '<span class="ct-grade-label label">' + label + '</span>' +
      '<span class="ct-grade-need label label--soft">needs ' + needed.toFixed(1) + ':1</span>' +
      '<span class="ct-grade-note label label--soft">' + note + '</span>' +
      '<span class="sr-only">' + (pass ? 'Passes' : 'Fails') + '</span>' +
    '</div>';
  }

  function renderReadout(s) {
    var p = Lab.palette(s.mode);
    var ratio = Lab.contrast(p.fg, p.bg);
    var g = Lab.grade(ratio);

    el.ratio.textContent = ratio.toFixed(2) + ':1';
    el.ratio.classList.toggle('is-fail', !g.aaLarge);

    var top = Lab.badge(ratio, false);
    el.verdict.textContent =
      top === 'Fail' ? 'Fails AA' :
      top === 'AA Large' ? 'Large text only' :
      'Passes ' + top;
    /* "AA Large" means body copy still fails, so it reads as a failure here -
       the badge is about the headline, the verdict is about the page. */
    el.verdict.classList.toggle('is-fail', top === 'Fail' || top === 'AA Large');

    el.grades.innerHTML =
      gradeRow('AA &middot; normal text', 4.5, g.aa, 'body copy under 24px') +
      gradeRow('AAA &middot; normal text', 7, g.aaa, 'the enhanced bar') +
      gradeRow('AA &middot; large text', 3, g.aaLarge, '24px+, or 18.66px bold') +
      gradeRow('AAA &middot; large text', 4.5, g.aaaLarge, 'enhanced, large') +
      gradeRow('AA &middot; UI &amp; graphics', 3, g.ui, 'borders, icons, focus rings');

    /* The counterpart mode, always visible. A palette that passes in light
       and fails in dark is the single most common accessibility regression
       when a site ships a theme toggle. */
    var otherMode = s.mode === 'light' ? 'dark' : 'light';
    var op = Lab.palette(otherMode);
    var oRatio = Lab.contrast(op.fg, op.bg);
    var oTop = Lab.badge(oRatio, false);
    /* The spaces between these spans are load-bearing: without them a screen
       reader runs the three labels together as "light counterpart17.93:1AAA". */
    el.other.innerHTML =
      '<span class="label label--soft">' + otherMode + ' counterpart</span> ' +
      '<span class="ct-other-ratio' + (oTop === 'Fail' ? ' is-fail' : '') + '">' +
        oRatio.toFixed(2) + ':1</span> ' +
      '<span class="label' + (oTop === 'Fail' ? ' is-fail' : ' label--soft') + '">' +
        (oTop === 'Fail' ? 'Fails AA' : oTop) + '</span>';

    renderCode(s, ratio, oRatio);
  }

  function renderCode(s, ratio, oRatio) {
    var t = D.BY_NAME[s.title];
    var b = D.BY_NAME[s.body];
    if (!t || !b) { return; }

    var light = Lab.palette('light');
    var dark = Lab.palette('dark');
    var lightRatio = s.mode === 'light' ? ratio : oRatio;
    var darkRatio = s.mode === 'dark' ? ratio : oRatio;

    /* --brand-* rather than --bg / --fg: the site's own tokens use those
       names, and handing someone CSS that overwrites their theme layer is a
       trap, not a convenience. */
    el.code.textContent =
      ':root {\n' +
      '  /* ' + lightRatio.toFixed(2) + ':1 - ' + Lab.badge(lightRatio, false) + ' */\n' +
      '  --brand-bg: ' + light.bg + ';\n' +
      '  --brand-fg: ' + light.fg + ';\n' +
      '  --brand-accent: ' + light.accent + ';\n' +
      '  --font-title: ' + t.stack + ';\n' +
      '  --font-body: ' + b.stack + ';\n' +
      '}\n\n' +
      '@media (prefers-color-scheme: dark) {\n' +
      '  :root {\n' +
      '    /* ' + darkRatio.toFixed(2) + ':1 - ' + Lab.badge(darkRatio, false) + ' */\n' +
      '    --brand-bg: ' + dark.bg + ';\n' +
      '    --brand-fg: ' + dark.fg + ';\n' +
      '    --brand-accent: ' + dark.accent + ';\n' +
      '  }\n' +
      '}';
  }

  function renderAll(s, changed) {
    s = s || Lab.get();
    applyPalette(Lab.palette(s.mode));
    if (!changed || changed.indexOf('title') !== -1 || changed.indexOf('body') !== -1) {
      applyFonts(s);
    }
    renderReadout(s);

    panel.querySelectorAll('[data-mode-btn]').forEach(function (btn) {
      var on = btn.getAttribute('data-mode-btn') === s.mode;
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('is-active', on);
    });

    syncUrl(s);
  }

  /* Dragging a colour input fires on every frame, and browsers rate-limit
     history writes (Chrome starts warning past ~100 in 30s). The URL only
     has to be right when the user stops moving. */
  var syncUrl = L.debounce(function (s) {
    L.setParams({
      title: s.title,
      body: s.body,
      bg: Lab.palette('light').bg.slice(1),
      fg: Lab.palette('light').fg.slice(1)
    });
  }, 350);

  /* ---------------- palette editing ---------------- */

  function patchActive(key, value) {
    var s = Lab.get();
    var patch = {};
    patch[s.mode] = {};
    patch[s.mode][key] = value;
    if (s.mode === 'dark') { markDarkTouched(); }
    Lab.set(patch, 'contrast');
  }

  function markDarkTouched() {
    if (darkTouched) { return; }
    darkTouched = true;
    try { localStorage.setItem('layz.lab.darkTouched', '1'); } catch (e) {}
  }

  el.bg.addEventListener('input', function () { patchActive('bg', el.bg.value); });
  el.fg.addEventListener('input', function () { patchActive('fg', el.fg.value); });

  /* Typed hex only commits when it parses. Half-typed "#1f" must not reset
     the canvas to the fallback on every keystroke. */
  function hexField(input, key) {
    input.addEventListener('input', function () {
      var v = input.value.trim();
      if (v && v.charAt(0) !== '#') { v = '#' + v; }
      if (Lab.safeHex(v, null)) { patchActive(key, v); }
    });
    input.addEventListener('blur', function () {
      input.value = Lab.palette()[key];
    });
  }
  hexField(el.bgHex, 'bg');
  hexField(el.fgHex, 'fg');

  $('ctSwap').addEventListener('click', function () {
    var p = Lab.palette();
    var s = Lab.get();
    var patch = {};
    patch[s.mode] = { bg: p.fg, fg: p.bg };
    if (s.mode === 'dark') { markDarkTouched(); }
    Lab.set(patch, 'contrast');
    L.toast('Swapped - the ratio is unchanged by design');
  });

  /* Move the text colour along its own lightness axis until it clears the
     target, keeping the hue and saturation the designer picked.
     Walks outward from the current lightness in BOTH directions, so the
     first hit is the smallest change that passes - guessing a single
     direction from the background dead-ends on mid-tone backgrounds, where
     the only way out may be the way you did not go. */
  function nearestPassing(fg, bg, target) {
    if (Lab.contrast(fg, bg) >= target) { return fg; }
    var hsl = Lab.toHsl(fg);
    var best = fg;
    var bestContrast = Lab.contrast(fg, bg);

    for (var d = 1; d <= 100; d++) {
      var tries = [hsl[2] + d, hsl[2] - d];
      for (var k = 0; k < 2; k++) {
        if (tries[k] < 0 || tries[k] > 100) { continue; }
        var cand = Lab.fromHsl([hsl[0], hsl[1], tries[k]]);
        var c = Lab.contrast(cand, bg);
        if (c >= target) { return cand; }
        if (c > bestContrast) { bestContrast = c; best = cand; }
      }
    }
    /* Nothing at this hue clears the bar - hand back the closest attempt and
       let the caller say so honestly. */
    return best;
  }

  $('ctFix').addEventListener('click', function () {
    var p = Lab.palette();
    var fixed = nearestPassing(p.fg, p.bg, 4.5);
    if (fixed === p.fg) {
      L.toast(Lab.contrast(p.fg, p.bg) >= 4.5
        ? 'Already passes AA'
        : 'No lightness at this hue clears AA - change the background');
      return;
    }
    patchActive('fg', fixed);
    L.toast(Lab.contrast(fixed, p.bg) >= 4.5
      ? 'Text nudged to ' + fixed
      : 'Closest possible at this hue - still short of AA');
  });

  /* ---------------- mode toggle ---------------- */

  panel.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-mode-btn]');
    if (!btn) { return; }
    var next = btn.getAttribute('data-mode-btn');
    var s = Lab.get();
    if (next === s.mode) { return; }

    if (next === 'dark' && !darkTouched) {
      Lab.set({ dark: Lab.deriveCounterpart('light') }, 'contrast');
    }
    Lab.set({ mode: next }, 'contrast');
  });

  /* ---------------- pair controls ---------------- */

  function commitFont(input, key) {
    input.addEventListener('change', function () {
      var name = input.value.trim();
      if (D.BY_NAME[name]) {
        var patch = {};
        patch[key] = name;
        Lab.set(patch, 'contrast');
      } else {
        input.value = Lab.get()[key];
        L.toast('Not a family in the catalogue');
      }
    });
  }
  commitFont(el.titleFont, 'title');
  commitFont(el.bodyFont, 'body');

  $('ctShuffle').addEventListener('click', function () {
    var pair = P.generate({});
    Lab.set({ title: pair.title.name, body: pair.body.name }, 'contrast');
  });

  $('ctCopy').addEventListener('click', function () {
    L.copy(el.code.textContent, 'CSS variables copied');
  });

  /* ---------------- boot ---------------- */

  /* Every write re-renders, whoever made it - the tools are meant to stay in
     step, and the inputs are guarded against clobbering a focused field. */
  Lab.on(function (s, changed) { renderAll(s, changed); });

  (function boot() {
    /* A deep link from the pairings page or a shared palette URL wins over
       whatever was last persisted. */
    var patch = {};
    var qt = L.param('title');
    var qb = L.param('body');
    if (qt && D.BY_NAME[qt]) { patch.title = qt; }
    if (qb && D.BY_NAME[qb]) { patch.body = qb; }

    var qbg = L.param('bg');
    var qfg = L.param('fg');
    var lightPatch = {};
    if (qbg) {
      var bg = Lab.safeHex(qbg.charAt(0) === '#' ? qbg : '#' + qbg, null);
      if (bg) { lightPatch.bg = bg; }
    }
    if (qfg) {
      var fg = Lab.safeHex(qfg.charAt(0) === '#' ? qfg : '#' + qfg, null);
      if (fg) { lightPatch.fg = fg; }
    }
    if (lightPatch.bg || lightPatch.fg) { patch.light = lightPatch; }

    if (Object.keys(patch).length) { Lab.set(patch, 'boot'); }
    renderAll(Lab.get());
  })();
})();
