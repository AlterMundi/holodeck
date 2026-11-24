"""Resample a calibrated, horizontal rectangular surface onto a regular lattice."""
import argparse
import json
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('output', type=Path)
parser.add_argument('--bounds', type=float, nargs=4, required=True, metavar=('MIN_X', 'MAX_X', 'MIN_Z', 'MAX_Z'))
parser.add_argument('--spacing', type=float, required=True, help='Target spacing in meters')
args = parser.parse_args()

layout = np.dtype([('position', '<i2', (3,)), ('rgb', 'u1', (3,)), ('normal', 'i1', (3,))])
source = np.fromfile(args.source, dtype=layout)
positions = source['position']
if len(source) < 4 or np.ptp(positions[:, 1]) or not np.all(source['normal'] == [0, 127, 0]):
    parser.error('Expected calibrated samples from one upward-facing horizontal plane')
lo_x, hi_x, lo_z, hi_z = args.bounds
if not np.isfinite([lo_x, hi_x, lo_z, hi_z, args.spacing]).all() or args.spacing <= 0:
    parser.error('Expected finite bounds and positive spacing')
if not (-7.99 <= lo_x < hi_x <= 7.99 and -7.99 <= lo_z < hi_z <= 7.99):
    parser.error('The floor must fit the bounded room-local compact format')
shape = np.ceil([(hi_x - lo_x) / args.spacing, (hi_z - lo_z) / args.spacing])
if np.prod(shape) > 260000:
    parser.error('Too many planar splats')
width, depth = shape.astype(int)
x = lo_x + (np.arange(width) + .5) * (hi_x - lo_x) / width
z = lo_z + (np.arange(depth) + .5) * (hi_z - lo_z) / depth
grid = np.stack(np.meshgrid(x, z), axis=-1).reshape(-1, 2)
observed = positions[:, [0, 2]] / 4096
distances, neighbours = cKDTree(observed).query(grid, k=4)
weights = 1 / np.maximum(distances, .003) ** 2
colors = np.sum(source['rgb'][neighbours] * weights[:, :, None], axis=1) / weights.sum(axis=1)[:, None]

result = np.empty(len(grid), dtype=layout)
result['position'][:, [0, 2]] = np.rint(grid * 4096).astype(np.int16)
result['position'][:, 1] = positions[0, 1]
result['normal'] = [0, 127, 0]
result['rgb'] = np.rint(colors).astype(np.uint8)
result.tofile(args.output)
print(json.dumps({'splats': len(result), 'sourceSplats': len(source),
                  'beyondOneCellFromObservation': int(np.count_nonzero(distances[:, 0] > args.spacing)),
                  'maxDistanceFromObservation': float(distances[:, 0].max())}))
