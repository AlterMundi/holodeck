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
 assert.deepEqual(model.action('save','button').action.context,{sessionId:'test',revision:8,gain:2});
 model.action('tabs','tab','preset');
 view=model.render('Shaper');
 assert.equal(view.components.find(node=>node.id==='preset').component,'HudTextInput');
 assert.equal(model.action('save','button'),undefined);
});
