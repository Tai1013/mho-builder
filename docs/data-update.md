# 遊戲資料更新流程

`src/data/*.json` 是網站使用的正式資料。抓取會下載數百個頁面，解析器會一次產生多份 JSON；**不要在第一次解析時直接輸出到 `src/data/`**。先在系統暫存目錄產生，再檢查差異。

## 完整抓取與解析

在專案根目錄執行。需要已安裝 Python 3 和專案 npm 相依套件。

```bash
CACHE="$(mktemp -d "${TMPDIR:-/tmp}/mho-data.XXXXXX")"
python3 scripts/fetch_pages.py "$CACHE"
python3 scripts/parse_pages.py "$CACHE" "$CACHE/generated"
```

使用全新的暫存目錄可避免抓取腳本重用舊頁面。抓取過程會在 `CACHE` 中建立 GameWith 與 MHOHub HTML 頁面，檔案數量多、容量也可能達數十 MB；它們不是網站資料，也不應提交到 Git。

## 檢查輸出，再決定是否採用

1. 檢查解析器輸出中的 `WARN`、`FAIL`、`NEED level`、`mismatch`。若出現未預期錯誤，先不要複製輸出。
2. 比較暫存輸出與正式資料：

   ```bash
   diff -ru src/data "$CACHE/generated"
   ```

   大量技能突然變成空陣列、資料筆數大幅減少、或原有系列消失，都代表解析結果不可信；不要整批覆蓋。
3. 確認差異合理後，只複製要更新的 JSON 檔案到 `src/data/`，不要未檢查就整批複製。
4. 在專案根目錄執行 `npm run build`，再檢查 `git status --short` 與 `git diff --stat`，確認只有預期檔案變更。
5. 完成比對後，刪除命令輸出的那個暫存目錄。它位於系統暫存區，不在專案內；刪除前先確認 `CACHE` 的實際路徑。

若只修正單一裝備或技能，不必重新抓取數百頁；直接修改對應資料並檢查 JSON／建置即可。

## 手動確認資料

來源網站可能沒有標出遊戲內的技能等級。這類使用者確認的固定值記在 `scripts/manual_data.json` 的 `skillLevelOverrides`，不要只手動改 `src/data/armor.json`，否則下次重新解析會被來源資料覆蓋。

每筆以系列 id、部位 id、技能名稱為鍵，例如：

```json
{ "armor": "radiant-rathalos", "part": "arms", "skill": "火屬性傷害提升", "level": 3, "note": "使用者提供" }
```

`part` 使用 `head`、`chest`、`arms`、`waist`、`legs`。加入覆寫後，依前述方式重新解析到暫存輸出，確認 `armor.json` 中最高階的技能等級正確，再採用變更。若覆寫有 `temporary: true`，只有在來源值相符時解析器才會提示可以移除；非暫時的使用者確認資料會持續優先於來源值。

## 腳本注意事項

- `scripts/fetch_pages.py [cache_dir]`：下載來源頁面；傳入全新的目錄可確保不沿用舊快取。
- `scripts/parse_pages.py [cache_dir] [out_dir]`：解析快取。務必提供 `out_dir`，並指向暫存目錄，而非 `src/data/`。
- `parse_pages.py` 會容忍來源頁面空白防禦值及部分 HTML 屬性變動；但來源網站仍可能改版，故每次都要人工檢查解析警告與輸出差異。
- 抓取完成後不需要把 HTML 快取加入版本控制；專案已忽略 `scripts/.cache` 與 `scripts/.cache-refresh/`，建議仍使用系統暫存目錄。
