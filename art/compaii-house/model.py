"""Create the editable Casa de CompAII study and three Blender review views."""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

OUT = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'


def collection(name):
    result = bpy.data.collections.new(name)
    scene.collection.children.link(result)
    return result


architecture = collection('01 • Architecture')
beacon = collection('02 • Harmonic Beacon Lab')
sensorial = collection('03 • Sensorial')
arrival = collection('04 • Arrival and shared work')
studio = collection('06 • Review lights and viewpoints')
group = architecture


def material(name, color, metallic=0, roughness=.4, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    for key, value in {
        'Base Color': (*color, 1), 'Metallic': metallic, 'Roughness': roughness,
        'Emission Color': (*color, 1), 'Emission Strength': emission,
    }.items():
        shader.inputs[key].default_value = value
    return mat


clay = material('Limestone • warm mineral', (.43, .29, .18), roughness=.72)
ivory = material('Lime plaster', (.69, .51, .35), roughness=.78)
edge = material('Blackened bronze', (.085, .055, .033), .7, .35)
gold = material('Brushed brass', (.66, .34, .095), .7, .33)
slate = material('Ink slate', (.034, .061, .065), .14, .57)
oak = material('Smoked oak', (.23, .10, .044), .07, .49)
petrol = material('Ocean enamel', (.047, .15, .17), .15, .47)
amber = material('Beacon filament', (1, .41, .095), emission=2.4)
mint = material('Sensorial phosphor', (.095, .78, .73), emission=1.1)
soft = material('Porcelain lettering', (.89, .73, .52), emission=.2)
earth = material('Charcoal basalt', (.09, .105, .10), roughness=.94)


def own(obj, name, mat=None):
    obj.name = name
    for previous in list(obj.users_collection):
        previous.objects.unlink(obj)
    group.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj


def bevel(obj, width):
    if width:
        body = obj.modifiers.new('Machined edges', 'BEVEL')
        body.width, body.segments = width, 2
        obj.modifiers.new('Weighted shading', 'WEIGHTED_NORMAL')
    return obj


def block(name, at, size, mat, radius=.03, angle=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    obj = own(bpy.context.object, name, mat)
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler.z = angle
    return bevel(obj, radius)


def disc(name, at, radius, depth, mat, axis=False):
    bpy.ops.mesh.primitive_cylinder_add(vertices=36, radius=radius, depth=depth, location=at)
    obj = own(bpy.context.object, name, mat)
    if axis:
        obj.rotation_euler.x = math.pi / 2
    return bevel(obj, min(.024, depth / 4))


def line(name, vertices, mat, width=.018):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = width
    curve.bevel_resolution = 2
    spline = curve.splines.new('POLY')
    spline.points.add(len(vertices) - 1)
    for point, coord in zip(spline.points, vertices):
        point.co = (*coord, 1)
    return own(bpy.data.objects.new(name, curve), name, mat)


def ring(name, x, y, spring, radius, thickness, depth, mat, complete=False):
    # Analytic curved voussoir with matching front, back, inner and outer faces.
    points, faces = [], []
    count = 48 if complete else 28
    for i in range(count + 1):
        theta = (math.tau if complete else math.pi) * i / count
        for plane, r in ((-depth/2,radius),(-depth/2,radius+thickness),
                         (depth/2,radius+thickness),(depth/2,radius)):
            points.append((x+r*math.cos(theta), y+plane, spring+r*math.sin(theta)))
    for i in range(count):
        for j in range(4):
            a, b = i*4+j, i*4+(j+1)%4
            faces.append((a,b,b+4,a+4))
    if not complete:
        faces.extend(((3,2,1,0), tuple(range(count*4,count*4+4))))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(points, [], faces)
    mesh.update()
    return bevel(own(bpy.data.objects.new(name, mesh), name, mat), min(thickness/3,.018))


def portal(name, x, y, radius, spring, trim):
    for side in (-1, 1):
        block(name+' pier', (x+side*(radius+.14),y,spring/2), (.28,.38,spring), clay)
        block(name+' light', (x+side*(radius-.025),y-.20,spring/2+.08),
              (.024,.035,spring-.14), trim, .006)
    ring(name+' stone arch',x,y,spring,radius,.28,.4,clay)
    ring(name+' inlay',x,y-.21,spring,radius+.003,.028,.02,trim)


def lettering(title, x, y, z, size, mat=soft, align='CENTER'):
    text=bpy.data.curves.new(title, 'FONT')
    text.body=title
    text.align_x=align
    text.size=size
    text.extrude=.002
    obj=own(bpy.data.objects.new(title,text),title,mat)
    obj.location=(x,y,z)
    obj.rotation_euler.x=math.pi/2


def area(name, position, aim, color, energy, size):
    light = bpy.data.lights.new(name, 'AREA')
    light.color, light.energy, light.shape, light.size = color, energy, 'DISK', size
    obj = own(bpy.data.objects.new(name, light), name)
    obj.location = position
    obj.rotation_euler = (Vector(aim)-obj.location).to_track_quat('-Z','Y').to_euler()


# The plan reserves a four-metre central axis and two clear lab approaches.
block('Basalt terrace', (0,-.4,-.54), (24.8,17.2,1), earth, .45)
block('House limestone plinth', (0,0,-.2), (22.6,13.8,.45), clay, .16)
for center in (-7, 0, 7):
    block('Walkable floor', (center,0,.05), (6.94,12.8,.14), slate, .035)
    for n in range(11):
        block('Inset floor seam', (center,-5.95+n*1.16,.123), (6.76,.017,.01), edge, 0)
for x in (-10.9,10.9):
    block('Side shear wall',(x,0,2.55),(.35,12.65,4.9),ivory,.08)
for x in (-7,0,7):
    block('North enclosure',(x,6.25,2.58),(7,.3,5.0),clay,.04)
for x, trim in ((-7,amber),(0,soft),(7,mint)):
    portal('South entrance',x,-6.24,1.39,2.35,trim)
    for side in (-1,1):
        block('Front screen',(x+side*2.52,-6.29,2.33),(1.64,.25,4.43),ivory,.06)
        for i in range(5):
            block('Bronze screen flute',(x+side*(1.87+i*.26),-6.45,2.33),(.038,.08,4.32),edge,.008)
    block('Lintel',(x,-6.25,4.53),(7.02,.34,.48),clay,.06)
    block('Upper fascia',(x,-6.33,4.89),(6.98,.44,.22),edge,.06)
    for y in (-4.4,-1.7,1,3.7,5.9):
        portal('Ceiling rib',x,y,2.73,2.6,edge)
    for side in (-1,1):
        block('Clerestory beam',(x+side*2.55,0,4.5),(.13,12.5,.16),gold,.03)
        if x + side*7 in (-7,0,7):
            for span, length in ((-5.6,1.1),(.3,4.1),(5.65,1.0)):
                block('Interrupted baseboard',(x+side*3.32,span,.23),(.12,length,.17),edge)
        else:
            block('Baseboard',(x+side*3.32,0,.23),(.12,12.34,.17),edge)
for x in (-3.52,3.52):
    for y in (-5.3,2.25,5.2):
        block('Open colonnade pier',(x,y,2.48),(.28,.30,4.74),clay,.055)
    block('Longitudinal beam',(x,0,4.46),(.29,12.46,.26),clay,.065)
for y,z in ((-8.45,-.04),(-7.96,.01),(-7.42,.065)):
    block('Arrival step',(0,y,z),(7.8,.78,.20),clay,.055)
for i in range(7):
    block('Guiding brass inset',(0,-7.25+i*1.04,.132),(.046,.65,.014),gold,.006)

group = arrival
lettering('CASA DE COMPAII',0,-6.514,4.47,.295)
lettering('HARMONIC BEACON',-7,-6.514,4.48,.26)
lettering('SENSORIAL',7,-6.514,4.48,.29)
for side in (-1,1):
    block('Shared bench',(side*2.25,0,.51),(1.16,2.84,.18),oak,.10)
    block('Bench base',(side*2.25,0,.28),(.82,2.43,.44),edge,.08)
    disc('Entry lantern',(side*3.05,-7.2,.51),.20,.80,edge)
    disc('Lantern ring',(side*3.05,-7.2,.89),.205,.036,amber)
block('Shared working table',(0,4.08,.84),(2.36,1.18,.16),oak,.07)
for x in (-.85,.85):
    block('Shared table trestle',(x,4.08,.45),(.12,.91,.73),edge)
block('Shared notes board',(0,6.045,2.24),(4.8,.11,2.66),petrol,.10)
lettering('MESA COMÚN',0,5.95,2.97,.28)
lettering('Proyectos  /  Conversaciones  /  Resultados',0,5.95,2.41,.128)

group = beacon
x = -7
block('Beacon acoustic vault',(x,5.95,2.47),(5.57,.16,3.93),slate,.15)
for i in range(23):
    block('Beacon absorptive oak rib',(x-2.61+i*.236,5.78,2.47),(.11,.20,3.75),oak,.026)
for r, thick, mat in ((1.58,.055,gold),(1.26,.036,amber),(.89,.043,edge),(.52,.031,gold)):
    ring('Beacon prototype annulus',x,4.52,2.62,r,thick,.11,mat,True)
disc('Prototype hub',(x,4.50,2.62),.39,.19,edge,True)
disc('Prototype emitter',(x,4.38,2.62),.21,.035,amber,True)
disc('Prototype plinth',(x,4.51,.34),1.51,.43,edge)
disc('Prototype plinth inlay',(x,4.51,.56),1.48,.027,gold)
block('Acoustic workbench',(x,1.35,.91),(4.58,.93,.18),oak,.08)
for offset in (-1.62,1.62):
    block('Bench end',(x+offset,1.35,.50),(.14,.78,.77),edge)
for i,r in enumerate((.14,.11,.11,.11,.14)):
    disc('Frequency control',(x-.79+i*.38,1.23,1.09),r,.21,gold)
block('Beacon display',(x+.94,1.73,1.28),(1.63,.075,.51),slate,.05)
for i in range(4):
    line('Beacon sample waveform',[(x+.29+j*.045,1.68,1.11+i*.105+math.sin(j*.52+i)*.032) for j in range(30)],amber,.008)
lettering('HARMONIC BEACON LAB',x,5.62,4.44,.245)
lettering('Prototipos  /  Escucha  /  Ajustes',x,.877,.872,.11)

group = sensorial
x = 7
block('Sensorial survey display structure',(x,5.50,2.56),(5.45,.36,3.40),edge,.15)
block('Sensorial observation surface',(x,5.30,2.56),(5.20,.068,3.14),petrol,.12)
for i in range(14):
    line('Observation grid vertical',[(x-2.36+i*.36,5.258,1.19),(x-2.36+i*.36,5.258,3.54)],mint,.005)
for i in range(8):
    line('Observation grid horizontal',[(x-2.36,5.258,1.19+i*.32),(x+2.32,5.258,1.19+i*.32)],mint,.005)
for i in range(3):
    line('Illustrative sensor trace',[(x-2.22+j*.057,5.236,
         1.73+i*.52+(.09+i*.022)*math.sin(j*.24+i)+.095*math.sin(j*.42)) for j in range(79)],mint,.018)
lettering('SENSORIAL  /  OBSERVACIÓN',x,5.25,3.75,.26)
lettering('ESTUDIO DE INTERFAZ',x,5.25,.99,.115)
block('Sensorial analysis console',(x,1.13,.92),(4.46,1.04,.16),oak,.10)
for offset in (-1.56,1.56):
    block('Analysis rack',(x+offset,1.13,.49),(.44,.77,.73),edge,.05)
for offset in (-1.32,0,1.32):
    block('Control deck',(x+offset,1.16,1.04),(1.11,.70,.09),petrol,.06)
    for i in range(4):
        block('Control pad',(x+offset-.31+i*.21,1.04,1.104),(.13,.17,.036),mint,.018)
for offset in (-2.63,2.63):
    disc('Sensor station base',(x+offset,3.49,.23),.33,.24,edge)
    disc('Sensor station mast',(x+offset,3.49,1.04),.065,1.63,gold)
    disc('Sensor station indicator',(x+offset,3.49,1.90),.14,.12,mint)

group = collection('05 • Interaction anchors')


def anchor(name, location, purpose):
    marker = own(bpy.data.objects.new(name, None), name)
    marker.location = location
    marker.empty_display_type = 'CIRCLE'
    marker.empty_display_size = .24
    marker['purpose'] = purpose


anchor('Shared table • conversation', (0,3.4,1.1), 'Exact room and shared work reference')
anchor('Beacon • prototype inspection', (-7,3.0,1.46), 'Version-pinned instrument viewer')
anchor('Beacon • listening and controls', (-7,.83,1.1), 'Owned software controls and readback')
anchor('Sensorial • retained observation', (7,4.5,2.4), 'Authorized source-bound run and time')
anchor('Sensorial • analysis console', (7,.51,1.12), 'Compare measured and derived data')

group = studio
area('Warm key',(-10,-10,12),(0,1,0),(1,.78,.58),3500,9)
area('Cool sky',(11,1,11),(0,0,0),(.58,.76,1),2900,11)
area('Arrival porch',(0,-9,5),(0,-5,1),(1,.78,.53),470,5)
area('Beacon stage',(-7,2,4.5),(-7,4.4,1.9),(1,.63,.31),380,3.3)
area('Beacon table',(-6,-3,3.9),(-7,1.35,.88),(1,.81,.54),295,3)
area('Sensorial stage',(8,2,4.6),(7,5.1,2),(.48,.81,1),360,3.5)
area('Sensorial desk',(6,-3,3.6),(7,1.2,1),(.67,1,.92),185,2.8)
world=bpy.data.worlds.new('Blue hour')
world.use_nodes=True
world.node_tree.nodes.get('Background').inputs[0].default_value=(.18,.265,.30,1)
world.node_tree.nodes.get('Background').inputs[1].default_value=.33
scene.world=world


def camera(name, loc, point, lens, ortho=None):
    cam=bpy.data.cameras.new(name)
    obj=own(bpy.data.objects.new(name,cam),name)
    obj.location=loc
    obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
    cam.lens=lens
    if ortho:
        cam.type='ORTHO'
        cam.ortho_scale=ortho
    return obj


views = {
    'Casa de CompAII': camera('01 • Arrival', (16,-25,14),(0,-.1,1.55),40,30.3),
    'Harmonic Beacon Lab': camera('02 • Harmonic Beacon Lab',(-8.0,-5.55,1.69),(-6.86,3.97,2.36),24),
    'Sensorial': camera('03 • Sensorial',(8.6,-5.55,1.69),(6.65,4.46,2.14),24),
}
scene.camera=views['Casa de CompAII']
scene.render.engine='CYCLES'
scene.cycles.samples=20
scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED'
scene.render.threads=8
scene.render.resolution_x=1200
scene.render.resolution_y=720
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='JPEG'
scene.render.image_settings.quality=92
scene.view_settings.view_transform='AgX'
scene['study'] = 'Architectural design. Instrument panels are illustrative and have no live connections.'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Casa de CompAII.blend'),compress=True)

for name, view in views.items():
    scene.camera=view
    scene.render.filepath=str(OUT/(name+'.jpg'))
    bpy.ops.render.render(write_still=True)

# Batch render meshes per authored area after saving the editable object hierarchy.
export_objects = []
for layer in (architecture, beacon, sensorial, arrival):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in layer.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(layer.objects))
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = layer.name
    export_objects.append(joined)

for obj in export_objects:
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'compaii-house.glb'), export_format='GLB', use_selection=True)
