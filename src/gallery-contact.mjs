import {DataTexture,LinearFilter,Mesh,MeshBasicMaterial,PlaneGeometry,Vector3} from 'three';

const resolution=64;
const texelVisits=2*1024*1024;
const edgePadding=3;

// Project just the low part of the miniature onto its display deck. The
// small, fixed grid bounds the work. Widely separated supports keep visibly separate shadows.
export function gallerySurface(mesh){
  const {index,attributes:{position},drawRange}=mesh.geometry;
  const start=drawRange.start;
  const end=Math.min(start+drawRange.count,index?.count??position.count);
  return {
    start,end,
    point:(target,i)=>mesh.getVertexPosition(index?index.getX(i):i,target).applyMatrix4(mesh.matrixWorld),
  };
}

function supportMask(surfaces,scale,center,bottom,width,depth,band){
  const mask=new Uint8Array(resolution*resolution);
  const a=new Vector3(),b=new Vector3(),c=new Vector3();
  let visits=0;
  const grid=(value,span)=>(value/span+.5)*resolution-.5;
  const write=(x,y)=>{
    if(x>=edgePadding&&x<resolution-edgePadding&&y>=edgePadding&&y<resolution-edgePadding)
      mask[y*resolution+x]=1;
  };
  for(const {start,end,point} of surfaces){
    for(let i=start;i+2<end;i+=3){
      point(a,i).sub(center).multiplyScalar(scale);
      point(b,i+1).sub(center).multiplyScalar(scale);
      point(c,i+2).sub(center).multiplyScalar(scale);
      if(Math.min(a.y,b.y,c.y)-bottom>band)continue;
      const ax=grid(a.x,width),ay=grid(-a.z,depth),bx=grid(b.x,width),by=grid(-b.z,depth);
      const cx=grid(c.x,width),cy=grid(-c.z,depth);
      if(a.y-bottom<=band)write(Math.round(ax),Math.round(ay));
      if(b.y-bottom<=band)write(Math.round(bx),Math.round(by));
      if(c.y-bottom<=band)write(Math.round(cx),Math.round(cy));
      const determinant=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
      if(Math.abs(determinant)<1e-6)continue;
      const left=Math.max(edgePadding,Math.ceil(Math.min(ax,bx,cx)));
      const right=Math.min(resolution-edgePadding-1,Math.floor(Math.max(ax,bx,cx)));
      const top=Math.max(edgePadding,Math.ceil(Math.min(ay,by,cy)));
      const bottomRow=Math.min(resolution-edgePadding-1,Math.floor(Math.max(ay,by,cy)));
      const candidates=(right-left+1)*(bottomRow-top+1);
      if(right<left||bottomRow<top||visits+candidates>texelVisits)continue;
      visits+=candidates;
      for(let y=top;y<=bottomRow;y++)for(let x=left;x<=right;x++){
        const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/determinant;
        const v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/determinant;
        const weight=1-u-v;
        if(u>=0&&v>=0&&weight>=0&&u*a.y+v*b.y+weight*c.y-bottom<=band)write(x,y);
      }
    }
  }
  return mask;
}

function soften(mask){
  const rgba=new Uint8Array(resolution*resolution*4);
  for(let y=1;y<resolution-1;y++)for(let x=1;x<resolution-1;x++){
    let shade=0;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      if(x+dx<0||x+dx>=resolution||y+dy<0||y+dy>=resolution)continue;
      const distance=dx*dx+dy*dy;
      if(mask[(y+dy)*resolution+x+dx])shade=Math.max(shade,1-distance/9);
    }
    rgba[(y*resolution+x)*4+3]=Math.round(65*shade);
  }
  return rgba;
}

export function galleryContact(surfaces,scale,center,bounds,plinth,{width,depth}){
  // The card spans only the display, with room inside the smallest oak deck
  // for the contact penumbra. The miniature itself keeps its existing fit.
  const span={width:width+.16,depth:depth+.14};
  const mask=supportMask(surfaces,scale,center,(bounds.min.y-center.y)*scale,
    span.width,span.depth,Math.min(.052,(bounds.max.y-bounds.min.y)*scale*.24));
  const map=new DataTexture(soften(mask),resolution,resolution);
  map.magFilter=map.minFilter=LinearFilter;
  map.needsUpdate=true;
  const contact=new Mesh(new PlaneGeometry(span.width,span.depth),new MeshBasicMaterial({
    map,transparent:true,depthWrite:false,toneMapped:false,
  }));
  contact.rotation.x=-Math.PI/2;
  contact.position.set(plinth.x,plinth.y+.0015,plinth.z);
  contact.name='gallery-plinth-contact';
  contact.raycast=()=>{};
  return contact;
}
