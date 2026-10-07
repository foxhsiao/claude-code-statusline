#!/usr/bin/env bash
# ~/.claude/statusline.sh — solid powerline capsules
#
#     acct     Model     dir     branch  +N -N     ctx%  5h%  7d% 
#
# 需要 Nerd Font。圖示集中在下面 ICON 區，要換直接改那幾行。
# CLAUDE_STATUSLINE_DEBUG=1 -> 把 stdin 原始 JSON 存到 /tmp/claude-statusline-debug.json

input=$(cat)
[ "${CLAUDE_STATUSLINE_DEBUG:-0}" = "1" ] && printf '%s' "$input" > /tmp/claude-statusline-debug.json

# ── ICON（Nerd Font 碼位見註解，可自行替換）────────────────────────
I_CAP_L=""   ; I_CAP_R=""    # U+E0B6 / U+E0B4
I_ARC_L=""   ; I_ARC_R=""    # U+E0B7 / U+E0B5  細圓弧（描邊）
I_DIR=""      ; I_BRANCH="󰘬"    # U+F114 / U+F062C
I_DIFF="󰦓"     ; I_USER=""      # U+F0993 / U+F1A0
I_CTX="󰪡"       # circle-slice-1..8（U+F0A9E~F0AA5），依 ctx% 由 ctx_icon 挑格數
I_H5=""       ; I_D7=""        # U+F017 / U+F455
I_LOGO="󱓞"                        # U+F14DE  nf-md-rocket-launch

# ── 配色（hex, 不含 #）Google 企業形象四色 ─────────────────────
# Blue 4285f4 / Red ea4335 / Yellow fbbc05 / Green 34a853 / Grey 202124
BG_LOGO="ea4335" ; FG_LOGO="ffffff"
BG_DIR="4285f4"  ; FG_DIR="ffffff"
BG_GIT="fbbc05"  ; FG_GIT="202124"  ; FG_ADD="137333" ; FG_DEL="a50e0e"
BG_USE="5f6368" ; FG_USE="ffffff"
# 用量文字依百分比換色（灰底上可讀的 Google 淺色調）：
#   <40 白 / 40-59 綠 / 60-74 黃 / 75-89 橙 / >=90 紅
LV_OK="ffffff" ; LV_GREEN="81c995" ; LV_YELLOW="fdd663" ; LV_ORANGE="fcad70" ; LV_RED="f28b82"
BG_CC="34a853"   ; FG_CC="ffffff"   ; FG_DIM="d7f0dd" ; BD_CC="ea4335"

# Claude 那顆的膠囊樣式: solid=實心 / outline=描邊+底色 / hollow=描邊不填底
CC_STYLE="solid"      # solid=跟資料夾那顆同款 / outline=描邊+底色 / hollow=只有框線

# ── 讀 payload ─────────────────────────────────────────────────
q() { printf '%s' "$input" | jq -r "$1 // empty" 2>/dev/null; }

CUR_DIR=$(q '.workspace.current_dir')
MODEL=$(q '.model.display_name')
CTX=$(q '.context_window.used_percentage')
H5=$(q '.rate_limits.five_hour.used_percentage')
D7=$(q '.rate_limits.seven_day.used_percentage')

CUR_DIR="${CUR_DIR:-$PWD}"
DIR=$(basename "$CUR_DIR")

# ── git：分支 + 工作區相對 HEAD 的增刪行數 ─────────────────────
IN_REPO=0 ; BR="" ; GADD=0 ; GDEL=0
if git -C "$CUR_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  IN_REPO=1
  BR=$(git -C "$CUR_DIR" branch --show-current 2>/dev/null)
  # detached HEAD 就退回短 SHA
  [ -z "$BR" ] && BR=$(git -C "$CUR_DIR" rev-parse --short HEAD 2>/dev/null)
  [ -z "$BR" ] && BR="(new)"
  # 已 stage + 未 stage 一起算；還沒有 commit 的新 repo 退回不帶 HEAD
  st=$(git -C "$CUR_DIR" diff --shortstat HEAD 2>/dev/null)
  [ -z "$st" ] && st=$(git -C "$CUR_DIR" diff --shortstat 2>/dev/null)
  GADD=$(printf '%s' "$st" | sed -n 's/.*[^0-9]\([0-9]\{1,\}\) insertion.*/\1/p')
  GDEL=$(printf '%s' "$st" | sed -n 's/.*[^0-9]\([0-9]\{1,\}\) deletion.*/\1/p')
  GADD=${GADD:-0} ; GDEL=${GDEL:-0}
fi

# 登入帳號：payload 沒有這個欄位，從 ~/.claude.json 取
ACCT=$(jq -r '.oauthAccount.displayName // .oauthAccount.emailAddress // empty' \
        "$HOME/.claude.json" 2>/dev/null)

# ── 色碼工具 ───────────────────────────────────────────────────
esc() { # $1=3(前景)|4(背景)  $2=hex
  printf '\033[%s8;2;%d;%d;%dm' "$1" \
    $((16#${2:0:2})) $((16#${2:2:2})) $((16#${2:4:2}))
}

cap() { # $1=bg hex  $2=預設 fg hex  $3=內容（可內嵌色碼）
  printf '%s%s' "$(esc 3 "$1")" "$I_CAP_L"
  printf '%s%s%s' "$(esc 4 "$1")" "$(esc 3 "$2")" "$3"
  printf '\033[0m%s%s\033[0m ' "$(esc 3 "$1")" "$I_CAP_R"
}

capo() { # $1=底色 $2=文字 $3=邊框 $4=內容
  case "$CC_STYLE" in
    solid)
      cap "$1" "$2" "$4" ;;
    hollow)   # 只留左右圓弧，中間不填底色
      printf '%s%s' "$(esc 3 "$3")" "$I_ARC_L"
      printf '%s%s' "$(esc 3 "$2")" "$4"
      printf '%s%s\033[0m ' "$(esc 3 "$3")" "$I_ARC_R" ;;
    *)        # outline: 圓弧描邊 + 填底色
      printf '%s%s' "$(esc 3 "$3")" "$I_ARC_L"
      printf '%s%s%s' "$(esc 4 "$1")" "$(esc 3 "$2")" "$4"
      printf '\033[0m%s%s\033[0m ' "$(esc 3 "$3")" "$I_ARC_R" ;;
  esac
}

# ── 最左：登入帳號 ─────────────────────────────────────────────
[ -n "$ACCT" ] && capo "$BG_CC" "$FG_CC" "$BD_CC" " $I_USER $ACCT "

# ── 第二顆：火箭標誌 + 目前模型 ─────────────────────────────────────────────
LOGO_TXT=" $I_LOGO "
[ -n "$MODEL" ] && LOGO_TXT=" $I_LOGO ${MODEL%% (*} "
cap "$BG_LOGO" "$FG_LOGO" "$LOGO_TXT"

# ── 第三顆：目前資料夾 ─────────────────────────────────────────
cap "$BG_DIR" "$FG_DIR" " $I_DIR $DIR "

# ── 第四顆：git（不在 repo 就整顆不畫）─────────────────────────
if [ "$IN_REPO" = "1" ]; then
  g=" $I_BRANCH $BR  $I_DIFF "
  g="$g$(esc 3 "$FG_ADD")+$GADD $(esc 3 "$FG_DEL")-$GDEL "
  cap "$BG_GIT" "$FG_GIT" "$g"
fi

# ── 第五顆：用量（context / 5h / 7d）──────────────────────────
c=""
S="  "
seg() { [ -n "$c" ] && c="$c$S" ; c="$c$1" ; }

lvl() { # $1=百分比 -> 輸出對應文字色 hex
  local n=${1%.*} ; n=${n:-0}
  if   [ "$n" -ge 90 ]; then printf '%s' "$LV_RED"
  elif [ "$n" -ge 75 ]; then printf '%s' "$LV_ORANGE"
  elif [ "$n" -ge 60 ]; then printf '%s' "$LV_YELLOW"
  elif [ "$n" -ge 40 ]; then printf '%s' "$LV_GREEN"
  else printf '%s' "$LV_OK"; fi
}
use() { # $1=圖示 $2=百分比；圖示維持預設色，只有數字換色
  seg "$1 $(esc 3 "$(lvl "$2")")${2%.*}%$(esc 3 "$FG_USE")"
}

CTX_ICONS=("󰪞" "󰪟" "󰪠" "󰪡" "󰪢" "󰪣" "󰪤" "󰪥")
ctx_icon() { # $1=百分比 -> circle-slice-1..8，1/8 起跳、滿格 8/8
  local n=${1%.*} ; n=${n:-0}
  local k=$(( (n * 8 + 99) / 100 ))
  [ "$k" -lt 1 ] && k=1 ; [ "$k" -gt 8 ] && k=8
  printf '%s' "${CTX_ICONS[k-1]}"
}

[ -n "$CTX" ] && use "$(ctx_icon "$CTX")" "$CTX"
[ -n "$H5" ]  && use "$I_H5" "$H5"
[ -n "$D7" ]  && use "$I_D7" "$D7"

[ -n "$c" ] && cap "$BG_USE" "$FG_USE" " $c "
