import {hudAppearanceKey,readHudAppearance} from './hud-appearance.mjs';
import {AmbientLight, Group, Matrix4} from 'three';
import {createHudMaterialShell, createInstrumentGlass} from './hud-material-shell.mjs';

const instrumentSurfaces=new Set(['matter-worktable','world-toolbelt','world-header',
  'world-map','conversation-header','world-settings']);

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
    this.document=document;
    this.name=document.body.dataset.hudLook;
    this.look=looks[this.name];
    this.reduced=document.defaultView.matchMedia('(prefers-reduced-motion: reduce)');
    if(!this.look)return;
    this.stylesDock=!this.look.surfaces;
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
    const light=this.document.body.dataset.hudTheme==='light';
    if(this.lightBase!==light){
      this.clearPanels();
      this.lightBase=light;
      this.invalidate();
    }
    if(light||!this.look){
      this.drawInstrument(key,source,bounds);
      return;
    }
    if(this.look.surfaces&&!this.look.surfaces.includes(key))return;
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

  drawInstrument(key,source,bounds){
    if(!instrumentSurfaces.has(key))return;
    let panel=this.panels.get(key);
    let visible=Boolean(source&&bounds);
    for(let node=source;node&&visible;node=node.parent)visible=node.visible;
    if(!visible){
      if(panel?.anchor.visible){panel.anchor.visible=false;this.invalidate();}
      return;
    }
    const theme=hudAppearanceKey(this.document);
    if(this.instrumentTheme!==theme){
      this.instrumentTheme=theme;
      this.instrumentColors=readHudAppearance(this.document).glass;
      this.invalidate();
    }
    if(!panel){
      const anchor=new Group(),shell=createInstrumentGlass();
      anchor.matrixAutoUpdate=false;
      anchor.renderOrder=-1;
      anchor.add(shell.group);
      this.parent.add(anchor);
      panel={anchor,shell};
      this.panels.set(key,panel);
      this.invalidate();
    }
    source.updateWorldMatrix(true,false);
    this.turn.copy(this.parent.matrixWorld).invert().multiply(source.matrixWorld);
    const extent=[bounds.left,bounds.right,bounds.top,bounds.bottom].join(':');
    if(!panel.anchor.visible||!panel.anchor.matrix.equals(this.turn)||panel.extent!==extent){
      panel.anchor.visible=true;
      panel.anchor.matrix.copy(this.turn);
      panel.anchor.matrixWorldNeedsUpdate=true;
      panel.extent=extent;
      this.invalidate();
    }
    const pulse=this.reduced.matches?0:Math.max(0,1-(performance.now()-(panel.hit??-Infinity))/210);
    panel.shell.update(bounds,{colors:this.instrumentColors,compact:key==='world-toolbelt'||key==='world-header',lightLevel:pulse});
    if(pulse||panel.animated)this.invalidate();
    panel.animated=Boolean(pulse);
  }

  clearPanels(){
    for(const {shell,anchor} of this.panels.values()){shell.dispose();anchor.removeFromParent();}
    this.panels.clear();
  }

  dispose(){
    this.clearPanels();
    this.light?.removeFromParent();
  }
}
