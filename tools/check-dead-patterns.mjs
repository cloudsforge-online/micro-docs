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
//
// ── WHY THIS FILE GRADES ITSELF FIRST ────────────────────────────────────────────────────────
//
// Until 2026-08-10 this printed `dead-patterns: clean` and exited 0 whether it had read
// forty-three documents or none. `walk()` starts from a path derived at import time, and a walk
// that returns an empty list produces character-for-character the same output as a clean sweep.
// That is 14-testing-strategy.md §17's subject in the repository that states the rule — the same
// shape as `ok — all 0 compose pins match`, which matched 0 of 44.
//
// Three properties answer it, and none of them is a promise:
//
//   1. THE CANARY RUNS BEFORE THE TREE IS GRADED. Every run plants a synthetic document holding
//      one uncorrected occurrence of every pattern and requires the scanner to find exactly
//      those; then plants the same text with the escapes applied and requires it to find none.
//      A scanner that has stopped matching prints the same clean report as a clean corpus, so the
//      clean report is only worth reading beside a canary that went red on purpose.
//   2. CARDINALITY IS REPORTED AND ZERO IS A FAILURE. The count of documents read is in the
//      output, and reading none is exit 2, not exit 0.
//   3. A PATTERN THAT MATCHES NOTHING AT ALL IS A FAILURE. If a retired thing has left the corpus
//      entirely, that is a real event and the pattern should be deleted deliberately — with the
//      paragraph that explains the retirement going with it. If instead the regex has rotted, this
//      is the only signal that would ever say so. Either way the run stops and a person decides;
//      silently guarding nothing is the outcome this file exists to refuse.
//
// EXIT CODES. 0 the corpus is clean. 1 a document prescribes a retired thing. 2 the check could
// not run, or could not be shown able to fail. `0` and `2` are different states and must never be
// collapsed: a check that passes when it cannot run is worse than no check.

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
    // One line that this pattern must match, used by the canary. It is the retired spelling
    // itself, so the canary goes stale the day the pattern does and not a day later.
    specimen: 'Deploy the console at hub.testnet.cloudsforge.online and point the client at it.',
    correction: '> This is retired: the testnet is a suffix, and that hostname does not resolve.',
  },
  {
    id: 'worlds-api-rename',
    re: /worlds-api/,
    why: 'The `api.` -> `worlds-api.` rename was performed and then reversed. `worlds-api.cloudsforge.online` has no DNS record; the game API is served at `api.<apex>/v1/...`.',
    corrects: /reversed|retired|no DNS|does not resolve|dead|do not implement|inverted/i,
    specimen: 'Point the bundle at worlds-api.cloudsforge.online for the game API.',
    correction: '> This was reversed: that host has no DNS record, so do not implement it.',
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

/**
 * The whole judgement, over one document's text. Separated from the filesystem so the canary can
 * drive the real function rather than a re-typed copy of it — micro-org#238 was a duplicated
 * predicate that drifted until CI was verifying the copy rather than the one that ran.
 *
 * `raw` counts every occurrence including the escaped and fenced ones, and is what property 3
 * reads: it answers "does this pattern still describe the corpus at all", which is a different
 * question from "is anything uncorrected".
 */
const scanText = (name, text, violations, raw) => {
  const lines = text.split('\n')
  let fenced = false
  lines.forEach((line, i) => {
    for (const p of PATTERNS) if (p.re.test(line)) raw.set(p.id, (raw.get(p.id) ?? 0) + 1)
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
      violations.push({ file: name, line: i + 1, id: p.id, text: line.trim(), why: p.why })
    }
  })
  return lines.length
}

/**
 * Plant a known-bad and require this scanner to name it; then plant the same text with each
 * escape applied and require silence. Returns a list of failures, empty when the check has been
 * shown able to fail.
 */
const canary = () => {
  const failures = []

  for (const p of PATTERNS) {
    const found = []
    scanText(`canary/${p.id}`, `# Canary\n\n${p.specimen}\n`, found, new Map())
    const ids = found.map((v) => v.id)
    if (ids.length !== 1 || ids[0] !== p.id) {
      failures.push(
        `${p.id}: the scanner did not report its own specimen — expected exactly [${p.id}], got [${ids.join(', ') || 'nothing'}]. ` +
          'Either the regex no longer matches the retired spelling, or the specimen has drifted from it.',
      )
    }
  }

  // Both escapes, on text that is otherwise a violation. A guard that cannot be silenced
  // deliberately gets deleted; one that is silenced by accident guards nothing.
  for (const p of PATTERNS) {
    for (const [how, text] of [
      ['the marker', `# Canary\n\n${p.specimen} ${MARKER}\n`],
      ['a nearby correction', `# Canary\n\n${p.correction}\n\n${p.specimen}\n`],
    ]) {
      const found = []
      scanText(`canary/${p.id}`, text, found, new Map())
      if (found.length !== 0) failures.push(`${p.id}: ${how} did not silence a deliberate mention`)
    }
  }

  return failures
}

const canaryFailures = canary()
if (canaryFailures.length > 0) {
  console.error('dead-patterns: THE CHECK CANNOT BE SHOWN TO FAIL — refusing to grade the corpus\n')
  for (const f of canaryFailures) console.error(`  ${f}`)
  console.error(
    '\nA clean report from a scanner that matches nothing is indistinguishable from a clean corpus,\n' +
      'so no result is reported here at all. Fix the pattern or its specimen and run again.',
  )
  process.exit(2)
}
console.log(`dead-patterns: canary ok — the scanner named all ${PATTERNS.length} planted specimens, and both escapes silenced it`)

const files = walk(ROOT)
if (files.length === 0) {
  console.error(`dead-patterns: read 0 documents under ${ROOT} — nothing was measured, and that is not a pass`)
  process.exit(2)
}

const violations = []
const raw = new Map()
let lines = 0
for (const file of files) lines += scanText(relative(ROOT, file), readFileSync(file, 'utf8'), violations, raw)

// A pattern nothing mentions any more is either a retirement that has completed — in which case
// the pattern and the paragraph explaining it should go together, deliberately — or a regex that
// has rotted. Both need a person; neither is a pass.
const silent = PATTERNS.filter((p) => (raw.get(p.id) ?? 0) === 0)
if (silent.length > 0) {
  console.error(
    `dead-patterns: ${silent.length} pattern(s) match nothing anywhere in ${files.length} documents\n`,
  )
  for (const p of silent) console.error(`  ${p.id}\n    ${p.why}\n`)
  console.error(
    'Either the retired thing has left the corpus entirely — then delete the pattern here and the\n' +
      'paragraph that explains the retirement, as one change — or the regex no longer matches what it\n' +
      'was written for. A pattern guarding nothing is not a passing check.',
  )
  process.exit(2)
}

const census = PATTERNS.map((p) => `${p.id} ${raw.get(p.id)}`).join(', ')
if (violations.length === 0) {
  console.log(`dead-patterns: clean — ${files.length} documents, ${lines} lines, mentions: ${census}`)
  process.exit(0)
}

console.error(
  `dead-patterns: ${violations.length} uncorrected occurrence(s) in ${files.length} documents (${lines} lines, mentions: ${census})\n`,
)
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
