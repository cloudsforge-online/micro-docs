# 18 — Build status

Where the programme actually stands, by repository. Everything else in this directory describes
what *should* be built; this file records what *has been*, so that anyone picking the work up —
including a future agent with no memory of the sessions that produced it — can tell the two
apart without reading 46 repositories.

**This document is a ledger, not a plan.** It is updated when a repository lands, and it never
claims a repository is done on the strength of intent. "Done" here means the specific thing
[17-definition-of-done](17-definition-of-done.md) says it means: installs, typechecks under the
strict settings, tests green, migrations present, `.env.example` with placeholders only, CI
calling the org's reusable workflow, and pushed to `cloudsforge-online`.

Last verified: 2026-07-31.

---

## 1. The number

Of the 43 repositories this programme creates or changes — the 46 in
[03-repository-responsibilities](03-repository-responsibilities.md) less the three left exactly
as they are (`hearth`, `asset-forge`, `stack`), plus the five added by [19-new-products](19-new-products.md) — **33 are done**.

| Group | Target | Done | Left |
| --- | ---: | ---: | ---: |
| Domain services | 24 | 19 | 5 |
| Frontends | 14 | 5 | 9 |
| Operations | 3 | 3 | 0 |
| Libraries | 4 | 3 | 1 |
| Org infrastructure | 3 | 3 | 0 |
| **Total** | **48** | **33** | **15** |

Four further repositories exist that the plan did not enumerate as products — `brand`,
`conformance`, `deploy`, `docs` and `emberkin-assets` — bringing the pushed count to **38**.

**Repository count is the least useful measure of the three, and it is the one that flatters.**
The truthful reading is that the *expensive* half is behind us. Everything that touches money,
keys, chain state or identity is built and adversarially tested: ledger, custody, settlement,
indexer, wallet, pricing, billing, identity, policy. What remains is dominated by frontends,
which are lighter per repository, and by three operational services whose behaviour is already
specified in [13-operational-model](13-operational-model.md).

**CI is green across all 32 repositories** (verified on the runner, 2026-07-31) — including the
sixteen that silently had no workflow file at all, despite the definition of done claiming CI
everywhere. That claim is now true rather than assumed.

**The measure that is still not flattering: nothing is deployed.** Every repository below passes
its own suite in CI, on a real Postgres. Not one is running in an environment. Phase exit is
defined by behaviour in an environment, so on the criteria in
[06-ecosystem-workflow](06-ecosystem-workflow.md) no phase has formally exited.

---

## 2. Done

Test counts are `test(` declarations counted statically across each repository's `*.test.ts`.
Actual run counts are equal or slightly higher, because a few suites generate cases in a loop.

### 2.1 Libraries and org infrastructure

| Repo | Tests | Notes |
| --- | ---: | --- |
| `micro-runtime` | 117 | Six packages. Replaces the six byte-identical `obs.ts` copies and five divergent auth middlewares. |
| `micro-contracts` | 176 | Four packages built (`-chain`, `-events`, `-money`, `-auth`). `-market`, `-worlds`, `-create`, `-devplatform` are not yet cut. |
| `micro-ui` | 70 | Design system. Product accents corrected from ΔE 4.1 to 17.0 — the original set was not distinguishable under two of the three common CVD simulations. |
| `micro-org` | 33 | The `.github` repo: `cfctl`, reusable workflows, the contract-compat checker. |
| `micro-service-template` | 41 | Wires every runtime lib. `cfctl new service` instantiates it. |
| `micro-web-template` | 65 | Vite, React 19, design system, runtime host resolution, honest 404. |

`micro-sdk` — the public developer surface — is **not built**. It is the one missing library and
it blocks P11.

### 2.2 Domain services

| Repo | Tests | The thing it proves |
| --- | ---: | --- |
| `micro-identity` | 137 | MFA, sessions, refresh-token family reuse detection, JWKS rotation. |
| `micro-ledger` | 122 | Double-entry. The deferred constraint is proven by bypassing the service with raw SQL — an unbalanced journal cannot be committed even by an attacker with a database connection. |
| `micro-custody` | 173 | HD BIP-39/BIP-44 derivation. The admin reveal endpoint was deleted rather than guarded. |
| `micro-wallet` | 180 | Holds no balances. Composes ledger, custody and indexer. |
| `micro-settlement` | 116 | The chain-keyed lease, proven by running two workers against one chain — this is the lost-payment race. |
| `micro-indexer` | 98 | Multi-chain with a simulated reorg, tested against a real Hearth node. |
| `micro-pricing` | 82 | Quotes live in a table, not a `Map`, so a restart does not silently reprice. |
| `micro-billing` | 90 | Entitlements with scope, expiry and revocation. |
| `micro-policy` | 66 | Fail-closed and fail-open are separated deliberately, per decision in [12-security-decisions](12-security-decisions.md). |
| `micro-activity` | 43 | Inbox deduped on `source_event_id`. |
| `micro-notify` | 119 | A critical notification ignores preferences — enforced three independent ways, because one mechanism is a mechanism that gets refactored away. |
| `micro-mint` | 109 | A deploy leaves the request (202). The estate's 180-second held request is gone. |
| `micro-worlds` | 119 | A private world is finally provisioned — the defect that made the feature inert. |
| `micro-studio` | 121 | FLUX 2 Pro generation with provenance recorded per asset. |
| `micro-hub-api` | 77 | Seven degradation tests: one upstream down never blanks the dashboard. |
| `micro-market` | 275 | Escrow is a *reference* to a ledger reservation, never a balance. Royalty splits sum exactly to the sale price in bigint. Proven end to end: one balanced entry, debit 1000 SHARD against credit 925 + 25 + 50. |
| `micro-trade` | 227 | A backtest is byte-identical across 100 runs on one seed, and genuinely differs on another. A fill whose ledger answer was lost is credited once. Two workers, one bot tick, one execution. |
| `micro-foresight` | 153 | The Hearth-native prediction market. **The service has no key and holds no stake** — `stake-intent` hands a wallet the contract address and calldata, and the wallet signs. Drop the `positions` table and every stake is still in the contract and every winner can still `claim()`. Contract invariants are proven against the *executed committed bytecode* on `@ethereumjs/evm`: fee + payouts + residue == pool exactly, residue < winners, double-claim reverts, claim-after-void refunds whole with zero fee. The fee comes off the losing pool only, so a winner never gets back less than they staked; a market nobody won voids rather than handing the treasury a windfall. |
| `micro-emberkin` | 75 | The second Forge Worlds title, ported from *Kindred: Resonance*. **The ported RNG reproduces the C# `NextDouble()` bit-for-bit** (compared as raw IEEE-754 int64, not epsilon), and a corpus of 10 recorded battles replays byte-identically from seed — the same behavioural-equivalence discipline the trade backtest uses. No balance column; a cosmetic equip is a billing entitlement and never a stat. |

### 2.3 Frontends

| Repo | Tests | The thing it proves |
| --- | ---: | --- |
| `micro-hub-web` | 174 | Every call cites the `hub-api` line that serves it. Where hub-api serves no route — transfers, notification preferences, a device inventory — the page renders a named hole rather than a plausible screen over nothing. |
| `micro-site` | 185 | No number appears on the marketing site that is not checkable against something real in this estate. |
| `micro-emberkin-web` | 430 | The game client. **It deletes the battle engine, the RNG and the localStorage save path it inherited** — a client that can resolve a battle can lie about one, so battles resolve server-side and a test plus a CI step fail if any of it returns. `three` is lazy: the dex, party and wardrobe download no renderer. |
| `micro-foresight-admin-web` | 241 | The operator console, its own bundle by design. Irreversible actions are gated by consequence-in-sentences, then a required rationale, then typing a phrase naming the market AND the outcome — never "Are you sure?". It asserts the ABSENCE of three routes it might have invented, including a close endpoint (the contract closes itself). |
| `micro-foresight-web` | 357 | The public prediction market. **It recomputes the question hash in the browser** from the canonical bytes the service serves — `foresight/src/server.ts:420-423` puts that document on the wire precisely so nobody has to take the platform's word for what they staked on. Odds are the pool ratio in bigint, always rendered with the pools that produce them; the stake projection adds the stake to the pool it is paid from, showing dilution rather than the ~33% overstatement the naive formula gives. `claim` reads the contract through the reader's own wallet — chain outranks mirror and the two are never blended, so the page keeps the button live even when it cannot confirm the amount. |

Cutting it found two defects in `micro-web-template`, both fixed there and both worth recording
because the template is the source of the ten frontends still to come: the error envelope is
**nested** (`{error:{code,message,requestId}}`) and was read as flat, so every server-side failure
would have rendered `[object Object]` while discarding the request id the support flow runs on;
and the CI step forbidding the SPA 200-fallback grepped `nginx.conf` unstripped, matching the
comment that explains why the fallback is forbidden — so the template failed its own pipeline,
and a guard that fires on its own rationale is a guard people delete.

### 2.4 Operations

| Repo | Tests | The thing it proves |
| --- | ---: | --- |
| `micro-lantern` | 204 | Log triage. Credentials are scrubbed at ingest before persistence — a planted `sk-`/`ghp_`/`AKIA`/bearer/DSN-password/`Set-Cookie` is provably absent from the database afterwards, which the frozen ancestor never did (it stripped NUL bytes and called it sanitising). A noisy message carrying a UUID or address groups stably instead of once per occurrence. |
| `micro-faucet` | 157 | Testnet EMBER faucet, and **the process holds no key**: a drip is a native transfer with empty calldata, which is exactly the `transfer` shape custody's `treasury` purpose maps to, so custody signs it. It uses its own treasury address rather than the platform's, so it and settlement never share a nonce. The lease was proven by *removing* it — two and four workers then rely on the partial unique index alone. |
| `micro-beacon` | 369 | **The release gate (AD-04), and it is fail-closed.** An unknown refuses before anything else is considered, and an override cannot reach an unknown — enforced three independent ways: in `decide()`, by the CHECK constraint `gate_decisions_indeterminate_never_promotes`, and by the CLI exiting 2 when it cannot reach Beacon. Six known refusal codes and six unknown ones. |

Two design corrections it found while building, both worth keeping: budget exhaustion derives from
consumed parts-per-million rather than `remaining <= 0`, because a 100%-objective SLO allows zero
bad events and would otherwise have been frozen permanently *for being perfect*; and
`probe_state.updated_at` is nullable on purpose, because defaulting it to `now()` makes every newly
added probe wait a full interval before its first run.

It also retired an inherited rationale rather than inherit it: the old implementation argued
`/metrics` must never touch Postgres, which is sound for one replica holding state in a `Map` and
wrong with replicas, where it yields a different answer depending on which one Prometheus reached.

### 2.5 Supporting repositories

| Repo | Tests | Notes |
| --- | ---: | --- |
| `micro-emberkin-assets` | — | 83 planned, **83 delivered** (134 files with derivatives), CI run 30663724437 green. Prompted from the `visuals.json` spec the game already ships. Grounds normalised numerically: delivered range was `#040404`–`#4c4c44` across 20 distinct values; all 123 flat assets now measure `#12100f` exactly in four corners (the 11 exceptions are full-bleed scenes, where a brand ground does not apply). All 24 evolution lines inside the 45° family ceiling. |
| `micro-brand` | — | 73 generated assets. Grounds normalised numerically to exactly `#12100f`; FLUX will not reproduce an exact hex and delivered `#232324`–`#3f3a3b` across the run. |
| `micro-conformance` | 59 | A recorded corpus of 60 interactions from the live estate — the behavioural baseline a successor must match. |
| `micro-deploy` | — | OTel collector, Prometheus, Tempo, Loki, Grafana. Configuration only; not running. |
| `micro-docs` | — | This directory. |

Across the estate: **~4,950 tests**, all green at last run.

---

## 3. Left

### 3.1 Partially built, paused on disk

| Repo | State |
| --- | --- |
| `micro-sdk` | Taken next. |

An earlier revision of this section listed `micro-status-web` and `micro-faucet` here as having
scaffolding on disk. **That was wrong** — neither directory exists; both agents were killed before
writing anything. Corrected rather than quietly amended, because a false "finish job" entry costs
whoever picks it up a session before they discover there is nothing to finish. Both are in §3.2.

### 3.2 Not started

**Services (5):** `nda`, `community`, `devplatform`, `admin-api`, `analytics`. Also added by
[19-new-products](19-new-products.md) — 19: both `emberkin` and `foresight` are **done** (§2.2).
`micro-nda` is the *Ninety Days After* game service; it is the one remaining service with a real
existing implementation to port, and it is the largest of the five.

**Frontends (12), of the 14:** `emberkin-web`, `foresight-web`, `foresight-admin-web` (added by 19), plus `admin-web`, `mint-web`, `trade-web`, `worlds-web`, `explorer-web`,
`network-site`, `market-web`, `devportal-web`, `status-web`. Six of these are ports of existing
applications rather than new work; `market-web`, `devportal-web` and `status-web` are new.

**Operations (1):** `faucet`. `beacon` — **the release gate (AD-04)**,
and until today the reason no phase could be shown to have exited on evidence rather than
assertion — is done. `faucet` is described in 03 as already built and tested inside
`hearth/tools/faucet`, needing only extraction; that claim is being checked against the source
rather than repeated, as several inherited claims in this directory have not survived checking.

**Libraries (1):** `sdk`.

### 3.3 What the CI could not do, and can now

Recorded because it is the most consequential thing found so far and none of it is visible in a
repository count. Every service and frontend declared a call to the org's reusable workflows, no
repository had pushed, and so **the workflows had never once run**. They could not have worked:

| Defect | Consequence |
| --- | --- |
| `micro-org`'s Actions access was `none` | No repository in the org could call a reusable workflow at all. |
| `service-ci.yml` had no Postgres container | Fifteen database-backed suites could not run. |
| Suites *skip* without a DSN rather than fail | So the consequence was a **green** pipeline that had executed none of the ledger's deferred-constraint, custody's overdraft-trigger or settlement's lease assertions. Green while proving nothing, and believed. |
| Rule 1 compared the declared variable by exact string | Rejected all fifteen services, for reading their own test database. |
| Thirteen `grep` captures lacked `|| true` | `grep` exits 1 on no match and GitHub runs `bash -e`, so each check **aborted on a clean repository**. They were red on correct code and had never passed anywhere. |
| `secret-hygiene` knew `changeme`, not `CHANGE_ME` | Failed five services on obvious placeholders — while passing a remote `postgres://` DSN carrying its password. |
| `web-ci.yml` required an invented deep link to return 200 | The exact opposite of the estate's honest-404 rule, which `web-template` fails the build over. A frontend could satisfy one guard or the other, never both. |
| The `image` smoke test booted the container against a DB that was not there | `index.ts` asserts its schema before binding and `env.ts` validates at import, so with no database and no config the container exits before serving. The job could never pass for any service. (9th defect, fixed with the test job's Postgres, `--network host`, and a `smoke-env` input.) |

All fixed, each verified in both directions — correct code passes, a planted violation is still
caught — and pinned by 56 tests in `micro-org`.

**Resolved on 2026-07-31: all 32 repositories are green on the real GitHub runner.** The root
cause was as diagnosed — the npm scope `@cloudsforge` does not match the org `cloudsforge-online`,
so GitHub Packages cannot host these packages and publishing was never available. Option 2 was
therefore the only coherent exit: the reusable workflow now checks out `micro-runtime` and
`micro-contracts` (and `micro-ui` for frontends) as siblings with a `contents:read` token, installs
each sibling's OWN dependencies first — `link:` resolves through the sibling's `node_modules`, so a
`link:` with no sibling installs as a *dangling symlink*, which is why `Install` passed while
`Typecheck` could not find one `@cloudsforge` module — and passes the same directories to
`docker build` as named build contexts.

Three further defects surfaced only by running it (10–12), all fixed with regression tests:
`contract-compat.yml` fetched the checker from the private org repo with the **job token**, scoped
to the calling repository, so it failed for every contract repo; the checker linked only the
workspace-root `node_modules`, so under pnpm the base side resolved to `any` and every real type
read as a breaking change; and well-known-symbol members carry TypeScript's per-compilation symbol
id, producing hundreds of phantom findings. On the real repository this moved a wall of false
breakage to 256 vs 256 paths and exit 0 — while deleting `Posting.sequence` still exits 1 and names
it. **`micro-contracts`' `pnpm compat` had been pointing at a `tools/compat.ts` that has never
existed in that repository, so the estate's contract-compatibility gate had never run anywhere.**

### 3.3 Cross-service defects, and the only thing that finds them

Every service's suite is green, and that has now twice failed to catch a client calling a route
that does not exist. Both were found the same way — by a *new* service reading the upstream's
actual route table while writing its own client — and never by a test.

| Defect | Consequence |
| --- | --- |
| `wallet` called `GET /v1/quotes`; pricing serves `GET /rates` | Found by `hub-api` reading both. |
| `market` called `POST /v1/decisions/market.listing`; policy has **no `/v1` routes at all** and takes the action in the body, and registers `market.listing.create` not `market.listing` | Found by `foresight`. |

The second is worth stating precisely, because it was first reported to me as the gate being
*bypassed* — a 404 swallowed into `review` + `degraded`. Checking it against the source showed the
opposite: `peerDecided` is true for **any** 4xx (`runtime/packages/http/src/index.ts:49-51`), so the
404 landed on the `deny` branch and `market/src/server.ts:678` turns a deny into 403. The
marketplace was not unmoderated — **it was closed. Every listing creation returned 403.** The two
failures need opposite fixes, so guessing between them would have fixed neither.

Fixed, plus the flaw the investigation exposed: a 404 or 405 no longer counts as a decision at
all, because a route that does not exist is our own misconfiguration and says nothing about a
seller's listing. Eight new tests assert the **request** — path, action name, body shape, the
amount crossing as a decimal string — rather than the response, which is the gap that let both
defects live: every existing test stubbed fetch and asserted behaviour given a reply.

A third instance followed within a day, and it was not a route: `micro-foresight-web` found that
the accent added to `micro-ui` for its own product was written `[data-product='foresight']`,
missing the `cf-` prefix every other product carries. The rule matched nothing, so the product
rendered in the company ember — **it looked entirely correct while wearing the wrong colour** — and
seventy-five green tests in `micro-ui` could not see it. The same commit gave the product
`devPort: 4011`, which is `beacon`'s, so a local Forge Foresight resolved to the monitoring
service. Both are fixed, with guards proven against the defects by reintroducing them.

**This is the case for the consumer-driven contract testing in
[14-testing-strategy](14-testing-strategy.md), which is still a strategy rather than a passing
gate.** Three for three, what caught the defect was a downstream reader consuming the upstream for
the first time — never the upstream's own suite. That does not scale to 48 repositories, and the
third case shows the gap is wider than routes: it is any promise one repository makes that another
consumes.

### 3.3b What generating the Emberkin art taught, worth keeping

The run cost ~129 generations for 83 assets — 46 of them retries — and every retry traced to a
prompt defect rather than model randomness. Four are worth recording because they generalise:

1. **Two copies of the colour table.** `plan.ts` wrote the subject noun and `generate.ts` wrote the
   albedo clause, each holding its own nine colour words. Correcting only one produced a
   regenerated asset that measured *identically wrong*, and cost a paid call to discover. One
   table now, looked up by hex. Duplicated constants drift in prompts exactly as they drift in
   code.
2. **A motif names a shape and a material, never a colour.** All seven verdant Kin inherit
   `"leaf frills, bark plating"` verbatim from upstream `visuals.json` — and bark is brown. The
   same clause explains frost (`"ice crystal spines"` → white), Stormcrow
   (`"hollow bones, streamer feathers"` → black) and umbra (`"void-black core"` → black). Four
   apparently separate defects, one cause.
3. **"Deepened" means richer, not darker.** The apex-stage direction said "darker shadow ramps";
   the model took that to black, so branch tips passed every numeric measure and still did not read
   as family members. A metric can be satisfied by an image that fails the intent.
4. **Colour words are measurable, so measure them.** Same prompt otherwise: "fresh leaf green" →
   hue 74, "emerald" → 96, "jade — halfway between emerald and teal" → 132–134, and adding
   "SATURATED" pushed it back to 103. Choosing words by measurement rather than by taste is what
   made the fix converge.

The method that kept it cheap: **all fifty portraits were measured against their anchors before
anything was regenerated**, and each correction was trialled on one asset before a line of seven
was re-run. That is why the pass cost 37 calls rather than ~150.

### 3.3c A defect in the frozen estate: the testnet faucet defaults to mainnet

Found while porting `hearth/tools/faucet`, and recorded rather than fixed, because
`stack/` is frozen and the successor supersedes it.

`stack/repos/hearth/tools/faucet/src/env.js:94` defaults `chainId` to **7411**. The exact-pinned
`contracts-chain` package puts EMBER at `{mainnet: 7411, testnet: 7412}`
(`contracts/packages/chain/src/index.ts:57`). So the faucet's shipped default is **mainnet**, and
its boot check (`src/index.js:71-75`) compares the node against that *configured* value — it
verifies agreement, not identity — so a mainnet node passes cleanly. The configuration did not
even match the network it runs against: the local testnet node answers `0x1cf4`, 7412.

It was never deployed, which is the only reason this is a finding rather than an incident. A
faucet exists to give away money; one that can be pointed at mainnet by leaving a variable unset
will eventually be.

`micro-faucet` refuses to start against any chain id that is not the testnet's, and proves the
refusal with a test — the difference between checking that two values agree and checking that a
value is the right one.

### 3.4 What only CI could catch

The point of the exercise, and the answer to "the suites pass locally, why bother": four real
defects were invisible to a green local run.

| Defect | Why local missed it |
| --- | --- |
| `runtime/packages/lifecycle` — two `unref()`'d timers. The drain-delay one is the serious one: unref'd, a draining process **exits the event loop instead of pausing**, so it skips the delay that exists to let the load balancer notice it is going away — dropping precisely the in-flight requests the drain was written to protect. | Node 24 hid it incidentally; Node 22 (the CI runtime) showed 16 cancelled tests. Now 21/21 on Node 22 and 117/117 on Node 24. |
| `custody/src/hd.ts` — `import { ECDSA } from 'xrpl'` throws at import. xrpl is CommonJS and defines `ECDSA` through a `defineProperty` getter Node 22's CJS lexer cannot see, so **every suite touching `hd.ts` died before running**. | Node 24's lexer finds it. A version difference between laptop and runner. |
| `billing` — fixtures asked questions on a frozen timeline while grants defaulted to the database's `now()`. | It agreed *by luck* until the wall clock passed 2026-07-30; then 8 tests failed and the expiry fixtures violated a CHECK constraint. A test that passes because of today's date. |
| `beacon` — the same class: fixture-time setup evaluated against real time, stale from 11:00 UTC on the fixture's own date. | Identical reason. |

Two of these are latent production defects, not test artefacts — the drain hole is in the shutdown
path of every service in the estate, and the xrpl import is in the custody service's key
derivation.

### 3.5 The work that is not a repository

Listed because a repository-count metric hides it, and because it is what stands between this
programme and a running platform:

1. **Nothing is deployed.** No environment, no gateway routing, no release manifest exercised.
2. **No cross-service integration has ever run.** Every service is proven against its own tests
   and its siblings' route tables. The consumer-driven contract tests described in
   [14-testing-strategy](14-testing-strategy.md) exist as a strategy, not as a passing gate.
3. **No data has been migrated.** [10-migration-strategy](10-migration-strategy.md) is unexercised.
4. **The four uncut contract packages** (`-market`, `-worlds`, `-create`, `-devplatform`) are
   currently local types inside their services, which is the exact drift the contracts repo
   exists to prevent.

---

## 4. How to update this file

Add the repository to §2 with its real test count and one line naming the defect or invariant it
proves — not what it does, which §03 already says. Remove it from §3. Correct §1's table and its
narrative, including the sentence about what the remaining work is dominated by, which stops
being true at some point and should not be left standing when it does.

Do not mark a repository done because its code is written. It is done when it is pushed and its
suite is green, and the count in §2 is evidence of that rather than decoration.
