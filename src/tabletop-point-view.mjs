import {Box3,BufferGeometry,Group,LineBasicMaterial,LineSegments,Quaternion,Raycaster,Vector3} from 'three';
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

function makeMarker(){
  const vertices=[];
  for(const x of [-1,1])for(const y of [-1,1]){
    vertices.push(new Vector3(x*.50,y,0),new Vector3(x,y,0),
      new Vector3(x,y,0),new Vector3(x,y*.50,0));
  }
  const geometry=new BufferGeometry().setFromPoints(vertices);
  const marker=new Group();
  marker.name='tabletop-point-marker';
  const shadow=new LineSegments(geometry,new LineBasicMaterial({color:0x221a11,
    transparent:true,opacity:.68,depthWrite:false}));
  shadow.position.set(.075,-.075,0);
  shadow.renderOrder=3;
  const strokes=new LineSegments(geometry,new LineBasicMaterial({color:0xffd185,
    transparent:true,opacity:.92,depthWrite:false}));
  strokes.renderOrder=4;
  marker.add(shadow,strokes);
  return marker;
}

export class TabletopPointView{
  constructor(scene,announce){
    this.scene=scene;
    this.announce=announce;
    this.cues=new Map();
    this.gazes=new Map();
    this.ray=new Raycaster();
    this.side=new Vector3();
    this.direction=new Vector3();
    this.anchor=new Vector3();
    this.sceneRotation=new Quaternion();
  }

  receive({broadcastType,payload},space,world,local=false){
    if(broadcastType!==tabletopPointBroadcast||!world?.isConnected()||
       payload?.space!==space||!validTabletopPoint(payload))return;
    if(world!==this.world||space!==this.space||world.getConnectionId()!==this.connection)this.reset(space,world);
    const prior=this.cues.get(payload.connection);
    if(prior&&payload.sequence<=prior.sequence)return;
    this.cues.set(payload.connection,{...payload,expires:performance.now()+tabletopPointDuration,
      point:new Vector3(),bounds:new Box3(),heard:false,local,mesh:null,wasAtTable:false,nextSample:0});
  }

  reset(space,world){
    this.space=space;this.world=world;this.connection=world?.getConnectionId();
    this.cues.clear();this.gazes.clear();
    if(this.marker)this.marker.visible=false;
  }

  surfacePoint(cue,camera,now){
    const mesh=cue.mesh;
    const visible=point=>!mesh.material.clippingPlanes?.some(plane=>plane.distanceToPoint(point)<-1e-5);
    if(cue.anchor&&visible(mesh.localToWorld(this.anchor.copy(cue.anchor))))return this.anchor;
    cue.anchor=null;
    if(now<cue.nextSample)return null;
    cue.nextSample=now+220;
    // Start at the projected center. A few nearby rays find material on small,
    // hollow or diagonal parts without walking every dense CAD mesh repeatedly.
    const width=Math.max(cue.bounds.max.x-cue.bounds.min.x,cue.bounds.max.y-cue.bounds.min.y,
      cue.bounds.max.z-cue.bounds.min.z);
    const offset=width*.17;
    const probes=mesh.geometry.index?.count>90000?[[0,0]]:[[0,0],[1,0],[-1,0],[0,1],[0,-1]];
    for(const [x,y] of probes){
      this.side.set(x*offset,y*offset,0).applyQuaternion(camera.rotation);
      this.direction.copy(cue.point).add(this.side).sub(camera.position).normalize();
      this.ray.set(camera.position,this.direction);
      const hit=this.ray.intersectObject(mesh,false).find(({point})=>visible(point));
      if(!hit)continue;
      cue.anchor=mesh.worldToLocal(hit.point.clone());
      return this.anchor.copy(hit.point);
    }
    return null;
  }

  update(space,world,table,players,now,localConnection,camera=null,viewHeight=0){
    if(localConnection==null||world!==this.world||space!==this.space||!world?.isConnected()||
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
      const mesh=table.pointingTarget(cue.reference,cue.revision);
      if(mesh!==cue.mesh){cue.mesh=mesh;cue.anchor=null;cue.nextSample=0;}
      if(!pointingBounds(mesh,cue.bounds))continue;
      cue.bounds.getCenter(cue.point);
      this.gazes.set(connection,cue.point);
      if(!latest||cue.expires>latest.expires)latest=cue;
    }
    const anchor=latest&&camera&&viewHeight>0?this.surfacePoint(latest,camera,now):null;
    if(!anchor){
      if(this.marker)this.marker.visible=false;
      return;
    }
    if(!latest.heard){this.announce(latest.local,latest.connection);latest.heard=true;}
    if(!this.marker){
      this.marker=makeMarker();
      this.scene.add(this.marker);
    }
    const distance=anchor.distanceTo(camera.position);
    const radius=22*distance*Math.tan(camera.fov*Math.PI/360)/viewHeight;
    // Lift the accent off the hit face. The scene can still occlude it.
    this.direction.copy(camera.position).sub(anchor).normalize();
    this.marker.position.copy(anchor).addScaledVector(this.direction,radius);
    this.scene.worldToLocal(this.marker.position);
    this.scene.getWorldQuaternion(this.sceneRotation);
    this.marker.quaternion.copy(this.sceneRotation.invert()).multiply(camera.rotation);
    this.marker.scale.setScalar(radius);
    this.marker.visible=true;
  }

  dispose(){
    this.reset(null,null);
    this.marker?.removeFromParent();
    const [shadow,strokes]=this.marker?.children??[];
    shadow?.geometry.dispose();
    shadow?.material.dispose();
    strokes?.material.dispose();
  }
}
