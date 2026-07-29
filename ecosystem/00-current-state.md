# 00 — Current state

The baseline. Everything in this document was verified against source in July 2026 by
per-repository inspection, not read from documentation. Where a repository's own `MAP.md`
disagrees with its code, the code is recorded here and the drift is noted, because several
of those documents are now materially wrong and a plan built on them would be a plan for a
system that does not exist.

Read this before any other document in `docs/ecosystem/`. Every decision in
[02-target-architecture.md](02-target-architecture.md) is a response to something recorded here.

---

## 1. The estate in one page

Eleven repositories. Nine hold product code, one (`stack`) composes them and carries two
real services in `infra/`, one (`.github`) is empty of code.

| Repo | Deployables | Language | Purpose | Honest status |
| --- | --- | --- | --- | --- |
| `platform` | 3 — nimbus, site, admin | TS / Fastify 5 + React 19 | Identity (Nimbus), marketing site, operator console | Auth is solid. No MFA, no sessions, no orgs. |
| `forge-pay` | 1 — pay | TS / Fastify 5 | Shards, custodial coin balances, deposits, withdrawals, conversions, price oracle, entitlements, game shop | Works. **Not double-entry.** Custodial EMBER can be minted with no chain movement. |
| `forge-keyvault` | 1 — keyvault | TS / Fastify 5 | Custody: key generation, encryption, signing policy, treasury pinning | Correct signing policy. Root + Docker socket. Master secret unrotatable. |
| `forge-mint` | 1 — forge-mint (API + SPA) | TS / Fastify 5 + React 19 | ERC-20 deployment on 5 EVM chains | Deploys real contracts. Solana suspended. Mainnet closed by default. |
| `crucible` | 1 — crucible (API + SPA) | TS / Fastify 5 + React 19 | Backtesting, 10 strategies, paper + live bots, HWM performance fee | Engine complete. Live path off by default. 1 test file. |
| `ninety-days-after` | 2 — game, game-client | TS / Fastify 5 + React 19 | Asynchronous multiplayer survival simulation | Deep simulation, playable. **No game-platform abstraction at all.** |
| `hearth` | 3 + node + contracts + rust + desktop | JS (zero-dep) / React / vanilla | EMBER chain: PoW node, self-written EVM, explorer, wallet, site, faucet | Testnet in compose only. Mainnet not launched. Nothing published. |
| `asset-forge` | 0 | TS CLI | AI asset generation, 59 assets across 2 tracks | A build-time CLI in the product repo list by accident. Never deployed. |
| `shared-libs` | 0 | TS packages | `@cloudsforge/shared`, `@cloudsforge/ui` | 0.5.0/0.6.0 committed, **unpublished**; every consumer pins ^0.4.0/^0.5.0. |
| `stack` | 2 — lantern, beacon | JS (zero-framework) | Compose, routing, docs, ops console, status/journeys | Lantern and Beacon are real services living in a deployment repo. |
| `.github` | 0 | — | Org profile | Does not exist yet. |

Eighteen containers, one host, one `docker-compose.yml` of 36 KB. `cv-web` serves a personal
site (`savvanis.life`) from the company stack.

---

## 2. What is already right, and must not be rebuilt

This list is short and load-bearing. Several proposals in earlier planning documents were
wrong because they did not read it.

- **One account, genuinely.** One `users` table with no product column. RS256 tokens, single
  audience `cloudsforge`, JWKS at a well-known path, verified independently by six services.
  `platform/services/nimbus/src/db/schema.ts`, `tokens.ts`.
- **SSO handoff that is not an open redirect.** 60-second, single-use, origin-bound code,
  hashed at rest, redeemed by a conditional `UPDATE … RETURNING` so a race cannot redeem it
  twice; return URLs allowlisted. `nimbus/src/exchange.ts`.
- **Refresh-token family reuse detection** with a 10-second concurrent-tab grace window.
- **Signing-key rotation exists** — `active | published | retired` with a 20-minute publish
  window, private JWK encrypted with AES-256-GCM under a scrypt-derived key. (`MAP.md` in
  `platform` still claims there is one key and no rotation. It is wrong.)
- **Database per service, honoured.** Nine logical databases and no service reads another's
  tables — verified by grep across all nine repos. Every cross-service read is HTTP. This is
  the single most expensive property to retrofit and it is already true.
- **Real idempotency in the money path.** `withIdempotency`
  (`forge-pay/services/pay/src/store.ts:153`) stores a request hash and the response body,
  claims the key in the same transaction as the work, and replays stored JSON on a duplicate.
  A different body under the same key is a 409. This is better than most production payment
  code and its shape should be copied, not replaced.
- **A general billing primitive.** `/internal/charge`, `/credit`, `/trade`,
  `/wallet/:userId` already let any peer service bill any user with a mandatory idempotency
  key. Built for Crucible, Crucible-specific in nothing.
- **A signing policy that binds, not a signing oracle.** ForgeKeyvault's `/sign` gates on
  purpose → binding (5 fields vs the stored row) → chain-id resolution → treasury pin, and
  only then decrypts. A `deposit`-purpose key can sign exactly one shape (`sweep`) to exactly
  one destination (the pinned treasury). `forge-keyvault/src/signing.ts`.
- **Deterministic simulation.** The game replays a world identically from a seed keyed on
  `(world, day)`. `ninety-days-after/services/game/src/engine/resolve.ts`.
- **A conformance-tested EVM.** Hearth's self-written EVM passes VMTests 609/609,
  GeneralStateTests 20,077/20,077, TransactionTests 188/188.
- **Beacon's journeys are already consumer-driven contract tests** — 24 multi-step functional
  scenarios that skip rather than fail on missing secrets. This is the regression harness the
  migration needs, and it already exists.

---

## 3. What is actually wrong

### 3.1 The system is a distributed monolith with good hygiene

Correctly separated at the data layer, and structurally incapable of running more than one
copy of anything. Not "slow with two copies" — *incorrect* with two copies, in ways that lose
money.

> **Correction.** The deleted `MICROSERVICES.md` claimed `grep -rn "pg_advisory\|SKIP LOCKED"`
> returned no matches anywhere in the estate. **That is no longer true**, and the plan inherited
> the claim without re-checking it. Nimbus now uses `pg_advisory_xact_lock` in two places:
>
> - `platform/services/nimbus/src/tokens.ts:230,324` — serialising refresh-token family
>   operations, which is what makes reuse detection correct under concurrency.
> - `platform/services/nimbus/src/db/migrate.ts:188-194` — a migration lock, with a source
>   comment explaining the choice of the transaction-scoped form over the session form because
>   it is released automatically.
>
> So one service in the estate has already solved the migration race, and solved it well. The
> generalisation still holds for the other five, and the *shape* of the problem is unchanged —
> but "no coordination primitives anywhere" was an overstatement, and Nimbus deserves the credit.

**Nine** `setInterval` timers do real work across three services, each guarded only by a
module-local boolean — a variable that is by construction invisible to a second process. (The
earlier count of eight predates `forge-pay/src/opswatch.ts:207`.)

| Service | Timer | What two replicas do |
| --- | --- | --- |
| pay | withdrawal worker | **Two withdrawals on one chain signed concurrently against the same nonce/sequence — one payment permanently lost** |
| pay | treasury sweeper | `signingBlocked` latch is per-process |
| pay | deposit watcher | Safe — address row `FOR UPDATE` + unique txid |
| pay | price oracle | Replicas quote different rates; an admin `PUT` updates one replica |
| pay | idempotency reaper | Harmless |
| crucible | bot tick | Bot state overwritten from a stale pre-trade snapshot |
| crucible | settlement sweep | **Double-billing** — `randomUUID()` settlement ids produce two different Pay idempotency keys |
| game | world tick | **Double XP and double `daysSurvived`** |

`hasUnsettledOutbound()` (`pay/src/store.ts:1162`) is an unlocked read, so two workers both
pass it. `markWithdrawalSigned` protects a single row; it does not protect the chain's nonce.

### 3.2 Money-losing defects live at one replica

> **Verification status, re-checked against source after the `audit.md` remediation.**
>
> A separate audit track (`audit.md`, 49 tickets; `upgrade.md`; `VERIFICATION.md`) closed 23
> tickets and verified 9 more as already fixed. That work is real and it corrected two claims
> that were in an earlier draft of this document — `assignHomestead` and ForgeMint's tier
> features are both fixed, and are struck through where they appear below and in §3.8.
>
> The items in this section came from a **different lens**: what breaks when a second replica
> runs, and where an idempotency key is missing. `audit.md` does not cover them —
> `grep -in "settlement|double-bill|spend.*idempot|private_world" audit.md` returns **zero
> hits**. Each item below was individually re-verified in current source, and the evidence is
> given inline so the next reader can check rather than trust.

| # | Defect | Status | Evidence in current source |
| --- | --- | --- | --- |
| 1 | **Crucible double-bills performance fees.** Settlement id is `randomUUID()`, so the Pay idempotency key differs per attempt and Pay correctly honours both. Races between the hourly sweep and `POST /bots/:id/actions {stop}`. | **LIVE** | `crucible/services/crucible/src/store.ts:452` still `randomUUID()`; no unique index on `fee_settlements (bot_id, period)` anywhere in `db/migrate.ts` |
| 2 | **`POST /spend` accepts a missing idempotency key** — the one money route that does. | **LIVE** | `forge-pay/services/pay/src/routes/wallet.ts:42` — `idempotencyKey: z.string().min(8).max(200).optional()` |
| 3 | **No idempotency key on any game shop purchase.** All four are called directly from the browser with none, and `rentPrivateWorld` is `ownOnce: false`, so a retry double-charges. | **LIVE** | zero matches for `idempotency` in `ninety-days-after/apps/game/src/pages/Shop.tsx` |
| 4 | **A purchased private world is never built.** Pay debits 1,800–2,500 Shards and writes the entitlement; nothing reads it. | **LIVE** | zero matches for `private_world` in `ninety-days-after/services/game/src/`; Pay still writes it at `forge-pay/.../routes/monetization.ts:109` |
| 5 | **Nimbus's two admin proxies have no request timeout.** A hung custody service pins the identity service indefinitely — a denial of service on authentication for the whole estate. | **LIVE** | bare `fetch` at `platform/services/nimbus/src/routes/vault.ts:68` and `routes/pay.ts:105`; zero timeout references in `vault.ts` |
| 6 | **Every container receives every secret.** | **LIVE** | `env_file` appears 10× in `docker-compose.yml` |
| 7 | **ForgeMint can mint a Solana token twice**, paying gas and rent both times. Masked, not fixed, by Solana being suspended. | **LIVE** | `deploySplToken` at `forge-mint/.../routes/tokens.ts:638` is called without the `onBroadcast` callback the EVM branch uses at `:633` |
| 8 | **`convertCoinToEmber` credits custodial EMBER with no on-chain movement and no reserve check**, and nothing reconciles custodial balances against custody holdings. | **LIVE** | `forge-pay/services/pay/src/store.ts:2511` |
| 9 | ~~`assignHomestead` lost update~~ | **FIXED** by the audit track | `ninety-days-after/.../world/generate.ts:101-107` claims conditionally via `isNull(tiles.ownerId)` and checks the returned row count. Still missing a **concurrency test**, so the guard can regress silently |
| 10 | ~~Ember signatures valid across networks~~ | **FIXED** by the audit track | `forge-keyvault/.../src/chains.ts:36-43` now resolves per-network EIP-155 chain ids (7411 mainnet, 7412 testnet); `bitcoinNetwork()` is checked against the WIF |

### 3.3 There is no ledger

`forge-pay`'s `ledger` table is single-sided: one `delta`, no account, no counter-account,
no journal grouping, no balancing invariant. Balances are materialised running columns.

- Coin movements on the deposit-credit path write **no ledger row at all**; the audit trail
  is `deposit_payments`.
- Withdrawal request, refund and convert-to-ember write `delta: 0` rows as breadcrumbs.
- There is **no reserved/available split** for user balances. A withdrawal debits immediately
  and a refund credits back.
- `ledger.source` exists but only `/internal/*` writes it. **Per-product revenue is not
  derivable today.**
- No reconciliation exists between Σ user balances and custody holdings, in any direction.

This is the single largest gap in the estate and it is the reason
[02-target-architecture.md](02-target-architecture.md) makes a dedicated ledger service the
first new service built.

### 3.4 There is no chain indexer

Deposit detection is **balance-probing, not transaction indexing**: every 30 seconds, load
*every* address row with no pagination, call `eth_getBalance` at `latest - confirmations`, and
compare against a high-water mark. Consequences:

- Synthetic txids (`depositPaymentTxid(coin, address, basis, total)`) — there is no real chain
  transaction hash on a deposit anywhere in the system.
- No transaction history, no token transfers, no contract-deployment events, no reorg
  detection, no finality model, no failed-transaction visibility.
- A regression in the observed balance freezes crediting for that address permanently until an
  operator records a manual sweep by curl. There is no UI for that route.
- Bitcoin and Solana can neither be withdrawn nor swept — no output policy exists for either.

### 3.5 Security posture

| Finding | Where | Consequence |
| --- | --- | --- |
| `env_file: .env` on eight services hands each container **all 64 variables** | `docker-compose.yml` | The game container holds `KEYVAULT_MASTER_SECRET`. Blast radius of any compromise is total. |
| One shared `PAY_SERVICE_TOKEN` grants read/debit/credit/liquidate on **every** user | `pay/src/routes/internal.ts` | No per-caller identity; Pay's audit cannot say which service charged. |
| One shared `KEYVAULT_SERVICE_TOKEN` grants the whole custody peer surface | `forge-keyvault/src/auth.ts` | Any of three containers holding it can mint a treasury, sweep every deposit to it, then drain it. Documented as a residual risk in source. |
| `POST /admin/keys/:address/reveal` returns **any** private key in plaintext to any admin JWT | `forge-keyvault/src/routes/admin.ts:123` | Total-exfiltration primitive. Mitigation is one audit row. No approval, no rate limit, no scoping. |
| ForgeKeyvault runs as **root** with `/var/run/docker.sock` mounted read-write | `Dockerfile:29-48` | Any RCE is host takeover and full custody loss. Deliberate and documented. |
| `KEYVAULT_MASTER_SECRET` **cannot be rotated** | `crypto.ts` — `CURRENT_VERSION = 1`, no v2 branch, no re-encryption pass | A compromise is unrecoverable without regenerating every address. |
| No MFA anywhere | `platform/services/nimbus` | No TOTP, no WebAuthn, no recovery codes. |
| No session or device records | Nimbus | No "sign out everywhere", no device list, no new-device alert. |
| Nimbus's two admin proxies use bare `fetch` with no timeout | `routes/vault.ts:61`, `routes/pay.ts:73` | A hung keyvault pins the SSO service indefinitely. |
| XRP has no network binding | `forge-keyvault/src/chains.ts:141` | Same seed and address on testnet and mainnet; a signed Payment is submittable on either. |
| Flat bridge network, plaintext HTTP, no segmentation | `docker-compose.yml` | Anything on the bridge reaches `forge-keyvault:4005` and `pay:4003/internal`. |
| No rate limiting in pay, keyvault or forge-mint | — | Including unauthenticated public routes. |

Two locks currently keep `/internal` off the internet: loopback binding in compose, and a
cloudflared path rule that returns 404 before the hostname rule. Both are asserted in CI,
because a previous configuration had `https://pay.<apex>/internal/charge` live on the public
internet with one guessed token as the only protection.

### 3.6 Operational immaturity

- **`/health` is a liveness probe used as a readiness gate.** Every service returns a static
  `{ok:true}` that never touches Postgres. A replica whose database is unreachable reports
  healthy and 503s every request. `depends_on: service_healthy` across the estate rests on
  this literal.
- **Migrations run in-process at boot, and no service records a schema version.** Six repos
  ship a hand-rolled `STEPS[]` of `CREATE TABLE IF NOT EXISTS` executed before `listen()`, with
  no version table, no down path and `process.exit(1)` on failure — verified: **0 of 6** have a
  `schema_migrations` table. *Corrected:* Nimbus **does** take an advisory lock
  (`db/migrate.ts:194`), so it alone survives two replicas booting together. The other five race
  on `pg_class`, one raises 23505 and crash-loops. Even for Nimbus, the absence of a version
  table means there is no way to know what schema a database is at, review a change, or roll one
  back.
- ~~**Nimbus has a split-brain signing key.**~~ **Fixed.** `keys.ts:212,255,345` now order by
  `(created_at, kid)` everywhere, and a source comment at `keys.ts:19-20` records that the
  active-key lookup and the JWKS publication "used to be the same one". The rotation state
  machine and the deterministic ordering both landed in the audit track.
- **Zero events, zero outbox, zero queue, zero circuit breakers.** Consistency between services
  is HTTP status codes plus hand-written caller-side compensation, reinvented per call site.
  *Corrected:* "zero retries anywhere" was an overstatement — Crucible's fee settlement
  (`services/crucible/src/fees.ts`) has a genuine, carefully-reasoned retry and compensation
  loop. It is hand-written and local to one file, which is the actual problem: the pattern is
  correct and is not available to anything else.
- **Long work runs inside the request.** ForgeMint awaits a chain deploy for up to 180 seconds
  inside the HTTP request; Crucible runs backtests synchronously inside the POST. Both are
  killed by the 10-second force-exit on SIGTERM.
- **Eighteen `container_name:` entries and fixed host ports** mean `deploy.replicas` is
  rejected outright. The compose file cannot express a second copy of anything.
- **Lantern collects by tailing the host Docker daemon**, so it survives neither a second host
  nor Kubernetes — and it is the tool you need most on the day you move.
- **Nothing backs itself up.** `infra/backup.sh` exists, is unscheduled, and writes locally.
- **A release is seven hand-pushed git tags.** `CLOUDSFORGE_TAG` is one value shared by
  fourteen images built by seven repositories; a commit sha cannot work, and a repo you forget
  has no image at that version.

### 3.7 Duplication and drift

| Thing | Copies | Note |
| --- | --- | --- |
| `services/*/src/obs.ts` | 5 byte-identical (375 lines) + 1 fork (428) | md5 `2fcb6c10…`. Meant to be hand-recopied. |
| `apps/*/src/lib/obs.tsx` | 6 byte-identical (261 lines) | md5 `13c5932c…`. |
| Nimbus JWKS auth middleware | 5 divergent implementations (54–93 lines) | pay, game, forge-mint, crucible, keyvault. |
| `--cf-*` design tokens | source + hearth `web/assets/vendor/` (now **differs**) + lantern + beacon inline + nimbus portal string | Five copies, two already drifted. |
| App UI primitives (`components/ui.tsx`) | 3, all different | ninety-days-after 228 lines, crucible 194, forge-mint 146. |
| `env.ts` | 7, all hand-written | — |
| Ember orange | 5 values shipping | `#e8622c` canonical; `#d9812f`, `#ff5a1e`, `#ff7a2f`, `#ff4d00` also live. |

`@cloudsforge/shared` 0.5.0 and `@cloudsforge/ui` 0.6.0 are committed and **unpublished**.
CI's `NPM_TOKEN` is dead. Every consumer pins `^0.4.0` / `^0.5.0`, and caret on `0.x` is
patch-only, so **no consumer can resolve the current version**. A minor bump costs one hand
publish plus 16 file edits across 8 repos, because these workspaces set
`verifyDepsBeforeRun: error` and a version missing from `minimumReleaseAgeExclude` breaks
every command in the repo, not just install.

### 3.8 Sold and undelivered

Ordered by how bad it looks if a customer finds it.

1. **Private worlds** — 1,800–2,500 Shards, provisioned by nobody, repeat-chargeable.
2. **Four convenience items and three cosmetic kinds** — Pay sells them, nothing renders or
   delivers them. The game client withheld the listings; **Pay's routes are still live**, so a
   direct caller is still charged.
3. **Season pass** — 500 Shards, three ids unlocked wholesale, two of the three are undrawable
   kinds, and there is no progression track.
4. ~~**ForgeMint "verified metadata" and "liquidity-lock helper"**~~ — **already fixed.** Both
   claims were removed from `MINT_OFFERS` in `shared-libs` commit `620230c`; no `liquidity`
   match remains in the estate.
5. **`tokens` in the game are a dead currency in both directions** — worse than recorded
   elsewhere. Nothing awards them (`resolve.ts:79`), nothing spends them, and yet an achievement
   gates on `tokens >= 100` (`resolve.ts:711`), so that achievement is unreachable by
   construction.
6. **The published USD prices contradict the 100 Shards = 1 USD peg.** Private worlds at
   1,800 / 2,500 Shards declare $14.99 / $19.99 where the peg gives $18 / $25; the season pass
   at 500 Shards declares $4.99 against $5; the three ForgeMint tiers are each out by a cent.
   Two prices for the same thing is a refund dispute waiting to happen.
7. **Crucible earns nothing on a default deploy** — `CRUCIBLE_LIVE_ENABLED=false`.
8. **No refunds exist anywhere.** `/internal/credit` has no caller in the estate.

### 3.9 Test coverage

Counts re-measured by running the suites, not read from documentation.

| Repo | Framework | Files | Tests | What is untested |
| --- | --- | --- | --- | --- |
| platform | `node --test` + tsx | 11 | **77** | All admin/vault/pay route handlers; no E2E, no render tests |
| forge-pay | `node --test` | 9 | 102 | **Not wired into CI.** No DB, no HTTP, no integration |
| forge-keyvault | `node --test` | 4 | **103** | Bitcoin PSBT, `/sign` E2E, reveal, crypto envelope, FileVault |
| forge-mint | `node --test` | 4 | 37 | No DB, no lifecycle E2E, no contract-execution tests |
| crucible | `node --test` | **1** | 16 | **The engine, indicators, metrics, routes, runner, store, feed, SPA** |
| ninety-days-after | `node --test` | 6 | **39** | The tick engine, every route handler, every component |
| hearth | hand-rolled | 31 suites | **20,766** vectors | The 351 MB vector corpus is gitignored, so CI runs the suites without it |
| shared-libs | CI pack/consume | — | — | No unit tests |
| lantern / beacon | `node --test` | 4 (new, uncommitted) | — | — |

Three findings that matter more than the totals:

- **29 of Nimbus's 56 tests skip silently** without `NIMBUS_TEST_DATABASE_URL` — the whole of
  `tokens.test.ts`, `keys.test.ts` and `pay.test.ts`. CI supplies Postgres; a developer's laptop
  reports green with half the suite unrun. A skip that looks like a pass is worse than a failure.
- **Hearth's `npm test` does run all 31 entrypoints**, including the nine vector suites. What CI
  cannot run is the 351 MB corpus they consume, which is gitignored and fetched by
  `node/scripts/fetch-vectors.sh`. Beacon runs them hourly against a mounted checkout, which is
  the only place the vectors are actually executed. (Beacon's own `conformance.js` comment
  saying "eight entrypoints" is stale.)
- The one product whose core claim is numerical correctness — Crucible — has a single test file,
  and it tests billing, not the engine.

---

## 4. Functionality inventory — what already exists

This is the answer to "identify if some of this already exists". Read it before proposing
anything in [08-prioritised-backlog.md](08-prioritised-backlog.md).

| Required ecosystem capability | Exists today? | Where, and what is missing |
| --- | --- | --- |
| Registration, login | **Yes** | Nimbus. Missing: email verification, account deletion. |
| Single sign-on across products | **Yes** | Origin-bound handoff code. Missing: OIDC conformance for third parties. |
| Account settings / profile | **Partial** | Nimbus portal `/account` renders initials, handle, email, roles and a *hardcoded* launcher grid. |
| Security settings | **No** | No MFA, no device list, no session list, no security log. |
| Session management, connected devices | **No** | `refresh_tokens` rows exist; nothing surfaces or names them. |
| Account recovery | **Partial** | Password reset by email token, 30 min, single use. No MFA recovery codes, no account-recovery flow. |
| Product entitlements | **Partial** | `entitlements` table in Pay. Bearer-only — **no service can ask "does this user own X"**. No expiry, no revocation, no product dimension. |
| Notification preferences | **No** | Nothing. |
| Organisations / teams | **No** | Roles are `player \| admin` on a text array. |
| Unified product navigation | **Yes** | `CloudsForgeBar` + `ProductSwitcher` in all six SPAs, derived from one registry. |
| Unified dashboard | **No** | Nothing aggregates across products. |
| Unified activity feed | **No** | Each product has its own list. No cross-product feed, no event bus. |
| Managed wallets per chain family | **Yes** | Custody mints one flat random key per address for EVM, Ember, Solana, Bitcoin, XRP. **No HD derivation, no mnemonic.** |
| Mainnet/testnet separation | **Partial** | A column exists and is bound in signing. XRP has no network binding at all. |
| Multiple wallets, labels, primary wallet | **No** | One address per (user, coin, network), deterministic order id. |
| Wallet lifecycle (freeze, retire) | **No** | No `DELETE`, no status column. |
| External wallet connection | **No** | Nothing. |
| Wallet ownership verification / signed challenge | **No** | Nothing. |
| Receive: address, QR, pending, confirmations | **Partial** | Address + pending/confirmed counts. No QR, no explorer link on deposits (synthetic txids). |
| Send: fee review, confirm, track, explorer | **Partial** | Works for EMBER/ETH/XRP. Not for BTC or SOL. Stuck withdrawals need a curl-only admin route. |
| Private-key access / export | **Admin-only** | `POST /admin/keys/:address/reveal` returns any key to any admin. **The user cannot access their own key.** |
| Key import, rotation, recovery phrase | **No** | Nothing. |
| Double-entry ledger | **No** | §3.3. |
| Balance reservations | **No** | §3.3. |
| Reconciliation | **No** | §3.3. |
| Chain indexer | **No** | §3.4. |
| Reorg handling | **No** | §3.4. |
| Asset / brand generation | **Yes, as a CLI** | asset-forge: 30 brand + 29 game assets, `gpt-image-1`, macOS-only sizing, no API, never deployed. |
| Token deployment (EVM) | **Yes** | ForgeMint, 5 chains, 3 tiers, customer wallet owns the token, keyvault signs. |
| Token deployment (Solana) | **Suspended** | Code kept, unreachable — keyvault refuses `SetAuthority`. |
| Token page / project page | **No** | Order detail only. |
| Marketplace | **No** | Nothing. Not a single listing, offer, auction or escrow primitive exists. |
| Trading: backtest, paper, live, HWM fee | **Yes** | Crucible. Live settles against Pay's oracle, not an exchange. |
| Cross-bot portfolio, P&L export | **No** | Per-bot only. |
| Game platform (titles, shared profile, inventory) | **No** | One title, no abstraction, no `game_id` anywhere. |
| Achievements, objectives, seasons | **Yes, per-world** | Ninety Days After only. |
| Cross-game assets | **No** | — |
| Blockchain explorer | **Yes** | Hearth `web/` — hash-routed vanilla ES modules, decodes logs and ERC-20 transfers. |
| Non-custodial wallet | **Yes** | Hearth `web/wallet.html` — PBKDF2 600k + AES-256-GCM in localStorage. No seed phrase, no recovery. |
| Node + mining software | **Yes** | Homefire PoW, LWMA retarget, browser miner with a dashboard. No pools. |
| Faucet | **Built, undeployed** | `hearth/tools/faucet`, 66 checks, not in compose. |
| RPC docs, SDK | **Partial** | 41 Ethereum JSON-RPC methods. `@cloudsforge/hearth-node` 0.2.0 exports **UTXO-era** APIs only and has zero consumers. |
| Developer platform | **No** | No API keys, no OAuth clients, no webhooks, no sandbox, no docs site. |
| Notifications | **No** | One outbound SMTP path (password reset) and one Beacon incident webhook. |
| Risk / policy engine | **Partial, scattered** | Custody's purpose gate and treasury pin are a real policy layer for signing. No limits, velocity, approvals, freezes or device risk anywhere. |
| Communities, governance, treasuries | **No** | `communes` exist inside one game and **are inert** — `resolve.ts` never reads them. |
| Admin console | **Partial** | Users list + role change, vault keys, prices, withdrawals. No user create/suspend/delete. Two critical remedies are curl-only. |
| Operations console | **Yes** | Lantern: log ingest, error grouping, request-id trace, browser errors. |
| Status / synthetic monitoring | **Yes** | Beacon: 27 probes, 24 journeys, Prometheus `/metrics`, incidents, chain conformance. |
| Billing / subscriptions / invoices | **No** | Entitlements are grant-only. No subscription concept anywhere. |
| Creator payouts, revenue share | **No** | Nothing. |
| Analytics | **No** | No product analytics, no funnels, no cohorts. |

---

## 5. Conflicting domain models

Four collisions that must be resolved before any new product is built. Each is recorded here
so [04-domain-model.md](04-domain-model.md) can point at what it is replacing.

1. **"Wallet" means three different things.** A `wallets` row in Pay (a Shards balance), a
   `vault_addresses` row in custody (a keypair), and Hearth's browser wallet (a localStorage
   keystore). The Forge Hub has to present one concept to a user.
2. **"Balance" has no owner.** Pay holds `wallets.shards` and `coin_balances.amount` as running
   columns; custody holds the keys; the chain holds the truth; nothing compares them. Three
   candidate sources of truth, no designated one.
3. **"Product" is declared in eight places** and has already drifted — the shared registry, the
   Nimbus portal (twice, with different copy), a stale static page, the marketing site, the
   vendored browser-obs copies, the compose anchors, and three hardcoded lists in CI.
   `pull-all.sh` omits `crucible` entirely.
4. **Game rules live in a platform contract package.** `@cloudsforge/shared`'s `game.ts` is 535
   lines holding `SKILL_PERKS`, `survivalScore`, `xpToNext` and `communeWithdrawCap` — domain
   logic shared between one game server and its own client, released on the same cadence as the
   deposit registry that Pay and custody must agree on byte-for-byte or money is credited at
   the wrong depth.

---

## 6. Technical debt register

Carried forward into [08-prioritised-backlog.md](08-prioritised-backlog.md) as `TD-*` items.

| # | Debt | Cost of leaving it |
| --- | --- | --- |
| TD-01 | No coordination primitives (no lease, no queue, no leader election) | Cannot run two replicas of anything |
| TD-02 | Boot-time DDL with no version table | Cannot scale up; cannot roll back a schema |
| TD-03 | Single-sided ledger | Cannot reconcile, cannot report revenue, cannot dispute |
| TD-04 | Balance-probe deposit detection | No real txids, no history, no reorg handling |
| TD-05 | Shared service tokens | No per-caller audit; total blast radius |
| TD-06 | `env_file: .env` fan-out | Every container holds every secret |
| TD-07 | Vendored `obs.ts` / auth middleware ×5–6 | Every cross-cutting fix is 8 PRs |
| TD-08 | Dead `NPM_TOKEN`, `0.x` versions, `minimumReleaseAgeExclude` ritual | A contract change costs 16 file edits |
| TD-09 | SPAs inside API processes | A CSS change redeploys the trading engine |
| TD-10 | `container_name` + fixed ports | `deploy.replicas` is rejected |
| TD-11 | Static `/health` used as readiness | Rolling deploys are lossy |
| TD-12 | Long work inside HTTP requests | Deploys kill in-flight chain deploys |
| TD-13 | Lantern's Docker-socket collector | Does not survive a second host |
| TD-14 | Master secret unrotatable | Compromise is unrecoverable |
| TD-15 | `.cf31-head/` — 23 tracked stale duplicate source files in the game repo | Dead weight in git |
| TD-16 | Hearth's `SPARKS_PER_EMBER` still `1e8` while 18 decimals are specified | Latent unit bug |
| TD-17 | Hearth `site/` copy still tells the UTXO story after the EVM migration | Public page describes a chain that no longer exists |
| TD-18 | `@cloudsforge/hearth-node` exports UTXO-era APIs and has zero consumers | Published package is a lie |
| TD-19 | ~38 MB of unreferenced generated art across the estate | — |
| TD-20 | 12 art masters at 1024² against declared 512²/256² | — |

---

## 7. Documentation drift found during this audit

Recorded because these documents were used as inputs by earlier plans and are wrong.

- `platform/MAP.md` §2.7, §7, §8 — claims no mail transport exists, that reset links are built
  from the request Host, and that there is no signing-key rotation. All four claims are false
  in current source.
- `forge-pay/MAP.md` — "33 handlers"; there are 35. Schema comment says treasury purpose is
  `'deployer' today`; `treasury.ts:63` uses `'treasury'`.
- `forge-keyvault/MAP.md` — inline line numbers stale by ~90 lines.
- `hearth/MAP.md` §4.6, §10 — claims `jsonrpc/server.js` "is never constructed"; it is mounted
  at `node/src/evmnode.js:232`. Test count says 27; there are 31 suites.
- `stack/BLOCKCHAIN.md` §1 — describes Hearth as "a pure key-to-address UTXO chain". Hearth is
  now an account-model EVM chain with `0x` addresses and secp256k1. The document's entire
  premise (add output predicates, not a VM) is obsolete: the VM already exists and passes
  conformance.
- `stack/ECOSYSTEM.md` — describes Forge Pay as settling "through a mock provider"; the invoice
  path was deleted and payments are on-chain deposit only.
- `asset-forge/MAP.md` says 27 game assets, `ECOSYSTEM.md` says 33 total; source has 59.

The superseded platform documents (`PLAN.md`, `ECOSYSTEM.md`, `MICROSERVICES.md`,
`upgrade.md`, `audit.md`) are removed as part of this work. Their still-true content is folded
into this directory; `MICROSERVICES.md`'s Part I analysis survives as §3.1–§3.6 above and its
Part II design survives in [02-target-architecture.md](02-target-architecture.md).
