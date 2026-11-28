import {CylinderGeometry,Group,Mesh,MeshBasicMaterial,Quaternion,SphereGeometry,Vector3} from 'three';

const up=new Vector3(0,1,0);

export class WorktableLaser{
  constructor(scene){
    this.scene=scene;
    this.tip=new Vector3();
    this.start=new Vector3();
    this.direction=new Vector3();
    this.origin=new Vector3();
    this.from=new Vector3();
    this.to=new Vector3();
    this.turn=new Quaternion();
    this.rotation=new Quaternion();
    this.parentRotation=new Quaternion();
  }

  mount(){
    this.group=new Group();
    this.group.name='Worktable companion laser';
    this.material=new MeshBasicMaterial({color:0x8cebd7,transparent:true,depthWrite:false,toneMapped:false});
    this.beam=new Mesh(new CylinderGeometry(.0016,.0016,1,6),this.material);
    this.spot=new Mesh(new SphereGeometry(.004,8,6),this.material);
    this.beam.raycast=this.spot.raycast=()=>{};
    this.group.add(this.beam,this.spot);
    this.scene.add(this.group);
  }

  aim(joint,next,target,strength){
    joint.getWorldPosition(this.origin);
    next.getWorldPosition(this.from).sub(this.origin).normalize();
    this.to.copy(target).sub(this.origin).normalize();
    this.turn.setFromUnitVectors(this.from,this.to);
    joint.getWorldQuaternion(this.rotation).premultiply(this.turn);
    joint.parent.getWorldQuaternion(this.parentRotation).invert();
    this.rotation.premultiply(this.parentRotation);
    joint.quaternion.slerp(this.rotation,strength);
    joint.updateWorldMatrix(false,true);
  }

  draw(root,cue,draw){
    if(!cue||!root?.visible){if(this.group)this.group.visible=false;return draw();}
    if(this.root!==root){
      this.root=root;
      this.arms=['R','L'].map(side=>['arm-','elbow-','hand-'].map(bone=>root.getObjectByName(bone+side)));
    }
    const target=cue.resolve(this.tip);
    if(!target||!this.arms.every(arm=>arm.every(Boolean))){
      if(this.group)this.group.visible=false;
      return draw();
    }
    if(!this.group)this.mount();
    const [right,left]=this.arms;
    const side=right[0].getWorldPosition(this.start).distanceToSquared(target)<
      left[0].getWorldPosition(this.start).distanceToSquared(target)?right:left;
    const [arm,elbow,hand]=side;
    const startArm=arm.quaternion.clone(),startElbow=elbow.quaternion.clone();
    try{
      const weight=Math.min(1,cue.age/125,cue.remaining/170);
      this.aim(arm,elbow,target,weight*.88);
      this.aim(elbow,hand,target,weight);
      hand.getWorldPosition(this.start);
      this.scene.worldToLocal(this.start);
      this.spot.position.copy(target);
      this.scene.worldToLocal(this.spot.position);
      this.direction.copy(this.spot.position).sub(this.start);
      const distance=this.direction.length();
      if(distance>.008){
        this.beam.position.copy(this.start).lerp(this.spot.position,.5);
        this.beam.quaternion.setFromUnitVectors(up,this.direction.divideScalar(distance));
        this.beam.scale.y=distance;
      }
      this.material.opacity=.72*weight;
      this.group.visible=distance>.008&&weight>0;
      return draw();
    }finally{
      arm.quaternion.copy(startArm);
      elbow.quaternion.copy(startElbow);
      arm.updateWorldMatrix(false,true);
      this.group.visible=false;
    }
  }

  dispose(){
    if(!this.group)return;
    this.group.removeFromParent();
    this.beam.geometry.dispose();
    this.spot.geometry.dispose();
    this.material.dispose();
  }
}
