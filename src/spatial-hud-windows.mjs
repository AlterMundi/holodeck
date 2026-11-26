import {Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import {placeHudInViewport} from 'proyeccion/spatial-hud';

const pad=8;
const clamp=(value,min,max)=>Math.max(min,Math.min(Math.max(min,max),value));
const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};

const edges=({width,height,insets={}})=>({
  left:(insets.left??0)+pad,right:width-(insets.right??0)-pad,
  top:(insets.top??0)+pad,bottom:height-(insets.bottom??0)-pad,
});
const fitScale=(view,bounds)=>{
  const {left,right,top,bottom}=edges(view);
  return Math.max(1,Math.min((right-left)/(bounds.right-bounds.left),(bottom-top)/(bounds.top-bounds.bottom)));
};
export function placeHudWindow(view,bounds,requested){
  const {left,right,top,bottom}=edges(view);
  const limit=fitScale(view,bounds);
  const scale=clamp(requested.scale,Math.min(65,limit),limit);
  return {
    scale,x:clamp(requested.x,left-bounds.left*scale,right-bounds.right*scale),
    y:clamp(requested.y,top+bounds.top*scale,bottom+bounds.bottom*scale),
  };
}

export class SpatialHudWindows{
  constructor({canvas,scene,camera,hit,dismissChoice,invalidate}){
    Object.assign(this,{canvas,scene,camera,hit,dismissChoice,invalidate,panels:new Map(),geometry:new Map()});
    this.events=new AbortController();
    this.marks=new Map();
    const options={capture:true,passive:false,signal:this.events.signal};
    for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])
      canvas.addEventListener(type,this[type].bind(this),options);
  }

  begin(){this.geometry.clear();}
  place(id,view,bounds,placement,resizable){
    if(!bounds||view.width<=2*pad||view.height<=2*pad)return placement;
    const placementKey=view.placementVariant?id+':'+view.placementVariant:view.insets?id+':insets':id;
    const saved=this.panels.get(placementKey);
    const requested=saved?{x:saved.x*view.width,y:saved.y*view.height,scale:saved.scale}:placement;
    const actual=placeHudWindow(view,bounds,requested);
    const {x,y,scale}=actual;
    const rect={left:x+bounds.left*scale,right:x+bounds.right*scale,
      top:y-bounds.top*scale,bottom:y-bounds.bottom*scale};
    this.geometry.set(id,{view,bounds,actual,rect,resizable,placementKey});
    if(resizable){
      const mark=this.marks.get(id)??this.resizeMark(id);
      const signature=[view.width,view.height,rect.right,rect.bottom].join(':');
      if(!mark.visible||mark.userData.placement!==signature){
        mark.visible=true;
        mark.userData.placement=signature;
        placeHudInViewport(mark,this.camera,{...view,x:rect.right-9,y:rect.bottom-9,pixelsPerUnit:1,depth:.89});
        this.invalidate();
      }
    }
    return actual;
  }

  end(){
    for(const [id,mark] of this.marks){
      if(mark.visible&&!this.geometry.get(id)?.resizable){
        mark.visible=false;
        this.invalidate();
      }
    }
    if(this.drag){
      const current=this.geometry.get(this.drag.id),original=this.drag.info;
      if(!current||current.placementKey!==original.placementKey||
        current.view.width!==original.view.width||current.view.height!==original.view.height)this.cancelDrag();
    }
  }

  resizeMark(id){
    const group=new Group();
    group.name='Window resize · '+id;
    const dark=new MeshBasicMaterial({color:0x10252e,depthWrite:false,depthTest:false,toneMapped:false,transparent:true});
    const light=new MeshBasicMaterial({color:0xd5edea,depthWrite:false,depthTest:false,toneMapped:false,transparent:true});
    for(const [length,x,y] of [[12,-3,1],[7,0,-2]]){
      for(const [material,width,z] of [[dark,3,0],[light,1.3,.01]]){
        const mark=new Mesh(new PlaneGeometry(length,width),material);
        mark.position.set(x,y,z);
        mark.rotation.z=Math.PI/4;
        mark.renderOrder=material===light?12:11;
        group.add(mark);
      }
    }
    this.scene.add(group);this.marks.set(id,group);
    return group;
  }

  pointerdown(event){
    if(event.button!==0||event.isPrimary===false||this.drag)return;
    const box=this.canvas.getBoundingClientRect(),x=event.clientX-box.left,y=event.clientY-box.top;
    const hit=this.hit(event);
    // Actionable targets keep ownership of their own press, including disabled controls.
    if(typeof hit==='string'&&hit.includes(':'))return;
    for(const [id,info] of [...this.geometry].reverse()){
      const {rect,resizable}=info;
      if(x<rect.left||x>rect.right||y<rect.top||y>rect.bottom)continue;
      const resizing=resizable&&x>=rect.right-26&&y>=rect.bottom-26;
      if(!resizing&&y>rect.top+26)return;
      const dismissed=this.dismissChoice?.(id)===true;
      this.drag={id,pointer:event.pointerId,x:event.clientX,y:event.clientY,info,resizing,dismissed};
      this.canvas.setPointerCapture(event.pointerId);
      event.preventDefault();event.stopImmediatePropagation();
      return;
    }
  }

  pointermove(event){
    const drag=this.drag;
    if(!drag||drag.pointer!==event.pointerId)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(drag.dismissed)return;
    const {view,bounds,actual}=drag.info;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    let requested={...actual,x:actual.x+dx,y:actual.y+dy};
    if(drag.resizing){
      const extentX=bounds.right-bounds.left,extentY=bounds.top-bounds.bottom;
      const limit=Math.min(330,fitScale(view,bounds));
      const scale=clamp(actual.scale+(dx*extentX+dy*extentY)/(extentX**2+extentY**2),Math.min(65,limit),limit);
      requested={scale,x:actual.x+bounds.left*(actual.scale-scale),y:actual.y-bounds.top*(actual.scale-scale)};
    }
    this.save(drag.id,drag.info,requested);
  }

  pointerup(event){
    if(this.drag?.pointer!==event.pointerId)return;
    this.drag=null;
    if(this.canvas.hasPointerCapture(event.pointerId))this.canvas.releasePointerCapture(event.pointerId);
    event.preventDefault();event.stopImmediatePropagation();
  }
  cancelDrag(){
    const pointer=this.drag?.pointer;
    this.drag=null;
    if(pointer!==undefined&&this.canvas.hasPointerCapture(pointer))this.canvas.releasePointerCapture(pointer);
  }

  pointercancel(event){this.pointerup(event);}
  lostpointercapture(event){if(this.drag?.pointer===event.pointerId)this.drag=null;}

  key(id,event){
    const direction=directions[event.key],info=this.geometry.get(id);
    if(!direction||!info||!event.altKey||event.ctrlKey||event.metaKey)return false;
    const {actual}=info;
    const [x,y]=direction;
    if(event.shiftKey&&!info.resizable)return false;
    this.save(id,info,event.shiftKey?{...actual,scale:actual.scale+(x-y)*8}
      :{...actual,x:actual.x+10*x,y:actual.y+10*y});
    return true;
  }

  save(id,info,requested){
    const {view,bounds}=info;
    const {x,y,scale}=placeHudWindow(view,bounds,requested);
    this.panels.set(info.placementKey,{x:x/view.width,y:y/view.height,scale});
    this.invalidate();
  }

  dispose(){
    this.cancelDrag();
    this.events.abort();
    for(const mark of this.marks.values()){
      mark.removeFromParent();
      const materials=new Set();
      mark.traverse(object=>{object.geometry?.dispose();if(object.material)materials.add(object.material);});
      for(const material of materials)material.dispose();
    }
  }
}
