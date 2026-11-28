import {Matrix4, Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import dimensions from '../dimensions.json' with {type:'json'};
import roomAsset from 'linterna-review-workshop-bytes';

const room = dimensions.rooms.workshop;
const half = dimensions.roomSize / 2;

export const workshopLanding = room.routes[0][0];
export const workshopReturn = [room.doors[0].x, room.doors[0].z + .54];
export const workshopView = [0, 1.146, -2];
export const workshopFloor = .1;

export const workshopDescription = `Taller de escultura de ${dimensions.roomSize} × ${dimensions.roomSize} m, con ${String(dimensions.roomHeight).replace('.', ',')} m de altura.`;

export function insideWorkshop(x, z) {
  const wallClearance = .15 + .23;
  return Math.max(Math.abs(x),Math.abs(z)) < half - wallClearance;
}

export async function loadReviewWorkshop() {
  const bytes = roomAsset.buffer.slice(roomAsset.byteOffset, roomAsset.byteOffset + roomAsset.byteLength);
  const {scene: group} = await new GLTFLoader().parseAsync(bytes, '');
  group.traverse(object => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  const height = dimensions.roomHeight;
  const obstacles = room.objects.map(({x,z,w,d}) => {
    const placement = new Matrix4().makeScale(w,height,d).setPosition(x,height/2,z);
    return {inverse: placement.invert(), half: new Vector3(w/2,height/2,d/2)};
  });
  const lights = [
    {pos: new Vector3(-3,2.65,-1.5), color: 0xffd6a8, intensity: 16, distance: 10},
    {pos: new Vector3(3,2.7,1.8), color: 0xffedce, intensity: 15, distance: 9},
  ];
  return {group, obstacles, lights};
}
