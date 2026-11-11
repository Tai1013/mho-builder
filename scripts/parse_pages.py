"""把 fetch_pages.py 下載的頁面解析成 src/data/*.json。
用法: python3 scripts/parse_pages.py [cache_dir] [out_dir]"""
import re, json, os, sys, html
def rsc(path):
    h = open(path, encoding='utf-8').read()
    out = []
    for c in re.findall(r'self\.__next_f\.push\((\[.*?\])\)</script>', h, flags=re.S):
        try: arr = json.loads(c)
        except Exception: continue
        if len(arr) > 1 and isinstance(arr[1], str): out.append(arr[1])
    return ''.join(out)
_here = os.path.dirname(os.path.abspath(__file__))
RAW = sys.argv[1] if len(sys.argv) > 1 else os.path.join(_here, '.cache')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(_here, '..', 'src', 'data')
P = os.path.join(RAW, 'pages')
os.makedirs(OUT, exist_ok=True)

def clean(s):
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s).replace('​', '')
    return re.sub(r'\s+', ' ', s).strip()

def load(name):
    h = open(os.path.join(P, name), encoding='utf-8').read()
    return re.sub(r'<script.*?</script>', '', h, flags=re.S)

def section(h, sid):
    m = re.search(r'<section id="%s".*?</section>' % re.escape(sid), h, flags=re.S)
    return m.group(0) if m else ''

def rows(tbl):
    body = re.search(r'<tbody>(.*?)</tbody>', tbl, flags=re.S)
    if not body: return []
    return [re.findall(r'<td[^>]*>(.*?)</td>', tr, flags=re.S)
            for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', body.group(1), flags=re.S)]

def raw_rows(fname, key):
    s = rsc(os.path.join(RAW, fname))
    i = s.find(key); j = s.rfind('[{', 0, i)
    return json.JSONDecoder().raw_decode(s, j)[0]

PART_SLUG = {'頭': 'head', '胴': 'chest', '腕': 'arms', '腰': 'waist', '脚': 'legs'}
PART_LABEL = {'head': '頭部', 'chest': '胸部', 'arms': '腕部', 'waist': '腰部', 'legs': '腿部'}
PART_ORDER = ['head', 'chest', 'arms', 'waist', 'legs']
SKILL_LINK = r'href="/monster-hunter-outlanders/zh-hant/skills/([a-z0-9-]+)"[^>]*>(.*?)</a>'

# ---------- skills ----------
skill_list = raw_rows('skills.html', '"slug"')
skills = []
skill_by_name = {}
for r in sorted(skill_list, key=lambda x: x['order']):
    h = load('skills__%s.html' % r['slug'])
    levels = []
    for cells in rows(section(h, 'levels')):
        lv = int(re.sub(r'\D', '', clean(cells[0])))
        levels.append({'level': lv, 'effect': clean(cells[1])})
    en = [n for n in r['searchNames'] if n != r['name']]
    sk = {
        'id': r['slug'], 'name': r['name'], 'nameEn': en[0] if en else None,
        'description': r['effect'], 'maxLevel': r['maxLevel'],
        'sources': r['sources'], 'armorCount': r['armorCount'], 'weaponCount': r['weaponCount'],
        'levels': levels,
    }
    if len(levels) != r['maxLevel']:
        print('WARN level count', r['slug'], len(levels), r['maxLevel'])
    skills.append(sk); skill_by_name[r['name']] = sk

# ---------- set skills ----------
sk_html = open(os.path.join(RAW, 'skills.html'), encoding='utf-8').read()
set_slugs = []
for slug in re.findall(r'href="/monster-hunter-outlanders/zh-hant/skills/set/([a-z0-9-]+)"', sk_html):
    if slug not in set_slugs: set_slugs.append(slug)
set_skills = []
for slug in set_slugs:
    h = load('skills__set__%s.html' % slug)
    name = clean(re.search(r'<h1[^>]*>(.*?)</h1>', h, flags=re.S).group(1))
    sub = clean(re.search(r'</h1><p[^>]*>(.*?)</p>', h, flags=re.S).group(1))
    pieces = int(re.search(r'(\d+)\s*件', sub).group(1))
    blk = re.search(r'</header><div class="space-y-1 text-sm">(.*?)</div>', h, flags=re.S).group(1)
    ps = re.findall(r'<p[^>]*>(.*?)</p>', blk, flags=re.S)
    label = clean(ps[0]); effect = clean(ps[1]) if len(ps) > 1 else None
    grants = []
    for m in re.finditer(SKILL_LINK, blk, flags=re.S):
        txt = clean(m.group(2))
        mm = re.match(r'(.+?)等級提升\s*(\d+)', txt)
        target = next(s for s in skills if s['id'] == m.group(1))
        grants.append({'skillId': m.group(1), 'skillName': target['name'], 'level': int(mm.group(2)) if mm else None})
    if not grants:
        mm = re.match(r'(.+?)\+(\d+)$', label)
        if mm:
            print('NOTE set grant without skill page', slug, label)
            grants.append({'skillId': None, 'skillName': mm.group(1), 'level': int(mm.group(2))})
    armor_ids = re.findall(r'href="/monster-hunter-outlanders/zh-hant/armor/([a-z0-9-]+/[a-z]+)"', section(h, 'armor'))
    set_skills.append({
        'id': slug, 'name': name, 'requiredPieces': pieces,
        'bonusLabel': label, 'bonusEffect': effect, 'grants': grants,
        'series': sorted({a.split('/')[0] for a in armor_ids}),
    })
set_by_name = {s['name']: s for s in set_skills}

# ---------- armor ----------
armor_list = raw_rows('armor.html', '"seriesSlug"')
# 來源網站沒標等級的技能，用遊戲內實際確認過的等級補上：(防具 id, 稀有度, 技能 id) → 等級
SKILL_LEVEL_OVERRIDES = {
    ('radiant-jyuratodus/arms', 10, 'hunting-instinct'): 1,  # 融光・泥魚龍腕甲Ⅳ 獵手直覺，遊戲內為 Lv1
}
series = {}
for r in armor_list:
    part = r['href'].split('/')[-1]
    sid = r['seriesSlug']
    h = load('armor__%s__%s.html' % (sid, part))
    head = re.search(r'<h1.*?aria-label="toc"', h, flags=re.S).group(0)
    mon = re.search(r'href="/monster-hunter-outlanders/zh-hant/monsters/([a-z0-9-]+)"[^>]*>(.*?)</a>', head, flags=re.S)
    stages = []
    no_level_in_source = set()  # 來源沒標等級的技能（和列表頁比對時用）
    for cells in rows(section(h, 'stages')):
        rarity = int(clean(cells[0]))
        sks = []
        for m in re.finditer(SKILL_LINK, cells[3], flags=re.S):
            t = clean(m.group(2)); mm = re.match(r'(.+?)\s*Lv(\d+)$', t)
            if mm: sks.append({'skillId': m.group(1), 'name': mm.group(1), 'level': int(mm.group(2))})
            else:
                no_level_in_source.add((rarity, m.group(1)))
                lv = SKILL_LEVEL_OVERRIDES.get(('%s/%s' % (sid, part), rarity, m.group(1)))
                if lv is None: print('NOTE skill without level', sid, part, t)
                else: print('NOTE skill level override', sid, part, rarity, t, '-> Lv%d' % lv)
                sks.append({'skillId': m.group(1), 'name': t, 'level': lv})
        stages.append({'rarity': rarity, 'name': clean(cells[1]),
                       'defense': int(clean(cells[2])), 'skills': sks})
    mats = {}
    for cells in rows(section(h, 'materials')):
        items = [{'itemId': m.group(1), 'name': clean(m.group(2)), 'qty': int(m.group(3))}
                 for m in re.finditer(r'href="/monster-hunter-outlanders/zh-hant/items/([a-z0-9-]+)"[^>]*>(.*?)</a>\s*<span[^>]*>×(?:<!-- -->)?(\d+)</span>', cells[2], flags=re.S)]
        mats[int(clean(cells[0]))] = {'type': 'craft' if clean(cells[1]) == '製作' else 'upgrade', 'items': items}
    for st in stages:
        st['materials'] = mats.get(st['rarity'])
    set_id = None
    sm = re.search(r'href="/monster-hunter-outlanders/zh-hant/skills/set/([a-z0-9-]+)"', head)
    if sm: set_id = sm.group(1)
    elif r['setSkillLabel']:
        print('NOTE set from list label', sid, part); set_id = set_by_name[r['setSkillLabel'].replace('\u200b','')]['id']
    top = stages[-1] if stages else None
    en = [n for n in r['searchNames'] if n not in (r['name'], r['seriesLabel'])]
    piece = {
        'id': '%s/%s' % (sid, part), 'name': r['name'], 'nameEn': en[0] if en else None,
        'part': part, 'partLabel': PART_LABEL[part], 'series': sid,
        'rarityMin': r['minRarity'], 'rarityMax': r['maxRarity'], 'maxDefense': r['defense'],
        'skills': top['skills'] if top else [], 'setSkill': set_id,
        'image': r['image'], 'stages': stages,
    }
    # cross-check list page vs detail page
    lbl = [s['name'] if s['level'] is None or (top['rarity'], s['skillId']) in no_level_in_source
           else '%s Lv%d' % (s['name'], s['level']) for s in piece['skills']]
    if lbl != r['skillLabels'] or (top and top['defense'] != r['defense']) or (top and top['rarity'] != r['maxRarity']):
        print('WARN mismatch', piece['id'], lbl, r['skillLabels'], top and top['defense'], r['defense'])
    s = series.setdefault(sid, {
        'id': sid, 'name': r['seriesLabel'],
        'monster': {'id': mon.group(1), 'name': clean(mon.group(2))} if mon else None,
        'setSkill': set_id, 'rarityMin': r['minRarity'], 'rarityMax': r['maxRarity'], 'pieces': {},
    })
    s['rarityMin'] = min(s['rarityMin'], r['minRarity']); s['rarityMax'] = max(s['rarityMax'], r['maxRarity'])
    if s['setSkill'] != set_id: print('WARN set differs within series', sid, s['setSkill'], set_id)
    s['pieces'][part] = piece

# ---------- monsters ----------
ms = rsc(os.path.join(RAW, 'monsters.html'))
mi = ms.find('"rows":[{"slug"') + len('"rows":')
mon_rows, mend = json.JSONDecoder().raw_decode(ms, mi)
def options(key):
    m = re.search(r'"%s":(\[.*?\])' % key, ms[mend:])
    return {o['value']: o['label'] for o in json.loads(m.group(1))} if m else {}
species_lbl, habitat_lbl = options('speciesOptions'), options('habitatOptions')
monsters = []
for r in sorted(mon_rows, key=lambda x: x['order']):
    en = [n for n in r['searchNames'] if n != r['name']]
    monsters.append({
        'id': r['slug'], 'name': r['name'], 'nameEn': en[0] if en else None, 'image': r['image'],
        'size': r['size'], 'species': species_lbl.get(r['species'], r['species']),
        'habitats': [habitat_lbl.get(x, x) for x in r['habitats']],
        'weakness': [{'element': w['label'], 'stars': w['stars']} for w in r['weakness']],
        'ailments': [{'ailment': w['label'], 'stars': w['stars']} for w in r['ailments']],
        'hitzones': r['hitzones'],
    })
mon_by_id = {m['id']: m for m in monsters}

# 來源網站的圖示錯誤：融光種大凶豺龍 用的是 融光種大凶顎龍 的圖示（兩張檔案完全相同）。
# 先改用一般 大凶豺龍 的圖示（至少是同一隻魔物）；畫面上會優先用下面的繪影圖示。
IMAGE_OVERRIDES = {'radiant-great-jagras': 'great-jagras'}
for mid, src in IMAGE_OVERRIDES.items():
    if mid in mon_by_id and src in mon_by_id:
        print('NOTE image override', mid, '->', src)
        mon_by_id[mid]['image'] = mon_by_id[src]['image']

# 繪影（visages）圖示：圖示畫在一張紙上（JPEG，紙有紫／金／藍三種顏色）。
# 為了外觀一致，網站平常用魔物列表的透明底圖示；只有列表圖示有錯的魔物才改用繪影圖示。
USE_VISAGE = {'radiant-great-jagras'}
vs_path = os.path.join(RAW, 'visages.html')
visage_img = {}
if os.path.exists(vs_path):
    vs = rsc(vs_path)
    vi = vs.find('"rows":[{"slug"') + len('"rows":')
    vis_rows, _ = json.JSONDecoder().raw_decode(vs, vi)
    visage_img = {r['slug']: r['image'] for r in vis_rows}
else:
    print('WARN visages.html not found, run fetch_pages.py')
for m in monsters:
    m['visage'] = visage_img.get(m['id']) if m['id'] in USE_VISAGE else None
    if m['id'] in USE_VISAGE:
        print('NOTE use visage image', m['id'], m['visage'] or '(WARN not found)')

# 來源網站的連結錯誤：融光種大凶顎龍套裝 連到小型的「融光種凶顎龍」，素材全是「融光種大凶顎龍的…」
MONSTER_OVERRIDES = {'radiant-great-girros': 'radiant-great-girros'}
# 素材名稱 → 魔物（最長名稱優先，避免「凶豺龍」吃掉「大凶豺龍」）
mon_names = sorted(monsters, key=lambda m: -len(m['name']))
def material_monster(item_name):
    for m in mon_names:
        if item_name.startswith(m['name'] + '的'): return m['id']
    return None

armor = []
for s in series.values():
    s['pieces'] = {p: s['pieces'][p] for p in PART_ORDER if p in s['pieces']}
    if s['id'] in MONSTER_OVERRIDES:
        fixed = mon_by_id[MONSTER_OVERRIDES[s['id']]]
        print('NOTE monster override', s['id'], s['monster'], '->', fixed['id'])
        s['monster'] = {'id': fixed['id'], 'name': fixed['name']}
    if s['monster'] and s['monster']['id'] not in mon_by_id:
        print('WARN monster not in monster list', s['id'], s['monster'])
    found = []
    for p in s['pieces'].values():
        for st in p['stages']:
            for it in (st['materials'] or {}).get('items', []):
                mid = material_monster(it['name'])
                if mid and mid not in found: found.append(mid)
    s['materialMonsters'] = found
    armor.append(s)

# ---------- mhohub.com：補 gamewith 沒有的階與防具 ----------
# 以 gamewith 為主；mhohub 只補 gamewith 沒有的稀有度（例如 R10 以上、中間階）和 gamewith 還沒收錄的套裝。
# mhohub 每個部件的技能寫成「技能・技能等級・解鎖等級」，解鎖等級就是稀有度（跟 gamewith 對過 941 筆一致）。
# mhohub 有些條目沒寫技能等級：同部位先前出現過的 → 前一級 +1；沒出現過的 → 用 gamewith 的等級，
# 兩邊都沒有就看 manual_data.json 的 skillLevels，再沒有就留 null（網站顯示「?」）。
MH = os.path.join(RAW, 'mhohub')
MH_PART = {'頭部': 'head', '胸部': 'chest', '手部': 'arms', '腰部': 'waist', '腿部': 'legs'}
# mhohub 套裝名稱跟 gamewith 不同的
MH_SERIES_ALIAS = {'光稜龍・聖騎套裝': '光稜龍套裝'}
def strip_tier(t): return re.sub(r'[ⅠⅡⅢⅣⅤⅥ]+$', '', t)

manual = json.load(open(os.path.join(_here, 'manual_data.json'), encoding='utf-8')) \
    if os.path.exists(os.path.join(_here, 'manual_data.json')) else {}
# (系列 id, 部位, 技能名稱) → 等級；遊戲內確認、兩個網站都沒寫等級的技能
level_patch = {(x['armor'], x['part'], x['skill']): x['level'] for x in manual.get('skillLevels', [])}
level_patch_used = set()
level_overrides = {(x['armor'], x['part'], x['skill']): x['level']
                   for x in manual.get('skillLevelOverrides', [])}
temporary_level_overrides = {
    (x['armor'], x['part'], x['skill']): x
    for x in manual.get('skillLevelOverrides', []) if x.get('temporary')
}
temporary_overrides_seen = set()

def mh_parse_sets():
    out = []
    d = os.path.join(MH, 'sets')
    for f in sorted(os.listdir(d)):
        h = open(os.path.join(d, f), encoding='utf-8').read()
        title = clean(re.search(r'<h1[^>]*>(.*?)</h1>', h, flags=re.S).group(1))
        # 套裝效果：<div data-set-bonus><h3>名稱</h3><li><strong>2 件</strong> · <a #equipment-skill-ID>技能+1</a>
        bonus = None
        bm = re.search(r'<div data-set-bonus="\d+"><h3[^>]*>(.*?)</h3>\s*<ul><li><strong>(\d+) 件</strong>'
                       r'<span[^>]*> · <a href="/zh-tw/skills/#equipment-skill-(\d+)">(.*?)\+(\d+)</a>', h, flags=re.S)
        if bm:
            bonus = {'name': clean(bm.group(1)), 'pieces': int(bm.group(2)), 'mhId': int(bm.group(3)),
                     'skill': clean(bm.group(4)), 'level': int(bm.group(5))}
        pieces = {}
        for art in re.findall(r'<article class="armor-set-card armor-piece-card"[^>]*>(.*?)</article>', h, flags=re.S):
            part = MH_PART.get(clean(re.search(r'<p class="eyebrow">(.*?)</p>', art).group(1)))
            sks = []
            for lang, sid, name, meta in re.findall(r'<li><strong lang="([^"]+)"><a href="/zh-tw/skills/#equipment-skill-(\d+)">(.*?)</a></strong><small class="meta">(.*?)</small>', art):
                lv = re.search(r'技能等級 (\d+)', meta); un = re.search(r'解鎖等級 (\d+)', meta)
                if not un: continue
                sks.append({'mhId': int(sid), 'name': clean(name), 'zh': lang == 'zh-TW',
                            'level': int(lv.group(1)) if lv else None, 'unlock': int(un.group(1))})
            pieces[part] = {'name': clean(re.search(r'<h3[^>]*>(.*?)</h3>', art).group(1)), 'skills': sks}
        out.append({'title': title, 'bonus': bonus, 'pieces': pieces})
    return out

def mh_parse_skills():
    h = open(os.path.join(MH, 'skills.html'), encoding='utf-8').read()
    out = {}
    for sid, blk in re.findall(r'<article[^>]*id="equipment-skill-(\d+)"[^>]*>(.*?)</article>', h, flags=re.S):
        name = clean(re.search(r'<h[23][^>]*>(.*?)</h[23]>', blk, flags=re.S).group(1))
        t = clean(blk)
        desc = t[len(name):t.find('技能等級與效果')].strip() if '技能等級與效果' in t else ''
        levels = [{'level': int(a), 'effect': b.strip()} for a, b in
                  re.findall(r'技能等級 (\d+) · (.*?)(?=\s*技能等級 \d+ · |\s*防具部件|\s*防具套裝效果|$)', t)]
        out[int(sid)] = {'name': name, 'description': desc or None, 'levels': levels}
    return out

if os.path.isdir(MH):
    mh_sets = mh_parse_sets()
    mh_skills = mh_parse_skills()
    sk_by_en = {(s['nameEn'] or '').lower(): s for s in skills}
    # mhohub 的技能 id → 中文名稱（有些條目只有英文，靠其他條目或技能頁對回中文）
    mh_zh = {i: v['name'] for i, v in mh_skills.items()}
    for ms_ in mh_sets:
        for p in ms_['pieces'].values():
            for k in p['skills']:
                if k['zh']: mh_zh.setdefault(k['mhId'], k['name'])
    def mh_skill(mh_id, fallback_name, source):
        """mhohub 技能 → skills.json 的技能；gamewith 沒有的技能用 mhohub 技能頁的資料新增"""
        name = mh_zh.get(mh_id, fallback_name)
        # mhohub 有些技能名稱只有英文（例如 Blessing＝庇佑），用 gamewith 的英文名稱對回來
        sk = skill_by_name.get(name) or skill_by_name.get(fallback_name) \
            or sk_by_en.get(name.lower()) or sk_by_en.get(fallback_name.lower())
        if sk: return sk
        info = mh_skills.get(mh_id, {'name': name, 'description': None, 'levels': []})
        levels = [l for l in info['levels'] if '待核驗' not in l['effect']]
        sk = {'id': 'mhohub-%d' % mh_id, 'name': name, 'nameEn': None, 'description': info['description'],
              'maxLevel': max([l['level'] for l in info['levels']] or [1]), 'sources': [source],
              'armorCount': 0, 'weaponCount': 0, 'levels': levels}
        skills.append(sk); skill_by_name[name] = sk
        print('NOTE skill from mhohub', sk['id'], name)
        return sk

    def merge_piece(sid, part, gp, mp, stage_name):
        """gamewith 部件（可能沒有）＋ mhohub 部件（可能沒有）→ 各稀有度的技能"""
        g_st = {st['rarity']: st for st in gp['stages']} if gp else {}
        entries = sorted(mp['skills'], key=lambda k: k['unlock']) if mp else []
        g_min = min(g_st) if g_st else None
        rarities = sorted(set(g_st) | {e['unlock'] for e in entries if g_min is None or e['unlock'] > g_min})
        stages, cur, prev_r, conflicts = [], {}, 0, []
        for r in rarities:
            new = [e for e in entries if prev_r < e['unlock'] <= r] if g_min is None or r > g_min else []
            if r in g_st:
                st = g_st[r]
                cur = {k['skillId']: dict(k) for k in st['skills']}
            else:
                cur = {k: dict(v) for k, v in cur.items()}
                for e in new:
                    sk = mh_skill(e['mhId'], e['name'], 'armor')
                    lv = e['level']
                    if lv is None and sk['id'] in cur and cur[sk['id']]['level']:
                        lv = cur[sk['id']]['level'] + 1          # 同部位先前出現過 → 前一級 +1
                    if lv is None:                                # 用 gamewith 之後的階的等級
                        lv = next((k['level'] for rr in sorted(g_st) if rr > r for k in g_st[rr]['skills'] if k['skillId'] == sk['id']), None)
                    if lv is None and (sid, part, sk['name']) in level_patch:
                        lv = level_patch[(sid, part, sk['name'])]; level_patch_used.add((sid, part, sk['name']))
                    if lv is None: print('NEED level', sid, part, 'R%d' % r, sk['name'])
                    cur[sk['id']] = {'skillId': sk['id'], 'name': sk['name'], 'level': lv}
                name = stages[-1]['name'] if stages else stage_name
                st = {'rarity': r, 'name': name, 'defense': None, 'skills': list(cur.values()), 'materials': None,
                      'source': 'mhohub'}
            stages.append(st if r not in g_st else dict(st))
            prev_r = r
        return stages

    g_by_name = {s['name']: s for s in armor}
    set_by_name = {s['name']: s for s in set_skills}
    for ms_ in mh_sets:
        base_name = MH_SERIES_ALIAS.get(strip_tier(ms_['title']), strip_tier(ms_['title']))
        g = g_by_name.get(base_name)
        if not any(p['skills'] for p in ms_['pieces'].values()):
            print('NOTE mhohub set without skills, skipped', ms_['title']); continue
        if g:
            # gamewith 有的套裝：只補 gamewith 沒有的階
            for part, gp in g['pieces'].items():
                mp = ms_['pieces'].get(part)
                if not mp: continue
                before = {st['rarity'] for st in gp['stages']}
                gp['stages'] = merge_piece(g['id'], part, gp, mp, gp['stages'][-1]['name'])
                added = [st['rarity'] for st in gp['stages'] if st['rarity'] not in before]
                if added:
                    print('NOTE mhohub stages', g['id'], part, added)
                    gp['rarityMax'] = max(gp['rarityMax'], max(added)); gp['skills'] = gp['stages'][-1]['skills']
            g['rarityMax'] = max(p['rarityMax'] for p in g['pieces'].values())
            continue
        # gamewith 沒有的套裝：整套用 mhohub
        mon_name = base_name.replace('套裝', '')
        mon = next((m for m in monsters if m['name'] == mon_name), None)
        if not mon: print('WARN mhohub set monster not found', ms_['title']); continue
        sid = mon['id']
        b = ms_['bonus']
        set_id = None
        if b:
            set_name, req, glv = b['name'], b['pieces'], b['level']
            if set_name in set_by_name:
                set_id = set_by_name[set_name]['id']
            else:
                gsk = mh_skill(b['mhId'], b['skill'], 'set')
                gname = gsk['name']
                effect = next((l['effect'] for l in gsk['levels'] if l['level'] == glv), None)
                set_id = '%s-set' % sid
                set_skills.append({'id': set_id, 'name': set_name, 'requiredPieces': req,
                                   'bonusLabel': '%s+%d' % (gname, glv), 'bonusEffect': effect,
                                   'grants': [{'skillId': gsk['id'], 'skillName': gname, 'level': glv}],
                                   'series': []})
                set_by_name[set_name] = set_skills[-1]
            set_by_name[set_name]['series'] = sorted(set(set_by_name[set_name]['series']) | {sid})
        pieces = {}
        for part in PART_ORDER:
            mp = ms_['pieces'].get(part)
            if not mp: continue
            stages = merge_piece(sid, part, None, mp, mp['name'])
            pieces[part] = {
                'id': '%s/%s' % (sid, part), 'name': strip_tier(mp['name']), 'nameEn': None,
                'part': part, 'partLabel': PART_LABEL[part], 'series': sid,
                'rarityMin': stages[0]['rarity'], 'rarityMax': stages[-1]['rarity'],
                'skills': stages[-1]['skills'], 'setSkill': set_id, 'image': '', 'stages': stages,
            }
        armor.append({'id': sid, 'name': base_name, 'monster': {'id': mon['id'], 'name': mon['name']},
                      'setSkill': set_id,
                      'rarityMin': min(p['rarityMin'] for p in pieces.values()),
                      'rarityMax': max(p['rarityMax'] for p in pieces.values()),
                      'pieces': pieces, 'materialMonsters': [mon['id']]})
        print('NOTE mhohub set added', sid, base_name)
    for k in set(level_patch) - level_patch_used:
        print('NOTE manual skillLevels not needed (already known)', k)
else:
    print('WARN mhohub cache not found, run fetch_pages.py')

# 使用者在遊戲內確認的技能等級優先於來源頁面標示。
for s in armor:
    for part, p in s['pieces'].items():
        for st in p['stages']:
            for skill in st['skills']:
                key = (s['id'], part, skill['name'])
                override = level_overrides.get(key)
                if override is not None:
                    temporary = temporary_level_overrides.get(key)
                    if temporary:
                        temporary_overrides_seen.add(key)
                        if skill['level'] == override:
                            print('NOTE temporary skill override matches source; can remove', key)
                            continue
                        print('NOTE temporary skill override applied', key,
                              skill['level'], '->', override)
                    skill['level'] = override
        if p['stages']:
            p['skills'] = p['stages'][-1]['skills']

for key in temporary_level_overrides.keys() - temporary_overrides_seen:
    print('WARN temporary skill override not found in parsed armor', key)

# 防具上出現的技能都要能在「技能篩選」選到（mhohub 補進來的技能可能先被當成套裝技能建立）
used_on_armor = {k['skillId'] for s in armor for p in s['pieces'].values() for st in p['stages'] for k in st['skills']}
for sk in skills:
    if sk['id'] in used_on_armor and 'armor' not in sk['sources']: sk['sources'].append('armor')

# 網站沒用到的欄位輸出時拿掉，手機要下載的資料少一半（2026-11-10）：
# 防禦力（使用者決定移除）、製作素材、部件圖片網址、魔物的種族／棲息地／弱點／異常／肉質、技能出現次數。
# 素材在上面推算 materialMonsters 時已經用過了。
for s in armor:
    for p in s['pieces'].values():
        for k in ('maxDefense', 'image'): p.pop(k, None)
        for st in p['stages']:
            for k in ('defense', 'source', 'materials'): st.pop(k, None)
for m in monsters:
    for k in ('species', 'habitats', 'weakness', 'ailments', 'hitzones'): m.pop(k, None)
for sk in skills:
    for k in ('armorCount', 'weaponCount'): sk.pop(k, None)

# ---------- adventurers / buddies（冒險者、隨從） ----------
# 配裝頁最上面可以選冒險者和隨從；只記錄選了誰，不影響技能計算。
# 只留畫面要用的欄位：冒險者＝圖、名稱、武器種類、屬性、類型；隨從＝圖、名稱、類型。
# 排序：主角冒險者在最前面，接著依稀有度（SSR → SR → R），同稀有度照來源網站的順序。
RARITY_RANK = {'SSR': 0, 'SR': 1, 'R': 2}
def list_rows(fname):
    path = os.path.join(RAW, fname)
    if not os.path.exists(path):
        print('WARN', fname, 'not found, run fetch_pages.py')
        return []
    s = rsc(path)
    i = s.find('"rows":[{"slug"') + len('"rows":')
    rows, _ = json.JSONDecoder().raw_decode(s, i)
    return sorted(rows, key=lambda r: (not r.get('fated'), RARITY_RANK.get(r['rarity'], 9), r.get('order', 0)))
adventurers = [{
    # 主角冒險者每種武器各一個，來源寫成「主角冒險者 (大劍)」；武器另外有欄位，名稱就只寫「主角冒險者」
    'id': r['slug'], 'name': re.sub(r'\s*\(.*\)$', '', r['name']) if r.get('fated') else r['name'],
    'image': r['image'], 'weapon': r['weaponTypeLabel'], 'element': r['specialtyLabel'], 'type': r['typeLabel'],
} for r in list_rows('adventurers.html')]
buddies = [{
    'id': r['slug'], 'name': r['name'], 'image': r['image'], 'type': r['typeLabel'],
} for r in list_rows('buddies.html')]

# 資料更新時間：快取裡最新一個檔案的下載時間（台灣時間），網站頁尾會顯示
from datetime import datetime, timezone, timedelta
latest = max(os.path.getmtime(os.path.join(d, f)) for d, _, fs in os.walk(RAW) for f in fs)
updated_at = datetime.fromtimestamp(latest, timezone(timedelta(hours=8))).isoformat(timespec='seconds')
meta = {'sources': [{'name': 'gamewith.ai', 'url': 'https://gamewith.ai/monster-hunter-outlanders/zh-hant'},
                    {'name': 'mhohub.com', 'url': 'https://mhohub.com/zh-tw/'}],
        'updatedAt': updated_at, 'locale': 'zh-hant',
        'parts': [{'id': p, 'label': PART_LABEL[p]} for p in PART_ORDER]}
print('data updated at', updated_at)
def dump(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
dump('skills.json', skills)
dump('set-skills.json', set_skills)
dump('armor.json', armor)
dump('meta.json', meta)
dump('monsters.json', monsters)
dump('adventurers.json', adventurers)
dump('buddies.json', buddies)
print('skills', len(skills), 'set', len(set_skills), 'series', len(armor), 'pieces', sum(len(s['pieces']) for s in armor), 'monsters', len(monsters), 'adventurers', len(adventurers), 'buddies', len(buddies))
