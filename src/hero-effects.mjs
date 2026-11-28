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
      transparent:true,depthWrite:false,blending:AdditiveBlending,side:DoubleSide,
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
          vec3 light=mix(colour,vec3(1.),core*.7);
          gl_FragColor=vec4(light*(core+halo)*glow,1.);
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
