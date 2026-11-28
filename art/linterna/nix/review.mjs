import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeNix } from './model.mjs';
import { plan, walkable } from './plan.mjs';

const media = __WANDA_FIXTURE__;
const q = (selector) => document.querySelector(selector);
const status = q('#status'), dialog = q('#inspection');
const frame = q('#frame-image'), scroller = q('#frame-window');
const rig = makeNix();
const scene = new T.Scene();
scene.background = new T.Color('#172536');
scene.fog = new T.FogExp2('#26384b', .021);
scene.add(rig.model);
const renderer = new T.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = .97
renderer.shadowMap.enabled = true
renderer.shadowMap.type = T.PCFShadowMap
renderer.shadowMap.autoUpdate = false
renderer.shadowMap.needsUpdate = true;
q('#view').append(renderer.domElement);

const ground = new T.Mesh(new T.PlaneGeometry(160,160), new T.MeshStandardMaterial({color:'#454c47', roughness: .97}));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -.028
ground.receiveShadow = true;
scene.add(ground);
scene.add(new T.HemisphereLight('#adc2e4','#766565', 1.19));
const moon = new T.DirectionalLight('#94b7ec', 1.15);
moon.position.set(-3.8, 10.5, 2.2);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, {left:-10,right:10,top:10,bottom:-10,near:.1,far:29});
moon.shadow.normalBias = .026;
rig.model.traverse(obj => {
  if (!obj.isMesh || obj.material.isMeshBasicMaterial) return;
  obj.castShadow = true;
  obj.receiveShadow = true;
});
scene.add(moon);
const fill = new T.PointLight('#bad0fa', 21, 14, 2);
fill.position.set(0,3.85,-1.36);
scene.add(fill);
for (const s of rig.lanterns) {
  const light = new T.PointLight(s.color, s.intensity, s.range, 2);
  light.position.set(...s.at);
  scene.add(light);
}
// This sparse backdrop is exterior architecture lighting decor only.
const decoration = [];
for (let i=0; i<160; i++) {
  const a = i * 2.39996323;
  const height = .09 + .88 * ((i * 47 % 157) / 156);
  const radius = 42 * Math.sqrt(1-height**2);
  decoration.push(Math.cos(a)*radius,height*42,Math.sin(a)*radius);
}
const celestial = new T.BufferGeometry();
celestial.setAttribute('position',new T.Float32BufferAttribute(decoration,3));
scene.add(new T.Points(celestial,new T.PointsMaterial({color:'#bdcbd6',size:.15,depthWrite:false})));

const camera = new T.PerspectiveCamera(51, 1, .04, 77);
camera.rotation.order = 'YXZ';
let eyeHeight = plan.avatar.eyes[1], view = 'entry', dirty = true;
function pose(key, height = eyeHeight) {
  const item = plan.poses[key];
  camera.position.set(item.eye[0], height, item.eye[2]);
  camera.lookAt(new T.Vector3(...item.target));
  view = key;
  document.body.dataset.view = key;
  dirty = true;
}
function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < .82 ? 67 : 51;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  dirty = true;
}
addEventListener('resize',() => {
  resize();
  if (dialog.open) sizeFrame(frame.dataset.scale);
});
resize();

const textures = {};
const loader = new T.TextureLoader();
const openTexture = async (href) => {
  const texture = await loader.loadAsync(href);
  texture.colorSpace = T.SRGBColorSpace;
  return new T.MeshBasicMaterial({map:texture, toneMapped:false});
};
for (const [id, asset] of Object.entries(media.frames)) {
  textures[id] = {
    original: await openTexture(asset.original),
    thumbnail: await openTexture(asset.thumbnail),
  };
  if (rig.pictures[id]) rig.pictures[id].material = textures[id].thumbnail;
}

const panelText = {capture:'CAPTURA DE PRUEBA', offline:'SIN SEÑAL', preview:'MODO EN VIVO · DEMO'};
const panelLooks = Object.fromEntries(Object.entries(panelText).map(([state,text]) => [state,rig.statusMaterial(text)]));
let phase, displayed, timer, activeAsset;
function showFrame(id) {
  displayed = id;
  dirty = true;
  rig.pictures.eyepiece.material = id ? textures[id].original : rig.shadow;
}
function setPhase(state) {
  clearTimeout(timer);
  phase = state;
  document.body.dataset.state = state;
  for (const button of document.querySelectorAll('[data-state]'))
    button.setAttribute('aria-pressed', String(button.dataset.state === state));
  const text = {
    capture:'Captura fijada · WANDA simulado',
    offline:'Sin señal · Archivo de prueba disponible',
    preview:'Modo en vivo · Demostración simulada',
  };
  status.textContent = text[state];
  rig.statusPanel.material = panelLooks[state];
  q('#open-eye').disabled = state === 'offline';
  if (state !== 'preview') {
    showFrame(state === 'capture' ? 'capture' : null);
    return;
  }
  const steps = media.sequence;
  let index = 0;
  function showNext() {
    const step = steps[index];
    showFrame(step.id);
    index++;
    if (index < steps.length) timer = setTimeout(showNext, steps[index].offset - step.offset);
  }
  showNext();
}
function sizeFrame(mode) {
  const fitWidth = Math.min(scroller.clientWidth, scroller.clientHeight * (4 / 3));
  frame.style.width = mode === '2' ? `${fitWidth * 2}px` : '';
}
function scale(mode) {
  frame.dataset.scale = mode;
  sizeFrame(mode);
  q('#fit').setAttribute('aria-pressed',String(mode === '1'));
  q('#zoom').setAttribute('aria-pressed',String(mode === '2'));
  scroller.scrollTo(0,0);
}
function inspect(id) {
  const selected = media.frames[id];
  if (!selected) return;
  activeAsset = id;
  q('#inspection-title').textContent = id === 'capture' ? 'Captura fijada' : 'Fotograma de demostración';
  frame.src = selected.original;
  frame.dataset.asset = id;
  const when = id === 'capture' ? ' · 03:00:01.100 UTC · 100 ms · 2×' : ` · +${selected.offset} ms`;
  q('#meta').textContent = `WANDA simulado · 640 × 480${when}`;
  dialog.showModal();
  scale('1');
  q('#close').focus();
}
q('#fit').onclick = () => scale('1');
q('#zoom').onclick = () => scale('2');
q('#close').onclick = () => dialog.close();
q('#open-eye').onclick = () => inspect(displayed);
q('#open-gallery').onclick = () => inspect('capture');
for (const button of document.querySelectorAll('[data-pose]'))
  button.onclick = () => pose(button.dataset.pose);
for (const button of document.querySelectorAll('[data-state]'))
  button.onclick = () => setPhase(button.dataset.state);

const keys = new Set();
addEventListener('keydown', event => {
  if (!dialog.open && /^[wasd]$/i.test(event.key) && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    keys.add(event.key.toLowerCase());
  }
});
addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
const floorDirection = new T.Vector3();
const rays = new T.Raycaster();
const canvas = renderer.domElement;
let drag;
canvas.addEventListener('pointerdown', event => {
  canvas.setPointerCapture(event.pointerId);
  drag = {x:event.clientX,y:event.clientY,length:0};
});
canvas.addEventListener('pointermove', event => {
  if (!drag) return;
  const dx = event.clientX-drag.x, dy = event.clientY-drag.y;
  drag.x=event.clientX; drag.y=event.clientY;
  drag.length+=Math.abs(dx)+Math.abs(dy);
  dirty = true;
  camera.rotation.y -= dx * .003;
  camera.rotation.x = T.MathUtils.clamp(camera.rotation.x - dy * .003, -1.46, 1.46);
});
canvas.addEventListener('pointerup', event => {
  if (!drag) return;
  const activate = drag.length < 7;
  drag = undefined;
  if (!activate) return;
  camera.updateMatrixWorld();
  rays.setFromCamera(new T.Vector2(event.clientX/innerWidth*2-1,1-event.clientY/innerHeight*2),camera);
  rays.far = 3.2;
  const hit = rays.intersectObject(rig.model,true)[0]?.object;
  const match = Object.entries(rig.hitboxes).find(([,mesh]) => mesh === hit)?.[0];
  if (match) inspect(match === 'eyepiece' ? displayed : match);
});
canvas.addEventListener('pointercancel',() => {drag=undefined;});

const args = new URLSearchParams(location.search);
if (args.has('art')) document.body.classList.add('art');
pose(args.get('view') in plan.poses ? args.get('view') : 'entry');
setPhase('capture');
let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(.2, (now-last)/1000);
  last = now;
  if (keys.size && !dialog.open) {
    dirty = true;
    camera.getWorldDirection(floorDirection);
    floorDirection.y=0; floorDirection.normalize();
    const f = Number(keys.has('w'))-Number(keys.has('s'));
    const s = Number(keys.has('d'))-Number(keys.has('a'));
    const slices = Math.max(1,Math.ceil(dt/.035));
    const step = 2.28*dt/(slices*Math.max(1,Math.hypot(f,s)));
    const at = camera.position;
    const dx = (floorDirection.x*f-floorDirection.z*s)*step;
    const dz = (floorDirection.z*f+floorDirection.x*s)*step;
    for (let i=0;i<slices;i++) {
      if (walkable(at.x+dx,at.z)) at.x+=dx;
      if (walkable(at.x,at.z+dz)) at.z+=dz;
    }
  }
  if (dirty) {
    renderer.render(scene,camera);
    dirty = false;
  }
}
requestAnimationFrame(animate);

function survey() {
  scene.updateMatrixWorld(true);
  const sampled = {};
  for (const [name,path] of Object.entries(plan.paths)) {
    let points = 0;
    for (let i=1;i<path.length;i++) {
      const [x,z]=path[i-1], [x2,z2]=path[i];
      const intervals=Math.ceil(Math.hypot(x-x2,z-z2)/.05);
      for(let j=0;j<=intervals;j++) {
        if (!walkable(T.MathUtils.lerp(x,x2,j/intervals),T.MathUtils.lerp(z,z2,j/intervals),.56))
          throw Error(`Clearance failed on ${name}`);
        points++;
      }
    }
    sampled[name]=points;
  }
  const sightlines=[];
  for (const height of plan.avatar.eyes) {
    for (const [poseName,target] of [['entry','eyepiece'],['ocular','eyepiece'],['photo','capture'],
                                    ['gallery','preview-02'],['gallery','preview-03']]) {
      const p=plan.poses[poseName];
      const origin = new T.Vector3(p.eye[0],height,p.eye[2]);
      const targetMesh = rig.hitboxes[target];
      const center=targetMesh.getWorldPosition(new T.Vector3());
      const line=new T.Raycaster(origin,center.clone().sub(origin).normalize(),0,origin.distanceTo(center)+.025);
      if (line.intersectObject(rig.model,true)[0]?.object!==targetMesh) throw Error(`Occluded ${poseName} ${height}`);
      sightlines.push({pose:poseName,target,eyeHeight:height,distanceM:origin.distanceTo(center)});
    }
  }
  return {sampled,minimumWalkDiameter:1.12,sightlines,anchors:Object.keys(rig.markers)};
}

async function exportModel() {
  const pictures = [...Object.values(rig.pictures), rig.statusPanel];
  const materials = pictures.map(p => p.material);
  let bytes;
  try {
    pictures.forEach(p => {p.material = rig.shadow;});
    bytes = await new GLTFExporter().parseAsync(rig.model, {binary:true});
  } finally {
    pictures.forEach((p,i) => {p.material = materials[i];});
  }
  const {scene:reopened} = await new GLTFLoader().parseAsync(bytes,'');
  const anchors = new Set();
  reopened.traverse(node => {
    if (node.userData?.anchorId) anchors.add(node.userData.anchorId);
  });
  if (Object.keys(plan.anchors).some(id => !anchors.has(id)) || anchors.size!==Object.keys(plan.anchors).length)
    throw Error(`Roundtrip kept ${anchors.size} named anchors`);
  const a = document.createElement('a');
  a.href=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'}));
  a.download='Templo-de-Nix.glb'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href),1000);
  return {bytes:bytes.byteLength,anchors:[...anchors]};
}

window.nixReview = {
  pose, setPhase, inspect, survey, exportModel,
  height: value => {eyeHeight=value; pose(view);},
  state: () => ({phase,displayed,activeAsset,state:document.body.dataset.state,eye:camera.position.toArray()}),
};
document.body.dataset.ready = 'true';
