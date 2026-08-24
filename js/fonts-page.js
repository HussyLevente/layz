/* ============================================================
   Layz - fonts library page
   ============================================================ */
(function () {
  'use strict';

  var D = window.LayzData;
  var L = window.Layz;
  var F = window.LayzFonts;

  var $ = function (id) { return document.getElementById(id); };

  var grid = $('fontGrid');
  var PAGE = 40;

  var state = {
    q: '',
    category: 'all',
    sort: 'curated',
    view: 'list',
    preview: '',
    size: 34,
    weight: 400,
    savedOnly: false,
    shown: PAGE
  };

  var visible = [];
  /* Persistent observer: rows load their family on the way in and release it
     on the way out, so a long catalogue cannot grow the font cache forever.
     Releasing only marks a family evictable - the loader keeps it until the
     live count actually exceeds its cap. */
  var io = F.observer(function (el, name) {
    /* request the exact cut this row renders, not a blanket 400 */
    var w = el.getAttribute('data-weight');
    if (w && w !== '400') { F.load(name, { weights: '400;' + w }); }
    F.ready(name).then(function () {
      var p = el.querySelector('.fr-preview');
      if (p) { p.classList.add('is-ready'); }
    });
  }, { persist: true, rootMargin: '900px 0px' });

  /* ---------------- read URL + storage ---------------- */
  (function boot() {
    var cat = L.param('category');
    if (cat && D.CATEGORIES.some(function (c) { return c.id === cat; })) { state.category = cat; }
    var q = L.param('q');
    if (q) { state.q = q; }
    if (L.param('saved') === '1') { state.savedOnly = true; }
    try {
      var v = localStorage.getItem('layz.view');
      if (v) { state.view = v; }
      var s = localStorage.getItem('layz.size');
      if (s) { state.size = parseInt(s, 10) || 34; }
      var w = localStorage.getItem('layz.weight');
      if (w) { state.weight = parseInt(w, 10) || 400; }
    } catch (e) {}
  })();

  /* ---------------- filtering ---------------- */
  function matches(f) {
    if (state.category !== 'all' && f.category !== state.category) { return false; }
    if (state.savedOnly && !L.saved.hasFont(f.name)) { return false; }
    if (!state.q) { return true; }
    var q = state.q.toLowerCase();
    return f.name.toLowerCase().indexOf(q) !== -1 ||
           f.category.indexOf(q) !== -1 ||
           f.tag.indexOf(q) !== -1;
  }

  function sortList(list) {
    var out = list.slice();
    if (state.sort === 'az') {
      out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    } else if (state.sort === 'za') {
      out.sort(function (a, b) { return b.name.localeCompare(a.name); });
    } else if (state.sort === 'category') {
      out.sort(function (a, b) {
        return a.category === b.category
          ? a.name.localeCompare(b.name)
          : a.category.localeCompare(b.category);
      });
    } else if (state.sort === 'random') {
      for (var i = out.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = out[i]; out[i] = out[j]; out[j] = t;
      }
    }
    /* 'curated' keeps the catalogue's own hand-ordered sequence */
    return out;
  }

  /* ---------------- rendering ---------------- */
  function previewFor(f) { return state.preview || f.name; }

  /* A family only has the cuts it ships. Asking css2 for a missing weight is
     silently ignored, so resolve to the nearest real one and show which. */
  function weightFor(f) { return D.nearestWeight(f, state.weight); }

  function rowHtml(f, i, absoluteIndex) {
    var saved = L.saved.hasFont(f.name);
    var delay = Math.min(i, 14) * 0.025;
    var w = weightFor(f);
    var meta = f.category + ' &middot; ' + f.tag + ' &middot; ' + w +
      (w === state.weight ? '' : '<span class="fr-sub"> (no ' + state.weight + ')</span>');
    return '<article class="font-row" data-font="' + f.name + '" data-id="' + f.id + '" ' +
        'data-weight="' + w + '" tabindex="0" role="button" data-cursor="Open" ' +
        'aria-label="' + L.escapeHtml(f.name) + ' details" ' +
        'style="animation-delay:' + delay + 's">' +
      '<span class="fr-top">' +
        '<span class="num fr-num">' + L.pad(absoluteIndex + 1) + '</span>' +
        '<span class="label fr-name">' + L.escapeHtml(f.name) + '</span>' +
      '</span>' +
      '<span class="fr-preview fnt" style="font-family:' + f.stack.replace(/"/g, '&quot;') +
        ';font-weight:' + w + '">' +
        L.escapeHtml(previewFor(f)) +
      '</span>' +
      '<span class="label label--soft fr-meta">' + meta + '</span>' +
      '<button class="fr-save' + (saved ? ' is-saved' : '') + '" data-save="' + L.escapeHtml(f.name) + '" ' +
        'aria-pressed="' + saved + '" aria-label="Save ' + L.escapeHtml(f.name) + '">' +
        (saved ? 'Saved' : 'Save') +
      '</button>' +
    '</article>';
  }

  function render(reset) {
    if (reset) { state.shown = PAGE; }
    visible = sortList(D.FONTS.filter(matches));

    var slice = visible.slice(0, state.shown);
    var html = '';
    for (var i = 0; i < slice.length; i++) { html += rowHtml(slice[i], i, i); }
    grid.innerHTML = html;
    grid.setAttribute('data-view', state.view);
    grid.style.setProperty('--preview-size', state.size + 'px');

    grid.querySelectorAll('.font-row').forEach(function (row) { io.observe(row); });

    $('resultCount').textContent = visible.length;
    $('resultFilter').textContent = describeFilter();
    $('emptyState').hidden = visible.length !== 0;
    $('loadMoreWrap').hidden = visible.length <= state.shown;
    updateSavedCount();
  }

  function describeFilter() {
    var bits = [];
    if (state.category !== 'all') { bits.push('in ' + state.category); }
    if (state.q) { bits.push('matching "' + state.q + '"'); }
    if (state.savedOnly) { bits.push('saved'); }
    return bits.length ? bits.join(' / ') : 'across the whole library';
  }

  /* Re-set previews without rebuilding the DOM. */
  function repaintPreviews() {
    var rows = grid.querySelectorAll('.font-row');
    for (var i = 0; i < rows.length; i++) {
      var f = D.BY_NAME[rows[i].getAttribute('data-font')];
      rows[i].querySelector('.fr-preview').textContent = previewFor(f);
    }
    if (detailFont) { $('detailHero').textContent = state.preview || 'Handgloves'; }
  }

  /* ---------------- category filters ---------------- */
  (function chips() {
    var counts = { all: D.FONTS.length };
    D.FONTS.forEach(function (f) { counts[f.category] = (counts[f.category] || 0) + 1; });
    var html = '';
    D.CATEGORIES.forEach(function (c) {
      html += '<button class="ul-link' + (state.category === c.id ? ' is-active' : '') + '" ' +
        'data-cat="' + c.id + '" aria-pressed="' + (state.category === c.id) + '">' +
        c.label + '<span class="count">' + counts[c.id] + '</span></button>';
    });
    $('catChips').innerHTML = html;
    $('catChips').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cat]');
      if (!btn) { return; }
      state.category = btn.getAttribute('data-cat');
      $('catChips').querySelectorAll('[data-cat]').forEach(function (c) {
        var on = c.getAttribute('data-cat') === state.category;
        c.setAttribute('aria-pressed', String(on));
        c.classList.toggle('is-active', on);
      });
      render(true);
    });
  })();

  /* ---------------- toolbar ---------------- */
  function fieldSync(input) {
    input.closest('.field').classList.toggle('has-value', !!input.value);
  }

  var search = $('searchInput');
  search.value = state.q;
  fieldSync(search);
  search.addEventListener('input', L.debounce(function () {
    state.q = search.value.trim();
    fieldSync(search);
    render(true);
  }, 140));

  var preview = $('previewInput');
  preview.addEventListener('input', L.debounce(function () {
    state.preview = preview.value;
    fieldSync(preview);
    repaintPreviews();
  }, 60));

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-clear]');
    if (!btn) { return; }
    var input = $(btn.getAttribute('data-clear'));
    input.value = '';
    fieldSync(input);
    if (input === search) { state.q = ''; render(true); }
    else { state.preview = ''; repaintPreviews(); }
    input.focus();
  });

  var slider = $('sizeSlider');
  slider.value = state.size;
  $('sizeValue').textContent = state.size;
  slider.addEventListener('input', function () {
    state.size = parseInt(slider.value, 10);
    $('sizeValue').textContent = state.size;
    grid.style.setProperty('--preview-size', state.size + 'px');
    try { localStorage.setItem('layz.size', state.size); } catch (err) {}
  });

  $('sortSelect').addEventListener('change', function (e) {
    state.sort = e.target.value;
    render(true);
  });

  var weightSelect = $('weightSelect');
  weightSelect.value = String(state.weight);
  weightSelect.addEventListener('change', function () {
    state.weight = parseInt(weightSelect.value, 10) || 400;
    try { localStorage.setItem('layz.weight', state.weight); } catch (e) {}
    render();
  });

  function setView(v) {
    state.view = v;
    grid.setAttribute('data-view', v);
    $('viewGrid').setAttribute('aria-pressed', String(v === 'grid'));
    $('viewList').setAttribute('aria-pressed', String(v === 'list'));
    $('viewGrid').classList.toggle('is-active', v === 'grid');
    $('viewList').classList.toggle('is-active', v === 'list');
    try { localStorage.setItem('layz.view', v); } catch (e) {}
  }
  $('viewGrid').addEventListener('click', function () { setView('grid'); });
  $('viewList').addEventListener('click', function () { setView('list'); });
  setView(state.view);

  var savedToggle = $('savedToggle');
  function syncSavedToggle() {
    savedToggle.setAttribute('aria-pressed', String(state.savedOnly));
    savedToggle.classList.toggle('is-active', state.savedOnly);
  }
  savedToggle.addEventListener('click', function () {
    state.savedOnly = !state.savedOnly;
    syncSavedToggle();
    render(true);
  });
  syncSavedToggle();

  function updateSavedCount() {
    $('savedCount').textContent = L.saved.all().fonts.length;
  }

  $('resetFilters').addEventListener('click', function () {
    state.q = ''; state.category = 'all'; state.savedOnly = false;
    search.value = ''; fieldSync(search);
    syncSavedToggle();
    $('catChips').querySelectorAll('[data-cat]').forEach(function (c) {
      var on = c.getAttribute('data-cat') === 'all';
      c.setAttribute('aria-pressed', String(on));
      c.classList.toggle('is-active', on);
    });
    render(true);
  });

  /* ---------------- pagination ---------------- */
  function showMore() {
    if (state.shown >= visible.length) { return; }
    var from = state.shown;
    state.shown = Math.min(state.shown + PAGE, visible.length);
    var frag = document.createElement('div');
    var html = '';
    for (var i = from; i < state.shown; i++) { html += rowHtml(visible[i], i - from, i); }
    frag.innerHTML = html;
    Array.prototype.slice.call(frag.children).forEach(function (n) {
      grid.appendChild(n);
      io.observe(n);
    });
    $('loadMoreWrap').hidden = visible.length <= state.shown;
  }

  $('loadMore').addEventListener('click', showMore);

  var sentinel = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) { showMore(); }
  }, { rootMargin: '500px' });
  sentinel.observe($('loadMoreWrap'));

  /* ---------------- row interactions ---------------- */
  grid.addEventListener('click', function (e) {
    var save = e.target.closest('[data-save]');
    if (save) {
      e.stopPropagation();
      var name = save.getAttribute('data-save');
      var added = L.saved.toggleFont(name);
      save.classList.toggle('is-saved', added);
      save.setAttribute('aria-pressed', String(added));
      save.textContent = added ? 'Saved' : 'Save';
      L.toast(added ? 'Saved ' + name : 'Removed ' + name);
      updateSavedCount();
      if (state.savedOnly && !added) { render(); }
      return;
    }
    var row = e.target.closest('.font-row');
    if (row) { openDetail(row.getAttribute('data-font')); }
  });

  grid.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') { return; }
    var row = e.target.closest('.font-row');
    if (!row) { return; }
    e.preventDefault();
    openDetail(row.getAttribute('data-font'));
  });

  /* ---------------- detail overlay ---------------- */
  var overlay = $('detailOverlay');
  var detailFont = null;
  var lastFocus = null;
  var detailCode = { link: '', css: '', import: '' };

  var WATERFALL = [12, 16, 20, 28, 40, 56, 76];

  function openDetail(name) {
    var f = D.BY_NAME[name];
    if (!f) { return; }
    detailFont = f;
    lastFocus = document.activeElement;

    F.load(name, { priority: true });

    $('detailIdx').textContent = 'Font / ' + L.pad(f.index + 1);
    $('detailName').textContent = f.name;

    var hero = $('detailHero');
    var glyphs = $('detailGlyphs');
    hero.textContent = state.preview || 'Handgloves';
    hero.style.fontFamily = f.stack;
    glyphs.style.fontFamily = f.stack;
    hero.classList.remove('is-ready');
    glyphs.classList.remove('is-ready');
    F.ready(name).then(function () {
      hero.classList.add('is-ready');
      glyphs.classList.add('is-ready');
    });

    /* every cut this family ships, each set in itself */
    var wSample = state.preview || f.name;
    var wl = '';
    f.weights.forEach(function (w) {
      wl += '<button data-set-weight="' + w + '" aria-label="Preview ' + w + '">' +
        '<span class="w">' + w + ' ' + (D.WEIGHT_LABELS[w] || '') + '</span>' +
        '<span class="s fnt is-ready" style="font-family:' + f.stack.replace(/"/g, '&quot;') +
        ';font-weight:' + w + '">' + L.escapeHtml(wSample) + '</span>' +
      '</button>';
    });
    $('detailWeights').innerHTML = wl;
    $('detailWeightNote').textContent = f.weights.length === 1
      ? 'This family ships a single weight. Faux-bolding it is disabled site-wide, so 700 will render as 400.'
      : f.weights.length + ' weights available. Click one to preview the whole library in it.';
    F.load(f.name, {
      priority: true,
      weights: f.weights.length > 1 ? f.weights.join(';') : null
    });

    var wf = '';
    var sample = state.preview || D.SAMPLES[0];
    WATERFALL.forEach(function (px) {
      wf += '<div><span class="px label">' + px + '</span>' +
        '<span class="sample fnt is-ready" style="font-family:' + f.stack.replace(/"/g, '&quot;') +
        ';font-size:' + px + 'px">' + L.escapeHtml(sample) + '</span></div>';
    });
    $('detailWaterfall').innerHTML = wf;

    $('detailTags').innerHTML = [f.category, f.tag, f.body ? 'body text' : 'headlines']
      .map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');

    /* request the cuts this family really has - never a phantom 700 */
    var axis = f.weights.length > 1 ? ':wght@' + f.weights.join(';') : '';
    var url = 'https://fonts.googleapis.com/css2?family=' +
      f.name.replace(/\s+/g, '+') + axis + '&display=swap';
    detailCode.link = '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
      '<link href="' + url + '" rel="stylesheet">';
    detailCode.css = 'font-family: ' + f.stack + ';';
    detailCode.import = '@import url("' + url + '");';
    $('detailLink').textContent = detailCode.link;
    $('detailCss').textContent = detailCode.css;

    $('detailGoogle').href = 'https://fonts.google.com/specimen/' + f.name.replace(/\s+/g, '+');
    $('detailPairTitle').href = 'pairings.html?title=' + encodeURIComponent(f.name);
    $('detailPairBody').href = 'pairings.html?body=' + encodeURIComponent(f.name);

    syncDetailSave();

    overlay.classList.add('is-open');
    overlay.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    $('detailClose').focus();
  }

  function closeDetail() {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    detailFont = null;
    if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
  }

  function syncDetailSave() {
    if (!detailFont) { return; }
    var on = L.saved.hasFont(detailFont.name);
    var btn = $('detailSave');
    btn.textContent = on ? 'Saved ★' : 'Save';
    btn.classList.toggle('is-active', on);
  }

  $('detailClose').addEventListener('click', closeDetail);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) { closeDetail(); }
  });

  $('detailSave').addEventListener('click', function () {
    if (!detailFont) { return; }
    var added = L.saved.toggleFont(detailFont.name);
    syncDetailSave();
    updateSavedCount();
    L.toast(added ? 'Saved ' + detailFont.name : 'Removed ' + detailFont.name);
    var btn = grid.querySelector('[data-save="' + detailFont.name + '"]');
    if (btn) {
      btn.classList.toggle('is-saved', added);
      btn.setAttribute('aria-pressed', String(added));
      btn.textContent = added ? 'Saved' : 'Save';
    }
  });

  /* picking a weight in the detail panel re-sets the whole library in it */
  overlay.addEventListener('click', function (e) {
    var wb = e.target.closest('[data-set-weight]');
    if (!wb) { return; }
    state.weight = parseInt(wb.getAttribute('data-set-weight'), 10) || 400;
    weightSelect.value = String(state.weight);
    try { localStorage.setItem('layz.weight', state.weight); } catch (err) {}
    render();
    L.toast('Previewing at ' + state.weight);
  });

  overlay.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) { return; }
    var kind = btn.getAttribute('data-copy');
    L.copy(detailCode[kind],
      'Copied the ' + (kind === 'link' ? 'link tag' : kind === 'css' ? 'CSS rule' : '@import'));
  });

  /* ---------------- keyboard ---------------- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) { closeDetail(); return; }
    var active = document.activeElement || document.body;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable) { return; }
    if (e.metaKey || e.ctrlKey || e.altKey) { return; }
    if (e.key === '/') { e.preventDefault(); search.focus(); search.select(); }
    if (e.key.toLowerCase() === 'p') { e.preventDefault(); preview.focus(); }
  });

  /* ---------------- load stats ---------------- */
  setInterval(function () {
    var s = F.stats();
    $('loadStats').textContent = s.live + ' live / ' + s.requests + ' requests' +
      (s.evicted ? ' / ' + s.evicted + ' released' : '');
  }, 900);

  render(true);
})();
