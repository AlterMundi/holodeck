import { Networked3dWebExperienceClient } from '@mml-io/3d-web-experience-client';
const token=window.SESSION_TOKEN;
document.cookie=`holodeck_dev=${token}; SameSite=Strict; Path=/`;
const client=new Networked3dWebExperienceClient(Networked3dWebExperienceClient.createFullscreenHolder(),{
  sessionToken:token,userNetworkAddress:`ws://${location.host}/network`,waitForWorldConfig:true,enableTweakPane:false,postProcessingEnabled:false,
  animationConfig:{airAnimationFileUrl:'/assets/anim_air.glb',idleAnimationFileUrl:'/assets/anim_idle.glb',
    jogAnimationFileUrl:'/assets/anim_jog.glb',sprintAnimationFileUrl:'/assets/anim_run.glb',doubleJumpAnimationFileUrl:'/assets/anim_double_jump.glb'},
  loadingScreen:{title:'Holodeck',subtitle:'Abriendo el taller de las islas',background:'#20464c',color:'#f4e8cd'},
});
client.update();
// Development inspection surface; this build is served only on loopback.
window.holodeckDevelopment={client};
const notice=document.querySelector('#notice');
let state=null,displayedSequence=0,pending=null;
async function api(path,body){
  const response=await fetch(`/api/${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const value=await response.json();if(!response.ok)throw Error(value.message);return value;
}
async function refresh(){
  state=await api('state');displayedSequence=state.sequence;
  const count=client.getCharacterStates().size;
  document.querySelector('#people').textContent=count>1?`${count} exploradores en el taller`:'Explorando el taller';
  document.querySelector('#bridge').textContent=state.entities.bridge.raised?'Separar las islas':'Conectar las islas';
}
async function action(type,target,args,expectedRevision){
  if(pending){notice.textContent='Estoy comprobando la acción anterior.';return;}
  try{
    // Semantic data delivery is not a rendered geometry acknowledgment.
    const observation=await api('observe',{displayedSequence:null});
    pending={id:crypto.randomUUID(),issuedAt:Date.now(),run:observation.run,edition:observation.edition,observation:observation.id,type,target,args,expectedRevision};
    const result=await api('commands',pending);
    notice.textContent=result.status==='completed'?'El cambio ya forma parte del mundo.':'El mundo cambió. Mirá cómo quedó antes de intentar de nuevo.';
    pending=null;await refresh();
  }catch(error){
    notice.textContent='No pude confirmar el cambio. Voy a comprobarlo antes de repetirlo.';
    // Never re-author an uncertain mutation. Retrieve its exact outcome first.
    if(pending)try{const result=await api(`commands/${pending.id}`);notice.textContent=result.status==='completed'?'El cambio quedó confirmado.':'La acción no se completó.';pending=null;}catch{ /* Pending is retained; no automatic replay. */ }
  }
}
document.querySelector('#bridge').onclick=()=>state&&action('bridge.set','bridge',{raised:!state.entities.bridge.raised},state.entities.bridge.revision);
document.querySelector('#plant').onclick=()=>{
  const position=client.getLocalCharacterState()?.position;
  if(position)action('garden.place',`garden-${crypto.randomUUID()}`,{x:Math.max(-7,Math.min(7,position.x+1)),z:Math.max(-6,Math.min(6,position.z)),color:'mint'},null);
};
const interval=setInterval(()=>refresh().catch(()=>{notice.textContent='Se perdió la conexión. Tus acciones no se reenviarán solas.';}),1500);
window.addEventListener('pagehide',()=>{clearInterval(interval);client.dispose();});
refresh().catch(()=>{});
