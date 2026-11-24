"""Apply the amber workshop look to the editable combined orbital scene."""
import bpy


# Colors are linear. The two scales give each material large-scale variation
# and a separate finer pattern that can be resolved at worktable distance.
SURFACES = {
    'Orbital deck': ((.065, .041, .030), (.22, .142, .090), 3.3, (1., 1., 1.), (.27, .45)),
    'Orbital panel': ((.18, .142, .104), (.43, .371, .275), 2.8, (1.4, 1., 3.), (.42, .65)),
    'Orbital navy': ((.012, .078, .067), (.072, .235, .171), 4.5, (1., 1., 4.), (.33, .52)),
    'Orbital orange': ((.20, .059, .023), (.47, .21, .08), 3.8, (1., 1., 5.), (.40, .58)),
    'Anodized brushed frames': ((.103, .065, .046), (.31, .19, .12), 6.0, (1., 8., 1.), (.23, .39)),
}


def vary_surface(name, low, high, scale, direction, roughness):
    tree = bpy.data.materials[name].node_tree
    shader = tree.nodes.get('Principled BSDF')
    position = tree.nodes.new('ShaderNodeNewGeometry').outputs['Position']
    stretch = tree.nodes.new('ShaderNodeVectorMath')
    stretch.operation = 'MULTIPLY'
    stretch.inputs[1].default_value = direction
    tree.links.new(position, stretch.inputs[0])
    grain = tree.nodes.new('ShaderNodeTexNoise')
    grain.inputs['Scale'].default_value = scale
    grain.inputs['Detail'].default_value = 5
    tree.links.new(stretch.outputs[0], grain.inputs['Vector'])
    texture = tree.nodes.new('ShaderNodeTexNoise')
    texture.inputs['Scale'].default_value = 35
    tree.links.new(stretch.outputs[0], texture.inputs['Vector'])
    color = tree.nodes.new('ShaderNodeValToRGB')
    for element, value, point in zip(color.color_ramp.elements, (low, high), (.24, .76)):
        element.position = point
        element.color = (*value, 1)
    tree.links.new(grain.outputs['Fac'], color.inputs[0])
    tree.links.new(color.outputs['Color'], shader.inputs['Base Color'])
    finish = tree.nodes.new('ShaderNodeMapRange')
    finish.inputs['To Min'].default_value, finish.inputs['To Max'].default_value = roughness
    tree.links.new(texture.outputs['Fac'], finish.inputs['Value'])
    tree.links.new(finish.outputs[0], shader.inputs['Roughness'])


for role, recipe in SURFACES.items():
    vary_surface(role, *recipe)

LAMPS = {
    'Worktable pendant emission': (206, (1., .78, .54)),
    'Archive canopy emission': (127, (.82, 1., .89)),
    'Window bounce': (42, (.52, .75, .97)),
    'Warm spill from the entrance': (188, (1., .59, .29)),
    'Ceiling soft return': (99, (1., .81, .67)),
    'Workshop side fill': (66, (.56, .86, .75)),
    'Reflected service bay light': (78, (.38, .70, .91)),
}
for obj in bpy.context.scene.objects:
    if obj.type == 'LIGHT':
        power, color = LAMPS[obj.name.split('.')[0]]
        obj.data.energy, obj.data.color = power, color

for name, color in (('Warm opal', (1., .76, .48, 1.)), ('Recess strip cyan', (.25, .78, .64, 1.))):
    shader = bpy.data.materials[name].node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = color
    if shader.inputs['Emission Strength'].default_value > 0:
        shader.inputs['Emission Color'].default_value = color
