import {createHash} from 'node:crypto';

const noteCapacity=160;
const requestId=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const edition=/^[a-f0-9]{64}\.[a-f0-9]{64}$/;

function exactKeys(value,keys){
  return value&&typeof value==='object'&&Object.keys(value).length===keys.length&&
    keys.every(key=>Object.hasOwn(value,key));
}

export function resolveReviewPose(input,catalog){
  if(!exactKeys(input,['rig','clip','edition','frame'])||
     typeof input.rig!=='string'||!Object.hasOwn(catalog,input.rig)||
     typeof input.clip!=='string'||!Object.hasOwn(catalog[input.rig],input.clip)||
     typeof input.edition!=='string'||!edition.test(input.edition)||
     !Number.isSafeInteger(input.frame)||input.frame<0)return {status:400};
  const selection=catalog[input.rig][input.clip];
  if(input.edition!==selection.edition||input.frame>selection.maxFrame)return {status:409};
  return {status:200,key:[input.rig,input.clip,input.edition,input.frame].join(':')};
}

export function createCharacterPoseReview(store,catalog){
  const checkpoint=store.load();
  let notes=checkpoint?.notes??[],fenced=false;
  if(checkpoint&&(checkpoint.version!==1||!Array.isArray(checkpoint.notes)||notes.length>noteCapacity||
    notes.some(note=>!exactKeys(note,['id','actor','author','pose','text'])||
      Object.values(note).some(value=>typeof value!=='string'))))
    throw Error('Unexpected pose review checkpoint');

  const forPose=pose=>{
    const resolved=resolveReviewPose(pose,catalog);
    if(resolved.status!==200)return resolved;
    return {status:200,notes:notes.filter(note=>note.pose===resolved.key)
      .map(({id,actor,author,text})=>({
        id:createHash('sha256').update(actor+'\0'+id).digest('hex'),author,text,
      }))};
  };
  return {
    forPose,
    add(actor,request){
      if(!exactKeys(request,['id','pose','text'])||typeof request.id!=='string'||
         !requestId.test(request.id)||typeof request.text!=='string')return {status:400};
      const text=request.text.trim();
      if(!text||text.length>300)return {status:400};
      const selection=resolveReviewPose(request.pose,catalog);
      if(selection.status!==200)return selection;
      if(fenced)return {status:503};
      const prior=notes.find(note=>note.actor===actor.id&&note.id===request.id);
      if(prior)return prior.pose===selection.key&&prior.text===text?forPose(request.pose):{status:409};
      if(notes.length>=noteCapacity)return {status:503};
      const author=String(actor.name??'Visitante').slice(0,96);
      const next=[...notes,{id:request.id,actor:actor.id,author,pose:selection.key,text}];
      try{store.save({version:1,notes:next});}
      catch(error){
        if(error.commitUncertain)fenced=true;
        return {status:503};
      }
      notes=next;
      return forPose(request.pose);
    },
  };
}
