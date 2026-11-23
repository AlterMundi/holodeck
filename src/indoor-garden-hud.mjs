import {signalColourName} from './playable-creations.mjs';

const COLORS=['#8ce4c2','#efc87a','#e8a2b9','#a77bea'];
const POLL_MS=1800;
const READ_DEADLINE_MS=5000;
const STYLE=`
#indoor-garden{position:fixed;z-index:21;left:max(14px,env(safe-area-inset-left));top:max(130px,calc(env(safe-area-inset-top) + 120px));width:310px;max-width:calc(100vw - 28px);max-height:44dvh;overflow:auto;overscroll-behavior:contain;padding:4px 13px;border-radius:16px;font-size:14px}
#indoor-garden summary{cursor:pointer;min-height:44px;align-content:center;color:var(--gold);overflow-wrap:anywhere}
#indoor-garden-progress{color:var(--mint);margin:0 0 9px}
#indoor-garden-choice{margin:0 0 4px}
#indoor-garden-colors,#indoor-garden-targets{display:flex;gap:5px;flex-wrap:wrap;margin:0 0 9px}
#indoor-garden button{min-width:44px;padding:5px 8px;font-size:13px}
#indoor-garden-colors button{color:var(--signal-color);border-color:var(--line)}
#indoor-garden-colors button[aria-pressed=true]{border-color:var(--signal-color);background:#245153}
#indoor-garden-targets button{flex:1 1 100%;text-align:left}
#indoor-garden-targets button[data-lit=true]{color:var(--mint)}
#indoor-garden[hidden],#indoor-garden [hidden]{display:none}
.room-transition #indoor-garden,body:has(#conversation-panel:not([hidden])) #indoor-garden,body:has(#content-visit:not([hidden]):not(.is-walking)) #indoor-garden{display:none}
@media(max-width:740px){#indoor-garden{top:max(116px,calc(env(safe-area-inset-top) + 104px));left:max(12px,env(safe-area-inset-left));width:min(272px,calc(100vw - 24px));max-height:39dvh}}
`;

const hide=(element,value)=>{if(element.hidden!==value)element.hidden=value;};
const write=(element,value)=>{if(element.textContent!==value)element.textContent=value;};
const near=(point,target,margin)=>point&&Math.abs(point.y-.1)<1.15&&
  Math.hypot(point.x-target.x,point.z-target.z)<=target.radius+margin;

function element(tag,id){
  const node=document.createElement(tag);
  if(id)node.id=id;
  return node;
}

export class IndoorGardenHUD {
  constructor({read,act,position,onError=()=>{}}){
    Object.assign(this,{read,act,position,onError});
    this.room=null;
    this.game=null;
    this.selectedColor=null;
    this.reading=null;
    this.sending=null;
    this.nextRead=0;
    this.anchorButtons=[];
    this.style=element('style');
    this.style.textContent=STYLE;
    document.head.append(this.style);
    this.panel=element('details','indoor-garden');
    this.panel.className='glass';
    this.panel.hidden=true;
    this.summary=element('summary');
    this.progress=element('p','indoor-garden-progress');
    this.progress.setAttribute('role','status');
    this.choice=element('p','indoor-garden-choice');
    this.choice.textContent='Elegí el color de la luz.';
    this.colors=element('div','indoor-garden-colors');
    this.colors.setAttribute('role','group');
    this.colors.setAttribute('aria-label','Color de la luz');
    this.colorButtons=COLORS.map(color=>{
      const button=element('button');
      button.type='button';
      button.style.setProperty('--signal-color',color);
      button.textContent=signalColourName(color);
      button.onclick=()=>{
        this.selectedColor=color;
        this.draw();
      };
      this.colors.append(button);
      return button;
    });
    this.targets=element('div','indoor-garden-targets');
    this.targets.setAttribute('role','group');
    this.targets.setAttribute('aria-label','Círculos del jardín');
    this.panel.append(this.summary,this.progress,this.choice,this.colors,this.targets);
    document.body.append(this.panel);
  }

  enter(room){
    this.reading?.abort();
    this.reading=null;
    this.sending=null;
    this.room=room;
    this.game=null;
    this.selectedColor=null;
    this.nextRead=0;
    this.panel.open=false;
    hide(this.panel,true);
  }

  update(spaceId){
    const room=spaceId&&spaceId!=='outside'?spaceId:null;
    if(room!==this.room)this.enter(room);
    if(!room||document.hidden)return;
    if(!this.reading&&!this.sending&&performance.now()>=this.nextRead)void this.refresh();
    this.draw();
  }

  async refresh(){
    if(!this.room||this.reading)return;
    const room=this.room;
    const controller=new AbortController();
    this.reading=controller;
    this.nextRead=performance.now()+POLL_MS;
    const timer=setTimeout(()=>controller.abort(),READ_DEADLINE_MS);
    try{
      const game=await this.read(room,{signal:controller.signal});
      if(this.reading===controller){
        this.game=game?.room===room&&!controller.signal.aborted?game:null;
        this.draw();
      }
    }catch{
      if(this.reading===controller){
        this.game=null;
        this.draw();
      }
    }finally{
      clearTimeout(timer);
      if(this.reading===controller)this.reading=null;
    }
  }

  draw(){
    const game=this.game;
    const point=game?this.position():null;
    const visible=!!game?.targets.some(target=>near(point,target,2.6));
    hide(this.panel,!visible);
    if(!visible){
      this.panel.open=false;
      return;
    }
    const status=game.progress;
    const canPlay=game.canPlay!==false;
    write(this.summary,(canPlay?'Jugar · ':'Ver · ')+game.title);
    write(this.progress,status.complete?'¡Jardín completado!':
      `${status.filledTargets}/${status.totalTargets} señales · ${status.contributors}/${status.minContributors} colaboradores`);
    hide(this.choice,!canPlay||status.complete);
    hide(this.colors,!canPlay||status.complete);
    for(const [index,button] of this.colorButtons.entries()){
      const selected=String(this.selectedColor===COLORS[index]);
      if(button.getAttribute('aria-pressed')!==selected)button.setAttribute('aria-pressed',selected);
    }
    if(game.targets.length!==this.anchorButtons.length){
      this.anchorButtons=game.targets.map((_,index)=>{
        const button=element('button');
        button.type='button';
        button.onclick=()=>void this.signal(index);
        return button;
      });
      this.targets.replaceChildren(...this.anchorButtons);
    }
    for(const [index,button] of this.anchorButtons.entries()){
      const target=game.targets[index],signal=game.signals[index];
      const matched=!!signal&&signalColourName(signal.color)===signalColourName(target.color);
      const close=near(point,target,1);
      const colour=signalColourName(target.color);
      const label=`Círculo ${index+1} · ${colour}`;
      write(button,matched?(canPlay&&close&&!status.complete?`Aportar · ${label}`:`${label} · listo`):
        canPlay&&close?`Encender · ${label}`:canPlay?`${label} · acercate`:label);
      const disabled=!canPlay||!!this.sending||!this.selectedColor||!close||status.complete;
      if(button.disabled!==disabled)button.disabled=disabled;
      if(button.dataset.lit!==String(matched))button.dataset.lit=String(matched);
    }
  }

  async signal(index){
    const game=this.game;
    if(!game||game.canPlay===false||this.sending||!this.selectedColor||game.progress.complete||
       !near(this.position(),game.targets[index],1))return;
    const pending={};
    this.sending=pending;
    this.reading?.abort();
    this.reading=null;
    this.draw();
    try{
      const outcome=await this.act({type:'garden.signal',id:crypto.randomUUID(),room:this.room,
        expectedRevision:game.revision,index,color:this.selectedColor});
      if(outcome===null||outcome===false||outcome?.ok===false)throw Error('Signal was refused');
    }catch{
      if(this.sending===pending)this.onError('No pude confirmar la señal. Revisá las luces antes de volver a intentar.');
    }finally{
      if(this.sending===pending){
        this.nextRead=0;
        await this.refresh();
        if(this.sending===pending){
          this.sending=null;
          this.draw();
        }
      }
    }
  }

  dispose(){
    this.enter(null);
    this.panel.remove();
    this.style.remove();
  }
}
