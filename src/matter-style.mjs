// The Blender export binds each material role to an authored surface batch.
// These rules change only that batch's visual channels.
const surfaces={
  'Orbital static diffuse':{role:'shell',channel:'color'},
  'Orbital focused material response':{role:'work-surfaces',channel:'emissive'},
};

export const matterStyles=[
  {id:'orbital',label:'Laboratorio orbital',tints:{}},
  {id:'amber',label:'Luz ámbar',tints:{shell:[1.28,.91,.52],'work-surfaces':[1.14,.90,.57]}},
];

export function bindMatterStyle(group){
  const materials=new Map();
  const bind=source=>{
    if(!source||!Object.hasOwn(surfaces,source.name))return source;
    if(!materials.has(source)){
      const {role,channel}=surfaces[source.name];
      materials.set(source,{role,channel,material:source.clone()});
    }
    return materials.get(source).material;
  };
  group.traverse(object=>{
    if(object.isMesh)
      object.material=Array.isArray(object.material)?object.material.map(bind):bind(object.material);
  });
  return {
    apply(style){
      for(const [source,{role,channel,material}] of materials){
        const tint=style.tints[role];
        const color=source[channel];
        material[channel].setRGB(tint?color.r*tint[0]:color.r,
          tint?color.g*tint[1]:color.g,tint?color.b*tint[2]:color.b);
      }
    },
    dispose(){for(const {material} of materials.values())material.dispose();},
  };
}
