import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {pavilions} from './plan.mjs';

const [target,selection]=process.argv.slice(2);
if (!target) throw Error('Usage: node art/linterna/precinct/build-review.mjs OUTPUT_HTML [SITES_JSON]');
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
const script=outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const html=template.replace('%%SITES%%',()=>JSON.stringify(sites).replace(/</g,'\\u003c'))
  .replace('%%SCRIPT%%',()=>script);
await writeFile(target,html);
