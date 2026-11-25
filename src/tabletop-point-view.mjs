import {Box3,Box3Helper,Vector3} from 'three';
import {tabletopPointBroadcast,tabletopPointDuration,validTabletopPoint} from './tabletop-pointing.mjs';

// The worktable section plane removes the top of a part in world Y.
export function pointingBounds(mesh,box){
  if(!mesh?.visible||!mesh.geometry.boundingBox)return null;
  mesh.updateWorldMatrix(true,false);
  box.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
  const section=mesh.material.clippingPlanes?.[0];
  if(section){
    if(section.constant<=box.min.y)return null;
    box.max.y=Math.min(box.max.y,section.constant);
  }
  return box.isEmpty()?null:box;
}

export class TabletopPointView{
  constructor(scene,announce){
    this.scene=scene;
    this.announce=announce;
    this.cues=new Map();
    this.gazes=new Map();
  }

  receive({broadcastType,payload},space,world,local=false){
    if(broadcastType!==tabletopPointBroadcast||!world?.isConnected()||
       payload?.space!==space||!validTabletopPoint(payload))return;
    if(world!==this.world||space!==this.space||world.getConnectionId()!==this.connection)this.reset(space,world);
    const prior=this.cues.get(payload.connection);
    if(prior&&payload.sequence<=prior.sequence)return;
    this.cues.set(payload.connection,{...payload,expires:performance.now()+tabletopPointDuration,
      point:new Vector3(),bounds:new Box3(),heard:false,local,mesh:null,wasAtTable:false});
  }

  reset(space,world){
    this.space=space;this.world=world;this.connection=world?.getConnectionId();
    this.cues.clear();this.gazes.clear();
    if(this.outline)this.outline.visible=false;
  }

  update(space,world,table,players,now,localConnection){
    if(world!==this.world||space!==this.space||!world?.isConnected()||
       world.getConnectionId()!==this.connection)this.reset(space,world);
    this.gazes.clear();
    let latest=null;
    for(const [connection,cue] of this.cues){
      const atTable=cue.local?connection===localConnection:players.has(connection);
      if(now>=cue.expires||!atTable&&(cue.local||cue.wasAtTable)||table.shared?.revision>cue.revision){
        this.cues.delete(connection);
        continue;
      }
      if(!atTable)continue;
      cue.wasAtTable=true;
      const mesh=cue.mesh=table.pointingTarget(cue.reference,cue.revision);
      if(!pointingBounds(mesh,cue.bounds))continue;
      if(!cue.heard){this.announce(cue.local,connection);cue.heard=true;}
      cue.bounds.getCenter(cue.point);
      this.gazes.set(connection,cue.point);
      if(!latest||cue.expires>latest.expires)latest=cue;
    }
    if(!this.outline&&!latest)return;
    if(!this.outline){
      this.outline=new Box3Helper(new Box3(),0xffd185);
      this.outline.material.transparent=true;
      this.outline.material.opacity=.68;
      this.outline.material.depthWrite=false;
      this.scene.add(this.outline);
    }
    this.outline.visible=!!latest;
    if(latest)this.outline.box.copy(latest.bounds);
  }

  dispose(){
    this.reset(null,null);
    this.outline?.removeFromParent();
    this.outline?.dispose();
  }
}
