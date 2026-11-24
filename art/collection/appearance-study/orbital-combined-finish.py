"""Combined orbital finish for an opened orbital reference scene.

The surface and light treatment builds on the Claude Fable 5.2 pass.
This pass leaves the camera, layout and scene objects in place.
"""
import bpy
from math import radians

scene, mats = bpy.context.scene, bpy.data.materials


def bsdf(mat):
    return next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if mat and mat.node_tree else None


def src(sock):  # whatever drives a socket today (baked AO/texture link or constant), so authored detail survives
    if sock.is_linked:
        return sock.links[0].from_socket
    return sock.default_value[:] if sock.type == 'RGBA' else sock.default_value


def node(tree, kind, ins=(), out=0, **props):
    n = tree.nodes.new(kind)
    for key, value in props.items():
        setattr(n, key, value)
    for key, value in ins:
        if isinstance(value, bpy.types.NodeSocket):
            tree.links.new(value, n.inputs[key])
        else:
            n.inputs[key].default_value = value
    return n.outputs[out]


# Use world height and surface normals to grade horizontal finishes in place.
# The warm, worn deck and cool brushed ceiling share shaders with other fixtures.
def zone_finish(mat):
    b = bsdf(mat)
    if not b:
        return
    t = mat.node_tree
    geo = t.nodes.new('ShaderNodeNewGeometry')
    P = geo.outputs['Position']
    M = lambda op, x, y: node(t, 'ShaderNodeMath', ((0, x), (1, y)), operation=op)
    C = lambda f, x, y, mode='MIX': node(t, 'ShaderNodeMix', ((0, f), (6, x), (7, y)), 2, data_type='RGBA', blend_type=mode)
    F = lambda f, x, y: node(t, 'ShaderNodeMix', ((0, f), (2, x), (3, y)))
    R = lambda v, lo, hi: node(t, 'ShaderNodeMapRange', ((0, v), (1, .3), (2, .7), (3, lo), (4, hi)))
    pz = node(t, 'ShaderNodeSeparateXYZ', ((0, P),), 2)
    nz = node(t, 'ShaderNodeSeparateXYZ', ((0, geo.outputs['Normal']),), 2)
    level = M('GREATER_THAN', M('ABSOLUTE', nz, 0.), .5)
    floor = M('MULTIPLY', level, M('LESS_THAN', pz, .13))
    ceil = M('MULTIPLY', level, M('GREATER_THAN', pz, 3.6))
    grain = node(t, 'ShaderNodeTexNoise', (('Vector', P), ('Scale', 1.7), ('Detail', 7.), ('Roughness', .62)))
    streak = node(t, 'ShaderNodeVectorMath', ((0, P), (1, (1.2, 46., 1.))), operation='MULTIPLY')
    brush = node(t, 'ShaderNodeTexNoise', (('Vector', streak), ('Scale', 1.), ('Detail', 3.)))
    color = src(b.inputs['Base Color'])
    wear = C(grain, (.49, .46, .41, 1.), (.36, .33, .29, 1.))          # warm grey, uneven traffic wear
    color = C(floor, color, wear, 'MULTIPLY')
    color = C(ceil, color, (.68, .73, .78, 1.), 'MULTIPLY')            # cool alloy picks up beam + window colour
    rough = F(floor, src(b.inputs['Roughness']), R(grain, .22, .41))   # sheen breaks up instead of a flat gloss
    rough = F(ceil, rough, R(brush, .27, .43))
    metal = F(ceil, src(b.inputs['Metallic']), .88)
    for key, value in (('Base Color', color), ('Roughness', rough), ('Metallic', metal)):
        t.links.new(value, b.inputs[key])


for name in ('Orbital panel', 'Orbital deck'):
    zone_finish(mats.get(name))


# Deepen the accents and let more light through the panes into the service bay.
def grade(name, hue, sat, val, rough=None, coat=None):
    b = bsdf(mats.get(name))
    if not b:
        return
    t = mats[name].node_tree
    ins = (('Color', src(b.inputs['Base Color'])), ('Hue', hue), ('Saturation', sat), ('Value', val))
    t.links.new(node(t, 'ShaderNodeHueSaturation', ins), b.inputs['Base Color'])
    for key, value in (('Roughness', rough), ('Coat Weight', coat)):
        if value is not None and not b.inputs[key].is_linked:
            b.inputs[key].default_value = value


grade('Orbital orange', .496, 1.13, .89)                 # deeper red-orange structural beams
grade('Orbital navy', .5, 1.70, .62, rough=.52, coat=.04)  # true navy; stops the tabletop mirroring the pendant
grade('Blue graphite rails', .5, 1.40, .80)
for name, tint, rough in (('Clear laminate, service windows', (.55, .72, 1., 1.), .02),
                          ('Clear archive glazing', (.80, .93, .97, 1.), .03)):
    b = bsdf(mats.get(name))
    if b:
        b.inputs['Base Color'].default_value, b.inputs['Roughness'].default_value = tint, rough
b = bsdf(mats.get('Indicator amber'))                    # concept's yellow drawer pulls
if b:
    for key in ('Base Color', 'Emission Color'):
        b.inputs[key].default_value = (1., .60, .03, 1.)

# Place the strongest light around the worktable and keep the room legible.
RIG = {'Worktable pendant emission': (176, (1., .97, .93)), 'Archive canopy emission': (111, (.80, .92, 1.)),
       'Window bounce': (59, (.49, .68, 1.)), 'Warm spill from the entrance': (226, (1., .82, .66)),
       'Ceiling soft return': (105, (.96, .94, .89)), 'Workshop side fill': (37, (.72, .85, 1.))}
for obj in scene.objects:
    if obj.type != 'LIGHT':
        continue
    for key, (power, color) in RIG.items():
        if obj.name.startswith(key):
            obj.data.energy, obj.data.color = power, color
    if obj.name.startswith('Reflected service bay'):
        obj.data.energy, obj.data.color = obj.data.energy * 1.12, (.22, .44, 1.)
    if obj.name.startswith('Worktable pendant'):
        obj.data.spread = radians(140)                   # pool the key on the bench, less wall wash
bg = scene.world.node_tree.nodes.get('Background') if scene.world and scene.world.node_tree else None
if bg:
    bg.inputs['Color'].default_value, bg.inputs['Strength'].default_value = (.12, .15, .21, 1.), .095
fog = mats.get('Orbital cleanroom atmosphere')
for n in (fog.node_tree.nodes if fog and fog.node_tree else ()):
    if n.type == 'VOLUME_SCATTER':                       # forward scatter: halo near sources, no global veil
        n.inputs['Anisotropy'].default_value, n.inputs['Color'].default_value = .6, (.60, .78, 1., 1.)
comp = getattr(scene, 'compositing_node_group', None)
for n in (comp.nodes if comp else ()):
    if n.bl_idname == 'CompositorNodeGlare':             # tighter bloom, only on real emitters
        for key, value in (('Threshold', 3.4), ('Strength', .24), ('Size', .5)):
            if key in n.inputs:
                n.inputs[key].default_value = value
view = scene.view_settings
view.exposure = .30
for look in ('AgX - Medium Low Contrast', 'Medium Low Contrast'):
    try:
        view.look = look
        break
    except TypeError:
        pass
