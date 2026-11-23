"""An authored, traversable architectural level study for Casa de CompAII."""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
out = Path(args[0]).resolve()
requested_views = args[1:]
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'


def layer(name):
    col = bpy.data.collections.new(name)
    scene.collection.children.link(col)
    return col


structure = layer('01 • Structure')
forum = layer('02 • Forum')
beacon = layer('03 • Beacon pit')
sensor = layer('04 • Sensorial lookout')
anchors = layer('05 • Authored work anchors')
studio = layer('06 • Review')
nav = layer('07 • Floors and stairs')
group = structure


def mat(name, color, rough=.45, metal=0, glow=0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    principled = material.node_tree.nodes.get('Principled BSDF')
    for name, value in {
        'Base Color': (*color, 1), 'Roughness': rough, 'Metallic': metal,
        'Emission Color': (*color, 1), 'Emission Strength': glow,
    }.items():
        principled.inputs[name].default_value = value
    return material


ash = mat('Pale aggregate', (.46,.40,.32), .8)
bone = mat('Porous chalk', (.69,.56,.40), .74)
bed = mat('Obsidian aggregate', (.055,.070,.073), .88)
green = mat('Oxidized copper', (.046,.22,.189), .51, .30)
wine = mat('Glazed oxblood', (.32,.078,.052), .28)
brass = mat('Brass', (.53,.29,.091), .29, .65)
gun = mat('Blue-black gunmetal', (.032,.052,.056), .35, .50)
oak = mat('Oiled smoked oak', (.27,.12,.050), .56)
soft = mat('Ivory graphics', (.88,.72,.48), glow=.28)
amber = mat('Fired amber', (1,.38,.081), glow=3.0)
opal = mat('Opal blue', (.14,.72,.86), glow=1.9)
slate = mat('Slate display', (.020,.075,.102), .68)
moss = mat('Garden moss', (.071,.135,.067), .89)
leaf = mat('Olive leaves', (.19,.25,.098), .8)
water = mat('Reflecting pool', (.027,.119,.127), .19, .37)
plaster = mat('Chalk limewash', (.57,.47,.33), .78)
for finish, tone in ((ash,(.48,.40,.31)),(bone,(.69,.56,.40)),(bed,(.085,.103,.101)),(plaster,(.57,.47,.33))):
    nodes=finish.node_tree.nodes
    links=finish.node_tree.links
    noise=nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value=47
    noise.inputs['Detail'].default_value=3
    ramp=nodes.new('ShaderNodeValToRGB')
    for knot,scale in zip(ramp.color_ramp.elements,(.77,1.13)):
        knot.color=(*(v*scale for v in tone),1)
    bump=nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value=.19
    bump.inputs['Distance'].default_value=.045
    links.new(noise.outputs['Fac'],ramp.inputs[0])
    links.new(noise.outputs['Fac'],bump.inputs['Height'])
    links.new(ramp.outputs[0],nodes['Principled BSDF'].inputs['Base Color'])
    links.new(bump.outputs[0],nodes['Principled BSDF'].inputs['Normal'])


def own(obj, name, material=None, collection=None):
    obj.name = name
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    (collection or group).objects.link(obj)
    if material:
        obj.data.materials.append(material)
    return obj


def softened(obj, width):
    if width:
        bevel = obj.modifiers.new('Soft edges', 'BEVEL')
        bevel.width = width
        bevel.segments = 2
    return obj


def box(name, at, dimensions, material, edge=.035, yaw=0, collection=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    obj = own(bpy.context.object, name, material, collection)
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler.z = yaw
    return softened(obj, edge)


def disk(name, at, radius, depth, material, vertices=48, axis=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=at)
    obj=own(bpy.context.object,name,material)
    if axis:
        obj.rotation_euler = Vector(axis).to_track_quat('Z','Y').to_euler()
    return softened(obj,min(depth*.18,.03))


def strut(name, start, end, width, height, material, edge=.025):
    start,end=Vector(start),Vector(end)
    obj=box(name,(start+end)*.5,(width,height,(end-start).length),material,edge)
    obj.rotation_euler=(end-start).to_track_quat('Z','Y').to_euler()
    return obj


def arc(name, coords, material, radius=.025):
    data=bpy.data.curves.new(name,'CURVE')
    data.dimensions='3D'
    data.bevel_depth=radius
    data.bevel_resolution=2
    spline=data.splines.new('POLY')
    spline.points.add(len(coords)-1)
    for point, co in zip(spline.points,coords):
        point.co=(*co,1)
    return own(bpy.data.objects.new(name,data),name,material)


def halo(name, center, radius, material, width=.045, elevation=0):
    x,y,z=center
    return arc(name,[(x+radius*math.cos(t*math.tau/64),
        y+elevation*math.sin(t*math.tau/64),z+radius*math.sin(t*math.tau/64))
        for t in range(65)],material,width)


def text(name, at, size, material=soft, angle=0):
    curve=bpy.data.curves.new(name,'FONT')
    curve.body=name
    curve.align_x='CENTER'
    curve.size=size
    curve.extrude=.001
    obj=own(bpy.data.objects.new(name,curve),name,material)
    obj.location=at
    obj.rotation_euler=(math.pi/2,0,angle)
    return obj


def deck(name,x1,x2,y1,y2,z,material):
    return box(name,((x1+x2)/2,(y1+y2)/2,z-.13),(x2-x1,y2-y1,.26),
               material,0,collection=nav)


def stairs(name, start, end, width, count, material):
    x1,y1,z1=start
    x2,y2,z2=end
    if x1!=x2 and y1!=y2:
        raise ValueError('Choose an orthogonal stair axis')
    for i in range(count):
        a,b=i/count,(i+1)/count
        cx=(x1+(x2-x1)*(a+b)/2)
        cy=(y1+(y2-y1)*(a+b)/2)
        step_z=z1+(z2-z1)*b
        depth=abs(x2-x1)/count if x2!=x1 else abs(y2-y1)/count
        sx,sy=(depth,width) if x2!=x1 else (width,depth)
        box(name+f' {i+1:02d}',(cx,cy,step_z-.105),(sx,sy,.21),
            material,.009,collection=nav)
        if i%3==0:
            box('Inset tread light',(cx,cy,step_z+.004),(sx*.63,sy*.63,.008),
                amber if z2<0 else opal,.003)


def rail(name, a, b, color=gun):
    a,b=Vector(a),Vector(b)
    strut(name,a,b,.075,.075,color)
    span=max(1,math.ceil((b-a).length/1.3))
    for i in range(span+1):
        p=a.lerp(b,i/span)
        strut('Railing upright',(p.x,p.y,p.z-.91),p,.044,.044,color,.009)


# Lower entry, main forum, Beacon pit, high bridge and two independent returns.
deck('Entry terrace',-3.05,3.4,-11.8,-6.6,0,ash)
deck('Garden approach',-3.05,3.4,-19.5,-11.8,0,ash)
deck('Garden west terrace',-11.1,-3.05,-18.9,-11.8,0,moss)
deck('Garden east terrace',3.4,11.3,-18.9,-11.8,0,moss)
deck('Forum floor',-5,5,-6.6,5.15,0,bed)
deck('Beacon basin',-13.2,-7.95,-4.5,6.65,-1.55,bed)
stairs('Beacon descent',(-5,-1.75,0),(-7.95,-1.75,-1.55),2.65,10,ash)
deck('Overlook gallery',-.05,7.9,9.6,12.15,2.1,ash)
stairs('Forum north ascent',(1.4,5.15,0),(1.4,9.6,2.1),2.75,13,ash)
deck('Sensorial cantilever',7.9,14.3,-4.43,12.15,2.1,slate)
deck('Upper return landing',5.01,7.90,-4.43,-1.78,2.1,ash)
box('Stone retaining foundation',(0,-.9,-3.26),(30,34.6,2.64),bed,.48)
box('Atrium retaining base', (0,-.65,-1.02),(9.95,11.90,1.77),plaster,.055)
box('Lab retaining base',(-10.6,1.04,-1.81),(5.28,11.0,.38),bed,.065)
box('Observatory lower masonry',(11.12,3.89,.66),(6.27,16.50,2.69),plaster,.11)

# Cliff cut, low entry compression and articulated perimeter.
box('Hewn western retaining wall',(-13.48,1.2,.4),(.65,12.8,5.2),bed,.14)
box('North retained spine',(-9.86,6.95,.2),(6.58,.64,4.9),bed,.11)
box('South Beacon shear wall',(-9.83,-4.7,.6),(6.45,.49,4.1),wine,.12)
box('Cliff supporting eastern station',(13.97,3.8,.53),(.62,13.9,2.85),bed,.11)
box('Dogleg west',(0.12,-9.43,1.06),(.31,3.2,2.12),wine,.08)
box('Dogleg lintel',(.15,-9.82,2.42),(6.18,3.7,.43),ash,.095)
box('Low wall facing arrival',(-1.3,-7.30,1.34),(3.54,.38,2.69),ash,.075)
box('Brass slot in the dogleg',(1.40,-9.9,2.18),(.052,2.85,.036),amber,.007)
for y in (-11.17,-10.58,-9.99,-9.4,-8.81,-8.22,-7.63):
    box('Brass approach marker',(1.40,y,.004),(.052,.38,.008),brass,.005)
box('Entrance herald',(1.48,-11.46,2.46),(2.78,.18,.56),gun,.055)
text('CASA DE COMPAII',(1.48,-11.558,2.40),.181)

group=forum
# An off-axis skylight, transverse ribs and a layered center.
for x,y,h in ((-4.6,-5.6,5.9),(4.55,-5.2,6.85),(-4.52,2.77,6.18),(4.55,4.7,7.22)):
    box('Forum spine',(x,y,h/2),(.43,.47,h),bone,.095)
    box('Inlaid vertical strip',(x,y-.25,h*.64),(.061,.027,h*.49),amber,.006)
for offset in (-1.1,1.25,3.5):
    strut('Skylight rafter',(-5,offset,6.2),(5.1,offset+.9,7.65),.34,.42,bone,.035)
for a,b in (((-4.7,-5.8,5.85),(-4.7,5.6,6.62)),((4.63,-5.8,6.75),(4.63,5.5,7.5))):
    strut('Forum side truss',a,b,.37,.38,ash)
for y in (-5.9,-4.62,3.45,4.62):
    box('Ceremonial floor inlay',(0,y,.009),(8.4,.035,.018),brass,.005)
rail('Forum west ledge',(-4.96,-5.95,.97),(-4.96,-3.16,.97))
rail('Forum west overlook',(-4.96,-.29,.97),(-4.96,4.9,.97))
rail('Bridge inner rail',(2.82,9.64,3.05),(7.85,9.64,3.05))
rail('Bridge north rail',(-.05,12.08,3.05),(7.85,12.08,3.05))
rail('East high landing', (5.08,-4.4,3.05),(5.08,-1.8,3.05))
table=disk('Common worktable',(.0,1.68,.81),1.55,.245,oak,8)
table.rotation_euler.z=math.pi/8
disk('Table foundation',(0,1.68,.40),.56,.74,gun,8)
disk('Brass work surface inset',(0,1.68,.936),1.02,.009,brass,8)
for x,y in ((-2.1,1.65),(2.12,1.45),(0,3.6)):
    box('Upholstered seat',(x,y,.49),(.91,.65,.19),green,.14)
    box('Seat plinth',(x,y,.20),(.57,.42,.39),ash,.07)
for i,theta in enumerate((.37,2.4,4.44)):
    x,y=1.42*math.cos(theta),1.68+1.42*math.sin(theta)
    box('Shared work tablet',(x,y,.958),(.37,.23,.043),gun,.034,yaw=theta)
    box('Shared work tablet inset',(x,y,.982),(.29,.16,.007),opal,.018,yaw=theta)
for i in range(4):
    z=4.92+i*.36
    center=(.12,1.08,z)
    arc('Atrium signature chandelier',[(center[0]+(1.38-i*.24)*math.cos(t*math.tau/64),
        center[1]+(1.38-i*.24)*math.sin(t*math.tau/64),center[2]+.17*math.sin(t*math.tau/64))
        for t in range(65)], amber if i%2==0 else brass,.035)
for x in (-1.03,1.03):
    strut('Suspension cable',(x,1.1,5),(x,1.72,7.19),.021,.021,gun,.002)
box('Stone pier for arrival plaque',(4.7,-3.1,1.41),(.45,.46,2.82),bone,.07)
box('Recessed arrival plaque',(4.70,-3.35,1.74),(.37,.047,.55),green,.03)
text('ATRIO',(4.70,-3.377,1.72),.09)

# Coherent old masonry and a newer copper observatory wing.
for x in (-3.95,-1.20,1.70,4.55,7.45):
    box('Gallery wall bay',(x,12.31,3.81),(.37,.42,5.30),plaster,.063)
box('North gallery base',(2.97,12.30,1.09),(11.6,.44,2.27),ash,.08)
box('North gallery entablature',(2.70,12.30,6.08),(12.2,.57,.62),bone,.08)
for x in (-1.5,1.42,4.35):
    box('Bronze louver backing',(x,12.33,4.01),(2.40,.14,2.70),gun,.035)
    for i in range(7):
        box('Vertical louver',(x-1.02+i*.34,12.20,4.01),(.095,.22,2.68),oak,.015)
for x in (-3.64,3.78):
    box('Skylight stone perimeter',(x,.35,6.56),(.67,10.4,.65),bone,.075)
for x in (-2.9,2.91):
    for y in (-4.7,-2.22,2.67,5.15):
        box('Skylight bronze trim',(x,y,6.85),(.28,1.88,.09),brass,.02)
box('Cantilever foundation cap',(11.05,-4.40,2),(6.5,.28,.4),green,.04)
rail('South observatory terrace',(8.03,-4.35,3.05),(14.07,-4.35,3.05))
rail('Atrium side boundary',(4.92,-6.54,.99),(4.92,5.03,.99))
strut('Perch soffit beam',(8.02,-3.84,5.82),(14.10,-3.50,6.32),.23,.30,green)
box('Seasonal studio wing seam',(-12.80,-4.95,.03),(1.07,.35,2.58),plaster,.04)
# Close the structural envelope behind the gallery. Recesses read as
# framed windows and the west wing meets the same foundation.
box('Back masonry spine',(-1.03,12.55,2.46),(26.10,.70,7.45),plaster,.14)
box('Continuous garden-facing coping',(-1.03,12.18,6.22),(26.18,.80,.37),ash,.06)
box('North side return',(-13.45,9.60,.63),(.64,6.33,5.21),plaster,.12)
box('West raised wing backing',(-8.88,9.34,-.23),(8.20,4.54,3.39),bed,.13)
for x in (-7.91,-5.23):
    box('Window framing pier',(x,12.01,2.98),(.23,.42,5.61),bone,.043)
for x in (5.45,13.66):
    box('Observatory corner stone',(x,12.37,3.91),(.58,.57,4.18),bone,.10)
for i,y in enumerate((-4.8,-2.98,3.65,5.44)):
    box('Atrium narrow copper roof panel',(-3.81,y,6.70),(1.88,1.63,.16),green,.047,yaw=.013*(-1)**i)
    box('Atrium narrow copper roof panel',(3.85,y,7.10),(1.68,1.65,.16),green,.045,yaw=.013*(-1)**i)
box('Gathering side enclosure',(4.98,2.6,-.68),(.42,5.1,1.39),bed,.063)


group=beacon
# Warm, tactile work pit with a dominant instrument silhouette.
for i in range(16):
    x=-12.95+i*.318
    box('Tuned terracotta baffle',(x,6.35,.49),(.164+.065*(i%3),.30,3.55-.12*(i%4)),wine,.04)
for y in (-3.6,-2.26,-.92,.42,1.76,3.1,4.44):
    box('Acoustic side fin',(-13.07,y,.35),(.22,.36,3.41),oak,.068,yaw=.17)
for offset,h in ((0,1.60),(.57,1.10),(1.13,.61)):
    disk('Prototype stepped plinth',(-10.25,3.28,-1.5+offset/3),h,.27,gun,40)
prototype=(-10.25,3.28,.30)
for radius,color,tilt in ((1.55,brass,.94),(1.43,amber,0),(.99,gun,.53),(.66,amber,-.4)):
    halo('Listening instrument rings',prototype,radius,color,.048,tilt)
disk('Resonator core',prototype,.32,.28,gun,48,(0,1,0))
disk('Resonator lit center',(-10.25,3.10,.30),.184,.04,amber,40,(0,1,0))
for dx in (-.48,.48):
    strut('Prototype bronze mount',(-10.25+dx,3.28,-1.23),(-10.25+dx*.55,3.28,.30),.085,.085,brass)
box('Beacon title plate',(-10.2,6.0,2.17),(4.31,.15,.52),gun,.09)
text('HARMONIC BEACON LAB',(-10.2,5.916,2.065),.247)
box('Beacon console',(-10.65,-1.97,-.61),(3.78,.87,.17),oak,.13,yaw=.10)
for x in (-11.91,-9.39):
    box('Console cast leg',(x,-1.97,-1.12),(.18,.65,.75),gun,.05)
for i in range(7):
    disk('Tuning dial',(-11.98+i*.35,-2+.035*i,-.464),.108,.124,brass,24)
box('Signal display',(-9.60,-1.59,-.29),(1.08,.12,.45),gun,.06)
for j in range(3):
    arc('Illustrative listening trace',[(-10.03+i*.028,-1.66,-.41+j*.11+
            .047*math.sin(i*.42+j)) for i in range(31)],amber,.009)
box('Beacon station label',(-10.63,-2.45,-.65),(2.86,.061,.20),gun,.027)
text('ESCUCHA  /  PROTOTIPOS',(-10.63,-2.486,-.694),.133)

group=sensor
# Cool overlook with an angled shared display and a more private reading perch.
for y in (-2.8,-.65,1.48,3.65,5.82,7.98,10.68):
    box('Observatory mullion',(14.15,y,4.2),(.19,.17,4.15),green,.046)
strut('Window sill',(14.10,-4.37,3.08),(14.10,12.06,3.08),.15,.17,gun)
strut('Window header',(14.10,-4.37,6.24),(14.10,12.06,6.24),.26,.31,green)
for y in (-3.84,1.8,7.61,11.94):
    strut('Overlook canopy',(8.05,y,5.76),(14.12,y+.33,6.39),.28,.24,green)
rail('Lookout west rail',(7.95,.66,3.05),(7.95,9.53,3.05))
box('Observation wall',(11.32,7.12,4.10),(5.39,.34,3.04),green,.18,yaw=-.12)
box('Observation screen',(11.32,6.919,4.1),(5.06,.07,2.75),slate,.12,yaw=-.12)


def on_screen(x,z):
    return (11.32+x*math.cos(-.12),6.862+x*math.sin(-.12),z)


for i in range(13):
    u=-2.28+i*.38
    arc('Observation column',[on_screen(u,3.02),on_screen(u,4.89)],green,.009)
for j in range(7):
    z=3.02+j*.313
    arc('Observation row',[on_screen(-2.28,z),on_screen(2.28,z)],green,.009)
for j in range(3):
    arc('Illustrated sample',[on_screen(-2.16+i*.055,3.40+j*.47+
        .11*math.sin(i*.26+j)+.045*math.sin(i*.70)) for i in range(79)],opal,.019)
text('SENSORIAL  /  OBSERVACIÓN',on_screen(0,5.04),.249,angle=-.12)
text('ESTUDIO DE INTERFAZ',on_screen(0,2.87),.102,angle=-.12)
box('Sensorial main station',(10.94,4.44,3.01),(4.78,.94,.21),oak,.13,yaw=-.12)
for x in (9.2,12.68):
    box('Station pedestal',(x,4.44,2.53),(.38,.65,.79),gun,.07)
for station in (-1.45,0,1.45):
    box('Slanted console deck',(10.94+station,4.48,3.159),(1.17,.65,.13),green,.10,yaw=-.12)
    for j in range(4):
        box('Console actuator',(10.55+station+j*.212,4.41,3.244),
            (.145,.19,.038),opal,.026,yaw=-.12)
box('Quiet reading bench',(12.82,-1.54,2.55),(1.65,2.22,.24),green,.151)
box('Quiet reading desktop',(11.12,-1.15,2.90),(.94,1.06,.12),oak,.086)
box('Tall private shelving',(13.9,-2.9,3.45),(.23,1.9,2.7),gun,.07)
for z in (2.52,2.86,3.24,3.63,4.01,4.40):
    box('Reading shelf',(13.73,-2.9,z),(.67,1.78,.073),oak,.04)
for i in range(10):
    z=2.62+(i//4)*.36
    box('Field notebook',(13.58,-3.50+(i%4)*.26,z),(.30,.16,.25+.025*(i%3)),
        (wine,ash,green,brass)[i%4],.014,yaw=.06*(i%3-1))

group=structure
for x in (-7.14,7.21):
    box('Garden work patio',(x,-15.03,.006),(4.92,3.87,.033),ash,.028)
    for y in (-16.43,-15.65,-14.85,-14.03,-13.26):
        box('Stone paving joint',(x,y,.025),(4.76,.015,.007),bed,.003)
for x in (-10.78,10.82):
    box('Garden stone seat',(x,-14.86,.42),(.64,2.46,.16),ash,.07)
    box('Garden seat support',(x,-14.86,.17),(.44,1.36,.31),bed,.042)
box('Water courtyard basin',(-7.20,-16.37,.27),(4.82,2.03,.5),bed,.16)
box('Water surface',(-7.20,-16.37,.528),(4.53,1.72,.027),water,.13)
for x in (-8.84,-5.58):
    disk('Pool lantern base',(x,-16.37,.63),.18,.2,gun,24)
    disk('Pool lantern',(x,-16.37,.76),.15,.065,amber,24)
box('Outdoor prototype station',(7.21,-15.42,.90),(2.76,1.18,.22),oak,.105)
for x in (6.21,8.21):
    box('Outdoor bench stone trestle',(x,-15.42,.41),(.26,.82,.77),ash,.043)
box('Outdoor station name plate',(7.21,-16.05,.91),(1.56,.037,.16),green,.025)
text('BANCO DE PRUEBAS',(7.21,-16.075,.881),.099)
for x,y in ((-9.65,-12.75),(-4.62,-12.55),(5.05,-12.37),(9.61,-17.45)):
    for side in (-1,1):
        strut('Olive branch',(x,y,.15),(x+side*.43,y+.16,1.62),.085,.095,oak)
    for dx,dy,h,size in ((-.4,0,1.81,.56),(.42,.12,1.76,.60),(0,-.22,2.20,.53),(0,.32,1.52,.55)):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=size,location=(x+dx,y+dy,h))
        tree=own(bpy.context.object,'Olive canopy',leaf)
        tree.scale=(1.16,1.04,.62)
for x,y in ((-11,-17.9),(-10.1,-18.15),(-5.0,-18.07),(5.4,-17.94),(10.7,-18.0)):
    box('Herb bed',(x,y,.16),(.95,.76,.23),bed,.10)
    for i in range(3):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.26,location=(x-.26+i*.25,y,.37))
        tuft=own(bpy.context.object,'Herb cluster',leaf)
        tuft.scale=(.78,1.22,.58)
before_import = set(bpy.context.scene.objects)
garden_stone = Path(__file__).with_name('assets')/'rock-09-garden.glb'
bpy.ops.import_scene.gltf(filepath=str(garden_stone))
stones = [obj for obj in bpy.context.scene.objects if obj not in before_import]
assert len(stones)==1 and stones[0].type=='MESH'
stone = own(stones[0],'Garden stone near the pool')
stone.location = (-5.78,-15.24,.032)
stone.rotation_euler.z = .73
companion = stone.copy()
structure.objects.link(companion)
companion.name = 'Garden stone by the herb bed'
companion.location = (-5.63,-13.08,0)
companion.rotation_euler.z = -1.02
companion.scale = (.69,.69,.69)
rail('Garden west terrace edge',(-10.95,-18.75,.91),(-3.09,-18.75,.91))
rail('Garden terrace edge',(3.44,-18.75,.91),(11.21,-18.75,.91))
rail('Open-air station east edge',(11.18,-18.75,.91),(11.18,-12.0,.91))

group=anchors
for name, xyz, purpose in (
    ('Garden • outdoor workbench', (7.21,-14.55,1.1), 'A reusable exterior socket for tools or furnishings'),
    ('Forum • shared work', (0,-.15,1), 'Situated Conversation and project revisions'),
    ('Beacon • listen and adjust', (-10.1,-2.65,-.4), 'Owner-managed software control and readback'),
    ('Beacon • inspect prototype', (-8.22,3.1,.1), 'Authorized version-pinned model'),
    ('Sensorial • inspect recorded run', (10.3,3.05,3.1), 'Source, interval and actual experiment'),
    ('Sensorial • compare views', (11.1,-.44,2.95), 'Private reading perch and independent view'),
):
    obj=own(bpy.data.objects.new(name,None),name)
    obj.location=xyz
    obj.empty_display_type='CIRCLE'
    obj.empty_display_size=.28
    obj['purpose']=purpose

# Validate the route against the authored stair/floor geometry and all visual
# obstructions. Offsets carry a human-scale collision envelope down the route.
route = [
    (1.4,-18.6,0),(1.4,-11.6,0),(1.4,-6.55,0),(1.4,-3.8,0),(-2.8,-3.8,0),(-3.9,-1.75,0),
    (-5,-1.75,0),(-7.95,-1.75,-1.55),(-8.35,-1.75,-1.55),(-8.35,4.84,-1.55),
    (-8.35,-1.75,-1.55),(-7.95,-1.75,-1.55),(-5,-1.75,0),(-3.8,-1.75,0),(2.6,-.6,0),
    (2.58,4.43,0),(1.4,4.52,0),(1.4,5.15,0),(1.4,9.6,2.1),(1.4,11.68,2.1),
    (8.29,11.68,2.1),(8.29,5.95,2.1),(8.65,-2.8,2.1),(6.45,-2.8,2.1),
]
route_map=own(bpy.data.objects.new('Verified route · start at brass entry line',None),
              'Verified route · start at brass entry line')
route_map['positions_xyz_m']=json.dumps(route)
scene['review_note']='Architectural study. Instrument controls and traces are illustrative.'
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
from mathutils.bvhtree import BVHTree

nav_trees=[(BVHTree.FromObject(o,deps),o.matrix_world.inverted()) for o in nav.objects]
tally=0
for start,end in zip(route,route[1:]):
    start,end=Vector(start),Vector(end)
    along=end-start
    right=Vector((-along.y,along.x,0)).normalized()
    for step in range(math.ceil(along.length/.15)+1):
        position=start.lerp(end,min(1,step*.15/along.length))
        for side in (-.24,0,.24):
            p=position+side*right
            ground=Vector((p.x,p.y,p.z+.43))
            hits=[]
            for tree,inverse in nav_trees:
                _,_,_,distance=tree.ray_cast(inverse@ground,(0,0,-1),.86)
                if distance is not None:
                    hits.append(distance)
            if not hits:
                for delta in ((-.022,0,0),(.022,0,0),(0,-.022,0),(0,.022,0)):
                    for tree,inverse in nav_trees:
                        _,_,_,distance=tree.ray_cast(inverse@(ground+Vector(delta)),(0,0,-1),.86)
                        if distance is not None:
                            hits.append(distance)
            assert hits, f'Missing walking floor around {tuple(p)}'
            tally+=1
        if step==0 or step*.15>=along.length:
            continue
        eye=Vector((position.x,position.y,position.z+1.67))
        result=scene.ray_cast(deps,eye,along.normalized(),distance=.14)
        assert not result[0],f'Blocked eye path: {result[4].name} around {tuple(position)}'
print(f'ROUTE_SUPPORT_SAMPLES={tally} ROUTE_LENGTH_M={sum((Vector(b)-Vector(a)).length for a,b in zip(route,route[1:])):.2f}')

group=studio

def area(name, at, target, color, power, size):
    data=bpy.data.lights.new(name,'AREA')
    data.color,data.energy,data.size=color,power,size
    obj=own(bpy.data.objects.new(name,data),name)
    obj.location=at
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


area('Warm sun ribbon',(-4,-9,12),(1,2,0),(1,.78,.56),4700,11)
area('Blue sky bounce',(10,3,13),(0,0,0),(.56,.73,1),4100,12)
area('Entry bounce',(2,-12,1.83),(1,-7,0),(1,.54,.30),105,3.2)
area('Atrium lantern',(1,1,5.35),(0,1,0),(1,.57,.30),480,4.3)
area('Beacon key',(-8.5,1.1,3.4),(-10.7,3,-.4),(1,.58,.30),630,3.4)
area('Beacon side kick',(-12.6,-3.6,1.6),(-9.5,3,0),(1,.74,.5),270,2.8)
area('Sensorial ambient',(14,2.4,6.4),(10.9,4,3),(.37,.71,1),490,4.2)
area('Sensorial soft fill',(9,1,5.8),(10.9,5,3),(.62,.80,1),185,3.4)
world=bpy.data.worlds.new('Coastal dusk')
world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.14,.23,.28,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.42
scene.world=world


def camera(name, at, point, lens=23):
    data=bpy.data.cameras.new(name)
    obj=own(bpy.data.objects.new(name,data),name)
    obj.location=at
    obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
    data.lens=lens
    return obj


views={
    '01 - Umbral': camera('01 · At the entrance',(1.52,-11.45,1.67),(1.15,-6.20,1.78),23),
    '02 - Atrio': camera('02 · From the dogleg',(1.48,-6.17,1.69),(.05,1.29,2.82),20),
    '03 - Harmonic Beacon Lab': camera('03 · From the pit',(-8.37,.02,.16),(-10.78,3.16,.54),21),
    '04 - Galería': camera('04 · On the gallery',(3.86,11.20,3.77),(.1,1.44,1.65),22),
    '05 - Sensorial': camera('05 · Near the lookout',(8.66,.31,3.77),(10.95,5.40,3.94),22),
    '06 - Jardín': camera('06 · The garden approach',(-5.80,-18.36,1.67),(1.6,-9.26,2.63),20),
}
scene.camera=views['02 - Atrio']
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED'
scene.render.threads=10
scene.render.resolution_x=1160
scene.render.resolution_y=696
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='JPEG'
scene.render.image_settings.quality=91
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'Casa de CompAII - Nivel.blend'),compress=True)
assert set(requested_views) <= views.keys(), 'Unknown camera'
for name,cam in views.items():
    if requested_views and name not in requested_views:
        continue
    scene.camera=cam
    scene.render.filepath=str(out/(name+'.jpg'))
    bpy.ops.render.render(write_still=True)
