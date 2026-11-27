import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BeaconNativeModel} from '../src/beacon-native-model.mjs';

const at=pointer=>({'@path':pointer});
const components=[
 {id:'root',component:'Column',children:['tabs']},
 {id:'tabs',component:'Tabs',tabs:[{title:'Mezcla',child:'main'},{title:'Presets',child:'preset'}]},
 {id:'main',component:'Column',children:['gain','save']},
 {id:'gain',component:'Slider',label:'Ganancia',min:0,max:4,steps:40,value:at('/gain')},
 {id:'save',component:'Button',child:'saveLabel',action:{event:{name:'setOutputGain',
  context:{sessionId:at('/sessionId'),revision:at('/revision'),gain:at('/gain')}}}},
 {id:'saveLabel',component:'Text',text:'Aplicar'},
 {id:'preset',component:'TextField',label:'Nombre',value:at('/preset')},
];
const initial={version:'1.0',createSurface:{surfaceId:'shaper',components,
 dataModel:{gain:1,sessionId:'test',revision:7,preset:''}}};

test('Three.js catalog controls use the original A2UI action and confirmed model',()=>{
 const model=new BeaconNativeModel('shaper');
 model.receive([initial]);
 let view=model.render('Shaper');
 assert.equal(view.components.find(node=>node.id==='gain').component,'HudRange');
 assert.equal(view.components.find(node=>node.id==='save').component,'HudButton');
 assert.equal(model.action('gain','range',1.3),undefined);
 model.render('Shaper');
 const {action}=model.action('save','button');
 assert.equal(action.sourceComponentId,'save');
 assert.equal(action.surfaceId,'shaper');
 assert.deepEqual(action.context,{sessionId:'test',revision:7,gain:1.3});
 model.receive([{version:'1.0',updateDataModel:{surfaceId:'shaper',path:'/',value:{gain:2,sessionId:'test',revision:8,preset:''}}}]);
 model.render('Shaper');
 assert.equal(model.action('save','button'),undefined);
 assert.equal(model.actionConflict,true);
 model.render('Shaper');
 model.action('gain','range',2.1);
 assert.deepEqual(model.action('save','button').action.context,{sessionId:'test',revision:8,gain:2.1});
 model.action('tabs','tab','preset');
 view=model.render('Shaper');
 assert.equal(view.components.find(node=>node.id==='preset').component,'HudTextInput');
 assert.equal(model.action('save','button'),undefined);
});

test('an edit cannot claim a newer revision even if the changed control value matches',()=>{
 const model=new BeaconNativeModel('shaper');
 model.receive([initial]);
 model.render('Shaper');
 model.action('gain','range',1.2);
 model.receive([{version:'1.0',updateDataModel:{surfaceId:'shaper',path:'/revision',value:8}}]);
 model.render('Shaper');
 assert.equal(model.action('save','button'),undefined);
 assert.equal(model.actionConflict,true);
 assert.equal(model.drafts.size,0);
});

test('independent Spatializer bands do not invalidate each other',()=>{
 const model=new BeaconNativeModel('spatializer');
 model.receive([{version:'1.0',createSurface:{surfaceId:'spatializer',
  dataModel:{stream:'engine',bands:{gain6:{observed:1,desired:1},gain7:{observed:0,desired:0}}},
  components:[
   {id:'root',component:'Column',children:['gain6','apply']},
   {id:'gain6',component:'Slider',label:'Ganancia',min:0,max:4,steps:40,value:at('/bands/gain6/desired')},
   {id:'apply',component:'Button',action:{event:{name:'setSpatializerControl',context:{
    expected:at('/bands/gain6/observed'),target:at('/bands/gain6/desired'),stream:at('/stream'),control:'gain6',
   }}}},
  ],
 }}]);
 model.render('Spatializer');
 model.action('gain6','range',1.3);
 model.receive([{version:'1.0',updateDataModel:{surfaceId:'spatializer',path:'/bands/gain7/observed',value:2}}]);
 model.render('Spatializer');
 assert.deepEqual(model.action('apply','button').action.context,{expected:1,target:1.3,stream:'engine',control:'gain6'});
 model.receive([{version:'1.0',updateDataModel:{surfaceId:'spatializer',path:'/bands/gain6/observed',value:2}}]);
 model.render('Spatializer');
 assert.equal(model.action('apply','button'),undefined);
 assert.equal(model.actionConflict,true);
});

test('a profile draft nested under an action binding retains the original profile version',()=>{
 const model=new BeaconNativeModel('operator');
 model.receive([{version:'1.0',createSurface:{surfaceId:'operator',
  dataModel:{enabled:{audio:false,body:true},profileVersion:'old'},
  components:[
   {id:'root',component:'Column',children:['audio','save']},
   {id:'audio',component:'CheckBox',label:'Audio',value:at('/enabled/audio')},
   {id:'save',component:'Button',action:{event:{name:'saveProfile',context:{
    enabled:at('/enabled'),profileVersion:at('/profileVersion'),
   }}}},
  ],
 }}]);
 model.render('Operación del Lab');
 model.action('audio','check');
 assert.deepEqual(model.action('save','button').action.context,{enabled:{audio:true,body:true},profileVersion:'old'});
 model.receive([{version:'1.0',updateDataModel:{surfaceId:'operator',path:'/profileVersion',value:'new'}}]);
 model.render('Operación del Lab');
 assert.equal(model.action('save','button'),undefined);
 assert.equal(model.actionConflict,true);
});

test('pagination keeps an instrument field with its apply action and links the visible navigation',()=>{
 const model=new BeaconNativeModel('shaper');
 const leading=Array.from({length:6},(_,i)=>({id:'label_'+i,component:'Text',text:String(i)}));
 model.receive([{version:'1.0',createSurface:{surfaceId:'shaper',dataModel:{gain:1},components:[
  {id:'root',component:'Column',children:[...leading.map(row=>row.id),'gain','apply']},...leading,
  {id:'gain',component:'Slider',label:'Gain',min:0,max:2,value:at('/gain')},
  {id:'apply',component:'Button',label:'Aplicar',action:{event:{name:'setOutputGain',context:{gain:at('/gain')}}}},
 ]}}]);
 const first=model.render('Shaper');
 assert.ok(!first.components.some(node=>node.id==='gain'));
 const pager=first.components.find(node=>node.id==='station_pages');
 assert.ok(pager.children.every(id=>first.components.some(node=>node.id===id)));
 model.action('station_pages','page',1);
 const next=model.render('Shaper');
 assert.ok(next.components.some(node=>node.id==='gain'));
 assert.ok(next.components.some(node=>node.id==='apply'));
});
