"""Render the authored room from the same camera as the packaged room."""
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Quaternion

root=Path(sys.argv[sys.argv.index('--')+1]).resolve()
pose=json.loads((root/'camera.json').read_text())
rotation=pose['rotation']
position=pose['position']
convert=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
basis=Quaternion(tuple(rotation[key] for key in ('w','x','y','z'))).to_matrix().to_4x4()
basis.translation=tuple(position[key] for key in ('x','y','z'))
camera_data=bpy.data.cameras.new('Packaged room witness')
camera=bpy.data.objects.new('Packaged room witness',camera_data)
scene=bpy.context.scene
scene.collection.objects.link(camera)
camera.matrix_world=convert@basis
scene.camera=camera
camera_data.sensor_fit='VERTICAL'
camera_data.lens=camera_data.sensor_height/(2*math.tan(math.radians(pose['fov'])/2))
scene.render.resolution_x=pose['width']
scene.render.resolution_y=pose['height']
scene.render.resolution_percentage=100
assert abs(pose['width']/pose['height']-pose['aspect'])<.01
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(root/'blender.png')
bpy.ops.render.render(write_still=True)
