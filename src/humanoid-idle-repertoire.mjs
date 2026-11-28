import {Quaternion,Vector3} from 'three';
import {keyed} from './avatar-motion-curves.mjs';

// A standing body's repertoire over its authored idle, in a hero's register:
// shift the weight to one leg with a hand on the hip, look back over each
// shoulder, settle into a ready stance with the guard up, roll the neck. The feet stay exactly where the idle planted them: the hips
// move and two-bone IK bends the legs back onto the same footprints.
//
// Lanes, all in the body frame (Y up, Z forward, X toward the left side):
//  0 pelvis side (m, + toward the left foot)  1 pelvis drop (m)  2 pelvis forward (m)
//  3 pelvis roll  4 spine pitch (+ forward)  5 spine roll (+ toward the left)
//  6 spine yaw  7 head pitch (+ down)  8 head yaw  9 head roll
// 10 arms overhead  11 arms forward  12 left hand on hip  13 right hand on hip
const LANES=14;
const at=(t,values={})=>[t,Array.from({length:LANES},(_,lane)=>values[lane]??0)];
const shift=side=>({length:7.2,keys:[
  at(0),
  at(1.0,{0:.075*side,1:.018,3:-.07*side,5:-.035*side,9:.03*side,[side>0?12:13]:.9}),
  at(2.6,{0:.080*side,1:.020,3:-.075*side,5:-.04*side,6:.05*side,8:.18*side,9:.03*side,[side>0?12:13]:1}),
  at(4.4,{0:.078*side,1:.019,3:-.07*side,5:-.03*side,6:-.03*side,8:-.12*side,9:.02*side,[side>0?12:13]:1}),
  at(5.9,{0:.07*side,1:.016,3:-.06*side,5:-.03*side,[side>0?12:13]:.85}),
  at(7.2),
]});
const phrases=[
  shift(1),
  shift(-1),
  // Look back over each shoulder, the chest turning with the gaze: alert,
  // reading the surroundings.
  {length:6.4,keys:[
    at(0),
    at(1.1,{0:.03,3:-.03,6:.22,8:.55,7:-.04}),
    at(2.2,{0:.035,3:-.035,6:.24,8:.62,7:-.06}),
    at(3.0,{6:0,8:0}),
    at(4.1,{0:-.03,3:.03,6:-.22,8:-.55,7:-.04}),
    at(5.2,{0:-.035,3:.035,6:-.24,8:-.62,7:-.06}),
    at(6.4),
  ]},
  // Ready stance: settle a little lower, chest forward, guard up, then stand
  // tall again with the shoulders squared.
  {length:5.2,keys:[
    at(0),
    at(.45,{1:.05,4:.06,11:.25}),
    at(1.2,{1:.12,2:-.03,4:.14,7:-.08,11:.55}),
    at(2.6,{1:.12,2:-.03,4:.14,7:-.10,11:.55}),
    at(3.5,{1:-.01,4:-.06,7:-.06,11:.05}),
    at(4.2,{4:-.05,7:-.04}),
    at(5.2),
  ]},
  {length:5.0,keys:[
    at(0),
    at(1.0,{7:.10,9:.32,5:.03}),
    at(1.6,{7:.16,9:.34,5:.03}),
    at(2.5,{7:.30,9:0}),
    at(3.4,{7:.10,9:-.32,5:-.03}),
    at(4.0,{7:.12,9:-.30,5:-.03}),
    at(5.0),
  ]},
];
const scatter=index=>{const x=Math.sin(index*91.733+2.17)*43758.5453;return x-Math.floor(x);};

export function idleRepertoireLength(){return phrases.length;}

export function bindHumanoidIdleRepertoire(mesh){
  const skeleton=mesh.getObjectByProperty('isSkinnedMesh',true)?.skeleton;
  const bone=name=>skeleton?.getBoneByName(name);
  const pelvis=bone('pelvis');
  const spine=['spine_01','spine_02','spine_03','spine_04','spine_05'].map(bone).filter(Boolean);
  const neck=['neck_01','head'].map(bone).filter(Boolean);
  const limb=side=>({
    upper:bone('upperarm_'+side),fore:bone('lowerarm_'+side),hand:bone('hand_'+side),
    thigh:bone('thigh_'+side),calf:bone('calf_'+side),foot:bone('foot_'+side)});
  const sides={l:limb('l'),r:limb('r')};
  const parts=[pelvis,...Object.values(sides).flatMap(side=>Object.values(side))];
  if(parts.some(part=>!part)||spine.length<3||neck.length<2)return null;
  const touched=[pelvis,...spine,...neck,...parts.slice(1)];
  const neutral=touched.map(()=>new Quaternion()),pelvisRest=new Vector3();
  const body=new Quaternion(),inverse=new Quaternion(),parent=new Quaternion(),world=new Quaternion();
  const turn=new Quaternion(),share=new Quaternion(),swing=new Quaternion();
  const axis=new Vector3(),from=new Vector3(),to=new Vector3(),start=new Vector3(),end=new Vector3();
  const hip=new Vector3(),knee=new Vector3(),ankle=new Vector3(),pole=new Vector3(),offset=new Vector3();
  const kneeGoal=new Vector3(),footGoal=new Vector3();
  const feet={l:{position:new Vector3(),rotation:new Quaternion()},r:{position:new Vector3(),rotation:new Quaternion()}};
  const lanes=new Array(LANES).fill(0);
  let applied=false,leftSign=1;

  // Rotate a chain in the body frame about an axis, shared over its joints.
  function bend(chain,axisX,axisY,axisZ,angle){
    if(Math.abs(angle)<1e-5)return;
    axis.set(axisX,axisY,axisZ);
    turn.setFromAxisAngle(axis,angle/chain.length).premultiply(body).multiply(inverse);
    for(const joint of chain){
      joint.parent.getWorldQuaternion(parent);
      share.copy(parent).invert().multiply(turn).multiply(parent);
      joint.quaternion.premultiply(share);
    }
  }
  // Swing a bone so it points from its joint toward a world point.
  function aim(joint,child,target,weight=1){
    joint.getWorldPosition(start);
    child.getWorldPosition(end);
    from.subVectors(end,start).normalize();
    to.subVectors(target,start).normalize();
    swing.setFromUnitVectors(from,to);
    if(weight<1)swing.slerp(turn.identity(),1-weight);
    joint.getWorldQuaternion(world);
    joint.parent.getWorldQuaternion(parent);
    joint.quaternion.copy(parent.invert().multiply(swing).multiply(world));
  }
  // Aim a bone along a body-frame direction.
  function point(joint,child,x,y,z,weight){
    if(weight<.001)return;
    joint.getWorldPosition(start);
    axis.set(x*leftSign,y,z).normalize().applyQuaternion(body);
    aim(joint,child,offset.copy(start).add(axis),weight);
  }
  // Two-bone leg back onto its footprint, keeping the knee's own plane.
  function plant(side){
    const {thigh,calf,foot}=sides[side],{position,rotation}=feet[side];
    thigh.getWorldPosition(hip);calf.getWorldPosition(knee);foot.getWorldPosition(ankle);
    const upper=hip.distanceTo(knee),lower=knee.distanceTo(ankle);
    const reach=Math.min(upper+lower-1e-4,Math.max(Math.abs(upper-lower)+1e-4,hip.distanceTo(position)));
    axis.subVectors(position,hip).normalize();
    pole.subVectors(knee,hip);
    pole.addScaledVector(axis,-pole.dot(axis));
    if(pole.lengthSq()<1e-8)pole.set(0,0,1).applyQuaternion(body);
    pole.normalize();
    const along=(upper*upper-lower*lower+reach*reach)/(2*reach);
    const height=Math.sqrt(Math.max(0,upper*upper-along*along));
    kneeGoal.copy(hip).addScaledVector(axis,along).addScaledVector(pole,height);
    aim(thigh,calf,kneeGoal);
    footGoal.copy(hip).addScaledVector(axis,reach);
    aim(calf,foot,footGoal);
    // The foot keeps the idle's world orientation on the ground.
    foot.parent.getWorldQuaternion(parent);
    foot.quaternion.copy(parent.invert().multiply(rotation));
  }

  // Alternate rest and phrases. Each avatar deals the whole repertoire in
  // its own shuffled order before any phrase repeats.
  let begin=0,count=0,pick=null,last=-1,deck=[];
  const deal=seed=>{
    const order=phrases.map((phrase,index)=>({phrase,key:scatter(seed*7.1+index*3.7+count*.913)}))
      .sort((a,b)=>a.key-b.key).map(({phrase})=>phrase);
    if(order[0]===pick)order.push(order.shift());
    deck=order;
  };
  function choose(dwell,seed){
    lanes.fill(0);
    if(dwell<last||!pick){
      count=0;pick=null;
      deal(seed);
      begin=3.0+2.2*scatter(seed);
      pick=deck.shift();
    }
    last=dwell;
    if(dwell>=begin+pick.length){
      count++;
      if(!deck.length)deal(seed);
      begin=dwell+2.4+3.6*scatter(count*1.7+seed);
      pick=deck.shift();
    }else if(dwell>begin)keyed(pick.keys,dwell-begin,lanes);
    return lanes.some(value=>Math.abs(value)>1e-4);
  }

  return {
    phrases:phrases.length,
    apply(character,dwell,weight,seed=0){
      if(applied||weight<=.001||!choose(dwell,Math.floor(seed)))return false;
      touched.forEach((joint,index)=>neutral[index].copy(joint.quaternion));
      pelvisRest.copy(pelvis.position);
      character.getWorldQuaternion(body).normalize();
      inverse.copy(body).invert();
      // Which side is left in the body frame, measured on this rig.
      sides.l.upper.getWorldPosition(start);sides.r.upper.getWorldPosition(end);
      leftSign=Math.sign(end.sub(start).applyQuaternion(inverse).x)<0?1:-1;
      for(const side of ['l','r']){
        sides[side].foot.getWorldPosition(feet[side].position);
        sides[side].foot.getWorldQuaternion(feet[side].rotation);
      }
      const v=lanes.map(value=>value*weight);
      // Hips: translate in the body frame, then roll over the standing leg.
      pelvis.getWorldPosition(start);
      offset.set(v[0]*leftSign,-v[1],v[2]).applyQuaternion(body);
      pelvis.parent.updateWorldMatrix(true,false);
      pelvis.position.copy(pelvis.parent.worldToLocal(start.add(offset)));
      bend([pelvis],0,0,1,v[3]*leftSign);
      // A near-straight idle leg cannot follow a sideways hip: settle the
      // hips just low enough that both feet stay within reach.
      let settle=0;
      axis.set(0,1,0).applyQuaternion(body);
      for(const side of ['l','r']){
        const {thigh,calf,foot}=sides[side];
        thigh.getWorldPosition(hip);calf.getWorldPosition(knee);foot.getWorldPosition(ankle);
        const most=(hip.distanceTo(knee)+knee.distanceTo(ankle))*.995;
        pole.subVectors(hip,feet[side].position);
        const rise=pole.dot(axis),excess=pole.lengthSq()-most*most;
        if(excess>0)settle=Math.max(settle,rise-Math.sqrt(Math.max(0,rise*rise-excess)));
      }
      if(settle>0){
        pelvis.getWorldPosition(start).addScaledVector(axis,-settle);
        pelvis.position.copy(pelvis.parent.worldToLocal(start));
      }
      // Undo the hip roll in the trunk, then bend it as the phrase asks.
      bend(spine,0,0,1,-v[3]*leftSign+v[5]*leftSign);
      bend(spine,1,0,0,v[4]);
      bend(spine,0,1,0,v[6]);
      bend(neck,1,0,0,v[7]-v[4]*.5);
      bend(neck,0,1,0,v[8]);
      bend(neck,0,0,1,v[9]*leftSign-v[5]*leftSign*.6);
      // Arms: overhead reach, a forward counterweight, or a hand on the hip.
      const up=lanes[10]*weight,ahead=lanes[11]*weight;
      for(const side of ['l','r']){
        const {upper,fore,hand}=sides[side],out=side==='l'?1:-1;
        const onHip=lanes[side==='l'?12:13]*weight;
        point(upper,fore,.18*out,.97,.08,up);
        point(fore,hand,-.10*out,.99,.03,up);
        point(upper,fore,.14*out,.08,.99,ahead);
        point(fore,hand,.02*out,.10,1,ahead);
        point(upper,fore,.62*out,-.72,-.30,onHip);
        point(fore,hand,-.55*out,-.42,.30,onHip);
      }
      plant('l');plant('r');
      applied=true;
      return true;
    },
    restore(){
      if(!applied)return;
      touched.forEach((joint,index)=>joint.quaternion.copy(neutral[index]));
      pelvis.position.copy(pelvisRest);
      applied=false;
    },
  };
}

