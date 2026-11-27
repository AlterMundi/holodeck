import {Ray,Vector3} from 'three';

const bodyRadius=.32;
const readings=[[.48,0],[.83,-.23],[.83,.23],[1.15,0]];
const up=new Vector3(0,1,0);
const detours=[Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2];
const followAlternatives=[-Math.PI/4,Math.PI/4,-Math.PI/2,Math.PI/2,Math.PI];
const landingOffsets=[[0,1],[0,-1],[1,0],[-1,0]];

// Ray queries inspect existing scene collision without changing the
// player's collision position or emitting MML contact events.
export class CompanionRoomClearance{
  constructor(){
    this.ray=new Ray();
    this.side=new Vector3();
    this.shift=new Vector3();
    this.candidate=new Vector3();
    this.lastTarget=new Vector3();
    this.progressTarget=new Vector3();
    this.reset();
  }

  reset(){
    this.hasTarget=false;
    this.stalled=0;
    this.bestDistance=Infinity;
    this.detouring=false;
  }

  clear(from,to,colliders){
    const {origin,direction}=this.ray;
    origin.copy(to).addScaledVector(up,1.27);
    direction.copy(up).negate();
    const surface=colliders.raycastFirst(this.ray,1.74);
    if(!surface||surface[0]<.85)return false;

    direction.subVectors(to,from).setY(0);
    const distance=direction.length();
    if(distance<1e-4)return true;
    direction.divideScalar(distance);
    this.side.crossVectors(up,direction);
    for(const [height,width] of readings){
      origin.copy(from).addScaledVector(up,height).addScaledVector(this.side,width);
      if(colliders.raycastFirst(this.ray,distance+bodyRadius))return false;
    }
    return true;
  }

  chooseTarget(leader,target,colliders,grounded){
    if(grounded&&this.selectSide(leader,target,colliders)){
      this.lastTarget.copy(target);
      this.hasTarget=true;
    }
    if(this.hasTarget)target.copy(this.lastTarget);
    return this.hasTarget;
  }

  selectSide(leader,target,colliders){
    // Compare against the actor's foot level, including on steps.
    target.y=leader.y;
    if(this.clear(leader,target,colliders))return true;
    this.shift.subVectors(target,leader);
    for(const angle of followAlternatives){
      this.candidate.copy(this.shift).applyAxisAngle(up,angle).add(leader);
      if(this.clear(leader,this.candidate,colliders)){target.copy(this.candidate);return true;}
    }
    // Narrow stair landings need an offset along the steps, between the rails.
    for(const [x,z] of landingOffsets){
      this.candidate.copy(leader);
      this.candidate.x+=.95*x;
      this.candidate.z+=.95*z;
      if(this.clear(leader,this.candidate,colliders)){target.copy(this.candidate);return true;}
    }
    return false;
  }

  step(from,next,colliders){
    this.detouring=false;
    if(this.clear(from,next,colliders))return true;
    this.detouring=true;
    this.shift.subVectors(next,from);
    for(const angle of detours){
      this.candidate.copy(this.shift).applyAxisAngle(up,angle).add(from);
      if(this.clear(from,this.candidate,colliders)){next.copy(this.candidate);return true;}
    }
    return false;
  }

  needsTransfer(from,target,seconds){
    const distance=from.distanceTo(target);
    if(distance<1.9||this.bestDistance===Infinity||
        this.progressTarget.distanceToSquared(target)>1.44||distance<this.bestDistance-.26){
      this.progressTarget.copy(target);
      this.bestDistance=distance;
      this.stalled=0;
    }else if(this.detouring||this.stalled>0){
      this.stalled+=seconds;
    }
    return this.stalled>1.6;
  }
}
