const http=require('http'),fs=require('fs'),path=require('path');
const rooms=new Map();
const MAX_PLAYERS=50, MAX_ROOMS=1000, ROOM_TTL_MS=6*60*60*1000;
const START_ASSETS=100000000;
function send(res,code,obj){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'});res.end(JSON.stringify(obj))}
function body(req){return new Promise((ok,bad)=>{let s='';let n=0;req.on('data',c=>{n+=c.length;if(n>10000){bad(new Error('request too large'));req.destroy();return}s+=c});req.on('end',()=>{try{ok(JSON.parse(s||'{}'))}catch(e){bad(e)}})})}
function code(){let c;do{c=Math.random().toString(36).slice(2,8).toUpperCase()}while(rooms.has(c));return c}
function pid(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4)}
function cleanName(x){return String(x||'player').trim().slice(0,24).replace(/[<>]/g,'')||'player'}
function token(){return Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)+Date.now().toString(36)}
function newPlayer(name,host=false){return {playerId:pid(),reconnectToken:token(),name:cleanName(name),score:START_ASSETS,assets:START_ASSETS,cash:0,debt:0,month:0,finished:false,joinedAt:Date.now(),lastSeen:Date.now(),host:!!host}}
function migrateHost(r){const active=r.players.filter(p=>Date.now()-p.lastSeen<60000&&!p.finished);if(!active.length)return; if(!r.players.some(p=>p.host&&active.includes(p))){for(const p of r.players)p.host=false;active.sort((a,b)=>a.joinedAt-b.joinedAt)[0].host=true}}
function publicPlayer(p){return {name:p.name,score:p.score,month:p.month,finished:p.finished,joinedAt:p.joinedAt,host:!!p.host,online:Date.now()-p.lastSeen<60000}}
function roomView(r,viewerId){migrateHost(r);const viewer=r.players.find(x=>x.playerId===viewerId);if(viewer)viewer.lastSeen=Date.now();const players=r.players.map(publicPlayer);const sorted=[...r.players].sort((a,b)=>(b.score-a.score)||(b.month-a.month)||(a.joinedAt-b.joinedAt));const myRank=viewerId?sorted.findIndex(x=>x.playerId===viewerId)+1:0;return {ok:true,room:r.code,seed:r.seed,year:r.year,players,myRank,playerCount:players.length,hostPlayerId:viewer?.host?viewerId:(r.players.find(x=>x.host)||{}).playerId||null}}
function cleanup(){const now=Date.now();for(const [c,r] of rooms){if(now-r.lastActivity>ROOM_TTL_MS)rooms.delete(c)}}
setInterval(cleanup,5*60*1000).unref();
const server=http.createServer(async(req,res)=>{
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type'});return res.end()}
 try{
  if(req.url==='/health'&&req.method==='GET') return send(res,200,{ok:true,service:'rewind-1990-second-life',rooms:rooms.size,maxPlayers:MAX_PLAYERS});
  if(req.url==='/api/room/create'&&req.method==='POST'){
   if(rooms.size>=MAX_ROOMS) return send(res,503,{ok:false,error:'현재 생성된 방이 너무 많습니다.'});
   const b=await body(req),c=code(),r={code:c,seed:Math.floor(Math.random()*2147483647),year:new Date().getFullYear(),players:[],lastActivity:Date.now()};
   const p=newPlayer(b.name,true);r.players.push(p);rooms.set(c,r);return send(res,200,{ok:true,room:c,seed:r.seed,year:r.year,playerId:p.playerId,reconnectToken:p.reconnectToken,host:true,players:1});
  }
  if(req.url==='/api/room/join'&&req.method==='POST'){
   const b=await body(req),c=String(b.room||'').toUpperCase(),r=rooms.get(c);if(!r)return send(res,404,{ok:false,error:'방을 찾을 수 없습니다.'});if(r.players.length>=MAX_PLAYERS)return send(res,409,{ok:false,error:'이 방은 최대 50명입니다.'});
   r.lastActivity=Date.now();const p=newPlayer(b.name,false);r.players.push(p);return send(res,200,{ok:true,room:c,seed:r.seed,year:r.year,playerId:p.playerId,reconnectToken:p.reconnectToken,host:false,players:r.players.length});
  }
  if(req.url==='/api/room/reconnect'&&req.method==='POST'){
   const b=await body(req),c=String(b.room||'').toUpperCase(),r=rooms.get(c);if(!r)return send(res,404,{ok:false,error:'방을 찾을 수 없습니다.'});
   const p=r.players.find(x=>x.reconnectToken===String(b.reconnectToken||''));if(!p)return send(res,404,{ok:false,error:'재접속 정보를 찾을 수 없습니다.'});
   p.lastSeen=Date.now();p.name=cleanName(b.name||p.name);r.lastActivity=Date.now();migrateHost(r);
   return send(res,200,{ok:true,room:c,seed:r.seed,year:r.year,playerId:p.playerId,reconnectToken:p.reconnectToken,host:!!p.host,month:p.month,score:p.score,finished:p.finished,players:r.players.length});
  }
  if(req.url.startsWith('/api/room/')&&req.method==='GET'){
   const raw=req.url.split('/').pop();const parts=raw.split('?');const c=parts[0].toUpperCase();const q=new URLSearchParams(parts[1]||'');const viewer=String(q.get('viewer')||'');const r=rooms.get(c);if(!r)return send(res,404,{ok:false,error:'방 없음'});r.lastActivity=Date.now();return send(res,200,roomView(r,viewer));
  }
  if(req.url==='/api/room/progress'&&req.method==='POST'){
   const b=await body(req),c=String(b.room||'').toUpperCase(),r=rooms.get(c);if(!r)return send(res,404,{ok:false,error:'방 없음'});
   const p=r.players.find(x=>x.playerId===b.playerId);if(!p)return send(res,404,{ok:false,error:'참가자 없음'});
   const month=Number(b.month);if(!Number.isInteger(month)||month!==p.month+1||month<1||month>12)return send(res,409,{ok:false,error:'잘못된 월 진행입니다.',expected:p.month+1});
   // 서버 권위 계산: 클라이언트는 월 번호만 제출하고 점수/자산을 전송하지 않는다.
   const x=Math.sin((r.seed+month)*12.9898)*43758.5453;const u=x-Math.floor(x);const ret=(u-.48)*.12;
   p.assets=Math.max(0,Math.round(p.assets*(1+ret)));p.cash+=Math.round(2000000+(month*50000));p.score=Math.round(p.assets-p.debt+p.cash);p.month=month;p.finished=month===12;p.lastSeen=Date.now();p.name=cleanName(b.name);r.lastActivity=Date.now();
   return send(res,200,{...roomView(r,p.playerId),self:{score:p.score,month:p.month,finished:p.finished}});
  }
  if(req.url==='/'||req.url==='/index.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return fs.createReadStream(path.join(__dirname,'index.html')).pipe(res)}
  res.writeHead(404);res.end('Not found');
 }catch(e){if(!res.headersSent)send(res,500,{ok:false,error:e.message})}
});
server.listen(process.env.PORT||8080,()=>console.log('REWIND 1990 server on http://localhost:'+(process.env.PORT||8080)));
