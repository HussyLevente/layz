/* ============================================================
   Layz - Lab / UI component tester
   ------------------------------------------------------------
   Renders real components wearing the current pairing and
   palette, and hands back the code that produces them.

   The stage is a shadow root, which is the whole trick here:

     - base.css cannot reach in, so .btn's fill-up hover and
       body's font-family/line-height can't fight the demo
     - custom properties DO inherit through the boundary, so
       the palette set on the host reaches every component
     - @font-face is document-scoped, so the families the
       loader already fetched render inside with no second
       request and no second consent decision
     - it is the same document, so the custom cursor keeps
       tracking (an iframe would be a dead zone)

   Component CSS is written without :host so the exact same
   string can be rendered AND exported. Only BASE_CSS knows
   about the shadow boundary.
   ============================================================ */
(function () {
  'use strict';

  var D = window.LayzData;
  var L = window.Layz;
  var F = window.LayzFonts;
  var P = window.LayzPairs;
  var Lab = window.LayzLab;

  var $ = function (id) { return document.getElementById(id); };

  var panel = $('toolComponents');
  if (!panel) { return; }

  /* ---------------- the stage sheet ----------------
     Everything the shadow tree needs that is NOT part of a component's own
     exported CSS: the boundary, the reset, and the token bridge. */
  var BASE_CSS = [
    ':host {',
    /* Centred in a fixed-height canvas so a three-button row and a 340px
       card both read as deliberate compositions rather than content stranded
       in a corner. */
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  min-height: 440px;',
    '  padding: clamp(26px, 5vw, 56px);',
    '  background: rgb(var(--bg-rgb));',
    '  color: rgb(var(--fg-rgb));',
    '  font-family: var(--font-body);',
    '  font-size: 16px;',
    '  line-height: 1.6;',
    '  -webkit-font-smoothing: antialiased;',
    '}',
    '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }',
    'button, input, select, textarea { font: inherit; color: inherit; }',
    'button { cursor: pointer; background: none; border: none; }',
    'ul { list-style: none; }',
    'a { color: inherit; text-decoration: none; }',
    '.stack { display: flex; flex-direction: column; gap: 26px; align-items: flex-start; }',
    '.row { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; }'
  ].join('\n');

  /* ---------------- components ----------------
     `css` is shared between the live render and the copied output, so what
     you see really is what you get. `tw` is a separate markup variant using
     Tailwind arbitrary values. */
  var COMPONENTS = [
    {
      id: 'buttons',
      label: 'Buttons',
      html:
        '<div class="row">' +
          '<button class="btn btn--primary">Get started</button>' +
          '<button class="btn btn--secondary">Learn more</button>' +
          '<button class="btn btn--ghost">Cancel</button>' +
          '<button class="btn btn--primary" disabled>Disabled</button>' +
        '</div>',
      css: [
        '.btn {',
        '  display: inline-flex;',
        '  align-items: center;',
        '  justify-content: center;',
        '  padding: 12px 22px;',
        '  font-family: var(--font-body);',
        '  font-size: 15px;',
        '  font-weight: 500;',
        '  line-height: 1.2;',
        '  border: 1px solid transparent;',
        '  border-radius: 6px;',
        '  transition: opacity .18s ease;',
        '}',
        '.btn:hover { opacity: .86; }',
        '.btn:disabled { opacity: .4; cursor: not-allowed; }',
        '.btn--primary {',
        '  color: var(--brand-on-accent);',
        '  background: var(--brand-accent);',
        '  border-color: var(--brand-accent);',
        '}',
        '.btn--secondary {',
        '  color: var(--brand-fg);',
        '  border-color: color-mix(in srgb, var(--brand-fg) 26%, transparent);',
        '}',
        '.btn--ghost { color: color-mix(in srgb, var(--brand-fg) 62%, transparent); }'
      ].join('\n'),
      tw:
        '<div class="flex flex-wrap items-center gap-3.5">\n' +
        '  <button class="inline-flex items-center justify-center rounded-md border border-transparent px-[22px] py-3 text-[15px] font-medium leading-tight transition-opacity hover:opacity-[.86] font-[family-name:var(--font-body)] text-[var(--brand-on-accent)] bg-[var(--brand-accent)]">Get started</button>\n' +
        '  <button class="inline-flex items-center justify-center rounded-md px-[22px] py-3 text-[15px] font-medium leading-tight transition-opacity hover:opacity-[.86] font-[family-name:var(--font-body)] text-[var(--brand-fg)] border border-[var(--brand-fg)]/[.26]">Learn more</button>\n' +
        '  <button class="inline-flex items-center justify-center rounded-md border border-transparent px-[22px] py-3 text-[15px] font-medium leading-tight transition-opacity hover:opacity-[.86] font-[family-name:var(--font-body)] text-[var(--brand-fg)]/[.62]">Cancel</button>\n' +
        '</div>'
    },
    {
      id: 'card',
      label: 'Product card',
      html:
        '<article class="card">' +
          '<div class="card__media" aria-hidden="true"></div>' +
          '<div class="card__body">' +
            '<span class="card__eyebrow">Outerwear</span>' +
            '<h3 class="card__title">The Ridgeline Parka</h3>' +
            '<p class="card__text">Waxed cotton shell, recycled down fill, and a hood that actually stays up in wind.</p>' +
            '<div class="card__foot">' +
              '<span class="card__price">&pound;340</span>' +
              '<button class="card__cta">Add to bag</button>' +
            '</div>' +
          '</div>' +
        '</article>',
      css: [
        '.card {',
        '  width: 340px;',
        '  max-width: 100%;',
        '  overflow: hidden;',
        '  border: 1px solid color-mix(in srgb, var(--brand-fg) 14%, transparent);',
        '  border-radius: 10px;',
        '}',
        '.card__media {',
        '  height: 168px;',
        '  background:',
        '    repeating-linear-gradient(45deg,',
        '      color-mix(in srgb, var(--brand-accent) 16%, transparent) 0 10px,',
        '      transparent 10px 20px),',
        '    color-mix(in srgb, var(--brand-accent) 9%, transparent);',
        '}',
        '.card__body { padding: 20px; }',
        '.card__eyebrow {',
        '  display: block;',
        '  margin-bottom: 8px;',
        '  font-family: var(--font-body);',
        '  font-size: 11px;',
        '  font-weight: 600;',
        '  letter-spacing: .09em;',
        '  text-transform: uppercase;',
        '  color: var(--brand-accent);',
        '}',
        '.card__title {',
        '  margin-bottom: 8px;',
        '  font-family: var(--font-title);',
        '  font-size: 24px;',
        '  font-weight: var(--font-title-weight, 700);',
        '  line-height: 1.15;',
        '  letter-spacing: -.015em;',
        '}',
        '.card__text {',
        '  font-family: var(--font-body);',
        '  font-size: 14px;',
        '  line-height: 1.6;',
        '  color: color-mix(in srgb, var(--brand-fg) 68%, transparent);',
        '}',
        '.card__foot {',
        '  display: flex;',
        '  align-items: center;',
        '  justify-content: space-between;',
        '  gap: 14px;',
        '  margin-top: 18px;',
        '}',
        '.card__price {',
        '  font-family: var(--font-title);',
        '  font-size: 20px;',
        '  font-weight: var(--font-title-weight, 700);',
        '}',
        '.card__cta {',
        '  padding: 10px 16px;',
        '  font-family: var(--font-body);',
        '  font-size: 14px;',
        '  font-weight: 500;',
        '  color: var(--brand-on-accent);',
        '  background: var(--brand-accent);',
        '  border-radius: 6px;',
        '}'
      ].join('\n'),
      tw:
        '<article class="w-[340px] max-w-full overflow-hidden rounded-[10px] border border-[var(--brand-fg)]/[.14]">\n' +
        '  <div class="h-[168px] bg-[var(--brand-accent)]/[.09]"></div>\n' +
        '  <div class="p-5">\n' +
        '    <span class="mb-2 block text-[11px] font-semibold uppercase tracking-[.09em] text-[var(--brand-accent)] font-[family-name:var(--font-body)]">Outerwear</span>\n' +
        '    <h3 class="mb-2 text-2xl leading-[1.15] tracking-[-.015em] font-[family-name:var(--font-title)] font-bold">The Ridgeline Parka</h3>\n' +
        '    <p class="text-sm leading-relaxed text-[var(--brand-fg)]/[.68] font-[family-name:var(--font-body)]">Waxed cotton shell, recycled down fill, and a hood that actually stays up in wind.</p>\n' +
        '    <div class="mt-[18px] flex items-center justify-between gap-3.5">\n' +
        '      <span class="text-xl font-bold font-[family-name:var(--font-title)]">&pound;340</span>\n' +
        '      <button class="rounded-md px-4 py-2.5 text-sm font-medium text-[var(--brand-on-accent)] bg-[var(--brand-accent)] font-[family-name:var(--font-body)]">Add to bag</button>\n' +
        '    </div>\n' +
        '  </div>\n' +
        '</article>'
    },
    {
      id: 'form',
      label: 'Form field',
      html:
        '<div class="field-group">' +
          '<div class="field">' +
            '<label class="field__label" for="demo-email">Work email</label>' +
            '<input class="field__input" id="demo-email" type="email" value="ada@example.com">' +
            '<span class="field__help">We only use this to send the invoice.</span>' +
          '</div>' +
          '<div class="field field--error">' +
            '<label class="field__label" for="demo-vat">VAT number</label>' +
            '<input class="field__input" id="demo-vat" type="text" value="GB-00">' +
            '<span class="field__help field__help--error">That does not look like a valid VAT number.</span>' +
          '</div>' +
        '</div>',
      css: [
        '.field-group { display: flex; flex-direction: column; gap: 20px; width: 360px; max-width: 100%; }',
        '.field { display: flex; flex-direction: column; gap: 6px; }',
        '.field__label {',
        '  font-family: var(--font-body);',
        '  font-size: 13px;',
        '  font-weight: 600;',
        '}',
        '.field__input {',
        '  padding: 11px 13px;',
        '  font-family: var(--font-body);',
        '  font-size: 15px;',
        '  background: transparent;',
        '  border: 1px solid color-mix(in srgb, var(--brand-fg) 26%, transparent);',
        '  border-radius: 6px;',
        '  transition: border-color .18s ease;',
        '}',
        '.field__input:focus {',
        '  outline: 2px solid var(--brand-accent);',
        '  outline-offset: 1px;',
        '  border-color: var(--brand-accent);',
        '}',
        '.field__help {',
        '  font-family: var(--font-body);',
        '  font-size: 12.5px;',
        '  color: color-mix(in srgb, var(--brand-fg) 62%, transparent);',
        '}',
        '.field--error .field__input { border-color: var(--brand-accent); }',
        '.field__help--error { color: var(--brand-accent); font-weight: 500; }'
      ].join('\n'),
      tw:
        '<div class="flex w-[360px] max-w-full flex-col gap-5">\n' +
        '  <div class="flex flex-col gap-1.5">\n' +
        '    <label class="text-[13px] font-semibold font-[family-name:var(--font-body)]" for="email">Work email</label>\n' +
        '    <input id="email" type="email" class="rounded-md border border-[var(--brand-fg)]/[.26] bg-transparent px-[13px] py-[11px] text-[15px] font-[family-name:var(--font-body)] focus:border-[var(--brand-accent)] focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-[var(--brand-accent)]">\n' +
        '    <span class="text-[12.5px] text-[var(--brand-fg)]/[.62] font-[family-name:var(--font-body)]">We only use this to send the invoice.</span>\n' +
        '  </div>\n' +
        '</div>'
    },
    {
      id: 'pricing',
      label: 'Pricing tile',
      html:
        '<div class="plan">' +
          '<span class="plan__badge">Most popular</span>' +
          '<h3 class="plan__name">Studio</h3>' +
          '<p class="plan__price"><span class="plan__amount">$24</span><span class="plan__per">/month</span></p>' +
          '<ul class="plan__list">' +
            '<li>Unlimited projects</li>' +
            '<li>Custom domains</li>' +
            '<li>Priority support</li>' +
          '</ul>' +
          '<button class="plan__cta">Choose Studio</button>' +
        '</div>',
      css: [
        '.plan {',
        '  width: 300px;',
        '  max-width: 100%;',
        '  padding: 26px;',
        '  border: 1px solid var(--brand-accent);',
        '  border-radius: 10px;',
        '}',
        '.plan__badge {',
        '  display: inline-block;',
        '  margin-bottom: 16px;',
        '  padding: 4px 10px;',
        '  font-family: var(--font-body);',
        '  font-size: 11px;',
        '  font-weight: 600;',
        '  letter-spacing: .07em;',
        '  text-transform: uppercase;',
        '  color: var(--brand-on-accent);',
        '  background: var(--brand-accent);',
        '  border-radius: 999px;',
        '}',
        '.plan__name {',
        '  font-family: var(--font-title);',
        '  font-size: 22px;',
        '  font-weight: var(--font-title-weight, 700);',
        '  margin-bottom: 4px;',
        '}',
        '.plan__price { display: flex; align-items: baseline; gap: 5px; margin-bottom: 18px; }',
        '.plan__amount {',
        '  font-family: var(--font-title);',
        '  font-size: 44px;',
        '  font-weight: var(--font-title-weight, 700);',
        '  line-height: 1;',
        '  letter-spacing: -.03em;',
        '}',
        '.plan__per {',
        '  font-family: var(--font-body);',
        '  font-size: 14px;',
        '  color: color-mix(in srgb, var(--brand-fg) 62%, transparent);',
        '}',
        '.plan__list { display: flex; flex-direction: column; gap: 9px; margin-bottom: 22px; }',
        '.plan__list li {',
        '  position: relative;',
        '  padding-left: 22px;',
        '  font-family: var(--font-body);',
        '  font-size: 14px;',
        '}',
        '.plan__list li::before {',
        '  content: "";',
        '  position: absolute;',
        '  left: 0; top: 8px;',
        '  width: 9px; height: 9px;',
        '  background: var(--brand-accent);',
        '  border-radius: 2px;',
        '}',
        '.plan__cta {',
        '  width: 100%;',
        '  padding: 13px;',
        '  font-family: var(--font-body);',
        '  font-size: 15px;',
        '  font-weight: 500;',
        '  color: var(--brand-on-accent);',
        '  background: var(--brand-accent);',
        '  border-radius: 6px;',
        '}'
      ].join('\n'),
      tw:
        '<div class="w-[300px] max-w-full rounded-[10px] border border-[var(--brand-accent)] p-[26px]">\n' +
        '  <span class="mb-4 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[.07em] text-[var(--brand-on-accent)] bg-[var(--brand-accent)] font-[family-name:var(--font-body)]">Most popular</span>\n' +
        '  <h3 class="mb-1 text-[22px] font-bold font-[family-name:var(--font-title)]">Studio</h3>\n' +
        '  <p class="mb-[18px] flex items-baseline gap-[5px]">\n' +
        '    <span class="text-[44px] font-bold leading-none tracking-[-.03em] font-[family-name:var(--font-title)]">$24</span>\n' +
        '    <span class="text-sm text-[var(--brand-fg)]/[.62] font-[family-name:var(--font-body)]">/month</span>\n' +
        '  </p>\n' +
        '  <button class="w-full rounded-md py-[13px] text-[15px] font-medium text-[var(--brand-on-accent)] bg-[var(--brand-accent)] font-[family-name:var(--font-body)]">Choose Studio</button>\n' +
        '</div>'
    },
    {
      id: 'navbar',
      label: 'Nav bar',
      html:
        '<nav class="nav">' +
          '<span class="nav__brand">Meridian</span>' +
          '<ul class="nav__links">' +
            '<li><a href="#" class="nav__link nav__link--on">Product</a></li>' +
            '<li><a href="#" class="nav__link">Pricing</a></li>' +
            '<li><a href="#" class="nav__link">Docs</a></li>' +
          '</ul>' +
          '<button class="nav__cta">Sign in</button>' +
        '</nav>',
      css: [
        '.nav {',
        '  display: flex;',
        '  align-items: center;',
        '  gap: 28px;',
        '  width: 620px;',
        '  max-width: 100%;',
        '  padding: 14px 20px;',
        '  border: 1px solid color-mix(in srgb, var(--brand-fg) 14%, transparent);',
        '  border-radius: 10px;',
        '}',
        '.nav__brand {',
        '  font-family: var(--font-title);',
        '  font-size: 21px;',
        '  font-weight: var(--font-title-weight, 700);',
        '  letter-spacing: -.02em;',
        '}',
        '.nav__links { display: flex; gap: 22px; margin-right: auto; }',
        '.nav__link {',
        '  font-family: var(--font-body);',
        '  font-size: 14.5px;',
        '  color: color-mix(in srgb, var(--brand-fg) 62%, transparent);',
        '  transition: color .18s ease;',
        '}',
        '.nav__link:hover, .nav__link--on { color: var(--brand-fg); }',
        '.nav__cta {',
        '  padding: 9px 16px;',
        '  font-family: var(--font-body);',
        '  font-size: 14px;',
        '  font-weight: 500;',
        '  color: var(--brand-on-accent);',
        '  background: var(--brand-accent);',
        '  border-radius: 6px;',
        '}'
      ].join('\n'),
      tw:
        '<nav class="flex w-[620px] max-w-full items-center gap-7 rounded-[10px] border border-[var(--brand-fg)]/[.14] px-5 py-3.5">\n' +
        '  <span class="text-[21px] font-bold tracking-[-.02em] font-[family-name:var(--font-title)]">Meridian</span>\n' +
        '  <ul class="mr-auto flex gap-[22px]">\n' +
        '    <li><a href="#" class="text-[14.5px] text-[var(--brand-fg)] font-[family-name:var(--font-body)]">Product</a></li>\n' +
        '    <li><a href="#" class="text-[14.5px] text-[var(--brand-fg)]/[.62] hover:text-[var(--brand-fg)] font-[family-name:var(--font-body)]">Pricing</a></li>\n' +
        '  </ul>\n' +
        '  <button class="rounded-md px-4 py-[9px] text-sm font-medium text-[var(--brand-on-accent)] bg-[var(--brand-accent)] font-[family-name:var(--font-body)]">Sign in</button>\n' +
        '</nav>'
    }
  ];

  var BY_ID = {};
  COMPONENTS.forEach(function (c) { BY_ID[c.id] = c; });

  /* ---------------- panel state ----------------
     Panel-local rather than in the shared store: which component you are
     looking at is not something the other tools have an opinion about. */
  var state = { component: 'card', format: 'css' };
  try {
    var raw = JSON.parse(localStorage.getItem('layz.lab.components') || '{}');
    if (BY_ID[raw.component]) { state.component = raw.component; }
    if (raw.format === 'tailwind' || raw.format === 'css') { state.format = raw.format; }
  } catch (e) {}

  function persist() {
    try { localStorage.setItem('layz.lab.components', JSON.stringify(state)); }
    catch (e) {}
  }

  /* ---------------- shadow stage ---------------- */
  var host = $('ukStage');
  var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : null;

  if (!shadow) {
    /* No attachShadow means a browser old enough that the rest of the site is
       already degraded. Say so rather than rendering a component that quietly
       inherits the site's styles and misrepresents the output. */
    host.innerHTML = '<p class="label label--soft" style="padding:40px;text-align:center">' +
      'This browser cannot isolate the preview, so the components are not shown. ' +
      'The generated code below is still correct.</p>';
  }

  function renderStage() {
    if (!shadow) { return; }
    var c = BY_ID[state.component];
    shadow.innerHTML = '<style>' + BASE_CSS + '\n' + c.css + '</style>' + c.html;
  }

  /* ---------------- token bridge ----------------
     Set on the host. Custom properties inherit through the shadow boundary,
     which is what lets one write here restyle everything inside. */
  function applyTokens(s) {
    var p = Lab.palette(s.mode);
    var t = D.BY_NAME[s.title];
    var b = D.BY_NAME[s.body];
    if (!t || !b) { return; }

    var tw = P.headingWeight(t);
    F.load(t.name, { priority: true, weights: tw === 400 ? null : '400;' + tw });
    F.load(b.name, { priority: true, weights: '400;500;600;700' });

    host.style.setProperty('--bg-rgb', Lab.toRgb(p.bg).join(', '));
    host.style.setProperty('--fg-rgb', Lab.toRgb(p.fg).join(', '));
    host.style.setProperty('--brand-bg', p.bg);
    host.style.setProperty('--brand-fg', p.fg);
    host.style.setProperty('--brand-accent', p.accent);
    host.style.setProperty('--brand-on-accent', Lab.bestOn(p.accent));
    host.style.setProperty('--font-title', t.stack);
    host.style.setProperty('--font-body', b.stack);
    host.style.setProperty('--font-title-weight', String(tw));
  }

  /* ---------------- code output ---------------- */
  function tokenBlock(s) {
    var t = D.BY_NAME[s.title];
    var b = D.BY_NAME[s.body];
    var light = Lab.palette('light');
    var dark = Lab.palette('dark');
    var tw = P.headingWeight(t);

    return '@import url("' + P.embedUrl({ title: t, body: b }) + '");\n\n' +
      ':root {\n' +
      '  --brand-bg: ' + light.bg + ';\n' +
      '  --brand-fg: ' + light.fg + ';\n' +
      '  --brand-accent: ' + light.accent + ';\n' +
      '  --brand-on-accent: ' + Lab.bestOn(light.accent) + ';\n' +
      '  --font-title: ' + t.stack + ';\n' +
      '  --font-body: ' + b.stack + ';\n' +
      '  --font-title-weight: ' + tw + ';\n' +
      '}\n\n' +
      '@media (prefers-color-scheme: dark) {\n' +
      '  :root {\n' +
      '    --brand-bg: ' + dark.bg + ';\n' +
      '    --brand-fg: ' + dark.fg + ';\n' +
      '    --brand-accent: ' + dark.accent + ';\n' +
      '    --brand-on-accent: ' + Lab.bestOn(dark.accent) + ';\n' +
      '  }\n' +
      '}';
  }

  function buildCode(s) {
    var c = BY_ID[state.component];
    if (state.format === 'tailwind') {
      return '<!-- Tailwind arbitrary values reference the custom properties\n' +
        '     below, which avoids escaping family names with spaces.\n' +
        '     Put this in your global stylesheet: -->\n\n' +
        '/* ' + tokenBlock(s).split('\n').join('\n   ') + ' */\n\n' +
        c.tw;
    }
    return tokenBlock(s) + '\n\n/* ---- ' + c.label + ' ---- */\n' + c.css +
      '\n\n<!-- markup -->\n' + formatHtml(c.html);
  }

  /* The templates are single-line strings for rendering; break them up so the
     copied markup is readable. */
  function formatHtml(html) {
    var out = html
      .replace(/></g, '>\n<')
      .split('\n');
    var depth = 0;
    return out.map(function (line) {
      if (/^<\//.test(line)) { depth = Math.max(0, depth - 1); }
      var padded = new Array(depth + 1).join('  ') + line;
      if (/^<[^/!]/.test(line) && !/\/>$/.test(line) && !/<\/[a-z]+>$/.test(line)) { depth++; }
      return padded;
    }).join('\n');
  }

  /* ---------------- render ---------------- */
  function render(s) {
    s = s || Lab.get();
    applyTokens(s);
    renderStage();

    panel.querySelectorAll('[data-comp]').forEach(function (btn) {
      var on = btn.getAttribute('data-comp') === state.component;
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('is-active', on);
    });
    panel.querySelectorAll('[data-fmt]').forEach(function (btn) {
      var on = btn.getAttribute('data-fmt') === state.format;
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('is-active', on);
    });
    panel.querySelectorAll('[data-uk-mode]').forEach(function (btn) {
      var on = btn.getAttribute('data-uk-mode') === s.mode;
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('is-active', on);
    });

    $('ukCode').textContent = buildCode(s);
    $('ukPair').textContent = s.title + ' + ' + s.body;

    /* Accent legibility is the one thing a component set can silently get
       wrong, so it is stated rather than assumed. */
    var p = Lab.palette(s.mode);
    var onAccent = Lab.contrast(Lab.bestOn(p.accent), p.accent);
    var body = Lab.contrast(p.fg, p.bg);
    $('ukNote').innerHTML =
      '<span class="label label--soft">Body ' + body.toFixed(2) + ':1</span> ' +
      '<span class="label label--soft">On accent ' + onAccent.toFixed(2) + ':1</span> ' +
      '<span class="label' + (onAccent >= 4.5 && body >= 4.5 ? ' label--soft' : '') + '">' +
        (onAccent >= 4.5 && body >= 4.5 ? 'Both clear AA' : 'Check the contrast tab') + '</span>';
  }

  /* ---------------- events ---------------- */
  panel.addEventListener('click', function (e) {
    var comp = e.target.closest('[data-comp]');
    if (comp) {
      state.component = comp.getAttribute('data-comp');
      persist();
      render();
      return;
    }
    var fmt = e.target.closest('[data-fmt]');
    if (fmt) {
      state.format = fmt.getAttribute('data-fmt');
      persist();
      render();
      return;
    }
    var mode = e.target.closest('[data-uk-mode]');
    if (mode) {
      Lab.set({ mode: mode.getAttribute('data-uk-mode') }, 'components');
    }
  });

  $('ukCopy').addEventListener('click', function () {
    L.copy($('ukCode').textContent,
      state.format === 'tailwind' ? 'Tailwind markup copied' : 'Component CSS copied');
  });

  $('ukShuffle').addEventListener('click', function () {
    var pair = P.generate({});
    Lab.set({ title: pair.title.name, body: pair.body.name }, 'components');
  });

  /* ---------------- boot ---------------- */
  (function buildChips() {
    $('ukChips').innerHTML = COMPONENTS.map(function (c, i) {
      return '<button class="uk-chip" data-comp="' + c.id + '" aria-pressed="false" data-cursor="Show">' +
        '<span class="num">' + L.pad(i + 1, 2) + '</span> ' + L.escapeHtml(c.label) +
      '</button>';
    }).join('');
  })();

  Lab.on(function (s) { render(s); });
  render(Lab.get());
})();
