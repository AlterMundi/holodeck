const maximumEdge=1440;
const frameTimeout=1600;

// Copy the existing render during its own frame, before the browser clears
// the WebGL drawing buffer. The screenshot does not include DOM or HUD layers.
export class WorldViewCapture{
  constructor(document){
    this.document=document;
  }

  request(){
    if(this.pending)throw Error('Ya hay una vista en preparación.');
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>this.cancel(),frameTimeout);
      this.pending={resolve,reject,timer};
    });
  }

  present(source){
    const pending=this.pending;
    if(!pending||!source.width||!source.height)return;
    this.pending=null;
    clearTimeout(pending.timer);
    const copy=this.document.createElement('canvas');
    const scale=Math.min(1,maximumEdge/Math.max(source.width,source.height));
    copy.width=Math.max(1,Math.round(source.width*scale));
    copy.height=Math.max(1,Math.round(source.height*scale));
    try{
      copy.getContext('2d').drawImage(source,0,0,copy.width,copy.height);
      copy.toBlob(blob=>{
        const width=copy.width,height=copy.height;
        copy.width=0;
        if(blob?.size)pending.resolve({blob,width,height});
        else pending.reject(Error('No pude preparar la vista. Probá de nuevo.'));
      },'image/png');
    }catch{
      pending.reject(Error('No pude preparar la vista. Probá de nuevo.'));
    }
  }

  cancel(){
    if(!this.pending)return;
    const {timer,reject}=this.pending;
    this.pending=null;
    clearTimeout(timer);
    reject(Error('Esperá a que termine de cargar la escena.'));
  }
}
