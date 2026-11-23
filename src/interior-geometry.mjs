// Room-local wall positions are assigned before access filtering. The same
// passage therefore always has the same physical address for both visitors.
const SLOTS = [
  {x:-3,z:-5.86,rotation:0,dx:0,dz:1},
  {x:3,z:-5.86,rotation:0,dx:0,dz:1},
  {x:5.86,z:-3,rotation:-90,dx:-1,dz:0},
  {x:-5.86,z:-3,rotation:90,dx:1,dz:0},
  {x:5.86,z:3,rotation:-90,dx:-1,dz:0},
  {x:-5.86,z:3,rotation:90,dx:1,dz:0},
];
const STAIR_STEPS=6, TREAD=.45, RISE=.14;
const round=n=>Number(n.toFixed(4));

export function passageAt(room,link,index,destination) {
  const slot=SLOTS[index];
  const rise=link.kind==='stair'?Math.sign(destination.level-room.level):0;
  const approach=rise ? .34 : 1.05;
  return {
    ...link,slot:index,rise,
    door:{x:round(slot.x+slot.dx*approach),y:round(.11+rise*STAIR_STEPS*RISE),
      z:round(slot.z+slot.dz*approach),yaw:slot.rotation+180},
  };
}

const cube=(x,y,z,width,height,depth,color,attributes='')=>
  `<m-cube x="${x}" y="${y}" z="${z}" width="${width}" height="${height}" depth="${depth}" color="${color}"${attributes}></m-cube>`;

export function roomFloor(passages,color,visible=true) {
  const attributes=visible?'':' opacity="0" cast-shadows="false"';
  const holes=passages.filter(p=>p.rise<0).map(p=>{
    const s=SLOTS[p.slot], endX=s.x+s.dx*STAIR_STEPS*TREAD,endZ=s.z+s.dz*STAIR_STEPS*TREAD;
    return [s.dx?Math.min(s.x,endX):s.x-.85,s.dx?Math.max(s.x,endX):s.x+.85,
      s.dz?Math.min(s.z,endZ):s.z-.85,s.dz?Math.max(s.z,endZ):s.z+.85];
  });
  const cuts=(a,b)=>[...new Set([-6,6,...holes.flatMap(h=>[h[a],h[b]])])].sort((x,y)=>x-y);
  const xs=cuts(0,1),zs=cuts(2,3);
  let floor='';
  for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++){
    const x=(xs[i-1]+xs[i])/2,z=(zs[j-1]+zs[j])/2;
    if(!holes.some(([x1,x2,z1,z2])=>x>x1&&x<x2&&z>z1&&z<z2))
      floor+=cube(x,0,z,xs[i]-xs[i-1],.2,zs[j]-zs[j-1],color,attributes);
  }
  return floor;
}

export function passageMarkup(passage,{visibleSteps=true,authoredPortal=false,authoredDoor=false,authoredPassages=[]}={}) {
  const slot=SLOTS[passage.slot],y=passage.rise*STAIR_STEPS*RISE;
  const portal=passage.kind==='portal',color=portal?'#9384bd':passage.rise?'#779491':'#d6b58c';
  const fill=portal?'#4f6a8d':passage.rise?'#3f5b5e':'#675948';
  const attributes=visibleSteps?'':' opacity="0" cast-shadows="false"';
  let steps='';
  for(let i=0;passage.rise&&i<STAIR_STEPS;i++){
    const z=TREAD*(i+.5),top=.1+passage.rise*(STAIR_STEPS-i)*RISE;
    steps+=cube(0,top-.07,z,1.7,.14,TREAD,fill,attributes);
  }
  if(passage.rise)for(const side of [-1,1])
    steps+=cube(side*.91,.57+y/2,STAIR_STEPS*TREAD/2,.12,1.04+Math.abs(y),STAIR_STEPS*TREAD,'#7a9690',attributes);
  if(portal&&authoredPortal)
    return `<m-group id="passage-${passage.slot}" x="${slot.x}" z="${slot.z}" ry="${slot.rotation}"></m-group>`;
  // Authored fittings replace only the visible marker at the selected slot.
  if(authoredPassages.includes(passage.slot))
    return `<m-group id="passage-${passage.slot}" x="${slot.x}" z="${slot.z}" ry="${slot.rotation}">${steps}</m-group>`;
  if(passage.kind==='door'&&authoredDoor)
    return `<m-group id="passage-${passage.slot}" x="${slot.x}" z="${slot.z}" ry="${slot.rotation}">
    <m-label y="2.48" z=".48" width="1.35" height=".22" font-size="16" alignment="center" color="#34291e" font-color="#fff0d1" content="${passage.label}" collide="false"></m-label></m-group>`;
  return `<m-group id="passage-${passage.slot}" x="${slot.x}" z="${slot.z}" ry="${slot.rotation}">
    ${steps}<m-cube y="${1.13+y}" z=".035" width="1.44" height="2.06" depth=".08" color="${color}" collide="false"></m-cube>
    <m-cube y="${1.1+y}" z=".086" width="1.22" height="1.82" depth=".025" color="${fill}" collide="false"></m-cube>
    <m-label y="${2.38+y}" z=".14" width="2.18" height=".35" font-size="19" content="${passage.label}" collide="false"></m-label>
  </m-group>`;
}
