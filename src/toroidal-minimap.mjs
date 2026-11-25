import {TOROIDAL_OVERLOOK,TOROIDAL_TERRAIN,terrainCoordinates,terrainElevation,terrainTrail,toroidalSpurPoint} from './toroidal-terrain.mjs';
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

export function toroidalSpurGuide(terrain=TOROIDAL_TERRAIN){
  const end=TOROIDAL_OVERLOOK.v, start=.25;
  const count=Math.ceil((end-start)*TAU*terrain.tubeRadius/3);
  const wet=({u,v})=>terrainElevation(u,v,terrain)<terrain.waterLevel;
  let previous=toroidalSpurPoint(start);
  const shores=[],runs=[{water:wet(previous),points:[previous]}];
  for(let i=1;i<=count;i++){
    const point=toroidalSpurPoint(start+(end-start)*i/count);
    const water=wet(point),run=runs.at(-1);
    if(run.water!==water){
      let low=previous.v, high=point.v;
      for(let j=0;j<13;j++){
        const mid=(low+high)/2;
        if(wet(toroidalSpurPoint(mid))===water)high=mid;
        else low=mid;
      }
      const shore=toroidalSpurPoint((low+high)/2);
      run.points.push(shore);
      shores.push(shore);
      runs.push({water,points:[shore]});
    }
    runs.at(-1).points.push(point);
    previous=point;
  }
  return {runs,shores};
}

export function projectToroidalSpur(chart,guide){
  const projected=[];
  for(const run of guide.runs){
    let last=null,path=null,length=0;
    for(const point of run.points){
      const next=toroidalMapPoint(chart,point);
      if(last){
        const dx=next.x-last.x,dy=next.y-last.y;
        // Opposite-side wrap discontinuities are never map segments.
        if(Math.abs(dx)>1||Math.abs(dy)>1){last=next;path=null;continue;}
        if(Math.max(next.x,last.x)>=0&&Math.min(next.x,last.x)<=1&&
          Math.max(next.y,last.y)>=0&&Math.min(next.y,last.y)<=1){
          if(!path){
            path={water:run.water,phase:length,points:[last]};
            projected.push(path);
          }
          path.points.push(next);
        }else path=null;
        length+=Math.hypot(dx,dy)*DISPLAY;
      }
      last=next;
    }
  }
  return projected;
}

function drawSpur(ctx,paths){
  for(const path of paths){
    ctx.beginPath();
    for(const [i,{x,y}] of path.points.entries())
      if(i===0)ctx.moveTo(x*DISPLAY,y*DISPLAY);
      else ctx.lineTo(x*DISPLAY,y*DISPLAY);
    ctx.setLineDash(path.water?[7,8]:[]);
    ctx.lineDashOffset=-path.phase;
    ctx.strokeStyle='#152d32';ctx.lineWidth=6;ctx.stroke();
    ctx.strokeStyle=path.water?'#a2e1ed':'#f7d7a0';ctx.lineWidth=3;ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.lineDashOffset=0;
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
  drawMapLabel(ctx,'Cueva',x,y);
}

function drawMapLabel(ctx,label,x,y){
  ctx.font='600 19px system-ui';
  const left=x+15+ctx.measureText(label).width>DISPLAY-6;
  const labelX=x+(left?-15:15);
  ctx.textAlign=left?'right':'left';
  ctx.strokeStyle='#261e22';ctx.lineWidth=3;
  ctx.strokeText(label,labelX,y+6);
  ctx.fillStyle='#fff4dd';
  ctx.fillText(label,labelX,y+6);
  ctx.textAlign='start';
}

function drawSpurMark(ctx,point,label,water){
  if(point.x<=.036||point.x>=.964||point.y<=.038||point.y>=.942)return;
  const x=point.x*DISPLAY,y=point.y*DISPLAY;
  ctx.fillStyle='#122831';ctx.fillRect(x-7,y-7,14,14);
  ctx.fillStyle=water?'#a2e1ed':'#f7d7a0';ctx.fillRect(x-4,y-4,8,8);
  drawMapLabel(ctx,label,x,y);
}

export function bindToroidalMinimap(panel,{now=()=>performance.now()}={}){
  const canvas=panel.querySelector('#world-minimap'),ctx=canvas?.getContext('2d',{alpha:false});
  if(!ctx)return ()=>{};
  const raster=canvas.ownerDocument.createElement('canvas');
  raster.width=raster.height=SIZE;
  const pixels=raster.getContext('2d');
  if(!pixels)return ()=>{};
  const image=pixels.createImageData(SIZE,SIZE);
  let guide=null,paths=[];
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
      guide??=toroidalSpurGuide();
      paths=projectToroidalSpur(chart,guide);
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
    drawSpur(ctx,paths);
    for(const shore of guide.shores)
      drawSpurMark(ctx,toroidalMapPoint(chart,shore),'Orilla',true);
    drawSpurMark(ctx,toroidalMapPoint(chart,TOROIDAL_OVERLOOK),'Mirador',false);
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
    if(paths.some(path=>path.water)){
      ctx.fillStyle='#132327e6';ctx.fillRect(248,335,128,41);
      ctx.strokeStyle='#a2e1ed';ctx.lineWidth=3;
      ctx.setLineDash([5,4]);
      ctx.beginPath();ctx.moveTo(258,356);ctx.lineTo(278,356);ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle='#d9f5fb';ctx.font='600 21px system-ui';ctx.fillText('A nado',286,363);
    }
    ctx.restore();
    return true;
  };
}
