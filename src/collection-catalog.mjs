import {readWorktableReference} from './collection-review.mjs';
import {isMatterArtProfile} from './matter-workshop-art.mjs';

const RESOURCE=/^[a-f0-9]{32}$/;
const VERSION=/^[a-f0-9]{64}$/;
const PROJECT=/^[a-z0-9][a-z0-9-]{0,39}$/;
const SOURCE_PREFIX='dm:resource:v1:';

// Keep the fallback art readable by the preceding service package. Only
// this reader interprets the separate, room-bound appearance selection.
export function selectMatterAppearance(receiving){
  const base=receiving?.matterCollection;
  const overlay=receiving?.matterAppearance;
  if(overlay===undefined)return base;
  if(!base||!overlay||Object.keys(overlay).sort().join(',')!=='profile,room'||
    overlay.room!==base.room||!isMatterArtProfile(overlay.profile))
    throw Error('Select a qualified appearance for the existing Matter room');
  return {...base,art:overlay.profile};
}

export function collectionSelection(selection,rooms){
  if(selection===undefined)return null;
  if(!selection||!['projects,room','art,projects,room','archive,projects,room','archive,art,projects,room'].includes(Object.keys(selection).sort().join(','))||!rooms.has(selection.room)||
     !Array.isArray(selection.projects)||selection.projects.length<1||selection.projects.length>6)
    throw Error('Select an existing Collection room and one to six shelf projects');
  if(selection.art!==undefined&&(!isMatterArtProfile(selection.art)||
     rooms.get(selection.room).links?.some(link=>link.kind==='stair')))
    throw Error('Select the Matter workshop shell on a room without stairs');
  const ids=new Set(),selected=new Set();
  const projects=selection.projects.map(project=>{
    if(!project||Object.keys(project).sort().join(',')!=='id,resources'||typeof project.id!=='string'||
       !PROJECT.test(project.id)||ids.has(project.id)||!Array.isArray(project.resources)||
       project.resources.length<1||project.resources.length>3)
      throw Error('Select project IDs with one to three existing Home resources');
    ids.add(project.id);
    for(const resource of project.resources){
      if(typeof resource!=='string'||!RESOURCE.test(resource)||selected.has(resource))
        throw Error('Select distinct Home resources for the Collection');
      selected.add(resource);
    }
    return Object.freeze({id:project.id,resources:Object.freeze([...project.resources])});
  });
  const archive=selection.archive;
  if(archive!==undefined&&(!Array.isArray(archive)||archive.length>6||
    archive.some(item=>!item||Object.keys(item).sort().join(',')!=='label,resource,version'||
      typeof item.resource!=='string'||!RESOURCE.test(item.resource)||
      typeof item.version!=='string'||!VERSION.test(item.version)||!title(item.label))||
    new Set(archive.map(item=>item.resource+':'+item.version)).size!==archive.length))
    throw Error('Select up to six named, distinct archive editions');
  return Object.freeze({room:selection.room,projects:Object.freeze(projects),
    ...(archive?{archive:Object.freeze(archive.map(item=>Object.freeze({...item,label:title(item.label)})))}:{}),
    ...(selection.art?{art:selection.art}:{})});
}

async function boundedJSON(response,limit){
  const reader=response.body?.getReader();
  if(!reader)return null;
  try{
    if(response.status!==200||response.redirected||Number(response.headers.get('content-length'))>limit)return null;
    const parts=[];let size=0;
    for(;;){
      const {done,value}=await reader.read();
      if(done)return JSON.parse(Buffer.concat(parts,size).toString('utf8'));
      size+=value.byteLength;
      if(size>limit)return null;
      parts.push(value);
    }
  }finally{reader.cancel().catch(()=>{});}
}

function sourceCookie(cookie){
  if(typeof cookie!=='string'||Buffer.byteLength(cookie)>8192||/[\x00-\x1f\x7f]/.test(cookie))return null;
  const matches=cookie.split(';').map(part=>part.trim()).filter(part=>part.startsWith('__Host-home='));
  return matches.length===1?matches[0]:null;
}

function title(value){
  return typeof value==='string'&&value.length<=180?value.replace(/[\x00-\x1f\x7f]/g,' ').trim():'';
}

export function createCollectionReader(origin,{request=fetch}={}){
  const selected=new URL(origin);
  if(selected.protocol!=='https:'||selected.origin!==origin)throw Error('Select the canonical HTTPS Home origin');
  return async (cookie,selection)=>{
    const session=sourceCookie(cookie);
    if(!session)return null;
    const signal=AbortSignal.timeout(3500);
    const read=path=>request(new URL(path,selected),{headers:{Cookie:session,Accept:'application/json'},
      cache:'no-store',redirect:'error',signal});
    let catalog;
    try{catalog=await boundedJSON(await read('/catalog.json'),1024*1024);}catch{return null;}
    if(!Array.isArray(catalog?.entries)||catalog.entries.length>2048)return null;
    const available=new Map();
    for(const row of catalog.entries){
      if(row?.kind!=='artifact'||row.model_review!==true||typeof row.resource_ref!=='string'||
         !row.resource_ref.startsWith(SOURCE_PREFIX)||typeof row.version_ref!=='string'||
         !VERSION.test(row.version_ref)||!title(row.title))continue;
      const resource=row.resource_ref.slice(SOURCE_PREFIX.length);
      if(RESOURCE.test(resource))available.set(resource,{version:row.version_ref,title:title(row.title)});
    }
    let unavailable=false;
    async function exact(resource,pin){
      const entry=available.get(resource);
      if(!entry)return null;
      const version=pin??entry.version;
      try{
        const response=await read('/works/'+resource+'/'+version+'/review-live.json');
        const manifest=await boundedJSON(response,16*1024);
        if(response.status===401||response.status===408||response.status===429||response.status>=500)unavailable=true;
        if(response.headers.get('x-home-version')!==version||manifest?.schema!=='dm.review-live/v1'||
           manifest.gallery!=='gallery.json'||typeof manifest.sha256!=='string'||!VERSION.test(manifest.sha256))return null;
        const index=manifest.scene_index;
        const sceneIndexSha256=index?.file==='scene-index.json'&&typeof index.sha256==='string'&&VERSION.test(index.sha256)
          ?index.sha256:null;
        return {resource,...entry,version,gallerySha256:manifest.sha256,...(sceneIndexSha256?{sceneIndexSha256}:{})};
      }catch{
        unavailable=true;
        return null;
      }
    }
    const [projects,archive]=await Promise.all([
      Promise.all(selection.projects.map(async ({id,resources},shelf)=>{
        const editions=(await Promise.all(resources.map(resource=>exact(resource)))).filter(Boolean);
        return editions.length>0?{id,shelf,editions}:null;
      })),
      Promise.all((selection.archive??[]).map(async ({resource,version,label})=>{
        const edition=await exact(resource,version);
        return edition?{...edition,label}:null;
      })),
    ]);
    const result={projects:projects.filter(Boolean),archive:archive.filter(Boolean),partial:unavailable};
    return unavailable&&!result.projects.length&&!result.archive.length?null:result;
  };
}

export function createCollectionReferenceReader(origin,readCollection,{request=fetch}={}){
  return async (cookie,reference,{current=false}={})=>{
    const session=sourceCookie(cookie);
    if(!session||!reference||Object.keys(reference).sort().join(',')!=='part,resource,scene,sceneVersion,version'||
       typeof reference.resource!=='string'||!RESOURCE.test(reference.resource)||
       typeof reference.version!=='string'||!VERSION.test(reference.version))return null;
    const {resource,version}=reference;
    const selection=current?{projects:[{id:'worktable',resources:[resource]}]}:
      {projects:[],archive:[{resource,version}]};
    const catalog=await readCollection(cookie,selection);
    const edition=current?catalog?.projects[0]?.editions[0]:catalog?.archive[0];
    if(edition?.version!==version)return null;
    const signal=AbortSignal.timeout(4500);
    const source=(path,options)=>request(new URL(path,origin),{...options,headers:{Cookie:session,Accept:'application/json'}});
    try{return await readWorktableReference(edition,reference,{request:source,signal});}
    catch{return null;}
  };
}
