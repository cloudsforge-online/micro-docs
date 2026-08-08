#!/usr/bin/env node
// Fails when a document prescribes something the estate has retired.
//
// The estate's documents are a plan set, not a wiki: they are corrected in place rather than
// rewritten, so a dead hostname legitimately appears in the paragraph that explains why it is
// dead. A bare grep therefore cannot be the gate. Two escapes, both auditable:
//
//   1. the line carries the marker `<!-- dead-ok -->`, meaning "this mentions the dead thing on
//      purpose", or
//   2. a blockquote line (`>`) naming the pattern's correction appears near it — after it, as an
//      inline note, or above it, as the banner heading the item it corrects. Both shapes are
//      already used throughout this repo.
//
// Anything else is a document still telling a reader to build the retired thing.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const LOOKAHEAD = 8
const LOOKBEHIND = 24 // a banner heads its item; MIG-26's sits 13 lines above the line it kills
const MARKER = '<!-- dead-ok -->'

const PATTERNS = [
  {
    id: 'testnet-two-label',
    re: /[a-z0-9-]+\.testnet\.cloudsforge\.online/,
    why: 'The testnet is a hostname SUFFIX (`hub-testnet.cloudsforge.online`), never a second label. Cloudflare does not issue a wildcard for `*.testnet.` on the plan in use.',
    corrects: /suffix|dead|never a second label|retired|does not resolve|do not/i,
  },
  {
    id: 'worlds-api-rename',
    re: /worlds-api/,
    why: 'The `api.` -> `worlds-api.` rename was performed and then reversed. `worlds-api.cloudsforge.online` has no DNS record; the game API is served at `api.<apex>/v1/...`.',
    corrects: /reversed|retired|no DNS|does not resolve|dead|do not implement|inverted/i,
  },
]

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (name.endsWith('.md')) out.push(p)
  }
  return out
}

const violations = []
for (const file of walk(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n')
  let fenced = false
  lines.forEach((line, i) => {
    // Fenced blocks are transcripts and worked examples, not instructions to a reader — and a
    // marker comment inside one would render literally.
    if (line.trimStart().startsWith('```')) { fenced = !fenced; return }
    if (fenced) return
    if (line.includes(MARKER)) return
    if (line.trimStart().startsWith('>')) return
    for (const p of PATTERNS) {
      if (!p.re.test(line)) continue
      const near = [
        ...lines.slice(Math.max(0, i - LOOKBEHIND), i),
        ...lines.slice(i + 1, i + 1 + LOOKAHEAD),
      ]
        .filter((l) => l.trimStart().startsWith('>'))
        .join(' ')
      if (p.corrects.test(near)) continue
      violations.push({ file: relative(ROOT, file), line: i + 1, id: p.id, text: line.trim(), why: p.why })
    }
  })
}

if (violations.length === 0) {
  console.log('dead-patterns: clean')
  process.exit(0)
}

console.error(`dead-patterns: ${violations.length} uncorrected occurrence(s)\n`)
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  [${v.id}]`)
  console.error(`    ${v.text.slice(0, 110)}`)
  console.error(`    ${v.why}\n`)
}
console.error(
  `Fix by deleting the instruction, or by following it with a blockquote correction, or — if the\n` +
    `line mentions the retired thing deliberately — by appending ${MARKER} to it.`,
)
process.exit(1)
