"""Bake the authored cells into self-contained core glTF for runtime review."""
import json
from math import cos, pi, sin
import runpy
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

CELLS = {
    'garden': ('VIS · Garden court', (0, 0, 0)),
    'house': ('VIS · House', (0, 0, 0)),
    'facade': ('VIS · House', (0, 0, 0)),
    'foyer': ('VIS · House', (0, 0, 0)),
    'foyer-gallery': ('VIS · House', (0, 0, 0)),
    'beacon': ('VIS · Beacon chamber', (-25, 9.4, 0)),
    'beacon-return': ('VIS · Beacon chamber', (-25, 9.4, 0)),
    'gallery': ('VIS · Collection gallery', (25, 7, 0)),
    'gallery-sealed': ('VIS · Collection gallery', (25, 7, 0)),
    'tower': ('VIS · Listening tower', (0, 0, 0)),
}
ALBEDO_RESOLUTION = 1024
NORMAL_RESOLUTION = 1024
MAX_BYTES = 4 * 1024 * 1024
MAX_TRIANGLES = 64_000
LAB_LETTERING = 'Laboratory sign ivory'
FOYER_LETTERING = 'Foyer sign ivory'
GALLERY_ENTRY_LETTERING = 'Gallery entry sign ivory'
RETURN_LETTERING = 'Gallery return sign ivory'
BEACON_STAIRS = ('Descending stair tread', 'Stair rail', 'Stone wall at stair')
FOYER_EXTERIOR = ('Stone plinth','Warm entrance floor','Entrance step','CASA DE COMPAII',
                  'Clerestory smoked glass','Vertical recessed window','Amber window sill',
                  'Right wing stone rib','Facade ')
GALLERY_BASE = ('Limestone gallery floor', 'Drafts stone base', 'Drafts oak top',
                'Published stone base', 'Published oak top', 'Archive stone base', 'Archive oak top')


def select(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def append_blocks(obj, specs):
    parts = [obj]
    for name, center, size, material, bevel in specs:
        bpy.ops.mesh.primitive_cube_add(size=1, location=center)
        part = bpy.context.object
        part.name, part.dimensions = name, size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if bevel:
            border = part.modifiers.new('Dressed edges', 'BEVEL')
            border.width, border.segments = bevel, 3
        part.data.materials.append(bpy.data.materials[material])
        parts.append(part)
    select(parts)
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()


def append_foyer_path(obj):
    # Blender +Y points toward the gallery. The route bends around the table
    # and keeps clear of the arrival, masonry piers and existing door slots.
    points = [Vector((0, -5.57)), Vector((0, -3.66)), Vector((-1.72, -1.50)),
              Vector((-1.92, 1.42)), Vector((-2.18, 3.45)), Vector((-3, 4.66)),
              Vector((-3, 5.75))]
    directions = [(end-start).normalized() for start,end in zip(points,points[1:])]
    sides = [directions[0], *((before+after).normalized() for before,after in
              zip(directions,directions[1:])), directions[-1]]
    pieces = [obj]
    for name,width,height,finish in [
        ('Basalt ribbon edges', 1.04, .107, 'Split basalt'),
        ('Limestone gallery route', .88, .109, 'Ivory limewash'),
    ]:
        vertices = [(*tuple(point+Vector((-along.y,along.x))*width*side/2), height)
                    for point,along in zip(points,sides) for side in (1,-1)]
        faces = [(i,i+1,i+3,i+2) for i in range(0,len(vertices)-2,2)]
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices,[],faces)
        mesh.update()
        ribbon = bpy.data.objects.new(name,mesh)
        bpy.context.collection.objects.link(ribbon)
        ribbon.data.materials.append(bpy.data.materials[finish])
        pieces.append(ribbon)
    select(pieces)
    bpy.ops.object.join()


def register_foyer(obj):
    obj.data.transform(Matrix.Translation((0,-5.84,-.334)) @
                       Matrix.Diagonal((1.27,1.42,1,1)))
    oak, stone, brass = 'Dark oiled oak', 'Honed honey limestone', 'Satin brass'
    gunmetal, lamp = 'Blue gunmetal', 'Honey lamp glass'
    frame = [('Foyer limestone floor',(0,0,.035),(11.76,11.76,.122),stone,0)]
    for side in (-1,1):
        frame.extend([
            ('Limestone skirting',(side*5.71,0,.25),(.16,11.63,.30),stone,.025),
            ('Oak eave beam',(side*5.69,0,3.20),(.27,11.70,.28),oak,.035),
        ])
    for x,y in [(-3,5.55),(0,-5.73)]:
        for side in (-1,1):
            frame.append(('Oak passage jamb',(x+side*.80,y,1.25),(.23,.28,2.29),oak,.033))
        frame.extend([
            ('Oak passage lintel',(x,y,2.47),(1.86,.29,.25),oak,.037),
            ('Brass doorway bead',(x,y-(.16 if y>0 else -.16),2.34),(1.64,.034,.036),brass,.009),
        ])
    frame.extend([
        ('Gallery oak door leaf',(-3,5.51,1.16),(1.39,.10,2.09),oak,.018),
        ('Rebated gunmetal panel',(-3,5.445,1.19),(1.16,.047,1.82),gunmetal,.022),
        ('Brass gallery latch',(-2.55,5.394,1.09),(.082,.074,.25),brass,.019),
    ])
    # An east-facing window bay gives the soft light an architectural source.
    frame.extend([
        ('Clerestory oak casing',(5.65,-1.75,2.80),(.26,3.05,1.03),oak,.038),
        ('Clerestory glazed recess',(5.50,-1.75,2.81),(.032,2.72,.73),gunmetal,.012),
        ('Clerestory upper light',(5.477,-1.75,3.05),(.027,2.57,.11),lamp,.010),
        ('Clerestory limestone sill',(5.44,-1.75,2.35),(.35,3.08,.15),stone,.029),
    ])
    for y in (-3.10,-2.44,-1.75,-1.06,-.40):
        frame.append(('Clerestory mullion',(5.445,y,2.80),(.12,.070,.78),oak,.012))
    for y in (-4.4,-3.95,-3.5,0, .45,.90,1.35,1.80,2.25,2.70,3.15,3.60,4.05,4.50):
        frame.append(('East wall oak batten',(5.66,y,1.42),(.13,.068,2.29),oak,.013))
    frame.extend(foyer_joinery())
    append_blocks(obj,frame)
    append_foyer_path(obj)


def register_foyer_gallery(obj):
    # Keep the existing oak door and route, and set the wayfinding into the
    # same wall. This variant is served only for the authorized gallery link.
    oak, iron, brass = 'Dark oiled oak', 'Blue gunmetal', 'Satin brass'
    append_blocks(obj, [
        ('Gallery entry sign oak frame',(-3,5.560,3.033),(2.03,.115,.465),oak,.027),
        ('Gallery entry sign gunmetal face',(-3,5.492,3.033),(1.90,.042,.368),iron,.013),
        ('Gallery entry sign brass sill',(-3,5.466,2.859),(1.796,.020,.018),brass,.004),
    ])
    letter_room_sign(obj, -3, 5.466, GALLERY_ENTRY_LETTERING,
                     [('GALERÍA', 3.029, .254), ('PLANTA BAJA', 2.908, .111)])


def foyer_joinery():
    oak, stone, brass = 'Dark oiled oak', 'Honed honey limestone', 'Satin brass'
    basalt, ivory, iron = 'Split basalt', 'Ivory limewash', 'Blue gunmetal'
    specs = [
        ('West wall-bench stone back',(-5.46,-1.18,.86),(.21,2.96,1.34),stone,.037),
        ('West bench oak cap',(-5.13,-1.18,.526),(.88,2.91,.11),oak,.024),
        ('West bench oak front rail',(-4.72,-1.18,.434),(.10,2.83,.13),oak,.018),
        ('West bench basalt kick',(-5.17,-1.18,.204),(.65,2.71,.22),basalt,.025),
        ('West dado',(-5.62,.2,1.58),(.16,11.36,.093),oak,.018),
        ('West dado brass seam',(-5.539,.2,1.627),(.015,11.29,.020),brass,.005),
        ('North limestone foot rail',(.61,5.66,.189),(5.01,.14,.17),stone,.021),
        ('Table long joinery rail',(-.59,-.16,.493),(.105,2.00,.15),oak,.018),
        ('Table long joinery rail',(.59,-.16,.493),(.105,2.00,.15),oak,.018),
        ('Table apron east seam',(.637,-.16,.558),(.024,1.97,.018),brass,.005),
        ('Table apron west seam',(-.637,-.16,.558),(.024,1.97,.018),brass,.005),
        ('Table inset site plan',(0,-.30,.686),(1.11,1.36,.058),basalt,.026),
        ('Table plan limestone field',(0,-.30,.719),(.987,1.243,.016),stone,.012),
        ('Table plan oak hall outline',(0,-.30,.735),(.767,1.02,.020),oak,.017),
        ('Table plan hall floor',(0,-.30,.747),(.69,.91,.015),ivory,.010),
        ('Table plan central table',(0,-.30,.770),(.092,.17,.025),oak,.006),
        ('Table plan inner route',(-.16,-.191,.758),(.030,.80,.012),brass,.004),
        ('Table plan arrival route',(-.083,-.62,.758),(.183,.034,.012),brass,.004),
        ('Table plan arrival door',(0,-.796,.767),(.127,.024,.027),iron,.007),
        ('Table plan internal threshold',(-.207,.212,.767),(.117,.025,.027),iron,.007),
    ]
    for y in (-2.35,0):
        specs.append(('West bench inset support',(-5.06,y,.355),(.72,.28,.486),basalt,.027))
    for y in (-4.90,-4.12,-3.34,.44,1.22,2.00,2.78,3.56,4.34,5.12):
        specs.append(('West wall dado vertical',(-5.62,y,.908),(.12,.052,1.14),oak,.011))
    for y in (-.99,.383):
        specs.append(('Plan tray brass end fillet',(0,y,.719),(1.04,.028,.026),brass,.008))
    return specs


def mesh_for(collection, origin, cell):
    scope = bpy.data.collections[collection]
    scope.hide_render = False
    exclusions = {'beacon':BEACON_STAIRS, 'beacon-return':BEACON_STAIRS, 'foyer':FOYER_EXTERIOR,
                  'foyer-gallery':FOYER_EXTERIOR,
                  'gallery':GALLERY_BASE,'gallery-sealed':GALLERY_BASE}.get(cell, ())
    objects = [obj for obj in scope.objects if not obj.name.startswith(exclusions)]
    select(objects)
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = collection
    obj.location -= Vector(origin)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if cell in ('beacon','beacon-return'):
        register_beacon(obj)
    if cell=='beacon-return':
        register_beacon_return(obj)
    if cell=='facade':
        # Front +Z in glTF. The checked-in chamber is full size; the fixture's
        # approved west-parcel facade is 3.15 × 1.5 × 2.65 in world space.
        obj.data.transform(Matrix.Translation((0,-1.195,0)) @
                           Matrix.Diagonal((.153,.320,.391,1)))
    if cell in ('foyer','foyer-gallery'):
        register_foyer(obj)
    if cell=='foyer-gallery':
        register_foyer_gallery(obj)
    if cell in ('gallery','gallery-sealed'):
        register_gallery(obj,stair=cell=='gallery')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.13, island_margin=.008)
    bpy.ops.object.mode_set(mode='OBJECT')
    return obj


def gallery_stair():
    stone, oak, basalt = 'Honed honey limestone', 'Dark oiled oak', 'Split basalt'
    brass, iron = 'Satin brass', 'Blue gunmetal'
    pieces = [
        ('Gallery stair end wall',(3,5.963,-.453),(1.71,.20,1.114),stone,.018),
        ('Gallery stair well underside',(3,4.51,-.988),(1.73,2.71,.075),basalt,.008),
        ('Lab doorway stone frame',(3,5.800,.323),(1.67,.178,2.16),stone,.024),
        ('Lab door oak casing',(3,5.696,.290),(1.50,.091,2.07),oak,.018),
        ('Lab door oak leaf',(3,5.639,.263),(1.35,.074,1.96),oak,.016),
        ('Lab door gunmetal inset',(3,5.596,.322),(1.11,.018,1.57),iron,.016),
        ('Lab door basalt kick plate',(3,5.591,-.590),(1.23,.028,.19),basalt,.009),
        ('Lab door satin brass backplate',(3.475,5.580,.218),(.084,.027,.223),brass,.004),
        ('Lab door handle',(3.409,5.548,.238),(.17,.048,.033),brass,.012),
        ('Lab address oak panel',(3,5.802,2.199),(2.15,.107,.491),oak,.028),
        ('Lab address gunmetal field',(3,5.738,2.199),(2.025,.04,.386),iron,.012),
        ('Lab address brass sill',(3,5.713,2.015),(1.929,.016,.016),brass,.003),
    ]
    for x in (2.64, 3.36):
        pieces.append(('Lab door inset oak stile',(x,5.579,.322),(.037,.031,1.51),oak,.006))
    for z in (-.172, .755):
        pieces.append(('Lab door inset oak crossbar',(3,5.577,z),(1.096,.033,.064),oak,.008))
    for index in range(6):
        depth = 5.86-.45*(index+.5)
        top = .095-.14*(6-index)
        pieces.extend([
            ('Gallery stair stone',(3,depth,top-.071),(1.70,.45,.142),stone,.012),
            ('Gallery stair basalt nosing',(3,depth+.194,top-.002),(1.57,.028,.009),basalt,.003),
        ])
    for x in (2.08,3.92):
        pieces.extend([
            ('Gallery stair limestone cheek',(x,4.51,-.455),(.14,2.71,1.10),stone,.012),
            ('Gallery stair oak cap',(x,4.51,.112),(.15,2.71,.048),oak,.008),
            ('Gallery stair oak handrail',(x,4.51,.879),(.112,2.74,.084),oak,.019),
        ])
        for y in (3.22,4.08,4.94,5.80):
            pieces.extend([
                ('Gallery stair rail shoes',(x,y,.158),(.105,.11,.044),iron,.007),
                ('Gallery stair bronze baluster',(x,y,.50),(.040,.052,.690),brass,.005),
            ])
    return pieces


def gallery_foyer_door():
    stone, oak, basalt = 'Honed honey limestone', 'Dark oiled oak', 'Split basalt'
    brass, iron = 'Satin brass', 'Blue gunmetal'
    # Slot zero is across the entrance wall from the stair. Keep the parts
    # shallow against the wall, outside the existing walking approach.
    return [
        ('Foyer door limestone surround',(-3,5.806,1.193),(1.67,.16,2.20),stone,.026),
        ('Foyer door oak lining',(-3,5.703,1.152),(1.49,.118,2.10),oak,.022),
        ('Foyer door oak leaf',(-3,5.632,1.142),(1.33,.068,1.99),oak,.017),
        ('Foyer door lower recessed panel',(-3,5.591,.622),(.961,.028,.627),iron,.019),
        ('Foyer door upper recessed panel',(-3,5.591,1.491),(.961,.028,.825),iron,.019),
        ('Foyer door lower brass bead',(-3,5.570,.925),(.927,.014,.020),brass,.003),
        ('Foyer door upper brass bead',(-3,5.570,1.886),(.927,.014,.020),brass,.003),
        ('Foyer door basalt foot',(-3,5.582,.201),(1.234,.021,.16),basalt,.008),
        ('Foyer door brass backplate',(-2.570,5.564,1.077),(.091,.028,.234),brass,.009),
        ('Foyer door lever',(-2.639,5.530,1.128),(.173,.054,.035),brass,.010),
        ('Foyer sign oak plaque',(-3,5.801,3.075),(2.03,.108,.473),oak,.029),
        ('Foyer sign bronze-dark face',(-3,5.737,3.075),(1.899,.040,.367),iron,.015),
        ('Foyer sign brass sill',(-3,5.712,2.902),(1.800,.017,.018),brass,.004),
    ]


def letter_room_sign(obj, x, y, material, lines):
    parts = [obj]
    ivory = bpy.data.materials['Ivory lettering'].copy()
    ivory.name = material
    surface = ivory.node_tree.nodes.get('Principled BSDF')
    surface.inputs['Emission Color'].default_value = (.84,.72,.53,1)
    surface.inputs['Emission Strength'].default_value = .12
    for body, height, size in lines:
        text = bpy.data.curves.new(body, 'FONT')
        text.body, text.align_x, text.size, text.extrude = body, 'CENTER', size, .001
        letters = bpy.data.objects.new(body, text)
        letters.location = (x,y,height)
        letters.rotation_euler.x = pi/2
        text.materials.append(ivory)
        bpy.context.collection.objects.link(letters)
        parts.append(letters)
    select(parts)
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()


def close_gallery_gables(obj):
    # Registered X/Z profile of the copper canopy, raised clerestory and
    # lined roof. The infill is at the two end walls only. The roof slot
    # stays open along the length of the gallery.
    profile = [(-5.91,3.78),(5.91,3.78),(5.91,4.01),
               (-2.96,4.69),(-3.94,5.025),(-5.91,3.93)]
    count = len(profile)
    pieces = [obj]
    for near,far in [(-5.88,-5.62),(5.77,5.96)]:
        vertices = [(x,y,z) for y in (near,far) for x,z in profile]
        faces = [tuple(range(count)),tuple(reversed(range(count,2*count)))]
        for i in range(count):
            j = (i+1) % count
            faces.append((i,i+count,j+count,j))
        mesh = bpy.data.meshes.new('Limewash gable infill')
        mesh.from_pydata(vertices,[],faces)
        mesh.update()
        gable = bpy.data.objects.new('Limewash gable infill',mesh)
        bpy.context.collection.objects.link(gable)
        mesh.materials.append(bpy.data.materials['Ivory limewash'])
        pieces.append(gable)
    select(pieces)
    bpy.ops.object.join()


def register_gallery(obj,stair):
    obj.data.transform(Matrix.Translation((0,0,.10)) @
                       Matrix.Diagonal((-1.095,-.832,1,1)))
    # Gallery stair slot 1 uses x=3 and z in [-5.86,-3.16]. Cut the
    # visible stone above the existing engine hole rather than sealing it.
    bounds = [(-5.89,2.15,-5.89,5.89),(3.85,5.89,-5.89,5.89),
              (2.15,3.85,-3.16,5.89)] if stair else [(-5.89,5.89,-5.89,5.89)]
    floor = [('Gallery limestone floor',((x1+x2)/2,-(z1+z2)/2,.035),
              (x2-x1,z2-z1,.122),'Honed honey limestone',0) for x1,x2,z1,z2 in bounds]
    oak, stone, brass = 'Dark oiled oak', 'Honed honey limestone', 'Satin brass'
    basalt, iron = 'Split basalt', 'Blue gunmetal'
    finish = [
        ('Gallery entrance wall',(0,5.96,1.965),(11.84,.20,3.94),'Ivory limewash',.032),
        ('Clerestory lower wall',(-5.79,0,1.28),(.21,11.64,2.56),'Ivory limewash',.038),
        ('Clerestory oak sill',(-5.73,0,2.59),(.38,11.66,.13),'Dark oiled oak',.026),
        ('Gallery limestone skirting',(-5.62,0,.19),(.13,11.66,.22),'Honed honey limestone',.022),
        ('Collection wall oak skirting',(5.70,0,.18),(.15,11.60,.18),'Dark oiled oak',.024),
        # The roof slot remains open to the cool light between these headers.
        ('Clerestory outer oak header',(-3.96,0,4.55),(.13,11.54,.18),oak,.018),
        ('Clerestory inner oak header',(-2.98,0,4.62),(.13,11.54,.18),oak,.018),
        ('Collection oak eave moulding',(5.55,.03,3.615),(.19,11.30,.185),oak,.021),
        ('Collection sign oak backing',(0,-5.641,2.695),(3.47,.042,.585),oak,.008),
        ('Collection wash light track',(2.10,-.12,3.571),(.146,8.04,.09),iron,.015),
        ('Limestone viewing strip',(-.55,-.08,.095),(2.36,8.98,.012),stone,.002),
        ('Entrance wall oak plate',(0,5.788,3.875),(11.78,.23,.19),oak,.028),
        ('Collection wall oak plate',(0,-5.632,3.875),(11.78,.19,.19),oak,.028),
    ]
    for start,end in [(-5.62,1.71),(4.29,5.68)]:
        middle, length = (start+end)/2, end-start
        finish.extend([
            ('Collection basalt wall foot',(5.55,middle,.19),(.095,length,.177),basalt,.014),
            ('Collection oak dado rail',(5.55,middle,.601),(.115,length,.078),oak,.013),
        ])
    for y in (-5.55,-3.69,-1.84,0,1.84,3.69,5.55):
        finish.append(('Clerestory oak divider',(-3.47,y,4.586),(1.03,.07,.112),oak,.012))
    for y in (-2.163,.998):
        finish.append(('Track suspension',(2.10,y,3.742),(.031,.035,.29),iron,.004))
    for x in (-1.75,.65):
        finish.append(('Bronze viewing strip seam',(x,-.08,.102),(.016,8.98,.007),brass,.001))
    for y in (.34944,-1.25,-3.67744):
        # A neutral frame belongs to the room. Edition labels and models
        # remain actor-filtered projections at the original plinth anchors.
        finish.extend([
            ('Oak shadow bay',(5.528,y,1.924),(.099,1.40,2.196),oak,.023),
            ('Inset matte stone shadow bay',(5.467,y,1.924),(.036,1.245,2.022),basalt,.012),
            ('Shadow bay bronze foot',(5.44,y,.956),(.018,1.195,.020),brass,.003),
            ('Gallery track head',(2.10,y,3.487),(.217,.223,.100),iron,.019),
            ('Gallery lamp glass',(2.10,y,3.431),(.154,.158,.021),'Honey lamp glass',.005),
        ])
    append_blocks(obj,floor+finish+gallery_furniture()+gallery_foyer_door()+(gallery_stair() if stair else []))
    gallery_portal_recess(obj)
    close_gallery_gables(obj)
    letter_room_sign(obj, -3, 5.714, FOYER_LETTERING,
                       [('VESTÍBULO', 3.071, .246), ('PLANTA BAJA', 2.939, .113)])
    if stair:
        letter_room_sign(obj, 3, 5.714, LAB_LETTERING,
                           [('LABORATORIO', 2.194, .247), ('NIVEL -1', 2.061, .107)])


def gallery_portal_recess(obj):
    """Build a neutral basalt and bronze recess at the existing east slot."""
    basalt, brass, iron = 'Split basalt', 'Satin brass', 'Blue gunmetal'
    center, spring = 3, 1.82
    # Coordinates before glTF conversion. The back stays in front of the
    # limewash wall; the stone frame is outside the walkable portal landing.
    specs = [
        ('Recess threshold', (5.482,center,.122), (.16,2.51,.059), basalt,.013),
        ('Recess center bronze seam', (5.479,center,1.36), (.041,.047,1.80), brass,.007),
        ('Recess sign holder', (5.486,center,3.31), (.114,1.74,.324), iron,.023),
    ]
    for side in (-1,1):
        specs.extend([
            ('Recess basalt jamb', (5.485,center+side*1.163,.976), (.194,.218,1.728), basalt,.032),
            ('Recess bronze inlay', (5.387,center+side*1.064,.980), (.019,.048,1.69), brass,.007),
        ])
    append_blocks(obj,specs)

    def arc(radius,depth):
        return [(depth,center+radius*cos(pi*i/32),spring+radius*sin(pi*i/32)) for i in range(33)]

    shapes = [obj]

    def add(name, material, vertices, faces):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices,[],faces)
        mesh.update()
        part = bpy.data.objects.new(name,mesh)
        bpy.context.collection.objects.link(part)
        mesh.materials.append(bpy.data.materials[material])
        shapes.append(part)

    panel = [(5.518,center-1.073,.154),(5.518,center+1.073,.154)] + arc(1.073,5.518)
    add('Recess dark field', iron, panel, [tuple(reversed(range(len(panel))))])

    # Four sampled edges describe the front and back of each closed crown.
    spans = 32
    n = spans+1
    for name, material, inner, outer, front, back in [
        ('Recess basalt crown', basalt, 1.054, 1.27, 5.389, 5.58),
        ('Recess bronze crown', brass, 1.041, 1.086, 5.377, 5.397),
    ]:
        vertices = arc(inner,front)+arc(outer,front)+arc(inner,back)+arc(outer,back)
        faces = [(0,n,3*n,2*n), (spans,2*n+spans,3*n+spans,n+spans)]
        for i in range(spans):
            fi, fo, bi, bo = i, n+i, 2*n+i, 3*n+i
            faces.extend([
                (fi,fi+1,fo+1,fo), (bi,bo,bo+1,bi+1),
                (fi,bi,bi+1,fi+1), (fo,fo+1,bo+1,bo),
            ])
        add(name, material, vertices, faces)
    select(shapes)
    bpy.ops.object.join()



def gallery_furniture():
    """Three silhouettes share the gallery's oak and bronze joinery."""
    oak, stone, brass = 'Dark oiled oak', 'Honed honey limestone', 'Satin brass'
    basalt, iron = 'Split basalt', 'Blue gunmetal'
    x, work, exhibit, archive = 3.3945, .34944, -1.25, -3.67744
    # The three work surfaces, collision envelopes and exhibit anchors stay in
    # place. These fittings carry no edition titles or protected geometry.
    pieces = [
        ('Workbench oak slab', (x,work,1.0465), (2.88,1.36,.122), oak,.027),
        ('Workbench blue working insert', (x+.06,work,1.105), (2.19,.95,.006), iron,.003),
        ('Workbench long back rail', (x,work+.49,.714), (2.65,.09,.13), oak,.014),
        ('Workbench low stretcher', (x,work,.313), (2.65,.12,.14), oak,.013),
        ('Workbench tool drawer cabinet', (x+.77,work,.763), (.76,1.017,.43), oak,.022),
        ('Workbench drawer face', (x+.77,work+.525,.793), (.706,.043,.259), iron,.010),
        ('Workbench drawer pull', (x+.77,work+.553,.821), (.198,.027,.032), brass,.006),
        ('Exhibit basalt footing', (2.5,exhibit,.18), (1.268,.984,.164), basalt,.037),
        ('Exhibit limestone body', (2.5,exhibit,.54), (1.10,.81,.65), stone,.065),
        ('Exhibit bronze reveal', (2.5,exhibit,.861), (1.19,.88,.026), brass,.005),
        ('Exhibit oak display deck', (2.5,exhibit,.917), (1.32,1.04,.096), oak,.030),
        ('Archive basalt kick', (x,archive,.175), (2.77,1.19,.152), basalt,.025),
        ('Archive flat-file carcass', (x+.025,archive,.781), (2.74,1.23,1.076), oak,.023),
        ('Archive oak capping', (x,archive,1.3555), (2.88,1.36,.104), oak,.025),
    ]
    for offset in (-1.24,1.24):
        for side in (-1,1):
            pieces.append(('Workbench trestle leg', (x+offset,work+side*.48,.551),
                           (.158,.182,.904), oak,.021))
        pieces.append(('Workbench trestle bronze foot', (x+offset,work,.131),
                       (.217,1.16,.064), brass,.011))
    # Drawer fronts face the viewing path. Their handles sit within the case's
    # footprint, with broad dark joints visible from the arrival.
    for height in (.374,.591,.808,1.025,1.222):
        pieces.extend([
            ('Archive flat drawer face', (x-1.369,archive,height), (.064,1.082,.164), iron,.013),
            ('Archive recessed pull', (x-1.418,archive,height+.015), (.031,.322,.035), brass,.006),
        ])
    return pieces


def register_beacon(obj):
    # Preserve the existing 12m cell and the west stair passage. The rendered
    # chamber extends south from the stair and leaves the original steps free.
    # Blender (X,Y,Z) here is centered on the chamber, before glTF converts it.
    obj.data.transform(Matrix.Translation((0,-.002,.10)) @
                       Matrix.Diagonal((-.88,-.77,1,1)))
    stone = bpy.data.materials['Honed honey limestone']
    oak = bpy.data.materials['Dark oiled oak']
    brass = bpy.data.materials['Satin brass']
    basalt = bpy.data.materials['Split basalt']
    iron = bpy.data.materials['Blue gunmetal']
    pieces = [obj]

    def piece(name, at, size, mat, tilt=0, bevel=.015, segments=3):
        bpy.ops.mesh.primitive_cube_add(size=1, location=at)
        part = bpy.context.object
        part.name, part.dimensions = name, size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        part.rotation_euler.x = tilt
        border = part.modifiers.new('Dressed edges', 'BEVEL')
        border.width, border.segments = bevel, segments
        part.data.materials.append(mat)
        pieces.append(part)

    # Coordinates match the existing six walkable MML treads. These are the
    # visible edges, with continuous outboard handrails in darkened brass.
    for index in range(6):
        depth = 5.86-.45*(index+.5)
        top = .1+.14*(6-index)-.004
        piece('Limestone stair tread',(-3,depth,top-.071),(1.70,.45,.142),stone)
    for x in [-3.92,-2.08]:
        for y,z in [(5.69,.93),(4.50,.57),(3.25,.22)]:
            piece('Bronze stair spindle',(x,y,z+.43),(.055,.058,.86),brass)
        piece('Oiled oak handrail',(x,4.49,1.45),(.09,2.62,.088),oak,.285)
    for x,width in [(-4.89,2.02),(1.86,8.00)]:
        piece('Limestone landing wall',(x,5.86,2.799),(width,.16,5.398),stone)
    piece('Stair portal architrave',(-3,5.84,3.55),(1.76,.19,.17),oak)
    piece('Upper landing lintel',(-3,5.86,4.59),(1.74,.16,1.82),stone)

    # Stop the skirting at the stair opening and keep both rail sweeps clear.
    # Wall and hardware details sit on the existing shell or occupied benches.
    for side in (-1,1):
        piece('Basalt wall foot',(side*5.586,.28,.176),(.130,10.99,.152),basalt)
        piece('Limestone skirting cap',(side*5.583,.28,.259),(.142,10.99,.033),stone,bevel=.007,segments=1)
        piece('Workshop oak wainscot',(side*5.586,.28,.582),(.103,10.97,.643),oak)
        piece('Dressed oak chair rail',(side*5.560,.28,.922),(.146,10.97,.073),oak)
        piece('Vault side wall plate',(side*5.573,.28,5.210),(.159,10.97,.202),oak)
    piece('Rear basalt wall foot',(0,-5.232,.175),(11.18,.145,.152),basalt)
    piece('Rear limestone skirting cap',(0,-5.232,.258),(11.18,.152,.034),stone,bevel=.007,segments=1)
    for x,width in [(-4.89,1.94),(1.83,7.84)]:
        piece('Landing wall foot',(x,5.733,.177),(width,.135,.154),basalt)
        piece('Landing limestone cap',(x,5.729,.260),(width,.14,.034),stone,bevel=.007,segments=1)
    piece('Stair landing stone',(-3,2.10,.097),(1.81,2.104,.020),stone,bevel=.004)
    for x in (-3.82,-2.18):
        piece('Landing bronze edge',(x,2.10,.109),(.017,2.08,.005),brass,bevel=.0015,segments=1)

    for side,y,x in [(1,.791,3.802),(-1,-2.659,-3.758)]:
        piece('Acoustic bay oak frame',(side*5.572,y,1.945),(.101,2.56,1.53),oak)
        piece('Acoustic bay dark backing',(side*5.510,y,1.945),(.036,2.375,1.345),iron)
        for offset in (-.97,-.73,-.49,-.25,0,.25,.49,.73,.97):
            piece('Acoustic oak blade',(side*5.482,y+offset,1.945),(.048,.076,1.305),oak,bevel=.008,segments=1)
        for height in (1.238,2.652):
            piece('Acoustic bay brass bead',(side*5.509,y,height),(.024,2.398,.020),brass,bevel=.004,segments=1)
        piece('Bench instrument drawers',(x,y,.634),(1.20,.50,.415),iron)
        for height in (.531,.729):
            piece('Rebated oak drawer front',(x,y+.250,height),(1.23,.044,.179),oak,bevel=.009)
            piece('Brass drawer pull',(x,y+.280,height),(.205,.031,.035),brass,bevel=.006,segments=1)
    select(pieces)
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()


def register_beacon_return(obj):
    # Slot zero is at X -3 and Z -5.86. Fit the leaf above the highest
    # tread, against the existing landing, with no change to collision.
    stone, oak, basalt = 'Honed honey limestone', 'Dark oiled oak', 'Split basalt'
    brass, iron = 'Satin brass', 'Blue gunmetal'
    append_blocks(obj, [
        ('Return door limewash recess',(-3,5.869,2.223),(1.82,.096,2.566),'Ivory limewash',.013),
        ('Return door limestone surround',(-3,5.803,2.015),(1.67,.156,2.16),stone,.025),
        ('Return door oak lining',(-3,5.700,1.994),(1.49,.110,2.10),oak,.021),
        ('Return door oak leaf',(-3,5.638,1.975),(1.33,.065,1.99),oak,.017),
        ('Return door lower inset',(-3,5.599,1.536),(.978,.028,.781),iron,.018),
        ('Return door upper inset',(-3,5.599,2.428),(.978,.028,.904),iron,.018),
        ('Return door lower brass bead',(-3,5.579,1.911),(.930,.014,.018),brass,.004),
        ('Return door upper brass bead',(-3,5.579,2.862),(.930,.014,.018),brass,.004),
        ('Return door kick plate',(-3,5.588,1.065),(1.228,.025,.152),basalt,.008),
        ('Return door brass backplate',(-2.573,5.582,1.970),(.084,.027,.228),brass,.006),
        ('Return door lever',(-2.641,5.544,2.019),(.171,.050,.036),brass,.009),
        ('Return sign oak frame',(-3,5.797,3.843),(2.025,.115,.468),oak,.024),
        ('Return sign gunmetal face',(-3,5.725,3.843),(1.893,.040,.369),iron,.015),
        ('Return sign brass sill',(-3,5.695,3.664),(1.796,.023,.017),brass,.004),
    ])
    letter_room_sign(obj, -3, 5.700, RETURN_LETTERING,
                     [('GALERÍA', 3.839, .251), ('PLANTA BAJA', 3.713, .109)])


def bake(obj, name, mode, resolution, scratch):
    image = bpy.data.images.new(name, width=resolution, height=resolution, alpha=False)
    image.colorspace_settings.name = 'sRGB' if mode == 'DIFFUSE' else 'Non-Color'
    for mat in obj.data.materials:
        nodes = mat.node_tree.nodes
        target = nodes.new('ShaderNodeTexImage')
        target.image = image
        nodes.active = target
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 8
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.use_pass_color = True
    scene.render.bake.margin = 8
    bpy.ops.object.bake(type=mode)
    image.filepath_raw = str(scratch / (name + '.png'))
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image


def bake_contact(obj, cell, scratch):
    for mat in obj.data.materials:
        tree = mat.node_tree
        occlusion = tree.nodes.new('ShaderNodeAmbientOcclusion')
        occlusion.inputs['Distance'].default_value = .7
        occlusion.only_local = True
        emission = tree.nodes.new('ShaderNodeEmission')
        tree.links.new(occlusion.outputs['AO'], emission.inputs['Color'])
        tree.links.new(emission.outputs['Emission'], tree.nodes.get('Material Output').inputs['Surface'])
    return bake(obj, cell+'-contact', 'EMIT', 512, scratch)


def portable_materials(obj, color, normal, contact=None, bounce=None):
    if contact:
        settings = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        settings.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    for mat in obj.data.materials:
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        shader = nodes.get('Principled BSDF')
        for node in list(nodes):
            if node not in (shader, nodes.get('Material Output')):
                nodes.remove(node)
        # Tiny bevels and glyph faces stay crisp in their solid sign material.
        if mat.name in (LAB_LETTERING, FOYER_LETTERING, GALLERY_ENTRY_LETTERING, RETURN_LETTERING):
            links.new(shader.outputs['BSDF'], nodes.get('Material Output').inputs['Surface'])
            continue
        color_node = nodes.new('ShaderNodeTexImage')
        color_node.image = color
        links.new(color_node.outputs['Color'], shader.inputs['Base Color'])
        normal_node = nodes.new('ShaderNodeTexImage')
        normal_node.image = normal
        decoded_normal = nodes.new('ShaderNodeNormalMap')
        links.new(normal_node.outputs['Color'], decoded_normal.inputs['Color'])
        links.new(decoded_normal.outputs['Normal'], shader.inputs['Normal'])
        links.new(shader.outputs['BSDF'], nodes.get('Material Output').inputs['Surface'])
        if contact:
            contact_node = nodes.new('ShaderNodeTexImage')
            contact_node.image = contact
            output = nodes.new('ShaderNodeGroup')
            output.node_tree = settings
            links.new(contact_node.outputs['Color'], output.inputs['Occlusion'])
        if bounce and shader.inputs['Emission Strength'].default_value == 0:
            radiance = nodes.new('ShaderNodeTexImage')
            radiance.image = bounce
            links.new(radiance.outputs['Color'], shader.inputs['Emission Color'])
            shader.inputs['Emission Strength'].default_value = 1-shader.inputs['Metallic'].default_value


def inventory(path):
    binary = path.read_bytes()
    _, version, length, metadata_length, tag = struct.unpack_from('<4sIIII', binary)
    assert version == 2 and length == len(binary) and tag == 0x4e4f534a
    doc = json.loads(binary[20:20+metadata_length])
    assert not doc.get('extensionsRequired')
    assert all('uri' not in x for x in doc['buffers'] + doc['images'])
    primitives = [p for mesh in doc['meshes'] for p in mesh['primitives']]
    triangles = sum(doc['accessors'][p['indices']]['count'] // 3 for p in primitives)
    assert len(binary) <= MAX_BYTES and triangles <= MAX_TRIANGLES, (len(binary),triangles)
    return {'bytes': len(binary), 'triangles': triangles, 'primitives': len(primitives),
            'images': len(doc['images']), 'localBounds': [
                [min(doc['accessors'][p['attributes']['POSITION']]['min'][i] for p in primitives)
                 for i in range(3)],
                [max(doc['accessors'][p['attributes']['POSITION']]['max'][i] for p in primitives)
                 for i in range(3)]]}


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--')+1:]
    destination, cell = Path(args[0]).resolve(), args[1]
    destination.mkdir(parents=True, exist_ok=True)
    collection, origin = CELLS[cell]
    obj = mesh_for(collection, origin, cell)
    # This smaller cell keeps its look with a 768px atlas and fits the
    # existing package budget alongside both permissioned gallery variants.
    color_size = 768 if cell == 'tower' else ALBEDO_RESOLUTION
    lit_room = {'beacon-return':'beacon','foyer-gallery':'foyer'}.get(cell,cell)
    normal_size = {'tower':768,'foyer':896}.get(lit_room,NORMAL_RESOLUTION)
    color = bake(obj, cell+'-albedo', 'DIFFUSE', color_size, destination)
    normal = bake(obj, cell+'-normal', 'NORMAL', normal_size, destination)
    bounce = None
    if lit_room in ('foyer','beacon','gallery','gallery-sealed'):
        lighting = runpy.run_path(str(Path(__file__).with_name('cell-irradiance.py')))
        bounce = lighting['portable_bounce'](obj,lit_room,destination/(cell+'-albedo.png'),color_size,destination)
    contact = bake_contact(obj, cell, destination) if lit_room in ('foyer','beacon','gallery','gallery-sealed') else None
    portable_materials(obj, color, normal, contact, bounce)
    path = destination / (cell+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                              export_animations=False, export_cameras=False, export_lights=False)
    metrics = inventory(path)
    (destination / (cell+'.json')).write_text(json.dumps(metrics, indent=2)+'\n')
    print(json.dumps(metrics))
