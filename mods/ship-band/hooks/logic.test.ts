import { describe, expect, test } from 'claude-code/testing'

import type { Ship } from '../types'
import { compareDeploy, findSha, parseConfig, rollup, segments } from './logic'

const base: Ship = {
  branch: 'main',
  defaultBranch: 'main',
  hasUpstream: true,
  isInMain: true,
  pr: null,
  deploy: null,
}

const texts = (s: Ship) => segments(s).map(p => p.text)

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

describe('segments', () => {
  test('clean main in sync shows nothing', () => {
    expect(texts(base)).toEqual([])
  })
  test('open PR with CI running', () => {
    const s: Ship = {
      ...base,
      branch: 'fix/x',
      isInMain: false,
      pr: { number: 12, state: 'OPEN', isDraft: false, checks: 'pending' },
    }
    expect(texts(s)).toEqual(['PR #12 未合併', 'CI ● 執行中'])
  })
  test('merged PR with green CI and a stale deploy', () => {
    const s: Ship = {
      ...base,
      branch: 'fix/x',
      isInMain: true,
      pr: { number: 7, state: 'MERGED', isDraft: false, checks: 'pass' },
      deploy: { status: 'behind', deployed: 'aaaaaaa1111', main: 'bbbbbbb2222' },
    }
    expect(texts(s)).toEqual(['PR #7 ✓ 已合併', 'CI ✓', '部署 ✗ 落後 aaaaaaa → bbbbbbb'])
  })
  test('a branch with no PR that already landed in main', () => {
    expect(texts({ ...base, branch: 'old', isInMain: true })).toContain('✓ 已進 main')
    expect(texts({ ...base, branch: 'wip', isInMain: false })).toContain('無 PR')
  })
  test('draft PR and no upstream', () => {
    const s: Ship = {
      ...base,
      branch: 'feat',
      hasUpstream: false,
      isInMain: false,
      pr: { number: 3, state: 'OPEN', isDraft: true, checks: 'none' },
    }
    expect(texts(s)).toEqual(['PR #3 草稿 未合併', 'CI —', '未推送'])
  })
  test('deploy tones: current is ok, unreadable is a warning', () => {
    const ok = segments({ ...base, deploy: { status: 'current', deployed: 'a', main: 'a' } })
    expect(ok.find(p => p.text.startsWith('部署'))?.tone).toBe('ok')
    const bad = segments({ ...base, deploy: { status: 'error', deployed: null, main: 'a' } })
    expect(bad.find(p => p.text.startsWith('部署'))?.tone).toBe('warn')
  })
})
