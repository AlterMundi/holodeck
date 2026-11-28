import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,realpath,writeFile} from 'node:fs/promises';
import {basename,dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {repairArchitecture,repairScene,replaceSource} from './repair-hd-source.mjs';
import {optimizeReviewArchitecture,optimizeReviewMain,optimizeReviewMaterials,optimizeReviewNature,optimizeReviewScene,stageReviewWorkshop} from './optimize-hd-review.mjs';

const [input,template,output,workshop]=process.argv.slice(2);
assert.ok(input&&template&&output,'Usage: node art/linterna/precinct/build-hd-review.mjs AUTHORIZED_HD_SRC AUTHORIZED_TEMPLATE OUTPUT_HTML [REVIEWED_WORKSHOP_GLB]');
const directory=await realpath(input), templatePath=await realpath(template);
assert.notEqual(templatePath,resolve(output),'Use a separate output path');
const workshopBytes=workshop?await readFile(workshop):null;
if(workshopBytes)assert.equal(createHash('sha256').update(workshopBytes).digest('hex'),
  'fd17011c6e2caf35c2804f353fc4ac658b88ffd4739149d0e1bf63d95225bace',
  'Use the selected full-size Claymon room');
const modules=['architecture.js','layout.js','main.js','materials.js','nature.js','scene.js','sculpture.js','statues.js','statues.data.js'];
const transforms={
  'architecture.js':data=>optimizeReviewArchitecture(repairArchitecture(data)),
  'main.js':data=>workshopBytes?stageReviewWorkshop(optimizeReviewMain(data)):optimizeReviewMain(data),
  'materials.js':optimizeReviewMaterials,
  'nature.js':optimizeReviewNature,
  'scene.js':data=>optimizeReviewScene(repairScene(data),Boolean(workshopBytes)),
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
      if(workshopBytes){
        builder.onResolve({filter:/^linterna-review-workshop$/},()=>({
          path:fileURLToPath(new URL('./review-workshop.mjs',import.meta.url)),
        }));
        builder.onResolve({filter:/^linterna-review-workshop-bytes$/},args=>({
          path:args.path,namespace:'selected-workshop',
        }));
        builder.onLoad({filter:/.*/,namespace:'selected-workshop'},()=>({contents:workshopBytes,loader:'binary'}));
      }
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
