import { describe, expect, test } from 'claude-code/testing'

import { pill } from './pill'

describe('pill', () => {
  const W = '#ffffff'

  test('is a rounded pill as tall as it is drawn', () => {
    const p = pill('#ea4335', [{ icon: 'logo', color: W }, { text: ' Opus 5.5', color: W }])
    expect(p.height).toBe(22)
    expect(p.source).toContain('rx="11"')
    expect(p.source).toContain(`width="${p.width}"`)
  })
  test('grows with its text', () => {
    const short = pill('#4285f4', [{ icon: 'dir', color: W }, { text: ' a', color: W }])
    const long = pill('#4285f4', [{ icon: 'dir', color: W }, { text: ' abcdefghij', color: W }])
    expect(long.width).toBeGreaterThan(short.width)
  })
  test('counts CJK as two cells', () => {
    const ascii = pill('#000000', [{ text: 'ab', color: W }])
    const cjk = pill('#000000', [{ text: '新', color: W }])
    expect(cjk.width).toBe(ascii.width)
  })
  test('escapes text the host would refuse', () => {
    const p = pill('#000000', [{ text: 'a<b>&"c', color: W }])
    expect(p.source).toContain('a&lt;b&gt;&amp;&quot;c')
    expect(p.source).not.toContain('a<b')
  })
  test('holds no Nerd Font glyph', () => {
    const p = pill('#5f6368', [{ pct: 40, color: W }, { text: ' 40%', color: W }, { icon: 'ciPass', color: W }])
    const pua = [...p.source].some(ch => {
      const c = ch.codePointAt(0) ?? 0
      return (c >= 0xe000 && c <= 0xf8ff) || c >= 0xf0000
    })
    expect(pua).toBe(false)
  })
})
