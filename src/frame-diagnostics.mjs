const average=(samples,key)=>samples.reduce((sum,sample)=>sum+sample[key],0)/samples.length;
const mb=bytes=>Number.isFinite(bytes)&&bytes>0?(bytes/1024**2).toFixed(1)+' MiB':'—';

export class FrameDiagnostics {
  constructor(webgl,base){
    this.webgl=webgl;
    this.base=base;
    this.samples=[];
  }

  setMode(mode){
    if(mode===this.mode)return;
    this.mode=mode;
    if(mode){
      this.resetWindow();
      if(!this.packageBytes&&!this.releaseRequest){
        this.releaseRequest=fetch(new URL('release-status',this.base),{signal:AbortSignal.timeout(5000)})
          .then(response=>response.ok?response.json():null)
          .then(status=>{this.packageBytes=status?.packageBytes;}).catch(()=>{})
          .finally(()=>{this.releaseRequest=null;});
      }
    }
    if(mode!=='detail')this.releaseGpu();
  }

  releaseGpu(){
    if(this.query)this.gl.deleteQuery(this.query);
    this.query=null;
    this.gpuMs=null;
    this.nextGpu=0;
  }

  resetWindow(){
    this.samples.length=0;
    this.frame=this.pending=null;
    this.refreshAt=0;
  }

  begin(now){
    if(!this.mode)return;
    if(this.pending){
      const elapsed=now-this.pending.at;
      if(elapsed>0)this.samples.push({...this.pending,at:now,elapsed});
      while(this.samples.length&&(this.samples.length>180||this.samples[0].at<now-2500))this.samples.shift();
      this.pending=null;
    }
    this.frame={at:now,world:0,post:0,hud:0};
  }

  beginWorld(){
    if(!this.frame)return;
    const {info}=this.webgl;
    this.autoReset=info.autoReset;
    info.reset();
    info.autoReset=false;
    if(this.mode!=='detail')return;
    this.gl??=this.webgl.getContext();
    const gl=this.gl;
    if(this.gpu===undefined)this.gpu=gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const ext=this.gpu;
    if(!ext||gl.isContextLost())return;
    if(gl.getParameter(ext.GPU_DISJOINT_EXT))this.releaseGpu();
    if(this.query&&gl.getQueryParameter(this.query,gl.QUERY_RESULT_AVAILABLE)){
      this.gpuMs=gl.getQueryParameter(this.query,gl.QUERY_RESULT)/1e6;
      gl.deleteQuery(this.query);
      this.query=null;
    }
    if(this.query||this.frame.at<this.nextGpu||gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))return;
    this.query=gl.createQuery();
    if(!this.query)return;
    gl.beginQuery(ext.TIME_ELAPSED_EXT,this.query);
    this.timingGpu=true;
    this.nextGpu=this.frame.at+300;
  }

  endWorld(start){
    const {info}=this.webgl;
    if(this.timingGpu){
      this.gl.endQuery(this.gpu.TIME_ELAPSED_EXT);
      this.timingGpu=false;
    }
    this.calls=info.render.calls;
    this.triangles=info.render.triangles;
    info.autoReset=this.autoReset;
    this.frame.world+=performance.now()-start;
  }

  end(){
    if(!this.frame)return;
    const {at,world,hud,post}=this.frame;
    this.frame=null;
    const update=Math.max(0,performance.now()-at-world-hud);
    this.pending={at,update,world:Math.max(0,world-post),hud,post};
  }

  snapshot(now=performance.now()){
    if(now<this.refreshAt)return this.data;
    this.refreshAt=now+1000;
    const rows=this.samples;
    const heap=performance.memory?.usedJSHeapSize;
    if(Number.isFinite(heap))this.peak=Math.max(heap,this.peak??0);
    const divisor=rows.length?average(rows,'elapsed'):0;
    const percent=key=>divisor?Math.round(100*average(rows,key)/divisor):0;
    const totals=['update','world','post','hud'].map(percent);
    const sorted=rows.map(row=>row.elapsed).sort((a,b)=>a-b);
    const p95=sorted[Math.ceil(sorted.length*.95)-1];
    return this.data={
      speed:divisor?`${Math.round(1000/divisor)} FPS · p95 ${p95.toFixed(0)} ms`:'Midiendo…',
      memory:Number.isFinite(heap)?`Memoria JS ${mb(heap)} · pico ${mb(this.peak)}`:'Memoria JS no disponible',
      phases:`Actualización ${totals[0]}% · Render ${totals[1]}% · Efectos ${totals[2]}%`,
      overhead:`HUD ${totals[3]}% · Tiempo sin atribuir ${Math.max(0,100-totals.reduce((a,b)=>a+b,0))}%`,
      graphics:`${this.webgl.domElement.width} × ${this.webgl.domElement.height} · GPU ${this.gpuMs==null?'—':this.gpuMs.toFixed(1)+' ms'}`,
      scene:`${this.calls??'—'} llamadas · ${this.triangles?.toLocaleString('es-AR')??'—'} triángulos`,
      package:`Paquete ${mb(this.packageBytes)}`,
    };
  }
}
