import {readActivity,nativeActivityQuery} from './activity.mjs';
import { RoomError } from './room.mjs';

// Direct world interface for a receiving-local daimon adapter. It is independent
// of human controls and browser sessions. resolveActor must verify existing
// identity/grants on EVERY operation; this module grants no identity itself.
export class DaimonPort {
  constructor(room, resolveActor) {
    if(typeof resolveActor!=='function')throw new TypeError('A receiving authority resolver is required');
    this.room=room;this.resolveActor=resolveActor;
  }
  async actor(receivingContext){
    const actor=await this.resolveActor(receivingContext);
    if(actor?.kind!=='daimon')throw new RoomError('identity','A verified daimon actor is required');
    return actor;
  }
  async observe(receivingContext,query={}){
    return this.room.observe(await this.actor(receivingContext),query);
  }
  async activity(receivingContext,args={}){
    return readActivity(this.room,await this.actor(receivingContext),nativeActivityQuery(args));
  }
  async project(receivingContext,projection){
    return this.room.project(await this.actor(receivingContext),projection);
  }
  async act(receivingContext,command){
    return this.room.command(await this.actor(receivingContext),command);
  }
  async result(receivingContext,id){
    return this.room.result(await this.actor(receivingContext),id);
  }
}
