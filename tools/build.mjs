import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {ensureMmlServerAuthContext} from './mml-server-auth-context.mjs';
ensureMmlServerAuthContext({check:true});

// The pinned MML model resource aborts its own fetch when its last handle is
// removed. Handle that specific rejection when a room is unmounted mid-load.
// Keep every other load error observable and leave the installed package intact.
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
      if(source.split(start).length!==2||source.split(end).length!==2)
        throw Error('Pinned MML model resource no longer matches');
      return {loader:'js',contents:source
        .replace(start,'    const request = this.abortController = new AbortController();\n    _ThreeJSModelResource.getModelLoader().load(')
        .replace(end,`        modelHandle.handleLoaded(result);
      }
    }).catch((error) => {
      if (!request.signal.aborted ||
          (error !== request.signal.reason && error?.name !== "AbortError")) throw error;
    }).finally(() => {`)};
    });
  }
};

// Reuse the pinned renderer's spatial labels and their lifetime, with a
// compact player nameplate and a clear sightline above the local avatar.
const avatarLabels={
  name:'mml-avatar-labels',
  setup(api){
    api.onLoad({filter:/\/@mml-io\/3d-web-threejs\/build\/index\.js$/},async ({path})=>{
      const bytes=await readFile(path);
      if(createHash('sha256').update(bytes).digest('hex')!==
        '4177dd0ce868ff3b72aeb57968401a7941e7fdd613d4b53a72ddd9fcb672111c')
        throw Error('Requalify the MML avatar label adaptation for these dependency bytes');
      let source=bytes.toString('utf8');
      const replacements=[
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
      ];
      for(const [before,after] of replacements){
        if(source.split(before).length!==2)throw Error('Pinned MML character label source no longer matches');
        source=source.replace(before,after);
      }
      const nameplateModule=fileURLToPath(new URL('../src/player-nameplate.mjs',import.meta.url));
      return {contents:`import { playerNameplate } from ${JSON.stringify(nameplateModule)};\n`+source,
        resolveDir:dirname(path)};
    });
  }
};
await build({entryPoints:['src/client.mjs'],outfile:'build/client.js',bundle:true,
  format:'esm',platform:'browser',target:'es2022',minify:true,
  plugins:[modelCancellation,avatarLabels],
  loader:{'.wasm':'file'},assetNames:'[name]-[hash]'});
