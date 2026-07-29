# 03 — Repository responsibilities

The target repository set, what each owns, what each must never contain, and how each was
derived from what exists today.

The topology decision is **AD-01: one repository per independently deployable unit**. Read
[02-target-architecture.md](02-target-architecture.md) §2 for the reasoning and, importantly,
for the cost this imposes and the machinery (AD-02, AD-03, AD-04) that pays it. That machinery
is a Phase 2 gate: **if it is not working, no repository is split.**

> **Repository policy — overrides everything below.** No existing repository is modified,
> deleted, archived or renamed. Every repository named `cloudsforge-<name>` in this document is
> created as **`micro-<name>`**, checked out at **`stack/micro/<name>/`**. The existing estate
> in `stack/repos/` is read-only for this programme and keeps running throughout. Code is
> **copied forward**, never extracted destructively. See [README.md](README.md) for the full
> policy and its five consequences.

---

## 1. The set

**Forty-six repositories** at the end state: 22 domain services, 3 operations services, 11
frontends, 4 library repos, 3 kept as they are, and 3 pieces of organisation infrastructure.
Nine repositories exist today and are archived or repurposed; two leave the organisation.

### 1.1 Domain services — 22 repos

| Repo | Owns | Derived from | Phase |
| --- | --- | --- | --- |
| `cloudsforge-identity` | Accounts, credentials, MFA factors, sessions, devices, refresh families, SSO exchange, signing keys, JWKS, organisations, teams, consents, OIDC façade | `platform/services/nimbus` | P3 |
| `cloudsforge-policy` | Rules, limits, velocity counters, trusted addresses, cooling-off timers, approval workflows, freezes, device and account risk scores | new | P5 |
| `cloudsforge-ledger` | Chart of accounts, journal entries, postings, balances projection, reservations, settlement states, reversals, reconciliation runs, financial reports | `forge-pay` (accounting core) | P4 |
| `cloudsforge-wallet` | Wallet registry, external wallet links and verification, deposit address assignment, withdrawal requests, conversions, transfers, portfolio read | `forge-pay` (user surface) | P4 |
| `cloudsforge-settlement` | Treasuries, sweeps, outbound transaction building, signing requests, broadcast, confirmation tracking, stuck/abandon adjudication | `forge-pay` (`withdrawer`, `sweeper`, `outbound`) | P4 |
| `cloudsforge-pricing` | Market sources, median oracle, administered prices, spread policy, rate history, valuation service | `forge-pay/src/pricing.ts` | P4 |
| `cloudsforge-billing` | Products, prices, entitlements, subscriptions, usage records, invoices, discounts, refunds, creator payouts, revenue shares | `forge-pay/src/routes/monetization.ts` | P4 |
| `cloudsforge-custody` | HD seeds, key generation, encryption envelope, signing policy, treasury pins, key lifecycle, export ceremony, key events | `forge-keyvault` | P5 |
| `cloudsforge-indexer` | Blocks, transactions, receipts, logs, address activity, native and token balances, transfers, contract deployments, reorgs, checkpoints, provider health | new | P5 |
| `cloudsforge-activity` | Canonical activity records, event inbox, feed cursors, feed query API | new | P6 |
| `cloudsforge-notify` | Preferences, categories, templates, localisation, notifications, deliveries, digests, dedupe, retries, delivery history, operator broadcasts, developer webhooks | new | P13 |
| `cloudsforge-studio` | Brand kits, asset specs, generation jobs, generated assets, asset storage, generation credits | `asset-forge` (engine) | P8 |
| `cloudsforge-mint` | Token orders, deployment lifecycle, token registry, token/project pages, contract templates | `forge-mint/services` | P3 split, P8 extend |
| `cloudsforge-market` | Listings, offers, bids, auctions, orders, escrow references, collections, verification, moderation, disputes, fees and royalties | new | P9 |
| `cloudsforge-trade` | Strategy catalogue, backtests, bots, fills, allocations, fee settlements, performance reporting | `crucible/services` | P3 split, P10 extend |
| `cloudsforge-worlds` | Title registry, shared player profile, inventory, achievements, reputation, seasons, rewards, entitlement bridge, sanctions, parental controls | new, generalised from `ninety-days-after` | P5 |
| `cloudsforge-nda` | *Ninety Days After*: worlds, tiles, players, actions, resolution engine, reports, communes, progress, objectives, world events | `ninety-days-after/services/game` | P5 |
| `cloudsforge-community` | Communities, membership, roles, treasury accounts, proposals, discussion, votes, delegations, timelocks, executions | new | P12 |
| `cloudsforge-devplatform` | Developer organisations, projects, environments, API keys, service accounts, OAuth clients, webhook endpoints and secrets, usage, quotas, application directory | new | P11 |
| `cloudsforge-hub-api` | Forge Hub BFF: dashboard aggregation, portfolio composition, unified search, suggested actions, saved views | new | P6 |
| `cloudsforge-admin-api` | Operator BFF: cross-service operator actions, approval queues, tamper-evident audit mirror, feature flags, broadcasts | `platform/services/nimbus` admin proxies | P13 |
| `cloudsforge-analytics` | Pseudonymised product event store, funnels, cohorts, retention, metric definitions | new | P13 |

### 1.2 Frontends — 11 repos

| Repo | Serves | Derived from | Phase |
| --- | --- | --- | --- |
| `cloudsforge-hub-web` | Forge Hub: dashboard, portfolio, wallet, activity, settings, security, entitlements | new; absorbs Nimbus `/account` and the game's wallet pages | P6 |
| `cloudsforge-site` | Marketing site | `platform/apps/site` | P3 |
| `cloudsforge-admin-web` | Operator console | `platform/apps/admin` | P3 |
| `cloudsforge-mint-web` | Forge Create | `forge-mint/apps` | P3 |
| `cloudsforge-trade-web` | Forge Trade | `crucible/apps` | P3 |
| `cloudsforge-worlds-web` | Forge Worlds client | `ninety-days-after/apps/game` | P3 |
| `cloudsforge-explorer-web` | Block explorer | `hearth/web` (explorer half) | P3 |
| `cloudsforge-network-site` | Forge Network marketing | `hearth/site` | P3 |
| `cloudsforge-market-web` | Forge Market | new | P9 |
| `cloudsforge-devportal-web` | Developer console + docs | new | P11 |
| `cloudsforge-status-web` | Public status page | new, from Beacon's redacted projection | P13 |

### 1.3 Operations — 3 repos

| Repo | Owns |
| --- | --- |
| `cloudsforge-lantern` | Log triage: OTLP push ingest, error fingerprinting and grouping, browser errors and RUM, request-id trace lookup. Docker-socket collector demoted to the dev fallback. |
| `cloudsforge-beacon` | Synthetic monitoring: probes, journeys, incidents, SLOs and error budgets, conformance runs, Prometheus metrics, the redacted public status projection. **The release gate (AD-04).** |
| `cloudsforge-faucet` | Testnet EMBER faucet — built and tested in `hearth/tools/faucet`, never deployed. |

### 1.4 Libraries — 4 repos

Library repos publish packages; they are not deployables, so AD-01 does not apply to them.
Grouping them is what keeps the release tax survivable.

| Repo | Packages | Why grouped |
| --- | --- | --- |
| `cloudsforge-contracts` | `@cloudsforge/contracts-auth`, `-money`, `-chain`, `-market`, `-worlds`, `-create`, `-events`, `-devplatform` | Split by bounded context so a game-rule change does not force a custody release, but released from one repo so cross-context changes are one PR. **`-chain` is the narrowest and is exact-pinned** — `RATE_SCALE`, `shardsForCoinAmount()` and per-coin confirmation depths must agree byte-for-byte between wallet, settlement, custody and indexer, or money is credited at the wrong depth. |
| `cloudsforge-runtime` | `@cloudsforge/telemetry`, `-http`, `-jobs`, `-auth`, `-db`, `-lifecycle`, `-policy-client` | These replace the six byte-identical `obs.ts` copies and five divergent auth middlewares. They change together and are the reason a cross-cutting fix stops being 8 PRs. |
| `cloudsforge-ui` | `@cloudsforge/ui`, `@cloudsforge/ui-charts` | Design system, tokens, chrome, and the validated chart layer ([assets/chart-palette.md](assets/chart-palette.md)). |
| `cloudsforge-sdk` | `@cloudsforge/sdk`, `@cloudsforge/cli` | **Public.** The third-party developer surface. Separate from `contracts` because it is generated from the public OpenAPI description and versioned on the public API's cadence, not on internal contract churn. |

### 1.5 Kept as they are — 3 repos

| Repo | Change |
| --- | --- |
| `hearth` | Keeps node, EVM, consensus, P2P, miner, CLI, contracts, `@cloudsforge/hearth-node`. **Loses** `web/`, `site/` and `tools/faucet` to their own repos (AD-19). Stays independent: public, external contributors, its own security policy, and its npm package is exact-pinned by custody for signature correctness. |
| `asset-forge` | Stays the build-time CLI and becomes the **engine** that `cloudsforge-studio` wraps. Removed from `clone-all.sh` — it is in the product repo list by accident and is never deployed. |
| `stack` | Stops being a product repo. Becomes: compose and Kubernetes manifests, gateway config, telemetry stack config (collector, Prometheus, Tempo, Loki, Grafana dashboards, Alertmanager rules), **release manifests**, the `cfctl` CLI, and `docs/`. Lantern and Beacon move out of `infra/`. |

### 1.6 New org infrastructure — 3 repos

| Repo | Owns |
| --- | --- |
| `.github` | Org profile README, and the **reusable workflows** every repo calls: `service-ci.yml`, `web-ci.yml`, `publish.yml`, `secret-hygiene.yml`, `contract-compat.yml`, `renovate-config`. This is what stops 40 copies of CI drifting. |
| `cloudsforge-service-template` | A working service skeleton: runtime libs wired, `/livez` + `/readyz`, migrations as a one-shot job, the jobs table, OTel, outbox + inbox, Dockerfile, CI calling the reusable workflow. `cfctl new service <name>` instantiates it. |
| `cloudsforge-web-template` | The same for a frontend: Vite, React 19, the design system, `cloudsforgeHosts()`, auth callback handling, browser telemetry, nginx config, CI. |

### 1.7 Leaving

| Repo | Why |
| --- | --- |
| `cv` / `cv-web` | Serves `savvanis.life` from the company stack. Harmless, and not the company's. Removed from the compose file in Phase 2; **the repository itself is left alone.** |
| `platform`, `forge-pay`, `forge-keyvault`, `forge-mint`, `crucible`, `ninety-days-after`, `shared-libs` | **Nothing happens to them.** Per the repository policy they are neither archived nor deleted nor renamed. They stop receiving new feature work once their `micro-*` successor passes its phase exit criteria, and they remain deployable indefinitely as the rollback target. Each gains one line in its README pointing at its successor. |

---

## 2. Rules that hold across every repository

These replace the boundaries that repository walls enforce for free today, and are checked in
CI by `.github/workflows/service-ci.yml`.

1. **A service owns exactly one database and reads no other.** Enforced by a check that greps
   for any connection string other than its own env var, and by per-service Postgres roles with
   no grants on other schemas.
2. **No service imports another service's source.** With one repo per service this is
   physically true; it must stay true when a "shared helper" is tempting. The answer is a
   package in `cloudsforge-runtime`, or duplication — never a cross-repo path import.
3. **Every cross-service call is HTTP, typed by a published contract, with a scoped service
   token.** No shared bearer secrets (AD-17).
4. **Every service exposes `/livez`, `/readyz`, `/metrics`, and emits OTLP traces and logs.**
   A service without these does not pass CI.
5. **Every state change that others care about writes an outbox row in the same transaction.**
6. **Every service that stores `user_id` subscribes to `identity.user.deleted`** and
   acknowledges within its stated SLA.
7. **Migrations are versioned files run by a one-shot job under an advisory lock**, expand/
   contract only.
8. **Every background timer is a leased job.** `setInterval` doing domain work fails review.
9. **Secrets are per-service.** A repo declares the variables it needs; the deploy provides
   exactly those. `env_file: .env` fan-out is banned.
10. **Contracts evolve additively.** `contract-compat.yml` fails on a removed field, a narrowed
    type, or a renamed key.

---

## 3. Where each existing capability lands

The migration map. Every row is a thing that exists today and where it goes, so nothing is
lost by omission during decomposition.

| Today | Lands in |
| --- | --- |
| `nimbus` auth, JWKS, SSO, password reset | `identity` |
| `nimbus` portal `/account` page | `hub-web` |
| `nimbus` admin proxies to pay and vault | `admin-api` (the pay proxy is deleted outright once the gateway handles CORS) |
| `platform/apps/site` | `site` |
| `platform/apps/admin` | `admin-web` + `admin-api` |
| `pay` wallet, deposits, withdrawals, conversions | `wallet` (orchestration) + `ledger` (accounting) + `settlement` (chain) |
| `pay` `ledger` table | `ledger` journal — **converted, not copied** (see [10-migration-strategy.md](10-migration-strategy.md)) |
| `pay` price oracle | `pricing` |
| `pay` cosmetics / convenience / season pass / private worlds / entitlements | `billing` |
| `pay` `/internal/*` | Scoped APIs on `ledger` and `wallet`; the omnibus internal surface is retired |
| `pay` deposit watcher | `indexer` (detection) + `wallet` (crediting decision) |
| `pay` sweeper, withdrawer, outbound | `settlement` |
| `forge-keyvault` everything | `custody` |
| `forge-keyvault` admin reveal | **Deleted.** Replaced by the user export ceremony (AD-13) and a two-operator break-glass runbook |
| `forge-mint` service | `mint` |
| `forge-mint` SPA | `mint-web` |
| `crucible` service | `trade` |
| `crucible` SPA | `trade-web` |
| `ninety-days-after` service, game-specific | `nda` |
| `ninety-days-after` player identity, cosmetics, entitlement bridge | `worlds` |
| `ninety-days-after` client | `worlds-web` |
| `ninety-days-after` wallet and store pages | `hub-web` (the wallet stops being a game screen) |
| `hearth/web` explorer | `explorer-web` |
| `hearth/web/wallet.html` | `hub-web`, as the external-wallet path |
| `hearth/site` | `network-site` |
| `hearth/tools/faucet` | `faucet` |
| `asset-forge` manifest + generation | `studio` (service) + `asset-forge` (engine, unchanged) |
| `shared-libs/packages/shared` | Split across `cloudsforge-contracts` packages |
| `shared-libs/packages/shared/game.ts` | **`cloudsforge-nda`** — game rules are not a platform contract |
| `shared-libs/packages/ui` | `cloudsforge-ui` |
| `infra/lantern` | `cloudsforge-lantern` |
| `infra/beacon` | `cloudsforge-beacon` |
| `infra/observability/*.ts` | `@cloudsforge/telemetry` in `cloudsforge-runtime` — deleted as vendored source |
| `stack/docker-compose.yml` | `stack/deploy/compose/` + `stack/deploy/k8s/` |
| `stack/scripts/clone-all.sh`, `pull-all.sh` | `cfctl` |
| `cv/` | Out of the organisation |

---

## 4. What each repository must never contain

Stated because these are the mistakes this topology invites.

- **`identity` must never contain a product feature.** It issues identity. The moment a
  dashboard, a launcher grid or a balance appears in it, the security boundary is gone. This is
  the mistake the current Nimbus portal already makes.
- **`ledger` must never contain a business rule.** It does not know what a cosmetic costs or
  what a performance fee is. It accepts typed postings and enforces that they balance.
  Business rules live in `billing`, `market`, `trade`.
- **`custody` must never make an outbound call to anything but `policy`.** No RPC providers, no
  price feeds, no product services. Its network reachability is the whole security model.
- **`indexer` must never hold a private key or make a decision about crediting.** It reports
  what the chain says. `wallet` decides what that means for a balance.
- **`policy` must never sit in the data path of a read.** It decides on actions, not on
  queries.
- **`analytics` must never receive a `user_id`, an email, a handle or an exact balance.**
  AD-21.
- **`hub-api` must never own state that another service owns.** It caches, with a stated TTL,
  and it degrades when an upstream is down. A field that only exists in the BFF is a bug.
- **No frontend repo may contain business logic that is not also enforced server-side.** The
  game client already demonstrates the failure mode: it withheld four SKUs from the UI while
  Pay's routes stayed live and chargeable.
- **`stack` must never contain product code again.** Lantern and Beacon living in the
  deployment repo is how they ended up outside the workspace, consuming zero shared packages
  and duplicating the design tokens by hand.

---

## 5. Repository count, honestly

Forty repositories is a lot for one team. Three mitigations are load-bearing, and if any of
them is not working the topology should be revisited rather than endured:

| Mitigation | Measured by |
| --- | --- |
| Renovate auto-merges contract bumps org-wide | Time from a contract publish to the last consumer being on it. **Target: under 24 hours, unattended.** If it exceeds a week, the topology is failing. |
| `.github` reusable workflows | Number of repos with a bespoke CI file. **Target: zero.** |
| `cfctl` + templates | Time to stand up a new service that passes CI and appears in Beacon. **Target: under an hour.** |

These three numbers are reviewed at every phase gate in
[06-ecosystem-workflow.md](06-ecosystem-workflow.md). They are the early warning that the
repository decision is costing more than it returns.
