import {Euler, Quaternion, Vector3} from 'three';

// Hover is viewer-local. Shared selection and the worktable state are untouched.
export function bindTabletopAttention({document,canvas,pick,allowed,overWorld=()=>true,current,clock=()=>performance.now()}){
  const win=document.defaultView;
  const reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
  let cursor=null, candidate=null, since=0, next=0, focused=null;
  const localPoint=new Vector3(), point=new Vector3();
  const clear=()=>{cursor=candidate=focused=null;next=0;};
  const move=event=>{
    if(event.pointerType!=='mouse'||event.buttons||document.pointerLockElement){clear();return;}
    cursor={clientX:event.clientX,clientY:event.clientY,movedAt:clock()};
  };
  const events=[[canvas,'pointermove',move],[canvas,'pointerleave',clear],
    [canvas,'pointerdown',clear],[canvas,'pointercancel',clear],[win,'blur',clear],
    [document,'visibilitychange',clear],[document,'pointerlockchange',clear],
    [reduced,'change',clear]];
  for(const [target,type,listener] of events)target.addEventListener(type,listener);
  return {
    sample(now){
      focused=null;
      if(!cursor)return null;
      if(now-cursor.movedAt>3500||reduced.matches||document.pointerLockElement||!allowed()){clear();return null;}
      if(now>=next){
        next=now+110;
        if(!overWorld(cursor)){clear();return null;}
        const hit=pick(cursor.clientX,cursor.clientY);
        if(hit?.mesh!==candidate?.mesh){candidate=hit;since=now;}
        if(hit)hit.mesh.worldToLocal(localPoint.copy(hit.point));
      }
      if(!candidate||!current(candidate)){candidate=null;return null;}
      if(now-since<180)return null;
      focused=candidate.mesh;
      return candidate.mesh.localToWorld(point.copy(localPoint));
    },
    part:()=>focused,
    dispose(){for(const [target,type,listener] of events)target.removeEventListener(type,listener);clear();}
  };
}

const radians=Math.PI/180;

export class TabletopGlance{
  constructor(){
    this.yaw=0;this.pitch=0;
    this.origin=new Vector3();this.direction=new Vector3();
    this.frame=new Quaternion();this.frameInverse=new Quaternion();
    this.parentInverse=new Quaternion();this.delta=new Quaternion();
    this.base=new Quaternion();this.angles=new Euler(0,0,0,'YXZ');
    this.head=null;
  }
  restore(){
    this.head?.quaternion.copy(this.base);
    this.head=null;
  }
  reset(){
    this.restore();
    this.yaw=this.pitch=0;
  }
  apply(body,head,target,seconds,strength=1){
    if(!head?.parent)return;
    let yaw=0,pitch=0;
    body.getWorldQuaternion(this.frame);
    if(target){
      head.getWorldPosition(this.origin);
      this.direction.subVectors(target,this.origin);
      if(this.direction.lengthSq()>.0025){
        this.direction.applyQuaternion(this.frameInverse.copy(this.frame).invert());
        const {x,y,z}=this.direction;
        const bearing=Math.atan2(x,z), horizontal=Math.hypot(x,z);
        const horizontalWeight=Math.min(1,horizontal/this.direction.length()/.38);
        const fade=Math.max(0,Math.min(1,(105-Math.abs(bearing/radians))/32));
        yaw=Math.max(-33*radians,Math.min(33*radians,bearing))*fade*horizontalWeight*strength;
        const pitchWeight=1-horizontalWeight*(1-fade);
        pitch=Math.max(-20*radians,Math.min(20*radians,-Math.atan2(y,horizontal)))*pitchWeight*strength;
      }
    }
    const blend=1-Math.exp(-Math.min(.06,Math.max(0,seconds))*(target?9:6));
    this.yaw+=(yaw-this.yaw)*blend;
    this.pitch+=(pitch-this.pitch)*blend;
    if(Math.max(Math.abs(this.yaw),Math.abs(this.pitch))<.001)return;
    this.head=head;
    this.base.copy(head.quaternion);
    head.parent.getWorldQuaternion(this.parentInverse).invert();
    this.delta.setFromEuler(this.angles.set(this.pitch,this.yaw,0));
    this.frameInverse.copy(this.frame).invert();
    this.delta.premultiply(this.frame).multiply(this.frameInverse).premultiply(this.parentInverse);
    this.delta.multiply(this.parentInverse.invert());
    head.quaternion.premultiply(this.delta);
  }
}
