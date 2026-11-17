import { build } from 'esbuild';
await build({entryPoints:['src/client.mjs'],outfile:'build/client.js',bundle:true,
  format:'esm',platform:'browser',target:'es2022',minify:true,
  loader:{'.wasm':'file'},assetNames:'[name]-[hash]'});
