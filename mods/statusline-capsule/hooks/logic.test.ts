import { describe, expect, test } from 'claude-code/testing'

import type { Remote } from '../types'
import { chips, isUnpushed, rollup } from './logic'

const base: Remote = {
  branch: 'main',
  defaultBranch: 'main',
  isInMain: true,
  pr: null,
}

const texts = (r: Remote) => chips(r).map(c => c.text)

describe('rollup', () => {
  test('empty or missing is none', () => {
    expect(rollup(undefined)).toBe('none')
    expect(rollup([])).toBe('none')
  })
  test('all completed and green is pass', () => {
    expect(rollup([{ status: 'COMPLETED', conclusion: 'SUCCESS' }, { state: 'SUCCESS' }])).toBe('pass')
  })
  test('a running check is pending', () => {
    expect(rollup([{ status: 'COMPLETED', conclusion: 'SUCCESS' }, { status: 'IN_PROGRESS', conclusion: '' }])).toBe('pending')
    expect(rollup([{ state: 'PENDING' }])).toBe('pending')
  })
  test('any failure wins over pending', () => {
    expect(rollup([{ status: 'IN_PROGRESS' }, { status: 'COMPLETED', conclusion: 'FAILURE' }])).toBe('fail')
    expect(rollup([{ state: 'ERROR' }])).toBe('fail')
    expect(rollup([{ status: 'COMPLETED', conclusion: 'CANCELLED' }])).toBe('fail')
  })
})

describe('chips', () => {
  test('clean default branch shows nothing', () => {
    expect(texts(base)).toEqual([])
  })
  test('open PR with CI running', () => {
    const r: Remote = {
      ...base,
      branch: 'fix/x',
      isInMain: false,
      pr: { number: 12, state: 'OPEN', isDraft: false, checks: 'pending' },
    }
    expect(texts(r)).toEqual(['#12', '\u{f021}'])
  })
  test('merged PR with green CI', () => {
    const r: Remote = {
      ...base,
      branch: 'fix/x',
      pr: { number: 7, state: 'MERGED', isDraft: false, checks: 'pass' },
    }
    expect(texts(r)).toEqual(['#7 已合併', '\u{f058}'])
  })
  test('failed CI is bad, a closed PR is bad', () => {
    const r: Remote = { ...base, branch: 'x', isInMain: false, pr: { number: 1, state: 'OPEN', isDraft: false, checks: 'fail' } }
    expect(chips(r).find(c => c.text === '\u{f057}')?.tone).toBe('bad')
    expect(chips({ ...r, pr: { number: 1, state: 'CLOSED', isDraft: false, checks: 'none' } })[0]?.tone).toBe('bad')
  })
  test('a branch with no PR: said only when it already landed in main', () => {
    expect(texts({ ...base, branch: 'old', isInMain: true })).toEqual(['已進 main'])
    expect(texts({ ...base, branch: 'wip', isInMain: false })).toEqual([])
  })
  test('draft PR with no CI configured', () => {
    const r: Remote = {
      ...base,
      branch: 'feat',
      isInMain: false,
      pr: { number: 3, state: 'OPEN', isDraft: true, checks: 'none' },
    }
    expect(texts(r)).toEqual(['#3 草稿'])
  })
})

describe('isUnpushed', () => {
  const fresh: Remote = { ...base, branch: 'feat', isInMain: false }
  test('a new branch with no upstream, no PR and not in main', () => {
    expect(isUnpushed(fresh, false)).toBe(true)
  })
  test('an upstream means it was pushed', () => {
    expect(isUnpushed(fresh, true)).toBe(false)
  })
  test('a PR proves it was pushed even without an upstream', () => {
    const pr = { number: 5, state: 'OPEN', isDraft: false, checks: 'none' } as const
    expect(isUnpushed({ ...fresh, pr }, false)).toBe(false)
  })
  test('a branch already in main is not unpushed', () => {
    expect(isUnpushed({ ...fresh, isInMain: true }, false)).toBe(false)
  })
  test('the default branch is never unpushed', () => {
    expect(isUnpushed(base, false)).toBe(false)
  })
})
