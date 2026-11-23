// Walkable display anchors match the authored Blender plinths.
export const GALLERY_STAGES=Object.freeze({
  'house-exhibit':{title:'Terminado',position:{x:2.5,y:.965,z:1.25},color:'#234841'},
  'house-exhibit-draft':{title:'En proceso',position:{x:3.3945,y:1.1075,z:-.34944},color:'#4b4130'},
  'house-exhibit-archive':{title:'Archivo',position:{x:3.3945,y:1.4075,z:3.67744},color:'#374553'},
});

export function applyGallerySigns(scene,entries){
  if(!scene)return;
  const authorized=entries.filter(entry=>entry.galleryDisplay===true&&Object.hasOwn(GALLERY_STAGES,entry.id));
  const prior=scene.querySelector('#gallery-stage-signs');
  const signature=authorized.map(entry=>entry.id).join(',');
  if(prior?.getAttribute('data-stages')===signature)return;
  prior?.remove();
  if(!authorized.length)return;
  const document=scene.ownerDocument;
  const signs=document.createElement('m-group');
  signs.id='gallery-stage-signs';
  signs.setAttribute('data-stages',signature);
  for(const entry of authorized){
    const {title,position,color}=GALLERY_STAGES[entry.id];
    for(const facing of [-90,90]){
      const plaque=document.createElement('m-label');
      const data={id:entry.id+(facing<0?'-sign-front':'-sign-back'),
        'aria-label':title,content:title,
        x:position.x+(facing<0?-.015:.015),y:position.y+.79,z:position.z,
        ry:facing,width:1.45,height:.29,'font-size':18,alignment:'center',color,'font-color':'#f6edda',collide:'false'};
      for(const [name,value] of Object.entries(data))plaque.setAttribute(name,String(value));
      signs.append(plaque);
    }
  }
  scene.append(signs);
}
