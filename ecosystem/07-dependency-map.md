# 07 — Dependency map

What depends on what, in five senses: services on services, topics on producers, phases on phases,
repositories on published packages, and the estate on things it does not control. Read it before
changing a contract, ordering a release, or deciding whether a service can be taken down.

Derived from [02-target-architecture.md](02-target-architecture.md) §3,
[03-repository-responsibilities.md](03-repository-responsibilities.md) §1 and
[06-ecosystem-workflow.md](06-ecosystem-workflow.md). Where it records a dependency that exists
today, the source file is cited.

---

## 1. The service dependency graph

```
LEGEND    ──►  synchronous HTTP; the caller blocks and can fail because of it
          ┈┈►  event subscription; outbox → relay → inbox (AD-10); the producer never blocks
          ═══  exact-pinned contract package; a version skew is a correctness bug, not a warning

                          ┌───────────────────────────────────┐
        browser ─────────►│  gateway (Traefik)                │◄──── every SPA bundle
                          └────┬──────────────────────────────┘
                               │
        ┌──────────────────────┼───────────────────────────────────────────────┐
        │                      │                                               │
   ┌────▼─────┐          ┌─────▼──────┐                                  ┌─────▼──────┐
   │ hub-api  │          │ admin-api  │                                  │devplatform │
   │  (BFF)   │          │ (operator) │                                  │  (public)  │
   └────┬─────┘          └─────┬──────┘                                  └─────┬──────┘
        │ reads only           │ reads + operator writes                       │
        │                      │                                               │
   ═════╪══════════════════════╪═══════════════════════════════════════════════╪═════
        │                      │                                               │
   ┌────▼──────────────────────▼───────────────────────────────────────────────▼────┐
   │  PRODUCT SERVICES                                                              │
   │                                                                                │
   │   studio ──► billing ──┐        market ──► wallet ──┐      trade ──► pricing   │
   │   mint ────► custody   │        market ──► indexer  │      trade ──► billing   │
   │   mint ────► indexer   │        market ──► policy   │      worlds ─► market    │
   │   mint ────► wallet    │        community ► indexer │      nda ────► worlds    │
   │                        │        community ► policy  │      nda ────► billing   │
   └────────────────────────┼───────────────────────────┼──────────────────────────┘
                            │                           │
   ┌────────────────────────▼───────────────────────────▼──────────────────────────┐
   │  SPINE                                                                        │
   │                                                                               │
   │   wallet ──► ledger      wallet ──► custody      wallet ──► indexer           │
   │   wallet ──► pricing     wallet ──► policy                                    │
   │   settlement ──► custody     settlement ──► indexer     settlement ──► ledger │
   │   billing ──► ledger     billing ──► identity                                 │
   │   custody ──► policy   (and nothing else, ever — §3 of [03])                  │
   │   policy ──► identity                                                         │
   │   ledger ──► (nothing).  indexer ──► (nothing but chain RPC).                 │
   │   pricing ──► (nothing but price sources).                                    │
   └───────────────────────────────────────────────────────────────────────────────┘

   ┌── EVENT PLANE ────────────────────────────────────────────────────────────────┐
   │  every service ┈┈► its outbox ┈┈► relay ┈┈► inbox of:                         │
   │      activity   notify   analytics   admin-api (audit mirror)   hub-api        │
   │  plus the targeted subscriptions in §3                                        │
   └───────────────────────────────────────────────────────────────────────────────┘

   ┌── OBSERVATION PLANE (no service depends on it; it depends on every service) ──┐
   │  every service ──► otel-collector ──► prometheus · tempo · loki ──► grafana   │
   │  collector ──► lantern (OTLP push)      beacon ──► every service (synthetic)  │
   └───────────────────────────────────────────────────────────────────────────────┘
```

Three structural properties this graph has, and must keep:

1. **`ledger` is a sink.** It calls nothing. That single fact is what makes the money subgraph
   acyclic and what lets a money write be one transaction rather than a saga.
2. **`custody` has exactly one outbound edge**, to `policy`. Its network reachability *is* the
   security model ([03](03-repository-responsibilities.md) §4).
3. **The observation plane is a leaf.** No service calls `beacon` or `lantern`. A monitoring
   system that products depend on cannot report on their failure.

---

## 2. Every service-to-service dependency

**Universal edges, listed once rather than 24 times.** Every service depends on `identity` twice:
JWKS to verify user tokens (cached 30 s — `platform/services/nimbus/src/keys.ts:62`), and from P4
a short-TTL scoped service token to call anyone (AD-17). Both are `soft` — each survives an
identity outage for its cache or token lifetime. Every service also writes to the collector,
always `soft`: telemetry loss never fails a request.

**Call profiles**, so the policy column is a name rather than a paragraph:

| Profile | Deadline | Retry | Breaker |
| --- | --- | --- | --- |
| `fast-read` | 800 ms | 2, exponential with full jitter, idempotent GET only | Opens at 50% failures of the last 20 within 10 s; half-open after 15 s with 1 probe |
| `bff-fanout` | 600 ms per upstream, 1.5 s total page budget | None | Per-upstream, same thresholds; an open breaker returns instantly rather than burning the budget |
| `money-write` | 5 s | **None automatic.** The caller re-submits with the same idempotency key | Opens at 5 consecutive failures; half-open after 30 s |
| `sign` | 10 s | None | **No breaker.** The job fails, the lease releases, the leased job re-runs |
| `chain-rpc` | 6 s (matches `PAY_CHAIN_RPC_TIMEOUT_MS`, `forge-pay/services/pay/src/env.ts:197`) | 1 per provider, then failover | Per-provider health score, not a binary breaker |
| `decision` | 1.5 s | 1 | Fail-**closed** for the four actions in AD-09; fail-open with an alert otherwise |

| Caller | Callee | Protocol | Purpose | Criticality | Profile |
| --- | --- | --- | --- | --- | --- |
| `hub-api` | ledger, wallet, pricing, indexer, trade, mint, market, worlds, activity, notify, identity, billing | HTTP GET | Dashboard aggregation | **soft ×12** — each degrades one tile | `bff-fanout` |
| `admin-api` | every service | HTTP | Operator reads and actions | soft for reads, hard per action | `fast-read` / `money-write` |
| `identity` | policy | HTTP | Register, sign-in, new-device risk | soft (fail-open, alert) | `decision` |
| `policy` | identity | HTTP | Subject attributes not carried on events | soft (stale attributes tolerated) | `fast-read` |
| `wallet` | ledger | HTTP | Post deposit credit, withdrawal reservation, conversion | **hard** | `money-write` |
| `wallet` | custody | HTTP | Derive an address for a new managed wallet | **hard** for provisioning, soft for everything else | `sign` |
| `wallet` | indexer | HTTP | Pending deposits, confirmations, address history | soft — balances come from the ledger | `fast-read` |
| `wallet` | pricing | HTTP | Valuation, conversion quote | **hard** for a conversion, soft for display | `fast-read` |
| `wallet` | policy | HTTP | `wallet.withdraw`, `wallet.create` | **hard** above the withdrawal threshold (fail-closed) | `decision` |
| `settlement` | custody | HTTP | `POST /sign` under the purpose gate | **hard** | `sign` |
| `settlement` | indexer | HTTP | Broadcast confirmation, nonce/sequence state | **hard** — no confirmation without it | `fast-read` |
| `settlement` | ledger | HTTP | `withdrawal_settled`, `withdrawal_refunded` | **hard** | `money-write` |
| `settlement` | policy | HTTP | `settlement.treasury_spend` | **hard** (fail-closed) | `decision` |
| `custody` | policy | HTTP | `custody.key.export` | **hard** (fail-closed) | `decision` |
| `billing` | ledger | HTTP | Purchase, subscription charge, payout postings | **hard** | `money-write` |
| `billing` | identity | HTTP | Organisation ownership — who pays | soft (cached 5 min) | `fast-read` |
| `mint` | custody | HTTP | Provision deployer, sign the deploy | **hard** | `sign` |
| `mint` | ledger | HTTP | Deployment fee | **hard** | `money-write` |
| `mint` | wallet | HTTP | Validate the owner wallet is controlled by the user | **hard** | `fast-read` |
| `mint` | indexer | HTTP | Deployment confirmation, on-chain supply and authorities | **hard** for the project page's on-chain facts | `fast-read` |
| `market` | ledger | HTTP | Reservation, escrow, atomic settlement, fees, royalties | **hard** | `money-write` |
| `market` | wallet | HTTP | Seller wallet ownership, on-chain settlement destination | **hard** | `fast-read` |
| `market` | indexer | HTTP | Risk indicators, on-chain escrow confirmation | soft for indicators, hard for on-chain settlement | `fast-read` |
| `market` | billing | HTTP | Entitlement grant on a platform-native sale | **hard** | `money-write` |
| `market` | policy | HTTP | Listing gating for new accounts and high-value items | soft (fail-open, flagged for review) | `decision` |
| `trade` | ledger | HTTP | Fill postings, performance fee, capital reservation | **hard** | `money-write` |
| `trade` | wallet | HTTP | Available balance for allocation | **hard** | `fast-read` |
| `trade` | pricing | HTTP | Mark and fill price | **hard** — a bot with no price does not trade | `fast-read` |
| `trade` | billing | HTTP | Subscription tier and limits | soft (cached 5 min, last-known tier) | `fast-read` |
| `worlds` | identity | HTTP | Profile for the shared player identity | soft | `fast-read` |
| `worlds` | billing | HTTP | Entitlement check | **hard** for gated content | `fast-read` |
| `worlds` | ledger | HTTP | Reward postings | **hard** | `money-write` |
| `worlds` | market | HTTP | Listability of an inventory item (`bound` check is local; price is not) | soft | `fast-read` |
| `nda` | worlds | HTTP | Player profile, inventory, entitlement bridge | **hard** | `fast-read` |
| `nda` | billing | HTTP | Private-world entitlement | **hard** | `fast-read` |
| `community` | ledger | HTTP | Treasury accounts and `treasury_spend` execution | **hard** | `money-write` |
| `community` | identity | HTTP | Membership subject resolution | soft | `fast-read` |
| `community` | indexer | HTTP | Token-gating re-evaluation at a snapshot block | **hard** for the re-evaluation job, soft for display | `fast-read` |
| `community` | policy | HTTP | Treasury spend approval | **hard** (fail-closed) | `decision` |
| `studio` | billing | HTTP | Generation credits and caps | **hard** — no cap check, no generation | `fast-read` |
| `studio` | ledger | HTTP | Credit consumption posting | **hard** | `money-write` |
| `devplatform` | identity | HTTP | Developer organisation and membership | **hard** | `fast-read` |
| `devplatform` | notify | HTTP | Register a webhook endpoint as a delivery target | soft (retried by a leased job) | `fast-read` |
| `notify` | identity | HTTP | Email address, locale, channel addresses | **hard** for delivery | `fast-read` |
| `notify` | devplatform | HTTP | Webhook secret for payload signing | **hard** for webhook delivery only | `fast-read` |
| `beacon` | every service | HTTP | Synthetic probes and journeys | n/a — beacon failing is not a service failure | 10 s, no retry |
| every service | `otel-collector` | OTLP | Traces, metrics, logs | soft, always | fire-and-forget |

---

## 3. Event topic subscription matrix

Topic naming is `<service>.<aggregate>.<past-tense-verb>` (AD-10). Ordering is guaranteed per
`(topic, key)` only.

| Topic | Producer | Key | Consumers |
| --- | --- | --- | --- |
| `identity.user.registered` | identity | `user_id` | activity, analytics, notify, billing |
| `identity.user.deleted` | identity | `user_id` | **all fourteen services holding `user_id`** — acknowledgement is contractual, and this is the GDPR erasure path |
| `identity.session.created` | identity | `user_id` | notify (new-device alert), policy (device risk), activity |
| `identity.device.added` | identity | `user_id` | notify, policy |
| `ledger.entry.posted` | ledger | `entry_id` | activity, analytics, notify, admin-api, hub-api |
| `ledger.reconciliation.drifted` | ledger | `chain:network:asset` | admin-api, notify (operator broadcast), beacon (incident) |
| `wallet.created` | wallet | `wallet_id` | indexer (watch the address), activity, hub-api |
| `wallet.deposit.detected` | wallet | `address` | activity, hub-api |
| `wallet.deposit.confirmed` | wallet | `address` | activity, notify, hub-api, analytics |
| `wallet.withdrawal.requested` | wallet | `chain:network` | settlement, activity, notify |
| `settlement.withdrawal.completed` | settlement | `chain:network` | wallet, ledger, activity, notify |
| `settlement.withdrawal.stuck` | settlement | `chain:network` | admin-api, notify, beacon |
| `indexer.address.activity` | indexer | `chain:network:address` | wallet, mint, market, community, hub-api |
| `indexer.reorg.detected` | indexer | `chain:network` | wallet, settlement, ledger, admin-api, beacon |
| `custody.key.exported` | custody | `user_id` | notify, policy, admin-api, activity, wallet |
| `billing.entitlement.granted` | billing | `subject` | **worlds, market, community** — this is the event that finally provisions the private world |
| `billing.entitlement.revoked` | billing | `subject` | worlds, market, community, notify |
| `mint.deploy.confirmed` | mint | `token_id` | activity, market, notify, analytics |
| `market.listing.sold` | market | `listing_id` | worlds, billing, ledger, activity, notify, analytics |
| `market.listing.removed` | market | `listing_id` | activity, notify |
| `worlds.reward.granted` | worlds | `user_id` | ledger, activity, notify, analytics |
| `community.proposal.executed` | community | `proposal_id` | ledger, activity, notify |
| `policy.decision.recorded` | policy | `subject` | admin-api, analytics (pseudonymised) |
| `*.audit.recorded` | every service | `resource_urn` | admin-api (hash-chained tamper-evident mirror) |

**The broker trigger, restated because this table is what will cross it.** AD-10 adopts NATS
JetStream when a topic exceeds 50 events/second sustained, more than six consumers subscribe to
one topic, 24-hour replay is needed more than once a quarter, or p99 relay lag exceeds 30 seconds
for a week. `identity.user.deleted` already has fourteen consumers but is measured in events per
month; the fan-out limb is therefore scoped to topics carrying sustained traffic, and
`ledger.entry.posted` is the one to watch.

---

## 4. Phase dependency graph

```
  P0 ──► P1 ──► P2 ═╦═► P3  (edge & identity — 13 extractions, no data moves)
   discovery  triage ║
                     ╠═► P4 ══► P5 ══╦══► P6 ═════════╗
                     ║  money    custody/chain║        ║
                     ║                        ╚══► P7  ║
                     ║                          ledger ║
                     ║                          complete
                     ║                                 ║
                     ╚═════════════════════════════════╬══► P8 ──► P9 ─┬──► P10 ──► P12 ──► P13
                                                       ║    create market│    products  community  ops
                                                       ║                 └──► P11
                                                       ║                      devplatform
                                                       ╚══ P2 is the gate: nothing splits until
                                                          its exit criteria are demonstrated

  ═══ critical path        ─── off the critical path
```

| Phase | Blocked by | Blocks | On critical path | Runs in parallel with |
| --- | --- | --- | --- | --- |
| P0 | — | everything | **yes** | — |
| P1 | P0 | P2 | **yes** | — |
| P2 | P1 | P3, P4, P5 | **yes** | — |
| P3 | P2 gate | — (nothing depends on it) | no | P4, P5 |
| P4 | P2 gate | P5, P6, P7 | **yes** | P3 |
| P5 | P4 (for `wallet`'s crediting cutover), P2 | P6, P7 | **yes** | P3, tail of P4 |
| P6 | P4, P5 | P8, P9, P10, P11 | **yes** | P7 |
| P7 | P4, P5 | P8, P9, P11, P12 | no (shorter than P6) | P6 |
| P8 | P5, P6, P7 | P9 | **yes** | — |
| P9 | P7, P8, P6 | P10, P11, P12 | **yes** | — |
| P10 | P6, P7, P9 | P12 | **yes** | P11 |
| P11 | P6, P7, P9 | P13 | no | P10 |
| P12 | P7, P9, P10 | P13 | **yes** | tail of P11 |
| P13 | everything | — | **yes** | — |

**The critical path is P0 → P1 → P2 → P4 → P5 → P6 → P8 → P9 → P10 → P12 → P13** — summing
[06](06-ecosystem-workflow.md)'s estimates, **82–116 weeks**. P3, P7 and P11 carry the slack:
each can slip by its own duration without moving the end date, so each is where a resourcing
shortfall is absorbed.

**Three ordering constraints that are not negotiable and are easy to get wrong:**

| Constraint | Why |
| --- | --- |
| P1 before P4 | Migrating a money-losing race preserves the race. The double-billing and lost-payment defects are fixed in place first |
| P2 gate before P3/P4/P5 | A polyrepo without automated contract distribution, reusable CI and a release manifest is worse than the current estate ([02](02-target-architecture.md) AD-01) |
| P5b (indexer) before `wallet`'s crediting cutover | Crediting from balance-probing and from the indexer must run in parallel for a 30-day parity window before the flag flips |

---

## 5. Repository and package dependencies

Library repos publish; deployable repos consume. Nothing else is shared — a cross-repo path
import fails review ([03](03-repository-responsibilities.md) §2 rule 2).

| Package | Repo | Consumed by | Pinning |
| --- | --- | --- | --- |
| `@cloudsforge/contracts-chain` | `cloudsforge-contracts` | wallet, settlement, custody, indexer, mint | **Exact.** `RATE_SCALE`, `shardsForCoinAmount()` and confirmation depths (EMBER 60, ETH 12, BTC 1, SOL 1, XRP 1 — `shared-libs/packages/shared/src/deposits.ts`) must agree byte-for-byte or money is credited at the wrong depth |
| `@cloudsforge/contracts-money` | `cloudsforge-contracts` | ledger, wallet, settlement, pricing, billing, trade, market, studio, worlds, community, hub-api, admin-api | Caret on `1.x`, may lag two minors |
| `@cloudsforge/contracts-auth` | `cloudsforge-contracts` | every service, every frontend | Caret on `1.x` |
| `@cloudsforge/contracts-events` | `cloudsforge-contracts` | every service | Caret on `1.x`; the envelope is additive-only, enforced by `contract-compat.yml` |
| `-market`, `-worlds`, `-create`, `-devplatform` | `cloudsforge-contracts` | their bounded context plus hub-api and admin-api | Caret on `1.x` |
| `@cloudsforge/telemetry`, `-http`, `-jobs`, `-auth`, `-db`, `-lifecycle`, `-policy-client` | `cloudsforge-runtime` | every service | Caret on `1.x`. These replace six byte-identical `obs.ts` copies and five divergent JWKS middlewares |
| `@cloudsforge/ui`, `-ui-charts` | `cloudsforge-ui` | every frontend | Caret on `1.x` |
| `@cloudsforge/sdk`, `-cli` | `cloudsforge-sdk` | third parties | Public; versioned on the public API's cadence, generated from the OpenAPI description |
| `@cloudsforge/hearth-node` | `hearth` | custody | **Exact**, for signature correctness. Republished at a major version in P10 exporting the EVM-era API — today it exports UTXO-era APIs and has zero consumers |

**Release-order constraints.**

| # | Rule | Consequence if broken |
| --- | --- | --- |
| 1 | `cloudsforge-runtime` publishes before any service that needs the new behaviour | A service that cannot resolve `@cloudsforge/jobs` fails CI, not production |
| 2 | `contracts-events` publishes before any producer *or* consumer of a new topic | A consumer with an older envelope drops the event into its dead-letter view |
| 3 | **`contracts-chain` is a release train.** Publish, then bump wallet, settlement, custody and indexer in one coordinated manifest | A confirmation-depth skew credits a deposit before the chain agrees it happened. This is the only skew in the estate that loses money silently |
| 4 | `contracts-auth` publishes before `identity` ships the corresponding change | Token shape changes break every verifier at once |
| 5 | `cloudsforge-sdk` publishes **after** the public OpenAPI is live in production | A published SDK that describes an unshipped API is the `hearth-node` mistake repeated |
| 6 | The release manifest (`stack/releases/<version>.yaml`) is generated by CI and is the only thing a deployment reads | With ~40 repos there is no shared version; a hand-edited manifest is an untested combination |

**The measurement that says whether this is working:** time from a contract publish to the last
consumer being on it. Target under 24 hours, unattended, via Renovate. If it exceeds a week, the
repository topology is failing and is revisited rather than endured
([03](03-repository-responsibilities.md) §5).

---

## 6. Data dependencies — who owns each concept

**One database per service, no cross-service reads.** Everything below is therefore a question of
which service to *ask*, and what a cache of the answer is allowed to be.

| Concept | Source of truth | Who holds a copy | TTL / staleness rule |
| --- | --- | --- | --- |
| Account, credentials, MFA | `identity` | JWKS in every verifier | 30 s (`nimbus/src/keys.ts:62`), and key rotation deliberately waits one access-token TTL before activation |
| Profile (name, avatar, locale) | `identity` | hub-api, worlds, market, community | 5 min; never persisted as a column |
| Organisation membership | `identity` | billing, devplatform | 5 min |
| **Balance** | `ledger` (journal), materialised in the `balances` projection | **nobody else, ever** — [04](04-domain-model.md) §11 | hub-api dashboard cache 15 s, labelled with its as-of time. A cached balance in a product database is the bug that made Crucible's bot state diverge from Pay's |
| Reservation / escrow | `ledger` | market, trade hold the reservation *id* only | No TTL — an id, not a value |
| Wallet registry, labels, lifecycle | `wallet` | hub-api 60 s | — |
| Private key material | `custody` | **nowhere** | — |
| Address → user assignment | `wallet` | indexer holds the watch list | Event-driven, no TTL |
| On-chain state (blocks, txs, balances) | The chain; `indexer` is the platform's read model | wallet, mint, market, community read through the indexer | Freshness is `indexer_lag_blocks`, alerted against the confirmation depth — never a time TTL |
| Price | `pricing` (median of four sources, `price_quotes` table) | hub-api 30 s; trade reads per fill | A price without its `quoted_at` is not renderable ([02](02-target-architecture.md) §6.3) |
| Entitlement | `billing` | worlds, market, community hold a derived grant driven by `billing.entitlement.granted`, reconciled daily | Reconciled, not expired |
| Product registry | A **published contract package and build artefact**, not a row | Every frontend, CI | Build-time. Making it a row is how it ended up declared in eight places |
| Activity narrative | `activity` | hub-api 30 s | — |
| Notification preference | `notify` | — | — |
| Policy decision | `policy` | admin-api mirror | Retained for the dispute window |
| Audit event | Each service, written in the same transaction as its change | `admin-api`, hash-chained mirror | Never pruned before the retention floor |
| Product analytics | `analytics` | — | Receives `HMAC(user_id, pepper)` and bucketed amounts only; cannot answer a question about a named user, by design (AD-21) |

---

## 7. External dependencies

| Dependency | Consumer | Failure mode | Fallback | How it is detected |
| --- | --- | --- | --- | --- |
| EVM RPC — `ethereum-sepolia-rpc.publicnode.com`, `ethereum-rpc.publicnode.com` (`forge-pay/services/pay/src/env.ts:210-211`) | indexer, settlement, mint | Rate limit, timeout, or a lagging node answering `latest` with a stale height | Health-scored multi-provider failover inside the indexer's EVM worker; a provider that lags is demoted, not just retried | `rpc_provider_success_rate` and failover events on the Chain Health dashboard |
| Bitcoin — `blockstream.info/api` (`env.ts:208-209`) | indexer, settlement | REST rate-limits aggressively | Second provider, optionally a self-hosted Electrum. BTC withdrawal and sweep do not exist today; built in P5 | Provider success rate; BTC deposit parity |
| Solana — `api.devnet.solana.com`, `api.mainnet-beta.solana.com` (`env.ts:212-213`) | indexer, settlement, mint | Public endpoints throttle under load | Paid provider. Solana deploy is **suspended** today; unsuspended or removed in P8 | Same |
| XRP — `s.altnet.rippletest.net:51234`, `s1.ripple.com:51234` (`env.ts:214-215`) | indexer, settlement | Cluster unavailability | Second cluster node | Same |
| Hearth JSON-RPC on 8545 (`env.ts:206`) | indexer, settlement, explorer-web | Single node — a stateful singleton by design (AD-18) | None. EMBER degrades to read-only and the status page says so | Beacon chain probes: height, peers, mempool, block age |
| Price sources — coingecko, coinbase, kraken, binance (`forge-pay/services/pay/src/pricing.ts:91-147`) | pricing | Any source down or lying | Median of whatever answered, provided at least `PAY_ORACLE_MIN_SOURCES` (default 2) did; if sources diverge by more than `PAY_ORACLE_MAX_DIVERGENCE_BPS` (default 500) **none is used**, because there is no way to tell which is wrong | The last failure per coin is surfaced by `GET /coins/rates` rather than left as a silent gap — already implemented |
| SMTP (generic, nodemailer; `SMTP_HOST/USER/PASS/FROM`) | notify, identity | Provider outage or unconfigured | **Unconfigured is a supported mode** (`platform/services/nimbus/src/env.ts:335`): the reset is recorded and an operator hands the link over from the console. `notify` queues and retries with a leased job; critical notifications escalate to a second channel | Delivery success rate per channel; dead-letter depth |
| OpenAI images — `gpt-image-1`, the only model reachable on the CloudsForge key (`asset-forge/src/model.ts:23-33`) | studio | API error, content refusal, or cost cap hit | The deterministic placeholder generator (`asset-forge/src/placeholder.ts`), so a brand kit still renders and the job is retried rather than lost | Generation job failure rate and per-account spend against the cap |
| GHCR | every deploy | **A new repository's package inherits the repository's visibility and 403s the deploy path until flipped by hand** | None — it must be flipped. `cfctl doctor` checks it, which is why it is a check and not a runbook line | `cfctl doctor`, run in CI |
| GitHub Packages | every service build | Registry outage, or a dead token | Today `NPM_TOKEN` is dead, which is the root cause of every manual release ritual; AD-02 moves publishing to the workflow's own `GITHUB_TOKEN` | Renovate lag measurement (§5) |
| Cloudflare tunnel | public ingress | Tunnel down | Currently one of the **two** locks keeping `/internal` off the public internet, alongside loopback binding; the gateway takes over the refusal in P2 and CI asserts the new mechanism | CI invariant, plus a Beacon probe that `/internal` returns 404 publicly |
| Object storage (Tempo, Loki, studio assets) | telemetry, studio | Unavailable | Telemetry degrades to local buffering; studio generation queues | Collector export failure rate |

---

## 8. Single points of failure

| SPOF | Blast radius | Mitigation | Visible where |
| --- | --- | --- | --- |
| `identity` | **No new sign-ins.** Existing access tokens work to their TTL and JWKS is cached 30 s, so verification survives a short outage | Stateless, N replicas from P2. **The split-brain signing key must be fixed first**: on a fresh database two replicas each generate a keypair, `onConflictDoNothing()` conflicts on nothing, and `getJwks()` does `select().limit(1)` with no `ORDER BY` | Status page: Account group |
| `custody` | **Single replica, permanently, by decision (AD-18).** Withdrawals, sweeps and deploys queue. Deposits still land, balances still read | Queued, not failed. Recovery is restoring an encrypted volume against a stated RTO. Reachable only from the `vault` network | Status page: Wallet group degraded, not down |
| `ledger` | **All money writes stop.** Reads degrade to the last projection | Deliberate — better for money to stop than to be wrong ([01](01-product-vision.md) principle 1). Stateless replicas; the constraint is its Postgres | Money Integrity dashboard |
| Postgres (one per service) | Total for that service. Today every `/health` is a static `{ok:true}` that never touches the database, so a replica with an unreachable database reports healthy and 503s every request | `/readyz` checks Postgres, JWKS and declared upstreams (AD-17). Backups **verified by restore drills, not by the existence of a dump file**; RPO/RTO per service in P13 | Service Detail dashboard |
| Gateway (Traefik) | **Total user-facing outage.** Every SPA and API is behind it | Stateless, ≥2 replicas, DNS failover; SPA bundles are static and servable from a second origin. It replaces 18 `container_name:` entries and every fixed host port, which is what makes replicas legal at all | Status page hero |
| The outbox relay | Events queue in Postgres; **nothing is lost.** activity, notify, analytics and the audit mirror lag | Leased job keyed on `topic_shard`, so it parallelises. p99 relay lag is an SLO and a broker-adoption trigger | Service Detail: job queue depth |
| Hearth chain node | EMBER deposits, withdrawals and the explorer stall | A stateful singleton — adding a node adds a validator, not capacity | Status page: Forge Network chain state |
| The single host | Everything | Why the gateway, leases and `/readyz` come before Kubernetes. `custody` and Hearth nodes are permanently excepted: StatefulSets of exactly one, or outside the cluster | — |

---

## 9. Circular dependency risks, and how each is broken

One rule, stated once, from which every row below follows:

> **An edge may be synchronous, or it may be reciprocal. It may not be both.**

| # | Apparent cycle | Why it is tempting | How it is broken |
| --- | --- | --- | --- |
| 1 | `identity` ⇄ `policy` | Identity asks policy whether a sign-in is allowed; policy wants identity's subject attributes to decide | Identity → policy is the **only** synchronous edge. Policy learns subject attributes from `identity.*` events into its own store, and never calls identity inside a decision |
| 2 | `wallet` ⇄ `settlement` | Wallet requests a withdrawal; settlement reports completion | Wallet ⇢ `wallet.withdrawal.requested`. Settlement posts the outcome to `ledger` and emits `settlement.withdrawal.completed`. **Settlement never calls wallet** |
| 3 | `notify` ⇄ `devplatform` | Notify needs webhook endpoints and secrets; devplatform needs notify to tell a developer their key rotated | Devplatform pushes endpoint definitions to notify as events; notify holds them locally. The one synchronous read (signing secret) is cached and fails soft to a queued retry |
| 4 | `market` ⇄ `worlds` | Market sells game items; worlds grants them and asks whether an item is listable | `market.listing.sold` ⇢ worlds. The `bound` check is **local to worlds** — the anti-pay-to-win rule is a schema constraint there, not a question asked of market |
| 5 | `billing` ⇄ every product | Billing charges for a thing; the product delivers it and then reports usage | `billing.entitlement.granted` ⇢ the delivering service. Usage records flow back as events, never as a synchronous call inside a charge |
| 6 | `hub-api` ⇄ everything | A BFF that starts owning state acquires callers | `hub-api` reads only, caches with a stated TTL, and **owns no state another service owns** — a field that exists only in the BFF is a bug ([03](03-repository-responsibilities.md) §4) |
| 7 | `admin-api` ⇄ every service | Operator actions call out; audit records come back | Audit arrives **only** by event into the hash-chained mirror. Operator actions are synchronous calls out. One direction each |
| 8 | `ledger` ← everything | Every money path wants the ledger to call back and confirm a business outcome | **The ledger calls nothing.** The posting *is* the transaction; the product records the outcome by consuming `ledger.entry.posted`. This is what keeps a money write from becoming a saga |
| 9 | `beacon` / `lantern` ⇄ services | Convenient for a service to report an incident to Beacon directly | No service calls beacon or lantern. Beacon probes inward; lantern receives OTLP push from the collector. A monitoring system in a product's dependency graph cannot report that product's failure |
| 10 | `custody` → anything | An RPC call, a price, a product lookup would each be locally reasonable | `custody` calls `policy` and nothing else, forever. Its network reachability is the security model |

**Where a cycle would genuinely be needed, the answer is a third party.** If two services must
agree synchronously and neither can be the caller, the correct resolution is to move the shared
decision into `policy` (for authorisation) or `ledger` (for value), both of which are sinks.
Introducing a synchronous back-edge to solve it is how a distributed monolith is rebuilt with
extra network hops.
