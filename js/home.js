/* ============================================================
   Layz - homepage behaviour
   ============================================================ */
(function () {
  'use strict';

  var D = window.LayzData;
  var L = window.Layz;
  var F = window.LayzFonts;
  var P = window.LayzPairs;

  var $ = function (id) { return document.getElementById(id); };
  var reduce = L.reduceMotion;

  /* ---------- 1. hero: the word that swaps typefaces ---------- */
  var MORPH_FONTS = [
    'Instrument Serif', 'Bebas Neue', 'Fraunces', 'Space Grotesk', 'Playfair Display',
    'Unbounded', 'Caveat', 'Bodoni Moda', 'Syne', 'Archivo Black', 'Prata', 'Monoton'
  ];
  F.load(MORPH_FONTS, { priority: true });

  /* Once the entry animation has played, the masking overflow is no longer
     needed - and keeping it would clip the descenders of whichever face the
     morph word lands on next. */
  var heroTitle = document.querySelector('.hero-title');
  if (heroTitle) {
    if (reduce) { heroTitle.classList.add('is-settled'); }
    else { setTimeout(function () { heroTitle.classList.add('is-settled'); }, 1600); }
  }

  var morph = $('morphWord');
  if (morph) {
    /* set the first face straight away so the word never sits in the UI font */
    F.ready(MORPH_FONTS[0]).then(function () {
      if (morph.style.fontFamily) { return; }
      morph.style.fontFamily = D.BY_NAME[MORPH_FONTS[0]].stack;
    });
  }
  if (morph && !reduce) {
    var mi = 0;
    setInterval(function () {
      mi = (mi + 1) % MORPH_FONTS.length;
      var name = MORPH_FONTS[mi];
      morph.style.transition = 'opacity .18s ease, transform .18s ease';
      morph.style.opacity = '0';
      morph.style.transform = 'translateY(-4px)';
      setTimeout(function () {
        var f = D.BY_NAME[name];
        morph.style.fontFamily = f ? f.stack : name;
        morph.style.opacity = '1';
        morph.style.transform = 'none';
      }, 190);
    }, 2400);
  }

  /* ---------- 2. specimen ---------- */
  var SPECIMEN = [
    'Instrument Serif', 'Bebas Neue', 'Playfair Display', 'Space Grotesk', 'Fraunces',
    'Abril Fatface', 'Unbounded', 'Cormorant Garamond', 'Archivo Black', 'Dancing Script',
    'JetBrains Mono', 'Gloock', 'Righteous', 'Young Serif', 'Syne'
  ];
  F.load(SPECIMEN);

  var glyph = $('specimenGlyph');
  var sName = $('specimenName');
  var sCat = $('specimenCat');
  var sIdx = $('specimenIndex');

  function showSpecimen(i) {
    var name = SPECIMEN[i % SPECIMEN.length];
    var f = D.BY_NAME[name] || { stack: name, category: 'sans', name: name };
    glyph.style.fontFamily = f.stack;
    glyph.style.animation = 'none';
    void glyph.offsetWidth;
    glyph.style.animation = '';
    F.ready(name).then(function () { glyph.style.fontFamily = f.stack; });
    sName.textContent = f.name;
    sCat.textContent = f.category;
    sIdx.textContent = String((i % SPECIMEN.length) + 1).padStart(2, '0');
  }

  if (glyph) {
    var si = 0;
    showSpecimen(si);
    if (!reduce) { setInterval(function () { showSpecimen(++si); }, 2800); }
    $('specimen').addEventListener('click', function () { showSpecimen(++si); });
  }

  /* ---------- 3. counters ---------- */
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    var totals = {
      fonts: D.FONTS.length,
      pairs: D.CURATED.length,
      categories: D.CATEGORIES.length - 1
    };
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) { return; }
        L.countUp(e.target, parseInt(e.target.getAttribute('data-to'), 10) || 0, 1400);
        cio.unobserve(e.target);
      });
    }, { threshold: .4 });

    counters.forEach(function (c) {
      var key = c.getAttribute('data-count');
      var to = totals[key] !== undefined ? totals[key] : (parseInt(key, 10) || 0);
      /* Seed the real figure first: the count-up is decoration, and a
         stat that never animates must still read correctly. */
      c.setAttribute('data-to', to);
      c.textContent = to;
      cio.observe(c);
    });
  }

  /* ---------- 4. marquee ---------- */
  var MARQUEE_A = ['Playfair Display', 'Space Grotesk', 'Bebas Neue', 'Cormorant Garamond',
    'Anton', 'Lora', 'Syne', 'DM Serif Display', 'Outfit', 'Fraunces', 'Oswald', 'Spectral'];
  var MARQUEE_B = ['Caveat', 'Archivo Black', 'EB Garamond', 'Poppins', 'Bodoni Moda',
    'Righteous', 'Manrope', 'Cinzel', 'Pacifico', 'Merriweather', 'Sora', 'Prata'];

  function buildMarquee(el, names) {
    if (!el) { return; }
    var html = '';
    /* duplicated once so the -50% translate loops seamlessly */
    for (var pass = 0; pass < 2; pass++) {
      names.forEach(function (name) {
        var f = D.BY_NAME[name];
        if (!f) { return; }
        html += '<span class="fnt" data-mq="' + f.name + '" style="font-family:' +
          f.stack.replace(/"/g, '&quot;') + '">' + L.escapeHtml(f.name) + '</span>';
      });
    }
    el.innerHTML = html;
  }

  buildMarquee($('marqueeA'), MARQUEE_A);
  buildMarquee($('marqueeB'), MARQUEE_B);

  var band = $('marqueeBand');
  if (band) {
    var mqio = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) { return; }
      mqio.disconnect();
      F.load(MARQUEE_A.concat(MARQUEE_B));
      band.querySelectorAll('.fnt').forEach(function (el) {
        F.ready(el.getAttribute('data-mq')).then(function () { el.classList.add('is-ready'); });
      });
    }, { rootMargin: '300px' });
    mqio.observe(band);
  }

  /* ---------- 5. live pairing ---------- */
  var hp = {
    tag: $('hpTag'), note: $('hpNote'), title: $('hpTitle'), body: $('hpBody'),
    tName: $('hpTitleName'), bName: $('hpBodyName'), open: $('hpOpen')
  };

  function renderPair(pair) {
    var copy = D.HEADLINES[Math.floor(Math.random() * D.HEADLINES.length)];
    hp.tag.textContent = pair.label || 'Pairing';
    hp.note.textContent = pair.curated ? 'Hand-picked' : 'Generated';
    hp.title.textContent = copy[0];
    hp.body.textContent = copy[1];
    hp.tName.textContent = pair.title.name;
    hp.bName.textContent = pair.body.name;
    hp.open.href = 'pairings.html?title=' + encodeURIComponent(pair.title.name) +
      '&body=' + encodeURIComponent(pair.body.name);

    /* the showcase headline renders at 700 - fetch that cut, not just 400 */
    F.load(pair.title.name, { priority: true, weights: '400;700' });

    hp.title.classList.remove('is-ready');
    hp.body.classList.remove('is-ready');
    hp.title.style.fontFamily = pair.title.stack;
    hp.body.style.fontFamily = pair.body.stack;
    F.ready(pair.title.name).then(function () { hp.title.classList.add('is-ready'); });
    F.ready(pair.body.name).then(function () { hp.body.classList.add('is-ready'); });
  }

  if (hp.title) {
    var card = $('homePair');
    var pio = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) { return; }
      pio.disconnect();
      renderPair(P.generate({ curatedChance: 1 }));
    }, { rootMargin: '250px' });
    pio.observe(card);

    var shuffleBtn = $('homeShuffle');
    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', function () {
        renderPair(P.generate());
        if (!reduce) {
          card.animate(
            [{ clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }],
            { duration: 600, easing: 'cubic-bezier(.86,0,.07,1)' }
          );
        }
      });
    }
  }

  /* ---------- 6. category rows ---------- */
  var GLYPH_FONT = {
    sans: 'Space Grotesk', serif: 'Playfair Display', display: 'Bebas Neue',
    handwriting: 'Caveat', mono: 'JetBrains Mono'
  };
  var BLURB = {
    sans: 'Neutral, modern, endlessly useful',
    serif: 'Bookish, editorial, warm',
    display: 'Loud on purpose',
    handwriting: 'Human, informal, personal',
    mono: 'Fixed width, technical'
  };

  var grid = $('catGrid');
  if (grid) {
    var counts = {};
    D.FONTS.forEach(function (f) { counts[f.category] = (counts[f.category] || 0) + 1; });

    var out = '';
    D.CATEGORIES.filter(function (c) { return c.id !== 'all'; }).forEach(function (c, i) {
      var f = D.BY_NAME[GLYPH_FONT[c.id]];
      out += '<a class="rows-item" href="fonts.html?category=' + c.id + '" data-cursor="Open">' +
        '<span class="num">' + L.pad(i + 1, 2) + '</span>' +
        '<span class="cat-name fnt" data-mq="' + GLYPH_FONT[c.id] + '" style="font-family:' +
          (f ? f.stack.replace(/"/g, '&quot;') : 'inherit') + '">' + c.label + '</span>' +
        '<span class="cat-blurb label label--soft">' + BLURB[c.id] + '</span>' +
        '<span class="cat-count label label--soft">' + counts[c.id] + ' fonts</span>' +
        '<svg class="cat-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>' +
        '</a>';
    });
    grid.innerHTML = out;

    var gio = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) { return; }
      gio.disconnect();
      var names = Object.keys(GLYPH_FONT).map(function (k) { return GLYPH_FONT[k]; });
      F.load(names);
      grid.querySelectorAll('.fnt').forEach(function (el) {
        F.ready(el.getAttribute('data-mq')).then(function () { el.classList.add('is-ready'); });
      });
    }, { rootMargin: '300px' });
    gio.observe(grid);
  }
})();
