import {openCharacterStudio} from './character-studio.mjs';

export class CharacterWorktable {
  constructor({document,scene}){
    Object.assign(this,{document,scene,available:false,anchor:null});
    this.firstControl='Pose';
  }

  update(player,anchor){
    this.anchor=anchor;
    this.available=Boolean(player&&anchor&&Math.hypot(player.x-anchor.x,player.z-anchor.z)<2.05);
  }

  start({send,close,isEditing}){
    this.viewer=openCharacterStudio(this.document,{scene:this.scene,anchor:this.anchor,height:.58,send,close,isEditing});
  }

  stop(){
    this.viewer?.dispose();
    this.viewer=null;
  }

  action(requested){this.viewer?.dispatch(requested);}
  render(now){this.viewer?.render(now);}
}
