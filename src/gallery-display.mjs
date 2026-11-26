// Walkable display anchors match the authored Blender plinths.
export const GALLERY_STAGES=Object.freeze({
  'house-exhibit':{title:'Terminado',position:{x:2.5,y:.965,z:1.25},color:'#234841'},
  'house-exhibit-draft':{title:'En proceso',position:{x:3.3945,y:1.1075,z:-.34944},color:'#4b4130'},
  'house-exhibit-archive':{title:'Archivo',position:{x:3.3945,y:1.4075,z:3.67744},color:'#374553'},
});

const renderedCatalogs=new WeakMap();
const renderedPlaques=new WeakMap();
// Hold the feet just inside the aisle edge of each measured oak deck.
const deckFront={
  'house-exhibit':1.895,
  'house-exhibit-draft':2.1245,
  'house-exhibit-archive':2.1245,
};
const bronze='#56391d';
const enamel='#071412';
const PLAQUE_WIDTH=.91;
const PLAQUE_PADDING=3;

function plaqueTitle(title,context){
  const characters=Array.from(title.trim().replace(/\s+/g,' ')).slice(0,160);
  const limit=PLAQUE_WIDTH*200-PLAQUE_PADDING*2;
  if(!context){
    const text=characters.length>20?characters.slice(0,19).join('').trimEnd()+'…':characters.join('');
    return {text,fontSize:8.5};
  }
  const text=characters.join('');
  for(const fontSize of [10.5,9.5,8.5]){
    context.font=`bold ${fontSize*2}px Arial`;
    if(context.measureText(text).width<=limit)return {text,fontSize};
  }
  const words=text.split(' ');
  const twoLineSize=7.75;
  context.font=`bold ${twoLineSize*2}px Arial`;
  let best=null;
  for(let i=1;i<words.length;i++){
    const rows=[words.slice(0,i).join(' '),words.slice(i).join(' ')];
    const width=Math.max(...rows.map(row=>context.measureText(row).width));
    if(width<=limit&&(!best||width<best.width))best={rows,width};
  }
  if(best)return {text:best.rows.join('\n'),fontSize:twoLineSize,twoLines:true};
  context.font='bold 17px Arial';
  while(characters.length&&context.measureText(characters.join('')+'…').width>limit)characters.pop();
  return {text:characters.join('').trimEnd()+'…',fontSize:8.5};
}

function element(document,tag,attributes){
  const node=document.createElement(tag);
  for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));
  return node;
}

function addPlate(signs,entry,measure,authoredDecks,genericDeckTop){
  const document=signs.ownerDocument;
  const {title,position}=GALLERY_STAGES[entry.id];
  const edition=typeof entry.editionTitle==='string'?entry.editionTitle.trim():'';
  const named=edition&&edition!==title;
  const deckY=authoredDecks?position.y:entry.id==='house-exhibit'?genericDeckTop:null;
  const deckMounted=deckY!==null;
  const plaque=element(document,'m-group',{
    id:entry.id+'-plaque','aria-label':named?title+' · '+edition:title,
    x:deckMounted?deckFront[entry.id]:position.x,
    y:deckY??position.y+.645,z:position.z,ry:-90,
  });
  renderedPlaques.set(plaque,{nodeRevision:entry.nodeRevision,pin:entry.pin});
  const cube=attributes=>element(document,'m-cube',{collide:false,...attributes});
  if(deckMounted){
    for(const x of [-.32,.32])plaque.append(cube({x,y:.029,z:-.016,width:.038,height:.058,depth:.060,color:bronze}));
  }
  const face=element(document,'m-group',{y:.173,rx:deckMounted?-12:0});
  face.append(
    cube({width:1,height:.274,depth:.024,color:bronze}),
    cube({width:.963,height:.237,depth:.032,color:enamel,'cast-shadows':false}),
  );
  const editionRow=named?plaqueTitle(edition,measure):null;
  const lines=editionRow?[
    {kind:'sign',text:title,y:.076,height:.085,fontSize:7,fontColor:'#ebc591'},
    {kind:'edition',...editionRow,y:-.027,height:editionRow.twoLines ? .171 : .122,fontColor:'#fff4da'},
  ]:[{kind:'sign',text:title,y:0,height:.14,fontSize:11.5,fontColor:'#fff4da'}];
  for(const direction of [1,-1]){
    for(const line of lines){
      face.append(element(document,'m-label',{
        id:entry.id+'-'+line.kind+(direction===1?'-front':'-back'),
        'aria-label':line.kind==='edition'?edition:title,content:line.text,
        y:line.y,z:direction*.017,ry:direction===1?0:180,
        width:PLAQUE_WIDTH,height:line.height,padding:PLAQUE_PADDING,
        'font-size':line.fontSize,alignment:'center',color:'rgba(0,0,0,0)',
        'font-color':line.fontColor,emissive:.20,collide:false,'cast-shadows':false,
      }));
    }
  }
  plaque.append(face);
  signs.append(plaque);
}

export function applyGallerySigns(scene,entries){
  if(!scene)return;
  const authorized=entries.filter(entry=>entry.galleryDisplay===true&&Object.hasOwn(GALLERY_STAGES,entry.id));
  const prior=scene.querySelector('#gallery-stage-signs');
  const fallbackDeck=scene.querySelector('#house-exhibit > m-cube');
  const authoredDecks=!fallbackDeck&&!!scene.querySelector('m-model#room-art[src]');
  const genericDeckTop=fallbackDeck?
    Number(fallbackDeck.getAttribute('y'))+Number(fallbackDeck.getAttribute('height'))/2:null;
  const signature=JSON.stringify([authoredDecks,genericDeckTop,
    authorized.map(({id,nodeRevision,editionTitle,pin})=>[id,nodeRevision,editionTitle,pin])]);
  if(prior&&renderedCatalogs.get(prior)===signature)return;
  prior?.remove();
  if(!authorized.length)return;
  const document=scene.ownerDocument??scene;
  const measure=document.defaultView?.CanvasRenderingContext2D?
    document.createElement('canvas').getContext('2d'):null;
  const signs=element(document,'m-group',{id:'gallery-stage-signs','data-stages':''});
  renderedCatalogs.set(signs,signature);
  for(const entry of authorized)addPlate(signs,entry,measure,authoredDecks,genericDeckTop);
  scene.append(signs);
}

export function renderedGalleryPlaque(scene,id){
  const plaque=scene?.querySelector('#'+id+'-plaque');
  const rendered=renderedPlaques.get(plaque);
  return rendered?{...rendered,container:plaque.getContainer?.()}:null;
}
