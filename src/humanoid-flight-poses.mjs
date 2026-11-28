import {Euler,Matrix4,Quaternion,Vector3} from 'three';
import {keyed,smooth} from './avatar-motion-curves.mjs';

// Original keyed phrases. Directions use the Y-up body frame for the left
// side. The right side mirrors across X before retargeting to the skeleton.
// Lanes: upper arm, forearm, thigh, calf, foot, spine and head. The last two
// hold pitch, yaw and roll in radians. Times are seconds, repeats are holds.
const pose=(upper,fore,thigh,calf,foot,spine=[0,0,0],head=[0,0,0])=>[...upper,...fore,...thigh,...calf,...foot,...spine,...head];
// Floating has a long breath and a small offset between the two sides.
// At cruise the chest leads, with the hands trailing in the slipstream.
const drift=[
  pose([.29,-.94,.13],[.16,-.82,.55],[.09,-.93,.36],[.05,-.92,-.38],[.02,-.58,.81],[.04,.04,.02],[-.03,-.04,-.01]),
  pose([.41,-.90,.08],[.20,-.89,.42],[.08,-.99,.08],[.04,-.97,-.24],[0,-.70,.71],[.10,.01,-.03],[-.08,.02,.01]),
  pose([.46,-.88,.11],[.22,-.80,.55],[.11,-.99,-.02],[.05,-.95,-.31],[.02,-.78,.62],[.04,-.06,-.02],[-.03,.05,.02]),
  pose([.35,-.91,.18],[.14,-.80,.58],[.10,-.96,.25],[.04,-.91,-.41],[.02,-.64,.77],[.07,-.01,.02],[-.06,-.03,-.01]),
];
const sweep=[
  pose([.42,-.77,-.48],[.23,-.68,-.69],[.08,-.98,-.20],[.04,-.97,-.24],[0,-.90,.44],[-.04,0,.02],[-.38,0,-.02]),
  pose([.47,-.74,-.48],[.28,-.61,-.74],[.06,-.99,-.12],[.03,-.95,-.32],[0,-.92,.40],[-.08,.03,0],[-.34,-.02,0]),
  pose([.44,-.75,-.49],[.26,-.63,-.73],[.08,-.97,-.24],[.04,-.98,-.18],[0,-.88,.47],[-.04,0,-.02],[-.38,0,.02]),
  pose([.40,-.79,-.46],[.20,-.73,-.65],[.07,-.98,-.17],[.04,-.96,-.28],[0,-.90,.44],[-.02,-.03,0],[-.40,.02,0]),
];
// Advance from a gathered shoulder and knee into a long, diagonal shape.
// The rear arm and feet trail the reach. This asymmetric line is original.
const boostGather=pose([.33,-.73,.60],[.08,-.18,.98],[.16,-.84,.52],[.06,-.87,-.48],[.01,-.78,.62],[.12,-.09,.09],[-.28,.08,-.05]);
const boostLead=pose([.16,.89,.43],[.09,.98,.18],[.07,-.99,-.09],[.04,-.98,-.18],[.02,-.99,.10],[-.15,-.10,-.09],[-.54,.08,.05]);
const boostTrail=pose([.35,-.61,-.70],[.20,-.48,-.85],[.12,-.96,-.21],[.06,-.99,-.12],[.02,-.99,.12]);
// Air brake: chest up, arms thrown wide and forward, legs swinging ahead.
const boostBrake=pose([.86,-.22,.46],[.72,.12,.68],[.12,-.78,.61],[.08,-.97,-.22],[.02,-.40,.92],[-.14,.02,.02],[-.20,-.02,-.02]);
// Flight styles, for the left side. Each style names the left and right
// arm; the rig mirrors the right across X. A cruising body holds them more
// loosely than a boost.
const fistAhead=pose([.10,.96,.26],[.04,.99,.12],[.07,-.99,-.09],[.04,-.98,-.18],[.02,-.99,.10]);
const fistsTogether=pose([.03,.96,.28],[-.10,.99,.08],[.06,-.99,-.08],[.04,-.98,-.16],[.02,-.99,.10]);
const armAlong=pose([.18,-.97,-.16],[.10,-.99,-.08],[.07,-.99,-.09],[.04,-.98,-.18],[.02,-.99,.10]);
// Thrusters: arms down and back at the sides, palms driving the body on.
const thruster=pose([.38,-.70,-.60],[.30,-.62,-.72],[.07,-.99,-.09],[.04,-.98,-.18],[.02,-.99,.10]);
// Standing in the air or treading water, a hero still has things to do.
// Each rest style shapes the limbs over the floating loop.
const onHip=pose([.62,-.72,-.30],[-.55,-.42,.30],[.10,-.99,.02],[.06,-.99,-.08],[0,-.85,.52]);
const levitate=pose([.55,-.82,.12],[.60,-.68,.40],[.08,-.99,.04],[.05,-.99,-.06],[0,-.90,.44]);
// Arms folded across the chest, legs long and together: watching, unhurried.
const armsFolded=pose([.30,-.88,.36],[-.86,.08,.50],[.06,-.99,-.04],[.04,-.99,-.08],[0,-.96,.28]);
const straightDown=pose([.30,-.94,.10],[.20,-.90,.38],[.06,-.99,-.04],[.04,-.99,-.08],[0,-.96,.28]);
const scullWide=pose([.86,-.44,.26],[.80,.08,.59],[.07,-.99,.10],[.05,-.97,-.24],[0,-.70,.71]);
const scullCalm=pose([.40,-.78,.48],[.30,-.40,.86],[.12,-.90,.42],[.08,-.92,-.38],[0,-.60,.80]);
export const HOVER_STYLES=Object.freeze({
  'fists-on-hips':{left:onHip,right:onHip},
  levitate:{left:levitate,right:levitate},
  'arms-folded':{left:armsFolded,right:armsFolded},
  drift:null,
});
export const TREAD_STYLES=Object.freeze({'scull-wide':{left:scullWide,right:scullWide},'scull-calm':{left:scullCalm,right:scullCalm},tread:null});
export const FLIGHT_STYLES=Object.freeze({
  'superman-left':{left:fistAhead,right:armAlong},
  'superman-right':{left:armAlong,right:fistAhead},
  'fists-together':{left:fistsTogether,right:fistsTogether},
  thrusters:{left:thruster,right:thruster},
  rocket:{left:armAlong,right:armAlong},
});
// Launch: drop low with one fist back, then drive it straight at the sky.
const launchFist=pose([.06,.98,.16],[.03,.99,.08],[.06,-.99,-.06],[.04,-.99,-.10],[0,-.98,.20],[-.10,0,0],[-.36,0,0]);
const launchTight=pose([.20,-.96,.18],[.10,-.80,.58],[.06,-.99,-.06],[.04,-.99,-.10],[0,-.98,.20],[-.10,0,0],[-.36,0,0]);
const coilBrace=pose([.34,-.70,.62],[.14,-.92,.36],[.13,-.84,.53],[.10,-.79,-.61],[0,-.12,.99],[.40,0,0],[-.30,0,0]);
// Double-jump surges, in the register of a film superhero: no spins, no
// tumbling. Each gathers for a beat, then drives the body up with intent and
// holds a strong, readable line before opening for the fall.
const gatherLow=pose([.42,-.82,.40],[.10,-.30,.95],[.12,-.55,.82],[.08,-.92,-.38],[0,-.45,.89],[.22,0,0],[-.10,0,0]);
const gatherCross=pose([.30,-.60,.74],[-.80,.25,.55],[.12,-.62,.77],[.08,-.92,-.38],[0,-.45,.89],[.26,0,0],[.05,0,0]);
// Skyward: one fist driven straight up, the other arm locked down at the
// side, legs together and pointed; chest open, eyes on the sky.
const skyFist=pose([.06,.98,.16],[.03,.99,.10],[.04,-.99,-.08],[.03,-.99,-.12],[0,-.97,.24],[-.12,0,0],[-.42,0,0]);
const skyLocked=pose([.22,-.95,-.20],[.12,-.98,-.16],[.04,-.99,-.08],[.03,-.99,-.12],[0,-.97,.24],[-.12,0,0],[-.42,0,0]);
// Power burst: arms flung out and down with open hands, chest thrown open,
// legs a little apart, as if energy left the body.
const burstOpen=pose([.86,-.40,.32],[.92,-.28,.28],[.22,-.95,.20],[.10,-.96,-.26],[.04,-.80,.60],[-.20,0,0],[-.30,0,0]);
// Leap: an athlete's stride through the air; the lead knee driven high,
// the trail leg long behind, arms in counter-swing.
const leapDriveArm=pose([.20,.40,.89],[.08,.90,.42],[.10,-.10,.99],[.06,-.96,-.26],[0,-.40,.92],[.18,0,0],[-.18,0,0]);
const leapTrailArm=pose([.22,-.55,-.80],[.12,-.30,-.95],[.06,-.75,-.66],[.03,-.45,-.89],[0,-.70,-.71],[.18,0,0],[-.18,0,0]);
// Guarded rise: compact and armoured, forearms up before the face, knees
// drawn, then the legs reach for the ground.
const guardUp=pose([.30,-.20,.93],[-.30,.85,.43],[.12,-.25,.96],[.07,-.95,-.30],[0,-.45,.89],[.20,0,0],[.12,0,0]);
// The other leg stays long beneath, so the guard reads as a fighter, not a ball.
const guardLong=pose([.30,-.20,.93],[-.30,.85,.43],[.06,-.97,.22],[.04,-.99,-.08],[0,-.85,.52],[.20,0,0],[.12,0,0]);
const openFall=pose([.55,-.78,.30],[.42,-.70,.58],[.12,-.90,.42],[.07,-.96,-.26],[0,-.30,.95],[.02,0,0],[.08,0,0]);
const coil=pose([.30,-.86,-.42],[.18,-.95,-.24],[.13,-.84,.53],[.10,-.79,-.61],[0,-.12,.99],[.34,0,0],[-.22,0,0]);
const spring=pose([.28,-.94,-.18],[.16,-.98,-.12],[.07,-.99,-.08],[.04,-.99,-.12],[0,-.95,.31],[-.16,0,0],[-.26,0,0]);
const tuck=pose([.54,-.76,.36],[.24,-.60,.76],[.13,-.72,.68],[.08,-.78,-.62],[.02,-.50,.86],[.14,0,0],[-.12,0,0]);
const flare=pose([.72,-.60,.34],[.42,-.50,.76],[.14,-.82,.55],[.08,-.88,-.47],[0,.05,1],[-.12,0,0],[.10,0,0]);
const reachDown=pose([.60,-.78,.16],[.40,-.82,.42],[.11,-.95,.28],[.06,-.98,-.16],[0,.02,1],[-.04,0,0],[.14,0,0]);
const brake=pose([.50,-.82,.28],[.30,-.70,.64],[.10,-.99,.05],[.06,-.99,-.08],[0,-.1,1],[.10,0,0],[-.06,0,0]);
const rest=pose([.24,-.97,.05],[.14,-.96,.24],[.10,-.99,.02],[.06,-.99,-.08],[0,-.1,1]);
const tread=[
  pose([.56,-.80,.20],[.42,-.55,.72],[.16,-.80,.58],[.14,-.90,-.42],[.06,-.60,.80],[.07,.05,.03],[-.05,-.04,-.02]),
  pose([.72,-.68,.12],[.70,-.52,.50],[.24,-.82,.52],[.24,-.96,.10],[.16,-.45,.88],[.05,.02,-.02],[-.03,-.01,.01]),
  pose([.64,-.76,.12],[.60,-.68,.42],[.18,-.94,.28],[-.08,-.99,.06],[.02,-.62,.78],[.07,-.05,-.03],[-.05,.04,.02]),
  pose([.46,-.86,.22],[.16,-.62,.77],[.14,-.90,.40],[.04,-.82,-.57],[.02,-.72,.69],[.09,-.02,.02],[-.07,.01,-.01]),
];
// Swimming is a torpedo: arms locked ahead, fists together, the whole body
// driving a dolphin kick from the chest down to pointed feet.
const torpedo=(thigh,calf,foot,chest)=>pose([.05,.96,.27],[-.08,.99,.10],thigh,calf,foot,[chest,0,0],[-.52,0,0]);
const stroke=[
  [0,torpedo([.05,-.98,.20],[.03,-.99,-.02],[0,-.93,.36],.05)],
  [.22,torpedo([.05,-.99,-.10],[.03,-.85,-.52],[0,-.75,.66],-.06)],
  [.40,torpedo([.05,-.94,-.33],[.03,-.97,-.24],[0,-.98,.20],-.02)],
  [.62,torpedo([.05,-.99,.05],[.03,-.99,.10],[0,-.96,.28],.06)],
];
const wade=[
  pose([.82,-.52,.22],[.60,-.10,.79],[.1,-1,0],[.05,-1,0],[0,-.1,1],[.08,.06,0],[-.05,-.04,0]),
  pose([.76,-.60,.02],[.64,-.20,.74],[.1,-1,0],[.05,-1,0],[0,-.1,1],[.08,0,0],[-.05,0,0]),
  pose([.80,-.56,.12],[.62,-.14,.77],[.1,-1,0],[.05,-1,0],[0,-.1,1],[.08,-.06,0],[-.05,.04,0]),
];
const even=(poses,seconds)=>poses.map((value,index)=>[index*seconds/poses.length,value]);
const clips={
  hover:{keys:even(drift,3.8),loop:3.8,alternate:true},
  glide:{keys:even(sweep,2.2),loop:2.2,alternate:true},
  lift:{keys:[[0,rest],[.07,coil],[.14,coil],[.24,launchFist],[.42,launchFist],[.58,tuck],[.72,drift[0]]],
    right:[[0,rest],[.07,coilBrace],[.14,coilBrace],[.24,launchTight],[.42,launchTight],[.58,tuck],[.72,drift[0]]]},
  surgeSky:{keys:[[0,gatherLow],[.16,gatherLow],[.30,skyFist],[.58,skyFist],[.78,openFall]],
    right:[[0,gatherLow],[.16,gatherLow],[.30,skyLocked],[.58,skyLocked],[.78,openFall]]},
  surgeBurst:{keys:[[0,gatherCross],[.18,gatherCross],[.30,burstOpen],[.60,burstOpen],[.78,openFall]]},
  surgeLeap:{keys:[[0,gatherLow],[.12,gatherLow],[.26,leapTrailArm],[.60,leapTrailArm],[.78,openFall]],
    right:[[0,gatherLow],[.12,gatherLow],[.26,leapDriveArm],[.60,leapDriveArm],[.78,openFall]]},
  surgeGuard:{keys:[[0,gatherLow],[.12,guardUp],[.56,guardUp],[.78,openFall]],
    right:[[0,gatherLow],[.12,guardLong],[.56,guardLong],[.78,openFall]]},
  descend:{keys:[[0,drift[1]],[.20,flare],[.42,flare],[.80,reachDown]]},
  land:{keys:[[0,reachDown],[.10,brake],[.18,brake],[.46,rest]]},
  tread:{keys:even(tread,1.8),loop:1.8,alternate:true},
  stroke:{keys:stroke,loop:.84},
  wade:{keys:even(wade,1.3),loop:1.3,alternate:true},
};

const torso=['pelvis','spine_01','spine_02','spine_03','spine_04','spine_05',
  'neck_01','neck_02','head','clavicle_l','clavicle_r'];
const tracks=[
  ['upperarm','lowerarm'],['lowerarm','hand'],
  ['thigh','calf'],['calf','foot'],['foot','ball'],
];

export function bindHumanoidFlightRig(mesh){
  let skeleton;
  mesh.traverse(object=>{if(!skeleton&&object.isSkinnedMesh)skeleton=object.skeleton;});
  if(!skeleton)return null;
  const indexes=new Map(skeleton.bones.map((bone,index)=>[bone,index]));
  const joints=new Map(skeleton.bones.map(bone=>[bone.name,bone]));
  const position=new Vector3(),scale=new Vector3();
  const modelBind=new Matrix4(),localBind=new Matrix4();
  function binding(bone){
    const index=indexes.get(bone),parent=indexes.get(bone?.parent);
    if(index===undefined||parent===undefined)return null;
    modelBind.copy(skeleton.boneInverses[index]).invert();
    const rotation=new Quaternion(),restPosition=new Vector3().setFromMatrixPosition(modelBind);
    modelBind.decompose(position,rotation,scale);
    localBind.multiplyMatrices(skeleton.boneInverses[parent],modelBind);
    const restLocal=new Quaternion(),restOffset=new Vector3();
    localBind.decompose(restOffset,restLocal,scale);
    return {bone,rotation,restPosition,restLocal,restOffset,
      previous:new Quaternion(),previousOffset:new Vector3()};
  }
  const body=torso.map(name=>binding(joints.get(name))).filter(Boolean);
  for(const bone of skeleton.bones){
    if(/^(hand|upperarm_twist|lowerarm_twist|thigh_twist|calf_twist)_/.test(bone.name)){
      const item=binding(bone);
      if(item)body.push(item);
    }
  }
  for(const item of body){
    const name=item.bone.name;
    item.group=/^(pelvis|thigh|calf)/.test(name)?'lower':/^(hand|upperarm|lowerarm|clavicle)/.test(name)?'arm':'torso';
  }
  const limbs=['l','r'].map(side=>tracks.map(([start,end])=>{
    const item=binding(joints.get(start+'_'+side));
    const tip=binding(joints.get(end+'_'+side));
    if(!item||!tip)return null;
    const span=tip.restPosition.sub(item.restPosition);
    return {...item,length:span.length(),direction:span.normalize()};
  }));
  if(limbs.some(side=>side.some(item=>!item)))return null;

  const bodyWorld=new Quaternion(),bodyInverse=new Quaternion(),parentWorld=new Quaternion(),target=new Quaternion();
  const direction=new Vector3(),aim=new Vector3();
  const hinge=new Vector3(),cross=new Vector3(),projected=new Vector3();
  const swing=new Quaternion();
  const sideAxis=new Vector3(),normal=new Vector3(),basis=new Matrix4();
  function frame(forward,result){
    sideAxis.set(1,0,0).addScaledVector(forward,-forward.x).normalize();
    normal.crossVectors(sideAxis,forward);
    basis.makeBasis(sideAxis,forward,normal);
    return result.setFromRotationMatrix(basis);
  }
  for(const side of limbs){
    for(const limb of side){
      limb.restFrameInverse=frame(limb.direction,new Quaternion()).invert();
      limb.frameOffset=limb.restFrameInverse.clone().multiply(limb.rotation);
      limb.aim=new Vector3();
      limb.drawn=new Vector3();
    }
    for(const lane of [1,3]){
      side[lane].hinge=new Vector3().crossVectors(side[lane-1].direction,side[lane].direction).normalize();
    }
  }
  const modified=[];
  function applyTransform(item,rotation,weight){
    const {bone,previous,previousOffset,restOffset}=item;
    previous.copy(bone.quaternion);
    previousOffset.copy(bone.position);
    bone.quaternion.slerp(rotation,weight);
    bone.position.lerp(restOffset,weight);
    modified.push(item);
  }
  const sides=[new Array(21),new Array(21)],mixed=new Array(21);
  const at=(name,time,side)=>time+(clips[name].alternate&&side?clips[name].loop/2:0);
  function sample(name,time){
    for(const [side,out] of sides.entries())keyed(side&&clips[name].right||clips[name].keys,at(name,time,side),out,clips[name].loop);
  }
  function blend(name,time,amount){
    if(amount<=0)return;
    for(const [side,out] of sides.entries()){
      keyed(clips[name].keys,at(name,time,side),mixed,clips[name].loop);
      for(let index=0;index<out.length;index++)out[index]+=(mixed[index]-out[index])*amount;
    }
  }
  const spine=['spine_01','spine_02','spine_03','spine_04','spine_05'].map(name=>joints.get(name)).filter(Boolean);
  const neck=['neck_01','neck_02','head'].map(name=>joints.get(name)).filter(Boolean);
  const accent=new Quaternion(),share=new Quaternion(),angles=new Euler(0,0,0,'YXZ');
  // Turn a chain in the body frame, spread over its joints from the base up.
  function bendChain(chain,pitch,yaw,roll,amount){
    if(!chain.length||amount<=0)return;
    const part=amount/chain.length;
    accent.setFromEuler(angles.set(pitch*part,yaw*part,roll*part)).premultiply(bodyWorld).multiply(bodyInverse);
    for(const bone of chain){
      bone.parent.getWorldQuaternion(parentWorld);
      share.copy(parentWorld).invert().multiply(accent).multiply(parentWorld);
      bone.quaternion.premultiply(share);
    }
  }
  const shoulder=new Vector3(),waterUp=new Vector3();
  // Rotate an aim toward the bed until the far joint is under the surface.
  function submerge(forward,height,length,ceiling){
    const limit=Math.max(-.97,Math.min(.97,(ceiling-height)/length));
    const along=forward.dot(waterUp);
    if(along<=limit)return height+along*length;
    forward.addScaledVector(waterUp,-along);
    if(forward.lengthSq()<1e-4)forward.set(0,0,1).addScaledVector(waterUp,-waterUp.z);
    forward.setLength(Math.sqrt(1-limit*limit)).addScaledVector(waterUp,limit);
    return height+limit*length;
  }
  return {
    restore(){
      for(let index=modified.length-1;index>=0;index--){
        const {bone,previous,previousOffset}=modified[index];
        bone.quaternion.copy(previous);
        bone.position.copy(previousOffset);
      }
      modified.length=0;
    },
    reset(){
      for(const limb of limbs.flat())limb.aim.set(0,0,0);
    },
    // water is {up, point} in world space while hands must stay submerged.
    apply(character,{mode,time,forward=0,weight,lowerWeight=weight,torsoWeight=weight,step,bank=0,boost=0,boostRelease=0,style=null,climb=0,rest=null,restAmount=0,
      stroke:strokeWeight=0,strokeTime=time,water=null}){
      if(weight<=0&&lowerWeight<=0)return;
      const name=mode==='swim'?'tread':clips[mode]?mode:'hover';
      sample(name,time);
      if(name==='hover'){
        blend('glide',time,forward);
        // Cruising holds the chosen style loosely; boost commits to it.
        if(style&&forward>0)for(const [side,out] of sides.entries()){
          const arms=side?style.right:style.left;
          for(let i=0;i<15;i++)out[i]+=(arms[i]-out[i])*forward*(i<6?.7:.35)*(1-boost);
        }
        if(boost>0){
          const gather=smooth(boost/.30),extend=smooth((boost-.30)/.70);
          for(const [side,out] of sides.entries()){
            const target=style?(side?style.right:style.left):side===0?boostLead:boostTrail;
            for(let i=0;i<out.length;i++){
              out[i]+=(boostGather[i]-out[i])*gather;
              // A style sets the limbs; the chest and head keep the boost's line.
              out[i]+=((style&&i>=15?boostLead:target)[i]-out[i])*extend;
              out[i]+=(boostBrake[i]-out[i])*boostRelease*.72;
            }
          }
        }
      }
      // Rest styles shape the floating or treading loop, which keeps breathing.
      if(rest&&restAmount>0&&(name==='hover'||name==='tread'))for(const [side,out] of sides.entries()){
        const target=side?rest.right:rest.left,amount=restAmount*(name==='tread'?.65:.85);
        for(let i=0;i<15;i++)out[i]+=(target[i]-out[i])*amount;
      }
      if(name==='tread')blend('stroke',strokeTime,strokeWeight);
      // Rising straight up, one fist leads toward the sky.
      if(climb>0&&name==='hover')for(const [side,out] of sides.entries()){
        const target=side?launchTight:launchFist;
        for(let i=0;i<15;i++)out[i]+=(target[i]-out[i])*climb;
      }
      for(const item of body){
        const amount=item.group==='lower'?lowerWeight:item.group==='arm'?weight:torsoWeight;
        if(amount>0)applyTransform(item,item.restLocal,amount);
      }
      character.getWorldQuaternion(bodyWorld);
      bodyInverse.copy(bodyWorld).invert();
      const [values]=sides;
      bendChain(spine,values[15],values[16]+bank*.55,values[17]+bank*.30,torsoWeight);
      bendChain(neck,values[18],values[19]+bank*.50,values[20]-bank*.45,torsoWeight);
      const size=character.getWorldScale(shoulder).x;
      if(water)waterUp.copy(water.up).applyQuaternion(bodyInverse);
      for(let side=0;side<limbs.length;side++){
        let height=0;
        if(water){
          limbs[side][0].bone.getWorldPosition(shoulder).sub(water.point);
          height=shoulder.dot(water.up)/size;
        }
        for(let lane=0;lane<tracks.length;lane++){
          const item=limbs[side][lane];
          direction.fromArray(sides[side],lane*3);
          // Reach along the outer wing and fold the inner one into the turn.
          if(lane<2)direction.y+=(side?-1:1)*bank*.75;
          if(side===1)direction.x=-direction.x;
          direction.normalize();
          if(item.aim.lengthSq()<.001)item.aim.copy(direction);
          else item.aim.lerp(direction,1-Math.exp(-step*18)).normalize();
          aim.copy(item.aim);
          if(item.hinge){
            const parent=limbs[side][lane-1];
            swing.copy(frame(parent.drawn,target)).multiply(parent.restFrameInverse);
            hinge.copy(item.hinge).applyQuaternion(swing);
            projected.copy(aim).addScaledVector(hinge,-aim.dot(hinge)).normalize();
            cross.crossVectors(parent.drawn,projected);
            const flex=Math.atan2(cross.dot(hinge),parent.drawn.dot(projected));
            aim.copy(parent.drawn).applyAxisAngle(hinge,Math.max(.10,Math.min(lane===1?1.9:2.0,flex)));
          }
          if(water&&lane<2)height=submerge(aim,height,item.length,lane===1?-.12:Math.max(-.06,height-.86*item.length));
          item.drawn.copy(aim);
          const amount=lane<2?weight:lowerWeight;
          if(amount<=0)continue;
          item.bone.parent.getWorldQuaternion(parentWorld);
          frame(aim,target).multiply(item.frameOffset)
            .premultiply(bodyWorld).premultiply(parentWorld.invert());
          applyTransform(item,target,amount);
        }
      }
    },
  };
}
