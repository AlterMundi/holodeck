import {Euler,Quaternion,Vector3} from 'three';
import {TOROIDAL_TERRAIN,terrainCoordinates,terrainWaterDepth} from './toroidal-terrain.mjs';
import {matterAvatarScale} from './matter-flight.mjs';

const limbNames=['upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','thigh_l','thigh_r','calf_l','calf_r'];
const pitchAxis=new Vector3(1,0,0);

export function bindFlightAvatarAnimation(manager,context){
  const update=manager.update;
  const actors=new Map();
  const angles=new Euler(),turn=new Quaternion(),pitch=new Quaternion();
  const displacement=new Vector3(),up=new Vector3();
  function restore(entry){
    for(const [bone,neutral] of entry.modified)bone.quaternion.copy(neutral);
    if(entry.rotation?.equals(entry.applied))entry.rotation.copy(entry.unpitched);
  }
  function animatedUpdate(state,dt){
    // Remove last frame's extra limb rotations before the base mixer runs.
    for(const entry of actors.values())restore(entry);
    const result=update.call(this,state,dt);
    const {outdoor,flying,table,crouch,tabletopPlayers=[]}=context();
    for(const [id,actor] of state.characters){
      const character=this.loadedCharacters.get(id)?.character;
      const mesh=character?.getMesh();
      if(!mesh)continue;
      let entry=actors.get(id);
      const position=actor.position;
      if(entry?.mesh!==mesh){
        entry={mesh,last:new Vector3().copy(position),weight:0,hoverWeight:0,lowWeight:0,phase:0,planarSpeed:0,modified:new Map(),
          unpitched:new Quaternion(),applied:new Quaternion(),
          limbs:limbNames.map(name=>mesh.getObjectByName(name))};
        actors.set(id,entry);
      }
      const isLocal=id===state.localCharacterId;
      const coordinate=outdoor?terrainCoordinates([position.x,position.y,position.z]):null;
      const underwater=coordinate&&coordinate.height<TOROIDAL_TERRAIN.waterLevel-.92&&terrainWaterDepth(coordinate.u,coordinate.v)>.18;
      const atTable=isLocal?table:tabletopPlayers.has?.(id)||tabletopPlayers.includes?.(id);
      const active=underwater||atTable||isLocal&&outdoor&&flying;
      const factor=atTable?matterAvatarScale:1;
      displacement.subVectors(position,entry.last);
      entry.last.copy(position);
      up.set(0,1,0).applyQuaternion(character.quaternion);
      const vertical=displacement.dot(up);
      displacement.addScaledVector(up,-vertical);
      const travel=displacement.length();
      const moved=travel<(atTable?.65:3);
      const speed=moved?Math.min(atTable?9:18,travel/Math.max(dt*factor,.001)):0;
      const low=isLocal&&crouch&&!active;
      const fade=1-Math.exp(-Math.max(0,dt)*8);
      entry.planarSpeed+=(speed-entry.planarSpeed)*fade;
      const target=active?Math.min(1,Math.max(0,(entry.planarSpeed-.14)/1.8)):0;
      entry.weight+=(target-entry.weight)*fade;
      entry.hoverWeight+=(Number(Boolean(active))*(1-target)-entry.hoverWeight)*fade;
      entry.lowWeight+=(Number(low)-entry.lowWeight)*fade;
      if(entry.weight<.01&&entry.hoverWeight<.01&&entry.lowWeight<.01){entry.modified.clear();continue;}
      entry.phase=(entry.phase+dt*(underwater?4.4:2.1))%(2*Math.PI);
      const stroke=Math.sin(entry.phase),counter=Math.cos(entry.phase);
      const w=entry.weight;
      pitch.setFromAxisAngle(pitchAxis,(underwater?1.17:atTable?.76:.91)*w+.13*entry.lowWeight);
      entry.rotation=character.quaternion;
      entry.unpitched.copy(entry.rotation);
      entry.rotation.multiply(pitch);
      entry.applied.copy(entry.rotation);
      const strokeAmplitude=underwater?.58:.16;
      const kickAmplitude=underwater?.27:.075;
      for(let index=0;index<entry.limbs.length;index++){
        const bone=entry.limbs[index];
        if(!bone)continue;
        const polarity=index%2?-1:1;
        const sweep=index<2?stroke*strokeAmplitude:index<4?counter*.22:kickAmplitude*counter;
        const offset=index<2?(.34+stroke*.10)*polarity:0;
        const neutral=entry.modified.get(bone)??new Quaternion();
        neutral.copy(bone.quaternion);
        entry.modified.set(bone,neutral);
        const crouchSwing=index<4?0:(index<6?-.42:.64)*entry.lowWeight;
        const hoverBend=index<2?.22:index<4?-.32:index<6?-.24:.44;
        const hoverSpread=index<2?polarity*.23:0;
        angles.set(w*sweep*polarity+entry.hoverWeight*hoverBend+crouchSwing,0,w*offset+entry.hoverWeight*hoverSpread);
        bone.quaternion.multiply(turn.setFromEuler(angles));
      }
    }
    for(const id of actors.keys())if(!state.characters.has(id))actors.delete(id);
    return result;
  }
  manager.update=animatedUpdate;
  return ()=>{
    if(manager.update===animatedUpdate)manager.update=update;
    for(const entry of actors.values())restore(entry);
    actors.clear();
  };
}
