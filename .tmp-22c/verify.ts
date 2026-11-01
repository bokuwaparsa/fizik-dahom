// One-off QA for Task 22-c: every glossary key must trace back to a source string.
import { readFileSync, readdirSync } from 'node:fs'

const GROUPS: Record<string, string[]> = {
  k: ['terms-fa-k.ts', 'terms-tr-k.ts'],
  l: ['terms-fa-l.ts', 'terms-tr-l.ts'],
  m: ['terms-fa-m.ts', 'terms-tr-m.ts'],
  n: ['terms-fa-n.ts', 'terms-tr-n.ts'],
  o: ['terms-fa-o.ts', 'terms-tr-o.ts'],
}

const unescapeKey = (s: string) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\')

let totalKeys = 0
let totalProblems = 0

for (const [grp, files] of Object.entries(GROUPS)) {
  const dir = `src/components/sims/${grp}`
  const srcs = readdirSync(dir)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => readFileSync(`${dir}/${f}`, 'utf8'))
    .join('\n')

  for (const file of files) {
    const text = readFileSync(`src/lib/game/dict/${file}`, 'utf8')
    const re = /^\s*'((?:[^'\\]|\\.)*)':/gm
    const seen = new Set<string>()
    let dups = 0
    let m: RegExpExecArray | null
    const keys: string[] = []
    while ((m = re.exec(text))) {
      const key = unescapeKey(m[1])
      if (seen.has(key)) { console.log(`  DUP   ${file}: ${JSON.stringify(key)}`); dups++; totalProblems++ }
      seen.add(key)
      keys.push(key)
    }
    const missing: string[] = []
    for (const key of keys) {
      let ok: boolean
      if (/\{[^}]+\}/.test(key)) {
        const marked = key.replace(/\{[^}]+\}/g, '\u0000')
        const escaped = marked.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const rx = new RegExp(escaped.split('\u0000').join('[\\s\\S]{0,80}?'))
        ok = rx.test(srcs)
      } else {
        ok = srcs.includes(key)
      }
      if (!ok) missing.push(key)
    }
    totalKeys += keys.length
    totalProblems += missing.length
    console.log(`${file}: ${keys.length} keys · ${dups} dup · ${missing.length} unmatched`)
    missing.forEach((k) => console.log(`  MISS  ${JSON.stringify(k)}`))
  }
}
console.log(`\nTOTAL keys: ${totalKeys} · problems: ${totalProblems}`)
