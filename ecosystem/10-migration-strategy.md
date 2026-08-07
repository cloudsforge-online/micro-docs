# 10 — Migration strategy

> ## ⚠ CUTOVER COMPLETE — 2026-08-07
>
> This is "the document to read the night before a cutover". **The cutover happened**, on
> 2026-08-05, and the estate has been public since. Every procedure here is written in the future
> tense about an event now in the past.
>
> It is retained for its rollback and reconciliation procedures, which remain sound and are cited
> from 13 places outside `docs/`. **Nothing in it is scheduled work.** A session looking for work
> should read [33-roadmap-index-and-next-sessions](33-roadmap-index-and-next-sessions.md); a session
> looking for the current deployment path should read
> [26-public-deployment](26-public-deployment.md) and its §0 correction.


How the transformation in [06-ecosystem-workflow.md](06-ecosystem-workflow.md) happens without
breaking anything, losing anything, or crediting anything twice.

This is the document to read the night before a cutover. Every procedure here is written to be
executed by one person at an inconvenient hour, so it states the checks, the numbers and the
stop conditions rather than the intent.

---

## 1. The principle

**Strangler fig, always. Big bang, never.** Every migration in this programme follows the same
four movements, and a migration that cannot be expressed in them is a migration that has not
been designed yet.

| Movement | What happens | The property it preserves |
| --- | --- | --- |
| **Stand up empty** | The new component runs in production, wired to nothing, serving no reads, owning no truth | A deployment failure is a deployment failure, not a data incident |
| **Dual write** | Every mutation goes to both old and new, in the same transaction where possible, with a continuous comparator | The old system remains authoritative and correct throughout |
| **Shadow read** | The new component answers every read in parallel and the answers are compared, but the old answer is returned | Read correctness is proven on production traffic before anyone depends on it |
| **Progressive cutover** | Reads move to the new component by flag, by cohort, by asset, or by route — never all at once — while dual write continues | Reverting is a flag flip, not a restore |

**Retirement is a separate, later, scheduled change.** Turning off dual write and dropping the
old columns is not part of the cutover; it happens weeks afterwards, with its own approval, and
it is the point at which the migration stops being reversible. Collapsing those two into one
release is the single most common way this kind of programme loses money.

**Two rules that hold everywhere.** Nothing is migrated that has not first been measured — the
P0 data census is the number every backfill must reproduce. And no migration step may be the
step that broadcasts a chain transaction; anything on a chain is outside the rollback envelope
entirely.

---

## 2. Repository extraction

Thirteen extractions in P3, five in P4, six in P5. The procedure is identical every time, and it
is executed one repository at a time with the Beacon journey suite as the gate after each — not
after all of them.

### 2.1 Split, preserving history

```
git subtree split --prefix=services/nimbus -b extract/identity
```

**History is preserved, never re-copied.** A fresh copy loses `git blame` on money-adjacent
code, and `git blame` on money-adjacent code is how the question "why does this compare against
`latest - confirmations` and not `latest`" gets answered two years from now. The audit trail on
`forge-pay`, `forge-keyvault` and `crucible` is evidence, not sentiment.

`subtree split` rewrites paths, so the extracted branch has the sub-tree at its root. Push it as
the initial history of the new repository, then apply the target layout on top as ordinary
commits, so the move from `services/nimbus/src/` to `src/` is itself a reviewable commit.

### 2.2 What must travel with the code

The failure mode of an extraction is never the source files. It is the thing that lived one
directory up.

| Must travel | Where it hides today |
| --- | --- |
| Dockerfile, `.dockerignore` | Repo root, not the service directory |
| `tsconfig` base and path aliases | Root config the service extended |
| Test setup, fixtures, the `node --test` invocation | Root `package.json` scripts |
| The exact env-var list the service reads | Spread across `env.ts` and `docker-compose.yml`; the P0 dependency audit is the authoritative list |
| Migration files, or the boot-DDL array pending conversion (§4) | `migrate.ts` |
| Lint, format and editor config | Root |
| Contract package dependencies and their exact pins | Root workspace, including `minimumReleaseAgeExclude` entries |
| `CODEOWNERS`, security policy, issue templates | Root or `.github/` |
| Compose service definition, healthcheck, network membership | `stack/docker-compose.yml` |
| Gateway labels, hostname, path rules | `stack/` gateway config |
| Beacon targets and journeys naming this service | `infra/beacon/src/targets.js` |

The check that catches an omission is not a review: it is that the extracted repository builds,
starts, passes `/readyz` and answers its Beacon journeys **in staging, from the manifest**,
before the source directory is deleted from its old home. The old directory stays in place,
unbuilt, until that has held for a week.

### 2.3 The GHCR trap

A new repository's GitHub Container Registry package **inherits the repository's visibility**.
For a private repository, the package is private, and it stays private even after the repository
is made public. The symptom is specific and misleading:

- `docker login ghcr.io` **succeeds**.
- `docker pull ghcr.io/cloudsforge/<name>:<version>` returns **403 Forbidden** on the manifest.
- Which reads exactly like a missing image, so the first hour is spent re-checking the tag, the
  digest and whether the CI publish step ran at all. It ran. The image is there.

The fix is manual and is not available from the repository's own settings: organisation →
Packages → the package → Package settings → **Change visibility**, and separately **Manage
Actions access** → add the source repository with **Write**. Both are per-package and neither is
inherited from an organisation default.

Consequences, stated as procedure:

1. `cfctl doctor` checks package visibility and Actions access for every entry in the manifest,
   and fails loudly with the exact settings URL. This is cheaper than the runbook paragraph
   nobody reads.
2. Extraction is not complete until an unauthenticated pull of the published image succeeds from
   a machine that has never logged in.
3. Do this at extraction time, not at first deploy. Discovering it during a cutover costs the
   cutover window.

### 2.4 CI wiring

Every new repository's workflow is a call to a reusable workflow in `.github` and contains no
build logic of its own — `service-ci.yml` or `web-ci.yml`, plus `publish.yml`,
`secret-hygiene.yml` and `contract-compat.yml` where applicable. The target from
[03-repository-responsibilities.md](03-repository-responsibilities.md) §5 is **zero repositories
with a bespoke CI file**, and it is measured at every phase gate. A repository that needs a
bespoke step needs a new input on the reusable workflow instead.

Renovate is enabled at organisation level, so a new repository is enrolled by existing, not by
configuration. `cfctl new service` produces the whole set; the target is under an hour from
`cfctl new` to appearing in Beacon.

### 2.5 Archiving the source

Once the successor has served production for a week with journeys green:

1. Delete the extracted directory from the source repository, in its own PR, with the successor
   named in the message.
2. When a repository has nothing left — `platform`, `forge-pay`, `forge-keyvault`, `forge-mint`,
   `crucible`, `ninety-days-after`, `shared-libs` — replace its README with a pointer to every
   successor repository and the commit sha at which each was split.
3. Remove it from `cfctl`'s clone set, from compose, from Beacon targets and from every hardcoded
   product list. There are at least three of the last, and `pull-all.sh` already omits `crucible`
   entirely, which is what happens when those lists are maintained by hand.
4. **Archive read-only. Never delete.** Issue links, PR discussions and the security history are
   referenced from elsewhere and from external write-ups.

---

## 3. The ledger migration

The highest-risk item in the programme. It moves live balances, and there is no version of it
that is safe to do quickly. Phase 4 states the five steps; this is what each one actually
involves.

### Step 1 — Stand up empty

`cloudsforge-ledger` runs in production with its chart of accounts, journal, postings, balances
projection and constraints, and **no data and no callers**. The trial-balance invariant is a
database constraint, not an assertion in application code. Postings are `INSERT`-only at the
database-role level.

**Go/no-go.** Property tests pass: no sequence of operations produces an unbalanced entry or a
negative user liability. The balances projection rebuilds from an empty journal deterministically.
Two replicas run without producing a duplicate posting for one idempotency key.

### Step 2 — Backfill

Convert every historical `pay.ledger` row and every current running balance into opening journal
entries, per user, per asset. Pay's `ledger` is single-sided — one `delta`, no account, no
counter-account, no journal grouping — so this is a conversion, not a copy: each historical row
becomes a two-sided entry against a `clearing:historic` account, and the current balance becomes
an opening entry whose counter-account is `clearing:opening`.

The backfill runs against a restored dump first, as many times as it takes, and is rerunnable
from zero. It is never run incrementally against production.

**Reconciliation checks, all of which must pass, none of which is a tolerance:**

| Check | Required result |
| --- | --- |
| Σ credits − Σ debits across the whole journal | Exactly `0` |
| Per user, per asset: ledger balance vs `wallets.shards` / `coin_balances.amount` | Exactly equal, for **every** row, not sampled |
| Σ user liabilities per asset | Exactly equal to the P0 signed data census |
| Count of users with a non-zero balance | Exactly equal to the census |
| Balances projection rebuilt from the journal vs the projection written during backfill | Byte-identical |
| Any negative liability account | Zero rows |
| `clearing:historic` residual | Explained line by line, or the backfill is wrong |

**Go/no-go.** All seven, on a dump no more than 24 hours old, twice, with the second run
starting from an empty ledger. A single mismatched row stops the migration. There is no
tolerance because there is no legitimate source of a rounding difference: both sides are integer
minor units.

### Step 3 — Dual write

Pay continues to own balances and remains authoritative. Every mutation additionally posts to the
ledger with the same idempotency key. The posting is in the same database transaction where the
services still share one, and behind an outbox row where they do not — never a fire-and-forget
HTTP call, because a dropped call is a silent divergence.

**The comparator** runs as a leased job every five minutes and compares, per user per asset:
Pay's running column against the ledger's projection. It writes a `divergence` row for every
mismatch with the user, asset, both values, the delta and the last mutation on each side.

| Divergence class | Meaning | Action |
| --- | --- | --- |
| Transient, resolves next cycle | Dual-write completed between the two reads | Logged, counted, not alerted below a rate threshold |
| Persistent, one user, one asset | A code path writes Pay and not the ledger | **Page.** Freeze that asset's withdrawals. Find the path, fix, re-backfill that account |
| Persistent, many users | A whole route is missing its posting | **Page.** Freeze withdrawals estate-wide. This is a stop-the-migration event |
| Ledger ahead of Pay | A posting exists for work Pay did not do | **Page.** Worse than the reverse; investigate as a potential duplicate posting |

**Go/no-go for proceeding to step 4: minimum two weeks at zero persistent divergence**, and a
transient rate that is stable rather than growing. The two weeks restart from zero after any
persistent divergence, however quickly it was fixed.

### Step 4 — Read cutover

`wallet` serves balances from the ledger. Pay's columns become write-only shadows. **Dual write
does not stop.**

The cutover is progressive, by asset, smallest exposure first: Shards last, because Shards is
the largest liability and the most-read balance. Each asset moves behind
`p04.wallet.ledger_reads:<asset>`, soaks for 48 hours, and only then does the next one move.

Shadow reads precede each flip: for one week per asset, `wallet` fetches from both and returns
Pay's answer while recording any difference. A shadow-read mismatch is treated exactly as a
persistent divergence.

**The withdrawal freeze procedure**, which is the reason a cutover is survivable:

1. `p04.settlement.withdrawals_frozen:<asset>` is a kill-switch flag; on-call may set it alone,
   immediately, without escalation.
2. Frozen means: no new withdrawal requests accepted for that asset, and no queued request
   claimed by a settlement worker. Already-signed transactions are **not** cancelled — they are
   on a chain or about to be, and are outside the rollback envelope.
3. Deposits, conversions and reads continue. Freezing withdrawals only is the narrowest action
   that stops money leaving against a balance that may be wrong.
4. The user-facing message names the asset and says the freeze is precautionary, because a
   platform holding customer money that goes silent has made two problems.
5. Unfreezing requires two people and a comparator run showing zero divergence for that asset.

**Go/no-go per asset.** Zero shadow-read mismatches for one week · trial balance exactly zero ·
in-flight idempotency keys migrated so that a retry spanning the cutover replays the stored
response rather than performing the work twice · a rehearsal on staging in which the flag is
flipped back and reads return to Pay correctly.

### Step 5 — Retire

Pay's balance columns are dropped and the `/internal/*` omnibus surface is deleted in favour of
scoped, per-caller-authenticated APIs on `ledger` and `wallet`. `PAY_SERVICE_TOKEN` ceases to
exist.

**This happens a month after the read cutover, not with it, and it is the point of no return.**

**Why dual write is retained past the read cutover.** Because that is the *only* thing that makes
step 4 reversible. With dual write running, reverting the read cutover is a flag flip: Pay's
columns are current, correct and continuously verified, so reads return to them with no data
work at all. Switch dual write off at cutover and Pay's columns start ageing from the moment
they stop being written; an hour later there is nothing to revert to and the only remaining
option is a restore, which loses every transaction since the backup. The month of redundant
writes is the cost of keeping an exit, and it is cheap.

---

## 4. Boot-DDL to versioned migrations

Five service repositories ship a hand-rolled `STEPS[]` array of `CREATE TABLE IF NOT EXISTS`
executed in-process before `listen()`. There is no version table, no down path, no advisory
lock, and failure is `process.exit(1)`. Two replicas booting together race on `pg_class`, one
raises 23505 and crash-loops — which is why scale-up is not slow but impossible.

The conversion is per service, one at a time, in **increasing order of criticality**:
`forge-mint`, `crucible`, `ninety-days-after`, `platform`/nimbus, `forge-pay`. The first is the
rehearsal; the last is done with the most practice.

### The procedure, per service

1. **Restore a production dump** into a scratch database. Every step below is proven here first.
   An empty database proves nothing: the whole difficulty is that production's schema is whatever
   the accumulated `IF NOT EXISTS` statements happened to produce, including columns added by
   hand, indexes that exist under a different name, and constraints that were never created
   because the table already existed when the statement was added.
2. **Dump the real schema** (`pg_dump --schema-only`) and diff it against what `STEPS[]` produces
   on an empty database. **The diff is never empty.** Every difference is recorded and classified
   as intentional drift, accidental drift, or dead structure.
3. **Write the baseline migration — `0001_baseline.sql` — to reconcile, not to create.** This is
   the delicate part. It is written against the *restored dump*, and its job is to bring the real
   schema to a known state and record it: every statement is `IF NOT EXISTS` / `IF EXISTS`, it
   adds what the diff says is missing, drops nothing, and ends by inserting version `1` into
   `schema_migrations`. Running it on the restored dump must produce a schema byte-identical to
   running it on an empty database.
4. **Prove idempotence.** Run the baseline three times against the restored dump. Runs two and
   three must be no-ops. Then run it against an empty database and diff against the restored-dump
   result; the two must be identical.
5. **Prove the lock.** Start two migration jobs simultaneously against one database. One acquires
   `pg_advisory_lock`, the other waits and then finds nothing to do. Neither errors.
6. **Ship the runner without shipping the deletion.** The migration job runs as a one-shot job
   before the service starts, and the service's boot-time `STEPS[]` array **stays in place for
   one release**, now a guaranteed no-op because the baseline already created everything. This
   makes the release reversible: the old image still manages its own schema.
7. **Delete `STEPS[]` in the next release.** From this point the conversion is one-way for that
   service.
8. **Verify no downtime was required.** Nothing in steps 1–7 takes an exclusive lock on a table
   the running service uses. The baseline creates only what is missing, and anything requiring a
   rewrite is deferred to a normal expand/contract migration afterwards (§7).

**Stop condition.** If the diff in step 2 contains a structure that production depends on and no
one can explain, the conversion stops until it is explained. Recording an unexplained column into
a baseline version makes it permanent and undocumented at the same time.

---

## 5. Deposit detection cutover

Deposit detection today is balance-probing: every 30 seconds, load every address row with no
pagination, call `eth_getBalance` at `latest - confirmations`, and compare against a high-water
mark. It produces synthetic txids, no history, no reorg detection and a permanent freeze on any
address whose observed balance regresses. The indexer replaces it — but only after **30 days of
shadow parity**, which is a phase exit criterion, not a guideline.

### What "parity" means, exactly

For each 24-hour window in the 30-day period, over every `(address, coin, network)`:

| Dimension | Parity condition |
| --- | --- |
| **Set** | The set of credit events the indexer would produce is identical to the set balance-probing produced. No extra, no missing |
| **Amount** | Identical to the smallest unit of the asset. Not "within rounding" — both are integers |
| **Depth** | The credit is decided at the same confirmation depth, per the exact-pinned `contracts-chain` depth for that coin |
| **Timing** | The indexer's credit decision is no later than the prober's, plus one probe interval (30 s), at p99 |
| **Idempotency** | Crediting remains idempotent on `(address, txid)` throughout, so a double-detection cannot become a double-credit |
| **Enrichment** | The indexer additionally supplies a real chain transaction hash. This is required, but it is an addition, not a parity dimension — the prober has nothing to compare against |

Parity is computed by a job that reads both pipelines' outputs and writes a daily parity record.
The 30 days are consecutive. **Any disagreement resets the counter to zero**, including one that
is explained and fixed the same day, because the thing being proven is that thirty consecutive
days pass without a disagreement.

### On disagreement

| Class | Meaning | Action |
| --- | --- | --- |
| **Indexer-only credit** | The prober missed a deposit — most likely one that arrived and left within a probe interval, which balance-probing structurally cannot see | Investigate, confirm against the chain, and record it. This class is *expected* and is evidence the indexer is better; it still resets the counter, and the credit is applied manually with an audit record |
| **Prober-only credit** | The indexer missed a deposit | **Stop.** The most serious class. Cutover does not proceed until the cause is found — provider gap, checkpoint regression, missed reorg recovery, or an unindexed transfer type |
| **Amount mismatch** | Decimals, token vs native, or an internal transfer | **Stop.** Fix, re-run backfill for the affected chain, restart the 30 days |
| **Depth mismatch** | Wallet, settlement, custody and indexer disagree on confirmation depth | **Stop.** This is exactly why `contracts-chain` is exact-pinned; the fix is a version alignment, not a code change |
| **Timing outside tolerance** | The indexer is lagging | Not a correctness failure. Investigate provider health and lag alerting; does not reset the counter unless it exceeds the confirmation depth |

**Cutover is a flag** (`p05.wallet.indexer_crediting`), per chain family, and the prober keeps
running in shadow for a further 30 days after each flip so that reverting is a flag flip.

**Historical backfill.** Deposit-address history is backfilled into the indexer so past deposits
gain real txids where the chain still has the data. Where it does not — pruned nodes, or chains
the estate never indexed — the synthetic txid is retained and **explicitly marked as synthetic**
in the API and the UI. A fabricated-looking hash that is silently not a hash is worse than an
honest label.

---

## 6. Custody key migration

**Flat-random keys cannot become HD keys.** Custody today generates one independent random key
per address. An HD wallet derives every key from one seed at a path. There is no function that
turns the former into the latter — the seed that would produce an existing random key does not
exist and cannot be found. This is arithmetic, not a scheduling problem, and no amount of
migration effort changes it.

**Therefore: two schemes coexist permanently.** Not "until we finish", not "for a transition
period". Written down here so it is never rediscovered as a surprise.

| | `flat` (pre-P5) | `hd` (P5 onward) |
| --- | --- | --- |
| Origin | One random key per address | BIP-39 seed per (user, chain family), addresses at `m/44'/<coin>'/<account>'/0/<index>` |
| Recovery phrase | **None exists** | Yes |
| Derivation path | None | Recorded |
| Export formats | Encrypted keystore (default), raw hex, WIF (Bitcoin), XRP family seed | All of those, **plus** the BIP-39 mnemonic |
| New addresses | Never again | All new addresses |

### How it is surfaced

- Custody returns `keyScheme: "flat" | "hd"` on every address response. The wallet registry
  stores it. It is never inferred from an address's age or index.
- The Hub wallet detail view states it in words, not in a badge: "This wallet was created before
  recovery phrases were supported. It has no recovery phrase. You can export its private key."
- The export ceremony offers the mnemonic format only for `hd` wallets, and explains its absence
  for `flat` ones at the point of choosing rather than after.
- Support tooling and the admin console show the scheme on every key record, because "why can't
  this user get a phrase" is otherwise a recurring investigation.

### What a user can do about it

One path, and it is user-initiated: provision a new HD address and move the funds. The platform
**never** does this automatically. Sweeping a user's balance between addresses without consent is
a movement of customer funds for the platform's architectural convenience, and it would be
indistinguishable from a compromise in the audit trail.

Old addresses are monitored forever regardless. A deposit address that has been shared with a
third party will receive deposits years after it stops being offered, and an address the indexer
stops watching is a deposit that is silently lost.

---

## 7. Contract package migration

`@cloudsforge/shared` 0.5.0 and `@cloudsforge/ui` 0.6.0 are committed and unpublished; CI's
`NPM_TOKEN` is dead; and every consumer pins `^0.4.0` / `^0.5.0`, which **cannot resolve
`0.5.0`** because caret on `0.x` is patch-only. So the estate's contract packages are
simultaneously ahead of and unreachable by their consumers.

The split is eight packages at `1.0.0`, published to GitHub Packages with the workflow's own
`GITHUB_TOKEN`.

### Order

Lowest blast radius first, so the machinery is proven on packages that cannot cost money:

| # | Package | Why here |
| --- | --- | --- |
| 1 | `contracts-events` | New. Zero existing consumers. Proves publish, Renovate and `contract-compat.yml` end to end with nothing at risk |
| 2 | `contracts-devplatform`, `contracts-market` | New, no consumers until P9/P11 |
| 3 | `contracts-auth` | Real consumers, but shapes are stable and a mistake is a build failure, not a wrong number |
| 4 | `contracts-create`, `contracts-worlds` | Moderate churn. **`game.ts`'s 535 lines of `SKILL_PERKS`, `survivalScore`, `xpToNext` and `communeWithdrawCap` leave contracts entirely** and land in `cloudsforge-nda`; game rules are not a platform contract |
| 5 | `contracts-money` | Real money shapes. Moved only once 1–4 have shipped and Renovate has demonstrated sub-24-hour propagation twice |
| 6 | `contracts-chain` | Last, and **exact-pinned by every consumer**. `RATE_SCALE`, `shardsForCoinAmount()` and the per-coin confirmation depths must agree byte-for-byte between wallet, settlement, custody and indexer, or money is credited at the wrong depth |

The dead invoice contract is deleted rather than migrated — payments are crypto-native and the
invoice path no longer exists.

### Compatibility window

- `@cloudsforge/shared` 0.4.x stays published and resolvable throughout. Nothing is unpublished,
  so an emergency revert of a *consumer* still installs.
- A consumer may depend on both `shared` and a `contracts-*` package while its cutover PR is open;
  it may not merge with both. One PR per consumer per package, and the old import disappears in
  the same commit the new one appears.
- These workspaces set `verifyDepsBeforeRun: error`, so a version missing from
  `minimumReleaseAgeExclude` breaks **every command in the repository**, not just install. The
  `minimumReleaseAgeExclude` entry must therefore be in the same commit as the version bump — not
  a follow-up — or the cutover PR bricks the repository for anyone who pulls it. Renovate takes
  this over afterwards; for `@cloudsforge/*` scoped packages the release-age gate may instead be
  dropped outright, since it exists to defend against supply-chain attacks on third-party
  packages and these are first-party.
- The window closes at the P2 gate: **every consumer is off `@cloudsforge/shared` before the
  first repository is split in P3.** Splitting repositories while consumers still resolve an
  unpublishable package multiplies one problem by thirteen.

---

## 8. Expand/contract discipline

A rolling deploy always runs two versions of a service against one schema. Therefore **no schema
change may be incompatible with the version currently deployed**. This is not advice; it is the
constraint that makes zero-downtime deploys possible at all, and it is mandatory from P2.

The rule: **never more than one of expand or contract in a single release.**

### Worked example — adding `title_id` to `nda`, P5

The worlds/nda split requires every `nda` table to carry a `title_id`, ultimately `NOT NULL`.
Done naively — `ALTER TABLE ... ADD COLUMN title_id uuid NOT NULL` — the old replica, which does
not write the column, starts failing every insert the moment the migration lands, and the table
is rewritten under an exclusive lock while the game is being played.

Done properly, across four releases:

| Release | Step | Migration | Code |
| --- | --- | --- | --- |
| **R1 — expand** | Add the column, nullable, no default backfill | `ALTER TABLE players ADD COLUMN title_id uuid NULL` — metadata-only, no rewrite, no long lock | Writers write `title_id` on every insert and update. Readers ignore it entirely. Old replicas still work: the column is nullable |
| **R2 — backfill** | Fill historical rows | A leased job in batches of 5,000 with a sleep between batches, resumable, idempotent, tracked by a `backfill_progress` row. Never one statement over the whole table | Unchanged. The backfill is a job, not a migration, so a deploy cannot be blocked by it |
| **R3 — read + constrain** | Readers depend on it; the constraint is validated without a long lock | `ALTER TABLE players ADD CONSTRAINT players_title_id_not_null CHECK (title_id IS NOT NULL) NOT VALID` then, separately, `VALIDATE CONSTRAINT` — which takes only a `SHARE UPDATE EXCLUSIVE` lock | Readers require `title_id`. Verified first by a query proving zero nulls; if it returns rows, R3 does not ship |
| **R4 — contract** | Remove the old path | Optionally convert the validated check to a real `NOT NULL` | Any dual-write or fallback code is deleted |

**Gate between each release: one full release train.** R2 does not ship in the same train as R1,
because the point is that R1 has been live on every replica before anything depends on it.

**The same shape applies to every rename**, which is why renames are three releases and not one:
add the new column, dual-write both, migrate readers, stop writing the old, drop the old. A
rename shipped as `ALTER TABLE ... RENAME COLUMN` is an outage with a commit message.

---

## 9. Data erasure during migration

`identity.user.deleted` is a contract: every service storing `user_id` subscribes and must
acknowledge within its stated SLA ([02-target-architecture.md](02-target-architecture.md) §4). It
does not exist today, and it is the GDPR erasure path. Fourteen databases carry `user_id` as a de
facto foreign key with no constraint, so erasure is a choreography, not a cascade.

### What is deleted, and what is tombstoned

| Data | Service | Disposition |
| --- | --- | --- |
| Credentials, MFA factors, sessions, devices, refresh families, exchange codes | `identity` | **Deleted** |
| Profile, handle, email, avatar, preferences | `identity`, `hub-api` cache | **Deleted** |
| Notification preferences, delivery history bodies | `notify` | **Deleted**; delivery *counts* retained aggregated |
| Activity records | `activity` | **Deleted** — it is a narrative, and the underlying domain facts survive where required |
| Wallet labels, primary flags, external wallet links | `wallet` | Labels deleted; the link record tombstoned, because a verification proof is evidence |
| Journal entries, postings, balances | `ledger` | **Never deleted.** Tombstoned by subject rename |
| Deposits, withdrawals, settlement records, chain transactions | `wallet`, `settlement`, `indexer` | Tombstoned. On-chain data is not the platform's to erase and is public regardless |
| Orders, listings, sales, disputes | `market`, `billing` | Tombstoned; counterparties' records reference them |
| `audit_events`, custody `key_events`, `signing_audit`, export records | all | **Never deleted.** An audit record that can be erased by its subject is not an audit record |
| Game simulation state | `nda` | Player record deleted; world history tombstoned, because other players' worlds reference it |
| Pseudonymised events | `analytics` | Deleted by `subject_key` |

**Tombstoning means:** the row survives, its personal fields are nulled or replaced with a
non-reversible token, and its `user:<id>` subject becomes `erased:<tombstone-id>`. Amounts,
timestamps, correlation ids and account structure are untouched.

**Why financial records cannot be erased.** Three independent reasons, any one of which is
sufficient. Legal retention obligations outlast an erasure request. The trial balance must remain
exactly zero — deleting one side of a journal entry violates a database constraint, and deleting
both destroys the counterparty's record as well as the subject's. And a ledger whose history can
be removed on request cannot be reconciled, which is the entire point of building it. The user is
told this plainly: their identity is erased, their financial history is anonymised and retained.

### Choreography

1. `identity` marks the account `erasure_pending`, revokes every session and token, and emits
   `identity.user.deleted` with the `user_id` **and the `subject_key = HMAC(user_id,
   analytics_pepper)`**. The second field matters: `analytics` never receives a `user_id` (AD-21)
   and therefore cannot compute the key itself, so if the event does not carry it, the analytics
   rows become unerasable the moment the identity row is gone.
2. Each of the fourteen services performs its disposition and acknowledges with the record counts
   it deleted and tombstoned.
3. `admin-api` maintains the erasure register: which services have acknowledged, which have not,
   and the age of the request. An unacknowledged service past its SLA pages.
4. `identity` finalises only when every subscriber has acknowledged. Erasure is complete when the
   register says so, not when the event is emitted.

**During the migration specifically:** a service being extracted or split must carry its
`identity.user.deleted` subscription with it, and a service that exists on both sides of a
cutover — Pay and ledger during dual write — must apply erasure to both, or the retired system
becomes a copy of data the user asked to have removed.

---

## 10. Per-migration checklist

Copy this into the migration's PR. Every unchecked box is a stop.

```
## Migration: <name>            Owner: <person>      Release: <version>

### Before
- [ ] Written against a restored production dump, not an empty database
- [ ] The dump used is < 24h old and its restore was verified
- [ ] Rehearsed end to end on staging from the release manifest
- [ ] Rollback rehearsed on staging, and it worked
- [ ] Expand/contract classified: this release contains expand OR contract, never both
- [ ] No statement takes an ACCESS EXCLUSIVE lock on a table > 100k rows
- [ ] Backfills are batched, resumable, idempotent and run as a leased job — not in the migration
- [ ] Runs under pg_advisory_lock; two concurrent runners tested
- [ ] Idempotent: three consecutive runs, runs 2 and 3 are no-ops
- [ ] Old and new service versions both work against the post-migration schema

### Evidence
- [ ] Reconciliation checks defined, with exact expected values (not tolerances)
- [ ] The comparator or parity job is deployed and reporting before the cutover
- [ ] Baseline captured: row counts, sums per asset, p95 per affected route

### Safety
- [ ] Kill-switch flag exists, named, owner recorded in the manifest
- [ ] Freeze procedure written for the affected asset/domain, and who may invoke it alone
- [ ] Alert routed to on-call with a runbook link
- [ ] identity.user.deleted handling applies to both old and new stores
- [ ] Nothing in this step can broadcast a chain transaction

### Cutover
- [ ] Progressive: by asset / cohort / route. Not all at once
- [ ] Soak duration stated and started from zero after any divergence
- [ ] Go/no-go criteria written down before the window, not decided during it
- [ ] Two people present for a production money migration

### After
- [ ] Journeys green, three consecutive runs
- [ ] p95 within 20% of the P0 baseline
- [ ] Trial balance exactly zero (from P4 onward)
- [ ] Retirement scheduled as a SEPARATE later change with its own approval
- [ ] Flag removal scheduled within two releases
```

---

## 11. What cannot be rolled back

Enumerated so that the irreversibility is a decision made in advance rather than a discovery made
at 03:00.

| Action | Phase | Why | The mitigation that replaces rollback |
| --- | --- | --- | --- |
| **Dropping Pay's balance columns** (ledger step 5) | P4 | No second copy of a balance remains. Only a restore, which loses everything since the backup | A month of dual write past the read cutover, then a separately approved change |
| **Deleting `POST /admin/keys/:address/reveal`** | P5 | Deliberately irreversible; restoring an any-key-to-any-admin exfiltration primitive under pressure is the scenario it must not survive | The two-operator break-glass runbook ships and is rehearsed in the same release |
| **Deleting `STEPS[]` after the boot-DDL conversion** | P2 | The old image can no longer manage the schema it finds | Runner and array coexist for one release; conversion proven on a restored dump first |
| **Contract packages at `1.0.0`** | P2 | `0.x` cannot be returned to after `1.x` is published | `0.4.x` stays published and resolvable indefinitely |
| **A broadcast chain transaction** | any | Nothing on a chain is reversible. Ever | No migration step may broadcast. Freezes stop *new* signing; already-signed transactions are allowed to complete |
| **A completed key export** | P6 | The secret has left. The `active → exported` transition is one-way by design | 24-hour cooling-off with a cancel link, notification on every channel, second MFA on redemption |
| **A sweep of user funds to treasury** | P4/P5 | An on-chain movement | Treasury pin and purpose gate in custody; sweeps are never part of a cutover step |
| **Erasure under `identity.user.deleted`** | P6+ | Deleted rows are gone; that is the point | Two-stage: `erasure_pending` with a cancellation window before dispositions execute |
| **Archiving a legacy repository** | P3–P5 | Reversible in principle; in practice the successor has diverged for a week | Archive read-only, never delete; README names every successor and its split sha |
| **Analytics pseudonymisation** | P13 | `subject_key` is an HMAC; the `user_id` cannot be recovered from it | Intentional. The support question it prevents is answered by `admin-api` against the owning service, with an audit record |

Everything not on this list is expected to roll back by checking out the previous release
manifest. If a change belongs on this list and is not on it, that is the defect — not the
irreversibility.
