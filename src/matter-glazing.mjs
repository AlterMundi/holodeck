import {FrontSide,ShaderMaterial} from 'three';

// Display treatments for the two authored optical materials.
// The MML model cache shares source materials between scene instances.
const opticalMaterials=new Set(['Clear archive glazing','Clear laminate, service windows']);

export function useLightweightMatterGlazing(group){
  const alternatives=new Map();
  const replace=material=>{
    if(!opticalMaterials.has(material?.name)||!(material.transmission>0))return material;
    if(!alternatives.has(material)){
      const glaze=material.clone();
      glaze.transmission=0;
      glaze.transparent=true;
      glaze.opacity=.24;
      glaze.depthWrite=false;
      glaze.forceSinglePass=true;
      alternatives.set(material,glaze);
    }
    return alternatives.get(material);
  };
  group.traverse(object=>{
    if(!object.isMesh)return;
    object.material=Array.isArray(object.material)?object.material.map(replace):replace(object.material);
  });
  return ()=>{for(const material of alternatives.values())material.dispose();};
}

function orbitalPane(name){
  const service=name==='Clear laminate, service windows';
  return new ShaderMaterial({
    name,side:FrontSide,transparent:true,depthWrite:false,toneMapped:false,
    uniforms:{servicePane:{value:service}},
    vertexShader:`
      varying vec3 panePosition;
      varying vec3 paneNormal;
      void main(){
        panePosition=(modelMatrix * vec4(position,1.0)).xyz;
        paneNormal=normalize(mat3(modelMatrix) * normal);
        gl_Position=projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader:`
      varying vec3 panePosition;
      varying vec3 paneNormal;
      uniform bool servicePane;

      float reflectedPanel(vec3 ray, vec3 center, vec2 halfSize, vec2 softness){
        if(abs(ray.y)<0.001) return 0.0;
        float distance=(center.y-panePosition.y)/ray.y;
        if(distance<=0.02 || distance>16.0) return 0.0;
        vec2 hit=panePosition.xz+ray.xz*distance;
        vec2 offset=max(abs(hit-center.xz)-halfSize,0.0)/softness;
        return exp(-dot(offset,offset));
      }

      void main(){
        vec3 view=normalize(cameraPosition-panePosition);
        vec3 normal=normalize(paneNormal);
        vec3 ray=reflect(-view,normal);
        float rim=1.0-max(dot(view,normal),0.0);
        float fresnel=rim*rim*rim*rim*rim;
        float pendant=reflectedPanel(ray,vec3(0.0,2.353,-0.43),vec2(1.19,0.10),vec2(0.13,0.10));
        float canopy=reflectedPanel(ray,vec3(3.35,2.225,-3.69),vec2(1.17,0.11),vec2(0.10,0.08));
        float fixture=max(pendant,canopy*0.70);
        float clearTint=servicePane?0.085:0.046;
        vec3 tint=servicePane?vec3(0.032,0.092,0.16):vec3(0.09,0.19,0.26);
        vec3 color=mix(tint,vec3(0.78,0.87,0.94),fixture);
        float opacity=clearTint+0.18*fresnel+0.43*fixture;
        gl_FragColor=vec4(color,opacity);
        #include <colorspace_fragment>
      }
    `,
  });
}

// This overlays the live geometry behind each pane. No transmission
// render target or duplicated copy of the displays is needed.
export function bindOrbitalMatterGlazing(group){
  const panes=new Map(),materials=new Map();
  group.traverse(object=>{
    if(!object.isMesh)return;
    const original=object.material;
    const replace=material=>{
      if(!opticalMaterials.has(material?.name))return material;
      if(!materials.has(material.name))materials.set(material.name,orbitalPane(material.name));
      return materials.get(material.name);
    };
    const candidate=Array.isArray(original)?original.map(replace):replace(original);
    const changed=Array.isArray(original)?candidate.some((material,i)=>material!==original[i]):candidate!==original;
    if(changed)panes.set(object,{original,candidate});
  });
  return {
    apply(enabled){
      for(const [mesh,{original,candidate}] of panes)mesh.material=enabled?candidate:original;
    },
    dispose(){
      for(const [mesh,{original}] of panes)mesh.material=original;
      for(const material of materials.values())material.dispose();
    },
  };
}
