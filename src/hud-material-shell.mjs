import {Color, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Path, PlaneGeometry, ShaderMaterial, Shape, Vector2} from 'three';

/**
 * Material surround for a Proyección surface. It inherits the display's
 * transform and leaves the rendered components and pointer targets with A2UI.
 * Coordinates are in the display's own layout units.
 */
function outline(shape,width,height,radius,chamfer){
  const x=width/2,y=height/2,r=Math.min(x,y,radius);
  if(chamfer){
    shape.moveTo(-x+r,-y);
    for(const [px,py] of [[x-r,-y],[x,-y+r],[x,y-r],[x-r,y],[-x+r,y],[-x,y-r],[-x,-y+r],[-x+r,-y]])shape.lineTo(px,py);
    return shape;
  }
  shape.moveTo(-x+r,-y);shape.lineTo(x-r,-y);
  shape.quadraticCurveTo(x,-y,x,-y+r);shape.lineTo(x,y-r);
  shape.quadraticCurveTo(x,y,x-r,y);shape.lineTo(-x+r,y);
  shape.quadraticCurveTo(-x,y,-x,y-r);shape.lineTo(-x,-y+r);
  shape.quadraticCurveTo(-x,-y,-x+r,-y);
  return shape;
}

export function createHudMaterialShell({frame, accent, radius=.038, thickness=.10, roughness=.38, markers=[.062,.020], chamfer=false, quiet=false}) {
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
      edge.emissiveIntensity=effects?(quiet?.08+lightLevel*.12:.24+lightLevel):.025;
      light.opacity=effects?Math.min(1,.76+lightLevel):.43;
      const width=bounds.right-bounds.left;
      const height=bounds.top-bounds.bottom;
      const key=`${width}:${height}`;
      group.position.set((bounds.left+bounds.right)/2,(bounds.top+bounds.bottom)/2,0);
      if(key===geometryKey)return;
      geometryKey=key;
      releaseMeshes();

      const frame=outline(new Shape(),width+(quiet?.076:.087),height+(quiet?.066:.077),radius,chamfer);
      frame.holes.push(outline(new Path(),width-.014,height-.014,.019,chamfer));
      const bezel=new ExtrudeGeometry(frame,{depth:thickness,bevelEnabled:true,bevelThickness:.006,
        bevelSize:.009,bevelSegments:2,curveSegments:8});
      part(bezel,housing,0,0,-.029-thickness);
      const trimRadius=quiet?.053:.024;
      const trim=outline(new Shape(),width+.033,height+.036,trimRadius,chamfer);
      trim.holes.push(outline(new Path(),width+.013,height+.015,trimRadius-.004,chamfer));
      part(new ExtrudeGeometry(trim,{depth:.009,bevelEnabled:false,curveSegments:7}),edge,0,0,-.021);
      if(markers)for(const direction of [-1,1]){
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

// One optical layer behind the catalog's transparent backing plate.
export function createInstrumentGlass(){
  const uniforms={
    size:{value:new Vector2()},reflection:{value:new Color()},rim:{value:new Color()},
    brass:{value:new Color()},pulse:{value:0},
  };
  const material=new ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,toneMapped:false,
    vertexShader:`
      varying vec2 paneUv;
      void main(){
        paneUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }
    `,
    fragmentShader:`
      uniform vec2 size;
      uniform vec3 reflection,rim,brass;
      uniform float pulse;
      varying vec2 paneUv;
      void main(){
        vec2 p=(paneUv-.5)*size;
        vec2 edge=abs(p)-size*.5+vec2(.037);
        float bevel=max(max(edge.x,edge.y),.7071*(edge.x+edge.y)+.011);
        float aa=max(fwidth(bevel),.002);
        float inside=1.0-smoothstep(-aa,aa,bevel);
        if(inside<.001)discard;
        float top=pow(paneUv.y,4.0);
        float chrome=1.0-smoothstep(aa*.4,aa*1.6,abs(bevel+.009));
        float fromTop=size.y*.5-p.y;
        float fromSide=size.x*.5-abs(p.x);
        float copper=chrome*(1.0-smoothstep(.065,.08,fromTop))*
          (1.0-smoothstep(.105,.135,fromSide));
        float sheen=.28+.28*top+.14*(1.0-smoothstep(.0,.24,abs(paneUv.y+paneUv.x*.26-1.04)));
        vec3 glaze=mix(reflection,rim,chrome*.76);
        glaze=mix(glaze,brass,copper*.86);
        gl_FragColor=vec4(glaze,inside*min(1.0,sheen+chrome*(.54+pulse*.12)));
        #include <colorspace_fragment>
      }
    `,
  });
  const geometry=new PlaneGeometry(1,1);
  const group=new Mesh(geometry,material);
  group.raycast=()=>{};
  group.renderOrder=-1;
  return {group,
    update(bounds,{colors,effects=true,lightLevel=0}){
      const width=bounds.right-bounds.left+.096,height=bounds.top-bounds.bottom+.096;
      group.position.set((bounds.left+bounds.right)/2,(bounds.top+bounds.bottom)/2,-.075);
      group.scale.set(width,height,1);
      uniforms.size.value.set(width,height);
      uniforms.reflection.value.set(colors.fill);
      uniforms.rim.value.set(colors.rim);
      uniforms.brass.value.set(colors.brass);
      uniforms.pulse.value=effects?Math.min(1,lightLevel):0;
    },
    dispose(){
      group.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}
