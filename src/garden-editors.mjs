const SCHEMA='holodeck.garden-editors/v1';
const ROOM=/^[a-z][a-z0-9-]{0,47}$/;
const HUMAN=/^human:[A-Za-z0-9:_-]{1,130}$/;
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).sort().join(',')===keys;

export class GardenEditors {
  constructor({state,owner,allows,persist}){
    Object.assign(this,{owner,allows,persist});
    this.fenced=false;
    const value=state??{schema:SCHEMA,grants:[]};
    if(!exact(value,'grants,schema')||value.schema!==SCHEMA||!Array.isArray(value.grants)||
      value.grants.length>24||new Set(value.grants.map(entry=>entry?.room)).size!==value.grants.length||
      !value.grants.every(entry=>exact(entry,'human,revision,room')&&typeof entry.room==='string'&&
        ROOM.test(entry.room)&&owner(entry.room)&&Number.isSafeInteger(entry.revision)&&entry.revision>0&&
        (entry.human===null||typeof entry.human==='string'&&HUMAN.test(entry.human))))
      throw Error('Invalid indoor garden editor checkpoint');
    this.grants=new Map(value.grants.map(entry=>[entry.room,Object.freeze({...entry})]));
  }

  grant(actor,room){
    const grant=this.grants.get(room);
    return !this.fenced&&actor?.kind==='human'&&actor.rights?.includes('edit')&&
      grant?.human===actor.id&&this.allows(actor,room)?grant:null;
  }

  act(actor,input){
    const {type,room}=input;
    if(this.fenced||!this.persist||actor?.kind!=='daimon'||
      !actor.rights?.includes('edit')||typeof room!=='string'||this.owner(room)!==actor.id)return null;
    const grant=this.grants.get(room);
    if(type==='garden.editor.current'&&exact(input,'room,type'))return {room,grant:grant??null};
    if(type!=='garden.editor.set'||!exact(input,'expectedRevision,human,room,type')||
      input.expectedRevision!==(grant?.revision??null))return null;
    const {human}=input;
    if(human!==null&&(typeof human!=='string'||!HUMAN.test(human)||
      !this.allows({kind:'human',id:human},room)))return null;
    if(grant?.human===human)return {room,grant};
    const revision=(grant?.revision??0)+1;
    if(!Number.isSafeInteger(revision)||!grant&&this.grants.size>=24)return null;
    const next=Object.freeze({room,human,revision});
    const grants=new Map(this.grants);
    grants.set(room,next);
    try{this.persist({schema:SCHEMA,grants:[...grants.values()]});}
    catch(error){if(error.commitUncertain)this.fenced=true;throw error;}
    this.grants=grants;
    return {room,grant:next};
  }
}
