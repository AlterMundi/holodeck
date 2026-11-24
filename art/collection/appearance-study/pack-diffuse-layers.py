"""Encode linear EXR albedo and irradiance into browser PNG textures."""
import argparse
from pathlib import Path
import subprocess

import numpy as np


def read_exr(path):
    probe = subprocess.check_output([
        'ffprobe', '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,pix_fmt', '-of', 'csv=p=0', str(path),
    ], text=True)
    width, height, pixel_format = probe.strip().split(',')
    width, height = int(width), int(height)
    if not 1 <= width <= 2048 or not 1 <= height <= 2048 or pixel_format != 'gbrpf32le':
        raise ValueError('Expected an RGB float EXR atlas up to 2048 pixels per side')
    raw = subprocess.check_output([
        'ffmpeg', '-nostdin', '-v', 'error', '-i', str(path),
        '-pix_fmt', 'gbrpf32le', '-threads', '1', '-f', 'rawvideo', '-',
    ])
    return np.frombuffer(raw, '<f4').reshape(3, height, width)[[2, 0, 1]].transpose(1, 2, 0)


def write_png(path, pixels):
    height, width, _ = pixels.shape
    byte_pixels = np.rint(255 * pixels).astype(np.uint8)
    subprocess.run([
        'ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'rawvideo', '-pixel_format', 'rgb24',
        '-video_size', f'{width}x{height}', '-i', '-', '-frames:v', '1', '-threads', '1', str(path),
    ], input=byte_pixels.tobytes(), check=True)


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('bake', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args()
albedo = read_exr(args.bake / 'orbital-albedo.exr')
irradiance = read_exr(args.bake / 'orbital-irradiance.exr')
if albedo.shape != irradiance.shape:
    raise ValueError('Albedo and irradiance must have the same UV layout and size')
for array, maximum in ((albedo, 1), (irradiance, 63)):
    if not np.isfinite(array).all() or array.min() < 0 or array.max() > maximum:
        raise ValueError(f'Expected finite layer values in [0, {maximum}]')
encoded_albedo = np.where(albedo <= .0031308, 12.92 * albedo, 1.055 * albedo**(1/2.4) - .055)
encoded_light = np.log2(irradiance + 1) / 6
args.output.mkdir(parents=True, exist_ok=True)
write_png(args.output / 'orbital-albedo.png', encoded_albedo)
write_png(args.output / 'orbital-irradiance.png', encoded_light)
