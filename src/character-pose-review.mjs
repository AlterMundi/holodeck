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
  let notes=checkpoint?.notes??[],presentation=checkpoint?.presentation??null,fenced=false;
  if(checkpoint&&(checkpoint.version!==1||!Array.isArray(checkpoint.notes)||notes.length>noteCapacity||
    notes.some(note=>!exactKeys(note,['id','actor','author','pose','text'])||
      Object.values(note).some(value=>typeof value!=='string'))))
    throw Error('Unexpected pose review checkpoint');
  if(presentation&&(!exactKeys(presentation,['revision','pose','actor','author'])||
    !Number.isSafeInteger(presentation.revision)||presentation.revision<1||
    !exactKeys(presentation.pose,['rig','clip','edition','frame'])||
    typeof presentation.actor!=='string'||typeof presentation.author!=='string'))throw Error('Unexpected presented pose');

  function save(nextNotes,nextPresentation){
    if(fenced)return false;
    try{store.save({version:1,notes:nextNotes,presentation:nextPresentation});}
    catch(error){
      if(error.commitUncertain)fenced=true;
      return false;
    }
    notes=nextNotes;
    presentation=nextPresentation;
    return true;
  }

  function presented(){
    const revision=presentation?.revision??0;
    if(!presentation||resolveReviewPose(presentation.pose,catalog).status!==200)
      return {status:200,revision,presentation:null};
    return {status:200,revision,presentation:{pose:presentation.pose,author:presentation.author}};
  }


  const forPose=pose=>{
    const resolved=resolveReviewPose(pose,catalog);
    if(resolved.status!==200)return resolved;
    return {status:200,notes:notes.filter(note=>note.pose===resolved.key)
      .map(({id,actor,author,text})=>({
        id:createHash('sha256').update(actor+'\0'+id).digest('hex'),author,text,
      }))};
  };
  return {
    forPose,presented,
    present(actor,request){
      if(!exactKeys(request,['expectedRevision','pose'])||!Number.isSafeInteger(request.expectedRevision)||
        request.expectedRevision<0)return {status:400};
      const chosen=resolveReviewPose(request.pose,catalog);
      if(chosen.status!==200)return chosen;
      if(fenced)return {status:503};
      if(presentation?.actor===actor.id&&
        chosen.key===resolveReviewPose(presentation.pose,catalog).key)return presented();
      const revision=presentation?.revision??0;
      if(request.expectedRevision!==revision)return {status:409};
      const author=String(actor.name??'Visitante').slice(0,96);
      if(!save(notes,{revision:revision+1,pose:request.pose,actor:actor.id,author}))return {status:503};
      return presented();
    },
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
      if(!save(next,presentation))return {status:503};
      return forPose(request.pose);
    },
  };
}
