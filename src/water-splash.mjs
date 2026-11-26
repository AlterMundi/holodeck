import {BufferAttribute,BufferGeometry,DynamicDrawUsage,Points,ShaderMaterial,Vector3} from 'three';
import {terrainFrame,terrainPosition} from './toroidal-terrain.mjs';

const capacity=192;
const lifetime=.72;
const clamp=value=>Math.min(1,Math.max(0,value));
const unitTurn=.38196601125;
const fraction=value=>value-Math.floor(value);
const wrappedMix=(from,to,t)=>fraction(from+(fraction(to-from+.5)-.5)*t);

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
  constructor(scene,{lightweight=()=>false,pixelRatio=()=>1,clock=()=>performance.now()}={}){
    this.lightweight=lightweight;
    this.pixelRatio=pixelRatio;
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
    this.timing=attribute('timing',4);
    for(let i=0;i<capacity;i++)this.timing.setX(i,-10);
    this.mesh=new Points(geometry,new ShaderMaterial({
      transparent:true,depthWrite:false,uniforms:{clock:{value:0},pixelRatio:{value:1}},
      vertexShader:`
        attribute vec3 launch;
        attribute vec3 surfaceUp;
        attribute vec4 timing;
        uniform float clock;
        uniform float pixelRatio;
        varying float opacity;
        varying float foam;
        varying vec2 screenTravel;
        varying float stretch;
        void main() {
          float age=max(0.0,clock-timing.x);
          float phase=age/max(.05,timing.z);
          foam=timing.w;
          float drag=mix(2.25,4.3,foam);
          float gravity=mix(12.5,0.0,foam);
          float decay=exp(-drag*min(age,${lifetime}));
          float travel=(1.0-decay)/drag;
          vec3 path=launch*travel-surfaceUp*(gravity*(age-travel)/drag);
          vec4 eye=modelViewMatrix*vec4(position+path,1.0);
          vec3 velocity=launch*decay-surfaceUp*(gravity*travel);
          vec3 viewVelocity=mat3(modelViewMatrix)*velocity;
          vec2 projected=viewVelocity.xy*(-eye.z)+eye.xy*viewVelocity.z;
          projected.y=-projected.y;
          float scale=max(1.0,-eye.z);
          float magnitude=length(projected);
          screenTravel=magnitude>.0001?projected/magnitude:vec2(1.0,0.0);
          stretch=mix(1.35+clamp(magnitude/(scale*scale)*.82,0.0,1.45),1.0,foam);
          float above=smoothstep(-.035,.028,dot(path,surfaceUp)+.05);
          opacity=above*(1.0-smoothstep(.23,1.0,phase))*smoothstep(.7,1.35,-eye.z);
          vec3 viewUp=normalize(mat3(modelViewMatrix)*surfaceUp);
          // A low angle turns the foam into small flecks at the waterline.
          float facing=max(.24,abs(dot(viewUp,normalize(eye.xyz))));
          stretch=mix(stretch,1.0/facing,foam);
          if(foam>.5){
            vec2 radial=viewUp.xy*(-eye.z)+eye.xy*viewUp.z;
            radial.y=-radial.y;
            screenTravel=length(radial)>.0001?normalize(vec2(-radial.y,radial.x)):vec2(1.0,0.0);
          }
          gl_Position=projectionMatrix*eye;
          float size=clamp(113.0*timing.y/scale,1.7,mix(17.0,23.0,foam));
          gl_PointSize=opacity>.002?size*pixelRatio:0.0;
        }`,
      fragmentShader:`
        varying float opacity;
        varying float foam;
        varying vec2 screenTravel;
        varying float stretch;
        void main() {
          vec2 point=gl_PointCoord-.5;
          vec2 across=vec2(-screenTravel.y,screenTravel.x);
          vec2 uv=vec2(dot(point,screenTravel),dot(point,across));
          float taper=mix(1.0,1.0+.65*max(0.0,-2.0*uv.x),1.0-foam);
          vec2 shape=uv*vec2(2.3,2.45*stretch*taper);
          float body=1.0-smoothstep(.27,.98,length(shape));
          float glint=1.0-smoothstep(.08,.75,length(shape-vec2(.18,-.15)));
          vec3 water=mix(vec3(.18,.37,.46),vec3(.78,.91,.95),glint);
          vec3 pale=mix(vec3(.39,.55,.59),vec3(.78,.88,.87),body);
          gl_FragColor=vec4(mix(water,pale,foam),body*opacity*mix(.86,.48,foam));
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
    this.forward=new Vector3();
    this.side=new Vector3();
    this.origin=new Vector3();
    scene.add(this.mesh);
  }

  observe(id,sample,seconds,planar,continuous,emit){
    const now=(this.clock()-this.start)/1000;
    const last=this.states.get(id);
    if(!last&&this.states.size>=32)return;
    const draft=sample.waterLevel-sample.feet;
    const depth=sample.waterLevel-sample.ground;
    const {state,strength}=sampleWaterCrossing(last,{draft,depth,seconds,planar,continuous});
    const side=draft>0?'wet':'dry';
    const sameRun=continuous&&seconds>0&&seconds<=.35&&depth>.12;
    const priorImpact=last?.impact;
    let impact=sameRun&&priorImpact&&now-priorImpact.time<=.35?priorImpact:null;
    if(sameRun&&last?.depth>.12&&draft!==last.draft&&(draft>0)!==(last.draft>0)){
      const t=last.draft/(last.draft-draft);
      impact={u:wrappedMix(last.u,sample.u,t),v:wrappedMix(last.v,sample.v,t),side,time:now};
    }
    this.states.set(id,{...state,seen:now,depth,u:sample.u,v:sample.v,impact:emit&&strength?null:impact});
    if(!emit||!strength)return;
    const anchor=impact?.side===state.side?impact:sample;
    const frame=terrainFrame(anchor.u,anchor.v);
    this.point.fromArray(terrainPosition(anchor.u,anchor.v,sample.waterLevel));
    this.up.fromArray(frame.up);
    this.along.fromArray(frame.alongRing);
    this.across.fromArray(frame.aroundTube);
    this.forward.fromArray(terrainPosition(sample.u,sample.v,sample.waterLevel))
      .sub(this.origin.fromArray(terrainPosition(last.u,last.v,sample.waterLevel)));
    this.forward.addScaledVector(this.up,-this.forward.dot(this.up));
    const directed=this.forward.lengthSq()>1e-8;
    const fanWeight=directed?clamp((planar-1.2)/8):0;
    if(directed)this.forward.normalize();
    else this.forward.copy(this.along);
    this.side.crossVectors(this.up,this.forward).normalize();
    const count=Math.ceil((12+32*strength)*(this.lightweight()?.5:1));
    const foamCount=Math.max(1,Math.round(count*.12));
    const seed=fraction(anchor.u*1398+anchor.v*928);
    for(let index=0;index<count;index++){
      const scatter=fraction(index*unitTurn+seed);
      const variation=.46+.54*fraction(index*.61803398875+2*seed);
      const foam=index<foamCount;
      const fan=!foam&&index%4!==0&&fanWeight>0;
      const angle=fan?(scatter-.5)*(2.15-.88*fanWeight):scatter*2*Math.PI;
      const spread=foam?.36+strength*.74:fan?
        variation*(.74+2.1*strength)+Math.min(planar,24)*.35*fanWeight:
        variation*(.72+2.15*strength);
      const lift=foam?0:fan?variation*(1.55+2.9*strength):variation*(2.1+4.3*strength);
      const axis=fan?this.forward:this.along;
      const lateral=fan?this.side:this.across;
      this.direction.copy(axis).multiplyScalar(Math.cos(angle)*spread)
        .addScaledVector(lateral,Math.sin(angle)*spread).addScaledVector(this.up,lift);
      const slot=this.cursor++%capacity;
      this.origin.copy(this.point).addScaledVector(this.up,foam?.061:.047);
      if(foam)this.origin.addScaledVector(axis,Math.cos(angle)*spread*.32)
        .addScaledVector(lateral,Math.sin(angle)*spread*.32);
      this.origins.setXYZ(slot,this.origin.x,this.origin.y,this.origin.z);
      this.normals.setXYZ(slot,this.up.x,this.up.y,this.up.z);
      this.velocity.setXYZ(slot,this.direction.x,this.direction.y,this.direction.z);
      const size=foam?.31+.16*strength:.12+variation*(.14+.19*strength);
      const life=foam?.26+.10*variation:.38+.34*variation;
      this.timing.setXYZW(slot,now,size,life,Number(foam));
    }
    for(const attribute of [this.origins,this.normals,this.velocity,this.timing])attribute.needsUpdate=true;
    this.mesh.material.uniforms.clock.value=now;
    this.mesh.material.uniforms.pixelRatio.value=this.pixelRatio();
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
    if(this.mesh.visible)this.mesh.material.uniforms.pixelRatio.value=this.pixelRatio();
  }

  dispose(){
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.states.clear();
  }
}
