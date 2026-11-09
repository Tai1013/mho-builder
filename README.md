# MHO 自由配裝

《魔物獵人：旅人（Monster Hunter Outlanders）》防具技能資料與簡易自由配裝網站（Vite + Vue 3 + TypeScript）。

網站：<https://tai1013.github.io/mho-builder/>

資料來源：<https://gamewith.ai/monster-hunter-outlanders/zh-hant/skills>、<https://gamewith.ai/monster-hunter-outlanders/zh-hant/armor>、<https://gamewith.ai/monster-hunter-outlanders/zh-hant/monsters>

## 開發

需要 Node 20.19+（專案 `.nvmrc` 指定 24.22.0）。

```bash
nvm use
npm install
npm run dev
```

## 部署

推送到 `main` 後，GitHub Actions（`.github/workflows/deploy.yml`）會自動建置並部署到 GitHub Pages。網址路徑由 repo 名稱決定（建置時以 `BASE_PATH=/<repo>/` 傳入），本機開發不受影響。也可以在 Actions 頁面手動執行 `workflow_dispatch` 重新部署。

## 資料檔（`src/data/`）

| 檔案 | 內容 |
| --- | --- |
| `armor.json` | 40 個防具系列，每個系列含 頭/胸/腕/腰/腿 5 件，共 200 件 |
| `skills.json` | 88 個技能，含各等級效果 |
| `set-skills.json` | 40 個套裝技能，含發動件數與加成的技能 |
| `monsters.json` | 57 隻魔物，含圖示網址、大小、種族、棲息地、屬性／異常弱點、肉質 |
| `meta.json` | 部位 id 與中文名稱 |

### `armor.json`

```jsonc
[
  {
    "id": "rathalos",                 // 系列 id
    "name": "火龍套裝",
    "monster": { "id": "rathalos", "name": "火龍" },  // 對應 monsters.json；非魔物系列（鎖甲、巨蜂…）為 null
    "materialMonsters": ["rathalos"],  // 從製作素材名稱推得的魔物，例如巨蜂套裝 → ["vespoid"]
    "setSkill": "rathalos-weakness",   // 對應 set-skills.json 的 id
    "rarityMin": 6, "rarityMax": 9,
    "pieces": {
      "head": {
        "id": "rathalos/head",
        "name": "火龍頭盔", "nameEn": "Rathalos Helm",
        "part": "head", "partLabel": "頭部",
        "series": "rathalos",
        "rarityMin": 6, "rarityMax": 9, "maxDefense": 122,
        "skills": [ { "skillId": "fire-damage-up", "name": "火屬性傷害提升", "level": 1 } ], // 最高稀有度時的技能
        "setSkill": "rathalos-weakness",
        "image": "https://…",
        "stages": [                    // 各稀有度的性能（技能會隨稀有度解鎖／升級）
          {
            "rarity": 6, "name": "火龍頭盔Ⅱ", "defense": 75,
            "skills": [ { "skillId": "…", "name": "…", "level": 1 } ],
            "materials": { "type": "craft", "items": [ { "itemId": "…", "name": "…", "qty": 1 } ] }
          }
        ]
      },
      "chest": {}, "arms": {}, "waist": {}, "legs": {}
    }
  }
]
```

部位 id：`head` 頭部、`chest` 胸部、`arms` 腕部、`waist` 腰部、`legs` 腿部。

### `skills.json`

```jsonc
{
  "id": "weakspot-exploit", "name": "弱點特效", "nameEn": "Weakspot Exploit",
  "description": "攻擊魔物肉質較好的部位時，會心率提升。",
  "maxLevel": 3,
  "sources": ["armor", "set"],          // armor / weapon / set
  "armorCount": 11, "weaponCount": 0,
  "levels": [ { "level": 1, "effect": "攻擊弱點部位時，會心率+4%。" } ]
}
```

### `set-skills.json`

```jsonc
{
  "id": "rathalos-weakness", "name": "火龍的弱襲",
  "requiredPieces": 3,
  "bonusLabel": "弱點特效+1",
  "bonusEffect": "攻擊魔物肉質較好的部位時，會心率+4%。",
  "grants": [ { "skillId": "weakspot-exploit", "skillName": "弱點特效", "level": 1 } ],
  "series": ["rathalos"]
}
```

### `monsters.json`

```jsonc
{
  "id": "rathalos", "name": "火龍", "nameEn": "Rathalos",
  "image": "https://img.gamewith.jp/img/….png",   // 148×148 圖示
  "size": "大型", "species": "飛龍種",
  "habitats": ["沙嵐綠洲", "大沙海", "邊野", "沉積泥湖", "雲煙林地"],
  "weakness": [ { "element": "龍", "stars": 3 } ],
  "ailments": [ { "ailment": "睡眠", "stars": 2 } ],
  "hitzones": [ { "label": "頭部", "cut": 3, "blunt": 3, "ammo": 3 } ]
}
```

配裝頁的魔物篩選規則：系列有 `monster` 就用它，沒有的話用 `materialMonsters`（所以巨蜂／燕尾蝶／獨角仙套裝都歸在「巨蜂」底下），兩者都沒有的歸在「無魔物素材」。

### 已知的來源資料缺漏

- 「融光種大凶顎龍套裝」在來源網站的魔物連結指向小型的「融光種凶顎龍」，但素材全是「融光種大凶顎龍的…」，所以 `parse_pages.py` 的 `MONSTER_OVERRIDES` 把它修正為 `radiant-great-girros`。
- `radiant-jyuratodus/arms` 稀有度 10 的「獵手直覺」來源網站沒有標等級 → `level: null`（配裝頁暫以 Lv1 計算並標「?」）。
- 套裝「土砂龍的泥障」加成「泥耐性+1」，但來源網站沒有「泥耐性」技能頁 → `grants[0].skillId: null`。
- 套裝「搔鳥的閃擊」標籤寫「全力+1」，實際加成的是技能「極力」（`instinct`）。
- `carving-pro`（剝取鐵人）與 5 個「冒險團之力」技能沒有總說明（`description: null`），但各等級效果有資料。

## 更新資料

```bash
rm -rf scripts/.cache
python3 scripts/fetch_pages.py     # 下載約 330 頁（含魔物一覽）到 scripts/.cache
python3 scripts/parse_pages.py     # 重新產生 src/data/*.json
```
