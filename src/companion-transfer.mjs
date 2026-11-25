import {DoubleSide,Mesh,MeshBasicMaterial,RingGeometry} from 'three';
import {smooth} from './avatar-motion-curves.mjs';

const depart=.17,arrive=.24;

// A catch-up is local presentation: fade, reposition at zero opacity,
// then recover the regular material and shadow settings.
export class CompanionTransfer{
  constructor(scene){this.scene=scene;this.materials=new Map();this.shadows=new Map();}
  get active(){return this.time!==undefined;}
  begin(){this.time=0;}

  advance(seconds){
    if(!this.active)return false;
    const before=this.time;
    this.time+=seconds;
    if(this.time>=depart+arrive){this.cancel();return false;}
    return before<depart&&this.time>=depart;
  }

  paint(root,repositioned){
    if(!this.active)return;
    const opacity=repositioned?0:this.time<depart?1-smooth(this.time/depart):smooth((this.time-depart)/arrive);
    if(!this.ring){
      this.ring=new Mesh(new RingGeometry(.32,.36,40),
        new MeshBasicMaterial({color:0x78f2ff,transparent:true,depthWrite:false,side:DoubleSide}));
      this.ring.name='Navegante transfer';
      this.ring.rotation.x=-Math.PI/2;
      this.scene.add(this.ring);
    }
    this.ring.visible=true;
    this.ring.position.copy(root.position).addScaledVector(root.up,.04);
    this.ring.quaternion.copy(root.quaternion);
    this.ring.rotateX(-Math.PI/2);
    this.ring.scale.setScalar(.86+(1-opacity)*.8);
    this.ring.material.opacity=(1-opacity)*.72;
    root.traverse(mesh=>{
      if(!mesh.isMesh)return;
      if(!this.shadows.has(mesh))this.shadows.set(mesh,mesh.castShadow);
      mesh.castShadow=false;
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        if(!this.materials.has(material))this.materials.set(material,{
          opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite});
        material.opacity=this.materials.get(material).opacity*opacity;
        material.depthWrite=false;
        if(!material.transparent){material.transparent=true;material.needsUpdate=true;}
      }
    });
  }

  cancel(){
    this.time=undefined;
    if(this.ring)this.ring.visible=false;
    for(const [material,prior] of this.materials){
      Object.assign(material,prior);
      if(!prior.transparent)material.needsUpdate=true;
    }
    for(const [mesh,shadow] of this.shadows)mesh.castShadow=shadow;
    this.materials.clear();this.shadows.clear();
  }

  dispose(){
    this.cancel();
    if(!this.ring)return;
    this.ring.removeFromParent();this.ring.geometry.dispose();this.ring.material.dispose();
  }
}
