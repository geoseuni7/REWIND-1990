import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ServerMarketRuntime} from './src/market/ServerMarketRuntime.js';
import {TradingEngine} from './src/market/TradingEngine.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(here,'public');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
const runtime=new ServerMarketRuntime();
await runtime.hydrate();
const trading=new TradingEngine(runtime.market);

function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload));}
async function body(req){let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{};}

async function api(req,res,url){
  if(req.method==='GET' && url.pathname==='/api/market/status') return json(res,200,{ok:true,assets:runtime.status()});
  if(req.method==='GET' && url.pathname==='/api/market/assets') return json(res,200,{ok:true,assets:runtime.market.assets});
  if(req.method==='GET' && url.pathname==='/api/market/price'){
    const id=url.searchParams.get('id'),date=url.searchParams.get('date');
    const asset=runtime.market.get(id);
    if(!asset||!date) return json(res,400,{ok:false,error:'id and date are required'});
    if(!runtime.market.data.has(id)) await runtime.sync([id]);
    const price=runtime.market.price(asset,date);
    if(price==null) return json(res,404,{ok:false,error:'verified price observation unavailable',assetId:id,date});
    return json(res,200,{ok:true,assetId:id,date,price,range:runtime.market.dataRange(asset)});
  }
  if(req.method==='GET' && url.pathname==='/api/market/history'){
    const id=url.searchParams.get('id'),start=url.searchParams.get('start'),end=url.searchParams.get('end');
    const asset=runtime.market.get(id); if(!asset) return json(res,404,{ok:false,error:'unknown asset'});
    if(!runtime.market.data.has(id)) await runtime.sync([id]);
    return json(res,200,{ok:true,assetId:id,rows:runtime.market.history(asset,start,end),range:runtime.market.dataRange(asset)});
  }
  if(req.method==='POST' && url.pathname==='/api/data/sync'){
    const b=await body(req); const ids=Array.isArray(b.assetIds)?b.assetIds:null;
    const result=await runtime.sync(ids,{force:Boolean(b.force)});
    const failed=result.filter(x=>x.status==='ERROR');
    return json(res,failed.length?502:200,{ok:failed.length===0,results:result});
  }
  if(req.method==='POST' && url.pathname==='/api/game/session'){
    const b=await body(req);
    if(b.resumeId){try{return json(res,200,{ok:true,state:trading.restore(b.resumeId)});}catch{}}
    return json(res,201,{ok:true,state:trading.createSession(b.name,b.mode==='online'?'online':'general')});
  }
  if(req.method==='GET' && url.pathname==='/api/game/state'){
    const id=url.searchParams.get('session'); return json(res,200,{ok:true,state:trading.state(trading.get(id))});
  }
  if(req.method==='POST' && url.pathname==='/api/game/order'){
    const b=await body(req); try{return json(res,200,{ok:true,...trading.order(b.session,{assetId:b.assetId,side:b.side,qty:b.qty})});}catch(error){return json(res,409,{ok:false,error:error.message});}
  }
  if(req.method==='POST' && url.pathname==='/api/game/advance'){
    const b=await body(req); try{return json(res,200,{ok:true,state:trading.advance(b.session,b.months)});}catch(error){return json(res,409,{ok:false,error:error.message});}
  }
  if(req.method==='GET' && url.pathname==='/api/data/status') return json(res,200,{ok:true,assets:runtime.status()});
  return false;
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(url.pathname.startsWith('/api/')){const handled=await api(req,res,url);if(handled!==false)return;return json(res,404,{ok:false,error:'API route not found'});}
    let u=decodeURIComponent(url.pathname);if(u==='/')u='/index.html';
    const f=path.normalize(path.join(root,u));
    if(!f.startsWith(root)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end('Not found');}
    res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);
  }catch(error){console.error(error);if(!res.headersSent)json(res,500,{ok:false,error:error.message});}
});

server.listen(process.env.PORT||3000,()=>console.log(`TIME & MONEY on ${process.env.PORT||3000}`));
