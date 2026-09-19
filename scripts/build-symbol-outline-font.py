"""Build the iOS symbol face: pip install 'fonttools[woff]'; python this_file.py.

Preserve the original monochrome outlines, mappings, metrics and layout tables.
Only remove color representations so WebKit uses normal TrueType rendering.
"""

from pathlib import Path

from fontTools.ttLib import TTFont

fonts = Path(__file__).resolve().parents[1] / "public" / "fonts"
font = TTFont(fonts / "aa-summer-symbols-lavender-v3.woff2")
for table in ("COLR", "CPAL", "SVG "):
    del font[table]
font.save(fonts / "aa-summer-symbols-outline-v1.woff2")
