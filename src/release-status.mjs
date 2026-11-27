import {basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openSync,readSync,closeSync,constants} from 'node:fs';
import {join} from 'node:path';

const digest=/^[a-f0-9]{64}$/;
export const releaseNoticeName='release-notice.json';

export function installedRelease(root){
  return /^release-([a-f0-9]{64})$/.exec(basename(fileURLToPath(root)))?.[1]??null;
}

export function releaseStatus(version,stateDir,now=Date.now()){
  const result={version:version?.slice(0,12)??null,update:null};
  if(!stateDir||!version)return result;
  let descriptor;
  try{
    descriptor=openSync(join(stateDir,releaseNoticeName),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
    const buffer=Buffer.alloc(1025);
    const count=readSync(descriptor,buffer);
    if(count>1024)return result;
    const notice=JSON.parse(buffer.toString('utf8',0,count));
    if(Object.keys(notice).sort().join(',')!=='expires,from,kind,to'||
       !['restart','live'].includes(notice.kind)||notice.from!==version||
       typeof notice.to!=='string'||!digest.test(notice.to)||
       !Number.isSafeInteger(notice.expires)||notice.expires<=now||
       notice.expires>now+5*60*1000)return result;
    return {...result,update:{kind:notice.kind}};
  }catch{
    return result;
  }finally{
    if(descriptor!==undefined)closeSync(descriptor);
  }
}
