import {BufferAttribute,BufferGeometry,DynamicDrawUsage,Points,ShaderMaterial,Vector3} from 'three';
import {terrainFrame} from './toroidal-terrain.mjs';
import {clamp,smooth} from './avatar-motion-curves.mjs';

const capacity=512;
const life=.72;
const drainingSeconds=1.60;

export function sampleWetFlight(previous,sample,time){
  const draft=sample.waterLevel-sample.feet;
  const near=sample.waterLevel-sample.ground>.12&&draft>-(previous?.near?1.10:.82);
  const lastWet=near?time:previous?.lastWet??-Infinity;
  const amount=near?1:1-smooth((time-lastWet-.26)/(drainingSeconds-.26));
  return {near,lastWet,amount,draft};
}

export class WaterWake{
  constructor(scene,{lightweight=()=>false,pixelRatio=()=>1,clock=()=>performance.now()}={}){
    this.lightweight=lightweight;
    this.pixelRatio=pixelRatio;
    this.clock=clock;
    this.start=clock();
    this.tracks=new Map();
    this.cursor=0;
    this.lastEmission=-10;
    this.delta=new Vector3();
    this.origin=new Vector3();
    this.velocity=new Vector3();
    this.side=new Vector3();
    const geometry=new BufferGeometry();
    const attribute=(name,length)=>{
      const data=new BufferAttribute(new Float32Array(capacity*length),length).setUsage(DynamicDrawUsage);
      geometry.setAttribute(name,data);
      return data;
    };
    this.positions=attribute('position',3);
    this.launch=attribute('launch',3);
    this.normals=attribute('waterUp',3);
    this.timing=attribute('timing',3);
    for(let i=0;i<capacity;i++)this.timing.setX(i,-10);
    const material=new ShaderMaterial({
      transparent:true,depthWrite:false,
      uniforms:{clock:{value:0},sizeLimit:{value:20},pixelRatio:{value:1}},
      vertexShader:`
        attribute vec3 launch;
        attribute vec3 waterUp;
        attribute vec3 timing;
        uniform float clock;
        uniform float sizeLimit;
        uniform float pixelRatio;
        varying float opacity;
        void main() {
          float age=max(0.0,clock-timing.x);
          vec3 drop=position+launch*age-waterUp*(5.6*age*age);
          vec4 eye=modelViewMatrix*vec4(drop,1.0);
          float surface=timing.z>=0.0?smoothstep(-.075,.04,timing.z+dot(launch*age-waterUp*(5.6*age*age),waterUp)):1.0;
          opacity=surface*(1.0-smoothstep(.12,${life},age))*smoothstep(.65,1.5,-eye.z)*timing.y;
          gl_Position=projectionMatrix*eye;
          gl_PointSize=opacity>.002?clamp(125.0*timing.y/max(1.0,-eye.z),2.0,sizeLimit)*pixelRatio:0.0;
        }`,
      fragmentShader:`
        varying float opacity;
        void main() {
          vec2 uv=(gl_PointCoord-.5)*vec2(2.65,1.83);
          float silhouette=1.0-smoothstep(.35,.99,length(uv));
          vec3 blue=mix(vec3(.025,.22,.74),vec3(.43,.82,1.0),
            1.0-smoothstep(.06,.78,length(uv+vec2(.12,-.20))));
          gl_FragColor=vec4(blue,.89*opacity*silhouette);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh=new Points(geometry,material);
    this.mesh.name='Water flight trail';
    this.mesh.frustumCulled=false;
    this.mesh.raycast=()=>{};
    this.mesh.visible=false;
    scene.add(this.mesh);
  }

  observe(id,position,up,sample,{flying,seconds,continuous,emit}){
    if(!flying){
      this.tracks.delete(id);
      return;
    }
    const now=(this.clock()-this.start)/1000;
    let track=this.tracks.get(id);
    if(!track){
      if(this.tracks.size>=32)return;
      track={previous:new Vector3().copy(position),remainder:0};
      this.tracks.set(id,track);
    }
    const start=track.previous;
    const delta=this.delta.subVectors(position,start);
    const distance=delta.length();
    const speed=distance/Math.max(.001,seconds);
    const sameRun=continuous&&speed<=39;
    const valid=sameRun&&seconds>0&&seconds<=.2;
    if(!sameRun)track.remainder=0;
    const wet=sampleWetFlight(sameRun?track.wet:null,sample,now);
    track.wet=wet;
    track.seen=now;
    if(!emit||!wet.amount||!valid||speed>39||speed<1.3){
      start.copy(position);
      if(!wet.amount||speed>39||!emit)track.remainder=0;
      return;
    }

    const light=this.lightweight();
    const rate=(light?3.5:6)*wet.amount;
    const available=distance*rate+track.remainder;
    const count=Math.min(18,Math.floor(available));
    this.side.crossVectors(up,delta);
    if(this.side.lengthSq()<1e-7)this.side.fromArray(terrainFrame(sample.u,sample.v).alongRing);
    else this.side.normalize();
    const groundOffset=wet.near?clamp(wet.draft,-.08,1.10):.20;
    const surface=wet.near&&wet.draft<=1.10;
    for(let index=0;index<count;index++){
      const offset=(index+1-track.remainder)/rate;
      const t=clamp(offset/distance);
      const slot=this.cursor++%capacity;
      const phase=this.cursor*2.3999632297;
      const scatter=Math.sin(phase),spray=.45+.55*Math.cos(phase*2.17)**2;
      this.origin.copy(start).lerp(position,t)
        .addScaledVector(up,groundOffset+.14*spray).addScaledVector(this.side,scatter*.25);
      this.velocity.copy(delta).multiplyScalar((.11+.08*spray)/seconds)
        .addScaledVector(this.side,scatter*(.55+.55*spray))
        .addScaledVector(up,surface?.85+1.85*spray:-.18-.60*spray);
      this.positions.setXYZ(slot,this.origin.x,this.origin.y,this.origin.z);
      this.launch.setXYZ(slot,this.velocity.x,this.velocity.y,this.velocity.z);
      this.normals.setXYZ(slot,up.x,up.y,up.z);
      const aboveWater=surface?Math.max(0,groundOffset+.14*spray-wet.draft):-1;
      this.timing.setXYZ(slot,now-seconds*(1-t),(.34+.39*spray)*Math.sqrt(wet.amount),aboveWater);
    }
    track.remainder=available-Math.floor(available);
    start.copy(position);
    if(!count)return;
    for(const attribute of [this.positions,this.launch,this.normals,this.timing])attribute.needsUpdate=true;
    const {uniforms}=this.mesh.material;
    uniforms.clock.value=now;
    uniforms.sizeLimit.value=light?13:20;
    uniforms.pixelRatio.value=this.pixelRatio();
    this.lastEmission=now;
    this.mesh.visible=true;
  }

  update(available){
    const now=(this.clock()-this.start)/1000;
    if(!available){
      this.tracks.clear();
      if(this.lastEmission!==-10){
        this.lastEmission=-10;
        for(let i=0;i<capacity;i++)this.timing.setX(i,-10);
        this.timing.needsUpdate=true;
      }
    }else for(const [id,track] of this.tracks)if(now-track.seen>.4)this.tracks.delete(id);
    this.mesh.material.uniforms.clock.value=now;
    this.mesh.visible=available&&now-this.lastEmission<life;
  }

  dispose(){
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.tracks.clear();
  }
}
