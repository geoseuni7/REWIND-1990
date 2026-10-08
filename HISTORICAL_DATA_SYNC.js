/* TIME & MONEY - bulk real-data synchronizer
 * Strict rule: only provider observations enter monthly_prices.json.
 * No interpolation, forward-fill, synthetic prices, or guessed dates.
 */
const fs=require('fs');
const path=require('path');
const https=require('https');
const ASSET_FILE=process.env.ASSET_FILE||path.join(__dirname,'session2_assets.json');
const OUT_FILE=process.env.HISTORICAL_PRICE_FILE||path.join(__dirname,'monthly_prices.json');
const REPORT_FILE=process.env.HISTORICAL_SYNC_REPORT||path.join(__dirname,'HISTORICAL_SYNC_REPORT.json');
const A=JSON.parse(fs.readFileSync(ASSET_FILE,'utf8'));
let old={};try{old=JSON.parse(fs.readFileSync(OUT_FILE,'utf8')).prices||{}}catch(_){old={}};
function get(url){return new Promise(resolve=>{const req=https.get(url,{headers:{'User-Agent':'TIME-MONEY-real-data-sync/1.0'}},res=>{let s='';res.on('data',c=>s+=c);res.on('end',()=>resolve(res.statusCode===200?s:null));});req.on('error',()=>resolve(null));req.setTimeout(15000,()=>{req.destroy();resolve(null)});});}
function csvMonthly(s){const lines=String(s||'').trim().split(/\r?\n/);if(lines.length<2)return{};const out={};for(let i=1;i<lines.length;i++){const c=lines[i].split(',');if(c.length<5)continue;const d=c[0],p=Number(c[4]);if(/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(p)&&p>0)out[d.slice(0,7)]=p;}return out;}
function stooqSymbol(a){let t=String(a.historyTicker||a.ticker||'').trim().toLowerCase();if(!t)return null;
 if(a.kind==='over'||a.kind==='fund'||a.historicalKind==='fund'||a.historicalKind==='over'||a.kind==='real')return /^[a-z0-9.-]+$/.test(t)?(t.endsWith('.us')?t:`${t}.us`):null;
 const fut={"cl=f":"cl.f","bz=f":"brn.f","ng=f":"ng.f","gc=f":"gc.f","si=f":"si.f","hg=f":"hg.f","zc=f":"zc.f","zs=f":"zs.f","zw=f":"zw.f","6j=f":"jpy.f","6b=f":"gbp.f","6c=f":"cad.f","6s=f":"chf.f","es=f":"sp.f","nq=f":"nq.f","ym=f":"ym.f","zn=f":"zn.f","zf=f":"zf.f","zt=f":"zt.f"};
 if(fut[t])return fut[t];
 const fx=t.replace(/=x$/,'').replace(/[^a-z]/g,'');if(fx.length===6)return fx;
 return null;
}
async function fetchAsset(a){const sym=stooqSymbol(a);if(!sym)return{status:'NO_PROVIDER',id:a.id};const u=`https://stooq.com/q/d/l/?s=${encodeURIComponent(sym)}&d1=19000101&d2=20261231&i=d`;const csv=await get(u);const monthly=csvMonthly(csv);const ks=Object.keys(monthly).sort();if(!ks.length)return{status:'NO_DATA',id:a.id,symbol:sym};return{status:'LOADED',id:a.id,symbol:sym,first:ks[0],last:ks.at(-1),observations:ks.length,monthly};}
async function pool(items,n,fn){let i=0,out=[];async function w(){while(true){const j=i++;if(j>=items.length)return;out[j]=await fn(items[j]);}}await Promise.all(Array.from({length:Math.min(n,items.length)},w));return out;}
(async()=>{const results=await pool(A,12,fetchAsset);let loaded=0,merged=0;for(const r of results){if(r.status!=='LOADED')continue;loaded++;const prev=old[r.id]?.monthly||old[r.id]||{};const m={...prev,...r.monthly};old[r.id]={monthly:m,source:`Stooq verified observations (${r.symbol})`,verifiedDataStart:Object.keys(m).sort()[0],verifiedDataEnd:Object.keys(m).sort().at(-1)};merged+=Object.keys(r.monthly).length;}
const prices={version:'bulk-real-data-v1',description:'Verified historical observations only',prices:old};fs.writeFileSync(OUT_FILE,JSON.stringify(prices,null,2));const report={generatedAt:new Date().toISOString(),assets:A.length,loaded,failed:A.length-loaded,observationsAdded:merged,results};fs.writeFileSync(REPORT_FILE,JSON.stringify(report,null,2));console.log(JSON.stringify({assets:A.length,loaded,failed:A.length-loaded,observationsAdded:merged},null,2));})();
