import {Box3,Matrix4,Ray,Vector3} from 'three';

const clearance=.095;
const maximumStep=.35;

export class TabletopCompanionPerch{
  constructor(){
    this.box=new Box3();
    this.obstacle=new Box3();
    this.ray=new Ray();
    this.hit=new Vector3();
    this.inverse=new Matrix4();
    this.pieceLocal=new Matrix4();
    this.eye=new Vector3();
    this.center=new Vector3();
    this.side=new Vector3();
    this.size=new Vector3();
    this.candidate=new Vector3();
    this.delta=new Vector3();
  }
  clear(){
    this.mesh=null;
    this.sign=0;
    this.ready=false;
  }
  apply(target,current,player,eye,mesh,bounds,space){
    if(this.mesh!==mesh){this.clear();this.mesh=mesh;}
    this.ready=false;
    if(!mesh?.geometry||!eye)return false;
    space.updateWorldMatrix(true,false);
    mesh.updateWorldMatrix(true,false);
    this.inverse.copy(space.matrixWorld).invert();
    if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
    this.pieceLocal.multiplyMatrices(this.inverse,mesh.matrixWorld);
    this.box.copy(mesh.geometry.boundingBox).applyMatrix4(this.pieceLocal);
    if(this.box.isEmpty())return false;
    this.eye.copy(eye).applyMatrix4(this.inverse);
    this.box.getCenter(this.center);
    this.box.getSize(this.size);
    this.obstacle.min.set(this.box.min.x-clearance, -1, this.box.min.z-clearance);
    this.obstacle.max.set(this.box.max.x+clearance, 1, this.box.max.z+clearance);
    this.ready=true;
    // Leave a margin beyond the piece's horizontal extent across the view.
    this.side.set(this.center.z-this.eye.z,0,this.eye.x-this.center.x);
    if(this.side.lengthSq()<.0081){
      if(this.blocked(current,target))this.hold(target,current);
      return false;
    }
    this.side.normalize();
    const radius=(Math.abs(this.side.x)*this.size.x+Math.abs(this.side.z)*this.size.z)/2+clearance;
    const lateral=this.delta.subVectors(target,this.center).dot(this.side);
    const near=this.delta.subVectors(current,this.center).dot(this.side)<0?-1:1;
    const first=this.sign||near;
    if(this.trial(target,current,player,bounds,lateral,radius,first)||
       !this.sign&&this.trial(target,current,player,bounds,lateral,radius,-first))return true;
    if(this.blocked(current,target))this.hold(target,current);
    return false;
  }
  hold(target,current){
    target.x=current.x;target.z=current.z;
  }
  blocked(current,target){
    if(!this.ready)return false;
    this.ray.origin.set(current.x,0,current.z);
    if(this.obstacle.containsPoint(this.ray.origin)){
      // Overlap may already exist after a snap or a part moves. Permit
      // horizontal progress toward an exit, and reject deeper motion.
      const depth=point=>Math.min(point.x-this.obstacle.min.x,this.obstacle.max.x-point.x,
        point.z-this.obstacle.min.z,this.obstacle.max.z-point.z);
      return depth(target)>=depth(current);
    }
    this.ray.direction.set(target.x-current.x,0,target.z-current.z);
    const distance=this.ray.direction.length();
    if(distance<.001)return false;
    this.ray.direction.divideScalar(distance);
    return Boolean(this.ray.intersectBox(this.obstacle,this.hit)&&
      this.hit.distanceToSquared(this.ray.origin)<distance**2);
  }
  trial(target,current,player,bounds,lateral,radius,sign){
    this.candidate.copy(target);
    if(sign*lateral<radius)this.candidate.addScaledVector(this.side,sign*radius-lateral);
    bounds.clampPoint(this.candidate,this.candidate);
    const exact=this.delta.subVectors(this.candidate,this.center).dot(this.side);
    if(sign*exact<radius-.001||this.candidate.distanceToSquared(target)>maximumStep**2||
      Math.hypot(this.candidate.x-player.x,this.candidate.z-player.z)<clearance||
      this.blocked(current,this.candidate))return false;
    this.sign=sign;
    target.copy(this.candidate);
    return true;
  }
}
