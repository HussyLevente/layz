/* ============================================================
   Layz - Lab / Variable font playground
   ------------------------------------------------------------
   Drag the real axes of a real variable font and watch the text
   move, then copy the CSS that reproduces it.

   Two things this tool has to get right or it lies:

     1. The axis ranges are Google's own, generated from their
        metadata rather than guessed. css2 returns 400 for an
        axis a family does not have OR a value outside its real
        range, which would silently drop the whole request and
        leave the fallback stack rendering while the sliders
        appear to work.

     2. font-variation-settings is applied ALONGSIDE font-weight,
        not instead of it. Setting only the former leaves the
        computed weight at 400, so anything inheriting from the
        preview (and any copied code) disagrees with what is on
        screen.
   ============================================================ */
(function () {
  'use strict';

  var D = window.LayzData;
  var L = window.Layz;
  var F = window.LayzFonts;
  var Lab = window.LayzLab;
  var V = window.LayzVariable;

  var $ = function (id) { return document.getElementById(id); };

  var panel = $('toolVariable');
  if (!panel) { return; }

  var el = {
    canvas: $('vfCanvas'),
    sample: $('vfSample'),
    sliders: $('vfSliders'),
    picker: $('vfFamily'),
    name: $('vfName'),
    axisCount: $('vfAxisCount'),
    code: $('vfCode'),
    size: $('vfSize'),
    sizeVal: $('vfSizeVal')
  };

  /* Panel-local: which family, the axis values, and the preview size. The
     shared store holds the pairing, which is a different question. */
  var state = { family: 'Roboto Flex', values: {}, size: 92 };
  try {
    var saved = JSON.parse(localStorage.getItem('layz.lab.variable') || '{}');
    if (V.BY_NAME[saved.family]) { state.family = saved.family; }
    if (saved.values && typeof saved.values === 'object') { state.values = saved.values; }
    if (saved.size) { state.size = Math.min(220, Math.max(24, parseInt(saved.size, 10) || 92)); }
  } catch (e) {}

  function persist() {
    try {
      localStorage.setItem('layz.lab.variable', JSON.stringify(state));
    } catch (e) {}
  }

  function family() { return V.BY_NAME[state.family] || V.FAMILIES[0]; }

  /* Values are clamped to the family's real range on every read, so a stale
     localStorage blob from a previous family cannot push a request out of
     bounds and 400 the whole stylesheet. */
  function valueOf(axis) {
    var v = state.values[axis.tag];
    if (typeof v !== 'number' || isNaN(v)) { return axis.def; }
    return Math.min(axis.max, Math.max(axis.min, v));
  }

  function step(axis) {
    var span = axis.max - axis.min;
    if (span <= 2) { return 0.01; }
    if (span <= 20) { return 0.5; }
    return 1;
  }

  /* ---------------- picker ---------------- */
  (function buildPicker() {
    el.picker.innerHTML = V.FAMILIES.map(function (f) {
      var core = f.axes.length;
      return '<option value="' + L.escapeHtml(f.name) + '">' +
        L.escapeHtml(f.name) + ' · ' + core + ' ' + (core === 1 ? 'axis' : 'axes') +
      '</option>';
    }).join('');
  })();

  el.picker.addEventListener('change', function () {
    if (!V.BY_NAME[el.picker.value]) { return; }
    state.family = el.picker.value;
    state.values = {};          /* axes do not carry across families */
    persist();
    render();
  });

  $('vfRandom').addEventListener('click', function () {
    var f = family();
    f.axes.forEach(function (a) {
      state.values[a.tag] = a.min + Math.random() * (a.max - a.min);
    });
    persist();
    render();
  });

  $('vfReset').addEventListener('click', function () {
    state.values = {};
    persist();
    render();
    L.toast('Axes back to their defaults');
  });

  el.size.addEventListener('input', function () {
    state.size = parseInt(el.size.value, 10) || 92;
    el.sizeVal.textContent = state.size + 'px';
    el.sample.style.fontSize = state.size + 'px';
    persist();
    renderCode();
  });

  /* ---------------- sliders ---------------- */
  function buildSliders() {
    var f = family();
    el.sliders.innerHTML = f.axes.map(function (a) {
      var v = valueOf(a);
      return '<div class="vf-axis">' +
        '<div class="vf-axis-head">' +
          '<span class="label">' + L.escapeHtml(a.label) + '</span>' +
          '<span class="label label--soft vf-axis-tag">' + a.tag + '</span>' +
          '<span class="spacer"></span>' +
          '<span class="label vf-axis-val" data-val="' + a.tag + '">' + fmt(v) + '</span>' +
        '</div>' +
        '<input type="range" data-axis="' + a.tag + '" ' +
          'min="' + a.min + '" max="' + a.max + '" step="' + step(a) + '" value="' + v + '" ' +
          'aria-label="' + L.escapeHtml(a.label) + ' (' + a.tag + ')">' +
        '<div class="vf-axis-foot">' +
          '<span class="label label--soft">' + fmt(a.min) + '</span>' +
          '<span class="label label--soft">' + fmt(a.max) + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function fmt(n) {
    return (Math.round(n * 100) / 100).toString();
  }

  /* Dragging a slider must not rebuild the DOM - that would drop the pointer
     capture and the drag would stop after one frame. Patch in place. */
  el.sliders.addEventListener('input', function (e) {
    var input = e.target.closest('[data-axis]');
    if (!input) { return; }
    var tag = input.getAttribute('data-axis');
    state.values[tag] = parseFloat(input.value);
    var out = el.sliders.querySelector('[data-val="' + tag + '"]');
    if (out) { out.textContent = fmt(state.values[tag]); }
    applyVariation();
    renderCode();
    persistSoon();
  });

  var persistSoon = L.debounce(persist, 400);

  /* ---------------- rendering ---------------- */
  function variationString() {
    var f = family();
    return f.axes.map(function (a) {
      return '"' + a.tag + '" ' + fmt(valueOf(a));
    }).join(', ');
  }

  function weightValue() {
    var f = family();
    for (var i = 0; i < f.axes.length; i++) {
      if (f.axes[i].tag === 'wght') { return Math.round(valueOf(f.axes[i])); }
    }
    return null;
  }

  function applyVariation() {
    el.sample.style.fontVariationSettings = variationString();
    /* Keep font-weight in step with the wght axis. Without this the computed
       weight stays 400 while the glyphs render at 900, and the copied CSS
       would be the only honest description of the result. */
    var w = weightValue();
    el.sample.style.fontWeight = w === null ? '' : String(w);
  }

  function render() {
    var f = family();

    el.picker.value = f.name;
    el.name.textContent = f.name;
    el.axisCount.textContent = f.axes.length + ' ' + (f.axes.length === 1 ? 'axis' : 'axes');

    /* Request the family across its FULL axis ranges, so every slider has
       real glyphs to interpolate between rather than snapping to an instance. */
    el.sample.classList.remove('is-ready');
    F.ready(f.name, { priority: true, axes: f.axes }).then(function () {
      el.sample.classList.add('is-ready');
    });

    el.sample.style.fontFamily = '"' + f.name + '", ' + fallbackFor(f.name);
    el.sample.style.fontSize = state.size + 'px';
    el.size.value = state.size;
    el.sizeVal.textContent = state.size + 'px';

    buildSliders();
    applyVariation();
    renderCode();
  }

  function fallbackFor(name) {
    var meta = D.BY_NAME[name];
    if (!meta) { return 'system-ui, sans-serif'; }
    /* reuse the catalogue's own fallback tail */
    var i = meta.stack.indexOf(', ');
    return i === -1 ? 'system-ui, sans-serif' : meta.stack.slice(i + 2);
  }

  function renderCode() {
    var f = family();
    var url = 'https://fonts.googleapis.com/css2?family=' +
      f.name.replace(/\s+/g, '+') + ':' + F.axisSpec(f.axes) + '&display=swap';
    var w = weightValue();

    el.code.textContent =
      '/* ' + f.name + ' - ' + f.axes.length + ' variable ' +
        (f.axes.length === 1 ? 'axis' : 'axes') + ' */\n' +
      '@import url("' + url + '");\n\n' +
      '.headline {\n' +
      '  font-family: "' + f.name + '", ' + fallbackFor(f.name) + ';\n' +
      '  font-size: ' + state.size + 'px;\n' +
      (w === null ? '' : '  font-weight: ' + w + ';\n') +
      '  font-variation-settings:\n    ' +
        variationString().split(', ').join(',\n    ') + ';\n' +
      '}';
  }

  $('vfCopy').addEventListener('click', function () {
    L.copy(el.code.textContent, 'Variable CSS copied');
  });

  /* Hand the current family to the rest of the lab as the title face. */
  $('vfUseAsTitle').addEventListener('click', function () {
    var f = family();
    if (!D.BY_NAME[f.name]) {
      L.toast('Not in the pairing catalogue');
      return;
    }
    Lab.set({ title: f.name }, 'variable');
    L.toast(f.name + ' set as the title font');
  });

  /* ---------------- boot ---------------- */
  render();
})();
