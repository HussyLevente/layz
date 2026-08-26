/* ============================================================
   Layz - pairing engine
   ------------------------------------------------------------
   Generates title/body font pairs that are actually usable.
   Rather than picking two fonts at random, it samples candidates
   and scores them on the rules real typographers use:

     + different categories (contrast in voice)
     + members of the same superfamily (built to sit together)
     + body font must be readable at 16px
     - two display faces shouting at each other
     - identical category AND identical sub-genre (muddy, no contrast)
   ============================================================ */
(function (global) {
  'use strict';

  var D = global.LayzData;

  /* Families designed as a set - always a safe pairing. */
  var SUPERFAMILIES = [
    'IBM Plex', 'Red Hat', 'DM ', 'Source ', 'Fira ', 'Roboto', 'Noto ',
    'PT ', 'Crimson', 'Josefin', 'Archivo', 'Libre ', 'Playfair', 'Inter',
    'Geist', 'Instrument', 'Bungee', 'Wix Madefor', 'Rubik', 'Chivo',
    'Overpass', 'Ubuntu', 'Syne', 'Nunito'
  ];

  function superfamilyOf(name) {
    for (var i = 0; i < SUPERFAMILIES.length; i++) {
      if (name.indexOf(SUPERFAMILIES[i]) === 0) { return SUPERFAMILIES[i].trim(); }
    }
    return null;
  }

  function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* Fonts that can carry a headline: anything but a plain body mono. */
  var TITLE_POOL = D.FONTS.filter(function (f) {
    return f.category !== 'mono' || !f.body;
  });
  /* Fonts safe for paragraphs. */
  var BODY_POOL = D.FONTS.filter(function (f) { return f.body; });

  function pool(list, category) {
    if (!category || category === 'all') { return list; }
    var filtered = list.filter(function (f) { return f.category === category; });
    return filtered.length ? filtered : list;
  }

  function score(title, body) {
    if (title.name === body.name) { return -100; }
    var s = 0;
    var famA = superfamilyOf(title.name);
    var famB = superfamilyOf(body.name);

    if (famA && famA === famB) { s += 5; }
    if (title.category !== body.category) { s += 3; }
    if (title.category === body.category && title.tag === body.tag) { s -= 4; }
    if (title.category === 'display' && body.category === 'display') { s -= 6; }
    if (title.category === 'handwriting' && body.category === 'handwriting') { s -= 6; }

    /* Classic axes of contrast. */
    if (title.category === 'serif' && body.category === 'sans') { s += 2; }
    if (title.category === 'display' && (body.category === 'sans' || body.category === 'serif')) { s += 2; }
    if (title.category === 'handwriting' && body.category === 'sans') { s += 2; }

    /* A neutral body under an expressive title is almost always right. */
    if (/neo-grotesque|humanist|grotesque|transitional/.test(body.tag)) { s += 1; }
    /* Two loud personalities rarely work. */
    if (title.tag === 'quirky' && body.tag === 'quirky') { s -= 4; }
    /* Weight/width sympathy. */
    if (title.tag === 'condensed' && body.tag === 'condensed') { s -= 2; }
    if (title.tag === 'pixel' && body.tag !== 'neo-grotesque') { s -= 1; }

    /* The library now carries every Latin family Google publishes, most of
       them untagged. Favour the hand-classified ones so a shuffle mostly
       lands on faces someone actually vouched for, without ever excluding
       the rest. */
    if (title.curated && body.curated) { s += 3; }
    else if (title.curated || body.curated) { s += 1; }

    s += Math.random() * 2; /* keeps results fresh between clicks */
    return s;
  }

  /*
    generate({ titleCategory, bodyCategory, lockTitle, lockBody, curatedChance })
    -> { title: Font, body: Font, curated: bool, note: string|null }
  */
  function generate(opts) {
    opts = opts || {};
    var curatedChance = opts.curatedChance === undefined ? 0.22 : opts.curatedChance;
    var anyCat = (!opts.titleCategory || opts.titleCategory === 'all') &&
                 (!opts.bodyCategory || opts.bodyCategory === 'all');

    /* Sometimes just serve a hand-picked classic. */
    if (!opts.lockTitle && !opts.lockBody && anyCat && Math.random() < curatedChance) {
      var c = rand(D.CURATED);
      var ct = D.BY_NAME[c[0]], cb = D.BY_NAME[c[1]];
      if (ct && cb) {
        return { title: ct, body: cb, curated: true, label: c[2], note: c[3] };
      }
    }

    var titles = pool(TITLE_POOL, opts.titleCategory);
    var bodies = pool(BODY_POOL, opts.bodyCategory);
    /* When a body category is explicitly chosen, honour it even if the
       family is not strictly body-safe (user asked for display body). */
    if (opts.bodyCategory && opts.bodyCategory !== 'all') {
      var strict = D.FONTS.filter(function (f) { return f.category === opts.bodyCategory; });
      var safe = strict.filter(function (f) { return f.body; });
      bodies = safe.length ? safe : strict;
    }

    var lockedTitle = opts.lockTitle ? D.BY_NAME[opts.lockTitle] : null;
    var lockedBody = opts.lockBody ? D.BY_NAME[opts.lockBody] : null;

    var best = null, bestScore = -Infinity;
    for (var i = 0; i < 40; i++) {
      var t = lockedTitle || rand(titles);
      var b = lockedBody || rand(bodies);
      if (!t || !b || t.name === b.name) { continue; }
      var s = score(t, b);
      if (s > bestScore) { bestScore = s; best = { title: t, body: b }; }
      if (lockedTitle && lockedBody) { break; }
    }

    if (!best) {
      best = { title: lockedTitle || rand(titles), body: lockedBody || rand(bodies) };
    }
    best.curated = false;
    best.label = describe(best.title, best.body);
    best.note = null;
    return best;
  }

  /* A short human label for a generated pair. */
  function describe(t, b) {
    var famA = superfamilyOf(t.name), famB = superfamilyOf(b.name);
    if (famA && famA === famB) { return 'Superfamily'; }
    if (t.category === 'display' || t.category === 'handwriting') { return 'Expressive'; }
    if (t.category === 'serif' && b.category === 'sans') { return 'Editorial'; }
    if (t.category === 'sans' && b.category === 'serif') { return 'Reverse'; }
    if (t.category === 'mono') { return 'Technical'; }
    if (t.category === 'sans' && b.category === 'sans') { return 'Systematic'; }
    return 'Balanced';
  }

  function curatedPairs() {
    return D.CURATED.map(function (c) {
      return {
        title: D.BY_NAME[c[0]],
        body: D.BY_NAME[c[1]],
        label: c[2],
        note: c[3],
        curated: true
      };
    }).filter(function (p) { return p.title && p.body; });
  }

  /* The css2 endpoint silently ignores a weight a family does not have, so
     asking for :wght@400;700 on a single-weight face produces code that looks
     right and renders wrong. Only ever request weights that actually exist. */
  function headingWeight(font) {
    return D.hasWeight(font, 700) ? 700 : D.nearestWeight(font, 700);
  }

  function axisFor(font, weights) {
    var have = weights.filter(function (w) { return D.hasWeight(font, w); });
    if (!have.length) { have = [font.weights[0]]; }
    have.sort(function (a, b) { return a - b; });
    var name = font.name.replace(/\s+/g, '+');
    /* a family with only its default instance needs no axis at all */
    if (have.length === 1 && have[0] === 400) { return 'family=' + name; }
    return 'family=' + name + ':wght@' + have.join(';');
  }

  function embedUrl(pair) {
    var tw = headingWeight(pair.title);
    return 'https://fonts.googleapis.com/css2?' +
      axisFor(pair.title, [400, tw]) + '&' +
      axisFor(pair.body, [400, 700]) + '&display=swap';
  }

  function cssFor(pair) {
    var tw = headingWeight(pair.title);
    var note = tw === 700 ? '' :
      '/* ' + pair.title.name + ' ships only ' + pair.title.weights.join('/') +
      ' - headings use ' + tw + ' */\n';

    return '@import url("' + embedUrl(pair) + '");\n\n' + note +
      ':root {\n' +
      '  --font-title: ' + pair.title.stack + ';\n' +
      '  --font-body:  ' + pair.body.stack + ';\n' +
      '}\n\n' +
      'h1, h2, h3, h4 {\n' +
      '  font-family: var(--font-title);\n' +
      '  font-weight: ' + tw + ';\n' +
      '  letter-spacing: -0.02em;\n' +
      '  line-height: 1.1;\n' +
      '}\n\n' +
      'body, p {\n' +
      '  font-family: var(--font-body);\n' +
      '  font-weight: 400;\n' +
      '  line-height: 1.65;\n' +
      '}';
  }

  function linkFor(pair) {
    return '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
      '<link href="' + embedUrl(pair) + '" rel="stylesheet">';
  }

  global.LayzPairs = {
    generate: generate,
    curatedPairs: curatedPairs,
    cssFor: cssFor,
    linkFor: linkFor,
    embedUrl: embedUrl,
    headingWeight: headingWeight,
    superfamilyOf: superfamilyOf,
    TITLE_POOL: TITLE_POOL,
    BODY_POOL: BODY_POOL
  };
})(window);
