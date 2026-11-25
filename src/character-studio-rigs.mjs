import {AVATARS} from './avatar-registry.mjs';

export const rigs={
  companion:{label:'Navegante',file:AVATARS['compaii-navegante-white-v1'].model},
  humanoid:{label:'Humanoide',file:'assets/avatar-1-bodyA-skin01.glb',clips:{
    idle:'assets/anim_idle.glb',jog:'assets/anim_jog.glb',
    run:'assets/anim_run.glb',air:'assets/anim_air.glb',
  }},
};
