export class AtelierTable {
  constructor(document, address) {
    this.address=address;
    this.button=document.querySelector('#atelier-table');
    this.widget=document.querySelector('#atelier-widget');
    this.dialog=document.querySelector('#atelier-panel');
    this.stage=document.querySelector('#atelier-panel-stage');
    this.button.onclick=()=>this.open();
    this.dialog.querySelector('button').onclick=()=>this.close();
    this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});
  }

  get opened(){return this.dialog.open;}

  open(){
    if(this.opened||this.button.hidden)return;
    const frame=this.button.ownerDocument.createElement('iframe');
    frame.title='Mesa compartida de Atelier';
    frame.allow="camera 'none'; microphone 'none'; geolocation 'none'";
    frame.src=this.address;
    this.stage.replaceChildren(frame);
    this.dialog.showModal();
  }

  close(){
    if(!this.opened)return;
    this.stage.replaceChildren();
    this.dialog.close();
    if(!this.button.hidden)this.button.focus();
  }

  update(space, position){
    const table=space?.atelierTable&&space.objects?.find(object=>object.id===space.atelierTable);
    const anchor=table?.position;
    const reach=space?.atelierTableReach??2.4;
    const near=Boolean(anchor&&position&&Math.hypot(anchor.x-position.x,anchor.z-position.z)<=reach);
    let closest,distance=Infinity;
    if(position)for(const widget of space?.atelierWidgets??[]){
      const offset=Math.hypot(widget.position.x-position.x,widget.position.z-position.z);
      if(offset<=widget.reach&&offset<distance){closest=widget;distance=offset;}
    }
    const tools=near&&closest?.action==='open-workbench';
    const label=tools?'Abrir herramientas de Atelier':'Abrir mesa de Atelier';
    const information=closest&&(!tools?`${closest.title} · Sin acción conectada`:'');
    if(this.button.textContent!==label)this.button.textContent=label;
    if(this.widget.textContent!==(information||''))this.widget.textContent=information||'';
    this.widget.hidden=!information;
    if(!near||this.room!==space?.id)this.close();
    this.room=space?.id;
    this.button.hidden=!near;
  }
}
