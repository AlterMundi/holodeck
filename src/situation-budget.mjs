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
 const note='Some public history, derived node descriptions or other participants/indications were omitted to fit the capture bound; all canonical entities and your indication are retained. This is not complete perception or human attention.';
 if(!observation.uncertainty.includes(note))observation.uncertainty.push(note);
 if(bytes(observation)>maxBytes&&observation.events.length){
  const events=observation.events,previous=coverage.events;
  const omit=count=>{
   observation.events=events.slice(count);coverage.events=previous+count;
   observation.source.gap=true;observation.source.retainedAfter=events[count-1].sequence;
  };
  // Avoid serializing a large full history once per omitted event. Find the
  // smallest suffix that fits, or omit all history before fitting summaries.
  omit(events.length);
  if(bytes(observation)<=maxBytes){
   let low=1,high=events.length;
   while(low<high){const mid=Math.floor((low+high)/2);omit(mid);if(bytes(observation)<=maxBytes)high=mid;else low=mid+1;}
   omit(low);
  }
 }
 // These strings repeat the authoritative play definition/progress. Preserve
 // every node and its canonical fields; disclose only the derived prose omitted.
 if(bytes(observation)>maxBytes){
  for(const node of Object.values(observation.nodes??{})){
   if(bytes(observation)<=maxBytes)break;
   if(node.play&&(Object.hasOwn(node,'instruction')||Object.hasOwn(node,'status'))){
    delete node.instruction;delete node.status;
    coverage.nodeSummaries=(coverage.nodeSummaries??0)+1;
   }
  }
 }
 while(bytes(observation)>maxBytes&&observation.focus?.some(signal=>!preserved.has(signal.actor))){
  const index=observation.focus.findIndex(signal=>!preserved.has(signal.actor));observation.focus.splice(index,1);coverage.focus++;
 }
 while(bytes(observation)>maxBytes&&observation.participants.some(participant=>!preserved.has(participant.actor))){
  const index=observation.participants.findLastIndex(participant=>!preserved.has(participant.actor));observation.participants.splice(index,1);coverage.participants++;
 }
 return bytes(observation)<=maxBytes;
}
