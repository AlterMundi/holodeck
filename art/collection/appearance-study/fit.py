"""Fit surface-registered Gaussian splats from the calibrated Matter captures."""
from pathlib import Path
import json
import math
import subprocess
import sys

import numpy as np

root = Path(sys.argv[1])
views = ('entry', 'east', 'west', 'reverse', 'side', 'shelf')
arguments = sys.argv[2:]
if arguments not in ([], ['--light'], ['--orbital'], ['--detail']):
    raise SystemExit('Usage: fit.py CAPTURE_DIRECTORY [--light | --orbital | --detail]')
light = arguments == ['--light']
detail = arguments == ['--detail']
orbital = arguments == ['--orbital'] or detail
if detail:
    views += ('threshold', 'archive', 'bench')
spacing = .024 if detail else .055 if light else .04 if orbital else .027
suffix = '-detail' if detail else '-light' if light else '-orbital' if orbital else ''
generated_views = set(views) if orbital else {'entry', 'east', 'reverse'}

def rgb(path, w, h):
    bytes_ = subprocess.check_output([
        'ffmpeg', '-v', 'error', '-threads', '1', '-i', str(path), '-vf',
        f'scale={w}:{h}:flags=area', '-frames:v', '1', '-threads:v', '1',
        '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
    return np.frombuffer(bytes_, np.uint8).reshape(h, w, 3).astype(np.float32)

def soften(pixels, radius):
    height, width = pixels.shape[:2]
    padded = np.pad(pixels, ((radius, radius), (radius, radius), (0, 0)), mode='edge')
    integral = np.pad(padded, ((1, 0), (1, 0), (0, 0))).cumsum(0).cumsum(1)
    k = radius * 2 + 1
    return (integral[k:k+height,k:k+width]-integral[:height,k:k+width]
            -integral[k:k+height,:width]+integral[:height,:width]) / k**2

def normalized(vector):
    return vector / np.linalg.norm(vector, axis=-1, keepdims=True).clip(1e-8)

records, all_samples = [], []
for name in views:
    camera = np.load(root/f'{name}.npz')
    samples = camera['view']
    h, w = samples.shape[:2]
    if samples.shape != ((384, 576, 7) if detail else (256, 384, 7)) or not np.isfinite(samples).all():
        raise ValueError(f'Capture {name} has invalid samples')
    all_samples.append(samples[samples[:,:,6] > .10, :])
    base = rgb(root/f'{name}.png', w, h)
    generated = name in generated_views
    raw = rgb(root/f'{name}-style.png', w, h) if generated else base
    # Bound appearance shifts where the generator displaces a contour.
    basic = soften(base, 4)
    generated_low = soften(raw, 4)
    gain = (generated_low + 40) / (basic + 40)
    fine = raw - soften(raw, 2)
    base_detail = base - soften(base, 2)
    good_detail = np.clip(1 - np.max(abs(fine-base_detail), axis=2, keepdims=True)/24, 0, 1)
    correction = np.clip(gain, .68, 1.58) ** .87
    grade = np.clip(base * correction + good_detail * (fine-base_detail) * .45, 0, 255)
    if orbital:
        # Preserve the new palette. Keep high-frequency detail only away
        # from geometry contours, where divergent edits create ghosts.
        edge = np.max(abs(base - soften(base, 2)), axis=2, keepdims=True)
        detail_weight = np.clip(1 - edge / 35, .18, .85)
        grade = np.clip(soften(raw, 1) + (raw - soften(raw, 1)) * detail_weight, 0, 255)
    records.append((name, samples, camera['position'], camera['target'], float(camera['fov']),
                    base, raw, grade, generated))

merged = np.concatenate(all_samples)
cells = np.unique(np.rint(merged[:,:3]/spacing).astype(np.int32), axis=0, return_inverse=True)[1]
ordered = np.lexsort((-merged[:,6], cells))
keep = ordered[np.r_[True, np.diff(cells[ordered])!=0]]
selected = merged[keep]
xyz = selected[:,:3].copy()
normals = normalized(selected[:,3:6])
weights = np.zeros(len(xyz), np.float32)
sums = np.zeros((3, len(xyz), 3), np.float32)
observations = np.zeros(len(xyz), np.int8)
styled = np.zeros(len(xyz), bool)
view_matches = {}
for name, grid, blender_pos, target, fov, base, raw, grade, generated in records:
    pos = blender_pos[[0,2,1]] * (1,1,-1)
    goal = target[[0,2,1]] * (1,1,-1)
    front = normalized(goal-pos)
    right = normalized(np.cross(front, (0,1,0)))
    up = np.cross(right, front)
    displacement = xyz-pos
    depth = displacement @ front
    h, w = grid.shape[:2]
    focal = h / 2 / math.tan(math.radians(fov)/2)
    xs = np.rint((displacement @ right) * focal / depth.clip(.03) + w / 2 - .25).astype(int)
    ys = np.rint(-(displacement @ up) * focal / depth.clip(.03) + h / 2 - .25).astype(int)
    valid = np.flatnonzero((depth > .06) & (xs>=0) & (xs<w) & (ys>=0) & (ys<h))
    row,col = ys[valid],xs[valid]
    seen = grid[row,col]
    distances = np.linalg.norm(xyz[valid]-seen[:,:3], axis=1)
    accepted = (distances <= np.minimum(.075, .012 + depth[valid]*.008)) & (
        np.einsum('ij,ij->i', normals[valid], seen[:,3:6]) > .85)
    choice = valid[accepted]
    row, col = row[accepted], col[accepted]
    if orbital:
        weight = (.08 + seen[accepted,6]**3) / (1 + depth[choice]*.33)**2
        if detail:
            weight **= 1.75
    else:
        weight = (.06 + seen[accepted,6]**2) / (1 + depth[choice]*.19)
    if generated:
        weight *= 1.30
        styled[choice] = True
    weights[choice] += weight
    observations[choice] += 1
    for i, colors in enumerate((base, raw, grade)):
        sums[i,choice] += colors[row,col] * weight[:,None]
    view_matches[name] = len(choice)

retained = weights > 0
count = int(np.count_nonzero(retained))
if not 0 < count <= (720_000 if detail else 420_000):
    raise ValueError(f'Unexpected fitted point count: {count}')
xyz, normals = xyz[retained], normals[retained]
angles = np.zeros((len(normals),4), np.float32)
angles[:,0] = 1 + normals[:,2]
angles[:,1] = -normals[:,1]
angles[:,2] = normals[:,0]
angles[angles[:,0] < 1e-4] = (0, 1, 0, 0)
angles = normalized(angles)
dtype = np.dtype([('position','<f4',(3,)),('scale','<f4',(3,)),
                  ('rgba','u1',(4,)),('rotation','u1',(4,))])
packed = np.empty(len(xyz),dtype=dtype)
# The lighter comparison rests over the source mesh. Offset its points in
# the surface normal direction so the GLB can fill missed rays.
packed['position'] = xyz + normals*.018 if light else xyz
# Two broad surface axes and a narrow thickness along the ray-cast normal.
radius = spacing * .96 if light or orbital else .026
packed['scale'] = (radius, radius, .0055)
packed['rgba'][:,3] = 230
packed['rotation'] = (angles*128+128).clip(0,255).astype(np.uint8)
if detail:
    # 12-byte records keep the more detailed room within the viewer's asset
    # budget. Positions use 1/4096 m and both Gaussian radii are uniform.
    compact = np.empty(count, dtype=np.dtype([
        ('position', '<i2', (3,)), ('rgb', 'u1', (3,)), ('normal', 'i1', (3,))]))
    quantized = np.rint(xyz * 4096)
    if np.max(np.abs(quantized)) >= 32767:
        raise ValueError('Detail vertices out of bounds')
    compact['position'] = quantized.astype(np.int16)
    compact['rgb'] = np.clip(sums[2, retained] / weights[retained, None], 0, 255)
    compact['normal'] = np.rint(normals * 127)
    compact.tofile(root / 'orbital-detail.bin')
else:
    for index,name in enumerate(('blender','raw','guided')):
        packed['rgba'][:,:3] = (sums[index,retained]/weights[retained,None]).clip(0,255).astype(np.uint8)
        packed.tofile(root/f'{name}{suffix}.splat')
stats = dict(spacingMeters=spacing, splats=len(packed), bytes=compact.nbytes if detail else packed.nbytes,
             multiView=float(np.mean(observations[retained]>1)),
             generatedCoverage=float(np.mean(styled[retained])),
             viewMatches=view_matches,
             fittedViews=list(views), generatedViews=[r[0] for r in records if r[-1]], heldOut='held')
(root/f'fit{suffix}.json').write_text(json.dumps(stats,indent=2)+'\n')
print(json.dumps(stats))
