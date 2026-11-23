// Walkable display anchors match the authored Blender plinths.
export const GALLERY_STAGES=Object.freeze({
  'house-exhibit':{title:'Terminado',position:{x:2.5,y:.965,z:1.25},color:'#234841'},
  'house-exhibit-draft':{title:'En proceso',position:{x:3.3945,y:1.1075,z:-.34944},color:'#4b4130'},
  'house-exhibit-archive':{title:'Archivo',position:{x:3.3945,y:1.4075,z:3.67744},color:'#374553'},
});

const renderedCatalogs=new WeakMap();

const EDITION_FONT=14;
const PLAQUE_WIDTH=1.55;
const PLAQUE_PADDING=4;

function plaqueTitle(title,context){
  if(typeof title!=='string')return '';
  const characters=Array.from(title.trim());
  const limit=PLAQUE_WIDTH*200-PLAQUE_PADDING*2;
  const text=characters.slice(0,38).join('');
  if(!context)return characters.length>38?characters.slice(0,37).join('')+'…':text;
  // MML rasterizes bold Arial at 200 texture pixels per metre.
  context.font=`bold ${EDITION_FONT*2}px Arial`;
  if(characters.length<=38&&context.measureText(text).width<=limit)return text;
  const prefix=characters.slice(0,37);
  while(prefix.length&&context.measureText(prefix.join('')+'…').width>limit)prefix.pop();
  return prefix.join('').trimEnd()+'…';
}

export function applyGallerySigns(scene,entries){
  if(!scene)return;
  const authorized=entries.filter(entry=>entry.galleryDisplay===true&&Object.hasOwn(GALLERY_STAGES,entry.id));
  const prior=scene.querySelector('#gallery-stage-signs');
  const signature=JSON.stringify(authorized.map(({id,nodeRevision,editionTitle})=>[id,nodeRevision,editionTitle]));
  if(prior&&renderedCatalogs.get(prior)===signature)return;
  prior?.remove();
  if(!authorized.length)return;
  const document=scene.ownerDocument;
  const measure=document.defaultView?.CanvasRenderingContext2D?
    document.createElement('canvas').getContext('2d'):null;
  const signs=document.createElement('m-group');
  signs.id='gallery-stage-signs';
  signs.setAttribute('data-stages','');
  renderedCatalogs.set(signs,signature);
  for(const entry of authorized){
    const {title,position,color}=GALLERY_STAGES[entry.id];
    const edition=entry.editionTitle===title?'':plaqueTitle(entry.editionTitle,measure);
    const lines=edition?[
      {kind:'sign',text:title,y:1.045,height:.21,fontSize:15,fontColor:'#e7c991'},
      {kind:'edition',text:edition,y:.827,height:.223,fontSize:EDITION_FONT,fontColor:'#f6edda'},
    ]:[{kind:'sign',text:title,y:.79,height:.29,fontSize:18,fontColor:'#f6edda'}];
    for(const facing of [-90,90]){
      for(const line of lines){
        const plaque=document.createElement('m-label');
        const data={id:entry.id+'-'+line.kind+(facing<0?'-front':'-back'),
          'aria-label':line.text,content:line.text,
          x:position.x+(facing<0?-.015:.015),y:position.y+line.y,z:position.z,
          ry:facing,width:PLAQUE_WIDTH,height:line.height,padding:PLAQUE_PADDING,'font-size':line.fontSize,
          alignment:'center',color,'font-color':line.fontColor,collide:'false'};
        for(const [name,value] of Object.entries(data))plaque.setAttribute(name,String(value));
        signs.append(plaque);
      }
    }
  }
  scene.append(signs);
}
