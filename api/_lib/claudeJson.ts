// Robust extraction of a JSON object from a Claude text response.
// Shared by analyze.ts and jury-script.ts (was duplicated, and the two copies
// had drifted — jury-script's naive tail-closing missed cases this handles).
//
// Chain: strip markdown fences → parse → first {...} block → salvage a
// truncated object by cutting back to the last complete item and re-balancing
// brackets (string-aware, so braces inside quoted text don't confuse it).

export function parseClaudeJson<T = Record<string, unknown>>(raw: string): T | null {
  const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
  try { return JSON.parse(clean) as T } catch { /* next */ }

  const m = raw.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) as T } catch { /* next */ } }

  return salvageTruncated<T>(raw)
}

// Rebuild a cut-off response: keep everything up to the last fully-closed
// object, drop a dangling comma, close whatever brackets remain open.
function salvageTruncated<T>(raw: string): T | null {
  const start = raw.indexOf('{')
  if (start === -1) return null
  const s = raw.slice(start)

  // Index of the last '}' that is NOT inside a string.
  let inStr = false, esc = false, lastObjClose = -1
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '}') lastObjClose = i
  }
  if (lastObjClose === -1) return null

  let cut = s.slice(0, lastObjClose + 1)
  const open: string[] = []
  inStr = false; esc = false
  for (let i = 0; i < cut.length; i++) {
    const ch = cut[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{' || ch === '[') open.push(ch)
    else if (ch === '}' || ch === ']') open.pop()
  }
  cut = cut.replace(/,\s*$/, '')
  while (open.length) cut += open.pop() === '{' ? '}' : ']'
  try { return JSON.parse(cut) as T } catch { return null }
}
