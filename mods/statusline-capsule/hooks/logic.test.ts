import { describe, expect, test } from 'claude-code/testing'

import type { Remote } from '../types'
import { chips, compareDeploy, findSha, isUnpushed, parseConfig, rollup } from './logic'

const base: Remote = {
  branch: 'main',
  defaultBranch: 'main',
  isInMain: true,
  pr: null,
  deploy: null,
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

describe('deploy', () => {
  test('parseConfig needs an http(s) url', () => {
    expect(parseConfig('{"deploy":{"url":"https://x.dev/version.json"}}')).toEqual({
      url: 'https://x.dev/version.json',
      header: undefined,
      pattern: undefined,
    })
    expect(parseConfig('{"deploy":{"url":"file:///etc/passwd"}}')).toBe(null)
    expect(parseConfig('not json')).toBe(null)
    expect(parseConfig('')).toBe(null)
  })
  test('parseConfig lower-cases the header name', () => {
    expect(parseConfig('{"deploy":{"url":"https://x.dev","header":"X-Commit"}}')?.header).toBe('x-commit')
  })
  test('findSha takes the first commit-like token', () => {
    expect(findSha('{"commit":"ABCDEF1234567"}')).toBe('abcdef1234567')
    expect(findSha('version 12 build')).toBe(null)
    expect(findSha('sha=abc1234 x', 'sha=([0-9a-f]+)')).toBe('abc1234')
    expect(findSha('abc1234', '([')).toBe(null)
  })
  test('compareDeploy matches on a short or a full sha', () => {
    expect(compareDeploy('abc1234', 'abc1234def56789')).toBe('current')
    expect(compareDeploy('abc1234def56789', 'abc1234')).toBe('current')
    expect(compareDeploy('abc1234', 'fff0000aaa')).toBe('behind')
    expect(compareDeploy(null, 'abc1234')).toBe('unknown')
    expect(compareDeploy('abc1234', null)).toBe('unknown')
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
  test('merged PR with green CI and a stale deploy', () => {
    const r: Remote = {
      ...base,
      branch: 'fix/x',
      pr: { number: 7, state: 'MERGED', isDraft: false, checks: 'pass' },
      deploy: { status: 'behind', deployed: 'aaaaaaa1111', main: 'bbbbbbb2222' },
    }
    expect(texts(r)).toEqual(['#7 已合併', '\u{f058}', '\u{f135}'])
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
  test('deploy: a rocket, green when current, red when behind, yellow with a ? when unreadable', () => {
    expect(chips({ ...base, deploy: { status: 'current', deployed: 'a', main: 'a' } })).toEqual([
      { text: '\u{f135}', tone: 'ok' },
    ])
    for (const status of ['error', 'unknown'] as const) {
      expect(chips({ ...base, deploy: { status, deployed: null, main: 'a' } })).toEqual([
        { text: '\u{f135}?', tone: 'warn' },
      ])
    }
    expect(chips({ ...base, deploy: { status: 'behind', deployed: 'a', main: 'b' } })).toEqual([
      { text: '\u{f135}', tone: 'bad' },
    ])
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
