import assert from 'node:assert/strict';
import {mkdir,readFile,realpath,writeFile} from 'node:fs/promises';
import {basename,dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {repairArchitecture,repairScene,replaceSource} from './repair-hd-source.mjs';
import {optimizeReviewArchitecture,optimizeReviewMain,optimizeReviewMaterials,optimizeReviewNature,optimizeReviewScene} from './optimize-hd-review.mjs';

const [input,template,output]=process.argv.slice(2);
assert.ok(input&&template&&output,'Usage: node art/linterna/precinct/build-hd-review.mjs AUTHORIZED_HD_SRC AUTHORIZED_TEMPLATE OUTPUT_HTML');
const directory=await realpath(input), templatePath=await realpath(template);
assert.notEqual(templatePath,resolve(output),'Use a separate output path');
const modules=['architecture.js','layout.js','main.js','materials.js','nature.js','scene.js','sculpture.js','statues.js','statues.data.js'];
const transforms={
  'architecture.js':data=>optimizeReviewArchitecture(repairArchitecture(data)),
  'main.js':optimizeReviewMain,
  'materials.js':optimizeReviewMaterials,
  'nature.js':optimizeReviewNature,
  'scene.js':data=>optimizeReviewScene(repairScene(data)),
};
const repository=fileURLToPath(new URL('../../../',import.meta.url));
const {outputFiles}=await build({
  entryPoints:[join(directory,'main.js')],
  bundle:true,minify:true,format:'iife',target:'es2022',write:false,
  nodePaths:[join(repository,'node_modules')],
  plugins:[{
    name:'authorized-source-repairs',
    setup(builder){
      builder.onResolve({filter:/^linterna-review-budget$/},()=>({
        path:fileURLToPath(new URL('./review-render-budget.mjs',import.meta.url)),
      }));
      builder.onLoad({filter:/\.js$/},async ({path})=>{
        if(dirname(path)!==directory)return;
        const name=basename(path);
        assert.ok(modules.includes(name),'Unexpected HD review module: '+name);
        const data=await readFile(path,'utf8');
        return {contents:transforms[name]?.(data)??data};
      });
    },
  }],
});
const source=await readFile(templatePath,'utf8');
const liveLinks=source.match(/<script type="application\/json" id="sites">[^<]*<\/script>/g);
assert.equal(liveLinks?.length,1,'Expected one site-link binding in the review template');
const html=replaceSource(source,[
  [liveLinks[0],'<script type="application/json" id="sites">{}</script>'],
  ['/*__BUNDLE__*/',outputFiles[0].text.replace(/<\/script/gi,'<\\/script')],
]);
await mkdir(dirname(resolve(output)),{recursive:true});
await writeFile(output,html,{mode:0o600});
