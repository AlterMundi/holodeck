"""Build the from-scratch Navegante study and render three review angles.

Run in background mode with -- OUTPUT CERAMIC RELIEF CAPE.
The meshes, materials and motion here are authored for Holodeck.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
if len(args) != 4:
    raise SystemExit("Use -- OUTPUT CERAMIC RELIEF CAPE")
out = Path(args[0])
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
    mat.use_backface_culling = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Emission Color"].default_value = (*color, 1)
    shader.inputs["Emission Strength"].default_value = glow
    return mat


porcelain = material("Warm ceramic enamel", (.83, .76, .62), .28, .04)
shell = material("Pearl molded shell", (.92, .87, .74), .29, .04)
seam = material("Graphite elastomer", (.034, .052, .060), .56)
visor = material("Deep petrol optical glass", (.008, .025, .035), .17, .18)
brass = material("Brushed champagne fasteners", (.53, .32, .12), .35, .52)
mantle = material("Petrol woven cape", (.025, .18, .207), .77)
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


def texture_derivative(name, path, size, uv, *, normal=False):
    source=bpy.data.images.load(str(path),check_existing=False)
    if normal:
        source.colorspace_settings.name="Non-Color"
    sw,sh=source.size
    samples=[0.0]*(sw*sh*4)
    source.pixels.foreach_get(samples)
    width,height=size
    image=bpy.data.images.new(name,width,height,alpha=False)
    if normal:
        image.colorspace_settings.name="Non-Color"
    result=[]
    for j in range(height):
        for i in range(width):
            x,y=uv((i+.5)/width,(j+.5)/height)
            ix=min(sw-1,int(x*sw))
            iy=min(sh-1,int(y*sh))
            at=(iy*sw+ix)*4
            result.extend((*samples[at:at+3],1))
    image.pixels.foreach_set(result)
    image.pack()
    bpy.data.images.remove(source)
    return image


def mapped_texture(mat,image,input_name="Base Color"):
    nodes=mat.node_tree.nodes
    texture=nodes.new("ShaderNodeTexImage")
    texture.image=image
    output=texture.outputs["Color"]
    if input_name=="Normal":
        normal=nodes.new("ShaderNodeNormalMap")
        normal.inputs["Strength"].default_value=.45
        mat.node_tree.links.new(output,normal.inputs["Color"])
        output=normal.outputs["Normal"]
    mat.node_tree.links.new(output,nodes.get("Principled BSDF").inputs[input_name])


def encode_srgb(channel):
    return 12.92*channel if channel<=.0031308 else 1.055*channel**(1/2.4)-.055


def engraved_bronze():
    """Bake one repeated scroll band in UV space, with areas of darker patina."""
    width,height=512,32
    repeats=5
    image=bpy.data.images.new("Engraved bronze band",width,height,alpha=False)
    pixels=[]
    for j in range(height):
        v=(j+.5)/height
        for i in range(width):
            u=(i+.5)/width
            phase=(u*repeats)%1
            theta=phase*2*math.pi
            stems=[.5+sign*(.035+.17*math.sin(theta/2)**2+.078*math.sin(2*theta))
                   for sign in (-1,1)]
            leaf=.5+.27*math.sin(theta)
            stroke=min(abs(v-stem) for stem in stems)
            stem_ink=math.exp(-((stroke)/.023)**2)
            leaf_ink=math.exp(-((v-leaf)/.027)**2)*max(0,-math.cos(2*theta))**7
            rim=max(math.exp(-((v-.16)/.025)**2),math.exp(-((v-.84)/.025)**2))
            tooling=.013*math.sin(i*1.36+j*.81)+.009*math.sin(i*2.31-j*.69)
            gilded=min(.53,.28+rim*.16+stem_ink*.18+leaf_ink*.14+tooling)
            colour=(gilded,.58*gilded,.27*gilded)
            pixels.extend((*map(encode_srgb,colour),1))
    image.pixels.foreach_set(pixels)
    image.pack()
    alloy=brass.copy()
    alloy.name="Engraved and patinated bronze"
    mapped_texture(alloy,image)
    normals=texture_derivative("Scrolled bronze relief",args[2],(512,48),
        lambda u,v:(.026+.308*((u*repeats)%1),.920+.050*v),normal=True)
    mapped_texture(alloy,normals,"Normal")
    return alloy


def visor_bezel():
    # A continuous ring meets the visor at its boundary instead of intersecting
    # two solid ellipsoids with different tessellations.
    steps=64
    profile=[(.955,-.173),(1.008,-.165),(1.072,-.135),(1.036,-.099)]
    verts=[(.196*scale*math.cos(i*2*math.pi/steps),y,1.054+.132*scale*math.sin(i*2*math.pi/steps))
           for scale,y in profile for i in range(steps)]
    faces=[(row*steps+i,(row+1)*steps+i,(row+1)*steps+(i+1)%steps,row*steps+(i+1)%steps)
           for row in range(len(profile)-1) for i in range(steps)]
    mesh=bpy.data.meshes.new("Machined visor ring")
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    uv=mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        row,i=divmod(polygon.index,steps)
        corners=((i,row),(i,row+1),(i+1,row+1),(i+1,row))
        for loop,(u,v) in zip(polygon.loop_indices,corners):
            uv.data[loop].uv=(u/steps,v/(len(profile)-1))
    obj=bpy.data.objects.new("Engraved visor bezel",mesh)
    scene.collection.objects.link(obj)
    return part(obj,obj.name,engraved_bronze(),"head")


def shell_line(points,center,width,depth,height,offset=.002):
    cx,cy,cz=center
    return [(x,cy-depth*math.sqrt(max(0,1-((x-cx)/width)**2-((z-cz)/height)**2))-offset,z)
            for x,z in points]


def visor_line(points):
    return shell_line(points,(0,-.138,1.054),.196,.100,.132,.003)


enamel=texture_derivative("Ivory and gold ceramic",args[1],(256,256),lambda u,v:(u,v))
mapped_texture(shell,enamel)

# Overlapping molded shells with solid profile and a separate jaw.
ellipsoid("Helmet dome", (0, .018, 1.044), (.239, .218, .236), shell, "head", 28, 16)
visor_bezel()
ellipsoid("Curved visor", (0, -.138, 1.054), (.196, .100, .132), visor, "head", 32, 16)
ellipsoid("Mouth well", (0, -.132, .936), (.129, .092, .050), seam, "head")
ellipsoid("Hinged ceramic chin", (0, -.132, .910), (.141, .099, .034), porcelain, "anchor-mouth")
stripe("Visor smile", visor_line([(-.034,.990),(-.018,.982),(0,.980),
                                 (.018,.982),(.034,.990)]),.0036,signal,"head")


for side in (-1, 1):
    suffix = "L" if side < 0 else "R"
    x = lambda v: side * v
    eye = "eye-" + suffix
    pupil = ellipsoid("Cyan pupil " + suffix, (x(.083), -.232, 1.062),
                      (.022, .009, .029), signal, eye, 18, 10)
    pupil.rotation_euler.z=side*.31
    stripe("Luminous brow " + suffix,visor_line([(x(.052),1.104),(x(.081),1.113),
           (x(.102),1.111)]),.0043,signal,eye)
    stripe("Crown inlay " + suffix,shell_line(
        [(0,1.234),(x(.040),1.211),(x(.093),1.193),(x(.130),1.203),(x(.153),1.214)],
        (0,.018,1.044),.239,.218,.236),.0035,brass,"head")
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

# The cape hangs from the chest and deforms gradually toward its centered bone.
def cape_point(u, v):
    width=.157+.112*v
    folds=.052*v*math.cos(2.15*math.pi*u)
    x=u*width
    y=.094+.183*v+.007*(1-u*u)+folds
    z=.786-.422*v-.020*u*u*(1-v)+.048*u*u*v+.019*v*math.cos(2.15*math.pi*u)
    return (x,y,z)


columns, rows = 16, 9
levels = [0,.06,.15,.27,.42,.58,.73,.88,.977,1]
widths = [-1]+[-.956+1.912*i/(columns-2) for i in range(columns-1)]+[1]
verts=[cape_point(u,v) for v in levels for u in widths]
faces=[(j*(columns+1)+i,j*(columns+1)+i+1,(j+1)*(columns+1)+i+1,(j+1)*(columns+1)+i)
       for j in range(rows) for i in range(columns)]
cape_mesh=bpy.data.meshes.new("Tailored cape")
cape_mesh.from_pydata(verts,[],faces)
cape_mesh.update()
cape=bpy.data.objects.new("Tailored cape",cape_mesh)
scene.collection.objects.link(cape)
cloth=mantle.copy()
cloth.name="Woven and embroidered cape"
cloth.use_backface_culling=False
fabric=texture_derivative("Teal weave and embroidered hem",args[3],(256,224),lambda u,v:(u,v))
mapped_texture(cloth,fabric)
part(cape,cape.name,cloth,None)
uv=cape_mesh.uv_layers.new(name="UVMap")
for face in cape_mesh.polygons:
    for index in face.loop_indices:
        v,u=divmod(cape_mesh.loops[index].vertex_index,columns+1)
        uv.data[index].uv=((widths[u]+1)/2,1-levels[v])
collar=cape.vertex_groups.new(name="chest")
drape=cape.vertex_groups.new(name="cape")
for j,v in enumerate(levels):
    weight=v*v*(3-2*v)
    indices=list(range(j*(columns+1),(j+1)*(columns+1)))
    if weight<1:collar.add(indices,1-weight,"REPLACE")
    if weight>0:drape.add(indices,weight,"REPLACE")

# A small compass clasp and collar give the fabric a visible front attachment.
stripe("Shoulder scarf", [(-.150,.102,.770),(-.123,-.071,.791),
                         (-.057,-.103,.802),(.064,-.103,.798),(.117,-.069,.783),
                         (.151,.101,.769)], .022, mantle, "chest")
rod("Compass clasp", (-.089,-.095,.782),(-.089,-.126,.782),.035,brass,"chest")
rod("Clasp enamel", (-.089,-.125,.782),(-.089,-.128,.782),.027,seam,"chest")
for angle in (0,math.pi/2):
    dx,dz=.020*math.sin(angle),.020*math.cos(angle)
    rod("Compass needle",(-.089-dx,-.131,.782-dz),(-.089+dx,-.131,.782+dz),.003,brass,"chest")
ellipsoid("Compass pin",(-.089,-.132,.782),(.006,.004,.006),signal,"chest",10,6)
stripe("Breastplate inlay", shell_line([(-.112,.664),(-.068,.636),(0,.617),(.068,.636),(.112,.664)],
       (0,.018,.622),.166,.127,.208),.0043,brass,"chest")

for side in (-1, 1):
    suffix = "L" if side < 0 else "R"
    x = lambda v: side * v
    arm, elbow, wrist = ("arm-"+suffix, "elbow-"+suffix, "hand-"+suffix)
    direction = "left" if side < 0 else "right"
    thigh, knee, shoe = ("leg-"+direction, "shin-"+direction, "foot-"+suffix)
    ellipsoid("Shoulder gimbal " + suffix, (x(.164), .009, .737), (.058, .058, .058), seam, arm)
    upper=ellipsoid("Upper arm shell " + suffix, (x(.196), .010, .674), (.046, .047, .072), porcelain, arm)
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
    rod("Knee bronze pivot " + suffix,(x(.121),-.006,.302),(x(.148),-.006,.302),.033,brass,knee)
    rod("Knee dark bearing " + suffix,(x(.148),-.006,.302),(x(.151),-.006,.302),.020,seam,knee)
    ellipsoid("Shin shell " + suffix, (x(.109), .006, .218), (.068, .065, .093), porcelain, knee)
    housing("Sole tread " + suffix, (x(.113), -.030, .034), (.143,.217,.064), .025, seam, shoe)
    housing("Boot welt " + suffix, (x(.113), -.030, .057), (.145,.214,.028), .012, brass, shoe)
    ellipsoid("Boot shell " + suffix, (x(.113), -.031, .091), (.072,.115,.056), porcelain, shoe)
    stripe("Boot seam " + suffix, [(x(.062), -.101, .080), (x(.111), -.134, .093),
                                   (x(.165), -.102, .080)], .004, seam, shoe)

# Rigid shells follow individual joints; the fabric keeps its two-bone gradient.
joints = {"root":((0,0,0),None),"hips":((0,0,.43),"root"),
          "chest":((0,0,.52),"hips"),"head":((0,.012,.871),"chest"),
          "anchor-mouth":((0,-.077,.940),"head"),
          "cape":((0,.145,.786),"chest"),"antenna":((.163,.081,1.186),"head"),
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
    if bone is not None:
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
    "calm":{"chest":(1,0,0),"head":(-2,-3,0),"cape":(2,1,0)},
    "curious":{"head":(-13,14,0),"antenna":(-11,0,2),"chest":(-5,0,0)},
    "joy":{"head":(8,0,0),"arm-L":(2,-24,0),"arm-R":(2,24,0),"elbow-L":(25,0,0),"elbow-R":(25,0,0)},
    "sad":{"chest":(-12,0,0),"head":(-14,-7,0),"antenna":(17,0,0)},
    "anger":{"head":(-9,0,0),"eye-L":(0,-16,0),"eye-R":(0,16,0),"arm-L":(-12,-8,0),"arm-R":(-12,8,0)},
    "uncertain":{"head":(10,-12,0),"arm-L":(-5,-18,0),"elbow-L":(40,0,0)},
    "focus":{"chest":(-8,0,0),"head":(-7,0,0),"eye-L":(0,8,0),"eye-R":(0,-8,0)},
    "welcome":{"head":(4,-5,0),"arm-L":(0,-33,0),"arm-R":(0,34,0),"elbow-R":(30,0,0)},
    "sleep":{"chest":(-17,0,0),"head":(-19,8,0),"cape":(3,-4,0)},
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
          "elbow-L":(-9,0,0),"elbow-R":(-9,0,0),"chest":(0,0,3*swing),"cape":(3+3*swing*swing,2*swing,0)}
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
        "cape":(4+12*lean+2*breath,2*breath,0),"antenna":(-4*lean+3*breath,0,0),
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
    export_texcoords=True,export_meshopt_compression_enable=True,
    export_meshopt_extension="EXT_meshopt_compression",export_optimize_animation_keep_anim_armature=False)

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
