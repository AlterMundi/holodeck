import {Box3,BufferGeometry,Group,LineBasicMaterial,LineSegments,Matrix4,Quaternion,Raycaster,Vector3} from 'three';
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
  shadow.raycast=strokes.raycast=()=>{};
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
    this.sampleVertex=new Vector3();
    this.sampleCenter=new Vector3();
    this.fallback=new Vector3();
    this.cameraRotation=new Quaternion();
    this.sceneRotation=new Quaternion();
  }

  receive({broadcastType,payload},space,world,local=false){
    if(broadcastType!==tabletopPointBroadcast||!world?.isConnected()||
       payload?.space!==space||!validTabletopPoint(payload))return;
    if(world!==this.world||space!==this.space||world.getConnectionId()!==this.connection)this.reset(space,world);
    const prior=this.cues.get(payload.connection);
    if(prior&&payload.sequence<=prior.sequence)return;
    this.cues.set(payload.connection,{...payload,expires:performance.now()+tabletopPointDuration,
      point:new Vector3(),bounds:new Box3(),heard:false,local,mesh:null,wasAtTable:false,nextSample:0,lastMatrix:new Matrix4(),lastEye:new Vector3()});
  }

  reset(space,world){
    this.space=space;this.world=world;this.connection=world?.getConnectionId();
    this.cues.clear();this.gazes.clear();
    if(this.marker)this.marker.visible=false;
  }

  surfacePoint(cue,camera,now){
    const mesh=cue.mesh,planes=mesh.material.clippingPlanes;
    const visible=point=>!planes?.some(plane=>plane.distanceToPoint(point)<-1e-5);
    const anchorVisible=cue.anchor&&visible(mesh.localToWorld(this.anchor.copy(cue.anchor)));
    const changed=!cue.lastMatrix.equals(mesh.matrixWorld)||
      cue.lastEye.distanceToSquared(camera.position)>.01||cue.lastSection!==planes?.[0]?.constant;
    if((anchorVisible&&!changed)||now<cue.nextSample)return anchorVisible?this.anchor:null;
    cue.anchor=null;
    cue.nextSample=now+220;
    cue.lastMatrix.copy(mesh.matrixWorld);
    cue.lastEye.copy(camera.position);
    cue.lastSection=planes?.[0]?.constant;
    const geometry=mesh.geometry,vertices=geometry.getAttribute('position'),index=geometry.index;
    const toSurface=target=>{
      this.direction.copy(target).sub(camera.position).normalize();
      this.ray.set(camera.position,this.direction);
      const hit=this.ray.intersectObject(mesh,false).find(({point})=>visible(point));
      if(!hit)return null;
      this.anchor.copy(hit.point);
      cue.anchor=mesh.worldToLocal(hit.point);
      return this.anchor;
    };
    const offset=.35*Math.max(cue.bounds.max.x-cue.bounds.min.x,cue.bounds.max.y-cue.bounds.min.y,
      cue.bounds.max.z-cue.bounds.min.z);
    const count=(index??vertices).count;
    const probes=count>90000?[[0,0]]:[[0,0],[1,0],[-1,0],[0,1],[0,-1]];
    for(const [x,y] of probes){
      this.side.set(x*offset,y*offset,0).applyQuaternion(this.cameraRotation).add(cue.point);
      if(toSurface(this.side))return this.anchor;
    }
    // For a frame or hollow part, sample bounded actual triangle centers and
    // reproject the nearest unclipped one to the visible side of the part.
    const triangles=Math.floor(count/3),samples=Math.min(48,triangles);
    let best=Infinity;
    for(let i=0;i<samples;i++){
      const first=Math.floor(i*triangles/samples)*3;
      this.sampleCenter.set(0,0,0);
      for(let j=0;j<3;j++)
        this.sampleCenter.add(this.sampleVertex.fromBufferAttribute(vertices,index?index.getX(first+j):first+j));
      this.sampleCenter.multiplyScalar(1/3).applyMatrix4(mesh.matrixWorld);
      const distance=this.sampleCenter.distanceToSquared(cue.point);
      if(distance>=best||!visible(this.sampleCenter))continue;
      best=distance;
      this.fallback.copy(this.sampleCenter);
    }
    return Number.isFinite(best)?toSurface(this.fallback):null;
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
    if(latest&&!latest.heard){this.announce(latest.local,latest.connection);latest.heard=true;}
    if(camera)this.cameraRotation.set(camera.rotation.x,camera.rotation.y,camera.rotation.z,camera.rotation.w);
    const anchor=latest&&camera&&viewHeight>0?this.surfacePoint(latest,camera,now):null;
    if(!anchor){
      if(this.marker)this.marker.visible=false;
      return;
    }
    if(!this.marker){
      this.marker=makeMarker();
      this.scene.add(this.marker);
    }
    const distance=anchor.distanceTo(camera.position);
    const scale=22*Math.tan(camera.fov*Math.PI/360)/viewHeight;
    const radius=distance*scale/(1+3*scale);
    // Lift the strokes clear of grazing faces while keeping the aimed point.
    this.direction.copy(camera.position).sub(anchor).normalize();
    this.marker.position.copy(anchor).addScaledVector(this.direction,3*radius);
    this.scene.worldToLocal(this.marker.position);
    this.scene.getWorldQuaternion(this.sceneRotation);
    this.marker.quaternion.copy(this.sceneRotation.invert()).multiply(this.cameraRotation);
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
    this.marker=null;
  }
}
