"""Bake one shared UV atlas for separately scoped GLBs in a static room."""

import argparse
import json
import sys
import time
from pathlib import Path
from types import SimpleNamespace

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bake_lightmaps import (  # noqa: E402
    UV_NAME, coverage, denoise_atlas, digest, integer_maps, positive, reference,
    setup_scene, write_map,
)


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('parts', type=Path, nargs='+')
    parser.add_argument('--resolution', type=positive, default=1024)
    parser.add_argument('--samples', type=positive, default=24)
    parser.add_argument('--threads', type=positive, default=2)
    parser.add_argument('--reference-scale', type=positive, default=45)
    parser.add_argument('--atlas-module', type=Path, required=True, help='directory containing the xatlas module')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if args.resolution < 512 or args.resolution > 4096:
        parser.error('select a 512–4096 pixel atlas')
    if len(args.parts) > 6 or len({path.name for path in args.parts}) != len(args.parts):
        parser.error('use up to six distinct room-local part names')
    args.input = args.parts[0]
    args.elevation, args.azimuth, args.temperature = 14, 252, 3500
    args.camera, args.target = (-3, 1.74, -4.81), (0, 1.146, -2)
    args.no_foliage = True
    return args


def select(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def room_objects(args):
    parts = [[obj for obj in bpy.context.scene.objects if obj.type == 'MESH']]
    existing = set(bpy.context.scene.objects)
    for part in args.parts[1:]:
        bpy.ops.import_scene.gltf(filepath=str(part.resolve()), merge_vertices=False)
        added = set(bpy.context.scene.objects) - existing
        parts.append(sorted((obj for obj in added if obj.type == 'MESH'), key=lambda obj: obj.name))
        existing.update(added)
    if any(not objects for objects in parts):
        raise ValueError('one selected room part has no mesh')
    return parts


def unwrap(objects, size, module_path):
    sys.path.insert(0, str(module_path.resolve()))
    import xatlas

    atlas = xatlas.Atlas()
    geometry = []
    for obj in objects:
        mesh = obj.data
        if mesh.uv_layers.get(UV_NAME) or len(mesh.uv_layers) > 1:
            raise ValueError('expected room parts with at most one material UV set')
        if not mesh.uv_layers:
            mesh.uv_layers.new(name='UVMap', do_init=False)
        mesh.uv_layers.active = mesh.uv_layers.new(name=UV_NAME, do_init=False)
        mesh.calc_loop_triangles()
        positions = np.asarray([tuple(obj.matrix_world @ v.co) for v in mesh.vertices], dtype=np.float32)
        faces = np.asarray([triangle.vertices[:] for triangle in mesh.loop_triangles], dtype=np.uint32)
        loops = np.asarray([triangle.loops[:] for triangle in mesh.loop_triangles])
        atlas.add_mesh(positions, faces)
        geometry.append((mesh, faces, loops))
    options = xatlas.PackOptions()
    # xatlas searches around this target. Allow some rescaling to the final
    # square image if four packing pixels still cover three bake pixels.
    options.resolution = size * 3 // 4
    options.padding = 4
    options.bilinear = True
    atlas.generate(pack_options=options)
    if atlas.atlas_count != 1 or max(atlas.width, atlas.height) * 3 > size * 4:
        raise ValueError(f'room requires {atlas.atlas_count} atlas pages of {atlas.width} × {atlas.height}')
    triangles = []
    for index, (mesh, faces, loops) in enumerate(geometry):
        vertex_map, indices, uv = atlas[index]
        if not np.array_equal(vertex_map[indices], faces):
            raise ValueError('the atlas changed the room face order')
        coords = np.zeros((len(mesh.loops), 2), dtype=np.float32)
        coords[loops.ravel()] = uv[indices].reshape(-1, 2)
        if not np.isfinite(coords).all() or np.any(coords < 0) or np.any(coords > 1):
            raise ValueError('UV coordinates escaped the shared atlas')
        mesh.uv_layers[UV_NAME].uv.foreach_set('vector', coords.ravel())
        triangles.append(coords[loops])
    combined = np.concatenate(triangles).reshape(-1, 2)
    faces = np.arange(len(combined)).reshape(-1, 3)
    mask = coverage([(SimpleNamespace(uv=combined), None, None, None, faces)], size)
    if mask.mean() < .1:
        raise ValueError('room atlas covers less than 10%; increase resolution or simplify UV islands')
    return mask, len(faces), atlas.chart_count, [atlas.width, atlas.height]


def save_parts(parts, inputs, output):
    for objects, source in zip(parts, inputs):
        select(objects)
        bpy.ops.export_scene.gltf(filepath=str(output / (source.stem + '-lightmap.glb')),
                                  export_format='GLB', use_selection=True, export_animations=False)


def main():
    start = time.monotonic()
    args = arguments()
    args.output = args.output.resolve()
    args.output.mkdir(parents=True, exist_ok=True)
    if any(args.output.iterdir()):
        raise ValueError('use an empty output directory')
    inputs = [{"name": path.name, "bytes": path.stat().st_size, "sha256": digest(path.read_bytes())}
              for path in args.parts]
    scene, sun = setup_scene(args, exterior_ground=False)
    parts = room_objects(args)
    objects = [obj for group in parts for obj in group]
    size = args.resolution
    mask, triangles, charts, atlas_dimensions = unwrap(objects, size, args.atlas_module)
    print(f'UV audit: {triangles} triangles, {charts} charts, {mask.mean():.1%} coverage', flush=True)
    save_parts(parts, args.parts, args.output)
    select(objects)
    bpy.ops.object.join()
    proxy = bpy.context.object
    proxy.data.uv_layers.active = proxy.data.uv_layers[UV_NAME]
    image = bpy.data.images.new('Room diffuse bake', size, size, alpha=True, float_buffer=True)
    image.colorspace_settings.name = 'Non-Color'
    for material in proxy.data.materials:
        nodes = material.node_tree.nodes
        texture = nodes.new('ShaderNodeTexImage')
        texture.image = image
        nodes.active = texture
    scene.cycles.use_adaptive_sampling = False
    print(f'Baking {size} x {size}, {args.samples} CPU samples', flush=True)
    begun = time.monotonic()
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'},
                       uv_layer=UV_NAME, margin=3, margin_type='EXTEND')
    bake_seconds = time.monotonic() - begun
    pixels, denoiser = denoise_atlas(image, args.threads)
    if not np.isfinite(pixels).all() or np.max(pixels[mask]) <= 0:
        raise ValueError('bake did not produce finite positive irradiance')
    exposure = 1 / float(np.percentile(pixels[mask].max(axis=1), 99.95))
    scene.view_settings.view_transform = 'Standard'
    write_map(scene, pixels, args.output / f'lightmap-{size}')
    integer_maps(pixels, exposure, args.output / f'lightmap-{size}')
    reference(scene, args)
    files = {path.name: {"bytes": path.stat().st_size, "sha256": digest(path.read_bytes())}
             for path in sorted(args.output.iterdir()) if path.is_file()}
    report = dict(schema='holodeck.linterna.room-parts-bake/v1', inputs=inputs,
                  files=files, triangles=triangles, charts=charts, atlas_size=size,
                  packing_size=atlas_dimensions, uv_channel=1,
                  atlas_coverage=float(mask.mean()), png_jpeg_linear_exposure_gain=exposure,
                  samples=args.samples, threads=args.threads, oidn_version=denoiser,
                  sun=dict(elevation_deg=args.elevation, azimuth_deg=args.azimuth,
                           temperature_kelvin=args.temperature, direction_blender=list(sun)),
                  bake_seconds=round(bake_seconds, 3), total_seconds=round(time.monotonic() - start, 3))
    (args.output / 'manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f"Completed room bake in {report['total_seconds']} seconds", flush=True)


if __name__ == '__main__':
    main()
