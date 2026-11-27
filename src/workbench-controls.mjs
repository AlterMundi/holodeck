import {BoxGeometry,CanvasTexture,CylinderGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,
  PlaneGeometry,Raycaster,SRGBColorSpace,Vector3} from 'three';

const panelFinish=0x17242a, brass=0xbc9b5d, signal=0x8be1d5;
const clamp=value=>Math.max(0,Math.min(1,value));
const binding=value=>value?.['@path'];
const read=(data,value)=>binding(value)?data[binding(value).slice(1)]:value;
const physical={HudRange:'range',HudButton:'button'};
const pageControls=/^(?:station_back|station_next|host_\d+|retry)$/;
const sweep=1.5*Math.PI;

function mesh(group,geometry,color,x,y,z,metalness=.22){
  const object=new Mesh(geometry,new MeshStandardMaterial({color,metalness,roughness:.46}));
  object.position.set(x,y,z);
  group.add(object);
  return object;
}
function release(group){
  group.traverse(object=>{
    object.geometry?.dispose();
    object.material?.map?.dispose();
    object.material?.dispose();
  });
  group.removeFromParent();
}

export function workbenchItems(view){
  return view.components.flatMap(row=>{
    const kind=physical[row.component];
    if(!kind||row.disabled||pageControls.test(row.id))return [];
    const value=read(view.data,row.value);
    if(kind==='range'&&(![value,row.min,row.max,row.step].every(Number.isFinite)||row.max<=row.min||row.step<=0))return [];
    // The panel owns all labels, bounds, and action identities. The style is
    // presentation only and can be supplied by any surface using this catalog.
    const style=kind==='range'?(row.presentation==='fader'?'fader':'knob'):'key';
    return [{id:row.id,label:row.label,value,style,kind,min:row.min,max:row.max,step:row.step,
      gestureKey:row.gestureKey,pressed:row.pressed===true,toggle:typeof row.pressed==='boolean'}];
  }).slice(0,6);
}

export function quantizeBenchValue(item,value){
  const {min,max,step}=item;
  if(value<=min)return min;
  if(value>=max)return max;
  return Math.min(max,Number((min+Math.round((value-min)/step)*step).toPrecision(14)));
}

export function mountWorkbenchControls({document,scene,bench,eye,pointerTarget,rayForPointer,onAction}){
  const root=new Group();
  root.name='A2UI workbench controls';
  root.position.set(bench.x,bench.y+.018,bench.z);
  // The physical bench is fixed in room coordinates. Rotate the modules by
  // half a turn only so labels face the approach without leaving the bench.
  if(eye.z<bench.z)root.rotation.y=Math.PI;
  scene.add(root);
  const accessible=document.createElement('div');
  accessible.setAttribute('aria-label','Controles de la mesa');
  accessible.setAttribute('role','group');
  accessible.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)';
  pointerTarget.append(accessible);
  const raycast=new Raycaster(),handlers=new AbortController();
  const options={capture:true,signal:handlers.signal};
  const items=new Map();
  let capture=null,suppressClick=false;
  const consume=event=>{event.preventDefault();event.stopImmediatePropagation();};
  const pick=event=>{
    const ray=rayForPointer(event)?.ray;
    if(!ray)return null;
    raycast.ray.copy(ray);
    const targets=Array.from(items.values(),item=>item.pick);
    return raycast.intersectObjects(targets,false)[0]?.object.userData.item??null;
  };

  function create(item){
    const plate=new Group();
    plate.name=item.label;
    root.add(plate);
    const base=mesh(plate,new BoxGeometry(.45,.045,.37),panelFinish,0,.025,0);
    base.userData.item=item.id;
    const canvas=document.createElement('canvas');
    canvas.width=512;canvas.height=128;
    const texture=new CanvasTexture(canvas);
    texture.colorSpace=SRGBColorSpace;
    const label=new Mesh(new PlaneGeometry(.42,.105),new MeshBasicMaterial({map:texture,toneMapped:false}));
    label.rotation.x=-Math.PI/2;
    label.position.set(0,.05,.126);
    plate.add(label);
    let moving;
    if(item.style==='knob'){
      mesh(plate,new CylinderGeometry(.096,.104,.012,36),brass,0,.057,-.046);
      moving=new Group();
      moving.position.set(0,.075,-.046);
      plate.add(moving);
      mesh(moving,new CylinderGeometry(.062,.073,.045,36),0x304348,0,0,0);
      mesh(moving,new BoxGeometry(.012,.003,.051),signal,0,.024,.022);
    }else if(item.style==='fader'){
      mesh(plate,new BoxGeometry(.025,.01,.186),0x090f13,0,.054,-.052);
      moving=mesh(plate,new BoxGeometry(.086,.031,.034),brass,0,.074,-.048);
      mesh(moving,new BoxGeometry(.064,.002,.006),signal,0,.016,0);
    }else{
      mesh(plate,new BoxGeometry(.22,.017,.107),brass,0,.053,-.043);
      moving=mesh(plate,new BoxGeometry(.19,.045,.084),0x36545a,0,.079,-.043);
    }
    const input=document.createElement(item.kind==='range'?'input':'button');
    input.setAttribute('aria-label',item.labelText);
    const assembled={...item,plate,pick:base,base,moving,label:canvas.getContext('2d'),texture,input};
    if(item.kind==='range'){
      input.type='range';
      input.onchange=()=>onAction(assembled.id,assembled.kind,input.valueAsNumber);
    }else{
      input.type='button';input.textContent=item.labelText;
      input.onclick=()=>onAction(assembled.id,assembled.kind);
    }
    input.onfocus=()=>base.material.emissive.setHex(0x315c57);
    input.onblur=()=>base.material.emissive.setHex(0);
    accessible.append(input);
    draw(assembled);
    return assembled;
  }
  function draw(item,value=item.value){
    let printed='';
    item.input.setAttribute('aria-label',item.labelText);
    if(item.kind==='range'){
      Object.assign(item.input,{min:String(item.min),max:String(item.max),step:String(item.step),value:String(value)});
      const level=clamp((value-item.min)/(item.max-item.min));
      if(item.style==='knob')item.moving.rotation.y=sweep*(level-.5);
      else item.moving.position.z=.032-level*.172;
      printed=new Intl.NumberFormat(undefined,{maximumFractionDigits:3}).format(value);
    }else{
      if(item.toggle)item.input.setAttribute('aria-pressed',String(item.pressed));
      item.moving.position.y=item.pressed?.065:.079;
      item.moving.material.color.setHex(item.pressed?signal:0x36545a);
    }
    const context=item.label;
    context.fillStyle='#122027';context.fillRect(0,0,512,128);
    context.fillStyle='#fff1d2';context.font='600 42px system-ui';context.textAlign='center';
    context.fillText(item.labelText,256,printed?46:80,470);
    if(printed){context.fillStyle='#8be1d5';context.font='500 41px system-ui';context.fillText(printed,256,102,474);}
    item.texture.needsUpdate=true;
  }
  function cancel(){
    if(!capture)return;
    const prior=capture;
    capture=null;
    suppressClick=true;
    draw(prior.item);
    if(pointerTarget.hasPointerCapture(prior.pointer))pointerTarget.releasePointerCapture(prior.pointer);
  }
  function update(view){
    const controls=workbenchItems(view);
    const active=new Set(controls.map(item=>item.id));
    for(const [id,item] of items){
      if(active.has(id))continue;
      if(capture?.item===item)cancel();
      item.input.remove();release(item.plate);
      items.delete(id);
    }
    for(const [index,props] of controls.entries()){
      let item=items.get(props.id);
      if(capture&&capture.item===item&&(props.style!==item.style||props.value!==item.value||props.gestureKey!==item.gestureKey||
        props.min!==item.min||props.max!==item.max||props.step!==item.step))cancel();
      if(item?.style!==props.style){
        if(item){item.input.remove();release(item.plate);}
        item=create({...props,labelText:props.label});
        items.set(props.id,item);
      }
      const column=index%3, row=Math.floor(index/3);
      const columns=Math.min(3,controls.length-row*3);
      item.plate.position.set((column-(columns-1)/2)*.51,0,controls.length<=3?0:(row-.5)*.40);
      if(capture?.item===item)continue;
      if(item.value!==props.value||item.labelText!==props.label||item.pressed!==props.pressed||
        item.min!==props.min||item.max!==props.max||item.step!==props.step){
        Object.assign(item,{value:props.value,labelText:props.label,pressed:props.pressed,min:props.min,max:props.max,step:props.step});
        draw(item);
      }
      item.gestureKey=props.gestureKey;
    }
    root.updateMatrixWorld(true);
  }
  pointerTarget.addEventListener('pointerdown',event=>{
    suppressClick=false;
    if(capture||event.button!==0||event.defaultPrevented)return;
    const item=items.get(pick(event));
    if(!item)return;
    if(item.kind==='button')item.moving.position.y=.063;
    capture={item,pointer:event.pointerId,x:event.clientX,y:event.clientY,value:item.value};
    pointerTarget.setPointerCapture(event.pointerId);
    consume(event);
  },options);
  pointerTarget.addEventListener('pointermove',event=>{
    if(capture?.pointer!==event.pointerId)return;
    const {item,x,y}=capture;
    consume(event);
    if(item.kind!=='range')return;
    const rect=pointerTarget.getBoundingClientRect();
    if(!rect.height)return;
    const movement=item.style==='fader'?y-event.clientY:
      (y-event.clientY)+(event.clientX-x)*.38;
    capture.value=quantizeBenchValue(item,item.value+(item.max-item.min)*movement/Math.max(90,rect.height*.25));
    draw(item,capture.value);
  },options);
  pointerTarget.addEventListener('pointerup',event=>{
    if(capture?.pointer!==event.pointerId)return;
    const {item,x,y,value}=capture;
    consume(event);
    cancel();
    if(item.kind==='range'&&value!==item.value)onAction(item.id,item.kind,value);
    if(item.kind==='button'&&Math.hypot(event.clientX-x,event.clientY-y)<8&&pick(event)===item.id)
      onAction(item.id,item.kind);
  },options);
  for(const type of ['pointercancel','lostpointercapture'])pointerTarget.addEventListener(type,event=>{
    if(capture?.pointer===event.pointerId){consume(event);cancel();}
  },options);
  pointerTarget.addEventListener('click',event=>{
    if(suppressClick&&event.detail){suppressClick=false;consume(event);}
  },options);
  return {update,owns:target=>accessible.contains(target),dispose(){cancel();handlers.abort();accessible.remove();release(root);items.clear();}};
}
