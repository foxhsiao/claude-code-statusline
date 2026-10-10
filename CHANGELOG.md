# Changelog

statusline-capsule mod 的版本紀錄。

## 0.2.0

- 窄終端機自適應：空間不夠時依序隱藏帳號、資料夾、git 膠囊，模型與用量保留。開啟側欄、內容區變窄時也會觸發，膠囊不再折行。
- 資料夾與分支名過長時以 `…` 截斷（`MAX_DIR` = 20、`MAX_BRANCH` = 24 格）。
