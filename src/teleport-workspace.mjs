import {AmbientLight, BoxGeometry, Color, CylinderGeometry, DirectionalLight, Fog, Group, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PointLight, Scene, TorusGeometry} from 'three';

const siteX=32;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const navigation=new Set(['KeyA','KeyD','KeyW','KeyS']);

function part(parent,geometry,material,x,y,z){
  const mesh=new Mesh(geometry,material);
  mesh.position.set(x,y,z);parent.add(mesh);
  return mesh;
}

export class TeleportWorkspace {
  constructor(invalidate){
    this.invalidate=invalidate;
    this.camera=new PerspectiveCamera(43,1,.075,24);
    this.scene=new Scene();
    this.overlay=new Scene();
    this.scene.background=new Color(0x111e24);
    this.scene.fog=new Fog(0x111e24,6.8,16);
    this.place=new Group();
    this.place.position.x=siteX;
    this.scene.add(this.place,new AmbientLight(0xbbebea,1.15));
    const key=new DirectionalLight(0xffdda6,2.2);
    key.position.set(3,6,4);this.scene.add(key);
    for(const [x,z,color] of [[-3,-2,0x53c9ba],[3,0,0xf4ba75]]){
      const light=new PointLight(color,15,9);
      light.position.set(x,3.4,z);
      this.place.add(light);
    }
    const slate=new MeshStandardMaterial({color:0x273337,roughness:.8});
    const dark=new MeshStandardMaterial({color:0x17262c,roughness:.64,metalness:.2});
    const copper=new MeshStandardMaterial({color:0x9f693c,roughness:.3,metalness:.58});
    const teal=new MeshBasicMaterial({color:0x418f80});
    part(this.place,new CylinderGeometry(7.8,7.8,.18,64),slate,0,-.09,0);
    part(this.place,new CylinderGeometry(.98,1.23,.68,48),dark,0,.34,0);
    part(this.place,new CylinderGeometry(1.09,1.01,.12,48),copper,0,.70,0);
    for(const [r,y,t,mat] of [[1.042,.623,.016,teal],[1.29,.015,.010,copper],[2.62,.013,.018,teal],[4.14,.012,.017,copper]]){
      part(this.place,new TorusGeometry(r,t,8,72),mat,0,y,0).rotation.x=Math.PI/2;
    }
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6,x=Math.cos(a),z=Math.sin(a);
      const column=part(this.place,new BoxGeometry(.58,5,.35),dark,x*5.35,2.49,z*5.35);
      column.rotation.y=-a+Math.PI/2;
      part(this.place,new CylinderGeometry(.017,.017,3.55,8),i%2?teal:copper,x*5.14,2.49,z*5.14);
      const plinth=part(this.place,new BoxGeometry(.74,.18,.53),copper,x*5.35,.09,z*5.35);
      plinth.rotation.y=column.rotation.y;
    }
    for(const height of [.13,4.58]){
      part(this.place,new TorusGeometry(5.40,.055,8,84),copper,0,height,0).rotation.x=Math.PI/2;
    }
  }

  enter(group){
    this.group=group;
    this.place.add(group);
    group.matrixAutoUpdate=true;
    group.position.set(0,2.24,0);
    group.rotation.set(0,0,0);
    group.scale.setScalar(1);
    this.yaw=.12;this.pitch=.13;this.zoom=1;
    this.resize(this.aspect??1);
    this.scene.updateMatrixWorld(true);
    this.invalidate();
  }

  leave(parent){
    if(this.group&&parent)parent.add(this.group);
    this.group=null;
    this.drag=null;
  }

  resize(aspect){
    if(this.aspect!==aspect){
      this.aspect=aspect;
      this.camera.aspect=aspect;
      this.camera.updateProjectionMatrix();
    }
    const distance=clamp(3.62/aspect,3.55,7.6)*this.zoom;
    const horizontal=distance*Math.cos(this.pitch);
    this.camera.position.set(siteX+Math.sin(this.yaw)*horizontal,1.48+distance*Math.sin(this.pitch),Math.cos(this.yaw)*horizontal);
    this.camera.lookAt(siteX,1.48,0);
    this.camera.updateMatrixWorld(true);
  }

  orbit(dx,dy){
    this.yaw=(this.yaw+dx)%(2*Math.PI);
    this.pitch=clamp(this.pitch+dy,-.16,.58);
    this.resize(this.aspect);
    this.invalidate();
  }

  approach(amount){
    this.zoom=clamp(this.zoom*Math.exp(amount),.64,1.18);
    this.resize(this.aspect);
    this.invalidate();
  }

  key(event){
    if(!navigation.has(event.code)||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return false;
    if(event.code==='KeyA'||event.code==='KeyD')this.orbit(event.code==='KeyA'?.105:-.105,0);
    else this.approach(event.code==='KeyW'?-.075:.075);
    return true;
  }

  dispose(){
    const materials=new Set();
    this.place.traverse(object=>{
      object.geometry?.dispose();
      if(object.material)materials.add(object.material);
    });
    for(const material of materials)material.dispose();
  }
}
