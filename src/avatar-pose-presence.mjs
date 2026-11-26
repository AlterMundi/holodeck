export const avatarPoseBroadcast='holodeck.avatar-pose.v1';
export const avatarPoseModes=new Set(['ground','crouch','fly','fly-fast','table']);
export const poseConnection=id=>Number.isSafeInteger(id)&&id>=0;
export const poseKeyMaterial=token=>avatarPoseBroadcast+'\n'+token;
export const poseProofMessage=({space,connection,pose,revision})=>JSON.stringify([space,connection,pose,revision]);

const text=new TextEncoder();

export async function signAvatarPresence(key,message){
  const signature=await crypto.subtle.sign('HMAC',key,text.encode(message));
  return Array.from(new Uint8Array(signature),byte=>byte.toString(16).padStart(2,'0')).join('');
}

export const avatarPoseProof=(key,payload)=>signAvatarPresence(key,poseProofMessage(payload));

// Pose is ephemeral rendering metadata. MML still owns position, movement
// and the base animation, including for clients from earlier releases.
export class AvatarPosePresence {
  constructor(base,token,document=globalThis.document){
    this.url=new URL('api/space/avatar-pose',base);
    const subtle=globalThis.crypto?.subtle;
    this.key=subtle?.digest('SHA-256',text.encode(poseKeyMaterial(token)))
      .then(material=>subtle.importKey('raw',material,{name:'HMAC',hash:'SHA-256'},false,['sign']))
      .catch(()=>null);
    this.document=document;
    this.events=new AbortController();
    const options={signal:this.events.signal};
    const ground=()=>{if(this.world)this.update(this.world,this.space,'ground',true);};
    this.document?.addEventListener('visibilitychange',()=>{if(this.document.hidden)ground();},options);
    this.document?.defaultView.addEventListener('pagehide',ground,options);
    this.peers=new Map();
    this.revision=0;
    this.reset=()=>{this.peers.clear();this.sent=null;if(!this.pending?.keepalive)this.pending?.abort();this.pending=null;};
    this.onEvent=event=>{
      if(['connected','disconnected','reconnecting'].includes(event.type))this.reset();
      if(event.type==='user_left')this.peers.delete(event.connectionId);
    };
  }

  receive({broadcastType,payload}){
    if(!this.world?.isConnected()||broadcastType!==avatarPoseBroadcast||payload?.space!==this.space)return;
    if(Array.isArray(payload.poses)){
      if(payload.poses.length>128||!payload.poses.every(row=>Array.isArray(row)&&row.length===2&&
        poseConnection(row[0])&&avatarPoseModes.has(row[1])))return;
      this.peers.clear();
      for(const [connection,pose] of payload.poses)if(pose!=='ground')this.peers.set(connection,pose);
    }else if(poseConnection(payload.connection)&&avatarPoseModes.has(payload.pose)){
      if(payload.pose==='ground')this.peers.delete(payload.connection);
      else if(this.peers.size<128||this.peers.has(payload.connection))this.peers.set(payload.connection,payload.pose);
    }
  }

  update(world,space,pose,keepalive=false){
    if(this.world!==world||this.space!==space){
      this.world?.removeEventListener(this.onEvent);
      this.reset();
      this.world=world;
      this.space=space;
      this.world?.addEventListener(this.onEvent);
    }
    const connection=world?.getConnectionId();
    if(!this.key||!world?.isConnected()||!poseConnection(connection))return;
    if(this.document?.hidden)pose='ground';
    const key=connection+':'+pose;
    if(this.sent?.key===key){
      if(this.sent.done||this.pending||performance.now()<this.sent.retryAt)return;
    }else{
      this.pending?.abort();
      this.sent={key,tries:0,retryAt:0};
    }
    const selected=this.sent,revision=++this.revision;
    const signal=new AbortController();
    if(keepalive)signal.keepalive=true;
    this.pending=signal;
    selected.tries++;
    const deadline=setTimeout(()=>signal.abort(),2500);
    const body={connection,pose,revision,space};
    void this.key.then(key=>key&&avatarPoseProof(key,body)).then(proof=>{
      if(!proof){selected.done=true;return;}
      if(signal.signal.aborted)return;
      return fetch(this.url,{method:'POST',redirect:'error',
        headers:{'Content-Type':'application/json','X-Holodeck-Pose-Proof':proof},
        body:JSON.stringify(body),signal:signal.signal,keepalive});
    }).then(response=>{
      if(response)selected.done=response.ok||[400,401,403,404,405].includes(response.status);
    })
      .catch(()=>{})
      .finally(()=>{
        clearTimeout(deadline);
        if(this.pending!==signal)return;
        this.pending=null;
        selected.retryAt=performance.now()+Math.min(30000,450*2**Math.min(7,selected.tries-1));
      });
  }

  dispose(){
    this.events.abort();
    this.world?.removeEventListener(this.onEvent);
    this.world=null;
    this.reset();
  }
}
