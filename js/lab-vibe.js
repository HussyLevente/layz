/* ============================================================
   Layz - Lab / Brand vibe
   ------------------------------------------------------------
   Pick a mood, get a matched pairing and a light/dark palette,
   copy it out as CSS custom properties.

   It writes into the same LayzLab store the contrast tool reads,
   so "generate a vibe" and "check it against WCAG" are one
   continuous move rather than two disconnected widgets. Every
   palette in the table is pre-verified to clear AA in both
   modes - and the panel measures it live anyway, because a
   number the user can see beats a promise in a comment.
   ============================================================ */
(function () {
  'use strict';

  var D = window.LayzData;
  var L = window.Layz;
  var F = window.LayzFonts;
  var P = window.LayzPairs;
  var Lab = window.LayzLab;
  var V = window.LayzVibes;

  var $ = function (id) { return document.getElementById(id); };

  var panel = $('toolVibe');
  if (!panel) { return; }

  var el = {
    tags: $('vbTags'),
    canvas: $('vbCanvas'),
    title: $('vbTitle'),
    body: $('vbBody'),
    btn: $('vbBtn'),
    chip: $('vbChip'),
    swatches: $('vbSwatches'),
    name: $('vbName'),
    blurb: $('vbBlurb'),
    pairName: $('vbPairName'),
    score: $('vbScore'),
    code: $('vbCode'),
    saved: $('vbSaved'),
    savedEmpty: $('vbSavedEmpty')
  };

  /* Which of the mood's pairs is showing. Reset whenever the mood changes. */
  var variant = 0;

  function currentMood() {
    var id = Lab.get().mood;
    return (id && V.BY_ID[id]) || null;
  }

  /* ---------------- tag grid ---------------- */

  (function buildTags() {
    var html = '';
    V.MOODS.forEach(function (m, i) {
      html += '<button class="vb-tag" data-mood="' + m.id + '" aria-pressed="false" data-cursor="Apply">' +
        '<span class="vb-tag-n num">' + L.pad(i + 1, 2) + '</span>' +
        '<span class="vb-tag-label">' + L.escapeHtml(m.label) + '</span>' +
        '<span class="vb-tag-dots" aria-hidden="true">' +
          '<i style="background:' + m.light.bg + '"></i>' +
          '<i style="background:' + m.light.fg + '"></i>' +
          '<i style="background:' + m.light.accent + '"></i>' +
        '</span>' +
      '</button>';
    });
    el.tags.innerHTML = html;
  })();

  el.tags.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-mood]');
    if (!btn) { return; }
    applyMood(btn.getAttribute('data-mood'), 0);
  });

  function applyMood(id, v) {
    var m = V.BY_ID[id];
    if (!m) { return; }
    variant = v % m.pairs.length;
    var pair = m.pairs[variant];
    Lab.set({
      mood: m.id,
      title: pair[0],
      body: pair[1],
      light: m.light,
      dark: m.dark
    }, 'vibe');
  }

  $('vbNextPair').addEventListener('click', function () {
    var m = currentMood();
    if (!m) { L.toast('Pick a mood first'); return; }
    applyMood(m.id, variant + 1);
  });

  /* A pairing from the engine, keeping the mood's colours. Lets someone
     break out of the three hand-picked options without losing the palette. */
  $('vbSurprise').addEventListener('click', function () {
    var m = currentMood();
    if (!m) { L.toast('Pick a mood first'); return; }
    var pair = P.generate({});
    Lab.set({ title: pair.title.name, body: pair.body.name }, 'vibe');
    L.toast('Engine pairing, mood palette');
  });

  /* Mirrors the contrast tool's toggle onto the same store key, so the two
     panels stay in step. No counterpart seeding is needed here - a mood
     always defines both palettes outright.
     Uses data-vb-mode, not data-mode-btn: that attribute already has a
     handler bound to the contrast panel, and reusing it would fire both. */
  panel.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-vb-mode]');
    if (!btn) { return; }
    Lab.set({ mode: btn.getAttribute('data-vb-mode') }, 'vibe');
  });

  /* ---------------- render ---------------- */

  function rgbTriple(hex) { return Lab.toRgb(hex).join(', '); }

  function render(s) {
    s = s || Lab.get();
    var m = currentMood();
    var p = Lab.palette(s.mode);

    el.canvas.style.setProperty('--bg-rgb', rgbTriple(p.bg));
    el.canvas.style.setProperty('--fg-rgb', rgbTriple(p.fg));
    el.canvas.style.setProperty('--accent', p.accent);
    el.canvas.style.setProperty('--on-accent', Lab.bestOn(p.accent));

    var t = D.BY_NAME[s.title];
    var b = D.BY_NAME[s.body];
    if (t && b) {
      var tw = P.headingWeight(t);
      F.load(t.name, { priority: true, weights: tw === 400 ? null : '400;' + tw });
      F.load(b.name, { priority: true, weights: '400;700' });
      el.canvas.style.setProperty('--ct-title', t.stack);
      el.canvas.style.setProperty('--ct-body', b.stack);
      el.canvas.style.setProperty('--ct-title-weight', String(tw));
      el.pairName.textContent = t.name + ' + ' + b.name;
    }

    el.name.textContent = m ? m.label : 'No mood selected';
    el.blurb.textContent = m ? m.blurb : 'Pick one of the tags to generate a pairing and a palette.';

    if (m) {
      el.title.textContent = m.label;
      el.chip.textContent = m.id;
    }

    panel.querySelectorAll('[data-mood]').forEach(function (btn) {
      var on = !!m && btn.getAttribute('data-mood') === m.id;
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('is-active', on);
    });

    panel.querySelectorAll('[data-vb-mode]').forEach(function (btn) {
      var on = btn.getAttribute('data-vb-mode') === s.mode;
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('is-active', on);
    });

    renderSwatches(p);
    renderScore(s);
    renderCode(s);
    syncSaveButton();
  }

  function renderSwatches(p) {
    var rows = [['Background', p.bg], ['Text', p.fg], ['Accent', p.accent]];
    el.swatches.innerHTML = rows.map(function (r) {
      return '<div class="vb-swatch">' +
        '<i style="background:' + r[1] + '"></i>' +
        '<span class="label">' + r[0] + '</span>' +
        '<span class="label label--soft vb-swatch-hex">' + r[1] + '</span>' +
      '</div>';
    }).join('');
  }

  /* Measured live rather than trusted from the table - if a mood ever drifts
     out of spec, this is where it shows up. */
  function renderScore(s) {
    var lp = Lab.palette('light');
    var dp = Lab.palette('dark');
    var lr = Lab.contrast(lp.fg, lp.bg);
    var dr = Lab.contrast(dp.fg, dp.bg);
    var la = Lab.contrast(lp.accent, lp.bg);
    var da = Lab.contrast(dp.accent, dp.bg);

    function cell(label, ratio, need, unit) {
      var pass = ratio >= need;
      return '<div class="vb-score-row' + (pass ? '' : ' is-fail') + '">' +
        '<span class="vb-score-mark" aria-hidden="true">' + (pass ? '✓' : '✕') + '</span> ' +
        '<span class="label">' + label + '</span> ' +
        '<span class="label label--soft">' + ratio.toFixed(2) + ':1</span> ' +
        '<span class="label label--soft vb-score-need">' + unit + '</span>' +
        '<span class="sr-only">' + (pass ? 'passes' : 'fails') + '</span>' +
      '</div>';
    }

    el.score.innerHTML =
      cell('Light text', lr, 4.5, 'AA 4.5') +
      cell('Light accent', la, 3, 'UI 3.0') +
      cell('Dark text', dr, 4.5, 'AA 4.5') +
      cell('Dark accent', da, 3, 'UI 3.0');
  }

  function renderCode(s) {
    var t = D.BY_NAME[s.title];
    var b = D.BY_NAME[s.body];
    if (!t || !b) { return; }
    var m = currentMood();
    var light = Lab.palette('light');
    var dark = Lab.palette('dark');

    el.code.textContent =
      (m ? '/* Layz vibe: ' + m.label + ' */\n' : '') +
      '@import url("' + P.embedUrl({ title: t, body: b }) + '");\n\n' +
      ':root {\n' +
      '  --brand-bg: ' + light.bg + ';\n' +
      '  --brand-fg: ' + light.fg + ';\n' +
      '  --brand-accent: ' + light.accent + ';\n' +
      '  --brand-on-accent: ' + Lab.bestOn(light.accent) + ';\n' +
      '  --font-title: ' + t.stack + ';\n' +
      '  --font-body: ' + b.stack + ';\n' +
      '}\n\n' +
      '@media (prefers-color-scheme: dark) {\n' +
      '  :root {\n' +
      '    --brand-bg: ' + dark.bg + ';\n' +
      '    --brand-fg: ' + dark.fg + ';\n' +
      '    --brand-accent: ' + dark.accent + ';\n' +
      '    --brand-on-accent: ' + Lab.bestOn(dark.accent) + ';\n' +
      '  }\n' +
      '}';
  }

  $('vbCopy').addEventListener('click', function () {
    L.copy(el.code.textContent, 'Vibe CSS copied');
  });

  $('vbCheck').addEventListener('click', function () {
    Lab.setTool('contrast');
  });

  /* ---------------- saving ---------------- */

  function asRecord() {
    var s = Lab.get();
    var m = currentMood();
    return {
      mood: s.mood || 'custom',
      label: m ? m.label : 'Custom',
      title: s.title,
      body: s.body,
      light: Lab.palette('light'),
      dark: Lab.palette('dark')
    };
  }

  function syncSaveButton() {
    var on = L.saved.hasPalette(asRecord());
    var btn = $('vbSave');
    btn.textContent = on ? 'Saved ★' : 'Save palette';
    btn.classList.toggle('is-active', on);
  }

  $('vbSave').addEventListener('click', function () {
    if (!Lab.get().mood) { L.toast('Pick a mood first'); return; }
    var added = L.saved.togglePalette(asRecord());
    syncSaveButton();
    renderSaved();
    L.toast(added ? 'Palette saved' : 'Palette removed');
  });

  function renderSaved() {
    var list = L.saved.palettes();
    el.savedEmpty.hidden = list.length > 0;
    el.saved.innerHTML = list.map(function (r, i) {
      return '<button class="vb-saved-row" data-load="' + i + '" data-cursor="Load">' +
        '<span class="vb-tag-dots" aria-hidden="true">' +
          '<i style="background:' + L.escapeHtml(r.light.bg) + '"></i>' +
          '<i style="background:' + L.escapeHtml(r.light.fg) + '"></i>' +
          '<i style="background:' + L.escapeHtml(r.light.accent) + '"></i>' +
        '</span>' +
        '<span class="label">' + L.escapeHtml(r.label) + '</span>' +
        '<span class="label label--soft vb-saved-pair">' +
          L.escapeHtml(r.title) + ' + ' + L.escapeHtml(r.body) + '</span>' +
        '<span class="vb-saved-x" data-remove="' + i + '" role="button" aria-label="Remove">&times;</span>' +
      '</button>';
    }).join('');
  }

  el.saved.addEventListener('click', function (e) {
    var rm = e.target.closest('[data-remove]');
    var list = L.saved.palettes();
    if (rm) {
      e.stopPropagation();
      var r = list[parseInt(rm.getAttribute('data-remove'), 10)];
      if (r) { L.saved.removePalette(r); renderSaved(); syncSaveButton(); L.toast('Palette removed'); }
      return;
    }
    var row = e.target.closest('[data-load]');
    if (!row) { return; }
    var rec = list[parseInt(row.getAttribute('data-load'), 10)];
    if (!rec) { return; }
    Lab.set({
      mood: V.BY_ID[rec.mood] ? rec.mood : null,
      title: rec.title,
      body: rec.body,
      light: rec.light,
      dark: rec.dark
    }, 'vibe');
    L.toast('Palette loaded');
  });

  /* ---------------- boot ---------------- */

  Lab.on(function (s) { render(s); });
  renderSaved();
  render(Lab.get());
})();
