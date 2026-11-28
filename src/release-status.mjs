import {basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openSync,readSync,closeSync,constants,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';

const digest=/^[a-f0-9]{64}$/;
export const releaseNoticeName='release-notice.json';

export function installedRelease(root){
  return /^release-([a-f0-9]{64})$/.exec(basename(fileURLToPath(root)))?.[1]??null;
}

// Holodeck's selected USTAR uses 512-byte entries and 10 KiB records.
export function installedPackageBytes(root){
  try{
    const file=new URL('service.json',root);
    const {service,files}=JSON.parse(readFileSync(file,'utf8'));
    if(service!=='holodeck'||!Array.isArray(files)||files.length>4096)return null;
    const blocks=bytes=>512+512*Math.ceil(bytes/512);
    let bytes=1024+blocks(statSync(file).size);
    for(const {path} of files){
      if(typeof path!=='string'||path.startsWith('/')||path.split('/').some(part=>['','.','..'].includes(part))||
        !/^[a-zA-Z0-9._/-]+$/.test(path))return null;
      bytes+=blocks(statSync(new URL(path,root)).size);
    }
    return 10240*Math.ceil(bytes/10240);
  }catch{return null;}
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
       !['request','restart','applying','live'].includes(notice.kind)||notice.from!==version||
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
