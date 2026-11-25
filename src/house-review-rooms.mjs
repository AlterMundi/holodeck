// Stable room identifiers shared by the world and its character review.
export const ATELIER_FOYER = 'compaii-vestibulo';
export const CHARACTER_STUDIO = 'compaii-character-studio';

export function houseReviewRooms(rooms, house, matterId, labId) {
  const find = id => rooms.find(room => room.id === id && room.house === house);
  const foyer = find(ATELIER_FOYER);
  const matter = find(matterId);
  const lab = find(labId);
  if (!matter) throw Error('The toroidal world requires the Matter room in CompAII’s house');
  // Other toroidal receivers can still select the original single-room edition.
  if (!foyer || !lab || matter===foyer || matter===lab) return [{...matter, entry:true, links:[]}];

  const door = to => ({kind:'door', to});
  const roomsOffFoyer = [
    {...matter, title:'Materializador de Materia'},
    {...lab, title:'Harmonic Lab'},
    {...matter, id:CHARACTER_STUDIO, title:'Taller de personajes'},
  ].map(room => ({...room, entry:false, level:foyer.level, links:[door(foyer.id)]}));
  const guests = [...new Set([foyer, matter, lab].flatMap(room => room.guests))];
  if (guests.length > 16) throw Error('The house foyer exceeds the supported guest capacity');
  return [{...foyer, entry:true, guests, links:roomsOffFoyer.map(room => door(room.id))}, ...roomsOffFoyer];
}
