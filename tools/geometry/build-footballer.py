"""Editable stylized footballer, millimetres, Z up, face towards -Y.

The research subject does not supply geometry or factual research content.
Display regions are generated from this source; the separate union is the
single-colour manufacturing mesh. No printer or publication effects.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.metadata
import json
import math
import numpy as np
import trimesh as tm
from shapely.geometry import LineString, Point
from shapely.affinity import scale as polygon_scale

P = {'height_mm': 120.0, 'base_width_mm': 72.0, 'base_depth_mm': 52.0,
     'base_height_mm': 5.0, 'world_height_m': 1.65, 'sphere_subdivisions': 2,
     'ring_segments': 40}
COLORS = {'skin':'#d69d78', 'white':'#f8f5ec', 'sky':'#81c9e6',
          'navy':'#172d43', 'hair':'#4c3024', 'beard':'#67432f',
          'eye':'#2e211d', 'base':'#456e64', 'gold':'#e7c07a'}
parts = []


def add(name, mesh, color):
    mesh.remove_unreferenced_vertices()
    if not mesh.is_watertight or not mesh.is_winding_consistent or mesh.volume <= 0:
        raise ValueError('Invalid source region: ' + name)
    mesh.visual.face_colors = tm.visual.color.hex_to_rgba(COLORS.get(color, color))
    parts.append((name, mesh))
    return mesh


def ellipsoid(name, center, radii, color):
    mesh = tm.creation.icosphere(subdivisions=P['sphere_subdivisions'])
    mesh.apply_scale(radii)
    mesh.apply_translation(center)
    return add(name, mesh, color)


def rod(name, start, end, radius, color):
    start, end = np.array(start, float), np.array(end, float)
    mesh = tm.creation.cylinder(radius=radius, height=np.linalg.norm(end-start), sections=32)
    mesh.apply_transform(tm.geometry.align_vectors([0, 0, 1], end-start))
    mesh.apply_translation((start+end)/2)
    return add(name, mesh, color)


def loft(name, rings, color):
    count = P['ring_segments']
    vertices = []
    for z, rx, ry, cy in rings:
        vertices.extend([(rx*math.cos(2*math.pi*i/count), cy+ry*math.sin(2*math.pi*i/count), z)
                         for i in range(count)])
    faces = []
    for ring in range(len(rings)-1):
        for i in range(count):
            a=ring*count+i; b=ring*count+(i+1)%count; c=b+count; d=a+count
            faces.extend([[a,b,c],[a,c,d]])
    bottom=len(vertices);vertices.append((0,rings[0][3],rings[0][0]))
    top=len(vertices);vertices.append((0,rings[-1][3],rings[-1][0]))
    for i in range(count):
        faces.append([bottom,(i+1)%count,i])
        faces.append([top,(len(rings)-1)*count+i,(len(rings)-1)*count+(i+1)%count])
    return add(name,tm.Trimesh(vertices=vertices,faces=faces,process=True),color)


def number_ten():
    one=LineString([(-5,7),(-3,9),(-3,0)]).buffer(.7,cap_style='round',join_style='round')
    zero=polygon_scale(Point(3,4.5).buffer(1,resolution=20),xfact=2.8,yfact=4.5,origin=(3,4.5))
    hole=polygon_scale(Point(3,4.5).buffer(1,resolution=20),xfact=1.35,yfact=3,origin=(3,4.5))
    for name,polygon in [('jersey-number-one',one),('jersey-number-zero',zero.difference(hole))]:
        mesh=tm.creation.extrude_polygon(polygon,height=1.6,engine='earcut')
        # Polygon X/Y becomes model X/Z; extrusion points to the front (-Y).
        transform=np.array([[1,0,0,0],[0,0,-1,-8.8],[0,1,0,61],[0,0,0,1]],float)
        mesh.apply_transform(transform)
        add(name,mesh,'navy')


def football(center, radius):
    ico=tm.creation.icosphere(subdivisions=0)
    source=np.array(ico.vertices)
    edges=set()
    for a,b,c in ico.faces:
        for i,j in [(a,b),(b,c),(c,a)]:edges.add((int(i),int(j)));edges.add((int(j),int(i)))
    ordered=sorted(edges); index={edge:i for i,edge in enumerate(ordered)}
    vertices=[(2*source[a]+source[b])/3 for a,b in ordered]
    polygons=[]
    for a in range(len(source)):
        ids=[index[(a,b)] for aa,b in ordered if aa==a]
        normal=source[a]/np.linalg.norm(source[a]);axis=np.cross(normal,[0,0,1])
        if np.linalg.norm(axis)<.1:axis=np.cross(normal,[0,1,0])
        axis/=np.linalg.norm(axis);other=np.cross(normal,axis)
        ids.sort(key=lambda i:math.atan2(np.dot(vertices[i],other),np.dot(vertices[i],axis)))
        polygons.append((ids,'navy'))
    for a,b,c in ico.faces:
        polygons.append(([index[(a,b)],index[(b,a)],index[(b,c)],index[(c,b)],index[(c,a)],index[(a,c)]],'white'))
    faces=[];colors=[]
    for ids,color in polygons:
        points=np.array([vertices[i] for i in ids]);centroid=points.mean(axis=0)
        if np.dot(np.cross(points[1]-points[0],points[2]-points[0]),centroid)<0:ids=list(reversed(ids))
        middle=len(vertices);vertices.append(centroid)
        for j in range(len(ids)):
            faces.append([middle,ids[j],ids[(j+1)%len(ids)]])
            colors.append(tm.visual.color.hex_to_rgba(COLORS[color]))
    mesh=tm.Trimesh(vertices=vertices,faces=faces,process=True)
    mesh.apply_scale(radius/np.linalg.norm(mesh.vertices,axis=1).max());mesh.apply_translation(center)
    add('football-truncated-icosahedron',mesh,'white');mesh.visual.face_colors=colors


def build():
    base=tm.creation.cylinder(radius=1,height=P['base_height_mm'],sections=64)
    base.apply_scale([P['base_width_mm']/2,P['base_depth_mm']/2,1]);base.apply_translation([0,0,2.5]);add('oval-plinth',base,'base')
    trim=tm.creation.cylinder(radius=1,height=1.2,sections=64)
    trim.apply_scale([34.5,24.5,1]);trim.apply_translation([0,0,5.1]);add('plinth-rim',trim,'gold')
    for side in [-1,1]:
        x=side*7.5
        ellipsoid(f'boot-{side}',[x,-4,10.0],[7.5,12,6.3],'navy')
        ellipsoid(f'boot-sole-{side}',[x,-4.5,7.2],[7.6,11.8,2.4],'white')
        rod(f'leg-{side}',[x,0,13],[x,0,43],5.7,'skin')
        rod(f'sock-{side}',[x,-.15,14],[x,-.15,29],6.0,'white')
        rod(f'sock-stripe-{side}',[x,-.15,26],[x,-.15,29.3],6.1,'sky')
        ellipsoid(f'shorts-leg-{side}',[x,0,42],[8.0,9.0,10.0],'navy')
    loft('shorts',[(40,11,8.7,0),(48,14.5,10,0),(54,13.2,9.1,0)],'navy')
    torso=loft('jersey',[(50,13,8.8,0),(58,14,9.5,0),(72,17,10.2,0),(78,14.8,8.2,0),(79,11,7,0)],'white')
    centers=torso.triangles_center
    colors=np.array([tm.visual.color.hex_to_rgba(COLORS['sky' if int(math.floor((v[0]+2.5)/5))%2==0 else 'white']) for v in centers])
    torso.visual.face_colors=colors
    for side in [-1,1]:
        ellipsoid(f'sleeve-{side}',[side*16,0,73],[7.8,8.1,8.5],'white')
        rod(f'upper-arm-{side}',[side*18,0,70],[side*23,-1,59],4.7,'skin')
        ellipsoid(f'elbow-{side}',[side*23,-1,59],[4.8,4.8,4.8],'skin')
        rod(f'forearm-{side}',[side*23,-1,59],[side*14.5,-8,54],4.4,'skin')
        ellipsoid(f'hand-{side}',[side*14,-8,54],[4.8,3.8,4.4],'skin')
    rod('neck',[0,0,77],[0,0,89],5.4,'skin')
    ellipsoid('head',[0,-.8,99],[16,14,18],'skin')
    for side in [-1,1]:ellipsoid(f'ear-{side}',[side*15.3,0,99.5],[3,3,4.4],'skin')
    loft('hair-cap',[(104,16.5,13.8,.3),(111,14,12.4,.3),(117,9,8,1),(120,.7,.7,1)],'hair')
    ellipsoid('swept-hair',[ -4,-7.3,113.7],[10,6.8,5.7],'hair')
    for side in [-1,1]:ellipsoid(f'sideburn-{side}',[side*13,-4.5,102],[3.2,6,7.2],'hair')
    ellipsoid('beard',[0,-7.9,90.5],[11.5,7.5,7.8],'beard')
    for side in [-1,1]:ellipsoid(f'beard-cheek-{side}',[side*9,-9.2,94],[3.2,4.6,4.2],'beard')
    ellipsoid('nose',[0,-13.6,100],[2.6,4.1,3.2],'skin')
    for side in [-1,1]:
        ellipsoid(f'eye-{side}',[side*5.5,-13.5,103],[1.15,1.1,1.25],'eye')
        ellipsoid(f'brow-{side}',[side*5.5,-13.3,106],[2.7,1.1,.8],'hair')
    ellipsoid('moustache',[0,-13.5,96.9],[6,2.0,1.6],'beard')
    ellipsoid('mouth',[0,-14.9,94.4],[3.1,.8,.65],'eye')
    number_ten()
    football([-17,-11,14.2],9.1)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path,required=True);args=parser.parse_args()
    args.out.mkdir(parents=True,exist_ok=True);build()
    # Create an actual closed manufacturing solid, rather than exporting a pile
    # of intersecting display shells as if it were one validated print body.
    solid=tm.boolean.union([mesh for _,mesh in parts],engine='manifold',check_volume=True)
    if not solid.is_watertight or not solid.is_winding_consistent or solid.volume<=0:raise ValueError('Invalid union')
    solid.units='mm';solid.export(args.out/'footballer-10-draft.stl')
    scene=tm.Scene()
    for name,mesh in parts:
        # Explicit flat vertex colours avoid interpolating across jersey stripes
        # or football panels, without an optional sparse-matrix dependency.
        vertices=mesh.vertices[mesh.faces].reshape((-1,3))
        faces=np.arange(len(vertices)).reshape((-1,3))
        display_mesh=tm.Trimesh(vertices=vertices,faces=faces,
            vertex_colors=np.repeat(mesh.visual.face_colors,3,axis=0),process=False)
        scene.add_geometry(display_mesh,node_name=name,geom_name=name)
    # Source Z-up millimetres -> glTF Y-up metres. World figure is deliberately
    # enlarged to human scale; this is not manufacturing scale.
    world=scene.copy();transform=tm.transformations.rotation_matrix(-math.pi/2,[1,0,0]);transform[:3,:3]*=P['world_height_m']/P['height_mm'];world.apply_transform(transform)
    (args.out/'footballer-10-world.glb').write_bytes(world.export(file_type='glb'))
    display={'schema':'portable-3d-scene/v1','units':'mm','title':'Messi · draft figure',
             'note':'Original stylized geometry. Research content pending. Not sliced or physically printed.',
             'scope':'Decorative figure prototype','status':'Generated geometry; manufacturing validation recorded separately',
             'dimensions':{k:v for k,v in P.items() if k.endswith('_mm')},'parts':[]}
    for name,mesh in parts:
        colors=mesh.visual.face_colors
        for color in np.unique(colors,axis=0):
            selected=mesh.faces[np.all(colors==color,axis=1)]
            indices,remap=np.unique(selected,return_inverse=True)
            display['parts'].append({'label':name+'-'+color[:3].tobytes().hex(),
                'color':'#'+color[:3].tobytes().hex(),'vertices':mesh.vertices[indices].tolist(),
                'faces':remap.reshape((-1,3)).tolist()})
    (args.out/'scene.json').write_text(json.dumps(display,separators=(',',':'))+'\n')
    reopened=tm.load(args.out/'footballer-10-draft.stl',force='mesh')
    assert reopened.is_watertight and reopened.is_winding_consistent
    assert np.allclose(reopened.bounds,solid.bounds,atol=1e-4)
    checked=tm.load(args.out/'footballer-10-world.glb',force='scene')
    assert len(checked.geometry)==len(parts)
    extent=checked.bounds[1]-checked.bounds[0]
    assert abs(extent[1]-1.65)<.02,extent
    # Exact edge incidence and connected-vertex graph are checked without an
    # optional graph backend, so topology results are not library guesses.
    edges=np.sort(np.concatenate([solid.faces[:,[0,1]],solid.faces[:,[1,2]],solid.faces[:,[2,0]]]),axis=1)
    unique,counts=np.unique(edges,axis=0,return_counts=True);assert np.all(counts==2)
    parent=list(range(len(solid.vertices)))
    def root(a):
        while parent[a]!=a:parent[a]=parent[parent[a]];a=parent[a]
        return a
    for a,b in unique:parent[root(int(a))]=root(int(b))
    components=len({root(i) for i in range(len(parent))});assert components==1,components
    files={f.name:{'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in args.out.iterdir() if f.is_file()}
    report={'schema':'holodeck.figure-validation/v1','parameters':P,'source_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            'versions':{key:importlib.metadata.version(key) for key in ['trimesh','manifold3d','numpy','shapely','mapbox-earcut']},
            'display_regions':len(parts),'manufacturing_triangles':len(solid.faces),'watertight':True,'consistent_winding':True,
            'edge_incidence_two':True,'connected_components':components,'positive_volume_mm3':float(solid.volume),
            'source_bounds_mm':solid.bounds.tolist(),'world_extents_m':extent.tolist(),'export_reopened':True,'files':files,
            'fabrication':'Unsliced decorative prototype; actual printer/nozzle/material/profile and physical trial remain unverified. No printer operation.',
            'gallery_limit':'Display material subsets can be open; their combined triangles exactly preserve each closed source region. The manufacturing mesh is the separate validated union.'}
    (args.out/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['display_regions','manufacturing_triangles','watertight','connected_components','source_bounds_mm','world_extents_m']}))


if __name__=='__main__':main()
