if(new URL(location.href).searchParams.get('taller')==='personajes'){
  const {openCharacterStudio}=await import('./character-studio.mjs');
  await openCharacterStudio(document);
}else{
  await import('./client.mjs');
}
