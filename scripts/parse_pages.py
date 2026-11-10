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

meta = {'source': 'https://gamewith.ai/monster-hunter-outlanders/zh-hant', 'locale': 'zh-hant',
        'parts': [{'id': p, 'label': PART_LABEL[p]} for p in PART_ORDER]}
def dump(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
dump('skills.json', skills)
dump('set-skills.json', set_skills)
dump('armor.json', armor)
dump('meta.json', meta)
dump('monsters.json', monsters)
print('skills', len(skills), 'set', len(set_skills), 'series', len(armor), 'pieces', sum(len(s['pieces']) for s in armor), 'monsters', len(monsters))
