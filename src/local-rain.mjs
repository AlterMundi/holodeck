import {BufferAttribute,BufferGeometry,DynamicDrawUsage,LineBasicMaterial,LineSegments,Vector3} from 'three';
import {terrainCoordinates,terrainFrame} from './toroidal-terrain.mjs';

const count=160;
const wrap=(value,size)=>((value%size)+size)%size-size/2;
// Use a small volume around the camera. Drops are render-only, including at
// room boundaries, and never allocate world entities or receive network state.
export function bindLocalRain(scene){
  const points=new Float32Array(count*6);
  const geometry=new BufferGeometry();
  const position=new BufferAttribute(points,3).setUsage(DynamicDrawUsage);
  geometry.setAttribute('position',position);
  const material=new LineBasicMaterial({color:0xbad3e7,transparent:true,depthWrite:false,opacity:.25});
  const lines=new LineSegments(geometry,material);
  lines.name='Quintana rain';lines.frustumCulled=false;lines.visible=false;
  scene.add(lines);
  const up=new Vector3(),a=new Vector3(),b=new Vector3(),wind=new Vector3();
  const drops=Array.from({length:count},(_,i)=>[(i*41%163)/163,(i*79%157)/157,(i*109%173)/173]);
  return {update(eye,weather,now,reducedMotion){
    const amount=weather?.precipitation??0;
    lines.visible=Boolean(eye&&amount>0&&!reducedMotion);
    if(!lines.visible)return;
    lines.position.copy(eye);
    const {u,v}=terrainCoordinates([eye.x,eye.y,eye.z]);
    const frame=terrainFrame(u,v);
    up.fromArray(frame.up);a.fromArray(frame.alongRing);b.fromArray(frame.aroundTube);
    const from=weather.windDirection*Math.PI/180;
    wind.set(Math.cos(from),0,-Math.sin(from)).projectOnPlane(up);
    wind.multiplyScalar(Math.min(weather.windSpeed/3.6,8)*.65);
    const time=now/1000;
    const size=17,height=13;
    const active=Math.min(count,Math.ceil(19+amount*95));
    geometry.setDrawRange(0,active*2);
    for(let i=0;i<active;i++){
      const [x,y,z]=drops[i];
      const side=wrap(x*size+time*wind.dot(a),size);
      const cross=wrap(z*size+time*wind.dot(b),size);
      const h=wrap(y*height-time*(8+y*6),height);
      for(let axis=0;axis<3;axis++){
        const k=i*6+axis;
        points[k]=a.getComponent(axis)*side+b.getComponent(axis)*cross+up.getComponent(axis)*h;
        points[k+3]=points[k]+up.getComponent(axis)*(.15+z*.19)-wind.getComponent(axis)*.03;
      }
    }
    position.needsUpdate=true;
  },dispose(){lines.removeFromParent();geometry.dispose();material.dispose();}};
}
