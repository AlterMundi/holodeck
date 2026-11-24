"""Prepare metric, periodic game textures from a selected six-slot albedo sheet."""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SLOTS = ('bulkhead', 'navy', 'deck', 'orange', 'steel', 'graphite')
SIZE = 512


def periodic(image):
    # In the small overlap band, fade the two opposing sides to the same
    # value. Retain authored texture variation across the central area.
    array = np.asarray(image, np.float32).copy()
    width = 20
    for axis in (0, 1):
        rows = array.swapaxes(0, axis)
        average = (rows[:width] + rows[-width:][::-1]) / 2
        weight = np.linspace(1, 0, width)[:, None, None] ** 2
        rows[:width] += (average - rows[:width]) * weight
        rows[-width:][::-1] += (average - rows[-width:][::-1]) * weight
    return array


def convert(name, image, output):
    rgb = periodic(image.resize((SIZE, SIZE), Image.Resampling.LANCZOS))
    gray = np.asarray(image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
                      .convert('L').filter(ImageFilter.GaussianBlur(radius=3)), np.float32) / 255
    height = (gray - gray.mean()) * .48
    y, x = np.mgrid[:SIZE, :SIZE]
    edge = np.minimum.reduce((x, y, SIZE-x-1, SIZE-y-1))
    if name in ('deck', 'bulkhead'):
        inset = 3 if name == 'deck' else 2
        joint = np.clip((edge - inset) / 4, 0, 1)
        rgb *= (.64 + .36*joint[:, :, None])
        height += .55*joint
        if name == 'bulkhead':
            for px, py in ((16, 16),(SIZE-17,16),(16,SIZE-17),(SIZE-17,SIZE-17)):
                rivet = np.clip(1 - np.hypot(x-px,y-py)/4, 0, 1)
                rgb *= (1 - rivet[:, :, None]*.39)
                height -= rivet*.36
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 2.
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 2.
    normal = np.stack((-dx, dy, np.ones_like(dx)), axis=2)
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    Image.fromarray(np.rint(rgb).clip(0, 255).astype(np.uint8)).save(
        output / f'{name}.jpg', quality=83, optimize=True, subsampling=0)
    Image.fromarray(np.rint((normal*.5+.5)*255).astype(np.uint8)).save(
        output / f'{name}-normal.png', optimize=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sheet', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    image = Image.open(args.sheet).convert('RGB')
    w, h = image.size
    if abs(w/h - 1.5) > .02:
        parser.error('Expected a 3:2 sheet of square material swatches')
    args.output.mkdir(parents=True, exist_ok=True)
    for index, name in enumerate(SLOTS):
        x, y = index % 3, index // 3
        position = (round(x*w/3), round(y*h/2), round((x+1)*w/3), round((y+1)*h/2))
        left, top, right, bottom = position
        convert(name, image.crop((left+12, top+12, right-12, bottom-12)), args.output)


if __name__ == '__main__':
    main()
