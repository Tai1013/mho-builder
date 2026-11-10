"""下載 gamewith.ai 與 mhohub.com 的 MHO 技能／套裝技能／防具頁到快取資料夾。
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
# 繪影（visages）列表：魔物列表圖示錯的魔物（例如融光種大凶豺龍），parse_pages.py 改用這裡的圖
fetch_index('visages')
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
print('gamewith done',flush=True)

# ---------- mhohub.com ----------
# 第二個資料來源：每個防具部件的技能「解鎖等級」（幾階開啟）比較完整，也有 gamewith 還沒收錄的防具。
# robots.txt 允許頁面、禁止 /api/，所以只抓頁面；一頁一頁慢慢抓（間隔 1 秒）。
MH='https://mhohub.com'
mh_dir=os.path.join(raw,'mhohub'); os.makedirs(os.path.join(mh_dir,'sets'),exist_ok=True)
def mh_get(path,fn):
    if os.path.exists(fn) and os.path.getsize(fn)>5000: return 'cached'
    for attempt in range(4):
        try:
            req=urllib.request.Request(MH+path,headers={'User-Agent':UA})
            with urllib.request.urlopen(req,timeout=30) as r: data=r.read()
            open(fn,'wb').write(data); time.sleep(1); return len(data)
        except Exception as e:
            err=str(e); time.sleep(2*(attempt+1))
    return 'FAIL '+err
print('mhohub armor', mh_get('/zh-tw/armor/',os.path.join(mh_dir,'armor.html')),flush=True)
print('mhohub skills', mh_get('/zh-tw/skills/',os.path.join(mh_dir,'skills.html')),flush=True)
mh_list=open(os.path.join(mh_dir,'armor.html'),encoding='utf-8').read()
# 只抓有名稱的完整套裝（「○○套裝Ⅰ」）；「○○頭盔Ⅱ · 防具套裝」那種分組資料幾乎都是待核驗，用不到
mh_title={}
for i,t in re.findall(r'href="/zh-tw/armor/(\d+)/"[^>]*>(.*?)</a>',mh_list,flags=re.S):
    t=re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',t)).strip()
    if t and i not in mh_title: mh_title[i]=t   # 每個套裝第一個連結的文字是套裝名稱（後面還有「查看套裝 →」）
mh_ids=[i for i,t in mh_title.items() if re.search(r'套裝[ⅠⅡⅢⅣⅤⅥ]+$',t) and '·' not in t]
print('mhohub sets',len(mh_ids),flush=True)
for i in mh_ids:
    res=mh_get('/zh-tw/armor/%s/'%i,os.path.join(mh_dir,'sets',i+'.html'))
    if not isinstance(res,int) and res!='cached': print('mhohub',i,res,flush=True)
print('done')
