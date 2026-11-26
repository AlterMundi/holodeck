import {clamp} from './avatar-motion-curves.mjs';

// Stock clips after the MML rig track filter. During their planted portions
// the feet travel back about 4.55 and 6.15 m/s, respectively. The sprint
// contact windows lead the jog windows by approximately one tenth of a cycle.
const jog=1,run=2,jogDuration=.7,runDuration=19/30,runLead=.10;
const jogStride=4.55*jogDuration,runStride=6.15*runDuration;
const wrap=value=>value-Math.floor(value);

export function groundGaitSample(previous,times,weights,distance,mixerStep,simulationStep=mixerStep){
  const total=weights[jog]+weights[run];
  if(!Number.isFinite(total)||total<(previous===null?.08:.002)||!Number.isFinite(mixerStep)||mixerStep<0)return null;
  const timed=distance===null||!Number.isFinite(distance)||distance>.9||simulationStep>.10;
  if(timed&&previous===null)return null;
  const running=weights[run]/total;
  const base=running>.5?times[run]/runDuration+runLead:times[jog]/jogDuration;
  const stride=jogStride+(runStride-jogStride)*running;
  const duration=jogDuration+(runDuration-jogDuration)*running;
  const nativeAdvance=simulationStep/duration;
  // Keep the clip clock continuous while the mixer fades out ground motion.
  // A collider can arrest travel before it clears the controller's gait cue.
  const advance=timed?nativeAdvance:clamp(distance/stride,.25*nativeAdvance,1.45*nativeAdvance);
  const phase=wrap(previous===null?base+nativeAdvance:previous+advance);

  // MML assigns these times, then advances its animation mixer by step.
  // Supply only a render-state copy of its two locomotion lanes.
  return {phase,times:{...times,
    [jog]:wrap(phase-mixerStep/jogDuration)*jogDuration,
    [run]:wrap(phase-runLead-mixerStep/runDuration)*runDuration,
  }};
}
