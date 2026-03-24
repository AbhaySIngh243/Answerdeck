"""One-off: adapt repo-root wordmarksvg.svg for light-header use in public/brand/wordmark.svg."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[2]
src = root / "wordmarksvg.svg"
out = root / "frontend" / "public" / "brand" / "wordmark.svg"

text = src.read_text(encoding="utf-8")
text = re.sub(
    r'<path fill="#000000" opacity="1\.000000" stroke="none"\s+d="[\s\S]*?z"/>',
    "",
    text,
    count=1,
)
text = text.replace('fill="#FAFAFA"', 'fill="#0f172a"')
text = text.replace('fill="#FBFBFB"', 'fill="#0f172a"')
text = text.replace('fill="#010101"', 'fill="#f8fafc"')
text = text.replace('fill="#2762E3"', 'fill="#2563eb"')
old_open = (
    '<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" '
    'xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"\n\t width="100%" '
    'viewBox="0 0 1280 1280" enable-background="new 0 0 1280 1280" xml:space="preserve">'
)
new_open = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 1280" fill="none" xml:space="preserve">'
text = text.replace(old_open, new_open)
# Tight viewBox around paths (not full 1280 artboard) so CSS height maps to real wordmark size
text = text.replace(
    'viewBox="0 0 1280 1280"',
    'viewBox="142 530 998 195"',
    1,
)
out.write_text(text, encoding="utf-8")
print("wrote", out.relative_to(root), out.stat().st_size, "bytes")
