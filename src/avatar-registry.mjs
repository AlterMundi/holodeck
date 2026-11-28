// Public appearance selection is independent of credentials and actor history.
// Only this exact being may select this design through the native projection port.
export const COMPAII_BEING='dm:being:v1:2wG9cFk2YwACrjlcc6JFGux_lcGN_thQ5lq4WdDefKU';
export const AVATARS=Object.freeze({
 'compaii-navegante-white-v1':Object.freeze({being:COMPAII_BEING,name:'Navegante blanco',
  design:'assets/avatar/navegante-white.json',renderer:'assets/avatar/renderer.mjs',
  model:'assets/avatar/navegante-blender.glb',
  modelSha256:'c36dbff08607a830089f450010dd1f0ee15b7991334e4fcda64cb04d316b548b',
  sha256:'17fdad0610f6971a8b37c9df4f5aef0f294ee8f36c62058fe6955757404f6daa',
  maxBytes:256*1024,width:1.6,height:2})
});
export function avatarForActor(actor){
 if(actor?.kind!=='daimon')return null;
 return Object.entries(AVATARS).find(([,entry])=>entry.being===actor.id&&(!actor.ref||actor.ref===actor.id))?.[0]||null;
}

// CompAII's alternative Navegante bodies. The companion wears the
// 'compaii-navegante-white-v1' model above; these are kept as options and can
// be examined in the Character Studio. To wear one in the world, point that
// entry's model and modelSha256 at it (no in-game switch, by Nicolás's choice).
export const NAVEGANTE_VARIANTS=Object.freeze({
 n3x:Object.freeze({label:'Navegante N-3X',model:'assets/avatar/navegante-blender.glb',modelSha256:AVATARS['compaii-navegante-white-v1'].modelSha256}),
 escafandra:Object.freeze({label:'Navegante escafandra',model:'assets/avatar/navegante-escafandra.glb',modelSha256:'30ebd3ca5113b9083e476da5d9ee68146ec06fa2d29bb0ff0950dd5e3973d0ba'}),
 bronce:Object.freeze({label:'Navegante bronce',model:'assets/avatar/navegante-bronce.glb',modelSha256:'4fcc9fd771c43f42e71c87db60f464a2c6e142d203af0dd4f6bbef53ba07305d'}),
});
