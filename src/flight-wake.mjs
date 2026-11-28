import {AdditiveBlending,BufferAttribute,BufferGeometry,Color,DynamicDrawUsage,Points,ShaderMaterial,Vector3} from 'three';

const capacity=384;
// Boosted flight leaves the bright, short wake; ordinary flight a thinner,
// longer-lived trail, so a flyer can be followed across the sky.
const BOOST={spacing:.75,life:.65,strength:1,lift:.66};
const CRUISE={spacing:.5,life:1.25,strength:.42,lift:.5};
// The burst where a boost begins: a ring that flies outward and fades.
const BURST={count:40,speed:7.5,life:.55,strength:1.35};
const life=Math.max(BOOST.life,CRUISE.life,BURST.life);
const tones=[0x71e5ff,0xffa471,0xbba2ff,0x66f0bd,0xf7de7a,0xff8ec0];

// Only continuous, explicitly airborne motion emits. Peer updates can
// interpolate unevenly, so tolerate short packets while rejecting jumps.
export function boostWakeDistance(previous,current,seconds){
  if(!(seconds>0&&seconds<.13))return 0;
  const distance=previous.distanceTo(current);
  return distance>=seconds*13&&distance<=seconds*39?distance:0;
}

// Ordinary flight, from a slow glide up to boost speed.
export function cruiseWakeDistance(previous,current,seconds){
  if(!(seconds>0&&seconds<.13))return 0;
  const distance=previous.distanceTo(current);
  return distance>=seconds*2.5&&distance<seconds*13?distance:0;
}

export class FlightWake{
  constructor(scene){
    const geometry=new BufferGeometry();
    const attribute=length=>new BufferAttribute(new Float32Array(capacity*length),length).setUsage(DynamicDrawUsage);
    this.position=attribute(3);
    this.tint=attribute(3);
    this.born=attribute(1);
    this.born.array.fill(-10);
    this.kind=attribute(2);
    this.drift=attribute(3);
    geometry.setAttribute('position',this.position);
    geometry.setAttribute('tint',this.tint);
    geometry.setAttribute('born',this.born);
    geometry.setAttribute('kind',this.kind);
    geometry.setAttribute('drift',this.drift);
    const material=new ShaderMaterial({
      transparent:true,depthWrite:false,blending:AdditiveBlending,
      uniforms:{clock:{value:0}},
      vertexShader:`
        attribute vec3 tint;
        attribute float born;
        attribute vec2 kind; // x: strength, y: life in seconds
        attribute vec3 drift; // metres per second, slowing as it fades
        uniform float clock;
        varying vec3 shade;
        varying float strength;
        void main(){
          float age=clamp((clock-born)/max(kind.y,.01),0.0,1.0);
          float seconds=max(0.,clock-born);
          vec4 eye=modelViewMatrix*vec4(position+drift*seconds*(1.-.5*age),1.0);
          shade=tint;
          strength=(1.0-age)*(1.0-age)*smoothstep(.45,1.35,-eye.z)*.64*kind.x;
          gl_Position=projectionMatrix*eye;
          gl_PointSize=strength>.003?clamp(27.0/max(1.0,-eye.z),2.0,12.0)*mix(.7,1.,kind.x):0.0;
        }`,
      fragmentShader:`
        varying vec3 shade;
        varying float strength;
        void main(){
          float r=length(gl_PointCoord-.5)*2.0;
          float halo=max(0.0,1.0-r);
          float core=1.0-smoothstep(.03,.40,r);
          gl_FragColor=vec4(shade,strength*(halo*halo*.50+core*.60));
          #include <colorspace_fragment>
        }`,
    });
    this.mesh=new Points(geometry,material);
    this.mesh.name='Boost flight wakes';
    this.mesh.frustumCulled=false;
    this.mesh.raycast=()=>{};
    this.mesh.visible=false;
    this.start=performance.now();
    this.index=0;
    this.lastEmission=-10;
    this.tracks=new Map();
    this.particle=new Vector3();
    scene.add(this.mesh);
  }

  observe(id,position,up,flying,seconds){
    const time=(performance.now()-this.start)/1000;
    let track=this.tracks.get(id);
    if(!track){
      if(this.tracks.size>=32)return;
      const key=Number(id);
      const color=new Color(Number.isFinite(key)?tones[(Math.imul(key,0x9e3779b1)>>>0)%tones.length]:0x6eeed8);
      track={last:new Vector3().copy(position),color,seen:time,carry:0};
      this.tracks.set(id,track);
    }
    const boost=flying?boostWakeDistance(track.last,position,seconds):0;
    const cruise=flying&&!boost?cruiseWakeDistance(track.last,position,seconds):0;
    const distance=boost||cruise,style=boost?BOOST:CRUISE;
    track.seen=time;
    if(distance>0){
      for(let offset=style.spacing-track.carry;offset<=distance;offset+=style.spacing){
        const i=this.index;
        this.particle.copy(track.last).lerp(position,offset/distance)
          .addScaledVector(up,style.lift+Math.sin(i*4.1)*.11);
        this.position.setXYZ(i,this.particle.x,this.particle.y,this.particle.z);
        this.tint.setXYZ(i,track.color.r,track.color.g,track.color.b);
        this.born.setX(i,time);
        this.kind.setXY(i,style.strength,style.life);
        this.drift.setXYZ(i,0,0,0);
        this.index=(i+1)%capacity;
        this.lastEmission=time;
        this.position.needsUpdate=this.tint.needsUpdate=this.born.needsUpdate=this.kind.needsUpdate=this.drift.needsUpdate=true;
      }
    }
    track.carry=distance>0?(track.carry+distance)%style.spacing:0;
    track.last.copy(position);
  }

  // A ring of light around the body, perpendicular to where it breaks away.
  burst(id,position,direction){
    const time=(performance.now()-this.start)/1000;
    const axis=this.particle.copy(direction);
    if(axis.lengthSq()<1e-6)return;
    axis.normalize();
    const a=Math.abs(axis.y)<.9?new Vector3(0,1,0):new Vector3(1,0,0);
    const u=new Vector3().crossVectors(axis,a).normalize(),v=new Vector3().crossVectors(axis,u);
    const key=Number(id),color=new Color(Number.isFinite(key)?tones[(Math.imul(key,0x9e3779b1)>>>0)%tones.length]:0x6eeed8);
    for(let k=0;k<BURST.count;k++){
      const angle=k/BURST.count*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle);
      const i=this.index;
      this.position.setXYZ(i,position.x+(u.x*c+v.x*s)*.35,position.y+(u.y*c+v.y*s)*.35+.9,position.z+(u.z*c+v.z*s)*.35);
      this.drift.setXYZ(i,(u.x*c+v.x*s)*BURST.speed-axis.x*2,(u.y*c+v.y*s)*BURST.speed-axis.y*2,(u.z*c+v.z*s)*BURST.speed-axis.z*2);
      this.tint.setXYZ(i,.6+.4*color.r,.6+.4*color.g,.6+.4*color.b);
      this.born.setX(i,time);
      this.kind.setXY(i,BURST.strength,BURST.life);
      this.index=(i+1)%capacity;
    }
    this.lastEmission=time;
    this.position.needsUpdate=this.tint.needsUpdate=this.born.needsUpdate=this.kind.needsUpdate=this.drift.needsUpdate=true;
  }

  update(enabled){
    const time=(performance.now()-this.start)/1000;
    this.mesh.material.uniforms.clock.value=time;
    for(const [id,track] of this.tracks)if(time-track.seen>.4)this.tracks.delete(id);
    this.mesh.visible=enabled&&time-this.lastEmission<life;
    if(!enabled&&this.lastEmission>-10){
      this.lastEmission=-10;
      this.born.array.fill(-10);
      this.born.needsUpdate=true;
      this.tracks.clear();
    }
  }

  dispose(){
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.tracks.clear();
  }
}
