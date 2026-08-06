# 02 — Target architecture

The system CloudsForge is being transformed into, and the reasoning for every structural
choice. This document has decision authority: where it disagrees with any repository's
`MAP.md`, or with the deleted `MICROSERVICES.md`, this document wins.

Read [00-current-state.md](00-current-state.md) first. Every decision below is a response to a
specific finding there, cited as `§n`.

---

## 1. Shape of the target system

```
                                    ┌───────────────────────────┐
    browser ────────────────────────│  gateway (Traefik)        │
                                    │  TLS · CORS · routing     │
                                    │  /internal refusal        │
                                    │  serves every SPA         │
                                    └─────────────┬─────────────┘
                                                  │
   ┌────────────── edge / experience ─────────────┼────────────────────────────┐
   │  hub-web  site  market-web  mint-web  trade-web  worlds-web  explorer-web │
   │  admin-web  devportal-web                                                 │
   └───────────────────────────────────────────────────────────────────────────┘
                                                  │
   ┌────────────── aggregation ───────────────────┼────────────────────────────┐
   │  hub-api (BFF)          admin-api (operator BFF)      devplatform (public)│
   └───────────────────────────────────────────────────────────────────────────┘
                                                  │
   ┌────────────── domain services ───────────────┼────────────────────────────┐
   │                                                                           │
   │  identity   policy      │  ledger   wallet   settlement   pricing  billing│
   │  activity   notify      │  custody  indexer                               │
   │                         │                                                 │
   │  studio  mint  market  trade  worlds  nda  community                      │
   │                                                                           │
   └───────────────────────────────────────────────────────────────────────────┘
                                                  │
   ┌────────────── substrate ─────────────────────┼────────────────────────────┐
   │  Postgres (database per service)   ·   event bus (outbox → HTTP → inbox)  │
   │  Hearth chain nodes (stateful, unreplicated)  ·  external chain RPC       │
   └───────────────────────────────────────────────────────────────────────────┘

   ┌────────────── telemetry (AD-20) ──────────────────────────────────────────┐
   │  every service ──► OTel SDK ──► otel-collector ──┬──► prometheus ──┐      │
   │                                                  ├──► tempo ───────┤      │
   │                                                  └──► loki ────────┤      │
   │                                                                    ▼      │
   │  lantern (triage console, log push)   beacon (synthetic + SLO)   grafana  │
   │  alertmanager ──► on-call · incident record in beacon · operator broadcast│
   │                                                                           │
   │  analytics (product funnels, from the event bus — NOT from logs)          │
   └───────────────────────────────────────────────────────────────────────────┘
```

Twenty-five backend deployables (22 domain services plus Lantern, Beacon and the faucet),
eleven frontends, one gateway. Every box is independently deployable, independently versioned,
and owns its own database. No service reads another's tables — the one property the current
estate already has and that this design refuses to give up.

---

## 2. The eighteen decisions

Each states the decision, the alternatives considered, and why they were rejected. These are
the decisions the brief assigned to this role.

### AD-01 · Repository topology: one repository per deployable

**Decision.** One Git repository per independently deployable unit — 25 backend repos and 11
frontend repos — plus four library repos, `hearth`, `asset-forge`, `stack` (deployment) and
`.github` and two templates. **Forty-six repositories.** Full list in
[03-repository-responsibilities.md](03-repository-responsibilities.md).

**Alternatives rejected.**
- *Platform monorepo with 24 deployables.* Genuinely cheaper: a contract change is one atomic
  PR, CI tests the real integration, one tag is one rollback. It was the recommendation of the
  deleted `MICROSERVICES.md`. **Rejected by the owner** in favour of maximum independence of
  release and ownership.
- *Repo per bounded context (~8 repos).* The middle ground. Also rejected for the same reason.

**What this decision costs, stated plainly.** With 38 repos, a `@cloudsforge/contracts-*`
minor bump today would cost ~48 file edits, 24 manual npm publishes, and no CI anywhere could
test the composed system. That cost is not acceptable, so choosing this topology *obliges*
the machinery in AD-02, AD-03 and AD-04. **Those three are not optional and they are the
critical path of Phase 2.** A polyrepo without them is worse than the current estate, not
better.

### AD-02 · Contract distribution is automated, or the topology fails

**Decision.** Four things, all in Phase 2, before any repository is split:

1. **Fix publishing.** Publish to GitHub Packages authenticated with the workflow's own
   `GITHUB_TOKEN`. The dead `NPM_TOKEN` (§3.7) is the root cause of every manual release
   ritual in the estate.
2. **Go to 1.x.** Caret ranges on `0.x` are patch-only, which is why no consumer can resolve
   the current contract version today. Every published package moves to `1.0.0` and evolves
   additively.
3. **Renovate at org level**, grouped per contract package, auto-merging on green CI. This is
   what replaces the 48 hand edits. It also removes `minimumReleaseAgeExclude` as a manual
   ritual: Renovate maintains it, or the constraint is dropped for `@cloudsforge/*` scoped
   packages specifically (they are first-party; the release-age gate exists to defend against
   supply-chain attacks on third-party packages).
4. **Contract compatibility CI.** Every contract repo runs a `schema-diff` job that fails on a
   removed field, a narrowed type or a renamed key. Additive-only is enforced by a check, not
   by discipline (§3.7 shows discipline already failed).

**Consequence.** Contract packages are **versioned artifacts with a compatibility contract**,
not shared source. A service may lag a contract version by up to two minors; the schema-diff
check is what makes that safe.

### AD-03 · Organisation machinery replaces monorepo conveniences

**Decision.** Build in Phase 2, in the `.github` and `stack` repos:

| Thing | What it replaces |
| --- | --- |
| `cloudsforge/.github` reusable workflows: `service-ci.yml`, `web-ci.yml`, `publish.yml`, `secret-hygiene.yml` | 11 copies of near-identical CI, already drifted |
| `cloudsforge-service-template` + `cloudsforge-web-template` repos | Bootstrapping a new service by copy-paste |
| `cfctl` CLI in `stack` — `cfctl clone`, `cfctl up`, `cfctl release`, `cfctl doctor` | `clone-all.sh` / `pull-all.sh`, which already omit `crucible` |
| **Release manifest** — `stack/releases/<version>.yaml` pinning an image tag per service, generated by CI, validated on `up` | `CLOUDSFORGE_TAG`, which cannot name a version across seven repos (§3.6) |
| Org-level branch protection, secret scanning, push protection, 2FA, dependency graph | All currently off |

**The release manifest is the single most important item.** With one repo per service there is
no shared version. A release is a *manifest*, not a tag: a generated file naming exactly which
image of each of 31 services is in this release, produced by CI, committed, and the only thing
a deployment reads. Rollback is checking out the previous manifest.

### AD-04 · Integration is tested by Beacon, not by CI in any single repo

**Decision.** No repository can test the composed system, so the composed system is tested by
a **contract-test + synthetic-journey pair**:

- **Consumer-driven contract tests** — each consumer publishes an expectation file to the
  provider's repo; the provider's CI replays every consumer expectation against its real
  handlers. A provider cannot merge a change that breaks a recorded consumer.
- **Beacon becomes the integration gate.** It already runs 24 multi-step journeys against a
  live stack. Every release candidate deploys to a staging environment and must pass the full
  journey suite before its manifest is promoted. Beacon's journeys grow with each phase; the
  phase exit criteria in [06-ecosystem-workflow.md](06-ecosystem-workflow.md) name the
  journeys each phase must add.

This is the answer to "validate that existing functionality didn't break". It is stated in
full in [14-testing-strategy.md](14-testing-strategy.md).

### AD-05 · Forge Hub is a new application, not a page in the identity service

**Decision.** Forge Hub is `cloudsforge-hub-web` (SPA) + `cloudsforge-hub-api` (BFF). The
Nimbus server-rendered portal is reduced to authentication screens only — login, register,
forgot, reset, consent — and `/account` moves to Hub.

**Why not inside `platform`/Nimbus.** Nimbus is the highest-security service in the estate: it
mints identity for every product and holds the private JWK. Hub is the richest,
fastest-changing UI surface and needs to fan out to ten services. Putting them in one process
means a dashboard tweak redeploys the token issuer, and it puts an aggregation surface inside
a security boundary. Separating them also lets Hub's BFF hold a *scoped* service credential
per upstream rather than being trusted with everything.

**Why a BFF at all rather than the SPA calling ten services.** The dashboard needs portfolio
(ledger), balances (wallet), pending deposits (indexer), bots (trade), listings (market),
rewards (worlds), tokens (mint), activity (activity), notifications (notify), security
(identity). Ten cross-origin round trips with ten token exchanges is a bad first paint and a
CORS matrix that nobody can reason about. The BFF makes it one request, one cache policy, one
place to degrade gracefully when an upstream is down.

### AD-06 · The ledger becomes a separate service, and Forge Pay is decomposed

**Decision.** `forge-pay` is split into five services:

| Service | Owns |
| --- | --- |
| `ledger` | Double-entry accounting: accounts, journal entries, postings, balances, reservations, settlement states, reversals, reconciliation, financial reporting |
| `wallet` | The user-facing money API: portfolio, deposits, receive addresses, withdrawal requests, conversions, transfers. Orchestrates ledger + custody + indexer. Owns no balances. |
| `settlement` | Outbound chain work: treasury, sweeps, transaction building, signing requests, broadcast, confirmation tracking, stuck/abandon handling |
| `pricing` | Market and administered prices, median oracle, rate history, valuation |
| `billing` | Products, prices, entitlements, subscriptions, usage records, invoices, creator payouts, revenue share |

**Why a separate ledger rather than an isolated module inside Pay.** Three reasons, all
observable in §3.3:
1. The ledger must eventually be the financial source of truth for market settlements, trading
   P&L, game purchases, creator revenue, community treasuries and platform revenue. Every one
   of those has a different service as its business owner. A ledger owned by the payments
   product will keep acquiring payments-shaped assumptions.
2. The ledger's change cadence must be *slow*, its review bar *high*, and its access *narrow*.
   Pay's user-facing routes change constantly. They should not share a deployment.
3. Reconciliation and audit need a service that no product can write to except through a typed
   posting API. A module in the same process cannot enforce that.

**Model.** Double-entry, append-only journal, balances derived and materialised in a
`balances` projection rebuilt from the journal. Every posting carries an idempotency key, an
originating service, an actor, and a correlation id. Reversals are new entries, never updates.
Detail in [04-domain-model.md](04-domain-model.md).

**Not event-sourced in the CQRS sense.** The journal *is* an event log for accounting purposes
and that is sufficient. A full event-sourced aggregate store adds replay tooling, snapshotting
and version migration for no gain over an append-only journal with a materialised projection.

**Separate operational and accounting ledgers: no.** One journal, with account *types* that
distinguish user liability, platform revenue, chain custody, fee income, community treasury
and clearing. Two ledgers is two truths.

### AD-07 · Forge Indexer is a separate service with per-family workers

**Decision.** `cloudsforge-indexer` — one service, one database, one normalised schema, and a
worker process per chain family (EVM, Ember, Solana, Bitcoin, XRP). It replaces balance-probing
(§3.4) entirely.

**Why not part of Forge Pay.** Because the indexer's consumers are not only Pay: Forge Market
needs settlement events, Forge Create needs contract-deployment confirmations, Forge Network
needs the explorer's data, Forge Hub needs transaction history, and the developer platform
needs address-activity webhooks. An indexer inside the payments service is an indexer that
five other products cannot use.

**Why not part of custody.** Custody must have the smallest possible attack surface and no
outbound network dependency on twelve RPC providers.

**Why not chain-specific services.** Five services with one normalised output is five
deployment units, five sets of retry logic and five reorg implementations. One service with
five worker *modules* sharing checkpointing, provider failover, reorg recovery and the
confirmation policy is materially simpler and is where the hard code actually is.

**Hearth is a first-class family, not a special case.** Hearth exposes Ethereum JSON-RPC on
8545, so the EVM worker serves it with a different chain id and a different confirmation
depth (60). This is a direct dividend of Hearth's EVM migration.

### AD-08 · Notifications are a service; delivery channels are adapters

**Decision.** `cloudsforge-notify` owns the event → notification mapping, user preferences,
templates, localisation, deduplication, digests, delivery retries, delivery history and
operator broadcasts. Channels (in-app, email/SMTP, web push, mobile push, SMS, developer
webhooks) are adapters behind one interface.

**Why not part of identity.** Identity already sends one email (password reset) and the
temptation is obvious. But notification preferences are a *product* surface with categories and
priorities per product, and the fan-in is the entire event bus. Putting a queue-driven
multi-channel delivery pipeline inside the token issuer is the same mistake as AD-05.

**Developer webhooks are the same pipeline.** A webhook to a third-party application is a
delivery channel with a different addressing scheme and a signed payload. One retry policy, one
delivery-history table, one dead-letter view.

### AD-09 · One policy service, plus a thin client library

**Decision.** `cloudsforge-policy` is a **decision service**: callers submit a typed decision
request (`subject`, `action`, `resource`, `context`) and receive `allow | deny | challenge |
review` with reasons and obligations. It owns limits, velocity counters, trusted-address lists,
cooling-off timers, approval workflows, freezes and risk scores. `@cloudsforge/policy-client`
is a thin library with a fail-closed default and a local cache for static rules.

**Why centralised rather than per-domain.** Because the interesting risk signals are
cross-domain: a new device (identity) plus a first withdrawal to an untrusted address (wallet)
plus a key-export request (custody) within an hour is one story, and no domain service can see
it. §3.5 shows the estate has *one* real policy layer today — custody's purpose gate — and
nothing else.

**Why the policy service does not enforce.** It decides; callers enforce. A decision service
that also sits in the data path becomes a single point of failure for every money movement.
Fail-closed on the *narrow* set of actions where that is correct (key export, withdrawal above
a threshold, treasury spend), fail-open with an alert on the rest (rate limits, soft caps).
This split is stated per-action in [12-security-decisions.md](12-security-decisions.md).

**Custody keeps its own signing policy.** The purpose gate, binding check and treasury pin stay
inside custody, because a signing policy that can be reached over the network is not a signing
policy. Policy service decisions are an *additional* gate, never a replacement.

### AD-10 · Events: Postgres outbox → HTTP delivery → inbox. No broker, yet.

**Decision.** Every service writes domain events to an `outbox` table in the same transaction
as the state change. A relay job publishes them over HTTP to subscribers registered in
`event_subscriptions`. Consumers dedupe into an `inbox` on `(topic, event_id)`. Ordering is
per `(topic, key)` only.

**Why not a broker now.** NATS or Redis Streams is a second stateful system to operate for an
event volume in the hundreds per minute. Postgres already has `SKIP LOCKED` and transactions.

**The trigger to adopt one, written down now so it is a measurement and not an argument:**
adopt NATS JetStream when any *one* of these is true — (a) a single topic exceeds 50 events
per second sustained, (b) more than six consumers subscribe to one topic, (c) replay of more
than 24 hours is needed operationally more than once a quarter, or (d) p99 relay lag exceeds
30 seconds for a week. Until then, the relay is a leased job like any other.

**Event envelope is a contract.** `{ id, topic, key, occurredAt, producer, version, actor,
correlationId, payload }`. Additive-only, versioned per topic, schema-diff enforced (AD-02).

### AD-11 · Activity is a service that consumes the bus and owns the canonical feed

**Decision.** `cloudsforge-activity` subscribes to every domain topic and writes one canonical
`activity` record per user-visible event. Products keep their own domain records; activity
keeps the *narrative*.

**Who owns canonical activity records: the activity service.** Not the ledger (which only sees
money), not Lantern (which sees logs, not domain facts), not each product (which is how you get
nine feeds). Activity records are immutable, typed, user-scoped and reference the owning
service's resource by URN.

**How events are collected:** exclusively from the event bus. No product ever writes to
activity directly, because a direct write is a write that can happen without the domain change
having committed. If it is not worth an outbox row, it is not worth a feed entry.

**Notification triggering reads the same bus, not the activity service.** Activity and
notification are two consumers of one stream, not a chain — so a notification is never blocked
on a feed write.

### AD-12 · Account ↔ wallet binding

**Decision.** Three record types, in three services, with one join key.

| Concept | Owner | Record |
| --- | --- | --- |
| Managed wallet | `custody` | The keypair. Bound to `user_id`, `chain`, `network`, `purpose`, `derivation_path`. Never leaves custody. |
| Wallet registry entry | `wallet` | The user-facing wallet: label, primary flag, lifecycle state, address, chain, network, `origin = managed \| external \| watch`. |
| External wallet link | `wallet` | Address + chain + verification proof + verified-at + revoked-at. |

**Managed wallets move to HD derivation.** Today custody generates one flat random key per
address (§4) — which is why there is no mnemonic to export, no derivation path, and no way to
give a user a recovery phrase. The target: one BIP-39 seed per (user, chain family), stored
encrypted, with addresses at `m/44'/<coin>'/<account>'/0/<index>`. This is what makes AD-13
possible at all, and it is the single largest change inside custody.

**External wallets are verified by signed challenge**, per family: EIP-4361 (Sign-In with
Ethereum) for EVM and Ember, `signMessage` for Solana, BIP-322 for Bitcoin, and a signed
memo-transaction or `sign` for XRP. A verified link may be a withdrawal destination, a token
owner, a community membership proof and a governance voting key. An unverified address may only
be a watch-only portfolio entry.

**Wallet ownership is the identity layer for ownership across products.** ForgeMint sets the
customer's wallet as contract owner (this is already true). Market listings are owned by a
wallet, not a user id. Community token-gating reads wallet balances via the indexer. Governance
weight is computed from wallet holdings at a snapshot block. The user id remains the account
key; the wallet is the ownership key.

### AD-13 · Private-key access: a user right, gated by a one-way lifecycle transition

**Decision.** A user may export the private key or recovery phrase of any **managed wallet they
own**. Doing so is not a read — it is a **state transition**. The wallet moves
`active → exported`, and an exported wallet:

- is no longer eligible to receive new deposit sweeps into the platform treasury;
- may still be used to receive and to withdraw, but is flagged in every UI as self-custodied;
- can be **retired** by the user, which stops the platform using it entirely.

**The gate**, in order: re-authenticate with password → MFA challenge → policy-service decision
(`custody.key.export`) → **24-hour cooling-off** with a cancel link, notified on every channel
the user has → second MFA challenge on redemption → single-use, short-TTL, origin-bound reveal
token → the secret is delivered once, client-side-decrypted, never logged, never in a response
body that any proxy caches.

**Formats:** BIP-39 mnemonic (for HD-derived families), raw private key hex, WIF (Bitcoin),
XRP family seed, and encrypted UTC/JSON keystore. The keystore is the default because it is the
only format safe to save to disk.

**Administrative access is removed.** `POST /admin/keys/:address/reveal` (§3.5) — an
any-key-to-any-admin exfiltration primitive — is deleted. It is replaced by a **break-glass
recovery procedure** requiring two operators, a signed incident record, a hardware-token
challenge each, and an alert to every admin. It cannot be invoked from the admin console; it is
a documented runbook against an offline tool. Rationale and the full argument are in
[12-security-decisions.md](12-security-decisions.md).

**Export audit history is user-visible.** Every export attempt, cancellation and completion
appears in the user's own security log and activity feed, and in the operator audit trail.

### AD-14 · Marketplace settlement is dual-mode, chosen by what is being sold

**Decision.**

| Asset class | Settlement | Why |
| --- | --- | --- |
| Fungible tokens held custodially, Shards, EMBER | **Custodial atomic swap in the ledger** — one journal entry debiting buyer and crediting seller, escrow account in between | Instant, free, reversible by an operator during a dispute window, no gas |
| Assets owned by an external wallet | **On-chain**: escrow contract on EVM/Ember, confirmed by the indexer | The platform never holds the key; the user's own wallet is the counterparty |
| Game items, entitlements, memberships, token-gated content | **Ledger + entitlement grant**, no chain | These are platform-native. Putting them on-chain would be ceremony without benefit |
| Creator products, service subscriptions | **Billing service**, recurring | Subscriptions are a billing concept, not a marketplace one |

**Escrow is a ledger account, not a smart contract, wherever custodial settlement applies.**
A listing reserves the seller's asset (a ledger reservation, AD-06), a purchase moves reserved
→ escrow → buyer atomically, and fees and royalties are postings in the same entry. Nothing is
"in flight" without being in an account.

### AD-15 · Community treasuries are ledger sub-accounts with an approval policy

**Decision.** A community treasury is a set of ledger accounts owned by a `community` subject,
with spending gated by a proposal → approval-threshold → timelock → execution flow in
`cloudsforge-community`. Execution is a ledger posting, or a withdrawal request against a
managed wallet the community owns.

**Not on-chain multisig, initially.** Hearth has no multisig, no scripting layer and no
finality gadget. An on-chain treasury today would be a single key with extra steps. When
Hearth gains threshold signing, EMBER treasuries above a configurable value move on-chain and
the ledger becomes the mirror rather than the record. That is a stated future migration, not a
present pretence.

### AD-16 · Developer platform is its own service, not a section of the account portal

**Decision.** `cloudsforge-devplatform` owns developer organisations, projects, environments,
API keys, service accounts, OAuth clients, webhook endpoints and secrets, usage records, rate
limits and the application directory. `cloudsforge-devportal-web` is its console and its docs
site.

**Why not inside identity.** Machine credentials and human credentials have different
lifecycles, different revocation semantics, different rate-limit models and different audit
requirements. Identity issues *the token*; devplatform issues *the credential that requests the
token*. Devplatform is a client of identity, exactly like every other product.

**Public API surface is versioned and separate from internal APIs.** `api.cloudsforge.online/v1`
is a stable, documented, OpenAPI-described surface fronted by the gateway and authorised by
devplatform-issued credentials with scopes. Internal service-to-service routes are never
exposed there. (Note: `api.cloudsforge.online` currently points at the *game* API and must be
renamed to `worlds-api.` before anything depends on it.)

### AD-17 · Runtime, deployment and versioning

| Concern | Decision |
| --- | --- |
| **Gateway** | Traefik, label-based discovery. Deletes 18 `container_name:` entries and every fixed host port, which is what makes `deploy.replicas` legal. Owns TLS, CORS, the `/internal` refusal, rate limits at the edge, and serving every SPA. |
| **SPAs** | Built to static bundles, served by the gateway. Removed from API processes (§TD-09) and from the hand-maintained `API_PREFIXES` array. |
| **Health** | `/livez` static; `/readyz` checks Postgres, JWKS and declared upstreams. `depends_on` and load-balancer probes move to `/readyz`. |
| **Shutdown** | SIGTERM → `ready=false` → serve for one LB interval → stop claiming jobs → drain in-flight → exit. |
| **Migrations** | Versioned files, `pg_advisory_lock`, run as a one-shot job (init container / K8s Job), never in `index.ts`. Expand/contract discipline is mandatory because a rolling deploy always runs two versions against one schema. |
| **Background work** | A leased `jobs` table per service (`@cloudsforge/jobs`), claimed with `FOR UPDATE SKIP LOCKED`. Every current `setInterval` becomes a producer plus a leased job. The lease key names the *contended resource*, not the row — `chain` for withdrawals, `bot_id` for ticks, `world_id` for world ticks. |
| **Service identity** | Identity issues short-TTL RS256 service tokens with `sub=<service>` and explicit scopes (`ledger:post`, `custody:sign`, `wallet:read`). The shared `PAY_SERVICE_TOKEN` and `KEYVAULT_SERVICE_TOKEN` are retired. Every ledger posting records the calling service. |
| **Secrets** | Per-service env files in Phase 2; Docker secrets or SOPS thereafter. No container receives a variable it does not use. This is the highest-severity item in the estate and close to free. |
| **Network** | Three compose networks: `edge` (gateway + frontends), `app` (services), `vault` (custody + ledger + settlement). Custody is reachable only from `vault`. |
| **Versioning** | Semver per repo, images tagged with the version. The release manifest (AD-03) pins one version per service. Rollback is the previous manifest. |
| **Kubernetes** | A conclusion, not a prerequisite. After the gateway and leases land, translation is mechanical — with two permanent exceptions written down now: `custody` and Hearth nodes are StatefulSets of exactly one, or they stay outside the cluster. |

### AD-18 · What stays exactly as it is

| Thing | Why |
| --- | --- |
| **Hearth's chain node, P2P, consensus, EVM and miner** | A chain node is a stateful singleton. Adding a node adds a validator, not capacity. It also has external contributors, its own security policy and a public audience. It stays its own repository, consumed as an npm package and an RPC endpoint. Its *supporting* surfaces — explorer, wallet, faucet, site, RPC docs, SDK — do split out (AD-19). |
| **Custody's container-per-address vault** | Correct for what it does. It is what blocks any multi-host move, and that is accepted. Single replica, permanently, written down rather than discovered. |
| **`withIdempotency` and `recordDepositAndCredit`** | Both correct. The rest of the design copies their shape. |
| **The origin-bound SSO handoff** | Correct, and safer than most OIDC deployments. It gains an OIDC-conformant *façade* for third parties (AD-16) without changing the internal mechanism. |
| **Custody's purpose gate, binding check and treasury pin** | The one real policy layer in the estate. It is extended, never bypassed. |
| **The warm ash/ember design system** | Extended with new accents, not replaced. See [assets/](assets/). |

### AD-19 · Hearth's supporting surfaces leave the chain repository

**Decision.** `hearth` keeps the node, the EVM, consensus, P2P, the miner, the CLI, the
contracts and the SDK. Four things move out into their own repositories:

- `cloudsforge-explorer-web` — the block explorer (currently `hearth/web`), rebuilt on the
  shared design system, fed by the indexer as well as by direct RPC.
- `cloudsforge-network-site` — the Forge Network marketing site (currently `hearth/site`,
  which still tells the retired UTXO story, §TD-17).
- `cloudsforge-faucet` — the testnet faucet, which is built and tested and **not deployed**.
- The non-custodial browser wallet moves into Forge Hub as the "connect an external wallet"
  path, rather than existing as a second, unrelated wallet with its own localStorage keystore.

This is the "support sites for sure" part of the brief, and it is also what lets the explorer
carry the CloudsForge bar — today `explorer.cloudsforge.online` is the most linkable public
artifact in the estate and looks like a different company.

### AD-20 · The observability stack: OpenTelemetry as the single instrumentation contract

**The problem.** The estate has two genuinely good tools and no telemetry pipeline underneath
them. There are **no metrics scraped anywhere**, **no traces at all**, **no dashboards**, and
**one webhook** as the entire alerting story. `infra/observability/` contains two source files
meant to be hand-copied into services — it is a vendoring convention, not a stack. Beacon
emits Prometheus format explicitly so that "adopting a scraper costs a scrape config rather
than a rewrite", and nothing has ever scraped it. Lantern collects by tailing the host Docker
daemon, so it survives neither a second host nor Kubernetes — and it is the tool you need most
on the day you move.

With one repository per service, this becomes urgent rather than tidy: **38 repositories
cannot be debugged by reading logs per container.** A single "why did this withdrawal fail"
question will span gateway → hub-api → wallet → policy → ledger → settlement → custody →
indexer. Without distributed tracing that is eight `docker logs` invocations and a guess.

**Decision.** One instrumentation contract, four signals, four separated planes.

**Instrumentation: OpenTelemetry, in a shared library, mandatory.**
`@cloudsforge/telemetry` replaces the six hand-copied `obs.ts` forks (§3.7). It configures the
OTel SDK once and exports:

- **Traces** — auto-instrumented HTTP server/client, Postgres, and the job runner. The existing
  `x-request-id` propagation is promoted to W3C `traceparent`, with `x-request-id` retained as
  a human-quotable alias carried in a baggage header, because "paste the id the user quoted" is
  a workflow that already works and must keep working.
- **Metrics** — RED (rate, errors, duration) per route automatically; USE for the job runner
  (claimed, in-flight, lease expiries, retries, dead-letter); plus a small typed API for domain
  metrics so a service declares `ledger_postings_total` rather than inventing a log line.
- **Logs** — structured pino, unchanged in shape, with `trace_id` and `span_id` injected on
  every line. This is the join key that makes the whole thing work: click a slow trace, get its
  logs; open a Lantern issue, jump to the trace.
- **Exemplars** — metrics carry trace ids, so "p99 latency spiked" links directly to a trace
  that was slow.

**Collection: an OTel Collector per host, one pipeline, three backends.**

| Signal | Backend | Retention | Why this one |
| --- | --- | --- | --- |
| Metrics | **Prometheus** (+ remote-write ready) | 15d raw; see the correction below | Beacon already emits it; every runtime has a client; it is the format Grafana assumes |
| Traces | **Tempo** | 7d, tail-sampled | Object-storage-backed, no index to operate, cheap. Tail sampling keeps 100% of errors and slow requests, 5% of the rest |
| Logs | **Loki** | 30d | Same label model as Prometheus, so one Grafana query language across signals |
| Dashboards | **Grafana** | — | One pane over all three, plus Postgres for business queries |
| Alerting | **Alertmanager** → on-call channel, **and an incident record in Beacon** | — | Beacon already owns incident open/close and a status page; alerts should land where incidents already live rather than in a second incident system |

**Two corrections to this decision, found by building it.** Both were wrong as originally
written and are recorded rather than quietly amended:

1. **"15d raw, 400d downsampled" is not a Prometheus capability.** Prometheus has no
   downsampling. What ships is 15-day raw retention plus 5-minute recording rules for the series
   that need long history, and remote-write left configured but unwired. Genuine 400-day
   downsampled retention requires Mimir or Thanos, and adopting one is an **open decision** in
   [16-risks-and-open-decisions.md](16-risks-and-open-decisions.md) rather than something this
   design can assert. The 400-day figure in [13-operational-model.md](13-operational-model.md)
   applies to Beacon's own `check_rollups` table, which does implement it, not to Prometheus.
2. **Scraping Beacon costs a credential, not just a scrape config.** Beacon's `/metrics` is
   auth-gated, correctly, so the claim that adopting a scraper "costs a scrape config rather
   than a rewrite" was half true: the config is trivial and it needs `BEACON_TOKEN` set, which
   is empty on the current estate. Verified — an unauthenticated scrape returns `401` and the
   target reads DOWN.

**Lantern is kept, and repositioned.** It is not replaced by Loki, because it does something
Loki does not: it *groups errors into issues* by normalised fingerprint — "this failure, 1,240
times, first seen 09:12" rather than 1,240 rows — and it collects browser errors. That is error
triage, not log search. So:

- **Lantern becomes push-ingest** (OTLP logs from the collector), and the Docker-socket
  collector is demoted to the dev fallback. This is what lets it survive the move.
- **Lantern keeps browser error ingest** and gains RUM basics: page load, first paint, failed
  fetches, unhandled rejections — tagged with the same trace id, so a browser error links to
  the server trace that caused it. Today a front-end failure and its backend cause are two
  unrelated records.
- **Loki holds the raw stream; Lantern holds the triage view.** Lantern stops being the only
  place logs exist, which is what makes its 7-day retention acceptable.

**Beacon is kept, and promoted.** It is already a consumer-driven contract-test harness and it
becomes the release gate (AD-04). It additionally gains:

- **SLO definitions and error budgets** per service, evaluated from Prometheus, displayed on
  the status page.
- **A public status page** — `status.cloudsforge.online`, using the redaction it already
  implements — because a platform holding customer money owes one.
- **Synthetic journeys as the alerting source of record for user-visible failure.** A metric
  says "p99 is high"; a journey says "a user cannot withdraw". Page on the second, ticket on
  the first.

**Four planes, deliberately separated.** This is the separation the brief asks for, and the
reason each is separate is that they have different consumers, retention, access control and
failure modes.

| Plane | Question it answers | System | Who reads it | Contains PII? |
| --- | --- | --- | --- | --- |
| **Operational observability** | Is the system healthy? Why is this request slow? | OTel → Prometheus / Tempo / Loki / Grafana, Lantern, Beacon | Engineers, on-call | Redacted; no secrets, no full addresses |
| **Security monitoring & audit** | Who did what, to whose data, and was it allowed? | Append-only `audit_events` in each service + a tamper-evident mirror in `admin-api`; policy decisions from `policy` | Security, compliance, support with a reason code | Yes, deliberately, access-logged |
| **Financial reporting** | What is the money? | The `ledger` journal and reconciliation runs — **never** logs or analytics | Finance, operators, the user's own statements | Yes |
| **Product analytics** | What do people do, and where do they drop off? | `analytics`, fed from the **event bus**, pseudonymised | Product | Pseudonymous by construction |

The rule that makes this stick: **no plane is derived from another.** Analytics is never
derived from logs (logs are sampled, redacted and expire). Financial reporting is never derived
from analytics (analytics is lossy and pseudonymous). Security audit is never derived from
application logs (logs can be dropped under load; an audit record cannot). Each plane has its
own write path and its own durability guarantee.

**Audit is a first-class write, not a log line.** Today the only audit tables in the estate are
custody's `key_reveals` and Lantern's issue store; everything else is `log.warn({audit:…})`,
which is a line that can be sampled away. Every service gains an `audit_events` table written
**in the same transaction as the change it describes**, and mirrors it to `admin-api` over the
event bus for a single searchable operator view. Actions that must produce an audit event are
enumerated in [12-security-decisions.md](12-security-decisions.md).

**What is deliberately not adopted.**
- *A commercial APM (Datadog, New Relic).* Cost scales with services, and there are about to be
  38 of them. The OTel contract means adopting one later is a collector export change, not a
  reinstrumentation — which is the whole point of standardising on OTel rather than on a vendor
  SDK.
- *A service mesh for observability.* Sidecar-generated golden signals are attractive and do
  not give you domain metrics, trace context through the job runner, or exemplars. Application
  instrumentation is doing the harder half regardless.
- *Replacing Lantern with Loki.* Error grouping and browser ingest are the product; log search
  is the commodity. Keep the product, buy the commodity.
- *Elasticsearch.* Operating a second stateful cluster for search, when the log volume is
  measured in gigabytes per week, is not justified.

**Rollout sequencing matters and is not negotiable.** Telemetry lands in **Phase 2**, before
the first repository is split — not in a "see it" phase at the end. The reason is direct: the
only way to prove a decomposition did not break behaviour is to compare traces, error rates and
journey results across the cutover. Instrumenting after the split means the baseline is gone.

### AD-21 · Product analytics is a service fed by events, not by page tags

**Decision.** `cloudsforge-analytics` subscribes to the same event bus as `activity`, and
writes a pseudonymised, append-only event store optimised for funnel, cohort and retention
questions. Frontends emit a small set of explicit UI events (`page_viewed`,
`cta_clicked`, `form_abandoned`) through the same envelope — never a third-party tag.

**Why a service rather than a SaaS pixel.** Three reasons: the interesting funnels here are
server-side (register → wallet created → first deposit confirmed → first conversion → first
token deployed), a pixel cannot see them; a crypto platform sending user behaviour to a
third-party ad network is a trust decision that contradicts §1 of
[01-product-vision.md](01-product-vision.md); and the event bus already carries every fact
analytics needs, so the marginal cost is a consumer.

**Privacy boundary, stated once and enforced in code.** Analytics receives a
`subject_key = HMAC(user_id, analytics_pepper)` and never the `user_id`. It stores no email, no
handle, no address, no balance — only amounts bucketed into ranges. The pepper lives only in
the analytics service. This means analytics **cannot** be used to answer a support question
about a named user, which is intentional: that question is answered by `admin-api` against the
owning service, with an audit record.

The metric catalogue — acquisition, registration conversion, wallet activation, first deposit,
first transaction, token creation, marketplace activity, trading activation, game retention,
community participation, developer adoption, revenue, cross-product usage, funnels, cohorts —
is defined in [13-operational-model.md](13-operational-model.md).

---

## 3. Service catalogue

Twenty-two services. Ownership, data, and the phase that creates or splits each.

| # | Service | Owns (data) | Consumes | Phase |
| --- | --- | --- | --- | --- |
| 1 | `identity` | users, credentials, MFA factors, sessions, devices, refresh families, exchange codes, signing keys, orgs, teams, memberships, consents | policy | P3 |
| 2 | `policy` | rules, limits, velocity counters, trusted addresses, cooling-off timers, approvals, freezes, risk scores | identity, activity | P5 |
| 3 | `ledger` | accounts, journal entries, postings, balances projection, reservations, settlements, reversals, reconciliation runs | — | P4 |
| 4 | `wallet` | wallet registry, external wallet links, deposit address assignments, withdrawal requests, conversion requests | ledger, custody, indexer, pricing, policy | P4 |
| 5 | `settlement` | treasuries, sweeps, outbound transactions, broadcast state, confirmation tracking | custody, indexer, ledger, policy | P4 |
| 6 | `pricing` | price quotes, sources, administered prices, rate history | — | P4 |
| 7 | `billing` | products, prices, entitlements, subscriptions, usage records, invoices, payouts, revenue shares | ledger, identity | P4 |
| 8 | `custody` | vault addresses, HD seeds, encrypted key material, treasury pins, key events, export records | policy | P5 |
| 9 | `indexer` | blocks, transactions, receipts, logs, address activity, native + token balances, token transfers, contract deployments, reorgs, checkpoints, provider health | — | P5 |
| 10 | `activity` | activity records, inbox, feed cursors | event bus | P6 |
| 11 | `notify` | notification preferences, templates, notifications, deliveries, digests, webhook endpoints, delivery history | event bus, identity, devplatform | P13 |
| 12 | `studio` | brand kits, asset specs, generation jobs, generated assets, credits | billing, ledger | P8 |
| 13 | `mint` | token orders, deployments, token registry, token pages | custody, ledger, indexer, wallet | P3 (split), P8 (extend) |
| 14 | `market` | listings, offers, bids, auctions, orders, escrow refs, collections, verification, moderation, disputes | ledger, wallet, indexer, billing, policy | P9 |
| 15 | `trade` | strategies, backtests, bots, fills, settlements, allocations | ledger, wallet, pricing, billing | P3 (split), P10 (extend) |
| 16 | `worlds` | titles, player profiles, inventory, entitlement bridge, achievements, seasons, rewards, sanctions | identity, billing, ledger, market | P5 |
| 17 | `nda` | worlds, tiles, players, actions, reports, communes, progress, objectives, events | worlds, billing | P5 |
| 18 | `community` | communities, memberships, roles, treasury accounts, proposals, votes, delegations, executions | ledger, identity, indexer, policy | P12 |
| 19 | `devplatform` | developer orgs, projects, environments, API keys, OAuth clients, webhook endpoints, usage, quotas, applications | identity, notify | P11 |
| 20 | `hub-api` | dashboard cache, suggested actions, saved views | everything (read) | P6 |
| 21 | `admin-api` | operator actions, approvals, audit mirror, feature flags, broadcast records | everything | P13 |
| 22 | `lantern` | log events, issues, fingerprints, browser errors, RUM samples | OTLP push | P3 (extract) |
| 23 | `beacon` | checks, rollups, journeys, runs, incidents, SLOs, conformance | Prometheus, every service | P3 (extract) |
| 24 | `analytics` | pseudonymised event store, funnels, cohorts, retention, metric definitions | event bus | P13 |

Frontends (11): `hub-web`, `site`, `market-web`, `mint-web`, `trade-web`, `worlds-web`,
`explorer-web`, `network-site`, `admin-web`, `devportal-web`, `status-web`.
Plus `faucet` (P3), a backend deployable listed under operations in
[03-repository-responsibilities.md](03-repository-responsibilities.md) §1.3.

Telemetry infrastructure (configuration, not services owned by a team): `otel-collector`,
`prometheus`, `tempo`, `loki`, `grafana`, `alertmanager` — all defined in `stack`.

---

## 4. Data ownership and partitioning

**One database per service. No exceptions, no shared tables, no cross-service reads.** This is
already true and is the most valuable property in the estate.

**The one cross-cutting key is `user_id`**, issued by identity. It appears in fourteen
databases as a de facto foreign key with no constraint. Two rules make that safe:

1. **`identity.user.deleted` is a contract.** Every service that stores `user_id` subscribes,
   and must acknowledge deletion within an SLA. This is also the GDPR erasure path, which does
   not exist today.
2. **No service may infer anything about a user from the shape of an id.** Ids are opaque
   UUIDs; profile data is fetched, never cached beyond a stated TTL.

**Money data is partitioned by account, not by user.** Ledger accounts belong to subjects —
`user:<id>`, `community:<id>`, `platform:revenue`, `platform:fees`, `custody:<chain>:<network>`,
`clearing:<purpose>`. This is what lets a community treasury and a platform revenue line live
in the same double-entry system without a special case.

**Retention** is per-service and stated in [11-data-and-contract-strategy.md](11-data-and-contract-strategy.md).
The ledger keeps everything forever; Lantern keeps events 7 days; the indexer prunes
transaction bodies past a per-chain horizon but never prunes anything a ledger entry references.

---

## 5. How activity is published

One pattern, used by every service, with no exceptions:

```
  domain change  ─┐
                  ├─ same transaction ─► outbox row
  outbox row     ─┘
        │
        ├─ relay job (leased, key = topic shard) ─► HTTP POST to each subscription
        │                                            with HMAC signature + event id
        ▼
  consumer inbox  (unique on topic + event_id)  ─► handler  ─► its own outbox if it emits
```

**Topic naming:** `<service>.<aggregate>.<past-tense-verb>` — `wallet.deposit.confirmed`,
`ledger.entry.posted`, `market.listing.sold`, `identity.device.added`,
`custody.key.exported`, `community.proposal.executed`.

**The first events to exist, chosen by which defect each retires:**

| Event | Consumers | Retires |
| --- | --- | --- |
| `identity.user.deleted` | all | No user-lifecycle reaction anywhere; the GDPR path |
| `ledger.entry.posted` | activity, analytics, notify | Per-product revenue not derivable (§3.3) |
| `billing.entitlement.granted` | worlds, market, community | **The private world that is never built (§3.2)** |
| `wallet.deposit.confirmed` | activity, notify, hub-api | Users learn about deposits by refreshing |
| `settlement.withdrawal.completed` | activity, notify | Same |
| `mint.deploy.confirmed` | activity, market, notify | Client polling every 4 seconds |
| `custody.key.exported` | notify, policy, admin-api | A key leaves with one log line |
| `identity.session.created` | notify, policy | No new-device alert |

---

## 6. Status pages, dashboards and graphs

Three audiences, three surfaces, one visual language. Every panel below names its data source
and the decision it supports — a dashboard whose panels do not change a decision is a screensaver.

Chart colour, mark and interaction rules are fixed in
[assets/chart-palette.md](assets/chart-palette.md); the categorical palette there is validated,
not chosen by eye.

### 6.1 Public status page — `status.cloudsforge.online`

Served by `status-web` from a **new** group-rollup projection in Beacon. A platform holding
customer money owes one.

**Correction to an earlier assumption:** Beacon's existing `redactStatus`
(`infra/beacon/src/server.js`) is *not* sufficient. It emits `t.name` and
`incidents[].subject` verbatim — `pay.rates`, `hearth.seed` — which is internal topology.
It also carries no scheduled-maintenance and no chain-state fields. So the public projection is
new work, not a configuration change, and `BEACON_PUBLIC_STATUS` stays `false` until it lands.

| Panel | Form | Source | Why |
| --- | --- | --- | --- |
| Overall state | Hero status chip + one sentence | Beacon summary | The only thing 90% of visitors want |
| Service state grid, grouped (Account · Wallet · Trading · Worlds · Network · Create · Market) | Status cells, **icon + label + colour** | Beacon targets, redacted to product groups | Product groups, not container names — "Wallet" not `pay.rates` |
| 90-day uptime per group | Daily uptime bars, one bar per day | `check_rollups` (400-day retention) | The industry-standard glanceable history |
| Active + recent incidents | Timeline with severity, opened/closed, updates | Beacon incidents | Where operator broadcasts land |
| Chain state (Forge Network) | Height, peers, mempool depth, last block age | Beacon chain probes | EMBER is a public network; its liveness is public information |
| Scheduled maintenance | List | admin-api broadcasts | — |

Explicitly **not** on the public page: latency numbers per service, error rates, internal
target names, replica counts. Those are an availability map for an attacker.

### 6.2 Operator dashboards — Grafana

Nine dashboards. Each has a stated owner and a stated question.

| Dashboard | Question it answers | Key panels |
| --- | --- | --- |
| **Platform overview** | Is anything wrong right now? | Global RED row (req/s, error %, p50/p95/p99) · error budget burn per SLO · top 5 failing routes · active incidents · deploy markers as annotations |
| **Service detail** (templated, one per service) | Why is *this* service unhealthy? | RED per route · saturation (CPU, memory, pool utilisation) · Postgres query time p99 · job queue depth, lease expiries, retries, dead-letter · upstream call latency + circuit-breaker state · **exemplar links straight into Tempo** |
| **Money integrity** | Is the ledger right? | **Trial balance: Σ debits − Σ credits (must be exactly 0 — alert on any non-zero)** · reconciliation drift per chain (ledger custody account vs indexer-observed on-chain balance) · unreconciled entries by age · reservations older than 24h · failed postings · idempotency replay rate |
| **Deposits & withdrawals** | Is money moving? | Funnel: detected → confirmed → credited · confirmation lag per chain (p50/p95) vs the policy depth · withdrawal state age histogram (pending/signed/broadcast) · **stuck count — pages on ≥1** · treasury balance vs target float per chain · sweep backlog |
| **Chain health** (Forge Network + external) | Are we seeing the chains correctly? | Indexer lag in blocks per chain · reorg depth events · RPC provider success rate and failover events · rate-limit rejections · Hearth height/peers/hashrate/difficulty/mempool · block time distribution |
| **Custody & security** | Who touched key material? | Signing requests by purpose and outcome · refusals by reason (`binding_mismatch`, `purpose_forbidden`) · key exports in flight, by lifecycle stage · policy decisions `deny`/`challenge`/`review` rate · admin actions per operator · failed auth by IP · new-device sign-ins |
| **Business** | Is the business working? | Revenue by source (mint fees, trade performance fees, market fees, subscriptions, studio credits) · GMV and take rate · active subscriptions and churn · creator payouts owed vs paid · refunds and disputes |
| **Product funnels** | Where do people drop off? | Register → wallet created → deposit confirmed → first conversion → first product action, as an **ordinal funnel** · cohort retention heatmap by signup week · cross-product usage matrix · time-to-first-deposit distribution |
| **Developer platform** | Is the API healthy for its users? | Calls per project · error rate by API key · rate-limit hits · webhook delivery success and retry depth · sandbox vs production split |

**Alert routing, stated once.** Page on user-visible failure (a Beacon journey fails twice
consecutively; trial balance ≠ 0; a stuck withdrawal; custody unreachable; indexer lag past the
confirmation depth). Ticket on everything else. Every alert carries a runbook link; an alert
without one is deleted, not silenced.

### 6.3 In-product graphs

Graphs that answer a user's question, not graphs that decorate a page.

| Surface | Graph | Form | Notes |
| --- | --- | --- | --- |
| **Forge Hub · dashboard** | Portfolio value, 24h/7d/30d/1y | Area, one series, crosshair tooltip | One series ⇒ no legend box; the title names it. Value in the user's display currency, with a "priced at" timestamp — never a bare number |
| Hub · dashboard | Allocation by asset | Horizontal bar, sorted, direct-labelled | **Not a pie.** ≥8 assets fold to "Other" |
| Hub · dashboard | Balance movement in/out | Diverging bars around a zero baseline | Gain/loss diverging pair |
| Hub · activity | Activity volume by type | Stacked bars per day | Adjacent-safe categorical order, 2px surface gap between segments |
| Hub · receive | Confirmation progress | Ordinal step meter, not a chart | 4/60 blocks reads better as a meter with an ETA |
| **Forge Trade** | Equity vs buy-and-hold | Two-line chart, direct-labelled | Already exists (`EquityChart.tsx`), hand-rolled SVG — keep, restyle to the validated palette |
| Forge Trade | Drawdown | Filled area below zero | Existing |
| Forge Trade | **Cross-bot portfolio** (new) | Stacked area of allocated capital + a P&L bar per bot | The missing aggregate — today Crucible has per-bot views only |
| Forge Trade | Strategy comparison | Small multiples, ≤4 series, all-pairs palette | Small multiples ⇒ all-pairs cap applies |
| **Forge Network** | Hashrate, difficulty, block time | Three separate one-series charts | **Never a dual axis.** Three measures, three charts |
| Forge Network | Supply and emission | Area with the modelled curve overlaid, dashed | Label it "modelled — not a promise", as the site already does |
| Forge Network | Block explorer: blocks/day, tx/day, active addresses | Bar, bar, line | Explorer landing page |
| **Forge Market** | Floor price and volume per collection | Line + volume bars, **stacked vertically sharing an x-axis** | Two measures, two panels — not two y-axes |
| Forge Market | Listing/sale activity | Bar per day | — |
| **Forge Worlds** | Season progress, resource scarcity | Ordinal meters + a world stock line | Scarcity is the game; show it |
| **Developer portal** | Usage vs quota, error rate, latency | Line + a quota threshold line | Threshold as an annotation, not a series |
| **Admin** | Every operator panel links to the Grafana equivalent | — | The admin console shows *state*; Grafana shows *trend*. Do not rebuild Grafana in React |

**Rules that apply to every graph above**, from the validated spec:

- **Never a dual-axis chart.** Two measures of different scale become two stacked panels
  sharing an x-axis, or two charts.
- **Money is never plotted without its unit and its pricing timestamp.** A portfolio chart
  denominated in a stale oracle price is a lie with a gradient on it.
- **A chart that cannot load says so.** Beacon and Lantern already render an explicit "no data
  answered" state rather than an empty axis; every product chart does the same. An empty chart
  and a broken chart must not look identical.
- **Every chart has a table view.** It is the accessibility fallback and the export path
  (Forge Trade needs exportable transaction history for tax anyway).
- **Colour never carries meaning alone** — status marks ship icon + label; series ≤4 are
  direct-labelled as well as legended.

## 7. Consequences accepted

Stated so that no one rediscovers them mid-migration.

1. **38 repositories is a real cost.** AD-02 and AD-03 are the mitigation and they are on the
   critical path. If Renovate and the release manifest are not working by the end of Phase 2,
   **stop and fix them before splitting anything.** This is an explicit gate in
   [06-ecosystem-workflow.md](06-ecosystem-workflow.md).
2. **No single CI can test the whole system.** AD-04 is the answer, and it means a staging
   environment is now mandatory infrastructure rather than a nicety.
3. **Custody remains single-replica and is a single point of failure for signing.** Deposits
   still land while it is down; withdrawals and sweeps queue. That is the correct degradation
   and it must be visible in the status page.
4. **The ledger split is the riskiest migration in the plan.** It moves live balances. It is
   done by dual-write with continuous reconciliation and a read-side cutover, never by a
   big-bang copy. Detail in [10-migration-strategy.md](10-migration-strategy.md).
5. **HD derivation in custody cannot be retrofitted onto existing flat keys.** Existing
   addresses stay flat-key and exportable; new addresses are derived. Custody carries two key
   schemes indefinitely, and says so in every response.
6. **Hearth mainnet is not launched.** Everything EMBER-denominated is testnet until it is.
   Nothing in this plan assumes a mainnet date.
