import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Deploy, Pr, Ship } from '../types'
import { compareDeploy, countLines, findSha, parseAheadBehind, parseConfig, rollup, segments } from './logic'
import type { Tone } from './logic'

const ship = atom({ plugin: 'ship-band', key: 'ship' } as const, null)

// the network parts (fetch, gh, the deploy URL) are re-read at most this often
const REMOTE_TTL_MS = 60_000

const COLORS: Record<Tone, string> = {
  ok: '#81c995',
  warn: '#fdd663',
  bad: '#f28b82',
  dim: '#9aa0a6',
}

type Remote = {
  defaultBranch: string
  isInMain: boolean
  pr: Pr | null
  deploy: Deploy | null
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
  const isInMain = onDefault || (await run($, cwd, ['git', 'merge-base', '--is-ancestor', 'HEAD', `origin/${defaultBranch}`])) !== null

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

  return { defaultBranch, isInMain, pr, deploy }
}

async function refresh($: EngineInterface, cache: Cache, isForced: boolean) {
  if (cache.isBusy) return
  cache.isBusy = true
  try {
    const cwd = await $.session.cwd()
    const root = (await run($, cwd, ['git', 'rev-parse', '--show-toplevel']))?.trim()
    if (!root) {
      await update($, ship, () => null)
      return
    }

    const named = (await run($, cwd, ['git', 'branch', '--show-current']))?.trim()
    const branch = named || (await run($, cwd, ['git', 'rev-parse', '--short', 'HEAD']))?.trim() || '(new)'
    const dirty = countLines((await run($, cwd, ['git', 'status', '--porcelain'])) ?? '')
    const ab = parseAheadBehind((await run($, cwd, ['git', 'rev-list', '--left-right', '--count', 'HEAD...@{u}'])) ?? '')

    const key = `${root}|${branch}`
    const now = await $.clock.now()
    if (isForced || cache.key !== key || cache.remote === null || now - cache.at > REMOTE_TTL_MS) {
      cache.remote = await readRemote($, cwd, root, branch)
      cache.key = key
      cache.at = now
    }

    const r = cache.remote
    const next: Ship = {
      branch,
      defaultBranch: r.defaultBranch,
      dirty,
      ahead: ab ? ab.ahead : null,
      behind: ab ? ab.behind : null,
      hasUpstream: ab !== null,
      isInMain: r.isInMain,
      pr: r.pr,
      deploy: r.deploy,
    }
    await update($, ship, () => next)
  } finally {
    cache.isBusy = false
  }
}

// commands that change what the band shows beyond the working tree
const SHIPS = /\b(gh\s+pr|git\s+(push|pull|fetch|merge|switch|checkout)|wrangler|deploy|publish)\b/

export const register: Register = on => {
  const cache: Cache = { key: '', at: 0, remote: null, isBusy: false }

  on('session.start', async ($, e, next) => {
    $.clock.after(0, () => {
      void refresh($, cache, true).catch(() => {})
    })
    $.clock.every(REMOTE_TTL_MS, () => {
      void refresh($, cache, false).catch(() => {})
    })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.isReadOnly !== true) {
      const isShipping = e.tool === 'Bash' && SHIPS.test(String(e.command))
      // off the tool's critical path: the network reads must not hold the result back
      $.clock.after(0, () => {
        void refresh($, cache, isShipping).catch(() => {})
      })
    }
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    $.clock.after(0, () => {
      void refresh($, cache, true).catch(() => {})
    })
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // another mod's band may sit beneath this one: draw above it instead of replacing it
    const below = await next(e)
    const s = await read($, ship)
    if (s === null || e.props.hasSurvey) return below

    const { Box, Text } = $.ui.resolve(e)
    const parts = segments(s)

    const mine = (
      <Box flexWrap="wrap">
        <Text backgroundColor="#4285f4" color="#ffffff">{' 發佈 '}</Text>
        <Text>{' '}</Text>
        {parts.map((p, i) => (
          <Box key={`${i}`}>
            {i > 0 && <Text color={COLORS.dim}>{' │ '}</Text>}
            <Text color={COLORS[p.tone]}>{p.text}</Text>
          </Box>
        ))}
      </Box>
    )

    return below ? <Box flexDirection="column">{mine}{below}</Box> : mine
  })
}
