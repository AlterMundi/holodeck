import {Group, PerspectiveCamera} from 'three';
import {createProyeccion} from 'proyeccion';

export function openBeaconProjection(stage, {host, surface, title, csrf, onReady}){
  const doc=stage.ownerDocument;
  const wrapper=doc.createElement('section');
  wrapper.className='beacon-projection';
  if(surface==='guitar')wrapper.classList.add('is-guitar');
  const viewport=doc.createElement('div');
  viewport.className='beacon-projection-view';
  viewport.tabIndex=-1;
  viewport.inert=true;
  viewport.setAttribute('aria-label','Controles de '+title);
  const feedback=doc.createElement('div');
  feedback.className='beacon-projection-feedback';
  const status=doc.createElement('span');
  status.setAttribute('role','status');
  const retry=doc.createElement('button');
  retry.type='button';
  retry.textContent='Reconectar';
  retry.hidden=true;
  feedback.append(status,retry);
  wrapper.append(viewport,feedback);
  stage.append(wrapper);

  const root='/harmonic_lab/api/a2ui/'+surface;
  const query='?host='+encodeURIComponent(host);
  const parent=new Group();
  const camera=new PerspectiveCamera(45,1,.001,20);
  const lifecycle=new AbortController();
  let stream,view,presented=false,modelVersion,disposeModelPanel;
  const resize=new ResizeObserver(render);
  resize.observe(viewport);

  function render(){
    const {clientWidth:width,clientHeight:height}=viewport;
    if(!view||!width||!height)return;
    camera.aspect=width/height;
    camera.position.z=height*.005/(2*Math.tan(Math.PI/8));
    camera.updateProjectionMatrix();
    view.render(camera);
  }
  function notice(message, offerRetry=false){
    status.textContent=message;
    feedback.hidden=!message;
    retry.hidden=!offerRetry;
  }
  async function send(envelope){
    if(viewport.inert||envelope?.action?.surfaceId!==surface)return;
    try{
      const response=await fetch(root+'/actions'+query,{
        method:'POST',credentials:'same-origin',redirect:'manual',signal:lifecycle.signal,
        headers:{'Content-Type':'application/json','X-Lab-CSRF':csrf},
        body:JSON.stringify(envelope),
      });
      response.body?.cancel().catch(()=>{});
      if(lifecycle.signal.aborted||viewport.inert)return;
      if(response.status===409)notice('El estado del instrumento cambió. Revisá el valor antes de volver a aplicar.');
      else if(!response.ok)notice('No se pudo confirmar el cambio. Revisá el valor actual.');
      else notice('');
    }catch{
      if(!lifecycle.signal.aborted&&!viewport.inert)
        notice('No se pudo confirmar el cambio. Revisá el valor actual.');
    }
  }
  function unavailable(){
    viewport.inert=true;
    notice('Se perdió la conexión con '+title+'.',true);
  }
  async function showGuitarModel(edition){
    if(!edition?.version||modelVersion===edition.version)return;
    modelVersion=edition.version;
    disposeModelPanel?.();
    disposeModelPanel=null;
    try{
      const {mountGuitarModel}=await import('./beacon-guitar-model.mjs');
      if(!lifecycle.signal.aborted&&modelVersion===edition.version)
        disposeModelPanel=mountGuitarModel(wrapper,edition);
    }catch{
      if(!lifecycle.signal.aborted)notice('El modelo 3D no se pudo cargar.');
    }
  }
  function connect(){
    stream?.close();
    viewport.inert=true;
    notice('Conectando con '+title+'…');
    const selected=new EventSource(root+'/events'+query);
    stream=selected;
    selected.onerror=()=>{
      if(stream===selected)unavailable();
    };
    selected.onmessage=event=>{
      if(stream!==selected)return;
      try{
        const messages=JSON.parse(event.data);
        if(!Array.isArray(messages)||!messages.length)throw Error('Missing A2UI messages');
        if(messages[0]?.createSurface?.surfaceId===surface){
          view?.dispose();
          view=createProyeccion({parent,viewport,send,onTransportError:unavailable});
          for(const message of messages)view.receive(message);
          if(!view.hasSurface(surface))throw Error('Missing instrument surface');
          viewport.inert=false;
          if(!presented){presented=true;onReady();}
          notice('');
          if(surface==='guitar')void showGuitarModel(messages[0].createSurface.dataModel?.model);
          render();
        }else if(view&&!viewport.inert){
          for(const message of messages)view.receive(message);
        }else throw Error('Missing initial instrument surface');
      }catch{
        selected.close();
        unavailable();
      }
    };
  }
  retry.onclick=connect;
  connect();
  return {
    contains:event=>event.composedPath().includes(wrapper),
    focus:()=>viewport.focus({preventScroll:true}),
    dispose(){
      lifecycle.abort();
      const previous=stream;
      stream=null;
      previous?.close();
      resize.disconnect();
      view?.dispose();
      disposeModelPanel?.();
      wrapper.remove();
    },
  };
}
