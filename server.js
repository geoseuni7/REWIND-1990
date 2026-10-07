const http=require('http');const crypto=require('crypto');const fs=require('fs');const path=require('path');
const PORT=Number(process.env.PORT)||3000, TURN_MS=150*1000, DAY_BATTLE_MS=30*1000, MAX_PLAYERS=50, ROOM_TTL_MS=5*60*1000, DISCONNECT_GRACE_MS=5000, MAX_BODY_BYTES=16*1024, MAX_NAME_LENGTH=20, MAX_QTY=1e12, MAX_MONEY=Number.MAX_SAFE_INTEGER, rooms=new Map(),sessions=new Map(),rate=new Map();
const ASSETS=JSON.parse(fs.readFileSync(path.join(__dirname,'session2_assets.json'),'utf8'));
const ASSET=new Map(ASSETS.map(a=>[a.id,a]));
function hash32(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}

const HISTORY_CACHE=new Map();
const HISTORY_TTL_MS=7*24*60*60*1000;
function yahooSymbols(id,kind,ticker){const out=[];if(ticker)out.push(ticker);else if(kind==='kr'){out.push(id+'.KS',id+'.KQ')}else if(kind==='coin'){out.push(id+'-USD')}else if(kind==='over'||kind==='fund'){out.push(id)}return [...new Set(out)];}
async function yahooMonthly(symbol,start='1990-01',end='2026-12'){
  const p1=Math.floor(new Date(start+'-01T00:00:00Z').getTime()/1000),p2=Math.floor(new Date(end+'-01T00:00:00Z').getTime()/1000)+32*86400;
  const u=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1mo&events=history&includeAdjustedClose=true`;
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);try{const r=await fetch(u,{signal:ctl.signal,headers:{'User-Agent':'TIME-MONEY/5.0'}});if(!r.ok)return null;const j=await r.json();const res=j?.chart?.result?.[0];if(!res?.timestamp||!res?.indicators?.quote?.[0]?.close)return null;const close=res.indicators.quote[0].close,monthly={};res.timestamp.forEach((ts,i)=>{const d=new Date(ts*1000),k=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`,v=Number(close[i]);if(Number.isFinite(v)&&v>0)monthly[k]=v});return Object.keys(monthly).length?monthly:null}finally{clearTimeout(timer)}}
async function historicalMonthly(id,kind,ticker){const key=`${kind}:${id}`;const hit=HISTORY_CACHE.get(key);if(hit&&Date.now()-hit.at<HISTORY_TTL_MS)return hit;for(const sym of yahooSymbols(id,kind,ticker)){try{const monthly=await yahooMonthly(sym);if(monthly){const v={at:Date.now(),monthly,source:`Yahoo Finance · ${sym} · 월말 Close`};HISTORY_CACHE.set(key,v);return v}}catch(_){} }return null}
function unitPrice(a,y,m){if(!a||y<a.year)return 0;const h=HISTORY_CACHE.get(`${a.kind}:${a.id}`);const monthly=h?.monthly||{};const key=`${y}-${String(m).padStart(2,'0')}`;if(monthly[key]!=null)return Number(monthly[key]);const keys=Object.keys(monthly).sort();if(keys.length){let prior=keys.filter(k=>k<=key).at(-1);if(prior==null)prior=keys[0];const v=Number(monthly[prior]);if(Number.isFinite(v)&&v>0)return v}return Number(a.base)||1}
function market(room){if(!room.marketPrices)room.marketPrices={};for(const a of ASSETS)if(a.year<=room.year)room.marketPrices[a.id]=unitPrice(a,room.year,room.month);return room.marketPrices}
function positionValue(p,room){let n=0;for(const [id,q] of Object.entries(p.positions||{})){const a=ASSET.get(id),price=Number(room.marketPrices?.[id]||0);if(a&&price)n+=Number(q)*price*(Number(a.multiplier)||1)}return Math.round(n)}
function netWorth(p){return Math.round((Number(p.cash)||0)+(Number(p.assetValue)||0)-(Number(p.debt)||0)-(Number(p.loan)||0)-(Number(p.loanShark)||0))}
function authoritativeNetWorth(p,room){return Math.round((Number(p.cash)||0)+positionValue(p,room)-(Number(p.loan)||0)-(Number(p.loanShark)||0))}
function authoritativeTotalAssets(p,room){return Math.round((Number(p.cash)||0)+positionValue(p,room))}
function syncAssetValue(p,room){p.assetValue=positionValue(p,room);p.debt=(Number(p.loan)||0)+(Number(p.loanShark)||0);return p.assetValue}
function liquidateHoldings(p,room,need){let raised=0;const holdings=Object.entries(p.positions||{}).map(([id,q])=>{const a=ASSET.get(id),price=Number(room.marketPrices?.[id]||0),unit=price*(Number(a?.multiplier)||1);return {id,a,q:Number(q)||0,price,unit,value:Math.max(0,(Number(q)||0)*unit)}}).filter(x=>x.q>0&&x.unit>0).sort((a,b)=>b.value-a.value);for(const h of holdings){if(raised+1e-9>=need)break;const target=Math.min(h.value,need-raised);const qty=Math.min(h.q,Math.floor((target/h.unit)*1000000)/1000000);if(!(qty>0))continue;const proceeds=qty*h.unit;p.cash+=proceeds;raised+=proceeds;h.q-=qty;p.positions[h.id]=h.q;if(h.q<=1e-9){delete p.positions[h.id];delete p.avg[h.id]}}syncAssetValue(p,room);return raised}
function privateState(room,p){syncAssetValue(p,room);return {cash:p.cash,positions:p.positions||{},avg:p.avg||{},loan:p.loan||0,loanShark:p.loanShark||0,netWorth:authoritativeNetWorth(p,room),assetValue:p.assetValue,debt:p.debt}}
const DAY_ASSETS=ASSETS.filter(a=>a&&a.kind!=='real'&&a.kind!=='bonds'&&a.kind!=='gold'&&Number(a.base)>0);
function dayAsset(room){const listed=DAY_ASSETS.filter(a=>Number(a.year||1990)<=Number(room.year||1990));return listed[crypto.randomInt(0,Math.max(1,listed.length))]||DAY_ASSETS[0];}
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
  // 온라인 뉴스는 단순한 "시장 평가"가 아니라 실제 기사처럼
  // 제목 + 본문 + 다음 회차 예고로 구성한다. 게임 자산 가격을 직접
  // 결정하지 않고 투자 판단을 위한 정보/힌트 역할만 한다.
  const y=Number(room.year)||1990;
  const pools={
    경제:[
      ['금리 인하 기대감, 기업 투자심리 회복 조짐','시장에서는 경기 회복과 자금조달 여건 개선에 대한 기대가 커지고 있다. 기업들의 투자 계획에도 변화가 나타날 수 있다는 전망이 나온다.','경제 전반의 위험선호가 조금씩 회복될 가능성이 있습니다.'],
      ['물가 안정세 이어지나…소비심리 변화 주목','물가 흐름이 안정되는 가운데 소비와 기업 비용에 대한 시장의 관심이 높아지고 있다. 전문가들은 향후 몇 달간 내수와 기업 실적을 함께 살펴볼 필요가 있다고 분석했다.','내수·소비 관련 자산의 흐름을 지켜볼 필요가 있습니다.'],
      ['경기 둔화 우려 확산…기업 실적 전망 엇갈려','주요 지표를 둘러싼 경기 둔화 우려가 커지는 가운데 업종별 실적 전망은 엇갈리고 있다. 시장은 다음 경제지표 발표를 주목하고 있다.','위험자산 변동성이 커질 가능성이 있습니다.']
    ],
    주식:[
      ['기업 실적 전망 엇갈려…업종별 주가 차별화','기업들의 실적 전망이 엇갈리면서 같은 시장 안에서도 업종별 주가 흐름이 달라질 수 있다는 분석이 나온다. 투자자들은 실적과 수급 변화를 함께 살피는 분위기다.','보유 종목의 업종별 민감도를 확인해 두는 것이 좋습니다.'],
      ['외국인·기관 수급 변화에 증시 촉각','주요 종목을 중심으로 투자 주체들의 매매 방향이 바뀌면서 단기 주가 변동성에 대한 경계감이 높아지고 있다.','대형주 중심의 수급 변화가 이어질 가능성이 있습니다.'],
      ['신성장 산업 투자 확대 기대…관련주 관심','기업과 투자자들이 새로운 성장 산업에 대한 투자 확대 가능성을 주목하고 있다. 다만 기대감이 실제 실적으로 이어질지는 지켜봐야 한다는 의견도 나온다.','관련 자산에 기대감이 먼저 반영될 수 있습니다.']
    ],
    부동산:[
      ['주택 거래량 변화 조짐…서울 시장 향방 주목','서울 주요 지역의 거래 문의와 거래량에 변화가 나타나면서 주택시장 방향에 관심이 쏠리고 있다. 금리와 대출 여건이 향후 시장의 중요한 변수로 꼽힌다.','부동산 관련 자산의 변동성을 주의해서 볼 필요가 있습니다.'],
      ['부동산 금융 여건 변화 가능성…시장 긴장','대출과 금융 여건을 둘러싼 변화 가능성이 거론되면서 부동산 투자자들의 관망세가 이어지고 있다.','부동산 자산의 단기 변동 가능성이 커질 수 있습니다.']
    ],
    해외:[
      ['글로벌 경기 전망 엇갈려…해외 증시 변동성 확대','주요국 경기와 금리 전망이 엇갈리면서 해외 증시의 방향을 두고 의견이 나뉘고 있다. 글로벌 투자자들은 다음 경제지표와 기업 실적을 주시하고 있다.','해외 위험자산의 변동성이 확대될 가능성이 있습니다.'],
      ['미국 금리 전망 변화에 글로벌 자금 이동 주목','미국의 통화정책 전망이 바뀔 수 있다는 관측 속에 글로벌 자금 흐름도 영향을 받을 수 있다는 분석이 나온다.','해외주식과 채권 가격의 방향을 함께 살펴보는 것이 좋습니다.']
    ],
    원자재:[
      ['원자재 가격 변동 확대…공급 상황에 시장 촉각','주요 원자재의 공급과 수요 전망이 엇갈리면서 국제 가격의 변동성이 커지고 있다. 제조업 비용과 물가에도 영향을 줄 수 있다는 분석이다.','금·원자재 가격의 단기 변동에 주의할 필요가 있습니다.']
    ],
    사회:[
      ['소비·고용 지표 변화에 시장 관심','가계 소비와 고용 환경의 변화 조짐이 나타나면서 내수 경기 전망에도 관심이 높아지고 있다. 시장은 향후 발표될 지표를 주목하고 있다.','소비 관련 기업과 내수 자산의 흐름을 살펴볼 필요가 있습니다.']
    ]
  };
  // 시대감은 유지하되 특정 역사 사건을 현재 시점의 확정 사실처럼 단정하지 않는다.
  const keys=Object.keys(pools);
  const category=keys[crypto.randomInt(0,keys.length)];
  const item=pools[category][crypto.randomInt(0,pools[category].length)];
  const nextKey=y*12+Number(room.month)+6;
  const ny=Math.floor((nextKey-1)/12),nm=((nextKey-1)%12)+1;
  const accuracy=55+crypto.randomInt(0,31);
  const news={category,title:item[0],text:item[1],preview:item[2],year:y,month:Number(room.month),
    nextYear:ny,nextMonth:nm,forecastAccuracy:accuracy,
    article:`${y}년 ${Number(room.month)}월 시장에서 ${item[0].replace(/[.…]+$/,'')}이라는 소식이 전해졌습니다. ${item[1]}`};
  const roll=crypto.randomInt(0,100);
  let event;
  if(roll<55){
    const rate=crypto.randomInt(1,4)/100;
    event={kind:'생활',title:'예상 밖의 생활비 증가 가능성',text:`다음 회차에 개인별 소액 지출이 발생할 가능성이 있다는 소식입니다. 현금을 조금 남겨두는 것이 유리합니다.`,rate,sign:-1};
  }else if(roll<80){
    const rate=crypto.randomInt(1,4)/100;
    event={kind:'기회',title:'소액의 추가 수입 기회',text:`다음 회차에 개인별 소액 현금 유입이 발생할 가능성이 있습니다. 큰 금액을 미리 움직일 필요는 없습니다.`,rate,sign:1};
  }else{
    const rate=crypto.randomInt(1,3)/100;
    event={kind:'시장',title:'투자 관련 소액 지원 소식',text:`다음 회차에 시장 참여자에게 소액 현금 보너스가 발생할 가능성이 있습니다.`,rate,sign:1};
  }
  room.onlineNews=news;
  room.onlineEvent={...event,year:y,month:Number(room.month),applied:false,preview:true,amountRule:'개인별 소액 조정 · 최소 50,000원 · 최대 300,000원',previewText:event.text};
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
function maybeDayBattle(room){room.dayBattle={active:false,startedAt:0,deadline:0,pausedMs:0};if(room.players.size<2)return;if(room.year===1990&&room.month===1)return;if(crypto.randomInt(0,100)<15){room.lastDayBattleResult=null;const remaining=Math.max(0,(room.turnDeadline||room.deadline)-Date.now());room.turnRemainingMs=remaining;room.deadline=0;const a=dayAsset(room);const marketPrice=Number(room.marketPrices?.[a.id]||unitPrice(a,room.year,room.month)||a.base||1);room.dayBattle={active:true,startedAt:Date.now(),deadline:Date.now()+DAY_BATTLE_MS,pausedMs:remaining,assetId:a.id,assetName:a.name,unit:a.unit||'단위',price:marketPrice,history:[{t:Date.now(),p:marketPrice}],winner:null,loser:null,settled:false};for(const p of room.players.values()){p.dayBudget=100;p.dayInitial=100;p.dayCash=100;p.dayQty=0;p.dayCost=0;p.dayPct=0;p.dayTradePnl=0;p.dayReady=false;}}}
function startRoom(room){if(room.started||room.finished||room.players.size<2)return false;room.startAt=0;room.started=true;room.year=1990;room.month=1;room.turn=0;room.periodStart={year:1990,month:1};room.periodEnd={year:1990,month:6};room.turnPlayerId=null;market(room);room.deadline=Date.now()+TURN_MS;room.turnDeadline=room.deadline;room.turnRemainingMs=TURN_MS;room.dayBattle={active:false,startedAt:0,deadline:0,pausedMs:0};for(const p of room.players.values()){p.ready=false;p.autoReady=false;p.autoReadyReason='';p.disconnected=false;p.left=false;p.lastSeen=Date.now()}return true}
function advance(room){if(room.finished)return {advanced:false,finished:true};if(room.year===2026&&room.month===7){room.finished=true;room.finishedAt=Date.now();room.deadline=0;room.turnDeadline=0;room.turnRemainingMs=0;for(const p of room.players.values())p.ready=false;return {advanced:false,finished:true}}room.month+=6;if(room.month>12){room.month-=12;room.year++}if(room.year>2026||(room.year===2026&&room.month>7)){room.finished=true;room.deadline=0;room.turnDeadline=0;room.turnRemainingMs=0;for(const p of room.players.values())p.ready=false;return {advanced:false,finished:true}}room.turn=(Number(room.turn)||0)+1;room.periodStart={year:room.year,month:room.month};room.periodEnd=periodFor(room.year,room.month).end;for(const p of room.players.values()){p.ready=false;p.autoReady=false;p.autoReadyReason='';if(p.loan)p.loan=Math.round(p.loan*Math.pow(1.01,6));if(p.loanShark)p.loanShark=Math.round(p.loanShark*Math.pow(1.05,6));syncAssetValue(p,room)}// 이전 회차에 예고했던 소액 현금 이벤트를 새 회차 시작 직전에 정산한다.
// 새 회차 뉴스/이벤트는 먼저 예고하고, 그 회차 동안 준비할 시간을 준다.
applyOnlineEvent(room);
market(room);room.deadline=Date.now()+TURN_MS;room.turnDeadline=room.deadline;room.turnRemainingMs=TURN_MS;onlineTurnContent(room);maybeDayBattle(room);return {advanced:true,finished:false}}
function finishDayBattle(room){if(!room.dayBattle?.active)return;if(Date.now()<room.dayBattle.deadline)return;const active=[...room.players.values()].filter(x=>!x.left);const price=Number(room.dayBattle.price)||0;for(const p of active){if(Number(p.dayQty)>0){p.dayCash+=Number(p.dayQty)*price;p.dayQty=0;p.dayCost=0}p.dayTradePnl=Math.round(Number(p.dayCash||0)-(Number(p.dayInitial)||100));p.dayPct=0}const ranked=active.map(x=>({p:x,tokens:Math.max(0,Number(x.dayCash)||0)})).sort((a,b)=>b.tokens-a.tokens);const first=ranked[0]?.p;const firstTokens=ranked[0]?.tokens??null;const loserTokens=ranked.length>1?ranked[ranked.length-1].tokens:null;const beforeFirst=first?Math.max(0,authoritativeTotalAssets(first,room)):0;if(first)first.cash+=Math.round(beforeFirst*.5);if(first)syncAssetValue(first,room);const paused=Math.max(0,Number(room.dayBattle.pausedMs)||0);room.dayBattle={...room.dayBattle,active:false,winner:first?.name||null,loser:ranked.length>1?ranked[ranked.length-1].p.name:null,pausedMs:paused,settled:true,winnerTokens:firstTokens,loserTokens:loserTokens,settledAt:Date.now()};room.lastDayBattleResult={active:false,assetId:room.dayBattle.assetId,assetName:room.dayBattle.assetName,unit:room.dayBattle.unit,winner:room.dayBattle.winner,loser:room.dayBattle.loser,winnerTokens:firstTokens,loserTokens:loserTokens,settled:true,settledAt:room.dayBattle.settledAt};room.deadline=Date.now()+paused;room.turnDeadline=room.deadline;room.turnRemainingMs=paused;active.forEach(x=>{x.dayPct=undefined;x.dayReady=false;x.dayBudget=0;x.dayInitial=0;x.dayCash=0;x.dayQty=0;x.dayCost=0})}
function create(name){const code=roomCode();const id=crypto.randomUUID(),t=token();const room={code,hostId:id,year:1990,month:1,deadline:0,periodStart:{year:1990,month:1},periodEnd:{year:1990,month:6},started:false,finished:false,createdAt:Date.now(),finishedAt:0,players:new Map(),dayBattle:{active:false,startedAt:0,deadline:0}};rooms.set(code,room);room.players.set(id,{id,name:safeName(name),cash:100000000,assetValue:0,debt:0,positions:{},avg:{},loan:0,loanShark:0,ready:false,dayReady:false,lastSeen:Date.now()});sessions.set(t,{room:code,id,exp:Date.now()+86400000});return {token:t,id,code}}
async function handler(req,res){const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);const route=req.method==='GET'&&u.pathname.startsWith('/api/rooms/')?'poll':u.pathname.startsWith('/api/rooms/')?u.pathname.split('/').pop()||'rooms':u.pathname==='/api/rooms'?'create':'global';if(limited(req,route))return json(res,429,{error:'요청이 너무 많습니다. 잠시 후 다시 시도하세요.'},req);if(req.method==='GET'&&u.pathname==='/'){const h={'Content-Type':'text/html; charset=utf-8',...securityHeaders(req)};res.writeHead(200,h);return fs.createReadStream(path.join(__dirname,'index.html')).pipe(res)}
try{

if(req.method==='POST'&&u.pathname==='/api/historical/verify-all'){
  let body={};try{body=await readJson(req)}catch(_){return json(res,400,{ok:false,error:'JSON이 잘못되었습니다.'},req)}
  const list=Array.isArray(body?.assets)?body.assets:[];
  if(!list.length||list.length>1000)return json(res,400,{ok:false,error:'assets는 1~1000개여야 합니다.'},req);
  const results=[];
  for(const a of list){
    const id=String(a.id||'').trim(), ticker=String(a.ticker||'').trim(), kind=String(a.kind||'fund').trim();
    if(!id||!ticker){results.push({id,ticker,ok:false,error:'id/ticker missing'});continue}
    let monthly=null;try{monthly=await yahooMonthly(ticker)}catch(_){monthly=null}
    results.push({id,ticker,kind,ok:!!monthly,months:monthly?Object.keys(monthly).length:0,first:monthly?Object.keys(monthly).sort()[0]:null,last:monthly?Object.keys(monthly).sort().at(-1):null});
  }
  return json(res,200,{ok:true,count:results.length,passed:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length,results},req)
}
if(req.method==='GET'&&u.pathname==='/api/historical'){const id=String(u.searchParams.get('id')||'').trim(),kind=String(u.searchParams.get('kind')||'').trim(),ticker=String(u.searchParams.get('ticker')||id).trim();if(!id||!kind||!ticker)return json(res,400,{error:'역사 데이터 요청값이 잘못되었습니다.'},req);const h=await historicalMonthly(id,kind,ticker);if(!h)return json(res,404,{ok:false,error:'실제 월별 데이터를 찾지 못했습니다.'},req);return json(res,200,{ok:true,id,kind,monthly:h.monthly,source:h.source},req)}
if(req.method==='POST'&&u.pathname==='/api/rooms'){const b=await body(req);if(b.name!==undefined&&typeof b.name!=='string')return json(res,400,{error:'이름이 잘못되었습니다.'},req);const r=create(b.name);return json(res,200,{roomCode:r.code,sessionToken:r.token,playerId:r.id,started:false,year:1990,month:1,deadline:0,periodStart:{year:1990,month:1},periodEnd:{year:1990,month:6}})}
if(req.method==='POST'&&u.pathname==='/api/rooms/join'){const b=await body(req);if(!validRoomCode(b.roomCode)||typeof b.name!=='string'&&b.name!==undefined)return json(res,400,{error:'방 코드 또는 이름이 잘못되었습니다.'},req);const room=rooms.get(String(b.roomCode||''));if(!room)return json(res,404,{error:'방을 찾을 수 없습니다.'});if(room.finished)return json(res,409,{error:'이미 종료된 방입니다.'});if(room.started)return json(res,409,{error:'이미 시작된 방입니다.'});if(room.players.size>=MAX_PLAYERS)return json(res,409,{error:'방이 가득 찼습니다.'});const id=crypto.randomUUID(),t=token();room.players.set(id,{id,name:safeName(b.name),cash:100000000,assetValue:0,debt:0,positions:{},avg:{},loan:0,loanShark:0,ready:false,dayReady:false,lastSeen:Date.now()});sessions.set(t,{room:room.code,id,exp:Date.now()+86400000});return json(res,200,{...view(room,id),sessionToken:t,playerId:id})}
if(req.method==='POST'&&u.pathname==='/api/rooms/start'){const b=await body(req),room=rooms.get(String(b.roomCode||''));if(!room)return json(res,404,{error:'방을 찾을 수 없습니다.'});const p=auth(room,sessionTokenFrom(req,b));if(!p)return json(res,401,{error:'인증 실패'});if(room.hostId!==p.id)return json(res,403,{error:'방장만 대전을 시작할 수 있습니다.'});if(room.players.size<2)return json(res,409,{error:'최소 2명이 필요합니다.'});if(room.started)return json(res,409,{error:'이미 시작된 대전입니다.'});if(!startRoom(room))return json(res,409,{error:'대전을 시작할 수 없습니다.'});return json(res,200,view(room,p.id))}
if(req.method==='POST'&&u.pathname==='/api/rooms/progress'){const b=await body(req),room=rooms.get(String(b.roomCode||''));if(!room)return json(res,404,{error:'방을 찾을 수 없습니다.'});const p=auth(room,sessionTokenFrom(req,b));if(!p)return json(res,401,{error:'인증 실패'});const pl=room.players.get(p.id);if(!pl)return json(res,401,{error:'플레이어를 찾을 수 없습니다.'});if(!room.started)return json(res,409,{error:'아직 대전이 시작되지 않았습니다.'});if(room.finished)return json(res,200,{...view(room,p.id),finished:true});markAutoReadyIfBroke(room);if(pl.ready)return json(res,200,{...view(room,p.id),alreadyReady:true});pl.ready=true;pl.autoReady=false;pl.autoReadyReason='';let result={advanced:false,finished:false};if(!room.dayBattle?.active)result=maybeAdvance(room);return json(res,200,{...view(room,p.id),...result})}
if(req.method==='POST'&&u.pathname==='/api/rooms/trade'){const b=await body(req),room=rooms.get(String(b.roomCode||''));if(!room)return json(res,404,{error:'방을 찾을 수 없습니다.'});const p=auth(room,sessionTokenFrom(req,b));if(!p)return json(res,401,{error:'인증 실패'});if(!room.started||room.finished)return json(res,409,{error:'진행 중인 대전이 아닙니다.'});const a=ASSET.get(String(b.assetId||'')),side=b.side,qty=validQty(b.qty);if(!a||!['buy','sell'].includes(side)||qty===null)return json(res,400,{error:'잘못된 거래입니다.'});if(a.year>room.year)return json(res,409,{error:'아직 거래할 수 없는 자산입니다.'});const price=Number(room.marketPrices?.[a.id]||0),unit=price*(Number(a.multiplier)||1),value=qty*unit;if(!price||!Number.isFinite(value))return json(res,409,{error:'시장 가격을 확인할 수 없습니다.'});const owned=Number(p.positions?.[a.id]||0);if(side==='buy'){if(Number(p.cash)<value)return json(res,409,{error:'현금이 부족합니다.',shortage:true,required:value,available:Number(p.cash)||0});const old=owned,oldAvg=Number(p.avg?.[a.id]||0);p.cash-=value;p.positions[a.id]=old+qty;p.avg[a.id]=old?((oldAvg*old)+value)/(old+qty):value}else{if(owned<qty)return json(res,409,{error:'보유 수량이 부족합니다.'});p.cash+=value;p.positions[a.id]=owned-qty;if(!p.positions[a.id]){delete p.positions[a.id];delete p.avg[a.id]}}syncAssetValue(p,room);return json(res,200,{...view(room,p.id),trade:{assetId:a.id,side,qty,value,price}})}
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
