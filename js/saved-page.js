/* ============================================================
   Layz - saved page: shortlisted fonts AND pairings
   ============================================================ */
(function () {
  'use strict';

  var D = window.LayzData;
  var L = window.Layz;
  var F = window.LayzFonts;

  var $ = function (id) { return document.getElementById(id); };

  var fontsEl = $('savedFonts');
  var pairsEl = $('savedPairs');

  var size = 34;
  try {
    var s = localStorage.getItem('layz.size');
    if (s) { size = parseInt(s, 10) || 34; }
  } catch (e) {}

  var io = F.observer(function (el, name) {
    F.ready(name).then(function () {
      var p = el.querySelector('.fr-preview, .gtitle, .gbody');
      if (p) { p.classList.add('is-ready'); }
    });
  }, { persist: true, rootMargin: '900px 0px' });

  /* ---------------- saved fonts ---------------- */
  function fontRow(f, i) {
    return '<article class="font-row" data-font="' + L.escapeHtml(f.name) + '" ' +
        'tabindex="0" role="button" data-cursor="Open" ' +
        'aria-label="' + L.escapeHtml(f.name) + ' in the library" ' +
        'style="animation-delay:' + Math.min(i, 14) * 0.025 + 's">' +
      '<span class="fr-top">' +
        '<span class="num fr-num">' + L.pad(i + 1) + '</span>' +
        '<span class="label fr-name">' + L.escapeHtml(f.name) + '</span>' +
      '</span>' +
      '<span class="fr-preview fnt" style="font-family:' + f.stack.replace(/"/g, '&quot;') + '">' +
        L.escapeHtml(f.name) +
      '</span>' +
      '<span class="label label--soft fr-meta">' + f.category + ' &middot; ' + f.tag + '</span>' +
      '<button class="fr-save" data-remove-font="' + L.escapeHtml(f.name) + '" ' +
        'aria-label="Remove ' + L.escapeHtml(f.name) + '">Remove</button>' +
    '</article>';
  }

  function renderFonts() {
    var names = L.saved.all().fonts;
    var list = names.map(function (n) { return D.BY_NAME[n]; }).filter(Boolean);

    fontsEl.innerHTML = list.map(fontRow).join('');
    fontsEl.style.setProperty('--preview-size', size + 'px');
    fontsEl.querySelectorAll('.font-row').forEach(function (r) { io.observe(r); });

    $('fontCount').textContent = list.length;
    $('sumFonts').textContent = list.length;
    $('fontsEmpty').hidden = list.length > 0;
    fontsEl.hidden = list.length === 0;
    $('clearFonts').hidden = list.length === 0;
  }

  /* ---------------- saved pairings ---------------- */
  function pairRow(p, i) {
    var t = p.title, b = p.body;
    return '<button class="gcard" data-title="' + L.escapeHtml(t.name) + '" ' +
        'data-body="' + L.escapeHtml(b.name) + '" data-cursor="Open" ' +
        'style="animation-delay:' + Math.min(i, 14) * 0.03 + 's">' +
      '<span class="gnum num">' + L.pad(i + 1, 2) + '</span>' +
      '<span class="gtitle fnt" data-font="' + L.escapeHtml(t.name) + '" style="font-family:' +
        t.stack.replace(/"/g, '&quot;') + '">Aa Bb</span>' +
      '<span class="gbody fnt" data-font="' + L.escapeHtml(b.name) + '" style="font-family:' +
        b.stack.replace(/"/g, '&quot;') + '">The quick brown fox jumps over the lazy dog and keeps on running.</span>' +
      '<span class="gfoot">' +
        '<span class="label">' + L.escapeHtml(t.name) + '</span>' +
        '<span class="label label--soft">' + L.escapeHtml(b.name) + '</span>' +
      '</span>' +
      '<span class="gtag label label--soft">' + L.escapeHtml(p.label || 'Pairing') + '</span>' +
      '<span class="gremove" data-remove-pair="1" role="button" aria-label="Remove pairing">&times;</span>' +
    '</button>';
  }

  function renderPairs() {
    var records = L.saved.all().pairs;
    var list = records.map(function (r) {
      var t = D.BY_NAME[r.title], b = D.BY_NAME[r.body];
      return (t && b) ? { title: t, body: b, label: r.label } : null;
    }).filter(Boolean);

    pairsEl.innerHTML = list.map(pairRow).join('');
    /* both halves of a pairing need their face loaded */
    pairsEl.querySelectorAll('.fnt[data-font]').forEach(function (n) { io.observe(n); });

    $('pairCount').textContent = list.length;
    $('sumPairs').textContent = list.length;
    $('pairsEmpty').hidden = list.length > 0;
    pairsEl.hidden = list.length === 0;
    $('clearPairs').hidden = list.length === 0;
  }

  /* ---------------- interactions ---------------- */
  fontsEl.addEventListener('click', function (e) {
    var rm = e.target.closest('[data-remove-font]');
    if (rm) {
      e.stopPropagation();
      var name = rm.getAttribute('data-remove-font');
      L.saved.toggleFont(name);
      L.toast('Removed ' + name);
      renderFonts();
      return;
    }
    var row = e.target.closest('.font-row');
    if (row) {
      location.href = 'fonts.html?q=' + encodeURIComponent(row.getAttribute('data-font'));
    }
  });

  fontsEl.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') { return; }
    var row = e.target.closest('.font-row');
    if (!row) { return; }
    e.preventDefault();
    location.href = 'fonts.html?q=' + encodeURIComponent(row.getAttribute('data-font'));
  });

  pairsEl.addEventListener('click', function (e) {
    var card = e.target.closest('.gcard');
    if (!card) { return; }
    var t = card.getAttribute('data-title');
    var b = card.getAttribute('data-body');

    if (e.target.closest('[data-remove-pair]')) {
      e.stopPropagation();
      L.saved.removePair({ title: t, body: b });
      L.toast('Pairing removed');
      renderPairs();
      return;
    }
    location.href = 'pairings.html?title=' + encodeURIComponent(t) + '&body=' + encodeURIComponent(b);
  });

  $('clearFonts').addEventListener('click', function () {
    var d = L.saved.all();
    if (!d.fonts.length) { return; }
    if (!confirm('Remove all ' + d.fonts.length + ' saved fonts?')) { return; }
    d.fonts.slice().forEach(function (n) { L.saved.toggleFont(n); });
    renderFonts();
    L.toast('Saved fonts cleared');
  });

  $('clearPairs').addEventListener('click', function () {
    var d = L.saved.all();
    if (!d.pairs.length) { return; }
    if (!confirm('Remove all ' + d.pairs.length + ' saved pairings?')) { return; }
    d.pairs.slice().forEach(function (p) { L.saved.removePair(p); });
    renderPairs();
    L.toast('Saved pairings cleared');
  });

  var slider = $('sizeSlider');
  slider.value = size;
  $('sizeValue').textContent = size;
  slider.addEventListener('input', function () {
    size = parseInt(slider.value, 10);
    $('sizeValue').textContent = size;
    fontsEl.style.setProperty('--preview-size', size + 'px');
    try { localStorage.setItem('layz.size', size); } catch (e) {}
  });

  /* another tab (or the pairing tool) changed the shortlist */
  window.addEventListener('storage', function (e) {
    if (e.key === 'layz.saved.v1') { renderFonts(); renderPairs(); }
  });

  renderFonts();
  renderPairs();
})();
