# 05 — User journeys

What a person actually does with CloudsForge, step by step: the surface they are on, the services
that run, the calls those services make, the events those calls emit, and what happens when each
step fails. This document turns [01-product-vision.md](01-product-vision.md)'s eleven "one
platform" tests into something testable, and it is the source for the Beacon journeys that gate
every phase in [06-ecosystem-workflow.md](06-ecosystem-workflow.md).

Read [02-target-architecture.md](02-target-architecture.md) and
[04-domain-model.md](04-domain-model.md) first — every service, route, state and event below is
defined in one of them. Where a step describes something that exists today, the current file is
cited so the delta is checkable rather than asserted.

---

## 0. Conventions

| Notation | Meaning |
| --- | --- |
| `a → b` | Synchronous HTTP call, `a` calls `b`, `a` waits |
| `a ⇢ topic` | `a` writes an outbox row; the relay delivers it (AD-10) |
| **P6** | The phase in [06](06-ecosystem-workflow.md) that makes this step work |
| `cf:mint:token:…` | A URN per [04](04-domain-model.md) §0 |

The surfaces a user can be on:

> **This table is out of date in three ways, corrected in
> [22-browser-journeys.md](22-browser-journeys.md) §5 and §9.3 against the working tree.**
> (1) There are **fifteen** frontend surfaces, not ten: it predates `foresight-web`,
> `foresight-admin-web`, `emberkin-web`, `aetherholm-web` and `site`. (2) The identity row is
> **false** — `micro-identity` serves JSON only and renders no HTML, and **no repository in the
> estate serves a sign-in page**. (3) `mint-web` does not call `studio`; there is no studio
> surface. The rest of this document's journeys stand; the surfaces they name have moved.

| Surface | Repo | What it is |
| --- | --- | --- |
| Forge Hub | `hub-web` + `hub-api` | Dashboard, portfolio, wallet, activity, settings, security |
| ~~Identity screens~~ | ~~`identity` (server-rendered)~~ | **Does not exist.** Every SPA redirects to `account.<apex>/login` and nothing in the estate answers there |
| Forge Create | `mint-web` → `mint`~~, `studio`~~ | Token launch, project pages. No `mint-web` page fetches a brand kit |
| Forge Market | `market-web` → `market` | Discovery, listings, offers, orders |
| Forge Trade | `trade-web` → `trade` | Backtests, strategies, paper and live bots |
| Forge Worlds | `worlds-web` → `worlds`, `nda` | The game platform and its first title |
| Forge Network | `explorer-web`, `network-site`, `faucet` | Chain explorer, marketing, testnet faucet |
| Developer Platform | `devportal-web` → `devplatform` | Projects, keys, webhooks, docs, sandbox |
| Operator console | `admin-web` → `admin-api` | Every operator action, audited |
| Status | `status-web` ← `beacon` | `status.cloudsforge.online`, pre-auth, redacted |

**Everything EMBER-denominated below is testnet.** Hearth mainnet is not launched
([02](02-target-architecture.md) §7.6), and no journey assumes a date for it.

---

# Part 1 — The canonical journey

One person, one account, from nothing to a running integration. Twelve steps, in the order the
brief names them. This is the spine; everything in Part 2 hangs off a step here.

| # | Step | Surface | Phase |
| --- | --- | --- | --- |
| 1.1 | Register | Identity screens → Hub | P6 |
| 1.2 | Create or connect wallets | Hub · Wallet | P6 |
| 1.3 | Fund the account | Hub · Receive | P5, P6, P7 |
| 1.4 | Hold assets | Hub · Portfolio | P4, P6 |
| 1.5 | Create assets | Forge Create | P8 |
| 1.6 | Use assets | Forge Worlds, Forge Trade | P10 |
| 1.7 | Trade or sell | Forge Trade, Forge Market | P9, P10 |
| 1.8 | Earn rewards | Worlds, Network, Market | P10 |
| 1.9 | Participate in communities | Community | P12 |
| 1.10 | Withdraw | Hub · Send | P6, P7 |
| 1.11 | Build integrations | Developer Platform | P11 |
| 1.12 | Return | Notifications, Hub | P13 |

---

## 1.1 Register

**Surface.** `identity`'s server-rendered `/register`, reached from `site` or from any product's
sign-in prompt with a `return_to`.

| # | Call | Service | Effect |
| --- | --- | --- | --- |
| 1 | `POST /auth/register` | `identity` | Creates `user`, a `personal` `organisation` with the user as sole `owner` ([04](04-domain-model.md) §1.5), and a `profile` row |
| 2 | — | `identity` → `policy` | `identity.register` decision; `deny` on a blocked IP range or a burned disposable domain |
| 3 | `POST /auth/exchange` | `identity` | 60-second, single-use, origin-bound handoff code, redeemed by conditional `UPDATE … RETURNING` (`nimbus/src/exchange.ts`, kept unchanged — AD-18) |
| 4 | Redirect | `hub-web` | Redeems the code, receives an RS256 access token with `aud=cloudsforge` |

**Events.** `identity.user.registered` ⇢ activity, analytics, notify. `identity.session.created`
⇢ notify (new-device mail), policy (device risk).

**What the user sees.** Email/handle/password, then Forge Hub with an empty portfolio, a
provisioned-wallet prompt, and a verification banner. Not a launcher grid — today
`nimbus/src/routes/portal.ts`'s `/account` renders two initials and a hardcoded grid, and that
page is retired in P6.

**Failures.**

| Cause | Result | User sees |
| --- | --- | --- |
| Handle taken | 409 | Inline field error, form state preserved |
| `policy` unreachable | Fail-open with alert — registration is not in the fail-closed set (AD-09) | Nothing |
| Exchange code redeemed twice | 400, single-use enforced by the conditional update | "This sign-in link has been used. Sign in again." |
| `hub-api` down | Hub renders shell + per-tile error | "Your dashboard is having trouble. Your account is fine." |

**Phase.** P6 (P3 extracts `identity`; registration itself works today).

---

## 1.2 Create or connect wallets

**Surface.** Hub · Wallet.

| # | Call | Service | Effect |
| --- | --- | --- | --- |
| 1 | `POST /wallets` `{chain, network}` | `wallet` | Inserts a `wallet` row, `origin=managed`, `status=provisioning` |
| 2 | `wallet → custody` | `custody` | HD derive at `m/44'/<coin>'/<account>'/0/<index>` from the per-(user, family) BIP-39 seed. Replaces today's flat random key per address ([00](00-current-state.md) §4) |
| 3 | `wallet → policy` | `policy` | `wallet.create` — velocity only |
| 4 | `POST /wallets/:id/deposit-address` | `wallet` | Writes a `deposit_address_assignment`, so rotation is a new row, never a mutated address |

**Events.** `wallet.created` ⇢ activity, hub-api, indexer (register the address for watching).

**What the user sees.** A wallet list with label, chain, network badge, primary flag and
lifecycle state. `mainnet` and `testnet` are separate rows and never inferred — the XRP
testnet/mainnet address collision in `forge-keyvault/src/chains.ts:141` is exactly what that
rule prevents.

**Failures.** Custody down (single replica, permanently — AD-18): `wallet` returns 503, the row
stays `provisioning`, a leased `wallet.provision` job retries, and the UI shows "Provisioning —
usually under a minute" rather than an error. Custody's unavailability is on the status page as
a degraded Wallet group, not an outage.

**Phase.** P5 (HD derivation), P6 (the registry and the UI).

---

## 1.3 Fund the account

**Surface.** Hub · Receive.

| # | Actor | Call / action | Effect |
| --- | --- | --- | --- |
| 1 | user | Selects asset + network | `GET /wallets/:id/receive` returns address, QR, `confirmation_policy` |
| 2 | user | Sends from an exchange or their own node | — |
| 3 | `indexer` | EVM/Ember/Solana/Bitcoin/XRP worker ingests the block | Writes `block`, `transaction`, `address_activity` with a **real** `tx_hash` |
| 4 | `indexer` | ⇢ `indexer.address.activity` | `first_seen_at` set; `confirmations` counts up |
| 5 | `wallet` | Consumes it, checks depth against `contracts-chain` | EMBER 60, ETH 12, BTC 1, SOL 1, XRP 1 (`shared-libs/packages/shared/src/deposits.ts:102-146`) |
| 6 | `wallet → ledger` | `POST /entries` `kind=deposit_credited`, idempotency key `(address, tx_hash)` | Debit `custody:<chain>:<network>` asset, credit `user:<id>` liability |
| 7 | `settlement` | Leased `chain.sweep`, key `chain:network` | Sweeps to the pinned treasury; `custody`'s purpose gate permits exactly one shape to exactly one destination (`forge-keyvault/src/signing.ts`) |

**Events.** `wallet.deposit.detected`, `wallet.deposit.confirmed` ⇢ activity, notify, hub-api.
`ledger.entry.posted` ⇢ activity, analytics.

**What the user sees.** A pending row the moment the transaction is in the mempool, an ordinal
confirmation meter (`4/60`, with an ETA — [02](02-target-architecture.md) §6.3), an explorer
link, then a credited balance and a push/email notification. Today there is no explorer link on
a deposit at all, because txids are synthetic (`depositPaymentTxid(coin, address, basis, total)`).

**Failures.** RPC provider down → indexer fails over, `beacon` records a chain-health incident,
the meter says "chain data delayed" rather than stalling silently. Reorg → journey 17. Deposit
below the per-user cap on a young chain → credited but flagged; above → held for review with a
policy reason code the user can read.

**Phase.** P5 (indexer), P6 (UI), P7 (all five chains complete).

---

## 1.4 Hold assets

**Surface.** Hub · Dashboard and Portfolio. One `GET /dashboard` to `hub-api`, which fans out to
`ledger` (balances), `wallet` (wallets and pending), `pricing` (valuation), `indexer`
(in-flight), `trade`, `mint`, `market`, `worlds`, `activity` and `notify`. Every upstream call is
deadline-bounded and circuit-broken; a tile that cannot load says so and the page still paints
(journey 19).

**What the user sees.** One total in a display currency with a **"priced at" timestamp** — a
portfolio figure without one is a stale oracle rendered as a fact. Allocation as a sorted
horizontal bar, not a pie. Value over 24h/7d/30d/1y as a single-series area chart.

**Invariant behind it.** The number comes from `ledger`'s `balances` projection, rebuildable from
the journal by replay and compared nightly against a shadow rebuild
([04](04-domain-model.md) §2.3). Today `wallets.shards` *is* the truth and nothing can check it.

**Phase.** P4 (ledger), P6 (Hub).

---

## 1.5 Create assets

**Surface.** Forge Create (`mint-web`), the ten-step launch flow.

| Step | Service | Note |
| --- | --- | --- |
| Brand kit | `studio` | Asynchronous, job-leased generation; every asset records model, prompt, spec and cost |
| Configure token | `mint` | Name, symbol, decimals, supply, `mintable/burnable/pausable` |
| Choose owner wallet | `wallet` | A `managed` or verified `external` wallet — the customer owns the contract, already true in `forge-mint/src/routes/tokens.ts` `POST /tokens/:id/owner` |
| Pay | `billing → ledger` | `kind=purchase`, idempotency key on the order |
| Provision deployer | `mint → custody` | `POST /addresses` with `purpose=deployer` |
| Deploy | `mint → custody` `POST /sign` → chain | **202 + status URL.** Today `POST /tokens/:id/deploy` holds the request for up to 180 s and is killed by the 10-second SIGTERM force-exit |
| Confirm | `indexer` ⇢ `mint.deploy.confirmed` | Replaces the client polling `GET /tokens/:id/status` every 4 seconds |
| Project page | `mint`, rendered by `market` | Supply, authorities, contract address read from the **indexer**, never from the order record |

**Failures.** Deployer funded but the deploy transaction is lost: `settlement`'s outbound state
machine (`planned → building → signed → broadcast → confirmed`, [04](04-domain-model.md) §4.4)
resumes from `signed`, because the signed raw transaction is committed before broadcast. Payment
taken and deploy permanently failed: a `reversal` entry, not an edit — refunds exist from P7.

**Phase.** P8.

---

## 1.6 Use assets

Two concrete uses, both of which turn an asset into something the ledger can see.

- **Forge Worlds.** A cosmetic or a season pass grants a `billing.entitlement.granted` event;
  `worlds` consumes it and writes an `inventory_item` with `bound=false` for cosmetics and
  `bound=true` for anything conferring power. This event is what finally provisions the private
  world that Pay has been selling and nothing has ever built
  (`forge-pay/routes/monetization.ts:100-138`; `grep -r private_world ninety-days-after` returns
  zero).
- **Forge Trade.** Capital allocated to a bot becomes a **ledger reservation** — a posting from
  the user's `available` account to `reserved` — rather than a convention held in the bot row.

**Phase.** P10.

## 1.7 Trade or sell assets

Forge Trade settles fills against `pricing`'s median oracle on coins already custodied; that is
the stated boundary, and CloudsForge is not an exchange
([01](01-product-vision.md) §6). Forge Market is the sell path — journey 8.

## 1.8 Earn rewards

Mining EMBER on Hearth, world objectives, marketplace sales and creator payouts all land as
ledger postings with `kind=reward_granted`, `market_settled` or `creator_payout`. Every reward is
budgeted and rate-limited, because a game exploit that mints rewards is a money incident. Today
the game awards `tokens` that are spendable on nothing.

## 1.9 – 1.11 Communities, withdrawal, integrations

Each is walked in full below: participate in communities is journey 11, withdraw assets is
journey 4, build integrations is journey 12.

## 1.12 Return

`notify` delivers a deposit confirmation, a bot settlement, a governance vote opening or an
outbid notice on the channels the user chose, honouring `preference.digest`. Critical security
notifications — new device, password change, MFA change, key export, withdrawal — ignore
preferences entirely ([04](04-domain-model.md) §10.3). Each links to a Hub deep link that
survives the sign-in round trip.

---

# Part 2 — Secondary journeys

## Journey 2 — Returning user

Refresh token presented → `identity` validates the family, detects reuse (10-second concurrent-tab
grace, already implemented) → new access token → Hub dashboard. If the refresh family was
revoked by "sign out everywhere", the user is sent to `/login` with the return URL preserved,
and `identity.session.created` fires on the new sign-in, producing a new-device notification if
the `device.fingerprint_hash` is unseen. **P6.**

## Journey 3 — First deposit

The step-1.3 machinery, with three first-time additions: the receive screen explains the
difference between a managed wallet and a deposit address *in the UI* rather than in
documentation; the first confirmed deposit emits `wallet.deposit.confirmed` which `analytics`
records as the funnel's key conversion; and `policy` applies a lower first-deposit cap that
lifts after the first reconciliation cycle covering that address. **P6, P7.**

## Journey 4 — First withdrawal

| # | Actor | Call | Effect |
| --- | --- | --- | --- |
| 1 | user | Hub · Send: asset, network, destination, amount | Address validated per family; untrusted-destination warning |
| 2 | `wallet → policy` | `wallet.withdraw` | **Fail-closed** above the threshold (AD-09). May return `challenge` (MFA) or `review` |
| 3 | `wallet → pricing` | Fee quote | Fee shown before confirmation, never after |
| 4 | user | Confirms | — |
| 5 | `wallet → ledger` | `kind=withdrawal_requested` | Posting `available → reserved`. Today a withdrawal debits immediately and a refund credits back, with `delta: 0` breadcrumb rows |
| 6 | `wallet ⇢ settlement` | `wallet.withdrawal.requested` | — |
| 7 | `settlement` | Leased `chain.withdraw`, **key `chain:network`** | The lease is the fix for the lost-payment race: two workers signing against one nonce today loses a payment permanently ([00](00-current-state.md) §3.1) |
| 8 | `settlement → custody` | `POST /sign` | Purpose gate → binding check → chain-id → treasury pin |
| 9 | `settlement` | Commit `raw_tx`, then broadcast | Order preserved from the current withdrawer, deliberately |
| 10 | `indexer` | Confirms | ⇢ `settlement.withdrawal.completed` |
| 11 | `ledger` | `kind=withdrawal_settled` | `reserved → custody` |

**What the user sees.** A single transaction detail view walking `requested → signed → broadcast
→ confirmed`, with the real txid and an explorer link, plus a safe retry that cannot double-send
because the outbound row is unique per `(chain, network, from_address)` in flight.

**Failures.** Policy `deny` → journey 20. Stuck → journeys 13 and 18. **P6, P7.**

## Journey 5 — Key export (AD-13), the full ceremony

The most security-sensitive flow in the programme. It is a **state transition, not a read.**

| Stage | Gate | Service | Failure behaviour |
| --- | --- | --- | --- |
| 0 | User opens Wallet → Advanced → Export key | `hub-web` | Copy assumes a user under pressure: what `exported` means, that it is irreversible |
| 1 | Re-authenticate with password | `identity` | 3 failures → 15-minute lockout on the action, not the account |
| 2 | MFA challenge | `identity` | No factor enrolled → export is unavailable; enrol first |
| 3 | `custody.key.export` decision | `policy` | **Fail-closed.** `deny` on an account frozen, on a device first seen under 24h ago, or on a velocity breach |
| 4 | `export_request` created, `status=cooling_off` | `custody` | ⇢ `custody.key.export.requested` |
| 5 | **24-hour cooling-off** | `notify` | Sent on **every channel the user has**, each carrying a one-click cancel link. Cancelling is one call, needs no MFA, and is always available |
| 6 | Redemption window opens | `custody` | A window, not a moment: expires if unredeemed, and expiry is itself notified |
| 7 | Second MFA challenge | `identity` | — |
| 8 | Single-use, short-TTL, origin-bound reveal token | `custody` | Same shape as the SSO handoff code, which is already race-safe |
| 9 | Secret delivered once, decrypted client-side | `hub-web` | Never logged, never in a cacheable response body |
| 10 | `wallet.status: active → exported` | `wallet` | ⇢ `custody.key.exported` → notify, policy, admin-api, activity |

**Post-conditions.** The wallet stops receiving deposit sweeps into treasury; every UI marks it
self-custodied; the user may retire it entirely. The export appears in the user's own security
log, in the activity feed and in the operator audit trail.

**What this replaces.** `POST /admin/keys/:address/reveal`
(`forge-keyvault/src/routes/admin.ts:123`), which returns **any** private key in plaintext to
**any** admin JWT with one audit row as the entire mitigation. It is deleted in P5, and the
break-glass runbook — two operators, a signed incident record, a hardware-token challenge each,
an alert to every admin — ships and is rehearsed in the same release.

**Ceremony shipped P6; the primitive built P5.**

## Journey 6 — Connecting an external wallet

`POST /wallets/external` → `wallet` issues a `challenge_nonce` → the user signs it in MetaMask,
Phantom, a Bitcoin signer or an XRP client → `POST /wallets/external/:id/verify` → `wallet`
checks the signature per scheme (`eip4361`, `solana_signmessage`, `bip322`, `xrp_signed_memo`) →
`verified_at` set → the user grants `authorisations[]` individually from the closed set
(`withdrawal_destination`, `token_owner`, `community_membership`, `governance_vote`,
`market_settlement`). An unverified address is `watch` origin and may contribute to portfolio
display only. Hearth's browser wallet (`hearth/web/wallet.html`, PBKDF2 600k + AES-256-GCM in
localStorage) is absorbed here rather than left as a second unrelated wallet. **P6.**

## Journey 7 — Creating and launching a token

Step 1.5, extended to the ten launch steps: generate branding → configure → review ownership and
authorities → deploy testnet → validate → deploy mainnet (allowlisted until the fee path and
refunds are proven) → token page → publish to Market → create a community → integrate. Mainnet
is closed by default today and stays so. **P8.**

## Journey 8 — Listing and selling on the marketplace

| # | Step | Service | Note |
| --- | --- | --- | --- |
| 1 | Create listing | `market` | `settlement_mode` chosen by asset class (AD-14) |
| 2 | Reserve | `market → ledger` | `available → reserved`. **A listing that cannot reserve cannot be listed** — this is what makes "sold twice" impossible |
| 3 | Buyer purchases | `market → ledger` | One journal entry: buyer debit, escrow, seller credit, platform fee, royalty — all postings in the same entry |
| 4 | Settle | `market` | Custodial: instant. On-chain: escrow contract, confirmed by `indexer` |
| 5 | Deliver | ⇢ `market.listing.sold` | `worlds` grants inventory, `billing` grants an entitlement, `notify` tells both parties |

**Concurrency.** Two buyers, one listing: exactly one order. The reservation is the lock.
`bound` items cannot be listed at all — the anti-pay-to-win rule as a schema constraint. **P9.**

## Journey 9 — Running a live trading bot

Configure strategy → `trade` reserves allocated capital in `ledger` → the leased `bot.tick` job
(key `bot_id`) evaluates and fills against `pricing` → fills post as `kind=trading_fill` → the
leased `bot.settle` job (key `bot_id:period`) charges the high-water-mark performance fee with a
**deterministic** settlement id.

Today that id is `randomUUID()`, `fee_settlements` has no unique constraint, and the hourly sweep
races `POST /bots/:id/actions {stop}` — so Pay correctly honours two different idempotency keys
and the user is double-billed. Fixed in P1, before any code moves. **P1, P10.**

## Journey 10 — Joining a game and earning a reward

`GET /worlds` → `POST /worlds/:id/join` → `assignHomestead` claims a tile with
`WHERE owner_id IS NULL` (added in P1; today two concurrent joins land two players on one tile) →
the leased `world.tick` job (key `world_id`) resolves the day deterministically from a seed keyed
on `(world, day)` → objectives complete → `worlds.reward.granted` ⇢ `ledger` posts
`kind=reward_granted` against a capped reward budget → the reward appears in the Hub portfolio
and is spendable in Market. **P10.**

## Journey 11 — Founding a community and passing a proposal

Create community with `kind=token_gated` and `join_policy=token_holding` → `community` opens
treasury accounts under subject `community:<id>` in `ledger` → members join, holdings verified
via `indexer` and **re-evaluated on a schedule** with a grace period, because membership never
re-checked is not token-gating → a `treasury_spend` proposal opens with a `snapshot_block`,
quorum and threshold → voting (`token_weighted` here; `reputation_weighted` for game communes;
`one_member_one_vote` for creator communities) → `passed → timelocked → executed` → execution is
one idempotent ledger posting, unique per `execution_id`.

Platform governance is deliberately not tokenised. A platform holding customer money does not put
custody policy to a vote. **P12.**

## Journey 12 — A developer integrating via API keys

Register → create a developer organisation and project in `devplatform` → generate a scoped API
key (hashed at rest, shown once) → call `api.cloudsforge.online/v1` in the sandbox with resettable
state and testnet wallets → register a webhook endpoint, which is delivered by `notify`'s pipeline
with the same retry policy, signing and dead-letter view as every other channel (AD-08) → inspect
deliveries and retries in the console → rotate the key, old key revocable in one action with its
usage history retained → promote to production, rate-limited per key at the gateway, usage metered
into `billing`.

`api.cloudsforge.online` currently points at the **game** API and is renamed to `worlds-api.`
before anything depends on it. **P11.**

---

# Part 3 — Operator journeys

## Journey 13 — Investigating a stuck withdrawal

1. Alert fires: **stuck withdrawal count ≥ 1** pages, from the Deposits & Withdrawals dashboard.
2. Operator opens `admin-web` → Withdrawals, filtered `state=broadcast`, sorted by age.
3. The row carries a `correlation_id`. One search in `admin-api` returns every audit event across
   `wallet`, `policy`, `ledger`, `settlement` and `custody` for that id; the same id is the
   `traceparent`, so Grafana shows the trace and Loki the logs on the same key.
4. Diagnosis is one of: gas priced too low, nonce gap, RPC rejecting, or a chain halt. Chain
   Health names which.
5. Remedy: bump-fee rebroadcast (a new outbound row referencing the same request), or **abandon
   adjudication** — which refunds by posting a `withdrawal_refunded` entry, reversing the
   reservation.
6. Abandon requires a reason code and **dual approval**, and produces an audit event, not a log
   line.

Today the equivalent is `POST /admin/withdrawals/:id/abandon`
(`forge-pay/src/routes/admin.ts:730`) reachable only by curl through Nimbus's proxy — there is no
UI for it. **P7.**

## Journey 14 — Responding to a reconciliation drift alert

1. `ledger`'s reconciliation job compares, per asset per chain: Σ user liability accounts = Σ
   custody asset accounts = indexer-observed on-chain holdings, within a per-chain tolerance set
   from measured data during an observe-only period, not guessed.
2. `drift_exceeded` **automatically freezes withdrawals for that asset only** and pages. One
   operator cannot override the freeze.
3. The operator reads the `reconciliation_run` row: which side moved, and by how much.
4. Three shapes: an in-flight fee not yet posted (benign, tolerance is wrong), an indexer gap
   (chain-side), or a genuine ledger/chain divergence (P0 incident).
5. Correction is a `reconciliation_correction` entry with a reason code and dual approval. Never
   an update to a posting — postings are `INSERT`-only at the database-role level.

`convertCoinToEmber` crediting custodial EMBER with no on-chain movement
(`forge-pay/src/store.ts`) is precisely the class of bug this catches. It is disabled in P1 and
re-enabled in P7 behind a real reserve check. **P7.**

## Journey 15 — Moderating a fraudulent listing

Report arrives from a user or from suspicious-listing detection → a `moderation_case` opens with
an SLA → the moderator sees the listing beside **computed** risk indicators (mint authority
present, ownership renounced or not, supply concentration, contract age, whether the deployer
wallet is `exported`) shown as facts, never as an editorial score → takedown sets the listing
`cancelled` and **releases the ledger reservation** → if a sale already settled custodially and
is inside the dispute window, a reversal entry returns the funds → `market.listing.removed` ⇢
notify, activity → the seller is told what happened and how to appeal. **P9.**

## Journey 16 — A support request about a balance

A user writes: "my balance is wrong". The agent, in `admin-web`, with an audit record and a
reason code on every read:

| Question | Where it is answered |
| --- | --- |
| What does the user hold? | `ledger` balances projection |
| How did it get there? | The journal, filtered by subject, in entry order |
| Which service caused each entry? | `originating_service` on every entry — answerable for the first time |
| Did a deposit land? | `indexer` `address_activity`, with a real txid |
| Was anything denied? | `policy_decision`, retained for the dispute window: "why was I blocked" must be answerable months later |

`analytics` is deliberately useless here — it holds `HMAC(user_id, pepper)` and bucketed amounts
and cannot identify a named user (AD-21). That is the boundary working, not a gap. **P13.**

---

# Part 4 — Failure journeys

These matter as much as the happy paths, and each has a Beacon journey or an injected-fault test.

## Journey 17 — A deposit that reorgs out

1. `indexer` credits at depth; the block is later orphaned. `block.status: included → orphaned`,
   `address_activity.reorged_at` set.
2. ⇢ `indexer.reorg.detected` carrying the depth. Past `reorg_alarm_depth` this pages, and on a
   young CPU-mined chain a reorg past ~5 blocks halts crediting for that chain outright.
3. If the deposit was **not yet credited**: the pending row disappears from Hub with an explicit
   "this transaction was reorganised out of the chain" note. No money moved.
4. If it **was credited**: `ledger` posts a `reversal` referencing the original entry. The
   balance goes down. The user gets a notification that names the transaction hash and explains
   it in plain language.
5. If the balance was already spent, the liability account would go negative — which the ledger
   refuses. The entry lands in `suspense` (the only account type with `overdraft_allowed`), and
   an operator adjudicates.

**Tested by** a simulated reorg past the confirmation depth, a P5 exit criterion. **P5, P7.**

## Journey 18 — A withdrawal that gets stuck

User-facing half of journey 13. The transaction detail view says `broadcast — not confirmed after
N minutes`, offers **safe retry** (which cannot double-send: one in-flight outbound per
`(chain, network, from_address)`), shows the explorer link so the user can verify independently,
and states that support has been notified automatically — because the stuck count is an alert,
not something a user has to report. Today a stuck withdrawal has no user-visible state beyond
`pending` and no self-service action. **P6, P7.**

## Journey 19 — A service is down during the dashboard load

`hub-api` fans out to ten services. Each call has a deadline and a circuit breaker; an open
breaker returns immediately rather than burning the deadline.

| Upstream down | Dashboard behaviour |
| --- | --- |
| `ledger` | Portfolio tile: "Balances unavailable". Everything else renders. No zero is ever displayed — a zero and an unknown must not look identical |
| `pricing` | Balances render in native units with "valuation unavailable" |
| `indexer` | Pending-deposit tile degrades; confirmed balances unaffected |
| `trade` / `market` / `worlds` | That product's tile only |
| `activity` | Feed panel hidden; activity is additive by design |
| `custody` | New wallets queue; existing wallets and balances fine; withdrawals queue |

**A tile that cannot load says so.** An empty chart and a broken chart must not look the same.
This is a P6 exit criterion with an explicit test: render the dashboard with each upstream
individually down. **P6.**

## Journey 20 — A policy denial

The user attempts a withdrawal to a new address for an amount above their velocity limit.
`policy` returns `deny` with `reasons[]` and a `policy_decision` record.

The user sees the reason in plain language, the limit, when it resets, and a route to raise it
(identity verification, or adding the address to trusted with its own cooling-off). Never a bare
403. A `challenge` decision instead prompts MFA inline and continues. A `review` decision queues
an operator approval and tells the user the expected turnaround.

The decision is retained, so the same explanation is available months later during a dispute.
**P5, P13.**

## Journey 21 — MFA lockout

Phone lost, TOTP gone.

1. Recovery codes, issued at enrolment and shown once, are the primary path. One code, one use.
2. No codes: `POST /auth/password/forgot` proves email control, but **email alone does not clear
   MFA** — that would make MFA decorative.
3. The account-recovery flow opens a `policy` `review` with a mandatory waiting period, notified
   on every channel including any the attacker cannot control, with a cancel link. Same shape as
   the export ceremony, and for the same reason.
4. On completion, all sessions are revoked, all factors reset, and a `critical` notification is
   sent that ignores preferences.
5. If the account holds above a configurable value, recovery additionally requires an operator
   with dual approval and produces an audit event.

Removing the last active factor never happens in one operation and always produces a
notification ([04](04-domain-model.md) §1.3). **P6, P13.**

---

# Part 5 — The eleven tests, and the step that proves each

From [01-product-vision.md](01-product-vision.md) §2. A test is proven by a **journey step that
can be run**, not by an assertion in a document. Each row names the Beacon journey that gates it.

| # | Test | Proven by | Beacon journey | Phase |
| --- | --- | --- | --- | --- |
| 1 | One account signs into everything, once | 1.1 step 3–4: one handoff code redeemed by Hub, then the same access token accepted by `mint`, `trade`, `worlds` with no second sign-in | `identity.handoff` (exists) | Already true |
| 2 | One identity everywhere | 1.1 step 1: `profile` created at registration and rendered by Market, Worlds and Community — today the only renderable identity is a handle | `identity.profile` (new, P6) | P6 |
| 3 | One wallet experience | 1.2 and journey 6: the same receive, send and key screens whether the user arrived from Worlds, Trade or Create; the game's wallet pages and Hearth's browser wallet both retire into Hub | `hub.wallet` (new, P6) | P6 |
| 4 | One portfolio | 1.4: one `GET /dashboard`, one total, sourced from `ledger`'s projection and reconciled against the chain | `hub.portfolio` (new, P6) | P6 |
| 5 | One activity history | 1.12 and 6g: `activity` consumes every domain topic; the P6 exit criterion is a feed showing events from **at least six different services** | `hub.activity` (new, P6) | P6 |
| 6 | One internal economy | 1.8 → journey 8: a reward earned in a world is spent in Market, both as ledger postings in the same journal | `cross.reward-to-market` (new, P10) | P10 |
| 7 | Assets created in one product usable in others | 1.5 → 1.6: a Studio brand kit becomes game content and a Market listing; a minted token gates a community | `cross.studio-to-worlds` (new, P10) | P10 |
| 8 | One set of notifications, one preference page | 1.12: `notify` owns preferences per category and channel; critical security events ignore them | `notify.preferences` (new, P6 stub, P13 full) | P6, P13 |
| 9 | One operator view | Journey 16: a support agent answers a balance question from `admin-web` alone, by `correlation_id`, without touching a database | `admin.support-lookup` (new, P13) | P13 |
| 10 | One financial source of truth that reconciles | Journey 14: trial balance exactly zero, continuously, plus a reconciliation run per asset per chain against indexer-observed holdings | `money.trial-balance`, `money.reconciliation` (new, P4/P7) | P7 |
| 11 | A third party can build on all of it | Journey 12: a third party builds a working integration against the sandbox using only public documentation | `dev.sandbox-integration` (new, P11) | P11 |

**How the journey set grows.** *(Dated. The count below is the **legacy** Beacon's and it
reproduces exactly; `micro-beacon` ships six, and states at `beacon/src/estate.ts:5-22` why it
declines to declare the rest. The browser-level successor to the six `web.*` page checks is
specified in [22-browser-journeys.md](22-browser-journeys.md).)* 24 journeys exist today in
`infra/beacon/src/journeys/` —
three `identity.*`, four `pay.*`, one `mint.*`, two `crucible.*`, three `game.*`, three
`chain.*`, two `platform.*` and six `web.*` page checks. P0 takes them to ~45 by covering every
money route and the full deposit → convert → spend → withdraw loop on testnet. Every phase after
that adds the journeys named above, and **the phase does not exit until they are green three
runs consecutively.**

They are already consumer-driven contract tests that skip rather than fail on a missing secret,
which is why they can be the release gate (AD-04) rather than a report nobody reads.
