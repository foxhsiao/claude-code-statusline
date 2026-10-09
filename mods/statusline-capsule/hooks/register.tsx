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

const ctxIcon = (n: number) => {
  const k = Math.min(8, Math.max(1, Math.floor((n * 8 + 99) / 100)))
  return CTX_ICONS[k - 1]
}

async function refresh($: EngineInterface) {
  const cwd = await $.session.cwd()
  const model = (await $.session.model()).replace(/ \(.*/, '')
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
  on('turn.complete', async ($, e, next) => {
    await refresh($).catch(() => {})
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const i = await read($, info)
    if (i === null || e.props.hasSurvey) return next(e)

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

    return (
      <Box>
        {i.acct !== null && <Cap bg={BG_CC} fg={WHITE}>{` ${I_USER} ${i.acct} `}</Cap>}
        <Cap bg={BG_LOGO} fg={WHITE}>{` ${I_LOGO} ${i.model} `}</Cap>
        <Cap bg={BG_DIR} fg={WHITE}>{` ${I_DIR} ${i.dir} `}</Cap>
        {i.branch !== null && (
          <Box>
            <Text color={BG_GIT}>{CAP_L}</Text>
            <Text backgroundColor={BG_GIT} color={DARK}>{` ${I_BRANCH} ${i.branch}  ${I_DIFF} `}</Text>
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
  })
}
