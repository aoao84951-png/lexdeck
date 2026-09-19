"""Build the iOS symbol face: pip install 'fonttools[woff]'; python this_file.py.

Preserve outlines, mappings, metrics, layout, COLRv0 layers and CPAL colors.
Only remove SVG-in-OpenType so WebKit uses the COLRv0 color representation.
The output filename's v1 is the asset revision, not the COLR table version.
"""

from pathlib import Path

from fontTools.ttLib import TTFont

fonts = Path(__file__).resolve().parents[1] / "public" / "fonts"
font = TTFont(fonts / "aa-summer-symbols-lavender-v3.woff2")
assert font["COLR"].version == 0
del font["SVG "]
font.save(fonts / "aa-summer-symbols-colr-v1.woff2")
