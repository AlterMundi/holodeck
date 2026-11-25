import {AmbientLight, Group, Matrix4} from 'three';
import {createHudMaterialShell} from './hud-material-shell.mjs';

const looks={
  taller:{frame:'#1c282b',accent:'#7d9994',radius:.11,thickness:.055,roughness:.78,
    markers:null,quiet:true,surfaces:['matter-worktable']},
  cabina:{frame:'#213232',accent:'#87dbc9',radius:.048,thickness:.19,roughness:.51,markers:[.12,.054],chamfer:true},
  orbita:{frame:'#142e36',accent:'#d6ed9c',radius:.075,thickness:.10,roughness:.22,markers:[.062,.020]},
  umbral:{frame:'#36223f',accent:'#e9b8ff',radius:.090,thickness:.075,roughness:.24,markers:[.14,.033]},
  pulso:{frame:'#45263c',accent:'#ffb38a',radius:.027,thickness:.15,roughness:.30,markers:[.108,.070]},
  estratos:{frame:'#173e42',accent:'#a1efda',radius:.045,thickness:.19,roughness:.67,markers:[.039,.085]},
};

export function selectedHudLook(url){
  const name=new URL(url).searchParams.get('hud-look');
  return Object.hasOwn(looks,name)?name:null;
}

// These are decorative backing meshes. A2UI keeps its original surfaces,
// stable pointer targets and keyboard focus throughout transitions.
export class HudLookPreview{
  constructor({document,parent,invalidate}){
    Object.assign(this,{invalidate,parent,panels:new Map(),turn:new Matrix4()});
    this.name=document.body.dataset.hudLook;
    this.look=looks[this.name];
    if(!this.look)return;
    this.stylesDock=!this.look.surfaces;
    this.reduced=document.defaultView.matchMedia('(prefers-reduced-motion: reduce)');
    this.light=new AmbientLight('#ffffff',this.look.quiet?1:1.55);
    parent.add(this.light);
  }

  hit(key){
    const panel=this.panels.get(key);
    if(panel&&!this.reduced.matches){panel.hit=performance.now();this.invalidate();}
  }

  redock(key){
    const panel=this.panels.get(key);
    if(panel&&!this.reduced.matches){panel.appeared=performance.now();this.invalidate();}
  }

  draw(key,source,bounds){
    if(!this.look||this.look.surfaces&&!this.look.surfaces.includes(key))return;
    let panel=this.panels.get(key);
    const now=performance.now();
    if(source?.visible&&bounds){
      if(!panel){
        const anchor=new Group(),shell=createHudMaterialShell(this.look);
        anchor.matrixAutoUpdate=false;
        anchor.add(shell.group);
        this.parent.add(anchor);
        panel={anchor,shell,appeared:now,transform:new Matrix4()};
        this.panels.set(key,panel);
      }
      source.updateWorldMatrix(true,false);
      panel.transform.copy(this.parent.matrixWorld).invert().multiply(source.matrixWorld);
      panel.bounds=bounds;
      if(panel.leaving!==undefined){panel.leaving=undefined;panel.appeared=now;}
    }else if(panel)panel.leaving??=now;
    if(!panel)return;

    const still=this.reduced.matches;
    const inT=still?1:Math.min(1,(now-panel.appeared)/235);
    const outT=panel.leaving===undefined?0:still?1:Math.min(1,(now-panel.leaving)/160);
    if(outT===1){
      panel.shell.dispose();panel.anchor.removeFromParent();this.panels.delete(key);this.invalidate();return;
    }
    const click=still?0:Math.max(0,1-(now-(panel.hit??-Infinity))/220);
    const eased=1-(1-inT)**3;
    const angle=((1-eased)*.33-outT*.54)*(this.look.quiet?.35:1);
    const rocking=(Math.sin(inT*Math.PI*2)*(1-inT)*.52+Math.sin(click*Math.PI*2)*click*.33)*
      (this.look.quiet?.17:1);
    const active=inT<1||outT>0||click>0;
    panel.anchor.matrix.copy(panel.transform).multiply(this.turn.makeRotationX(angle));
    panel.anchor.matrixWorldNeedsUpdate=true;
    panel.shell.update(panel.bounds,{effects:!still,wave:rocking,lightLevel:click*.75+(1-inT)*.5});
    if(active||panel.animated||source!==panel.source)this.invalidate();
    panel.animated=active;
    panel.source=source;
  }

  dispose(){
    for(const {shell,anchor} of this.panels.values()){shell.dispose();anchor.removeFromParent();}
    this.panels.clear();
    this.light?.removeFromParent();
  }
}
