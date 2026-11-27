// Read the fixed dm.review-live/v1 files used by the Home 3D Viewer.
const MAX_BYTES=25*1024*1024;
const hex=(value,length)=>typeof value==='string'&&value.length===length&&/^[a-f0-9]+$/.test(value);
const vector=value=>Array.isArray(value)&&value.length===3&&value.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e9);
const name=value=>typeof value==='string'&&value.length>0&&value.length<=180;
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),
  byte=>byte.toString(16).padStart(2,'0')).join('');

async function bounded(stream,limit){
  const reader=stream.getReader(),chunks=[];
  let total=0;
  try{
    for(;;){
      const {value,done}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>limit)throw Error('Review exceeds its byte limit');
      chunks.push(value);
    }
  }finally{reader.cancel().catch(()=>{});}
  const result=new Uint8Array(total);
  let at=0;
  for(const chunk of chunks){result.set(chunk,at);at+=chunk.byteLength;}
  return result;
}

function partMetadata(part){
  if(!name(part.id)||!name(part.label)||typeof part.color!=='string'||!/^#[a-f0-9]{6}$/i.test(part.color))
    throw Error('Invalid review part identity');
  return {id:part.id,label:part.label,color:part.color};
}
function sceneMetadata(scene){
  if(scene?.units!=='mm'||!name(scene.id)||!name(scene.title)||!hex(scene.version,64)||
     !Array.isArray(scene.parts)||!scene.parts.length||scene.parts.length>256)
    throw Error('Invalid review scene');
  const parts=scene.parts.map(partMetadata);
  if(new Set(parts.map(part=>part.id)).size!==parts.length)throw Error('Duplicate review part');
  return {id:scene.id,version:scene.version,title:scene.title,parts,...(scene.model?{model:sceneModel(scene.model)}:{})};
}

// Optional complete presentation of the same scene: an exact glTF binary in the
// same Home publication, with its own materials, textures, skin and clips. The
// part meshes stay authoritative for identity, picking and the inspection cut.
export const MAX_SCENE_MODEL_BYTES=8*1024*1024;
function sceneModel(model){
  if(!model||typeof model!=='object'||Array.isArray(model)||
     typeof model.file!=='string'||!/^[a-z0-9][a-z0-9._-]{0,80}\.glb$/i.test(model.file)||
     !hex(model.sha256,64)||!Number.isSafeInteger(model.bytes)||model.bytes<20||model.bytes>MAX_SCENE_MODEL_BYTES||
     (model.clip!==undefined&&!name(model.clip)))
    throw Error('Invalid review scene model');
  return {file:model.file,sha256:model.sha256,bytes:model.bytes,...(model.clip?{clip:model.clip}:{})};
}

function transform(positions,i,x,y,z,offset){
  positions[i]=(x+offset[0])*.001;
  positions[i+1]=(z+offset[2])*.001;
  positions[i+2]=-(y+offset[1])*.001;
}
function validateTriangle(indices,at,a,b,c,size){
  if([a,b,c].some(value=>!Number.isInteger(value)||value<0||value>=size))
    throw Error('Invalid review triangle');
  indices[at]=a;indices[at+1]=b;indices[at+2]=c;
}
function unpackPart(part,view,start){
  const {mesh}=part,offset=part.offset??[0,0,0];
  if(!vector(offset))throw Error('Invalid review part offset');
  const positions=new Float32Array(mesh.vertices*3),indices=new Uint32Array(mesh.triangles*3);
  const previous=[0,0,0];
  let cursor=start;
  for(let i=0;i<positions.length;i+=3){
    const next=previous.map((value,axis)=>{
      const decoded=value+view.getInt32(cursor,true);cursor+=4;
      if(decoded<0||decoded>2147483647)throw Error('Invalid packed review vertex');
      previous[axis]=decoded;
      return mesh.origin[axis]+decoded*mesh.scale;
    });
    if(!vector(next))throw Error('Invalid packed review coordinates');
    transform(positions,i,...next,offset);
  }
  let a=0;
  for(let i=0;i<indices.length;i+=3){
    a+=view.getUint16(cursor,true);
    validateTriangle(indices,i,a,a+view.getUint16(cursor+2,true),a+view.getUint16(cursor+4,true),mesh.vertices);
    cursor+=6;
  }
  return {positions,indices,...partMetadata(part)};
}
async function packedParts(gallery,selected){
  const buffer=gallery.buffer;
  if(buffer?.encoding!=='gzip/i32-delta-xyz+u16-delta-tri/le'||
     !Number.isInteger(buffer.size)||buffer.size<1||buffer.size>MAX_BYTES||!hex(buffer.sha256,64)||
     typeof buffer.data!=='string'||buffer.data.length>Math.ceil(MAX_BYTES/3)*4)
    throw Error('Invalid packed review');
  let end=0;
  const parts=[];
  for(const scene of gallery.scenes){
    if(!Array.isArray(scene.parts)||!scene.parts.length||scene.parts.length>256)throw Error('Invalid packed scene');
    let triangles=0;
    for(const part of scene.parts){
      const mesh=part.mesh;
      if(!mesh||!vector(mesh.origin)||!Number.isFinite(mesh.scale)||mesh.scale<=0||mesh.scale>1||
         !Number.isInteger(mesh.vertices)||mesh.vertices<3||mesh.vertices>65535||
         !Number.isInteger(mesh.triangles)||mesh.triangles<1||mesh.triangles>300000)
        throw Error('Invalid packed mesh');
      if(scene===selected)parts.push({part,start:end});
      triangles+=mesh.triangles;
      end+=mesh.vertices*12+mesh.triangles*6;
      if(triangles>300000||end>buffer.size)throw Error('Packed review exceeds its geometry limit');
    }
  }
  if(end!==buffer.size)throw Error('Invalid packed review size');
  const compressed=Uint8Array.from(atob(buffer.data),char=>char.charCodeAt(0));
  const raw=await bounded(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')),end);
  if(raw.length!==end||await digest(raw)!==buffer.sha256)throw Error('Invalid packed review hash');
  const view=new DataView(raw.buffer);
  return parts.map(({part,start})=>unpackPart(part,view,start));
}
function plainParts(scene){
  let triangles=0,vertices=0;
  return scene.parts.map(part=>{
    const offset=part.offset??[0,0,0];
    if(!Array.isArray(part.vertices)||part.vertices.length<3||!Array.isArray(part.faces)||!part.faces.length||!vector(offset))
      throw Error('Invalid review mesh');
    triangles+=part.faces.length;vertices+=part.vertices.length;
    if(triangles>300000||vertices>900000)throw Error('Review exceeds its geometry limit');
    const positions=new Float32Array(part.vertices.length*3),indices=new Uint32Array(part.faces.length*3);
    part.vertices.forEach((point,i)=>{
      if(!vector(point))throw Error('Invalid review vertex');
      transform(positions,i*3,...point,offset);
    });
    part.faces.forEach((face,i)=>{
      if(!Array.isArray(face)||face.length!==3)throw Error('Invalid review triangle');
      validateTriangle(indices,i*3,...face,part.vertices.length);
    });
    return {positions,indices,...partMetadata(part)};
  });
}

function reviewSource(edition,{request=fetch,signal}={}){
  if(!hex(edition.resource,32)||!hex(edition.version,64)||!hex(edition.gallerySha256,64))
    throw Error('Invalid Home review edition');
  const base='/works/'+edition.resource+'/'+edition.version+'/';
  return async (file,sha,limit)=>{
    const response=await request(base+file,{cache:'no-store',credentials:'same-origin',redirect:'error',signal});
    if(!response.ok||response.headers.get('X-Home-Version')!==edition.version||
       Number(response.headers.get('Content-Length'))>limit||!response.body){
      await response.body?.cancel();
      throw Error('Review source unavailable');
    }
    const bytes=await bounded(response.body,limit);
    if(await digest(bytes)!==sha)throw Error('Home review checksum changed');
    return JSON.parse(new TextDecoder().decode(bytes));
  };
}

async function readSceneIndex(edition,read){
  if(!hex(edition.sceneIndexSha256,64))throw Error('Invalid Home scene index');
  const index=await read('scene-index.json',edition.sceneIndexSha256,256*1024);
  if(index?.schema!=='dm.review-scene-index/v1'||!Array.isArray(index.entries)||!index.entries.length||
     index.entries.length>64)throw Error('Invalid Home scene index');
  const entries=index.entries.map((entry,i)=>{
    if(entry.file!=='scene-'+String(i).padStart(3,'0')+'.json'||!hex(entry.sha256,64))
      throw Error('Invalid Home scene entry');
    return {...entry,scene:sceneMetadata(entry.scene)};
  });
  const initial=entries.find(entry=>entry.scene.id===index.initial);
  if(!initial||new Set(entries.map(entry=>entry.scene.id)).size!==entries.length)throw Error('Invalid Home scene selection');
  return {entries,initial};
}

export async function readWorktableReference(edition,reference,options){
  if(!name(reference.scene)||!hex(reference.sceneVersion,64)||
     (reference.part!==null&&!name(reference.part)))return null;
  const read=reviewSource(edition,options);
  let scene;
  if(edition.sceneIndexSha256){
    const {entries}=await readSceneIndex(edition,read);
    scene=entries.find(entry=>entry.scene.id===reference.scene)?.scene;
  }else{
    const gallery=await read('gallery.json',edition.gallerySha256,MAX_BYTES);
    if(!Array.isArray(gallery?.scenes)||gallery.scenes.length>64)return null;
    const matches=gallery.scenes.filter(item=>item.id===reference.scene);
    if(matches.length===1)scene=sceneMetadata(matches[0]);
  }
  if(!scene||scene.version!==reference.sceneVersion)return null;
  const part=scene.parts.find(part=>part.id===reference.part);
  if(reference.part!==null&&!part)return null;
  return {resource:edition.resource,version:edition.version,scene:scene.id,sceneVersion:scene.version,
    part:part?.id??null,sceneTitle:scene.title,...(part?{partLabel:part.label}:{})};
}

export async function readWorktableReview(edition,requested,options){
  const read=reviewSource(edition,options);
  let file='gallery.json',sha=edition.gallerySha256,expected,choices;
  if(edition.sceneIndexSha256){
    const {entries,initial}=await readSceneIndex(edition,read);
    const chosen=entries.find(entry=>entry.scene.id===requested)??initial;
    file=chosen.file;sha=chosen.sha256;expected=chosen.scene;
    choices=entries.map(({scene:{id,title}})=>({id,title}));
  }
  const gallery=await read(file,sha,MAX_BYTES);
  if(!Array.isArray(gallery?.scenes)||!gallery.scenes.length||gallery.scenes.length>64)
    throw Error('Empty Home review');
  const chosen=expected?gallery.scenes[0]:gallery.scenes.find(scene=>scene.id===(requested??gallery.navigation?.initial))??gallery.scenes[0];
  const meta=sceneMetadata(chosen);
  if(expected&&(gallery.scenes.length!==1||JSON.stringify(meta)!==JSON.stringify(expected)))
    throw Error('Home scene geometry does not match its index');
  choices??=gallery.scenes.map(scene=>{
    if(!name(scene.id)||!name(scene.title))throw Error('Invalid Home scene label');
    return {id:scene.id,title:scene.title};
  });
  if(new Set(choices.map(choice=>choice.id)).size!==choices.length)throw Error('Duplicate Home review scene');
  const parts=gallery.schema==='dm.review-packed/v1'?await packedParts(gallery,chosen):plainParts(chosen);
  return {...meta,choices,parts};
}
