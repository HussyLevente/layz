/* ============================================================
   Layz - lazy, batched Google Fonts loader
   ------------------------------------------------------------
   Loading 250 families as 250 <link> tags would open 250 requests
   and block rendering. Instead we:

     1. queue every family that is actually about to be seen
     2. coalesce the queue on the next frame
     3. ship ONE css2 request per batch (up to BATCH_SIZE families)
     4. never request the same family twice
     5. evict batches that scrolled far out of view once the number
        of live families passes MAX_FAMILIES, so a very long
        catalogue cannot grow the font cache without bound

   Requests carry no weight axis unless one is asked for, so Google
   returns the default (400) instance only - the smallest payload.
   ============================================================ */
(function (global) {
  'use strict';

  var ENDPOINT = 'https://fonts.googleapis.com/css2';
  var BATCH_SIZE = 18;       /* families per request */
  var IDLE_DELAY = 40;       /* ms to collect a batch before firing */
  var FACE_TIMEOUT = 4000;   /* give up waiting on glyphs after this */
  var LINK_TIMEOUT = 8000;   /* backstop if the <link> fires no event */
  var MAX_FAMILIES = 240;    /* live families before eviction kicks in */

  var requested = Object.create(null);  /* entry -> true, already sent */
  var waiters = Object.create(null);    /* name  -> [resolve, ...] */
  var settled = Object.create(null);    /* name  -> true, glyphs ready */
  var retained = Object.create(null);   /* name  -> true, still on screen */
  var batches = [];                     /* { link, entries } oldest first */
  var liveFamilies = 0;

  var queue = [];
  var priorityQueue = [];
  var timer = null;
  var sweepTimer = null;
  var stats = { requests: 0, families: 0, evicted: 0 };

  /* A queue entry is one of:
       "Family"                              default (400) instance only
       "Family|400;700"                      a weight list
       "Family@@opsz,wght@14..32,100..900"   a ready-made css2 axis tuple
     The third form exists because the weight-list form structurally cannot
     express a multi-axis variable request. */
  function split(entry) {
    var v = entry.indexOf('@@');
    if (v !== -1) {
      return { name: entry.slice(0, v), weights: null, axes: entry.slice(v + 2) };
    }
    var i = entry.indexOf('|');
    return i === -1
      ? { name: entry, weights: null, axes: null }
      : { name: entry.slice(0, i), weights: entry.slice(i + 1), axes: null };
  }

  function encodeFamily(entry) {
    var e = split(entry);
    var fam = 'family=' + e.name.trim().replace(/\s+/g, '+');
    if (e.axes) { return fam + ':' + e.axes; }
    return fam + (e.weights ? ':wght@' + e.weights : '');
  }

  /* css2 rejects the whole request if an axis does not exist on the family or
     a value falls outside its real range, so the ranges handed in here have to
     come from real metadata rather than a guess. Tag order is NOT enforced by
     the endpoint, but sorting lowercase-then-uppercase matches the documented
     form and keeps the dedupe key stable for a given set of axes. */
  function axisSpec(axes) {
    var lower = [], upper = [];
    for (var i = 0; i < axes.length; i++) {
      (axes[i].tag === axes[i].tag.toLowerCase() ? lower : upper).push(axes[i]);
    }
    var cmp = function (x, y) { return x.tag < y.tag ? -1 : x.tag > y.tag ? 1 : 0; };
    lower.sort(cmp);
    upper.sort(cmp);
    var ord = lower.concat(upper);
    return ord.map(function (a) { return a.tag; }).join(',') + '@' +
           ord.map(function (a) { return a.min + '..' + a.max; }).join(',');
  }

  function notify(name) {
    if (settled[name]) { return; }
    settled[name] = true;
    var list = waiters[name];
    if (list) {
      delete waiters[name];
      for (var i = 0; i < list.length; i++) { list[i](name); }
    }
    document.dispatchEvent(new CustomEvent('layz:fontready', { detail: { font: name } }));
  }

  /* Ask the browser whether the real glyphs have arrived. */
  function watchFace(name) {
    if (settled[name]) { return; }
    if (!global.document || !document.fonts || !document.fonts.load) {
      notify(name);
      return;
    }
    var done = false;
    var finish = function () {
      if (done) { return; }
      done = true;
      notify(name);
    };
    setTimeout(finish, FACE_TIMEOUT);
    try {
      document.fonts.load('16px "' + name + '"').then(finish, finish);
    } catch (e) {
      finish();
    }
  }

  function ship(entries, isRetry) {
    if (!entries.length) { return; }
    var href = ENDPOINT + '?' + entries.map(encodeFamily).join('&') + '&display=swap';
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-layz-batch', String(entries.length));

    var settle = function () {
      entries.forEach(function (e) { watchFace(split(e).name); });
    };

    link.onload = settle;
    link.onerror = function () {
      /* The css2 endpoint rejects the WHOLE request if one family is
         unknown, so split the batch: one bad name must not take out the
         seventeen good ones queued next to it. */
      if (!isRetry && entries.length > 1) {
        entries.forEach(function (e) { ship([e], true); });
        return;
      }
      /* A single family still failing - try once more without any axis
         request at all, then give up and let the fallback stack render. */
      var e = split(entries[0]);
      if (e.weights || e.axes) { ship([e.name], true); }
      else { watchFace(e.name); }
    };

    /* Backstop: if the element never fires either event (proxy, blocked
       request, bfcache restore) nothing downstream should wait forever. */
    setTimeout(settle, LINK_TIMEOUT);

    document.head.appendChild(link);
    stats.requests++;
    if (!isRetry) {
      stats.families += entries.length;
      liveFamilies += entries.length;
      batches.push({ link: link, entries: entries });
    }
  }

  /* Every request here discloses the visitor's IP to Google, so nothing is
     shipped until consent allows it. Queued families simply wait. */
  function allowed() {
    return !global.LayzConsent || global.LayzConsent.granted();
  }

  function flush() {
    timer = null;
    if (!allowed()) { return; }
    var source = priorityQueue.length ? priorityQueue : queue;
    if (!source.length) { return; }
    var batch = source.splice(0, BATCH_SIZE);
    ship(batch);
    if (priorityQueue.length || queue.length) { schedule(); }
  }

  if (global.LayzConsent && global.LayzConsent.onChange) {
    global.LayzConsent.onChange(function (ok) {
      if (ok) { schedule(true); }
    });
  }

  function schedule(immediate) {
    if (timer) {
      if (!immediate) { return; }
      clearTimeout(timer);
    }
    timer = setTimeout(flush, immediate ? 0 : IDLE_DELAY);
  }

  /* -------- eviction --------
     Dropping a batch removes its @font-face rules and lets the browser
     release the decoded glyph data. The files stay in the HTTP cache, so
     scrolling back re-attaches them without a network round trip. */
  function sweep() {
    sweepTimer = null;
    if (liveFamilies <= MAX_FAMILIES) { return; }

    for (var i = 0; i < batches.length && liveFamilies > MAX_FAMILIES; i++) {
      var b = batches[i];
      var keep = b.entries.some(function (e) { return retained[split(e).name]; });
      if (keep) { continue; }

      if (b.link.parentNode) { b.link.parentNode.removeChild(b.link); }
      b.entries.forEach(function (e) {
        var name = split(e).name;
        delete requested[e];
        delete settled[name];
      });
      liveFamilies -= b.entries.length;
      stats.evicted += b.entries.length;
      batches.splice(i, 1);
      i--;
    }
  }

  function scheduleSweep() {
    if (sweepTimer) { return; }
    sweepTimer = setTimeout(sweep, 400);
  }

  /* -------- public API -------- */

  /* load('Inter')
     load(['Inter','Lora'], { priority: true })
     load('Bitter', { weights: '400;700' })   <- headline previews */
  function load(names, opts) {
    if (typeof names === 'string') { names = [names]; }
    if (!names || !names.length) { return; }
    var priority = !!(opts && opts.priority);
    var weights = (opts && opts.weights) || null;
    /* opts.axes is an array of { tag, min, max } - a variable request. It is
       encoded into the entry so retained/settled stay keyed on the plain
       family name and eviction keeps working. */
    var axes = (opts && opts.axes && opts.axes.length) ? axisSpec(opts.axes) : null;
    var added = false;
    for (var i = 0; i < names.length; i++) {
      if (!names[i]) { continue; }
      retained[names[i]] = true;
      var entry = axes ? names[i] + '@@' + axes
        : weights ? names[i] + '|' + weights
        : names[i];
      if (requested[entry]) { continue; }
      requested[entry] = true;
      (priority ? priorityQueue : queue).push(entry);
      added = true;
    }
    if (added) { schedule(priority); }
  }

  /* Mark a family as no longer on screen; it becomes evictable. */
  function release(names) {
    if (typeof names === 'string') { names = [names]; }
    if (!names || !names.length) { return; }
    for (var i = 0; i < names.length; i++) { retained[names[i]] = false; }
    scheduleSweep();
  }

  /* Promise that resolves once the family's glyphs are usable.
     `opts` is passed straight through to load(), so a variable request can be
     awaited without also triggering a second, static request for the same
     family. */
  function ready(name, opts) {
    load(name, opts || { priority: true });
    if (settled[name]) { return Promise.resolve(name); }
    return new Promise(function (resolve) {
      (waiters[name] = waiters[name] || []).push(resolve);
    });
  }

  function isReady(name) { return !!settled[name]; }

  /*
    observer(onVisible)                       -> load once, then stop watching
    observer(onVisible, { persist: true,      -> also release on the way out
                          onHidden: fn })
    Elements must carry data-font="Family".
  */
  function observer(onVisible, opts) {
    opts = opts || {};
    var persist = !!opts.persist;

    if (!('IntersectionObserver' in global)) {
      return {
        observe: function (el) {
          var name = el.getAttribute('data-font');
          if (name) { load(name); if (onVisible) { onVisible(el, name); } }
        },
        unobserve: function () {},
        disconnect: function () {}
      };
    }

    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var el = entries[i].target;
        var name = el.getAttribute('data-font');
        if (!name) { continue; }
        if (entries[i].isIntersecting) {
          if (!persist) { io.unobserve(el); }
          load(name);
          if (onVisible) { onVisible(el, name); }
        } else if (persist) {
          if (opts.onHidden) { opts.onHidden(el, name); }
          release(name);
        }
      }
    }, { rootMargin: opts.rootMargin || '600px 0px', threshold: 0 });

    return io;
  }

  global.LayzFonts = {
    load: load,
    release: release,
    ready: ready,
    isReady: isReady,
    observer: observer,
    axisSpec: axisSpec,
    stats: function () {
      return {
        requests: stats.requests,
        families: stats.families,
        evicted: stats.evicted,
        live: liveFamilies
      };
    }
  };
})(window);
