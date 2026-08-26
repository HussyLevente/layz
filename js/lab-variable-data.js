/* ============================================================
   Layz - variable font axis table
   ------------------------------------------------------------
   GENERATED from Google's own font metadata
   (https://fonts.google.com/metadata/fonts), then hand-curated
   down to 44 families. Do not hand-edit ranges: they are the
   real axis bounds the css2 endpoint will accept, and a value
   outside them makes the whole request 400.

   Excluded on purpose:
     - 'ital', which css2 treats as a style, not a variation
     - axes whose min equals max (nothing to drag)
     - families whose ONLY axes are exotic, since a slider with
       no honest label is just a mystery knob

   Row: [name, [[tag, min, max, default], ...]]
   ============================================================ */
(function (global) {
  'use strict';

  /* Display names, straight from Google's axis registry. */
  var AXIS_NAMES = {
    "CASL": "Casual",
    "CRSV": "Cursive",
    "CTRS": "Contrast",
    "FLAR": "Flare",
    "GRAD": "Grade",
    "MONO": "Monospace",
    "ROND": "Roundness",
    "SHRP": "Sharpness",
    "SOFT": "Softness",
    "VOLM": "Volume",
    "WONK": "Wonky",
    "XOPQ": "Thick Stroke",
    "XTRA": "Counter Width",
    "YOPQ": "Thin Stroke",
    "YTAS": "Ascender Height",
    "YTDE": "Descender Depth",
    "YTFI": "Figure Height",
    "YTLC": "Lowercase Height",
    "YTUC": "Uppercase Height",
    "opsz": "Optical Size",
    "slnt": "Slant",
    "wdth": "Width",
    "wght": "Weight"
  };

  var RAW = [
    ["Open Sans", [["wdth",75,100,100],["wght",300,800,400]]],
    ["Inter", [["opsz",14,32,14],["wght",100,900,400]]],
    ["Noto Sans", [["wdth",62.5,100,100],["wght",100,900,400]]],
    ["DM Sans", [["opsz",9,40,14],["wght",100,1000,400]]],
    ["Nunito Sans", [["YTLC",440,540,500],["opsz",6,12,12],["wdth",75,125,100],["wght",200,1000,400]]],
    ["Merriweather", [["opsz",18,144,18],["wdth",87,112,100],["wght",300,900,400]]],
    ["Bricolage Grotesque", [["opsz",12,96,14],["wdth",75,100,100],["wght",200,800,400]]],
    ["Saira", [["wdth",50,125,100],["wght",100,900,400]]],
    ["IBM Plex Sans", [["wdth",75,100,100],["wght",100,700,400]]],
    ["Archivo", [["wdth",62,125,100],["wght",100,900,400]]],
    ["Google Sans Flex", [["GRAD",0,100,0],["ROND",0,100,0],["opsz",6,144,18],["slnt",-10,0,0],["wdth",25,151,100],["wght",1,1000,400]]],
    ["Inconsolata", [["wdth",50,200,100],["wght",200,900,400]]],
    ["Cairo", [["slnt",-11,11,0],["wght",200,1000,400]]],
    ["Fraunces", [["SOFT",0,100,0],["WONK",0,1,0],["opsz",9,144,14],["wght",100,900,400]]],
    ["Cabin", [["wdth",75,100,100],["wght",400,700,400]]],
    ["Roboto Flex", [["GRAD",-200,150,0],["XOPQ",27,175,96],["XTRA",323,603,468],["YOPQ",25,135,79],["YTAS",649,854,750],["YTDE",-305,-98,-203],["YTFI",560,788,738],["YTLC",416,570,514],["YTUC",528,760,712],["opsz",8,144,14],["slnt",-10,0,0],["wdth",25,151,100],["wght",100,1000,400]]],
    ["Fredoka", [["wdth",75,125,100],["wght",300,700,400]]],
    ["Instrument Sans", [["wdth",75,100,100],["wght",400,700,400]]],
    ["Source Serif 4", [["opsz",8,60,14],["wght",200,900,400]]],
    ["Asap", [["wdth",75,125,100],["wght",100,900,400]]],
    ["Bodoni Moda", [["opsz",6,96,11],["wght",400,900,400]]],
    ["Newsreader", [["opsz",6,72,16],["wght",200,800,400]]],
    ["Geologica", [["CRSV",0,1,0],["SHRP",0,100,0],["slnt",-12,0,0],["wght",100,900,400]]],
    ["Roboto Serif", [["GRAD",-50,100,0],["opsz",8,144,14],["wdth",50,150,100],["wght",100,900,400]]],
    ["Literata", [["opsz",7,72,14],["wght",200,900,400]]],
    ["Playfair", [["opsz",5,1200,14],["wdth",87.5,112.5,100],["wght",300,900,400]]],
    ["Advent Pro", [["wdth",100,200,100],["wght",100,900,400]]],
    ["Encode Sans", [["wdth",75,125,100],["wght",100,900,400]]],
    ["Commissioner", [["FLAR",0,100,0],["VOLM",0,100,0],["slnt",-12,0,0],["wght",100,900,400]]],
    ["Radio Canada", [["wdth",75,100,100],["wght",300,700,400]]],
    ["Ubuntu Sans", [["wdth",75,100,100],["wght",100,800,400]]],
    ["Georama", [["wdth",62.5,150,100],["wght",100,900,400]]],
    ["Mona Sans", [["wdth",75,125,100],["wght",200,900,400]]],
    ["Pathway Extreme", [["opsz",8,144,12],["wdth",75,100,100],["wght",100,900,400]]],
    ["Anek Latin", [["wdth",75,125,100],["wght",100,800,400]]],
    ["TikTok Sans", [["opsz",12,36,14],["slnt",-6,0,0],["wdth",75,150,100],["wght",300,900,400]]],
    ["Tektur", [["wdth",75,100,100],["wght",400,900,400]]],
    ["Big Shoulders", [["opsz",10,72,14],["wght",100,900,400]]],
    ["Anybody", [["wdth",50,150,100],["wght",100,900,400]]],
    ["Recursive", [["CASL",0,1,0],["CRSV",0,1,0.5],["MONO",0,1,0],["slnt",-15,0,0],["wght",300,1000,400]]],
    ["Martian Mono", [["wdth",75,112.5,100],["wght",100,800,400]]],
    ["Science Gothic", [["CTRS",0,85,0],["slnt",-10,0,0],["wdth",50,200,100],["wght",100,900,400]]],
    ["Truculenta", [["opsz",12,72,14],["wdth",75,125,100],["wght",100,900,400]]],
    ["Tourney", [["wdth",75,125,100],["wght",100,900,400]]]
  ];

  var FAMILIES = RAW.map(function (r) {
    return {
      name: r[0],
      axes: r[1].map(function (a) {
        return { tag: a[0], min: a[1], max: a[2], def: a[3], label: AXIS_NAMES[a[0]] || a[0] };
      })
    };
  });

  var BY_NAME = {};
  FAMILIES.forEach(function (f) { BY_NAME[f.name] = f; });

  global.LayzVariable = {
    FAMILIES: FAMILIES,
    BY_NAME: BY_NAME,
    AXIS_NAMES: AXIS_NAMES
  };
})(window);
