import {ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Path, PlaneGeometry, Shape} from 'three';

/**
 * Material surround for a Proyección surface. It inherits the display's
 * transform and leaves the rendered components and pointer targets with A2UI.
 * Coordinates are in the display's own layout units.
 */
function outline(shape,width,height,radius){
  const x=width/2,y=height/2,r=Math.min(x,y,radius);
  shape.moveTo(-x+r,-y);shape.lineTo(x-r,-y);
  shape.quadraticCurveTo(x,-y,x,-y+r);shape.lineTo(x,y-r);
  shape.quadraticCurveTo(x,y,x-r,y);shape.lineTo(-x+r,y);
  shape.quadraticCurveTo(-x,y,-x,y-r);shape.lineTo(-x,-y+r);
  shape.quadraticCurveTo(-x,-y,-x+r,-y);
  return shape;
}

export function createHudMaterialShell({frame, accent, radius=.038, thickness=.10, roughness=.38, markers=[.062,.020]}) {
  const group=new Group();
  group.visible=false;
  const housing=new MeshStandardMaterial({color:frame,roughness,metalness:.28});
  const edge=new MeshStandardMaterial({
    color:accent,roughness:.32,metalness:.28,emissive:accent,emissiveIntensity:.12,
  });
  const light=new MeshBasicMaterial({color:accent,transparent:true,opacity:.78,depthWrite:false});
  const spring={value:0};
  housing.onBeforeCompile=shader=>{
    shader.uniforms.frameSpring=spring;
    shader.vertexShader='uniform float frameSpring;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed.z += frameSpring * sin(position.x * 3.4 + position.y * 8.0);');
  };
  let geometryKey;

  function releaseMeshes(){
    for(const object of [...group.children]){
      object.geometry.dispose();
      object.removeFromParent();
    }
  }
  function part(geometry,material,x,y,z){
    const mesh=new Mesh(geometry,material);
    mesh.position.set(x,y,z);
    group.add(mesh);
  }

  return {group,
    update(bounds,{effects=true,wave=0,lightLevel=0}={}){
      group.visible=!!bounds;
      if(!bounds)return;
      spring.value=effects?wave*.047:0;
      edge.emissiveIntensity=effects?.24+lightLevel:.025;
      light.opacity=effects?Math.min(1,.76+lightLevel):.43;
      const width=bounds.right-bounds.left;
      const height=bounds.top-bounds.bottom;
      const key=`${width}:${height}`;
      group.position.set((bounds.left+bounds.right)/2,(bounds.top+bounds.bottom)/2,0);
      if(key===geometryKey)return;
      geometryKey=key;
      releaseMeshes();

      const frame=outline(new Shape(),width+.087,height+.077,radius);
      frame.holes.push(outline(new Path(),width-.014,height-.014,.019));
      const bezel=new ExtrudeGeometry(frame,{depth:thickness,bevelEnabled:true,bevelThickness:.006,
        bevelSize:.009,bevelSegments:2,curveSegments:8});
      part(bezel,housing,0,0,-.029-thickness);
      const trim=outline(new Shape(),width+.033,height+.036,.024);
      trim.holes.push(outline(new Path(),width+.013,height+.015,.020));
      part(new ExtrudeGeometry(trim,{depth:.009,bevelEnabled:false,curveSegments:7}),edge,0,0,-.021);
      for(const direction of [-1,1]){
        const x=direction*(width/2-.093);
        part(new PlaneGeometry(markers[0],.009),light,x,height/2+.015,.002);
        part(new PlaneGeometry(markers[1],.009),light,x,-height/2-.014,.002);
      }
    },
    dispose(){
      group.removeFromParent();
      releaseMeshes();
      for(const material of [housing,edge,light])material.dispose();
    },
  };
}
