import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WorldNotice} from '../src/client-feedback.mjs';
import {selectionLabel} from '../src/world-indication.mjs';

test('confirmed transient feedback expires without clearing a newer error or uncertain outcome',()=>{
 const element={textContent:''},tasks=new Map();let id=0;
 const notice=new WorldNotice(element,{setTimeout:(fn,delay)=>{assert.equal(delay,6000);const key=++id;tasks.set(key,()=>{tasks.delete(key);fn();});return key;},clearTimeout:key=>tasks.delete(key)});
 notice.show('Volviste al mundo.',{transient:true});const late=tasks.get(1);
 notice.show('Estoy comprobando si el cambio llegó.');late();
 assert.equal(element.textContent,'Estoy comprobando si el cambio llegó.');assert.equal(tasks.size,0);
 notice.show('Ese lugar cambió.');assert.equal(tasks.size,0);
 notice.show('El cambio quedó deshecho.',{transient:true});tasks.get(2)();assert.equal(element.textContent,'');
 notice.show('Otra confirmación.',{transient:true});const canceled=tasks.get(3);notice.clear();canceled();assert.equal(element.textContent,'');assert.equal(tasks.size,0);
});

test('selection names come from the current public node, distinguishing game and result without raw identifiers',()=>{
 const id='node-private-looking-id',state={nodes:{[id]:{title:'Taller en revisión'}}};
 assert.equal(selectionLabel(id,state),'el contenido «Taller en revisión»');
 state.nodes[id]={title:'Jardín de señales',play:{}};assert.equal(selectionLabel(id,state),'el juego «Jardín de señales»');
 state.nodes[id].title='Edición nueva';assert.equal(selectionLabel(id,state),'el juego «Edición nueva»');
 state.nodes[id].deleted=true;assert.equal(selectionLabel(id,state),'este contenido');
 assert.equal(selectionLabel('garden-luz',state),'una luz');assert.equal(selectionLabel('bridge',state),'el puente');
});
