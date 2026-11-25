const preferenceKey='holodeck.hudTheme';
const normalizeTheme=value=>value==='light'?'light':'dark';

export function bindHudAppearance(document,window){
  const selector=document.getElementById('hud-theme-choice');
  const apply=value=>{
    const theme=normalizeTheme(value);
    document.body.dataset.hudTheme=theme;
    if(selector)selector.value=theme;
  };
  const load=()=>{
    try{apply(window.localStorage.getItem(preferenceKey));}catch{}
  };
  apply('dark');
  load();
  selector?.addEventListener('change',()=>{
    apply(selector.value);
    try{window.localStorage.setItem(preferenceKey,selector.value);}catch{}
  });
  window.addEventListener('pageshow',event=>{if(event.persisted)load();});
  window.addEventListener('storage',event=>{
    if(event.key!==null&&event.key!==preferenceKey)return;
    try{if(event.storageArea!==window.localStorage)return;}catch{return;}
    apply(event.newValue);
  });
}

export function hudAppearanceKey(document){
  const {hudTheme,hudLook,roomLook}=document.body.dataset;
  return [hudTheme,hudLook,roomLook].join(':');
}

export function readHudAppearance(document){
  const {hudTheme,hudLook,roomLook}=document.body.dataset;
  const light=hudTheme==='light';
  const style=document.defaultView.getComputedStyle(document.body);
  const color=name=>style.getPropertyValue(name).trim();
  const preview=Boolean(hudLook&&!light);
  const controls=light?'--hud-control':'--control-fill';
  const pressed=light?'--hud-pressed':'--control-hover';
  return {
    palette:{
      background:color(preview?'--panel':'--hud-panel'),
      button:color(controls)||color('--hud-control'),
      pressed:color(pressed)||color('--hud-pressed'),
      text:color(!light&&(preview||roomLook)?'--ink':'--hud-ink'),
      focus:color(preview?'--gold':'--hud-brass'),
      ...(!preview&&{disabled:color('--hud-disabled')}),
    },
    defaultWorldPalette:!light&&hudLook==='taller'&&!roomLook,
    edge:color(light?'--hud-rim':'--gold'),
    glass:{fill:color('--hud-glass'),rim:color('--hud-rim'),brass:color('--hud-brass')},
    frame:light?color('--hud-frame'):preview&&color('--control-fill')?color('--control-fill'):roomLook==='amber'?'#342322':'#12262d',
    frameOpacity:preview&&['orbita','umbral'].includes(hudLook)?.89:1,
  };
}
