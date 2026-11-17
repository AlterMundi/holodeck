import { mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,statSync,openSync,closeSync,fsyncSync,unlinkSync } from 'node:fs';
import { join } from 'node:path';

export const MAX_SAVE_BYTES=5*1024*1024;
// One current, one previous and one bounded staging file: maximum15MiB.
export class RoomStore {
  constructor(directory){
    mkdirSync(directory,{recursive:true,mode:0o700});
    this.directory=directory;this.current=join(directory,'room.json');
    this.previous=join(directory,'room.previous.json');this.stage=join(directory,'room.stage.json');
  }
  load(){
    if(!existsSync(this.current))return null;
    const stat=statSync(this.current);
    if(!stat.isFile()||stat.size>MAX_SAVE_BYTES)throw Error('Room save exceeds its bound');
    // Never silently roll back current state after an uncertain completed action.
    // Preserve a corrupt checkpoint; recovery chooses the earlier state explicitly.
    return JSON.parse(readFileSync(this.current,'utf8'));
  }
  save(state){
    const data=Buffer.from(JSON.stringify(state));
    if(data.length>MAX_SAVE_BYTES)throw Error('Room save capacity reached');
    let descriptor;
    try{
      descriptor=openSync(this.stage,'w',0o600);
      writeFileSync(descriptor,data);fsyncSync(descriptor);closeSync(descriptor);descriptor=null;
      if(existsSync(this.current)){
        // Copy through the bounded stage's previous bytes before atomic replacement.
        // Current remains authoritative until rename(stage,current).
        const previous=readFileSync(this.current);
        if(previous.length>MAX_SAVE_BYTES)throw Error('Previous room save exceeds its bound');
        writeFileSync(this.previous,previous,{mode:0o600});
        const old=openSync(this.previous,'r');try{fsyncSync(old);}finally{closeSync(old);}
      }
      renameSync(this.stage,this.current);
      const dir=openSync(this.directory,'r');try{fsyncSync(dir);}finally{closeSync(dir);}
    }finally{
      if(descriptor!==undefined&&descriptor!==null)closeSync(descriptor);
      if(existsSync(this.stage))unlinkSync(this.stage);
    }
  }
}
