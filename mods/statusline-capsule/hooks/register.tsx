import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Deploy, Info, Limit, Pr, Remote } from '../types'
import { chips, compareDeploy, findSha, isUnpushed, parseConfig, rollup } from './logic'
import type { Tone } from './logic'

const info = atom({ plugin: 'statusline-capsule', key: 'info' } as const, null)
const remote = atom({ plugin: 'statusline-capsule', key: 'remote' } as const, null)

// the network parts (fetch, gh, the deploy URL) are re-read at most this often
const REMOTE_TTL_MS = 60_000
// the minute tick fires on the same period and `at` is stamped before the read, so a strict `>` skipped about
// every other tick (a real refresh every 60-120 s); count a read as due a little early
const REMOTE_SLACK_MS = 5_000

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
const DIM_USE = '#bdc1c6'
const DARK = '#202124'
const FG_ADD = '#137333'
const FG_DEL = '#a50e0e'
// status tones that stay readable on the yellow git capsule
const TONE_GIT: Record<Tone, string> = { ok: FG_ADD, warn: '#8a4b00', bad: FG_DEL, dim: '#5f6368' }

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

// time left until an ISO timestamp as 3d4h / 2h10m / 45m; null once it has passed or can't be read
const fmtReset = (iso: string | null, now: number) => {
  if (iso === null) return null
  const ms = Date.parse(iso) - now
  if (!(ms > 0)) return null
  const mins = Math.ceil(ms / 60000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${d}d${h}h` : h > 0 ? `${h}h${m}m` : `${m}m`
}

const ctxIcon = (n: number) => {
  const k = Math.min(8, Math.max(1, Math.floor((n * 8 + 99) / 100)))
  return CTX_ICONS[k - 1]
}

async function refresh($: EngineInterface) {
  const cwd = await $.session.cwd()
  const model = modelName(await $.session.model())
  const usage = await $.session.usage()
  const pick = (kind: string): Limit | null => {
    const r = usage.rateLimits.find(l => l.kind === kind)
    return r ? { pct: r.percentUsed, resetsAt: r.resetsAt ?? null } : null
  }

  let branch: string | null = null
  let add = 0
  let del = 0
  let ahead = 0
  let behind = 0
  let hasUpstream = false
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
      // exits non-zero without an upstream: then there is nothing to be ahead of or behind
      const ab = await $.process.run(['git', 'rev-list', '--left-right', '--count', 'HEAD...@{u}'], { cwd })
      hasUpstream = ab.exitCode === 0
      const m = hasUpstream ? /^(\d+)\s+(\d+)\s*$/.exec(ab.stdout.trim()) : null
      ahead = Number(m?.[1] ?? 0)
      behind = Number(m?.[2] ?? 0)
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
    ahead,
    behind,
    hasUpstream,
    acct,
    ctx: usage.context.percent ?? null,
    h5: pick('five_hour'),
    d7: pick('seven_day'),
  }
  await update($, info, () => next)
}

type Cache = { key: string; at: number; remote: Remote | null; isBusy: boolean }

async function run($: EngineInterface, cwd: string, argv: string[], timeoutMs = 15_000) {
  try {
    const r = await $.process.run(argv, { cwd, timeoutMs })
    return r.exitCode === 0 ? r.stdout : null
  } catch {
    return null
  }
}

async function readRemote($: EngineInterface, cwd: string, root: string, branch: string): Promise<Remote> {
  const head = (await run($, cwd, ['git', 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD']))?.trim()
  const defaultBranch = head ? head.replace(/^origin\//, '') : 'main'
  const onDefault = branch === defaultBranch

  await run($, cwd, ['git', 'fetch', '--quiet', 'origin', defaultBranch], 20_000)
  const mainSha = (await run($, cwd, ['git', 'rev-parse', `origin/${defaultBranch}`]))?.trim() || null
  const isInMain =
    onDefault || (await run($, cwd, ['git', 'merge-base', '--is-ancestor', 'HEAD', `origin/${defaultBranch}`])) !== null

  let pr: Pr | null = null
  if (!onDefault) {
    const out = await run($, cwd, ['gh', 'pr', 'view', '--json', 'number,state,isDraft,statusCheckRollup'], 20_000)
    if (out) {
      try {
        const j = JSON.parse(out) as { number: number; state: Pr['state']; isDraft: boolean; statusCheckRollup: unknown }
        pr = { number: j.number, state: j.state, isDraft: j.isDraft, checks: rollup(j.statusCheckRollup) }
      } catch {
        pr = null
      }
    }
  }

  let deploy: Deploy | null = null
  let text = ''
  try {
    text = await $.fs.read(`${root}/.ship-band.json`)
  } catch {
    text = ''
  }
  const cfg = parseConfig(text)
  if (cfg) {
    try {
      const res = await $.http.fetch(cfg.url)
      if (!res.ok) {
        deploy = { status: 'error', deployed: null, main: mainSha }
      } else {
        const source = cfg.header ? (res.headers[cfg.header] ?? '') : res.text
        const deployed = findSha(source, cfg.pattern)
        deploy = { status: compareDeploy(deployed, mainSha), deployed, main: mainSha }
      }
    } catch {
      deploy = { status: 'error', deployed: null, main: mainSha }
    }
  }

  return { branch, defaultBranch, isInMain, pr, deploy }
}

async function refreshRemote($: EngineInterface, cache: Cache, isForced: boolean) {
  if (cache.isBusy) return
  cache.isBusy = true
  try {
    const cwd = await $.session.cwd()
    const root = (await run($, cwd, ['git', 'rev-parse', '--show-toplevel']))?.trim()
    if (!root) {
      await update($, remote, () => null)
      return
    }

    const named = (await run($, cwd, ['git', 'branch', '--show-current']))?.trim()
    const branch = named || (await run($, cwd, ['git', 'rev-parse', '--short', 'HEAD']))?.trim() || '(new)'

    const key = `${root}|${branch}`
    const now = await $.clock.now()
    if (isForced || cache.key !== key || cache.remote === null || now - cache.at >= REMOTE_TTL_MS - REMOTE_SLACK_MS) {
      cache.remote = await readRemote($, cwd, root, branch)
      cache.key = key
      cache.at = now
    }

    const next = cache.remote
    await update($, remote, () => next)
  } finally {
    cache.isBusy = false
  }
}

// off the hook's critical path: the network reads must not hold anything back
function kick($: EngineInterface, cache: Cache, isForced: boolean) {
  $.clock.after(0, () => {
    void refreshRemote($, cache, isForced).catch(() => {})
  })
}

// commands that change what the PR / CI / deploy chips show beyond the working tree
const SHIPS = /\b(gh\s+pr|git\s+(push|pull|fetch|merge|switch|checkout)|wrangler|deploy|publish)\b/

export const register: Register = on => {
  let tick: { cancel: () => void } | null = null
  const cache: Cache = { key: '', at: 0, remote: null, isBusy: false }

  on('session.start', async ($, e, next) => {
    // the countdown moves with the clock, not with events: redraw once a minute
    tick?.cancel()
    // the working tree changes inside long tool calls too (a ship script pushes and opens the PR in one), so
    // the local git state is re-read on the same tick, not only when a tool call ends
    tick = $.clock.every(60_000, () => {
      void refresh($).catch(() => {})
      $.ui.invalidate('ui.render')
      kick($, cache, false)
    })
    kick($, cache, true)
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
    if (ran.isReadOnly !== true) {
      await refresh($).catch(() => {})
      kick($, cache, e.tool === 'Bash' && SHIPS.test(String(e.command)))
    }
    return ran
  })
  on('turn.complete', async ($, e, next) => {
    kick($, cache, true)
    await refresh($).catch(() => {})
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // another mod's band may sit beneath this one: draw above it instead of replacing it
    const below = await next(e)
    const i = await read($, info)
    if (i === null || e.props.hasSurvey) return below
    // the network parts belong to a branch: ignore them until they catch up after a switch
    const loaded = await read($, remote)
    const r = loaded !== null && i.branch !== null && loaded.branch === i.branch ? loaded : null

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()

    const Cap = (p: { bg: string; fg: string; children?: unknown }) => (
      <Box>
        <Text color={p.bg}>{CAP_L}</Text>
        <Text backgroundColor={p.bg} color={p.fg}>
          {p.children}
        </Text>
        <Text color={p.bg}>{CAP_R} </Text>
      </Box>
    )

    // icon, percent, time until the window resets (context has none)
    const uses: [string, number, string | null][] = []
    if (i.ctx !== null) uses.push([ctxIcon(i.ctx), i.ctx, null])
    if (i.h5 !== null) uses.push([I_H5, i.h5.pct, fmtReset(i.h5.resetsAt, now)])
    if (i.d7 !== null) uses.push([I_D7, i.d7.pct, fmtReset(i.d7.resetsAt, now)])

    // commits not pushed / not pulled, or ↑新 for a branch never pushed; empty when in sync
    const unpushed = r !== null && isUnpushed(r, i.hasUpstream)
    const sync = `${i.ahead > 0 ? `↑${i.ahead} ` : ''}${i.behind > 0 ? `↓${i.behind} ` : ''}${unpushed ? '↑新 ' : ''}`
    // PR, CI and production, only when there is something to say
    const extra = r === null ? [] : chips(r)
    const extraText = extra.length > 0 ? `│ ${extra.map(c => `${c.text} `).join('')}` : ''
    const dir = truncate(i.dir, MAX_DIR)
    const branch = i.branch === null ? null : truncate(i.branch, MAX_BRANCH)

    // each capsule is its text plus the two caps and a trailing space
    const useText = ' ' + uses.map(([icon, n, reset], idx) => `${idx > 0 ? '  ' : ''}${icon} ${Math.floor(n)}%${reset ? ` ${reset}` : ''}`).join('') + ' '
    const w = {
      acct: i.acct === null ? 0 : cells(` ${I_USER} ${i.acct} `) + 3,
      model: cells(` ${I_LOGO} ${i.model} `) + 3,
      dir: cells(` ${I_DIR} ${dir} `) + 3,
      git: branch === null ? 0 : cells(` ${I_BRANCH} ${branch}  ${I_DIFF} +${i.add} -${i.del} ${sync}`) + 3,
      extra: cells(extraText),
      use: uses.length === 0 ? 0 : cells(useText) + 2,
    }
    // too narrow: drop the account, the folder, the PR/CI/deploy chips, then git; model and usage stay
    const show = { acct: true, dir: true, extra: true, git: true }
    const total = () =>
      w.model +
      w.use +
      (show.acct ? w.acct : 0) +
      (show.dir ? w.dir : 0) +
      (show.git ? w.git + (show.extra ? w.extra : 0) : 0)
    for (const k of ['acct', 'dir', 'extra', 'git'] as const) {
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
            {sync !== '' && <Text backgroundColor={BG_GIT} color={DARK}>{sync}</Text>}
            {show.extra && extra.length > 0 && (
              <Box>
                <Text backgroundColor={BG_GIT} color={TONE_GIT.dim}>{'│ '}</Text>
                {extra.map(c => (
                  <Text key={c.text} backgroundColor={BG_GIT} color={TONE_GIT[c.tone]}>{`${c.text} `}</Text>
                ))}
              </Box>
            )}
            <Text color={BG_GIT}>{CAP_R} </Text>
          </Box>
        )}
        {uses.length > 0 && (
          <Box>
            <Text color={BG_USE}>{CAP_L}</Text>
            <Text backgroundColor={BG_USE} color={WHITE}>{' '}</Text>
            {uses.map(([icon, n, reset], idx) => (
              <Box key={icon}>
                <Text backgroundColor={BG_USE} color={WHITE}>{`${idx > 0 ? '  ' : ''}${icon} `}</Text>
                <Text backgroundColor={BG_USE} color={levelColor(n)}>{`${Math.floor(n)}%`}</Text>
                {reset && <Text backgroundColor={BG_USE} color={DIM_USE}>{` ${reset}`}</Text>}
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
