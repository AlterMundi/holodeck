import {showSettingsDialog} from './settings-hud.mjs';

export function bindVideoSettings({document,window,lightweight,onGraphics,onSensitivity,onFullscreenError}){
  const dialog=document.querySelector('#video-dialog');
  const open=document.querySelector('#video-open');
  const close=document.querySelector('#video-close');
  const toggle=document.querySelector('#video-fullscreen');
  const quality=document.querySelector('#video-quality');
  const mouse=document.querySelector('#mouse-sensitivity');
  const mouseValue=document.querySelector('#mouse-sensitivity-value');
  const status=document.querySelector('#video-status');
  const root=document.documentElement;
  const available=()=>document.fullscreenEnabled&&typeof root.requestFullscreen==='function';
  const keyboard=window.navigator?.keyboard;
  let changing=false,requestedMovementLock=false;

  function releaseMovementLock(){
    if(!requestedMovementLock)return;
    requestedMovementLock=false;
    keyboard.unlock?.();
  }

  async function lockMovementKey(){
    if(typeof keyboard?.lock!=='function'||document.fullscreenElement!==root)return;
    requestedMovementLock=true;
    try{
      await keyboard.lock(['KeyW']);
      if(document.fullscreenElement!==root)keyboard.unlock?.();
    }catch{
      // The world also has a sprint key that needs no browser permission.
    }
  }

  function syncFullscreen(){
    const active=!!document.fullscreenElement;
    if(document.fullscreenElement!==root)releaseMovementLock();
    toggle.textContent=active?'Salir de pantalla completa':'Pantalla completa';
    toggle.setAttribute('aria-pressed',String(active));
    toggle.disabled=changing||!available();
  }

  async function switchFullscreen(){
    if(changing||!available())return;
    changing=true;
    status.textContent='';
    syncFullscreen();
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else{
        await root.requestFullscreen();
        void lockMovementKey();
      }
    }catch{
      status.textContent='No se pudo cambiar la pantalla completa.';
      if(!onFullscreenError?.(status.textContent))showSettingsDialog(dialog);
    }finally{
      changing=false;
      syncFullscreen();
    }
  }

  if(mouse){
    try{
      const saved=window.localStorage.getItem('holodeck.mouseSensitivity');
      if(saved!==null)mouse.value=saved;
    }catch{}
    const sync=()=>{
      const value=mouse.valueAsNumber;
      mouseValue.textContent=value+' %';
      onSensitivity?.(value/100);
      try{window.localStorage.setItem('holodeck.mouseSensitivity',String(value));}catch{}
    };
    mouse.oninput=sync;
    sync();
  }
  quality.value=lightweight?'light':'auto';
  quality.onchange=()=>onGraphics(quality.value==='light');
  open.onclick=()=>{showSettingsDialog(dialog);};
  close.onclick=()=>dialog.close();
  toggle.onclick=()=>void switchFullscreen();
  document.addEventListener('fullscreenchange',syncFullscreen);
  window.addEventListener('pagehide',releaseMovementLock);
  window.addEventListener('keydown',event=>{
    const shortcut=event.code==='KeyF'&&event.ctrlKey&&event.altKey&&!event.metaKey&&!event.shiftKey&&
      !event.getModifierState('AltGraph')&&!event.target?.closest?.('input,textarea,[contenteditable]');
    const f11=event.key==='F11'&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.shiftKey;
    if((shortcut||f11)&&!event.repeat&&event.cancelable&&available()){
      event.preventDefault();
      event.stopImmediatePropagation();
      void switchFullscreen();
    }else if(dialog.open&&!dialog.hasAttribute('data-native-settings'))event.stopImmediatePropagation();
  },true);
  if(!available())status.textContent='La pantalla completa no está disponible en este navegador.';
  syncFullscreen();
}
