import {cp,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const output=process.argv[2];
if(!output)throw Error('Usage: node art/linterna/workshop/build-review.mjs OUTPUT_DIR');
const dir=resolve(output);
await mkdir(dir,{recursive:true});
await cp(new URL('./materials/',import.meta.url),join(dir,'materials'),{recursive:true});
await build({entryPoints:[fileURLToPath(new URL('./review.mjs',import.meta.url))],
  bundle:true,format:'esm',target:'es2022',minify:true,outfile:join(dir,'review.js')});
await writeFile(join(dir,'index.html'),`<!doctype html>
<html lang="es">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hefesto · Taller Claymon · Revisión de arte</title>
<style>html,body{margin:0;background:#53604d;color:#fff7dc}canvas{display:block;width:100vw;height:100vh}output{position:absolute;top:16px;left:16px;font:16px system-ui}</style>
<canvas aria-label="Modelo tridimensional del Taller Claymon"></canvas>
<output role="status">Cargando el taller…</output>
<script type="module" src="./review.js"></script>
</html>
`);
