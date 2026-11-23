import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// The artwork belongs to this exact authored house and room. Its GLB lives
// outside the ordinary asset directory and can only be read through the room.
export const COMPAII_HOUSE = 'house-0ff5a86d4833282efce28513783adb442b93b619991a13d75a536a2711df8cb9';
const BEACON_ART = readFileSync(new URL('../public/room-art/beacon-workshop.glb', import.meta.url));
const BEACON_REVISION = createHash('sha256').update(BEACON_ART).digest('hex') + '.glb';
const BEACON_STATION = Object.freeze({
  id:'beacon-prototypes',title:'Banco de prototipos',revision:1,
  position:Object.freeze({x:1.5,y:.1,z:2.75}),
  pin:Object.freeze({kind:'artifact_review',adapter:'interactive_3d',tableId:'guitar-review-935e6262',
    reviewId:'hb-guitar',revision:'published-935e6262-organic-head'}),
});
const COLLIDERS = [
  '<m-cylinder x="1.9" y=".5" z="-2.5" radius="1.42" height=".8" opacity="0" cast-shadows="false"></m-cylinder>',
  '<m-cube x="1.50" y=".54" z="2.75" ry="5.7" width="3.78" height=".88" depth=".87" opacity="0" cast-shadows="false"></m-cube>',
].join('');

export function interiorArt(room) {
  if(room?.id !== 'compaii-lab' || room.house !== COMPAII_HOUSE) return null;
  return { bytes: BEACON_ART, revision: BEACON_REVISION, colliders: COLLIDERS, station: BEACON_STATION };
}
