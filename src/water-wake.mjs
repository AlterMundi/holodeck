import {BufferAttribute,BufferGeometry,DynamicDrawUsage,Points,ShaderMaterial,Vector3} from 'three';
import {terrainFrame} from './toroidal-terrain.mjs';
import {clamp,smooth} from './avatar-motion-curves.mjs';

const capacity=512;
const dropLife=.72;
const sprayLife=1.05;
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
    this.visibleUntil=-10;
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
    this.timing=attribute('timing',4);
    for(let i=0;i<capacity;i++)this.timing.setX(i,-10);
    const material=new ShaderMaterial({
      transparent:true,depthWrite:false,
      uniforms:{clock:{value:0},lightweight:{value:false},pixelRatio:{value:1}},
      vertexShader:`
        attribute vec3 launch;
        attribute vec3 waterUp;
        attribute vec4 timing;
        uniform float clock;
        uniform bool lightweight;
        uniform float pixelRatio;
        varying float opacity;
        varying float spray;
        varying vec2 screenTravel;
        void main() {
          spray=timing.w;
          float age=max(0.0,clock-timing.x);
          float life=mix(${dropLife},${sprayLife},spray);
          float drag=mix(.9,2.4,spray);
          float travel=(1.0-exp(-drag*min(age,life)))/drag;
          float gravity=mix(11.2,2.7,spray);
          vec3 offset=launch*travel-waterUp*(gravity*(min(age,life)-travel)/drag);
          vec4 eye=modelViewMatrix*vec4(position+offset,1.0);
          float surface=timing.z>=0.0?smoothstep(-.075,.07,timing.z+dot(offset,waterUp)):1.0;
          float envelope=smoothstep(0.0,.045,age)*(1.0-smoothstep(.42*life,life,age));
          opacity=surface*envelope*smoothstep(.65,1.5,-eye.z)*timing.y;
          vec3 alongTrail=launch-waterUp*dot(launch,waterUp);
          vec3 velocity=launch*exp(-drag*age)-waterUp*(gravity*travel);
          vec3 direction=mix(velocity,alongTrail,spray);
          vec3 viewDirection=(modelViewMatrix*vec4(direction,0.0)).xyz;
          vec2 heading=viewDirection.xy*(-eye.z)+eye.xy*viewDirection.z;
          heading.y=-heading.y;
          float magnitude=length(heading);
          screenTravel=magnitude>.0001?heading/magnitude:vec2(1.0,0.0);
          float cameraDepth=max(1.0,-eye.z);
          float dropSize=min(163.0/cameraDepth,lightweight?13.0:19.0);
          float spraySize=min(450.0/cameraDepth,lightweight?29.0:43.0);
          spraySize*=1.0+.38*smoothstep(0.0,.55,age);
          gl_Position=projectionMatrix*eye;
          gl_PointSize=opacity>.002?max(2.0,mix(dropSize,spraySize,spray))*pixelRatio:0.0;
        }`,
      fragmentShader:`
        varying float opacity;
        varying float spray;
        varying vec2 screenTravel;
        void main() {
          vec2 point=gl_PointCoord-.5;
          vec2 across=vec2(-screenTravel.y,screenTravel.x);
          vec2 uv=vec2(dot(point,screenTravel),dot(point,across));
          vec2 dropShape=uv*vec2(2.18,4.1);
          float drop=1.0-smoothstep(.34,1.0,length(dropShape));
          float glint=1.0-smoothstep(.06,.72,length(dropShape+vec2(.12,-.22)));
          vec3 blue=mix(vec3(.018,.17,.62),vec3(.57,.91,1.0),glint);
          float mist=1.0-smoothstep(.12,1.0,length(uv*vec2(2.05,4.35)));
          float edge=1.0-smoothstep(.43,.5,max(abs(point.x),abs(point.y)));
          vec3 skyBlue=mix(vec3(.028,.34,.69),vec3(.48,.88,.97),mist);
          gl_FragColor=vec4(mix(blue,skyBlue,spray),edge*opacity*mix(.93*drop,.43*mist,spray));
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
      track={previous:new Vector3().copy(position),remainder:0,sequence:0};
      this.tracks.set(id,track);
    }
    const start=track.previous;
    const delta=this.delta.subVectors(position,start);
    const distance=delta.length();
    // These positions can come from the local controller or a smoothed
    // peer. Both are sampled over the actual presentation interval.
    const speed=distance/Math.max(.001,seconds);
    const sameRun=continuous&&speed<=39;
    const valid=sameRun&&seconds>0&&seconds<=.35;
    if(!sameRun)track.remainder=0;
    const previousWet=sameRun?track.wet:null;
    const wet=sampleWetFlight(previousWet,sample,now);
    track.wet=wet;
    track.seen=now;
    if(!emit||!wet.amount||!valid||speed>39||speed<1.3){
      start.copy(position);
      if(!wet.amount||speed>39||!emit)track.remainder=0;
      return;
    }

    const light=this.lightweight();
    const rate=Math.min(light?4.8:7.8,(light?42:72)/speed)*wet.amount;
    const available=distance*rate+track.remainder;
    const pending=Math.floor(available);
    const count=Math.min(18,pending);
    this.side.crossVectors(up,delta);
    if(this.side.lengthSq()<1e-7)this.side.fromArray(terrainFrame(sample.u,sample.v).alongRing);
    else this.side.normalize();
    const initialDraft=previousWet?.draft??wet.draft;
    const cursorBefore=this.cursor;
    for(let index=0;index<count;index++){
      const offset=(index+1-track.remainder)/rate;
      const t=count<pending?(index+.5)/count:clamp(offset/distance);
      const draft=initialDraft+(wet.draft-initialDraft)*t;
      const surface=wet.near&&draft>=-1.10&&draft<=1.10;
      const spray=surface&&(track.sequence++%3)===0;
      const strength=spray?1:Math.sqrt(wet.amount);
      const slot=this.cursor++%capacity;
      const phase=this.cursor*2.3999632297;
      const scatter=Math.sin(phase),variation=.45+.55*Math.cos(phase*2.17)**2;
      const fan=spray?scatter*Math.abs(scatter):scatter;
      const originHeight=spray?draft+.10:
        (surface?clamp(draft,-.08,1.10):.20)+.14*variation;
      this.origin.copy(start).lerp(position,t)
        .addScaledVector(up,originHeight).addScaledVector(this.side,fan*(spray?.14:.31));
      const rise=surface?(spray?1.8+1.7*variation:.45+1.75*variation):
        -.18-.60*variation;
      this.velocity.copy(delta).multiplyScalar((spray?.035:.13+.08*variation)/seconds)
        .addScaledVector(this.side,spray?0:fan*(.65+.65*variation))
        .addScaledVector(up,rise);
      this.positions.setXYZ(slot,this.origin.x,this.origin.y,this.origin.z);
      this.launch.setXYZ(slot,this.velocity.x,this.velocity.y,this.velocity.z);
      this.normals.setXYZ(slot,up.x,up.y,up.z);
      const aboveWater=surface?Math.max(0,originHeight-draft):-1;
      const startTime=now-seconds*(1-t);
      this.timing.setXYZW(slot,startTime,(spray?strength:(.68+.3*variation)*strength),aboveWater,Number(spray));
      const life=spray?sprayLife:dropLife;
      this.visibleUntil=Math.max(this.visibleUntil,startTime+life);
    }
    track.remainder=available-pending;
    start.copy(position);
    if(this.cursor===cursorBefore)return;
    for(const attribute of [this.positions,this.launch,this.normals,this.timing])attribute.needsUpdate=true;
    const {uniforms}=this.mesh.material;
    uniforms.clock.value=now;
    uniforms.lightweight.value=light;
    uniforms.pixelRatio.value=this.pixelRatio();
    this.mesh.visible=true;
  }

  update(available){
    const now=(this.clock()-this.start)/1000;
    if(!available){
      this.tracks.clear();
      if(this.visibleUntil!==-10){
        this.visibleUntil=-10;
        for(let i=0;i<capacity;i++)this.timing.setX(i,-10);
        this.timing.needsUpdate=true;
      }
    }else for(const [id,track] of this.tracks)if(now-track.seen>.4)this.tracks.delete(id);
    this.mesh.material.uniforms.clock.value=now;
    this.mesh.visible=available&&now<this.visibleUntil;
  }

  dispose(){
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.tracks.clear();
  }
}
