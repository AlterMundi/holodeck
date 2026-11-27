import { build } from 'esbuild';
import {buildMotionStudyRevision,characterPoseCatalog} from './character-pose-catalog.mjs';
import { createHash } from 'node:crypto';
import { readFile,writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { avatarModelFiles, personalAvatarFile } from '../src/human-avatars.mjs';
import {ensureMmlServerAuthContext} from './mml-server-auth-context.mjs';
ensureMmlServerAuthContext({check:true});
const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
const renderer=JSON.parse(await readFile(new URL('../package.json',import.meta.resolve('proyeccion/spatial-hud')),'utf8'));
if(renderer.version!==lock.packages['node_modules/proyeccion'].version)
  throw Error('Install the locked Proyección renderer before building Holodeck');

// The pinned MML model resource aborts its own fetch when its last handle is
// removed. Handle that specific rejection when a room is unmounted mid-load.
// Keep every other load error observable and leave the installed package intact.
// Collision-only primitives stay registered without submitting draw calls.
const modelCancellation={
  name:'mml-model-cancellation',
  setup(api){
    api.onLoad({filter:/\/@mml-io\/mml-web-threejs\/build\/index\.js$/},async ({path})=>{
      const bytes=await readFile(path);
      if(createHash('sha256').update(bytes).digest('hex')!==
        '9ccaefda3c310f42c51a54c7072fcae9d1fa377d58702ae8d23577dfe4e047f5')
        throw Error('Requalify the MML model cancellation adaptation for these dependency bytes');
      const start='    this.abortController = new AbortController();\n    _ThreeJSModelResource.getModelLoader().load(';
      const end='        modelHandle.handleLoaded(result);\n      }\n    }).finally(() => {';
      const source=bytes.toString('utf8');
      const primitiveStart=source.indexOf('// src/elements/ThreeJSCube.ts');
      const primitiveEnd=source.indexOf('// src/elements/ThreeJSDebugHelper.ts',primitiveStart);
      const primitives=source.slice(primitiveStart,primitiveEnd);
      const opacity='    this.material.opacity = opacity;';
      if(primitiveStart<0||primitiveEnd<0||primitives.split(opacity).length!==3)
        throw Error('Pinned MML collision-only primitives no longer match');
      if(source.split(start).length!==2||source.split(end).length!==2)
        throw Error('Pinned MML model resource no longer matches');
      return {loader:'js',contents:source
        .replace(primitives,primitives.replaceAll(opacity,opacity+'\n    this.material.visible = opacity > 0;'))
        .replace(start,'    const request = this.abortController = new AbortController();\n    _ThreeJSModelResource.getModelLoader().load(')
        .replace(end,`        modelHandle.handleLoaded(result);
      }
    }).catch((error) => {
      const retired = request.signal.aborted && this.modelHandles.size === 0;
      const closedFetch = error?.name === "TypeError" && error.message === "Failed to fetch";
      if (!retired || (error !== request.signal.reason &&
          error?.name !== "AbortError" && !closedFetch)) throw error;
    }).finally(() => {`)};
    });
  }
};

// Preserve the pinned character renderer and its spatial-label lifetime.
// The packaged rigs and pinned LOD can use the existing direct loader when
// optional worker-side texture processing is unavailable.
const avatarRendering={
  name:'mml-avatar-rendering',
  setup(api){
    api.onLoad({filter:/\/@mml-io\/3d-web-threejs\/build\/index\.js$/},async ({path})=>{
      const bytes=await readFile(path);
      if(createHash('sha256').update(bytes).digest('hex')!==
        '4177dd0ce868ff3b72aeb57968401a7941e7fdd613d4b53a72ddd9fcb672111c')
        throw Error('Requalify the MML avatar rendering adaptation for these dependency bytes');
      let source=bytes.toString('utf8');
      const replacements=[
        // Keep solid skins in the depth pass. The world renderer handles
        // close local avatar visibility once for the complete model.
        [`    this.transparent = true;
    this.side = this.config.originalMaterial.side;`,`    this.transparent = this.config.originalMaterial.transparent;
    this.side = this.config.originalMaterial.side;`],
        ['      this.materials.forEach((material) => material.update());',''],
        [`    this.usernameTooltip = new CharacterTooltip(
      this.config.isLocal ? {
        secondsToFadeOut: 10
      } : {}
    );
    this.usernameTooltip.setText(this.config.username);
    this.add(this.usernameTooltip);`,`    if (!this.config.isLocal) {
      this.usernameTooltip = new CharacterTooltip({playerNameplate: true});
      this.usernameTooltip.setText(this.config.username);
      this.add(this.usernameTooltip);
    }`],
        [`      this.usernameTooltip.setText(username);
      this.usernameTooltip.show();`,`      this.usernameTooltip?.setText(username);
      this.usernameTooltip?.show();`],
        [`      this.usernameTooltip.setHeightOffset(height);
      height += this.usernameTooltip.scale.y;`,`      if (this.usernameTooltip) {
        this.usernameTooltip.setHeightOffset(height);
        height += this.usernameTooltip.scale.y;
      }`],
        [`    if (this.config.isLocal) {
      this.usernameTooltip.show();
    }
`,''],
        ['    this.usernameTooltip.dispose();','    this.usernameTooltip?.dispose();'],
        ['    const { texture, width, height } = THREECanvasTextTexture(content, {',
          '    const { texture, width, height } = this.config.playerNameplate ? playerNameplate(content) : THREECanvasTextTexture(content, {'],
        [`    this.scale.x = width / (100 * fontScale);
    this.scale.y = height / (100 * fontScale);`,`    const pixelsPerMeter = this.config.playerNameplate ? 440 : 100 * fontScale;
    this.scale.x = width / pixelsPerMeter;
    this.scale.y = height / pixelsPerMeter;
    if (this.config.playerNameplate) {
      this.material.depthWrite = false;
      this.material.toneMapped = false;
    }`],
        [`    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = new Worker(GLTFLoadingWorker_default);
      worker.onmessage = this.handleWorkerMessage.bind(this);
      worker.onerror = this.handleWorkerError.bind(this);
      this.workers.push(worker);
    }`,`    if (typeof Worker !== "function" || typeof OffscreenCanvas !== "function") return;
    for (let i = 0; i < this.maxWorkers; i++) {
      let worker;
      try {
        worker = new Worker(GLTFLoadingWorker_default);
      } catch {
        break;
      }
      worker.onmessage = this.handleWorkerMessage.bind(this);
      worker.onerror = (event) => {
        event.preventDefault();
        this.retireWorker(worker);
      };
      this.workers.push(worker);
    }`],
        [`  handleWorkerError(error) {
    console.error("gLTF texture worker error:", error);
  }`,`  retireWorker(worker) {
    this.workers = this.workers.filter((entry) => entry !== worker);
    this.workerIndex = 0;
    worker.terminate();
    for (const [id, job] of this.activeJobs) {
      if (job.worker !== worker) continue;
      clearTimeout(job.timeout);
      this.activeJobs.delete(id);
      job.reject(new Error("Avatar worker unavailable"));
    }
  }`],
        ['      const worker = this.getNextWorker();',
          '      if (this.workers.length === 0) { reject(new Error("Avatar worker unavailable")); return; }\n      const worker = this.getNextWorker();'],
        [`      const timeout = setTimeout(() => {
        if (this.activeJobs.has(id)) {
          this.activeJobs.delete(id);
          reject(new Error("gLTF process timeout"));
        }
      }, 6e4);`,`      const timeout = setTimeout(() => this.retireWorker(worker),
        fallbackAvatarModel(fileUrl) ? 12000 : 60000);`],
        ['      worker.postMessage(message);',`      try {
        worker.postMessage(message);
      } catch {
        this.retireWorker(worker);
      }`],
        ['    this.workerPool = new GLTFLoadingWorkerPool();','    this.workerPool = null;'],
        ['      this.setAnimationFromFile(animationConfig.idleAnimation, AnimationState.idle, true);',
          '      const authoredIdle = this.mesh.animations.find(clip => clip.name === "hero_idle");\n      this.setAnimationFromFile(authoredIdle ?? animationConfig.idleAnimation, AnimationState.idle, true);'],
        [`      const processedBuffer = await this.processGLTFInWorker(
        fileUrl,
        maxTextureSize,
        abortController
      );
      return await this.loadFromBuffer(processedBuffer, fileUrl);`,`      if (new URL(fileUrl, document.baseURI).href === new URL(holodeckPersonalAvatar, document.baseURI).href) {
        const direct = await this.modelLoader.load(fileUrl, undefined, abortController);
        if (abortController?.signal.aborted) return null;
        direct.group.animations = direct.animations.filter(clip => clip.name === "hero_idle" || clip.name === "hero_landing");
        return direct.group;
      }
      let processedBuffer;
      try {
        processedBuffer = await this.processGLTFInWorker(fileUrl, maxTextureSize, abortController);
      } catch (error) {
        if (abortController?.signal.aborted) return null;
        if (!fallbackAvatarModel(fileUrl)) throw error;
        const direct = await this.modelLoader.load(fileUrl, undefined, abortController);
        return abortController?.signal.aborted ? null : direct.group;
      }
      return await this.loadFromBuffer(processedBuffer, fileUrl);`],
        ['      const processedBuffer = await this.workerPool.processGLTF(',
          '      this.workerPool ??= new GLTFLoadingWorkerPool();\n      const processedBuffer = await this.workerPool.processGLTF('],
        ['      antialias: true\n    });',
          '      antialias: !usesLightGraphics(window.location.search)\n    });'],
      ];
      for(const [before,after] of replacements){
        if(source.split(before).length!==2)throw Error('Pinned MML avatar source no longer matches');
        source=source.replace(before,after);
      }
      const nameplateModule=fileURLToPath(new URL('../src/player-nameplate.mjs',import.meta.url));
      const graphicsModule=fileURLToPath(new URL('../src/render-pixel-budget.mjs',import.meta.url));
      const prelude=`import { playerNameplate } from ${JSON.stringify(nameplateModule)};
import { usesLightGraphics } from ${JSON.stringify(graphicsModule)};
const holodeckPersonalAvatar = ${JSON.stringify('assets/'+personalAvatarFile)};
const holodeckAvatarFiles = new Set(${JSON.stringify(avatarModelFiles)});
function fallbackAvatarModel(fileUrl) {
  if (fileUrl === lowPolyLoDModelURL) return true;
  const assetBase = new URL("./assets/", document.baseURI);
  const url = new URL(fileUrl, document.baseURI);
  return url.href.startsWith(assetBase.href) && holodeckAvatarFiles.has(url.href.slice(assetBase.href.length));
}
`;
      return {contents:prelude+source,
        resolveDir:dirname(path)};
    });
  }
};
// Pin the code that the sampler uses. Terrain shading and other host-only
// changes stay outside the tree-shaken sampler bundle.
const browserPlugins=[modelCancellation,avatarRendering];
const sampledMotionRevision=await buildMotionStudyRevision(browserPlugins);
// Compare every published frame and chapter before aliasing a sampler build.
// Water flight and live camera steering retain all 670 Character Studio samples.
const publishedMotionRevisions=new Map([
  // Direct pilot pitch leaves all 1,340 published Studio samples identical.
  ['6ac45eed20eefab7c6c1f0b779a73ca996e56b9927ca306239deabb0043fd8f8',
    '20d0ee6c449d3a5ae48ade689ef6016fb48f93481f94fc7b2bc4e18c78d4dbb6'],
  // The vertical pole controls preserve all 1,340 Studio frames on the two rigs.
  ['21c6921cd14b127bab903709ced48d98b22a4e07f530fea1b27be74717e2ac7b',
    '20d0ee6c449d3a5ae48ade689ef6016fb48f93481f94fc7b2bc4e18c78d4dbb6'],
  // The live flight and landing controls preserve all four Studio studies on both rigs.
  ['104ba0910fc54d34209f4fdc68d738ebfbf35ecc505f9408e6a24f19ccffe5ee',
    '20d0ee6c449d3a5ae48ade689ef6016fb48f93481f94fc7b2bc4e18c78d4dbb6'],
  ['c7e2b7d5579d45e73acdd6614b6e0f5e48f23dc0444e205dd24855848a2317ab',
    '5a74c3383c834fca81920395084deff916b918e0fe31a4e9ddd7e608621ad7d4'],
  ['c99c9d2c9510df179d0c5ef80a6e09e394bf4ba9eac167b43a37b27de4d90d3c',
    '5a74c3383c834fca81920395084deff916b918e0fe31a4e9ddd7e608621ad7d4'],
  ['87fea49cf1221b573ea5583af8ed277f90e676104f0b0e79a4a197fd6ca8dfca',
    '5a74c3383c834fca81920395084deff916b918e0fe31a4e9ddd7e608621ad7d4'],
  // The baked terrain colours keep all 670 poses and chapter frames identical.
  ['74d101063cd4fb9ab74e8f4686ad73983bd7765f9c9e26f2807c8e66ad367ada',
    '5a74c3383c834fca81920395084deff916b918e0fe31a4e9ddd7e608621ad7d4'],
]);
const motionStudyRevision=publishedMotionRevisions.get(sampledMotionRevision)??sampledMotionRevision;
await build({entryPoints:['src/browser-entry.mjs'],outfile:'build/client.js',bundle:true,
  format:'esm',platform:'browser',target:'es2022',minify:true,
  plugins:browserPlugins,
  define:{HOLODECK_MOTION_STUDY_REVISION:JSON.stringify(motionStudyRevision)},
  loader:{'.wasm':'file'},assetNames:'[name]-[hash]'});
await writeFile('build/character-pose-catalog.json',JSON.stringify(await characterPoseCatalog(motionStudyRevision)));

await build({entryPoints:['src/collection-review-worker.mjs'],outfile:'build/collection-review-worker.js',
  bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});

await build({entryPoints:['src/toroidal-terrain-worker.mjs'],outfile:'build/toroidal-terrain-worker.js',
  bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
