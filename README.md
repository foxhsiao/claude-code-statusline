# claude-code-statusline

Claude Code 的 powerline 膠囊風格狀態列（Google 四色）。

顯示：火箭 logo ｜ 資料夾 ｜ git 分支與增刪行數 ｜ 帳號、模型、context %、5h %、7d % 用量

## 需求

- [Nerd Font](https://www.nerdfonts.com/)
- `jq`、`git`、`bash`

## 安裝

```sh
cp statusline.sh ~/.claude/statusline.sh
chmod +x ~/.claude/statusline.sh
```

再把 `settings.snippet.json` 的 `statusLine` 區塊合併進 `~/.claude/settings.json`。

## 自訂

- 圖示與配色在 `statusline.sh` 上方的 ICON / 配色區。
- `statusline-icons.sh` 可在終端機預覽候選圖示。
- `CC_STYLE` 可選 `solid` / `outline` / `hollow`。
- `CLAUDE_STATUSLINE_DEBUG=1` 會把 stdin JSON 存到 `/tmp/claude-statusline-debug.json`。
