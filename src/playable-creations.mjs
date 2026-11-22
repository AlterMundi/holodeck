import {creationContains} from './world-layout.mjs';
import {workshopColour} from './workshop.mjs';
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys;
export function validSignalGarden(play){
 if(!play||typeof play!=='object'||Array.isArray(play)||!['minContributors,schema,targets','minContributors,requiredBridgeRaised,schema,targets'].includes(Object.keys(play).sort().join(','))
  ||play.schema!=='signal-garden/v1'||!Number.isInteger(play.minContributors)||play.minContributors<1||play.minContributors>8
  ||(play.requiredBridgeRaised!==undefined&&typeof play.requiredBridgeRaised!=='boolean')||!Array.isArray(play.targets)||play.targets.length<1||play.targets.length>4)return false;
 return play.targets.every(target=>exact(target,'color,radius,x,z')&&[target.x,target.z,target.radius].every(Number.isFinite)
  &&target.radius>=.4&&target.radius<=1.5&&creationContains(target.x,target.z,target.radius)&&workshopColour(target.color));
}
export function validEntityEditors(editors,entities){
 return editors&&typeof editors==='object'&&!Array.isArray(editors)&&Object.keys(editors).length<=32&&Object.entries(editors).every(([id,stamp])=>entities?.[id]
  &&exact(stamp,'actorRef,revision')&&typeof stamp.actorRef==='string'&&stamp.actorRef.length>0&&stamp.actorRef.length<=200
  &&Number.isSafeInteger(stamp.revision)&&stamp.revision>=1&&stamp.revision<=entities[id].revision);
}
// Derived only. A body never earns another contributor for the same canonical
// actorRef; unknown/stale editor stamps never receive attribution.
export function signalGardenProgress(play,{entities={},editors={},sequence=0}={}){
 const lights=Object.entries(entities).filter(([id,entity])=>id.startsWith('garden-')&&!entity.deleted&&workshopColour(entity.color)).sort(([a],[b])=>a.localeCompare(b));
 const candidates=play.targets.map(target=>lights.filter(([,entity])=>workshopColour(entity.color)===workshopColour(target.color)&&Math.hypot(entity.x-target.x,entity.z-target.z)<=target.radius+1e-9).map(([id])=>id));
 // Maximum bipartite matching prevents one light from filling two overlapping
 // targets, and avoids a greedy early choice incorrectly blocking another target.
 const assigned=new Map();
 function fill(index,seen){for(const id of candidates[index])if(!seen.has(id)){seen.add(id);if(!assigned.has(id)||fill(assigned.get(id),seen)){assigned.set(id,index);return true;}}return false;}
 for(let index=0;index<play.targets.length;index++)fill(index,new Set());
 const matches=play.targets.map((_,index)=>({index,entity:[...assigned].find(([,target])=>target===index)?.[0]??null}));
 const bridgeRequired=play.requiredBridgeRaised===true,bridgeReady=!bridgeRequired||entities.bridge?.raised===true;
 const relevant=new Set(candidates.flat());if(bridgeRequired&&entities.bridge?.raised)relevant.add('bridge');
 const contributors=new Set();let unattributed=0;
 for(const id of relevant){const stamp=editors[id];if(stamp&&stamp.revision===entities[id].revision)contributors.add(stamp.actorRef);else unattributed++;}
 const filled=assigned.size,complete=filled===play.targets.length&&bridgeReady&&contributors.size>=play.minContributors;
 return {through:sequence,targets:matches,filledTargets:filled,totalTargets:play.targets.length,contributors:contributors.size,minContributors:play.minContributors,bridgeRequired,bridgeReady,unattributedMatches:unattributed,complete};
}
export function signalColourName(colour){
 const value=workshopColour(colour);return ({'#8ce4c2':'menta','#efc87a':'ámbar','#e8a2b9':'rosa','#a77bea':'violeta'})[value]??value;
}
export function signalGardenInstructions(play,progress){
 const colours=[...new Set(play.targets.map(target=>signalColourName(target.color)))];
 const instruction=`Plantá luces ${colours.join(', ')} en sus círculos. Colaboración: al menos ${play.minContributors} ${play.minContributors===1?'humano o daimon':'humanos o daimons'}.${progress.bridgeRequired?' Conecten también las islas.':''}`;
 const status=progress.complete?(play.minContributors===1?'¡Jardín completado!':'¡Jardín completado en equipo!'):`${progress.filledTargets}/${progress.totalTargets} señales · ${progress.contributors}/${progress.minContributors} colaboradores${progress.bridgeRequired&&!progress.bridgeReady?' · falta conectar las islas':''}`;
 return {instruction,status};
}
