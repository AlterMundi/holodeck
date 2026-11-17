// Preserve JSDOM's real package resources after bundling. Server HTML Canvas is
// deliberately absent; upstream JSDOM supports this optional capability as null.
process.env.HOLODECK_JSDOM_HELPERS=new URL('./runtime/jsdom/lib/jsdom/living/helpers',import.meta.url).pathname;
process.env.HOLODECK_XHR_WORKER=new URL('./src/xhr-sync-worker.mjs',import.meta.url).pathname;
const {main}=await import('./src/server.mjs');
await main();
