import {TOROIDAL_TERRAIN,terrainCoordinates,terrainElevation,terrainTrail} from './toroidal-terrain.mjs';
import {CAVE_ENTRANCE} from './toroidal-cave.mjs';

const TAU=2*Math.PI;
const SIZE=96;
const DISPLAY=384;
const SPAN=180;
const GRID=SIZE+1;
const INTERVAL=8;
const wrap=delta=>delta-Math.round(delta);
const turn=value=>value-Math.floor(value);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const ringRadius=(v,terrain)=>terrain.majorRadius+terrain.tubeRadius*Math.cos(v*TAU);

export function toroidalMapChart({u,v},terrain=TOROIDAL_TERRAIN){
  const vSteps=Math.round(TAU*terrain.tubeRadius/4);
  const row=Math.round(turn(v)*vSteps)%vSteps;
  const centerV=row/vSteps;
  const radius=ringRadius(centerV,terrain);
  const uSteps=Math.round(TAU*radius/4);
  const column=Math.round(turn(u)*uSteps)%uSteps;
  return {u:column/uSteps,v:centerV,radius,du:SPAN/(TAU*radius),dv:SPAN/(TAU*terrain.tubeRadius),
    key:row+':'+column};
}

export function toroidalMapPoint(chart,{u,v}){
  return {x:.5+wrap(u-chart.u)/chart.du,y:.5-wrap(v-chart.v)/chart.dv};
}

export function toroidalMapHeading(chart,v,yaw,terrain=TOROIDAL_TERRAIN){
  // Forward on the tangent frame is (+sin(yaw), +cos(yaw)). The chart
  // uses +u to the right and +v up, with its metric fixed at the centre.
  return Math.atan2(Math.sin(yaw)*chart.radius/ringRadius(v,terrain),Math.cos(yaw));
}

export function paintToroidalRelief(chart,rgba,terrain=TOROIDAL_TERRAIN){
  const elevations=new Float32Array(GRID*GRID);
  const trails=new Float32Array(GRID*GRID);
  for(let y=0;y<GRID;y++)for(let x=0;x<GRID;x++){
    const u=turn(chart.u+(x/SIZE-.5)*chart.du);
    const v=turn(chart.v+(.5-y/SIZE)*chart.dv);
    elevations[y*GRID+x]=terrainElevation(u,v,terrain);
    trails[y*GRID+x]=terrainTrail(u,v,terrain);
  }
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const a=y*GRID+x,b=a+1,c=a+GRID,d=c+1;
    const nw=elevations[a],ne=elevations[b],sw=elevations[c],se=elevations[d];
    const height=(nw+ne+sw+se)*.25;
    const low=Math.min(nw,ne,sw,se),high=Math.max(nw,ne,sw,se);
    const elevation=clamp((height-14)*.62,-17,24);
    const relief=clamp((se-nw)*2.9,-18,19);
    const contourLevel=Math.round(height/INTERVAL)*INTERVAL;
    const lines=contourLevel>=low&&contourLevel<=high&&high-low>.025;
    const contour=lines?(contourLevel%(INTERVAL*3)===0?-32:-18):0;
    const water=((nw<terrain.waterLevel)+(ne<terrain.waterLevel)+(sw<terrain.waterLevel)+(se<terrain.waterLevel))*.25;
    const depth=clamp(terrain.waterLevel-height,0,30);
    const trail=clamp((trails[a]+trails[b]+trails[c]+trails[d])*.29,0,.95)*(1-water);
    const shore=water>0&&water<1?24:0;
    const shade=elevation+relief+contour;
    const i=(y*SIZE+x)*4;
    rgba[i]=((82+shade)*(1-trail)+178*trail)*(1-water)+(38-depth*.38)*water+shore;
    rgba[i+1]=((106+shade)*(1-trail)+151*trail)*(1-water)+(86-depth*.65)*water+shore;
    rgba[i+2]=((80+shade)*(1-trail)+102*trail)*(1-water)+(101-depth*.54)*water+shore;
    rgba[i+3]=255;
  }
}

function drawHouse(ctx,x,y){
  ctx.beginPath();
  ctx.moveTo(x-9,y-1);ctx.lineTo(x,y-9);ctx.lineTo(x+9,y-1);
  ctx.lineTo(x+6,y-1);ctx.lineTo(x+6,y+7);ctx.lineTo(x-6,y+7);ctx.lineTo(x-6,y-1);ctx.closePath();
  ctx.strokeStyle='#192a31';ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle='#f4ce94';ctx.fill();
}

function drawCave(ctx,x,y){
  ctx.beginPath();
  ctx.moveTo(x-10,y+6);ctx.lineTo(x-8,y-5);ctx.lineTo(x-2,y-11);
  ctx.lineTo(x+5,y-8);ctx.lineTo(x+10,y+6);ctx.closePath();
  ctx.strokeStyle='#261e22';ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle='#e5a984';ctx.fill();
  ctx.fillStyle='#352726';ctx.fillRect(x-3,y-1,6,7);
  ctx.textAlign=x>DISPLAY-70?'right':'left';
  ctx.font='600 19px system-ui';
  ctx.fillStyle='#fff4dd';
  ctx.fillText('Cueva',x+(x>DISPLAY-70?-15:15),y+6);
  ctx.textAlign='start';
}

export function bindToroidalMinimap(panel,{now=()=>performance.now()}={}){
  const canvas=panel.querySelector('#world-minimap'),ctx=canvas?.getContext('2d',{alpha:false});
  if(!ctx)return ()=>{};
  const raster=canvas.ownerDocument.createElement('canvas');
  raster.width=raster.height=SIZE;
  const pixels=raster.getContext('2d');
  if(!pixels)return ()=>{};
  const image=pixels.createImageData(SIZE,SIZE);
  let chart=null,last=null,next=0;
  const restore=()=>{chart=null;last=null;next=0;};
  canvas.addEventListener('contextrestored',restore);
  raster.addEventListener('contextrestored',restore);
  return (position,yaw,entrances)=>{
    canvas.hidden=!position;
    if(!position||!panel.open){last=null;return;}
    const time=now();
    if(time<next)return;
    next=time+90;
    const point=terrainCoordinates([position.x,position.y,position.z]);
    if(!chart||Math.abs(wrap(point.u-chart.u))/chart.du>3/SPAN||Math.abs(wrap(point.v-chart.v))/chart.dv>3/SPAN){
      chart=toroidalMapChart(point);
      paintToroidalRelief(chart,image.data);
      pixels.putImageData(image,0,0);
      last=null;
    }
    const {x,y}=toroidalMapPoint(chart,point);
    const heading=toroidalMapHeading(chart,point.v,Number.isFinite(yaw)?yaw:0);
    if(last&&Math.hypot(x-last.x,y-last.y)<.75/DISPLAY&&
      Math.abs(wrap((heading-last.heading)/TAU))<.025/TAU&&last.entrances===entrances)return;
    // Entrances are an immutable snapshot of the current exterior scope.
    last={x,y,heading,entrances};
    const {width,height}=canvas;
    ctx.drawImage(raster,0,0,width,height);
    ctx.save();
    ctx.scale(width/DISPLAY,height/DISPLAY);
    for(const {door} of entrances??[]){
      if(!door)continue;
      const {x,y}=toroidalMapPoint(chart,terrainCoordinates([door.x,door.y,door.z]));
      if(x>0&&x<1&&y>0&&y<1)drawHouse(ctx,x*DISPLAY,y*DISPLAY);
    }
    const cave=toroidalMapPoint(chart,CAVE_ENTRANCE);
    if(cave.x>.032&&cave.x<.968&&cave.y>.032&&cave.y<.968)
      drawCave(ctx,cave.x*DISPLAY,cave.y*DISPLAY);
    ctx.save();
    ctx.translate(x*DISPLAY,y*DISPLAY);
    ctx.rotate(heading);
    ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(8,10);ctx.lineTo(0,6);ctx.lineTo(-8,10);ctx.closePath();
    ctx.fillStyle='#fff4cd';ctx.strokeStyle='#182e34';ctx.lineWidth=2;ctx.stroke();ctx.fill();
    ctx.restore();
    const scaleLength=DISPLAY*50/SPAN;
    ctx.fillStyle='#132327d9';ctx.fillRect(8,335,scaleLength+16,41);
    ctx.strokeStyle='#eee3c7';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(16,367);ctx.lineTo(16+scaleLength,367);ctx.stroke();
    ctx.fillStyle='#eee3c7';ctx.font='600 23px system-ui';ctx.fillText('50 m',16,362);
    ctx.restore();
    return true;
  };
}
