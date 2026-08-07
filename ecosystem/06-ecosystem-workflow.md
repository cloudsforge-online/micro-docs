# 06 — The ecosystem workflow

Fourteen executable phases. Each is scoped so that one engineer or one agent session can pick
it up, read this section plus the documents it cites, and implement it without rediscovering
the estate.

> **Repository policy — applies to every phase below.** All work happens in a new parallel
> estate of `micro-*` repositories under `stack/micro/`. **No existing repository in
> `stack/repos/` is modified, deleted, archived or renamed at any point in this programme.**
> Code is copied forward; the old service keeps running and is the rollback target for its
> replacement. Where a phase says "extract", read "copy forward". Where an exit criterion says
> "old repositories archived", read "no longer receiving new work" — archiving is not a gate.
> Full policy and its consequences: [README.md](README.md).
>
> This makes every decomposition phase materially safer than originally planned: rollback is
> always "route traffic back to the `repos/` service", which stays deployable.

**The ordering constraint is real and is not a preference.** The decomposition into
microservices comes first, because the alternative — building Forge Hub, the marketplace and
the developer platform on top of a system that cannot run two replicas of anything — means
building all of it twice. Within the decomposition, correctness comes before movement, because
migrating a money-losing race preserves the race.

## Phase map

| # | Phase | Ships | Gate it opens |
| --- | --- | --- | --- |
| **P0** | Discovery & baseline | The regression harness and a frozen baseline | Nothing can be proven unbroken without it |
| **P1** | Correctness triage | Six money-losing defects fixed in place | Migration no longer carries known bugs forward |
| **P2** | Platform foundations | Contracts, runtime libs, telemetry, org machinery, gateway, release manifest | **The polyrepo gate.** Nothing splits until this works |
| **P3** | Decomposition A — edge & identity | 10 frontend repos, identity, mint, trade, worlds-web split out | SPAs stop redeploying engines |
| **P4** | Decomposition B — money | ledger, wallet, settlement, pricing, billing | Double-entry accounting exists |
| **P5** | Decomposition C — custody, chain, play | custody, indexer, policy, worlds, nda, studio | **Migration exit gate** |
| **P6** | Forge Hub & wallets | One account, one wallet, one portfolio, one activity feed | The ecosystem becomes visible to the user |
| **P7** | Ledger completion & chain infrastructure | Reconciliation, full chain coverage, transaction lifecycle | Money is trustworthy |
| **P8** | Forge Create | Brand kits, launch flow, project pages | Creation has a product |
| **P9** | Forge Market | Discovery, listings, settlement, moderation | Creation has a destination |
| **P10** | Product integration | Trade, Worlds, Network on the shared spine | Products stop being islands |
| **P11** | Developer platform | API keys, SDK, CLI, webhooks, sandbox | Third parties can build |
| **P12** | Community & governance | Communities, treasuries, proposals, voting | Ownership becomes collective |
| **P13** | Operations & commercial readiness | Notifications, policy, admin, billing, analytics, DR | Production release |

**Parallelisation summary.** P0→P1→P2 are strictly serial. P3, P4 and P5 overlap substantially
(§P5). From P6 onward, three tracks run in parallel: *money* (P7), *creation* (P8→P9), and
*platform* (P11). P10, P12 and P13 fan in.

---

# Phase 0 — Discovery and baseline

**Objective.** Establish a measured, reproducible baseline of current behaviour, so that every
later claim of "nothing broke" is a comparison rather than an assertion.

**User value.** None directly. This is the phase that makes every later phase safe, and
skipping it is how a migration becomes a rewrite with no way back.

### Functionality

| Item | Detail |
| --- | --- |
| Behavioural inventory | Freeze the route surface of all 9 services as machine-readable OpenAPI, generated from the running services by exercising them, not hand-written. ~150 routes. |
| Golden-path recordings | Record request/response pairs for every Beacon journey and every money route, redacted, as fixtures. These become the characterisation test corpus. |
| Beacon journey expansion | From 24 to ~45 journeys: every money route, every entitlement grant, the full deposit→convert→spend→withdraw loop on testnet, admin surfaces, and the two curl-only remedies. |
| Baseline metrics capture | Run the estate for two weeks with telemetry (from P2's prototype collector) to capture p50/p95/p99 per route, error rates, and job durations. **This is the comparison set for every cutover.** |
| Data census | Row counts, balance totals per asset, entitlement counts, and a signed snapshot of `wallets.shards` + `coin_balances` totals. The number the ledger migration must reproduce exactly. |
| Test gap closure | Wire `forge-pay`'s 102 existing tests into CI — they exist and are not run. Add engine tests to Crucible, whose core numerical claim has none. |
| Dependency and secret audit | Which service actually reads which of the 64 env vars. Input to per-service secret splitting. |

**Repositories affected.** All 9 + `stack`. **New repositories.** None.

**Architectural decisions.** None taken here — this phase is measurement. It does produce the
input that validates AD-06 (the ledger split) by making today's balances a checkable number.

**Dependencies.** None. Starts immediately.

**Data-model changes.** None. **API and contract changes.** None. **UI changes.** None.

**Migration requirements.** None.

**Operational requirements.** A staging environment that mirrors production topology. This is
the first hard infrastructure requirement of the programme and it is required from here on —
[02](02-target-architecture.md) §7.2 explains why no single CI can substitute for it.

**Security decisions.** Fixture recordings are redacted at capture, never after. The recorder
refuses to write a fixture containing anything matching the existing secret-hygiene patterns.

**Testing requirements.** Characterisation tests must pass against the *current* code before
they are trusted. A characterisation test that fails on day one is describing a bug, and it is
recorded as one rather than adjusted to match.

**Documentation.** [00-current-state.md](00-current-state.md) — done. Plus the generated
OpenAPI set committed to `stack/baseline/`.

**Entry criteria.** None.

**Exit criteria.**
- 45 Beacon journeys green against the current stack, three runs consecutively.
- OpenAPI committed for every service, generated not hand-written.
- Two weeks of baseline telemetry captured and queryable.
- The data census signed and committed.
- `forge-pay` tests running in CI.

**Rollback strategy.** Not applicable — nothing ships to production.

**Risks.** *Journeys that fail intermittently get muted rather than fixed.* Mitigation: a muted
journey is a P1 backlog item with an owner, and the count of muted journeys is a phase gate at
every subsequent phase.

**Estimated complexity.** M. Two to three weeks.

**Parallelisation.** Journey authoring, OpenAPI generation and test-gap closure are three
independent tracks.

---

# Phase 1 — Correctness triage

**Objective.** Fix every defect that loses money or sells something undeliverable, before any
code moves.

> **Decision taken — `repos/` stays untouched; the fixes land in the new services.**
>
> This phase was written to fix twelve defects *in place*. The repository policy forbids it.
> **Resolved in favour of the policy**, for three reasons: the owner's instruction was explicit
> and recent; a separate audit track is actively working inside `repos/` and a concurrent edit
> risks conflicting with it; and every one of these defects is re-implemented correctly in the
> replacement service regardless, so fixing twice buys only the interval between now and cutover.
>
> **The cost is real and is accepted:** eight verified-live defects (§3.2 of
> [00-current-state.md](00-current-state.md)) continue until their replacement reaches
> production — P4 for the money defects, P5 for the game ones.
>
> **Mitigations that need no code change**, and should be applied by an operator today:
>
> | Defect | Operator mitigation available now |
> | --- | --- |
> | Crucible double-billing | `CRUCIBLE_LIVE_ENABLED=false` — already the default, so the path is inert unless deliberately enabled |
> | Repeat-chargeable private worlds | Withdraw the SKU from the catalogue, or accept and reconcile manually |
> | Solana double-mint | Already masked — Solana is suspended in `forge-mint/src/suspended.ts` |
> | Secret fan-out | Split `env_file` per service in `docker-compose.yml` — this is deployment configuration, not repository code, and is the one item worth doing immediately |
>
> The remaining four — `/spend` idempotency, game shop keys, the Nimbus proxy timeouts, and
> convert-to-EMBER's missing reserve check — have **no configuration mitigation** and are live
> until replaced. That is the price of the freeze, stated plainly rather than buried.
>
> The three options considered, for the record:
>
> - **Option A — fix in place anyway** (a narrow, explicit exception to the policy for these
>   twelve defects only). The bleeding stops now. Cost: twelve small commits to repositories the
>   policy says are frozen.
> - **Option B — fix only in the new services.** The policy holds cleanly. Cost: **every one of
>   these defects keeps losing money until its replacement service reaches production**, which is
>   P4 at the earliest for the money defects and P5 for the game ones. Double-billed performance
>   fees, repeat-chargeable private worlds, and the unkeyed `POST /spend` continue for months.
> - **Option C — Option B, plus turn the affected features off now** via existing environment
>   flags. No code changes to `repos/`; the revenue stops instead of the correctness problem.
>   `CRUCIBLE_LIVE_ENABLED` is already `false` by default, so the double-billing path is already
>   inert on a default deploy; the game shop SKUs have no such switch.
>
> **Recommendation: A, scoped to the six defects that move money** (settlement id, `/spend`
> idempotency, shop idempotency keys, private-world provisioning, the Nimbus bare-`fetch`
> timeouts, per-service secrets), with the rest deferred to their replacement services.
> Until this is decided, the twelve defects are **live and known**, and all twelve are
> re-implemented correctly in the new services regardless of which option is taken.

**User value.** Users stop being double-billed, stop being charged for private worlds that are
never built, and stop being able to buy four items and three cosmetic kinds that nothing
delivers.

### Functionality

| # | Fix | Where | Defect |
| --- | --- | --- | --- |
| 1 | Deterministic settlement id from `(bot_id, period)` + unique index on `fee_settlements` | `crucible/src/store.ts`, `migrate.ts` | **Double-billed performance fees** |
| 2 | `POST /bots/:id/actions {stop}` takes the same lease as the sweep | `crucible/routes/bots.ts` | Same, via a different path |
| 3 | Mandatory idempotency key on `POST /spend` | `forge-pay/src/store.ts` | The one money route accepting a missing key |
| 4 | Idempotency keys on all four game shop purchases | `ninety-days-after/apps/game/src/pages/Shop.tsx` | Retry double-charges; `rent` is `ownOnce:false` |
| 5 | `private_world` purchase either provisions or refuses the sale | `forge-pay/routes/monetization.ts` | **Charged for a thing no code creates** |
| 6 | Withdraw the undeliverable SKUs **from the API**, not just the UI | `forge-pay`, `@cloudsforge/shared/pay.ts` | 4 convenience items + 3 cosmetic kinds + 2 ForgeMint features |
| 7 | `assignHomestead` gets `WHERE owner_id IS NULL` | `ninety-days-after/world/generate.ts` | Two players on one tile |
| 8 | Nimbus's two proxies use `fetchJson` with a timeout and forward `x-request-id` | `nimbus/routes/vault.ts`, `pay.ts` | A hung keyvault pins the SSO service **indefinitely** |
| 9 | `onBroadcast` on the Solana deploy path + extend `/status` settle beyond `family==='evm'` | `forge-mint/routes/tokens.ts,407` | Double-mint paying gas and rent twice |
| 10 | Per-service `env_file` | `docker-compose.yml` | The game container holds `KEYVAULT_MASTER_SECRET` |
| 11 | XRP network binding in key derivation and signing | `forge-keyvault/src/chains.ts` | One seed valid on testnet **and** mainnet |
| 12 | Clamp `convertCoinToEmber` behind a reserve check, or disable it | `forge-pay/src/store.ts` | Credits custodial EMBER with no on-chain movement |

**Repositories affected.** `crucible`, `forge-pay`, `ninety-days-after`, `forge-mint`,
`platform`, `forge-keyvault`, `shared-libs`, `stack`. **New repositories.** None.

**Architectural decisions.** Item 12 is a product decision, not only a fix: either
convert-to-EMBER is backed by a real reserve (and the reserve is a ledger account in P4), or the
feature is off until it is. **Recommendation: disable it now, re-enable in P7 behind
reconciliation.** Selling a claim on EMBER the chain has never seen is the exact failure mode
[01](01-product-vision.md) principle 3 exists to prevent.

**Dependencies.** P0 (the characterisation corpus proves these fixes change only what they
intend to).

**Data-model changes.** One unique index on `fee_settlements (bot_id, period)`. One partial
index change on `entitlements` for `private_world`. Both additive.

**API and contract changes.** `POST /spend` requires `Idempotency-Key` — a **breaking change**
for any caller omitting it. Callers are known and in-estate; they are updated in the same
release. The removed SKUs are a contract removal, gated by `contract-compat.yml` from P2 —
here it is done by hand with a documented exception, because these SKUs must not survive until
P2.

**UI changes.** Shop pages send idempotency keys. Removed SKUs disappear from catalogues.
ForgeMint tier copy stops claiming two unimplemented features.

**Migration requirements.** Existing `private_world` entitlements are either honoured by
provisioning worlds retroactively or refunded. **Refund is the recommendation** — the world
type does not exist yet, and a refund is honest where a promise is not.

**Operational requirements.** A refund runbook, since no refund path exists anywhere in the
estate today.

**Security decisions.** Item 10 (per-service secrets) is the highest-severity item in the
estate and close to free. Item 11 closes a cross-network signature replay.

**Testing requirements.** A regression test per fix, named for the defect. The double-billing
and lost-payment fixes get a concurrency test that runs two workers against one Postgres.

**Documentation.** A defect register entry per fix with before/after behaviour.

**Entry criteria.** P0 exit criteria met.

**Exit criteria.**
- All 12 fixed, each with a named regression test.
- No SKU is purchasable that has no delivery path — verified by a test that enumerates the
  catalogue and asserts a delivery handler exists for each.
- Two-replica concurrency test passes for settlement and withdrawal.
- 45 journeys still green.

**Rollback strategy.** Per-fix revert. Items 3 and 6 are the only ones with client coupling;
both ship server-first with a one-release compatibility window.

**Risks.** *Item 5 turns into building private worlds.* Mitigation: the scope here is
**refuse or refund**, not provision. Provisioning is P10.

**Estimated complexity.** M. Two to three weeks. **Parallelisation.** Twelve near-independent
fixes across six repos; the only ordering is 3 before 4.

---

# Phase 2 — Platform foundations

**Objective.** Build everything the polyrepo topology requires *before* the first repository is
split. This phase is the gate described in [02](02-target-architecture.md) AD-01: if its exit
criteria are not met, the topology is revisited rather than endured.

**User value.** None directly. Indirectly: every later phase ships faster and more safely, and
telemetry means user-visible failures are found by us rather than reported by users.

### Functionality

**2a — Contracts (AD-02).**
Split `@cloudsforge/shared` into `contracts-auth`, `-money`, `-chain`, `-market`, `-worlds`,
`-create`, `-events`, `-devplatform` in the new `cloudsforge-contracts` repo. Move game rules
(`SKILL_PERKS`, `survivalScore`, `xpToNext`, `communeWithdrawCap`, 535 lines) **out** of
contracts and into the game. Delete the dead invoice contract. Publish to GitHub Packages with
`GITHUB_TOKEN`. Everything goes to `1.0.0`. Add `contract-compat.yml` failing on removed
fields, narrowed types and renames. `contracts-chain` is exact-pinned by every consumer.

**2b — Runtime libraries.**
`cloudsforge-runtime` publishing: `@cloudsforge/telemetry` (OTel traces + metrics + logs,
replacing six byte-identical `obs.ts` copies), `-http` (retry with jitter, circuit breaker,
deadline propagation, `traceparent` propagation), `-jobs` (the leased job table and claim
helper), `-auth` (one JWKS middleware replacing five divergent ones), `-db` (pool, migration
runner, advisory lock), `-lifecycle` (`/livez`, `/readyz`, drain), `-policy-client` (stub until
P5).

**2c — Telemetry stack (AD-20).**
OTel Collector, Prometheus, Tempo, Loki, Grafana, Alertmanager in `stack/deploy/`. All nine
services instrumented. Lantern gains OTLP push ingest with the Docker-socket collector demoted
to the dev fallback. Beacon's Prometheus endpoint finally scraped. The nine Grafana dashboards
from [02](02-target-architecture.md) §6.2 — at minimum Platform Overview, Service Detail and
Money Integrity.

**2d — Deployment mechanics.**
Traefik gateway with label discovery. Delete 18 `container_name:` entries and every fixed host
port. Three networks: `edge`, `app`, `vault`. `/internal` refusal becomes gateway policy, with
the CI invariant moved to assert the new mechanism. Migrations become versioned files run by a
one-shot job under `pg_advisory_lock`. `/livez` + `/readyz` everywhere, `depends_on` moved to
`/readyz`. Drain on SIGTERM.

**2e — Organisation machinery (AD-03).**
`.github` repo with the five reusable workflows. `cloudsforge-service-template` and
`-web-template`. Renovate org-wide, grouped per contract package, auto-merge on green.
`cfctl` replacing `clone-all.sh`/`pull-all.sh`. **Release manifests** — `stack/releases/<v>.yaml`
pinning an image per service, generated by CI, the only thing a deployment reads.
Org security defaults on: secret scanning, push protection, 2FA, dependency graph, branch
protection.

**2f — Housekeeping.** Evict `cv`. Remove `asset-forge` from `clone-all.sh`. Delete
`ninety-days-after/services/game/.cf31-head/` (23 tracked stale files).

**Repositories affected.** All. **New repositories.** `cloudsforge-contracts`,
`cloudsforge-runtime`, `cloudsforge-ui`, `.github`, `cloudsforge-service-template`,
`cloudsforge-web-template`. Six.

**Architectural decisions.** AD-02, AD-03, AD-04, AD-10 (event envelope defined, relay not yet
built), AD-17, AD-20.

**Dependencies.** P1. The gateway (2d) depends on 2b's lifecycle library.

**Data-model changes.** A `jobs`, `outbox` and `inbox` table added to every service by the
runtime library's migration set. `schema_migrations` version table replacing boot-time DDL —
the first migration in each service reconciles the existing hand-built schema to a recorded
version, which is delicate and is the reason this is a phase and not a chore.

**API and contract changes.** Contract package split (import paths change everywhere).
`/livez` and `/readyz` added. `/metrics` added. No business-route changes.

**UI changes.** Browser telemetry replaces the six vendored `obs.tsx` copies. Design tokens
consolidated: one ember (`#e8622c`), five sanctioned accents, plus the validated chart layer
from [assets/chart-palette.md](assets/chart-palette.md). Hearth's drifted vendored token copies
replaced by the package.

**Migration requirements.** The boot-DDL → versioned-migration conversion is per service and
must be proven idempotent against a **restored production dump**, not an empty database.

**Operational requirements.** Staging becomes permanent. Grafana, Prometheus, Tempo, Loki and
Alertmanager become operated systems with their own backups and retention.

**Security decisions.** Per-service secrets completed (started in P1). Network segmentation.
`/internal` refusal moved from a hand-written cloudflared rule to gateway policy, keeping the CI
assertion. Org-level secret scanning and push protection — urgent, because all nine product
repos are public.

**Testing requirements.** Every runtime library has unit tests. The migration runner is tested
against a restored dump per service. Gateway routing tested by a journey per hostname. **The
45 journeys must stay green through every sub-phase** — this is the first phase where they act
as a gate rather than a report.

**Documentation.** A runbook per telemetry component. `cfctl` usage. The release-manifest
procedure. A contract-evolution guide stating additive-only rules with examples.

**Entry criteria.** P1 exit criteria met.

**Exit criteria — the polyrepo gate.**
- A contract publish reaches **every** consumer unattended in under 24 hours, demonstrated
  twice.
- Zero repos with a bespoke CI file.
- `cfctl new service <name>` produces a service that passes CI and appears in Beacon in under
  an hour, demonstrated.
- A release manifest deploys the full stack to staging, and the previous manifest rolls it back.
- Every service reports `/readyz` truthfully — verified by killing Postgres and observing 503.
- A single trace spans gateway → nimbus → pay → keyvault, viewable in Grafana.
- Two replicas of one service run without incorrectness (pick `forge-mint` — no timers).
- 45 journeys green.

**Rollback strategy.** Each sub-phase is independently revertible. The gateway ships alongside
the existing published ports, with cutover by DNS, so reverting is a DNS change. Migration
conversion is the exception: it is one-way per service and must be proven on staging first.

**Risks.**
- *The migration conversion breaks a production schema.* Highest risk in the phase. Mitigation:
  restored-dump testing, one service at a time, starting with the least critical (`forge-mint`).
- *Renovate does not actually work unattended and nobody notices.* Mitigation: it is an exit
  criterion with a demonstration, not a configuration.
- *Telemetry is deferred as "not user-facing".* Mitigation: it is the only way to prove P3–P5
  did not break anything. Deferring it means the decomposition cannot be validated.

**Estimated complexity.** XL. Six to ten weeks. The largest non-product phase in the plan, and
the one most likely to be under-estimated.

**Parallelisation.** 2a, 2b, 2c and 2e are four independent tracks. 2d depends on 2b. 2f is
anyone's afternoon.

---

# Phase 3 — Decomposition A: edge and identity

**Objective.** Split every frontend out of every API process, and extract identity, into their
own repositories and deployables — the lowest-risk decomposition, done first to prove the
machinery.

**User value.** Indirect but real: a CSS change stops redeploying the trading engine, and the
explorer stops looking like a different company.

### Functionality

| New repo | From | Notes |
| --- | --- | --- |
| `cloudsforge-identity` | `platform/services/nimbus` | Portal reduced to auth screens; `/account` retired to P6 |
| `cloudsforge-site` | `platform/apps/site` | Real auth wired — today `Layout.tsx` hardcodes `signedIn: false` on the page promising one account |
| `cloudsforge-admin-web` | `platform/apps/admin` | Talks to service `/admin` routes directly until P13's `admin-api` |
| `cloudsforge-mint-web` | `forge-mint/apps` | SPA leaves the API process; `API_PREFIXES` deleted |
| `cloudsforge-trade-web` | `crucible/apps` | Same |
| `cloudsforge-worlds-web` | `ninety-days-after/apps/game` | Same |
| `cloudsforge-explorer-web` | `hearth/web` (explorer) | Gains the CloudsForge bar and the shared design system |
| `cloudsforge-network-site` | `hearth/site` | Copy rewritten — it still tells the retired UTXO story |
| `cloudsforge-faucet` | `hearth/tools/faucet` | Built, tested, never deployed. Deployed here |
| `cloudsforge-mint` | `forge-mint/services` | API only |
| `cloudsforge-trade` | `crucible/services` | API only |
| `cloudsforge-lantern`, `cloudsforge-beacon` | `stack/infra/*` | Out of the deployment repo, into the workspace, consuming the shared packages instead of duplicating tokens |

**Repositories affected.** `platform`, `forge-mint`, `crucible`, `ninety-days-after`, `hearth`,
`stack`. **New repositories.** Thirteen.

**Architectural decisions.** AD-05 (partially — Hub is deferred to P6, but Nimbus's portal is
already reduced here), AD-17 (SPAs at the gateway), AD-19 (Hearth's supporting surfaces leave).

**Dependencies.** P2 complete, including the gate.

**Data-model changes.** None. Identity keeps its schema unchanged. **This is deliberate** —
the first decomposition wave moves code, not data, so a failure is a routing problem rather
than a data problem.

**API and contract changes.** None to route shapes. Service-to-service URLs change. Nimbus's
Pay admin proxy is **deleted** — it existed only because Pay's CORS refused a cross-origin
`PUT`, which the gateway now handles. The keyvault proxy **stays**; that one is a real
architectural decision, not a workaround.

**UI changes.** Every frontend adopts `@cloudsforge/ui` from the package rather than a vendored
copy. The three divergent `components/ui.tsx` files converge into `@cloudsforge/ui` primitives.
Real auth state in `site` and `network-site`.

**Migration requirements.** No data migration. Git history is preserved per extraction using
`git subtree split`, not a fresh copy — the audit trail on money-adjacent code matters.

**Operational requirements.** Thirteen new CI pipelines (all calling the reusable workflows),
thirteen new GHCR packages — each of which **inherits the repo's visibility and 403s until
flipped by hand**, a known trap. Release manifest grows to ~24 entries.

**Security decisions.** Identity's attack surface shrinks — it no longer serves an account
dashboard. Frontends receive no secrets at all; they resolve hosts at runtime via
`cloudsforgeHosts()`, which already works and must be preserved.

**Testing requirements.** Per-repo CI. Consumer-driven contract tests between each frontend and
its API. **All 45 journeys green after each extraction, not after all of them** — extract one,
verify, extract the next.

**Documentation.** A `MAP.md` per new repo. The archived repos get a README pointing at
successors.

**Entry criteria.** P2 gate passed.

**Exit criteria.**
- Thirteen repos building, releasing and deployed from the manifest.
- No API process serves a SPA.
- Journeys green; baseline p95 per route within 20% of P0's capture.
- `explorer.cloudsforge.online` carries the CloudsForge bar.
- The faucet is deployed and drips on testnet.
- Old repos archived read-only.

**Rollback strategy.** Per-extraction. The old monorepo image stays in the manifest until its
replacement has run a week in production; reverting is a manifest edit.

**Risks.** *Thirteen extractions is thirteen chances to lose a config detail.* Mitigation:
extract by `git subtree split` (config comes with it), one at a time, journeys as the gate.
*GHCR package visibility.* Mitigation: `cfctl doctor` checks it.

**Estimated complexity.** L. Four to six weeks. **Parallelisation.** High — thirteen largely
independent extractions. Practical limit is review capacity, not dependency.

---

# Phase 4 — Decomposition B: the money domain

**Objective.** Split `forge-pay` into `ledger`, `wallet`, `settlement`, `pricing` and `billing`,
and replace the single-sided ledger with double-entry accounting **without moving a balance
incorrectly.**

**User value.** Invisible when it works, which is the point. It makes every later money feature
— reservations, escrow, refunds, payouts, treasuries, revenue reporting — possible.

### Functionality

- `ledger`: chart of accounts, journal entries, postings, balances projection, reservations,
  reversals, the trial-balance invariant as a database constraint.
- `wallet`: portfolio read, deposit address assignment, withdrawal request, conversion,
  transfer. Owns no balances.
- `settlement`: treasuries, sweeps, outbound transaction lifecycle, the **chain-keyed lease**
  that fixes the lost-payment race.
- `pricing`: sources, median, spread, administered prices — moved from an in-memory `Map` to a
  `price_quotes` table so replicas agree and an admin `PUT` is globally visible.
- `billing`: products, entitlements with scope/expiry/revocation, and a **service-readable
  entitlement API**, which does not exist today.

### The migration, which is the phase

Five steps, no big bang:

1. **Ledger stands up empty, alongside Pay.** Journal, accounts, constraints, tests.
2. **Backfill.** Convert every historical `ledger` row and every current balance into opening
   journal entries, per user, per asset. The closing balance must equal P0's signed data census
   **exactly** — not within tolerance.
3. **Dual write.** Pay continues to own balances; every mutation also posts to the ledger. A
   continuous comparator runs every five minutes and alerts on any divergence.
4. **Read cutover.** `wallet` serves balances from the ledger. Pay's columns become
   write-only shadows. **Minimum two weeks at zero divergence before proceeding.**
5. **Retire.** Pay's balance columns are dropped; the internal omnibus surface is replaced by
   scoped ledger and wallet APIs.

**Repositories affected.** `forge-pay` (retired), `crucible`, `ninety-days-after`, `forge-mint`
(all callers of `/internal/*`), `stack`. **New repositories.** Five.

**Architectural decisions.** AD-06, AD-17 (scoped service tokens replace `PAY_SERVICE_TOKEN`).

**Dependencies.** P2 (jobs, migrations, telemetry). P3 is concurrent, not a prerequisite.

**Data-model changes.** The whole of [04](04-domain-model.md) §2. Pay's `ledger`, `wallets`,
`coin_balances` are superseded. `entitlements` gains `scope`, `expires_at`, `revoked_at`,
`quantity`.

**API and contract changes.** `contracts-money` replaces Pay's shapes. `/internal/charge`,
`/credit`, `/trade`, `/wallet/:userId` — the omnibus surface where one shared secret can move
any user's money — is replaced by scoped, per-caller-authenticated APIs on `ledger` and
`wallet`. Every posting records the calling service, so "how much did ForgeMint earn" becomes
answerable for the first time.

**UI changes.** None visible. Balance reads change origin. Admin price and treasury screens
repoint.

**Migration requirements.** As above. Additionally: idempotency keys must survive the split —
in-flight keys are migrated so a retry across the cutover does not double-charge.

**Operational requirements.** The Money Integrity dashboard becomes the primary operational
surface. The divergence comparator pages on any non-zero. A documented freeze procedure for
withdrawals during the read cutover.

**Security decisions.** The single omnipotent `PAY_SERVICE_TOKEN` dies here. The ledger accepts
writes only from authenticated services with a `ledger:post` scope, and records which one.
Ledger postings are `INSERT`-only at the database-role level.

**Testing requirements.** Property tests: no sequence of operations produces an unbalanced
entry or a negative liability. Concurrency tests with two replicas per service. A replay test
rebuilding the balances projection from the journal and comparing. Journeys extended to assert
balances end-to-end, not just HTTP 200.

**Documentation.** The chart of accounts, with an example entry per `kind`. A dispute
investigation runbook.

**Entry criteria.** P2 gate. P0's data census signed. P1 item 12 resolved.

**Exit criteria.**
- Trial balance is exactly zero, continuously, for two weeks.
- Backfilled opening balances reproduce the census exactly.
- Zero divergence between Pay and ledger for two weeks before cutover.
- Balances projection rebuilds from the journal and matches.
- Two replicas of `settlement` run without signing two transactions against one nonce —
  the specific test for the lost-payment race.
- `PAY_SERVICE_TOKEN` no longer exists anywhere.
- Journeys green.

**Rollback strategy.** Steps 1–3 are fully reversible (dual write, Pay still authoritative).
Step 4 is reversible by repointing reads for as long as dual write continues — which is why
dual write is **not** switched off at cutover. Step 5 is the point of no return and happens a
month later.

**Risks.**
- *A balance is wrong after cutover.* The only genuinely severe risk in the programme.
  Mitigation: exact-match backfill, two-week zero-divergence gate, dual write retained past
  cutover, per-asset withdrawal freeze on drift.
- *The split fragments a transaction that used to be atomic.* Mitigation: a debit and its
  business effect are never in two services — the ledger posting is the transaction, and the
  product records the outcome by consuming the event.

**Estimated complexity.** XL. Eight to twelve weeks including the soak periods, most of which
is waiting rather than building.

**Parallelisation.** `pricing` and `billing` extract independently and early. `ledger`,
`wallet` and `settlement` are one coordinated effort.

---

# Phase 5 — Decomposition C: custody, chain and play

**Objective.** Complete the decomposition: harden custody and give it HD derivation, build the
indexer that replaces balance-probing, stand up the policy service, and split the game platform
from its first title. **This phase ends the migration.**

**User value.** Real transaction hashes and explorer links on deposits. A path to recovery
phrases. The structural possibility of a second game.

### Functionality

**5a — `cloudsforge-custody`.** Extracted from `forge-keyvault`. Adds: HD BIP-39/BIP-44
derivation for new addresses (two schemes coexist permanently — [04](04-domain-model.md) §3.3);
a key-version field and a re-encryption pass so the master secret becomes rotatable; a signing
audit table (today a successful `/sign` records nothing); per-user authorisation (`row.userId`
is currently compared to nothing); rate limiting. **`POST /admin/keys/:address/reveal` is
deleted** and replaced by the two-operator break-glass runbook. Bitcoin and Solana output
policies built, closing the two chains that can currently neither withdraw nor sweep.

**5b — `cloudsforge-indexer`.** New. Per-family workers over one normalised schema. Blocks,
transactions, receipts, logs, address activity, balances, token transfers, contract
deployments. Checkpointing, reorg recovery, idempotent processing, provider abstraction with
failover, rate-limit handling, backfill. Hearth is served by the EVM worker at depth 60.
`wallet` switches from balance-probing to indexer-driven crediting.

**5c — `cloudsforge-policy`.** New. Decision service with limits, velocity counters, trusted
addresses, cooling-off, approvals, freezes. Initially enforcing on: withdrawals above a
threshold, key export, treasury spend, new-device sign-in. Fail-closed on those four,
fail-open with an alert elsewhere.

**5d — `cloudsforge-worlds` + `cloudsforge-nda`.** Title registry, account-scoped player
profile, inventory, achievements, seasons, entitlement bridge extracted from the game. The game
keeps simulation state. Game rules move out of the shared contract package into `nda`.

**5e — `cloudsforge-studio`.** Wraps `asset-forge` as a service: brand kits, generation jobs,
asset storage, credits. `asset-forge` stays the engine.

**Repositories affected.** `forge-keyvault`, `ninety-days-after`, `asset-forge`, `wallet`,
`settlement`. **New repositories.** Six.

**Architectural decisions.** AD-07, AD-09, AD-12 (HD derivation), AD-13 (admin reveal deleted;
user export ceremony designed here, shipped in P6).

**Dependencies.** P4 for `wallet` (the indexer's consumer). P2 for everything.

**Data-model changes.** Custody gains `seed`, `derivation_path`, `key_version`, `signing_audit`,
`export_request`. The whole indexer schema. Policy's rule and decision tables. `worlds` schema
new; `nda` keeps its tables plus a `title_id`.

**API and contract changes.** `contracts-chain` gains the confirmation policy and indexer
shapes — **exact-pinned**, because wallet, settlement, custody and indexer disagreeing on
confirmation depth means crediting at the wrong depth. Custody's reveal route removed.

**UI changes.** Deposits show real transaction hashes and explorer links. Admin console loses
the reveal button.

**Migration requirements.** Existing flat-random keys are **not** migrated to HD — they cannot
be. They stay exportable as raw keys, and every response states the scheme. The deposit-address
history is backfilled into the indexer so historical deposits gain real txids where the chain
still has them; where it does not, the synthetic id is retained and marked as such.

**Operational requirements.** RPC provider accounts with failover per chain. Indexer lag
alerting against the confirmation depth. Chain Health dashboard. The break-glass runbook,
rehearsed.

**Security decisions.** The single largest security improvement in the programme: the
any-key-to-any-admin exfiltration primitive is deleted; a signing audit exists; master-secret
rotation becomes possible; per-user authorisation is enforced. Custody's network reachability
is narrowed to the `vault` network and it calls nothing but `policy`. **Custody stays
single-replica permanently** — written down, not discovered.

**Testing requirements.** Reorg simulation per family, including a deep reorg past the
confirmation depth. Backfill replay determinism. Custody signing-policy tests extended to
Bitcoin PSBT and Solana. A test proving a deleted reveal route returns 404 and that no other
route returns key material — asserted by a response-body scan across the whole surface.

**Documentation.** Chain integration guide per family. The break-glass runbook. The two-scheme
key model, stated plainly.

**Entry criteria.** P4 read cutover complete.

**Exit criteria — the migration exit gate.**
- Indexer at parity with balance-probing for 30 days: every deposit both would have credited,
  both do, at the same depth, and the indexer additionally reports a real txid.
- A simulated reorg past the confirmation depth is detected, alerted and recovered without a
  wrong credit.
- BTC and SOL withdraw and sweep on testnet.
- No route in any service can return private key material.
- Master secret rotated on staging, end to end.
- A second title registers against `worlds` and receives an entitlement — proven with a stub
  title, not a real game.
- **All 45+ journeys green; p95 within 20% of the P0 baseline; the trial balance still zero.**
- Every legacy repository archived.

**Rollback strategy.** The indexer runs in shadow mode beside balance-probing for its full
parity period; cutover is a flag. Custody changes are additive except the reveal deletion,
which is intentionally irreversible. The worlds/nda split is reversible until `nda` starts
writing `title_id`.

**Risks.**
- *The indexer credits a deposit twice, or misses one.* Mitigation: 30-day shadow parity, and
  crediting stays idempotent on `(address, txid)`.
- *HD derivation is implemented incorrectly and addresses are unrecoverable.* Mitigation: test
  vectors from BIP-32/39/44 plus a full derive→sign→verify round trip per family before any
  production address uses it.
- *Deleting admin reveal removes the only key-recovery path.* Mitigation: the break-glass
  runbook ships and is rehearsed **in the same release**, not after.

**Estimated complexity.** XL. Ten to fourteen weeks.

**Parallelisation.** 5a, 5b, 5c, 5d and 5e are five independent tracks with one dependency:
5b before `wallet`'s crediting cutover.

---

# Phase 6 — Forge Hub and wallets

**Objective.** Build the control centre. This is the phase where the ecosystem becomes visible
to the person using it, and where seven of the eleven "one platform" tests in
[01](01-product-vision.md) §2 flip from false to true.

**User value.** The largest single jump in the programme. One place that shows everything you
own, everything you have done, and everything you can do next — replacing an account page that
renders two initials and a hardcoded launcher grid.

### Functionality

**6a — Unified account.** Registration, login, SSO, account settings, profile
([04](04-domain-model.md) §1.2 — the first time a product can render an identity beyond a
handle), **MFA** (TOTP + WebAuthn + recovery codes), session management, connected devices with
labels and revocation, "sign out everywhere", account recovery, entitlements view, preferences,
notification preferences, organisation and team membership.

**6b — Unified navigation.** The product switcher gains Hub, Market, Worlds, Network,
Developer Platform and Community. Navigation state, deep links and return URLs work across all
of them. Admin appears only when authorised.

**6c — Unified dashboard.** Total portfolio, Shards, EMBER, per-chain balances, pending
deposits with confirmation progress, active withdrawals, trading bots, recently created tokens,
marketplace listings, game rewards, recent activity, notifications, security alerts, suggested
next actions. Served by `hub-api` as one aggregated call that degrades per-tile when an
upstream is down — a tile that cannot load says so and the rest of the page still renders.

**6d — Wallet experience.** Wallet list with labels, primary designation and lifecycle state.
Provisioning per chain family. Mainnet/testnet separation, visible and never inferred.
**Receive:** chain and network selection, correct address, copy, QR, the managed-wallet vs
deposit-address distinction explained in the UI rather than in documentation, pending and
confirmed incoming transactions with real transaction hashes and confirmation progress.
**Send:** asset and network selection, destination with address validation and trusted-address
warnings, amount, fee review, full transaction review, confirmation, state tracking, explorer
link, safe retry, and clear stuck/failure states.

**6e — External wallets.** Connect, verify by signed challenge (EIP-4361, Solana signMessage,
BIP-322, XRP signed memo), import as watch-only, select as withdrawal destination, select as
token owner, disconnect, revoke individual authorisations. Absorbs Hearth's browser wallet as
the connect path rather than leaving a second unrelated wallet in the estate.

**6f — Key access (AD-13).** The export ceremony designed in P5, shipped: re-auth → MFA →
policy decision → **24-hour cooling-off with a cancel link** → second MFA → single-use
origin-bound reveal → wallet transitions to `exported`. Formats: encrypted keystore (default),
mnemonic where HD-derived, raw key, WIF, XRP seed. Export history visible to the user.

**6g — Unified activity feed.** `cloudsforge-activity` stands up, subscribing to every domain
topic. One chronological feed covering all sixteen categories in [04](04-domain-model.md) §10.1,
filterable by category and product, with each entry linking to the owning service's detail view.

**Repositories affected.** `identity`, `wallet`, `custody`, `policy`, `billing`, `ledger`,
`notify` (stub). **New repositories.** `cloudsforge-hub-api`, `cloudsforge-hub-web`,
`cloudsforge-activity`. Three.

**Architectural decisions.** AD-05, AD-11, AD-12, AD-13.

**Dependencies.** P4 (portfolio needs the ledger), P5 (receive needs the indexer; export needs
custody's ceremony). This is the fan-in point of the migration.

**Data-model changes.** `mfa_factor`, `session`, `device`, `profile`, `organisation`,
`membership` in identity. `wallet`, `external_wallet_link`, `deposit_address_assignment` in
wallet. `activity_record`, `inbox`, feed cursors in activity. `export_request` in custody.

**API and contract changes.** `hub-api` is a new public surface. `contracts-auth` gains MFA,
session and organisation shapes. The event bus goes live for real — the relay ships here, not
in P2 where only the envelope was defined.

**UI changes.** The largest UI effort in the programme. A new application, plus the retirement
of Nimbus's server-rendered `/account` and the game's wallet and store pages. Charts per
[assets/chart-palette.md](assets/chart-palette.md): portfolio area chart, allocation bars,
in/out diverging bars, activity stacked bars, confirmation meters.

**Migration requirements.** Existing users have no MFA — enrolment is prompted, not forced,
except for accounts holding above a configurable value or with the `admin` role, where it is
mandatory within a grace period. Existing deposit addresses become `wallet` rows with
`origin=managed`, preserving addresses exactly.

**Operational requirements.** `hub-api` needs per-upstream circuit breakers and a cache with a
stated TTL, because it fans out to ten services and must not turn one slow upstream into a
dead dashboard.

**Security decisions.** MFA arrives. Session and device visibility arrives. The export ceremony
is the most security-sensitive feature in the programme and its full argument is in
[12-security-decisions.md](12-security-decisions.md). Critical security notifications ignore
preferences — a user cannot opt out of being told their key left.

**Testing requirements.** End-to-end journeys for: register → MFA enrol → wallet provision →
receive on testnet → confirm → convert → send → confirm. External wallet verification per
family. The export ceremony including the cancel path and the cooling-off expiry. A test that
the dashboard renders with each upstream individually down.

**Documentation.** Key-export user guidance written in plain language, because a user who
exports a key and does not understand `exported` state is a support incident.

**Entry criteria.** P5 migration exit gate passed.

**Exit criteria.**
- Tests 1–5 and 8 in [01](01-product-vision.md) §2 are true.
- A user can complete the full journey on testnet without leaving Hub.
- An external EVM wallet is verified and set as a withdrawal destination.
- A key export completes, including cooling-off, and the wallet shows `exported` everywhere.
- The activity feed shows events from at least six different services.
- Dashboard p95 under 800 ms with all upstreams healthy; renders with any one upstream down.

**Rollback strategy.** Hub ships alongside the existing surfaces; the old account page and game
wallet stay live behind a flag for one release. Key export is behind a per-user flag, enabled
progressively. Activity is additive — a feed that fails hides a panel, nothing else.

**Risks.**
- *Key export is used to socially engineer users.* Mitigation: cooling-off, notification on
  every channel, cancel link, and copy that assumes a user under pressure.
- *The dashboard becomes a distributed-systems failure amplifier.* Mitigation: per-tile
  degradation is an exit criterion with an explicit test.
- *Scope sprawl — Hub absorbs every product's UI.* Mitigation: Hub owns account, wallet,
  portfolio, activity. Product surfaces stay in product apps.

**Estimated complexity.** XL. Ten to fourteen weeks.

**Parallelisation.** 6a, 6d/6e/6f and 6g are three tracks. 6c depends on all of them and is
built last.

---

# Phase 7 — Ledger completion and chain infrastructure

**Objective.** Make the money trustworthy: continuous reconciliation, full chain coverage,
complete transaction lifecycle, and the operator tooling to investigate any of it.

**User value.** Withdrawals that work on every supported chain, deposits that never freeze, and
a platform that can prove it holds what it says it holds.

### Functionality

- **Reconciliation**, continuous, per asset per chain: Σ user liabilities = Σ custody assets =
  indexer-observed on-chain holdings, within a stated tolerance. Drift beyond tolerance freezes
  withdrawals for that asset and pages.
- **Convert-to-EMBER re-enabled** behind a real reserve check, closing the P1 item 12
  suspension.
- **Reservations, settlement states, reversals, refunds** fully implemented — the primitives
  Market and Billing depend on.
- **Financial reporting**: revenue by product and source, fee income, creator liabilities,
  treasury positions, period close.
- **Chain coverage completed**: all five families for deposit, withdrawal and sweep, with
  per-chain confirmation policy, reorg alarms and per-user deposit caps on young chains.
- **Transaction lifecycle**: one state machine, one UI, from intent to finality, including safe
  retry and the abandon adjudication that is currently curl-only.
- **Operator tooling**: dispute investigation by correlation id across services, manual
  adjustment with mandatory reason codes and dual approval, the sweep-recording remedy given a
  UI.

**Repositories affected.** `ledger`, `wallet`, `settlement`, `indexer`, `custody`, `pricing`,
`admin-api`. **New repositories.** None.

**Architectural decisions.** None new — this completes AD-06 and AD-07.

**Dependencies.** P4, P5.

**Data-model changes.** `reconciliation_run`, reservation tables, reversal linkage, reporting
projections.

**API and contract changes.** Reporting APIs. Reservation and settlement APIs that Market
consumes in P9 — **defined here, so P9 does not invent them.**

**UI changes.** Admin reconciliation, adjustment and dispute screens. The user-facing
transaction detail view.

**Migration requirements.** Historical entries are backfilled with reconciliation state so
reports cover periods before this phase.

**Operational requirements.** Period-close procedure. Drift runbook. Per-chain tolerance values
set as stated product decisions, not defaults.

**Security decisions.** Manual adjustments require dual approval and a reason code, and are
audit-events, not log lines. Reconciliation freeze is automatic and cannot be overridden by one
operator.

**Testing requirements.** Injected-drift tests proving detection and freeze. Reversal and refund
property tests. Chain integration tests per family on testnet.

**Documentation.** The reconciliation model and every tolerance value, with its justification.

**Entry criteria.** P4 exit, P5 exit.

**Exit criteria.** Test 10 in [01](01-product-vision.md) §2 is true. All five chains complete
for deposit, withdraw and sweep on testnet. Injected drift is detected within one cycle and
freezes the correct asset only. A full period close runs and reconciles.

**Rollback strategy.** Reconciliation ships in observe-only mode first; the freeze action is a
separate flag enabled after two weeks of clean observation.

**Risks.** *Tolerances set too tight cause false freezes; too loose and drift hides.*
Mitigation: observe-only period sets them from measured data rather than from guesses.

**Estimated complexity.** L. Six to eight weeks. **Parallelisation.** Reconciliation, chain
completion and operator tooling are three tracks.

---

# Phase 8 — Forge Create

**Objective.** Turn asset generation and token deployment into one coherent creation product
with a launch flow that ends somewhere.

**User value.** A creator can go from an idea to a branded, deployed, documented token with a
project page in one sitting, owning it from their own wallet.

### Functionality

- **Brand creation**: name, symbol, description, logos, banners, icons, colour palette, social
  assets, game assets, metadata manifests, and **reusable brand kits** — the thing `asset-forge`
  cannot express today.
- **Token creation**: EVM deployment (live), Solana (unsuspended once custody's bounded
  `SetAuthority` lands in P5), Ember, network selection, supply, decimals, mint/burn/pause
  configuration, ownership and authorities, metadata, deployment fees, mainnet guards, testnet
  previews, transaction tracking.
- **Ownership**: the customer's managed or verified external wallet is the contract owner —
  already true, preserved and now selectable from the Hub wallet list.
- **Launch flow**, the ten steps in the brief: generate branding → configure → review ownership
  and authorities → deploy testnet → validate → deploy mainnet → token page → publish to Market
  → create a community → integrate.
- **Creator profiles** — the identity a project is published under.

**Repositories affected.** `studio`, `mint`, `mint-web`, `custody`, `billing`, `wallet`.
**New repositories.** None (`studio` created in P5).

**Architectural decisions.** Studio generation is asynchronous and job-leased; deployment
returns 202 with a status URL instead of holding a request for 180 seconds.

**Dependencies.** P5 (studio, custody), P6 (wallet selection), P7 (deployment fees as ledger
postings).

**Data-model changes.** `brand_kit`, `asset`, `generation_job`, `project_page`, token registry
extensions.

**API and contract changes.** `contracts-create` gains brand kits and project pages. Deploy
becomes asynchronous — a breaking change to the client, shipped with it.

**UI changes.** The launch wizard. Brand kit editor. Project page editor and public view.

**Migration requirements.** Existing token orders backfilled into the token registry with
project pages generated from order data.

**Operational requirements.** Generation cost controls and per-account spend caps — today
`asset-forge` has a `$2` default and a TTY prompt, which is not a service-grade control.

**Security decisions.** Mainnet deployment stays behind an allowlist until the fee path and
refunds are proven. Generated assets are content-scanned before publication.

**Testing requirements.** Full launch flow on testnet as a journey. Deployment recovery from a
lost confirmation. Idempotent generation.

**Documentation.** Creator guide. What ownership and authorities actually mean, in plain
language — this is where users make irreversible mistakes.

**Entry criteria.** P5, P6.

**Exit criteria.** A creator completes all ten launch steps on testnet, unaided. Solana is
unsuspended or formally withdrawn with the code removed. Every ForgeMint tier's advertised
features exist.

**Rollback strategy.** Per-feature flags. The existing synchronous deploy path stays available
for one release.

**Risks.** *Generation costs run away.* Mitigation: per-account credits in `billing`, hard caps,
and a spend dashboard.

**Estimated complexity.** L. Six to eight weeks. **Parallelisation.** Brand track and token
track are independent until the launch flow joins them.

---

# Phase 9 — Forge Market

**Objective.** Build the missing verb. Creation without a destination is a hobby.

**User value.** Somewhere to sell what you make and buy what others make, with settlement that
is atomic and fees that are visible.

### Functionality

**Scope decision — what Market supports, and what it does not.** Supported: fungible tokens,
game assets, digital collectibles, creator products, token-gated content, community
memberships, in-game goods, service subscriptions. **Not supported: anything conferring
in-game power** — `bound` items ([04](04-domain-model.md) §7.3) cannot be listed, which is the
anti-pay-to-win control expressed as a schema constraint rather than a policy.

- **Discovery**: featured, new launches, trending, categories, search, filters, watchlists,
  creator profiles, community profiles, verified projects, **computed risk indicators** (mint
  authority present, ownership renounced, supply concentration, age, deployer wallet exported),
  token pages, asset pages.
- **Listings**: fixed price, auctions, offers, bids, expiry, cancellation, royalties, creator
  fees, platform fees, escrow, and both custodial and non-custodial settlement.
- **Launch pages**: description, token details, ownership, supply, authorities, network,
  contract address, team, links, roadmap, community, risk disclosures, marketplace activity —
  every on-chain fact read from the indexer, never from the order record.
- **Settlement** per AD-14.
- **Administration**: moderation, verification, takedowns, disputes, fraud reports, suspicious
  listing detection, fee configuration, creator support.

**Repositories affected.** `market` (new), `market-web` (new), `ledger`, `wallet`, `indexer`,
`billing`, `policy`, `activity`, `notify`. **New repositories.** Two.

**Architectural decisions.** AD-14. Escrow is a ledger account, not a smart contract, for
custodial settlement.

**Dependencies.** P7 (reservations and escrow), P8 (things to sell), P6 (wallets as sellers).

**Data-model changes.** All of [04](04-domain-model.md) §6.

**API and contract changes.** `contracts-market`, new. Public read APIs are part of the
developer surface in P11.

**UI changes.** A new application: discovery, listing creation, asset and token pages, auctions,
offers, watchlists, seller dashboard, moderation console.

**Migration requirements.** None — greenfield.

**Operational requirements.** Moderation queue with SLAs. Dispute process with a defined window
during which custodial settlements are reversible. Fraud monitoring.

**Security decisions.** Escrow reservations make double-selling impossible at the schema level.
Non-custodial settlement never has the platform holding a key. Listing creation is
policy-gated for new accounts and for high-value items.

**Testing requirements.** Concurrent purchase of one listing — exactly one succeeds. Auction
race conditions at close. Royalty and fee arithmetic property tests. Dispute reversal.

**Documentation.** Seller guide, fee schedule, dispute policy, what verification does and does
not mean.

**Entry criteria.** P7, P8.

**Exit criteria.** A custodial and a non-custodial sale both settle end to end. Concurrent
purchase yields exactly one order. Risk indicators render from indexer data. Moderation and
dispute flows exercised.

**Rollback strategy.** Launch invite-only with a low value cap, raised progressively.
Non-custodial settlement ships after custodial has run for a month.

**Risks.** *A marketplace attracts fraud immediately.* Mitigation: verification levels, computed
risk indicators shown as facts, policy gating, invite-only launch, value caps.

**Estimated complexity.** XL. Ten to fourteen weeks. **Parallelisation.** Discovery, listings
and settlement are three tracks; administration is a fourth.

---

# Phase 10 — Product integration

**Objective.** Make the existing products members of the ecosystem rather than tenants of it.

**User value.** Rewards earned in one product spend in another; assets created in one are used
in another; every product writes to one activity feed and one portfolio.

### Functionality

**Forge Trade.** Portfolio integration with the Hub. Cross-bot P&L and aggregate performance —
the missing aggregate view. Capital allocation as **ledger reservations** rather than a
convention. Risk limits from `policy`. Tax-ready exportable transaction history. Strategy
comparison and sharing. Notifications on bot events, risk limits and settlements. Fills and
fees as ledger postings, so trading appears in the unified activity feed.

**Forge Worlds.** Titles registry live with a second title scaffolded. Shared player profile,
inventory, achievements, reputation, cross-game assets, season passes with a real progression
track, **private worlds actually provisioned** by consuming
`billing.entitlement.granted` — closing the defect that has been sold since before this
programme began. Game rewards in Shards or EMBER. Token-gated private worlds. Marketplace
cosmetics. Creator-generated game assets from Studio. Fair-play and anti-pay-to-win constraints
enforced by `bound` inventory.

**Forge Network.** EMBER wallet integration in Hub. Explorer on the shared design system, fed
by the indexer. Node and mining software distribution. Mining dashboard. Network statistics.
Transaction monitoring. Address pages. Miner information. Testnet faucet (deployed in P3).
Network status on the public status page. RPC documentation. SDK integration —
`@cloudsforge/hearth-node` republished exporting the **EVM-era** API rather than the retired
UTXO one, which today has zero consumers and is a published lie. Ecosystem project directory.

**EMBER's role, decided here.** EMBER is the platform's native settlement and reward asset:
mining rewards, marketplace settlement option, community treasury denomination, governance
weight in EMBER-denominated communities, game rewards, developer incentives. It is **not** a
governance token for the platform itself, and it is **not** required to use CloudsForge —
requiring it would make every user a speculator.

**Repositories affected.** `trade`, `trade-web`, `worlds`, `nda`, `worlds-web`, `explorer-web`,
`network-site`, `hearth`, `ledger`, `billing`, `activity`, `notify`, `market`.
**New repositories.** None.

**Dependencies.** P6, P7, P9.

**Data-model changes.** Trading allocations as reservations. Inventory and title scoping.
Cross-game asset scopes.

**API and contract changes.** `contracts-worlds` rewritten for multiple titles. Hearth SDK
republished at a major version.

**UI changes.** Cross-bot portfolio. Player profile. Explorer restyle. Mining dashboard.

**Migration requirements.** Existing bots' allocations converted to reservations. Existing
player data mapped into `worlds` profiles. Existing `private_world` entitlements — refunded in
P1 — may now be honoured for anyone who wants to repurchase.

**Operational requirements.** Reward budgets with caps, because rewards are money.

**Security decisions.** Reward issuance is rate-limited and policy-gated; a game exploit that
mints rewards is a money incident.

**Testing requirements.** Cross-product journeys: earn in a world → see in portfolio → spend in
Market. Second-title conformance suite.

**Entry criteria.** P9.

**Exit criteria.** Tests 6, 7 and 9 in [01](01-product-vision.md) §2 true. A private world is
purchased and provisioned. A reward earned in a world is spent in Market. A second title passes
the conformance suite.

**Rollback strategy.** Per-integration flags.

**Risks.** *Cross-product rewards create an exploitable loop.* Mitigation: every reward is a
ledger posting with a budget cap and reconciliation, so an exploit is bounded and visible.

**Estimated complexity.** XL. Ten to fourteen weeks. **Parallelisation.** Three fully
independent product tracks.

---

# Phase 11 — Developer platform

**Objective.** Make third-party development possible.

**User value.** Developers build on CloudsForge; the platform gets applications it did not
have to write.

### Functionality

Developer accounts, organisations, teams, projects, environments, roles and permissions.
Credentials: API keys, scoped API keys, service accounts, OAuth clients, webhook secrets,
rotation, revocation, usage limits. APIs for authentication, user identity, wallet
provisioning, addresses, transaction intents, payments, Shards, token deployment, asset
generation, marketplace listings, game entitlements, community membership, notifications and
webhooks. SDK, CLI, OpenAPI, generated clients, examples, starter applications. Test
environment with sandbox balances, testnet wallets, a local development stack, a webhook
simulator and a request inspector. Developer dashboard: projects, credentials, webhooks, logs,
usage, errors, rate limits, billing, environments, team access. Application directory,
plugins, third-party games, marketplace applications, community bots, trading integrations,
revenue sharing, grants.

**Repositories affected.** `devplatform` (new), `devportal-web` (new), `cloudsforge-sdk` (new),
every service exposing a public API. **New repositories.** Three.

**Architectural decisions.** AD-16. The public API is versioned separately from internal
contracts and fronted by the gateway. `api.cloudsforge.online` — currently the *game* API — is
renamed to `worlds-api.` before anything depends on it.

> **CORRECTION 2026-08-07 — this rename was performed and then REVERSED.** The estate serves the
> game API at `api.<apex>/v1/...`, not `worlds-api.<apex>`, and `worlds-api.cloudsforge.online`
> does not resolve. Do not implement what this passage specifies. See
> [18-build-status](18-build-status.md) §0.1 and `ui/packages/ui/src/surfaces.ts`.


**Dependencies.** P6, P7, P9.

**Data-model changes.** All of [04](04-domain-model.md) §1.5 plus devplatform's own.

**API and contract changes.** The first **externally versioned** API surface, with a
deprecation policy: two versions supported, twelve months' notice, machine-readable deprecation
headers.

**UI changes.** Developer console and documentation site.

**Operational requirements.** Sandbox environment with resettable state. Per-key rate limiting
at the gateway. Usage metering into `billing`.

**Security decisions.** Keys are hashed at rest and shown once. Scopes are least-privilege by
default. OAuth consent screens name exactly what is granted. A compromised key can be revoked
in one action and its usage history retained.

**Testing requirements.** Generated SDK compiles and passes against the sandbox. Webhook
delivery, retry and signature verification. Rate-limit enforcement under concurrency.

**Entry criteria.** P9.

**Exit criteria.** Test 11 in [01](01-product-vision.md) §2 true. A third party builds a working
integration against the sandbox using only public documentation. Key rotation and revocation
demonstrated.

**Estimated complexity.** XL. Ten to fourteen weeks. **Parallelisation.** Credentials, APIs,
SDK/CLI and the console are four tracks.

---

# Phase 12 — Community and governance

**Objective.** Let ownership become collective.

**User value.** Projects, guilds and creators get shared identity, shared money and a way to
decide things together.

### Functionality

Communities: public, private, token-gated, game communes, guilds, project and creator
communities. Membership by open join, invitation, token ownership, marketplace purchase, game
achievement or administrator approval — with **token-gated membership re-evaluated on a
schedule**, not granted once. Roles: owner, administrator, moderator, treasurer, member, guest,
plus custom roles. Community treasury holding Shards, EMBER and supported blockchain assets,
with spending proposals, approval thresholds, multiple approvers, transaction history, budget
categories, and marketplace and game revenue routed into it. Governance: proposals, discussion,
voting, quorum, delegation, token-weighted / one-member-one-vote / reputation-weighted models,
timelocks, execution and audit history.

**Governance model per context, decided:** games use reputation-weighted (playing is the
stake); token communities use token-weighted at a snapshot block; creator communities use
one-member-one-vote; **platform governance is not tokenised** — a platform holding customer
money does not put custody policy to a vote; EMBER ecosystem governance is token-weighted with
a timelock and an operator veto retained until the chain has finality.

**Also fixes:** the game's `communes` are currently inert — `resolve.ts` never reads them.
Communes become real communities with treasuries and consequences in the simulation.

**Repositories affected.** `community` (new), `hub-web`, `worlds`, `nda`, `market`, `ledger`,
`indexer`, `policy`, `notify`. **New repositories.** One.

**Dependencies.** P7 (treasury accounts), P9 (membership by purchase), P10 (achievements).

**Security decisions.** Treasury spends require threshold approval **and** a timelock, and
execute as idempotent ledger postings. A governance exploit must not be able to drain a
treasury faster than the timelock allows a response.

**Exit criteria.** A community forms, gates on token holding, funds a treasury, passes a
spending proposal through timelock, and executes it as a ledger posting. Revoked token holding
demotes membership on the next evaluation.

**Estimated complexity.** L. Eight to ten weeks.

---

# Phase 13 — Operations and commercial readiness

**Objective.** Everything required to run this as a business rather than a project.

### Functionality

**Notifications** (`notify` goes live): in-app, email, push, mobile push, optional SMS for
critical events, developer webhooks. All 21 event types in the brief. Preferences, categories,
priority, retries, templates, localisation, unsubscribe, delivery history, deduplication,
digests, operator broadcasts.

**Policy and risk**, completed: wallet operation policies, withdrawal and velocity limits,
trusted addresses, cooling-off, transaction approval, marketplace fraud controls, trading
limits, game-economy abuse detection, community treasury controls, API rate limits, account and
device risk, administrative approvals, emergency freezes.

**Administration** (`admin-api` + `admin-web`): users, sessions, wallets, key events, deposits,
withdrawals, ledger entries, reconciliation, trading bots, tokens, marketplace listings,
communities, governance, notifications, API clients, risk events, feature flags, service health,
audit history — one operator surface, every action audited, with the tamper-evident mirror.

**Billing**, completed: products, prices, entitlements, subscriptions, usage-based billing,
invoices, discounts, refunds, revenue recognition, creator payouts, revenue sharing, tax data,
financial reporting. Model in [15-monetisation-model.md](15-monetisation-model.md).

**Analytics** (`analytics` goes live): the full metric catalogue, pseudonymised per AD-21, with
the four planes kept separate.

**Status and dashboards**, completed: the public status page at `status.cloudsforge.online`,
all nine Grafana dashboards, SLOs with error budgets, alert routing with a runbook per alert.

**Resilience**: scheduled backups verified by **restore drills**, not by the existence of a
dump file — today `infra/backup.sh` is unscheduled and writes locally, which is not a backup.
Disaster recovery with stated RPO and RTO per service. Incident response with severity levels,
on-call and post-incident review.

**Repositories affected.** `notify`, `policy`, `admin-api`, `admin-web`, `billing`, `analytics`,
`status-web`, `stack`. **New repositories.** `cloudsforge-analytics`, `cloudsforge-status-web`.
Two.

**Dependencies.** Everything.

**Security decisions.** Break-glass procedures rehearsed. Administrative access requires MFA and
produces audit events. Emergency freeze is one action with a documented unfreeze requiring two
operators.

**Testing requirements.** Restore drills, quarterly. A chaos exercise per critical dependency:
Postgres, custody, an RPC provider, the event relay. Notification delivery under retry storms.

**Exit criteria — production release.**
- A restore drill completes within the stated RTO, from an off-host backup.
- Every alert has a runbook; no alert is routinely silenced.
- The public status page is live and accurate through a simulated incident.
- SLOs defined with error budgets, and a month of data against them.
- An incident is run end to end as an exercise, including a public status update.
- Financial reports reconcile to the ledger for a full period.
- All eleven tests in [01](01-product-vision.md) §2 are true.

**Estimated complexity.** XL. Ten to fourteen weeks. **Parallelisation.** Notifications, policy,
admin, billing, analytics and resilience are six tracks.

---

# Cross-phase requirements

Applying to every phase, checked at every gate.

| Requirement | Check |
| --- | --- |
| Beacon journeys green | Three consecutive runs before a gate passes |
| p95 within 20% of the P0 baseline | Grafana comparison against the captured baseline |
| Trial balance exactly zero | Continuous, from P4 onward |
| Muted journeys | Count must be zero at a gate; each is a P1 with an owner |
| Renovate lag | Contract publish → last consumer, under 24 hours |
| Bespoke CI files | Zero |
| Every new alert has a runbook | Enforced in the alert rule's CI |
| No SKU without a delivery path | Automated catalogue-versus-handler test |
| No route can return key material | Response-body scan across the whole surface |
| Secrets are per-service | No container receives a variable it does not use |

