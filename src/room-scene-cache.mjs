// Only detached, server-generated static geometry lives here. A cached
// revision is never an authorization to mount it.
export class RoomSceneCache {
  constructor(actor,limit=3){
    this.actor=actor;this.limit=limit;this.entries=new Map();
  }
  revision(id){return this.entries.get(id)?.revision;}
  remember(scene){
    if(!scene||scene.actor!==this.actor||typeof scene.id!=='string'||
       !/^[a-f0-9]{64}$/.test(scene.revision??''))return null;
    let stored=this.entries.get(scene.id);
    if(typeof scene.markup==='string'){
      if(scene.markup.length>128*1024)return null;
      const template=document.createElement('template');
      template.innerHTML=scene.markup;
      stored={id:scene.id,revision:scene.revision,template};
    }
    if(stored?.revision!==scene.revision)return null;
    this.entries.delete(scene.id);
    this.entries.set(scene.id,stored);
    if(this.entries.size>this.limit)this.entries.delete(this.entries.keys().next().value);
    return stored;
  }
  clear(){this.entries.clear();}
}
