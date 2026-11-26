import {openCharacterStudio} from './character-studio.mjs';

const previewHeight=.58;

export class CharacterWorktable {
  constructor({document,scene,setAngle}){
    Object.assign(this,{document,scene,setAngle,available:false,anchor:null});
    this.firstControl='Pose';
  }

  update(player,anchor){
    this.anchor=anchor;
    this.available=Boolean(player&&anchor&&Math.hypot(player.x-anchor.x,player.z-anchor.z)<2.05);
  }

  get previewOrigin(){
    const {x,y,z}=this.anchor;
    return {x:x+.34,y:y+.025,z};
  }

  get reviewCameraTarget(){
    if(!this.anchor)return null;
    const origin=this.previewOrigin;
    // Leave the top of the figure clear of the compact HUD.
    return {...origin,y:origin.y+previewHeight*2/3};
  }

  start({send,close,ownsTextInput}){
    this.viewer=openCharacterStudio(this.document,{scene:this.scene,origin:this.previewOrigin,
      height:previewHeight,setAngle:this.setAngle,send,close,ownsTextInput});
  }

  stop(){
    this.viewer?.dispose();
    this.viewer=null;
  }

  setShortLayout(short){this.viewer?.setShortTableLayout(short);}
  currentPose(){return this.viewer?.currentPose()??null;}
  action(requested){this.viewer?.dispatch(requested);}
  render(now){this.viewer?.render(now);}
}
