"""Author the foyer's offline Cycles reference and portable diffuse light."""
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


def select_lighting(room):
    for obj in bpy.context.scene.objects:
        obj.hide_render = obj != room
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.diffuse_bounces = 3
    scene.cycles.use_denoising = True
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .15
    area('Clerestory', (4.89,-1.75,3.15), (-2.30,2.30,.80), 440, (.83,.91,1), 1.8)
    for x in (-2.9,2.9):
        area('Warm pier practical', (x,1.10,1.78), (x*.8,-.2,.25), 38, (1,.69,.39), .23)


def diffuse_light(room, size, *, direct=False):
    import numpy as np

    scene = bpy.context.scene
    image = bpy.data.images.new('Foyer diffuse light', width=size, height=size,
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


def portable_bounce(room, albedo, size, destination):
    import numpy as np

    select_lighting(room)
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
    path = destination/'foyer-bounce.jpg'
    subprocess.run(['ffmpeg','-v','error','-y','-f','rawvideo','-pixel_format','rgb24',
                    '-video_size',f'{size//2}x{size//2}','-i','pipe:0','-frames:v','1',
                    '-pix_fmt','yuvj444p','-q:v','3',str(path)],
                   input=np.rint(encoded*255).astype(np.uint8).tobytes(), check=True)
    assert path.stat().st_size <= 80*1024
    return bpy.data.images.load(str(path))


def reference(destination):
    destination.mkdir(parents=True, exist_ok=True)
    export = runpy.run_path(str(Path(__file__).with_name('export_cells.py')))
    room = export['mesh_for']('VIS · House', (0, 0, 0), 'foyer')
    select_lighting(room)

    scene = bpy.context.scene
    camera = bpy.data.objects.new('Player-height reference', bpy.data.cameras.new('Foyer lens'))
    bpy.context.collection.objects.link(camera)
    camera.location = (0,-4.75,1.68)
    camera.rotation_euler = (Vector((-.65,3.35,1.40))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.lens = 28
    scene.camera = camera
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 960, 620, 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(destination/'foyer-cycles-reference.png')
    bpy.ops.render.render(write_still=True)
    image, _ = diffuse_light(room, 768)
    image.file_format = 'OPEN_EXR'
    image.filepath_raw = str(destination/'foyer-indirect.exr')
    image.save()


if __name__ == '__main__':
    reference(Path(sys.argv[sys.argv.index('--')+1]).resolve())
