/* ============================================================
   Layz - consent
   ------------------------------------------------------------
   This site sets NO cookies. It stores a handful of preferences
   in localStorage (theme, shortlist, view, preview size) which
   are functional and exempt from consent under the ePrivacy
   Directive's "strictly necessary" carve-out.

   The one thing that genuinely needs a decision is Google Fonts:
   every request to fonts.googleapis.com / fonts.gstatic.com
   discloses the visitor's IP address to Google. That is what
   this module gates.

   Because declining removes the entire point of a type specimen
   site, the decline path is confirmed rather than instant, and a
   quiet bar afterwards offers the way back.

   Loaded synchronously in <head> so the decision is known before
   the first paint and the UI font can be attached without a flash.
   ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'layz.consent.v1';
  var BAR_KEY = 'layz.consent.bar';

  /* true  = no request reaches Google until the visitor accepts (opt-in,
              the defensible default in the EU)
     false = fonts load right away and the notice is an opt-out          */
  var BLOCK_UNTIL_DECISION = true;

  /* the site's own interface font */
  var UI_FONT = 'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300;400;500;700&display=swap';

  var listeners = [];
  var injected = false;

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function write(value) {
    try { localStorage.setItem(KEY, value); } catch (e) {}
  }

  /* 'granted' | 'denied' | 'unset' */
  function state() {
    var v = read();
    return (v === 'granted' || v === 'denied') ? v : 'unset';
  }

  /* May we talk to Google right now? */
  function granted() {
    var s = state();
    if (s === 'granted') { return true; }
    if (s === 'denied') { return false; }
    return !BLOCK_UNTIL_DECISION;
  }

  function injectUiFont() {
    if (injected || !granted()) { return; }
    injected = true;
    var head = document.head || document.getElementsByTagName('head')[0];
    if (!head) { return; }

    [['preconnect', 'https://fonts.googleapis.com', false],
     ['preconnect', 'https://fonts.gstatic.com', true]].forEach(function (p) {
      var l = document.createElement('link');
      l.rel = p[0];
      l.href = p[1];
      if (p[2]) { l.crossOrigin = 'anonymous'; }
      head.appendChild(l);
    });

    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = UI_FONT;
    head.appendChild(css);
  }

  function emit() {
    var g = granted();
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](g); } catch (e) {}
    }
  }

  function decide(value) {
    write(value);
    closeModal();

    if (value === 'granted') {
      injectUiFont();
      hideBar();
      emit();
      return;
    }

    emit();
    showBar();
    if (injected && global.Layz && global.Layz.toast) {
      /* fonts already attached this session cannot be detached in place */
      global.Layz.toast('Reload to drop the fonts already loaded');
    }
  }

  /* ---------------- modal ---------------- */
  var modal = null;

  function view(name) {
    if (!modal) { return; }
    modal.querySelectorAll('[data-view]').forEach(function (v) {
      v.hidden = v.getAttribute('data-view') !== name;
    });
  }

  function buildModal() {
    if (modal || !document.body) { return; }

    modal = document.createElement('div');
    modal.className = 'consent';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'consentTitle');
    modal.innerHTML =
      '<div class="consent-panel">' +

        '<div data-view="ask">' +
          '<div class="consent-head">' +
            '<span class="label label--soft">Privacy</span>' +
            '<span class="label label--soft">001</span>' +
          '</div>' +
          '<h2 class="label" id="consentTitle">This site sets no cookies.</h2>' +
          '<p class="prose">' +
            'Layz stores your theme, shortlist and preview settings in this browser only. ' +
            'Nothing is uploaded and there is no tracking or analytics. ' +
            'The typefaces themselves are served by <strong>Google Fonts</strong>, which means ' +
            'your IP address is disclosed to Google when they load.' +
          '</p>' +
          '<div class="consent-actions">' +
            '<button class="btn btn--solid" data-consent="granted">Allow Google Fonts</button>' +
            '<button class="btn" data-consent="confirm-deny">Essential only</button>' +
          '</div>' +
          '<p class="consent-note label label--soft">' +
            'Choosing essential only keeps the site working with your system fonts. ' +
            '<a class="ul-link" href="privacy.html">Privacy</a> ' +
            '<a class="ul-link" href="cookies.html">Cookies &amp; storage</a>' +
          '</p>' +
        '</div>' +

        '<div data-view="warn" hidden>' +
          '<div class="consent-head">' +
            '<span class="label label--soft">Heads up</span>' +
            '<span class="label label--soft">002</span>' +
          '</div>' +
          '<h2 class="label consent-warn">Layz needs those fonts to be Layz.</h2>' +
          '<p class="prose">' +
            'Every specimen on this site <em>is</em> a Google Font. Without them the library, ' +
            'the pairing tool and your shortlist all fall back to the fonts already installed ' +
            'on your device &mdash; you will still see the names, but not the typefaces, and ' +
            'there is nothing left to compare.' +
          '</p>' +
          '<p class="prose">You can switch this back on at any time from the footer.</p>' +
          '<div class="consent-actions">' +
            '<button class="btn btn--solid" data-consent="granted">Allow Google Fonts</button>' +
            '<button class="btn" data-consent="denied">Continue anyway</button>' +
          '</div>' +
          '<p class="consent-note label label--soft">' +
            '<button class="ul-link" data-consent="back">&larr; Back</button>' +
          '</p>' +
        '</div>' +

      '</div>';

    document.body.appendChild(modal);

    modal.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-consent]');
      if (!btn) { return; }
      var action = btn.getAttribute('data-consent');
      if (action === 'confirm-deny') { view('warn'); return; }
      if (action === 'back') { view('ask'); return; }
      decide(action);
    });
  }

  function openModal() {
    buildModal();
    if (!modal) { return; }
    view('ask');
    requestAnimationFrame(function () { modal.classList.add('is-open'); });
  }

  function closeModal() {
    if (modal) { modal.classList.remove('is-open'); }
  }

  /* ---------------- degraded-mode bar ----------------
     Without this, a visitor who declined sees a site full of fallback text
     and no explanation of why - which reads as broken rather than chosen. */
  var bar = null;

  function barDismissed() {
    try { return sessionStorage.getItem(BAR_KEY) === '1'; } catch (e) { return false; }
  }

  function showBar() {
    if (barDismissed() || !document.body) { return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'consent-bar';
      bar.innerHTML =
        '<span class="label">Specimens are showing in your system fonts.</span>' +
        '<button class="ul-link" data-consent-enable>Enable Google Fonts</button>' +
        '<button class="consent-bar-x" data-consent-dismiss aria-label="Dismiss">&times;</button>';
      document.body.appendChild(bar);

      bar.addEventListener('click', function (e) {
        if (e.target.closest('[data-consent-enable]')) { decide('granted'); return; }
        if (e.target.closest('[data-consent-dismiss]')) {
          try { sessionStorage.setItem(BAR_KEY, '1'); } catch (err) {}
          hideBar();
        }
      });
    }
    requestAnimationFrame(function () { bar.classList.add('is-open'); });
  }

  function hideBar() {
    if (bar) { bar.classList.remove('is-open'); }
  }

  function init() {
    var s = state();
    if (s === 'unset') { openModal(); }
    else if (s === 'denied') { showBar(); }
  }

  /* Decide and attach the interface font before first paint. */
  injectUiFont();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.LayzConsent = {
    state: state,
    granted: granted,
    accept: function () { decide('granted'); },
    deny: function () { decide('denied'); },
    open: openModal,
    reset: function () { write(''); hideBar(); openModal(); },
    onChange: function (fn) { listeners.push(fn); }
  };
})(window);
