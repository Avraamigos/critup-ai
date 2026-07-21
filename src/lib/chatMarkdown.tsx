import React from 'react'

// Lightweight markdown → React for chat bubbles. The model leans on markdown
// heavily (especially in Arabic/RU), and the bubbles render plain text, so raw
// **, ##, `, and [link](url) syntax was leaking through. This renders bold and
// headings and strips the rest — no dependency, display-only.

function inline(text: string, keyBase: string): React.ReactNode[] {
  const s = text
    .replace(/`([^`]*)`/g, '$1')                 // `code` → code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')     // [text](url) → text
  const out: React.ReactNode[] = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0, m: RegExpExecArray | null, i = 0
  const clean = (str: string) => str.replace(/\*/g, '').replace(/(^|\s)_(?=\S)|(?<=\S)_(?=\s|$)/g, '$1')
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(clean(s.slice(last, m.index)))
    out.push(<strong key={`${keyBase}-b${i++}`}>{m[1]}</strong>)
    last = m.index + m[0].length
  }
  if (last < s.length) out.push(clean(s.slice(last)))
  return out
}

/** Render chat text with basic formatting; safe for any language. */
export function ChatText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        const heading = line.match(/^\s*#{1,6}\s+(.*)$/)
        if (heading) return <div key={i} style={{ fontWeight: 700, margin: i ? '9px 0 2px' : '0 0 2px' }}>{inline(heading[1], `h${i}`)}</div>
        const bullet = line.match(/^\s*[-*]\s+(.*)$/)
        if (bullet) return <div key={i} style={{ display: 'flex', gap: 7 }}><span aria-hidden>•</span><span>{inline(bullet[1], `l${i}`)}</span></div>
        if (line.trim() === '---') return <div key={i} style={{ height: 1, background: 'currentColor', opacity: 0.14, margin: '9px 0' }} />
        return <div key={i}>{line.trim() ? inline(line, `p${i}`) : ' '}</div>
      })}
    </>
  )
}
