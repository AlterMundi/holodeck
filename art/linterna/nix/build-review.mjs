import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const [fixtureDir, outDir] = process.argv.slice(2);
if (!fixtureDir || !outDir) throw Error('Usage: node build-review.mjs FIXED_NIGHT_FOLDER OUTPUT_FOLDER');
const file = (path) => resolve(fileURLToPath(new URL('.',import.meta.url)),path);
const fixture = (path) => resolve(fixtureDir,path);
async function decode(path, sha256) {
  const bytes = await readFile(fixture(path));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),sha256);
  return JSON.parse(bytes);
}
const latest = await decode('latest.json','0ed7c094de8701a49577d04303a5ad23402820378c5811fd37744568e98a3e33');
const preview = await decode('preview.json','1f8ff6e258a9138ec41226afb36a23c2ecc655370bcba967a1406abed42c3abb');
assert.equal(latest.provenance.kind,'simulated');
assert.equal(latest.provenance.fixture_id,'fixed-night-v1');
assert.equal(latest.capture_id,'wanda-fixture-01-000002');
assert.deepEqual(latest.orientation,{mirrored:false,pixel_origin:'top-left',pixel_x:'right',pixel_y:'down',sky_solution:null});
assert.equal(preview.provenance,'simulated');
assert.equal(preview.node_id,latest.node_id);
assert.deepEqual(preview.frames.map(f=>f.offset_ms),[0,250,500]);
assert.equal(preview.duration_ms,750);

const encode = (bytes) => 'data:image/jpeg;base64,' + bytes.toString('base64');
const frames = {};
async function register(id, {sha256, path, byte_count, width_px, height_px}, offset) {
  assert.match(path,/^media\/[a-z0-9-]+\.jpg$/);
  const original = await readFile(fixture(path));
  assert.equal(original.length,byte_count);
  assert.equal(createHash('sha256').update(original).digest('hex'),sha256);
  const dimensions = execFileSync('ffprobe',['-v','error','-show_entries','stream=width,height','-of','csv=p=0',fixture(path)],{encoding:'utf8'});
  assert.equal(dimensions.trim(),'640,480');
  assert.deepEqual([width_px,height_px],[640,480]);
  const thumb = execFileSync('ffmpeg',['-nostdin','-loglevel','error','-threads','1','-filter_threads','1',
    '-i',fixture(path),'-vf','scale=240:180','-frames:v','1','-q:v','4','-f','mjpeg','pipe:1']);
  frames[id] = {sha256, original:encode(original), thumbnail:encode(thumb), offset};
}
assert.equal(latest.image.sha256,'35a68ced654fac9bfd21a160168ce1aab5ecd385b54ac4c5dba60022c1646e50');
assert.equal(preview.frames[0].image.sha256,latest.image.sha256);
await register('capture',latest.image,0);
await register('preview-02',preview.frames[1].image,250);
await register('preview-03',preview.frames[2].image,500);
const sequence = [{id:'capture',offset:0},{id:'preview-02',offset:250},{id:'preview-03',offset:500}];
const result = await build({entryPoints:[file('review.mjs')],bundle:true,minify:true,write:false,format:'esm',
  legalComments:'inline',define:{__WANDA_FIXTURE__:JSON.stringify({frames,sequence})}});
const template = await readFile(file('review-template.html'),'utf8');
const script = result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
await mkdir(outDir,{recursive:true});
const output = resolve(outDir,'Templo-de-Nix-revision.html');
await writeFile(output,template.replace('/* REVIEW_SCRIPT */',()=>script));
console.log(output);
