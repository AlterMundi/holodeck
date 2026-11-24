"""Compare photometric disagreement on matching surfaces across known views."""
import argparse
from itertools import combinations
import json
import math
from pathlib import Path
import subprocess

import numpy as np

VIEWS = ('entry', 'east', 'west', 'reverse', 'side', 'shelf', 'threshold', 'archive', 'bench')


def rgb(path, width, height):
    data = subprocess.check_output(['ffmpeg', '-v', 'error', '-threads', '1', '-i', str(path),
                                    '-vf', f'scale={width}:{height}:flags=area', '-frames:v', '1',
                                    '-threads:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
    return np.frombuffer(data, np.uint8).reshape(height, width, 3)


def norm(v):
    return v / np.linalg.norm(v)


def interior(grid):
    normal = grid[:, :, 3:6]
    center = grid[1:-1, 1:-1]
    mask = center[:, :, 6] > .30
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        neighbor = grid[1+dy:grid.shape[0]-1+dy, 1+dx:grid.shape[1]-1+dx]
        mask &= np.sum(normal[1:-1, 1:-1] * neighbor[:, :, 3:6], axis=2) > .97
        mask &= np.linalg.norm(center[:, :, :3] - neighbor[:, :, :3], axis=2) < .10
    return np.pad(mask, 1)


def match(first, second):
    grid, valid, *_ = first
    target, target_valid, pos, right, up, front, fov = second
    rows, cols = np.nonzero(valid)
    rows, cols = rows[::5], cols[::5]
    hit = grid[rows, cols]
    relative = hit[:, :3] - pos
    depth = relative @ front
    h, w = target.shape[:2]
    focal = h / 2 / math.tan(math.radians(fov) / 2)
    x = np.rint((relative @ right) * focal / depth.clip(.05) + w / 2 - .25).astype(int)
    y = np.rint(-(relative @ up) * focal / depth.clip(.05) + h / 2 - .25).astype(int)
    inside = np.flatnonzero((depth > .06) & (x > 0) & (x < w-1) & (y > 0) & (y < h-1))
    observed = target[y[inside], x[inside]]
    delta = observed[:, :3] - hit[inside, :3]
    normal = hit[inside, 3:6]
    good = (np.sum(normal * observed[:, 3:6], axis=1) > .96)
    good &= (np.abs(np.sum(delta * normal, axis=1)) < .012)
    good &= (np.linalg.norm(delta, axis=1) < .035)
    good &= target_valid[y[inside], x[inside]]
    kept = inside[good]
    return rows[kept], cols[kept], y[kept], x[kept]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('captures', type=Path, help='Directory with calibrated NPZ and NAME-style.png')
    parser.add_argument('control', type=Path, help='Coherent rerenders at the same calibrated cameras')
    args = parser.parse_args()
    camera, edited, control = {}, {}, {}
    for name in VIEWS:
        with np.load(args.captures / f'{name}.npz') as view:
            grid = view['view']
            pos, target = (view[key][[0, 2, 1]] * (1, 1, -1) for key in ('position', 'target'))
            front = norm(target - pos)
            right = norm(np.cross(front, (0, 1, 0)))
            camera[name] = grid, interior(grid), pos, right, np.cross(right, front), front, float(view['fov'])
        h, w = grid.shape[:2]
        edited[name] = rgb(args.captures / f'{name}-style.png', w, h)
        control[name] = rgb(args.control / f'{name}.png', w, h)
    results = [[], []]
    pairs = 0
    for a, b in combinations(VIEWS, 2):
        r, c, y, x = match(camera[a], camera[b])
        if len(r):
            pairs += 1
            for samples, images in zip(results, (edited, control)):
                samples.append(np.abs(images[a][r, c].astype(np.float32) - images[b][y, x]).mean(axis=1))
    report = {'viewPairs': pairs, 'validCorrespondences': sum(len(a) for a in results[0])}
    for name, data in zip(('independent_edits', 'coherent_renders'), results):
        error = np.concatenate(data)
        report[name] = {'mean': float(error.mean()), 'median': float(np.median(error)),
                        'p90': float(np.percentile(error, 90))}
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
