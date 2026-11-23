"""Author offline Cycles references and portable diffuse light for registered rooms."""
import json
import runpy
import subprocess
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def area(name, position, target, power, color, size):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.color, data.size = power, color, size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z', 'Y').to_euler()


LIGHTS = {
    'foyer': (
        ('Clerestory', (4.89,-1.75,3.15), (-2.30,2.30,.80), 440, (.83,.91,1), 1.8),
        ('West practical', (-2.9,1.10,1.78), (-2.32,-.2,.25), 38, (1,.69,.39), .23),
        ('East practical', (2.9,1.10,1.78), (2.32,-.2,.25), 38, (1,.69,.39), .23),
    ),
    'beacon': (
        ('Instrument pendant', (-.44,-1.9,4.35), (-.44,-1.9,1.07), 520, (1,.78,.47), 1.05),
        ('Stair spill', (-3,4.58,3.28), (-1.80,2.40,.25), 295, (.55,.73,1), 2.2),
        ('Spatializer pendant', (3.79,.80,2.70), (3.79,.58,.95), 124, (1,.79,.55), .54),
        ('Weaver pendant', (-3.76,-2.67,2.70), (-3.76,-2.42,.95), 124, (1,.77,.50), .54),
    ),
    'gallery': (
        ('Clerestory', (-4.30,-.5,3.79), (2.45,-.5,1.05), 350, (.76,.85,1), 2.5),
        ('Draft wash', (2.10,.34944,3.39), (3.3945,.34944,1.11), 52, (1,.82,.58), .52),
        ('Finished wash', (2.10,-1.25,3.39), (2.5,-1.25,.965), 75, (1,.87,.66), .54),
        ('Archive wash', (2.10,-3.67744,3.39), (3.3945,-3.67744,1.41), 56, (1,.77,.49), .52),
    ),
}


def select_lighting(room, cell):
    for obj in bpy.context.scene.objects:
        obj.hide_render = obj != room
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.diffuse_bounces = 3
    scene.cycles.use_denoising = True
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .15 if cell == 'foyer' else .08
    for spec in LIGHTS['gallery' if cell=='gallery-sealed' else cell]:
        area(*spec)


def diffuse_light(room, size, *, direct=False):
    import numpy as np

    scene = bpy.context.scene
    image = bpy.data.images.new('Room diffuse light', width=size, height=size,
                                alpha=False, float_buffer=True)
    for material in room.data.materials:
        nodes = material.node_tree.nodes
        target = nodes.new('ShaderNodeTexImage')
        target.image = image
        nodes.active = target
    scene.render.bake.use_pass_direct = direct
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = False
    scene.render.bake.margin = 8
    bpy.ops.object.bake(type='DIFFUSE')
    pixels = np.empty(size*size*4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    daylight = pixels.reshape(size, size, 4)[::-1, :, :3]
    lit = daylight.max(axis=2)
    assert np.isfinite(daylight).all() and lit.max() > 1e-5 and lit.min() < lit.max()
    print(json.dumps({'atlas':[size,size], 'illuminatedTexels':int((lit > 1e-5).sum()),
                      'peak':float(lit.max())}))
    return image, daylight


def portable_bounce(room, cell, albedo, size, destination):
    import numpy as np

    select_lighting(room, cell)
    _, lighting = diffuse_light(room, size, direct=True)
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(albedo),'-frames:v','1',
                                  '-f','rawvideo','-pix_fmt','rgb24','pipe:1'])
    srgb = np.frombuffer(raw, dtype=np.uint8).reshape(size,size,3).astype(np.float32)/255
    diffuse = np.where(srgb <= .04045, srgb/12.92, ((srgb+.055)/1.055)**2.4)
    # Premultiply static direct and indirect light by diffuse reflectance.
    # Filter in linear light. A shoulder keeps the small atlas within display
    # range while retaining the low-level illumination in shadow.
    bounce = np.maximum(lighting,0)*diffuse*.60
    bounce = bounce.reshape(size//2,2,size//2,2,3).mean(axis=(1,3))
    bounce = np.where(bounce<=.78,bounce,1-.22*np.exp(-np.maximum(bounce-.78,0)/.22))
    encoded = np.where(bounce <= .0031308, 12.92*bounce, 1.055*bounce**(1/2.4)-.055)
    path = destination/(cell+'-bounce.jpg')
    subprocess.run(['ffmpeg','-v','error','-y','-f','rawvideo','-pixel_format','rgb24',
                    '-video_size',f'{size//2}x{size//2}','-i','pipe:0','-frames:v','1',
                    '-pix_fmt','yuvj444p','-q:v','3',str(path)],
                   input=np.rint(encoded*255).astype(np.uint8).tobytes(), check=True)
    assert path.stat().st_size <= 80*1024
    return bpy.data.images.load(str(path))


def reference(destination, cell):
    destination.mkdir(parents=True, exist_ok=True)
    export = runpy.run_path(str(Path(__file__).with_name('export_cells.py')))
    collection, origin = export['CELLS'][cell]
    room = export['mesh_for'](collection, origin, cell)
    select_lighting(room, cell)

    scene = bpy.context.scene
    camera = bpy.data.objects.new('Player-height reference', bpy.data.cameras.new('Room lens'))
    bpy.context.collection.objects.link(camera)
    position, target = ((0,-4.75,1.68),(-.65,3.35,1.40)) if cell == 'foyer' else (
        (-2.7,3.05,1.68),(-.44,-2.60,1.76))
    camera.location = position
    camera.rotation_euler = (Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.lens = 28
    scene.camera = camera
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 960, 620, 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(destination/(cell+'-cycles-reference.png'))
    bpy.ops.render.render(write_still=True)
    image, _ = diffuse_light(room, 768)
    image.file_format = 'OPEN_EXR'
    image.filepath_raw = str(destination/(cell+'-indirect.exr'))
    image.save()


if __name__ == '__main__':
    destination, cell = sys.argv[sys.argv.index('--')+1:]
    reference(Path(destination).resolve(), cell)
