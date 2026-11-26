export class AtelierTable {
  constructor(document, address) {
    this.address=address;
    this.button=document.querySelector('#atelier-table');
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
    const near=Boolean(anchor&&position&&Math.hypot(anchor.x-position.x,anchor.z-position.z)<=2.4);
    if(!near||this.room!==space?.id)this.close();
    this.room=space?.id;
    this.button.hidden=!near;
  }
}
