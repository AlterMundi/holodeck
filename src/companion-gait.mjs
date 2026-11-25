import {Matrix4,Quaternion,Vector3} from 'three';
import {clamp,smooth} from './avatar-motion-curves.mjs';

const localUp=new Vector3(0,1,0),localForward=new Vector3(0,0,1),localRight=new Vector3(1,0,0);
const ankleHeight=.126,stance=.113,toe=.115;
const legs=[['leg-left','shin-left','foot-L',-1,0],['leg-right','shin-right','foot-R',1,.5]];

// Cadence rises with speed and the stance covers only what the legs can reach.
// A short-legged body takes the rest of each stride in the air.
export function companionStride(speed){
  const cadence=speed<1.4?1.1+.55*speed:1.87+.19*(speed-1.4);
  const length=speed/cadence;
  const reach=.29+.04*clamp((speed-3)/4);
  return {cadence,length,duty:Math.min(.6,reach/Math.max(.001,length))};
}

// Place each foot once, keep it there until it lifts, then solve the leg to it.
// Positions are in the root's parent space so moving frames and scale agree.
export function bindCompanionGait(root){
  const hips=root.getObjectByName('hips');
  const limbs=legs.map(([thigh,shin,foot,side,offset])=>({
    thigh:root.getObjectByName(thigh),shin:root.getObjectByName(shin),foot:root.getObjectByName(foot),side,offset,
    sole:new Vector3(),from:new Vector3(),target:new Vector3(),ankle:new Vector3(),toe:new Vector3(),
    facing:new Quaternion(),fromFacing:new Quaternion(),rest:new Quaternion(),
    clipThigh:new Quaternion(),clipShin:new Quaternion(),clipFoot:new Quaternion(),
    planted:true,swing:0,duration:.25,height:0,pitch:0,fromPitch:0,idle:0,error:0,
  }));
  if(!hips||limbs.some(limb=>!limb.thigh||!limb.shin||!limb.foot))return null;
  root.updateWorldMatrix(true,true);
  const world=new Quaternion(),parent=new Quaternion(),turn=new Quaternion(),desired=new Quaternion();
  const hip=new Vector3(),knee=new Vector3(),axis=new Vector3(),pole=new Vector3(),point=new Vector3();
  const from=new Vector3(),to=new Vector3(),up=new Vector3(),forward=new Vector3(),direction=new Vector3();
  const stage=new Matrix4(),landing=new Quaternion();
  root.getWorldQuaternion(world).invert();
  const size=root.getWorldScale(new Vector3()).x;
  for(const limb of limbs){
    limb.rest.copy(world).multiply(limb.foot.getWorldQuaternion(new Quaternion()));
    limb.upper=limb.thigh.getWorldPosition(new Vector3()).distanceTo(limb.shin.getWorldPosition(hip))/size;
    limb.lower=limb.shin.getWorldPosition(new Vector3()).distanceTo(limb.foot.getWorldPosition(hip))/size;
  }
  const clipHips=new Vector3();
  let phase=0,walking=false,fresh=true,still=0,rise=0,drop=0,posed=false;

  function home(limb,out,advance=0){
    out.set(limb.side*stance,0,.004).multiplyScalar(root.scale.x).applyQuaternion(root.quaternion).add(root.position);
    return advance?out.addScaledVector(direction,advance):out;
  }
  // Match the sole to the slope between the ankle and the toe.
  function stand(limb,out,at,place){
    out.copy(root.quaternion);
    if(!place)return;
    from.copy(localForward).applyQuaternion(root.quaternion);
    place(point.copy(at).addScaledVector(from,toe*root.scale.x),up);
    const climb=point.sub(at).dot(up)/(toe*root.scale.x);
    out.multiply(turn.setFromAxisAngle(localRight,-Math.atan(clamp(climb,-.6,.6))));
  }
  function plant(limb,place){
    home(limb,limb.sole);
    place?.(limb.sole,up);
    stand(limb,limb.facing,limb.sole,place);
    Object.assign(limb,{planted:true,swing:0,height:0,pitch:0,idle:0,cycle:undefined});
  }
  function liftOff(limb,duration){
    Object.assign(limb,{planted:false,swing:0,duration});
    limb.from.copy(limb.sole);
    limb.fromFacing.copy(limb.facing);
    limb.fromPitch=limb.pitch;
  }
  const heading=limb=>{
    from.copy(localForward).applyQuaternion(limb.facing);
    from.addScaledVector(up,-from.dot(up));
    to.copy(localForward).applyQuaternion(root.quaternion);
    return from.angleTo(to);
  };

  return {
    limbs,
    get phase(){return ((phase%1)+1)%1;},
    get walking(){return walking;},
    reset(){fresh=true;walking=false;phase=0;still=0;rise=drop=0;},
    // Advance contacts before the mixer runs, so the body clips share the phase.
    advance({step,speed,velocity,place}){
      const scale=root.scale.x;
      up.copy(localUp).applyQuaternion(root.quaternion);
      if(fresh){
        for(const limb of limbs)plant(limb,place);
        fresh=false;
      }
      const planar=direction.copy(velocity).addScaledVector(up,-velocity.dot(up)).length();
      if(planar>1e-5)direction.divideScalar(planar);
      const moves=speed>(walking?.05:.09);
      const {cadence,length,duty}=companionStride(Math.max(.09,speed));
      if(moves&&!walking){
        // The foot that trails the direction of travel takes the first step.
        const trailing=limbs.map(limb=>point.subVectors(limb.sole,root.position).dot(direction));
        const first=trailing[0]<=trailing[1]?0:1;
        phase=Math.floor(phase)+duty-limbs[first].offset+(limbs[first].offset?1:0);
        limbs[1-first].cycle=Math.floor(phase+limbs[1-first].offset);
        limbs[first].cycle=undefined;
      }
      walking=moves;
      still=moves?0:still+step;
      if(walking)phase+=cadence*step;
      const lead=Math.min(length*duty,.33)/2*scale;
      let swinging=limbs.filter(limb=>!limb.planted).length;
      for(const limb of limbs){
        if(limb.planted){
          const strayed=point.subVectors(limb.sole,home(limb,to)).addScaledVector(up,-point.dot(up)).length()/scale;
          if(walking){
            const local=phase+limb.offset,cycle=Math.floor(local);
            const due=local-cycle>=duty&&limb.cycle!==cycle;
            if(due||strayed+.5*step*planar/scale>.245){
              limb.cycle=cycle;
              liftOff(limb,(1-duty)/cadence);
              // Contact ended inside this frame. Credit the elapsed part.
              if(due)limb.swing=Math.max(0,(local-cycle-duty)/(1-duty)-step/limb.duration);
              swinging++;
            }
          }else{
            const turned=heading(limb);
            const error=strayed/.05+turned/.34;
            limb.idle=error>(still>.45?.6:1)?limb.idle+step:0;
            const other=limbs[limb===limbs[0]?1:0];
            if(limb.idle>.05&&!swinging&&(other.idle===0||other.error<=error)){
              liftOff(limb,.25);
              swinging++;
            }
            limb.error=error;
          }
        }
        if(limb.planted)continue;
        const elapsed=limb.swing+step/limb.duration;
        limb.swing=Math.min(1,elapsed);
        home(limb,limb.target,walking?Math.max(-lead*.4,(1-elapsed)*limb.duration*planar+lead):0);
        place?.(limb.target,up);
        const s=limb.swing,travel=smooth(s);
        limb.sole.lerpVectors(limb.from,limb.target,travel);
        if(place){
          // Clear a kerb or crest between the two contacts.
          place(point.copy(limb.sole),up);
          limb.sole.addScaledVector(up,Math.max(0,point.sub(limb.sole).dot(up)));
        }
        stand(limb,landing,limb.target,place);
        limb.facing.slerpQuaternions(limb.fromFacing,landing,travel);
        const arc=Math.sin(Math.PI*s**.82);
        limb.height=(walking?Math.min(.15,.05+.026*speed):.038)*arc*arc;
        const kick=clamp(speed/4);
        limb.pitch=limb.fromPitch*(1-smooth(s/.35))+(.30+.65*kick)*Math.sin(Math.PI*clamp(s/.62))-(.12+.16*kick)*Math.sin(Math.PI*clamp((s-.55)/.45));
        if(s>=1){
          limb.sole.copy(limb.target);
          limb.facing.copy(landing);
          Object.assign(limb,{planted:true,height:0,pitch:0,idle:0});
        }
      }
      // Both feet off the ground: the body follows the same ballistic interval.
      const flight=.5-duty;
      rise=0;
      if(walking&&flight>.02){
        const beat=((phase%.5)+.5)%.5;
        const at=clamp((beat-duty)/flight);
        rise=4*at*(1-at)*Math.min(.075,1.5*9.8*(flight/cadence)**2/8)*smooth((speed-1)/1.4);
      }
    },
    // The mixer skips channels whose sample did not change. Give it back its
    // own values before it runs so corrections never accumulate.
    restore(){
      if(!posed)return;
      posed=false;
      hips.position.copy(clipHips);
      for(const limb of limbs){
        limb.thigh.quaternion.copy(limb.clipThigh);
        limb.shin.quaternion.copy(limb.clipShin);
        limb.foot.quaternion.copy(limb.clipFoot);
      }
    },
    // Run after the mixer. Weight fades the contacts out for air and water.
    apply(weight,{crouch=0}={}){
      if(weight<.001||fresh)return;
      const scale=root.scale.x;
      up.copy(localUp).applyQuaternion(root.quaternion);
      forward.copy(localForward).applyQuaternion(root.quaternion);
      stage.copy(root.parent.matrixWorld);
      const grow=point.setFromMatrixScale(stage).x*scale;
      root.parent.getWorldQuaternion(parent);
      up.applyQuaternion(parent);forward.applyQuaternion(parent);
      root.updateWorldMatrix(false,true);
      drop=crouch*.075;
      for(const limb of limbs){
        desired.copy(parent).multiply(limb.facing);
        limb.ankle.copy(limb.sole).applyMatrix4(stage)
          .add(point.set(0,ankleHeight*grow,0).applyQuaternion(desired));
        limb.thigh.getWorldPosition(hip);
        if(limb.planted){
          // Roll over a fixed toe as the body passes ahead of it.
          const behind=point.subVectors(hip,limb.ankle).dot(forward)/grow;
          limb.pitch=walking?.75*smooth((behind-.055)/.12):0;
          if(limb.pitch>0){
            limb.toe.set(0,-ankleHeight,toe).multiplyScalar(grow);
            point.copy(limb.toe).applyQuaternion(turn.setFromAxisAngle(localRight,limb.pitch));
            limb.toe.sub(point).applyQuaternion(desired);
            limb.ankle.add(limb.toe);
          }
          const stood=point.subVectors(hip,limb.ankle).dot(up)/grow;
          const reach=(limb.upper+limb.lower)*.997;
          const across=Math.max(0,point.lengthSq()/(grow*grow)-stood*stood);
          const tallest=Math.sqrt(Math.max(.01,reach*reach-across));
          const needed=stood+rise-tallest,limit=crouch*.075+rise+.12;
          // A contact the legs cannot keep ends as a step, not as a slide.
          if(needed>limit)liftOff(limb,.2);
          drop=Math.max(drop,Math.min(limit,needed));
        }else{
          const lowest=ankleHeight*(Math.cos(limb.pitch)-1)+Math.abs(Math.sin(limb.pitch))*(limb.pitch>0?toe+.02:.085);
          limb.ankle.addScaledVector(up,(limb.height+rise*.7+lowest)*grow);
        }
      }
      posed=true;
      clipHips.copy(hips.position);
      for(const limb of limbs){
        limb.clipThigh.copy(limb.thigh.quaternion);
        limb.clipShin.copy(limb.shin.quaternion);
        limb.clipFoot.copy(limb.foot.quaternion);
      }
      hips.position.z+=(rise-drop)*weight;
      hips.updateWorldMatrix(false,true);
      for(const limb of limbs){
        limb.thigh.getWorldPosition(hip);
        axis.subVectors(limb.ankle,hip);
        const distance=axis.length();
        if(distance<1e-5)continue;
        axis.divideScalar(distance);
        const upper=limb.upper*grow,lower=limb.lower*grow;
        const reach=clamp(distance,Math.abs(upper-lower)+1e-4*grow,(upper+lower)*.9995);
        const along=(upper*upper+reach*reach-lower*lower)/(2*reach);
        pole.copy(forward).addScaledVector(axis,-forward.dot(axis));
        if(pole.lengthSq()<1e-6)continue;
        knee.copy(hip).addScaledVector(axis,along).addScaledVector(pole.normalize(),Math.sqrt(Math.max(0,upper*upper-along*along)));
        limb.ankle.copy(hip).addScaledVector(axis,reach);
        aim(limb.thigh,limb.shin,knee);
        aim(limb.shin,limb.foot,limb.ankle);
        root.parent.getWorldQuaternion(desired).multiply(limb.facing)
          .multiply(turn.setFromAxisAngle(localRight,limb.pitch)).multiply(limb.rest);
        limb.foot.parent.getWorldQuaternion(world).invert();
        limb.foot.quaternion.copy(world).multiply(desired);
        if(weight<.999){
          const thigh=limb.thigh.quaternion,shin=limb.shin.quaternion,foot=limb.foot.quaternion;
          thigh.slerpQuaternions(limb.clipThigh,desired.copy(thigh),weight);
          shin.slerpQuaternions(limb.clipShin,desired.copy(shin),weight);
          foot.slerpQuaternions(limb.clipFoot,desired.copy(foot),weight);
        }
        limb.thigh.updateWorldMatrix(false,true);
      }
    },
  };

  function aim(bone,child,destination){
    bone.getWorldPosition(point);
    child.getWorldPosition(from).sub(point).normalize();
    to.copy(destination).sub(point).normalize();
    bone.getWorldQuaternion(world).premultiply(turn.setFromUnitVectors(from,to));
    bone.parent.getWorldQuaternion(desired).invert();
    bone.quaternion.copy(desired).multiply(world);
    bone.updateWorldMatrix(false,true);
  }
}
