const idPart = value => typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);

export function mountHarMoCAPPreview(wrapper, root, query){
  const doc=wrapper.ownerDocument;
  const preview=doc.createElement('aside');
  preview.className='beacon-video-preview';
  preview.hidden=true;
  preview.setAttribute('aria-label','Vista previa del video');
  const video=doc.createElement('video');
  video.muted=true;
  video.playsInline=true;
  video.preload='metadata';
  video.setAttribute('aria-label','Video de seguimiento');
  const status=doc.createElement('p');
  status.setAttribute('role','status');
  preview.append(video,status);
  wrapper.prepend(preview);

  let source='', target=null, epoch=null, pending=false;
  function sync(){
    if(!target||!source||video.readyState<1)return;
    if(!target.playing)video.pause();
    const offset=target.position-video.currentTime;
    const discontinuity=target.epoch!==epoch;
    if(!video.seeking&&(discontinuity||Math.abs(offset)>(target.playing?1:.05))){
      video.currentTime=Math.max(0,Math.min(target.position,video.duration));
      epoch=target.epoch;
    }
    if(target.playing&&video.paused&&!pending){
      pending=true;
      const selected=source;
      void video.play().catch(error=>{
        if(source===selected&&error.name!=='AbortError')
          status.textContent='El navegador no pudo reproducir este video.';
      }).finally(()=>{
        pending=false;
        if(!target?.playing)video.pause();
      });
    }
  }
  function show(next){
    const visible=next&&[next.sessionId,next.jobId,next.generation].every(idPart)&&
      typeof next.playing==='boolean'&&Number.isFinite(next.position)&&Number.isInteger(next.epoch);
    target=visible?next:null;
    const url=visible?`${root}/preview/${next.sessionId}/${next.jobId}/${next.generation}${query()}`:'';
    if(url!==source){
      source=url;
      epoch=null;
      preview.hidden=!source;
      wrapper.classList.toggle('has-video-preview',!!source);
      status.textContent='';
      video.pause();
      if(url)video.src=url;
      else video.removeAttribute('src');
      video.load();
    }
    sync();
  }
  video.onloadedmetadata=sync;
  video.onseeked=sync;
  video.onerror=()=>{
    if(source&&video.error)status.textContent='El video no está disponible en esta mesa.';
  };
  return {
    receive(messages){
      for(const message of messages){
        if(message.createSurface)show(message.createSurface.dataModel?.videoPreview);
        const update=message.updateDataModel;
        if(update?.path==='/')show(update.value?.videoPreview);
        if(update?.path==='/videoPreview')show(update.value);
      }
    },
    clear:()=>show(null),
    dispose(){
      show(null);
      preview.remove();
    },
  };
}
