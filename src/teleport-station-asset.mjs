import {AnimationMixer,LoopOnce,LoopRepeat,Vector3} from 'three';

// Char Design's teleport station (Alternative 3). The asset owns form,
// materials and named anchors; Holodeck owns A2UI controls, permissions,
// destination data and travel. See art/teleport-station/README.md.
export const TELEPORT_STATION_ASSET='teleport/teleport-station.glb';
export const TELEPORT_MINIATURES_ASSET='teleport/teleport-miniatures.glb';
export const TELEPORT_NODE_COUNT=4;
export const TELEPORT_CLIPS=Object.freeze({deploy:'tp_deploy',idle:'tp_idle',travel:'tp_travel'});
export const TELEPORT_MINIATURE_KINDS=Object.freeze(['plaza','house','residence','room','table']);

const required=['tp_station','tp_center','tp_parent','tp_travel_carriage','tp_travel_slot',
  'tp_travel_button','tp_travel_beam','tp_travel_beam_rings',
  ...Array.from({length:TELEPORT_NODE_COUNT},(_,i)=>`tp_node_${i}`)];

// Resolve the named parts of a loaded station scene. Missing names fail closed.
export function stationParts(scene){
  const found={};
  for(const name of required){
    const object=scene.getObjectByName(name);
    if(!object)throw Error('Teleport station asset lacks '+name);
    found[name]=object;
  }
  return {
    root:found.tp_station,center:found.tp_center,parent:found.tp_parent,
    nodes:Array.from({length:TELEPORT_NODE_COUNT},(_,i)=>found[`tp_node_${i}`]),
    threads:Array.from({length:TELEPORT_NODE_COUNT},(_,i)=>scene.getObjectByName(`tp_thread_${i}`)??null),
    carriage:found.tp_travel_carriage,travelSlot:found.tp_travel_slot,button:found.tp_travel_button,
    beam:[found.tp_travel_beam,found.tp_travel_beam_rings],
  };
}

// Show exactly the used destination slots; a hidden slot also hides its thread.
export function showNodes(parts,count,{parent=true}={}){
  parts.parent.visible=parent;
  const stem=parts.root.getObjectByName('tp_parent_stem');
  if(stem)stem.visible=parent;
  parts.nodes.forEach((node,i)=>{
    node.visible=i<count;
    if(parts.threads[i])parts.threads[i].visible=parent&&i<count;
  });
}

// Turn the travel carriage around the station's local up axis so the control
// faces the viewer, like the HUD but in the 3D object. Pass the viewer's world
// position; returns the applied angle. `rate` eases per call (1 snaps).
const eye=new Vector3();
export function faceViewer(parts,viewerWorld,rate=1){
  eye.copy(viewerWorld);
  parts.root.worldToLocal(eye);
  if(Math.hypot(eye.x,eye.z)<1e-4)return parts.carriage.rotation.y;
  // The carriage rests at the front (+Z in glTF), so its angle is atan2(x,z).
  const target=Math.atan2(eye.x,eye.z);
  let delta=target-parts.carriage.rotation.y;
  delta=Math.atan2(Math.sin(delta),Math.cos(delta));
  parts.carriage.rotation.y+=delta*Math.max(0,Math.min(1,rate));
  return parts.carriage.rotation.y;
}

// Clips are presentation only. Reduced motion jumps to each clip's end pose.
export function stationMotion(scene,animations,{reduced=()=>false}={}){
  const mixer=new AnimationMixer(scene);
  const clip=name=>animations.find(candidate=>candidate.name===name);
  const play=(name,{loop=false}={})=>{
    const source=clip(name);
    if(!source)return null;
    const action=mixer.clipAction(source);
    action.reset();
    action.setLoop(loop?LoopRepeat:LoopOnce,loop?Infinity:1);
    action.clampWhenFinished=!loop;
    action.play();
    if(reduced()){
      if(loop){action.stop();return action;}
      mixer.setTime(source.duration);
    }
    return action;
  };
  return {
    mixer,
    deploy:()=>play(TELEPORT_CLIPS.deploy),
    idle:()=>play(TELEPORT_CLIPS.idle,{loop:true}),
    travel:()=>play(TELEPORT_CLIPS.travel),
    update:seconds=>{if(!reduced())mixer.update(seconds);},
    dispose:()=>{mixer.stopAllAction();mixer.uncacheRoot(scene);},
  };
}
