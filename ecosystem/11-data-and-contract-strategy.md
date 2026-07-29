# 11 — Data and contract strategy

How data and API contracts are owned, versioned, evolved and retired across forty repositories
in which no single build can see more than one service at a time.

[02-target-architecture.md](02-target-architecture.md) AD-01 chose one repository per
deployable, and AD-02 stated the consequence plainly: **contract distribution is automated, or
the topology fails.** This document is the specification of that automation, plus the data
rules that survive the loss of the compiler as an integration test.

Read [04-domain-model.md](04-domain-model.md) for what the entities are. This document is about
who owns them, who may read them, how the shapes change, and how long anything is kept.

---

## 1. The rule the whole document hangs from

A contract is a **published, versioned artifact with a compatibility guarantee** — never shared
source, never a path import, never a copied interface. Today the estate proves what the
alternative costs: `services/*/src/obs.ts` exists as five byte-identical 375-line copies plus
one 428-line fork, the Nimbus JWKS middleware exists in five divergent implementations, and the
`--cf-*` design tokens exist in five copies of which two have already drifted
([00-current-state.md](00-current-state.md) §3.7).

Three consequences follow, and they are the acceptance criteria for everything below.

1. **A consumer may lag.** A service may run up to two minors behind a contract package. This is
   only safe because removals are impossible; see §4.
2. **A producer may not break a consumer silently.** Additive-only is enforced by
   `contract-compat.yml` in `.github`, not by review discipline. Discipline has already failed
   here once, measurably.
3. **Where lag is unsafe, the package is exact-pinned rather than caret-ranged.** Exactly one
   package is in that category, and §3 is the argument for why.

---

## 2. Contract package structure

`@cloudsforge/shared` 0.5.0 is 1,664 lines across seven source files in one package with one
version. It is split into eight packages in the `cloudsforge-contracts` repository
([03-repository-responsibilities.md](03-repository-responsibilities.md) §1.4), released from
one repository so a cross-context change is one pull request, but versioned separately so a
game-rule change cannot force a custody release.

| Package | Owns | Derived from | Must never contain |
| --- | --- | --- | --- |
| `contracts-auth` | `PublicUser`, claims, register/login shapes, MFA factor kinds, session and device shapes, organisation and membership roles, OIDC scopes | `shared/src/auth.ts` (48 lines) | Anything a token issuer would not need to validate |
| `contracts-money` | Account subject/type/purpose vocabulary, entry `kind` closed set, posting shape, reservation shape, entitlement and subscription shapes, `Idempotency-Key` semantics | `shared/src/pay.ts` (185 lines), minus the SKUs | Prices, fee percentages, product catalogues — those are `billing` **data**, not contract |
| `contracts-chain` | `DepositCoin`, `DepositFamily`, `SUPPORTED_DEPOSIT_COINS`, decimals, `confirmation_policy`, `RATE_SCALE`, `shardsForCoinAmount()`, address canonicalisation, indexer record shapes | `shared/src/deposits.ts` (294 lines) | Anything that changes on a product cadence. **Exact-pinned — §3** |
| `contracts-market` | Listing, offer, bid, order, collection, verification level, dispute shapes; settlement-mode enum | new | Fee rates, royalty defaults, moderation policy |
| `contracts-worlds` | `title` registry shape, `player_profile`, `inventory_item`, `bound` flag, achievement and season shapes, the title-service capability list | new | **Any rule of any individual game** |
| `contracts-create` | Brand kit, asset kind and spec, generation-job status, token order, deployment lifecycle, `SUPPORTED_CHAINS` | `shared/src/forgemint.ts` (262 lines) | Contract bytecode, gas heuristics |
| `contracts-events` | The envelope (§6), topic registry, per-topic payload schemas and their versions, the subscription record | new | Any handler, any transport, any retry policy — those are `@cloudsforge/runtime` |
| `contracts-devplatform` | API key and OAuth client shapes, scope vocabulary, webhook envelope and signature scheme, quota and usage records | new | The public REST surface itself — that is `cloudsforge-sdk`, generated from OpenAPI |

The product registry (`shared/src/products.ts`, 334 lines, `SURFACES`, `PRODUCTS`,
`SWITCHER_SURFACES`, `CLOUDSFORGE_EMBER`) moves to `@cloudsforge/ui` rather than to a contracts
package, because its consumers are frontends and CI, not services.
[04-domain-model.md](04-domain-model.md) §11 is explicit that it must never become a database
table; making it a build artifact is what keeps that true.

### 2.1 What leaves the contracts entirely

**Game rules.** `shared/src/game.ts` is 535 lines — a third of the package — holding
`SKILL_PERKS`, `aggregatePerks`, `xpToNext`, `survivalScore`, `communeWithdrawCap`,
`DAILY_OBJECTIVES`, `WEEKLY_OBJECTIVES`, `ACHIEVEMENTS`, `SEASON_MILESTONES` and
`WORLD_EVENT_TYPES`. They move into `cloudsforge-nda`.

The argument is not aesthetic, and it is checkable. Grepping the estate for
`SKILL_PERKS|xpToNext|survivalScore|communeWithdrawCap` returns matches in exactly one
repository — `ninety-days-after`, in `services/game/src/{util,stipend}.ts`,
`services/game/src/engine/{progression,resolve}.ts`,
`services/game/src/routes/{communes,progression,worlds}.ts` and one client page,
`apps/game/src/pages/Progress.tsx`. Nothing else in nine repositories imports a single one of
them. A balance tweak to a survival perk therefore currently forces a version bump of the same
artifact that carries `SUPPORTED_DEPOSIT_COINS`, which Forge Pay's watcher and ForgeKeyvault's
signer must agree on byte-for-byte. That is the coupling this split exists to sever, and after
the split the game's rules ship on the game's cadence with no release ceremony at all.

**The retired invoice contract.** `shared/src/pay.ts` already carries a header block marking the
fiat/invoice checkout surface as retired and warning against restoring it. The comment is
deleted with the code it describes; the history lives in this document and in
[00-current-state.md](00-current-state.md).

**The undeliverable SKUs.** `COSMETICS`, `CONVENIENCE_ITEMS`, `SEASON_PASS` and
`PRIVATE_WORLD_OFFERS` are catalogue *data*, not contract. They become `billing` rows behind a
service-readable API. The four convenience items, three undrawable cosmetic kinds and the
repeat-chargeable private world are withdrawn from the API in P1 of
[06-ecosystem-workflow.md](06-ecosystem-workflow.md), before the package split, because they
must not survive long enough to be migrated.

---

## 3. Why `contracts-chain` is exact-pinned

Every other contract package is consumed with a caret range and a two-minor lag tolerance.
`contracts-chain` is consumed with an exact version by `wallet`, `settlement`, `custody` and
`indexer`, and a mismatch between any two of them fails `cfctl doctor` and the release manifest
validation.

The reason is that this package does not describe shapes; it carries **numbers that four
services must compute identically**.

- `RATE_SCALE = 1_000_000n` and `shardsForCoinAmount(coin, amountSmallest, shardsPerCoinScaled)`
  perform the credit arithmetic in `BigInt` and floor the result. The function deliberately
  returns `Infinity` rather than clamping when the result exceeds `Number.MAX_SAFE_INTEGER`,
  because a clamped value reads as a legitimate result to every caller's bounds check. Two
  versions of that function in two services is two different amounts of money for one deposit.
- `SUPPORTED_DEPOSIT_COINS` carries `decimals` per coin — EMBER and ETH 18, SOL 9, BTC 8, XRP 6.
  EMBER's moved from 8 to 18 during Hearth's EVM migration, a change of magnitude 1e10. A
  service one minor behind on that value credits ten billion times the wrong amount.
- `confirmations` per coin is the depth at which the watcher probes and the depth at which money
  becomes spendable — EMBER 60, ETH 12, BTC 1, SOL 1, XRP 1. EMBER's 60 is not arbitrary: it is
  the depth Hearth's own exchange-integration documentation publishes to third parties, and
  crediting shallower than the published depth is indefensible in either direction.
- `keyvaultChain` is **persisted**. `forge-pay` stores it on every deposit address row and
  custody stores it on every key row. It is a database value, not a config value, and changing
  it retroactively invalidates stored bindings — custody's `/sign` gate compares five fields
  against the stored row and refuses on any mismatch.

So the invariant is: **`contracts-chain` is the only package where a version skew between two
running services credits the wrong amount or signs against the wrong chain.** Exact-pinning
turns that skew from a silent money bug into a failed deploy. `contracts-chain` accordingly
carries a hard rule of its own — no field in it may change on a product cadence, and any change
to a `decimals` or `confirmations` value is a coordinated release of all four consumers in one
manifest, never a Renovate auto-merge.

---

## 4. Versioning and evolution

**Every package starts at `1.0.0`.** Caret ranges on `0.x` are patch-only, which is why all
thirteen consumer manifests in the estate today pin `@cloudsforge/shared: ^0.4.0` and
`@cloudsforge/ui: ^0.5.0` while 0.5.0 and 0.6.0 sit committed and unresolvable. Going to 1.x is
what makes `^1.2.0` mean "1.2.0 or any later 1.x", which is what makes Renovate's auto-merge and
the two-minor lag tolerance work at all.

**Additive-only, enforced by `contract-compat.yml`.** The check runs on every pull request in
`cloudsforge-contracts`, extracts the type surface of every exported symbol from the merge base
and from `HEAD`, and fails on:

| Change | Verdict |
| --- | --- |
| A field removed from an interface or a Zod object | fail |
| A field made required that was optional | fail |
| A type narrowed (`string` → `'a' \| 'b'`, `number` → `1 \| 2`) | fail |
| A member removed from a union or a `const` array used as an enum | fail |
| A key renamed | fail (it reads as a removal plus an addition, and that is correct) |
| A function's parameter added without a default | fail |
| A function's return type narrowed | fail |
| An optional field added | pass |
| A member added to a union that is only ever *produced* by the owner | pass, with a warning naming every consumer that switches exhaustively on it |
| A new exported symbol | pass |
| A documentation comment change | pass |

**A breaking change is a new major package name, not a new major version.** `contracts-money`
becomes `contracts-money-v2`, published alongside, with both maintained for the notice period.
This is deliberately more annoying than bumping a major, because in a forty-repository estate a
major bump is forty coordinated pull requests that cannot land atomically, and a half-landed
major is a production incident. Side-by-side packages let each consumer migrate on its own
schedule and let the compiler catch the ones that have not.

**The procedure, when it is genuinely unavoidable:**

1. An architecture decision record in `cloudsforge-contracts` stating what cannot be expressed
   additively and why. If the answer is "the old field is ugly", the change is refused.
2. `-v2` published; `-v1` gains a deprecation notice in its README and a build-time warning.
3. Every consumer opens a migration issue automatically, created by the publish workflow.
4. A minimum of **two release cycles** before `-v1` is unpublished, and never while any release
   manifest in `stack/releases/` still names an image built against it — which is checkable,
   because the manifest is a file.
5. `-v1` archived, not deleted, so an old manifest still resolves and rollback still works.

The exception already taken: P1 makes `Idempotency-Key` mandatory on `POST /spend` and withdraws
the undeliverable SKUs by hand with a documented exception, because `contract-compat.yml` does
not exist until P2 and those two changes must not wait.

---

## 5. Publishing and distribution

**GitHub Packages, authenticated with the workflow's own `GITHUB_TOKEN`.** The current release
workflow (`shared-libs/.github/workflows/release.yml`) sets `registry-url:
https://registry.npmjs.org` and `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`, and that token is
dead. It is the root cause of every hand-publish ritual in the estate and of the version skew
above. `GITHUB_TOKEN` is minted per workflow run, cannot be leaked into a fork's run, and needs
no rotation.

**Renovate at organisation level**, configured in `.github/renovate-config`, grouped per
contract package, auto-merging on green CI. The measured target from
[03-repository-responsibilities.md](03-repository-responsibilities.md) §5 is **under 24 hours
from publish to the last consumer, unattended**, demonstrated twice as a P2 exit criterion.

**The pnpm trap, stated precisely because it is a real cost and it is not obvious.** Every
workspace in the estate sets:

```yaml
minimumReleaseAgeExclude:
  - '@cloudsforge/shared@0.1.0'
  - '@cloudsforge/shared@0.2.1'
  - '@cloudsforge/shared@0.3.0'
  - '@cloudsforge/shared@0.4.0'
verifyDepsBeforeRun: error
```

pnpm quarantines newly published packages until they age. The gate exists to defend against
supply-chain attacks on third-party packages; applied to first-party packages it defends against
nobody. pnpm writes the exclude block itself on first install, and a version present in the
lockfile but missing from the block trips `verifyDepsBeforeRun` on the very next command —
`pnpm test`, `pnpm typecheck`, everything, not just install. That is why a minor bump today costs
sixteen file edits across eight repositories rather than one.

The fix, in order of preference: **drop the release-age constraint for the `@cloudsforge/*`
scope entirely** (they are first-party and published by our own CI, so the gate protects us from
ourselves); failing that, have Renovate maintain the exclude list as part of the same automated
pull request that bumps the range. One further trap is already documented in
`forge-pay/pnpm-workspace.yaml` and must not be re-learned: `verifyDepsBeforeRun: true` is
silently ignored by pnpm 11 and performs no check at all. `error` is the only value that
enforces.

**Nothing is published from a laptop.** A publish is a tag push in `cloudsforge-contracts`, and
the workflow refuses to publish a version whose `contract-compat.yml` job did not pass.

---

## 6. The event envelope contract

Owned by `contracts-events`. This is the single most widely consumed shape in the target estate
and the only one every service both produces and consumes.

```jsonc
{
  "id":            "0192…",              // UUIDv7, unique per event, the dedupe key
  "topic":         "wallet.deposit.confirmed",
  "key":           "user:0192…",         // ordering key; ordering is guaranteed per topic+key ONLY
  "occurredAt":    "2026-07-30T09:12:04.117Z",
  "producer":      "wallet@1.14.2",      // service name and version, for triage
  "version":       2,                     // schema version of THIS topic's payload
  "actor":         "user:0192…",         // user:<id> | service:<name> | operator:<id> | system
  "correlationId": "0192…",              // W3C trace id where one exists
  "payload":       { }
}
```

**Topic naming is `<service>.<aggregate>.<past-tense-verb>`** — `wallet.deposit.confirmed`,
`ledger.entry.posted`, `billing.entitlement.granted`, `custody.key.exported`,
`identity.user.deleted`, `market.listing.sold`, `community.proposal.executed`. Present tense is
a command and commands are HTTP calls; a topic in the imperative fails review. The topic
registry is a file in `contracts-events`, so a typo is a compile error rather than a subscriber
that never fires.

**Versioning is per topic, not per package.** `version` is an integer on the envelope. A payload
gains fields freely at the same version; a payload that must lose one gets `version: n+1`
published alongside, with the producer emitting both until every registered subscriber has
acknowledged the new one. Subscribers must ignore unknown fields — a consumer that fails closed
on an unrecognised key makes every producer's additive change a breaking one.

**Ordering is guaranteed per `(topic, key)` and nowhere else.** There is no global sequence
([04-domain-model.md](04-domain-model.md) §11). A consumer that needs "all events in order"
across topics is asking for a property that a Postgres-per-service estate does not provide, and
the answer is to key correctly rather than to add a sequencer.

**Delivery is at-least-once, and the inbox dedupe rule is not optional.** Every consumer writes
`(topic, event_id)` into its `inbox` table with a unique constraint, **in the same transaction
as the handler's effect**. If the insert conflicts, the event has already been processed and the
handler does not run. A handler that is idempotent "by inspection" instead of by the inbox fails
review — `activity_record.source_event_id` being unique is the same rule expressed as a domain
constraint, and it is why a redelivered event does not duplicate a feed entry.

**Events are facts, not commands, and they are not a transaction boundary.** A debit and its
business effect are never split across a synchronous call and an event; the ledger posting *is*
the transaction and the product records the outcome by consuming the event.

---

## 7. API versioning

Two surfaces with different rules, and conflating them is how an internal refactor becomes a
third-party outage.

| | Internal service APIs | Public API |
| --- | --- | --- |
| Address | `http://<service>` on the `app` network | `api.cloudsforge.online/v1` via the gateway |
| Consumers | Other CloudsForge services, known and enumerable | Unknown third parties |
| Versioning | The contract package version. No URL version | URL-versioned, `/v1`, `/v2` |
| Auth | Short-TTL RS256 service token, `sub=<service>`, explicit scopes | devplatform-issued key or OAuth client with scopes |
| Breaking change | Side-by-side package (§4); consumers are known and can be told | Deprecation policy below |
| Description | Generated OpenAPI, committed, used by contract tests | Generated OpenAPI, published, used to generate `@cloudsforge/sdk` |

**Internal APIs are not versioned in the URL** because URL versioning solves a problem —
unknown consumers — that internal services do not have. Adding `/v1` to `ledger` would produce
a `/v1` that is never followed by a `/v2` and one more thing to keep consistent across forty
repositories.

**Public API deprecation policy.**

- **Two major versions supported concurrently.** `/v1` remains live for the whole life of `/v2`.
- **Twelve months' notice** from the announcement of a deprecation to the removal of an endpoint
  or a field, and the clock starts on the announcement, not on the release.
- **Machine-readable headers on every deprecated response:** `Deprecation: true`,
  `Sunset: <IMF-fixdate>` per RFC 8594, and `Link: <…>; rel="deprecation"` pointing at the
  migration note. A developer must be able to discover the deprecation from a response, not
  only from a blog post.
- **Usage-gated removal.** `devplatform` meters calls per project per endpoint, so removal is
  preceded by direct notification of every project that called the endpoint in the last 90 days.
  An endpoint with live callers past its sunset date is escalated, not silently removed.
- **Additive changes need no version.** A new optional field, a new endpoint or a new enum member
  that only the server produces ships in the current version.

**One naming defect must be fixed before any of this.** `api.cloudsforge.online` currently
points at the **game** API — the hostname is bound in `deploy/cloudflared/config.example.yml`.
It is renamed to `worlds-api.cloudsforge.online` in P11 of
[06-ecosystem-workflow.md](06-ecosystem-workflow.md), **before** anything depends on
`api.cloudsforge.online` as the public surface. Renaming it after third parties are on it costs
a deprecation cycle for a hostname nobody meant to publish.

---

## 8. Database conventions

Binding on every service. Checked by `service-ci.yml`; a migration that violates one fails the
build.

| Convention | Rule | What it replaces |
| --- | --- | --- |
| **Identifiers** | `uuid` column type, UUIDv7 values, generated in the application. Time-ordered, so they index without page splits and sort chronologically | `id: text('id').primaryKey()` holding a `randomUUID()` v4 — the shape used in every current schema, which is a random string in a text column |
| **Chain amounts** | `numeric(78,0)`, smallest unit, always positive; direction is a separate column | `text('amount')`, `text('pending')`, `text('swept')`, `text('last_seen')` throughout `forge-pay/services/pay/src/db/schema.ts`. Postgres cannot add, compare or sum a TEXT amount, so every arithmetic invariant currently has to live in application code |
| **Scaled amounts** | Shards and fiat are scaled integers in `bigint`, with the scale named in the column comment | `bigint(mode: 'number')` on `wallets.shards` and `ledger.delta` — Drizzle's `mode: 'number'` returns a JS number, which silently loses precision past 2^53 |
| **No floats in money** | `real`, `double precision` and `float` are refused in any table holding value, a rate, a fee or a quantity | — |
| **Time** | `timestamptz`, UTC. Business dates are separate `date` columns, never derived from a timestamp in a query | Already true across the estate and worth keeping |
| **Cross-service references** | `user_id uuid` with **no** foreign key; everything else is a URN string `cf:<service>:<type>:<id>` | — |
| **No cross-service foreign keys** | A constraint across a service boundary is a shared database with extra steps | — |
| **No soft delete** | No `deleted_at`, no `is_deleted`. Records have lifecycle states; erasure is a distinct audited operation (§11) | — |
| **No generic JSONB substituting for a column** | `metadata` exists on entries, assets and entitlements for genuinely open-ended data. A field added to it and then queried is a schema change deferred, not avoided | — |
| **Every money table is `INSERT`-only at the role level** | The ledger's application role has no `UPDATE` or `DELETE` grant on `journal_entry` or `posting`. Immutability enforced by the database, not by care | — |

---

## 9. Data ownership matrix

One owner per concept. Everyone else reads over HTTP, or from the event bus, and caches only
with a stated TTL. A field that exists only in a cache is a bug
([03-repository-responsibilities.md](03-repository-responsibilities.md) §4).

| Concept | Owner | Who reads it, and how | Projection / cache, and TTL |
| --- | --- | --- | --- |
| Account, credentials, MFA, sessions, devices | `identity` | Every service validates tokens against JWKS; `hub-api` and `admin-api` read the profile over HTTP | `hub-api` caches profile 60 s. JWKS cached 10 min with a forced refresh on unknown `kid` |
| Profile (display name, avatar, locale) | `identity` | `worlds`, `market`, `community` for display | Each may cache 5 min. Never persisted as a copy |
| Organisations, memberships | `identity` | `devplatform`, `billing`, `market` | 60 s |
| Accounts, journal, postings, balances | `ledger` | Nobody reads the tables. `wallet` reads balances over HTTP; everyone else consumes `ledger.entry.posted` | **No service caches a balance.** `hub-api` may cache a portfolio for 15 s and must render the "priced at" timestamp |
| Reservations, escrow | `ledger` | `market`, `trade` create and release them via the posting API | none |
| Wallet registry, external links, deposit assignments | `wallet` | `hub-api`, `settlement`, `mint` (owner wallet), `market` (seller wallet) | `mint` stores `owner_wallet_id` as a reference, never the address |
| Key material, HD seeds, derivation paths | `custody` | **Nobody.** Custody answers "does this address exist and what scheme is it" and signs. It never returns key material | none, ever |
| Blocks, transactions, logs, address activity | `indexer` | `wallet` (crediting), `settlement` (confirmations), `market` (risk indicators), `explorer-web`, `devplatform` webhooks | `explorer-web` caches 5 s at the edge. `market` risk indicators recomputed on read, never stored as a score |
| Confirmation policy | `contracts-chain` | `wallet`, `settlement`, `custody`, `indexer` | Compiled in. Exact-pinned (§3) |
| Prices and rates | `pricing` | `wallet` (conversion), `trade` (fills), `hub-api` (valuation), `market` | 10 s, and every displayed price carries its quote timestamp |
| Outbound transactions | `settlement` | `wallet` (withdrawal status), `admin-api` | none |
| Products, prices, entitlements, subscriptions | `billing` | `worlds`, `market`, `community`, `studio` ask "does this subject own X for this scope" over HTTP, and subscribe to `billing.entitlement.granted` | Entitlement checks cached 30 s; a revocation event invalidates immediately |
| Listings, offers, orders | `market` | `hub-api`, `activity` | 30 s on public listing reads |
| Player profile, inventory, achievements | `worlds` | `nda` and any future title | Title services cache the profile for the length of one tick, never across |
| World simulation state | `nda` | Nobody. It is the title's own | none |
| Communities, treasuries, proposals | `community` | `hub-api`, `market` (membership gating), `worlds` | Membership cached 60 s; token-gated membership is re-evaluated on a schedule, not cached indefinitely |
| Developer credentials, quotas, usage | `devplatform` | Gateway (key validation), `billing` (metering) | Key validation cached 30 s; revocation propagates via `devplatform.key.revoked` |
| Activity records | `activity` | `hub-api` only | 15 s |
| Notification preferences and history | `notify` | `hub-api` | 60 s |
| Audit events | Every service, mirrored to `admin-api` | `admin-api` (search), security | The mirror is a durable copy, not a cache, and is hash-chained |
| Policy decisions | `policy` | Callers receive the decision; `admin-api` reads history | Static rules cached locally by `@cloudsforge/policy-client`; decisions never cached |
| Pseudonymised product events | `analytics` | Product | Not readable by any service |

---

## 10. Data partitioning

**One database per service, no exceptions.** This is already true across all nine repositories,
verified by grep, and it is the single most expensive property to retrofit
([00-current-state.md](00-current-state.md) §2). It is enforced going forward by a CI check for
any connection string other than the service's own environment variable, and by per-service
Postgres roles with no grants on other schemas.

**Money is partitioned by account, not by user.** A ledger account's key is
`(subject, asset_code, purpose)` where `subject` is `user:<id>`, `community:<id>`,
`organisation:<id>`, `platform`, `custody` or `clearing`. Partitioning by user would make a
community treasury, a marketplace escrow and a platform revenue line into three special cases;
partitioning by account makes them the same case. Physical partitioning of `posting` is by
`entry_id` range as volume requires, never by user — a query that has to scan every partition to
compute one user's balance is the projection's job, not the journal's.

**`user_id` is a cross-cutting key in fourteen databases with no constraint anywhere.** Two
rules make that safe, and both are testable:

1. **`identity.user.deleted` is a contract.** Every service storing `user_id` subscribes and
   acknowledges within its stated SLA. A service that stores `user_id` and has no subscription
   fails `service-ci.yml`.
2. **No service may infer anything from the shape of an id.** Ids are opaque. Profile data is
   fetched, never derived, never cached past the TTL in §9.

The thing `user_id` explicitly does **not** mean: a foreign key. A row referencing a deleted user
is not corruption — it is a record awaiting its erasure acknowledgement, and §11 defines what
happens to it.

---

## 11. Retention and erasure

### 11.1 Retention

| Data | Owner | Retention | Why this number |
| --- | --- | --- | --- |
| Journal entries and postings | `ledger` | **Forever** | Financial records. Not erasable, §11.3 |
| Balances projection | `ledger` | Rebuilt from the journal on demand | It is a projection, not a record |
| Reconciliation runs | `ledger` | 7 years | Audit period |
| Wallet registry, external links | `wallet` | Life of account + 7 years for any wallet referenced by a journal entry | Follows the money |
| Outbound transactions | `settlement` | Forever for confirmed; 400 days for failed and abandoned | A confirmed transaction is a financial record |
| Key events, signing audit, export records | `custody` | Forever. Key **material** is destroyed on wallet retirement | Who touched a key is the security record; the key is not |
| Blocks, transactions, receipts | `indexer` | Per-chain horizon (default 180 days of full bodies), then headers and address activity only. **Never prunes anything a ledger entry references** | Bodies are large and re-fetchable; the reference is not |
| Address activity | `indexer` | Forever | It is the evidence behind a credit |
| Prices and rate history | `pricing` | 400 days at full resolution, then daily | Enough for a year-on-year chart and a tax export |
| Entitlements, subscriptions, invoices | `billing` | 7 years | Tax |
| Listings, orders, disputes | `market` | Orders 7 years; expired listings 400 days | Orders are money |
| World simulation state | `nda` | Archived worlds 400 days, then aggregate results only | A finished world is a story, not a record |
| Activity records | `activity` | 400 days | The feed's useful horizon; the underlying facts live in their owners |
| Notifications and deliveries | `notify` | Notifications 180 days; delivery attempts 30 days | — |
| Policy decisions | `policy` | 400 days | "Why was I blocked" must be answerable months later |
| Audit events | Every service + `admin-api` mirror | 7 years, append-only, WORM storage for the mirror | — |
| Lantern log events | `lantern` | **7 days** (`LANTERN_RETENTION_DAYS`) | Triage horizon. Loki holds the raw stream |
| Lantern issues (grouped errors) | `lantern` | **90 days** (`LANTERN_ISSUE_RETENTION_DAYS`) | An issue outlives its events; that is the point of grouping |
| Beacon check results | `beacon` | **14 days** (`BEACON_CHECK_RETENTION_DAYS`) | Raw probe results |
| Beacon rollups | `beacon` | **400 days** (`BEACON_ROLLUP_RETENTION_DAYS`) | The 90-day public uptime bars, with headroom |
| Beacon journey runs | `beacon` | 30 days (`BEACON_RUN_RETENTION_DAYS`) | — |
| Beacon incidents | `beacon` | 400 days (`BEACON_INCIDENT_RETENTION_DAYS`) | — |
| Loki logs | telemetry | 30 days | — |
| Tempo traces | telemetry | 7 days, tail-sampled: 100% of errors and slow requests, 5% of the rest | — |
| Prometheus metrics | telemetry | 15 days raw, 400 days downsampled | — |
| Analytics events | `analytics` | 400 days | Pseudonymous, so retention is a storage question, not a privacy one |

### 11.2 Erasure

Erasure is driven by one event, `identity.user.deleted`, and it is the GDPR path that does not
exist today at all.

```
user requests deletion
  → identity sets status = pending_deletion, emits identity.user.deletion_requested
  → 30-day cooling-off (cancellable by the user; the account is inaccessible but intact)
  → identity emits identity.user.deleted { user_id, requested_at }
  → every subscriber erases or tombstones per the table below and emits
      <service>.erasure.acknowledged { user_id, action, records }
  → identity waits for all fourteen acknowledgements, then tombstones the user row
      to { id, created_at, deleted_at } and nothing else
  → an acknowledgement missing past its SLA pages; it is never assumed
```

| Service | Action |
| --- | --- |
| `identity` | Tombstone. Retain `id`, `created_at`, `deleted_at`. Erase email, handle, password hash, MFA secrets, sessions, devices |
| `wallet` | Erase labels and user-supplied text. **Retain** address, chain, network and lifecycle for any wallet referenced by a journal entry |
| `custody` | **Destroy key material.** Retain the key event log with `user_id` replaced by the tombstone id |
| `ledger` | **Erase nothing.** `subject` becomes `user:<tombstone-id>` |
| `settlement` | Retain confirmed transactions; erase nothing on chain, because nothing on chain can be erased |
| `indexer` | Erase nothing. Chain data is public and not ours to delete |
| `billing` | Retain invoices and entitlement history for the tax period; erase billing contact details |
| `market` | Retain orders; erase listing descriptions, images and seller profile text; anonymise the seller display name |
| `worlds`, `nda` | Erase display name and avatar; retain aggregate world outcomes with the tombstone id |
| `community` | Erase display name; **retain votes and proposals** under the tombstone id, because erasing a vote rewrites a governance record |
| `activity` | Erase the whole feed |
| `notify` | Erase preferences, notifications and delivery history |
| `policy` | Retain decisions under the tombstone id for the dispute window |
| `analytics` | Nothing to do — it never held a `user_id` (§12) |
| `lantern`, telemetry | Nothing to do — expires within 30 days, and holds no `user_id` by policy |

### 11.3 Why financial records cannot be erased

A journal entry is not personal data about a person; it is a record of a transaction between the
platform and an account. Erasing it would make the trial balance non-zero, break the
reconciliation invariant that
[04-domain-model.md](04-domain-model.md) §2.4 makes the whole platform rest on, and destroy the
evidence needed to answer a dispute or a tax enquiry — both of which are legal obligations that
sit alongside the erasure obligation rather than under it.

What is erased instead is the **link**: `subject` becomes an opaque tombstone id, and the
mapping from that id to a person is destroyed in `identity`. The entry survives; the identity
does not. This is stated to the user in the deletion flow in plain language, because a deletion
flow that implies more than it delivers is worse than one that is honest about the limit.

---

## 12. Privacy boundaries

Four planes, from [02-target-architecture.md](02-target-architecture.md) AD-20, with one rule
that makes the separation real: **no plane is derived from another.**

| Plane | System | Contains | May be derived from |
| --- | --- | --- | --- |
| Operational observability | OTel → Prometheus, Tempo, Loki, Grafana; Lantern; Beacon | Redacted. No secrets, no full addresses, no balances | Nothing |
| Security audit | `audit_events` per service + hash-chained mirror in `admin-api`; `policy_decision` | PII, deliberately, access-logged | Nothing |
| Financial reporting | `ledger` journal and reconciliation runs | PII | Nothing |
| Product analytics | `analytics`, fed from the event bus | Pseudonymous by construction | Nothing |

- Analytics is **never** derived from logs. Logs are sampled, redacted and expire in 30 days;
  a funnel built on them is a funnel that changes shape under load.
- Financial reporting is **never** derived from analytics. Analytics is lossy and pseudonymous.
- Security audit is **never** derived from application logs. A log line can be dropped under
  load; an audit record cannot. Today the only real audit tables in the estate are custody's
  `key_reveals` and Lantern's issue store, and everything else is `log.warn({audit:…})` — which
  is exactly the failure this rule closes.
- Each plane has its own write path and its own durability guarantee. Audit rows are written **in
  the same transaction as the change they describe**.

**The analytics pseudonymisation rule, enforced in code and in CI.** `analytics` receives
`subject_key = HMAC(user_id, analytics_pepper)`, and the pepper lives only in the analytics
service. It stores **no `user_id`, no email, no handle, no wallet address, and no exact balance
or amount** — amounts arrive bucketed into ranges. A schema check in `analytics`'s CI fails the
build if a column named `user_id`, `email`, `handle`, `address` or `amount` appears in any
table, and the ingest path rejects an event carrying any of those keys rather than dropping the
key silently.

The consequence is intentional and must not be worked around: **analytics cannot answer a
support question about a named user.** That question is answered by `admin-api` against the
owning service, with a reason code and an audit record.

---

## 13. Migration conventions

Boot-time DDL is the reason the estate cannot run two replicas of anything: five repositories
ship a hand-rolled `STEPS[]` of `CREATE TABLE IF NOT EXISTS` executed before `listen()`, with no
version table, no down path and no lock. Two replicas booting together race on `pg_class`, one
raises 23505 and crash-loops.

| Rule | Detail |
| --- | --- |
| **Versioned files** | `migrations/NNNN_<slug>.sql`, monotonic, immutable once merged. A merged migration is never edited; a mistake is a new migration |
| **Version table** | `schema_migrations(version, applied_at, checksum)`. A checksum mismatch is a hard failure, not a warning |
| **Advisory lock** | The runner takes `pg_advisory_lock(<service-hash>)` before reading the version table and releases it after the last migration commits |
| **One-shot job** | An init container or a Kubernetes `Job`, never `index.ts`. The application process asserts the expected version at boot and refuses to start below it |
| **Expand / contract** | Mandatory. A rolling deploy always runs two code versions against one schema, so: expand (add nullable column, backfill, dual-write) → deploy the code that reads it → contract (make it required, drop the old) in a **later** release |
| **No destructive statement in the same release as the code that stops using the column** | `DROP COLUMN` lands at least one release after the last reader is deployed |
| **Every migration is proven against a restored production dump**, not an empty database | This is the highest risk in P2 and the reason the conversion is a phase and not a chore |

The first migration in each existing service is a **reconciliation migration**: it records the
hand-built schema as version 0001 without changing it, verified by comparing the restored dump's
catalogue against the expected shape. Getting this wrong breaks a production schema, so it is
done one service at a time, starting with the least critical (`forge-mint`).

---

## 14. Schema change checklist

Every schema change answers all of these in the pull request description. A missing answer is a
review block, not a comment.

1. **Which service owns this table, and is this change inside that ownership?** If another
   service needs the data, the answer is an API or an event, never a column here.
2. **Is it expand-only?** If it adds a `NOT NULL` column, drops a column, renames one, or
   narrows a type, name the release in which the contract half lands.
3. **Is it safe against a rolling deploy?** State what the previous code version does when it
   reads a row written by the new one, and what the new version does reading an old row.
4. **Is it safe against a restored production dump?** State the row count it was tested at and
   the observed lock duration. A migration taking a table lock on a table with a million rows is
   a planned outage, and must say so.
5. **Does it touch money?** If yes: is the column `numeric(78,0)` or a scaled `bigint`, is it
   non-negative with direction held separately, and does the role have `INSERT` only?
6. **Does it store `user_id`?** If yes, is this service subscribed to `identity.user.deleted`,
   and what does §11.2 say it does on erasure?
7. **Does it need a cross-service reference?** It is a URN string with no foreign key.
8. **Does it change a published contract?** Name the contract package and confirm
   `contract-compat.yml` passes. If it does not, §4's breaking-change procedure applies.
9. **Does anything need to emit an event?** If another service's behaviour depends on this
   change, an outbox row in the same transaction is mandatory.
10. **What is the retention, and where is it written down?** A table absent from §11 has no
    retention, which means forever, which is a decision and must be a deliberate one.
11. **Is there a rollback?** Either the migration is additive and rollback is deploying the old
    image, or state the forward-fix migration that undoes it.
12. **Which test proves it?** Name the test and the behaviour it asserts, per
    [14-testing-strategy.md](14-testing-strategy.md). "Covered by existing tests" is not an
    answer.
