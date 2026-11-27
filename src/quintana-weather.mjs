import {quintana} from './toroidal-solar-clock.mjs';

const current=['precipitation','weather_code','cloud_cover','wind_speed_10m','wind_direction_10m','wind_gusts_10m'];
const source=new URL('https://api.open-meteo.com/v1/forecast');
source.search=new URLSearchParams({...quintana,current:current.join(','),timezone:'UTC',timeformat:'unixtime'}).toString();
const minute=60000;

export function createQuintanaWeather({request=fetch,now=Date.now}={}){
  let sample=null,next=0,inflight;
  async function update(){
    try{
      const response=await request(source,{signal:AbortSignal.timeout(5000),redirect:'error'});
      if(!response.ok||!response.body)return;
      const reader=response.body.getReader(),decoder=new TextDecoder();
      let bytes=0,body='';
      try{
        for(;;){
          const {value,done}=await reader.read();
          if(done)break;
          bytes+=value.byteLength;
          if(bytes>8192)return;
          body+=decoder.decode(value,{stream:true});
        }
        body+=decoder.decode();
      }finally{await reader.cancel().catch(()=>{});}
      const reading=JSON.parse(body).current;
      if(!reading||![reading.time,...current.map(key=>reading[key])].every(Number.isFinite))return;
      const at=reading.time*1000;
      if(at>now()+minute||now()-at>30*minute||sample?.at>at)return;
      const {precipitation,cloud_cover:cloudCover,wind_speed_10m:windSpeed,wind_direction_10m:windDirection,
        wind_gusts_10m:windGusts,weather_code:code}=reading;
      if(precipitation<0||cloudCover<0||cloudCover>100||windSpeed<0||windGusts<0||windDirection<0||windDirection>360)return;
      sample={at,precipitation,cloudCover,windSpeed,windDirection,windGusts,storm:[95,96,99].includes(code)};
      next=now()+10*minute;
    }catch{
      // A gap clears the scene effects once the last model interval is stale.
    }
  }
  return async()=>{
    if(inflight)await inflight;
    else if(now()>=next){
      next=now()+2*minute;
      inflight=update().finally(()=>{inflight=null;});
      await inflight;
    }
    return sample&&now()-sample.at<30*minute?sample:null;
  };
}
