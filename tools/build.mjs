import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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
await build({entryPoints:['src/client.mjs'],outfile:'build/client.js',bundle:true,
  format:'esm',platform:'browser',target:'es2022',minify:true,
  plugins:[modelCancellation],
  loader:{'.wasm':'file'},assetNames:'[name]-[hash]'});
