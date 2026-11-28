"""Bake the smoke flipbook used by hero-effects.mjs.

A puff is simulated once as a small density volume: a ball of billowing
noise that expands, rises, curls and thins over sixteen frames. Each frame
is ray-marched orthographically and lit from three directions with self
shadowing, so the runtime can relight it from the sun without any volume
work. Atlas: 4x4 frames, RGBA = light from above, from the right, from the
left, and coverage.

    python3 art/effects/bake_smoke_flipbook.py public/assets/effects/smoke-flipbook.png
"""
import struct
import sys
import zlib

import numpy as np

N = 64          # voxels per side and pixels per frame
FRAMES = 16
GRID = 4
rng = np.random.default_rng(20261128)


def lattice(size):
    return rng.random((size, size, size)).astype(np.float32)


OCTAVES = [lattice(s) for s in (5, 9, 17, 29)]


def sample(volume, p):
    # Trilinear, periodic sample of a lattice at points p in [0,1).
    n = volume.shape[0]
    q = (p % 1.0) * n
    i = np.floor(q).astype(np.int64)
    f = q - i
    f = f * f * (3 - 2 * f)
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (f[..., 0] if dx else 1 - f[..., 0]) * (f[..., 1] if dy else 1 - f[..., 1]) * (f[..., 2] if dz else 1 - f[..., 2])
                out = out + w * volume[(i[..., 0] + dx) % n, (i[..., 1] + dy) % n, (i[..., 2] + dz) % n]
    return out


def fbm(p):
    total, amp = 0, .5
    for k, volume in enumerate(OCTAVES):
        total = total + amp * sample(volume, p + k * .173)
        amp *= .5
    return total / .9375


axis = (np.arange(N, dtype=np.float32) + .5) / N * 2 - 1
X, Y, Z = np.meshgrid(axis, axis, axis, indexing='ij')   # X right, Y up, Z toward the viewer

# A cluster of lobes: the cauliflower silhouette of a real puff.
LOBES = []
for k in range(34):
    direction = rng.normal(size=3)
    direction /= np.linalg.norm(direction)
    LOBES.append((direction * np.array([1.15, .85, 1.15]), .3 + .7 * rng.random() ** .5, .06 + .08 * rng.random() ** 2, rng.random()))


def density(t):
    # t in [0,1]: young, tight and dense -> old, wide, rising and thin.
    grow = t ** .55
    d = np.zeros_like(X)
    for direction, reach, size, phase in LOBES:
        c = direction * reach * (.22 + .5 * grow)
        c = c + np.array([0, .16 * t, 0])
        r = size * (1 + 1.2 * grow)
        d += np.exp(-((X - c[0]) ** 2 + (Y - c[1]) ** 2 + (Z - c[2]) ** 2) / (r * r))
    p = np.stack([X * .5 + .5, Y * .5 + .5 - .2 * t, Z * .5 + .5], -1)
    detail = fbm(p * .8 + 1.7)
    fine = fbm(p * 2.1 + 5.3 + .15 * t)
    d = np.clip(d - (.38 + .2 * t), 0, None) * np.clip(detail * 2.2 - .55 + (fine - .5) * 1.2, 0, None)
    return d * (9.0 * (1 - .78 * t))


def light(d, axis_index, reverse):
    # Transmittance from a light along an axis: cumulative optical depth.
    step = 2.0 / N
    a = np.flip(d, axis_index) if reverse else d
    depth = np.cumsum(a, axis=axis_index) * step
    T = np.exp(-depth * .55)
    T = np.flip(T, axis_index) if reverse else T
    return T


def render(d):
    step = 2.0 / N
    top = light(d, 1, True)        # light arrives from +Y
    right = light(d, 0, True)      # from +X
    left = light(d, 0, False)      # from -X
    # March toward the viewer along +Z (front-to-back from +Z).
    dz = np.flip(d, 2)
    lit = [np.flip(t, 2) for t in (top, right, left)]
    alpha_step = 1 - np.exp(-dz * step)
    view_T = np.cumprod(np.concatenate([np.ones_like(alpha_step[..., :1]), 1 - alpha_step[..., :-1]], 2), 2)
    weight = alpha_step * view_T
    coverage = weight.sum(2)
    channels = [(weight * t).sum(2) / np.maximum(coverage, 1e-4) for t in lit]
    # Ambient floor so the shadow side never goes black.
    channels = [np.clip(.28 + .72 * c, 0, 1) * (coverage > 1e-4) for c in channels]
    image = np.stack(channels + [coverage], -1)
    return np.transpose(image, (1, 0, 2))[::-1]   # rows top-down, columns left-right


def png(path, rgba):
    h, w, _ = rgba.shape
    raw = b''.join(b'\0' + rgba[y].tobytes() for y in range(h))
    chunk = lambda kind, data: struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
                + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def main(out):
    atlas = np.zeros((N * GRID, N * GRID, 4), np.float32)
    for k in range(FRAMES):
        frame = render(density(k / (FRAMES - 1)))
        # Soft circular vignette so no frame touches its cell border.
        yy, xx = np.mgrid[0:N, 0:N]
        rr = np.hypot(xx - N / 2 + .5, yy - N / 2 + .5) / (N / 2)
        frame[..., 3] *= np.clip((1 - rr) / .08, 0, 1)
        row, col = divmod(k, GRID)
        atlas[row * N:(row + 1) * N, col * N:(col + 1) * N] = frame
    png(out, (np.clip(atlas, 0, 1) * 255 + .5).astype(np.uint8))


if __name__ == '__main__':
    main(sys.argv[1])
