# Changelog

statusline-capsule 的版本紀錄（ship-band 已併入，見 0.5.0）。

## statusline-capsule 0.5.7

- 窄視窗多一層最後防線：帳號、資料夾、PR／CI／部署、整個 git 膠囊都隱藏後，模型加用量仍放不下時，會拿掉 5h／7d 的重設倒數，只留百分比。這讓膠囊折行的門檻從約 50 格降到約 40 格。

## statusline-capsule 0.5.6

- 每分鐘的計時器也會重新讀本機 git 狀態（`↑新`、`↑↓`、`+n -n`），不再只在工具呼叫結束時才讀。原本推送與開 PR 發生在同一個長工具呼叫（如 ship 腳本）裡時，PR 與 CI 已經更新，本機狀態卻還停在推送前。
- 有 PR 或分支已進預設分支時，不再顯示 `↑新`：這兩種情況都證明分支推送過了，即使沒有 upstream（沒用 `-u` 推送，或遠端分支合併後被刪）。

## statusline-capsule 0.5.5

- 修正 PR、CI、部署這些網路資料的刷新間隔：原本每分鐘的計時器與「距離上次讀取大於 60 秒」的判斷剛好卡在邊界，約每隔一次就被跳過，實際是 60 到 120 秒才刷新一次。現在提早 5 秒判定到期，改為每 60 秒刷新一次。

## statusline-capsule 0.5.4

- 部署狀態改成火箭圖示（Nerd Font U+F135），取代 `✓部署`、`部署落後`、`?部署` 文字：綠色是正式站已是最新、紅色是落後、黃色加 `?` 是讀不到或認不出版本。注意綠與紅只靠顏色區分，形狀相同。

## statusline-capsule 0.5.3

- CI 狀態改成單一 Nerd Font 圖示，拿掉 `CI` 字樣：通過是圈圈打勾（綠）、失敗是圈圈打叉（紅）、執行中是循環箭頭（黃）。與膠囊其他圖示對齊，也比原本的 `CI✓` 少佔兩格寬度。

## statusline-capsule 0.5.2

- CI 執行中的圓圈改用 Nerd Font 圖示（U+F111），因為原本的 `●` 在終端機裡畫在文字基線下方。**更正**：此版本原先寫的原因（字型沒有 `●`、終端機補字造成偏移）不實，後來查證 `●` 其實在 JetBrainsMono Nerd Font 裡，偏移的真正原因未確認。

## statusline-capsule 0.5.1

- 修復 0.5.0 的外掛驗證失敗：`$` 傳給了不在檔案頂層宣告的函式，`claude plugin validate` 不通過，導致整個 mod 沒有載入、statusline 完全消失。已改成頂層函式，驗證通過。**0.5.0 無法使用，請直接更新到 0.5.1。**

## statusline-capsule 0.5.0

ship-band 併入 statusline-capsule，成為單一 mod。

- 黃色 git 膠囊顯示 PR（`#12`、`#12 已合併`、`#12 草稿`）、CI（`CI✓`、`CI✗`、`CI●`）與正式站部署狀態（`✓部署`、`部署落後`、`?部署`）；沒有 PR、沒設定部署時不顯示，膠囊維持原本長度。
- 沒有 upstream 的新分支在黃色膠囊顯示 `↑新`。
- 窄終端機的隱藏順序變成：帳號、資料夾、PR／CI／部署，最後才整個 git 膠囊。
- `.ship-band.json`（部署比對設定）沿用。PR 與 CI 需要已登入的 `gh`；沒有 `gh` 時只是不顯示這兩項。

**從 ship-band 遷移**：ship-band 已從 marketplace 移除，不再維護。已安裝的人請執行 `claude plugin uninstall ship-band` 與 `claude plugin update statusline-capsule`。獨立的 `發佈` 那一行不再出現，原本的分支名與「工作區 ✓ 乾淨」也不再另外顯示（分支在 git 膠囊裡，未提交變更看 `+n -n`）。

## statusline-capsule 0.4.0

- 黃色 git 膠囊在增刪行數後面顯示 `↑n`（未推送）、`↓n`（待拉取）；同步或沒有 upstream 時不顯示。這段文字也計入寬度判斷。

## ship-band 0.2.0（最後一版）

- `發佈` 標籤改成與膠囊一致的圓角樣式。
- 拿掉分支、工作區狀態與 `↑n 未推送`／`↓n 待拉取`，這些改由 statusline-capsule 的 git 膠囊顯示；沒有 upstream 的分支仍顯示 `未推送`。
- 沒有內容可顯示時（例如乾淨、已同步的預設分支）整行不畫。
- 移除不再使用的 dirty、ahead／behind 計算。

## statusline-capsule 0.3.0

- 5h、7d 用量旁顯示距離重設的倒數（如 `59% 2h10m`、`3d4h`），每分鐘更新一次；沒有重設時間時不顯示。倒數也計入寬度判斷，窄終端機會更早隱藏帳號、資料夾、git。

## statusline-capsule 0.2.1

- 膠囊改為疊在排在它下面的 mod 上方，不再蓋掉 ship-band 的 `發佈` 行，兩者同時安裝時兩行都會顯示。

## statusline-capsule 0.2.0

- 窄終端機自適應：空間不夠時依序隱藏帳號、資料夾、git 膠囊，模型與用量保留。開啟側欄、內容區變窄時也會觸發，膠囊不再折行。
- 資料夾與分支名過長時以 `…` 截斷（`MAX_DIR` = 20、`MAX_BRANCH` = 24 格）。
