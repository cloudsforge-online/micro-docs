# 16 — Risks and open decisions

The honest register. Every risk below is one this plan actually carries, with the phase where
it bites, the mitigation that is already in the plan, and — the column that matters most — the
**early-warning signal** that tells you it is materialising while there is still time to act.

A risk register whose entries are all "medium/medium" is decoration. These are graded, and
several are graded high on both axes because they genuinely are.

The second half is what this plan **deliberately does not decide**. A plan that pretends to
have decided everything is a plan that will be wrong quietly rather than openly.

---

## 1. Risk register

**Likelihood** and **impact** are `L · M · H`. **Owner** is a role, not a person; on a
one-engineer estate every role is currently the same person, which is itself R-46.

### 1.1 Money and the ledger

| ID | Risk | Cat | L | I | Phase | Mitigation | Owner | Early warning |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-01 | **The ledger migration moves a balance incorrectly.** A user's balance in some asset is wrong after cutover, and nobody notices until they withdraw | Financial | M | **H** | P4 | Exact-match backfill against P0's signed census; dual write with a five-minute comparator; two weeks at zero divergence before read cutover; dual write retained *past* cutover; per-asset withdrawal freeze on drift | Money lead | Any non-zero comparator result. One divergence is the signal — not a trend |
| R-02 | Backfill reproduces the census "within tolerance" rather than exactly, and the tolerance hides a real error | Financial | M | **H** | P4 | The exit criterion is *exactly*, not within tolerance. A one-minor-unit mismatch blocks the phase | Money lead | Anyone proposing a tolerance for the backfill |
| R-03 | The divergence comparator itself is broken and reports zero because it is not running | Financial | L | **H** | P4 | The comparator emits a heartbeat metric; absence of results alerts, not just non-zero results | Money lead | Comparator run count flat for one hour |
| R-04 | The trial-balance deferred constraint is too slow at volume and is relaxed "temporarily" | Technical | L | H | P4 | It is a database constraint, not application code, and its removal requires a migration that fails review | Money lead | Any PR touching the constraint trigger |
| R-05 | **Custodial float coverage falls below 100%** — outstanding user liability in an asset exceeds the custody holdings backing it | Financial | M | **H** | P7 | Reconciliation invariant ([04](04-domain-model.md) §2.4); coverage ratio on the Business dashboard; issuance stops before redemption does | Money lead | Coverage ratio below 105% |
| R-06 | `convertCoinToEmber` is re-enabled before the reserve check exists | Financial | M | **H** | P1→P7 | Disabled in P1; re-enabled in P7 only behind reconciliation ([06](06-ecosystem-workflow.md) P1 item 12) | Money lead | Custodial EMBER liability rising with no matching custody asset movement |
| R-07 | The split fragments a transaction that used to be atomic — a debit lands and its business effect does not | Technical | M | H | P4 | A debit and its effect are never in two services: the ledger posting *is* the transaction, the product consumes the event | Architect | Any entry with no corresponding domain record after the reconciliation window |
| R-08 | **No refund path exists anywhere** (`/internal/credit` has no caller), so the undelivered-SKU remediation cannot execute | Financial | **H** | M | P1 | Refund path is built in P1 as the first item, before the withdrawals; completed in P7 | Money lead | It is already materialised. Track as a P1 blocker |
| R-09 | Revenue by product stays underivable because a service charges through a path that records no source | Financial | M | M | P4 | Every posting records `originating_service`; the omnibus `/internal/*` surface is retired | Money lead | Any revenue entry with a null or generic source |

**R-01, R-02 and R-05 were de-Sharded on 2026-08-07 — generalised, not narrowed.** They named
Shards because Shards was the largest balance when they were written; SHARD is now retired
(`contracts/packages/chain/src/index.ts`) and none of the three risks was ever about that asset
in particular. R-05 is the one worth reading twice: retiring an asset *shrinks* a float-coverage
risk, because nothing issues new liability against the same custody, but it does not close it —
the residual balance is still owed to whoever holds it, and it is still redeemable. The mitigation
is unchanged and the early warning is unchanged.

### 1.2 Topology and delivery

| ID | Risk | Cat | L | I | Phase | Mitigation | Owner | Early warning |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-10 | **The polyrepo topology costs more than it returns.** Forty repositories for one team, and the machinery that pays for it never quite works | Operational | **H** | **H** | P2→P13 | AD-02/03/04 are the critical path and P2 is a hard gate. The three measured mitigations in [03](03-repository-responsibilities.md) §5 are reviewed at *every* phase gate | Architect | All three, together: **Renovate lag over 24 hours** (failing at a week); **any repo with a bespoke CI file** (target zero); **`cfctl new service` taking over an hour** to reach green CI and Beacon |
| R-11 | **Renovate does not actually work unattended and nobody notices** | Operational | M | H | P2 | An exit criterion with a demonstration, twice, not a configuration file | Platform lead | Time from contract publish to last consumer creeping past 24 hours |
| R-12 | Bespoke CI files reappear after P2 because a repo "needed one thing" | Operational | M | M | P3+ | Counted at every gate; the fix is a new input to the reusable workflow, never a local file | Platform lead | Count above zero |
| R-13 | A contract breaking change escapes `contract-compat.yml` because the change is semantic, not structural | Technical | M | H | P3+ | Consumer-driven contract tests replay real consumer expectations against real handlers (AD-04) | Architect | A consumer failing on a version the schema-diff passed |
| R-14 | Thirteen extractions in P3 lose a configuration detail | Technical | M | M | P3 | `git subtree split` so config travels with code; one at a time; journeys as the gate between each | Platform lead | Any journey failing after an extraction that passed before it |
| R-15 | The boot-DDL → versioned-migration conversion breaks a production schema | Technical | M | **H** | P2 | Tested against a **restored production dump**, not an empty database; one service at a time, least critical first | Platform lead | Any migration that is not idempotent against the restored dump |
| R-16 | GHCR packages for new repos are private by default and 403 the deploy path | Operational | **H** | L | P3 | Known trap; `cfctl doctor` checks visibility | Platform lead | It materialises on every new repo. Automated check, not vigilance |
| R-17 | The event relay's Postgres outbox becomes the bottleneck and a broker is adopted in a panic | Technical | L | M | P6+ | AD-10's four measured trigger conditions, written down in advance so adoption is a measurement, not an argument | Architect | p99 relay lag approaching 30 seconds; any topic approaching 50 events/second |
| R-18 | A lease key names the row rather than the contended resource, so the race survives the fix | Technical | M | **H** | P4, P5 | The lease-key table in [04](04-domain-model.md) §10.5 is explicit per job; two-replica concurrency tests per money-moving job | Money lead | A two-replica test that passes without actually contending |

### 1.3 Custody, keys and chain

| ID | Risk | Cat | L | I | Phase | Mitigation | Owner | Early warning |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-19 | **Custody is a permanent single point of failure for signing.** Single replica, container-per-address, unmovable to a second host | Technical | **H** | M | Permanent | Accepted and written down (AD-18). Deposits still land while it is down; withdrawals and sweeps queue. The degradation is correct and must be **visible on the status page** | Custody lead | It is not a question of *if*. Watch withdrawal queue depth during any custody restart |
| R-20 | **The master secret cannot be rotated** — `CURRENT_VERSION = 1`, no v2 branch, no re-encryption pass | Security | M | **H** | Now→P5 | A key-version field and a re-encryption pass land in P5a; rotation proven end-to-end on staging is a P5 exit criterion | Custody lead | Already materialised. The signal is P5 slipping |
| R-21 | Deleting `POST /admin/keys/:address/reveal` removes the only key-recovery path before the replacement exists | Operational | M | H | P5 | The two-operator break-glass runbook ships **and is rehearsed in the same release**, not after | Custody lead | The runbook existing but never having been executed by two people |
| R-22 | **HD derivation is implemented incorrectly and addresses are unrecoverable** | Technical | L | **H** | P5 | BIP-32/39/44 test vectors plus a full derive→sign→verify round trip per family before any production address uses it | Custody lead | Any family whose round-trip test is skipped or stubbed |
| R-23 | Two key schemes coexist permanently and the export UX offers a recovery phrase that does not exist | Product | M | M | P5+ | Every custody response states its scheme; export formats are derived from it, never assumed | Custody lead | A UI that offers "mnemonic" without reading `scheme` |
| R-24 | **The indexer double-credits a deposit** | Financial | M | **H** | P5 | 30-day shadow parity against balance-probing; crediting idempotent on `(address, txid)`; the exit criterion is *both would credit, both do, at the same depth* | Chain lead | Any parity mismatch during the shadow period, in either direction |
| R-25 | **The indexer misses a deposit** — silent, and worse than a double-credit because nobody complains until they do | Financial | M | **H** | P5 | Same shadow parity, run in both directions; per-address activity reconciled against chain balance | Chain lead | Shadow parity showing balance-probing crediting something the indexer did not |
| R-26 | A reorg deeper than the confirmation policy credits money that is then unwound | Financial | L | **H** | P5, P7 | Reorg simulation per family including a deep reorg past the depth, as a P5 exit criterion; reorg alarm depth per chain | Chain lead | Any observed reorg within 50% of the configured alarm depth |
| R-27 | An RPC provider outage or rate-limit freezes deposit detection | Operational | **H** | M | P5+ | Provider abstraction with failover; provider health tracked; Chain Health dashboard | Chain lead | Provider success rate below 99%; any failover event |
| R-28 | XRP's missing network binding lets a signed payment be replayed on the other network | Security | L | H | P1 | P1 item 11 binds the network in derivation and signing | Custody lead | Already materialised in code today |
| R-29 | Bitcoin and Solana remain unwithdrawable, so a supported-looking coin is a trap | Product | M | M | P5, P7 | Output policies built in P5a; BTC and SOL withdraw and sweep on testnet is a P5 exit criterion | Chain lead | A UI listing a coin whose withdrawal path returns `UnsupportedChainError` |

### 1.4 Security and abuse

| ID | Risk | Cat | L | I | Phase | Mitigation | Owner | Early warning |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-30 | **Key export is used for social engineering.** A user is talked through the ceremony by an attacker | Security | **H** | **H** | P6+ | 24-hour cooling-off with a cancel link; notification on *every* channel; second MFA on redemption; copy written for a user under pressure; export history user-visible | Security lead | A rise in exports cancelled during cooling-off — that is the control working *and* the attack happening |
| R-31 | The export ceremony's friction is mistaken for the platform withholding assets | Product | M | M | P6 | Plain-language guidance; the `exported` state explained in the UI, not in documentation | Product | Support volume on "why can't I get my key" |
| R-32 | **A marketplace attracts fraud immediately** — fake tokens, impersonated projects, wash trading | Product | **H** | **H** | P9 | Verification levels; **computed** risk indicators shown as facts; policy gating for new accounts and high-value items; invite-only launch with value caps raised progressively; moderation SLAs | Product | Listings-per-new-account rate; duplicate symbol/name collisions |
| R-33 | The paid verified badge is read as an endorsement of investment merit | Legal | **H** | H | P9 | Badge copy states exactly what was checked and what was not; risk indicators are computed and non-editable; if that cannot be held in the UI, the SKU is withdrawn ([15](15-monetisation-model.md) §3.5) | Product | Any marketing copy using "verified" without its qualifier |
| R-34 | **Cross-product rewards create an exploitable loop** — earn in a world, sell in Market, convert, repeat | Financial | M | **H** | P10 | Every reward is a ledger posting against a **capped budget account**, rate-limited and policy-gated, so an exploit is bounded and visible rather than unbounded and invisible | Money lead | Reward budget consumption rate against its cap |
| R-35 | A game exploit that mints rewards is treated as a game bug rather than a money incident | Operational | M | H | P10 | Reward issuance is a ledger posting; it appears in reconciliation and on the Money Integrity dashboard | Money lead | Reward postings outside expected hours or distribution |
| R-36 | `identity.user.deleted` is published but a subscriber never acknowledges, so erasure is incomplete | Legal | M | H | P6+ | Every service storing `user_id` subscribes with a stated SLA; acknowledgement is tracked, not assumed | Architect | Any deletion event unacknowledged past its SLA |
| R-37 | The analytics pepper leaks, or bucketing is coarse enough to re-identify | Security | L | M | P13 | Pepper lives only in `analytics`; no email, handle, address or exact balance is ever received (AD-21) | Security lead | Any PR adding a field to the analytics envelope |
| R-38 | Scoped service tokens are issued too broadly and become the new shared secret | Security | M | H | P4+ | Scopes are explicit per route; every ledger posting records the calling service, so over-broad scope is visible in the data | Security lead | One service appearing as the originator of postings it should not make |

### 1.5 Product, scope and team

| ID | Risk | Cat | L | I | Phase | Mitigation | Owner | Early warning |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-39 | **Twenty-four services are too many for the team.** Each needs a database, migrations, CI, dashboards, a runbook, backups and an owner | Operational | **H** | **H** | P3→P13 | The service template and reusable workflows make the marginal service cheap; the [17](17-definition-of-done.md) service checklist makes "cheap" verifiable; if a service cannot meet it, it is merged into its neighbour | Architect | Any service that reaches production missing a runbook, a dashboard or a verified restore |
| R-40 | **Telemetry is deferred as "not user-facing" and the decomposition becomes unvalidatable** | Operational | M | **H** | P2 | Telemetry lands in P2, *before* the first repository splits, because comparing traces and error rates across a cutover is the only proof that nothing broke. Instrumenting afterwards means the baseline is gone | Architect | P2 sub-phase 2c slipping behind 2a/2b/2e |
| R-41 | P0's two weeks of baseline telemetry are never captured, so "p95 within 20% of baseline" has no baseline | Operational | M | H | P0 | It is a P0 exit criterion with a stored artefact, not a claim | Architect | P0 declared complete with no queryable baseline |
| R-42 | **Journeys that fail intermittently get muted rather than fixed** | Operational | **H** | H | P0+ | A muted journey is a P1 backlog item with an owner, and the muted count is a gate at *every* subsequent phase | Architect | Muted count above zero at any gate |
| R-43 | **Scope sprawl in Forge Hub** — it absorbs every product's UI and becomes the monolith the decomposition removed | Product | **H** | M | P6 | Hub owns account, wallet, portfolio, activity, settings, security. Product surfaces stay in product apps. Anything else is a new route in a product repo | Product | A Hub PR touching a product's domain logic |
| R-44 | `hub-api` turns one slow upstream into a dead dashboard | Technical | M | M | P6 | Per-upstream circuit breakers; per-tile degradation is an exit criterion **with an explicit test** that renders the dashboard with each upstream individually down | Platform lead | Dashboard p95 tracking the slowest upstream rather than the median |
| R-45 | Estimates are wrong: six XL phases at ten to fourteen weeks each is years, not months | Operational | **H** | M | All | Phases are gated on criteria, not dates. A phase that misses its criteria is not shipped late, it is not shipped | Architect | Two consecutive phases exceeding their upper estimate |
| R-46 | **Key-person risk.** Every role in this table is one person; the plan assumes continuity across fourteen phases | Operational | **H** | **H** | All | Documentation-first (this directory), runbooks per alert, break-glass requiring *two* operators — which is itself unsatisfiable with one | Architect | Any procedure that documents "two operators" while one exists |
| R-47 | Solana stays suspended and the dead code rots behind a flag | Product | M | L | P8 | P8 exit criterion: Solana is unsuspended **or formally withdrawn with the code removed**. There is no third option | Product | The suspension surviving a second phase |
| R-48 | The staging environment diverges from production and stops proving anything | Operational | M | H | P2+ | Staging deploys from the same release manifest as production; divergence is a manifest diff | Platform lead | Any manual change applied to staging and not to a manifest |
| R-49 | Backups exist as files and have never been restored | Operational | **H** | **H** | P13 | Restore drills, quarterly, within a stated RTO, from an **off-host** backup. The existence of a dump file is not a backup | Operator | `infra/backup.sh` remaining unscheduled and local. Already materialised |
| R-50 | Asset generation stays dependent on one OpenAI model that is deprecated, repriced or refuses a prompt | Technical | M | M | P8 | Model name is configuration; the cost table is explicit; offline SVG placeholders already exist as a fallback path | Product | Any model deprecation notice; generation refusal rate above 1% |

### 1.6 Legal and regulatory

| ID | Risk | Cat | L | I | Phase | Mitigation | Owner | Early warning |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-51 | **Custodial holdings create regulatory exposure.** Holding customer crypto is a regulated activity in most jurisdictions the platform is reachable from | Legal | **H** | **H** | P7+ | This plan does not resolve it — see §2.5. What it does provide is the *evidence base* any regime requires: a double-entry ledger, reconciliation against chain, an audit trail, and per-user statements. Without those, compliance is impossible at any cost | Architect | Reaching a user or asset-value threshold in any single jurisdiction |
| R-52 | KYC/AML obligations are triggered by the marketplace, by withdrawal volume or by a jurisdiction | Legal | M | **H** | P9+ | Deferred decision §2.6. The policy service is built so identity-verification obligations are an *additional* gate rather than a re-architecture | Architect | Aggregate withdrawal volume per user per rolling year |
| R-53 | A token deployed via Forge Create is characterised as a security, implicating the deployer | Legal | M | H | P8+ | The customer's wallet is the contract owner and the platform is a tool, not an issuer. Risk disclosures on every project page; no promotion of price | Product | Any marketing copy about a customer token's price or prospects |
| R-54 | The conversion spread is characterised as unlicensed exchange or money-transmission activity | Legal | M | H | P7+ | Conversions are between assets the platform already custodies for one user, never between users; there is no order book and no fiat rail | Architect | Any proposal to match two users' conversions |
| R-55 | VAT/sales tax on digital goods across jurisdictions is not collected | Legal | M | M | P13 | Billing stores country, treatment and rate per invoice from P13 | Architect | First invoice issued without a tax treatment recorded |

---

## 2. Open decisions

Things this plan **deliberately does not decide**. Each states why it is deferred, what
information would resolve it, the phase gate at which it must be resolved, and the default that
applies if nobody decides.

### 2.1 Does Hearth launch mainnet, and when?

> **RESOLVED 2026-08-05. Mainnet launched — chain 7411, live and mining.** See
> [18-build-status](18-build-status.md) §0. The reasoning below is left intact as the record of why
> it was deferred, but the **"Default if undecided: mainnet is not launched"** line no longer
> describes reality and must not be cited as a constraint. The one property it claimed was
> load-bearing — that no phase's exit criteria depend on a mainnet date — is now moot.
>
> Note that mainnet EMBER still has **no monetary value** on either network, so anything downstream
> that was waiting on "is EMBER real money yet" is still waiting. Launched ≠ valued.

**Deferred because** a mainnet launch is a one-way door: a chain with real value cannot be
reset, and Hearth has no finality gadget, no multisig, no pools and a supply curve that is
currently modelled rather than committed. **Resolved by:** sustained testnet hashrate from
independent miners, an external review of consensus and the EVM, and a decision on whether
EMBER is ever exchange-listed. **Gate:** P10, when EMBER's economic role goes live.
**Default if undecided: mainnet is not launched.** Everything EMBER-denominated stays testnet,
and — as [02](02-target-architecture.md) §7.6 states — **nothing in this plan assumes a mainnet
date**. That is a load-bearing property, not a caveat: no phase's exit criteria depend on one.

### 2.2 Kubernetes: adopt or not?

**Deferred because** it is a conclusion, not a prerequisite (AD-17). After the gateway and the
leased jobs land, translation from compose is mechanical. **Resolved by:** needing more than one
host — for capacity, for availability, or because a second region is required.
**Gate:** P13. **Default: no Kubernetes.** Compose plus the release manifest, on one host, with
two permanent exceptions already written down: `custody` and Hearth nodes are StatefulSets of
exactly one, or they stay outside the cluster entirely.

### 2.3 A message broker?

**Deferred because** NATS or Redis Streams is a second stateful system to operate for an event
volume in the hundreds per minute, and Postgres already has `SKIP LOCKED` and transactions.
**Resolved by measurement, not argument** — AD-10 fixes four trigger conditions in advance.
Adopt NATS JetStream when **any one** is true:

1. a single topic exceeds **50 events per second sustained**;
2. more than **six consumers** subscribe to one topic;
3. replay of more than **24 hours** is needed operationally more than once a quarter;
4. **p99 relay lag exceeds 30 seconds for a week**.

**Gate:** reviewed at every phase gate from P6. **Default: no broker.** The relay stays a leased
job like any other.

### 2.4 Solana: complete or withdraw?

**Deferred because** the suspension currently masks a real double-mint defect (no `onBroadcast`,
`/status` settle gated on `chain.family === 'evm'`) and because custody refuses `SetAuthority`,
which is the correct refusal until a bounded version exists. **Resolved by:** whether the bounded
`SetAuthority` policy lands in P5a, and whether Foundry-tier demand justifies it.
**Gate: P8, and there is no third option** — the exit criterion is "Solana is unsuspended or
formally withdrawn with the code removed". **Default: withdrawn.** Dead code behind a flag is a
liability, and the Foundry tier's copy already has to be honest about what an SPL mint does and
does not have.

### 2.5 Does the platform ever hold fiat?

**Deferred because** it is the single largest change to the platform's regulatory posture and
nothing in the current design requires it. **Resolved by:** whether users are actually blocked
from funding accounts, measured as drop-off at the deposit step in the P13 funnel.
**Gate:** P13. **Default: no fiat, permanently.** The invoice and provider stack was deleted, not
deferred — `PAY_PROVIDER` defaulted to `'mock'` and `POST /invoices/:id/mock-pay` was a live hole
that minted a spendable balance out of nothing. A custodial balance is funded by on-chain deposit
only. Reversing this is a new programme, not a feature.

### 2.6 Is KYC/AML required, and at what threshold?

**Deferred because** the answer depends on jurisdiction, on whether fiat is ever held (§2.5) and
on the marketplace's asset classes. Building identity verification before it is required imposes
friction on every user for a hypothetical. **Resolved by:** legal advice against a named
jurisdiction list, plus measured withdrawal volume per user. **Gate:** P9 for the marketplace,
P13 for the platform. **Default: no identity verification, with the hooks in place** — `policy`
supports `challenge` and `review` outcomes and cooling-off timers from P5, so adding a
verification obligation is a new rule rather than a new architecture. Velocity limits and
trusted-address controls ship regardless, because they are good security independent of
regulation.

### 2.7 Does Forge Trade ever touch a real exchange?

**Deferred because** [01](01-product-vision.md) §6 rejects a CloudsForge exchange, and settling
against a price oracle on coins already custodied is a defensible boundary. Connecting to an
external venue introduces API-key custody, venue counterparty risk and a different regulatory
posture. **Resolved by:** whether users demand execution quality that an oracle cannot provide.
**Gate:** P10. **Default: no.** Live bots settle against `pricing`. The product's copy already
tells the truth about this and must continue to.

### 2.8 Do community treasuries move on-chain?

**Deferred because** Hearth has no multisig, no scripting layer and no finality gadget: an
on-chain treasury today would be a single key with extra ceremony. **Resolved by:** Hearth
gaining threshold signing. **Gate:** P12, re-reviewed whenever §2.1 is decided.
**Default: ledger sub-accounts** with proposal → threshold → timelock → posting (AD-15). When
threshold signing exists, EMBER treasuries above a configurable value move on-chain and the
ledger becomes the mirror rather than the record. That is a stated future migration, not a
present pretence.

### 2.9 Is evicting the personal CV site a hard requirement?

**Deferred because** it is genuinely harmless — `cv-web` serves `savvanis.life` from the company
stack and costs one container. **Resolved by:** whether the estate is ever presented to an
external party (investor, auditor, acquirer) for whom "a personal site in the production
compose" is a governance finding rather than a curiosity. **Gate:** P2.
**Default: evicted**, as [03](03-repository-responsibilities.md) §1.7 states. It is an
afternoon's work and it removes a question that otherwise gets asked at the worst moment.

### 2.10 Does asset generation stay OpenAI-dependent?

> **RESOLVED. The default below was not taken.**
> [24-asset-model-comparison](24-asset-model-comparison.md):3, :22 and :296 conclude **"FLUX 2 Pro,
> decisively"**, and the root README credits FLUX 2 Pro. The **"Default: OpenAI only"** line is
> therefore stale and contradicts a sibling document with authority on this question. The reasoning
> below is left as the record of why it was deferred in July 2026.

**Deferred because** `gpt-image-1` is the only model the account can actually generate with
(probed 2026-07-28), and a second provider is real work for no current benefit.
**Resolved by:** a deprecation notice, a repricing, or a refusal rate that makes the product
unreliable. **Gate:** P8. **Default: OpenAI only, with the model name as configuration and the
offline SVG placeholder path retained** as the degradation mode. The cost table
(`asset-forge/src/model.ts`) is explicitly "an estimate, not a quote" and must stay that way.

### 2.11 Which of the eight products survives?

**Deferred because** it cannot be answered before P13's analytics exist. **Resolved by:** the
cross-product usage matrix and the funnel data. **Gate:** after P13, as the first act of
whatever follows this plan. **Default: all of them**, which is the expensive default and is
stated as such. A product that no funnel reaches is a maintenance liability with a logo.

---

## 3. Assumptions this plan makes

If any of these is wrong, the part of the plan that rests on it is wrong with it.

| # | Assumption | What breaks if it is false |
| --- | --- | --- |
| A-01 | The existing money code is *correct where it is not listed as broken* — particularly `withIdempotency` and `recordDepositAndCredit` | The P4 backfill copies a defect into the ledger and blesses it as an opening balance |
| A-02 | P0's data census is a true snapshot of what is owed | R-01 and R-02 both become undetectable |
| A-03 | Beacon's 45 journeys cover enough behaviour that "journeys green" means "nothing broke" | Every phase gate becomes a false negative. This is why journey count grows per phase |
| A-04 | Database-per-service is genuinely true today (verified by grep across nine repos) | The decomposition hits a cross-service read that was never in the plan |
| A-05 | Contract packages can be published to GitHub Packages with the workflow's own `GITHUB_TOKEN` | AD-02 has no root-cause fix and the manual release ritual survives, which fails R-10 |
| A-06 | Event volume stays in the hundreds per minute | §2.3's default is wrong and a broker is needed sooner than planned |
| A-07 | One host is sufficient for the whole estate through P13 | §2.2's default is wrong; Lantern's Docker-socket collector and custody's container-per-address vault both become blockers |
| A-08 | The team stays continuous across fourteen phases | R-46. Half the plan's sequencing assumes accumulated context |
| A-09 | User volume stays small enough that a wrong balance affects few people and is individually correctable | R-01's impact grows superlinearly with users |
| A-10 | EMBER has no market price during the plan, so nothing EMBER-denominated is real money | Every EMBER-denominated feature acquires financial and regulatory weight it was not designed for |
| A-11 | The chains supported today remain supported by their RPC providers, and testnets stay funded | P5's parity period and every testnet exit criterion stall |
| A-12 | Nothing in the estate is currently under active attack | The security sequencing (per-service secrets P1, custody hardening P5, MFA P6) is too slow. Several findings in [00](00-current-state.md) §3.5 would be P0 under attack |

---

## 4. What would cause a re-plan

Specific tripwires. Hitting one does not mean abandoning the plan; it means stopping and
re-deciding rather than pressing on.

1. **The P2 gate is not met after two attempts.** If Renovate does not reach every consumer
   unattended, or bespoke CI files persist, or `cfctl new service` takes a day rather than an
   hour, then AD-01's cost is not being paid and **the topology is revisited rather than
   endured** — [02](02-target-architecture.md) §7.1 already commits to stopping here.
2. **Renovate lag exceeds a week at any gate.** [03](03-repository-responsibilities.md) §5:
   "if it exceeds a week, the topology is failing". Not a warning — a re-plan trigger.
3. **A balance is wrong in production after the P4 read cutover.** Roll back to Pay-authoritative
   reads (which dual write makes possible), stop the phase, and re-derive the migration.
4. **The trial balance is non-zero for more than one cycle** and the cause is not a known
   in-flight entry. Everything downstream of the ledger is untrustworthy until it is zero.
5. **Reconciliation drift exceeds tolerance on any asset and cannot be explained within 24
   hours.** Withdrawals stay frozen for that asset; the cause is a re-plan input, not a ticket.
6. **The indexer's 30-day shadow parity fails in the "missed a deposit" direction.** A
   double-credit is recoverable; a silent miss means the replacement is not a replacement.
7. **Any key material leaves the platform other than through the export ceremony.** Full stop on
   feature work; incident response; the security model is re-derived before anything else ships.
8. **Two consecutive phases exceed their upper estimate.** The estimates are wrong by enough that
   the sequencing assumptions need re-checking, not the effort.
9. **Muted journeys exceed zero at two consecutive gates.** The regression harness has stopped
   being a harness, and every subsequent "nothing broke" claim is unfounded.
10. **A regulator, bank or counterparty asserts jurisdiction.** §2.5 and §2.6 stop being deferred
    decisions and become the top of the backlog.
11. **The team drops below its current size.** Forty repositories, twenty-four services and
    fourteen phases is already an aggressive plan for one person. Below that it is not a plan.
