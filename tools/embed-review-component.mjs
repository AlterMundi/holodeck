// Reuse one selected maintained Portable3D HTML renderer in the SAME sandboxed
// document. The artifact gateway intentionally disallows nested frames. This
// compiler adds a scoped DOM facade; it grants no identity/network capabilities
// and neither evaluates nor changes the selected renderer's JavaScript body.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2),input=args[args.indexOf('--review')+1],output=args[args.indexOf('--out')+1];
if(!args.includes('--review')||!input||!args.includes('--out')||!output)throw Error('Pass --review SELECTED_REVIEW_HTML --out COMPONENT_JS');
const html=await readFile(input,'utf8');
const styles=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)],scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
if(styles.length!==1||scripts.length!==1||scripts[0][1].trim()||!html.includes('data-review-version='))throw Error('Select one self-contained maintained renderer');
const style=styles[0][1].replaceAll(':root',':host').replace(/\bbody\b/g,'#review-body').replace(/100(?:d|s|l)?v[hw]/g,'100%');
const markup=html.slice(styles[0].index+styles[0][0].length,scripts[0].index);
if(/<script\b|<iframe\b|<\/html/i.test(markup))throw Error('Unsupported renderer markup');
const version=html.match(/data-review-version="([a-f0-9]{64})"/)?.[1];if(!version)throw Error('Missing review revision');
const css=':host{display:block;width:100%;height:100%;contain:layout paint style;overflow:hidden;--home-surface:var(--surface);--home-background:var(--paper);--home-text:var(--ink);--home-accent:var(--accent)}#review-body{height:100%;width:100%}'+style;
const source=`// Compiled from an explicitly selected Portable3D renderer, not remote code.\nexport async function mountReview(host){\n if(host.dataset.mounted==='true')return host.reviewController;\n const actual=globalThis.document,root=host.shadowRoot||host.attachShadow({mode:'open'});\n root.innerHTML=${JSON.stringify('<style>'+css+'</style><div id="review-body">'+markup+'</div>')};\n host.dataset.reviewVersion=${JSON.stringify(version)};\n const body=root.getElementById('review-body');\n const scoped=new Proxy(actual,{get(target,key){\n  if(key==='body')return body;if(key==='documentElement')return host;\n  if(key==='getElementById')return id=>root.getElementById(id);\n  if(key==='querySelector')return selector=>root.querySelector(selector);\n  if(key==='querySelectorAll')return selector=>root.querySelectorAll(selector);\n  if(key==='addEventListener'||key==='removeEventListener')return(type,...args)=>{const sink=['keydown','pointerdown','pointerup','pointermove','pointercancel'].includes(type)?root:target;return sink[key](type,...args);};\n  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;\n }});\n const controls=(function(document){\n${scripts[0][2]}\nreturn {redraw:draw};\n})(scoped);\n root.getElementById('modelOnly').click();\n if(root.getElementById('collapseControls').getAttribute('aria-expanded')!=='false')root.getElementById('collapseControls').click();\n root.getElementById('front').click();host.dataset.mounted='true';\n host.reviewController={version:host.dataset.reviewVersion,redraw:controls.redraw};\n await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));\n return host.reviewController;\n}\n`;
await writeFile(output,source);
console.log(JSON.stringify({rendererSha256:createHash('sha256').update(html).digest('hex'),rendererBodySha256:createHash('sha256').update(scripts[0][2]).digest('hex'),componentSha256:createHash('sha256').update(source).digest('hex'),scope:'Same-document isolated DOM/CSS; maintained JavaScript body preserved; no iframe, eval or new authority.'}));
