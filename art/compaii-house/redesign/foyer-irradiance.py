"""Generate a Cycles reference and an indirect-light atlas for the foyer.

Run against the editable house scene with Blender in background mode. The
atlas is authoring evidence for a WebGL light-map trial, not a runtime asset.
"""
import json
import runpy
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


destination = Path(sys.argv[sys.argv.index('--')+1]).resolve()
destination.mkdir(parents=True, exist_ok=True)
export = runpy.run_path(str(Path(__file__).with_name('export_cells.py')))
room = export['mesh_for']('VIS · House', (0, 0, 0), 'foyer')
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

# Use the registered geometry's existing UV islands for this source bake.
image = bpy.data.images.new('Foyer diffuse indirect', width=768, height=768, alpha=False, float_buffer=True)
for material in room.data.materials:
    target = material.node_tree.nodes.new('ShaderNodeTexImage')
    target.image = image
    material.node_tree.nodes.active = target
scene.render.bake.use_pass_direct = False
scene.render.bake.use_pass_indirect = True
scene.render.bake.use_pass_color = False
scene.render.bake.margin = 6
export['select']([room])
bpy.ops.object.bake(type='DIFFUSE')
image.file_format = 'OPEN_EXR'
image.filepath_raw = str(destination/'foyer-indirect.exr')
image.save()

pixels = image.pixels[:]
lit = [max(pixels[i:i+3]) for i in range(0, len(pixels),4) if max(pixels[i:i+3])>1e-5]
assert lit and max(lit)>min(lit), 'Cycles returned no spatially varying indirect light'
print(json.dumps({'atlas':[768,768],'illuminatedTexels':len(lit),'peak':max(lit)}))
