import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Points, Quaternion, ShaderMaterial, Vector3, Vector4,
} from 'three';
import {CAVE} from './toroidal-cave.mjs';
import {
  overlookCoordinates, residencePlantClearance, TOROIDAL_TERRAIN, terrainColor, terrainCoordinates,
  terrainElevation, terrainFrame, terrainMeadowMoisture, terrainPosition, terrainTrail, terrainWoodland,
} from './toroidal-terrain.mjs';

// A dense, wind-driven carpet of grass tufts around the explorer and a few
// night fireflies. It is purely local presentation: no collision, no shared
// state, and it never replaces the authored meadow beds and woodland cover.
// Tiles are fixed in (u,v) so the carpet stays put while the explorer moves.

const TAU=2*Math.PI;
const T=TOROIDAL_TERRAIN;
const TILE=8;                 // metres at the ring's mid latitude
const RADIUS=38;              // metres of visible carpet
const FULL_DENSITY=14;        // metres of full carpet before it thins out
const FAR_SHARE=.16;          // share of tufts left at the outer edge
const GROW_SECONDS=.9;        // a freshly built tile grows in instead of popping
const DENSITY=5.2;            // tufts per square metre on open meadow
const BUDGET_MS=3.5;          // generation time per frame
const COLUMNS=Math.round(TAU*T.majorRadius/TILE);
const ROWS=Math.round(TAU*T.tubeRadius/TILE);
const FIREFLIES=320;           // buffer capacity for the swarms in reach
// Swarms belong to fixed places on the ring: one candidate site per cell,
// kept only over hollows, damp meadow and banks. They fade with distance
// from the explorer, so a swarm enters and leaves only where it is unseen.
const SWARM_CELL=24;           // metres at the ring's mid latitude
const SWARM_COLUMNS=Math.round(TAU*T.majorRadius/SWARM_CELL);
const SWARM_ROWS=Math.round(TAU*T.tubeRadius/SWARM_CELL);
const SWARM_FADE=[24,36];      // metres: fully visible → gone
const SWARM_REACH=SWARM_FADE[1]+10;
const FLOWER_SHARE=.045;      // wildflowers per tuft on fresh meadow
const FLOWER_TINTS=[[1,.98,.92],[1,.97,.9],[1,.82,.28],[.62,.46,1],[.5,.55,1],[1,.62,.78]];
// The far meadow: a sparse layer of cheap clumps that takes over where the
// detailed carpet thins, so distant slopes keep the texture of grass.
const FAR_TILE=48;             // metres at the ring's mid latitude
const FAR_RADIUS=72;           // metres of visible far meadow
const FAR_START=[20,34];       // metres: clumps fade in as the carpet thins
const FAR_DENSITY=.32;          // clumps per square metre on open meadow
const FAR_COLUMNS=Math.round(TAU*T.majorRadius/FAR_TILE);
const FAR_ROWS=Math.round(TAU*T.tubeRadius/FAR_TILE);
// Walkers part the grass and leave a short path that springs back.
const LIVE_PUSHERS=2;          // explorer and the nearest other body
const TRAIL_PUSHERS=6;         // footprints left behind, shared
const PUSHERS=LIVE_PUSHERS+TRAIL_PUSHERS;
const FOOTSTEP=.85;            // metres between footprints
const TRAMPLE_SECONDS=1.4;     // a footprint has sprung back after this
const TRAMPLE_REACH=3.4;       // metres above the grass a body still parts it

const overlookStart=overlookCoordinates(-4.1,-8);
const overlookEnd=overlookCoordinates(4.1,7.4);

function wrap(value){
  const remainder=value%1;
  return remainder<0?remainder+1:remainder;
}
const wrappedDistance=(a,b)=>{
  const d=Math.abs(wrap(a)-wrap(b));
  return Math.min(d,1-d);
};

function random(column,row,index,salt){
  let n=Math.imul(column+1,73856093)^Math.imul(row+1,19349663)^Math.imul(index+1,83492791)^salt^T.seed;
  n=Math.imul(n^(n>>>16),0x7feb352d);
  n=Math.imul(n^(n>>>15),0x846ca68b);
  return ((n^(n>>>16))>>>0)/4294967296;
}

// Places where authored ground, paving or buildings own the surface.
export function grassCover(u,v,h){
  if(h<T.waterLevel+.35)return 0;
  if(u>overlookStart.u&&u<overlookEnd.u&&v>overlookStart.v&&v<overlookEnd.v)return 0;
  if(u>CAVE.from-.0004&&u<CAVE.to+.0004&&Math.abs(v-CAVE.latitude)<.0034)return 0;
  // Parcel commons, house plots and the arrival approach (parcel-local metres).
  const z=(wrap(u+.5)-.5)*TAU*T.majorRadius;
  const x=(.25-v)*TAU*(T.tubeRadius+18);
  const outside=Math.max(Math.abs(x)-9.5,-5-z,z-28);
  if(outside<0)return 0;
  if(residencePlantClearance(u,v,2.2))return 0;
  const trail=terrainTrail(u,v);
  if(trail>.55)return 0;
  const shore=Math.min(1,(h-T.waterLevel-.35)/1.4);
  const woodland=terrainWoodland(u,v,h);
  // Feather the parcel edge so the carpet thins out instead of ending in a hedge.
  const commons=Math.min(1,outside/5);
  return Math.max(0,(1-trail*1.6)*shore*(1-woodland*.55)*commons*commons);
}

function tuftGeometry(){
  const positions=[],colors=[],normals=[],indices=[];
  const blades=6,golden=Math.PI*(3-Math.sqrt(5));
  for(let b=0;b<blades;b++){
    const angle=b*golden+.3,dir=[Math.cos(angle),Math.sin(angle)];
    const spread=.025+.09*((b*37%11)/11);
    const lean=.10+.22*((b*53%7)/7);
    const height=.62+.38*((b*29%9)/9);
    const width=.034+.012*((b*17%5)/5);
    const side=[-dir[1],dir[0]];
    const base=positions.length/3;
    const steps=[0,.38,.72,1];
    for(const t of steps){
      const out=spread+lean*t*t;
      const cx=dir[0]*out,cz=dir[1]*out,y=height*t*(1-.12*t);
      const w=width*(1-t*.92);
      const shade=.28+.72*t*t;
      if(t<1){
        positions.push(cx-side[0]*w,y,cz-side[1]*w,cx+side[0]*w,y,cz+side[1]*w);
        colors.push(shade,shade,shade,shade,shade,shade);
        normals.push(dir[0]*.35,1,dir[1]*.35,dir[0]*.35,1,dir[1]*.35);
      }else{
        positions.push(cx,y,cz);
        colors.push(shade,shade*1.02,shade*.96);
        normals.push(dir[0]*.35,1,dir[1]*.35);
      }
    }
    for(let s=0;s<2;s++){
      const a=base+s*2;
      indices.push(a,a+1,a+2,a+1,a+3,a+2);
    }
    indices.push(base+4,base+5,base+6);
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
  geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));
  geometry.setIndex(indices);
  return geometry;
}

// Three crossed, tapered cards: twelve triangles that read as a clump of grass
// from twenty metres on, instead of thirty for a detailed tuft.
function clumpGeometry(){
  const positions=[],colors=[],normals=[],indices=[];
  for(let k=0;k<3;k++){
    const a=k*Math.PI/3+.2,dx=Math.cos(a),dz=Math.sin(a);
    const base=positions.length/3;
    const rows=[[0,.5,.3],[.55,.32,.62],[1,.06,1]];
    for(const [y,w,shade] of rows){
      positions.push(-dx*w,y,-dz*w,dx*w,y,dz*w);
      colors.push(shade,shade,shade,shade,shade*1.02,shade*.97);
      normals.push(-dz*.4,1,dx*.4,-dz*.4,1,dx*.4);
    }
    indices.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4,base+3,base+5,base+4);
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
  geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));
  geometry.setIndex(indices);
  return geometry;
}

function flowerGeometry(){
  const positions=[],colors=[],normals=[],indices=[];
  const quad=(points,colour,normal)=>{
    const base=positions.length/3;
    for(const p of points){positions.push(...p);colors.push(...colour);normals.push(...normal);}
    indices.push(base,base+1,base+2,base,base+2,base+3);
  };
  const stem=[.16,.3,.1],w=.008,top=1;
  quad([[-w,0,0],[w,0,0],[w*.6,top,0],[-w*.6,top,0]],stem,[0,.6,1]);
  quad([[0,0,-w],[0,0,w],[0,top,w*.6],[0,top,-w*.6]],stem,[1,.6,0]);
  // A small star of petals facing the sky, slightly cupped.
  const r=.05;
  for(let i=0;i<3;i++){
    const a=i*Math.PI/3,c=Math.cos(a)*r,s=Math.sin(a)*r,px=-Math.sin(a)*r*.38,pz=Math.cos(a)*r*.38;
    quad([[-c-px,top+.03,-s-pz],[c-px,top+.03,s-pz],[c+px,top-.004,s+pz],[-c+px,top-.004,-s+pz]],[1,1,1],[0,1,0]);
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
  geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));
  geometry.setIndex(indices);
  return geometry;
}

function grassMaterial(uniforms,{far=false,reactive=false}={}){
  const material=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:far?1:.78,metalness:0});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>',`#include <common>
        #define GRASS_PUSHERS ${PUSHERS}
        uniform float grassTime;
        uniform vec3 grassWind;
        uniform float grassReach;
        uniform vec4 grassPush[GRASS_PUSHERS];
        uniform vec4 grassPushBounds;
        attribute vec2 grassGrow;
        varying float vGrassTip;`)
      .replace('#include <beginnormal_vertex>',`vec3 objectNormal=${far?'vec3(0.,1.,0.)':'normalize(normal*vec3(.6,1.,.6))'};
        #ifdef USE_TANGENT
          vec3 objectTangent=vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vec3 grassOffset=vec3(0.);
        {
          vec3 root=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
          // Every tuft has its own rank (grassGrow.x) and leaves the carpet
          // smoothly in rank order as distance rises, so the far carpet
          // thins and the edge scatters instead of ending in a line. The
          // remaining far tufts widen a little to keep the colour of grass.
          float far=distance(root,cameraPosition);
          float jitter=fract(grassGrow.x*7.137+.31);
          float grow=smoothstep(grassGrow.y,grassGrow.y+${GROW_SECONDS.toFixed(2)},grassTime);
          ${far?`
          // Clumps kindle where the detailed carpet thins and leave the far
          // edge one by one, so neither border reads as a line.
          float inner=smoothstep(${FAR_START[0].toFixed(1)},${FAR_START[1].toFixed(1)},far+(jitter-.5)*7.0);
          float edge=1.-smoothstep(grassReach-22.0,grassReach-2.0,far+(jitter-.5)*14.0);
          float reach=inner*edge*grow;`:`
          float share=mix(1.,${FAR_SHARE.toFixed(2)},smoothstep(${FULL_DENSITY.toFixed(1)},grassReach,far));
          float keep=1.-smoothstep(share-.1,share,grassGrow.x);
          float edge=1.-smoothstep(grassReach-14.0,grassReach-2.0,far+(jitter-.5)*9.0);
          float reach=keep*edge*grow;
          transformed.xz*=1.+(1.-share)*.7;`}
          ${far?'':`
          if(reach>0.){
            float bend=position.y*position.y;
            float phase=dot(root,vec3(.173,.127,.191));
            float gust=.55+.45*sin(grassTime*.43+dot(root,grassWind)*.035);
            float sway=sin(grassTime*1.9+phase)*.55+sin(grassTime*3.1+phase*1.7)*.2;
            vec3 world=grassWind*(gust*.22+sway*.10*gust)*bend;
            world+=cross(grassWind,normalize(root))*sin(grassTime*2.3+phase*2.1)*.035*bend;
            ${reactive?`
            // Bodies part the grass around them: each recent footprint pushes
            // the tuft away and presses it down, then lets it spring back with
            // a small overshoot. One test per tuft skips all of it when nobody
            // is near.
            if(bend>.05&&grassPushBounds.w>0.&&distance(root,grassPushBounds.xyz)<grassPushBounds.w){
              vec3 axis=(modelMatrix*instanceMatrix*vec4(0.,1.,0.,0.)).xyz;
              float tall=length(axis);
              vec3 up=axis/max(tall,1e-4);
              vec3 trample=vec3(0.);
              float press=0.;
              for(int i=0;i<GRASS_PUSHERS;i++){
                vec4 body=grassPush[i];
                float age=grassTime-body.w;
                if(age<0.||age>${TRAMPLE_SECONDS.toFixed(2)})continue;
                vec3 offset=root-body.xyz;
                float above=-dot(offset,up);
                float gate=1.-smoothstep(1.1,${TRAMPLE_REACH.toFixed(2)},above);
                if(gate<=0.)continue;
                vec3 across=offset+up*above;
                float gap=length(across);
                // Low flight blows a wider, gentler hollow than a footstep.
                float radius=.8+max(0.,above)*.55;
                float spring=exp(-age*2.4)*(.8+.2*cos(age*11.));
                float amount=(1.-smoothstep(.1,radius,gap))*gate*spring;
                trample+=across/max(gap,.05)*amount;
                press=max(press,amount*(1.-smoothstep(.6,1.6,above)));
              }
              float parted=min(1.,length(trample));
              if(parted>0.){
                world+=(trample/max(length(trample),1e-4)*parted*.85-up*press*.5)*tall*bend;
              }
            }
            `:' '}
            grassOffset=world*reach;
          }`}
          transformed*=reach;
          vGrassTip=position.y;
        }`)
      .replace('#include <project_vertex>',`#include <project_vertex>
        mvPosition.xyz+=(viewMatrix*vec4(grassOffset,0.)).xyz;
        gl_Position=projectionMatrix*mvPosition;`)
      .replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
        #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined( USE_SHADOWMAP ) || defined( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
          worldPosition.xyz+=grassOffset;
        #endif`);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
        uniform float grassGlow;
        varying float vGrassTip;`)
      .replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
        normal=normalize(vNormal);`)
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        totalEmissiveRadiance+=diffuseColor.rgb*vGrassTip*vGrassTip*grassGlow;`);
    // Seen at a grazing angle, specular sheen turns distant clumps grey;
    // lit like the ground they stand on, they read as its texture.
    if(far)shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
        reflectedLight.directSpecular*=0.;
        reflectedLight.indirectSpecular*=0.;`);
  };
  material.customProgramCacheKey=()=>far?'holodeck-toroidal-grass-far-v3':reactive?'holodeck-toroidal-grass-reactive-v1':'holodeck-toroidal-grass-wind-v1';
  return material;
}

const fireflyVertex=`
  attribute vec4 seed;
  attribute vec3 lift;
  uniform float time;
  uniform float night;
  uniform vec3 viewer;
  varying float vGlow;
  void main(){
    vec3 drift=lift*(sin(time*.37+seed.x*6.28)*.45+.2)+
      vec3(sin(time*.21+seed.y*6.28),sin(time*.29+seed.z*6.28),cos(time*.23+seed.w*6.28))*.9;
    vec4 view=modelViewMatrix*vec4(position+drift,1.);
    float pulse=pow(.5+.5*sin(time*(1.1+seed.y*1.6)+seed.x*31.0),3.0);
    vec3 world=(modelMatrix*vec4(position+drift,1.)).xyz;
    // Each firefly kindles at its own distance, so a swarm gathers light
    // gradually as you approach and dims the same way as you leave.
    float kindle=distance(world,viewer)+(seed.z-.5)*8.;
    float reach=1.-smoothstep(${SWARM_FADE[0].toFixed(1)},${SWARM_FADE[1].toFixed(1)}-4.,kindle);
    vGlow=night*reach*(.25+.75*pulse);
    gl_PointSize=clamp(110.0/-view.z,2.5,16.0);
    gl_Position=projectionMatrix*view;
  }
`;
const fireflyFragment=`
  varying float vGlow;
  void main(){
    vec2 p=gl_PointCoord-.5;
    float d=dot(p,p)*4.0;
    float core=exp(-d*9.0)+exp(-d*2.5)*.18;
    gl_FragColor=vec4(vec3(.35,1.0,.82)*core*vGlow*6.0,1.0);
  }
`;

export class ToroidalGrass {
  constructor(scene,{density=globalThis.matchMedia?.('(pointer: coarse)').matches?.55:1}={}){
    this.density=density;
    this.group=new Group();
    this.group.name='holodeck-grass-carpet';
    scene.add(this.group);
    this.tiles=new Map();
    this.queue=[];
    this.uniforms={grassTime:{value:0},grassWind:{value:new Vector3(1,0,0)},grassReach:{value:RADIUS},grassGlow:{value:.06},
      grassPush:{value:Array.from({length:PUSHERS},()=>new Vector4(0,0,0,-1e4))},grassPushBounds:{value:new Vector4(0,0,0,0)}};
    this.geometry=tuftGeometry();
    this.flowerGeometry=flowerGeometry();
    this.material=grassMaterial(this.uniforms);
    this.reactiveMaterial=grassMaterial(this.uniforms,{reactive:true});
    this.farTiles=new Map();
    this.farGeometry=clumpGeometry();
    this.farMaterial=grassMaterial({...this.uniforms,grassReach:{value:FAR_RADIUS}},{far:true});
    this.walkers=new Map();
    this.footprints=Array.from({length:TRAIL_PUSHERS},()=>[0,0,0,-1e4]);
    this.footprintIndex=0;
    this.matrix=new Matrix4();
    this.quaternion=new Quaternion();
    this.yaw=new Quaternion();
    this.basis=new Matrix4();
    this.axisY=new Vector3(0,1,0);
    this.color=new Color();
    this.scratchColor=new Color();
    this.scale=new Vector3();
    this.place=new Vector3();
    this.seconds=0;
    this.fireflies=null;
    this.fireflyCells='';
    this.swarmSites=new Map();
  }

  tileKey(column,row){return column+':'+row;}

  disposeTile(mesh){
    const flowers=mesh.userData.flowers;
    if(flowers){
      flowers.geometry.dispose();
      flowers.dispose();
    }
    mesh.geometry.dispose();
    mesh.dispose();
  }

  buildTile(column,row){
    const u0=column/COLUMNS,v0=row/ROWS;
    const center=terrainPosition(u0+.5/COLUMNS,v0+.5/ROWS,terrainElevation(u0+.5/COLUMNS,v0+.5/ROWS));
    const latitudeScale=(T.majorRadius+T.tubeRadius*Math.cos(TAU*(v0+.5/ROWS)))/T.majorRadius;
    const candidates=Math.round(TILE*TILE*latitudeScale*DENSITY*this.density);
    const mesh=new InstancedMesh(this.geometry.clone(),this.material,candidates);
    mesh.position.fromArray(center);
    const flowers=new InstancedMesh(this.flowerGeometry.clone(),this.material,Math.ceil(candidates*FLOWER_SHARE*1.6)+1);
    let count=0,blooms=0;
    for(let i=0;i<candidates;i++){
      const pick=salt=>random(column,row,i,salt);
      const u=(column+pick(11))/COLUMNS,v=(row+pick(23))/ROWS;
      const h=terrainElevation(u,v);
      const cover=grassCover(u,v,h);
      if(cover<=0||pick(31)>cover*1.15)continue;
      // Steep faces read as rock in the ground colour; keep them bare.
      const du=.6/(TAU*T.majorRadius*latitudeScale),dv=.6/(TAU*T.tubeRadius);
      const slope=Math.hypot(terrainElevation(u+du,v)-h,terrainElevation(u,v+dv)-h)/.6;
      if(slope>.55||pick(37)<(slope-.3)*2.5)continue;
      const ground=terrainColor(u,v,h,slope);
      const frame=terrainFrame(u,v);
      const point=terrainPosition(u,v,h-.06);
      this.place.set(point[0]-center[0],point[1]-center[1],point[2]-center[2]);
      this.basis.makeBasis(
        new Vector3().fromArray(frame.alongRing),new Vector3().fromArray(frame.up),new Vector3().fromArray(frame.aroundTube));
      this.quaternion.setFromRotationMatrix(this.basis).multiply(this.yaw.setFromAxisAngle(this.axisY,pick(41)*TAU));
      const lush=.55+.45*Math.min(1,cover);
      const height=(.32+.5*pick(53)*pick(59)+.2*pick(61))*lush;
      const width=.8+.5*pick(67);
      this.scale.set(width,height,width);
      this.matrix.compose(this.place,this.quaternion,this.scale);
      mesh.setMatrixAt(count,this.matrix);
      // Tufts take the ground's hue, a little brighter, fresher and varied.
      const vary=.88+.3*pick(71),dry=pick(73)<.18;
      this.color.setRGB(
        (ground[0]*(dry?1.25:.92))*vary,
        (ground[1]*1.22+.01)*vary,
        (ground[2]*(dry?.95:.78))*vary);
      mesh.setColorAt(count,this.color);
      count++;
      const moisture=ground[1]/(ground[0]+ground[1]+ground[2]+1e-3);
      if(blooms<flowers.instanceMatrix.count&&pick(79)<FLOWER_SHARE*(.6+moisture*1.2)*cover){
        // Flowers rise just above the surrounding blades and gather in drifts.
        const drift=.5+.5*Math.sin(u*9000+row)*Math.sin(v*7000+column);
        if(pick(83)<.35+.65*drift){
          this.scale.set(1,height*(1.05+.35*pick(89))+.08,1);
          this.quaternion.multiply(this.yaw.setFromAxisAngle(this.axisY,pick(97)));
          this.matrix.compose(this.place,this.quaternion,this.scale);
          flowers.setMatrixAt(blooms,this.matrix);
          const tint=FLOWER_TINTS[Math.floor(pick(101)*FLOWER_TINTS.length)];
          this.color.setRGB(tint[0]*.9,tint[1]*.9,tint[2]*.9);
          flowers.setColorAt(blooms,this.color);
          blooms++;
        }
      }
    }
    flowers.count=blooms;
    flowers.instanceMatrix.needsUpdate=true;
    if(flowers.instanceColor)flowers.instanceColor.needsUpdate=true;
    flowers.receiveShadow=true;
    flowers.computeBoundingSphere();
    flowers.visible=blooms>0;
    flowers.name='grass-flowers';
    mesh.add(flowers);
    // Instances are in random order, so index order is a fair rank.
    const grow=(instance,total)=>{
      const values=new Float32Array(Math.max(1,total)*2);
      for(let i=0;i<total;i++){values[i*2]=(i+.5)/total;values[i*2+1]=this.seconds;}
      instance.geometry.setAttribute('grassGrow',new InstancedBufferAttribute(values,2));
    };
    grow(mesh,count);
    grow(flowers,blooms);
    mesh.userData.full=count;
    mesh.userData.flowers=flowers;
    mesh.count=count;
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.receiveShadow=true;
    mesh.castShadow=false;
    mesh.computeBoundingSphere();
    mesh.visible=count>0;
    mesh.name='grass-tile';
    return mesh;
  }

  // A far tile: fewer, larger clumps in the meadow's own colours. Some take
  // a flower tint, so distant drifts of colour survive past the carpet.
  buildFarTile(column,row){
    const u0=column/FAR_COLUMNS,v0=row/FAR_ROWS;
    const center=terrainPosition(u0+.5/FAR_COLUMNS,v0+.5/FAR_ROWS,terrainElevation(u0+.5/FAR_COLUMNS,v0+.5/FAR_ROWS));
    const latitudeScale=(T.majorRadius+T.tubeRadius*Math.cos(TAU*(v0+.5/FAR_ROWS)))/T.majorRadius;
    const candidates=Math.round(FAR_TILE*FAR_TILE*latitudeScale*FAR_DENSITY*this.density);
    const mesh=new InstancedMesh(this.farGeometry.clone(),this.farMaterial,Math.max(1,candidates));
    mesh.position.fromArray(center);
    let count=0;
    for(let i=0;i<candidates;i++){
      const pick=salt=>random(column+7919,row+104729,i,salt);
      const u=(column+pick(11))/FAR_COLUMNS,v=(row+pick(23))/FAR_ROWS;
      const h=terrainElevation(u,v);
      const cover=grassCover(u,v,h);
      if(cover<=0||pick(31)>cover*1.15)continue;
      const du=1.2/(TAU*T.majorRadius*latitudeScale),dv=1.2/(TAU*T.tubeRadius);
      const slope=Math.hypot(terrainElevation(u+du,v)-h,terrainElevation(u,v+dv)-h)/1.2;
      if(slope>.55||pick(37)<(slope-.3)*2.5)continue;
      const ground=terrainColor(u,v,h,slope);
      const frame=terrainFrame(u,v);
      const point=terrainPosition(u,v,h-.05);
      this.place.set(point[0]-center[0],point[1]-center[1],point[2]-center[2]);
      this.basis.makeBasis(
        new Vector3().fromArray(frame.alongRing),new Vector3().fromArray(frame.up),new Vector3().fromArray(frame.aroundTube));
      this.quaternion.setFromRotationMatrix(this.basis).multiply(this.yaw.setFromAxisAngle(this.axisY,pick(41)*TAU));
      const lush=.55+.45*Math.min(1,cover);
      const height=(.24+.2*pick(53)+.1*pick(61))*lush;
      const width=.55+.45*pick(67);
      this.scale.set(width,height,width);
      this.matrix.compose(this.place,this.quaternion,this.scale);
      mesh.setMatrixAt(count,this.matrix);
      const vary=.82+.26*pick(71),dry=pick(73)<.18;
      this.color.setRGB(
        (ground[0]*(dry?1.15:.86))*vary,
        (ground[1]*1.12+.01)*vary,
        (ground[2]*(dry?.9:.72))*vary);
      const moisture=ground[1]/(ground[0]+ground[1]+ground[2]+1e-3);
      const drift=.5+.5*Math.sin(u*9000+row)*Math.sin(v*7000+column);
      if(pick(79)<FLOWER_SHARE*2.2*(.6+moisture*1.2)*cover*drift){
        const tint=FLOWER_TINTS[Math.floor(pick(101)*FLOWER_TINTS.length)];
        this.color.lerp(this.scratchColor.setRGB(tint[0]*.85,tint[1]*.85,tint[2]*.85),.4);
      }
      mesh.setColorAt(count,this.color);
      count++;
    }
    const values=new Float32Array(Math.max(1,count)*2);
    for(let i=0;i<count;i++){values[i*2]=(i+.5)/count;values[i*2+1]=this.seconds;}
    mesh.geometry.setAttribute('grassGrow',new InstancedBufferAttribute(values,2));
    mesh.count=count;
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.receiveShadow=false;
    mesh.castShadow=false;
    mesh.computeBoundingSphere();
    mesh.visible=count>0;
    mesh.name='grass-far-tile';
    return mesh;
  }

  wanted(u,v,height,{columns=COLUMNS,rows=ROWS,tile=TILE,radius=RADIUS}={}){
    const ringMetres=TAU*(T.majorRadius+(T.tubeRadius+height)*Math.cos(TAU*v))/columns;
    const tubeMetres=TAU*(T.tubeRadius+height)/rows;
    const column=Math.floor(wrap(u)*columns),row=Math.floor(wrap(v)*rows);
    const spanU=Math.ceil((radius+tile)/ringMetres),spanV=Math.ceil((radius+tile)/tubeMetres);
    const list=[];
    for(let dc=-spanU;dc<=spanU;dc++)for(let dr=-spanV;dr<=spanV;dr++){
      const c=(column+dc+columns)%columns,r=(row+dr+rows)%rows;
      const cu=(c+.5)/columns,cv=(r+.5)/rows;
      const distance=Math.hypot(wrappedDistance(cu,u)*columns*ringMetres,wrappedDistance(cv,v)*rows*tubeMetres);
      if(distance<radius+tile*.75)list.push({c,r,distance});
    }
    return list.sort((a,b)=>a.distance-b.distance);
  }

  // A body near the grass this frame. Moving bodies leave footprints that
  // spring back; a long jump (teleport, respawn) leaves none.
  observe(id,position){
    if(!position||![position.x,position.y,position.z].every(Number.isFinite))return;
    let walker=this.walkers.get(id);
    if(!walker){
      if(this.walkers.size>=32)return;
      walker={last:[position.x,position.y,position.z],now:[0,0,0],seen:this.seconds};
      this.walkers.set(id,walker);
    }
    const [x,y,z]=walker.last;
    const moved=Math.hypot(position.x-x,position.y-y,position.z-z);
    if(moved>4)walker.last=[position.x,position.y,position.z];
    else if(moved>=FOOTSTEP){
      this.footprints[this.footprintIndex]=[x,y,z,this.seconds];
      this.footprintIndex=(this.footprintIndex+1)%TRAIL_PUSHERS;
      walker.last=[position.x,position.y,position.z];
    }
    walker.now=[position.x,position.y,position.z];
    walker.seen=this.seconds;
  }

  heightAbove(point){
    const {u,v,height}=terrainCoordinates(point);
    return height-terrainElevation(u,v);
  }

  updateTrample(position){
    const push=this.uniforms.grassPush.value,bounds=this.uniforms.grassPushBounds.value;
    for(const [id,walker] of this.walkers)if(this.seconds-walker.seen>.5)this.walkers.delete(id);
    // The explorer always owns a live slot; the nearest other bodies get the rest.
    const live=[...this.walkers.entries()].filter(([id])=>id!=='self')
      .map(([,walker])=>walker.now)
      .sort((a,b)=>Math.hypot(a[0]-position.x,a[1]-position.y,a[2]-position.z)-Math.hypot(b[0]-position.x,b[1]-position.y,b[2]-position.z));
    live.unshift([position.x,position.y,position.z]);
    let active=0;
    const centre=[0,0,0],samples=[];
    for(let i=0;i<PUSHERS;i++){
      const source=i<LIVE_PUSHERS?live[i]:this.footprints[i-LIVE_PUSHERS];
      const born=i<LIVE_PUSHERS?(source?this.seconds:-1e4):source[3];
      const above=source?this.heightAbove(source):Infinity;
      if(!source||this.seconds-born>TRAMPLE_SECONDS||above>TRAMPLE_REACH){push[i].set(0,0,0,-1e4);continue;}
      push[i].set(source[0],source[1],source[2],born);
      samples.push([...source,above]);
      centre[0]+=source[0];centre[1]+=source[1];centre[2]+=source[2];
      active++;
    }
    if(!active){bounds.set(0,0,0,0);return;}
    centre[0]/=active;centre[1]/=active;centre[2]/=active;
    let radius=0;
    // Beyond each body's own hollow (wider when it flies low), no tuft moves.
    for(const p of samples)radius=Math.max(radius,
      Math.hypot(p[0]-centre[0],p[1]-centre[1],p[2]-centre[2])+.8+Math.max(0,p[3])*1.55+.4);
    bounds.set(centre[0],centre[1],centre[2],radius);
  }

  selectTileMaterial(mesh) {
    const bounds=this.uniforms.grassPushBounds.value;
    const sphere=mesh.boundingSphere;
    const centre=sphere.center;
    const touched=Math.hypot(centre.x+mesh.position.x-bounds.x,centre.y+mesh.position.y-bounds.y,
      centre.z+mesh.position.z-bounds.z)<=sphere.radius+bounds.w;
    mesh.material=mesh.userData.flowers.material=touched?this.reactiveMaterial:this.material;
  }

  update(position,lightweight,daylight=1,seconds=1/60){
    const valid=position&&[position.x,position.y,position.z].every(Number.isFinite);
    this.group.visible=!lightweight&&valid;
    if(lightweight){
      this.clear();
      return;
    }
    if(!valid)return;
    this.seconds+=Math.min(.1,Math.max(0,seconds));
    const {u,v,height}=terrainCoordinates([position.x,position.y,position.z]);
    const frame=terrainFrame(u,v);
    // A steady breeze along the ring, slowly veering across the tube.
    const veer=Math.sin(this.seconds*.05)*.6;
    this.uniforms.grassWind.value.fromArray(frame.alongRing).multiplyScalar(Math.cos(veer))
      .addScaledVector(new Vector3().fromArray(frame.aroundTube),Math.sin(veer)).normalize();
    this.uniforms.grassTime.value=this.seconds;
    const day=Math.max(0,Math.min(1,daylight??1));
    this.uniforms.grassGlow.value=.045*day;
    this.observe('self',position);
    this.updateTrample(position);

    const wanted=this.wanted(u,v,height);
    const keep=new Set(wanted.map(({c,r})=>this.tileKey(c,r)));
    for(const [key,mesh] of this.tiles){
      if(keep.has(key))continue;
      this.group.remove(mesh);
      this.disposeTile(mesh);
      this.tiles.delete(key);
    }
    // Instances are in random order, so drawing a prefix thins a tile evenly.
    for(const {c,r,distance} of wanted){
      const mesh=this.tiles.get(this.tileKey(c,r));
      if(!mesh)continue;
      // Draw only the ranks the shader can still show at the tile's nearest
      // point; the shader does the gradual thinning itself.
      const nearest=Math.max(0,distance-TILE*.75-6); // 6 m: camera may sit behind the explorer
      const share=1+(FAR_SHARE-1)*smoothstep(FULL_DENSITY,RADIUS,nearest);
      mesh.count=Math.min(mesh.userData.full,Math.ceil(mesh.userData.full*share)+1);
      this.selectTileMaterial(mesh);
    }
    const farWanted=this.wanted(u,v,height,{columns:FAR_COLUMNS,rows:FAR_ROWS,tile:FAR_TILE,radius:FAR_RADIUS});
    const farKeep=new Set(farWanted.map(({c,r})=>this.tileKey(c,r)));
    for(const [key,mesh] of this.farTiles){
      if(farKeep.has(key))continue;
      this.group.remove(mesh);
      this.disposeTile(mesh);
      this.farTiles.delete(key);
    }
    // The detailed carpet comes first; the far meadow uses what time is left.
    const start=performance.now();
    let pending=false;
    for(const {c,r} of wanted){
      const key=this.tileKey(c,r);
      if(this.tiles.has(key))continue;
      if(performance.now()-start>BUDGET_MS){pending=true;break;}
      const mesh=this.buildTile(c,r);
      this.selectTileMaterial(mesh);
      this.tiles.set(key,mesh);
      this.group.add(mesh);
    }
    if(!pending)for(const {c,r} of farWanted){
      const key=this.tileKey(c,r);
      if(this.farTiles.has(key))continue;
      if(performance.now()-start>BUDGET_MS)break;
      const mesh=this.buildFarTile(c,r);
      this.farTiles.set(key,mesh);
      this.group.add(mesh);
    }
    this.updateFireflies(position,u,v,height,1-smoothstep(.04,.32,day));
  }

  // The swarm owned by one fixed cell, or null. Deterministic and cached.
  swarmSite(column,row){
    const key=column+':'+row;
    if(this.swarmSites.has(key))return this.swarmSites.get(key);
    if(this.swarmSites.size>4096)this.swarmSites.clear();
    const pick=s=>random(column,row,0,s);
    const pu=(column+.15+.7*pick(1))/SWARM_COLUMNS,pv=(row+.15+.7*pick(2))/SWARM_ROWS;
    let site=null;
    const h=terrainElevation(pu,pv);
    if(h>=T.waterLevel-.2&&(h<=T.waterLevel+.4||grassCover(pu,pv,h)>0)){
      const metresU=TAU*(T.majorRadius+(T.tubeRadius+h)*Math.cos(TAU*pv)),metresV=TAU*(T.tubeRadius+h);
      let around=0;
      for(let k=0;k<6;k++){
        const a=k/6*TAU;
        around+=terrainElevation(pu+Math.cos(a)*14/metresU,pv+Math.sin(a)*14/metresV);
      }
      const score=(around/6-h)*.6+(terrainMeadowMoisture(pu,pv,h)-.5)*3+(h<T.waterLevel+3?1.5:0);
      if(score>-.3){
        const count=Math.round(14+10*Math.min(1,score/3));
        const points=new Float32Array(count*3),lifts=new Float32Array(count*3),seeds=new Float32Array(count*4);
        for(let i=0;i<count;i++){
          const p=s=>random(column,row,i+1,s);
          const spread=2.6*Math.sqrt(-2*Math.log(Math.max(1e-4,p(11))))*.5,angle=p(13)*TAU;
          const fu=pu+Math.cos(angle)*spread/metresU,fv=pv+Math.sin(angle)*spread/metresV;
          const surface=Math.max(terrainElevation(fu,fv),T.waterLevel);
          points.set(terrainPosition(fu,fv,surface+.3+1.4*p(7)*p(9)),i*3);
          lifts.set(terrainFrame(fu,fv).up,i*3);
          for(let k=0;k<4;k++)seeds[i*4+k]=p(20+k);
        }
        site={centre:terrainPosition(pu,pv,Math.max(h,T.waterLevel)),points,lifts,seeds,count};
      }
    }
    this.swarmSites.set(key,site);
    return site;
  }

  updateFireflies(position,u,v,height,night){
    if(night<=.001){
      if(this.fireflies)this.fireflies.visible=false;
      return;
    }
    if(!this.fireflies){
      const geometry=new BufferGeometry();
      geometry.setAttribute('position',new BufferAttribute(new Float32Array(FIREFLIES*3),3));
      geometry.setAttribute('lift',new BufferAttribute(new Float32Array(FIREFLIES*3),3));
      geometry.setAttribute('seed',new BufferAttribute(new Float32Array(FIREFLIES*4),4));
      geometry.setDrawRange(0,0);
      this.fireflies=new Points(geometry,new ShaderMaterial({
        uniforms:{time:{value:0},night:{value:0},viewer:{value:new Vector3()}},
        vertexShader:fireflyVertex,fragmentShader:fireflyFragment,
        transparent:true,depthWrite:false,blending:AdditiveBlending,toneMapped:false,
      }));
      this.fireflies.frustumCulled=false;
      this.fireflies.name='holodeck-fireflies';
      this.group.add(this.fireflies);
    }
    // Swarms in reach, nearest first. Anything added or dropped here lies
    // beyond the fade, so changing the set never moves a visible firefly.
    const ringMetres=TAU*(T.majorRadius+(T.tubeRadius+height)*Math.cos(TAU*v))/SWARM_COLUMNS;
    const tubeMetres=TAU*(T.tubeRadius+height)/SWARM_ROWS;
    const column=Math.floor(wrap(u)*SWARM_COLUMNS),row=Math.floor(wrap(v)*SWARM_ROWS);
    const spanU=Math.ceil(SWARM_REACH/ringMetres)+1,spanV=Math.ceil(SWARM_REACH/tubeMetres)+1;
    const near=[];
    for(let dc=-spanU;dc<=spanU;dc++)for(let dr=-spanV;dr<=spanV;dr++){
      const c=(column+dc+SWARM_COLUMNS)%SWARM_COLUMNS,r=(row+dr+SWARM_ROWS)%SWARM_ROWS;
      const site=this.swarmSite(c,r);
      if(!site)continue;
      const distance=Math.hypot(site.centre[0]-position.x,site.centre[1]-position.y,site.centre[2]-position.z);
      if(distance<SWARM_REACH)near.push({key:c+':'+r,site,distance});
    }
    near.sort((a,b)=>a.distance-b.distance);
    // Nearest first, stopping at the first swarm that no longer fits.
    const chosen=[];
    let total=0;
    for(const swarm of near){
      if(total+swarm.site.count>FIREFLIES)break;
      chosen.push(swarm);
      total+=swarm.site.count;
    }
    const cells=chosen.map(({key})=>key).sort().join(' ');
    if(cells!==this.fireflyCells){
      this.fireflyCells=cells;
      const geometry=this.fireflies.geometry;
      const {position:points,lift:lifts,seed:seeds}=geometry.attributes;
      let placed=0;
      // Each firefly carries its own seed, so its drift and pulse stay the
      // same wherever it lands in the buffer.
      for(const {site} of chosen){
        points.array.set(site.points,placed*3);
        lifts.array.set(site.lifts,placed*3);
        seeds.array.set(site.seeds,placed*4);
        placed+=site.count;
      }
      geometry.setDrawRange(0,placed);
      geometry.attributes.position.needsUpdate=true;
      geometry.attributes.lift.needsUpdate=true;
      geometry.attributes.seed.needsUpdate=true;
    }
    this.fireflies.visible=true;
    this.fireflies.material.uniforms.time.value=this.seconds;
    this.fireflies.material.uniforms.night.value=night;
    this.fireflies.material.uniforms.viewer.value.set(position.x,position.y,position.z);
  }

  clear(){
    for(const mesh of this.tiles.values()){
      this.group.remove(mesh);
      this.disposeTile(mesh);
    }
    this.tiles.clear();
    for(const mesh of this.farTiles.values()){
      this.group.remove(mesh);
      this.disposeTile(mesh);
    }
    this.farTiles.clear();
    this.walkers.clear();
    for(const footprint of this.footprints)footprint[3]=-1e4;
    this.uniforms.grassPushBounds.value.set(0,0,0,0);
    if(this.fireflies)this.fireflies.visible=false;
    this.fireflyCells='';
  }

  dispose(){
    this.clear();
    if(this.fireflies){
      this.fireflies.geometry.dispose();
      this.fireflies.material.dispose();
      this.fireflies=null;
    }
    this.geometry.dispose();
    this.flowerGeometry.dispose();
    this.farGeometry.dispose();
    this.material.dispose();
    this.reactiveMaterial.dispose();
    this.farMaterial.dispose();
    this.group.removeFromParent();
  }
}

function smoothstep(edge0,edge1,x){
  const t=Math.max(0,Math.min(1,(x-edge0)/(edge1-edge0)));
  return t*t*(3-2*t);
}
