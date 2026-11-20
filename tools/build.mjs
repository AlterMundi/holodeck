import { build } from 'esbuild';
import {ensureMmlServerAuthContext} from './mml-server-auth-context.mjs';
ensureMmlServerAuthContext({check:true});
await build({entryPoints:['src/client.mjs'],outfile:'build/client.js',bundle:true,
  format:'esm',platform:'browser',target:'es2022',minify:true,
  loader:{'.wasm':'file'},assetNames:'[name]-[hash]'});
