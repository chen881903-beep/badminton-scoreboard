# 祥云球场记分板 V2.2 PWA

本資料夾是本地發佈版本，已加入安裝及離線功能。未推送 GitHub，也未啟用 GitHub Pages。原 badminton_web 維持 V2.1。

app.js、scoring.js、style.css 與原 V2.1 完全一致。localStorage 鍵仍是 badminton_web.match.v2，不會因 PWA 安裝或快取更新而清除比賽。

## 本地啟動與離線驗證

在本資料夾開啟 PowerShell：

```powershell
python tools/serve-pwa.py
```

用電腦 Chrome 或 Edge 開啟：

http://localhost:8001/badminton-scoreboard/

此測試伺服器只監聽電腦 loopback，模擬 GitHub Pages 的 /badminton-scoreboard/ 路徑，不影響已有的 8000 伺服器。

1. 首次必須連線載入，等頁面底部顯示「離線資源已準備」。
2. 得分幾球，記下比分、發球球員及站位。
3. 按 F12，進入 Application → Manifest，檢查名稱、圖示、start_url 及 scope。
4. 到 Application → Service Workers，確認 sw.js 已 activated。第一次安裝後可正常重新整理一次，確保頁面由 Service Worker 控制。
5. 在 Network 面板選 Offline，再重新整理；頁面應正常出現，比分不變。
6. 離線得分、撤銷，再重新整理，確認比分與站位均保留。
7. 也可在 PowerShell 按 Ctrl+C 停止測試伺服器，再正常重新整理，以確認真的能離線載入。
8. 測試後取消 Offline。不要使用 Clear site data，該操作會刪除比賽紀錄。

測試伺服器已於本次實測後停止；要再次測試請執行上述指令。切勿用 file: 雙擊 HTML 來測試 PWA，普通記分功能仍可使用，但不能安裝 Service Worker。

## Android 安裝與離線驗證

Service Worker 需要 HTTPS；電腦 localhost 是本地開發例外。原來手機開啟的 http://192.168.1.8:8000 不是安全來源，仍能記分，但不提供離線安裝。不要關閉瀏覽器安全檢查。

待你之後授權發佈 GitHub Pages，預期網址為：

https://chen881903-beep.github.io/badminton-scoreboard/

目前沒有部署，這不是本次已發佈網址。屆時可在 Android Chrome：

1. 連網開啟正式 HTTPS 網址，等待「離線資源已準備」。
2. Chrome 選單 →「新增至主畫面」→「安裝」（實際文字依版本有所不同）。
3. 從主畫面開啟 App，確認獨立視窗與圖示正常。
4. 得分幾球，再開飛航模式、關閉 Wi-Fi。
5. 關閉 App 後重新開啟，確認比分、站位、得分及撤銷正常。

本次已完成電腦真實瀏覽器的離線載入實測；未實際執行 Android 安裝或 GitHub Pages 線上測試。

## 資料保存範圍

- 安裝或更新不會呼叫 localStorage.clear 或 removeItem；比賽資料與應用檔案快取分開保存。
- 同一來源（協定、主機、連接埠）的原 V2.1 資料可繼續使用。網址的查詢參數不影響 localStorage。
- file:、localhost、192.168.1.8、GitHub Pages 是不同來源，瀏覽器不會自動搬移它們的比分。第一次從本地改用 GitHub Pages，不能直接讀到舊本地比分。
- 清除網站資料、解除安裝時選擇清除資料、無痕模式或瀏覽器儲存清理仍可能使紀錄遺失；本機保存不是雲端備份。

## 快取與版本更新

- sw.js 的 VERSION 目前為 2.2.0。任何已快取資源變更時，必須增加此版本號；資源路徑改變時也要同步更新 SHELL 清單與 index.html 引用。
- 所有必要檔案成功下載後，新 Service Worker 才算安裝成功。
- 更新不強制 skipWaiting、不自動重新整理進行中的比賽。偵測到等待中的新版本時，底部提示關閉所有記分板分頁／App 後再開啟。
- 舊視窗關閉後，新版啟用，只刪除這個應用在同一 scope 的舊 Cache Storage，不清除比分，不碰其他應用快取。
- 已控制的頁面使用同一版離線快取，避免新舊 HTML／JS 混用。瀏覽器每次開啟會檢查 Service Worker 更新；離線檢查失敗不阻擋記分。
- 更新必須有網絡；還沒成功快取過的裝置不能首次離線開啟。

## 檔案

新增：

- manifest.webmanifest：應用名稱、相對範圍、獨立視窗及圖示。
- icons/icon-192.png、icons/icon-512.png：深綠球場／羽毛球幾何圖示，包含 maskable 安全留白。
- sw.js：帶版本的離線應用檔案快取。
- pwa.js：註冊及更新提示，不操作比賽資料。
- tools/build-icons.ps1：使用 Windows 內建繪圖 API 重建圖示，無需安裝套件。
- tools/serve-pwa.py：模擬 GitHub Pages 子路徑的本地預覽。
- pwa.test.cjs：PWA 自動化測試。
- test.cjs、legacy-regression.cjs：複製原有測試，在這個發佈資料夾直接驗證。
- README.md、TEST_RESULTS.md：操作與測試說明。

修改 index.html：加入 PWA 引用及離線準備提示，版本文字改為 V2.2；保留原有介面結構。

## 自動測試

已有 Node.js 時執行，無需 npm install：

```powershell
node --test test.cjs pwa.test.cjs
```

預期 22 項通過（原有 13 項 + PWA 9 項）。這些測試用獨立模擬儲存，不修改真實瀏覽器的比分。

參考：[MDN Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)。
