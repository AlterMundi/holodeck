const idPart = value => typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);
export const takeFormats = ['mp4','mkv'];

export function preparedDownloadUrl(root,query,take,format){
  if(!takeFormats.includes(format)||!take||![take.sessionId,take.exportId,take[format]].every(idPart))return '';
  return `${root}/take/${take.sessionId}/${take.exportId}/${take[format]}/${format}${query()}`;
}

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
  const downloads=doc.createElement('nav');
  downloads.hidden=true;
  downloads.setAttribute('aria-label','Descargas de la toma preparada');
  wrapper.prepend(preview,downloads);

  const player=bindHarMoCAPPreview(video,root,query,{
    visible(value){
      preview.hidden=!value;
      wrapper.classList.toggle('has-video-preview',value);
    },
    notice(text){status.textContent=text;},
    prepared(take){
      downloads.replaceChildren();
      for(const format of takeFormats){
        const url=preparedDownloadUrl(root,query,take,format);
        if(!url)continue;
        const link=doc.createElement('a');
        link.href=url;
        link.download='';
        link.textContent='Descargar '+format.toUpperCase();
        downloads.append(link,' ');
      }
      downloads.hidden=!downloads.children.length;
    },
  });
  return {...player,dispose(){player.dispose();preview.remove();downloads.remove();}};
}

export function bindHarMoCAPPreview(video,root,query,{visible,notice,prepared:showPrepared}){
  let source='', target=null, epoch=null, pending=false;
  let tracking=null, prepared=null, reviewing=false;
  function takeUrl(take){
    return take&&[take.sessionId,take.exportId,take.mp4].every(idPart)
      ?`${root}/preview/${take.sessionId}/${take.exportId}/${take.mp4}${query()}`:'';
  }
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
          notice('El navegador no pudo reproducir este video.');
      }).finally(()=>{
        pending=false;
        if(source===selected&&!target?.playing)video.pause();
        if(source!==selected&&!reviewing)sync();
      });
    }
  }
  function present(url){
    if(url===source)return;
    source=url;
    epoch=null;
    visible(!!source);
    notice('');
    video.pause();
    if(url)video.src=url;
    else video.removeAttribute('src');
    video.load();
  }
  function show(next){
    const valid=next&&[next.sessionId,next.jobId,next.generation].every(idPart)&&
      typeof next.playing==='boolean'&&Number.isFinite(next.position)&&Number.isInteger(next.epoch);
    target=valid?next:null;
    const url=valid?`${root}/preview/${next.sessionId}/${next.jobId}/${next.generation}${query()}`:'';
    video.muted=true;
    present(url);
    sync();
  }
  function observeTake(next){
    if(takeFormats.some(format=>preparedDownloadUrl(root,query,next,format)!==preparedDownloadUrl(root,query,prepared,format)))
      showPrepared?.(next);
    if(reviewing&&takeUrl(next)!==takeUrl(prepared)){
      reviewing=false;
      show(tracking);
    }
    prepared=next;
  }
  video.onloadedmetadata=sync;
  video.onseeked=sync;
  video.onerror=()=>{
    if(source&&video.error)notice('El video no está disponible en esta mesa.');
  };
  return {
    receive(messages){
      for(const message of messages){
        const initial=message.createSurface?.dataModel;
        const update=message.updateDataModel;
        const root=initial??(update?.path==='/'?update.value:undefined);
        if(root){
          tracking=root.videoPreview;
          observeTake(root.preparedTake);
        }
        if(update?.path==='/preparedTake')observeTake(update.value);
        if(update?.path==='/videoPreview')tracking=update.value;
        if(!reviewing)show(tracking);
      }
    },
    review(take){
      const url=takeUrl(take);
      if(!url||url!==takeUrl(prepared))return;
      if(reviewing){
        reviewing=false;
        show(tracking);
        return;
      }
      reviewing=true;
      target=null;
      video.muted=false;
      present(url);
      void video.play().catch(error=>{
        if(reviewing&&source===url&&error.name!=='AbortError')
          notice('No se pudo reproducir la toma.');
      });
    },
    clear(){
      reviewing=false;
      prepared=tracking=null;
      showPrepared?.(null);
      show(null);
    },
    dispose(){
      this.clear();
      video.onloadedmetadata=video.onseeked=video.onerror=null;
    },
  };
}
