// Narrow client evidence: applied MML primitive geometry in the Three scene graph
// after a renderer call returned. This is not a GPU fence, pixel/frame receipt,
// visibility/frustum/occlusion test, human attention or trusted server authority.
import {workshopProjection} from './workshop-projection.mjs';
const near=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<1e-4;
const attached=(object,scene)=>{for(let n=object,depth=0;n&&depth<64;n=n.parent,depth++)if(n===scene)return true;return false;};
const find=(root,id)=>root.querySelector(`[id="${id}"]`);
function live(element,scene){
  if(!element?.isConnected||typeof element.getContainer!=='function'||typeof element.getVisible!=='function'||typeof element.isDisabled!=='function')return false;
  const object=element.getContainer();
  return !element.isDisabled()&&element.getVisible()===true&&object?.isObject3D&&attached(object,scene);
}
function primitiveMatches(element,expected,scene){
  if(!live(element,scene)||element.tagName.toLowerCase()!==`m-${expected.kind}`)return false;
  const object=element.getContainer(),position=element.getWorldPosition?.();
  if(!position||!['x','y','z'].every((key,i)=>near(position[key],expected.position[i])))return false;
  const matrix=object.matrixWorld?.elements;
  const identity=[1,0,0,0,0,1,0,0,0,0,1,0,...expected.position,1];
  if(!matrix||!identity.every((n,i)=>near(matrix[i],n)))return false;
  const meshes=object.children.filter(child=>child.isMesh);
  if(meshes.length!==1)return false;
  const mesh=meshes[0],geometry=mesh.geometry,material=mesh.material;
  if(mesh.visible===false||!geometry?.attributes?.position?.count||!material||Array.isArray(material)||material.visible===false||!near(material.opacity,1))return false;
  if(!['x','y','z'].every(key=>near(mesh.position[key],0))||!near(mesh.quaternion.x,0)||!near(mesh.quaternion.y,0)||!near(mesh.quaternion.z,0)||!near(mesh.quaternion.w,1))return false;
  const scale=expected.kind==='cube'?expected.size:expected.kind==='cylinder'?[expected.size[0]*2,expected.size[1],expected.size[0]*2]:Array(3).fill(expected.size[0]*2);
  if(!['x','y','z'].every((key,i)=>near(mesh.scale[key],scale[i])))return false;
  const type={cube:'BoxGeometry',cylinder:'CylinderGeometry',sphere:'SphereGeometry'}[expected.kind];
  if(geometry.type!==type||element.getAttribute('color')?.toLowerCase()!==expected.color)return false;
  // MML's public #RRGGBB parser supplies normalized channels directly to Three.
  const rgb=[1,3,5].map(index=>parseInt(expected.color.slice(index,index+2),16)/255);
  return ['r','g','b'].every((key,i)=>near(material.color?.[key],rgb[i]));
}
export function verifyWorkshopGeometry(root,scene,{expectedDocumentURL}={}){
  try{
    if(!live(root,scene)||root.id!=='workshop')return null;
    const source=root.getInitiatedRemoteDocument?.();
    if(!source||source.getDocumentAddress?.()!==expectedDocumentURL)return null;
    const run=root.getAttribute('data-run'),edition=root.getAttribute('data-edition'),rawSequence=root.getAttribute('data-semantic-sequence');
    if(!run||run.length>80||!edition||edition.length>128||!/^\d+$/.test(rawSequence||''))return null;
    const sequence=Number(rawSequence);if(!Number.isSafeInteger(sequence))return null;
    const manifest=root.getAttribute('data-geometry-state');if(!manifest||manifest.length>16384)return null;
    const entities=workshopProjection(JSON.parse(manifest));
    const scenery=find(root,'island-scenery');
    if(!live(scenery,scene)||scenery.modelGraphics?.hasLoadedModel?.()!==true||!scenery.getContentBounds?.())return null;
    let sceneryMeshes=0;scenery.getContainer().traverse(node=>{if(node.isMesh&&node.geometry?.attributes?.position?.count)sceneryMeshes++;});
    if(!sceneryMeshes)return null;
    const entityRefs=[];
    for(const entity of entities){
      const group=find(root,entity.id);
      if(entity.deleted){if(group)return null;entityRefs.push([entity.id,entity.revision,'not-in-document']);continue;}
      if(!live(group,scene)||group.getAttribute('data-entity-revision')!==String(entity.revision))return null;
      if(![...entity.nodes,...(entity.controls||[])].every(node=>primitiveMatches(find(root,node.id),node,scene)))return null;
      entityRefs.push([entity.id,entity.revision,'attached']);
    }
    return {run,edition,sequence,manifest,entityRefs};
  }catch{return null;}
}
const digest=async text=>{
  if(!globalThis.crypto?.subtle)return null;
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
};
export class AppliedGeometryProbe{
  constructor({document,scene,canvas,expectedDocumentURL,now=Date.now,monotonic=()=>performance.now(),hash=digest,Observer=globalThis.MutationObserver}={}){
    Object.assign(this,{document,scene,canvas,expectedDocumentURL,now,monotonic,hash,Observer});
    this.root=null;this.cache=null;this.dirty=true;this.pending=false;this.generation=0;this.contextLost=false;this.disposed=false;this.frames=0;this.lastRender=-Infinity;this.nextCheck=-Infinity;
    this.lost=()=>{this.contextLost=true;this.invalidate();};this.restored=()=>{this.contextLost=false;this.invalidate();};
    canvas?.addEventListener('webglcontextlost',this.lost);canvas?.addEventListener('webglcontextrestored',this.restored);
  }
  invalidate(){this.dirty=true;this.cache=null;this.generation++;}
  afterRender(){
    if(this.disposed)return;
    this.frames++;this.lastRender=this.monotonic();this.lastRenderAt=this.now();
    if(this.contextLost||this.document.visibilityState==='hidden'){this.invalidate();return;}
    const root=this.document.querySelector('m-group#workshop');
    const sourceVersion=root?['data-run','data-edition','data-semantic-sequence'].map(name=>root.getAttribute(name)).join('\0'):null;
    if(root===this.root&&sourceVersion!==this.sourceVersion)this.invalidate();
    this.sourceVersion=sourceVersion;
    if(root!==this.root){
      this.observer?.disconnect();this.root=root;this.invalidate();
      if(root&&this.Observer){this.observer=new this.Observer(()=>this.invalidate());this.observer.observe(root,{subtree:true,childList:true,attributes:true});}
    }
    if(!root||!this.dirty||this.pending||this.lastRender<this.nextCheck)return;
    this.nextCheck=this.lastRender+100;
    const verified=verifyWorkshopGeometry(root,this.scene,{expectedDocumentURL:this.expectedDocumentURL});
    if(!verified)return;
    const generation=this.generation,verifiedAt=this.now(),verifiedFrame=this.frames;
    this.pending=true;this.dirty=false;
    Promise.resolve(this.hash(verified.manifest)).then(sha=>{
      if(!sha||this.disposed||this.contextLost||this.dirty||generation!==this.generation||!this.sameSource(verified))return;
      this.cache={...verified,manifestSha256:sha,verifiedAt,verifiedFrame};
    }).catch(()=>{this.dirty=true;}).finally(()=>{this.pending=false;});
  }
  sameSource(value){return this.root?.isConnected&&this.root.getAttribute('data-run')===value.run&&this.root.getAttribute('data-edition')===value.edition&&this.root.getAttribute('data-semantic-sequence')===String(value.sequence)&&this.root.getAttribute('data-geometry-state')===value.manifest;}
  snapshot(){
    const value=this.cache;
    if(!value||this.disposed||this.contextLost||this.dirty||this.document.visibilityState==='hidden'||this.monotonic()-this.lastRender>2000||!this.sameSource(value))return null;
    try{if(this.canvas?.getContext?.('webgl2')?.isContextLost?.()){this.contextLost=true;this.invalidate();return null;}}catch{return null;}
    // Recheck the actual objects at capture, not just cached DOM revision labels.
    // This also detects a detached/changed mesh without a DOM mutation callback.
    const current=verifyWorkshopGeometry(this.root,this.scene,{expectedDocumentURL:this.expectedDocumentURL});
    if(!current||current.manifest!==value.manifest){this.invalidate();return null;}
    const refs=value.entityRefs.slice(0,8);
    return {schema:'holodeck.applied-geometry/v1',evidence:'client-mml-three-scene-after-render-call',scope:'workshop-entity-primitives',
      run:value.run,edition:value.edition,sequence:value.sequence,manifestSha256:value.manifestSha256,
      entityCount:value.entityRefs.length,entityRefs:refs,omittedEntityRefs:value.entityRefs.length-refs.length,
      geometryVerifiedAt:value.verifiedAt,geometryCheckedAt:this.now(),renderCallReturnedAt:this.lastRenderAt};
  }
  dispose(){this.disposed=true;this.observer?.disconnect();this.canvas?.removeEventListener('webglcontextlost',this.lost);this.canvas?.removeEventListener('webglcontextrestored',this.restored);this.invalidate();}
}
