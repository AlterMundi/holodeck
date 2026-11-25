import {Ray,Vector3} from 'three';

const SKIN=.025;
const samples=[[0,0],[1,0],[-1,0],[0,1],[0,-1]];

// Sweep the crown of the capsule before the regular collision pass. In a
// toroidal space the same query follows the local radial up direction.
export function createAvatarHeadroom(){
  const ray=new Ray();
  return (position,rise,capsule,colliders,up,right,side)=>{
    if(!(rise>0))return rise;
    let allowed=rise;
    const {radius,segment}=capsule;
    for(const [x,z] of samples){
      const offset=(x||z)?radius*.8:0;
      const cap=segment.end.y+radius+Math.sqrt(radius*radius-offset*offset);
      ray.origin.copy(position).addScaledVector(up,cap-rise-SKIN)
        .addScaledVector(right,x*offset).addScaledVector(side,z*offset);
      ray.direction.copy(up);
      const hit=colliders.raycastFirst(ray,allowed+2*SKIN);
      if(hit)allowed=Math.min(allowed,Math.max(0,hit[0]-2*SKIN));
    }
    return allowed;
  };
}

export function bindInteriorHeadroom(manager,inside){
  const update=manager.update;
  const clearance=createAvatarHeadroom();
  const up=new Vector3(0,1,0),right=new Vector3(1,0,0),side=new Vector3(0,0,1);
  const ledge=new Ray(new Vector3(),new Vector3(0,-1,0));
  function updateWithHeadroom(...args){
    const local=this.localController;
    const controls=local?.applyControls;
    if(!controls||!inside())return update.apply(this,args);
    local.applyControls=function(...step){
      const {position,collisionsManager}=this.config;
      const before=position.y,x=position.x,z=position.z;
      const crouch=this.characterOnGround&&this.config.keyInputManager.isKeyPressed('shift')&&
        !this.config.keyInputManager.getJump();
      controls.apply(this,step);
      if(crouch){
        const nextX=x+(position.x-x)*.37,nextZ=z+(position.z-z)*.37;
        ledge.origin.set(nextX,before+.10,nextZ);
        const supported=collisionsManager.raycastFirst(ledge,.36);
        position.x=supported?nextX:x;
        position.z=supported?nextZ:z;
        if(!supported)this.characterVelocity.set(0,this.characterVelocity.y,0);
      }
      const rise=position.y-before;
      const allowed=clearance(position,rise,this.capsuleInfo,collisionsManager,up,right,side);
      if(allowed<rise){
        position.y=before+allowed;
        this.characterVelocity.y=0;
      }
    };
    try{return update.apply(this,args);}
    finally{local.applyControls=controls;}
  }
  manager.update=updateWithHeadroom;
  return ()=>{if(manager.update===updateWithHeadroom)manager.update=update;};
}
