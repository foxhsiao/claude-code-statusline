import type { Checks, Deploy, Ship } from '../types'

export type Tone = 'ok' | 'warn' | 'bad' | 'dim'
export type Seg = { text: string; tone: Tone }

export type DeployConfig = { url: string; header?: string; pattern?: string }

// gh's statusCheckRollup mixes CheckRun (status/conclusion) and StatusContext (state)
export const rollup = (items: unknown): Checks => {
  if (!Array.isArray(items) || items.length === 0) return 'none'
  let isPending = false
  for (const raw of items) {
    const it = (raw ?? {}) as Record<string, unknown>
    const state = String(it.state ?? '').toUpperCase()
    const status = String(it.status ?? '').toUpperCase()
    const conclusion = String(it.conclusion ?? '').toUpperCase()
    if (['FAILURE', 'ERROR'].includes(state)) return 'fail'
    if (['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE'].includes(conclusion)) {
      return 'fail'
    }
    if (state === 'PENDING' || state === 'EXPECTED') isPending = true
    if (status && status !== 'COMPLETED') isPending = true
  }
  return isPending ? 'pending' : 'pass'
}

export const parseConfig = (text: string): DeployConfig | null => {
  try {
    const url = (JSON.parse(text) as { deploy?: { url?: unknown; header?: unknown; pattern?: unknown } }).deploy
    if (!url || typeof url.url !== 'string' || !/^https?:\/\//.test(url.url)) return null
    return {
      url: url.url,
      header: typeof url.header === 'string' ? url.header.toLowerCase() : undefined,
      pattern: typeof url.pattern === 'string' ? url.pattern : undefined,
    }
  } catch {
    return null
  }
}

// the first commit-looking token: the pattern's first group when it has one, else the whole match
export const findSha = (text: string, pattern?: string): string | null => {
  let re: RegExp
  try {
    re = new RegExp(pattern ?? '\\b[0-9a-f]{7,40}\\b', 'i')
  } catch {
    return null
  }
  const m = re.exec(text)
  const hit = m ? (m[1] ?? m[0]) : null
  return hit && /^[0-9a-f]{7,40}$/i.test(hit) ? hit.toLowerCase() : null
}

export const compareDeploy = (deployed: string | null, main: string | null): Deploy['status'] => {
  if (!deployed || !main) return 'unknown'
  const a = deployed.toLowerCase()
  const b = main.toLowerCase()
  return a.startsWith(b) || b.startsWith(a) ? 'current' : 'behind'
}

const short = (s: string | null) => (s ? s.slice(0, 7) : '?')

export const segments = (s: Ship): Seg[] => {
  const out: Seg[] = []
  const onDefault = s.branch === s.defaultBranch

  if (s.pr) {
    const tag = s.pr.isDraft ? ' 草稿' : ''
    if (s.pr.state === 'MERGED') out.push({ text: `PR #${s.pr.number} ✓ 已合併`, tone: 'ok' })
    else if (s.pr.state === 'CLOSED') out.push({ text: `PR #${s.pr.number} 已關閉`, tone: 'bad' })
    else out.push({ text: `PR #${s.pr.number}${tag} 未合併`, tone: 'warn' })

    if (s.pr.checks === 'pass') out.push({ text: 'CI ✓', tone: 'ok' })
    else if (s.pr.checks === 'fail') out.push({ text: 'CI ✗ 失敗', tone: 'bad' })
    else if (s.pr.checks === 'pending') out.push({ text: 'CI ● 執行中', tone: 'warn' })
    else out.push({ text: 'CI —', tone: 'dim' })
  } else if (!onDefault) {
    out.push(
      s.isInMain
        ? { text: '✓ 已進 main', tone: 'ok' }
        : { text: '無 PR', tone: 'dim' },
    )
  }

  if (s.deploy) {
    const d = s.deploy
    if (d.status === 'current') out.push({ text: '部署 ✓ 最新', tone: 'ok' })
    else if (d.status === 'behind') {
      out.push({ text: `部署 ✗ 落後 ${short(d.deployed)} → ${short(d.main)}`, tone: 'bad' })
    } else if (d.status === 'error') out.push({ text: '部署 ? 讀不到', tone: 'warn' })
    else out.push({ text: '部署 ? 認不出版本', tone: 'warn' })
  }

  // ahead/behind counts live in the statusline-capsule git capsule; only a branch never pushed is said here
  if (!s.hasUpstream && !onDefault) out.push({ text: '未推送', tone: 'warn' })

  return out
}
