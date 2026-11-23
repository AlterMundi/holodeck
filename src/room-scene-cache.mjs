// Detached static room markup and its resource handles. A cache hit does
// not authorize a mount. The caller must confirm the current room and scope.
export class RoomSceneCache {
  constructor(actor,limit=3){
    this.actor=actor;this.limit=limit;this.entries=new Map();
  }
  revision(id){return this.entries.get(id)?.revision;}
  remember(scene){
    if(!scene||scene.actor!==this.actor||typeof scene.id!=='string'||
       !/^[a-f0-9]{64}$/.test(scene.revision??''))return null;
    if(typeof scene.markup==='string'&&scene.markup.length>128*1024)return null;
    let stored=this.entries.get(scene.id);
    if(typeof scene.markup==='string'&&stored?.revision!==scene.revision){
      this.forget(scene.id);
      const template=document.createElement('template');
      template.innerHTML=scene.markup;
      stored={id:scene.id,revision:scene.revision,template};
    }
    if(stored?.revision!==scene.revision)return null;
    this.entries.delete(scene.id);
    this.entries.set(scene.id,stored);
    if(this.entries.size>this.limit)this.forget(this.entries.keys().next().value);
    return stored;
  }
  keepArt(entry,load){
    if(this.entries.get(entry.id)===entry&&!entry.art)entry.art=load();
  }
  forget(id){
    this.entries.get(id)?.art?.dispose();
    this.entries.delete(id);
  }
  clear(){
    for(const id of this.entries.keys())this.forget(id);
  }
}
