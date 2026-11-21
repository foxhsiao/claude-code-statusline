import type { Checks, Remote } from '../types'

export type Tone = 'ok' | 'warn' | 'bad' | 'dim'
export type Chip = { text: string; tone: Tone }

// The terminal capsule's Nerd Font glyphs. The apps' font has none of them, so there the capsules are SVG
// pills (pill.ts) instead.
export type Glyphs = {
  capL: string
  capR: string
  dir: string
  branch: string
  diff: string
  user: string
  h5: string
  d7: string
  logo: string
  // one per eighth of the context used, emptiest first
  ctx: string[]
  ciPass: string
  ciFail: string
  ciPending: string
}

export const NERD: Glyphs = {
  capL: '\u{e0b6}',
  capR: '\u{e0b4}',
  dir: '\u{f114}',
  branch: '\u{f062c}',
  diff: '\u{f0993}',
  user: '\u{f1a0}',
  h5: '\u{f017}',
  d7: '\u{f455}',
  logo: '\u{f14de}',
  ctx: [0xf0a9e, 0xf0a9f, 0xf0aa0, 0xf0aa1, 0xf0aa2, 0xf0aa3, 0xf0aa4, 0xf0aa5].map(c => String.fromCodePoint(c)),
  // circle-check, circle-x, refresh: these line up with the other icons; the plain U+25CF dot used before
  // drew below the text baseline in the terminal
  ciPass: '\u{f058}',
  ciFail: '\u{f057}',
  ciPending: '\u{f021}',
}


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

// what the git capsule says about the PR and CI; nothing when there is nothing to say
export const chips = (r: Remote, g: Glyphs = NERD): Chip[] => {
  const out: Chip[] = []

  if (r.pr) {
    const { number: n, state, isDraft, checks } = r.pr
    if (state === 'MERGED') out.push({ text: `#${n} 已合併`, tone: 'ok' })
    else if (state === 'CLOSED') out.push({ text: `#${n} 已關閉`, tone: 'bad' })
    else out.push({ text: `#${n}${isDraft ? ' 草稿' : ''}`, tone: 'warn' })

    if (checks === 'pass') out.push({ text: g.ciPass, tone: 'ok' })
    else if (checks === 'fail') out.push({ text: g.ciFail, tone: 'bad' })
    else if (checks === 'pending') out.push({ text: g.ciPending, tone: 'warn' })
  } else if (r.branch !== r.defaultBranch && r.isInMain) {
    out.push({ text: `已進 ${r.defaultBranch}`, tone: 'ok' })
  }

  return out
}

// a branch that was never pushed: no upstream and nothing showing it left the machine. A PR or a landed
// commit proves it was pushed, even when the upstream is not set (or is gone after the branch was deleted).
export const isUnpushed = (r: Remote, hasUpstream: boolean): boolean =>
  !hasUpstream && r.branch !== r.defaultBranch && r.pr === null && !r.isInMain
