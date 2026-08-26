/* ============================================================
   Layz - brand vibe table
   ------------------------------------------------------------
   Hand-built moods. Each one carries two or three font pairs
   and a light/dark palette designed as a set.

   Two rules every entry here has to hold, both machine-checked
   by the harness rather than trusted:

     1. every family name resolves in the catalogue
     2. fg-on-bg clears WCAG AA (4.5:1) in BOTH modes, and the
        accent clears 3:1 non-text contrast against its bg

   A mood generator that hands someone a failing palette is
   worse than no generator, so the data is held to the same bar
   the contrast tool measures against.

   Row shape:
     id, label, blurb, pairs[[title, body], ...],
     light { bg, fg, accent }, dark { bg, fg, accent }
   ============================================================ */
(function (global) {
  'use strict';

  var MOODS = [
    {
      id: 'saas',
      label: 'SaaS startup',
      blurb: 'Neutral, competent, slightly invisible. The typography gets out of the product’s way.',
      pairs: [
        ['Plus Jakarta Sans', 'Inter'],
        ['Sora', 'Inter'],
        ['Figtree', 'Inter']
      ],
      light: { bg: '#ffffff', fg: '#101828', accent: '#2563eb' },
      dark:  { bg: '#0b1220', fg: '#e6edf7', accent: '#3b82f6' }
    },
    {
      id: 'luxury',
      label: 'Luxury',
      blurb: 'High stroke contrast on warm paper. Space is the product; restraint is the message.',
      pairs: [
        ['Cormorant Garamond', 'Lato'],
        ['Bodoni Moda', 'Lato'],
        ['Prata', 'Nunito Sans']
      ],
      light: { bg: '#faf7f2', fg: '#1c1815', accent: '#7a5c22' },
      dark:  { bg: '#14110d', fg: '#ece5d8', accent: '#c9a227' }
    },
    {
      id: 'cyberpunk',
      label: 'Cyberpunk',
      blurb: 'Machine type and a voltage accent. Reads like a terminal that costs too much.',
      pairs: [
        ['Syne', 'JetBrains Mono'],
        ['Unbounded', 'Space Grotesk'],
        ['Chivo', 'JetBrains Mono']
      ],
      light: { bg: '#f2f0ff', fg: '#1a0b2e', accent: '#6d28d9' },
      dark:  { bg: '#07060f', fg: '#e9e4ff', accent: '#22d3ee' }
    },
    {
      id: 'editorial',
      label: 'Editorial',
      blurb: 'The magazine default. A didone announces, a humanist sans explains.',
      pairs: [
        ['Playfair Display', 'Source Sans 3'],
        ['Instrument Serif', 'Inter'],
        ['Gloock', 'Epilogue']
      ],
      light: { bg: '#fffdf9', fg: '#16130f', accent: '#9a2617' },
      dark:  { bg: '#12100d', fg: '#f0ece4', accent: '#e2725b' }
    },
    {
      id: 'brutalist',
      label: 'Brutalist',
      blurb: 'Maximum weight, zero decoration, one hazard colour. Nothing is softened.',
      pairs: [
        ['Archivo Black', 'Roboto'],
        ['Anton', 'Work Sans'],
        ['Staatliches', 'Rubik']
      ],
      light: { bg: '#f5f5f5', fg: '#000000', accent: '#b91c1c' },
      dark:  { bg: '#000000', fg: '#ffffff', accent: '#facc15' }
    },
    {
      id: 'playful',
      label: 'Playful',
      blurb: 'Wide, round and warm. Built for products that are allowed to be fun.',
      pairs: [
        ['Unbounded', 'Figtree'],
        ['Caveat', 'Nunito'],
        ['Fraunces', 'Manrope']
      ],
      light: { bg: '#fffdf5', fg: '#2b1a0e', accent: '#b8430f' },
      dark:  { bg: '#1a1410', fg: '#fff4e6', accent: '#fb923c' }
    },
    {
      id: 'academic',
      label: 'Academic',
      blurb: 'Old-style serif, long measure, quiet institutional green. Built to be read slowly.',
      pairs: [
        ['EB Garamond', 'Lato'],
        ['Libre Baskerville', 'Montserrat'],
        ['Cardo', 'Source Sans 3']
      ],
      light: { bg: '#fbfaf7', fg: '#1a1a1a', accent: '#14532d' },
      dark:  { bg: '#101210', fg: '#e8e8e3', accent: '#4ade80' }
    },
    {
      id: 'clinical',
      label: 'Clinical',
      blurb: 'Cool, even and unexcitable. A superfamily doing dashboards and documentation.',
      pairs: [
        ['IBM Plex Sans', 'IBM Plex Sans'],
        ['IBM Plex Sans', 'IBM Plex Mono'],
        ['Barlow', 'Source Sans 3']
      ],
      light: { bg: '#ffffff', fg: '#0f172a', accent: '#0e7490' },
      dark:  { bg: '#0a1014', fg: '#e2f0f5', accent: '#22d3ee' }
    },
    {
      id: 'retro',
      label: 'Retro',
      blurb: 'Fairground slab on tinted stock. Seventies signage without the pastiche.',
      pairs: [
        ['Alfa Slab One', 'Cabin'],
        ['Abril Fatface', 'Lora'],
        ['Yeseva One', 'Josefin Sans']
      ],
      light: { bg: '#fdf3e3', fg: '#2b1b0e', accent: '#9c3d13' },
      dark:  { bg: '#1d1409', fg: '#f7e7cd', accent: '#e08e45' }
    },
    {
      id: 'zine',
      label: 'Zine',
      blurb: 'Tall condensed caps, a slightly odd grotesque, and one colour doing all the shouting.',
      pairs: [
        ['Bebas Neue', 'Karla'],
        ['Oswald', 'Karla'],
        ['Fjalla One', 'Work Sans']
      ],
      light: { bg: '#f0f0eb', fg: '#111111', accent: '#be123c' },
      dark:  { bg: '#0d0d0d', fg: '#f5f5f0', accent: '#fb7185' }
    },
    {
      id: 'fintech',
      label: 'Fintech',
      blurb: 'Deep navy, one confident green, and geometry that reads as solvent.',
      pairs: [
        ['Sora', 'Inter'],
        ['Space Grotesk', 'Inter'],
        ['Manrope', 'Inter']
      ],
      light: { bg: '#ffffff', fg: '#0b1b2b', accent: '#047857' },
      dark:  { bg: '#071018', fg: '#dce8f2', accent: '#34d399' }
    },
    {
      id: 'eco',
      label: 'Eco',
      blurb: 'Chunky new-school serif on recycled stock. Earthy without going rustic.',
      pairs: [
        ['Young Serif', 'Work Sans'],
        ['Bitter', 'Open Sans'],
        ['Newsreader', 'Chivo']
      ],
      light: { bg: '#f7f5ee', fg: '#1e2419', accent: '#3f6212' },
      dark:  { bg: '#12160f', fg: '#e8eddf', accent: '#a3e635' }
    }
  ];

  var BY_ID = {};
  MOODS.forEach(function (m) { BY_ID[m.id] = m; });

  global.LayzVibes = { MOODS: MOODS, BY_ID: BY_ID };
})(window);
