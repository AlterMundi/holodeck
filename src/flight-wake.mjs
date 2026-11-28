import {AdditiveBlending,BufferAttribute,BufferGeometry,Color,DynamicDrawUsage,Points,ShaderMaterial,Vector3} from 'three';
import {CameraKick,RibbonTrails,Shockwaves,SmokePuffs} from './hero-effects.mjs';
import {terrainColor} from './toroidal-terrain.mjs';
import {footDustColour,footSurface} from './footfall-surface.mjs';

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
  constructor(scene,{base=null}={}){
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
        varying float spin;
        varying float twinkle;
        void main(){
          spin=born*37.1+(clock-born)*(fract(born*13.7)-.5)*14.;
          twinkle=.65+.35*sin((clock-born)*40.+born*91.);
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
        varying float spin;
        varying float twinkle;
        void main(){
          vec2 p=(gl_PointCoord-.5)*2.0;
          p=mat2(cos(spin),-sin(spin),sin(spin),cos(spin))*p;
          float r=length(p);
          // A hot core, a soft halo and four twinkling rays.
          float core=1.0-smoothstep(.03,.30,r);
          float halo=max(0.0,1.0-r);
          float rays=(exp(-abs(p.x)*14.)+exp(-abs(p.y)*14.))*max(0.,1.-r)*twinkle;
          vec3 colour=mix(shade,vec3(1.),core*.8);
          gl_FragColor=vec4(colour,strength*(halo*halo*.35+core*.7+rays*.55));
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
    // Flyers leave glowing ribbons; boosts keep their sparks on top and
    // break away with a shockwave.
    this.ribbons=new RibbonTrails(scene);
    this.shockwaves=new Shockwaves(scene);
    this.smoke=new SmokePuffs(scene,{base});
    this.kick=new CameraKick();
    // Optional (kind,{strength}) sink for the explorer's own body sounds.
    this.sound=null;
    this.ribbonPoint=new Vector3();
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
    // A respawn or corrected peer position must never bridge an old ribbon
    // to the new location. Keep the same speed ceiling as the spark emitter.
    if(track.last.distanceTo(position)>Math.max(.4,Math.min(Math.max(seconds,0),.13)*39))
      this.ribbons.release(id);
    const boost=flying?boostWakeDistance(track.last,position,seconds):0;
    const cruise=flying&&!boost?cruiseWakeDistance(track.last,position,seconds):0;
    const distance=boost||cruise,style=boost?BOOST:CRUISE;
    track.seen=time;
    this.ribbonPoint.copy(position).addScaledVector(up,style.lift);
    this.ribbons.follow(id,this.ribbonPoint,time,boost?1:cruise?.6:0,track.color);
    // Cruise is drawn by the ribbon alone; boost adds sparks.
    if(boost>0){
      const carry=track.carry%style.spacing;
      for(let offset=style.spacing-carry;offset<=distance;offset+=style.spacing){
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
  burst(id,position,direction,up=null,local=false){
    const time=(performance.now()-this.start)/1000;
    const axis=this.particle.copy(direction);
    if(axis.lengthSq()<1e-6)return;
    axis.normalize();
    const lift=up?new Vector3().copy(up).multiplyScalar(.9):new Vector3(0,.9,0);
    const key0=Number(id);
    const hue=new Color(Number.isFinite(key0)?tones[(Math.imul(key0,0x9e3779b1)>>>0)%tones.length]:0x6eeed8);
    const origin=new Vector3().copy(position).add(lift);
    this.shockwaves.fire(origin,axis,time,hue);
    // Smoke thrown back and out from where the body tore away.
    const su=new Vector3(),sv=new Vector3(),helper=Math.abs(axis.y)<.9?new Vector3(0,1,0):new Vector3(1,0,0);
    su.crossVectors(axis,helper).normalize();sv.crossVectors(axis,su);
    for(let k=0;k<8;k++){
      const a=k/8*Math.PI*2+key0;
      const throwOut=new Vector3().copy(su).multiplyScalar(Math.cos(a)*4.5).addScaledVector(sv,Math.sin(a)*4.5).addScaledVector(axis,-3.5);
      this.smoke.puff(origin,throwOut,time,.55+.2*((k*7)%3)/2,hue,(k*.618+time)%1,{up:up??null,height:up?.9:100});
    }
    if(local){this.kick.fire(time);this.sound?.('boost',{strength:1});}
    const a=Math.abs(axis.y)<.9?new Vector3(0,1,0):new Vector3(1,0,0);
    const u=new Vector3().crossVectors(axis,a).normalize(),v=new Vector3().crossVectors(axis,u);
    const key=Number(id),color=new Color(Number.isFinite(key)?tones[(Math.imul(key,0x9e3779b1)>>>0)%tones.length]:0x6eeed8);
    for(let k=0;k<BURST.count;k++){
      const angle=k/BURST.count*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle);
      const i=this.index;
      this.position.setXYZ(i,position.x+lift.x+(u.x*c+v.x*s)*.35,position.y+lift.y+(u.y*c+v.y*s)*.35,position.z+lift.z+(u.z*c+v.z*s)*.35);
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
    this.ribbons.update(time,enabled);
    this.shockwaves.update(time,enabled);
    this.smoke.update(time,enabled);
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

  // Dust kicked up from the ground under a low flyer: puffs in the ground's
  // own colour, thrown out to the sides and back, with a few grass-green bits.
  dust(point,up,direction,strength,ground){
    const [r,g,b]=Array.isArray(ground)?ground:terrainColor(ground.u,ground.v,ground.ground,0);
    const time=(performance.now()-this.start)/1000;
    const side=this.particle.crossVectors(up,direction);
    if(side.lengthSq()<1e-6)side.set(1,0,0);
    side.normalize();
    this.dustColour??=new Color();
    for(const sign of [-1,1]){
      const out=new Vector3().copy(side).multiplyScalar(sign*(2.2+2.5*strength))
        .addScaledVector(direction,-1.5).addScaledVector(up,.9+.8*strength);
      const grassy=g>r*1.08&&g>b*1.2;
      this.dustColour.setRGB(r*1.15+.08,g*1.1+.06,b*1.05+.05);
      this.smoke.puff(new Vector3().copy(point).addScaledVector(up,.15),out,time,.35+.35*strength,this.dustColour,(time*7.3+sign)%1,
        {glow:0,opacity:.5,life:1.3,gravity:.6,up,height:.15});
      if(grassy&&strength>.5){
        this.dustColour.setRGB(r*.8,g*1.25,b*.6);
        this.smoke.puff(new Vector3().copy(point).addScaledVector(up,.1),out.multiplyScalar(1.3),time,.16,this.dustColour,(time*3.1+sign*.5)%1,
          {glow:0,opacity:.8,life:.9,gravity:5,up,height:.1});
      }
    }
  }

  // A step on dry ground: a low puff of the ground's colour pushed back and
  // to the sides, settling quickly. Grass throws a few green bits; stone only
  // a faint pale breath. Strength is the pace from walk (~.3) to sprint (1).
  footfall(point,up,direction,strength,sample,{splash=null,colour=null,local=false}={}){
    const surface=typeof sample==='string'?sample:footSurface(sample);
    if(!surface)return;
    if(local)this.sound?.('step-'+surface,{strength});
    if(surface==='water'){
      splash?.skim?.(point.addScaledVector(up,sample.waterLevel-sample.feet),up,.15+.35*strength);
      return;
    }
    const [r,g,b]=colour??footDustColour(surface,sample);
    const time=(performance.now()-this.start)/1000;
    this.dustColour??=new Color();
    const back=this.particle.copy(direction).multiplyScalar(-(.6+1.6*strength));
    const side=new Vector3().crossVectors(up,direction);
    if(side.lengthSq()<1e-6)side.set(1,0,0);
    side.normalize();
    const seed=(time*5.17)%1;
    const spread=(seed-.5)*(.8+1.2*strength);
    const out=new Vector3().copy(back).addScaledVector(side,spread).addScaledVector(up,.35+.6*strength);
    const lift=new Vector3().copy(point).addScaledVector(up,.06);
    const stone=surface==='stone';
    this.dustColour.setRGB(r*1.1+.06,g*1.05+.05,b+.04);
    this.smoke.puff(lift,out,time,(stone?.09:.12)+.15*strength,this.dustColour,seed,
      {glow:0,opacity:(stone?.14:.3)*(.55+.45*strength),life:.7+.5*strength,gravity:.9,up,height:.06});
    if(surface==='grass'&&strength>.45){
      this.dustColour.setRGB(r*.75,g*1.3,b*.55);
      this.smoke.puff(lift,out.multiplyScalar(1.5).addScaledVector(up,.8),time,.07+.05*strength,this.dustColour,(seed+.37)%1,
        {glow:0,opacity:.85,life:.55,gravity:6,up,height:.06});
    }
  }

  // Screen-only offset for the camera target after a local boost.
  shake(up,right,allowed){
    return this.kick.sample((performance.now()-this.start)/1000,up,right,{allowed});
  }

  dispose(){
    this.ribbons.dispose();
    this.shockwaves.dispose();
    this.smoke.dispose();
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.tracks.clear();
  }
}
