# 14 — Testing strategy

How correctness is established and maintained across forty repositories in which **no single CI
run can build the composed system**. [02-target-architecture.md](02-target-architecture.md)
AD-01 accepted that cost; AD-04 named the answer — consumer-driven contract tests plus Beacon's
synthetic journeys as the release gate. This document is that answer in full, plus everything
underneath it.

Read [00-current-state.md](00-current-state.md) §3.9 first. This document is grounded in what is
actually in the repositories, re-counted by running the suites rather than by reading the
existing summary, and where the two disagree the measured number is used and the discrepancy is
flagged.

---

## 1. Where the estate actually is

Counts below are from executing each suite on 30 July 2026, not from a manifest.

| Repo | Runner | Files | Tests | In CI? | The gap that matters |
| --- | --- | --- | --- | --- | --- |
| `platform` | `node --test` + tsx | 11 | **77** (nimbus 56, admin 13, site 8) | Yes, three named filters | **29 of nimbus's 56 skip when `NIMBUS_TEST_DATABASE_URL` is unset** — all of `tokens.test.ts` (14), `keys.test.ts` (8), `pay.test.ts` (6), `forgotTiming.test.ts` (1). CI supplies a Postgres; a laptop does not, and `pnpm test` is green either way. No route-integration test for any handler in `src/routes/{admin,auth,pay,portal,vault}.ts` |
| `forge-pay` | `node --test` | 9 | **102** | **No.** `ci.yml` has `Typecheck`, `Docker image` and `Secret hygiene` jobs and no test job | 102 passing tests that no pipeline has ever run |
| `forge-keyvault` | `node --test` | 4 | **103** (18 suites) | Yes | `signing.test.ts` imports `signEvm`, `signSolana`, `signXrp` — **not `signBitcoin`**. The word "bitcoin" appears zero times in it. The PSBT path (`signing.ts–571`), which validates `witnessUtxo`, refuses non-`SIGHASH_ALL`, and refuses any output not paying the pinned treasury for a `deposit`-purpose key, is entirely uncovered. `/sign` has no end-to-end test |
| `forge-mint` | `tsx --test` | 4 | **37** | Yes | No DB, no deployment lifecycle E2E, no contract-execution test |
| `crucible` | `node --test` | **1** | **16** | Yes, but the script names exactly `src/fees.test.ts` | `engine/backtest.ts` (179), `engine/indicators.ts` (185), `engine/metrics.ts` (127), `engine/strategies.ts` (264) — **755 lines, zero tests.** The one product whose core claim is numerical correctness tests only its billing |
| `ninety-days-after` | `node --test` | 6 | **39** (30 server, 9 client) | Yes | The tick engine (`src/engine/{resolve,tick,bots,events,progression,trade}.ts`) is untested, and no test touches a database |
| `hearth` | hand-rolled | 31 entrypoints | 121 committed fixture vectors + the full corpus | `npm test` runs all 31 | The 351 MB upstream corpus is gitignored; CI runs the committed 121 |
| `shared-libs` | pack/consume in CI | — | — | — | No unit tests at all |
| `lantern` | `node --test` | 2 (untracked) | 29 | Not yet | — |
| `beacon` | `node --test` | 4 (untracked) | 26 | Not yet | — |

**Test globs are a trap and are already costing coverage.** Four of six repositories enumerate
their tests in a way that silently excludes new ones:

| Repo | Script | What it silently excludes |
| --- | --- | --- |
| `crucible` | `node --import tsx --test src/fees.test.ts` | Everything. A new `src/engine/backtest.test.ts` would not run and CI would stay green |
| `ninety-days-after` (game) | `node --import tsx --test src/*.test.ts` | `src/engine/` and `src/world/` — the six engine modules and the world generator |
| `platform` (nimbus) | `node --import tsx --test --test-concurrency=1 src/*.test.ts` | `src/routes/` — five untested handler files |
| `forge-keyvault` | Four filenames listed explicitly | Any fifth file |
| `platform` (admin, site) | `node --import tsx --test "src/**/*.test.ts"` | Nothing. **This is the correct form** and the one every repository adopts |

**Action, P0:** every `test` script becomes a recursive glob, and `service-ci.yml` asserts that
the number of test files discovered by the glob equals the number of `*.test.ts` files in the
repository. A suite that skips files is worse than no suite, because it reports green.

---

## 2. The pyramid for this estate

Six levels, and the unusual shape is deliberate: the middle is thin because there is no
integration CI, and the two ends are thick because that is where the estate's real defects live.

| Level | What belongs here | What does not | Runs in |
| --- | --- | --- | --- |
| **Unit** | Pure functions, state machines, arithmetic, refusal logic, schema validation, reducers | Anything needing a socket or a database | Every PR, under 60 s per repo |
| **Component (DB-touching)** | Repository functions against a real Postgres in a service container; migrations; idempotency claims; conditional `UPDATE … RETURNING`; unique-index behaviour | Cross-service HTTP | Every PR, service repos only |
| **Concurrency** | Two workers or two processes against one Postgres, contending on one resource | Anything single-threaded | Every PR for money and job-lease code |
| **Contract** | Consumer expectations replayed against the provider's real handlers, in the provider's CI | Anything requiring the consumer to be running | Every PR in the provider repo |
| **Journey (Beacon)** | Multi-step scenarios against a live staging stack, using real credentials, moving real testnet value | Anything asserting an internal implementation detail | On a stagger, continuously; as a gate before promotion |
| **Chaos / drill** | Killing a dependency and observing the degradation and the recovery | Anything that is not rehearsed with a runbook open | Quarterly, and at P13's gate |

**What is deliberately absent: an end-to-end suite living in one repository.** With one repo per
deployable there is no repository that could host it honestly. Attempting it produces a suite
that either mocks every peer (and therefore tests the mocks) or spins up 22 containers in CI
(and therefore never finishes). The journey layer does this job against a real stack, which is
the only place the question can be answered.

---

## 3. Unit testing standards

**`node:test` + `tsx`, everywhere.** The convention is already in use in six repositories and
needs no framework migration. `describe`/`it` and bare `test()` are both acceptable;
`forge-keyvault` uses the former (18 suites, 103 tests) and everything else the latter.

Standards, checked in review:

- **A test name states the behaviour and the consequence, not the function.** The estate already
  does this well and it must not regress: `"a bot stopped between the sweep two queries is
  settled once, not twice"`, `"the exploit: six empty offers against six settlers take nothing"`,
  `"psbt input N does not spend this vault address"`. A test called `"test settle"` fails review.
- **A test that can only assert the fix cannot show the bug.** `nimbus/src/tokens.test.ts` sets
  `rotated_at` back to `NULL` to reconstruct the pre-fix state and asserts the family *is* burned.
  That pattern — reproduce the defect, then assert the fix — is the house standard for every
  regression test.
- **A refusal test asserts the refusal type, not just that something threw.** ForgeKeyvault's
  `refuses()` helper requires a `SignRefused` specifically, because a `SignRefused` is a 403 and
  the caller's fault while any other throw is a 500 and ours. Collapsing them is how a signer
  starts tolerating shapes nobody meant it to sign.
- **A skipped test is never counted as passing.** §12.
- **No test asserts a log line.** Logs are sampled and expire; if the behaviour matters, it is an
  audit event or a metric, and the test asserts that.

**Coverage expectations by criticality.** Line coverage is a floor, not a goal, and it is
enforced per directory rather than per repository so a well-tested utility module cannot mask an
untested engine.

| Tier | Services | Line floor | Branch floor | Additional requirement |
| --- | --- | --- | --- | --- |
| **Money and custody** | `ledger`, `wallet`, `settlement`, `custody`, `billing`, `pricing` | 90% | 85% | Property tests (§4) and concurrency tests (§5) are mandatory, not optional |
| **Identity and policy** | `identity`, `policy`, `devplatform` | 85% | 80% | Every refusal path has a named test |
| **Chain** | `indexer`, `hearth` | 85% | 80% | Conformance vectors (§9) and reorg simulation |
| **Product** | `market`, `trade`, `worlds`, `nda`, `mint`, `studio`, `community` | 75% | 70% | Every engine module has tests; `crucible`'s 755 untested engine lines are the exemplar of the failure |
| **Aggregation and edge** | `hub-api`, `admin-api`, `activity`, `notify` | 70% | 65% | A degradation test per upstream |
| **Frontends** | all `*-web` | 60% | — | §11 |

---

## 4. Property-based testing for money

Example-based tests prove that the cases someone thought of work. The ledger's invariants must
hold for cases nobody thought of, so `ledger` and `wallet` carry a property suite (`fast-check`,
minimum 1,000 runs per property in CI, seeded and reproducible on failure).

The generator produces a random sequence drawn from the entry kinds in
[04-domain-model.md](04-domain-model.md) §2.2 — deposit credits, withdrawals, refunds,
conversions, transfers, purchases, fee charges, reservations, escrow moves, reversals and
adjustments — against a random set of accounts and assets, interleaved with random retries of
previously issued idempotency keys.

| Property | Statement | What it catches |
| --- | --- | --- |
| **P1 · Journal balance** | For every entry and every `asset_code`, Σ debits = Σ credits, exactly | The deferred constraint trigger being wrong, or a code path bypassing it |
| **P2 · Trial balance** | After any sequence, Σ debits − Σ credits across the whole journal is exactly 0 | The invariant the Money Integrity dashboard alerts on |
| **P3 · No negative liability** | No account of type `liability` ends negative unless `overdraft_allowed` is set, which is only `clearing` and `suspense` | A user spending money they do not have through an unusual path |
| **P4 · Idempotency key never lost** | Replaying any issued key returns the stored response byte-for-byte, and creates no new posting. A different body under the same key is a 409 | The shape `withIdempotency` (`forge-pay/services/pay/src/store.ts`) already gets right, held for the ledger |
| **P5 · Projection equals replay** | The `balances` projection equals a fold of the journal from the beginning, for every account | A projection updated by a code path that forgot to |
| **P6 · Reversal restores** | Entry then its reversal returns every touched account to its prior balance | An asymmetric reversal |
| **P7 · Reservation conservation** | `available + reserved + escrow` per subject and asset is invariant under reserve/release/settle | The double-sell that escrow reservations exist to prevent |
| **P8 · Amounts are exact** | No sequence produces a fractional smallest unit or a value that differs from `BigInt` arithmetic performed independently | Float contamination and the `bigint(mode: 'number')` precision cliff at 2^53 |
| **P9 · Rate arithmetic** | `shardsForCoinAmount()` floors, never rounds up, and returns `Infinity` rather than a clamped value past `Number.MAX_SAFE_INTEGER` | A clamped credit that reads as legitimate to every bounds check |

P2 and P5 additionally run continuously in production as the trial-balance panel and the nightly
shadow-rebuild comparator; a mismatch there is a P0 page.

---

## 5. Concurrency testing

**Two-replica tests are a first-class requirement, not an optimisation.** The estate's most
expensive defects are all races, and none of them is visible to a single-process test:
`grep -rn "pg_advisory\|SKIP LOCKED"` across every service returns no matches today, and eight
`setInterval` timers do real work guarded only by a module-local boolean.

The harness (`@cloudsforge/jobs/testing`) starts **two OS processes** of the service against one
Postgres, releases them on a barrier, and asserts the outcome. In-process concurrency is not
acceptable: a module-local latch is invisible to a second process, and that is precisely the bug
class being tested.

| Race | Lease key | The test | Passes when |
| --- | --- | --- | --- |
| **Chain-keyed withdrawal** | `chain:network` | Two `settlement` replicas, four pending withdrawals on one chain, released simultaneously | Exactly one outbound transaction per `(chain, network, from_address)` is in flight at any instant; no two signatures share a nonce; every withdrawal eventually settles exactly once. Today `hasUnsettledOutbound()` (`forge-pay/services/pay/src/store.ts`) is an unlocked read that both workers pass, and the outcome is a permanently lost payment |
| **Settlement double-billing** | `bot_id:period` | Two `trade` replicas running the sweep while a third process issues `POST /bots/:id/actions {stop}` | Exactly one `fee_settlement` row per `(bot_id, period)`. Today the id is `randomUUID()` (`crucible/services/crucible/src/store.ts`), producing two different Pay idempotency keys, and `fee_settlements` has no unique constraint |
| **World tick double-XP** | `world_id` | Two `nda` replicas ticking one world across a day boundary | `daysSurvived` advances by exactly 1 and XP by exactly the single-tick amount |
| **Homestead tile collision** | none — fixed by predicate | Twenty concurrent joins against a map with one free tile | Exactly one player is placed; nineteen receive "no tile". The fix is `WHERE owner_id IS NULL` on the `UPDATE`; the existing test `"a tile taken between the read and the write costs the loser the next tile, not the winner theirs"` is the single-process half and the two-replica test is the other |
| **Price oracle divergence** | `global` | Two `pricing` replicas, an admin `PUT` against one | Both serve the new rate within one refresh interval. Today the oracle is an in-memory `Map` and the `PUT` updates one replica |
| **Migration race** | advisory lock | Two replicas booting against an empty database | Both start; exactly one applies migrations; neither raises 23505 |
| **Nimbus signing-key split-brain** | advisory lock | Two `identity` replicas booting on a fresh database | Exactly one signing key row exists and `getJwks()` returns it deterministically. Today both generate a keypair with different `kid`s, `onConflictDoNothing()` conflicts on nothing, and `getJwks()` does `select().limit(1)` with no `ORDER BY` |
| **Outbox relay duplication** | `topic_shard` | Two relay processes over one outbox | Every event is delivered at least once and every consumer's inbox dedupes it to exactly one effect |
| **Market listing purchase** | ledger reservation | Ten concurrent purchases of one listing | Exactly one `order`; nine 409s; the reservation is released or settled, never lost |

P2's exit criteria require two replicas of one service running without incorrectness, and P4's
require the settlement test specifically. Both are demonstrations, not configurations.

---

## 6. Consumer-driven contract testing

This is the substitute for integration CI, and it is the mechanism that makes a two-minor
contract lag ([11-data-and-contract-strategy.md](11-data-and-contract-strategy.md) §4) safe.

**How it works.**

1. A consumer writes an expectation file describing the interactions it depends on: request
   method, path, headers it sends, body shape, and the **fields of the response it actually
   reads**. Not the whole response — only what it consumes, so a provider adding a field never
   breaks a consumer.
2. The consumer's CI verifies its own client code against the expectation using a local stub,
   proving the expectation describes what the consumer really sends.
3. On merge, the consumer's CI opens a pull request against the provider's repository adding or
   updating `contracts/consumers/<consumer>@<version>.json`. The provider reviews and merges it
   like any other change.
4. The provider's CI replays **every** recorded consumer expectation against its real handlers,
   with a real database, on every pull request. A provider cannot merge a change that breaks a
   recorded consumer.
5. Expectations are versioned and retained for the two-minor lag window, so the provider is
   tested against the versions actually deployed — which the release manifest names, so this is
   checkable rather than assumed.

**Who publishes to whom, at the end state:**

| Provider | Consumers whose expectations it replays |
| --- | --- |
| `identity` | every service (JWKS and claims), `hub-api`, `admin-api`, `devplatform` |
| `ledger` | `wallet`, `billing`, `market`, `trade`, `community`, `worlds` |
| `wallet` | `hub-api`, `mint`, `market`, `settlement` |
| `custody` | `settlement`, `wallet`, `mint` |
| `indexer` | `wallet`, `settlement`, `market`, `explorer-web`, `devplatform` |
| `billing` | `worlds`, `market`, `community`, `studio`, `mint` |
| `policy` | `wallet`, `custody`, `settlement`, `market`, `identity` |
| every service | `hub-api`, `admin-api` (they read nearly everything) |

**The precedent already exists.** `platform/apps/site/src/lib/site.test.ts` (8 tests) reads
EMBER's confirmation depth out of `@cloudsforge/shared`'s deposit registry — the same module
`forge-pay`'s watcher reads — and fails if the marketing copy quotes a different number or if a
retired claim reappears. That is a consumer-driven contract test in everything but name, and it
is the only thing in the estate holding a public claim to the code behind it.

---

## 7. Characterisation testing

Characterisation tests describe what the system **does**, not what it should do. They are the
instrument that proves a decomposition changed structure and not behaviour, and they are built
in P0 before anything moves.

**The P0 golden-path corpus.**

- **Captured from running services**, not hand-written. A recording proxy sits in front of the
  staging stack while every Beacon journey and every money route is exercised, and writes
  request/response pairs as fixtures under `stack/baseline/`.
- **Redacted at capture, never after.** The recorder refuses to write a fixture whose body
  matches any secret-hygiene pattern already asserted in CI. A redaction pass over stored
  fixtures is a pass that can be forgotten; a refusal at capture cannot.
- **Volatile fields are normalised at capture** — timestamps, ids, nonces and trace ids are
  replaced by stable tokens, so a diff is a behavioural diff.
- **The corpus must pass against the current code before it is trusted.** A characterisation test
  that fails on day one is describing a bug; it is recorded as a defect in the register, not
  adjusted to match.
- **The OpenAPI set is generated from the running services**, ~150 routes across nine services,
  by exercising them — never hand-written, because a hand-written description of an
  undocumented estate documents intent rather than behaviour.
- **The data census** — row counts, balance totals per asset, entitlement counts, and a signed
  snapshot of `wallets.shards` + `coin_balances` — is a characterisation test of the data. P4's
  backfill must reproduce it **exactly**, not within tolerance.

**How it validates the decomposition.** After a service is extracted, the corpus is replayed
against the new deployment through the gateway. Every response must match modulo the normalised
fields and modulo a documented, reviewed allowlist of intentional differences. An undocumented
difference blocks the extraction. This is what "nothing broke" means as a comparison rather than
an assertion.

---

## 8. Synthetic journey testing as the release gate

Beacon is the integration test the topology cannot otherwise have. It already runs **24
journeys** across eight files (2,018 lines) — 19 defined directly and 5 through the
`surfaceJourney` helper in `journeys/web.js` — plus 28 probes and the chain conformance runner.

> **Those figures are the LEGACY Beacon's, and they reproduce exactly** (`stack/infra/beacon/`:
> eight journey files, 2,018 lines, 3 `chain` + 2 `crucible` + 3 `game` + 3 `identity` + 1 `mint`
> + 4 `pay` + 2 `platform` + 6 `web` = 24). **`micro-beacon` ships six**, and says why it declines
> to declare the other three of the critical nine (`beacon/src/estate.ts`). Read the paragraph
> above as history, not as the state of the estate being built.

**How a journey is written.** `defineJourney({ name, title, description, group, intervalSec,
covers, run })`. `name` is a stable id used in URLs and metrics; `description` states **what
breaking looks like to a user**, not what the test does. Inside `run(ctx)`:

- `ctx.step(label, fn)` — one timed, recorded unit. Step names are stable because renaming one
  starts a new metric series and abandons its history.
- `ctx.assert(cond, message)` — throws `JourneyAssertion`. The message names what is broken and
  for whom, and quotes the upstream's response.
- `ctx.skip(reason)` — throws `JourneySkip`.
- `ctx.cleanup(fn, label)` — runs in reverse order on every exit path, and a failure inside it is
  reported separately rather than overwriting the real result.
- `ctx.detail(value, fields)` — attaches diagnostic fields to a step.

**Three rules, borrowed from Hearth's conformance harness because it is the same problem.**

1. **A failed assertion and a thrown error are different outcomes.** An assertion failure is
   `fail` — the product is broken. Anything else thrown is `error` — Beacon is broken. Collapse
   them and a `TypeError` in a journey reads as an outage.
2. **Not-run is not passed.** A journey without its credentials reports `skip` **with the
   reason**, and a skip is never green. This is why missing secrets skip rather than fail: a
   monitor that goes red because an operator chose not to give it a token has produced a false
   incident, and a monitor that goes green having done nothing is worse. `skip` is the only
   honest third state.
3. **Cleanup runs even when the journey does not.**

**Why journeys are staggered and serialised.** Twelve scenarios firing at t=0 would each sign in
at once, trip Nimbus's five-per-minute registration limit and its ten-per-minute login limit, and
report an identity outage **that Beacon itself caused** — the observer becoming the incident.
`startSchedule()` spreads first runs across a stagger window and the queue runs one journey at a
time, so step-duration graphs measure the product rather than contention, and two journeys never
move the synthetic account's balance underneath each other.

**Journey growth per phase.** P0 takes the suite from 24 to 45; every later phase adds the
journeys named in its exit criteria. All of them must be green for three consecutive runs before
a gate passes.

| Phase | Journeys added | Covering |
| --- | --- | --- |
| **P0** | 21, to 45 | Every money route individually; the full deposit → convert → spend → withdraw loop on testnet; every entitlement grant and its delivery; both curl-only admin remedies (manual sweep record, stuck-withdrawal abandon); admin price `PUT`; admin role change; withdrawal queue |
| **P2** | 9, to 54 | One per gateway hostname (routing, TLS, CORS); `/readyz` returning 503 with Postgres down; a trace spanning gateway → identity → pay → keyvault; release-manifest deploy and rollback |
| **P3** | 6, to 60 | Each extracted frontend loads, mounts and authenticates against its new API host; the explorer carries the CloudsForge bar; the faucet drips on testnet |
| **P4** | 8, to 68 | Balance asserted end-to-end rather than HTTP 200; trial balance zero; a reversal restores; an entitlement is granted, read by a service, and revoked; a conversion is idempotent under retry |
| **P5** | 10, to 78 | A deposit credits with a **real** txid and an explorer link; a simulated reorg past the confirmation depth is detected and recovered without a wrong credit; BTC and SOL withdraw and sweep on testnet; the reveal route returns 404; a stub second title registers with `worlds` and receives an entitlement |
| **P6** | 12, to 90 | Register → MFA enrol → wallet provision → receive → confirm → convert → send → confirm, unbroken; external wallet verification per family; the export ceremony including the cancel path and the cooling-off expiry; the dashboard rendering with each upstream individually down |
| **P7** | 6, to 96 | Injected drift is detected within one cycle and freezes only the affected asset; a period close reconciles; safe retry of a stuck withdrawal |
| **P8** | 5, to 101 | The ten-step launch flow on testnet; deployment recovery from a lost confirmation; idempotent asset generation |
| **P9** | 6, to 107 | A custodial and a non-custodial sale settle; concurrent purchase yields exactly one order; an auction closes correctly under a race; a dispute reverses |
| **P10** | 5, to 112 | Earn in a world → see in portfolio → spend in Market; a private world is purchased and provisioned; a reward is a ledger posting inside its budget cap |
| **P11** | 5, to 117 | A sandbox integration built from public documentation only; key rotation and revocation; webhook delivery, retry and signature verification; rate-limit enforcement |
| **P12** | 4, to 121 | A community forms, gates on token holding, funds a treasury, passes a proposal through timelock and executes it as a ledger posting; revoked holding demotes on the next evaluation |
| **P13** | 6, to 127 | Notification delivery per channel and per priority; the critical-notification override of preferences; a simulated incident appearing on the public status page; an emergency freeze and its two-operator unfreeze |

**Beacon as the gate.** Every release candidate deploys to staging and must pass the full suite
before its manifest is promoted. A failing journey blocks promotion; it does not warn.

---

## 9. Chain testing

**Testnet per family, always.** `network` is never inferred and no test may run against
mainnet. The XRP defect recorded in [00-current-state.md](00-current-state.md) §3.5 — the same
seed and address valid on testnet and mainnet, so a signed Payment is submittable on either — is
tested directly: derive on testnet, sign, and assert the signature is **not** valid for the
mainnet chain binding.

| Family | Network | How value is obtained | Specific tests |
| --- | --- | --- | --- |
| Hearth / EMBER | Local testnet in compose, plus the deployed testnet | `cloudsforge-faucet` (built, tested with 66 checks, deployed in P3) | Depth-60 crediting; reorg past 60; the `SPARKS_PER_EMBER` vs 18-decimals unit bug (TD-16) |
| EVM | Sepolia | Public faucets, a funded platform test wallet | Nonce management under two replicas; EIP-55 canonicalisation; failed-transaction visibility |
| Bitcoin | testnet3 / signet | Faucet | **PSBT construction and signing** — the currently untested path; `witnessUtxo` present; `SIGHASH_ALL` only; every output of a `deposit`-purpose PSBT paying the pinned treasury; sweep leaves no change |
| Solana | devnet | Airdrop | Rent and gas paid once, not twice — `onBroadcast` present and `/status` settling beyond `family === 'evm'` |
| XRP | testnet | Faucet | Network binding, as above; sequence handling |

**Reorg simulation** is per family and runs in CI against a controllable node, not against a
public testnet. The EVM and Hearth workers are driven against a node that is forced to
re-organise at a chosen depth, including **past the confirmation depth**, and the assertions are:
the reorg is detected; affected `address_activity` rows move to `reorged`; no credit is issued
for an orphaned transaction; a credit already issued produces a reversal entry rather than an
edit; the alarm fires at `reorg_alarm_depth`; and processing resumes at the correct checkpoint
without gaps or duplicates.

**The Hearth conformance corpus.** The harness is `node/test/conformance/{loader,runner,report}.js`.
`fixtures/` is 39 files and 300 KB holding **121** runnable Shanghai vectors, committed, and runs
offline. `vectors/` is 3,425 files and 351 MB, gitignored, fetched by `scripts/fetch-vectors.sh`,
holding **20,766** vectors — 20,077 GeneralStateTests, 609 VMTests, 55 RLPTests, 25 TrieTests.
Hearth's own CI runs `npm test`, which executes all 31 entrypoints including the nine vector
suites and `runner.js --selftest` (85 checks) against the committed fixtures. What it does not
run is the full corpus. Beacon's `conformance.js` runs the nine vector suites plus the four
runner corpora hourly against a read-only checkout, reports `skip` with the path when the
checkout is absent, and never produces a green row without having executed something.

The rule from the spec is binding on both: **if a vector cannot be made to pass, the correct
response is to say so, not to skip it.**

**Testing signing without real money.** Three mechanisms, none of which involves a funded
mainnet key:

1. **Derive → sign → verify round trips** per family, against BIP-32/39/44 test vectors, asserting
   the derived address and the recovered signer without ever broadcasting. This is the gate before
   any production address uses HD derivation.
2. **Refusal tests, which need no key at all** — the security-critical half of custody is what it
   *declines* to sign. ForgeKeyvault's 58 signing tests are already this shape and are extended to
   Bitcoin and Solana.
3. **A cross-implementation differential test.** Hearth's `web/assets/wallet-selftest.js` runs the
   browser wallet's ports of secp256k1, RLP and the legacy transaction against the node's
   implementations over the same random keys and transactions, comparing `r`, `s`, `recoveryId`,
   the signed bytes, the hash and the recovered sender. A wallet that signs differently from the
   node does not bounce — it pays the wrong person. Custody gains the equivalent against
   `ethers`, `@solana/web3.js` and `xrpl`.

---

## 10. Migration testing

| Test | What it proves |
| --- | --- |
| **Restored-dump migration test** | Every migration runs to completion against a restored production dump, per service, with the lock duration and row count recorded. An empty-database test proves nothing about a production schema, and the boot-DDL conversion is the highest-risk item in P2 |
| **Idempotent re-run** | Running the full migration set twice produces the same schema and the same `schema_migrations` contents |
| **Interrupted-migration resume** | Killing the runner mid-set and re-running completes correctly. `ninety-days-after`'s existing test — "the players delete is the last of the dedupe, so an interrupted run can resume" — is the model |
| **Ordering test** | Where a migration's correctness depends on statement order, the order is asserted directly. The same repository already does this: "the duplicate players rows are retired before the unique index is created", because a unique index built over existing duplicates is not a failed migration, it is a service that no longer boots |
| **Dual-write comparator** | During P4, every mutation writes to both Pay and the ledger, and a comparator runs every five minutes over both, alerting on any divergence. Cutover requires **two weeks at zero divergence**, and dual write is not switched off at cutover — that is what keeps the read cutover reversible |
| **Backfill exactness** | Converted opening balances reproduce the P0 data census **exactly**. Not within tolerance |
| **Replay test** | The `balances` projection is rebuilt from the journal from entry zero and compared to the live projection. Run nightly in production as a shadow rebuild; a mismatch is a P0 page |
| **In-flight idempotency key survival** | Keys issued before the cutover are migrated, and a retry arriving after the cutover replays rather than double-charges |
| **Indexer shadow parity** | The indexer runs beside balance-probing for 30 days: every deposit either would have credited, both do, at the same depth, and the indexer additionally reports a real txid. Cutover is a flag |

---

## 11. Frontend testing

The estate has **zero render tests**. The three test files under `apps/` — `site.test.ts`,
`withdrawalQueue.test.ts`, `panelRead.test.ts`, 27 tests between them — all test pure library
modules, deliberately: `withdrawalQueue.ts` imports no runtime module, which is the whole reason
the withdrawals panel's rules are testable at all.

What is worth adding, and nothing beyond it:

| Level | Scope | Tool |
| --- | --- | --- |
| **Pure logic** | Formatting, unit conversion, address validation, permission derivation, query key construction | `node:test`, as today |
| **Component render** | Every component with a state machine: pending/confirmed/failed transaction states, per-tile dashboard degradation, the export ceremony's stages, the fee-review step, chart empty-vs-broken states | Vitest + Testing Library |
| **Interaction** | Forms that move money — send, convert, listing creation, key export. Assert the confirmation step cannot be bypassed and the destination shown is the destination submitted | Testing Library |
| **Accessibility** | `axe-core` on every route and every modal, failing on any serious or critical violation. Keyboard-only traversal of the send flow and the export ceremony. Every chart has its table view, which is both the accessibility fallback and the export path | `@axe-core/playwright` |
| **Visual regression** | The design system only — `@cloudsforge/ui` primitives, tokens in light and dark, the chart layer against [assets/chart-palette.md](assets/chart-palette.md). Snapshots live in `cloudsforge-ui`, not in nine applications | Playwright screenshots |
| **Bundle boot** | **Not covered. This row used to say "already covered", and it was wrong.** The thing it named is real but frozen: `surfaceJourney` asserts the body rendered more than 40 characters and collects console errors and failed requests — because a bundle that 404s leaves the network perfectly idle and `domcontentloaded` fires anyway — and it lives in the **legacy** repository (`stack/infra/beacon/src/journeys/web.js`, on `playwright-core`). `micro-beacon` declares six journeys and **none of them opens a browser** (`beacon/src/estate.ts`); it has no browser dependency at all. Specified as `BJ-<KEY>-404` and the per-surface smoke set in [22-browser-journeys.md](22-browser-journeys.md) | Beacon — **to be built** |

**Every tool in the right-hand column above is an intention.** Vitest, Testing Library and
`@axe-core/playwright` are named here and installed nowhere: no `*-web/package.json` lists any of
the three, and there is no Playwright, Puppeteer or Cypress anywhere in the estate. The frontends
run `node --import tsx --test test/*.test.ts` over their pure layer, deliberately and with the
reasoning stated (`hub-web/test/browser-stubs.ts`). The scenario catalogue that this table is
the summary of is [22-browser-journeys.md](22-browser-journeys.md).

**What is not tested at the frontend:** business rules. The game client withheld four SKUs from
its UI while Pay's routes stayed live and chargeable; a client-side test of the hidden catalogue
would have passed against that defect. Every rule is asserted server-side, and the client test
asserts only that the client sends what it claims to send.

---

## 12. Security testing

| Test | Asserts | Runs |
| --- | --- | --- |
| **Response-body scan** | No route in any service returns key material. The whole route surface is enumerated from the generated OpenAPI, called with a valid credential, and every response body and header is scanned for private-key patterns — hex of key length, WIF, BIP-39 word sequences, PEM blocks, XRP family seeds | Every PR, and as a cross-phase gate |
| **Deleted-route assertion** | `POST /admin/keys/:address/reveal` returns 404, and no successor route exists | Every PR in `custody` from P5 |
| **Purpose-gate negative** | A `deposit`-purpose key cannot sign a transfer. The `/sign` gate is driven with every combination of purpose × shape × destination, and every combination outside the allowed pair refuses with `SignRefused` and a named reason | Every PR in `custody` |
| **Treasury-pin negative** | A `deposit`-purpose sweep to any destination other than the pinned treasury refuses. For Bitcoin, every output of the PSBT — including change, which a sweep must not have — is checked | Every PR in `custody` |
| **Withdrawal destination negative** | An unverified (`watch`) external wallet cannot be set as a withdrawal destination, and a verified link with `withdrawal_destination` revoked cannot either. Asserted at the API, not only in the UI | Every PR in `wallet` |
| **Cross-network replay negative** | A transaction signed for testnet is rejected by mainnet chain-binding validation, per family | Every PR in `custody` |
| **Scope negatives** | A service token with `ledger:read` cannot post; a `custody:sign` token cannot export; an expired token is refused; a token for service A cannot act as service B | Every PR in `identity` and each provider |
| **Secret hygiene** | `.env` is not tracked; `.dockerignore` excludes `.env` and `.env.*`; no API-token pattern is committed. This already exists in every repository's CI and becomes one reusable workflow | Every PR |
| **Per-service secrets** | No container receives a variable it does not use, asserted against a declared manifest per service | Every deploy |
| **`/internal` refusal** | The internal surface is unreachable from outside, asserted against the gateway policy — the current CI asserts loopback binding and a cloudflared path rule, and the assertion moves rather than disappears | Every PR in `stack` |
| **Dependency scanning** | Dependabot/Renovate security updates auto-merged on green for patches; `pnpm audit --audit-level=high` fails the build; org-level secret scanning and push protection on, which they currently are not, on nine public repositories | Continuous |
| **MFA and rate limits** | Enrolment, challenge, recovery-code single use, and the last-factor removal rule; login and registration limits enforced under concurrency | Every PR in `identity` |

---

## 13. Performance testing

**Baseline captured in P0** — two weeks of telemetry across the running estate, giving p50/p95/p99
per route, error rates and job durations, committed as the comparison set.

**The gate at every phase: p95 within 20% of the P0 baseline**, compared in Grafana against the
captured figures. A regression beyond 20% blocks a gate; it is not a follow-up ticket.

Specific budgets, stated so they can fail:

| Surface | Budget |
| --- | --- |
| Hub dashboard, all upstreams healthy | p95 under 800 ms, and it renders with any one upstream down |
| Any single-service read route | p95 within 20% of baseline |
| Ledger posting | p95 under 50 ms, measured at the ledger, excluding the caller |
| Journey step duration | Within 20% of its own trailing 7-day median; Beacon already graphs this per step, which is why step names must be stable |
| Indexer lag | Below the confirmation depth for every chain, continuously; exceeding it pages |
| Relay lag | p99 under 30 s — and sustained breach for a week is one of the four written triggers for adopting a broker |

Load tests are run against staging before P6, P9 and P13, at the traffic shape those phases
introduce: fan-out reads for Hub, concurrent purchases for Market, and webhook fan-out for the
developer platform.

---

## 14. Chaos and resilience exercises

Rehearsed quarterly and at P13's gate, each with its runbook open, each producing a written
observation.

| Dependency | Exercise | Expected behaviour |
| --- | --- | --- |
| **Postgres** | Kill the primary for one service | `/readyz` returns 503 within one probe interval; the gateway removes the instance; in-flight requests drain; no partial write; recovery is automatic and no job is lost or double-claimed. Today every service returns a static `{ok:true}` that never touches Postgres, so a replica with an unreachable database reports healthy and 503s every request |
| **Custody** | Stop it for 30 minutes | Deposits still land and still credit; withdrawals and sweeps **queue** rather than fail; the status page shows the degradation; nothing retries into a signing storm on recovery; every queued item completes exactly once |
| **An RPC provider** | Blackhole one provider for one chain; then rate-limit it to 1 req/s | Failover to the secondary within the stated window; indexer lag recovers without gaps; the Chain Health dashboard shows the failover; no deposit is credited twice across the switch |
| **The event relay** | Stop it for one hour, then restart | Outbox rows accumulate and none is lost; on restart every event is delivered; every consumer's inbox dedupes redeliveries to exactly one effect; `activity` shows no duplicate entries; ordering per `(topic, key)` is preserved |
| **The gateway** | Kill one instance during a rolling deploy | Zero failed requests, proven by a journey running throughout |
| **Backups** | Restore drill from an off-host backup | Completes within the stated RTO with the stated RPO. `infra/backup.sh` today is unscheduled and writes locally, which is not a backup, and a dump file's existence is not evidence of a restore |

---

## 15. Test data management

- **Never production data.** No dump is copied to a developer machine, no production row is used
  as a fixture, and the characterisation recorder redacts at capture (§7).
- **Sandbox balances.** `devplatform`'s sandbox environment issues Shards and coin balances from
  a dedicated `clearing:sandbox` ledger account. Sandbox postings use a separate asset namespace
  and can never reach a production account — asserted by a test that attempts exactly that and
  expects a refusal.
- **Testnet wallets.** A small, named set of platform test wallets per family, with their
  addresses committed and their keys in custody under a `test` purpose that cannot sign a mainnet
  chain binding.
- **Faucet.** `cloudsforge-faucet` funds EMBER testnet journeys. It is built and carries 66
  checks and has never been deployed; P3 deploys it, and journeys that need EMBER `skip` with a
  reason until it drips.
- **Synthetic accounts.** Beacon's journeys register and tear down their own accounts, and
  `ctx.cleanup` runs on every exit path. The one shared synthetic account with a balance is
  protected by the scheduler running exactly one journey at a time.
- **Fixtures live with the code they describe.** A shared fixtures package would become a
  cross-repository coupling with no version discipline, which is the problem this whole document
  exists to avoid.

---

## 16. The definition of "green"

A repository, a release candidate or a phase gate is green when **all** of the following hold.
Any one failing means not green; there is no partial credit and no "green with known issues".

| Condition | Where checked |
| --- | --- |
| Every test in the recursive glob ran, and the count of discovered files equals the count of `*.test.ts` files in the repository | `service-ci.yml` |
| Zero failures, and **zero unexplained skips** — a skip must carry a reason and a recorded justification, and skips are reported as a first-class number, never folded into the pass count | Every CI run |
| Coverage floors for the service's tier are met, per directory | `service-ci.yml` |
| Every recorded consumer expectation replays successfully | Provider CI |
| The characterisation corpus replays with no undocumented difference | Extraction CI |
| All Beacon journeys pass **three consecutive runs** | Phase gate |
| **Zero muted journeys** | Phase gate |
| p95 within 20% of the P0 baseline for every route | Grafana comparison |
| Trial balance exactly zero, continuously, from P4 onward | Money Integrity dashboard |
| No route returns key material | Response-body scan |
| Secrets are per-service; no container holds a variable it does not use | Deploy check |
| Every new alert has a runbook link | Alert rule CI |
| No SKU is purchasable without a delivery handler | Catalogue-versus-handler test |

**The muted-journey rule.** A journey may be muted only by opening a P1 backlog item with a named
owner and a stated expiry date. **The count of muted journeys is a phase gate and must be zero
to pass one.** Muting is a way to keep a dashboard readable for a day, not a way to keep it
readable forever, and the failure mode it guards against — intermittent journeys quietly muted
until the suite means nothing — is the single most likely way this entire strategy is defeated.

The same reasoning governs skips. A journey without its credentials reports `skip` with the
reason and is never counted green; a unit suite where 29 of 56 tests silently skip because a
laptop has no Postgres is green in a way that means nothing. Both are the same mistake wearing
different clothes, and both are answered by counting skips out loud.

---

## 17. A check that cannot fail is not a check

§16 says when a repository is green. This section is about when that green is worth reading.

The largest single class of defect this estate has found is not a check that failed. It is a check
that **could not have failed** — one that went green having measured nothing, and had the green
read as evidence. The incident roster lives in the tracker, as a list of incidents should
(micro-org#38, opened 2026-08-05 with nineteen instances and back-filled to twenty-two inside the
week). What belongs in a strategy document is the rule, the corollaries the estate had to pay for
separately, and the obligation that makes any of it enforceable. Re-counted on **2026-08-10**:
twenty-seven issues carry the `vacuous-check` label, and the four newest were all found in the
five days before that count.

The detail that should change how these are read: in nearly every instance **the number was
already in the output.** `ok — all 0 compose pins match`, matching 0 of 44. `groups: []`.
`seeding skipped`. Nobody was denied the evidence. Every reader parsed the word `ok` and never
read the count beside it, which is why the remedy below is a property of the check rather than a
habit asked of the reader.

### 17.1 The rule, and the four corollaries

> **A check must fail when it measures nothing.**

Every check names the non-zero cardinality it expects and goes red on zero. §1's requirement that
the test glob discover as many files as the repository holds `*.test.ts` files is one instance of
this, and §16's insistence that skips are a first-class number rather than a component of the pass
count is another; they are not separate ideas, and neither is a special case.

Four consequences the parent rule does not reach, each of which had to be learned from a defect
that walked past it:

**Assert the derivation, or the behaviour — never the spelling.** A test that pins a constant to
its own current value is green for every possible value. The estate has now filed that tautology
twice under its own name — a test asserting that a client posted to the URL the client was written
to post to (micro-org#31), and then a frontend suite asserting that a hostname constant equalled
itself and appeared in the registry, both true, while the hostname had no DNS record at all
(micro-org#146). Its mirror image is just as bad and is harder to spot, because it goes red rather
than green: a guard that greps one file for the name of a mechanism fails the day the mechanism
moves somewhere better. `micro-emberkin`'s inbound-signature guard grepped `src/server.ts` for
`timingSafeEqual`; the comparison moved into
`@cloudsforge/contracts-events`, which is exactly where it belongs, and the guard read the correct
fix as *"the check is gone"* and failed the commit that repaired the thing it existed to protect.
**A guard that fails on the correct fix teaches people to delete the guard.** It now asserts the
property it always meant — that the route calls `verifyInbound`, that the call precedes the first
`JSON.parse` of the raw body, that a failure answers 403, and that the scheme is imported from the
contract rather than re-implemented locally.

**A check that enumerates a surface must also say which surfaces must NOT be there.** An
allow-list that only ever grows is a list of things somebody once wanted, not a specification.
This is the worst variant in the roster because it does not merely fail to catch a defect, it
affirmatively certifies one: `estate-verify.sh` enumerated a faucet page and asserted a 200 with
the app shell, against a testnet faucet live on a **mainnet** hostname (micro-org#147). The check
was correct about its own question, and the question was the wrong one.

**A fake is a claim about the thing it fakes, and the fields it omits are the claims it cannot
make.** A test double that drops a field cannot disagree with the real thing about that field, so
every assertion over it is silently out of scope, and the suite reports the coverage anyway.

**"Could not run" is not "ran and found nothing."** They are different states and a check must
return different exit codes for them. `estate-bootstrap.sh` printed `ok` for *"seeding skipped: no
node on this machine"*, every time, for months (micro-org#13); a skipped conformance suite counted
as a passed one and opened a release gate on no evidence (micro-org#83). The same mistake in a
frontend suite is an `existsSync` early return that renders as a pass, named as the anti-pattern
in `micro-ui`'s `packages/ui/src/cite.ts`.

### 17.2 The proof obligation — mutate it, watch it go red, restore

None of the above is enforceable by review, because every one of these checks looked correct to
the person who wrote it. A check is not trusted because it is green. **It is trusted because
somebody broke the thing it guards, watched it go red, and read the diagnosis it printed to
confirm it named what was actually broken.** Anything less is a promise.

The estate already does this in its strongest places, and those are the places to copy:

- **The response-body scan plants a known-bad before it grades the real tree.** Every `estate-ci`
  run injects private key material into a route and requires the sweep to go red *and name the
  injected file, route and field*, then removes it and requires green again — because a scan that
  is measuring nothing prints exactly the same clean report as a clean estate. The canary's own
  result is published beside the scan's, and neither is accepted as the other's evidence.
- **`micro-mint`'s indexer route cross-check is a CI job that mutates its own checkout** and
  requires the job to go red, because a job that graded a file it failed to fetch looks identical
  to a job that passed.
- **`micro-billing`'s fee-recycle guards were each watched go red on 2026-08-10** before the change
  was accepted — the ledger metadata keys restored to their old spelling produced
  `actual: ['grossShards', 'periodStart', 'recycleBps', 'refundedShards']`, in red — and each was
  restored to green afterwards.

Two ways the obligation is itself got wrong, both already paid for here:

- **A mutation that hardcodes the value it mutates goes stale exactly when the thing it guards
  changes, and then fails with a diagnosis that is false.** `micro-mint-web`'s CI bent one route
  citation by naming the line; the day `micro-mint`'s table moved, the mutation applied to nothing,
  the suite passed unmutated, and the step reported that the cross-check had accepted a wrong
  citation ([18](18-build-status.md) §3.3o). It reads the value now, and refuses to grade a file it
  did not change.
- **A mutation must break the property, not the syntax.** The interesting mutations are the ones
  that stay valid. Renaming `$labels.device` to `$labels.disk` in an alert annotation does not
  error — it renders the page as *"ext4 has recorded 3 error(s) on , which holds every backup"* —
  and `promtool check rules` is green on it. A mutation set made only of syntax errors proves the
  parser works.

### 17.3 The four newest instances, and what each one adds

Measured between 2026-08-05 and 2026-08-10. They are recorded here rather than left in the tracker
because each one names a shape the roster did not already have.

| The check | Why it could not fail | Repaired |
| --- | --- | --- |
| `micro-emberkin`'s CI grepped `src/server.ts` for `timingSafeEqual` as a proxy for "the inbound signature is verified" | It asserted a spelling in one file. The scheme moved into `@cloudsforge/contracts-events` and the guard failed the commit that fixed the defect it guarded | Asserts the property — `verifyInbound` called, before the first parse, 403 on failure, scheme imported not re-implemented. Checked both ways round: passes on the tree, fails on a copy with the verify call removed |
| `micro-aetherholm-assets`' README stated which pictures illustrate mechanics the built game does not have — as a hand-written paragraph | The claim about another repository was **written down instead of measured**, so it was green whatever that repository did. Section 11 recorded four gaps and none of them was the real one; it also held `private-skerry` back as unbuilt while `provisioning.ts` was raising skerries against paid entitlements | `gaps.py` measures the service's own non-test source every run, in **both** directions — a picture whose mechanic has since been built fails as loudly as one whose mechanic is missing. It asserts it read something before grading, and exits `2` rather than `0` when there is no sibling checkout. Red on three of four before the change, green after (micro-org#186, 2026-08-10) |
| Three deployed alert rules were valid YAML that could never fire — `BackupAgeExceeded`, `LedgerReconciliationDrift` and `ChainHeightSpreadSustained` read metric names that do not exist among the 1,329 the mainnet Prometheus holds | `promtool check rules` validates syntax, not reachability, and every one of the three had a runbook. `make check-rules` had been in the Makefile the whole time and had never been in CI | The rules are restated or retired against measured metric names, and `prometheus/rules/alerts.test.yaml` is the first promtool unit test in the estate — mutation-proved on 2026-08-10 by three edits that each took `promtool` from exit 0 to exit 1, then restored (micro-org#310, micro-org#207) |
| `micro-billing`'s `fakeLedger` did not record `metadata` at all | The recycle wrote a retired asset's name into the **permanent** audit metadata of an EMBER ledger entry, and nothing in the repository could see the keys. The suite stayed green while disagreeing with the ledger it modelled | `testsupport.ts` records `metadata`, with the reason written at the field: a ledger entry is never edited — corrections are reversals — so a wrong key there is wrong for ever, which is exactly the kind of thing a fake has to expose (micro-org#336, 2026-08-10) |

The alert row carries a structural note worth keeping separately, because it is the enumeration
corollary in its live form. `prometheus/rules/` is bind-mounted whole into the container while
`prometheus.yml` names its rule files one by one, so **presence in the mount is not loading** and
nothing compares the two sets. `alerts.test.yaml` is outside the enumeration deliberately and the
commit that added it says so. Measured against the mainnet Prometheus on 2026-08-10 — two rule
files present in the mount, the same two loaded, 17 groups, 48 rules — so nothing is orphaned
today. The hazard is that the next file dropped into that directory would be mounted, unloaded and
indistinguishable from a rule that is simply not firing.

### 17.4 This repository is not exempt, and neither is any other

`docs` runs one check of its own, `tools/check-dead-patterns.mjs`, which fails a document that
still instructs a reader to build something the estate has retired. Until 2026-08-10 it printed
`dead-patterns: clean` and exited 0 whether it had read forty-three documents or none: it walked
from a path derived at import time, and a walk that returned an empty list produced the same
output as a clean sweep. That is the `ok — all 0 compose pins match` shape exactly, in the
repository that states the rule.

It now plants its own known-bad before it grades anything, the way the response-body sweep does,
and it reports what it read:

```
dead-patterns: canary ok — the scanner named all 2 planted specimens, and both escapes silenced it
dead-patterns: clean — 43 documents, 27674 lines, mentions: testnet-two-label 8, worlds-api-rename 26
```

Those figures are a measurement taken on 2026-08-10 and they will move with the corpus; that is
the point of printing them. The old output carried a verdict and no denominator, and a verdict
with no denominator is the one thing a reader cannot check.

The canary drives the real scanning function rather than a re-typed copy of it, because
micro-org#238 was a duplicated predicate that drifted until CI was verifying the copy instead of
the one that ran. It asserts both directions — an uncorrected mention is named, and each of the
two deliberate escapes silences it — since a guard that cannot be silenced on purpose gets deleted
by the first person it inconveniences.

Proved by mutation on 2026-08-10 rather than asserted. Four edits, each taking the check from
exit 0 to a non-zero exit, each restored:

| Mutation | Result |
| --- | --- |
| An uncorrected retired hostname appended to a real document | **exit 1**, naming the file, the line and the correction to apply |
| One pattern's regex rotted by a character | **exit 2** — *"THE CHECK CANNOT BE SHOWN TO FAIL — refusing to grade the corpus"*, and no verdict on the corpus is printed at all |
| The walk pointed at a tree holding no documents | **exit 2** — *"read 0 documents … nothing was measured, and that is not a pass"* |
| A pattern whose retired thing has left the corpus entirely | **exit 2**, naming the pattern and requiring a person to decide between retiring it and repairing it |

The last one is the least obvious and the most valuable: a pattern that matches nothing anywhere
is guarding nothing, and it is silent about it in exactly the way a clean corpus is. It is also
the shape that makes a recorded exception announce its own expiry: `micro-org`'s
`tools/estate-topics.mjs` fails the run when a recorded gap stops matching anything — *"the record
no longer describes the estate — the gap is closed, or it has changed shape. Delete it"* — because
a record that outlives its finding is the permanent allow-list the check exists not to become.

The three exit codes are three states and are never collapsed. `0` is a clean corpus, `1` is a
document prescribing a retired thing, and `2` is *the check could not run, or could not be shown
able to fail* — because a check that passes when it cannot run is worse than no check, and that is
the whole of micro-org#13.

A document that tells the rest of the estate to prove its checks can fail, guarded by a check
nobody had ever proved could fail, is the same defect one level up.
