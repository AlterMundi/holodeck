import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const rigs=[
  'avatar-1-bodyA-skin01',
  'avatar-2-bodyB-skin03',
  'avatar-3-bodyA-skin05',
  'avatar-4-bodyB-skin07',
];
const outfits=rigs.map((_,index)=>`avatar-wardrobe-v1-${index+1}.glb`);
const profiles=Object.freeze([...rigs.map(rig=>rig+'.glb'),...outfits]);
export const personalAvatarFile='avatar/explorer-hero-v29.glb';
export const personalAvatarSha256='f12f53803a6f0b3a754ad185c8319fbc020f627c01a14195e0603fe6534b3ef7';
export const avatarModelFiles=Object.freeze([...profiles,personalAvatarFile]);
const preferenceLimit=64;
const preferenceSchema='holodeck.avatar-choices/v1';
const validSlot=slot=>Number.isInteger(slot)&&slot>=0&&slot<profiles.length;

const actorKey=actor=>createHash('sha256').update(actor.id).digest('hex');

export class HumanAvatarProfiles {
  constructor(state=null,save=null,preferences=null,savePreferences=null,personalOwnerRef=null){
    this.save=save;
    this.savePreferences=savePreferences;
    this.personalOwnerRef=personalOwnerRef;
    this.standardAvatarFor=preferences?.standardAvatarFor??null;
    if(state===null)state={schema:'holodeck.human-avatars/v1',assignments:[]};
    if(state.schema!=='holodeck.human-avatars/v1'||!Array.isArray(state.assignments)||
       state.assignments.length>profiles.length)throw Error('Invalid avatar assignments');
    this.assignments=new Map(state.assignments);
    if(this.assignments.size!==state.assignments.length||
       new Set(this.assignments.values()).size!==this.assignments.size||
       [...this.assignments].some(([key,slot])=>!/^[a-f0-9]{64}$/.test(key)||
         !validSlot(slot)))throw Error('Invalid avatar assignments');
    this.preferences=new Map(preferences?.choices);
    if(preferences&&(preferences.schema!==preferenceSchema||!Array.isArray(preferences.choices)||
       (this.standardAvatarFor!==null&&!/^[a-f0-9]{64}$/.test(this.standardAvatarFor))||
       this.preferences.size!==preferences.choices.length||this.preferences.size>preferenceLimit||
       [...this.preferences].some(([key,slot])=>!/^[a-f0-9]{64}$/.test(key)||!validSlot(slot))))
      throw Error('Invalid avatar choices');
  }

  retain(sessions){
    const keys=new Set([...sessions].filter(session=>session.actor.kind==='human').map(session=>actorKey(session.actor)));
    if(keys.size>profiles.length)throw Error('Avatar profile capacity reached');
    const selected=new Map([...this.assignments].filter(([key])=>keys.has(key)));
    const used=new Set(selected.values());
    for(const key of keys){
      if(selected.has(key))continue;
      // A stable starting preference with collision resolution for everyone
      // with a retained session. It depends only on the authenticated ID.
      let slot=Number.parseInt(key.slice(0,2),16)%profiles.length;
      while(used.has(slot))slot=(slot+1)%profiles.length;
      selected.set(key,slot);used.add(slot);
    }
    if(selected.size===this.assignments.size&&[...selected].every(([key,slot])=>this.assignments.get(key)===slot))return;
    this.assignments=selected;
    this.save?.({schema:'holodeck.human-avatars/v1',assignments:[...selected]});
  }

  ownsPersonalAvatar(actor){
    return actor.kind==='human'&&actor.id===this.personalOwnerRef;
  }

  usesPersonalAvatar(actor){
    return this.ownsPersonalAvatar(actor)&&this.standardAvatarFor!==actorKey(actor);
  }

  model(actor){
    if(this.usesPersonalAvatar(actor))return personalAvatarFile;
    return profiles[this.preference(actor)??(actor.kind==='human'?this.assignments.get(actorKey(actor)):0)]??profiles[0];
  }

  preference(actor){
    return actor.kind==='human'&&!this.usesPersonalAvatar(actor)?this.preferences.get(actorKey(actor))??null:null;
  }

  choose(actor,slot){
    if(actor.kind!=='human'||(slot!==null&&!validSlot(slot)))return false;
    const key=actorKey(actor);
    const standardAvatarFor=this.ownsPersonalAvatar(actor)?(slot===null?null:key):this.standardAvatarFor;
    if(this.preference(actor)===slot&&standardAvatarFor===this.standardAvatarFor)return true;
    const choices=new Map(this.preferences);
    if(slot===null)choices.delete(key);
    else {
      choices.delete(key);
      choices.set(key,slot);
    }
    if(choices.size>preferenceLimit)choices.delete(choices.keys().next().value);
    this.savePreferences?.({schema:preferenceSchema,choices:[...choices],...(standardAvatarFor?{standardAvatarFor}:{})});
    this.preferences=choices;
    this.standardAvatarFor=standardAvatarFor;
    return true;
  }
}

function aligned(length){
  return Math.ceil(length/4)*4;
}

function wardrobeModel(model,atlas){
  const jsonLength=model.readUInt32LE(12);
  const binaryStart=28+jsonLength;
  if(model.toString('ascii',0,4)!=='glTF'||model.readUInt32LE(4)!==2||
     model.readUInt32LE(8)!==model.length||model.toString('ascii',16,20)!=='JSON'||
     model.toString('ascii',binaryStart-4,binaryStart)!=='BIN\0')throw Error('Invalid avatar rig');
  const document=JSON.parse(model.toString('utf8',20,20+jsonLength));
  const image=document.images[document.textures[document.materials[0].pbrMetallicRoughness.baseColorTexture.index].source];
  if(document.buffers.length!==1||image.name!=='atlas-base'||image.mimeType!=='image/jpeg')
    throw Error('Expected embedded avatar colour atlas');
  const view=document.bufferViews[image.bufferView];
  const binary=model.subarray(binaryStart);
  const start=view.byteOffset??0,offset=start+Math.ceil(view.byteLength/8)*8;
  if(document.bufferViews.some(other=>other!==view&&
    (other.byteOffset??0)<offset&&(other.byteOffset??0)+other.byteLength>start))
    throw Error('Expected a standalone avatar atlas');
  const nextOffset=start+Math.ceil(atlas.length/8)*8;
  const nextBinaryLength=nextOffset+binary.length-offset;
  document.buffers[0].byteLength=nextBinaryLength;
  view.byteLength=atlas.length;
  for(const other of document.bufferViews){
    if(other!==view&&(other.byteOffset??0)>=offset)other.byteOffset+=nextOffset-offset;
  }
  const json=Buffer.from(JSON.stringify(document));
  const nextJsonLength=aligned(json.length);
  const output=Buffer.alloc(28+nextJsonLength+nextBinaryLength);
  output.write('glTF');output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);
  output.writeUInt32LE(nextJsonLength,12);output.write('JSON',16);
  output.fill(32,20,20+nextJsonLength);json.copy(output,20);
  const nextBinaryStart=28+nextJsonLength;
  output.writeUInt32LE(nextBinaryLength,nextBinaryStart-8);output.write('BIN\0',nextBinaryStart-4);
  binary.copy(output,nextBinaryStart,0,start);
  atlas.copy(output,nextBinaryStart+start);
  binary.copy(output,nextBinaryStart+nextOffset,offset);
  return output;
}

// The archive keeps only a second small colour map per rig. The browser
// receives an ordinary self-contained GLB for either wardrobe, without a
// custom renderer, animation path or duplicated rig in the release.
let wardrobeAssets;
export function humanWardrobeAssets(){
  wardrobeAssets??=new Map(outfits.map((name,index)=>[name,wardrobeModel(
    readFileSync(new URL(`../public/assets/${rigs[index]}.glb`,import.meta.url)),
    readFileSync(new URL(`../public/assets/human-outfits/${rigs[index]}.jpg`,import.meta.url)),
  )]));
  return wardrobeAssets;
}
