import {useToroidalRockDetail} from './toroidal-surface-detail.mjs';
import {BufferAttribute, BufferGeometry, Mesh, MeshStandardMaterial} from 'three';
import {TOROIDAL_TERRAIN, terrainColor, terrainElevation, terrainPosition, terrainTrail} from './toroidal-terrain.mjs';

export const CAVE = Object.freeze({from: .0076, to: .0117, latitude: .265});
export const CAVE_ENTRANCE = Object.freeze({u:CAVE.from,v:CAVE.latitude});
const SECTION_COUNT = 36;
const ARCH_SEGMENTS = 16;
const TAU = 2 * Math.PI;

function weatheredContact(rock, u, v, floor, clearance, transition, terrain, strength = 1) {
  if (clearance >= transition) return rock;
  const t = Math.max(0, clearance / transition);
  const soilWeight = strength * .76 * (1 - t * t * (3 - 2 * t));
  const soil = terrainColor(u,v,floor,.08,terrain);
  return rock.map((channel,i)=>soil[i] * .84 * soilWeight + channel * (1 - soilWeight));
}

// The tunnel and its two chambers follow the seeded terrain at the same
// elevation used by locomotion. Rock joins the underlying ground on both
// sides, and the shared triangle shell bounds the actual walkable passage.
export function buildToroidalCave(terrain = TOROIDAL_TERRAIN) {
  const centerU = (CAVE.from + CAVE.to) / 2;
  const origin = terrainPosition(centerU, CAVE.latitude, terrainElevation(centerU, CAVE.latitude, terrain), terrain);
  const width = ARCH_SEGMENTS + 1;
  const stride = (SECTION_COUNT + 1) * width;
  const positions = new Float32Array(stride * 6);
  const colors = new Float32Array(positions.length);
  const groundContact = new Float32Array(stride * 4);
  const indices = [];
  for (let section = 0; section <= SECTION_COUNT; section += 1) {
    const t = section / SECTION_COUNT;
    const u = CAVE.from + (CAVE.to - CAVE.from) * t;
    const center = CAVE.latitude + .00032 * Math.sin(t * TAU);
    const chambers = Math.sin(Math.PI * t) * (.58 - .42 * Math.cos(t * 2 * TAU));
    const tunnelWidth = 2.8 + 2 * chambers;
    const ceiling = 2.65 + 2.4 * chambers;
    const walls = 1.6 + 1.8 * Math.sin(Math.PI * t);
    const fromEntrance = t < .5;
    const towardChambers = fromEntrance ? 1 : -1;
    const mouth = Math.max(0, 1 - 7 * Math.min(t, 1 - t)) ** 2;
    for (let arch = 0; arch <= ARCH_SEGMENTS; arch += 1) {
      const radialAngle = Math.PI * arch / ARCH_SEGMENTS;
      const roughness = .34 * Math.sin(23 * t + .7 * arch) + .17 * Math.sin(51 * t - 1.8 * arch);
      const transverse = Math.cos(radialAngle);
      const lift = Math.sin(radialAngle);
      // Roll exposed toes into the slope. Fade out below the shoulder of
      // each arch so the roof and the complete inner surface keep their shape.
      const low = Math.max(0, 1 - lift / .62);
      const toe = mouth * low * low * (3 - 2 * low);
      const trailSide = fromEntrance ? transverse < 0 : transverse > 0;
      const retreat = trailSide ? 2.5 : 1.6;
      const mouthOffset = towardChambers * (mouth *
        (1.75 * lift - 2.7 * transverse ** 2 + .75 * Math.cos(6 * radialAngle)) + toe * retreat);
      const bedding = Math.sin(9 * radialAngle + 3 * t) + .46 * Math.sin(19 * radialAngle - 11 * t);
      const shade = .83 + .08 * Math.sin(18 * t + .65 * arch) + .07 * bedding;
      for (let skin = 0; skin < 2; skin += 1) {
        const outer = skin === 0;
        const skirt = mouth * (1 - lift) * (2.1 + .6 * bedding) - toe * (trailSide ? 1.3 : .8);
        const metersAcross = transverse * (tunnelWidth + (outer ? walls + roughness + skirt : .25 * roughness));
        const v = center + metersAcross / (TAU * terrain.tubeRadius);
        const longitude = outer ? u + mouthOffset / (TAU * terrain.majorRadius) : u;
        const floor = terrainElevation(longitude, v, terrain);
        const shell = walls + roughness * 2 + (.45 + .55 * mouth) * bedding;
        const height = floor - 1.1 + lift * (ceiling + 1.1 + (outer ? shell : roughness * .2)) -
          (outer ? toe * (trailSide ? .74 : .49) : 0);
        const p = terrainPosition(longitude,v,height,terrain);
        const vertex = skin * stride + section * width + arch;
        const index = vertex * 3;
        const brightness = shade * (outer ? .85 : .45);
        const mineral = outer ? bedding * .035 : 0;
        for (let axis = 0; axis < 3; axis += 1) positions[index + axis] = p[axis] - origin[axis];
        const rock = [(.34 + mineral) * brightness,.265 * brightness,(.201 - .4 * mineral) * brightness];
        const clearance = height - floor;
        groundContact[2 * vertex] = clearance;
        groundContact[2 * vertex + 1] = outer ? 1 : 0;
        colors.set(weatheredContact(rock,longitude,v,floor,clearance,
          outer ? 1.4 : .52,terrain,outer ? 1 : .24),index);
      }

      if (arch < ARCH_SEGMENTS && section < SECTION_COUNT) {
        const a = section * width + arch, b = a + width, c = a + 1, d = b + 1;
        indices.push(a,b,c, b,d,c, a+stride,c+stride,b+stride, b+stride,c+stride,d+stride);
      }
      if (arch < ARCH_SEGMENTS && (section === 0 || section === SECTION_COUNT)) {
        const a = section * width + arch, b = a + 1;
        if (section === 0) indices.push(a,b,a+stride, b,b+stride,a+stride);
        else indices.push(a,a+stride,b, b,a+stride,b+stride);
      }
    }
  }
  return {origin,positions,colors,groundContact,indices:new Uint16Array(indices)};
}

// The rock crown rises beside the arrival end of the passage, outside the
// arch, leaving the original route and tunnel floor clear.
const fins=[
  {u:.00836,v:.26193,length:3.5,width:1.53,height:14.0,turn:-.18,lean:1.82},
  {u:.00897,v:.26898,length:2.34,width:1.48,height:8.3,turn:.39,lean:1.07},
  {u:.00823,v:.27036,length:2.25,width:1.38,height:6.8,turn:.45,lean:.71},
  {u:.00885,v:.26083,length:2.88,width:1.34,height:11.6,turn:-.26,lean:-.93},
];
const sections=[
  [0,1.0,0],[.18,1.0,0],[.40,.92,0],[.57,.84,0],[.621,.80,1],
  [.665,.78,1],[.79,.69,0],[.91,.56,0],[.978,.39,0],[1,.21,0],
];

export function buildCaveCrown(terrain = TOROIDAL_TERRAIN) {
  const {u,v}=CAVE_ENTRANCE;
  const origin=terrainPosition(u,v,terrainElevation(u,v,terrain),terrain);
  const positions=[],colors=[],groundContact=[],indices=[];
  const sides=8;
  for(const [ordinal,fin] of fins.entries()){
    const first=positions.length/3;
    const ringRadius=terrain.majorRadius+terrain.tubeRadius*Math.cos(fin.v*TAU);
    const ca=Math.cos(fin.turn),sa=Math.sin(fin.turn);
    for(const [rise,radius,vein] of sections){
      for(let side=0;side<sides;side++){
        const angle=TAU*(side+.28)/sides;
        const edge=.86+.12*Math.sin(side*6.1+ordinal*2.1)+.09*Math.cos(side*3.7);
        const along=Math.cos(angle)*fin.length*edge;
        const across=Math.sin(angle)*fin.width*edge;
        const du=(along*ca-across*sa)/(TAU*ringRadius);
        const dv=(across*ca+along*sa)/(TAU*terrain.tubeRadius);
        const lean=fin.lean*rise*rise;
        let root=radius;
        if(rise===0){
          // Keep the buried buttress on the side away from the footpath.
          const flare=1.20+.12*Math.sin(side*2.1+ordinal);
          if(terrainTrail(fin.u+du*flare,fin.v+dv*flare,terrain)<.045)root=flare;
        }
        const pointU=fin.u+du*root+lean*ca/(TAU*ringRadius);
        const pointV=fin.v+dv*root+lean*sa/(TAU*terrain.tubeRadius);
        const grade=.9*Math.cos(angle+ordinal*.72)*Math.sin(rise*Math.PI/2);
        const floor=terrainElevation(pointU,pointV,terrain);
        const height=floor-1.65+rise*fin.height+rise*grade;
        const point=terrainPosition(pointU,pointV,height,terrain);
        positions.push(...point.map((value,i)=>value-origin[i]));
        const shade=.82+rise*.24+.09*Math.sin(side*3.4+ordinal);
        const mineral=vein&&ordinal===0&&side<5?.64:0;
        const rose=.035*Math.sin(side+ordinal);
        const rock=[shade*(.408+rose-mineral*.30),shade*(.227+mineral*.07),shade*(.12+mineral*.13)];
        const clearance=height-floor;
        colors.push(...weatheredContact(rock,pointU,pointV,floor,clearance,1.65,terrain));
        groundContact.push(clearance,1);
      }
    }
    for(let row=0;row<sections.length-1;row++){
      for(let side=0;side<sides;side++){
        const lower=first+row*sides+side,next=first+row*sides+(side+1)%sides;
        indices.push(lower,lower+sides,next,next,lower+sides,next+sides);
      }
    }
    const top=first+(sections.length-1)*sides;
    for(let side=1;side<sides-1;side++){
      indices.push(first,first+side,first+side+1,top,top+side+1,top+side);
    }
  }
  return {origin,positions:new Float32Array(positions),colors:new Float32Array(colors),
    groundContact:new Float32Array(groundContact),indices:new Uint16Array(indices)};
}

function rockMesh({origin,positions,colors,groundContact,indices},material,name) {
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(positions,3));
  geometry.setAttribute('color',new BufferAttribute(colors,3));
  geometry.setAttribute('caveGroundContact',new BufferAttribute(groundContact,2));
  geometry.setIndex(new BufferAttribute(indices,1));
  geometry.computeVertexNormals();
  const mesh=new Mesh(geometry,material);
  mesh.name=name;
  mesh.position.fromArray(origin);
  return mesh;
}

export class ToroidalCave {
  constructor(scene,colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.mesh = null;
    this.crown = null;
    this.location = terrainPosition((CAVE.from+CAVE.to)/2,CAVE.latitude);
  }

  update(position) {
    const distance = Math.hypot(position.x-this.location[0],position.y-this.location[1],position.z-this.location[2]);
    if (this.mesh) {
      if (distance > 210) this.dispose();
      return;
    }
    if (distance > 170) return;
    const material = new MeshStandardMaterial({vertexColors:true,roughness:.96});
    useToroidalRockDetail(material,{bedding:true,groundContact:'cave'});
    this.mesh=rockMesh(buildToroidalCave(),material,'Connected rock passage');
    const crownMaterial=new MeshStandardMaterial({vertexColors:true,roughness:.92,flatShading:true});
    useToroidalRockDetail(crownMaterial,{bedding:true,groundContact:'cave'});
    this.crown=rockMesh(buildCaveCrown(),crownMaterial,'Stone crown above the cave');
    for(const mesh of [this.mesh,this.crown]){
      this.scene.add(mesh);
      mesh.updateWorldMatrix(true,false);
      this.colliders.addCollider(mesh);
    }
  }

  dispose() {
    if (!this.mesh) return;
    for(const mesh of [this.mesh,this.crown]){
      this.colliders.removeCollider(mesh);
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.mesh = null;
    this.crown = null;
  }
}
