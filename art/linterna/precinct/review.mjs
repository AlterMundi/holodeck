import * as T from 'three';
import {batchModel} from './batch.mjs';
import {floorClearance,makeScene} from './model.mjs';
import {approachDoor,makeJourneys,makeStops,pavilionDoor,pavilions,place,roomCenters,roomPartition} from './plan.mjs';

const labels = {
  promenade:['Desde el paseo','La puerta de Casa Linterna se abre a otra escala.'],
  world:['Templo del Mundo','La mesa del mundo orienta la llegada. El jardín asoma entre las columnas.'],
  garden:['Jardín interno','Hefesto queda al fondo. Los senderos llevan a Atenea a la izquierda y a Apolo a la derecha.'],
  athena:['Vestíbulo de Atenea','Atenea reúne saberes, estrategia y oficios. Sus puertas conducen a proyectos de estudio.'],
  hephaestus:['Vestíbulo de Hefesto','Dios del fuego y la forja. Desde su vestíbulo se entra al taller de arcilla o al de impresión.'],
  apollo:['Vestíbulo de Apolo','Dios de la música y la luz. Sus salas relacionan sonido, instrumento y movimiento.'],
  atelier:['Atelier VR','Un banco para modelar y rodear la pieza.'],
  printing:['AnyPrinter','Un banco para preparar y cotizar impresiones.'],
  instrument:['Instrumento','La sala del instrumento.'],
  movement:['Gesto y sonido','Un espacio para explorar gesto y sonido.'],
  planning:['Planificación','Una sala de proyectos y planificación.'],
  reading:['Lectura','Una sala de lectura.'],
  library:['Biblioteca','Sala prevista para consulta bibliográfica.'],
};
const actionText = {
  promenade:'Salir al paseo',world:'Cruzar la puerta',garden:'Ir al jardín',
  athena:'Entrar a Atenea',hephaestus:'Entrar a Hefesto',apollo:'Entrar a Apolo',
};
const sites = JSON.parse(document.querySelector('#sites').textContent);
for (const [id,site] of Object.entries(sites)) {
  if (site.title) labels[id][0]=site.title;
}
const stops=makeStops(), journeys=makeJourneys();
const view=document.querySelector('#stage'), title=document.querySelector('#place');
const description=document.querySelector('#description'), state=document.querySelector('#status');
const options=document.querySelector('#options'), reset=document.querySelector('#reset');
const hallDirection=new T.Vector3(), forward=new T.Vector3(), motion=new T.Vector3();
const look=new T.Vector3(), destination=new T.Vector3();
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const held=new Set(), stageAssets=new Map();
let current='promenade', stage, clear, transport, drag, yaw=0, pitch=0, previousTime=0, dirty=true;
let renderer;
try {
  renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});
} catch {
  state.textContent='La vista 3D necesita un navegador con WebGL.';
  throw Error('WebGL unavailable');
}
view.append(renderer.domElement);
renderer.domElement.setAttribute('aria-label','Vista 3D. Arrastrá para mirar alrededor.');
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFShadowMap;
renderer.shadowMap.autoUpdate=false;
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.15;
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));

const scene=new T.Scene();
scene.background=new T.Color('#c6dbd8');
scene.fog=new T.Fog('#c6dbd8',27,66);
scene.add(new T.HemisphereLight('#e6f0e7','#978160',2.04));
const sun=new T.DirectionalLight('#fff2d5',2.62);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.near=.25;
sun.shadow.camera.far=84;
Object.assign(sun.shadow.camera,{left:-30,right:30,top:32,bottom:-32});
sun.shadow.normalBias=.04;
sun.shadow.bias=-.00015;
scene.add(sun,sun.target);
const camera=new T.PerspectiveCamera(56,1,.075,92);
camera.rotation.order='YXZ';
const position=new T.Vector3();

function switchStage(name) {
  if (stage===name) return;
  if (stage) scene.remove(stageAssets.get(stage).model);
  if (!stageAssets.has(name)) {
    const {group,obstacles}=makeScene(name);
    const model=batchModel(group);
    if (name==='precinct') addPlaques(model);
    stageAssets.set(name,{model,clear:floorClearance(obstacles)});
  }
  const art=stageAssets.get(name);
  clear=art.clear;
  scene.add(art.model);
  sun.position.set(-18,30,10);
  sun.target.position.set(0,0,name==='approach'?1:-10);
  renderer.shadowMap.needsUpdate=true;
  stage=name;
}

function addPlaques(model) {
  function plaque(pavilion,x,y,z,name,width) {
    const face=document.createElement('canvas');
    face.width=512;
    face.height=96;
    const brush=face.getContext('2d');
    brush.fillStyle='#584532';
    brush.fillRect(2,2,508,92);
    brush.strokeStyle='#c1a573';
    brush.lineWidth=4;
    brush.strokeRect(9,9,494,78);
    brush.fillStyle='#fff1cf';
    brush.font='600 46px Georgia';
    brush.textAlign='center';
    brush.textBaseline='middle';
    brush.fillText(name,256,50,460);
    const map=new T.CanvasTexture(face);
    map.colorSpace=T.SRGBColorSpace;
    const plate=new T.Mesh(new T.PlaneGeometry(width,width*96/512),
      new T.MeshBasicMaterial({map,transparent:true}));
    const [worldX,worldZ]=place(pavilion,x,z);
    plate.position.set(worldX,y,worldZ);
    plate.rotation.y=pavilion.turn;
    model.add(plate);
  }
  for (const pavilion of pavilions) {
    plaque(pavilion,0,2.72,pavilionDoor+.145,labels[pavilion.id][0].slice('Vestíbulo de '.length),1.61);
    for (const room of roomCenters(pavilion))
      plaque(pavilion,room.x,2.68,roomPartition+.15,labels[room.id][0],1.54);
  }
}

function updateFraming() {
  const broad=current==='garden'||stopParents.has(current)&&stopParents.get(current)==='garden';
  camera.fov=camera.aspect<1.2 ? (broad?80:70) : (broad?63:55);
  camera.updateProjectionMatrix();
}

function identifyPlace(id) {
  current=id;
  const [name,copy]=labels[id];
  title.textContent=name;
  description.textContent=copy;
  view.dataset.place=id;
  view.dataset.stage=stops[id].stage;
  state.textContent='';
  options.replaceChildren();
  const previous=stopParents.get(id);
  for (const next of Object.keys(journeys[id]??{})) {
    const button=document.createElement('button');
    button.type='button';
    button.dataset.to=next;
    button.textContent=next===previous ? 'Volver · '+labels[next][0] : actionText[next]??'Entrar · '+labels[next][0];
    options.append(button);
  }
  if (id==='promenade'||id==='world') {
    const button=document.createElement('button');
    button.type='button';
    button.dataset.to=id==='promenade'?'world':'promenade';
    button.textContent=actionText[button.dataset.to];
    if (id==='promenade') options.prepend(button);
    else options.append(button);
  }
  if (sites[id]?.url) {
    const anchor=document.createElement('a');
    anchor.className='site-link';
    anchor.textContent='Abrir '+name;
    anchor.href=sites[id].url;
    anchor.target='_blank';
    anchor.rel='noopener noreferrer';
    options.prepend(anchor);
  }
}

function aim(dx,dy,dz) {
  yaw=Math.atan2(-dx,-dz);
  pitch=Math.atan2(dy,Math.hypot(dx,dz));
  camera.rotation.set(pitch,yaw,0,'YXZ');
  dirty=true;
}

function aimAtStop(id) {
  const [x,y,z]=stops[id].target;
  aim(x-position.x,y-position.y,z-position.z);
}

function arrive(id) {
  const stop=stops[id];
  switchStage(stop.stage);
  position.set(stop.point[0],1.64,stop.point[1]);
  aimAtStop(id);
  identifyPlace(id);
  updateFraming();
  transport=null;
  reset.disabled=false;
  dirty=true;
}

function moveTo(id) {
  if (transport||!stops[id]) return;
  const stop=stops[current];
  if (Math.hypot(position.x-stop.point[0],position.z-stop.point[1])>.61) {
    state.textContent='Usá «Centrar la vista» para retomar el recorrido desde esta parada.';
    return;
  }
  if (reduced.matches) {
    arrive(id);
    return;
  }
  const waypoints=journeys[current]?.[id] ??
    (current==='promenade' ? [[.55,3.48],[0,approachDoor]] : [[0,13.04]]);
  transport={id,waypoints,index:0};
  options.querySelectorAll('button').forEach(button=>button.disabled=true);
  reset.disabled=true;
  state.textContent='En camino a '+labels[id][0]+'…';
  held.clear();
}

function step(now) {
  const dt=Math.min((now-(previousTime||now))/1000,.045);
  previousTime=now;
  if (!document.hidden) {
    if (transport) stepTour(dt);
    else if (held.size) stepFree(dt);
    if (dirty) {
      camera.position.copy(position);
      renderer.render(scene,camera);
      dirty=false;
    }
  }
  requestAnimationFrame(step);
}

function stepTour(dt) {
  const [x,z]=transport.waypoints[transport.index];
  destination.set(x,1.64,z);
  motion.copy(destination).sub(position);
  const distance=motion.length();
  if (distance < .025) {
    position.copy(destination);
    transport.index++;
    if (transport.index===transport.waypoints.length) arrive(transport.id);
    return;
  }
  motion.multiplyScalar(Math.min(distance,dt*5.7)/distance);
  const next=[position.x+motion.x,position.z+motion.z];
  if (!clear(next)) {
    arrive(current);
    state.textContent='Se interrumpió el recorrido en ese paso.';
    return;
  }
  const goalYaw=Math.atan2(-motion.x,-motion.z);
  const difference=Math.atan2(Math.sin(goalYaw-yaw),Math.cos(goalYaw-yaw));
  yaw+=difference*Math.min(1,dt*4.1);
  pitch*=Math.max(0,1-dt*3.6);
  camera.rotation.set(pitch,yaw,0,'YXZ');
  position.add(motion);
  dirty=true;
}

function contact(x,z) {
  return (stage==='approach' ? Math.abs(x)<10.9&&z>-6.7&&z<12.15 :
    Math.abs(x)<24.5&&z>-31.5&&z<19.8) && clear([x,z]);
}

function stepFree(dt) {
  const stride=Number(held.has('forward'))-Number(held.has('back'));
  const side=Number(held.has('right'))-Number(held.has('left'));
  forward.set(-Math.sin(yaw),0,-Math.cos(yaw));
  hallDirection.set(Math.cos(yaw),0,-Math.sin(yaw));
  look.copy(forward).multiplyScalar(stride).addScaledVector(hallDirection,side).normalize().multiplyScalar(dt*2.75);
  if (contact(position.x+look.x,position.z)) position.x+=look.x;
  if (contact(position.x,position.z+look.z)) position.z+=look.z;
  dirty=true;
}

const stopParents=new Map([['garden','world'],['athena','garden'],['hephaestus','garden'],['apollo','garden']]);
for (const id of ['athena','hephaestus','apollo']) {
  for (const key of Object.keys(journeys[id])) if (key!=='garden') stopParents.set(key,id);
}

options.addEventListener('click',event=>{
  const button=event.target.closest('button[data-to]');
  if (button) moveTo(button.dataset.to);
});
reset.addEventListener('click',()=>arrive(current));
new ResizeObserver(()=>{
  const {clientWidth:width,clientHeight:height}=view;
  if (!width||!height) return;
  camera.aspect=width/height;
  updateFraming();
  renderer.setSize(width,height,false);
  dirty=true;
}).observe(view);
view.addEventListener('pointerdown',event=>{
  if (event.button!==0||transport) return;
  view.setPointerCapture(event.pointerId);
  drag=[event.clientX,event.clientY];
});
view.addEventListener('pointermove',event=>{
  if (!drag) return;
  yaw-=(event.clientX-drag[0])*.0052;
  pitch=T.MathUtils.clamp(pitch-(event.clientY-drag[1])*.0052,-.9,.64);
  camera.rotation.set(pitch,yaw,0,'YXZ');
  drag=[event.clientX,event.clientY];
  dirty=true;
});
view.addEventListener('lostpointercapture',()=>{drag=null;});
const keypad={w:'forward',a:'left',s:'back',d:'right',
  arrowup:'forward',arrowdown:'back',arrowleft:'left',arrowright:'right'};
window.addEventListener('keydown',event=>{
  const key=keypad[event.key.toLowerCase()];
  if (key&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.target.closest('button,a,input')) {
    event.preventDefault();
    if (!transport) held.add(key);
  }
});
window.addEventListener('keyup',event=>held.delete(keypad[event.key.toLowerCase()]));
window.addEventListener('blur',()=>held.clear());
document.querySelectorAll('[data-move]').forEach(button=>{
  const direction=button.dataset.move;
  button.addEventListener('pointerdown',event=>{
    button.setPointerCapture(event.pointerId);
    if (!transport) held.add(direction);
  });
  button.addEventListener('lostpointercapture',()=>held.delete(direction));
  button.addEventListener('keydown',event=>{
    if ((event.key==='Enter'||event.key===' ')&&!transport) held.add(direction);
  });
  button.addEventListener('keyup',()=>held.delete(direction));
  button.addEventListener('blur',()=>held.delete(direction));
});
renderer.domElement.addEventListener('webglcontextlost',()=>{
  state.textContent='Se perdió la vista 3D. Recargá el archivo para volver al paseo.';
});
arrive('promenade');
requestAnimationFrame(step);
