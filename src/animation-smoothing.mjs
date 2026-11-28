// Keyframe hygiene for baked companion clips. The Navegante's clips are
// sampled every frame with fine authored noise; replayed and blended, that
// noise reads as trembling. Keep quaternion signs continuous, then low-pass
// every track with a small Gaussian (wrapping for looping cycles).

export function continuousQuaternions(track){
  const v=track.values;
  for(let i=4;i<v.length;i+=4){
    if(v[i]*v[i-4]+v[i+1]*v[i-3]+v[i+2]*v[i-2]+v[i+3]*v[i-1]<0)
      for(let c=0;c<4;c++)v[i+c]=-v[i+c];
  }
  return track;
}

function kernel(sigma){
  const radius=Math.max(1,Math.ceil(sigma*2.5)),weights=[];
  for(let i=-radius;i<=radius;i++)weights.push(Math.exp(-(i*i)/(2*sigma*sigma)));
  const total=weights.reduce((a,b)=>a+b,0);
  return {radius,weights:weights.map(w=>w/total)};
}

// sigmaSeconds: smoothing width; loop: the clip repeats (first == last pose).
export function smoothTrack(track,{sigmaSeconds=.05,loop=false}={}){
  const times=track.times,count=times.length;
  if(count<5)return track;
  const step=(times[count-1]-times[0])/(count-1)||1/30;
  const {radius,weights}=kernel(sigmaSeconds/step);
  const size=track.getValueSize(),source=Float32Array.from(track.values),out=track.values;
  const quaternion=track.ValueTypeName==='quaternion';
  if(quaternion)continuousQuaternions(track),source.set(track.values);
  // In a loop the last key repeats the first; index the period without it.
  const period=loop?count-1:count;
  for(let i=0;i<count;i++){
    for(let c=0;c<size;c++){
      let sum=0;
      for(let k=-radius;k<=radius;k++){
        let j=i+k;
        if(loop)j=((j%period)+period)%period;
        else j=Math.max(0,Math.min(count-1,j));
        sum+=source[j*size+c]*weights[k+radius];
      }
      out[i*size+c]=sum;
    }
    if(quaternion){
      const o=i*4,l=Math.hypot(out[o],out[o+1],out[o+2],out[o+3])||1;
      for(let c=0;c<4;c++)out[o+c]/=l;
    }
  }
  if(loop)for(let c=0;c<size;c++)out[(count-1)*size+c]=out[c];
  return track;
}

export function smoothClip(clip,options={}){
  for(const track of clip.tracks)smoothTrack(track,options);
  return clip;
}

// Ratio of second-difference to first-difference energy: high means jitter.
export function jitterRatio(clip){
  let high=0,low=0;
  for(const track of clip.tracks){
    const size=track.getValueSize(),v=track.values,count=track.times.length;
    for(let i=1;i<count-1;i++){
      let a=0,d=0;
      for(let c=0;c<size;c++){
        const p=v[(i-1)*size+c],q=v[i*size+c],r=v[(i+1)*size+c];
        a+=(p-2*q+r)**2;d+=(r-p)**2/4;
      }
      high+=Math.sqrt(a);low+=Math.sqrt(d);
    }
  }
  return high/Math.max(low,1e-9);
}
