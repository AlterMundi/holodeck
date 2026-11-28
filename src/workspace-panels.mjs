// Open state is separate from presentation so switching views keeps the
// Conversation iframe, map selection and active table session intact.
export class WorkspacePanels {
  constructor(compact){
    this.compact=compact;
    this.order=[];
  }

  opened(panel){return this.order.includes(panel);}
  foreground(){return this.order.at(-1);}
  visible(panel){return this.opened(panel)&&(!this.compact()||this.foreground()===panel);}

  set(panel,open){
    this.order=this.order.filter(item=>item!==panel);
    if(open)this.order.push(panel);
  }
}
