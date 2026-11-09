"""下載 gamewith.ai MHO 技能／套裝技能／防具詳細頁到快取資料夾。
用法: python3 scripts/fetch_pages.py [cache_dir]   (預設 scripts/.cache)
刪除快取資料夾即可重新抓最新資料。"""
import re, json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
BASE='https://gamewith.ai/monster-hunter-outlanders/zh-hant'
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'
raw=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'.cache')
out=os.path.join(raw,'pages'); os.makedirs(out,exist_ok=True)
def fetch_index(name):
    fn=os.path.join(raw,name+'.html')
    if not os.path.exists(fn):
        req=urllib.request.Request(BASE+'/'+name,headers={'User-Agent':UA})
        with urllib.request.urlopen(req,timeout=30) as r: open(fn,'wb').write(r.read())
    return open(fn,encoding='utf-8').read()
sk=fetch_index('skills')
ar=fetch_index('armor')
fetch_index('monsters')
# the armor list page only renders page 1 as links; every row's href lives in the RSC payload
ar+=''.join('href="/monster-hunter-outlanders/zh-hant%s"'%h for h in re.findall(r'\\"href\\":\\"(/armor/[a-z0-9-]+/[a-z]+)\\"',ar))
paths=set()
paths|=set(re.findall(r'href="/monster-hunter-outlanders/zh-hant(/skills/set/[a-z0-9-]+)"',sk))
paths|=set(re.findall(r'href="/monster-hunter-outlanders/zh-hant(/skills/[a-z0-9-]+)"',sk))
paths|=set(re.findall(r'href="/monster-hunter-outlanders/zh-hant(/armor/[a-z0-9-]+/[a-z]+)"',ar))
paths=sorted(paths)
print(len(paths),flush=True)
def get(p):
    fn=os.path.join(out,p.strip('/').replace('/','__')+'.html')
    if os.path.exists(fn) and os.path.getsize(fn)>10000: return p,'cached'
    for attempt in range(4):
        try:
            req=urllib.request.Request(BASE+p,headers={'User-Agent':UA})
            with urllib.request.urlopen(req,timeout=30) as r:
                data=r.read()
            open(fn,'wb').write(data); time.sleep(0.25); return p,len(data)
        except Exception as e:
            err=str(e); time.sleep(2*(attempt+1))
    return p,'FAIL '+err
with ThreadPoolExecutor(4) as ex:
    for i,(p,res) in enumerate(ex.map(get,paths)):
        if not isinstance(res,int) or i%40==0: print(i,p,res,flush=True)
print('done')
