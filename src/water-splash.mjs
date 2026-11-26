import {BufferAttribute,BufferGeometry,DynamicDrawUsage,Points,ShaderMaterial,Vector3} from 'three';
import {terrainFrame,terrainPosition} from './toroidal-terrain.mjs';

const capacity=192;
const lifetime=.62;
const clamp=value=>Math.min(1,Math.max(0,value));

// Keep the previous stable side inside the narrow band. Float and wade
// animation cannot create a crossing, and a reposition seeds a fresh side.
export function sampleWaterCrossing(previous,{draft,depth,seconds,planar,continuous}){
  const side=depth>.12?(draft>.25?'wet':draft<-.05?'dry':previous?.side):'dry';
  const state={side,draft,cooldown:Math.max(0,(previous?.cooldown??0)-Math.max(0,seconds))};
  if(!continuous||!previous?.side||!side||side===previous.side||depth<=.12||
     state.cooldown>0||!(seconds>0&&seconds<=.35))return {state,strength:0};
  // Match the pinned simulation's advance cap when a draw stalls.
  const vertical=Math.abs(draft-previous.draft)/Math.min(.1,seconds);
  if(vertical<.9)return {state,strength:0};
  state.cooldown=.30;
  return {state,strength:.12+.88*clamp((vertical+.18*planar*Math.max(1,seconds/.1)-.9)/8)};
}

export class WaterSplash {
  constructor(scene,{lightweight=()=>false,clock=()=>performance.now()}={}){
    this.lightweight=lightweight;
    this.clock=clock;
    this.start=clock();
    this.states=new Map();
    this.cursor=0;
    this.lastBurst=-10;
    const geometry=new BufferGeometry();
    const attribute=(name,length)=>{
      const result=new BufferAttribute(new Float32Array(capacity*length),length).setUsage(DynamicDrawUsage);
      geometry.setAttribute(name,result);
      return result;
    };
    this.origins=attribute('position',3);
    this.velocity=attribute('launch',3);
    this.normals=attribute('surfaceUp',3);
    this.timing=attribute('timing',2);
    for(let i=0;i<capacity;i++)this.timing.setX(i,-10);
    this.mesh=new Points(geometry,new ShaderMaterial({
      transparent:true,depthWrite:false,uniforms:{clock:{value:0}},
      vertexShader:`
        attribute vec3 launch;
        attribute vec3 surfaceUp;
        attribute vec2 timing;
        uniform float clock;
        varying float strength;
        void main() {
          float age=max(0.0,clock-timing.x);
          float phase=age/${lifetime};
          vec3 path=launch*age - surfaceUp*(7.9*age*age);
          vec4 eye=modelViewMatrix*vec4(position+path,1.0);
          float above=smoothstep(-0.035,0.038,dot(path,surfaceUp)+0.045);
          strength=above*(1.0-smoothstep(.24,1.0,phase))*.78;
          gl_Position=projectionMatrix*eye;
          gl_PointSize=strength>.002 ?
            clamp(104.0*timing.y/max(1.2,-eye.z),2.0,15.0):0.0;
        }`,
      fragmentShader:`
        varying float strength;
        void main() {
          vec2 uv=(gl_PointCoord-.5)*vec2(2.5,1.9);
          float radius=length(uv);
          float edge=1.0-smoothstep(.32,.95,radius);
          vec3 shade=mix(vec3(.17,.44,.58),vec3(.83,.96,1.0),
            1.0-smoothstep(.10,.70,length(uv+vec2(.13,-.16))));
          gl_FragColor=vec4(shade,strength*edge);
          #include <colorspace_fragment>
        }`,
    }));
    this.mesh.name='Waterline splashes';
    this.mesh.frustumCulled=false;
    this.mesh.raycast=()=>{};
    this.mesh.visible=false;
    this.point=new Vector3();
    this.up=new Vector3();
    this.along=new Vector3();
    this.across=new Vector3();
    this.direction=new Vector3();
    scene.add(this.mesh);
  }

  observe(id,sample,seconds,planar,continuous,emit){
    const now=(this.clock()-this.start)/1000;
    const last=this.states.get(id);
    if(!last&&this.states.size>=32)return;
    const {state,strength}=sampleWaterCrossing(last,{
      draft:sample.waterLevel-sample.feet,depth:sample.waterLevel-sample.ground,seconds,planar,continuous,
    });
    this.states.set(id,{...state,seen:now});
    if(!emit||!strength)return;
    const frame=terrainFrame(sample.u,sample.v);
    this.point.fromArray(terrainPosition(sample.u,sample.v,sample.waterLevel));
    this.up.fromArray(frame.up);
    this.along.fromArray(frame.alongRing);
    this.across.fromArray(frame.aroundTube);
    const count=Math.ceil((12+32*strength)*(this.lightweight()?.5:1));
    for(let index=0;index<count;index++){
      const angle=index*2.3999632297+this.cursor*.1;
      const spread=.4+.6*Math.sin(index*13.3)**2;
      const reach=spread*(.55+2.7*strength);
      const lift=(.9+2.8*strength)*(.65+.35*Math.cos(index*3.1)**2);
      this.direction.copy(this.along).multiplyScalar(Math.cos(angle)*reach)
        .addScaledVector(this.across,Math.sin(angle)*reach).addScaledVector(this.up,lift);
      const slot=this.cursor++%capacity;
      this.origins.setXYZ(slot,this.point.x,this.point.y,this.point.z);
      this.normals.setXYZ(slot,this.up.x,this.up.y,this.up.z);
      this.velocity.setXYZ(slot,this.direction.x,this.direction.y,this.direction.z);
      this.timing.setXY(slot,now,.18+spread*(.18+.22*strength));
    }
    for(const attribute of [this.origins,this.normals,this.velocity,this.timing])attribute.needsUpdate=true;
    this.mesh.material.uniforms.clock.value=now;
    this.lastBurst=now;
    this.mesh.visible=true;
  }

  update(available){
    const now=(this.clock()-this.start)/1000;
    if(!available){
      this.states.clear();
      if(this.lastBurst!==-10){
        this.lastBurst=-10;
        for(let i=0;i<capacity;i++)this.timing.setX(i,-10);
        this.timing.needsUpdate=true;
      }
    }else for(const [id,state] of this.states)if(now-state.seen>.4)this.states.delete(id);
    this.mesh.material.uniforms.clock.value=now;
    this.mesh.visible=available&&now-this.lastBurst<lifetime;
  }

  dispose(){
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.states.clear();
  }
}
