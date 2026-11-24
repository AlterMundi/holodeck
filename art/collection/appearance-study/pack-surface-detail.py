"""Pack the Orbital material tiles while retaining their seam wrap in the atlas."""
import argparse
from pathlib import Path
import subprocess

import numpy as np


TILE = 256
GUTTER = 4
INNER = TILE - 2 * GUTTER
MATERIALS = ('bulkhead', 'navy', 'orange', 'steel', 'graphite')


def read_map(source):
    raw = subprocess.check_output([
        'ffmpeg', '-nostdin', '-v', 'error', '-threads', '1', '-i', str(source),
        '-vf', f'scale={INNER}:{INNER}:flags=lanczos', '-frames:v', '1',
        '-threads', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-',
    ])
    return np.frombuffer(raw, np.uint8).reshape(INNER, INNER, 3) / 255


def detail(materials, name):
    color = read_map(materials / f'{name}.jpg')
    normal = 2 * read_map(materials / f'{name}-normal.png') - 1
    color = np.where(color <= .04045, color / 12.92, ((color + .055) / 1.055) ** 2.4)
    luma = color @ [.2126, .7152, .0722]
    # Keep the appearance atlas in charge of large color and light changes.
    # Carry the source material's small-scale color and normal variation.
    n = np.fft.fftfreq(INNER)
    low_pass = np.exp(-2 * (np.pi * 5) ** 2 * (n[:, None] ** 2 + n[None, :] ** 2))
    smooth = np.fft.ifft2(np.fft.fft2(luma) * low_pass).real
    variation = (luma - smooth) / np.maximum(smooth, .035)
    shaded = .24 * normal[..., 0] + .34 * normal[..., 1] + .25 * (normal[..., 2] - 1)
    signal = .5 + .36 * variation + .44 * (shaded - shaded.mean())
    encoded = np.rint(255 * np.clip(signal, 0, 1)).astype(np.uint8)
    return np.pad(encoded, GUTTER, mode='wrap')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('materials', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    atlas = np.full((2 * TILE, 3 * TILE), 128, dtype=np.uint8)
    for index, name in enumerate(MATERIALS):
        row, column = divmod(index, 3)
        atlas[row * TILE:(row + 1) * TILE, column * TILE:(column + 1) * TILE] = detail(args.materials, name)
    subprocess.run([
        'ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray',
        '-s', f'{3 * TILE}x{2 * TILE}', '-i', '-', '-frames:v', '1', '-threads', '1', str(args.output),
    ], input=atlas.tobytes(), check=True)


if __name__ == '__main__':
    main()
