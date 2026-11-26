import {ActivityError} from './activity.mjs';

const types={html:'text/html; charset=utf-8',script:'text/javascript; charset=utf-8'};
const marker='<!-- atelier-home-context -->';
const csp="default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'";

export function atelierProjectionHandler({authority, scope, authorize}) {
  return async function atelierProjection(req,res) {
    res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});
    const unavailable=()=>res.status(404).json({error:'workspace-unavailable'});
    const position=scope(req.actor);
    if(!authority?.browserAnchor(req.actor,position))return unavailable();
    const base='/api/workspaces/'+authority.description.workspace;
    const asset=req.path==='/'?'html':req.path==='/workshop.js'?'script':null;
    const operation=asset?'projection':req.path===base?'view':req.path===base+'/selection'?'select':req.path===base+'/smooth'?'smooth':null;
    if(!operation||req.method!==(operation==='select'||operation==='smooth'?'POST':'GET'))return unavailable();
    if((operation==='select'||operation==='smooth')&&!req.actor.rights.includes('edit'))return unavailable();
    if(req.method==='POST'&&!req.is('application/json'))return res.status(415).json({error:'json-required'});
    try {
      const value=await authority.dispatch(req.actor,position,operation,asset?{asset}:req.method==='POST'?req.body:{});
      const current=await authorize(req,req.holodeckSession);
      if(!authority.browserAnchor(current,scope(current)))return unavailable();
      if(asset==='html'){
        const html=value.toString('utf8');
        if(html.split(marker).length!==2)throw Error('Atelier projection markup does not match its contract');
        return res.set({'Content-Type':types.html,'Content-Security-Policy':csp,
          'Permissions-Policy':'camera=(), microphone=(), geolocation=()'}).send(html.replace(marker,
          `<meta name="atelier-workspace" content="${authority.description.workspace}">`));
      }
      if(asset==='script')return res.set('Content-Type',types.script).send(value);
      return res.json(value);
    } catch(error) {
      if(error instanceof ActivityError){
        if(error.code==='workspace-unavailable')return unavailable();
        return res.status(error.status).json({error:error.code});
      }
      return res.status(503).json({error:'atelier-unavailable'});
    }
  };
}
