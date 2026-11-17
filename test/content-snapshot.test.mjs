import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Room} from '../src/room.mjs';import {exportWorldSnapshot} from '../tools/export-world-snapshot.mjs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const human={id:'snapshot-fixture',kind:'human',rights:['observe','edit']};
const scenery=readFileSync(new URL('../public/assets/island-scenery.glb',import.meta.url));
function document(bytes){assert.equal(bytes.readUInt32LE(8),bytes.length);return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());}
test('GLB freezes semantic creation state with shared entity references and independent source hashes',async()=>{
 const room=new Room();const observation=room.observe(human);
 const proposal={id:crypto.randomUUID(),issuedAt:Date.now(),run:room.run,edition:room.edition,observation:observation.id,type:'garden.place',target:'garden-snapshot',expectedRevision:null,args:{x:2,z:1,color:'rose'}};
 room.command(human,proposal);const captured=room.observe(human);const glb=exportWorldSnapshot(captured,scenery);const result=document(glb);
 assert.ok(glb.length<2*1024*1024);assert.ok(result.nodes.some(node=>node.name==='garden-snapshot'));
 assert.equal(result.extras.holodeck.semanticSequence,1);assert.equal(result.extras.holodeck.participantsExported,false);
 assert.equal(result.extras.holodeck.scenerySha256.length,64);
 assert.equal(result.extras.holodeck.authoredProjectionSha256.length,64);
 assert.ok(result.nodes.some(node=>node.name==='bridge'&&node.extras.revision===0));
 const loaded=await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');
 assert.ok(loaded.scene.getObjectByName('garden-snapshot'));
 assert.equal(loaded.scene.getObjectByName('bridge').userData.revision,0);
 for(const view of result.bufferViews)assert.ok(view.byteOffset+view.byteLength<=result.buffers[0].byteLength);
 room.command(human,{...proposal,id:crypto.randomUUID(),type:'garden.remove',observation:captured.id,expectedRevision:1,args:{}});
 assert.ok(!document(exportWorldSnapshot(room.observe(human),scenery)).nodes.some(node=>node.name==='garden-snapshot'));
 assert.ok(result.nodes.some(node=>node.name==='garden-snapshot'));
});
test('unrecognized content cannot inject files or arbitrary runtime geometry into a snapshot',()=>{
 const room=new Room();const observation=room.observe(human);observation.entities['garden-invalid']={x:Infinity,z:0,color:'mint'};
 assert.throws(()=>exportWorldSnapshot(observation,scenery),/Unsupported creation/);
 const otherEdition=new Room({edition:'different-authored-world@1'}).observe(human);
 assert.throws(()=>exportWorldSnapshot(otherEdition,scenery),/bounded workshop situation/);
});
