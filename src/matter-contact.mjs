import {Box3,Line3,Matrix4,Plane,Ray,Vector3} from 'three';
import {ExtendedTriangle,MeshBVH} from 'three-mesh-bvh/src/index.js';

export const matterInspectionNear=.02;

const padding=.008;
const inContact=(distance,radius)=>distance<radius-1e-6;

// CAD positions, rotation, visibility and section are local to each visitor.
// Index the existing part geometry without changing its triangle order.
export class MatterContact{
  constructor(){
    this.trees=new WeakMap();
    this.sweepBox=new Box3();
    this.worldBox=new Box3();
    this.segment=new Line3();
    this.goal=new Vector3();
    this.closest=new Vector3();
    this.hit=new Vector3();
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
      let tree=this.trees.get(geometry);
      if(!tree){
        tree=new MeshBVH(geometry,{indirect:true});
        this.trees.set(geometry,tree);
      }
      tree.shapecast({
        intersectsBounds:box=>box.intersectsBox(this.sweepBox),
        intersectsTriangle:triangle=>{
          if(section){
            const count=this.clip(triangle);
            for(let i=1;i+1<count;i++){
              this.clipped.set(this.polygon[0],this.polygon[i],this.polygon[i+1]);
              this.clipped.needsUpdate=true;
              fraction=this.limitTriangle(this.clipped,radius,fraction);
            }
          }else fraction=this.limitTriangle(triangle,radius,fraction);
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

  limitTriangle(triangle,radius,fraction){
    const {start,end}=this.segment;
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
