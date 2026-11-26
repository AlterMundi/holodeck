// One opaque primitive contains the deck feet, bronze frame and both readable
// faces. The atlas is private to this mounted edition and never leaves the view.
const atlasWidth=256,atlasHeight=128;
const face={x:4,y:4,width:248,height:68};
const side={
  front:{normal:[0,0,1],along:[1,0,0],up:[0,1,0]},
  back:{normal:[0,0,-1],along:[-1,0,0],up:[0,1,0]},
  right:{normal:[1,0,0],along:[0,0,-1],up:[0,1,0]},
  left:{normal:[-1,0,0],along:[0,0,1],up:[0,1,0]},
  top:{normal:[0,1,0],along:[1,0,0],up:[0,0,-1]},
  bottom:{normal:[0,-1,0],along:[1,0,0],up:[0,0,1]},
};

function atlas(document,lines){
  const canvas=document.createElement('canvas');
  canvas.width=atlasWidth;canvas.height=atlasHeight;
  const ctx=canvas.getContext('2d');
  if(!ctx)return null;
  ctx.fillStyle='#8b6949';
  ctx.fillRect(0,0,atlasWidth,atlasHeight);
  ctx.fillStyle='#263a39';
  ctx.fillRect(face.x+5,face.y+5,face.width-10,face.height-10);
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(const {text,y,fontSize,fontColor} of lines){
    const px=fontSize*2*face.width/200;
    ctx.font=`bold ${px}px Arial`;
    ctx.fillStyle=fontColor;
    const rows=text.split('\n');
    rows.forEach((row,index)=>ctx.fillText(row,atlasWidth/2,
      face.y+face.height*(.5-y/.274)+(index-(rows.length-1)/2)*px,face.width-18));
  }
  const data=canvas.toDataURL('image/png');
  if(!data.startsWith('data:image/png;base64,')||data.length>64000)return null;
  return Uint8Array.from(atob(data.slice(data.indexOf(',')+1)),character=>character.charCodeAt(0));
}

function geometry(deckMounted){
  const positions=[],normals=[],uvs=[],indices=[];
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  const tilt=(deckMounted?-12:0)*Math.PI/180,c=Math.cos(tilt),s=Math.sin(tilt);
  const corners=[[0,0],[1,0],[1,1],[0,1]];
  const rotate=([x,y,z])=>[x,y*c-z*s,y*s+z*c];
  const box=(center,dimensions,panel=false)=>{
    for(const {normal,along,up} of Object.values(side)){
      const first=positions.length/3;
      const lit=panel&&normal[2]!==0;
      normals.push(...Array(4).fill(panel?rotate(normal):normal).flat());
      for(const [u,v] of corners){
        const corner=normal.map((n,i)=>(n+along[i]*(2*u-1)+up[i]*(2*v-1))*dimensions[i]/2);
        const vertex=(panel?rotate(corner):corner).map((value,i)=>value+center[i]);
        positions.push(...vertex);
        vertex.forEach((value,i)=>{min[i]=Math.min(min[i],value);max[i]=Math.max(max[i],value);});
        // In glTF the top edge of an image has v=0.
        uvs.push(...(lit?[(face.x+.5+u*(face.width-1))/atlasWidth,
          (face.y+.5+(1-v)*(face.height-1))/atlasHeight]:[.5,.8]));
      }
      indices.push(first,first+1,first+2,first,first+2,first+3);
    }
  };
  if(deckMounted)for(const x of [-.32,.32])box([x,.029,-.016],[.038,.058,.060]);
  box([0,.173,0],[1,.274,.032],true);
  return {min,max,vertices:positions.length/3,indices:indices.length,buffers:[
    new Float32Array(positions),new Float32Array(normals),new Float32Array(uvs),new Uint16Array(indices),
  ]};
}

export function createGalleryPlaqueBlob(document,lines,deckMounted){
  const png=atlas(document,lines);
  if(!png)return null;
  const geo=geometry(deckMounted);
  const padded=size=>(size+3)&~3;
  let offset=0;
  const segments=[...geo.buffers,png];
  const bufferViews=segments.map((bytes,index)=>{
    const view={buffer:0,byteOffset:offset,byteLength:bytes.byteLength};
    if(index<4)view.target=index===3?34963:34962;
    offset+=padded(bytes.byteLength);
    return view;
  });
  const attribute=(bufferView,type,count,componentType=5126)=>({bufferView,type,count,componentType});
  const gltf={
    asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],
    meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},indices:3,material:0}]}],
    materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0},roughnessFactor:.77,metallicFactor:0},
      emissiveTexture:{index:0},emissiveFactor:[.13,.13,.13]}],
    textures:[{source:0,sampler:0}],samplers:[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}],
    images:[{bufferView:4,mimeType:'image/png'}],buffers:[{byteLength:offset}],bufferViews,
    accessors:[{...attribute(0,'VEC3',geo.vertices),min:geo.min,max:geo.max},
      attribute(1,'VEC3',geo.vertices),attribute(2,'VEC2',geo.vertices),attribute(3,'SCALAR',geo.indices,5123)],
  };
  const json=new TextEncoder().encode(JSON.stringify(gltf));
  const jsonSize=padded(json.length);
  const output=new Uint8Array(28+jsonSize+offset);
  const header=new DataView(output.buffer);
  for(const [position,value] of [[0,0x46546c67],[4,2],[8,output.byteLength],[12,jsonSize],
    [16,0x4e4f534a],[20+jsonSize,offset],[24+jsonSize,0x004e4942]])header.setUint32(position,value,true);
  output.fill(32,20,20+jsonSize);
  output.set(json,20);
  segments.forEach((bytes,index)=>output.set(new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength),
    28+jsonSize+bufferViews[index].byteOffset));
  return new Blob([output],{type:'model/gltf-binary'});
}
