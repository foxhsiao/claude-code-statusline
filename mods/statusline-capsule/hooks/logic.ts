import type { Checks, Deploy, Remote } from '../types'

export type Tone = 'ok' | 'warn' | 'bad' | 'dim'
export type Chip = { text: string; tone: Tone }

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

// what the git capsule says about the PR, CI and production; nothing when there is nothing to say
export const chips = (r: Remote): Chip[] => {
  const out: Chip[] = []

  if (r.pr) {
    const { number: n, state, isDraft, checks } = r.pr
    if (state === 'MERGED') out.push({ text: `#${n} 已合併`, tone: 'ok' })
    else if (state === 'CLOSED') out.push({ text: `#${n} 已關閉`, tone: 'bad' })
    else out.push({ text: `#${n}${isDraft ? ' 草稿' : ''}`, tone: 'warn' })

    // one Nerd Font icon for the CI state: circle-check, circle-x, refresh. These line up with the capsule's
    // other icons; the plain U+25CF dot used before drew below the text baseline in the terminal.
    if (checks === 'pass') out.push({ text: '\u{f058}', tone: 'ok' })
    else if (checks === 'fail') out.push({ text: '\u{f057}', tone: 'bad' })
    else if (checks === 'pending') out.push({ text: '\u{f021}', tone: 'warn' })
  } else if (r.branch !== r.defaultBranch && r.isInMain) {
    out.push({ text: `已進 ${r.defaultBranch}`, tone: 'ok' })
  }

  if (r.deploy) {
    // the Nerd Font rocket marks the deploy: green when production runs main's latest, red when it is behind,
    // yellow with a ? when it could not be read
    if (r.deploy.status === 'current') out.push({ text: '\u{f135}', tone: 'ok' })
    else if (r.deploy.status === 'behind') out.push({ text: '\u{f135}', tone: 'bad' })
    else out.push({ text: '\u{f135}?', tone: 'warn' })
  }

  return out
}
