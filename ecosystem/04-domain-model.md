# 04 — Domain model

The shared language. Every entity below names its owning service, its identity, its lifecycle
and the invariants that must hold. Where an entity replaces something that exists today, the
replacement is stated.

Field lists are indicative of shape and constraint, not final DDL. What is binding is the
**ownership**, the **identity**, the **states** and the **invariants** — those are what other
services depend on.

---

## 0. Conventions

- **Identity.** All ids are UUIDv7 (time-ordered, so they index well and sort chronologically),
  except where an external system dictates otherwise (chain addresses, transaction hashes).
- **Amounts.** Every on-chain amount is a smallest-unit integer stored as `numeric(78,0)`.
  Every fiat or Shard amount is a scaled integer. **No floats anywhere in money.** The current
  estate stores these as TEXT; the ledger uses `numeric` so the database can enforce arithmetic.
- **URNs.** Cross-service references use `cf:<service>:<type>:<id>` — e.g.
  `cf:market:listing:0192…`, `cf:mint:token:0192…`. This is what lets activity records,
  notifications and audit events point at anything without a foreign key.
- **Time.** `timestamptz`, UTC, always. Business dates are separate explicit columns.
- **Soft delete does not exist.** Records have lifecycle states. Erasure is a distinct,
  audited operation driven by `identity.user.deleted`.

---

## 1. Identity

### 1.1 `user` — owned by `identity`

The account. One row per person. Replaces today's `users` table, extended.

| Field | Notes |
| --- | --- |
| `id` | The cross-cutting key. Appears in fourteen databases. |
| `email`, `email_verified_at` | Normalised to lowercase **on write** — today register/login match verbatim while forgot-password matches `lower(email)`, which is a live inconsistency. |
| `handle` | Unique, `3–20`, `[a-zA-Z0-9_-]`. The public display identity. |
| `password_hash` | scrypt today; a `hash_algo` column is added so the work factor is recorded and upgradable. |
| `status` | `active · suspended · locked · pending_deletion · deleted` |
| `roles` | Retained for platform roles only (`admin`). Product permissions move to organisation roles and entitlements. |
| `created_at`, `last_seen_at` | |

**Invariant.** A `user` row is never hard-deleted while any service still holds records
referencing it. Deletion is: `pending_deletion` → `identity.user.deleted` published → every
subscriber acknowledges → `deleted` (tombstone retaining only `id` and dates).

### 1.2 `profile` — owned by `identity`

Split from `user` because it is read by every product and written rarely.
`display_name`, `avatar_asset_urn`, `bio`, `links[]`, `country`, `locale`, `timezone`,
`visibility`.

**This is what makes "one identity" true** (test 2 in [01-product-vision.md](01-product-vision.md)).
Today the only identity a product can render is a handle.

### 1.3 `credential` and `mfa_factor` — owned by `identity`

`mfa_factor`: `id`, `user_id`, `kind` (`totp · webauthn · recovery_code · sms`), `label`,
`secret_enc`, `status` (`pending · active · revoked`), `last_used_at`, `created_at`.

**Invariant.** A user with any active factor cannot have all factors removed in one operation;
removing the last factor requires re-authentication and produces a notification.

### 1.4 `session` and `device` — owned by `identity`

Neither exists today; `refresh_tokens` rows exist but nothing names or surfaces them.

- `device`: `id`, `user_id`, `fingerprint_hash`, `user_agent_family`, `os_family`, `first_seen_at`,
  `last_seen_at`, `trusted_at`, `label`.
- `session`: `id`, `user_id`, `device_id`, `refresh_family_id`, `ip_prefix` (truncated — /24 or
  /48, never the full address), `created_at`, `last_active_at`, `revoked_at`, `revoke_reason`.

**States:** `active → expired | revoked | superseded`.
**Invariant.** Every refresh-token family maps to exactly one session, so "sign out everywhere"
is one operation and the device list is truthful.

### 1.5 `organisation`, `team`, `membership` — owned by `identity`

Does not exist today. Needed by the developer platform (projects belong to organisations),
by Forge Market (verified project teams) and by billing (who pays).

- `organisation`: `id`, `slug`, `name`, `kind` (`personal · team · project`), `status`.
  Every user gets a `personal` organisation at registration, so there is never a code path that
  handles "no organisation".
- `membership`: `organisation_id`, `user_id`, `role` (`owner · admin · member · billing · read`),
  `invited_by`, `accepted_at`.

**Invariant.** An organisation always has at least one `owner`. The last owner cannot leave or
be demoted — the same rule Nimbus already enforces for the last platform admin.

---

## 2. Money — the ledger

The largest change in the estate. Replaces the single-sided `ledger` table described in
[00-current-state.md](00-current-state.md) §3.3.

### 2.1 `account` — owned by `ledger`

The chart of accounts. Every unit of value in the platform sits in exactly one account.

| Field | Notes |
| --- | --- |
| `id` | |
| `subject` | `user:<id>` · `community:<id>` · `organisation:<id>` · `platform` · `custody` · `clearing` |
| `type` | `liability` (what we owe users) · `asset` (what we hold on chain) · `revenue` · `expense` · `equity` · `clearing` |
| `asset_code` | `SHARD` · `EMBER` · `BTC` · `ETH` · `SOL` · `XRP` · `USD` · `TOKEN:<urn>` |
| `purpose` | `available` · `reserved` · `escrow` · `treasury` · `fees` · `payout_due` · `suspense` |
| `status` | `open · frozen · closed` |

**Account key is `(subject, asset_code, purpose)` and is unique.** That single fact is what
lets a user balance, a community treasury, a marketplace escrow and a platform revenue line all
live in one double-entry system with no special cases.

**The available/reserved split is modelled as two accounts, not two columns.** Reserving funds
is a posting from `available` to `reserved`, which means a reservation is auditable, reversible
and impossible to lose track of. Today no reservation concept exists at all.

### 2.2 `journal_entry` and `posting` — owned by `ledger`

Append-only. The financial source of truth.

`journal_entry`: `id`, `occurred_at`, `recorded_at`, `kind`, `description`,
`originating_service`, `actor` (`user:<id>` · `service:<name>` · `operator:<id>` · `system`),
`correlation_id`, `idempotency_key` (unique), `reverses_entry_id`, `metadata`.

`posting`: `id`, `entry_id`, `account_id`, `direction` (`debit`/`credit`), `amount`
(`numeric(78,0)`, always positive), `asset_code`, `sequence`.

**Invariants, enforced in the database, not in application code:**

1. **Σ debits = Σ credits per entry, per `asset_code`.** A deferred constraint trigger. This is
   the check that the trial-balance panel in [02](02-target-architecture.md) §6.2 monitors.
2. **Postings are immutable.** No `UPDATE`, no `DELETE`. Revoked by `INSERT` privilege only.
3. **A correction is a new entry with `reverses_entry_id` set.** Never an edit.
4. **`idempotency_key` is unique** and claimed in the same transaction as the postings — the
   shape `withIdempotency` already gets right today and which the ledger keeps.
5. **A liability account may not go negative** unless its `overdraft_allowed` flag is set
   (used only for `clearing` and `suspense`).

**Entry kinds** — the closed set, which is also the audit vocabulary:
`deposit_credited · withdrawal_requested · withdrawal_settled · withdrawal_refunded ·
conversion · transfer · purchase · subscription_charge · fee_charged · reward_granted ·
item_issue · market_escrow · market_settled · royalty_paid · trading_fill ·
performance_fee · creator_payout · treasury_spend · adjustment ·
reconciliation_correction · reversal`.

**Closed means a caller may not invent one, and two services have proved what that costs.**
`foresight.settlement_fee` posted nothing for months; `item_issue` — micro-tessera's object
issuance — was refused on every attempt, so not one Tessera object was ever brought into the
books. Both were invisible because the kind is a `string` on the client's request type: the
compiler had nothing to say, and micro-ledger's `validateEntryRequest` answered `400
invalid_entry` at runtime. A client whose `kind` field is typed `EntryKind` cannot compile the
mistake, and that — not a wider vocabulary — is the remedy. Adding a kind is a deliberate act
in three places at once: `ENTRY_KINDS` in `contracts-money`, a **new** micro-ledger migration
re-declaring `journal_entries_kind_chk` (migration text is checksummed, so an applied one may
never be edited), and this list. `ledger/src/migrations.test.ts` asserts the first two are
equal in both directions, so a half-done change is red rather than silent.

### 2.3 `balance` — owned by `ledger`

A **projection**, not a source of truth. `(account_id, asset_code) → amount, as_of_entry_id,
updated_at`. Maintained transactionally with each entry, and **rebuildable from the journal by
replay**. A nightly job rebuilds a shadow copy and compares; a mismatch is a P0 alert.

This is the difference from today, where `wallets.shards` *is* the truth and nothing can check
it.

### 2.4 `reconciliation_run` — owned by `ledger`

`id`, `chain`, `network`, `asset_code`, `started_at`, `finished_at`,
`ledger_custody_total`, `indexer_observed_total`, `drift`, `status`
(`clean · drift_within_tolerance · drift_exceeded · failed`), `notes`.

**The invariant the whole platform rests on:** for each asset, the sum of user liability
accounts must equal the sum of custody asset accounts, and the custody asset total must equal
what the indexer observes on chain, within a stated per-chain tolerance (fees in flight).
Exceeding tolerance **freezes withdrawals for that asset** and pages. Nothing like this exists
today — and `convertCoinToEmber` currently credits custodial EMBER with no on-chain movement at
all, which is exactly the class of bug this catches.

---

## 3. Wallets and addresses

Resolves the "wallet means three things" collision recorded in [00](00-current-state.md) §5.

### 3.1 `wallet` — owned by `wallet`

The user-facing concept. One row per wallet a user has, of any origin.

| Field | Notes |
| --- | --- |
| `id`, `user_id` | |
| `origin` | `managed` (we hold the key) · `external` (they hold the key, verified) · `watch` (address only, unverified) |
| `chain`, `network` | `network` is `mainnet` or `testnet`, never inferred |
| `address` | Canonical form per family (EIP-55 for EVM/Ember) |
| `label` | User-supplied |
| `is_primary` | At most one per `(user_id, chain, network)` — partial unique index |
| `status` | §3.2 |
| `custody_key_urn` | Present only when `origin = managed` |
| `created_at`, `verified_at`, `exported_at`, `retired_at` | |

**States.** `provisioning → active → { frozen, exported, retiring → retired }`

- `frozen` — set by policy or an operator; cannot send, can still receive.
- `exported` — the user has taken the private key (AD-13). Irreversible. The platform stops
  sweeping into treasury from it and every UI marks it self-custodied.
- `retired` — the user has ended the platform's use of it. No new deposits assigned.

**Invariant.** A `managed` wallet's key never leaves custody except through the export ceremony,
and an export is a state transition, not a read.

### 3.2 `external_wallet_link` — owned by `wallet`

`wallet_id`, `challenge_nonce`, `scheme` (`eip4361 · solana_signmessage · bip322 ·
xrp_signed_memo`), `signature`, `verified_at`, `revoked_at`, `authorisations[]`.

`authorisations` is the closed set of what a verified external wallet may do:
`withdrawal_destination · token_owner · community_membership · governance_vote ·
market_settlement`. Each is granted explicitly and revocable individually — "disconnect a
wallet" is revoking all of them plus the link.

**Invariant.** An unverified (`watch`) address may only contribute to portfolio display. It can
never be a withdrawal destination or an ownership proof.

### 3.3 `custody_key` — owned by `custody`

Never leaves the service. `address`, `chain`, `network`, `family`, `purpose`
(`deposit · treasury · deployer · user`), `user_id`, `scheme` (`flat_random` for legacy,
`hd_bip44` for new), `derivation_path`, `seed_id`, `key_enc`, `storage`, `status`, `created_at`.

**Two key schemes coexist permanently.** Addresses created before Phase 5 are `flat_random`
with no derivation path and no mnemonic. New addresses are `hd_bip44` derived from a per-(user,
family) BIP-39 seed. Every custody response states the scheme, because it determines which
export formats are offered. Pretending otherwise would mean offering a recovery phrase that
does not exist.

### 3.4 `deposit_address_assignment` — owned by `wallet`

Which wallet is the deposit target for a given `(user, asset, network)`, and since when.
Separated from `wallet` so a rotation is a new assignment rather than a mutated address —
today the address row is mutated and a "regression" in the observed balance freezes crediting
permanently.

---

## 4. Chain data

### 4.1 `block`, `transaction`, `log` — owned by `indexer`

Normalised across five families. `chain`, `network`, `height`, `hash`, `parent_hash`,
`timestamp`, `status` (`pending · included · finalised · orphaned`), `reorg_depth`.

`transaction`: `chain`, `network`, `hash`, `block_height`, `index`, `from`, `to`, `value`,
`fee`, `status` (`pending · success · failed · dropped · orphaned`), `nonce_or_sequence`,
`raw_ref`.

**Invariant.** Every record carries `chain` and `network` and no query may span networks. The
XRP testnet/mainnet address collision recorded in [00](00-current-state.md) §3.5 is exactly
what this prevents.

### 4.2 `address_activity` — owned by `indexer`

The join between chain data and platform concepts: `chain`, `network`, `address`, `direction`,
`asset_code`, `amount`, `tx_hash`, `block_height`, `confirmations`, `first_seen_at`,
`confirmed_at`, `reorged_at`.

**This is what replaces balance-probing**, and it is why deposits get real transaction hashes
and explorer links for the first time.

### 4.3 `confirmation_policy` — owned by `contracts-chain`, consumed by everyone

Per `(chain, network, asset)`: `required_confirmations`, `finality_model`, `reorg_alarm_depth`,
`max_credit_per_window`. Published as an exact-pinned contract package, because
wallet, settlement, custody and indexer disagreeing here means money credited at the wrong
depth.

### 4.4 `outbound_transaction` — owned by `settlement`

`id`, `purpose` (`withdrawal · sweep · treasury_move · deploy`), `chain`, `network`, `from`,
`to`, `asset_code`, `amount`, `fee`, `state`, `raw_tx`, `signed_nonce`, `signed_expiry`,
`tx_hash`, `broadcast_at`, `confirmed_at`, `failure_reason`.

**States.** `planned → building → signed → broadcast → confirmed`, with `stuck` and `failed`
as terminals. **The signed raw transaction is committed before broadcast** — a property the
current withdrawer already gets right and which the split must preserve.

**Invariant.** One in-flight outbound transaction per `(chain, network, from_address)` at a
time, enforced by the job lease keyed on the chain. This is the fix for the lost-payment race.

---

## 5. Assets and creation

### 5.1 `brand_kit` and `asset` — owned by `studio`

`brand_kit`: `id`, `owner_subject`, `name`, `accent`, `palette`, `typography`, `style_prompt`,
`status`. Reusable across token launches, project pages and game content.

`asset`: `id`, `brand_kit_id`, `kind` (`mark · wordmark · favicon · og · social · banner ·
icon · tile · character · terrain`), `spec` (size, format), `storage_url`, `checksum`,
`generation_job_id`, `licence`, `created_at`.

**Invariant.** Every generated asset records the model, prompt, spec and cost that produced it,
so a brand kit is reproducible and a spend is attributable. Today `asset-forge` writes PNGs
into sibling working trees with no record of any of this.

### 5.2 `token` — owned by `mint`

`id`, `owner_subject`, `owner_wallet_id`, `chain`, `network`, `standard`, `name`, `symbol`,
`decimals`, `supply`, `cap`, `features[]` (`mintable · burnable · pausable`), `contract_address`,
`deploy_tx_hash`, `status`, `metadata_uri`, `brand_kit_id`, `project_page_id`.

**States.** `draft → awaiting_payment → paid → provisioning → awaiting_funds → deploying →
deployed`, with `failed` terminal.

**Invariant.** `owner_wallet_id` must reference a wallet the user controls — `managed` or a
verified `external`. The customer's wallet is the contract owner; the platform deployer only
pays gas. This is already true today and must survive the split.

### 5.3 `project_page` — owned by `mint`, rendered by `market`

`id`, `token_id`, `subject`, `description`, `links`, `team[]`, `roadmap`, `risk_disclosures`,
`verification_status`, `community_id`.

**Invariant.** A project page always renders supply, authorities, network and contract address
from the **indexer**, not from the order record — the on-chain reality, not the intent.

---

## 6. Marketplace

### 6.1 `listing` — owned by `market`

`id`, `seller_subject`, `seller_wallet_id`, `item` (`asset_kind` + URN), `quantity`,
`pricing_mode` (`fixed · auction · offers_only`), `price`, `asset_code`, `reserve_price`,
`settlement_mode` (`custodial · onchain`), `royalty_bps`, `platform_fee_bps`, `expires_at`,
`status`, `escrow_reservation_id`.

**States.** `draft → active → { sold, cancelled, expired }`, plus `settling` between a
winning bid and completed settlement.

**Invariant.** Creating an `active` listing for a custodially-settled item **creates a ledger
reservation** moving the item from `available` to `reserved`. A listing that cannot reserve
cannot be listed — that is what makes "sold twice" impossible.

### 6.2 `offer`, `bid`, `order` — owned by `market`

`order` is the settled record: `listing_id`, `buyer_subject`, `amount`, `fees`, `royalty`,
`journal_entry_id` or `outbound_transaction_id`, `settled_at`, `dispute_id`.

**Invariant.** Every `order` references exactly one settlement artefact — a ledger entry for
custodial, an on-chain transaction for non-custodial. An order with neither is a bug that
reconciliation catches.

### 6.3 `collection`, `verification`, `moderation_case`, `dispute` — owned by `market`

`verification`: `subject`, `level` (`unverified · claimed · verified · flagged`), `evidence`,
`reviewed_by`, `reviewed_at`. **Risk indicators are computed, not editorial**: contract has a
mint authority, ownership is renounced or not, supply concentration, age, whether the deployer
wallet is exported. Shown as facts, not as a score.

---

## 7. Play

### 7.1 `title` — owned by `worlds`

Does not exist today, and its absence is why a second game is impossible.
`id`, `slug`, `name`, `status`, `service_url`, `capabilities[]`, `asset_scopes[]`.

### 7.2 `player_profile` — owned by `worlds`

Account-scoped, cross-title. `user_id`, `display_name`, `avatar_asset_urn`, `reputation`,
`equipped_cosmetics`, `sanctions[]`, `age_bracket`, `parental_controls`.

Today the only account-scoped game row is `player_cosmetics(user_id)`. Everything else is
per-world, which is correct for a world and wrong for a player.

### 7.3 `inventory_item` — owned by `worlds`

`id`, `user_id`, `title_scope` (a title id, or `*` for cross-game), `item_urn`, `source`
(`purchase · reward · craft · market · grant`), `quantity`, `bound` (true = non-tradeable),
`acquired_at`, `entitlement_id`.

**This is the join between the economy and play.** An item bought in Forge Market, earned in a
world, or granted by an entitlement all land here, and `bound` is the anti-pay-to-win control:
anything conferring power is `bound` and cannot enter the market.

### 7.4 `world` and per-title state — owned by each title service (`nda`)

Unchanged in shape from today. `worlds`, `tiles`, `players`, `queued_actions`, `reports`,
`communes`, `world_stock`, `player_progress`, `objectives`, `achievements`, `world_events`.

**The boundary:** a title service owns simulation state; `worlds` owns anything that must
outlive a season or cross a title.

---

## 8. Billing

### 8.1 `product`, `price`, `entitlement`, `subscription` — owned by `billing`

`entitlement`: `id`, `subject`, `product_id`, `sku`, `scope` (`platform · title:<id> ·
community:<id>`), `source`, `granted_at`, `expires_at`, `revoked_at`, `quantity`, `metadata`.

Four things today's entitlements lack and every one of them is a live defect:

1. **A product dimension** — so a service can ask "does this user own X *for this title*".
2. **An expiry** — so a season pass ends.
3. **Revocation** — so a refund removes what it paid for.
4. **A service-readable API** — today entitlements are Bearer-only, so **no service can ask
   whether a user owns anything**.

**Invariant.** Every entitlement grant emits `billing.entitlement.granted`. The service that
delivers the thing subscribes. This is what finally builds the private world that is currently
sold and never provisioned.

### 8.2 `usage_record`, `invoice`, `payout` — owned by `billing`

`payout`: `subject`, `period`, `gross`, `platform_fee`, `net`, `status`, `journal_entry_id`,
`destination_wallet_id`. Creator payouts are a ledger movement plus optionally a withdrawal —
never a separate money system.

---

## 9. Community and governance

### 9.1 `community` — owned by `community`

`id`, `slug`, `name`, `kind` (`public · private · token_gated · guild · project · creator`),
`owner_subject`, `join_policy`, `treasury_subject`, `governance_model`, `status`.

`join_policy` is the closed set: `open · invite · token_holding · marketplace_purchase ·
achievement · approval`.

### 9.2 `membership` and `role` — owned by `community`

Roles: `owner · admin · moderator · treasurer · member · guest` plus custom roles with a
capability set. **Token-gated membership is re-evaluated**, not granted once: a scheduled job
re-checks holdings via the indexer and demotes on failure, with a grace period. Membership that
is never re-checked is not token-gating.

### 9.3 `proposal`, `vote`, `execution` — owned by `community`

`proposal`: `id`, `community_id`, `author`, `kind` (`treasury_spend · role_change ·
parameter_change · text`), `body`, `voting_model`, `quorum`, `threshold`, `snapshot_block`,
`opens_at`, `closes_at`, `timelock_until`, `status`, `execution_id`.

**States.** `draft → discussion → voting → { passed → timelocked → executed, rejected,
cancelled }`.

**Voting models**, chosen per community and per proposal kind:
`one_member_one_vote` (guilds, creator communities), `token_weighted` at a snapshot block
(project communities), `reputation_weighted` (game communes), `multisig_threshold`
(treasury spends above a value).

**Invariant.** A `treasury_spend` execution is a ledger posting from the community's treasury
account, gated by the approval threshold **and** a timelock. It cannot be executed twice —
`execution_id` is unique per proposal and carries the ledger idempotency key.

---

## 10. Cross-cutting

### 10.1 `activity_record` — owned by `activity`

`id`, `user_id`, `occurred_at`, `category`, `type`, `subject_urn`, `summary`, `amount`,
`asset_code`, `correlation_id`, `source_event_id`, `visibility`.

**Categories** — the full set the unified feed covers: `account · security · wallet · deposit ·
withdrawal · transfer · conversion · token · ownership · trading · market · reward · community ·
governance · api · billing`.

**Invariants.** Immutable. Written only from the event bus. `source_event_id` is unique, so a
redelivered event does not duplicate a feed entry.

### 10.2 `audit_event` — owned by every service, mirrored to `admin-api`

`id`, `occurred_at`, `actor`, `action`, `resource_urn`, `outcome`, `reason_code`,
`before_hash`, `after_hash`, `correlation_id`, `ip_prefix`.

Written **in the same transaction as the change it describes**. Distinct from `activity_record`
(user-facing narrative) and from logs (sampled, expiring). The mirror in `admin-api` is
hash-chained so tampering is detectable.

### 10.3 `notification` and `preference` — owned by `notify`

`preference`: `user_id`, `category`, `channel`, `enabled`, `digest` (`instant · hourly ·
daily · off`), `min_priority`.

`notification`: `id`, `user_id`, `category`, `priority` (`critical · high · normal · low`),
`template_id`, `params`, `dedupe_key`, `created_at`, `read_at`.

**Invariant.** `critical` security notifications — new device, password change, MFA change, key
export, withdrawal — **ignore preferences and always send on at least one channel.** A user
cannot opt out of being told their key left.

### 10.4 `policy_decision` — owned by `policy`

`id`, `subject`, `action`, `resource_urn`, `decision` (`allow · deny · challenge · review`),
`reasons[]`, `obligations[]`, `evaluated_at`, `rule_versions[]`, `correlation_id`.

Retained for the dispute window. **A decision is a record, not just a return value** — "why was
I blocked" must be answerable months later.

### 10.5 `job` — owned by every service

`id`, `kind`, `key`, `run_at`, `locked_by`, `locked_until`, `attempts`, `last_error`,
`payload`. Unique on `(kind, key)`.

**The lease key names the contended resource, not the row.** This is the single most important
detail in the whole coordination design:

| Job | Key | Prevents |
| --- | --- | --- |
| `chain.withdraw` | `chain:network` | Two withdrawals signed against one nonce — **a permanently lost payment** |
| `chain.sweep` | `chain:network` | Concurrent sweeps from one treasury |
| `address.scan` | `address_id` | — (parallelises safely) |
| `price.refresh` | `global` | Replicas quoting different rates |
| `bot.tick` | `bot_id` | Bot state overwritten from a stale snapshot |
| `bot.settle` | `bot_id:period` | **Double-billed performance fees** |
| `world.tick` | `world_id` | **Double XP and double days-survived** |
| `outbox.relay` | `topic_shard` | Duplicate event delivery |

### 10.6 `outbox` and `inbox` — owned by every service

`outbox`: `id`, `topic`, `key`, `payload`, `created_at`, `published_at`, `attempts`.
`inbox`: `topic`, `event_id`, `received_at`, `processed_at` — unique on `(topic, event_id)`.

---

## 11. What this model deliberately does not have

- **No `product` table in a database.** The product registry is a published contract package
  and a build artefact, because it is read by frontends at runtime and by CI. Making it a row
  is how it ends up declared in eight places again.
- **No cross-service foreign keys.** `user_id` and URNs are references, enforced by contract
  and by the deletion event, not by the database.
- **No "user balance" column anywhere outside the ledger's projection.** Every service that
  wants a balance asks the ledger. A cached balance in a product database is the bug that made
  Crucible's bot state diverge from Pay's.
- **No generic `metadata` JSONB as a substitute for a column.** It exists on entries, assets and
  entitlements for genuinely open-ended data, and adding a field to it that is then queried is
  a schema change deferred, not avoided.
- **No global sequence numbers.** Ordering is per `(topic, key)`. Anything needing a global
  order is asking for a distributed system property that Postgres-per-service does not provide.
