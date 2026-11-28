"""Tileable finish textures for the Holodeck residence, generated from the finish sheet's palette.

Periodic noise (FFT-filtered) keeps every texture seamless. Returns linear-free sRGB uint8 arrays.
"""
import numpy as np


def periodic_noise(n, scale, seed, octaves=5, gain=.55):
    rng = np.random.default_rng(seed)
    out = np.zeros((n, n))
    amp, total = 1.0, 0.0
    fy, fx = np.meshgrid(np.fft.fftfreq(n), np.fft.fftfreq(n), indexing="ij")
    radius = np.hypot(fx, fy)
    for o in range(octaves):
        cutoff = scale * 2 ** o / n
        spectrum = np.fft.fft2(rng.standard_normal((n, n))) * np.exp(-(radius / cutoff) ** 2)
        layer = np.real(np.fft.ifft2(spectrum))
        layer = (layer - layer.mean()) / (layer.std() + 1e-9)
        out += amp * layer; total += amp; amp *= gain
    out /= total
    return (out - out.min()) / (np.ptp(out) + 1e-9)


def mix(a, b, t):
    return a + (b - a) * t[..., None]


def rgb(hexc):
    return np.array([int(hexc[i:i + 2], 16) for i in (1, 3, 5)], float)


def marble(n=512, seed=3):
    """Aged ivory marble: soft clouding, warped grey-gold veins (sheet: Mármol marfil envejecido)."""
    cloud = periodic_noise(n, 3, seed)
    warp = periodic_noise(n, 2, seed + 1, 4)
    y, x = np.mgrid[0:n, 0:n] / n
    phase = 2 * np.pi * (2 * x + 1 * y + 1.8 * warp)          # integer frequencies keep the tile seamless
    vein = np.abs(np.sin(phase)) ** .12
    vein2 = np.abs(np.sin(2 * np.pi * (3 * y - x + 2.2 * periodic_noise(n, 2, seed + 2, 4)))) ** .09
    v = np.minimum(vein, vein2)
    base = mix(rgb('#d9d1bf'), rgb('#f1ebdc'), cloud)
    c = mix(rgb('#a89c86'), base, np.clip(v * 1.15, 0, 1))
    gold = (1 - np.clip(v * 1.6, 0, 1)) * (periodic_noise(n, 6, seed + 3) > .6)
    c = mix(c, rgb('#c9a35a'), gold * .7)
    return np.clip(c, 0, 255).astype(np.uint8)


def floor(n=512, seed=11):
    """Polished stone floor: 4×4 slabs per tile with thin dark joints and per-slab tone."""
    m = marble(n, seed).astype(float) * .92
    y, x = np.mgrid[0:n, 0:n]
    cell = n // 4
    slab = ((x // cell) * 7 + (y // cell) * 13) % 5
    m *= (0.92 + 0.03 * slab)[..., None]
    joint = (np.minimum(x % cell, cell - 1 - x % cell) < 2) | (np.minimum(y % cell, cell - 1 - y % cell) < 2)
    m[joint] = rgb('#6d6253')
    return np.clip(m, 0, 255).astype(np.uint8)


def teal_tiles(n=512, seed=21):
    """Overlapping teal metal tiles with patina and champagne seams (sheet: Tejas de metal teal)."""
    rows, cols = 8, 8
    y, x = np.mgrid[0:n, 0:n] / n
    r = np.floor(y * rows); xs = (x * cols + .5 * (r % 2)) % cols
    fx, fy = xs % 1, (y * rows) % 1
    tone = ((np.floor(xs) * 31 + r * 17) % 7) / 7
    pat = periodic_noise(n, 8, seed)
    base = mix(rgb('#215f69'), rgb('#3a8792'), .35 + .4 * tone + .25 * pat - .2 * fy)
    seam = (fy > .93) | (fx < .03) | (fx > .97)
    base[seam] = rgb('#b89a62')
    return np.clip(base, 0, 255).astype(np.uint8)


def gold(n=256, seed=31):
    """Champagne gold with brushed, slightly worn variation."""
    brush = periodic_noise(n, 64, seed, 2)
    wear = periodic_noise(n, 4, seed + 1)
    c = mix(rgb('#b89552'), rgb('#e4c88a'), .5 * brush + .5 * wear)
    return np.clip(c, 0, 255).astype(np.uint8)


TEXTURES = {"marble": marble, "floor": floor, "tiles": teal_tiles, "gold": gold}
