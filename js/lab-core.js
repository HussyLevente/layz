/* ============================================================
   Layz - lab core
   ------------------------------------------------------------
   The four lab tools all read and write the same few things: a
   font pair, a palette, and (later) a set of variable-font axes.
   Holding that in one observable store is what stops each tool
   growing its own colour picker and its own idea of the pair.

     LayzLab.get()               -> immutable-ish snapshot
     LayzLab.set({...}, source)  -> merge, persist, notify
     LayzLab.on(fn)              -> subscribe; returns unsubscribe
     LayzLab.palette()           -> the palette for the active mode
     LayzLab.contrast(a, b)      -> WCAG 2.1 contrast ratio
     LayzLab.grade(ratio)        -> { aa, aaa, aaLarge, aaaLarge, ui }
     LayzLab.setTool(id)         -> ?tool= panel routing

   Colours are stored as #rrggbb and nothing else. Every entry
   point runs through safeHex, because these values end up inside
   style attributes and generated CSS text.
   ============================================================ */
(function (global) {
  'use strict';

  var L = global.Layz;
  var KEY = 'layz.lab.v1';

  /* ---------------- colour primitives ---------------- */

  var HEX6 = /^#[0-9a-f]{6}$/i;
  var HEX3 = /^#[0-9a-f]{3}$/i;

  /* The only way a colour enters the store. Anything unparseable falls back
     rather than propagating into a style attribute or a copied CSS rule. */
  function safeHex(value, fallback) {
    if (typeof value !== 'string') { return fallback; }
    var v = value.trim();
    if (HEX6.test(v)) { return v.toLowerCase(); }
    if (HEX3.test(v)) {
      return ('#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]).toLowerCase();
    }
    return fallback;
  }

  function toRgb(hex) {
    var h = safeHex(hex, '#000000');
    return [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16)
    ];
  }

  function toHex(rgb) {
    return '#' + rgb.map(function (c) {
      var n = Math.max(0, Math.min(255, Math.round(c)));
      return (n < 16 ? '0' : '') + n.toString(16);
    }).join('');
  }

  /* WCAG 2.1 relative luminance - the sRGB channel is linearised first,
     which is the step people skip when they get contrast ratios wrong. */
  function channel(c) {
    var s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }

  function luminance(hex) {
    var c = toRgb(hex);
    return 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
  }

  /* Symmetric by definition: swapping foreground and background cannot
     change the ratio. Worth knowing before you go looking for a bug. */
  function contrast(a, b) {
    var la = luminance(a);
    var lb = luminance(b);
    var hi = Math.max(la, lb);
    var lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  /* WCAG 2.1 thresholds. "Large" is >=24px, or >=18.66px when bold.
     `ui` is 1.4.11 non-text contrast - borders, icons, form outlines. */
  function grade(ratio) {
    return {
      ratio: ratio,
      aa: ratio >= 4.5,
      aaa: ratio >= 7,
      aaLarge: ratio >= 3,
      aaaLarge: ratio >= 4.5,
      ui: ratio >= 3
    };
  }

  /* Black or white, whichever reads better on the given colour. What you
     need the moment text sits on an accent fill rather than the background. */
  function bestOn(hex) {
    return contrast('#ffffff', hex) >= contrast('#000000', hex) ? '#ffffff' : '#000000';
  }

  /* Highest WCAG label a ratio earns at a given size, for a one-word badge. */
  function badge(ratio, large) {
    var g = grade(ratio);
    if (large) {
      if (g.aaaLarge) { return 'AAA'; }
      if (g.aaLarge) { return 'AA'; }
      return 'Fail';
    }
    if (g.aaa) { return 'AAA'; }
    if (g.aa) { return 'AA'; }
    if (g.aaLarge) { return 'AA Large'; }
    return 'Fail';
  }

  /* ---------------- HSL, for deriving a dark counterpart ---------------- */

  function toHsl(hex) {
    var c = toRgb(hex).map(function (v) { return v / 255; });
    var max = Math.max(c[0], c[1], c[2]);
    var min = Math.min(c[0], c[1], c[2]);
    var l = (max + min) / 2;
    var d = max - min;
    var h = 0;
    var s = 0;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === c[0]) { h = ((c[1] - c[2]) / d + (c[1] < c[2] ? 6 : 0)); }
      else if (max === c[1]) { h = (c[2] - c[0]) / d + 2; }
      else { h = (c[0] - c[1]) / d + 4; }
      h *= 60;
    }
    return [h, s * 100, l * 100];
  }

  function fromHsl(hsl) {
    var h = ((hsl[0] % 360) + 360) % 360;
    var s = Math.max(0, Math.min(100, hsl[1])) / 100;
    var l = Math.max(0, Math.min(100, hsl[2])) / 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2;
    var t = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
          : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return toHex([(t[0] + m) * 255, (t[1] + m) * 255, (t[2] + m) * 255]);
  }

  /* Seed a dark-mode counterpart by flipping lightness and keeping hue.
     #ffffff -> #000000, #171717 -> #e8e8e8, and a tinted grey stays tinted.
     Only ever used as a starting point - the user can edit it after. */
  function flipLightness(hex) {
    var hsl = toHsl(hex);
    return fromHsl([hsl[0], hsl[1], 100 - hsl[2]]);
  }

  /* ---------------- state ---------------- */

  var DEFAULTS = {
    title: 'Playfair Display',
    body: 'Source Sans 3',
    mode: 'light',
    light: { bg: '#ffffff', fg: '#171717', accent: '#2f6df6' },
    dark:  { bg: '#0a0a0a', fg: '#ededed', accent: '#7aa2ff' },
    mood: null,
    axes: {}
  };

  function cleanPalette(p, fallback) {
    p = p || {};
    return {
      bg: safeHex(p.bg, fallback.bg),
      fg: safeHex(p.fg, fallback.fg),
      accent: safeHex(p.accent, fallback.accent)
    };
  }

  /* Anything read back from storage is untrusted - it may have been written
     by an older version, hand-edited, or corrupted. */
  function normalize(raw) {
    raw = (raw && typeof raw === 'object') ? raw : {};
    var D = global.LayzData;
    var title = (D && D.BY_NAME[raw.title]) ? raw.title : DEFAULTS.title;
    var body = (D && D.BY_NAME[raw.body]) ? raw.body : DEFAULTS.body;
    return {
      title: title,
      body: body,
      mode: raw.mode === 'dark' ? 'dark' : 'light',
      light: cleanPalette(raw.light, DEFAULTS.light),
      dark: cleanPalette(raw.dark, DEFAULTS.dark),
      mood: typeof raw.mood === 'string' ? raw.mood : null,
      axes: (raw.axes && typeof raw.axes === 'object') ? raw.axes : {}
    };
  }

  var state = normalize(load());

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { /* private mode */ }
  }

  var listeners = [];

  function on(fn) {
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i !== -1) { listeners.splice(i, 1); }
    };
  }

  /* `source` lets a tool ignore the echo of its own write - without it every
     slider would fight the re-render it just triggered. */
  function emit(changed, source) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state, changed, source); } catch (e) {}
    }
  }

  function get() {
    return {
      title: state.title,
      body: state.body,
      mode: state.mode,
      light: { bg: state.light.bg, fg: state.light.fg, accent: state.light.accent },
      dark: { bg: state.dark.bg, fg: state.dark.fg, accent: state.dark.accent },
      mood: state.mood,
      axes: state.axes
    };
  }

  /* The palette currently on the canvas. */
  function palette(mode) {
    var m = mode || state.mode;
    return m === 'dark' ? get().dark : get().light;
  }

  /*
    set({ title, body, mode, mood, axes })            top-level keys
    set({ light: { fg: '#333' } })                    merges into a palette
  */
  function set(patch, source) {
    if (!patch) { return; }
    var changed = [];
    var D = global.LayzData;

    ['title', 'body'].forEach(function (k) {
      if (patch[k] === undefined || patch[k] === state[k]) { return; }
      if (D && !D.BY_NAME[patch[k]]) { return; }
      state[k] = patch[k];
      changed.push(k);
    });

    if (patch.mode !== undefined) {
      var m = patch.mode === 'dark' ? 'dark' : 'light';
      if (m !== state.mode) { state.mode = m; changed.push('mode'); }
    }

    if (patch.mood !== undefined && patch.mood !== state.mood) {
      state.mood = typeof patch.mood === 'string' ? patch.mood : null;
      changed.push('mood');
    }

    if (patch.axes !== undefined) {
      state.axes = (patch.axes && typeof patch.axes === 'object') ? patch.axes : {};
      changed.push('axes');
    }

    ['light', 'dark'].forEach(function (m) {
      if (!patch[m]) { return; }
      var next = state[m];
      var hit = false;
      ['bg', 'fg', 'accent'].forEach(function (k) {
        if (patch[m][k] === undefined) { return; }
        var v = safeHex(patch[m][k], next[k]);
        if (v !== next[k]) { next[k] = v; hit = true; }
      });
      if (hit) { changed.push(m); }
    });

    if (!changed.length) { return; }
    persist();
    emit(changed, source || null);
  }

  /* Re-seed the inactive mode's palette from the active one. Called when the
     user has never touched the dark palette and flips to it for the first
     time, so they land on something plausible instead of the default. */
  function deriveCounterpart(from) {
    var src = palette(from);
    return {
      bg: flipLightness(src.bg),
      fg: flipLightness(src.fg),
      accent: src.accent
    };
  }

  /* ---------------- ?tool= routing ---------------- */

  var TOOLS = ['contrast', 'components', 'vibe', 'variable'];
  var tool = null;
  var routeListeners = [];

  function validTool(id) { return TOOLS.indexOf(id) !== -1 ? id : TOOLS[0]; }

  function setTool(id, opts) {
    var next = validTool(id);
    if (next === tool) { return; }
    tool = next;

    document.querySelectorAll('[data-tool]').forEach(function (p) {
      p.hidden = p.getAttribute('data-tool') !== tool;
    });
    document.querySelectorAll('[data-tool-btn]').forEach(function (b) {
      var on = b.getAttribute('data-tool-btn') === tool;
      b.setAttribute('aria-selected', String(on));
      b.classList.toggle('is-active', on);
      b.setAttribute('tabindex', on ? '0' : '-1');
    });

    if (!opts || !opts.silent) { L.setParams({ tool: tool }); }
    for (var i = 0; i < routeListeners.length; i++) {
      try { routeListeners[i](tool); } catch (e) {}
    }
  }

  function onRoute(fn) { routeListeners.push(fn); }

  function initRouter() {
    setTool(L.param('tool') || TOOLS[0], { silent: true });
    L.setParams({ tool: tool });

    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-tool-btn]');
      if (!btn) { return; }
      e.preventDefault();
      setTool(btn.getAttribute('data-tool-btn'));
    });

    /* Arrow-key movement is what role="tablist" promises a screen reader.
       Bound to the strip, never to the document - the site already spends
       bare letter keys on other pages and this page is full of buttons. */
    var strip = document.querySelector('[role="tablist"]');
    if (strip) {
      strip.addEventListener('keydown', function (e) {
        var dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1
                : e.key === 'Home' ? 'first' : e.key === 'End' ? 'last' : 0;
        if (!dir) { return; }
        e.preventDefault();
        var i = TOOLS.indexOf(tool);
        var next = dir === 'first' ? 0
                 : dir === 'last' ? TOOLS.length - 1
                 : (i + dir + TOOLS.length) % TOOLS.length;
        setTool(TOOLS[next]);
        var btn = strip.querySelector('[data-tool-btn="' + TOOLS[next] + '"]');
        if (btn) { btn.focus(); }
      });
    }

    /* Back/forward between panels should work like any other navigation. */
    global.addEventListener('popstate', function () {
      setTool(L.param('tool') || TOOLS[0], { silent: true });
    });
  }

  /* The lab scripts sit at the end of <body>, so the panels already exist by
     the time this runs - but guard anyway so the module stays importable
     from a page that has no tool markup at all. */
  if (document.querySelector('[data-tool]')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initRouter);
    } else {
      initRouter();
    }
  }

  global.LayzLab = {
    /* state */
    get: get,
    set: set,
    on: on,
    palette: palette,
    deriveCounterpart: deriveCounterpart,
    DEFAULTS: DEFAULTS,

    /* colour */
    safeHex: safeHex,
    toRgb: toRgb,
    toHex: toHex,
    toHsl: toHsl,
    fromHsl: fromHsl,
    flipLightness: flipLightness,
    luminance: luminance,
    contrast: contrast,
    grade: grade,
    badge: badge,
    bestOn: bestOn,

    /* routing */
    TOOLS: TOOLS,
    tool: function () { return tool; },
    setTool: setTool,
    onRoute: onRoute,
    initRouter: initRouter
  };
})(window);
