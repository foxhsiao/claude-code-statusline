// Capsules for the desktop and mobile apps. Their font has no Nerd Font glyphs, so each capsule is drawn as
// one small SVG: a rounded pill, vector icons and monospaced text, so its width is known before it is drawn.

export type IconName = 'logo' | 'dir' | 'branch' | 'diff' | 'user' | 'h5' | 'd7' | 'ciPass' | 'ciFail' | 'ciPending'

// a run of text, or an icon; `pct` draws the context icon as a pie filled that far
export type Part =
  | { text: string; color: string }
  | { icon: IconName; color: string }
  | { pct: number; color: string }

export type Pill = { source: string; width: number; height: number }

const H = 22
const FONT = 12
const CHAR = FONT * 0.62 // a monospaced cell, a little over so a fallback font still fits
const ICON = 14
const PAD = 9
const GAP = 5
// the text baseline that centres digits and lowercase in the pill
const BASE = Math.round((H / 2 + FONT * 0.36) * 100) / 100

// 24-unit line icons, drawn with the part's color as the stroke
const PATHS: Record<IconName, string> = {
  logo: '<path d="M12 3l2.1 6.9L21 12l-6.9 2.1L12 21l-2.1-6.9L3 12l6.9-2.1z" fill="C" stroke="none"/>',
  dir: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  branch:
    '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9c0 4-4 5-12 8"/>',
  diff: '<path d="M12 4v8M8 8h8M8 18h8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  h5: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  d7: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  ciPass: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  ciFail: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  ciPending: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>',
}

// display cells: CJK and fullwidth count 2
const cells = (s: string) => {
  let w = 0
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0
    w += (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6) ? 2 : 1
  }
  return w
}

// the only character references the host lets through
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const n2 = (n: number) => Math.round(n * 100) / 100

// a ring with a slice filled to `pct`
const pie = (pct: number, color: string) => {
  const p = Math.min(100, Math.max(0, pct))
  const ring = `<circle cx="12" cy="12" r="9"/>`
  if (p <= 0) return ring
  if (p >= 100) return `${ring}<circle cx="12" cy="12" r="6" fill="${color}" stroke="none"/>`
  const a = (p / 100) * 2 * Math.PI
  const x = n2(12 + 6 * Math.sin(a))
  const y = n2(12 - 6 * Math.cos(a))
  return `${ring}<path d="M12 12V6A6 6 0 ${p > 50 ? 1 : 0} 1 ${x} ${y}z" fill="${color}" stroke="none"/>`
}

const icon = (body: string, x: number, color: string) => {
  const s = ICON / 24
  const y = (H - ICON) / 2
  return `<g transform="translate(${n2(x)} ${n2(y)}) scale(${n2(s)})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body.replace(/"C"/g, `"${color}"`)}</g>`
}

export const pill = (bg: string, parts: Part[]): Pill => {
  let x = PAD
  let body = ''
  parts.forEach((p, i) => {
    if ('text' in p) {
      // a leading space in the text is the gap, so trim it at the start of the pill
      // a pill opens on its padding and an icon brings its own gap, so neither needs the text's leading space
      const prev = parts[i - 1]
      let t = i === 0 ? p.text.replace(/^ +/, '') : prev !== undefined && !('text' in prev) ? p.text.replace(/^ /, '') : p.text
      if (i === parts.length - 1) t = t.replace(/ +$/, '')
      if (t === '') return
      body += `<text x="${n2(x)}" y="${BASE}" fill="${p.color}" xml:space="preserve">${esc(t)}</text>`
      x += cells(t) * CHAR
    } else {
      body += icon('icon' in p ? PATHS[p.icon] : pie(p.pct, p.color), x, p.color)
      x += ICON + GAP
    }
  })
  // drop the trailing gap or spaces' worth before the closing padding
  const last = parts.at(-1)
  const width = Math.ceil(x - (last !== undefined && !('text' in last) ? GAP : 0) + PAD)
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}">` +
    `<rect width="${width}" height="${H}" rx="${H / 2}" fill="${bg}"/>` +
    `<g font-family="SF Mono, ui-monospace, Menlo, Consolas, monospace" font-size="${FONT}">${body}</g>` +
    `</svg>`
  return { source, width, height: H }
}
