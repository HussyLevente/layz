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

  /* A queue entry is "Family" or "Family|400;700" - the weight axis is only
     asked for where it is actually rendered (headline previews), so the
     library grid never pays for glyphs it will not draw. */
  function split(entry) {
    var i = entry.indexOf('|');
    return i === -1
      ? { name: entry, weights: null }
      : { name: entry.slice(0, i), weights: entry.slice(i + 1) };
  }

  function encodeFamily(entry) {
    var e = split(entry);
    return 'family=' + e.name.trim().replace(/\s+/g, '+') +
      (e.weights ? ':wght@' + e.weights : '');
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
      /* A single family still failing - try once more without the weight
         axis, then give up and let the fallback stack render. */
      var e = split(entries[0]);
      if (e.weights) { ship([e.name], true); }
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

  function flush() {
    timer = null;
    var source = priorityQueue.length ? priorityQueue : queue;
    if (!source.length) { return; }
    var batch = source.splice(0, BATCH_SIZE);
    ship(batch);
    if (priorityQueue.length || queue.length) { schedule(); }
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
    var added = false;
    for (var i = 0; i < names.length; i++) {
      if (!names[i]) { continue; }
      retained[names[i]] = true;
      var entry = weights ? names[i] + '|' + weights : names[i];
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

  /* Promise that resolves once the family's glyphs are usable. */
  function ready(name) {
    load(name, { priority: true });
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
