// Build renderer code only. Actual subject data/model/audience remain selected
// project content, not fixtures embedded into application source.
import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const args=process.argv.slice(2),output=args[args.indexOf('--out')+1],appearance=args[args.indexOf('--appearance')+1];
if(!args.includes('--out')||!output||!args.includes('--appearance')||!appearance)throw Error('Pass --out DIRECTORY --appearance SELECTED_ARTIFACT_STYLE_JS');
const out=resolve(output);await mkdir(out,{recursive:true});
await build({entryPoints:['src/research-viewer.mjs'],outfile:resolve(out,'research.js'),bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',external:['./review-component.js']});
await copyFile('templates/research-viewer.html',resolve(out,'index.html'));
await copyFile('templates/research-viewer.css',resolve(out,'research.css'));
await copyFile(appearance,resolve(out,'artifact-style.js'));
console.log(JSON.stringify({renderer:out,content:'Supply selected research.json and its existing model/gallery assets; no publication or identity is created.'}));
