import {ActivityError} from './activity.mjs';
import net from 'node:net';
import { chmodSync,lstatSync } from 'node:fs';
import { DaimonPort } from './daimon-port.mjs';
import {situatedGardenCommandId} from './indoor-gardens.mjs';

function situatedInterior({request,verified,actor,room,conversationPlace,indoorGarden,approachSpace,moveSpace}){
  const {operation,args}=request;
  const captured=conversationPlace?.(actor,verified.capturedSpace);
  if(!captured)throw Error('The current being has no access to that room');
  const fields=Object.keys(args).sort().join(',');
  const next=()=>verified.working&&actor.rights.includes('edit')?approachSpace?.(actor,captured.id):null;
  if(operation==='observe'&&!fields){
    const approach=next();
    return {schema:'holodeck.space-observation/v1',run:room.run,edition:room.edition,
      observer:actor.id,space:captured,...(approach?{approach}:{})};
  }
  const {nativeRequest,...command}=args;
  const commandFields=Object.keys(command).sort().join(',');
  const currentOriginal=!Object.hasOwn(args,'nativeRequest')||nativeRequest===verified.nativeRequest;
  if(operation==='act'&&command.type==='space.move'&&commandFields==='from,to,type'&&currentOriginal){
    const step=next();
    if(!step||step.from!==command.from||step.to!==command.to)throw Error('The admitted room approach changed');
    const arrived=moveSpace?.(actor,step);
    if(!arrived||arrived.id!==step.to)throw Error('The admitted room move could not be confirmed');
    return {from:step.from,to:arrived.id};
  }

  const id=situatedGardenCommandId(verified.nativeRequest,command.id);
  let result;
  if(id&&operation==='act'&&command.type==='garden.signal'&&command.room===captured.id&&
     commandFields==='color,expectedRevision,id,index,room,type'&&currentOriginal)
    result=indoorGarden?.(actor,{...command,id});
  else if(id&&operation==='result'&&fields==='id')
    result=indoorGarden?.(actor,{type:'garden.result',id});
  if(!result||result.room!==captured.id)throw Error('Situated garden operation unavailable');
  return result;
}

// The receiving operator owns the directory/socket filesystem capability.
// Native identity and current room rights are independently rechecked per request.
export async function createWorldPort({socketPath,room,native,resolveRights,expectedBeingRef=null,resolveOwnNativeRights=null,describeSpace,moveSpace,approachSpace,conversationPlace,putExhibit,exhibitResult,currentLayout,previewLayout,publishLayout,layoutResult,roomDesign,indoorGarden}){
  if(!socketPath?.startsWith('/')||!native?.authorizeWorldRequest||typeof resolveRights!=='function')
    throw Error('Select the installed native world port and authority resolver');
  let active=0;
  const server=net.createServer(socket=>{
    if(active>=4){socket.end(JSON.stringify({ok:false,message:'El mundo está ocupado; consultá el resultado antes de repetir una acción.'})+'\n');return;}
    active++;let bytes=Buffer.alloc(0),handled=false;
    socket.setTimeout(55000,()=>socket.destroy());
    socket.once('close',()=>active--);
    socket.on('error',()=>{});
    socket.on('data',async data=>{
      if(handled)return;
      bytes=Buffer.concat([bytes,data]);
      if(bytes.length>16384){handled=true;socket.destroy();return;}
      const end=bytes.indexOf(10);if(end<0)return;handled=true;
      try{
        const request=JSON.parse(bytes.subarray(0,end));
        const own=request?.ownNative===true;
        if(!request||Object.keys(request).sort().join(',')!==(own?'args,operation,ownNative':'args,interactionId,operation')
          ||!['observe','activity','project','act','result'].includes(request.operation)
          ||!request.args||typeof request.args!=='object'||Array.isArray(request.args))throw Error('Invalid world operation');
        let verified,rights;
        if(own){
          // The private receiving lane selects identity; current Home authority
          // supplies access. Neither is a signature on the supplied command.
          if(!/^dm:being:v1:[A-Za-z0-9_-]{43}$/.test(expectedBeingRef||'')
            ||typeof resolveOwnNativeRights!=='function')throw Error('Own native authority is unavailable');
          if(Object.hasOwn(request.args,'nativeRequest'))throw Error('Own commands cannot borrow an input reference');
          verified={actor:{id:expectedBeingRef,ref:expectedBeingRef,kind:'daimon'}};
          rights=await resolveOwnNativeRights(verified);
        }else{
          verified=await native.authorizeWorldRequest(request.interactionId,expectedBeingRef);
          if(expectedBeingRef!==null&&verified.actor?.ref!==expectedBeingRef)throw Error('Native return lane identity changed');
          rights=await resolveRights(verified);
        }
        if(expectedBeingRef!==null&&verified.actor?.ref!==expectedBeingRef)throw Error('Native return lane identity changed');
        if(!rights?.includes('observe'))throw Error('Room admission expired');
        const actor={...verified.actor,rights};
        const port=new DaimonPort(room,async()=>actor);
        const space=verified.capturedSpace?null:describeSpace?.(actor);
        let result;
        const savedExhibit=own&&request.operation==='result'?exhibitResult?.(actor,request.args.id):null;
        if(verified.capturedSpace){
          result=situatedInterior({request,verified,actor,room,conversationPlace,indoorGarden,approachSpace,moveSpace});
        }else if(request.operation==='act'&&request.args.type==='layout.current'){
          if(!own||!rights.includes('edit')||Object.keys(request.args).length!==1)throw Error('Reading the draft base requires an own-native editor route');
          result=currentLayout?.(actor)??null;
        }else if(request.operation==='act'&&request.args.type==='layout.result'){
          if(!own||Object.keys(request.args).sort().join(',')!=='id,type')throw Error('Layout receipts require an own-native route');
          result=layoutResult?.(actor,request.args.id);
          if(!result)throw Error('Layout receipt unavailable');
        }else if(request.operation==='act'&&['layout.preview','layout.publish'].includes(request.args.type)){
          if(!own||!actor.rights.includes('edit'))throw Error('Layout authoring requires an own-native route');
          result=request.args.type==='layout.preview'?
            previewLayout?.(actor,{...request.args,type:'layout.publish'}):
            publishLayout?.(actor,request.args);
          if(!result)throw Error('Layout unavailable');
        }else if(request.operation==='act'&&['design.current','design.preview','design.put','design.result'].includes(request.args.type)){
          if(!own||!rights.includes('edit'))throw Error('Room design requires an own-native editor route');
          const fields=Object.keys(request.args).sort().join(',');
          if((request.args.type==='design.current'&&fields!=='room,type')||
             (request.args.type==='design.result'&&fields!=='id,type'))throw Error('Invalid room design lookup');
          result=roomDesign?.(actor,request.args);
          if(!result)throw Error('Room design unavailable');
        }else if(request.operation==='act'&&['garden.preview','garden.put','garden.signal','garden.result'].includes(request.args.type)){
          if(!own||(request.args.type==='garden.result'&&Object.keys(request.args).sort().join(',')!=='id,type'))
            throw Error('Indoor gardens require an own-native route');
          result=indoorGarden?.(actor,request.args);
          if(!result)throw Error('Indoor garden unavailable');
        }else if(request.operation==='act'&&['exhibit.current','exhibit.preview','exhibit.put'].includes(request.args.type)){
          if(!own||!rights.includes('edit'))throw Error('Exhibit authoring requires an own-native editor route');
          if(request.args.type==='exhibit.current'&&Object.keys(request.args).sort().join(',')!=='room,type')
            throw Error('Invalid exhibit lookup');
          result=await putExhibit?.(actor,request.args);
          if(!result)throw Error('Exhibit authoring unavailable');
        }else if(savedExhibit)result=savedExhibit;
        else if(request.operation==='act'&&request.args.type==='space.move'){
          if(!own||!rights.includes('edit')||Object.keys(request.args).sort().join(',')!=='from,to,type')
            throw Error('Room transitions require an own-native route');
          result=moveSpace?.(actor,{from:request.args.from,to:request.args.to});
          if(!result)throw Error('Room transition unavailable');
        }else if(space&&space.id!=='outside'){
          if(!own||request.operation!=='observe')throw Error('Exterior operation unavailable inside');
          result={schema:'holodeck.space-observation/v1',run:room.run,edition:room.edition,
            observer:actor.id,space};
        }else if(request.operation==='observe'){
          result=await port.observe(null,request.args);
          if(space?.entrances.length)result.space=space;
        }
        else if(request.operation==='activity')result=await port.activity(null,request.args);
        else if(request.operation==='project')result=await port.project(null,request.args);
        else if(request.operation==='result')result=await port.result(null,request.args.id);
        else{
          if(request.args.nativeRequest&&request.args.nativeRequest!==verified.nativeRequest)throw Error('Native request changed');
          result=await port.act(null,{...request.args,nativeRequest:own?'own-native:'+request.args.id:verified.nativeRequest});
        }
        const response=JSON.stringify({ok:true,result,...(own?{authoritySource:{identity:'receiving-lane',access:'current-being-grant'}}:{})});
        if(Buffer.byteLength(response)>131072)throw Error('World response exceeds its bound');
        socket.end(response+'\n');
      }catch(error){
        if(error instanceof ActivityError){socket.end(JSON.stringify({ok:false,code:error.code,message:error.message,...(error.code==='stale-run'?{run:room.run}:{})})+'\n');return;}
        socket.end(JSON.stringify({ok:false,message:'No pude confirmar esa operación. Revisá el turno, el acceso y el estado del mundo antes de intentar otra acción.'})+'\n');}
    });
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(socketPath,resolve);});
  chmodSync(socketPath,0o660);
  const stat=lstatSync(socketPath);
  if(!stat.isSocket()||stat.uid!==process.getuid()){server.close();throw Error('World port ownership changed');}
  return {close:()=>new Promise(resolve=>server.close(resolve))};
}
