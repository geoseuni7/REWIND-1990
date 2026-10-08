const http=require('http');const crypto=require('crypto');const fs=require('fs');const path=require('path');
const PORT=Number(process.env.PORT)||3000, TURN_MS=150*1000, DAY_BATTLE_MS=30*1000, MAX_PLAYERS=50, ROOM_TTL_MS=5*60*1000, DISCONNECT_GRACE_MS=5000, MAX_BODY_BYTES=16*1024, MAX_NAME_LENGTH=20, MAX_QTY=1e12, MAX_MONEY=Number.MAX_SAFE_INTEGER, rooms=new Map(),sessions=new Map(),rate=new Map();
const ASSETS=JSON.parse(fs.readFileSync(path.join(__dirname,'session2_assets.json'),'utf8'));
const ASSET=new Map(ASSETS.map(a=>[a.id,a]));
function hash32(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}

const HISTORY_CACHE=new Map();
const HISTORY_TTL_MS=7*24*60*60*1000;
const BUNDLED_PRICE_FILE=process.env.HISTORICAL_PRICE_FILE||path.join(__dirname,'monthly_prices.json');
let BUNDLED_PRICES={};
try{if(fs.existsSync(BUNDLED_PRICE_FILE)){const raw=JSON.parse(fs.readFileSync(BUNDLED_PRICE_FILE,'utf8'));BUNDLED_PRICES=raw&&typeof raw==='object'?(raw.prices||raw):{};}}catch(_){BUNDLED_PRICES={};}
function bundledMonthly(a){if(!a)return null;const keys=[a.id,a.ticker,a.historyTicker].filter(Boolean).map(String);for(const k of keys){const v=BUNDLED_PRICES[k];if(v&&typeof v==='object')return v.monthly||v;}return null;}
function bundledHistory(a){const m=bundledMonthly(a);return m&&Object.keys(m).length?{at:Date.now(),monthly:m,source:'Bundled historical data'}:null;}
async function fetchText(url,timeoutMs=12000){const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),timeoutMs);try{const r=await fetch(url,{signal:ctl.signal,headers:{'User-Agent':'TIME-MONEY historical-data-client/1.0'}});if(!r.ok)return null;return await r.text()}catch(_){return null}finally{clearTimeout(t)}}
function stooqSymbol(kind,ticker){
 const t=String(ticker||'').trim().toLowerCase(); if(!t)return null;
 if(kind==='over'||kind==='fund'||kind==='real') return /^[a-z0-9.\-]+$/.test(t)?(t.endsWith('.us')?t:`${t}.us`):null;
 const fut={"cl=f":"cl.f","bz=f":"brn.f","ng=f":"ng.f","gc=f":"gc.f","si=f":"si.f","hg=f":"hg.f","zc=f":"zc.f","zs=f":"zs.f","zw=f":"zw.f","6j=f":"jpy.f","6b=f":"gbp.f","6c=f":"cad.f","6s=f":"chf.f","es=f":"sp.f","nq=f":"nq.f","ym=f":"ym.f","zn=f":"zn.f","zf=f":"zf.f","zt=f":"zt.f"};
 if(fut[t])return fut[t];
 const fx=t.replace(/=x$/,'').replace(/[^a-z]/g,''); if(fx.length===6)return fx;
 return null;
}
function stooqMonthly(csv){const lines=String(csv||'').trim().split(/\r?\n/);if(lines.length<2)return {};const out={};for(let i=1;i<lines.length;i++){const cols=lines[i].split(',');if(cols.length<5)continue;const date=cols[0],close=Number(cols[4]);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(close)||close<=0)continue;const key=date.slice(0,7);out[key]=close}return out}
async function stooqHistory(a){const symbol=stooqSymbol(a?.kind,a?.historyTicker||a?.ticker);if(!symbol)return null;const url=`https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&d1=19000101&d2=20261231&i=d`;const csv=await fetchText(url);const monthly=stooqMonthly(csv);if(!Object.keys(monthly).length)return null;const first=actualFirstLast(monthly);return {at:Date.now(),monthly,source:`Stooq daily observations aggregated to month-end close (${symbol})`,verifiedDataStart:first.first,verifiedDataEnd:first.last}}
async function molitAptHistory(a, startKey, endKey){
  const key=String(process.env.MOLIT_SERVICE_KEY||'').trim();
  if(!key||a?.kind!=='real'||!a?.lawdCode)return null;
  const start=String(startKey||'2006-01'), end=String(endKey||'2026-12');
  const sYear=Number(start.slice(0,4)), sMonth=Number(start.slice(5,7));
  const eYear=Number(end.slice(0,4)), eMonth=Number(end.slice(5,7));
  if(!sYear||!eYear)return null;
  const out={};
  const from=Math.max(2006,sYear), to=Math.min(2026,eYear);
  for(let y=from;y<=to;y++){
    const m0=y===from?sMonth:1, m1=y===to?eMonth:12;
    for(let m=m0;m<=m1;m++){
      const ym=String(y)+String(m).padStart(2,'0');
      const apiPath=a.historicalKind==='molit-officetel'?'RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade':'RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade';
      const u='https://apis.data.go.kr/1613000/'+apiPath+'?serviceKey='+encodeURIComponent(key)+'&LAWD_CD='+encodeURIComponent(a.lawdCode)+'&DEAL_YMD='+ym+'&numOfRows=1000&pageNo=1&_type=json';
      const txt=await fetchText(u,15000); if(!txt)continue;
      try{
        const j=JSON.parse(txt), items=j?.response?.body?.items?.item;
        const arr=Array.isArray(items)?items:(items?[items]:[]);
        const field=a.historicalKind==='molit-officetel'?'단지명':'아파트';
        const wanted=String(a.name||'').replace(/\s+/g,'').replace(/아파트$/,'');
        const hits=arr.filter(x=>String(x[field]||'').replace(/\s+/g,'').includes(wanted));
        if(!hits.length)continue;
        const vals=hits.map(x=>Number(String(x.거래금액||'').replace(/,/g,''))).filter(v=>v>0);
        if(vals.length)out[String(y)+'-'+String(m).padStart(2,'0')]=Math.round(vals.reduce((q,v)=>q+v,0)/vals.length*10000)/10000;
      }catch(_){ }
    }
  }
  if(!Object.keys(out).length)return null;
  const meta=actualFirstLast(out);
  return {at:Date.now(),monthly:out,source:'국토교통부 '+(a.historicalKind==='molit-officetel'?'오피스텔':'아파트')+' 실거래가 API (실제 거래금액 월평균)',verifiedDataStart:meta.first,verifiedDataEnd:meta.last};
}
async function historicalMonthly(id,kind,ticker){
  const key=kind+':'+id; const hit=HISTORY_CACHE.get(key); if(hit&&hit.monthly)return hit;
  const a=ASSET.get(String(id))||{id,ticker,historyTicker:ticker,kind};
  const v=bundledHistory(a); if(v){HISTORY_CACHE.set(key,v);return v;}
  if(kind==='real'){const remote=await molitAptHistory(a,'2006-01','2026-12');if(remote){HISTORY_CACHE.set(key,remote);return remote}}
  const remote=await stooqHistory(a);if(remote){HISTORY_CACHE.set(key,remote);return remote}
  return null;
}
async function ensureAssetHistory(a){
  if(!a)return null;
  const cached=HISTORY_CACHE.get(`${a.kind}:${a.id}`);
  if(cached&&cached.monthly)return cached;
  const ticker=a.historyTicker||a.ticker||a.id;
  return await historicalMonthly(a.id,a.kind,ticker);
}
function actualFirstLast(monthly){const keys=Object.keys(monthly||{}).filter(k=>/^\d{4}-\d{2}$/.test(k)&&Number.isFinite(Number(monthly[k]))&&Number(monthly[k])>0).sort();return {first:keys[0]||null,last:keys.at(-1)||null,count:keys.length};}
function unitPrice(a,y,m){if(!a)return 0;const key=`${y}-${String(m).padStart(2,'0')}`;const h=HISTORY_CACHE.get(`${a.kind}:${a.id}`);const monthly=h?.monthly||bundledMonthly(a)||{};const v=Number(monthly[key]);return Number.isFinite(v)&&v>0?v:0}
function market(room){if(!room.marketPrices)room.marketPrices={};for(const a of ASSETS){const bundled=bundledMonthly(a);const key=`${room.year}-${String(room.month).padStart(2,'0')}`;const bp=Number(bundled?.[key]||0);const p=bp>0?bp:unitPrice(a,room.year,room.month);if(p>0)room.marketPrices[a.id]=p;else delete room.marketPrices[a.id]}return room.marketPrices}
function positionValue(p,room){let n=0;for(const [id,q] of Object.entries(p.positions||{})){const a=ASSET.get(id),price=Number(room.marketPrices?.[id]||0);if(a&&price)n+=Number(q)*price*(Number(a.multiplier)||1)}return Math.round(n)}
function netWorth(p){return Math.round((Number(p.cash)||0)+(Number(p.assetValue)||0)-(Number(p.debt)||0)-(Number(p.loan)||0)-(Number(p.loanShark)||0))}
function authoritativeNetWorth(p,room){return Math.round((Number(p.cash)||0)+positionValue(p,room)-(Number(p.loan)||0)-(Number(p.loanShark)||0))}
function authoritativeTotalAssets(p,room){return Math.round((Number(p.cash)||0)+positionValue(p,room))}
function syncAssetValue(p,room){p.assetValue=positionValue(p,room);p.debt=(Number(p.loan)||0)+(Number(p.loanShark)||0);return p.assetValue}
function liquidateHoldings(p,room,need){let raised=0;const holdings=Object.entries(p.positions||{}).map(([id,q])=>{const a=ASSET.get(id),price=Number(room.marketPrices?.[id]||0),unit=price*(Number(a?.multiplier)||1);return {id,a,q:Number(q)||0,price,unit,value:Math.max(0,(Number(q)||0)*unit)}}).filter(x=>x.q>0&&x.unit>0).sort((a,b)=>b.value-a.value);for(const h of holdings){if(raised+1e-9>=need)break;const target=Math.min(h.value,need-raised);const qty=Math.min(h.q,Math.floor((target/h.unit)*1000000)/1000000);if(!(qty>0))continue;const proceeds=qty*h.unit;p.cash+=proceeds;raised+=proceeds;h.q-=qty;p.positions[h.id]=h.q;if(h.q<=1e-9){delete p.positions[h.id];delete p.avg[h.id]}}syncAssetValue(p,room);return raised}
function privateState(room,p){syncAssetValue(p,room);return {cash:p.cash,positions:p.positions||{},avg:p.avg||{},tradeHistory:Array.isArray(p.tradeHistory)?p.tradeHistory.slice(-200):[],realizedPnl:Number(p.realizedPnl)||0,loan:p.loan||0,loanShark:p.loanShark||0,netWorth:authoritativeNetWorth(p,room),assetValue:p.assetValue,debt:p.debt}}
const DAY_ASSETS=ASSETS.filter(a=>a&&a.kind!=='real'&&a.kind!=='bonds'&&a.kind!=='gold'&&Number(a.base)>0);
function dayAsset(room){const listed=DAY_ASSETS.filter(a=>Number(room.marketPrices?.[a.id]||0)>0);return listed[crypto.randomInt(0,Math.max(1,listed.length))]||null;}
function dayEquity(p,price){return Math.max(0,(Number(p?.dayCash)||0)+(Number(p?.dayQty)||0)*(Number(price)||0));}
function dayTokens(p,price){return dayEquity(p,price);}
function dayView(room,p){const d=room.dayBattle||{},last=room.lastDayBattleResult||{};const price=Number(d.price)||0;return {active:!!d.active,assetId:d.assetId||last.assetId||null,assetName:d.assetName||last.assetName||null,unit:d.unit||last.unit||'',currentPrice:price,endAt:Number(d.deadline)||0,serverNow:Date.now(),history:Array.isArray(d.history)?d.history.slice(-180):[],myQty:Number(p?.dayQty)||0,myCost:Number(p?.dayCost)||0,myTokens:Number(p?.dayCash)||0,myCash:Number(p?.dayCash)||0,myEquity:Math.round(dayEquity(p,price)),myInitial:Number(p?.dayInitial)||100,myPct:0,myUnrealized:0,winner:d.winner||last.winner||null,loser:d.loser||last.loser||null,winnerTokens:d.winnerTokens??last.winnerTokens??null,loserTokens:d.loserTokens??last.loserTokens??null,settled:!!d.settled||!!last.settled};}
function tickDayBattle(room){if(!room.dayBattle?.active)return;const d=room.dayBattle;const p=Math.max(.000001,Number(d.price)||.000001),a=ASSET.get(d.assetId);const vol=Math.max(.004,Math.min(.035,Number(a?.vol)||.012));const next=Math.max(.000001,p*(1+((crypto.randomInt(-100,101)/10000)*Math.sqrt(vol/.012))));d.price=a?.kind==='coin'?Number(next.toFixed(6)):Math.max(.01,Math.round(next*100)/100);d.history=Array.isArray(d.history)?d.history:[];d.history.push({t:Date.now(),p:d.price});if(d.history.length>180)d.history=d.history.slice(-180);for(const pl of room.players.values())pl.dayPct=0;}
function securityHeaders(req){const h={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=()','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Resource-Policy':'same-origin','X-Permitted-Cross-Domain-Policies':'none','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};if(String(req.headers['x-forwarded-proto']||'').split(',')[0].trim()==='https'||req.socket.encrypted)h['Strict-Transport-Security']='max-age=31536000; includeSubDomains';return h}

const STATIC_MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon'};
function serveStatic(req,res,u){
  let rel=decodeURIComponent(u.pathname);
  if(rel==='/'||rel.startsWith('/api/'))return false;
  if(rel.includes('\\')||rel.includes('..')){json(res,400,{error:'잘못된 경로입니다.'},req);return true}
  const file=path.join(__dirname,rel.replace(/^\//,''));
  if(!file.startsWith(__dirname+path.sep)){json(res,400,{error:'잘못된 경로입니다.'},req);return true}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){json(res,404,{error:'not found'},req);return true}
  const ext=path.extname(file).toLowerCase(),type=STATIC_MIME[ext]||'application/octet-stream';
  res.writeHead(200,{ 'Content-Type':type, ...securityHeaders(req), 'Cache-Control': ext==='.html'?'no-store':'public, max-age=86400' });
  fs.createReadStream(file).pipe(res);return true;
}
function json(res,status,obj,req=null){const body=JSON.stringify(obj);const h={'Content-Type':'application/json; charset=utf-8',...securityHeaders(req||{headers:{},socket:{}})};res.writeHead(status,h);res.end(body)}
function ip(req){return (req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim()}
function limited(req,route='global'){const limit=route==='create'||route==='join'?12:route==='trade'||route==='loan'||route==='liquidate'||route==='daytrade'?120:route==='poll'?180:240,now=Date.now();const hit=(key,max)=>{const x=rate.get(key)||{t:now,n:0};if(now-x.t>60000){x.t=now;x.n=0}x.n++;rate.set(key,x);return x.n>max};if(hit(ip(req)+'|'+route,limit))return true;const h=String(req.headers.authorization||'');if(/^Bearer [0-9a-f]{64}$/i.test(h)&&hit('s:'+h.slice(7)+'|'+route,limit))return true;return false}
function token(){return crypto.randomBytes(32).toString('hex')}
function roomCode(){let c;do c=String(crypto.randomInt(0,1000000)).padStart(6,'0');while(rooms.has(c));return c}
function safeName(n){const v=String(n??'Player').replace(/[\u0000-\u001F\u007F]/g,' ').trim().slice(0,MAX_NAME_LENGTH);return v||'Player'}
function validRoomCode(v){return /^\d{6}$/.test(String(v||''))}
function sessionTokenFrom(req,b={}){const h=String(req.headers.authorization||'');if(/^Bearer [0-9a-f]{64}$/i.test(h))return h.slice(7);const t=String(b.sessionToken||'');return /^[0-9a-f]{64}$/i.test(t)?t:''}
function finiteNumber(v,min=-MAX_MONEY,max=MAX_MONEY){const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?n:null}
function validQty(v){const n=finiteNumber(v,0,MAX_QTY);if(n===null||n<=0)return null;return Math.floor(n*1000000)/1000000}
function netWorth(p){return Math.round((Number(p.cash)||0)+(Number(p.assetValue)||0)-(Number(p.debt)||0))}
function debtExcludedWealth(p,room){return Math.round((Number(p.cash)||0)+positionValue(p,room))}
function markAutoReadyIfBroke(room){if(!room.started||room.finished||room.dayBattle?.active)return false;let changed=false;for(const p of room.players.values()){if(!p.ready&&debtExcludedWealth(p,room)<=0){p.ready=true;p.autoReady=true;p.autoReadyReason='무부채 재산 0원 이하';changed=true}}return changed}
function markDisconnectedReady(room,now=Date.now()){if(!room.started||room.finished||room.dayBattle?.active)return false;let changed=false;for(const p of room.players.values()){if(!p.ready&&!p.left&&p.lastSeen&&now-p.lastSeen>=DISCONNECT_GRACE_MS){p.ready=true;p.autoReady=true;p.autoReadyReason='접속 끊김 자동 승인';p.disconnected=true;changed=true}}return changed}
function maybeAdvance(room){if(!room.started||room.finished||room.dayBattle?.active)return {advanced:false,finished:false};markAutoReadyIfBroke(room);markDisconnectedReady(room);if([...room.players.values()].every(x=>x.ready))return advance(room);return {advanced:false,finished:false,readyCount:[...room.players.values()].filter(x=>x.ready).length}}
function periodFor(y,m){const startMonth=((m-1)%6)+1;const startM=m-startMonth+1;const sy=y;const ey=y,em=Math.min(startM+5,12);return {start:{year:sy,month:startM},end:{year:ey,month:em}}}
function activateCountdown(room){if(room.startAt && !room.started && Date.now()>=room.startAt){room.startAt=0;startRoom(room);return true}return false}
function view(room,playerId){activateCountdown(room);for(const x of room.players.values())syncAssetValue(x,room);markAutoReadyIfBroke(room);markDisconnectedReady(room);if(room.dayBattle?.active&&Date.now()>=room.dayBattle.deadline)finishDayBattle(room);const p=playerId?room.players.get(playerId):null;const dayBattleLeaderboard=[...room.players.values()].filter(x=>!x.left).map(x=>{const equity=room.dayBattle?.active?dayEquity(x,Number(room.dayBattle.price)||0):null;const initial=Number(x.dayInitial)||100;const pct=equity===null?null:((equity/Math.max(.000001,initial))-1)*100;return {name:x.name,pct:pct===null?null:Number(pct.toFixed(2))}}).sort((a,b)=>(b.pct??-Infinity)-(a.pct??-Infinity)).map((x,i)=>({...x,rank:i+1}));return {roomCode:room.code,hostId:room.hostId,started:room.started,finished:room.finished,startAt:room.startAt||0,countdownActive:!!(room.startAt&&!room.started),year:room.year,month:room.month,turn:room.turn||0,deadline:room.deadline,turnDeadline:room.turnDeadline||room.deadline,periodStart:room.periodStart,periodEnd:room.periodEnd,playerCount:room.players.size,readyCount:[...room.players.values()].filter(x=>x.ready).length,meReady:!!p?.ready,canStart:room.players.size>=2&&room.hostId===playerId&&!room.started&&!room.finished,players:[...room.players.values()].filter(x=>!x.left).map(x=>({id:x.id,name:x.name,ready:!!x.ready,autoReady:!!x.autoReady,autoReadyReason:x.autoReadyReason||'',netWorth:authoritativeNetWorth(x,room),totalAssets:authoritativeTotalAssets(x,room)})),dayBattle:room.dayBattle||{active:false},onlineNews:room.onlineNews||null,onlineEvent:room.onlineEvent||null,dayBattleLeaderboard,leaderboard:[...room.players.values()].filter(x=>!x.left).map(x=>({name:x.name,netWorth:authoritativeNetWorth(x,room)})).sort((a,b)=>b.netWorth-a.netWorth),market:{prices:market(room)},turnPlayerId:room.turnPlayerId||null,me:p?privateState(room,p):null,dayTrade:dayView(room,p)}}
function body(req){return new Promise((resolve,reject)=>{const declared=Number(req.headers['content-length']||0);if(declared>MAX_BODY_BYTES){reject(Object.assign(new Error('payload too large'),{status:413}));return}let s='',done=false;const fail=(e)=>{if(done)return;done=true;reject(e)};req.on('data',c=>{s+=c;if(s.length>MAX_BODY_BYTES){req.destroy();fail(Object.assign(new Error('payload too large'),{status:413}))}});req.on('end',()=>{if(done)return;try{done=true;resolve(s?JSON.parse(s):{})}catch(e){fail(e)}});req.on('error',fail)})}
function auth(room,t){const s=sessions.get(t);if(!s||s.room!==room.code||s.exp<Date.now()){if(s&&s.exp<Date.now())sessions.delete(t);return null}const p=room.players.get(s.id)||null;if(p){p.lastSeen=Date.now();p.disconnected=false;if(!p.left)room.emptySince=0}return p}
function onlineTurnContent(room){
  const news=[
    ['경제','금리와 기업 실적을 둘러싼 시장의 관심이 커지고 있다.'],
    ['주식','주요 기업들의 실적 전망이 투자심리에 영향을 주고 있다.'],
    ['부동산','서울 주요 지역의 거래 흐름이 서서히 움직이고 있다.'],
    ['해외','미국 금리와 글로벌 경기 흐름이 국내 시장에 영향을 주고 있다.'],
    ['사회','소비와 고용 환경의 변화 조짐이 나타나고 있다.']
  ];
  const n=news[crypto.randomInt(0,news.length)];
  const roll=crypto.randomInt(0,100);
  let event;
  if(roll<55){
    const rate=crypto.randomInt(1,4)/100;
    event={kind:'생활',title:'예상 밖의 지출',text:`개인별 예상 밖의 지출로 순자산의 약 ${Math.round(rate*100)}%가 현금에서 빠져나갑니다.`,rate,sign:-1};
  }else if(roll<80){
    const rate=crypto.randomInt(1,4)/100;
    event={kind:'기회',title:'뜻밖의 수입',text:`특별 수입으로 순자산의 약 ${Math.round(rate*100)}%가 현금으로 추가됩니다.`,rate,sign:1};
  }else{
    const rate=crypto.randomInt(1,3)/100;
    event={kind:'시장',title:'시장 참여 보너스',text:`시장 기회를 잡은 참가자들에게 순자산의 약 ${Math.round(rate*100)}%가 현금으로 지급됩니다.`,rate,sign:1};
  }
  const nextKey=Number(room.year)*12+Number(room.month)+6;
  const ny=Math.floor((nextKey-1)/12), nm=((nextKey-1)%12)+1;
  const previewA=ASSETS[crypto.randomInt(0,Math.max(1,ASSETS.length))]||null;
  room.onlineNews={category:n[0],title:n[1],year:room.year,month:room.month,preview:`다음 회차(${ny}.${String(nm).padStart(2,'0')})에도 ${n[0]} 관련 변동이 이어질 가능성이 있습니다. 투자 판단의 참고용 예고이며 확정 신호는 아닙니다.`,forecastAccuracy:55+crypto.randomInt(0,31)};
  room.onlineEvent={...event,year:room.year,month:room.month,applied:false,preview:true,amountRule:'보유 순자산의 0.1~0.3% 수준, 최대 300,000원',previewText:event.sign<0?'다음 회차에 소액의 현금 지출이 발생할 수 있습니다. 현금을 조금 남겨두는 것이 유리합니다.':'다음 회차에 소액의 현금 유입 가능성이 있습니다. 큰 금액을 미리 움직일 필요는 없습니다.'};
}
function applyOnlineEvent(room){
  const e=room.onlineEvent;if(!e||e.applied)return;
  for(const p of room.players.values()){
    const wealth=Math.max(100000,authoritativeNetWorth(p,room));
    const rate=Number(e.rate||0);
    const amount=Math.min(300000,Math.max(50000,Math.round(wealth*rate)));
    p.cash=Math.max(0,Number(p.cash||0)+(e.sign<0?-amount:amount));
    syncAssetValue(p,room);
  }
  e.applied=true;e.appliedAt=Date.now();e.amountRule='개인별 순자산 비율 · 최소 50,000원 · 최대 300,000원';
}
function maybeDayBattle(room){room.dayBattle={active:false,startedAt:0,deadline:0,pausedMs:0};if(room.players.size<2)return;if(room.year<1993)return;if(crypto.randomInt(0,100)<15){room.lastDayBattleResult=null;const remaining=Math.max(0,(room.turnDeadline||room.deadline)-Date.now());room.turnRemainingMs=remaining;room.deadline=0;const a=dayAsset(room);if(!a)return;const marketPrice=Number(room.marketPrices?.[a.id]||unitPrice(a,room.year,room.month)||0);if(!(marketPrice>0))return;room.dayBattle={active:true,startedAt:Date.now(),deadline:Date.now()+DAY_BATTLE_MS,pausedMs:remaining,assetId:a.id,assetName:a.name,unit:a.unit||'단위',price:marketPrice,history:[{t:Date.now(),p:marketPrice}],winner:null,loser:null,settled:false};for(const p of room.players.values()){p.dayBudget=100;p.dayInitial=100;p.dayCash=100;p.dayQty=0;p.dayCost=0;p.dayPct=0;p.dayTradePnl=0;p.dayReady=false;}}}
function startRoom(room){if(room.started||room.finished||room.players.size<2)return false;room.startAt=0;room.started=true;room.year=1993;room.month=1;room.turn=0;room.periodStart={year:1993,month:1};room.periodEnd={year:1993,month:6};room.turnPlayerId=null;market(room);room.deadline=Date.now()+TURN_MS;room.turnDeadline=room.deadline;room.turnRemainingMs=TURN_MS;room.dayBattle={active:false,startedAt:0,deadline:0,pausedMs:0};onlineTurnContent(room);for(const p of room.players.values()){p.ready=false;p.autoReady=false;p.autoReadyReason='';p.disconnected=false;p.left=false;p.lastSeen=Date.now()}return true}
function advance(room){if(room.finished)return {advanced:false,finished:true};if(room.year===2026&&room.month===7){room.finished=true;room.finishedAt=Date.now();room.deadline=0;room.turnDeadline=0;room.turnRemainingMs=0;for(const p of room.players.values())p.ready=false;return {advanced:false,finished:true}}room.month+=6;if(room.month>12){room.month-=12;room.year++}if(room.year>2026||(room.year===2026&&room.month>7)){room.finished=true;room.deadline=0;room.turnDeadline=0;room.turnRemainingMs=0;for(const p of room.players.values())p.ready=false;return {advanced:false,finished:true}}room.turn=(Number(room.turn)||0)+1;room.periodStart={year:room.year,month:room.month};room.periodEnd=periodFor(room.year,room.month).end;for(const p of room.players.values()){p.ready=false;p.autoReady=false;p.autoReadyReason='';if(p.loan)p.loan=Math.round(p.loan*Math.pow(1.01,6));if(p.loanShark)p.loanShark=Math.round(p.loanShark*Math.pow(1.05,6));syncAssetValue(p,room)}// 이전 회차에 예고했던 소액 현금 이벤트를 새 회차 시작 직전에 정산한다.
// 새 회차 뉴스/이벤트는 먼저 예고하고, 그 회차 동안 준비할 시간을 준다.
applyOnlineEvent(room);
market(room);room.deadline=Date.now()+TURN_MS;room.turnDeadline=room.deadline;room.turnRemainingMs=TURN_MS;onlineTurnContent(room);maybeDayBattle(room);return {advanced:true,finished:false}}
function finishDayBattle(room){if(!room.dayBattle?.active)return;if(Date.now()<room.dayBattle.deadline)return;const active=[...room.players.values()].filter(x=>!x.left);const price=Number(room.dayBattle.price)||0;for(const p of active){if(Number(p.dayQty)>0){p.dayCash+=Number(p.dayQty)*price;p.dayQty=0;p.dayCost=0}p.dayTradePnl=Math.round(Number(p.dayCash||0)-(Number(p.dayInitial)||100));p.dayPct=0}const ranked=active.map(x=>({p:x,tokens:Math.max(0,Number(x.dayCash)||0)})).sort((a,b)=>b.tokens-a.tokens);const first=ranked[0]?.p;const firstTokens=ranked[0]?.tokens??null;const loserTokens=ranked.length>1?ranked[ranked.length-1].tokens:null;const beforeFirst=first?Math.max(0,authoritativeTotalAssets(first,room)):0;if(first)first.cash+=Math.round(beforeFirst*.5);if(first)syncAssetValue(first,room);const paused=Math.max(0,Number(room.dayBattle.pausedMs)||0);room.dayBattle={...room.dayBattle,active:false,winner:first?.name||null,loser:ranked.length>1?ranked[ranked.length-1].p.name:null,pausedMs:paused,settled:true,winnerTokens:firstTokens,loserTokens:loserTokens,settledAt:Date.now()};room.lastDayBattleResult={active:false,assetId:room.dayBattle.assetId,assetName:room.dayBattle.assetName,unit:room.dayBattle.unit,winner:room.dayBattle.winner,loser:room.dayBattle.loser,winnerTokens:firstTokens,loserTokens:loserTokens,settled:true,settledAt:room.dayBattle.settledAt};room.deadline=Date.now()+paused;room.turnDeadline=room.deadline;room.turnRemainingMs=paused;active.forEach(x=>{x.dayPct=undefined;x.dayReady=false;x.dayBudget=0;x.dayInitial=0;x.dayCash=0;x.dayQty=0;x.dayCost=0})}
function create(name){const code=roomCode();const id=crypto.randomUUID(),t=token();const room={code,hostId:id,year:1993,month:1,deadline:0,periodStart:{year:1993,month:1},periodEnd:{year:1993,month:6},started:false,finished:false,createdAt:Date.now(),finishedAt:0,players:new Map(),dayBattle:{active:false,startedAt:0,deadline:0}};rooms.set(code,room);room.players.set(id,{id,name:safeName(name),cash:100000000,assetValue:0,debt:0,positions:{},avg:{},tradeHistory:[],realizedPnl:0,loan:0,loanShark:0,ready:false,dayReady:false,lastSeen:Date.now()});sessions.set(t,{room:code,id,exp:Date.now()+86400000});return {token:t,id,code}}
async function handler(req,res){const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);const route=req.method==='GET'&&u.pathname.startsWith('/api/rooms/')?'poll':u.pathname.startsWith('/api/rooms/')?u.pathname.split('/').pop()||'rooms':u.pathname==='/api/rooms'?'create':'global';if(limited(req,route))return json(res,429,{error:'요청이 너무 많습니다. 잠시 후 다시 시도하세요.'},req);if(req.method==='GET'&&u.pathname==='/'){const h={'Content-Type':'text/html; charset=utf-8',...securityHeaders(req)};res.writeHead(200,h);return fs.createReadStream(path.join(__dirname,'index.html')).pipe(res)}
try{

if(req.method==='GET'&&u.pathname==='/api/market/assets'){
  return json(res,200,{ok:true,assets:ASSETS.map(a=>{const h=HISTORY_CACHE.get(`${a.kind}:${a.id}`);const meta=actualFirstLast(h?.monthly||{});return {...a,priceDataStatus:meta.count?'loaded':'unloaded',verifiedDataStart:meta.first||null,verifiedDataEnd:meta.last||null}})},req);
}
if(req.method==='GET'&&u.pathname==='/api/market/status'){
  const assets=ASSETS.map(a=>{const h=HISTORY_CACHE.get(`${a.kind}:${a.id}`);const meta=actualFirstLast(h?.monthly||{});return {id:a.id,name:a.name,loaded:meta.count>0,verifiedDataStart:meta.first,verifiedDataEnd:meta.last,observations:meta.count}});
  return json(res,200,{ok:true,assets},req);
}
if(req.method==='GET'&&u.pathname==='/api/market/price'){
  const id=String(u.searchParams.get('id')||'').trim(),date=String(u.searchParams.get('date')||'').trim();
  const a=ASSET.get(id); if(!a||!/^\d{4}-\d{2}$/.test(date))return json(res,400,{ok:false,error:'id/date가 잘못되었습니다.'},req);
  const h=await ensureAssetHistory(a),price=h?.monthly?.[date];
  if(!(Number(price)>0))return json(res,404,{ok:false,error:'verified price observation unavailable',assetId:id,date},req);
  const meta=actualFirstLast(h.monthly);return json(res,200,{ok:true,assetId:id,date,price:Number(price),range:meta,source:h.source},req);
}
if(req.method==='GET'&&u.pathname==='/api/market/history'){
  const id=String(u.searchParams.get('id')||'').trim(),a=ASSET.get(id);if(!a)return json(res,404,{ok:false,error:'unknown asset'},req);
  const h=await ensureAssetHistory(a);if(!h)return json(res,404,{ok:false,error:'verified history unavailable'},req);
  const start=String(u.searchParams.get('start')||'0000-00'),end=String(u.searchParams.get('end')||'9999-99');
  const rows=Object.entries(h.monthly).filter(([k])=>k>=start&&k<=end).sort(([a],[b])=>a.localeCompare(b)).map(([date,close])=>({date,close:Number(close)}));
  return json(res,200,{ok:true,assetId:id,rows,range:actualFirstLast(h.monthly),source:h.source},req);
}
if(req.method==='POST'&&u.pathname==='/api/data/sync'){
  let body={};try{body=await readJson(req)}catch(_){return json(res,400,{ok:false,error:'JSON이 잘못되었습니다.'},req)}
  const ids=Array.isArray(body.assetIds)?body.assetIds:ASSETS.map(a=>a.id); if(ids.length>5000)return json(res,400,{ok:false,error:'assetIds는 최대 5000개입니다.'},req);
  const targets=ids.map(id=>ASSET.get(String(id))).filter(Boolean), results=new Array(targets.length); let cursor=0;
  const worker=async()=>{while(true){const i=cursor++;if(i>=targets.length)return;const a=targets[i];const h=await ensureAssetHistory(a);const meta=actualFirstLast(h?.monthly||{});results[i]={id:a.id,status:meta.count?'LOADED':'ERROR',first:meta.first,last:meta.last,observations:meta.count,source:h?.source||null};}};
  await Promise.all(Array.from({length:Math.min(12,targets.length)},()=>worker()));
  const missing=ids.filter(id=>!ASSET.has(String(id))); for(const id of missing)results.push({id,status:'ERROR',error:'unknown asset'});
  return json(res,200,{ok:results.length===ids.length&&results.every(x=>x.status==='LOADED'),count:results.length,loaded:results.filter(x=>x.status==='LOADED').length,failed:results.filter(x=>x.status!=='LOADED').length,results},req);
}
if(req.method==='POST'&&u.pathname==='/api/historical/verify-all'){
  let body={};try{body=await readJson(req)}catch(_){return json(res,400,{ok:false,error:'JSON이 잘못되었습니다.'},req)}
  const list=Array.isArray(body?.assets)?body.assets:ASSETS;
  if(!list.length||list.length>5000)return json(res,400,{ok:false,error:'assets는 1~1000개여야 합니다.'},req);
  const results=list.map(a=>{const id=String(a.id||''),h=bundledHistory(a);const meta=actualFirstLast(h?.monthly||{});return {id,ticker:a.ticker||null,kind:a.kind||null,ok:meta.count>0,months:meta.count,first:meta.first,last:meta.last,source:h?.source||null}});
  return json(res,200,{ok:true,count:results.length,passed:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length,results},req)
}
if(req.method==='GET'&&u.pathname==='/api/historical'){const id=String(u.searchParams.get('id')||'').trim(),kind=String(u.searchParams.get('kind')||'').trim(),ticker=String(u.searchParams.get('ticker')||id).trim();if(!id||!kind||!ticker)return json(res,400,{error:'역사 데이터 요청값이 잘못되었습니다.'},req);const h=await historicalMonthly(id,kind,ticker);if(!h)return json(res,404,{ok:false,error:'실제 월별 데이터를 찾지 못했습니다.'},req);return json(res,200,{ok:true,id,kind,monthly:h.monthly,source:h.source},req)}
if(req.method==='POST'&&u.pathname==='/api/rooms'){const b=await body(req);if(b.name!==undefined&&typeof b.name!=='string')return json(res,400,{error:'이름이 잘못되었습니다.'},req);const r=create(b.name);return json(res,200,{roomCode:r.code,sessionToken:r.token,playerId:r.id,started:false,year:1993,month:1,deadline:0,periodStart:{year:1993,month:1},periodEnd:{year:1993,month:6}})}
if(req.method==='POST'&&u.pathname==='/api/rooms/join'){const b=await body(req);if(!validRoomCode(b.roomCode)||typeof b.name!=='string'&&b.name!==undefined)return json(res,400,{error:'방 코드 또는 이름이 잘못되었습니다.'},req);const room=rooms.get(String(b.roomCode||''));if(!room)return json(res,404,{error:'방을 찾을 수 없습니다.'});if(room.finished)return json(res,409,{error:'이미 종료된 방입니다.'});if(room.started)return json(res,409,{error:'이미 시작된 방입니다.'});if(room.players.size>=MAX_PLAYERS)return json(res,409,{error:'방이 가득 찼습니다.'});const id=crypto.randomUUID(),t=token();room.players.set(id,{id,name:safeName(b.name),cash:100000000,assetValue:0,debt:0,positions:{},avg:{},tradeHistory:[],realizedPnl:0,loan:0,loanShark:0,ready:false,dayReady:false,lastSeen:Date.now()});sessions.set(t,{room:room.code,id,exp:Date.now()+86400000});return json(res,200,{...view(room,id),sessionToken:t,playerId:id})}
if(req.method==='POST'&&u.pathname==='/api/rooms/start'){const b=await body(req),room=rooms.get(String(b.roomCode||''));if(!room)return json(res,404,{error:'방을 찾을 수 없습니다.'});const p=auth(room,sessionTokenFrom(req,b));if(!p)return json(res,401,{error:'인증 실패'});if(room.hostId!==p.id)return json(res,403,{error:'방장만 대전을 시작할 수 있습니다.'});if(room.players.size<2)return json(res,409,{error:'최소 2명이 필요합니다.'});if(room.started)return json(res,409,{error:'이미 시작된 대전입니다.'});if(!startRoom(room))return json(res,409,{error:'대전을 시작할 수 없습니다.'});return json(res,200,view(room,p.id))}
if(req.method==='POST'&&u.pathname==='/api/rooms/progress'){const b=await body(req),room=rooms.get(String(b.roomCode||''));if(!room)return json(res,404,{error:'방을 찾을 수 없습니다.'});const p=auth(room,sessionTokenFrom(req,b));if(!p)return json(res,401,{error:'인증 실패'});const pl=room.players.get(p.id);if(!pl)return json(res,401,{error:'플레이어를 찾을 수 없습니다.'});if(!room.started)return json(res,409,{error:'아직 대전이 시작되지 않았습니다.'});if(room.finished)return json(res,200,{...view(room,p.id),finished:true});markAutoReadyIfBroke(room);if(pl.ready)return json(res,200,{...view(room,p.id),alreadyReady:true});pl.ready=true;pl.autoReady=false;pl.autoReadyReason='';let result={advanced:false,finished:false};if(!room.dayBattle?.active)result=maybeAdvance(room);return json(res,200,{...view(room,p.id),...result})}
if(req.method==='POST'&&u.pathname==='/api/rooms/trade'){const b=await body(req),room=rooms.get(String(b.roomCode||''));if(!room)return json(res,404,{error:'방을 찾을 수 없습니다.'});const p=auth(room,sessionTokenFrom(req,b));if(!p)return json(res,401,{error:'인증 실패'});if(!room.started||room.finished)return json(res,409,{error:'진행 중인 대전이 아닙니다.'});const a=ASSET.get(String(b.assetId||'')),side=b.side,qty=validQty(b.qty);if(!a||!['buy','sell'].includes(side)||qty===null)return json(res,400,{error:'잘못된 거래입니다.'});const h=await ensureAssetHistory(a);
if(!h?.monthly)return json(res,409,{error:'실제 역사 가격 데이터가 없는 자산입니다.',reason:'verified historical data unavailable'});const key=`${room.year}-${String(room.month).padStart(2,'0')}`,price=Number(h?.monthly?.[key]||0);if(price>0)room.marketPrices[a.id]=price;const unit=price*(Number(a.multiplier)||1),value=qty*unit;if(!price||!Number.isFinite(value))return json(res,409,{error:'시장 가격을 확인할 수 없습니다.',reason:'verified historical monthly row missing'});const owned=Number(p.positions?.[a.id]||0);const beforeAvg=Number(p.avg?.[a.id]||0);let realized=0;if(side==='buy'){if(Number(p.cash)<value)return json(res,409,{error:'현금이 부족합니다.',shortage:true,required:value,available:Number(p.cash)||0});const old=owned,oldAvg=beforeAvg;p.cash-=value;p.positions[a.id]=old+qty;p.avg[a.id]=old?((oldAvg*old)+value)/(old+qty):value}else{if(owned<qty)return json(res,409,{error:'보유 수량이 부족합니다.'});realized=(price-beforeAvg)*qty*(Number(a.multiplier)||1);p.cash+=value;p.positions[a.id]=owned-qty;p.realizedPnl=(Number(p.realizedPnl)||0)+realized;if(!p.positions[a.id]){delete p.positions[a.id];delete p.avg[a.id]}}p.tradeHistory=Array.isArray(p.tradeHistory)?p.tradeHistory:[];p.tradeHistory.push({ts:Date.now(),date:key,assetId:a.id,side,qty,price,value,avgCost:beforeAvg,realizedPnl:realized});if(p.tradeHistory.length>200)p.tradeHistory=p.tradeHistory.slice(-200);syncAssetValue(p,room);return json(res,200,{...view(room,p.id),trade:{assetId:a.id,side,qty,value,price,realizedPnl:realized}})}
if(req.method==='POST'&&u.pathname==='/api/rooms/loan'){const b=await body(req),room=rooms.get(String(b.roomCode||''));if(!room)return json(res,404,{error:'방을 찾을 수 없습니다.'});const p=auth(room,sessionTokenFrom(req,b));if(!p)return json(res,401,{error:'인증 실패'});if(!room.started||room.finished)return json(res,409,{error:'진행 중인 대전이 아닙니다.'});const kind=b.kind==='shark'?'shark':'bank',amount=finiteNumber(b.amount,1,MAX_MONEY);if(amount===null||!Number.isInteger(amount)||amount<1)return json(res,400,{error:'대출 금액이 잘못되었습니다.'});syncAssetValue(p,room);const nw=Math.abs(authoritativeNetWorth(p,room)),max=kind==='bank'?Math.floor(nw*1.5):Math.floor(nw*4),used=kind==='bank'?Number(p.loan)||0:Number(p.loanShark)||0,v=Math.min(amount,Math.max(0,max-used));if(v<1)return json(res,409,{error:'대출 한도가 없습니다.'});if(kind==='bank')p.loan=(Number(p.loan)||0)+v;else p.loanShark=(Number(p.loanShark)||0)+v;p.cash+=v;syncAssetValue(p,room);return json(res,200,{...view(room,p.id),loaned:v,kind})}
if(req.method==='POST'&&u.pathname==='/api/rooms/liquidate'){const b=await body(req),room=rooms.get(String(b.roomCode||''));if(!room)return json(res,404,{error:'방을 찾을 수 없습니다.'});const p=auth(room,sessionTokenFrom(req,b));if(!p)return json(res,401,{error:'인증 실패'});const requested=finiteNumber(b.amount,1,MAX_MONEY),need=requested===null?0:Math.ceil(requested);if(!room.started||room.finished||need<1)return json(res,409,{error:'매도할 수 없습니다.'});let raised=0;const holdings=Object.entries(p.positions||{}).map(([id,q])=>{const a=ASSET.get(id),price=Number(room.marketPrices?.[id]||0),unit=price*(Number(a?.multiplier)||1);return {id,a,q:Number(q)||0,price,unit,value:Math.max(0,Math.round((Number(q)||0)*unit))}}).filter(x=>x.q>0&&x.price>0).sort((a,b)=>b.value-a.value);for(const h of holdings){if(raised>=need)break;const target=Math.min(h.value,need-raised);const qty=Math.min(h.q,Math.floor((target/h.unit)*1000000)/1000000);const proceeds=Math.min(h.value,qty*h.unit);p.cash+=proceeds;raised+=proceeds;p.positions[h.id]=h.q-qty;if(p.positions[h.id]<=0){delete p.positions[h.id];delete p.avg[h.id]}}syncAssetValue(p,room);if(raised<need)return json(res,409,{error:'보유 투자물을 모두 매도해도 부족 금액을 마련할 수 없습니다.',raised,required:need,shortage:true});return json(res,200,{...view(room,p.id),liquidated:raised,required:need})}
if(req.method==='POST'&&u.pathname==='/api/rooms/score'){const b=await body(req),room=rooms.get(String(b.roomCode||''));if(!room)return json(res,404,{error:'방을 찾을 수 없습니다.'},req);const p=auth(room,sessionTokenFrom(req,b));if(!p)return json(res,401,{error:'인증 실패'},req);return json(res,200,{...view(room,p.id),serverAuthoritative:true},req)}
if(req.method==='POST'&&u.pathname==='/api/rooms/daytrade'){const b=await body(req),room=rooms.get(String(b.roomCode||''));if(!room)return json(res,404,{error:'방을 찾을 수 없습니다.'});const p=auth(room,sessionTokenFrom(req,b));if(!p)return json(res,401,{error:'인증 실패'});if(!room.started||room.finished||!room.dayBattle?.active)return json(res,409,{error:'진행 중인 전체참여 단타가 없습니다.'});const pl=room.players.get(p.id);const side=b.side==='sell'?'sell':'buy',requestedQty=validQty(b.qty),price=Number(room.dayBattle.price)||0;if(requestedQty===null)return json(res,400,{error:'거래 수량이 잘못되었습니다.'});const qty=side==='buy'?Math.floor(((Number(pl.dayCash)||0)/Math.max(price,1e-12))*1000000)/1000000:Number(pl.dayQty)||0;if(Math.abs(requestedQty-qty)>Math.max(1e-9,Math.abs(qty)*1e-6))return json(res,409,{error:side==='buy'?'전액 매수만 가능합니다.':'전량 매도만 가능합니다.'});if(qty<=0)return json(res,409,{error:side==='buy'?'단타 코인이 부족합니다.':'보유 단타 수량이 없습니다.'});if(side==='buy'){const cost=price*qty;if(!Number.isFinite(cost)||cost<=0)return json(res,409,{error:'단타 거래 금액이 잘못되었습니다.'});if((Number(pl.dayCash)||0)+1e-9<cost)return json(res,409,{error:'단타 토큰이 부족합니다.',available:Number(pl.dayCash)||0,required:cost});const oldQ=Number(pl.dayQty)||0,oldCost=Number(pl.dayCost)||0;pl.dayCash-=cost;pl.dayQty=oldQ+qty;pl.dayCost=oldCost+cost}else{if((Number(pl.dayQty)||0)+1e-9<qty)return json(res,409,{error:'단타 보유수량이 부족합니다.'});const avg=(Number(pl.dayCost)||0)/(Number(pl.dayQty)||1);pl.dayCash+=price*qty;pl.dayQty-=qty;pl.dayCost=Math.max(0,avg*pl.dayQty)}return json(res,200,view(room,p.id))}
if(req.method==='POST'&&u.pathname==='/api/rooms/daybattle/score'){const b=await body(req),room=rooms.get(String(b.roomCode||''));if(!room)return json(res,404,{error:'방을 찾을 수 없습니다.'});const p=auth(room,sessionTokenFrom(req,b));if(!p)return json(res,401,{error:'인증 실패'});if(!room.dayBattle?.active)return json(res,409,{error:'진행 중인 전체참여 단타가 없습니다.'});const pl=room.players.get(p.id);return json(res,200,view(room,p.id))}
if(req.method==='POST'&&u.pathname==='/api/rooms/force-progress'){const b=await body(req),room=rooms.get(String(b.roomCode||''));if(!room)return json(res,404,{error:'방을 찾을 수 없습니다.'});const p=auth(room,sessionTokenFrom(req,b));if(!p)return json(res,401,{error:'인증 실패'});if(room.hostId!==p.id)return json(res,403,{error:'방장만 턴을 강제로 넘길 수 있습니다.'});if(!room.started||room.finished)return json(res,409,{error:'강제 진행할 수 없는 상태입니다.'});if(room.dayBattle?.active)return json(res,409,{error:'전체참여 단타가 끝난 뒤 강제 진행할 수 있습니다.'});for(const x of room.players.values()){x.ready=false;x.autoReady=false;x.autoReadyReason='';}const result=advance(room);return json(res,200,{...view(room,p.id),...result,forcedByHost:true})}
if(req.method==='POST'&&u.pathname==='/api/rooms/leave'){const b=await body(req),room=rooms.get(String(b.roomCode||''));if(!room)return json(res,404,{error:'방을 찾을 수 없습니다.'});const p=auth(room,sessionTokenFrom(req,b));if(!p)return json(res,401,{error:'인증 실패'});if(room.started&&!room.finished){p.ready=true;p.autoReady=true;p.autoReadyReason='플레이어 퇴장 자동 승인';p.left=true;p.disconnected=true;p.lastSeen=Date.now();sessions.delete(sessionTokenFrom(req,b));if(room.hostId===p.id){const next=[...room.players.values()].find(x=>x.id!==p.id&&!x.left);room.hostId=next?.id||null}const result=maybeAdvance(room);return json(res,200,{ok:true,autoReady:true,...result})}room.players.delete(p.id);sessions.delete(sessionTokenFrom(req,b));if(room.hostId===p.id){const next=room.players.values().next().value;room.hostId=next?.id||null;room.startAt=0}if(room.players.size===0)room.emptySince=Date.now();return json(res,200,{ok:true})}
if(req.method==='GET'&&u.pathname.startsWith('/api/rooms/')){const code=u.pathname.split('/').pop(),room=rooms.get(code),t=sessionTokenFrom(req,{});if(!validRoomCode(code)||!room||!auth(room,t))return json(res,401,{error:'인증 실패'});const p=auth(room,t);if(room.started&&!room.finished&&!room.dayBattle?.active&&Date.now()>=room.deadline){advance(room)}return json(res,200,view(room,p.id))}
if(req.method==='GET'&&serveStatic(req,res,u))return;
return json(res,404,{error:'not found'},req)
}catch(e){return json(res,e?.status===413?413:400,{error:e?.status===413?'요청 데이터가 너무 큽니다.':'잘못된 요청입니다.'},req)}}
function allPlayersGone(room,now){
  if(room.players.size===0)return true;
  for(const p of room.players.values()){
    if(p.left)continue;
    if(!p.lastSeen||now-p.lastSeen<DISCONNECT_GRACE_MS)return false;
  }
  return true;
}
setInterval(()=>{
  const now=Date.now();
  for(const [k,x] of rate) if(now-x.t>120000) rate.delete(k);
  for(const [t,s] of sessions) if(s.exp<now) sessions.delete(t);
  for(const [c,r] of rooms){
    if(allPlayersGone(r,now)){
      if(!r.emptySince)r.emptySince=now;
      if(now-r.emptySince>=ROOM_TTL_MS){
        for(const [t,s] of sessions) if(s.room===r.code) sessions.delete(t);
        rooms.delete(c);
        continue;
      }
    }else r.emptySince=0
    if(r.dayBattle?.active){tickDayBattle(r);finishDayBattle(r);}
    if(r.started&&!r.finished&&!r.dayBattle?.active){markAutoReadyIfBroke(r,now);markDisconnectedReady(r,now);if([...r.players.values()].every(x=>x.ready)) advance(r);else if(now>=r.deadline) advance(r)}
  }
},1000);
http.createServer(handler).listen(PORT,()=>console.log(`TIME&MONEY v6 server on ${PORT}`));
