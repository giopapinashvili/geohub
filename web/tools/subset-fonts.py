"""Subset FiraGO (from @fontsource/firago, which ships the full font) into
per-script WOFF2 files, so a Georgian reader downloads only Georgian glyphs.

Run from the repo root:  python3 web/tools/subset-fonts.py
Requires: pip install fonttools brotli
"""
import os
from fontTools import subset
from fontTools.ttLib import TTFont

SRC = 'node_modules/@fontsource/firago/files/firago-latin-{w}-normal.woff2'
OUT = 'web/src/assets/fonts'
WEIGHTS = [400, 500, 600, 700]

# unicode-range values are mirrored in web/src/styles/fonts.css
RANGES = {
    'georgian': 'U+10D0-10FF,U+2D00-2D2F,U+20BE,U+0589,U+10FB',
    'latin': 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,'
             'U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,'
             'U+2212,U+2215,U+FEFF,U+FFFD',
    'latin-ext': 'U+0100-02AF,U+0300-0301,U+1E00-1EFF,U+2020,U+20A0-20AB,'
                 'U+20AD-20BD,U+20BF-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
    'cyrillic': 'U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116',
}

def parse(r):
    out = []
    for part in r.split(','):
        part = part.strip()[2:]
        if '-' in part:
            a, b = part.split('-')
            out.extend(range(int(a, 16), int(b, 16) + 1))
        else:
            out.append(int(part, 16))
    return out

os.makedirs(OUT, exist_ok=True)
for w in WEIGHTS:
    for name, r in RANGES.items():
        font = TTFont(SRC.format(w=w))
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['*']
        opts.name_IDs = ['*']
        opts.notdef_outline = True
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=parse(r))
        sub.subset(font)
        path = f'{OUT}/firago-{name}-{w}.woff2'
        font.flavor = 'woff2'
        font.save(path)
        print(path, os.path.getsize(path))
