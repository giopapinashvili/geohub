# Split a tall screenshot into viewable segments: python3 web/tools/crop.py file.png [segment_height]
import sys
from PIL import Image
p = sys.argv[1]; h = int(sys.argv[2]) if len(sys.argv) > 2 else 1100
im = Image.open(p); W, H = im.size
for i, y in enumerate(range(0, H, h)):
    im.crop((0, y, W, min(H, y + h))).save(p.replace('.png', f'.part{i}.png'))
print(W, H, (H + h - 1) // h)
