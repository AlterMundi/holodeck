import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pavilions} from './plan.mjs';

const args=process.argv.slice(2);
const home=args[0]==='--home';
const [target,selection]=home?args.slice(1):args;
if (!target) throw Error('Usage: node art/linterna/precinct/build-review.mjs [--home] OUTPUT [SITES_JSON]');
const sites=selection?JSON.parse(await readFile(selection,'utf8')):{};
const roomIds=new Set(pavilions.flatMap(pavilion=>pavilion.rooms));
for (const [id,site] of Object.entries(sites)) {
  if (!roomIds.has(id)||!site||Object.keys(site).some(key=>key!=='title'&&key!=='url'))
    throw Error('Use title/url metadata for a known site room');
  if (site.title!==undefined&&(typeof site.title!=='string'||!site.title.trim()||site.title.length>45))
    throw Error('Site labels need 1–45 characters');
  if (site.url!==undefined) {
    const url=new URL(site.url);
    if (url.protocol!=='https:'||url.username||url.password)
      throw Error('Use an authorized HTTPS URL for the site');
  }
}
const {outputFiles}=await build({
  entryPoints:[fileURLToPath(new URL('./review.mjs',import.meta.url))],
  write:false,bundle:true,format:'iife',minify:true,target:'es2022',
  legalComments:'inline',
});
const template=await readFile(new URL('./review.html',import.meta.url),'utf8');
const siteData=JSON.stringify(sites).replace(/</g,'\\u003c');
if(home){
  const stylesheet=template.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  if(!stylesheet)throw Error('Missing Linterna stylesheet');
  const html=template.replace('<body>','<body data-home-entry="world">')
    .replace(/<style>[\s\S]*?<\/style>/,'<link rel="stylesheet" href="./linterna.css">')
    .replace('Este 1 · Recorrido 3D de revisión','Este 1 · Recorrido 3D')
    .replace('Desde el paseo</h2>','Templo del Mundo</h2>')
    .replace('</header>','<a class="site-link" href="https://compaii.dmn.homes/holodeck/">Volver a Holodeck</a></header>')
    .replace('%%SITES%%',()=>siteData)
    .replace('<script>%%SCRIPT%%</script>','<script defer src="./linterna.js"></script>');
  await mkdir(target,{recursive:true});
  await Promise.all([writeFile(join(target,'index.html'),html),writeFile(join(target,'linterna.css'),stylesheet),
    writeFile(join(target,'linterna.js'),outputFiles[0].text)]);
  process.exit(0);
}
const script=outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const html=template.replace('%%SITES%%',()=>siteData)
  .replace('%%SCRIPT%%',()=>script);
await writeFile(target,html);
