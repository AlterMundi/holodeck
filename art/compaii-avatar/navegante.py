"""Build the from-scratch Navegante study and render three review angles.

Run with Blender in background mode. Pass the output directory after --.
The meshes, materials and motion here are authored for Holodeck.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

out = Path(sys.argv[sys.argv.index("--") + 1])
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.frame_start = 0
bpy.context.preferences.filepaths.save_version = 0
parts = []


def material(name, color, roughness, metal=0, glow=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Emission Color"].default_value = (*color, 1)
    shader.inputs["Emission Strength"].default_value = glow
    return mat


porcelain = material("Warm ceramic enamel", (.81, .73, .60), .32, .08)
shell = material("Pearl molded shell", (.91, .88, .78), .36, .1)
seam = material("Graphite elastomer", (.034, .052, .060), .56)
visor = material("Deep petrol optical glass", (.011, .046, .064), .23, .32)
brass = material("Brushed champagne fasteners", (.39, .24, .11), .34, .56)
mantle = material("Dyed teal shoulder laminate", (.058, .22, .22), .59)
signal = material("Turquoise indicators", (.035, .74, .81), .31, .14, 1.1)


def part(obj, name, mat, bone):
    obj.name = name
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    parts.append((obj, bone))
    return obj


def ellipsoid(name, at, size, mat, bone, segments=14, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=at)
    obj = bpy.context.object
    obj.scale = size
    return part(obj, name, mat, bone)


def housing(name, at, size, radius, mat, bone):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new("Molded radius", "BEVEL")
    bevel.width = radius
    bevel.segments = 2
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    bpy.ops.object.modifier_apply(modifier="Weighted corner normals")
    return part(obj, name, mat, bone)


def rod(name, a, b, radius, mat, bone):
    edge = Vector(b) - Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=edge.length,
                                       location=(Vector(a) + Vector(b)) / 2)
    obj = bpy.context.object
    obj.rotation_euler = edge.to_track_quat("Z", "Y").to_euler()
    return part(obj, name, mat, bone)


def stripe(name, points, radius, mat, bone):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 4
    curve.bevel_depth = radius
    curve.bevel_resolution = 1
    curve.use_fill_caps = True
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for p, xyz in zip(spline.bezier_points, points):
        p.co = xyz
        p.handle_left_type = p.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    return part(obj, name, mat, bone)


# Overlapping molded shells with solid profile and a separate jaw.
ellipsoid("Helmet dome", (0, .018, 1.044), (.246, .210, .236), shell, "head", 28, 16)
ellipsoid("Visor compression gasket", (0, -.125, 1.037), (.211, .111, .154), seam, "head", 32, 16)
ellipsoid("Curved visor", (0, -.138, 1.054), (.196, .100, .132), visor, "head", 32, 16)
ellipsoid("Mouth well", (0, -.132, .936), (.129, .092, .050), seam, "head")
ellipsoid("Hinged ceramic chin", (0, -.132, .912), (.145, .103, .045), porcelain, "anchor-mouth")
ellipsoid("Center nose", (0, -.237, .998), (.023, .016, .020), porcelain, "head", 14, 8)


def visor_line(points):
    return [(x, -.141 - .100*math.sqrt(1-(x/.196)**2-((z-1.054)/.132)**2), z)
            for x,z in points]


for side in (-1, 1):
    suffix = "L" if side < 0 else "R"
    x = lambda v: side * v
    eye = "eye-" + suffix
    stripe("Visor eyelid " + suffix,visor_line([(x(.043),1.050),(x(.088),1.068),(x(.132),1.050)]),.009,signal,eye)
    stripe("Brow " + suffix,visor_line([(x(.047),1.095),(x(.082),1.108),(x(.122),1.107)]),.006,signal,eye)
    rod("Ear hinge " + suffix, (x(.203), .025, 1.035), (x(.255), .025, 1.035), .076, seam, "head")
    rod("Ear cap " + suffix, (x(.242), .025, 1.035), (x(.267), .025, 1.035), .061, brass, "head")
    rod("Ear enamel " + suffix, (x(.264), .025, 1.035), (x(.274), .025, 1.035), .046, porcelain, "head")
    for k in (-1, 0, 1):
        rod("Acoustic slot " + suffix, (x(.275), .000, 1.035+k*.015),
            (x(.275), .050, 1.035+k*.015), .0035, seam, "head")

rod("Offset aerial", (.163, .081, 1.186), (.200, .105, 1.322), .012, brass, "antenna")
ellipsoid("Receiver light", (.200, .105, 1.322), (.022, .022, .021), signal, "antenna", 12, 8)
rod("Neck", (0, .012, .782), (0, .012, .911), .062, seam, "chest")
ellipsoid("Pearl torso", (0, .018, .622), (.166, .127, .208), shell, "chest", 24, 14)
ellipsoid("Pelvis gasket", (0, .020, .466), (.132, .102, .085), seam, "hips")
housing("Hip shield", (0, -.034, .456), (.241, .133, .113), .040, porcelain, "hips")
housing("Rear service pod", (0, .129, .640), (.170, .105, .216), .032, seam, "chest")
housing("Rear shell cover", (0, .187, .644), (.139, .035, .180), .016, porcelain, "chest")
for k in range(3):
    z=.622+k*.022
    rod("Rear vent", (-.041, .207, z), (.041, .207, z), .006, seam, "chest")
ellipsoid("Rear indicator", (0, .212, .590), (.017, .008, .010), signal, "chest", 12, 8)

# The asymmetrical mantle is a solid cushioned shell with a rolled edge.
wing=ellipsoid("Teal shoulder mantle", (-.115, .055, .768), (.163, .142, .060), mantle, "mantle", 24, 12)
wing.rotation_euler.y=-.27
tail=ellipsoid("Fold over rear shoulder", (-.143, .155, .702), (.103, .049, .128), mantle, "mantle")
tail.rotation_euler.y=.28
stripe("Mantle bound edge", [(-.250, -.004, .740), (-.177, -.060, .779),
                             (-.076, -.074, .806), (.016, -.056, .813)], .010, porcelain, "mantle")
ellipsoid("Mantle clasp", (-.066, -.093, .778), (.031, .016, .029), brass, "chest", 14, 8)
ellipsoid("Clasp lamp", (-.066, -.109, .778), (.014, .006, .014), signal, "chest", 12, 8)

for side in (-1, 1):
    suffix = "L" if side < 0 else "R"
    x = lambda v: side * v
    arm, elbow, wrist = ("arm-"+suffix, "elbow-"+suffix, "hand-"+suffix)
    direction = "left" if side < 0 else "right"
    thigh, knee, shoe = ("leg-"+direction, "shin-"+direction, "foot-"+suffix)
    ellipsoid("Shoulder gimbal " + suffix, (x(.164), .009, .737), (.058, .058, .058), seam, arm)
    upper=ellipsoid("Upper arm shell " + suffix, (x(.196), .010, .674), (.046, .047, .072), shell, arm)
    upper.rotation_euler.y=-side*.36
    ellipsoid("Elbow joint " + suffix, (x(.223), .004, .622), (.033, .035, .035), seam, elbow)
    fore=ellipsoid("Tapered fore shell " + suffix, (x(.241), -.006, .563), (.044, .046, .069), porcelain, elbow)
    fore.rotation_euler.y=-side*.24
    ellipsoid("Palm " + suffix, (x(.251), -.014, .500), (.045, .029, .044), seam, wrist)
    housing("Palm guard " + suffix, (x(.255), -.036, .507), (.067, .020, .056), .009, shell, wrist)
    ellipsoid("Pinch thumb " + suffix, (x(.220), -.023, .489), (.019, .021, .030), porcelain, wrist, 12, 8)
    for index in range(3):
        ellipsoid("Fingertip " + suffix, (x(.237+.014*index), -.015, .466),
                  (.010, .019, .022), porcelain, wrist, 10, 6)
    ellipsoid("Hip joint " + suffix, (x(.085), .006, .431), (.054, .053, .055), seam, thigh)
    ellipsoid("Thigh shell " + suffix, (x(.095), .006, .359), (.060, .059, .076), porcelain, thigh)
    ellipsoid("Knee pivot " + suffix, (x(.103), -.006, .302), (.047, .047, .053), seam, knee)
    ellipsoid("Shin shell " + suffix, (x(.109), .006, .218), (.068, .065, .093), shell, knee)
    housing("Sole tread " + suffix, (x(.113), -.030, .034), (.143,.217,.064), .025, seam, shoe)
    ellipsoid("Boot shell " + suffix, (x(.113), -.031, .091), (.072,.115,.056), porcelain, shoe)
    stripe("Boot seam " + suffix, [(x(.062), -.101, .080), (x(.111), -.134, .093),
                                   (x(.165), -.102, .080)], .004, seam, shoe)

# Each manufactured part follows precisely one bone, without rubbery joint deformation.
joints = {"root":((0,0,0),None),"hips":((0,0,.43),"root"),
          "chest":((0,0,.52),"hips"),"head":((0,.012,.871),"chest"),
          "anchor-mouth":((0,-.077,.940),"head"),"mantle":((-.11,.011,.772),"chest"),
          "antenna":((.163,.081,1.186),"head"),
          "eye-L":((-.088,-.226,1.065),"head"),"eye-R":((.088,-.226,1.065),"head")}
for side in (-1,1):
    suffix="L" if side<0 else "R"
    direction="left" if side<0 else "right"
    joints.update({
        "arm-"+suffix:((side*.164,.009,.737),"chest"),
        "elbow-"+suffix:((side*.223,.004,.622),"arm-"+suffix),
        "hand-"+suffix:((side*.251,-.014,.510),"elbow-"+suffix),
        "leg-"+direction:((side*.085,.006,.431),"hips"),
        "shin-"+direction:((side*.103,-.006,.302),"leg-"+direction),
        "foot-"+suffix:((side*.113,-.004,.126),"shin-"+direction),
    })
rig=bpy.data.objects.new("Navegante armature",bpy.data.armatures.new("Rigid mechanism"))
scene.collection.objects.link(rig)
bpy.ops.object.select_all(action="DESELECT")
bpy.context.view_layer.objects.active=rig
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
for name,(xyz,parent) in joints.items():
    bone=rig.data.edit_bones.new(name)
    bone.head=xyz
    bone.tail=Vector(xyz)+Vector((0,.065,0))
    if parent:bone.parent=rig.data.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT")

bpy.ops.object.select_all(action="DESELECT")
for obj,bone in parts:
    obj.vertex_groups.new(name=bone).add([v.index for v in obj.data.vertices],1,"REPLACE")
    obj.select_set(True)
bpy.context.view_layer.objects.active=parts[0][0]
bpy.ops.object.join()
skin=bpy.context.object
skin.name="Navegante ceramic and mechanism"
skin.parent=rig
modifier=skin.modifiers.new("Rigid weighted joints","ARMATURE")
modifier.object=rig

poses={
    "calm":{"chest":(1,0,0),"head":(-2,-3,0),"mantle":(0,2,0)},
    "curious":{"head":(-13,14,0),"antenna":(-11,0,2),"chest":(-5,0,0)},
    "joy":{"head":(8,0,0),"arm-L":(2,-24,0),"arm-R":(2,24,0),"elbow-L":(25,0,0),"elbow-R":(25,0,0)},
    "sad":{"chest":(-12,0,0),"head":(-14,-7,0),"antenna":(17,0,0)},
    "anger":{"head":(-9,0,0),"eye-L":(0,-16,0),"eye-R":(0,16,0),"arm-L":(-12,-8,0),"arm-R":(-12,8,0)},
    "uncertain":{"head":(10,-12,0),"arm-L":(-5,-18,0),"elbow-L":(40,0,0)},
    "focus":{"chest":(-8,0,0),"head":(-7,0,0),"eye-L":(0,8,0),"eye-R":(0,-8,0)},
    "welcome":{"head":(4,-5,0),"arm-L":(0,-33,0),"arm-R":(0,34,0),"elbow-R":(30,0,0)},
    "sleep":{"chest":(-17,0,0),"head":(-19,8,0),"mantle":(0,-7,0)},
}


def clip(name, frames):
    action=bpy.data.actions.new(name)
    rig.animation_data_create()
    rig.animation_data.action=action
    names=sorted({bone for _,pose,_ in frames for bone in pose})
    for frame,pose,bob in frames:
        for bone in names:
            current=rig.pose.bones[bone]
            current.rotation_mode="XYZ"
            current.rotation_euler=tuple(math.radians(v) for v in pose.get(bone,(0,0,0)))
            current.keyframe_insert(data_path="rotation_euler",frame=frame-1,group=bone)
        hips=rig.pose.bones["hips"]
        hips.location.z=bob
        hips.keyframe_insert(data_path="location",frame=frame-1,group="hips")
    rig.animation_data.action=None
    track=rig.animation_data.nla_tracks.new()
    track.name=name
    track.strips.new(name,0,action)
    track.mute=True


def stride(t):
    swing=math.cos(2*math.pi*t)
    bob=-.024+.005*(1-swing*swing)
    pose={"arm-L":(14*swing,0,0),"arm-R":(-14*swing,0,0),
          "elbow-L":(-9,0,0),"elbow-R":(-9,0,0),"chest":(0,0,3*swing),"mantle":(0,2*swing,0)}
    for direction,suffix,offset in (("left","L",0),("right","R",.5)):
        phase=(t+offset)%1
        if phase<.5:
            y=-.099+.396*phase
            lift=0
        else:
            angle=math.pi*(phase-.5)*2
            y=.099*math.cos(angle)
            lift=.062*math.sin(angle)**2
        hip,shin,ankle=[joints[name][0] for name in ("leg-"+direction,"shin-"+direction,"foot-"+suffix)]
        upper=(shin[1]-hip[1],hip[2]-shin[2])
        lower=(ankle[1]-shin[1],shin[2]-ankle[2])
        a,b=math.hypot(*upper),math.hypot(*lower)
        down=hip[2]-ankle[2]+bob-lift
        length=min(a+b-1e-6,math.hypot(y,down))
        knee=math.acos((length*length-a*a-b*b)/(2*a*b))
        thigh=math.atan2(y,down)-math.atan2(b*math.sin(knee),a+b*math.cos(knee))
        thigh_delta=thigh-math.atan2(*upper)
        knee_delta=knee-math.atan2(*lower)+math.atan2(*upper)
        pose["leg-"+direction]=(math.degrees(thigh_delta),0,0)
        pose["shin-"+direction]=(math.degrees(knee_delta),0,0)
        pose["foot-"+suffix]=(-math.degrees(thigh_delta+knee_delta),0,0)
    return pose,bob
for name,pose in poses.items():
    clip(name,[(1,{},0),(25,pose,.012 if name in ("calm","joy") else 0),(50,{},0)])
clip("walk",[(frame+1,*stride(frame/28)) for frame in range(0,29,2)])

def flight_pose(t, moving):
    breath=math.sin(2*math.pi*t)
    lean=1 if moving else 0
    return {
        "chest":(5+11*lean,0,1.3*breath),
        "head":(-5-8*lean,2*breath,0),
        "arm-L":(-9-13*lean+2*breath,-13-5*lean,0),
        "arm-R":(-9-13*lean-2*breath,13+5*lean,0),
        "elbow-L":(-15+2*breath,0,0),"elbow-R":(-15-2*breath,0,0),
        "leg-left":(-8-16*lean+3*breath,0,0),
        "leg-right":(-8-16*lean-3*breath,0,0),
        "shin-left":(19+9*lean-2*breath,0,0),
        "shin-right":(19+9*lean+2*breath,0,0),
        "foot-L":(-10-6*lean,0,0),"foot-R":(-10-6*lean,0,0),
        "mantle":(-2-8*lean,3*breath,0),"antenna":(-4*lean+3*breath,0,0),
    }, .008*breath

for name,moving in (("hover",False),("glide",True)):
    clip(name,[(1+i*8,*flight_pose(i/8,moving)) for i in range(9)])

for bone in rig.pose.bones:
    bone.rotation_euler=(0,0,0)
    bone.location=(0,0,0)

scene.render.fps=30
scene.frame_set(1)
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
skin.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(out/"navegante.blend"))
for track in rig.animation_data.nla_tracks:track.mute=False
bpy.ops.export_scene.gltf(filepath=str(out/"navegante.glb"),export_format="GLB",use_selection=True,
    export_animation_mode="NLA_TRACKS",export_animations=True,export_materials="EXPORT",
    export_texcoords=False,export_optimize_animation_keep_anim_armature=False)

# Studio photographs are local qualification, separate from the game mesh.
for track in rig.animation_data.nla_tracks:track.mute=True
rig.animation_data.action=None
for bone in rig.pose.bones:
    bone.matrix_basis.identity()
scene.frame_set(0)
bpy.context.view_layer.update()
floor=material("Studio slate",(.045,.068,.078),.77)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.004))
bpy.context.object.data.materials.append(floor)
scene.world=bpy.data.worlds.new("Cool grey environment")
scene.world.use_nodes=True
scene.world.node_tree.nodes["Background"].inputs[0].default_value=(.10,.14,.18,1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value=.40


def area(name, at, energy, size, color):
    light=bpy.data.lights.new(name,"AREA")
    light.energy,light.size,light.color=energy,size,color
    obj=bpy.data.objects.new(name,light)
    scene.collection.objects.link(obj)
    obj.location=at
    obj.rotation_euler=(Vector((0,0,.65))-obj.location).to_track_quat("-Z","Y").to_euler()


area("Warm key",(-3,-4,5),560,4.0,(1,.84,.68))
area("Cool fill",(3,-2,2.7),280,3.0,(.64,.84,1))
area("Edge light",(1,3,3),530,2.5,(.55,.86,1))
camera=bpy.data.cameras.new("Studio")
view=bpy.data.objects.new("Studio",camera)
scene.collection.objects.link(view)
scene.camera=view
camera.type="ORTHO"
camera.ortho_scale=1.62
scene.render.engine="CYCLES"
scene.cycles.samples=20
scene.cycles.use_denoising=True
scene.render.resolution_x=620
scene.render.resolution_y=660
scene.render.resolution_percentage=100
for name,at in {"front":(1.0,-3.4,1.54),"profile":(3.6,-.23,1.38),"rear":(-1.6,3.4,1.56)}.items():
    view.location=at
    view.rotation_euler=(Vector((0,0,.65))-view.location).to_track_quat("-Z","Y").to_euler()
    scene.render.filepath=str(out/(name+".png"))
    bpy.ops.render.render(write_still=True)
