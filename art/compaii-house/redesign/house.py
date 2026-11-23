"""Build the clean-sheet Blender source and eye-height reviews for Casa de CompAII."""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

arguments = sys.argv[sys.argv.index('--') + 1:]
output = Path(arguments[0]).resolve()
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'


def group(name):
    item = bpy.data.collections.new(name)
    scene.collection.children.link(item)
    return item


garden = group('VIS · Garden court')
house = group('VIS · House')
lab = group('VIS · Beacon chamber')
gallery = group('VIS · Collection gallery')
anchors = group('ANCHOR · Entrances and work')
review = group('LIGHT GUIDE · Review cameras and light')


def material(name, tone, roughness, metal=0, grain=0, emission=0):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*tone, 1)
    result.use_nodes = True
    nodes, links = result.node_tree.nodes, result.node_tree.links
    shader = nodes.get('Principled BSDF')
    for key, value in {'Base Color': (*tone, 1), 'Roughness': roughness,
                       'Metallic': metal, 'Emission Color': (*tone, 1),
                       'Emission Strength': emission}.items():
        shader.inputs[key].default_value = value
    if grain:
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 25
        ramp = nodes.new('ShaderNodeValToRGB')
        for element, factor in zip(ramp.color_ramp.elements, (.70, 1.13)):
            element.color = (*(value * factor for value in tone), 1)
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .21
        bump.inputs['Distance'].default_value = grain
        links.new(noise.outputs['Fac'], ramp.inputs[0])
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(ramp.outputs[0], shader.inputs['Base Color'])
        links.new(bump.outputs[0], shader.inputs['Normal'])
    return result


stone = material('Honed honey limestone', (.52,.37,.23), .73, grain=.025)
plaster = material('Ivory limewash', (.65,.53,.38), .77, grain=.018)
basalt = material('Split basalt', (.075,.099,.088), .81, grain=.04)
copper = material('Weathered copper', (.044,.159,.135), .57, .42, .024)
oak = material('Dark oiled oak', (.23,.115,.058), .51, grain=.034)
brass = material('Satin brass', (.61,.355,.107), .31, .67)
iron = material('Blue gunmetal', (.042,.076,.087), .36, .52)
earth = material('Garden moss', (.085,.158,.049), .9, grain=.057)
leaf = material('Bay leaves', (.135,.226,.063), .82, grain=.028)
water = material('Shaded water', (.032,.118,.090), .145, .38)
amber = material('Honey lamp glass', (1,.511,.16), .3, emission=2.4)
linen = material('Ivory lettering', (.84,.72,.53), .75)


def own(obj, scope, name, finish):
    obj.name = name
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    scope.objects.link(obj)
    obj.data.materials.append(finish)
    return obj


def bevel(obj, width):
    if width:
        edge = obj.modifiers.new('Dressed edges', 'BEVEL')
        edge.width, edge.segments = width, 3
        obj.modifiers.new('Weighted face normals', 'WEIGHTED_NORMAL')
    return obj


def block(scope, name, at, size, finish, edge=.028):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return own(bevel(obj, edge), scope, name, finish)


def beam(scope, name, a, b, radius, finish, sides=12):
    vector = Vector(b) - Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius,
        depth=vector.length, location=(Vector(a)+Vector(b))*.5)
    obj = bpy.context.object
    obj.rotation_euler = vector.to_track_quat('Z','Y').to_euler()
    return own(obj, scope, name, finish)


def curve(scope, name, coordinates, depth, finish, cyclic=False, bevel_resolution=3):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions, data.bevel_depth, data.bevel_resolution = '3D', depth, bevel_resolution
    spline = data.splines.new('POLY')
    spline.points.add(len(coordinates)-1)
    for point, value in zip(spline.points, coordinates):
        point.co = (*value, 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    scope.objects.link(obj)
    data.materials.append(finish)
    return obj


def shell(scope, name, coordinates, faces, finish, thickness, edge):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(coordinates, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scope.objects.link(obj)
    mesh.materials.append(finish)
    obj.modifiers.new('Structural thickness','SOLIDIFY').thickness = thickness
    return bevel(obj, edge)


def text(scope, name, at, size):
    data = bpy.data.curves.new(name, 'FONT')
    data.body, data.size, data.align_x = name, size, 'CENTER'
    data.extrude = .001
    obj = bpy.data.objects.new(name, data)
    scope.objects.link(obj)
    obj.location, obj.rotation_euler.x = at, math.pi/2
    data.materials.append(linen)
    return obj


def light(name, kind, at, target, watts, color, size):
    data = bpy.data.lights.new(name, kind)
    data.energy, data.color = watts, color
    if kind == 'AREA':
        data.shape, data.size = 'DISK', size
    else:
        data.angle = math.radians(size)
    obj = bpy.data.objects.new(name, data)
    review.objects.link(obj)
    obj.location = at
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


def anchor(name, at):
    obj = bpy.data.objects.new(name, None)
    anchors.objects.link(obj)
    obj.location, obj.empty_display_size = at, .4


# The garden frames the house instead of competing with it.
block(garden,'Terraced garden base',(0,-5,-.47),(30,24,.84),basalt,.15)
block(garden,'Garden ground',(0,-5,-.075),(29.7,23.7,.16),earth,.05)
block(garden,'House approach',(0,-7,.073),(3.24,15,.15),stone,.045)
block(garden,'Crosswalk to the collection',(0,-4.2,.071),(18,2.3,.13),stone,.045)
block(garden,'Pool margin',(4.85,-8.3,.115),(4.0,5.8,.28),basalt,.09)
block(garden,'Water line',(4.85,-8.3,.267),(3.74,5.54,.02),water,0)
for step in range(11):
    block(garden,'Scored approach stone',(0,-13+step*.96,.15),(3.20,.031,.012),basalt,.005)
for x,y in [(-5.6,-9.1),(-7.3,-5.5),(10.3,-6.2),(10.5,-12.1),(-6.8,-.7),(7.25,2.8)]:
    block(garden,'Basalt planter',(x,y,.105),(2.24,2.16,.22),basalt,.066)
    block(garden,'Planted soil',(x,y,.224),(2.05,1.98,.055),earth,.04)
    beam(garden,'Bay trunk',(x,y,.22),(x+.13,y,2.7),.116,oak)
    for dx,dy,z in [(-.42,.16,2.52),(.43,.22,3.06),(.05,-.35,3.36)]:
        beam(garden,'Bay bough',(x+.06,y,1.49),(x+dx,y+dy,z),.055,oak)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, location=(x+dx,y+dy,z))
        crown = own(bpy.context.object,garden,'Bay canopy',leaf)
        crown.scale = (.91,.72,.54)
        for poly in crown.data.polygons:
            poly.use_smooth = True
for x,y in [(-1.86,-10),(1.87,-6.3),(-1.98,-2.88)]:
    block(garden,'Recessed path lamp',(x,y,.29),(.24,.24,.58),basalt,.035)
    block(garden,'Lamp slit',(x,y-.127,.45),(.1,.025,.105),amber,.01)
for x in [-5.0,8.0]:
    for leg in [-.75,.75]:
        block(garden,'Bench footing',(x+leg,-8.2,.23),(.15,.5,.46),basalt,.035)
    block(garden,'Oak garden seat',(x,-8.2,.49),(1.95,.56,.1),oak,.045)

# Broken-gable section shared by the full exterior and tabletop miniature.
profile = [(-4.75,3.05),(-3.05,4.05),(-1.55,4.05),(0,6.4),(1.9,5.52),(4.75,3.43)]


def roof(scope, name, origin, scale):
    x,y,z = origin
    points = [(x+u*scale,y+depth*scale,z+v*scale)
              for depth in [-.42,8.6] for u,v in profile]
    shell(scope,name,points,[(i,i+1,i+7,i+6) for i in range(5)],
          copper,.19*scale,.045*scale)
    for px,pz in profile:
        curve(scope,'Fold joint',[(x+px*scale,y-.45*scale,z+pz*scale),
              (x+px*scale,y+8.63*scale,z+pz*scale)],.038*scale,brass)


def arch(scope, center, span, spring, depth, finish):
    x,y,z = center
    points = [(x+math.cos(i*math.pi/24)*r,y,z+spring+math.sin(i*math.pi/24)*r)
              for r in [span,span+.18] for i in range(25)]
    shell(scope,'Arched portal band',points,[(i,i+1,i+26,i+25) for i in range(24)],
          finish,depth,.017)
    for side in [-1,1]:
        block(scope,'Portal pier',(x+side*(span+.08),y,z+spring*.5),
              (.18,depth,spring),finish,.017)


def arch_infill(scope, center, span, spring, top, finish):
    x,y,z = center
    points = [(x+math.cos(i*math.pi/24)*span,y,z+spring+math.sin(i*math.pi/24)*span)
              for i in range(25)]
    points.extend([(x-span,y,top),(x+span,y,top)])
    shell(scope,'Carved wall over portal',points,[tuple(range(len(points)))],finish,.29,.017)


block(house,'Stone plinth',(0,4.15,.175),(9.56,9.0,.35),basalt,.065)
block(house,'Warm entrance floor',(0,2.2,.385),(3.15,5.25,.1),oak)
for x in [-3.16,3.16]:
    block(house,'Mineral wall cheek',(x,0,1.74),(2.82,.44,2.96),plaster,.05)
for x in [-4.55,4.55]:
    block(house,'Stone wing wall',(x,4.17,1.86),(.36,8.10,3.1),plaster)
block(house,'North wall',(0,8.23,1.91),(9.15,.34,3.1),stone)
block(house,'Oak portal header',(0,0,3.52),(9.27,.47,.58),oak,.05)
roof(house,'Folded copper roof',(0,0,.34),1)
for y in [.02,8.21]:
    shell(house,'Panelled upper gable',
          [(x,y,z+.31) for x,z in profile]+[(4.65,y,3.31),(-4.61,y,3.31)],
          [tuple(range(len(profile)+2))],oak,.17,.034)
for x,z in [(-1.18,4.32),(-.86,4.49),(-.54,4.69),(-.22,4.88),
            (.10,5.00),(.42,4.96),(.74,4.88),(1.06,4.77),(1.38,4.65)]:
    block(house,'Clerestory smoked glass',(x,-.198,(z+3.82)*.5),
          (.165,.06,z-3.82),iron,.014)
arch(house,(0,-.29,.42),1.29,1.41,.28,brass)
arch_infill(house,(0,-.13,.42),1.385,1.41,3.34,plaster)
for x in [-1.59,1.59]:
    block(house,'Carved portal shoulder',(x,-.12,1.69),(.35,.42,3.30),plaster,.035)
text(house,'CASA DE COMPAII',(0,-.248,3.48),.198)
for i in range(6):
    x = -3.89+i*.43
    block(house,'Vertical recessed window',(x,-.227,2.19),(.14,.018,1.4),iron,.006)
    block(house,'Amber window sill',(x,-.239,1.57),(.109,.012,.15),amber,.005)
    block(house,'Right wing stone rib',(2.64+i*.25,-.24,2.09),(.11,.078,1.49),stone,.012)
for i in range(4):
    block(house,'Entrance step',(0,-1.04+i*.26,.055+i*.048),(2.91,.29,.11+i*.096),stone,.017)
block(house,'Hall table',(0,4.0,.94),(1.4,1.65,.12),oak,.044)
for x in [-.55,.55]:
    for y in [3.38,4.62]:
        block(house,'Hall table leg',(x,y,.68),(.10,.10,.47),oak)
for x in [-2.35,2.35]:
    block(house,'Stone vestibule pier',(x,5.56,1.54),(.37,.5,2.40),stone,.045)
    block(house,'Vestibule lamp mask',(x,5.30,2.11),(.26,.11,.39),iron,.039)
    block(house,'Vestibule practical',(x,5.239,2.11),(.12,.014,.25),amber,.014)
    light('Vestibule bounce '+str(x),'AREA',(x,5.05,2.18),(0,4.40,.44),92,(1,.67,.34),.33)
anchor('entry.public',(0,-1.61,.151))
anchor('entry.hall',(0,1.65,.435))
light('Warm entrance lamp','AREA',(0,1.7,2.91),(0,-.4,.45),320,(1,.72,.40),1.25)

block(garden,'Miniature display plinth',(-3.85,-4.16,.46),(1.67,1.45,.92),basalt,.1)
block(garden,'Miniature display base',(-3.85,-4.16,.95),(1.52,1.27,.08),oak,.05)
block(garden,'Miniature stone mass',(-3.85,-4.12,1.205),(1.02,.88,.42),plaster,.018)
roof(garden,'Miniature roof',(-3.85,-4.58,1.003),.114)
block(garden,'Miniature entrance',(-3.85,-4.57,1.16),(.27,.026,.32),iron,.005)
anchor('model.inspect',(-3.85,-5.28,.12))

# Cells remain visually separate in the working file. Their stable entrance and
# tool anchors are preserved when the existing renderer registers each cell.
def underground(x,y,z):
    return (-25+x,y,z)


def collection_at(x,y,z):
    return (25+x,y,z)


block(lab,'Solid basalt chamber floor',underground(0,9.4,-.19),(13.3,15.2,.38),basalt,.055)
block(lab,'Rear limestone wall',underground(0,16.6,2.70),(13.3,.4,5.40),stone)
block(lab,'Rear oak panelling',underground(0,16.35,1.3),(12.75,.19,2.6),oak,.035)
for x in [-6.55,6.55]:
    block(lab,'Stone chamber side',underground(x,9.3,2.68),(.33,15.0,5.36),plaster)
for x in [-4.12,4.12]:
    block(lab,'Stone wall at stair',underground(x,1.89,2.3),(4.75,.35,4.6),stone)
block(lab,'Acoustic roof lining',underground(0,9.33,5.32),(13.4,15.0,.18),oak)
for y in [3.7,6.7,9.7,12.7,15.7]:
    cross_section=[(-6.2,.06),(-6.2,2.85),(-4.55,4.25),(-2.35,5.15),
                   (.50,5.15),(3.72,4.69),(6.2,3.1),(6.2,.06)]
    profile_positions=[underground(x,y,z) for x,z in cross_section]
    for a,b in zip(profile_positions,profile_positions[1:]):
        beam(lab,'Smoked oak vault rib',a,b,.158,oak,8)
    for x in [-6.18,6.18]:
        block(lab,'Rib brass mounting shoe',underground(x,y,.186),(.4,.41,.375),brass,.037)
for x in [-5.75,-5.38,-5.01,-4.64,-4.27,-3.90,3.60,3.97,4.34,4.71,5.08,5.45]:
    block(lab,'Standing acoustic fin',underground(x,16.13,2.29),(.10,.25,4.05),copper,.018)
for i in range(12):
    block(lab,'Stone inlay seam',underground(0,2.7+i*1.12,.005),(12.32,.024,.010),stone,.004)
block(lab,'Workshop nameplate',underground(0,16.16,3.1),(4.21,.15,.61),iron,.055)
text(lab,'HARMONIC BEACON',underground(0,16.08,2.99),.31)

for i in range(5):
    y=2.2+i*.40
    top=.16*(5-i)
    block(lab,'Descending stair tread',underground(.1,y,top*.5),(2.45,.41,top),stone,.025)
for x in [-1.2,1.4]:
    beam(lab,'Stair rail',underground(x,1.92,1.85),underground(x,4.1,1.09),.037,brass)
    for y,z in [(1.95,1.81),(3.04,1.43),(4.10,1.10)]:
        beam(lab,'Stair rail post',underground(x,y,z-.94),underground(x,y,z),.028,iron)
anchor('lab.stair_top',underground(.1,1.94,.8))
anchor('lab.stair_landing',underground(.1,4.3,.02))

# One hero instrument with two secondary, offset stations.
cx,cy,cz=.5,11.87,2.12
beam(lab,'Instrument basalt foot',underground(cx,cy,.03),underground(cx,cy,.41),1.84,iron,48)
beam(lab,'Thin brass rim',underground(cx,cy,.41),underground(cx,cy,.46),1.75,brass,48)
block(lab,'Prototype plaque foot',underground(cx,cy-1.55,.47),(1.01,.29,.18),brass,.026)
block(lab,'Prototype enamel plaque',underground(cx,cy-1.69,.61),(1.26,.071,.25),iron,.023)
prototype_lettering = text(lab,'BANCO DE PROTOTIPOS',underground(cx,cy-1.727,.563),.105)
prototype_lettering.data.resolution_u = 3
for angle in [0,math.tau/3,math.tau*2/3]:
    base=underground(cx+1.54*math.cos(angle),cy+1.54*math.sin(angle),.45)
    beam(lab,'Resonator tension strut',base,underground(cx,cy,cz),.067,brass)
for angle,radius,finish in [(.16,1.48,brass),(1.14,1.34,copper),(2.28,1.20,brass)]:
    points=[underground(cx+math.cos(i*math.tau/64)*radius*math.cos(angle),
            cy+math.cos(i*math.tau/64)*radius*math.sin(angle),
            cz+math.sin(i*math.tau/64)*radius) for i in range(64)]
    curve(lab,'Tensioned instrument ring',points,.067,finish,True)
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=.305,location=underground(cx,cy,cz))
own(bpy.context.object,lab,'Glowing resonator core',amber)
beam(lab,'Instrument light suspension',underground(cx,cy,5.32),
     underground(cx,cy,4.64),.035,iron)
beam(lab,'Instrument light shaded ring',underground(cx,cy,4.64),
     underground(cx,cy,4.49),.68,iron,48)
beam(lab,'Instrument light lens',underground(cx,cy,4.50),
     underground(cx,cy,4.475),.59,amber,48)
anchor('prototype.inspect',underground(cx,cy-1.71,0))

def listening_console(x, y):
    def at(dx, dy, z):
        return underground(x+dx,y+dy,z)

    block(lab,'Spatial monitoring console',at(0,.046,1.145),(1.35,.69,.15),iron,.035)
    block(lab,'Spatial positioning inset',at(-.17,.083,1.224),(.91,.52,.024),basalt,.018)
    for radius in (.092,.171,.239):
        curve(lab,'Etched listening field',
              [at(-.17+radius*math.cos(angle),.083+radius*math.sin(angle),1.238)
               for angle in (n*math.tau/32 for n in range(32))],
              .0042,brass,cyclic=True,bevel_resolution=1)
    for dx,dy in [(-.17,-.18),(-.32,.17),(.015,.136)]:
        beam(lab,'Movable brass source marker',at(dx,dy,1.229),at(dx,dy,1.277),.028,brass,16)
    for dy in (-.141,.026,.193):
        beam(lab,'Monitor trim dial',at(.449,dy,1.22),at(.449,dy,1.279),.048,brass,16)
        block(lab,'Monitor trim index',at(.449,dy-.016,1.28),(.008,.020,.003),basalt,.001)
    for side in (-1,1):
        dx=side*1.016
        block(lab,'Nearfield speaker cabinet',at(dx,.215,1.29),(.35,.26,.405),oak,.027)
        block(lab,'Speaker face',at(dx,.080,1.288),(.292,.024,.355),iron,.017)
        for z,radius in [(1.227,.087),(1.394,.048)]:
            beam(lab,'Speaker rim',at(dx,.079,z),at(dx,.056,z),radius,brass,24)
            beam(lab,'Speaker cone',at(dx,.056,z),at(dx,.049,z),radius*.84,basalt,24)


def movement_console(x, y):
    def at(dx, dy, z):
        return underground(x+dx,y+dy,z)

    block(lab,'Weaver instrument foot',at(0,.095,1.133),(1.87,.70,.11),iron,.036)
    block(lab,'Upright motion routing panel',at(0,.266,1.439),(1.77,.208,.561),oak,.037)
    block(lab,'Recessed patch bay',at(0,.152,1.46),(1.58,.035,.451),iron,.021)
    for col in (-.60,-.40,-.20,0,.20,.40,.60):
        for z in (1.345,1.463,1.581):
            beam(lab,'Recessed motion jack bezel',at(col,.135,z),at(col,.116,z),.032,brass,12)
            beam(lab,'Motion jack socket',at(col,.115,z),at(col,.108,z),.017,basalt,12)
    for left,right,top in [(-.60,-.40,1.659),(-.20,.20,1.691),(.40,.60,1.659)]:
        curve(lab,'Patched movement route',
              [at(left+(right-left)*step/16,.094-.043*math.sin(math.pi*step/16),
                  1.581+(top-1.581)*math.sin(math.pi*step/16))
               for step in range(17)],.012,copper,bevel_resolution=1)
    for dx in (-.62,-.31,0,.31,.62):
        block(lab,'Recessed gesture key well',at(dx,-.209,1.189),(.223,.193,.019),basalt,.010)
        block(lab,'Gesture key',at(dx,-.205,1.207),(.160,.128,.029),brass,.014)


for name,x,y,width in [('Spatializer',-4.32,8.37,2.65),('Weaver',4.27,12.85,2.35)]:
    block(lab,name+' bench top',underground(x,y,1.02),(width,1.15,.13),oak,.07)
    for dx in [-(width*.40),width*.40]:
        block(lab,'Bench stone end',underground(x+dx,y,.51),(.17,.86,.94),basalt,.045)
    block(lab,'Brass bench nameplate',underground(x,y-.585,.86),(1.55,.068,.24),iron,.022)
    text(lab,name,underground(x,y-.62,.812),.157)
    (listening_console if name=='Spatializer' else movement_console)(x,y)
    beam(lab,'Pendant cable',underground(x,y,5.21),underground(x,y,2.83),.02,iron)
    beam(lab,'Spun brass pendant',underground(x,y,2.83),underground(x,y,2.69),.30,brass,28)
    beam(lab,'Warm lamp lens',underground(x,y,2.70),underground(x,y,2.668),.25,amber,28)
    light(name+' practical','AREA',underground(x,y,2.62),underground(x,y,1.02),165,(1,.70,.36),.50)
    anchor('tools.'+name.lower(),underground(x,y-1,.02))

# A quieter gallery with a long side light and wide circulation.
block(gallery,'Limestone gallery floor',collection_at(0,7,-.12),(10.9,14,.24),stone,.045)
block(gallery,'Gallery limewash wall',collection_at(-5.26,7,1.95),(.28,14,3.9),plaster,.041)
block(gallery,'Gallery end wall',collection_at(0,13.9,1.95),(10.7,.26,3.9),plaster,.045)
shell(gallery,'Lined gallery roof',
      [collection_at(x,y,z) for x,y,z in [
          (-5.40,0,3.91),(2.7,0,4.60),(2.7,14,4.60),(-5.40,14,3.91)]],
      [(0,1,2,3)],oak,.18,.045)
shell(gallery,'Copper window canopy',
      [collection_at(x,y,z) for x,y,z in [
          (3.6,0,4.95),(5.6,0,3.72),(5.6,14,3.72),(3.6,14,4.95)]],
      [(0,1,2,3)],copper,.15,.043)
for y in [2.0,5.8,9.6,13.6]:
    block(gallery,'Gallery roof rail',collection_at(0,y,3.85),(10.65,.23,.28),oak,.035)
    block(gallery,'Copper window mullion',collection_at(5.20,y,1.88),(.24,.28,3.76),copper,.035)
for name,x,y,height in [('Drafts',-3.1,3.6,.92),('Published',.7,7.72,.72),('Archive',-3.1,11.42,1.22)]:
    block(gallery,name+' stone base',collection_at(x,y,height*.5),(2.56,1.58,height),basalt,.075)
    block(gallery,name+' oak top',collection_at(x,y,height+.04),(2.64,1.66,.095),oak,.038)
    anchor('collection.'+name.lower(),collection_at(x,y,height+.088))
anchor('gallery.entry',collection_at(.2,1.50,.025))
text(gallery,'COLECCIÓN',collection_at(0,13.74,2.45),.42)

# Authored motivated lights, kept apart from visible GLB geometry.
world=bpy.data.worlds.new('Garden atmosphere')
world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.37,.57,.73,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.29
scene.world=world
light('Low afternoon sun','SUN',(-8,-14,14),(0,1,1),2.08,(1,.80,.57),11)
light('Commons sky bounce','AREA',(4,-4,8),(0,1,2),480,(.66,.81,1),8)
light('Instrument key','AREA',underground(cx,cy,4.42),underground(cx,cy,1.13),650,(1,.67,.33),1.16)
light('Cool stair bounce','AREA',underground(-.4,3.03,4.4),underground(.1,4.35,.2),350,(.46,.67,1),2.4)
light('Soft chamber bounce','AREA',underground(4.0,13.8,4.60),underground(.7,10.6,1.14),150,(.63,.76,.92),3.6)
light('Long gallery daylight','AREA',collection_at(4.55,7.6,3.6),collection_at(-2.2,7.7,1.3),770,(.76,.86,1),6.0)


def camera(name, at, target, lens):
    data=bpy.data.cameras.new(name)
    data.lens=lens
    obj=bpy.data.objects.new(name,data)
    review.objects.link(obj)
    obj.location=at
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj


views={
    'garden':camera('Garden eye level',(6.42,-14.05,1.78),(0,-.50,2.67),28),
    'threshold':camera('Threshold eye level',(2.7,-7.6,1.78),(0,1.06,2.47),30),
    'beacon':camera('Chamber reveal from the lower landing',underground(1.65,3.62,2.01),
                    underground(.12,11.2,2.43),25),
    'gallery':camera('Gallery at arrival',collection_at(2.6,1.4,1.74),
                     collection_at(-.8,9.8,1.5),29),
}
scene.render.engine='CYCLES'
scene.cycles.samples=20
scene.cycles.use_denoising=True
scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage=1000,640,100
scene.render.image_settings.file_format='JPEG'
scene.render.image_settings.quality=90
scene.view_settings.view_transform='AgX'
def select_review(name):
    selected = {'garden': [garden,house], 'threshold': [garden,house],
                'beacon': [lab], 'gallery': [gallery]}[name]
    for scope in [garden,house,lab,gallery]:
        scope.hide_render = scope not in selected
    # Keeping exterior lights out of the interior is part of the room design.
    for lamp in (obj for obj in review.objects if obj.type == 'LIGHT'):
        lamp.hide_render = (
            name == 'beacon' and lamp.name in {'Low afternoon sun','Commons sky bounce','Warm entrance lamp','Long gallery daylight'}
            or name in {'garden','threshold'} and lamp.name not in {'Low afternoon sun','Commons sky bounce','Warm entrance lamp'}
                and not lamp.name.startswith('Vestibule bounce')
            or name == 'gallery' and lamp.name not in {'Low afternoon sun','Long gallery daylight'}
        )
    scene.camera=views[name]


select_review('garden')
scene.render.filepath='//garden.jpg'
bpy.ops.wm.save_as_mainfile(filepath=str(output/'casa-compaii-redesign.blend'),compress=True)
review_names=arguments[1:] or ['garden','beacon']
for name in ([] if review_names==['--scene-only'] else review_names):
    select_review(name)
    scene.render.filepath=str(output/(name+'.jpg'))
    bpy.ops.render.render(write_still=True)
(output/'scene.json').write_text(json.dumps({'objects':len(bpy.data.objects),
    'materials':len(bpy.data.materials),'cameras':list(views)},indent=2)+'\n')
