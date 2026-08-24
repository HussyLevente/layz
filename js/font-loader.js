/* ============================================================
   Layz - lazy, batched Google Fonts loader
   ------------------------------------------------------------
   Loading 250 families as 250 <link> tags would open 250 requests
   and block rendering. Instead we:

     1. queue every family that is actually about to be seen
     2. coalesce the queue on the next frame
     3. ship ONE css2 request per batch (up to BATCH_SIZE families)
     4. never request the same family twice
     5. resolve a promise per family via the CSS Font Loading API
        so callers can fade previews in only once glyphs exist

   Requests are made without a weight axis, so Google returns the
   default (400) instance only - the smallest possible payload.
   ============================================================ */
(function (global) {
  'use strict';

  var ENDPOINT = 'https://fonts.googleapis.com/css2';
  var BATCH_SIZE = 18;      /* families per request */
  var IDLE_DELAY = 40;      /* ms to collect a batch before firing */
  var FACE_TIMEOUT = 6000;  /* give up waiting on glyphs after this */

  var requested = Object.create(null);   /* name -> true, already sent */
  var waiters = Object.create(null);     /* name -> [resolve, ...] */
  var settled = Object.create(null);     /* name -> true, glyphs ready */
  var queue = [];
  var priorityQueue = [];
  var timer = null;
  var stats = { requests: 0, families: 0 };

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
    link.onload = function () {
      entries.forEach(function (e) { watchFace(split(e).name); });
    };
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
    document.head.appendChild(link);
    stats.requests++;
    if (!isRetry) { stats.families += entries.length; }
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
      var entry = weights ? names[i] + '|' + weights : names[i];
      if (requested[entry]) { continue; }
      requested[entry] = true;
      (priority ? priorityQueue : queue).push(entry);
      added = true;
    }
    if (added) { schedule(priority); }
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

  /* Observe elements and load their [data-font] as they approach view. */
  function observer(onVisible) {
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
        if (!entries[i].isIntersecting) { continue; }
        var el = entries[i].target;
        var name = el.getAttribute('data-font');
        io.unobserve(el);
        if (!name) { continue; }
        load(name);
        if (onVisible) { onVisible(el, name); }
      }
    }, { rootMargin: '600px 0px', threshold: 0 });
    return io;
  }

  global.LayzFonts = {
    load: load,
    ready: ready,
    isReady: isReady,
    observer: observer,
    stats: function () { return { requests: stats.requests, families: stats.families }; }
  };
})(window);
