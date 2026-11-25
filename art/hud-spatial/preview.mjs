import {AmbientLight,DirectionalLight,HemisphereLight,PerspectiveCamera,
  Matrix4,Raycaster,Scene,Vector2,WebGLRenderer} from 'three';
import {bindSpatialHudPointer,createSpatialHud,placeHudInViewport,spatialHudCatalog} from 'proyeccion/spatial-hud';
import {createHudMaterialShell} from '../../src/hud-material-shell.mjs';
import {instruments} from './stage-art.mjs';

const looks={
  orbita:{name:'Órbita',label:'Atlas vivo',detail:'Leé el Anillo como un mapa en relieve. Giralo y seguí el sendero entre sus balizas.',
    stops:['Plaza de llegada','Mirador','Casa'],actions:['Cambiar destino','Girar mapa'],back:'#183132b9',fill:'#33424f',accent:'#e6f99c',frame:'#203b31',radius:.061,thickness:.16},
  umbral:{name:'Umbral',label:'Ventanas al mundo',detail:'Las capas de vidrio tienen profundidad. Cambiá de plano para enfocar otra puerta.',
    stops:['Plaza','Galería','Casa'],actions:['Cambiar plano','Día / noche'],back:'#301d39b9',fill:'#583952',accent:'#fbd59e',frame:'#482947',radius:.044,thickness:.085},
  pulso:{name:'Pulso',label:'Inspección óptica',detail:'Un barrido de luz atraviesa la muestra y deja ver su estructura.',
    stops:['Muestra completa','Escáner activo','Estructura visible'],actions:['Iniciar barrido','Ver estructura'],back:'#351b2eb9',fill:'#6c364f',accent:'#ffc39d',frame:'#48223c',radius:.018,thickness:.13},
  estratos:{name:'Estratos',label:'Mesa de Materia',detail:'Separá las capas de la pieza y girala para estudiar cómo encajan.',
    stops:[],actions:['Girar pieza','Volver a armar'],back:'#123b3cb9',fill:'#244b53',accent:'#9ef9e5',frame:'#265e60',radius:.027,thickness:.20},
};
const el=id=>document.getElementById(id);
const stage=el('stage'), canvas=el('view'), readout=el('readout');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let selected='orbita', fx=!reduced.matches, step=0, amount=36, night=false;
let yaw=0,pitch=0,viewYaw=0,viewPitch=0,viewAmount=36;
let kick=0, kickedAt=0, dirty=true, raf=0, last=0, start=0;
let renderer, camera, content, interfaceScene, hud, hudGroup, art, shell;
let layout={width:0,height:0,mobile:false};
const raycaster=new Raycaster(), point=new Vector2(), tilt=new Matrix4();
const binding=key=>({'@path':'/'+key});
const action=(name,context={})=>({event:{name,context}});
const receive=(event,fields)=>hud.receive({version:'1.0',[event]:{surfaceId:'instrument',...fields}});

function updateReadout(){
  const detail = selected==='estratos'?amount===0?'Pieza ensamblada':`Separación · ${amount}%`:looks[selected].stops[step];
  if(readout.textContent!==detail)readout.textContent=detail;
}
function sync(){
  updateReadout();
  const [primary,secondary]=looks[selected].actions;
  receive('updateDataModel',{value:{primary:selected==='pulso'&&step===1?'Detener barrido':primary,
    secondary, status:readout.textContent, active:selected==='pulso'&&step===1,amount,draft:amount}});
  invalidate();
}
function components(){
  const isMatter=selected==='estratos';
  const stacked=layout.mobile||selected==='umbral';
  const controls=stacked?['primary','secondary']:['controls'];
  const path=key=>binding(key);
  return [
    {id:'root',component:'HudPanel',label:'Instrumento',width:layout.mobile?.80:stacked?1.22:2.84,
      gap:layout.mobile?.028:.044,children:['status',...(isMatter?['range']:[]),...controls]},
    {id:'status',component:'HudText',label:path('status'),style:'status'},
    ...(stacked?[]:[{id:'controls',component:'HudRow',gap:.075,children:['primary','secondary']}]),
    {id:'primary',component:'HudButton',label:path('primary'),pressed:path('active'),action:action('primary')},
    {id:'secondary',component:'HudButton',label:path('secondary'),action:action('secondary')},
    ...(isMatter?[{id:'range',component:'HudRange',label:'Capas',min:0,max:100,step:2,
      value:path('amount'),draft:path('draft'),action:action('range',{value:path('draft')})}]:[]),
  ];
}
function bump(amplitude){kick=fx?amplitude:0;kickedAt=performance.now();}
function activate({action:request}){
  if(request?.surfaceId!=='instrument')return;
  const {name,context}=request;
  if(name==='range'){
    const v=context?.value;
    if(!Number.isFinite(v))return;
    amount=Math.round(Math.max(0,Math.min(100,v)));
    bump(.55);
  }else if(name==='primary'){
    if(selected==='orbita'||selected==='umbral')step=(step+1)%3;
    else if(selected==='pulso')step=step===1?0:1;
    else yaw+=.62;
    bump(.64);
  }else if(name==='secondary'){
    if(selected==='orbita')yaw+=.7;
    else if(selected==='umbral'){
      night=!night;
      stage.classList.toggle('night',night);
    }else if(selected==='pulso')step=step===2?0:2;
    else amount=0;
    bump(.52);
  }
  sync();
}

function rayForPointer(event){
  const {left,top,width,height}=canvas.getBoundingClientRect();
  if(!width||!height)return;
  point.set((event.clientX-left)/width*2-1,1-(event.clientY-top)/height*2);
  raycaster.setFromCamera(point,camera);
  return {ray:raycaster.ray};
}
function freeArt(model){
  model.root.removeFromParent();
  model.root.traverse(node=>{
    node.geometry?.dispose();
    if(node.material?.map)node.material.map.dispose();
    node.material?.dispose();
  });
}
function change(key){
  selected=key; step=0; viewAmount=amount=36; night=false; yaw=viewYaw=pitch=viewPitch=0; bump(1);
  document.body.dataset.look=key;
  stage.classList.remove('night');
  const look=looks[key];
  el('title').textContent=look.name;
  el('domain').textContent=look.label;
  el('detail').textContent=look.detail;
  for(const button of document.querySelectorAll('button[data-look]'))
    button.setAttribute('aria-pressed',String(button.dataset.look===key));
  if(!renderer){updateReadout();return;}
  if(art)freeArt(art);
  art=instruments[key](invalidate);
  content.add(art.root);
  shell?.dispose();
  shell=createHudMaterialShell(look);
  hudGroup?.add(shell.group);
  hud.setPalette({background:look.back,button:look.fill,pressed:selected==='pulso'?'#863c50':look.fill,focus:look.accent,text:'#fff7eb'});
  receive('updateComponents',{components:components()});
  sync();
}
function size(){
  const {width,height}=stage.getBoundingClientRect();
  if(!width||!height)return;
  const changed=(width<650)!==layout.mobile;
  layout={width,height,mobile:width<650};
  renderer.setPixelRatio(Math.min(layout.mobile?1.5:2,devicePixelRatio||1));
  if(changed&&art){receive('updateComponents',{components:components()});sync();}
  renderer.setSize(width,height,false);
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
  invalidate();
}
function invalidate(){
  dirty=true;
  if(!raf&&!document.hidden)raf=requestAnimationFrame(draw);
}
function draw(now){
  raf=0;
  const {width,height,mobile}=layout;
  if(!width||!art||document.hidden||renderer.getContext().isContextLost())return;
  if(!start)start=now;
  const t=(now-start)/1000, dt=Math.min(last?(now-last)/1000:.016,.05);
  last=now;
  const gain=fx?1-Math.exp(-14*dt):1;
  viewYaw+=(yaw-viewYaw)*gain;
  viewPitch+=(pitch-viewPitch)*gain;
  const age=Math.max(0,(now-kickedAt)/1000);
  const intensity=fx?kick*Math.exp(-7*age):0;
  const wave=intensity*Math.sin(27*age);
  const widthTarget=mobile?(selected==='umbral'?770:610):960;
  const scale=Math.min(1,width/widthTarget);
  art.root.scale.setScalar(scale*(1+wave*.09));
  art.root.position.set(mobile?0:1.28,mobile?.19:.24,.03*wave);
  art.root.rotation.z=wave*.10;
  viewAmount+=(amount-viewAmount)*(fx?1-Math.exp(-dt*13):1);
  const amountWave=selected==='estratos'&&fx?wave*4:0;
  art.update({yaw:viewYaw,pitch:viewPitch,step,amount:Math.max(0,viewAmount+amountWave),fx,motion:fx,time:t,dt});
  hud.update();
  const pixels=mobile?Math.min(331,(width-32)/.94):Math.min(207,(width-33)/2.98);
  const hudScale=pixels;
  const bounds=hud.getSurfaceBounds('instrument');
  shell?.update(bounds,{effects:fx,wave});
  const mainHeight=bounds?(bounds.top-bounds.bottom)*hudScale:0;
  if(hudGroup){
    const x=mobile?width/2:selected==='umbral'?width*.83:selected==='pulso'?width*.63:width*.46;
    const y=height-(mobile?21:35)-mainHeight;
    hud.setTextDensity('instrument',{cssPixelsPerUnit:pixels,pixelRatio:renderer.getPixelRatio(),fontSize:mobile?16:17});
    placeHudInViewport(hudGroup,camera,{width,height,x,y,pixelsPerUnit:hudScale,depth:1});
    hudGroup.matrix.multiply(tilt.makeRotationX(mobile?0:.11));
    hudGroup.updateMatrixWorld(true);
  }
  renderer.clear();
  renderer.render(content,camera);
  renderer.clearDepth();
  renderer.render(interfaceScene,camera);
  dirty=false;
  const moving=fx&&((selected==='pulso'&&step===1)||intensity>.002||
    Math.abs(viewYaw-yaw)+Math.abs(viewPitch-pitch)>.002||Math.abs(viewAmount-amount)>.03);
  if(moving||dirty)raf=requestAnimationFrame(draw);
}
try{
  renderer=new WebGLRenderer({canvas,alpha:true,antialias:true});
  renderer.autoClear=false;
  renderer.setClearColor(0,0);
  camera=new PerspectiveCamera(38,1,.037,85);
  camera.position.set(0,0,7.5);camera.updateMatrixWorld();
  content=new Scene();interfaceScene=new Scene();
  content.add(new AmbientLight('#a6b4f9',1.2),new HemisphereLight('#fff8d4','#3f3c67',1.5));
  const key=new DirectionalLight('#ffe8ca',3.15); key.position.set(-1,4,5);
  const rim=new DirectionalLight('#a0caff',2.5); rim.position.set(2,.1,-4);
  content.add(key,rim);
  const displayLight=new DirectionalLight('#c3bad8',1.3); displayLight.position.set(2,2,6);
  interfaceScene.add(new AmbientLight('#bfedff',1.1),displayLight);
  hud=createSpatialHud({parent:interfaceScene,document,accessibilityRoot:el('a11y'),
    placeSurface:group=>{hudGroup=group;if(shell)group.add(shell.group);},send:activate,onTransportError:error=>console.error(error)});
  receive('createSurface',{catalogId:spatialHudCatalog.id});
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','focusin','focusout']){
    stage.addEventListener(type,invalidate,{capture:true,passive:true});
  }
  bindSpatialHudPointer({element:canvas,hud,rayForPointer});
  let drag;
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||drag)return;
    canvas.setPointerCapture(e.pointerId);
    drag={id:e.pointerId,x:e.clientX,y:e.clientY};
  });
  canvas.addEventListener('pointermove',e=>{
    if(drag?.id!==e.pointerId||!e.buttons)return;
    yaw+=(e.clientX-drag.x)*.012; pitch=Math.max(-.59,Math.min(.59,pitch+(e.clientY-drag.y)*.007));
    drag.x=e.clientX;drag.y=e.clientY;invalidate();
  });
  canvas.addEventListener('lostpointercapture',e=>{if(drag?.id===e.pointerId)drag=undefined;});
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();
    el('fallback').hidden=false;
    if(raf)cancelAnimationFrame(raf);
    raf=0;
  });
  canvas.addEventListener('webglcontextrestored',()=>{el('fallback').hidden=true;invalidate();});
  new ResizeObserver(size).observe(stage);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)invalidate();});
  size();change(selected);
  canvas.dataset.ready='true';
}catch(error){
  console.error(error);
  renderer=undefined;
  el('fallback').hidden=false;
}
document.querySelectorAll('button[data-look]').forEach(button=>button.addEventListener('click',()=>change(button.dataset.look)));
el('recenter').addEventListener('click',()=>{yaw=pitch=0;bump(.4);invalidate();});
function setEffects(value){
  fx=value;el('effects').setAttribute('aria-pressed',String(fx));invalidate();
}
el('effects').addEventListener('click',()=>setEffects(!fx));
setEffects(fx);
reduced.addEventListener('change',event=>setEffects(!event.matches));
