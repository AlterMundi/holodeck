import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,statSync,readFileSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';

export const SESSION_MS=1800000;
const MAX_BYTES=8192;
export const sessionKey=token=>typeof token==='string'&&/^[a-f0-9]{40}$/.test(token)
  ?createHash('sha256').update(token).digest('hex'):null;

// Room-session bindings only: never persist Home cookies, names, rights or native
// conversation. Every restored binding still needs current Home authorization.
export class SessionBindings {
  constructor(directory,limit){
    this.limit=limit;this.directory=directory;this.current=join(directory,'sessions.json');this.stage=join(directory,'sessions.stage.json');
    mkdirSync(directory,{recursive:true,mode:0o700});
  }
  load(){
    if(!existsSync(this.current))return [];
    const info=statSync(this.current);
    if(!info.isFile()||info.size>MAX_BYTES)throw Error('Room session bindings exceed their bound');
    const value=JSON.parse(readFileSync(this.current,'utf8'));
    if(value.schema!=='holodeck.session-bindings/v1'||!Array.isArray(value.bindings)||value.bindings.length>this.limit)throw Error('Invalid room session bindings');
    const keys=new Set();
    for(const binding of value.bindings){
      if(!binding||Object.keys(binding).some(key=>!['key','actorRef','created'].includes(key))
        ||!/^[a-f0-9]{64}$/.test(binding.key)||keys.has(binding.key)
        ||typeof binding.actorRef!=='string'||!binding.actorRef.length||binding.actorRef.length>256
        ||!Number.isSafeInteger(binding.created)||binding.created<0||binding.created>Date.now())throw Error('Invalid room session binding');
      keys.add(binding.key);
    }
    return value.bindings.filter(binding=>Date.now()-binding.created<SESSION_MS);
  }
  save(sessions){
    const bindings=[...sessions].map(([key,session])=>({key,actorRef:session.actor.id,created:session.created}));
    const data=JSON.stringify({schema:'holodeck.session-bindings/v1',bindings});
    if(bindings.length>this.limit||Buffer.byteLength(data)>MAX_BYTES)throw Error('Room session binding capacity reached');
    let fd;
    try{
      fd=openSync(this.stage,'w',0o600);writeFileSync(fd,data);fsyncSync(fd);closeSync(fd);fd=null;
      renameSync(this.stage,this.current);
      fd=openSync(this.directory,'r');fsyncSync(fd);
    }finally{
      if(fd!==undefined&&fd!==null)closeSync(fd);
      if(existsSync(this.stage))unlinkSync(this.stage);
    }
  }
}
