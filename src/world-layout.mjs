// Shared spatial contract: authored geometry, collision, native perception and
// creator bounds consume these same metre/Y-up regions. Original plaza retained.
export const LAYOUT_VERSION='island-archipelago@2';
export const TERRACES=Object.freeze([
 {id:'arrival',x:0,z:0,radius:10.75}, {id:'overlook',x:0,z:-17,radius:4.9},
 {id:'gallery',x:-22,z:0,radius:8}, {id:'garden',x:22,z:0,radius:10}
].map(Object.freeze));
export const PROMENADES=Object.freeze([
 {id:'gallery-path',minX:-14.6,maxX:-9.8,minZ:-1.6,maxZ:1.6},
 {id:'garden-path',minX:9.8,maxX:12.7,minZ:-1.6,maxZ:1.6}
].map(Object.freeze));
export const CREATION_AREAS=Object.freeze([
 {id:'arrival',minX:-7,maxX:7,minZ:-6,maxZ:6},
 {id:'gallery',minX:-27,maxX:-17,minZ:-5,maxZ:5},
 {id:'garden',minX:15,maxX:29,minZ:-6,maxZ:6}
].map(Object.freeze));
export function creationContains(x,z,radius=0){return [x,z,radius].every(Number.isFinite)&&radius>=0&&CREATION_AREAS.some(a=>x-radius>=a.minX&&x+radius<=a.maxX&&z-radius>=a.minZ&&z+radius<=a.maxZ);}
export function nearestCreationPosition(x,z){
 if(![x,z].every(Number.isFinite))return null;
 return CREATION_AREAS.map(a=>({x:Math.max(a.minX,Math.min(a.maxX,x)),z:Math.max(a.minZ,Math.min(a.maxZ,z))})).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];
}
