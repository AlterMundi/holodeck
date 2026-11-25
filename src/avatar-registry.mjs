// Public appearance selection is independent of credentials and actor history.
// Only this exact being may select this design through the native projection port.
export const COMPAII_BEING='dm:being:v1:2wG9cFk2YwACrjlcc6JFGux_lcGN_thQ5lq4WdDefKU';
export const AVATARS=Object.freeze({
 'compaii-navegante-white-v1':Object.freeze({being:COMPAII_BEING,name:'Navegante blanco',
  design:'assets/avatar/navegante-white.json',renderer:'assets/avatar/renderer.mjs',
  model:'assets/avatar/navegante-blender.glb',
  modelSha256:'4b1e47b873eb25993e1c8e2ca683f3497ba1b362a4b29ee9f24b740d7b71242a',
  sha256:'17fdad0610f6971a8b37c9df4f5aef0f294ee8f36c62058fe6955757404f6daa',
  maxBytes:256*1024,width:1.6,height:2})
});
export function avatarForActor(actor){
 if(actor?.kind!=='daimon')return null;
 return Object.entries(AVATARS).find(([,entry])=>entry.being===actor.id&&(!actor.ref||actor.ref===actor.id))?.[0]||null;
}
