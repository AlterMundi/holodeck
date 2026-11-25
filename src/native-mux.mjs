// Receiving-selected native lanes. This is a transport selection table, never an
// identity registry or a fallback to another participant's companion.
export class NativeRouteError extends Error {
  constructor(code,message){super(message);this.code=code;}
}

export function createNativeTransportMux({routes,createTransport}){
  if(!Array.isArray(routes)||!routes.length||routes.length>32||typeof createTransport!=='function')
    throw new TypeError('Select bounded native receiving routes and their fixed transport');
  const selected=new Map();
  for(const route of routes){
    if(!route||Object.keys(route).some(key=>!['actorRef','beingRef','homeRef','socket'].includes(key))
      ||typeof route.actorRef!=='string'||!/^human:[A-Za-z0-9:._/-]{1,240}$/.test(route.actorRef)
      ||typeof route.beingRef!=='string'||!/^dm:being:v1:[A-Za-z0-9_-]{43}$/.test(route.beingRef)
      ||typeof route.homeRef!=='string'||!/^home:[a-f0-9]{32}$/.test(route.homeRef)
      ||typeof route.socket!=='string'||!route.socket.startsWith('/')||route.socket.includes('\0')
      ||selected.has(route.actorRef))throw new TypeError('Select one explicit paired native route per human');
    selected.set(route.actorRef,{route:Object.freeze({...route}),transport:createTransport(route.socket)});
  }
  function lane(actorRef){
    const value=selected.get(actorRef);
    if(!value)throw new NativeRouteError('native-route-unavailable','This participant has no configured native receiving lane');
    return value;
  }
  function verify(value,binding){
    if(!binding||binding.actorRef!==value.route.actorRef||binding.beingRef!==value.route.beingRef||binding.homeRef!==value.route.homeRef)
      throw new NativeRouteError('native-route-mismatch','The receiving pairing does not match the selected native lane');
    return binding;
  }
  return {
    async inspect(actorRef){const value=lane(actorRef);return verify(value,await value.transport.inspect(actorRef));},
    async surface(actorRef){const value=lane(actorRef);return verify(value,await value.transport.surface(actorRef));},
    async lookup(request){
      const value=lane(request.actorRef),result=await value.transport.lookup(request);
      verify(value,result.frozen);
      return result;
    },
    async submit(request){const value=lane(request.actorRef);verify(value,request.frozen);return value.transport.submit(request);},
    async prepareContext(request){const value=lane(request.actorRef);verify(value,request.frozen);return value.transport.prepareContext(request);},
    async prepareMachineContext(request){const value=lane(request.actorRef);verify(value,request.frozen);return value.transport.prepareMachineContext(request);},
    async machineContextStatus(request){const value=lane(request.actorRef);verify(value,request.frozen);return value.transport.machineContextStatus(request);},
    async status(request){const value=lane(request.actorRef);verify(value,request.frozen);return value.transport.status(request);}
  };
}
