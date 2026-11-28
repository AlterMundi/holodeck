import {Matrix4,Quaternion,Vector3} from 'three';
import {verticalWheelDistance} from './avatar-camera.mjs';

export const matterAvatarScale=.19;

// One active worktable owns navigation for this view. The mounting policy
// supplies the anchor, collision limits, and how to place its participants.
export class WorktableNavigation{
  mount(surface,{enter,leave,lift}){
    if(this.active&&this.active.surface===surface)return true;
    if(this.active||!enter())return false;
    this.active={surface,leave,lift};
    return true;
  }

  unmount(surface,options){
    if(!this.active||this.active.surface!==surface)return;
    const {leave}=this.active;
    this.active=null;
    this.attention=null;
    leave(options);
  }

  point(surface,resolve,now=performance.now()){
    if(this.active?.surface===surface)this.attention={surface,resolve,start:now};
  }

  pointing(now=performance.now()){
    const cue=this.attention;
    if(!cue||cue.surface!==this.active?.surface)return null;
    const age=now-cue.start,remaining=1150-age;
    return remaining>0?{resolve:cue.resolve,age,remaining}:null;
  }

  wheel(surface,event,pageHeight){
    if(!this.active||this.active.surface!==surface)return false;
    const distance=verticalWheelDistance(event,pageHeight);
    if(distance===null)return false;
    if(distance)this.active.lift(distance);
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }

  escape(surface,event,close){
    if(!this.active||this.active.surface!==surface||event.key!=='Escape'||event.defaultPrevented)return false;
    if(!event.repeat)close();
    return true;
  }
}

const up=new Vector3(0,1,0);

// A personal device borrows the animated bodies for its situated render. Public
// tables already have authoritative miniature positions through MatterFlight.
export function withTabletopAvatars(table,participants,draw){
  const saved=[];
  const position=new Vector3(),rotation=new Quaternion(),scale=new Vector3();
  const stationary=new Matrix4();
  table.updateWorldMatrix(true,false);
  try{
    for(const {object,x,y,z,yaw} of participants){
      if(!object?.parent)continue;
      object.parent.updateWorldMatrix(true,false);
      if(object.matrixAutoUpdate)object.updateMatrix();
      saved.push({object,matrix:object.matrix.clone(),automatic:object.matrixAutoUpdate,visible:object.visible});
      position.set(x,y,z);
      rotation.setFromAxisAngle(up,yaw);
      scale.copy(object.scale).multiplyScalar(matterAvatarScale);
      stationary.compose(position,rotation,scale);
      object.matrix.copy(object.parent.matrixWorld).invert().multiply(table.matrixWorld).multiply(stationary);
      object.matrixAutoUpdate=false;
      object.visible=true;
      object.matrixWorldNeedsUpdate=true;
    }
    return draw();
  }finally{
    for(const {object,matrix,automatic,visible} of saved){
      object.matrix.copy(matrix);
      object.matrixAutoUpdate=automatic;
      object.visible=visible;
      object.updateWorldMatrix(false,true);
    }
  }
}
