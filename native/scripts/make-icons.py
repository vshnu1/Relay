#!/usr/bin/env python3
"""Generate the iOS app icon and splash from the Relay mark.

The mark is the same one in public/favicon.svg, redrawn here rather than
converted: no SVG rasteriser is installed on this machine, and a hand-drawn
polyline at 4x supersampling is sharper than a traced 32px source anyway.

  python3 scripts/make-icons.py
"""
from PIL import Image, ImageDraw

PINE = (36, 73, 61)  # #24493d, the brand mark background
DEEP = (20, 43, 40)  # #142b28, the splash background and theme-color
WHITE = (255, 255, 255)

# favicon.svg path, in its own 32x32 coordinate space
MARK = [(6, 17), (11, 17), (14, 9), (18, 23), (21, 17), (26, 17)]
STROKE = 2.4
SS = 4  # supersample factor


def draw_mark(size, background, inset=1.0):
    """The mark centred on `background`, at `size` px, drawn at SSx then reduced."""
    big = size * SS
    img = Image.new("RGB", (big, big), background)
    d = ImageDraw.Draw(img)
    scale = big / 32 * inset
    offset = (big - 32 * scale) / 2
    pts = [(x * scale + offset, y * scale + offset) for x, y in MARK]
    width = int(STROKE * scale)
    d.line(pts, fill=WHITE, width=width, joint="curve")
    # joint="curve" rounds the joins but not the two ends
    r = width / 2
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x - r, y - r, x + r, y + r], fill=WHITE)
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    # iOS masks the corners itself and rejects alpha, so this is full-bleed RGB.
    icon = draw_mark(1024, PINE)
    icon.save("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")

    # The splash is shown centre-cropped at every aspect ratio, so the mark sits
    # small in a large field of the background colour.
    splash = draw_mark(2732, DEEP, inset=0.22)
    for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
        splash.save(f"ios/App/App/Assets.xcassets/Splash.imageset/{name}")
    print("wrote app icon (1024) and splash (2732)")
