// A single projection of Room semantic state. No writable gameplay scripts.
const cube = (x,y,z,w,h,d,color,extra='') => `<m-cube x="${x}" y="${y}" z="${z}" width="${w}" height="${h}" depth="${d}" color="${color}" ${extra}></m-cube>`;
const sphere = (x,y,z,r,color) => `<m-sphere x="${x}" y="${y}" z="${z}" radius="${r}" color="${color}" collide="false"></m-sphere>`;
const cylinder = (x,y,z,r,h,color,extra='') => `<m-cylinder x="${x}" y="${y}" z="${z}" radius="${r}" height="${h}" color="${color}" ${extra}></m-cylinder>`;
export function worldDocument(room) {
  let out = `<m-group id="workshop" data-run="${room.run}" data-semantic-sequence="${room.sequence}">`;
  // Floating terraces, warm paths, two gardens and a central shared mechanism.
  out += cylinder(0,-1,0,11,2,'#334854');
  out += cylinder(0,0,0,10.8,0.18,'#6d9c86');
  out += cylinder(0,-3,0,7,2.4,'#253b4c');
  out += cylinder(0,.13,0,3,0.12,'#d9c5a3');
  out += cube(0,.14,3.7,2.4,.12,7,'#d9c5a3');
  out += cylinder(0,0,-17,5,0.18,'#79aa94');
  out += cylinder(0,-1,-17,5,2,'#334854');
  for (let i=0;i<8;i++) out += cube(0,room.entities.bridge.raised ? .18 : -2.2,-10.2-i*.55,2.5,.22,.49,'#b68b5f');
  out += cylinder(0,.5,0,.7,.75,'#526f73');
  out += sphere(0,1.3,0,.46,room.entities.bridge.raised ? '#e8c77c':'#9fe5d9');
  // Framing colonnade and lanterns.
  for (let i=0;i<6;i++) {
    const angle=i*Math.PI/3, x=Math.sin(angle)*3.5,z=Math.cos(angle)*3.5;
    out+=cylinder(x,1.2,z,.16,2.4,'#d6c7aa');
    out+=sphere(x,2.5,z,.2,'#ffe2a0');
  }
  for (let i=0;i<20;i++) {
    const angle=i*2.39996, r=5.6+(i%3)*1.2;
    const x=Math.sin(angle)*r,z=Math.cos(angle)*r;
    if(Math.abs(x)<2.2 && z<0) continue;
    out+=cylinder(x,.7,z,.16,1.4,'#816c59');
    out+=sphere(x,2+(i%3)*.18,z,.9+(i%2)*.25,i%3 ? '#3e7b6c':'#a5b68b');
    out+=sphere(x+.4,1.9,z+.2,.6,'#62927a');
  }
  for (let i=0;i<12;i++) {
    const angle=i*Math.PI/6;
    out+=cube(Math.sin(angle)*9.7,.25,Math.cos(angle)*9.7,.5,.65,.6,'#91a3a0');
  }
  for(const [id,e] of Object.entries(room.entities)) if(id.startsWith('garden-')) {
    const color={mint:'#8ce4c2',amber:'#efc87a',rose:'#e8a2b9'}[e.color];
    out+=`<m-group id="${id}">${cylinder(e.x,.2,e.z,.4,.35,'#e2c9a2')}${sphere(e.x,.9,e.z,.48,color)}</m-group>`;
  }
  for(const p of room.projections.values()) {
    const {x,y,z}=p.position;
    out+=`<m-group id="projection-${p.actor.replace(/[^\w-]/g,'')}">${sphere(x,y,z,.32,'#9de6e5')}${p.form==='beacon'?cylinder(x,y-.5,z,.09,.7,'#e9dcaf'):''}</m-group>`;
  }
  return out+'</m-group>';
}
