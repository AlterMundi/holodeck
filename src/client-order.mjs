// Responses may arrive out of request order. Only the latest issued state read
// can apply; within the same actor/room/edition its semantic cursor cannot regress.
export function snapshotMayApply(current,next,request,latest){
  if(request!==latest||!next||typeof next.actorRef!=='string'||typeof next.run!=='string'||typeof next.edition!=='string'||!Number.isSafeInteger(next.sequence)||next.sequence<0)return false;
  const same=current&&current.actorRef===next.actorRef&&current.run===next.run&&current.edition===next.edition;
  return !same||next.sequence>=current.sequence;
}
export const sameRequest=(current,id)=>!!current&&current.id===id;
