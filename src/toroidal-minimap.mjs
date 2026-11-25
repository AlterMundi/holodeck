import {TOROIDAL_TERRAIN,terrainCoordinates,terrainElevation,terrainTrail} from './toroidal-terrain.mjs';

const TAU=2*Math.PI;
const SIZE=80;
const SPAN=180;
const wrap=delta=>delta-Math.round(delta);

export function bindToroidalMinimap(panel){
  const canvas=panel.querySelector('#world-minimap');
  const ctx=canvas.getContext('2d',{alpha:false});
  const image=ctx.createImageData(SIZE,SIZE);
  const raster=canvas.ownerDocument.createElement('canvas');
  raster.width=raster.height=SIZE;
  const pixels=raster.getContext('2d');
  let next=0;
  return (position,yaw,entrances)=>{
    canvas.hidden=!position;
    if(!position||!panel.open||performance.now()<next)return;
    next=performance.now()+420;
    const {u,v}=terrainCoordinates([position.x,position.y,position.z]);
    const terrain=TOROIDAL_TERRAIN, tube=terrain.tubeRadius;
    const ring=terrain.majorRadius+tube*Math.cos(v*TAU);
    const du=SPAN/(TAU*ring),dv=SPAN/(TAU*tube);
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
      const a=u+(x/SIZE-.5)*du,b=v+(.5-y/SIZE)*dv;
      const height=terrainElevation(a,b);
      const trail=terrainTrail(a,b)>.3;
      const shade=Math.max(-20,Math.min(45,height));
      const color=height<terrain.waterLevel?[48,99,122]:
        trail?[186,158,108]:[62+shade,94+shade,78+shade];
      const i=(y*SIZE+x)*4;
      image.data.set([...color,255],i);
    }
    pixels.putImageData(image,0,0);
    ctx.drawImage(raster,0,0,canvas.width,canvas.height);
    for(const {door} of entrances??[]){
      const p=terrainCoordinates([door.x,door.y,door.z]);
      const x=(.5+wrap(p.u-u)/du)*canvas.width,y=(.5-wrap(p.v-v)/dv)*canvas.height;
      ctx.fillStyle='#f4ce94';
      ctx.fillRect(x-3,y-3,6,6);
    }
    ctx.save();
    ctx.translate(canvas.width/2,canvas.height/2);
    ctx.rotate(Number.isFinite(yaw)?yaw:0);
    ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(6,7);ctx.lineTo(0,4);ctx.lineTo(-6,7);ctx.closePath();
    ctx.fillStyle='#fff4cd';ctx.strokeStyle='#182e34';ctx.lineWidth=2;ctx.stroke();ctx.fill();
    ctx.restore();
    return true;
  };
}
