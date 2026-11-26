import {Box3,FrontSide,Line3,Matrix4,Plane,Ray,Vector3} from 'three';
import {ExtendedTriangle,MeshBVH} from 'three-mesh-bvh/src/index.js';

export const matterInspectionNear=.02;

const trees=new WeakMap();

export function indexMatterPart(geometry,index){
  let tree=trees.get(geometry);
  if(!tree){
    tree=index?MeshBVH.deserialize(index,geometry,{setIndex:false}):new MeshBVH(geometry,{indirect:true});
    trees.set(geometry,tree);
  }
  return tree;
}

// Require a positively wound watertight surface. CAD exporters can repeat the
// same position for face normals, so compare exact positions rather than indices.
export function closedMatterPart(positions,indices){
  const vertices=new Map(),welded=new Uint32Array(positions.length/3),edges=new Map();
  const stride=welded.length+1;
  const vertex=i=>{
    if(welded[i])return welded[i];
    const at=3*i,key=positions[at]+','+positions[at+1]+','+positions[at+2];
    let id=vertices.get(key);
    if(id===undefined){id=vertices.size+1;vertices.set(key,id);}
    return welded[i]=id;
  };
  const edge=(a,b)=>{
    const forward=a<b,key=forward?a*stride+b:b*stride+a;
    const orientation=forward?1:-1,prior=edges.get(key);
    if(prior===undefined){edges.set(key,orientation);return true;}
    if(prior===-orientation){edges.set(key,0);return true;}
    return false;
  };
  let volume=0;
  const ox=positions[0],oy=positions[1],oz=positions[2];
  for(let i=0;i<indices.length;i+=3){
    const a=indices[i],b=indices[i+1],c=indices[i+2];
    const wa=vertex(a),wb=vertex(b),wc=vertex(c);
    if(wa===wb||wb===wc||wc===wa||!edge(wa,wb)||!edge(wb,wc)||!edge(wc,wa))return false;
    const ax=positions[3*a]-ox,ay=positions[3*a+1]-oy,az=positions[3*a+2]-oz;
    const bx=positions[3*b]-ox,by=positions[3*b+1]-oy,bz=positions[3*b+2]-oz;
    const cx=positions[3*c]-ox,cy=positions[3*c+1]-oy,cz=positions[3*c+2]-oz;
    volume+=ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx);
  }
  if(!(volume>0))return false;
  for(const orientation of edges.values())if(orientation)return false;
  return true;
}

export function firstMatterHit(parts,ray){
  const inverse=new Matrix4(),local=new Ray(),direction=new Vector3(),section=new Plane();
  let best=null;
  for(const mesh of parts){
    if(!mesh.material.visible||mesh.material.opacity<=0)continue;
    let visible=true;
    for(let parent=mesh;parent;parent=parent.parent){
      if(!parent.visible){visible=false;break;}
    }
    if(!visible)continue;
    mesh.updateWorldMatrix(true,false);
    const {geometry,matrixWorld}=mesh;
    inverse.copy(matrixWorld).invert();
    local.origin.copy(ray.origin).applyMatrix4(inverse);
    direction.copy(ray.origin).add(ray.direction).applyMatrix4(inverse).sub(local.origin);
    const localPerWorld=direction.length();
    if(!localPerWorld)continue;
    local.direction.copy(direction).divideScalar(localPerWorld);
    if(!geometry.boundingBox)geometry.computeBoundingBox();
    if(!local.intersectsBox(geometry.boundingBox))continue;
    let near=0,far=(best?.distance??Infinity)*localPerWorld;
    const cut=mesh.material.clippingPlanes?.[0];
    if(cut){
      section.copy(cut).applyMatrix4(inverse);
      const side=section.distanceToPoint(local.origin),slope=section.normal.dot(local.direction);
      if(slope>0)near=Math.max(near,-side/slope);
      else if(slope<0)far=Math.min(far,-side/slope);
      else if(side<0)continue;
      if(near>far)continue;
    }
    const hit=indexMatterPart(geometry).raycastFirst(local,mesh.material.side??FrontSide,near,far);
    if(hit){
      const distance=hit.distance/localPerWorld;
      if(!best||distance<best.distance)best={object:mesh,distance,point:hit.point.applyMatrix4(matrixWorld)};
    }
  }
  return best;
}

const padding=.008;
const inContact=(distance,radius)=>distance<radius-1e-6;

// CAD positions, rotation, visibility and section are local to each visitor.
// Index the existing part geometry without changing its triangle order.
export class MatterContact{
  constructor(){
    this.sweepBox=new Box3();
    this.worldBox=new Box3();
    this.segment=new Line3();
    this.goal=new Vector3();
    this.closest=new Vector3();
    this.hit=new Vector3();
    this.normal=new Vector3();
    this.ray=new Ray();
    this.inverse=new Matrix4();
    this.section=new Plane();
    this.clipped=new ExtendedTriangle();
    this.polygon=Array.from({length:4},()=>new Vector3());
  }

  // The corner clearance of the small inspection near plane fits into
  // openings that the full-sized camera's near plane would clip.
  limit(parts,from,to,{fov,aspect}){
    if(!parts?.size||from.distanceToSquared(to)<1e-12)return 1;
    const halfHeight=matterInspectionNear*Math.tan(fov*Math.PI/360);
    const clearance=Math.hypot(matterInspectionNear,halfHeight,halfHeight*aspect)+padding;
    let fraction=1;
    for(const mesh of parts.values()){
      if(!mesh.visible)continue;
      mesh.updateWorldMatrix(true,false);
      const {geometry,matrixWorld}=mesh;
      this.worldBox.copy(geometry.boundingBox).applyMatrix4(matrixWorld);
      this.sweepBox.setFromPoints([from,to]).expandByScalar(clearance);
      if(!this.worldBox.intersectsBox(this.sweepBox))continue;
      const section=mesh.material.clippingPlanes?.[0];
      if(section&&this.worldBox.min.y>section.constant)continue;
      this.inverse.copy(matrixWorld).invert();
      const radius=clearance/matrixWorld.getMaxScaleOnAxis();
      this.segment.start.copy(from).applyMatrix4(this.inverse);
      this.goal.copy(to).applyMatrix4(this.inverse);
      this.sweepBox.setFromPoints([this.segment.start,this.goal]).expandByScalar(radius);
      if(section)this.section.copy(section).applyMatrix4(this.inverse);
      const solid=mesh.userData.matterClosed===true;
      indexMatterPart(geometry).shapecast({
        intersectsBounds:box=>box.intersectsBox(this.sweepBox),
        intersectsTriangle:triangle=>{
          if(section){
            const count=this.clip(triangle);
            for(let i=1;i+1<count;i++){
              this.clipped.set(this.polygon[0],this.polygon[i],this.polygon[i+1]);
              this.clipped.needsUpdate=true;
              fraction=this.limitTriangle(this.clipped,radius,fraction,solid);
            }
          }else fraction=this.limitTriangle(triangle,radius,fraction,solid);
          return fraction===0;
        },
      });
      if(fraction===0)break;
    }
    return fraction;
  }

  clip(triangle){
    const vertices=triangle.points;
    let count=0;
    for(let i=0;i<3;i++){
      const a=vertices[i],b=vertices[(i+1)%3];
      const da=this.section.distanceToPoint(a),db=this.section.distanceToPoint(b);
      if(da>=0)this.polygon[count++].copy(a);
      if((da<0&&db>0)||(da>0&&db<0))
        this.polygon[count++].copy(a).lerp(b,da/(da-db));
    }
    return count;
  }

  limitTriangle(triangle,radius,fraction,solid){
    const {start,end}=this.segment;
    // Closed CAD renders its outward faces. If it appeared around the eye,
    // let the visitor leave along an unseen back face without moving them.
    if(solid&&triangle.getNormal(this.normal).dot(this.hit.subVectors(start,triangle.a))<0)return fraction;
    triangle.closestPointToPoint(start,this.closest);
    if(inContact(start.distanceTo(this.closest),radius)){
      // An incoming model or rotated part can overlap a stationary visitor.
      // Permit motion away from the contact, including a tangential escape.
      this.hit.subVectors(start,this.closest);
      this.ray.direction.subVectors(this.goal,start);
      return this.hit.dot(this.ray.direction)>=0?fraction:0;
    }
    const intersects=step=>{
      end.copy(start).lerp(this.goal,step);
      this.ray.set(start,this.ray.direction.subVectors(end,start).normalize());
      // closestPointToSegment in the pinned library tests edges and endpoints.
      // The ray also checks an interior crossing through a zero-thickness face.
      if(this.ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,this.hit)&&
        this.hit.distanceToSquared(start)<=start.distanceToSquared(end))return true;
      return inContact(triangle.closestPointToSegment(this.segment),radius);
    };
    if(!intersects(fraction))return fraction;
    let low=0,high=fraction;
    for(let i=0;i<12;i++){
      const mid=(low+high)/2;
      if(intersects(mid))high=mid;
      else low=mid;
    }
    return low;
  }
}
