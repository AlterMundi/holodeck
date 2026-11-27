const maximumEdge=1024;
const frameTimeout=1250;
const maximumBytes=84*1024;
const qualities=[.79,.59,.41,.28];

// Read the world's own rendered frame before WebGL clears its buffer.
// Browser UI and separate document surfaces are never copied.
export class WorldViewCapture{
  constructor(document){this.document=document;}

  request(){
    if(this.pending)return Promise.resolve(null);
    return new Promise(resolve=>{
      const timer=setTimeout(()=>this.cancel(),frameTimeout);
      this.pending={resolve,timer};
    });
  }

  present(source,camera){
    const pending=this.pending;
    if(!pending||!source.width||!source.height||!camera?.isPerspectiveCamera)return;
    this.pending=null;
    clearTimeout(pending.timer);
    const copy=this.document.createElement('canvas');
    const scale=Math.min(1,maximumEdge/Math.max(source.width,source.height));
    copy.width=Math.max(1,Math.round(source.width*scale));
    copy.height=Math.max(1,Math.round(source.height*scale));
    const cameraState={position:camera.position.toArray(),rotation:camera.quaternion.toArray(),
      fov:camera.getEffectiveFOV(),aspect:copy.width/copy.height};
    const capturedAt=Date.now();
    const finish=value=>{copy.width=0;pending.resolve(value);};
    try{
      copy.getContext('2d').drawImage(source,0,0,copy.width,copy.height);
      const encode=index=>{
        copy.toBlob(async blob=>{
          if(blob?.size>maximumBytes&&index+1<qualities.length){encode(index+1);return;}
          if(!blob?.size||blob.size>maximumBytes){finish(null);return;}
          try{
            const data=new Uint8Array(await blob.arrayBuffer());
            let binary='';
            for(const byte of data)binary+=String.fromCharCode(byte);
            finish({capturedAt,camera:cameraState,jpeg:btoa(binary)});
          }catch{finish(null);}
        },'image/jpeg',qualities[index]);
      };
      encode(0);
    }catch{finish(null);}
  }

  cancel(){
    if(!this.pending)return;
    const {timer,resolve}=this.pending;
    this.pending=null;
    clearTimeout(timer);
    resolve(null);
  }
}
