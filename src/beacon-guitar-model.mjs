import {AmbientLight, DirectionalLight, PerspectiveCamera, Scene, WebGLRenderer} from 'three';
import {readWorktableReview} from './collection-review.mjs';
import {makeModel} from './collection-worktable.mjs';
import {disposeModel} from './gallery-models.mjs';

const sections=[['mechanism','Mecanismo'],['startup','Arranque'],['support','Soporte']];

export function mountGuitarModel(wrapper,edition){
  const doc=wrapper.ownerDocument;
  const panel=doc.createElement('aside');
  panel.className='beacon-guitar-model';
  panel.setAttribute('aria-label','Modelo de H.B. Guitar');
  const views=doc.createElement('div');
  views.className='beacon-guitar-views';
  const viewport=doc.createElement('div');
  viewport.className='beacon-guitar-viewport';
  const status=doc.createElement('p');
  status.setAttribute('role','status');
  panel.append(views,viewport,status);
  wrapper.prepend(panel);

  let renderer;
  try{renderer=new WebGLRenderer({antialias:true,alpha:true});}catch{
    status.textContent='El modelo 3D no está disponible en este navegador.';
    return ()=>panel.remove();
  }
  renderer.setPixelRatio(Math.min(doc.defaultView.devicePixelRatio||1,2));
  viewport.append(renderer.domElement);
  const scene=new Scene();
  scene.add(new AmbientLight(0xffffff,1.85));
  const lamp=new DirectionalLight(0xffffff,2.4);
  lamp.position.set(3,4,5);
  scene.add(lamp);
  const camera=new PerspectiveCamera(35,1,.01,20);
  camera.position.set(1.65,1.32,2.31);
  camera.lookAt(0,.35,0);
  let pending, display, active;
  const buttons=new Map();
  const observer=new ResizeObserver(render);
  observer.observe(viewport);

  function render(){
    const {clientWidth:width,clientHeight:height}=viewport;
    if(!width||!height)return;
    camera.aspect=width/height;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    renderer.render(scene,camera);
  }
  function clearModel(){
    if(!display)return;
    scene.remove(display.group);
    disposeModel(display.group);
    display=null;
  }
  async function choose(section){
    const anchor=edition.anchors?.[section];
    if(!anchor||active===section)return;
    active=section;
    for(const [id,button] of buttons)button.setAttribute('aria-pressed',String(id===section));
    pending?.abort();
    const controller=new AbortController();
    pending=controller;
    clearModel();
    render();
    status.textContent='Cargando la pieza…';
    try{
      const review=await readWorktableReview(edition,anchor.scene,{signal:
        AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});
      if(controller.signal.aborted)return;
      if(review.id!==anchor.scene||!review.parts.some(part=>part.id===anchor.part))
        throw Error('Missing selected guitar part');
      display=makeModel(review,{x:0,y:0,z:0});
      display.parts.get(anchor.part).material.emissive.set('#208d79');
      display.parts.get(anchor.part).material.emissiveIntensity=.45;
      scene.add(display.group);
      status.textContent=review.parts.find(part=>part.id===anchor.part).label;
      render();
    }catch{
      if(controller.signal.aborted)return;
      active=null;
      buttons.get(section)?.setAttribute('aria-pressed','false');
      status.textContent='No se pudo abrir esa pieza del modelo.';
    }
  }
  for(const [section,title] of sections){
    const button=doc.createElement('button');
    button.type='button';
    button.textContent=title;
    button.setAttribute('aria-pressed','false');
    button.onclick=()=>void choose(section);
    buttons.set(section,button);
    views.append(button);
  }
  void choose('mechanism');
  return ()=>{
    pending?.abort();
    observer.disconnect();
    clearModel();
    renderer.dispose();
    renderer.forceContextLoss();
    panel.remove();
  };
}
