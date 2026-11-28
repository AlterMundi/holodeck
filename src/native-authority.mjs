import net from 'node:net';
import {sameVisitPin,validVisitPin} from './content-visits.mjs';

function actorRef(actor){
 if(actor?.kind!=='daimon'||actor.id!==actor.ref||!/^dm:being:v1:[A-Za-z0-9_-]{43}$/.test(actor.ref))throw Error('A verified native being is required');
 return actor.ref;
}

function authorityExchange(socketPath,timeoutMs){
 if(typeof socketPath!=='string'||!socketPath.startsWith('/')||socketPath.length>4096||socketPath.includes('\0'))throw Error('Select the existing owner authority socket');
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw Error('Select a bounded authority deadline');
 return request=>new Promise((resolve,reject)=>{
  const socket=net.createConnection({path:socketPath});let bytes=Buffer.alloc(0),done=false;
  const timer=setTimeout(()=>finish(Error('Current service authority unavailable')),timeoutMs);
  function finish(error,value){if(done)return;done=true;clearTimeout(timer);socket.destroy();error?reject(error):resolve(value);}
  socket.on('error',error=>finish(error));
  socket.on('connect',()=>socket.write(JSON.stringify(request)+'\n'));
  socket.on('data',chunk=>{
   bytes=Buffer.concat([bytes,chunk]);if(bytes.length>8192)return finish(Error('Authority response exceeds its bound'));
   const end=bytes.indexOf(10);if(end<0)return;
   try{const value=JSON.parse(bytes.subarray(0,end));if(value.ok!==true)throw Error('Current service authority unavailable');finish(null,value.result);}
   catch(error){finish(error);}
  });
  socket.on('end',()=>{if(!done)finish(Error('Authority response incomplete'));});
 });
}

// The receiving socket retains owner credentials; the world only receives the
// scoped decision after verifying the identity of the native route.
export function createNativeRoomAuthority(socketPath,{timeoutMs=8000}={}){
 const exchange=authorityExchange(socketPath,timeoutMs);
 return async verified=>{
  const beingRef=actorRef(verified?.actor);
  const result=await exchange({operation:'world-access',beingRef});
  if(!result||result.schema!=='holodeck.world-access/v1'||result.beingRef!==beingRef||typeof result.allowed!=='boolean')throw Error('Authority response does not match this being');
  return result.allowed?['observe','edit','project']:[];
 };
}

export function createNativeReviewAuthority(socketPath,{timeoutMs=10000}={}){
 const exchange=authorityExchange(socketPath,timeoutMs);
 return async(actor,pin)=>{
  const beingRef=actorRef(actor);
  if(!validVisitPin(pin)||pin.kind!=='artifact_review'||pin.adapter!=='interactive_3d')return false;
  const result=await exchange({operation:'review-ownership',beingRef,pin});
  if(!result||result.schema!=='holodeck.review-ownership/v1'||result.beingRef!==beingRef||
     !sameVisitPin(result.pin,pin)||typeof result.owned!=='boolean')throw Error('Ownership proof does not match the requested edition');
  return result.owned;
 };
}

export function createNativeQuestbookAuthority(socketPath, project, {timeoutMs=8000,paired=false}={}) {
 const exchange=authorityExchange(socketPath,timeoutMs);
 return async (actor, write)=>{
  const browser=actor?.kind==='human';
  const key=browser?'actorRef':'beingRef';
  if(browser&&(!paired||actor.id!==actor.ref||!/^human:[A-Za-z0-9:._/-]{1,240}$/.test(actor.ref)))
    return null;
  const subject=browser?actor.ref:actorRef(actor);
  const result=await exchange({operation:'questbook-access',[key]:subject,project,write});
  if(!result||result.schema!=='holodeck.questbook-access/v1'||result[key]!==subject||
     result.project!==project||result.requestedWrite!==write||
     typeof result.read!=='boolean'||typeof result.write!=='boolean'||result.write&&(!write||!result.read))
    throw Error('Questbook authority response does not match this operation');
  return {read:result.read,write:result.write};
 };
}
