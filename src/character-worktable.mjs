import {characterReviewCamera} from './character-review-camera.mjs';
import {characterControlRole,openCharacterStudio} from './character-studio.mjs';

const previewHeight=.58;

export class CharacterWorktable {
  reviewScale=previewHeight/characterReviewCamera.rigHeight;
  constructor({document,scene,setAngle}){
    Object.assign(this,{document,scene,setAngle,available:false,anchor:null});
    this.firstControl='play';
    this.controlRole=characterControlRole;
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
    return {...origin,y:origin.y+characterReviewCamera.targetHeight*this.reviewScale};
  }

  start({send,close,ownsTextInput}){
    this.viewer=openCharacterStudio(this.document,{scene:this.scene,origin:this.previewOrigin,
      height:previewHeight,setAngle:this.setAngle,send,close,ownsTextInput});
  }

  stop(){
    this.viewer?.dispose();
    this.viewer=null;
  }

  setLayout(width,height,short){return this.viewer?.setTableLayout(width,height,short);}
  currentPose(){return this.viewer?.currentPose()??null;}
  action(requested){this.viewer?.dispatch(requested);}
  render(now){this.viewer?.render(now);}
}
