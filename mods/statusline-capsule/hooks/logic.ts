import type { Checks, Remote } from '../types'

export type Tone = 'ok' | 'warn' | 'bad' | 'dim'
export type Chip = { text: string; tone: Tone }

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

  return out
}

// a branch that was never pushed: no upstream and nothing showing it left the machine. A PR or a landed
// commit proves it was pushed, even when the upstream is not set (or is gone after the branch was deleted).
export const isUnpushed = (r: Remote, hasUpstream: boolean): boolean =>
  !hasUpstream && r.branch !== r.defaultBranch && r.pr === null && !r.isInMain
