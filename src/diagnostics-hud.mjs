import {spatialHudCatalog} from 'proyeccion/spatial-hud';

export const diagnosticsId='world-diagnostics',diagnosticsWidth=2.55;
const path=key=>({'@path':'/'+key});
const button=(id,label)=>({id,component:'HudButton',label,action:{event:{name:id}}});
const text=(id,label,fields={})=>({id,component:'HudText',label,...fields});
const detail=['phases','overhead','graphics','scene','package','legend'];
const components=[
  {id:'root',component:'HudPanel',label:'Rendimiento',width:diagnosticsWidth,gap:.014,
    children:['heading','speed','memory',...detail]},
  {id:'heading',component:'HudRow',children:['title','detail','close']},
  text('title','Rendimiento',{style:'title',weight:2}),
  button('detail',path('detailLabel')),button('close','Cerrar'),
  text('speed',path('speed'),{style:'status'}),text('memory',path('memory')),
  ...detail.slice(0,-1).map(id=>text(id,path(id),{visible:path('expanded')})),
  text('legend','Fases en CPU · GPU sólo del mundo',{visible:path('expanded'),style:'status'}),
];

export class DiagnosticsHud {
  constructor({monitor,send,focus}){
    Object.assign(this,{monitor,send,focus});
  }

  open(){
    if(this.mode)return;
    this.mode='summary';
    this.monitor.setMode(this.mode);
    this.send('createSurface',{catalogId:spatialHudCatalog.id},diagnosticsId);
    this.send('updateComponents',{components},diagnosticsId);
    this.update();
    this.focus('detail');
  }

  activate({name}){
    if(!this.mode)return;
    if(name==='close'){this.close();return;}
    if(name==='detail'){
      this.mode=this.mode==='summary'?'detail':'summary';
      this.monitor.setMode(this.mode);
      this.update();
    }
  }

  update(){
    if(!this.mode)return;
    const sample=this.monitor.snapshot();
    if(sample===this.sample&&this.mode===this.presentedMode)return;
    this.sample=sample;
    this.presentedMode=this.mode;
    this.send('updateDataModel',{value:{...sample,expanded:this.mode==='detail',
      detailLabel:this.mode==='detail'?'Resumen':'Detalle'}},diagnosticsId);
  }

  close(){
    if(!this.mode)return;
    this.mode=this.group=null;
    this.monitor.setMode(null);
    this.send('deleteSurface',{},diagnosticsId);
  }
}
