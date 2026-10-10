import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Info } from '../types'

const info = atom({ plugin: 'statusline-capsule', key: 'info' } as const, null)

// Nerd Font glyphs (code points as in statusline.sh)
const CAP_L = ''
const CAP_R = ''
const I_DIR = ''
const I_BRANCH = '\u{f062c}'
const I_DIFF = '\u{f0993}'
const I_USER = ''
const I_H5 = ''
const I_D7 = ''
const I_LOGO = '\u{f14de}'
const CTX_ICONS = [0xf0a9e, 0xf0a9f, 0xf0aa0, 0xf0aa1, 0xf0aa2, 0xf0aa3, 0xf0aa4, 0xf0aa5].map(c =>
  String.fromCodePoint(c),
)

// Google palette
const BG_CC = '#34a853'
const BG_LOGO = '#ea4335'
const BG_DIR = '#4285f4'
const BG_GIT = '#fbbc05'
const BG_USE = '#5f6368'
const WHITE = '#ffffff'
const DARK = '#202124'
const FG_ADD = '#137333'
const FG_DEL = '#a50e0e'

const levelColor = (n: number) =>
  n >= 90 ? '#f28b82' : n >= 75 ? '#fcad70' : n >= 60 ? '#fdd663' : n >= 40 ? '#81c995' : WHITE

// claude-sonnet-5-5 -> Sonnet 5.5, claude-3-5-sonnet-20241022 -> Sonnet 3.5; anything else as is
const cap1 = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)
const modelName = (id: string) => {
  const base = id.replace(/\[.*\]$/, '').replace(/ \(.*/, '')
  const m =
    /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/.exec(base) ??
    /^claude-(\d+)(?:-(\d{1,2}))?-([a-z]+)(?:-\d{8})?$/.exec(base)
  if (!m) return base
  const [family, major, minor] = /^\d/.test(m[1]) ? [m[3], m[1], m[2]] : [m[1], m[2], m[3]]
  return `${cap1(family)} ${major}${minor ? `.${minor}` : ''}`
}

// display cells: CJK / fullwidth count 2, everything else 1 (Nerd Font glyphs are single-cell)
const cells = (str: string) => {
  let w = 0
  for (const ch of str) {
    const c = ch.codePointAt(0) ?? 0
    w += (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6) ? 2 : 1
  }
  return w
}

// shorten to at most `max` display cells, ending in … when cut
const truncate = (str: string, max: number) => {
  if (cells(str) <= max) return str
  let out = ''
  let w = 0
  for (const ch of str) {
    const cw = cells(ch)
    if (w + cw > max - 1) break
    out += ch
    w += cw
  }
  return `${out}…`
}
const MAX_DIR = 20
const MAX_BRANCH = 24

const ctxIcon = (n: number) => {
  const k = Math.min(8, Math.max(1, Math.floor((n * 8 + 99) / 100)))
  return CTX_ICONS[k - 1]
}

async function refresh($: EngineInterface) {
  const cwd = await $.session.cwd()
  const model = modelName(await $.session.model())
  const usage = await $.session.usage()
  const pick = (kind: string) => usage.rateLimits.find(r => r.kind === kind)?.percentUsed ?? null

  let branch: string | null = null
  let add = 0
  let del = 0
  try {
    const inRepo = await $.process.run(['git', 'rev-parse', '--is-inside-work-tree'], { cwd })
    if (inRepo.exitCode === 0) {
      branch = (await $.process.run(['git', 'branch', '--show-current'], { cwd })).stdout.trim()
      if (!branch) {
        branch = (await $.process.run(['git', 'rev-parse', '--short', 'HEAD'], { cwd })).stdout.trim()
      }
      if (!branch) branch = '(new)'
      let st = (await $.process.run(['git', 'diff', '--shortstat', 'HEAD'], { cwd })).stdout
      if (!st.trim()) st = (await $.process.run(['git', 'diff', '--shortstat'], { cwd })).stdout
      add = Number(/(\d+) insertion/.exec(st)?.[1] ?? 0)
      del = Number(/(\d+) deletion/.exec(st)?.[1] ?? 0)
    }
  } catch {
    branch = null
  }

  let acct: string | null = null
  try {
    const home = (await $.process.run(['printenv', 'HOME'])).stdout.trim()
    const cfg = JSON.parse(await $.fs.read(`${home}/.claude.json`))
    acct = cfg?.oauthAccount?.displayName ?? cfg?.oauthAccount?.emailAddress ?? null
  } catch {
    acct = null
  }

  const next: Info = {
    model,
    dir: cwd.split('/').filter(Boolean).pop() ?? cwd,
    branch,
    add,
    del,
    acct,
    ctx: usage.context.percent ?? null,
    h5: pick('five_hour'),
    d7: pick('seven_day'),
  }
  await update($, info, () => next)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await refresh($).catch(() => {})
    return next(e)
  })
  on('session.measure', async ($, e, next) => {
    await refresh($).catch(() => {})
    return next(e)
  })
  // tool calls change the working tree: refresh git after each one that writes
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.isReadOnly !== true) await refresh($).catch(() => {})
    return ran
  })
  on('turn.complete', async ($, e, next) => {
    await refresh($).catch(() => {})
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // another mod's band (ship-band) may sit beneath this one: draw above it instead of replacing it
    const below = await next(e)
    const i = await read($, info)
    if (i === null || e.props.hasSurvey) return below

    const { Box, Text } = $.ui.resolve(e)

    const Cap = (p: { bg: string; fg: string; children?: unknown }) => (
      <Box>
        <Text color={p.bg}>{CAP_L}</Text>
        <Text backgroundColor={p.bg} color={p.fg}>
          {p.children}
        </Text>
        <Text color={p.bg}>{CAP_R} </Text>
      </Box>
    )

    const uses: [string, number][] = []
    if (i.ctx !== null) uses.push([ctxIcon(i.ctx), i.ctx])
    if (i.h5 !== null) uses.push([I_H5, i.h5])
    if (i.d7 !== null) uses.push([I_D7, i.d7])

    const dir = truncate(i.dir, MAX_DIR)
    const branch = i.branch === null ? null : truncate(i.branch, MAX_BRANCH)

    // each capsule is its text plus the two caps and a trailing space
    const useText = ' ' + uses.map(([icon, n], idx) => `${idx > 0 ? '  ' : ''}${icon} ${Math.floor(n)}%`).join('') + ' '
    const w = {
      acct: i.acct === null ? 0 : cells(` ${I_USER} ${i.acct} `) + 3,
      model: cells(` ${I_LOGO} ${i.model} `) + 3,
      dir: cells(` ${I_DIR} ${dir} `) + 3,
      git: branch === null ? 0 : cells(` ${I_BRANCH} ${branch}  ${I_DIFF} +${i.add} -${i.del} `) + 3,
      use: uses.length === 0 ? 0 : cells(useText) + 2,
    }
    // too narrow: drop the account, then the folder, then git; model and usage stay
    const show = { acct: true, dir: true, git: true }
    const total = () =>
      w.model + w.use + (show.acct ? w.acct : 0) + (show.dir ? w.dir : 0) + (show.git ? w.git : 0)
    for (const k of ['acct', 'dir', 'git'] as const) {
      if (total() <= e.props.bodyColumns) break
      show[k] = false
    }

    const mine = (
      <Box>
        {show.acct && i.acct !== null && <Cap bg={BG_CC} fg={WHITE}>{` ${I_USER} ${i.acct} `}</Cap>}
        <Cap bg={BG_LOGO} fg={WHITE}>{` ${I_LOGO} ${i.model} `}</Cap>
        {show.dir && <Cap bg={BG_DIR} fg={WHITE}>{` ${I_DIR} ${dir} `}</Cap>}
        {show.git && branch !== null && (
          <Box>
            <Text color={BG_GIT}>{CAP_L}</Text>
            <Text backgroundColor={BG_GIT} color={DARK}>{` ${I_BRANCH} ${branch}  ${I_DIFF} `}</Text>
            <Text backgroundColor={BG_GIT} color={FG_ADD}>{`+${i.add} `}</Text>
            <Text backgroundColor={BG_GIT} color={FG_DEL}>{`-${i.del} `}</Text>
            <Text color={BG_GIT}>{CAP_R} </Text>
          </Box>
        )}
        {uses.length > 0 && (
          <Box>
            <Text color={BG_USE}>{CAP_L}</Text>
            <Text backgroundColor={BG_USE} color={WHITE}>{' '}</Text>
            {uses.map(([icon, n], idx) => (
              <Box key={icon}>
                <Text backgroundColor={BG_USE} color={WHITE}>{`${idx > 0 ? '  ' : ''}${icon} `}</Text>
                <Text backgroundColor={BG_USE} color={levelColor(n)}>{`${Math.floor(n)}%`}</Text>
              </Box>
            ))}
            <Text backgroundColor={BG_USE} color={WHITE}>{' '}</Text>
            <Text color={BG_USE}>{CAP_R}</Text>
          </Box>
        )}
      </Box>
    )

    return below ? <Box flexDirection="column">{mine}{below}</Box> : mine
  })
}
