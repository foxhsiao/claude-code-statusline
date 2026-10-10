# Changelog

statusline-capsule 的版本紀錄（ship-band 已併入，見 0.5.0）。

## statusline-capsule 0.5.2

- CI 執行中的圓圈改用 Nerd Font 圖示，修正原本的 `●` 因字型補字而垂直置中偏移（往下掉）的問題。

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
