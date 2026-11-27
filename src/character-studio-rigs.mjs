import {AVATARS} from './avatar-registry.mjs';

export const rigs={
  companion:{label:'Navegante',file:AVATARS['compaii-navegante-white-v1'].model},
  humanoid:{label:'Humanoide',file:'assets/avatar-1-bodyA-skin01.glb',clips:{
    idle:'assets/anim_idle.glb',jog:'assets/anim_jog.glb',
    run:'assets/anim_run.glb',air:'assets/anim_air.glb',
  }},
};
// Nicolás's Explorer keeps the stock humanoid skeleton, so the shared stock
// clips and motion studies apply; its own authored hero clips come first.
// Same file as human-avatars.mjs personalAvatarFile (that module is server-only).
rigs.explorer={label:'Explorador',file:'assets/avatar/explorer-hero-v29.glb',clips:rigs.humanoid.clips,initial:'hero_idle'};
