# Changelog

statusline-capsule mod 的版本紀錄。

## 0.2.0

- 窄終端機自適應：空間不夠時依序隱藏帳號、資料夾、git 膠囊，模型與用量保留。
- 資料夾與分支名過長時以 `…` 截斷（`MAX_DIR` = 20、`MAX_BRANCH` = 24 格）。

## 0.1.x

- 新增帳號膠囊；曾加入 outline 與 hollow 樣式，後來移除。
- 每次工具呼叫後重新整理 git 增刪行數。
- 顯示模型名稱（如 `Sonnet 5.5`）。
- 修正 outline 與 hollow 樣式中 `ARC_L`／`ARC_R` 未定義的問題。

## 0.1.0

- 初版：模型、資料夾、git 分支與增刪行數、用量（context、5h、7d）膠囊。
