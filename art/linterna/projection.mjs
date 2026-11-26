// Typed ingredients for the existing scene/projector. The receiving operator
// selects the allowed models and compatible artwork routes.
const heights={
  atlas:1.46, bench:.91, seats:1.13, hooks:1.58,
  shelf:1.94, specimens:1.19, seat:1.13, worktable:1.05,
};

export function interiorDecoration(type,room,src) {
  if(!['atlas','archive','workshop'].includes(type)||!room||typeof src!=='string'||
     !/^\/[a-zA-Z0-9/_.-]+$/.test(src)||src.startsWith('//')||src.includes('..'))
    throw Error('Select a local allowed model for the Linterna room');
  const colliders=room.objects.map(item=>{
    const height=item.style==='bench'&&type==='atlas'?.53:heights[item.style];
    if(!height)throw Error('Unknown Linterna fixture');
    const common=`x="${item.x}" y="${height/2+.1}" z="${item.z}" height="${height}" opacity="0" cast-shadows="false"`;
    return item.shape==='circle'?`<m-cylinder ${common} radius="${item.r}"></m-cylinder>`:
      `<m-cube ${common} width="${item.w}" depth="${item.d}"></m-cube>`;
  }).join('');
  return {
    src,colliders,hideMarker:true,
    palette:{floor:'#9a7d5f',wall:'#52665b',end:'#466557'},
  };
}
