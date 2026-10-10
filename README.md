# claude-code-statusline

Claude Code 的 powerline 膠囊風格狀態列（Google 四色）。

顯示：帳號 ｜ 火箭 logo + 目前模型（如 `Sonnet 5.5`）｜ 資料夾 ｜ git 分支與增刪行數 ｜ 用量（context %、5h %、7d %）

有兩種版本：

- **mod（建議）**：`mods/statusline-capsule/`，膠囊畫在提示框上方。
- **shell script**：`statusline.sh`，走 `settings.json` 的 `statusLine`，畫在提示框下方。

![statusline screenshot](docs/screenshot.png)

上圖是寬度足夠時的畫面，五個膠囊由左到右依序是帳號、模型、資料夾、git（分支與增刪行數）、用量（context、5h、7d）。終端機變窄或開啟側欄時會自動隱藏部分膠囊，見[窄終端機與長名稱](#窄終端機與長名稱)。

## 需求

- [Nerd Font](https://www.nerdfonts.com/)（兩種版本都需要）
- `git`
- shell script 版另外需要 `jq`、`bash`

## 安裝 Nerd Font

圖示依賴 Nerd Font，沒裝的話會顯示成方框或亂碼。

**macOS（Homebrew）**

```sh
brew install --cask font-jetbrains-mono-nerd-font
```

其他字型可用 `brew search nerd-font` 查詢，例如 `font-meslo-lg-nerd-font`、`font-fira-code-nerd-font`。

**Linux**

```sh
mkdir -p ~/.local/share/fonts
curl -fLo /tmp/JetBrainsMono.zip https://github.com/ryanoasis/nerd-fonts/releases/latest/download/JetBrainsMono.zip
unzip -o /tmp/JetBrainsMono.zip -d ~/.local/share/fonts
fc-cache -fv
```

**Windows**

到 [Nerd Fonts 下載頁](https://www.nerdfonts.com/font-downloads) 下載字型，解壓後選取 `.ttf` 檔，按右鍵選「為所有使用者安裝」。

**安裝後：把終端機字型換成 Nerd Font**

安裝字型不會自動生效，要在終端機設定裡選用它（字型名稱結尾通常是 `Nerd Font` 或 `NF`）：

- Terminal.app：設定 → 描述檔 → 文字 → 字體
- iTerm2：Settings → Profiles → Text → Font
- VS Code 內建終端機：設定 `terminal.integrated.fontFamily`，例如 `"JetBrainsMono Nerd Font"`
- Warp：Settings → Appearance → Text → Terminal font

## 安裝 mod 版（statusline-capsule）

`mods/statusline-capsule/` 是 Claude Code mod：膠囊畫在提示框上方，資料來自 `$.session`，不需要 `jq` 或 `settings.json` 的 `statusLine`。

```
/plugin install statusline-capsule --marketplace foxhsiao/claude-code-statusline
```

輸入後依序按 `y` 加入 marketplace、選 scope（選 user 就會套用到所有 session）。

從本機資料夾安裝：

```
/plugin install statusline-capsule --marketplace /path/to/claude-code-statusline
```

只想在單一 session 試用：`claude --plugin-dir mods/statusline-capsule`。改完程式後在 session 內執行 `/reload-plugins`。

改用 mod 後，可以把 `settings.json` 裡原本的 `statusLine` 區塊移除，避免兩條同時出現。

更新：改程式後要把 `mods/statusline-capsule/.claude-plugin/plugin.json` 的 `version` 加一，否則已安裝的人 `claude plugin update` 會判斷沒有新版。

### 窄終端機與長名稱

膠囊寬度依提示框上方可用的欄數（`bodyColumns`）計算，中日韓字元算 2 格。空間不夠時，整個膠囊依序隱藏：

1. 帳號
2. 資料夾
3. git 分支與增刪行數

模型與用量永遠保留。隱藏是整個膠囊一起拿掉，不會把單一膠囊截短。

資料夾與分支名超過上限時，保留開頭並以 `…` 結尾（結尾的內容會被截掉）：

| 常數 | 預設 | 說明 |
| --- | --- | --- |
| `MAX_DIR` | 20 | 資料夾名稱最多顯示格數 |
| `MAX_BRANCH` | 24 | 分支名稱最多顯示格數 |

實際畫面：Claude Code 視窗左邊開著側欄（spaces／agents），內容區只剩約 66 欄時，提示框上方只剩 `Sonnet 5.5` 與用量（context、5h、7d）兩個膠囊，單行顯示、不折行，右側的 `[-]` 也保留。關掉側欄、內容區變寬後，隱藏的膠囊會回來。資料夾名稱過長時則在寬度足夠的情況下以 `…` 結尾，例如 `claude-code-statusl…`。

截斷發生在寬度判斷之前，所以隱藏順序用的是截斷後的實際寬度。常數在 `mods/statusline-capsule/hooks/register.tsx`。

版本異動見 [CHANGELOG.md](CHANGELOG.md)。

## 安裝 ship-band mod

`mods/ship-band/` 在提示框上方多一行發佈狀態：目前分支的 PR、CI、是否已合併、工作區是否乾淨，以及（選用）正式站是不是 main 的最新版。需要 `git` 和 [`gh`](https://cli.github.com/)（已登入）。

```
/plugin install ship-band --marketplace foxhsiao/claude-code-statusline
```

正式站版本比對要在 repo 根目錄放 `.ship-band.json`，格式見 [`mods/ship-band/README.md`](mods/ship-band/README.md)。

和 statusline-capsule 同時安裝時，兩者共用提示框上方這個位置，同一時間只有一個 mod 的畫面會被採用：ship-band 會把排在它下面的 mod 一起畫出來，statusline-capsule 目前不會。所以兩者的先後順序決定看得到哪一個；若只看到膠囊、沒有 `發佈` 這一行，代表 ship-band 排在膠囊下面被蓋掉了，請回報。

## 安裝 shell script 版

```sh
cp statusline.sh ~/.claude/statusline.sh
chmod +x ~/.claude/statusline.sh
```

再把 `settings.snippet.json` 的 `statusLine` 區塊合併進 `~/.claude/settings.json`。

## 自訂

**mod 版**：圖示、配色在 `mods/statusline-capsule/hooks/register.tsx` 上方的常數區，名稱長度上限 `MAX_DIR`／`MAX_BRANCH` 也在這個檔案；模型顯示名稱由 `modelName()` 從 model ID 轉出。

**shell script 版**：

- 圖示與配色在 `statusline.sh` 上方的 ICON / 配色區。
- `statusline-icons.sh` 可在終端機預覽候選圖示。
- `CC_STYLE` 可選 `solid` / `outline` / `hollow`。
- `CLAUDE_STATUSLINE_DEBUG=1` 會把 stdin JSON 存到 `/tmp/claude-statusline-debug.json`。

## 授權

[MIT License](LICENSE)
