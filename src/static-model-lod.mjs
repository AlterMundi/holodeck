import {
  Box3,BufferGeometry,Color,DoubleSide,Float32BufferAttribute,Group,Mesh,MeshLambertMaterial,Vector3,
} from 'three';

export function wantsDetailedModel({anchor,diameter,distance,camera,pixels,near}){
  if(distance<=2)return true;
  if(!camera?.position||!camera.fov||!pixels)return distance<=(near?5.8:4.8);
  const eye=camera.position;
  const meters=Math.hypot(eye.x-anchor.x,eye.y-anchor.y,eye.z-anchor.z);
  const size=pixels*diameter/(2*Math.max(.1,meters)*Math.tan(camera.fov*Math.PI/360));
  return size>=(near?53:64);
}

function clusteredSurface(detail,resolution){
  const meshes=[];
  const bounds=new Box3();
  detail.updateMatrixWorld(true);
  detail.traverseVisible(node=>{
    if(!node.isMesh||!node.geometry.index||!node.geometry.attributes.position)return;
    node.geometry.computeBoundingBox();
    bounds.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
    meshes.push(node);
  });
  if(bounds.isEmpty())return null;
  const size=bounds.getSize(new Vector3());
  const span=Math.max(size.x,size.y,size.z);
  if(!span)return null;
  const cells=new Vector3(
    Math.max(2,Math.round(resolution*size.x/span)),
    Math.max(2,Math.round(resolution*size.y/span)),
    Math.max(2,Math.round(resolution*size.z/span)),
  );
  const scale=new Vector3(cells.x/(size.x||1),cells.y/(size.y||1),cells.z/(size.z||1));
  const point=new Vector3(),color=new Color(),vertexColor=new Color(),white=new Color(1,1,1);
  const vertices=[],lookup=new Map(),indices=[],faces=new Set();
  for(const mesh of meshes){
    const {geometry,material,matrixWorld}=mesh;
    const positions=geometry.attributes.position, colors=geometry.attributes.color;
    const slots=Array.isArray(material)?material:[material];
    const groups=geometry.groups.length?geometry.groups:[{start:0,count:geometry.index.count,materialIndex:0}];
    for(const {start,count,materialIndex} of groups){
      const tint=slots[materialIndex]?.color??white;
      const cache=new Map();
      const pointIndex=index=>{
        if(cache.has(index))return cache.get(index);
        point.fromBufferAttribute(positions,index).applyMatrix4(matrixWorld);
        const x=Math.round((point.x-bounds.min.x)*scale.x);
        const y=Math.round((point.y-bounds.min.y)*scale.y);
        const z=Math.round((point.z-bounds.min.z)*scale.z);
        const key=(x*(cells.y+1)+y)*(cells.z+1)+z;
        let cluster=lookup.get(key);
        if(cluster===undefined){
          cluster=vertices.length;
          lookup.set(key,cluster);
          vertices.push({position:new Vector3(),rgb:new Vector3(),count:0});
        }
        const vertex=vertices[cluster];
        color.copy(tint);
        if(colors)color.multiply(vertexColor.fromBufferAttribute(colors,index));
        vertex.position.add(point);
        vertex.rgb.x+=color.r;vertex.rgb.y+=color.g;vertex.rgb.z+=color.b;
        vertex.count++;
        cache.set(index,cluster);
        return cluster;
      };
      const end=Math.min(start+count,geometry.index.count);
      for(let i=start;i+2<end;i+=3){
        const a=pointIndex(geometry.index.getX(i));
        const b=pointIndex(geometry.index.getX(i+1));
        const c=pointIndex(geometry.index.getX(i+2));
        if(a===b||b===c||a===c)continue;
        const key=[a,b,c].sort((x,y)=>x-y).join(':');
        if(faces.has(key))continue;
        faces.add(key);indices.push(a,b,c);
      }
    }
  }
  if(!indices.length)return null;
  const offsets=[],rgb=[];
  for(const vertex of vertices){
    offsets.push(...vertex.position.divideScalar(vertex.count).toArray());
    rgb.push(...vertex.rgb.divideScalar(vertex.count).toArray());
  }
  const surface=new BufferGeometry();
  surface.setAttribute('position',new Float32BufferAttribute(offsets,3));
  surface.setAttribute('color',new Float32BufferAttribute(rgb,3));
  surface.setIndex(indices);
  surface.computeVertexNormals();
  return surface;
}

// For capped, static representatives. The full mesh stays attached and retains
// its materials and picking identity. Distances select a visible representation.
export function staticModelLevels(detail,near=false){
  let count=0;
  detail.traverseVisible(node=>{if(node.isMesh)count+=(node.geometry.index?.count??0)/3;});
  const group=new Group();
  group.add(detail);
  let surface=null;
  if(count>600){
    for(const resolution of [10,7,5]){
      const candidate=clusteredSurface(detail,resolution);
      if(!candidate)continue;
      surface?.dispose();
      surface=candidate;
      if(candidate.index.count/3<=640)break;
    }
  }
  let low;
  if(surface&&surface.index.count/3<count){
    low=new Mesh(surface,new MeshLambertMaterial({vertexColors:true,side:DoubleSide}));
    low.name='simplified-representative';
    low.receiveShadow=true;
    group.add(low);
  }else surface?.dispose();
  const levels={group,setNear(value){
    near=!!value;
    if(!low)return;
    detail.visible=near;
    low.visible=!near;
  },low,detail,get near(){return near;}};
  levels.setNear(near);
  return levels;
}
