import {Mesh,PlaneGeometry,PointLight,SpotLight,Ray,ShaderMaterial,Vector3} from 'three';
import {TOROIDAL_TERRAIN,terrainCoordinates,terrainElevation,terrainFrame} from './toroidal-terrain.mjs';

import {bindExplorerThrusters} from './explorer-thrusters.mjs';
import {matterAvatarScale} from './matter-flight.mjs';

const normal=new Vector3(0,0,1);
const antennaTip=new Vector3(.037,.136,-.024); // Navegante's Receiver light, relative to its antenna joint.
const forwardTarget=new Vector3(0,.52,1.36);
const beltFront=new Vector3(0,1.032,.176); // Explorer v29's buckle in model space.

export function bindAvatarPracticals(group,colliders){
  const lanterns=[new SpotLight(0xffe8c7,0,10,.64,.98,.90),new PointLight(0xbfe9ef,0,9,.65),
    new PointLight(0x549eff,0,3.5,1.15)];
  lanterns[0].name='Explorer buckle light';
  lanterns[1].name='Navegante antenna light';
  lanterns[2].name='Explorer thruster light';
  group.add(...lanterns,lanterns[0].target);
  const geometry=new PlaneGeometry(2,2);
  const ground=[];
  for(const name of ['Explorer contact shadow','Navegante contact shadow']){
    const material=new ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,
      uniforms:{opacity:{value:0}},
      vertexShader:`varying vec2 spot;void main(){spot=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform float opacity;varying vec2 spot;void main(){gl_FragColor=vec4(.012,.015,.020,opacity*(1.0-smoothstep(.07,1.0,length(spot))));}`});
    const shadow=new Mesh(geometry,material);
    shadow.name=name;shadow.visible=false;
    group.add(shadow);ground.push(shadow);
  }
  const up=new Vector3(),world=new Vector3(),localUp=new Vector3(),ray=new Ray();
  function contact(shadow,feet,outdoor,scale){
    shadow.visible=false;
    if(!feet)return;
    up.set(0,1,0);
    let drop=Infinity;
    if(outdoor){
      const {u,v,height}=terrainCoordinates([feet.x,feet.y,feet.z]);
      const terrain=terrainElevation(u,v);
      if(terrain<TOROIDAL_TERRAIN.waterLevel&&height<TOROIDAL_TERRAIN.waterLevel+.1)return;
      up.fromArray(terrainFrame(u,v).up);
      if(terrain>=TOROIDAL_TERRAIN.waterLevel)drop=Math.max(0,height-terrain);
    }
    ray.origin.copy(feet).addScaledVector(up,.12*scale);
    ray.direction.copy(up).negate();
    const hit=colliders?.raycastFirst(ray,2.6*scale);
    const hasFloor=hit&&hit[1].dot(up)>.60&&hit[0]-.12*scale<=drop+.04*scale;
    if(hasFloor)drop=Math.max(0,hit[0]-.12*scale);
    if(drop>2.4*scale)return;
    shadow.visible=true;
    shadow.position.copy(feet).addScaledVector(up,.015*scale-drop);
    const orientation=hasFloor?hit[1]:up;
    localUp.copy(orientation);
    shadow.quaternion.setFromUnitVectors(normal,localUp);
    const swell=1+.5*drop/scale;
    shadow.scale.set(.48*swell*scale,.36*swell*scale,1);
    shadow.material.uniforms.opacity.value=.39*(1-drop/(2.4*scale));
  }

  const exhaust=new Vector3(0,1.04,-.245);
  let selectedPlayer,thrusters;
  return {update({player,feet,companion,outdoor,visible,table,daylight=0,thrust=false,boost=false}){
    if(selectedPlayer!==player){
      thrusters?.dispose();
      thrusters=player?.animations?.some(clip=>clip.name==='hero_idle')?bindExplorerThrusters(player):null;
      selectedPlayer=player;
    }
    const firing=Boolean(visible&&outdoor&&!table&&thrusters&&thrust);
    thrusters?.set(firing);
    lanterns[2].intensity=firing?(boost?.92:.55):0;
    if(firing)lanterns[2].position.copy(group.worldToLocal(player.localToWorld(world.copy(exhaust))));
    // Keep the lights in the same scene through room and graphics-tier transitions.
    const explorer=visible&&player?.animations?.some(clip=>clip.name==='hero_idle');
    const antenna=visible&&companion?.getObjectByName('antenna');
    const scale=table?matterAvatarScale:1;
    const brightness=outdoor?1-.63*daylight:1;
    lanterns[0].intensity=explorer?3.9*brightness*scale**.90:0;
    lanterns[1].intensity=antenna?1.9*brightness*scale**.65:0;
    lanterns[0].distance=10*scale;
    lanterns[1].distance=9*scale;
    if(explorer){
      lanterns[0].position.copy(group.worldToLocal(player.localToWorld(world.copy(beltFront))));
      lanterns[0].target.position.copy(group.worldToLocal(player.localToWorld(world.copy(forwardTarget))));
    }
    if(antenna)lanterns[1].position.copy(group.worldToLocal(antenna.localToWorld(world.copy(antennaTip))));
    contact(ground[0],visible?feet:null,outdoor,scale);
    contact(ground[1],visible?companion?.position:null,outdoor,scale);
  },dispose(){
    thrusters?.dispose();
    for(const shadow of ground){shadow.removeFromParent();shadow.material.dispose();}
    for(const light of lanterns){light.removeFromParent();light.dispose();}
    lanterns[0].target.removeFromParent();
    geometry.dispose();
  }};
}
