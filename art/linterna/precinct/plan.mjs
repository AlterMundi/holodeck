// Metres. X is east, +Z faces the approach. Pavilion coordinates are local
// to the door they describe; the render and clearances use the same plan.
export const pavilions = [
  {id: 'athena', origin: [-13.5, -12.8], turn: .85, width: 9,
    rooms: ['planning', 'reading', 'library', 'research-gallery'], roof: 'sage', icon: 'owl'},
  {id: 'hephaestus', origin: [0, -22], turn: 0, width: 8.4,
    rooms: ['atelier', 'printing'], roof: 'sage', icon: 'hammer'},
  {id: 'apollo', origin: [13.5, -12.8], turn: -.85, width: 8.4,
    rooms: ['instrument', 'movement'], roof: 'sage', icon: 'lyre'},
];

export const hall = {halfWidth: 7.4, entrance: 12.4, columns: 1.7};
export const pavilionDoor = 3.8;
export const roomPartition = -.7;
export const approachDoor = 1.46;
const foyerView = 3.12;

export function place(pavilion, x, z) {
  const sine = Math.sin(pavilion.turn), cosine = Math.cos(pavilion.turn);
  return [pavilion.origin[0] + x * cosine + z * sine,
    pavilion.origin[1] - x * sine + z * cosine];
}

export function roomCenters(pavilion) {
  return pavilion.rooms.map((id, i) => ({id, x: pavilion.width * ((i + .5) / pavilion.rooms.length - .5)}));
}

// Inner curve of the path, from Athena through Hephaestus to Apollo.
export const gardenArc = [[-9.07, -8.9], [-7.5, -12], [-5.2, -14.65],
  [-2.8, -16.45], [0, -17], [2.8, -16.45], [5.2, -14.65], [7.5, -12], [9.07, -8.9]];

export const arrivalStops = {
  promenade: {stage:'approach', point:[1.65, 6.6], target:[0, 1.25, 1.44]},
  world: {stage:'precinct', point:[0, 11.35], target:[0, 1.52, 1.7]},
  garden: {stage:'precinct', point:[0, 4.08], target:[0, 1.72, -15]},
};

export function makeStops() {
  const result = {...arrivalStops};
  for (const pavilion of pavilions) {
    result[pavilion.id] = {stage:'precinct', point:place(pavilion, 0, foyerView),
      target:targetIn(pavilion, 0, 1.72, -.62)};
    for (const room of roomCenters(pavilion)) {
      result[room.id] = {stage:'precinct', point:place(pavilion, room.x, -2.43),
        target:targetIn(pavilion, room.x, 1.43, -3.48)};
    }
  }
  return result;
}

function targetIn(pavilion, x, y, z) {
  const [worldX, worldZ] = place(pavilion, x, z);
  return [worldX, y, worldZ];
}

const branches = {
  athena: [[-3, -6.7], gardenArc[0]],
  hephaestus: [[0, -8], gardenArc[4]],
  apollo: [[3, -6.7], gardenArc.at(-1)],
};

export function makeJourneys() {
  const result = {
    world: {garden:[[2.95, 9.25], [2.95, 4.08], arrivalStops.garden.point]},
    garden: {},
  };
  for (const pavilion of pavilions) {
    const door = place(pavilion, 0, pavilionDoor);
    result.garden[pavilion.id] = [...branches[pavilion.id], door, place(pavilion, 0, foyerView)];
    result[pavilion.id] = {};
    for (const room of roomCenters(pavilion)) {
      result[pavilion.id][room.id] = [place(pavilion, room.x, 1.38),
        place(pavilion, room.x, roomPartition), place(pavilion, room.x, -2.43)];
    }
  }
  const stops = makeStops();
  for (const [from, paths] of Object.entries(result)) {
    for (const [to, points] of Object.entries(paths)) {
      result[to] ??= {};
      result[to][from] = [stops[from].point, ...points.slice(0, -1)].reverse();
    }
  }
  return result;
}
