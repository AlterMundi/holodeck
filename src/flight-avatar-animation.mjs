import {Euler,Quaternion,Vector3} from 'three';
import {TOROIDAL_TERRAIN,terrainCoordinates,terrainWaterDepth} from './toroidal-terrain.mjs';

const limbNames=['upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','thigh_l','thigh_r','calf_l','calf_r'];
const pitchAxis=new Vector3(1,0,0);

export function bindFlightAvatarAnimation(manager,context){
  const update=manager.update;
  const actors=new Map();
  const angles=new Euler(),turn=new Quaternion(),pitch=new Quaternion();
  function animatedUpdate(state,dt){
    // Remove last frame's extra limb rotations before the base mixer runs.
    for(const entry of actors.values())
      for(const [bone,neutral] of entry.modified)bone.quaternion.copy(neutral);
    const result=update.call(this,state,dt);
    const {outdoor,flying,table,crouch}=context();
    for(const [id,actor] of state.characters){
      const character=this.loadedCharacters.get(id)?.character;
      const mesh=character?.getMesh();
      if(!mesh)continue;
      let entry=actors.get(id);
      const position=actor.position;
      if(entry?.mesh!==mesh){
        entry={mesh,last:new Vector3().copy(position),weight:0,lowWeight:0,phase:0,modified:new Map(),
          limbs:limbNames.map(name=>mesh.getObjectByName(name))};
        actors.set(id,entry);
      }
      const isLocal=id===state.localCharacterId;
      const coordinate=outdoor?terrainCoordinates([position.x,position.y,position.z]):null;
      const underwater=coordinate&&coordinate.height<TOROIDAL_TERRAIN.waterLevel-.92&&terrainWaterDepth(coordinate.u,coordinate.v)>.18;
      const active=underwater||isLocal&&(outdoor&&flying||table);
      const speed=entry.last.distanceTo(position)/Math.max(dt,.001);
      entry.last.copy(position);
      const low=isLocal&&crouch&&!active;
      const target=active&&speed>.19?Math.min(1,speed/.75):0;
      const fade=Math.min(1,dt*10);
      entry.weight+=(target-entry.weight)*fade;
      entry.lowWeight+=(Number(low)-entry.lowWeight)*fade;
      if(entry.weight<.01&&entry.lowWeight<.01){entry.modified.clear();continue;}
      entry.phase=(entry.phase+dt*(underwater?4.4:2.1))%(2*Math.PI);
      const stroke=Math.sin(entry.phase),counter=Math.cos(entry.phase);
      const w=entry.weight;
      pitch.setFromAxisAngle(pitchAxis,(underwater?1.17:.97)*w+.13*entry.lowWeight);
      character.quaternion.multiply(pitch);
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
        angles.set(w*sweep*polarity+crouchSwing,0,w*offset);
        bone.quaternion.multiply(turn.setFromEuler(angles));
      }
    }
    for(const id of actors.keys())if(!state.characters.has(id))actors.delete(id);
    return result;
  }
  manager.update=animatedUpdate;
  return ()=>{
    if(manager.update===animatedUpdate)manager.update=update;
    for(const entry of actors.values())
      for(const [bone,neutral] of entry.modified)bone.quaternion.copy(neutral);
    actors.clear();
  };
}
