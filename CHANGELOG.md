# Changelog

statusline-capsule 與 ship-band 兩個 mod 的版本紀錄。

## statusline-capsule 0.4.0

- 黃色 git 膠囊在增刪行數後面顯示 `↑n`（未推送）、`↓n`（待拉取）；同步或沒有 upstream 時不顯示。這段文字也計入寬度判斷。

## ship-band 0.2.0

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
