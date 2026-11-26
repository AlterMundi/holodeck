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
    const index=lines&&contourLevel%(INTERVAL*3)===0;
    const contour=lines?(index?19:-24):0;
    const water=((nw<terrain.waterLevel)+(ne<terrain.waterLevel)+(sw<terrain.waterLevel)+(se<terrain.waterLevel))*.25;
    const depth=clamp(terrain.waterLevel-height,0,30);
    const trail=clamp((trails[a]+trails[b]+trails[c]+trails[d])*.29,0,.95)*(1-water);
    const shore=water>0&&water<1?24:0;
    const shade=elevation+relief+contour;
    const i=(y*SIZE+x)*4;
    rgba[i]=((57+shade+(index?17:0))*(1-trail)+186*trail)*(1-water)+(24-depth*.38)*water+shore;
    rgba[i+1]=((91+shade)*(1-trail)+155*trail)*(1-water)+(62-depth*.65)*water+shore;
    rgba[i+2]=((76+shade-(index?12:0))*(1-trail)+100*trail)*(1-water)+(83-depth*.54)*water+shore;
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
    ctx.lineDashOffset=path.phase;
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

function drawCave(ctx,x,y,circular){
  ctx.beginPath();
  ctx.moveTo(x-10,y+6);ctx.lineTo(x-8,y-5);ctx.lineTo(x-2,y-11);
  ctx.lineTo(x+5,y-8);ctx.lineTo(x+10,y+6);ctx.closePath();
  ctx.strokeStyle='#261e22';ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle='#e5a984';ctx.fill();
  ctx.fillStyle='#352726';ctx.fillRect(x-3,y-1,6,7);
  drawMapLabel(ctx,'Cueva',x,y,circular);
}

function drawMapLabel(ctx,label,x,y,circular){
  ctx.font='600 19px system-ui';
  const textWidth=ctx.measureText(label).width;
  const half=DISPLAY/2;
  const edge=circular?Math.sqrt(Math.max(0,(half-7)**2-(Math.abs(y+6-half)+8)**2)):half-6;
  const left=x+15+textWidth>half+edge;
  if(left&&x-15-textWidth<half-edge)return;
  const labelX=x+(left?-15:15);
  ctx.textAlign=left?'right':'left';
  ctx.strokeStyle='#261e22';ctx.lineWidth=3;
  ctx.strokeText(label,labelX,y+6);
  ctx.fillStyle='#fff4dd';
  ctx.fillText(label,labelX,y+6);
  ctx.textAlign='start';
}

function drawSpurMark(ctx,point,label,water,legend,circular){
  if(point.x<=.036||point.x>=.964||point.y<=.038||point.y>=.942||
    legend&&point.x>.38&&point.y>.85||circular&&Math.hypot(point.x-.5,point.y-.5)>.46)return;
  const x=point.x*DISPLAY,y=point.y*DISPLAY;
  ctx.fillStyle='#122831';ctx.fillRect(x-7,y-7,14,14);
  ctx.fillStyle=water?'#a2e1ed':'#f7d7a0';ctx.fillRect(x-4,y-4,8,8);
  drawMapLabel(ctx,label,x,y,circular);
}

function drawChartRim(ctx,circular){
  const margin=5,half=DISPLAY/2;
  ctx.lineWidth=2;
  if(circular){
    for(const [ink,start] of [['#edc797',Math.PI],['#79c1c4',0]]){
      ctx.strokeStyle=ink;
      ctx.beginPath();
      ctx.arc(half,half,half-margin,start,start+Math.PI);
      ctx.stroke();
    }
    return;
  }
  for(const [edge,ink] of [[margin,'#edc797'],[DISPLAY-margin,'#79c1c4']]){
    ctx.strokeStyle=ink;
    ctx.beginPath();
    ctx.moveTo(margin,edge);ctx.lineTo(DISPLAY-margin,edge);
    ctx.stroke();
  }
}

export function bindToroidalMinimap(panel,{now=()=>performance.now()}={}){
  const canvas=panel.querySelector('#world-minimap'),ctx=canvas?.getContext('2d',{alpha:false});
  if(!ctx)return ()=>{};
  const raster=canvas.ownerDocument.createElement('canvas');
  raster.width=raster.height=SIZE;
  const pixels=raster.getContext('2d');
  if(!pixels)return ()=>{};
  const image=pixels.createImageData(SIZE,SIZE);
  let guide=null,paths=[],waterVisible=false;
  let chart=null,last=null,next=0;
  const restore=()=>{chart=null;last=null;next=0;};
  canvas.addEventListener('contextrestored',restore);
  raster.addEventListener('contextrestored',restore);
  return (position,yaw,entrances,peek=false)=>{
    canvas.hidden=!position;
    if(!position||!panel.open&&!peek){last=null;return;}
    const circular=peek||panel.dataset.terrainFormat==='circle';
    const time=now();
    if(last&&last.peek===peek&&last.circular===circular&&time<next)return;
    next=time+90;
    const point=terrainCoordinates([position.x,position.y,position.z]);
    if(!chart||Math.abs(wrap(point.u-chart.u))/chart.du>3/SPAN||Math.abs(wrap(point.v-chart.v))/chart.dv>3/SPAN){
      chart=toroidalMapChart(point);
      paintToroidalRelief(chart,image.data);
      pixels.putImageData(image,0,0);
      guide??=toroidalSpurGuide();
      paths=projectToroidalSpur(chart,guide);
      waterVisible=paths.some(path=>path.water);
      const landVisible=paths.some(path=>!path.water);
      canvas.setAttribute('aria-label','Minimapa topográfico con la casa y la cueva cercanas.'+
        (landVisible?' Línea continua hacia el mirador.':'')+
        (waterVisible?' Línea discontinua en el cruce a nado.':''));
      last=null;
    }
    const {x,y}=toroidalMapPoint(chart,point);
    const heading=toroidalMapHeading(chart,point.v,Number.isFinite(yaw)?yaw:0);
    if(last&&Math.hypot(x-last.x,y-last.y)<.75/DISPLAY&&
      Math.abs(wrap((heading-last.heading)/TAU))<.025/TAU&&last.entrances===entrances&&last.circular===circular&&last.peek===peek)return;
    // Entrances are an immutable snapshot of the current exterior scope.
    last={x,y,heading,entrances,circular,peek};
    const {width,height}=canvas;
    ctx.drawImage(raster,0,0,width,height);
    ctx.save();
    ctx.scale(width/DISPLAY,height/DISPLAY);
    drawChartRim(ctx,circular);
    drawSpur(ctx,paths);
    if(!peek){
      for(const shore of guide.shores)
        drawSpurMark(ctx,toroidalMapPoint(chart,shore),'Orilla',true,waterVisible,circular);
      drawSpurMark(ctx,toroidalMapPoint(chart,TOROIDAL_OVERLOOK),'Mirador',false,waterVisible,circular);
    }
    for(const {door} of entrances??[]){
      if(!door)continue;
      const {x,y}=toroidalMapPoint(chart,terrainCoordinates([door.x,door.y,door.z]));
      if(x>0&&x<1&&y>0&&y<1)drawHouse(ctx,x*DISPLAY,y*DISPLAY);
    }
    const cave=toroidalMapPoint(chart,CAVE_ENTRANCE);
    if(!peek&&cave.x>.032&&cave.x<.968&&cave.y>.032&&cave.y<.968&&
      (!circular||Math.hypot(cave.x-.5,cave.y-.5)<.46))
      drawCave(ctx,cave.x*DISPLAY,cave.y*DISPLAY,circular);
    ctx.save();
    ctx.translate(x*DISPLAY,y*DISPLAY);
    ctx.rotate(heading);
    const pointer=peek?2:1;
    ctx.beginPath();ctx.moveTo(0,-16*pointer);ctx.lineTo(10*pointer,11*pointer);
    ctx.lineTo(0,6*pointer);ctx.lineTo(-10*pointer,11*pointer);ctx.closePath();
    ctx.fillStyle='#fff4cd';ctx.strokeStyle='#14292f';ctx.lineWidth=5;ctx.stroke();ctx.fill();
    ctx.restore();
    if(peek){
      ctx.restore();
      return true;
    }
    const scaleLength=DISPLAY*50/SPAN;
    const scaleX=circular?(DISPLAY-scaleLength)/2:16, scaleY=circular?325:335;
    ctx.fillStyle='#132327d9';ctx.fillRect(scaleX-8,scaleY,scaleLength+16,41);
    ctx.strokeStyle='#eee3c7';ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(scaleX,scaleY+29);ctx.lineTo(scaleX,scaleY+34);
    ctx.lineTo(scaleX+scaleLength,scaleY+34);ctx.lineTo(scaleX+scaleLength,scaleY+29);
    ctx.stroke();
    ctx.fillStyle='#eee3c7';ctx.font='600 23px system-ui';ctx.fillText('50 m',scaleX,scaleY+27);
    if(waterVisible){
      const legendX=circular?128:248, legendY=circular?281:335;
      ctx.fillStyle='#132327e6';ctx.fillRect(legendX,legendY,128,41);
      ctx.strokeStyle='#a2e1ed';ctx.lineWidth=3;
      ctx.setLineDash([7,8]);
      ctx.beginPath();ctx.moveTo(legendX+10,legendY+21);ctx.lineTo(legendX+30,legendY+21);ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle='#d9f5fb';ctx.font='600 21px system-ui';ctx.fillText('A nado',legendX+38,legendY+28);
    }
    ctx.restore();
    return true;
  };
}
