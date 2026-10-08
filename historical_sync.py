"""TIME & MONEY strict historical data collector.

Uses FinanceDataReader only for source-backed observations. It never fabricates,
interpolates, forward-fills, or uses a guessed listing date.
"""
import argparse, json, os, sys
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import FinanceDataReader as fdr
except Exception as e:
    print(json.dumps({"ok":False,"error":"FinanceDataReader is not installed","detail":str(e)},ensure_ascii=False))
    sys.exit(2)

BASE=os.path.dirname(os.path.abspath(__file__))
assets=json.load(open(os.path.join(BASE,'session2_assets.json'),encoding='utf-8'))
out_path=os.environ.get('HISTORICAL_PRICE_FILE',os.path.join(BASE,'monthly_prices.json'))
report_path=os.environ.get('HISTORICAL_SYNC_REPORT',os.path.join(BASE,'HISTORICAL_SYNC_REPORT.json'))
try: existing=json.load(open(out_path,encoding='utf-8')).get('prices',{})
except Exception: existing={}

def source_specs(a):
    k=a.get('kind'); t=str(a.get('historyTicker') or a.get('ticker') or a.get('id'))
    market=str(a.get('market') or '').upper()
    if k=='kr': return ['KRX:'+t,'KRX-DELISTING:'+t]
    if k in ('over','fund','real'):
        if market=='JP': return ['TSE:'+t]
        if market=='HK': return ['HKEX:'+t]
        if market=='CN':
            sym=t.split(':')[-1]
            return [('SSE:'+sym) if ':SS:' in str(a.get('id')) or market=='CN' and sym.startswith('6') else ('SZSE:'+sym)]
        if market=='UK': return ['LSE:'+t, t]
        if market=='DE': return ['FWB:'+t, t]
        if market=='US' or not market: return [t]
        return [t]
    if k=='coin':
        u=t.upper(); return [u if '/' in u else u+'/USD', u+'/KRW']
    if k=='bonds': return [str(a.get('historyTicker') or t)]
    if k in ('gold','deriv'):
        m={'GC=F':'ZG','SI=F':'ZI','HG=F':'HG','NG=F':'NG','CL=F':'CL','BZ=F':'BRN','ZC=F':'ZC','ZS=F':'ZS','ZW=F':'ZW','6J=F':'6J','6B=F':'6B','6C=F':'6C','6S=F':'6S','ES=F':'ES','NQ=F':'NQ','YM=F':'YM','ZN=F':'ZN','ZF=F':'ZF','ZT=F':'ZT','DX=F':'DX'}
        return [m.get(t,t)]
    return [t]

def monthly(df):
    if df is None or len(df)==0:return {}
    cols={str(c).lower():c for c in df.columns}
    close=cols.get('close')
    if close is None:return {}
    idx=df.index
    rows={}
    for dt,val in zip(idx,df[close]):
        try:
            p=float(val)
            if p>0:
                key=str(dt)[:7]; rows[key]=p
        except Exception: pass
    return dict(sorted(rows.items()))

def fetch(a):
    specs=source_specs(a); last_error=None
    for spec in specs:
        try:
            df=fdr.DataReader(spec,'1990-01-01','2026-12-31')
            m=monthly(df)
            if m:return {'id':a['id'],'status':'LOADED','source':spec,'first':next(iter(m)),'last':next(reversed(m)),'observations':len(m),'monthly':m}
        except Exception as e: last_error=str(e)[:500]
    return {'id':a['id'],'status':'ERROR' if last_error else 'NO_DATA','source':' | '.join(specs),'error':last_error}

ap=argparse.ArgumentParser();ap.add_argument('--workers',type=int,default=8);ap.add_argument('--ids',nargs='*');args=ap.parse_args()
target=assets if not args.ids else [a for a in assets if a['id'] in set(args.ids)]
results=[]
with ThreadPoolExecutor(max_workers=max(1,args.workers)) as ex:
    futs=[ex.submit(fetch,a) for a in target]
    for f in as_completed(futs): results.append(f.result())
for r in results:
    if r['status']=='LOADED':
        old=existing.get(r['id'],{}).get('monthly',{}) if isinstance(existing.get(r['id']),dict) else {}
        m=dict(old);m.update(r['monthly'])
        ks=sorted(m)
        existing[r['id']]={'monthly':m,'source':f"FinanceDataReader verified observations ({r['source']})",'verifiedDataStart':ks[0],'verifiedDataEnd':ks[-1]}
report={'generatedAt':datetime.utcnow().isoformat()+'Z','assetsRequested':len(target),'loaded':sum(r['status']=='LOADED' for r in results),'noData':sum(r['status']=='NO_DATA' for r in results),'errors':sum(r['status']=='ERROR' for r in results),'results':sorted(results,key=lambda x:x['id'])}
json.dump({'version':'fdr-strict-v1','description':'Actual observations only; monthly last observed close; no interpolation','prices':existing},open(out_path,'w',encoding='utf-8'),ensure_ascii=False,indent=2)
json.dump(report,open(report_path,'w',encoding='utf-8'),ensure_ascii=False,indent=2)
print(json.dumps({k:report[k] for k in ('assetsRequested','loaded','noData','errors')},ensure_ascii=False))
