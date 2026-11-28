import {
  AdditiveBlending,BufferAttribute,BufferGeometry,DoubleSide,DynamicDrawUsage,Mesh,NormalBlending,ShaderMaterial,Vector3,
} from 'three';

// Effects drawn as shapes instead of dots. Each kind is one mesh and one
// draw call, with its motion computed in the vertex shader from a birth time.

const attribute=(geometry,name,count,size)=>{
  const result=new BufferAttribute(new Float32Array(count*size),size).setUsage(DynamicDrawUsage);
  geometry.setAttribute(name,result);
  return result;
};
const quadIndex=count=>{
  const index=[];
  for(let q=0;q<count;q++){const b=q*4;index.push(b,b+1,b+2,b,b+2,b+3);}
  return index;
};
const corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
const basis=(axis,u,v)=>{
  const helper=Math.abs(axis.y)<.9?new Vector3(0,1,0):new Vector3(1,0,0);
  u.crossVectors(axis,helper).normalize();
  v.crossVectors(axis,u).normalize();
};

// Glowing ribbons that follow flyers: a camera-facing strip through the
// recent path, wide and bright at the body, thinning and fading behind.
export const RIBBON={points:40,spacing:.32,life:1.1,width:.24};
export class RibbonTrails{
  constructor(scene,{tracks=8}={}){
    this.capacity=tracks;
    const vertices=tracks*RIBBON.points*2;
    const geometry=new BufferGeometry();
    this.center=attribute(geometry,'position',vertices,3);
    this.tangent=attribute(geometry,'tangent',vertices,3);
    this.shape=attribute(geometry,'shape',vertices,4);   // side, rank, born, strength
    this.tint=attribute(geometry,'tint',vertices,3);
    const index=[];
    for(let t=0;t<tracks;t++)for(let p=0;p<RIBBON.points-1;p++){
      const a=(t*RIBBON.points+p)*2;
      index.push(a,a+1,a+2,a+1,a+3,a+2);
    }
    geometry.setIndex(index);
    for(let i=0;i<vertices;i++)this.shape.setZ(i,-1e4);
    this.material=new ShaderMaterial({
      transparent:true,depthWrite:false,blending:NormalBlending,side:DoubleSide,
      uniforms:{clock:{value:0}},
      vertexShader:`
        attribute vec3 tangent;
        attribute vec4 shape;
        attribute vec3 tint;
        uniform float clock;
        varying float across;
        varying float glow;
        varying vec3 colour;
        void main(){
          float age=clamp((clock-shape.z)/${RIBBON.life.toFixed(2)},0.,1.);
          float rank=shape.y;
          // Full width just behind the body, then a long taper.
          float width=${RIBBON.width.toFixed(3)}*shape.w*smoothstep(0.,.06,rank)*(1.-rank)*(1.-age*age);
          vec4 eye=modelViewMatrix*vec4(position,1.);
          vec3 along=normalize(mat3(modelViewMatrix)*tangent+vec3(1e-5));
          vec3 side=normalize(cross(along,normalize(eye.xyz)));
          eye.xyz+=side*shape.x*width;
          across=shape.x;
          glow=(1.-age)*(1.-rank*.6)*smoothstep(.4,1.4,-eye.z)*min(1.,shape.w);
          colour=tint;
          gl_Position=projectionMatrix*eye;
        }`,
      fragmentShader:`
        varying float across;
        varying float glow;
        varying vec3 colour;
        void main(){
          float x=abs(across);
          float core=exp(-x*x*18.);
          float halo=exp(-x*x*3.5)*.55;
          // Keep the hue: only the very core goes white, so a daylight sky
          // does not wash the ribbon out.
          vec3 light=mix(colour,vec3(1.),core*.35);
          gl_FragColor=vec4(light*(1.15+core*.4),min(1.,(core*.8+halo)*glow));
          #include <colorspace_fragment>
        }`,
    });
    this.mesh=new Mesh(geometry,this.material);
    this.mesh.name='Flight ribbons';
    this.mesh.frustumCulled=false;
    this.mesh.raycast=()=>{};
    this.mesh.visible=false;
    this.slots=new Map();
    this.free=Array.from({length:tracks},(_,i)=>i);
    this.scratch=new Vector3();
    scene.add(this.mesh);
  }

  // Extend a flyer's ribbon to its current point. strength 0 lets it fade.
  follow(id,point,time,strength,colour){
    let track=this.slots.get(id);
    if(!track){
      if(!strength||!this.free.length)return;
      track={slot:this.free.shift(),points:Array.from({length:RIBBON.points},()=>({p:point.clone(),born:-1e4,strength:0})),
        lastPush:-1e4,seen:time,colour};
      this.slots.set(id,track);
    }
    track.seen=time;
    const head=track.points[0];
    // After a gap the old path is gone: restart from here, so no strip
    // stretches across the jump.
    if(strength&&time-track.lastPush>RIBBON.life){
      for(const item of track.points){item.p.copy(point);item.born=-1e4;}
      track.lastPush=time;
    }
    // The head rides with the body; a new point is committed once it is a
    // spacing away from the last committed one.
    if(strength&&track.points[1].p.distanceTo(point)>=RIBBON.spacing){
      const tail=track.points.pop();
      tail.p.copy(point);tail.born=time;tail.strength=strength;
      track.points.unshift(tail);
      track.lastPush=time;
    }else{
      head.p.copy(point);
      if(strength){head.born=time;head.strength=strength;}
    }
    this.write(track);
  }

  write(track){
    const base=track.slot*RIBBON.points*2,{points,colour}=track;
    for(let i=0;i<points.length;i++){
      const here=points[i].p,next=points[Math.min(points.length-1,i+1)].p,previous=points[Math.max(0,i-1)].p;
      this.scratch.subVectors(previous,next);
      if(this.scratch.lengthSq()<1e-8)this.scratch.set(0,0,1);
      for(const side of [0,1]){
        const v=base+i*2+side;
        this.center.setXYZ(v,here.x,here.y,here.z);
        this.tangent.setXYZ(v,this.scratch.x,this.scratch.y,this.scratch.z);
        this.shape.setXYZW(v,side?1:-1,i/(points.length-1),points[i].born,points[i].strength);
        this.tint.setXYZ(v,colour.r,colour.g,colour.b);
      }
    }
    this.center.needsUpdate=this.tangent.needsUpdate=this.shape.needsUpdate=this.tint.needsUpdate=true;
    this.mesh.visible=true;
  }

  update(time,enabled){
    this.material.uniforms.clock.value=time;
    for(const [id,track] of this.slots){
      if(enabled&&time-track.seen<RIBBON.life+.2)continue;
      for(let i=0;i<RIBBON.points*2;i++)this.shape.setZ(track.slot*RIBBON.points*2+i,-1e4);
      this.shape.needsUpdate=true;
      this.free.push(track.slot);
      this.slots.delete(id);
    }
    this.mesh.visible=enabled&&this.slots.size>0;
  }

  dispose(){
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.slots.clear();
  }
}

// A boost breaking away: a hot flash at the body and a shock ring that
// races outward across the travel, thinning as it grows.
export const SHOCK={life:.55,radius:5.2,flash:.22};
export class Shockwaves{
  constructor(scene,{count=6}={}){
    this.count=count;
    const quads=count*2,vertices=quads*4;
    const geometry=new BufferGeometry();
    this.center=attribute(geometry,'position',vertices,3);
    this.axisU=attribute(geometry,'axisU',vertices,3);
    this.axisV=attribute(geometry,'axisV',vertices,3);
    this.data=attribute(geometry,'data',vertices,4);   // corner x, corner y, born, kind
    this.tint=attribute(geometry,'tint',vertices,3);
    geometry.setIndex(quadIndex(quads));
    for(let q=0;q<quads;q++)for(let c=0;c<4;c++)this.data.setXYZW(q*4+c,corners[c][0],corners[c][1],-1e4,q%2);
    this.material=new ShaderMaterial({
      transparent:true,depthWrite:false,blending:AdditiveBlending,side:DoubleSide,
      uniforms:{clock:{value:0}},
      vertexShader:`
        attribute vec3 axisU;
        attribute vec3 axisV;
        attribute vec4 data;
        attribute vec3 tint;
        uniform float clock;
        varying vec2 plane;
        varying float age;
        varying float kind;
        varying vec3 colour;
        void main(){
          age=(clock-data.z)/${SHOCK.life.toFixed(2)};
          kind=data.w;
          plane=data.xy;
          colour=tint;
          if(age<0.||age>1.){gl_Position=vec4(2.,2.,2.,1.);return;}
          vec4 eye;
          if(kind<.5){
            // Ring across the travel, eased out so it bursts then slows.
            float grow=1.-pow(1.-age,3.);
            float radius=.35+${SHOCK.radius.toFixed(2)}*grow;
            eye=modelViewMatrix*vec4(position+(axisU*data.x+axisV*data.y)*radius,1.);
          }else{
            // Flash: a camera-facing glow that swells and dies quickly.
            eye=modelViewMatrix*vec4(position,1.);
            float size=1.1+2.2*sqrt(min(1.,age/${(SHOCK.flash/SHOCK.life).toFixed(3)}));
            eye.xy+=data.xy*size;
          }
          gl_Position=projectionMatrix*eye;
        }`,
      fragmentShader:`
        varying vec2 plane;
        varying float age;
        varying float kind;
        varying vec3 colour;
        void main(){
          float r=length(plane);
          float light;
          if(kind<.5){
            float thickness=mix(.22,.04,age);
            float band=exp(-pow((r-(1.-thickness))/thickness,2.)*2.);
            float inner=smoothstep(.2,1.,r)*.18*(1.-age);
            light=(band+inner)*(1.-age)*(1.-age)*1.4*step(r,1.);
          }else{
            float life=clamp(age/${(SHOCK.flash/SHOCK.life).toFixed(3)},0.,1.);
            light=exp(-r*r*5.)*(1.-life)*2.2*(1.-smoothstep(.55,1.,r));
          }
          vec3 hot=mix(colour,vec3(1.),kind>.5?.8:.45);
          gl_FragColor=vec4(hot*light,1.);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh=new Mesh(geometry,this.material);
    this.mesh.name='Boost shockwaves';
    this.mesh.frustumCulled=false;
    this.mesh.raycast=()=>{};
    this.mesh.visible=false;
    this.next=0;
    this.last=-1e4;
    this.u=new Vector3();this.v=new Vector3();this.axis=new Vector3();
    scene.add(this.mesh);
  }

  fire(point,direction,time,colour){
    this.axis.copy(direction);
    if(this.axis.lengthSq()<1e-8)return;
    this.axis.normalize();
    basis(this.axis,this.u,this.v);
    const pair=this.next++%this.count;
    for(const quad of [pair*2,pair*2+1])for(let c=0;c<4;c++){
      const i=quad*4+c;
      this.center.setXYZ(i,point.x,point.y,point.z);
      this.axisU.setXYZ(i,this.u.x,this.u.y,this.u.z);
      this.axisV.setXYZ(i,this.v.x,this.v.y,this.v.z);
      this.data.setZ(i,time);
      this.tint.setXYZ(i,colour.r,colour.g,colour.b);
    }
    this.center.needsUpdate=this.axisU.needsUpdate=this.axisV.needsUpdate=this.data.needsUpdate=this.tint.needsUpdate=true;
    this.last=time;
    this.mesh.visible=true;
  }

  update(time,enabled){
    this.material.uniforms.clock.value=time;
    this.mesh.visible=enabled&&time-this.last<SHOCK.life;
  }

  dispose(){
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

// Rings spreading on the water where a body breaks the surface.
export const RIPPLE={life:1.6,radius:2.6};
export class WaterRipples{
  constructor(scene,{count=24}={}){
    this.count=count;
    const vertices=count*4;
    const geometry=new BufferGeometry();
    this.center=attribute(geometry,'position',vertices,3);
    this.axisU=attribute(geometry,'axisU',vertices,3);
    this.axisV=attribute(geometry,'axisV',vertices,3);
    this.data=attribute(geometry,'data',vertices,4);   // corner x, corner y, born, strength
    geometry.setIndex(quadIndex(count));
    for(let q=0;q<count;q++)for(let c=0;c<4;c++)this.data.setXYZW(q*4+c,corners[c][0],corners[c][1],-1e4,0);
    this.material=new ShaderMaterial({
      transparent:true,depthWrite:false,blending:NormalBlending,side:DoubleSide,
      uniforms:{clock:{value:0}},
      vertexShader:`
        attribute vec3 axisU;
        attribute vec3 axisV;
        attribute vec4 data;
        uniform float clock;
        varying vec2 plane;
        varying float age;
        varying float strength;
        void main(){
          age=(clock-data.z)/${RIPPLE.life.toFixed(2)};
          strength=data.w;
          plane=data.xy;
          if(age<0.||age>1.){gl_Position=vec4(2.,2.,2.,1.);return;}
          float radius=.3+${RIPPLE.radius.toFixed(2)}*(.4+.6*strength)*sqrt(age);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position+(axisU*data.x+axisV*data.y)*radius,1.);
        }`,
      fragmentShader:`
        varying vec2 plane;
        varying float age;
        varying float strength;
        void main(){
          float r=length(plane);
          if(r>1.)discard;
          // A leading crest, a trailing trough and a faint second ring.
          float crest=exp(-pow((r-.92)/.05,2.));
          float second=exp(-pow((r-.62)/.05,2.))*.55;
          float foam=smoothstep(.35,0.,r)*(1.-smoothstep(0.,.25,age))*.5;
          float fade=(1.-age)*(1.-age)*(.5+.5*strength);
          float a=(crest+second+foam)*fade*.75;
          gl_FragColor=vec4(mix(vec3(.62,.80,.86),vec3(.95,.99,1.),crest),a);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh=new Mesh(geometry,this.material);
    this.mesh.name='Water ripples';
    this.mesh.frustumCulled=false;
    this.mesh.raycast=()=>{};
    this.mesh.visible=false;
    this.next=0;
    this.last=-1e4;
    this.u=new Vector3();this.v=new Vector3();
    scene.add(this.mesh);
  }

  spawn(point,up,time,strength){
    basis(up,this.u,this.v);
    const q=this.next++%this.count;
    for(let c=0;c<4;c++){
      const i=q*4+c;
      this.center.setXYZ(i,point.x+up.x*.02,point.y+up.y*.02,point.z+up.z*.02);
      this.axisU.setXYZ(i,this.u.x,this.u.y,this.u.z);
      this.axisV.setXYZ(i,this.v.x,this.v.y,this.v.z);
      this.data.setZ(i,time);
      this.data.setW(i,Math.min(1,strength));
    }
    this.center.needsUpdate=this.axisU.needsUpdate=this.axisV.needsUpdate=this.data.needsUpdate=true;
    this.last=time;
    this.mesh.visible=true;
  }

  update(time,enabled){
    this.material.uniforms.clock.value=time;
    this.mesh.visible=enabled&&time-this.last<RIPPLE.life;
  }

  dispose(){
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

// Soft smoke: camera-facing puffs whose shape is animated noise, swelling,
// drifting and thinning as they age. Shared by boosts and hard landings.
export const SMOKE={life:1.5};
const noise=`
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float value(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*value(p);p*=2.03;a*=.5;}return s;}`;
export class SmokePuffs{
  constructor(scene,{count=48}={}){
    this.count=count;
    const vertices=count*4;
    const geometry=new BufferGeometry();
    this.center=attribute(geometry,'position',vertices,3);
    this.velocity=attribute(geometry,'velocity',vertices,3);
    this.data=attribute(geometry,'data',vertices,4);   // corner x, corner y, born, size
    this.tint=attribute(geometry,'tint',vertices,4);   // rgb, seed
    geometry.setIndex(quadIndex(count));
    for(let q=0;q<count;q++)for(let c=0;c<4;c++)this.data.setXYZW(q*4+c,corners[c][0],corners[c][1],-1e4,1);
    this.material=new ShaderMaterial({
      transparent:true,depthWrite:false,blending:NormalBlending,side:DoubleSide,
      uniforms:{clock:{value:0}},
      vertexShader:`
        attribute vec3 velocity;
        attribute vec4 data;
        attribute vec4 tint;
        uniform float clock;
        varying vec2 plane;
        varying float age;
        varying vec4 colour;
        void main(){
          float seconds=clock-data.z;
          age=seconds/${SMOKE.life.toFixed(2)};
          plane=data.xy;colour=tint;
          if(age<0.||age>1.){gl_Position=vec4(2.,2.,2.,1.);return;}
          // Thrown out fast, then caught by the air.
          vec3 travel=velocity*(1.-exp(-seconds*3.))/3.;
          vec4 eye=modelViewMatrix*vec4(position+travel,1.);
          float size=data.w*(.45+1.4*sqrt(age));
          float spin=tint.w*6.283+seconds*(tint.w-.5)*1.2;
          eye.xy+=mat2(cos(spin),-sin(spin),sin(spin),cos(spin))*data.xy*size;
          gl_Position=projectionMatrix*eye;
        }`,
      fragmentShader:`
        varying vec2 plane;
        varying float age;
        varying vec4 colour;
        ${noise}
        void main(){
          float r=length(plane);
          if(r>1.)discard;
          float billow=fbm(plane*1.6+colour.w*9.+age*1.3);
          float body=smoothstep(1.,.15,r+(billow-.5)*.9);
          float fade=smoothstep(0.,.08,age)*(1.-age)*(1.-age);
          // Lit from inside at first, then grey and cool.
          vec3 shade=mix(colour.rgb*1.2,vec3(.72,.76,.80),smoothstep(0.,.35,age))*(.75+.35*billow);
          gl_FragColor=vec4(shade,body*fade*.55);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh=new Mesh(geometry,this.material);
    this.mesh.name='Smoke puffs';
    this.mesh.frustumCulled=false;
    this.mesh.raycast=()=>{};
    this.mesh.visible=false;
    this.next=0;
    this.last=-1e4;
    scene.add(this.mesh);
  }

  puff(point,velocity,time,size,colour,seed=Math.random()){
    const q=this.next++%this.count;
    for(let c=0;c<4;c++){
      const i=q*4+c;
      this.center.setXYZ(i,point.x,point.y,point.z);
      this.velocity.setXYZ(i,velocity.x,velocity.y,velocity.z);
      this.data.setZ(i,time);this.data.setW(i,size);
      this.tint.setXYZW(i,colour.r,colour.g,colour.b,seed);
    }
    this.center.needsUpdate=this.velocity.needsUpdate=this.data.needsUpdate=this.tint.needsUpdate=true;
    this.last=time;
    this.mesh.visible=true;
  }

  update(time,enabled){
    this.material.uniforms.clock.value=time;
    this.mesh.visible=enabled&&time-this.last<SMOKE.life;
  }

  dispose(){
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

// A brief screen-only kick for the local boost. Never in VR or with
// reduced motion: there the view must stay exactly where the head is.
export class CameraKick{
  constructor(){this.at=-1e4;this.offset=new Vector3();}
  fire(time){this.at=time;}
  sample(time,up,right,{allowed=true}={}){
    const age=time-this.at;
    if(!allowed||age<0||age>.32)return this.offset.set(0,0,0);
    const fade=(1-age/.32)**2*.06;
    return this.offset.copy(up).multiplyScalar(Math.sin(age*71)*fade).addScaledVector(right,Math.sin(age*53+1.3)*fade*.7);
  }
}
