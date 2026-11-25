import {poseConnection} from './avatar-pose-presence.mjs';

export const tabletopPointBroadcast='holodeck.tabletop-point.v1';
export const tabletopPointDuration=5000;
const validName=name=>typeof name==='string'&&name.length>0&&name.length<=180;
const validRevision=revision=>Number.isSafeInteger(revision)&&revision>=0;

export function validTabletopPoint({connection,sequence,revision,reference}={}){
  return poseConnection(connection)&&validRevision(sequence)&&sequence>0&&validRevision(revision)&&
    reference&&Object.keys(reference).sort().join(',')==='part,resource,scene,sceneVersion,version'&&
    typeof reference.resource==='string'&&/^[a-f0-9]{32}$/.test(reference.resource)&&
    typeof reference.version==='string'&&/^[a-f0-9]{64}$/.test(reference.version)&&
    typeof reference.sceneVersion==='string'&&/^[a-f0-9]{64}$/.test(reference.sceneVersion)&&
    validName(reference.scene)&&validName(reference.part);
}

export function tabletopPointProofMessage(space,{connection,sequence,revision,reference}){
  const {resource,version,scene,sceneVersion,part}=reference;
  return JSON.stringify([tabletopPointBroadcast,space,connection,sequence,revision,resource,version,scene,sceneVersion,part]);
}
