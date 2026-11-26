// Matches the horizontal surfaces in both maintained Foyer GLBs. Use local
// metres so the same finish follows the model in either permitted room view.
const surfaces=new Map([
  ['Honed honey limestone','deck'],
  ['Ivory limewash','path'],
  ['Split basalt','inlay'],
]);
const levels={deck:'.096',path:'.109',inlay:'.107'};

const masonry=`
float foyerHash(vec2 tile) {
  vec3 p=fract(tile.xyx*vec3(.1031,.11369,.13787));
  p+=dot(p,p.yzx+19.19);
  return fract((p.x+p.y)*p.z);
}
float foyerCourse(vec2 plane,vec2 pitch) {
  float row=floor(plane.y/pitch.y);
  vec2 slab=vec2(plane.x/pitch.x+.46*mod(row,2.0),plane.y/pitch.y);
  vec2 joint=min(fract(slab),1.0-fract(slab))*pitch;
  float width=max(fwidth(plane.x),fwidth(plane.y));
  float cut=(1.0-smoothstep(.006,.013+width,min(joint.x,joint.y)))*
    (1.0-smoothstep(.024,.098,width));
  float grain=1.0-smoothstep(.046,.23,width);
  return mix(.995,.96+.069*foyerHash(floor(slab)),grain)-.19*cut;
}
`;

const inlay=`
float foyerSpan(vec2 p,vec2 a,vec2 b) {
  vec2 s=b-a;
  return length(p-a-s*clamp(dot(p-a,s)/dot(s,s),0.0,1.0));
}
float foyerRouteEdge(vec2 p) {
  // Centreline of the authored basalt course, in the coordinates of the GLB.
  float edge=foyerSpan(p,vec2(0.0,5.57),vec2(0.0,3.66));
  edge=min(edge,foyerSpan(p,vec2(0.0,3.66),vec2(-1.72,1.50)));
  edge=min(edge,foyerSpan(p,vec2(-1.72,1.50),vec2(-1.92,-1.42)));
  edge=min(edge,foyerSpan(p,vec2(-1.92,-1.42),vec2(-2.18,-3.45)));
  edge=min(edge,foyerSpan(p,vec2(-2.18,-3.45),vec2(-3.0,-4.66)));
  return min(edge,foyerSpan(p,vec2(-3.0,-4.66),vec2(-3.0,-5.75)));
}
`;

const finishes={
  deck:`
    float foyerValue=foyerCourse(foyerPoint.xz,vec2(1.14,.88));
    // Low contrast variation keeps the pale route readable from the door.
    outgoingLight*=mix(1.0,.91*foyerValue,foyerFloor);
  `,
  path:`
    float foyerValue=foyerCourse(vec2(0.25*foyerPoint.x,foyerPoint.z),vec2(3.6,1.22));
    outgoingLight*=mix(1.0,foyerValue,foyerFloor);
  `,
  inlay:`
    float metalDistance=abs(foyerRouteEdge(foyerPoint.xz)-.479);
    float foyerFootprint=max(fwidth(foyerPoint.x),fwidth(foyerPoint.z));
    float foyerBronze=foyerFloor*(1.0-smoothstep(.012,.021+foyerFootprint,metalDistance))*
      (1.0-smoothstep(.026,.09,foyerFootprint));
    // Tint the existing lit surface rather than replacing its baked shadow.
    outgoingLight=mix(outgoingLight,outgoingLight*vec3(2.18,1.52,.83),.84*foyerBronze);
  `,
};

export function bindFoyerFloorFinish(root){
  const restored=new Map();
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
      const surface=surfaces.get(material?.name);
      if(!surface||!material.isMeshStandardMaterial||restored.has(material))continue;
      const compile=material.onBeforeCompile;
      const key=material.customProgramCacheKey;
      const programKey=key.call(material);
      restored.set(material,{compile,key});
      material.onBeforeCompile=function(shader,renderer){
        compile.call(this,shader,renderer);
        shader.vertexShader='varying vec3 foyerPoint;\n'+shader.vertexShader
          .replace('#include <begin_vertex>','#include <begin_vertex>\nfoyerPoint = position;');
        shader.fragmentShader='varying vec3 foyerPoint;\n'+(surface==='inlay'?inlay:masonry)+shader.fragmentShader
          .replace('#include <opaque_fragment>',`
            float foyerFloor=1.0-smoothstep(.0006,.0025,abs(foyerPoint.y-${levels[surface]}));
            ${finishes[surface]}
            #include <opaque_fragment>`);
      };
      material.customProgramCacheKey=()=>programKey+'-foyer-finish-'+surface;
      material.needsUpdate=true;
    }
  });
  return ()=>{
    for(const [material,{compile,key}] of restored){
      material.onBeforeCompile=compile;
      material.customProgramCacheKey=key;
      material.needsUpdate=true;
    }
    restored.clear();
  };
}
