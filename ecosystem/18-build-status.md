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
as they are (`hearth`, `asset-forge`, `stack`) — **22 are done**.

| Group | Target | Done | Left |
| --- | ---: | ---: | ---: |
| Domain services | 22 | 15 | 7 |
| Frontends | 11 | 1 | 10 |
| Operations | 3 | 0 | 3 |
| Libraries | 4 | 3 | 1 |
| Org infrastructure | 3 | 3 | 0 |
| **Total** | **43** | **22** | **21** |

Four further repositories exist that the plan did not enumerate as products — `brand`,
`conformance`, `deploy` and `docs` — bringing the pushed count to **25**.

**Repository count is the least useful measure of the three, and it is the one that flatters.**
The truthful reading is that the *expensive* half is behind us. Everything that touches money,
keys, chain state or identity is built and adversarially tested: ledger, custody, settlement,
indexer, wallet, pricing, billing, identity, policy. What remains is dominated by frontends,
which are lighter per repository, and by three operational services whose behaviour is already
specified in [13-operational-model](13-operational-model.md).

**The measure that is not flattering at all: nothing is deployed.** Every repository listed below
exists as code that passes its own tests. Not one of them is running anywhere. Phase exit is
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

### 2.3 Frontends

| Repo | Tests | The thing it proves |
| --- | ---: | --- |
| `micro-hub-web` | 174 | Every call cites the `hub-api` line that serves it. Where hub-api serves no route — transfers, notification preferences, a device inventory — the page renders a named hole rather than a plausible screen over nothing. |

Cutting it found two defects in `micro-web-template`, both fixed there and both worth recording
because the template is the source of the ten frontends still to come: the error envelope is
**nested** (`{error:{code,message,requestId}}`) and was read as flat, so every server-side failure
would have rendered `[object Object]` while discarding the request id the support flow runs on;
and the CI step forbidding the SPA 200-fallback grepped `nginx.conf` unstripped, matching the
comment that explains why the fallback is forbidden — so the template failed its own pipeline,
and a guard that fires on its own rationale is a guard people delete.

### 2.4 Supporting repositories

| Repo | Tests | Notes |
| --- | ---: | --- |
| `micro-brand` | — | 73 generated assets. Grounds normalised numerically to exactly `#12100f`; FLUX will not reproduce an exact hex and delivered `#232324`–`#3f3a3b` across the run. |
| `micro-conformance` | 59 | A recorded corpus of 60 interactions from the live estate — the behavioural baseline a successor must match. |
| `micro-deploy` | — | OTel collector, Prometheus, Tempo, Loki, Grafana. Configuration only; not running. |
| `micro-docs` | — | This directory. |

Across the estate: **~2,400 tests**, all green at last run.

---

## 3. Left

### 3.1 In flight

| Repo | State |
| --- | --- |
| `micro-market` | Scaffolding only. |
| `micro-trade` | Scaffolding only. |
| `micro-beacon` | Not started; taken next, ahead of the frontend queue, because it is the release gate. |
| `micro-site` | Not started; taken next, as the second cut from the template. |

### 3.2 Not started

**Services (5):** `nda`, `community`, `devplatform`, `admin-api`, `analytics`.
`micro-nda` is the *Ninety Days After* game service; it is the one remaining service with a real
existing implementation to port, and it is the largest of the five.

**Frontends (10), of the 11:** `site`, `admin-web`, `mint-web`, `trade-web`, `worlds-web`, `explorer-web`,
`network-site`, `market-web`, `devportal-web`, `status-web`. Seven of these are ports of existing
applications rather than new work; `market-web`, `devportal-web` and `status-web` are new.

**Operations (3):** `lantern`, `beacon`, `faucet`. `beacon` is **the release gate (AD-04)** and is
therefore the highest-leverage remaining item that is not a service — until it exists, no phase
can be shown to have exited on evidence rather than assertion. `faucet` is already built and
tested inside `hearth/tools/faucet` and has only ever needed extracting and deploying.

**Libraries (1):** `sdk`.

### 3.3 The work that is not a repository

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
