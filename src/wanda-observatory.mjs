import {createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {jpegDimensions} from './rendered-view.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const hash=/^[a-f0-9]{64}$/;
const key=/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const mediaName=/^media\/[A-Za-z0-9][A-Za-z0-9._-]{0,95}\.jpg$/;

export const wandaSurfaceId='wanda-observatory';
const targets=new Set(['inspect_eyepiece','inspect_poster']);

// Live and exposing require qualified, recent events from the same WANDA
// node. A ready camera or a running session does not attest either event.
export function wandaPhase({simulated,online,exposureAgeMs,previewAgeMs,captured},maxAge=5000){
  const fresh=age=>Number.isFinite(age)&&age>=0&&age<=maxAge;
  if(simulated)return captured?'latest':'offline';
  if(!online)return 'offline';
  if(fresh(exposureAgeMs))return 'exposing';
  if(fresh(previewAgeMs))return 'live';
  return captured?'latest':'offline';
}

function readBounded(path,max){
  const stat=statSync(path);
  if(!stat.isFile()||stat.size>max)throw Error('WANDA file exceeds its selected bound');
  const bytes=readFileSync(path);
  if(bytes.length>max)throw Error('WANDA file exceeds its selected bound');
  return bytes;
}

// This reader selects WANDA's immutable fixed-night export. Deployment has
// no default source and the fixture is never a live node or a camera proxy.
export function loadWandaFixture({room,directory,manifestSha256,thumbnailSha256}){
  if(!key.test(room??'')||typeof directory!=='string'||!hash.test(manifestSha256??'')||!hash.test(thumbnailSha256??''))
    throw Error('Select an existing room and pinned WANDA fixture');
  const manifest=readBounded(join(directory,'latest.json'),16384);
  if(digest(manifest)!==manifestSha256)throw Error('WANDA observation manifest changed');
  const capture=JSON.parse(manifest),source=capture.image,orientation=capture.orientation;
  const status=JSON.parse(readBounded(join(directory,'status.json'),16384));
  const completedAt=Date.parse(capture.completed_at_utc),startedAt=Date.parse(capture.started_at_utc);
  if(capture.schema!=='wanda.observation/v1'||capture.provenance?.kind!=='simulated'||capture.state!=='completed'||
     !key.test(capture.node_id??'')||!key.test(capture.capture_id??'')||
     !Number.isFinite(startedAt)||!Number.isFinite(completedAt)||completedAt<startedAt||
     !Number.isSafeInteger(capture.exposure_us)||capture.exposure_us<=0||
     !Number.isFinite(capture.analogue_gain)||capture.analogue_gain<=0||
     status.schema!=='wanda.node-status/v1'||status.mode!=='fixture'||
     status.node_id!==capture.node_id||status.latest_capture_id!==capture.capture_id||
     orientation?.pixel_origin!=='top-left'||orientation.pixel_x!=='right'||orientation.pixel_y!=='down'||
     orientation.mirrored!==false||orientation.sky_solution!==null||
     source?.mime_type!=='image/jpeg'||!mediaName.test(source.path??'')||!hash.test(source.sha256??''))
    throw Error('WANDA fixture capture or orientation does not match the selected contract');
  const full=readBounded(join(directory,source.path),8*1024*1024);
  const size=jpegDimensions(full);
  if(full.length!==source.byte_count||digest(full)!==source.sha256||
     !size||size.width!==source.width_px||size.height!==source.height_px||!size.width||!size.height)
    throw Error('WANDA full frame does not match its capture reference');
  const thumbnail=readBounded(join(directory,'poster.jpg'),128*1024);
  const thumbSize=jpegDimensions(thumbnail);
  if(digest(thumbnail)!==thumbnailSha256||!thumbSize||!thumbSize.width||!thumbSize.height||
     thumbSize.width>=size.width||thumbSize.height>=size.height||
     thumbSize.width*size.height!==thumbSize.height*size.width)
    throw Error('WANDA poster must be a pinned smaller frame in the same aspect ratio');
  const data=Object.freeze({
    revision:manifestSha256,nodeId:capture.node_id,captureId:capture.capture_id,
    phase:wandaPhase({simulated:true,captured:true}),simulated:true,clock:capture.provenance.clock,
    capturedAt:new Date(completedAt).toISOString(),exposureUs:capture.exposure_us,
    analogueGain:capture.analogue_gain,width:size.width,height:size.height,
    orientation:Object.freeze({...orientation}),sha256:source.sha256,
  });
  const mediaKey=(variant,sha)=>'media/'+data.nodeId+'/'+data.captureId+'/'+sha+'/'+variant+'.jpg';
  const fullKey=mediaKey('full',source.sha256),posterKey=mediaKey('poster',thumbnailSha256);
  const files=new Map([['/'+fullKey,full],['/'+posterKey,thumbnail]]);
  const projection=href=>({...data,poster:href(posterKey),eyepiece:href(fullKey)});
  return Object.freeze({
    room,projection,
    media:path=>files.get(path),
    inspect(action,href){
      const ctx=action?.context;
      if(action?.surfaceId!==wandaSurfaceId||!targets.has(action.name)||!ctx||
         Object.keys(ctx).sort().join(',')!=='captureId,nodeId,revision'||
         ctx.captureId!==data.captureId||ctx.nodeId!==data.nodeId||ctx.revision!==data.revision)return null;
      const {poster,eyepiece,...reference}=projection(href);
      return {...reference,target:action.name,media:eyepiece};
    },
  });
}

// Room-local coordinates for the stock 12 m Nix trial room. Both images
// face the visitor without rotating or mirroring the recorded pixels.
export function wandaRoomArt({poster,eyepiece,width,height}){
  const w=1.68,h=w*height/width;
  return [[-1.24,'eyepiece',eyepiece,'Ocular WANDA'],[1.24,'poster',poster,'Observación fijada']].map(
    ([x,id,path,title])=>{
      const instrument=id==='eyepiece';
      const stand=instrument?`<m-cube y="${-.66-h/4}" z="-.25" width=".70" height="${1.24-h/2}" depth=".63" color="#394b50" collide="false"></m-cube>
      <m-cube y="-1.32" z="-.25" width="1.09" height=".12" depth=".79" color="#394b50" collide="false"></m-cube>`:'';
      return `<m-group id="wanda-${id}" x="${x}" y="1.48" z="${instrument?-4.85:-5.64}">
      ${stand}<m-cube z="${instrument?-.19:0}" width="${w+.14}" height="${h+.14}" depth="${instrument?.44:.065}" color="#25363b" collide="false"></m-cube>
      <m-image src="${path}" z=".038" width="${w}" height="${h}" collide="false" cast-shadows="false"></m-image>
      <m-label y="${-h/2-.19}" width="${w}" height=".24" font-size="16" content="${title}" collide="false"></m-label>
    </m-group>`;
    }).join('');
}
