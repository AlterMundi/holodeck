import {
  AmbientLight, Color, DirectionalLight, PerspectiveCamera, PointLight,
  Scene, TextureLoader, Vector3, WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createSplats } from './splats.mjs';

const $=id=>document.getElementById(id);
const canvas=$('scene'), status=$('status'), movement=$('movement');
const options=[...document.querySelectorAll('[data-mode]')];
const descriptions={
  splat:'Toda la apariencia sale del splat. La vitrina forma parte de la imagen.',
  orbital:'Laboratorio orbital con materiales de ImageGen y luces cian y ámbar. Podés recorrerlo desde cualquier ángulo.',
  mixed:'El splat da el acabado sobre la malla. El plato de la vitrina sigue siendo un objeto que podés girar.',
  uv:'Alterná el material original y el piso generado con sombras horneadas. La cámara y el resto de la sala conservan su posición y su aspecto.',
};
const obstacles=[
  [-1.58,1.58,-1.44,.58], [1.84,4.85,-4.60,-2.76], [-5.78,-4.78,-2.47,1.63],
];
const initial=new Vector3(-.72,1.66,4.38), desk=new Vector3(0,1.05,-.43);
const front=new Vector3(), right=new Vector3();
const hints={splat:'Cargando el splat…',orbital:'Cargando el laboratorio orbital…',mixed:'Cargando la vitrina…',uv:'Cargando la sala y su textura…'};
const scene=new Scene();
scene.background=new Color('#332b24');
const camera=new PerspectiveCamera(67.38,1,.06,28);
camera.rotation.order='YXZ';
const key=new DirectionalLight('#ffdbad',1.15);
key.position.set(-1,3,2);
const windowLamp=new DirectionalLight('#a8c7ff',.7);
windowLamp.position.set(-1,2,-4);
const lamp=new PointLight('#ffd59b',18,7,2);
lamp.position.set(0,2.35,-.43);
scene.add(new AmbientLight('#e6ebf3',1.16),key,windowLamp,lamp);

let renderer, room, floor, uvFloor, turntable;
const splatAssets = new Map();
const floorOptions = [...document.querySelectorAll('[data-floor]')];
let floorStyle = 'baked';
let mode='splat', moving=new Set(), painted=false, dragging=null;
let layoutDirty=true, frameDirty=true, viewReady=false, modeTicket=0;
let turnAngle=0;
const reduced=$('light');
reduced.checked=matchMedia('(pointer:coarse)').matches;
const gltf=new GLTFLoader();
// The isolated Homes artifact permits blob images. It does not permit
// fetches from blob URLs, which Three's ImageBitmapLoader would attempt.
gltf.register(parser=>{
  parser.textureLoader=new TextureLoader(parser.options.manager);
  return {name:'HolodeckArtifactTextures'};
});
async function loadModel(path) {
  const response=await fetch(path,{credentials:'omit'});
  if(!response.ok) throw Error('Model unavailable');
  return gltf.parseAsync(await response.arrayBuffer(),new URL('.',location.href).href);
}
function getSplat(name) {
  if (!splatAssets.has(name)) {
    const load = (async () => {
      const asset = await fetch(name === 'orbital' ? 'orbital.splat' : 'matter.splat', {credentials:'omit'});
      if (!asset.ok) throw Error('Splat unavailable');
      const splat = createSplats(await asset.arrayBuffer());
      splat.mesh.visible = false;
      scene.add(splat.mesh);
      return splat;
    })().catch(error => {
      splatAssets.delete(name);
      throw error;
    });
    splatAssets.set(name, load);
  }
  return splatAssets.get(name);
}
let visibleSplat;
function showFloor() {
  if (floor) floor.visible = mode !== 'uv' || floorStyle === 'original';
  if (uvFloor) uvFloor.visible = mode === 'uv' && floorStyle === 'baked';
  $('floor-options').hidden = mode !== 'uv';
  for (const button of floorOptions) {
    button.setAttribute('aria-pressed', String(button.dataset.floor === floorStyle));
  }
  frameDirty = true;
}
function getRoom() {
  return getRoom.ready??=(async()=>{
    room=(await loadModel('room.glb')).scene;
    floor=room.getObjectByName('Surface__Honed_limestone_floor_with_fixture_bounce') ??
      room.children.find(item=>item.isMesh&&item.material?.name.includes('floor with fixture bounce'));
    turntable=room.getObjectByName('archive_turntable_platform');
    if(!floor||!turntable)throw Error('Room objects unavailable');
    turnAngle=turntable.rotation.y;
    room.visible=false;
    scene.add(room);
  })().catch(error=>{getRoom.ready=null;throw error;});
}
function getFloor() {
  return getFloor.ready??=(async()=>{
    uvFloor=(await loadModel('floor.glb')).scene;
    uvFloor.visible=false;
    scene.add(uvFloor);
  })().catch(error=>{getFloor.ready=null;throw error;});
}
function setStatus(message) {
  status.textContent=message;
  status.hidden=!message;
}
async function choose(next) {
  if(!renderer)return;
  const request=++modeTicket;
  for(const button of options)button.setAttribute('aria-pressed',String(button.dataset.mode===next));
  setStatus(hints[next]);
  $('description').textContent=descriptions[next];
  $('turn').disabled=true;
  try{
    let splat;
    if (next === 'uv') {
      await Promise.all([getRoom(), getFloor()]);
    } else {
      const selected = getSplat(next === 'orbital' ? 'orbital' : 'original');
      splat = next === 'mixed' ? (await Promise.all([selected, getRoom()]))[0] : await selected;
    }
    if (request !== modeTicket) return;
    if (visibleSplat) visibleSplat.mesh.visible = false;
    if (splat) splat.mesh.visible = true;
    visibleSplat = splat;
    mode = next;
    if (room) room.visible = next === 'mixed' || next === 'uv';
    showFloor();
    $('turn').disabled = !room?.visible;
    setStatus('');
    frameDirty=true;
    viewReady=true;
    $('reset').disabled=$('table').disabled=false;
    movement.hidden=false;
  }catch{
    if(request!==modeTicket)return;
    if(viewReady){
      for(const button of options)button.setAttribute('aria-pressed',String(button.dataset.mode===mode));
      $('description').textContent=descriptions[mode];
      $('turn').disabled = !room?.visible;
    }
    setStatus('Esta vista no cargó. Volvé a elegirla para reintentar.');
  }
}
function setCamera(position, target) {
  moving.clear();
  camera.position.copy(position);
  camera.lookAt(target);
  frameDirty=true;
}
function clearAt(x,z) {
  return Math.abs(x)<5.72&&Math.abs(z)<5.72&&
    obstacles.every(([x0,x1,z0,z1])=>x<x0||x>x1||z<z0||z>z1);
}
function move(dt){
  if(!moving.size||!viewReady)return;
  camera.getWorldDirection(front);
  front.y=0;
  front.normalize();
  right.crossVectors(front,camera.up);
  const f=Number(moving.has('w'))-Number(moving.has('s'));
  const r=Number(moving.has('d'))-Number(moving.has('a'));
  const step=Math.min(dt,.065)*1.85;
  const x=camera.position.x+step*(f*front.x+r*right.x);
  const z=camera.position.z+step*(f*front.z+r*right.z);
  if(clearAt(x,camera.position.z))camera.position.x=x;
  if(clearAt(camera.position.x,z))camera.position.z=z;
  frameDirty=true;
}
function layout(){
  const width=canvas.clientWidth,height=canvas.clientHeight;
  if(!width||!height)return;
  const maxPixels=reduced.checked?260000:700000;
  renderer.setPixelRatio(Math.min(devicePixelRatio,Math.sqrt(maxPixels/(width*height))));
  renderer.setSize(width,height,false);
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
  layoutDirty=false;
  frameDirty=true;
}
const keyMap={w:'w',a:'a',s:'s',d:'d',arrowup:'w',arrowleft:'a',arrowdown:'s',arrowright:'d'};
window.addEventListener('keydown',event=>{
  const key=keyMap[event.key.toLowerCase()];
  if(!key||event.ctrlKey||event.metaKey||event.altKey||event.target.tagName==='INPUT')return;
  event.preventDefault();
  moving.add(key);
});
window.addEventListener('keyup',event=>moving.delete(keyMap[event.key.toLowerCase()]));
window.addEventListener('blur',()=>{moving.clear();dragging=null;});
canvas.addEventListener('pointerdown',event=>{
  if(!viewReady||dragging!==null)return;
  dragging=[event.pointerId,event.clientX,event.clientY];
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
  if(dragging?.[0]!==event.pointerId)return;
  camera.rotation.y-=(event.clientX-dragging[1])*.006;
  camera.rotation.x=Math.max(-1.25,Math.min(1.25,camera.rotation.x-(event.clientY-dragging[2])*.006));
  dragging=[event.pointerId,event.clientX,event.clientY];
  frameDirty=true;
});
for(const kind of ['pointerup','pointercancel','lostpointercapture'])
  canvas.addEventListener(kind,event=>{if(dragging?.[0]===event.pointerId)dragging=null;});
for(const button of movement.querySelectorAll('[data-step]')){
  const axis=button.dataset.step;
  button.addEventListener('pointerdown',event=>{
    event.preventDefault();
    moving.add(axis);
    button.setPointerCapture(event.pointerId);
  });
  for(const kind of ['pointerup','pointercancel','lostpointercapture'])
    button.addEventListener(kind,()=>moving.delete(axis));
  button.addEventListener('click',event=>{
    if(event.detail===0){
      moving.add(axis);move(.065);moving.delete(axis);
    }
  });
}
for(const button of options)button.onclick=()=>void choose(button.dataset.mode);
$('reset').onclick=()=>setCamera(initial,new Vector3(0,1.23,-2.79));
$('table').onclick=()=>setCamera(new Vector3(2.8,1.66,.85),desk);
$('turn').onclick=()=>{turnAngle+=Math.PI/2;};
$('floor-view').onclick = () => setCamera(new Vector3(1.9, 1.66, 1.8), new Vector3(0, 0, .9));
for (const button of floorOptions) {
  button.onclick = () => { floorStyle = button.dataset.floor; showFloor(); };
}
reduced.onchange=()=>{layoutDirty=true;};
new ResizeObserver(()=>{layoutDirty=true;}).observe(canvas);

try{
  renderer=new WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  $('reset').onclick();
  let previous=performance.now();
  function tick(now){
    requestAnimationFrame(tick);
    if(document.hidden){previous=now;return;}
    const dt=(now-previous)/1000;
    previous=now;
    if(layoutDirty)layout();
    move(dt);
    if(turntable&&room.visible&&Math.abs(turntable.rotation.y-turnAngle)>.001){
      const step=Math.min(1,dt*10);
      turntable.rotation.y+=(turnAngle-turntable.rotation.y)*step;
      frameDirty=true;
    }
    if(!frameDirty||!viewReady)return;
    frameDirty=false;
    visibleSplat?.sort(camera, mode === 'mixed');
    renderer.render(scene,camera);
    if(!painted){$('still').hidden=true;painted=true;}
  }
  requestAnimationFrame(tick);
  void choose('splat');
}catch{
  for(const button of options)button.disabled=true;
  reduced.disabled=true;
  setStatus('Este navegador no pudo iniciar la vista 3D. Podés ver la comparación del piso.');
}
