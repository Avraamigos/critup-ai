import { describe, it, expect } from 'vitest'
import { parseClaudeJson } from '../api/_lib/claudeJson.js'

describe('parseClaudeJson', () => {
  it('parses plain JSON', () => {
    expect(parseClaudeJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('strips markdown fences', () => {
    expect(parseClaudeJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('extracts the object from surrounding prose', () => {
    expect(parseClaudeJson('Here is the result:\n{"a":1}\nHope that helps!')).toEqual({ a: 1 })
  })

  it('salvages a response truncated mid-array', () => {
    const cut = '{"slides":[{"title":"One","script":"say this"},{"title":"Two","script":"say th'
    const out = parseClaudeJson<{ slides: Array<{ title: string }> }>(cut)
    expect(out).not.toBeNull()
    expect(out!.slides).toHaveLength(1)
    expect(out!.slides[0].title).toBe('One')
  })

  it('salvages when cut off between items (dangling comma)', () => {
    const cut = '{"feedback":[{"t":"a"},{"t":"b"},'
    const out = parseClaudeJson<{ feedback: Array<{ t: string }> }>(cut)
    expect(out).not.toBeNull()
    expect(out!.feedback.map(f => f.t)).toEqual(['a', 'b'])
  })

  it('is not confused by braces inside strings', () => {
    const cut = '{"items":[{"text":"an object looks like {a: 1} ok"},{"text":"unfinished '
    const out = parseClaudeJson<{ items: Array<{ text: string }> }>(cut)
    expect(out).not.toBeNull()
    expect(out!.items).toHaveLength(1)
    expect(out!.items[0].text).toContain('{a: 1}')
  })

  it('returns null for hopeless input', () => {
    expect(parseClaudeJson('no json here at all')).toBeNull()
    expect(parseClaudeJson('')).toBeNull()
  })
})
