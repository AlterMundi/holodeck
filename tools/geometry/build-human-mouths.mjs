// Add the same speech aperture shape to the two licensed face topologies.
// Run from this repository with the original GLBs in input and a fresh output
// directory. The pinned Draco decoder supplies the runtime point order.
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import draco3d from 'draco3d';

const [input,output]=process.argv.slice(2);
if(!input||!output||resolve(input)===resolve(output))throw Error('Specify separate input and output directories');
mkdirSync(output,{recursive:true});

const skins=[
  ['avatar-1-bodyA-skin01', '2bb4ff4ca71ebbaa96be9a3073b6c82b62188836c0aea2a50bec298c354d2457', [512.2,199.92],1.627],
  ['avatar-2-bodyB-skin03', '922525b25be5162cc4ff831026c3e8bdf600d1a72bd054c84660809c67a4b792', [170.8,541.42],1.630],
  ['avatar-3-bodyA-skin05', 'edb437e2168e18fda4e824316338286d63eef94efb545c1c08763fced1578853', [170.9,541.35],1.623],
  ['avatar-4-bodyB-skin07', 'c7dc68c4936e497bca827a5324e63f82a7de9a61f2c9a621e94fbd9c083a5640', [853.6,199.94],1.625],
];
const draco=await draco3d.createDecoderModule({});
const align=value=>Math.ceil(value/4)*4;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const smooth=(value,start,end)=>{
  const n=Math.min(1,Math.max(0,(value-start)/(end-start)));
  return n*n*(3-2*n);
};

function attributes(compressed,ids){
  const decoder=new draco.Decoder(),buffer=new draco.DecoderBuffer(),mesh=new draco.Mesh();
  buffer.Init(new Int8Array(compressed),compressed.length);
  const status=decoder.DecodeBufferToMesh(buffer,mesh);
  if(!status.ok())throw Error(status.error_msg());
  const columns={};
  for(const key of ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0']){
    const attribute=decoder.GetAttributeByUniqueId(mesh,ids[key]);
    const values=new draco.DracoFloat32Array();
    if(!decoder.GetAttributeFloatForAllPoints(mesh,attribute,values))throw Error('Missing '+key);
    columns[key]=Float32Array.from({length:values.size()},(_,index)=>values.GetValue(index));
    draco.destroy(values);
  }
  for(const object of [mesh,buffer,decoder])draco.destroy(object);
  return columns;
}

function aperture({POSITION,NORMAL,TEXCOORD_0,JOINTS_0,WEIGHTS_0},head,[center,lip],pivotY){
  const posed=new Map();
  const vertex=index=>POSITION.subarray(index*3,index*3+3);
  const headOwned=index=>JOINTS_0[index*4]===head&&WEIGHTS_0[index*4]>=204;
  for(let index=0;index<POSITION.length/3;index++){
    if(!headOwned(index))continue;
    const xyz=vertex(index),[x,y,z]=xyz;
    const [u,v]=TEXCOORD_0.subarray(index*2,index*2+2);
    const atlasX=Math.abs(u*1024-center),atlasY=v*1024-lip;
    if(atlasX>=75||atlasY<=-19||atlasY>=79||z<=.035)continue;
    const centerWeight=(1-smooth(Math.abs(x),.016,.068))*(1-smooth(atlasX,37,75));
    const forwardWeight=smooth(z,.035,.091);
    const lipWidth=1-smooth(Math.abs(x),.006,.030);
    // The lip corners stay attached while the jaw moves underneath. Widen
    // the influence gradually below the lower lip into the chin and cheeks.
    const jawWidth=lipWidth+(1-lipWidth)*smooth(atlasY,6,29);
    const jawWeight=atlasY>0?smooth(atlasY,0,.55)*(1-smooth(atlasY,36,79)):0;
    const angle=.225*centerWeight*forwardWeight*jawWeight*jawWidth;
    const lift=atlasY<=0?.0017*lipWidth*centerWeight*forwardWeight*(1-smooth(-atlasY,1,15)):0;
    const cos=Math.cos(angle),sin=Math.sin(angle);
    const relativeY=y-pivotY,relativeZ=z-.04;
    const deltaY=(cos-1)*relativeY-sin*relativeZ+lift;
    const deltaZ=sin*relativeY+(cos-1)*relativeZ;
    const amount=Math.hypot(deltaY,deltaZ);
    const key=xyz.join(',');
    if(amount>=.00002&&amount>(posed.get(key)?.amount??0))posed.set(key,{deltaY,deltaZ,cos,sin,amount});
  }
  // The mouth lining uses a separate atlas island. Copy the face's
  // movement to coincident head vertices so the UV seam cannot split.
  const positions=[],normals=[],indices=[];
  for(let index=0;index<POSITION.length/3;index++){
    if(!headOwned(index))continue;
    const moved=posed.get(vertex(index).join(','));
    if(!moved)continue;
    const {deltaY,deltaZ,cos,sin}=moved;
    const [nx,ny,nz]=NORMAL.subarray(index*3,index*3+3);
    indices.push(index);
    positions.push(0,deltaY,deltaZ);
    normals.push(0,(cos-1)*ny-sin*nz,sin*ny+(cos-1)*nz);
  }
  return {positions,normals,indices};
}

function addMorph(document,binary,primitive,{positions,normals,indices},count){
  const bufferParts=[binary];
  let end=binary.length;
  const view=part=>{
    const start=align(end);
    if(start>end)bufferParts.push(Buffer.alloc(start-end));
    bufferParts.push(part);end=start+part.length;
    return document.bufferViews.push({buffer:0,byteOffset:start,byteLength:part.length})-1;
  };
  const indexBytes=Buffer.alloc(indices.length*2);
  indices.forEach((index,i)=>indexBytes.writeUInt16LE(index,2*i));
  const indexView=view(indexBytes);
  const type={componentType:5126,count,type:'VEC3'};
  const add=(values,bounds)=>{
    const bytes=Buffer.alloc(values.length*4);
    values.forEach((value,i)=>bytes.writeFloatLE(value,4*i));
    const index=document.accessors.push({...type,...bounds,sparse:{count:indices.length,
      indices:{bufferView:indexView,componentType:5123},values:{bufferView:view(bytes)}}})-1;
    return index;
  };
  const min=[0,0,0],max=[0,0,0];
  positions.forEach((value,i)=>{
    const lane=i%3,next=Math.fround(value);
    min[lane]=Math.min(min[lane],next);max[lane]=Math.max(max[lane],next);
  });
  primitive.targets=[{POSITION:add(positions,{min,max}),NORMAL:add(normals,{})}];
  const model=document.meshes[0];
  model.weights=[0];model.extras={...model.extras,targetNames:['jawOpen']};
  document.buffers[0].byteLength=align(end);
  if(end%4)bufferParts.push(Buffer.alloc(align(end)-end));
  const meta=Buffer.from(JSON.stringify(document));
  const out=Buffer.alloc(28+align(meta.length)+align(end),0);
  out.write('glTF');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);
  out.writeUInt32LE(align(meta.length),12);out.write('JSON',16);
  out.fill(32,20,20+align(meta.length));meta.copy(out,20);
  const start=28+align(meta.length);
  out.writeUInt32LE(align(end),start-8);out.write('BIN\x00',start-4);
  Buffer.concat(bufferParts).copy(out,start);
  return out;
}

for(const [name,pinned,atlas,pivot] of skins){
  const file=name+'.glb',source=readFileSync(join(input,file));
  if(digest(source)!==pinned)throw Error('Unexpected base rig: '+name);
  const jsonLength=source.readUInt32LE(12),document=JSON.parse(source.toString('utf8',20,20+jsonLength));
  const binary=source.subarray(28+jsonLength),primitive=document.meshes[0].primitives[0];
  const dracoView=primitive.extensions.KHR_draco_mesh_compression;
  const {byteOffset=0,byteLength}=document.bufferViews[dracoView.bufferView];
  if(document.meshes.length!==1||document.meshes[0].primitives.length!==1||
      primitive.targets||document.meshes[0].weights||document.nodes.some(node=>node.weights)||
      document.accessors[primitive.attributes.WEIGHTS_0].componentType!==5121||
      document.accessors[primitive.attributes.WEIGHTS_0].normalized!==true)throw Error('Unexpected rig layout: '+name);
  const decoded=attributes(binary.subarray(byteOffset,byteOffset+byteLength),dracoView.attributes);
  const head=document.skins[0].joints.findIndex(index=>document.nodes[index].name==='head');
  const count=decoded.POSITION.length/3,result=aperture(decoded,head,atlas,pivot);
  if(head<0||count!==document.accessors[primitive.attributes.POSITION].count||count>65535||
      result.indices.length<250||result.indices.length>1800)throw Error('Unexpected aperture topology: '+name);
  const bytes=addMorph(document,binary,primitive,result,count);
  writeFileSync(join(output,file),bytes);
  console.log(name,result.indices.length,bytes.length-source.length,digest(bytes));
}
