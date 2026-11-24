# 遊戲資料更新流程

`src/data/*.json` 是網站使用的正式資料。GameWith 是技能、防具與魔物的主要來源；若 GameWith 的技能說明或等級效果缺漏，才用 MHO Hub 技能頁補充。MHO Hub 不用來新增防具或魔物。抓取會下載數百個頁面，解析器會一次產生多份 JSON；**不要在第一次解析時直接輸出到 `src/data/`**。先在系統暫存目錄產生，再檢查差異。

## 完整抓取與解析

在專案根目錄執行。需要已安裝 Python 3 和專案 npm 相依套件。

```bash
CACHE="$(mktemp -d "${TMPDIR:-/tmp}/mho-data.XXXXXX")"
python3 scripts/fetch_pages.py "$CACHE"
python3 scripts/parse_pages.py "$CACHE" "$CACHE/generated"
```

使用全新的暫存目錄可避免抓取腳本重用舊頁面。抓取過程會在 `CACHE` 中建立 GameWith 頁面及一個 MHO Hub 技能頁，檔案數量多、容量也可能數十 MB；它們不是網站資料，也不應提交到 Git。

## 檢查輸出，再決定是否採用

1. 檢查解析器輸出中的 `WARN`、`FAIL`、`mismatch`。若出現未預期錯誤，先不要複製輸出。
2. 比較暫存輸出與正式資料：

   ```bash
   diff -ru src/data "$CACHE/generated"
   ```

   大量技能突然變成空陣列、資料筆數大幅減少、或原有系列消失，都代表解析結果不可信；不要整批覆蓋。
3. 確認差異合理後，只複製要更新的 JSON 檔案到 `src/data/`，不要未檢查就整批複製。
4. 在專案根目錄執行 `npm run build`，再檢查 `git status --short` 與 `git diff --stat`，確認只有預期檔案變更。
5. 完成比對後，刪除命令輸出的那個暫存目錄。它位於系統暫存區，不在專案內；刪除前先確認 `CACHE` 的實際路徑。

若只修正單一裝備或技能，不必重新抓取數百頁；直接修改對應資料並檢查 JSON／建置即可。

## 腳本注意事項

- `scripts/fetch_pages.py [cache_dir]`：下載 GameWith 技能、防具等頁面，以及 MHO Hub 技能補充頁；傳入全新的目錄可確保不沿用舊快取。
- `scripts/parse_pages.py [cache_dir] [out_dir]`：解析快取。務必提供 `out_dir`，並指向暫存目錄，而非 `src/data/`。
- `parse_pages.py` 會容忍來源頁面空白防禦值及部分 HTML 屬性變動；但來源網站仍可能改版，故每次都要人工檢查解析警告與輸出差異。
- 抓取完成後不需要把 HTML 快取加入版本控制；專案已忽略 `scripts/.cache` 與 `scripts/.cache-refresh/`，建議仍使用系統暫存目錄。
