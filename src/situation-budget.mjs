const bytes=value=>Buffer.byteLength(JSON.stringify(value));
// Preserve canonical entities, authored place/activity/time and the exact
// observer's statement. Omit older history/other summaries explicitly, never
// silently claim that the entire situation or a human's attention was captured.
export function fitSituation(observation,maxBytes,{preserveActors=[]}={}){
 const preserved=new Set([observation.observer,...preserveActors]);
 if(!Number.isInteger(maxBytes)||maxBytes<4096||maxBytes>65536)throw Error('Select a bounded situation budget');
 if(bytes(observation)<=maxBytes)return true;
 const coverage=observation.source.omissions??={events:0,focus:0,participants:0};
 observation.source.partial=true;
 const note='Some public history or other participants/indications were omitted to fit the capture bound; all canonical entities and your indication are retained. This is not complete perception or human attention.';
 if(!observation.uncertainty.includes(note))observation.uncertainty.push(note);
 while(bytes(observation)>maxBytes&&observation.events.length){
  const dropped=observation.events.shift();coverage.events++;observation.source.gap=true;observation.source.retainedAfter=dropped.sequence;
 }
 while(bytes(observation)>maxBytes&&observation.focus?.some(signal=>!preserved.has(signal.actor))){
  const index=observation.focus.findIndex(signal=>!preserved.has(signal.actor));observation.focus.splice(index,1);coverage.focus++;
 }
 while(bytes(observation)>maxBytes&&observation.participants.some(participant=>!preserved.has(participant.actor))){
  const index=observation.participants.findLastIndex(participant=>!preserved.has(participant.actor));observation.participants.splice(index,1);coverage.participants++;
 }
 return bytes(observation)<=maxBytes;
}
