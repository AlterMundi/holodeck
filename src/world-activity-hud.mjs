import {spatialHudCatalog} from 'proyeccion/spatial-hud';
import {activityAuthor,activityStateLines,activityTime,activityTitle} from './world-history.mjs';

export const activityHudId='world-activity',activityHudWidth=2.78;
const path=name=>({'@path':'/'+name});
const row=(id,children,visible)=>({id,component:'HudRow',children,...(visible?{visible:path(visible)}:{})});
const text=(id,label,fields={})=>({id,component:'HudText',label,...fields});
const action=(name,fields={})=>({event:{name,context:{epoch:path('epoch'),pageRevision:path('pageRevision'),...fields}}});
const button=(id,label,fields={})=>({id,component:'HudButton',label,action:action(id),...fields});
const components=[
  {id:'root',component:'HudPanel',label:'Actividad del mundo',width:activityHudWidth,gap:.025,
    children:['heading','pageTools','count','item','metadata','tabs','details','actions','status']},
  row('heading',['title','close']),
  text('title','Actividad del mundo',{style:'title',weight:3}),
  button('close','Volver',{weight:1}),
  row('pageTools',['newer','refresh','older']),
  button('newer','Más nuevos',{disabled:path('noNewer')}),
  button('refresh','Actualizar',{disabled:path('busy')}),
  button('older','Más viejos',{disabled:path('noOlder')}),
  text('count',path('count'),{style:'body'}),
  {id:'item',component:'HudChoice',label:'Cambio',options:path('options'),value:path('selected'),
    draft:path('draft'),visible:path('hasItem'),disabled:path('busy'),action:action('item',{sequence:path('draft')})},
  text('metadata',path('metadata'),{visible:path('hasItem'),lines:2}),
  row('tabs',['recorded','current'],'hasItem'),
  button('recorded','Registrado',{pressed:path('recorded')}),
  button('current','Ahora',{pressed:path('current')}),
  text('details',path('details'),{visible:path('hasItem'),lines:5}),
  row('actions',['point','discuss'],'hasItem'),
  button('point','Señalar',{disabled:path('noPoint'),action:action('point',{selected:path('selected')})}),
  button('discuss','Conversar',{disabled:path('busy'),action:action('discuss',{selected:path('selected')})}),
  text('status',path('status'),{visible:path('hasStatus'),style:'status',lines:2}),
];
const statuses={current:'Conserva esa versión.',revised:'Cambió desde entonces.',deleted:'Fue retirado del mundo.',
  unavailable:'No hay un estado actual comparable.'};

export class WorldActivityHud{
  constructor({owner,send,focus}){
    Object.assign(this,{owner,send,focus,tab:'recorded',epoch:0});
  }

  message(type,content){this.send(type,content,activityHudId);}

  update(){
    const history=this.owner();
    if(!history?.native){
      if(this.group){
        this.message('deleteSurface',{});
        this.group=null;this.signature=null;this.painted=false;
        this.epoch++;this.tab='recorded';
      }
      return;
    }
    if(!this.group){
      this.message('createSurface',{catalogId:spatialHudCatalog.id});
      this.message('updateComponents',{components});
    }
    const data=history.data,item=history.selected,busy=Boolean(history.loading||history.pointBusy);
    const status=history.status||(data?.gaps.cursorEvicted?'Esa página ya no está disponible.':
      data?.gaps.earlierUnavailable||data?.gaps.missingSequences?'Hay cambios anteriores que ya no están disponibles.':
      data&&history.getState()?.sequence>data.currentThrough?'Hay cambios nuevos.':
      data&&!item?'No hay cambios en esta página.':'');
    const selected=item?String(item.sequence):'';
    const details=item?(this.tab==='recorded'?activityStateLines(item.recorded):
      [...activityStateLines(item.current.state),statuses[item.current.status]].filter(Boolean)).join('\n'):'';
    const value={epoch:this.epoch,pageRevision:history.epoch,busy,noNewer:busy||history.page===0,noOlder:busy||!data?.nextBefore,
      count:data?`${data.items.length} de ${data.retention.count} cambios conservados`:'',
      options:data?.items.map(record=>({id:String(record.sequence),
        label:activityTitle(record)+' · '+(record.recorded?.title||activityAuthor(record))}))??[],
      selected,hasItem:Boolean(item),metadata:item?`${activityAuthor(item)} · ${activityTime(item.time)}`:'',
      recorded:this.tab==='recorded',current:this.tab==='current',details,
      noPoint:busy||!item?.target||!item.current.actionable,status,hasStatus:Boolean(status)};
    const signature=JSON.stringify(value);
    if(signature!==this.signature){this.signature=signature;this.message('updateDataModel',{value});}
  }

  activate({name,context}){
    const history=this.owner();
    if(!this.group||!history?.native||context?.epoch!==this.epoch)return;
    if(name==='close'){history.close();return;}
    if(history.loading||history.pointBusy)return;
    const state=history.getState();
    if(context.pageRevision!==history.epoch||!state||
      (history.data&&(history.data.observer!==state.actorRef||history.data.run!==state.run))){
      history.message('La actividad cambió. Actualizala para seguir.');
      return;
    }
    switch(name){
      case 'newer':
        if(history.page>0)void history.fetchPage({before:history.cursors[history.page-1],page:history.page-1});
        break;
      case 'older':
        if(history.data?.nextBefore)void history.fetchPage({before:history.data.nextBefore,page:history.page+1});
        break;
      case 'refresh':void history.fetchPage({fresh:true});break;
      case 'item':
        if(typeof context.sequence==='string'&&/^[1-9][0-9]*$/.test(context.sequence)){
          history.select(Number(context.sequence));this.tab='recorded';
        }
        break;
      case 'recorded':
      case 'current':this.tab=name;break;
      case 'point':
      case 'discuss':
        if(context.selected!==String(history.selected?.sequence))return;
        if(name==='point')void history.point();else history.discuss();
        break;
    }
  }

  present(painted,launcher){
    const history=this.owner();
    if(!history)return;
    history.launcher.hidden=Boolean(painted&&(launcher||history.native));
    history.launcher.toggleAttribute('data-native-activity-open',Boolean(painted&&history.native));
    if(!history.native){this.painted=false;return;}
    if(!painted||!this.group){history.fallback();this.painted=false;return;}
    if(!this.painted){this.painted=true;this.focus('close');}
  }
}
