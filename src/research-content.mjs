// Content-only research editions. No identity, grant, native input or network URL
// comes from this document. Publication and viewer permissions remain separate.
export const MAX_RESEARCH_BYTES=262144;
const object=(v,keys)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const text=(v,max=2000)=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9-]{0,63}$/.test(v);
const local=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.[a-zA-Z0-9]{1,8}$/.test(v)&&v.length<=160;
const download=(v,ext)=>typeof v==='string'&&new RegExp('^media/[a-f0-9]{64}\\.'+ext+'$').test(v);
export function evidenceURL(value){
 try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&value.length<=1600;}catch{return false;}
}
export function validResearchDate(v){
 if(!object(v,'value,precision'))return false;
 if(v.precision==='unknown')return v.value===null;
 if(typeof v.value!=='string')return false;
 if(v.precision==='year')return /^\d{4}$/.test(v.value);
 if(v.precision==='month')return /^\d{4}-(0[1-9]|1[0-2])$/.test(v.value);
 if(v.precision!=='day'||!/^\d{4}-\d{2}-\d{2}$/.test(v.value))return false;
 const d=new Date(v.value+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v.value;
}
export function validateResearchContent(value){
 if(!object(value,'schema,id,revision,subject,status,summary,sources,subjectHistory,researchHistory,designs')
  ||value.schema!=='holodeck.research-content/v1'||!id(value.id)||!id(value.revision)
  ||!object(value.subject,'name,place')||!text(value.subject.name,80)||!value.subject.name.trim()||!text(value.subject.place,160)
  ||!['awaiting-source','draft','ready'].includes(value.status)||!text(value.summary,8000))throw Error('Invalid research edition');
 const seen=new Set();
 function unique(rows,max,check){
  if(!Array.isArray(rows)||rows.length>max)throw Error('Research capacity exceeded');
  for(const row of rows){if(!row||!id(row.id)||seen.has(row.id)||!check(row))throw Error('Invalid or duplicate research entry');seen.add(row.id);}
 }
 unique(value.sources,64,s=>object(s,'id,title,url,author,publishedAt,revision')&&text(s.title,200)&&s.title.trim()
  &&evidenceURL(s.url)&&(s.author===null||text(s.author,160))&&validResearchDate(s.publishedAt)&&(s.revision===null||text(s.revision,160)));
 const sources=new Set(value.sources.map(s=>s.id));
 const event=e=>object(e,'id,title,text,when,evidence,confidence,author')&&text(e.title,160)&&e.title.trim()&&text(e.text,4000)
  &&validResearchDate(e.when)&&['confirmed','tentative'].includes(e.confidence)&&(e.author===null||text(e.author,160))
  &&Array.isArray(e.evidence)&&e.evidence.length<=16&&new Set(e.evidence).size===e.evidence.length
  &&e.evidence.every(ref=>sources.has(ref))&&(e.confidence!=='confirmed'||e.evidence.length>0);
 unique(value.subjectHistory,128,event);unique(value.researchHistory,128,event);
 unique(value.designs,16,d=>object(d,'id,title,stage,note,assets,dimensions,evidence')&&text(d.title,160)&&text(d.note,2000)
  &&['generated','geometrically-validated','sliced','printed'].includes(d.stage)
  &&object(d.assets,'preview,stl,glb')&&local(d.assets.preview)&&download(d.assets.stl,'stl')&&download(d.assets.glb,'glb')
  &&object(d.dimensions,'widthMm,heightMm,depthMm')&&Object.values(d.dimensions).every(n=>Number.isFinite(n)&&n>0&&n<=5000)
  &&object(d.evidence,'watertight,components,profile,physicalNote')&&typeof d.evidence.watertight==='boolean'
  &&Number.isSafeInteger(d.evidence.components)&&d.evidence.components>0&&d.evidence.components<=256
  &&(d.evidence.profile===null||text(d.evidence.profile,500))&&(d.evidence.physicalNote===null||text(d.evidence.physicalNote,1000))
  &&(!['sliced','printed'].includes(d.stage)||!!d.evidence.profile?.trim())
  &&(d.stage!=='printed'||!!d.evidence.physicalNote?.trim()));
 if(value.status==='ready'&&(!value.sources.length||!value.summary.trim()))throw Error('A ready edition needs actual evidence and text');
 if(new TextEncoder().encode(JSON.stringify(value)).length>MAX_RESEARCH_BYTES)throw Error('Research edition exceeds byte bound');
 return structuredClone(value);
}
export async function readResearchResponse(response){
 if(!response.ok)throw Error('No se pudo abrir esta edición.');
 if(Number(response.headers.get('content-length'))>MAX_RESEARCH_BYTES)throw Error('La edición supera el tamaño permitido.');
 const reader=response.body?.getReader();let raw;
 if(reader){const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_RESEARCH_BYTES)throw Error('La edición supera el tamaño permitido.');chunks.push(value);}}
  catch(error){await reader.cancel();throw error;}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 }else{raw=await response.text();if(new TextEncoder().encode(raw).length>MAX_RESEARCH_BYTES)throw Error('La edición supera el tamaño permitido.');}
 return validateResearchContent(JSON.parse(raw));
}
