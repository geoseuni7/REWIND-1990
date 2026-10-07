const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=__dirname;
const assets=JSON.parse(fs.readFileSync(path.join(root,'session2_assets.json'),'utf8'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const kinds={};for(const a of assets)kinds[a.kind]=(kinds[a.kind]||0)+1;
const ids=new Set(assets.map(a=>a.id));
assert.equal(assets.length,729,'asset count');
assert.equal(ids.size,729,'duplicate asset ids');
for(const [k,n] of Object.entries({kr:300,over:300,coin:10,fund:50,bonds:8,gold:6,deriv:5,real:50}))assert.equal(kinds[k],n,`count ${k}`);
assert(html.includes('function investmentListed(a){const sy='),'month-aware listing guard');
assert(html.includes('historyQuality:{},'),'history quality state');
assert(server.includes('confidence:h.confidence||\'C\''),'API confidence payload');
const proxy=(html.match(/const HISTORICAL_PROXY_TICKERS=(\{.*?\});/)||[])[1];
assert(proxy,'proxy map');
const p=JSON.parse(proxy), pc={};for(const [id,t] of Object.entries(p)){pc[t]=(pc[t]||[]).concat(id)}
const dups=Object.entries(pc).filter(([,v])=>v.length>1);assert.equal(dups.length,0,'historical ticker duplicates');
// Startup invariant: mode choice must exist and online button is not placed on name modal.
assert(html.includes('id="modeChoiceModal"'),'mode choice modal missing');
assert(html.includes('id="onlineModeChoiceBtn"'),'online mode choice missing');
assert(html.includes('id="startGameBtn"'),'start button missing');
// No general scalp tab: general render maps legacy trade category away from an accessible tab.
assert(html.includes("if(S.cat==='trade'){S.cat='kr'}"),'general scalp category guard missing');
// Online forced battle remains separate and token-hidden.
assert(html.includes('100개의 단타 코인이 지급됩니다'),'online token rule');
assert(html.includes('30초 동안 매매'),'online 30s rule');
assert(html.includes('기존 총자산의 50%가 실제 현금 보상'),'online reward rule');
const knownStarts={BOND_KTB3:11,BOND_KTB1:4,BOND_CORP3:11,BOND_KTB5:11,BOND_KTB10:4,BOND_REPO:11,BOND_MSB2:10,BOND_CORP1:12,F_KOSPI200:9,O_KOSPI200:6};
for(const a of assets)if(knownStarts[a.id])assert.equal(a.startMonth,knownStarts[a.id],`start month ${a.id}`);
console.log('PASS historical_engine_qa');
console.log(JSON.stringify({assets:assets.length,kinds,historyTickerDuplicates:dups.length,knownStartMonths:Object.keys(knownStarts).length}));
