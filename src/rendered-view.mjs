import {createHash} from 'node:crypto';

export const renderedViewMaxBytes=84*1024;
export const renderedViewLifetimeMs=45*60*1000;
const idPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const maxFrames=40;
const vector=(value,length)=>Array.isArray(value)&&value.length===length&&value.every(Number.isFinite);

export function jpegDimensions(bytes){
  if(bytes.length<4||bytes.readUInt16BE(0)!==0xffd8||bytes.readUInt16BE(bytes.length-2)!==0xffd9)return null;
  let offset=2;
  while(offset+8<bytes.length&&bytes[offset]===0xff){
    const marker=bytes[offset+1],length=bytes.readUInt16BE(offset+2);
    if(length<2||offset+2+length>bytes.length)return null;
    if(marker===0xc0||marker===0xc2){
      if(length<8)return null;
      return {width:bytes.readUInt16BE(offset+7),height:bytes.readUInt16BE(offset+5)};
    }
    if(marker===0xda)break;
    offset+=2+length;
  }
  return null;
}

export function parseRenderedView(value,view){
  const camera=value?.camera;
  if(!camera||!view||!Number.isSafeInteger(value.capturedAt)||!Number.isSafeInteger(view.capturedAt)||
     value.capturedAt<=0||Math.abs(value.capturedAt-view.capturedAt)>1800||
     !vector(camera.position,3)||!vector(camera.rotation,4)||camera.position.some(n=>Math.abs(n)>1e5)||
     Math.abs(Math.hypot(...camera.rotation)-1)>.005||!Number.isFinite(camera.fov)||camera.fov<5||camera.fov>140||
     !Number.isFinite(camera.aspect)||camera.aspect<.12||camera.aspect>12||
     typeof value.jpeg!=='string'||value.jpeg.length>Math.ceil(renderedViewMaxBytes/3)*4||
     !/^[A-Za-z0-9+/]+={0,2}$/.test(value.jpeg))return null;
  const bytes=Buffer.from(value.jpeg,'base64');
  if(bytes.length<64||bytes.length>renderedViewMaxBytes||bytes.toString('base64')!==value.jpeg)return null;
  const dimensions=jpegDimensions(bytes);
  if(!dimensions||dimensions.width<1||dimensions.height<1||Math.max(dimensions.width,dimensions.height)>1024||
     Math.abs(dimensions.width/dimensions.height-camera.aspect)>.12)return null;
  const descriptor={schema:'holodeck.rendered-view/v1',capturedAt:value.capturedAt,mime:'image/jpeg',
    ...dimensions,sha256:createHash('sha256').update(bytes).digest('hex'),
    camera:{position:camera.position,rotation:camera.rotation,fov:camera.fov,aspect:camera.aspect}};
  return {descriptor,jpeg:value.jpeg};
}

export class RenderedViews{
  #frames=new Map();
  trim(now){
    for(const [id,frame] of this.#frames)if(now>=frame.expires)this.#frames.delete(id);
  }
  put({id,human,space,run,frame},now=Date.now()){
    if(!idPattern.test(id)||!frame)return;
    this.trim(now);
    if(this.#frames.has(id))return;
    if(this.#frames.size>=maxFrames)this.#frames.delete(this.#frames.keys().next().value);
    this.#frames.set(id,{human,space,run,...frame,expires:now+renderedViewLifetimeMs});
  }
  read({id,human,space,run},now=Date.now()){
    this.trim(now);
    const frame=this.#frames.get(id);
    if(!frame||frame.human!==human||frame.space!==space||frame.run!==run)return null;
    return {descriptor:frame.descriptor,jpeg:frame.jpeg};
  }
  remove(id,human){
    if(this.#frames.get(id)?.human===human)this.#frames.delete(id);
  }
}
