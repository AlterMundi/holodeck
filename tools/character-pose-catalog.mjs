import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {rigs} from '../src/character-studio-rigs.mjs';
import {humanMotionStudies,motionStudyRate} from '../src/human-motion-study.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');

async function model(path){
  const bytes=await readFile(new URL('../public/'+path,import.meta.url));
  const manifest=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  return {
    digest:digest(bytes),
    clips:manifest.animations?.map(({name,samplers})=>({name,
      maxFrame:Math.ceil(Math.max(...samplers.map(({input})=>
        Math.fround(manifest.accessors[input].max[0])))*motionStudyRate)}))??[],
  };
}

// The browser and server qualify the same shipped bytes and sampled study code.
export async function characterPoseCatalog(studyRevision){
  const catalog={};
  for(const [id,rig] of Object.entries(rigs)){
    const asset=await model(rig.file);
    const identity=(digest,maxFrame)=>({edition:asset.digest+'.'+digest,maxFrame});
    if(!rig.clips){
      catalog[id]=Object.fromEntries(asset.clips.map(({name,maxFrame})=>[name,identity(asset.digest,maxFrame)]));
      continue;
    }
    const stock=Object.fromEntries(await Promise.all(Object.entries(rig.clips).map(async ([clip,path])=>{
      const sample=await model(path);
      return [clip,identity(sample.digest,sample.clips[0].maxFrame)];
    })));
    const stockDigest=name=>stock[name].edition.split('.')[1];
    catalog[id]={...stock,...Object.fromEntries(Object.entries(humanMotionStudies).map(([name,study])=>{
      const inputs=[studyRevision,name,stockDigest('idle')];
      if(study.walking)inputs.push(stockDigest('jog'));
      return [name,identity(digest(inputs.join(' ')),Math.round(study.duration*motionStudyRate))];
    }))};
  }
  return catalog;
}
