const doubleTapWindow=340;
const holdTime=180;

export function bindFlightSpaceGesture({allowed,onFlight,onDoubleJump,clock=()=>performance.now()}){
  let first=-Infinity,second=null;
  function cancel(){
    if(second)clearTimeout(second.timer);
    first=-Infinity;
    second=null;
  }
  function down(event){
    if(event.code!=='Space'||event.repeat||!allowed(event))return;
    const now=clock();
    if(now-first>=doubleTapWindow){first=now;return;}
    second={started:now,timer:setTimeout(()=>{
      const armed=second;
      cancel();
      if(armed&&allowed(event))onFlight();
    },holdTime)};
    first=-Infinity;
  }
  function up(event){
    if(event.code!=='Space'||!second)return;
    const held=clock()-second.started>=holdTime;
    cancel();
    if(!allowed(event))return;
    if(held)onFlight();
    else onDoubleJump();
  }
  return {down,up,cancel};
}
