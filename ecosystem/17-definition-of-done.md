# 17 — Definition of done

Completion in this programme is **verified, never declared.** Every level below — an item, a
service, a frontend, a phase, the migration, the first production release, the ecosystem — has a
checklist whose entries are things someone can go and look at. If a criterion cannot be checked
by a person or a job, it is not a criterion; it is a hope, and it has been rewritten.

This exists because the estate already contains the failure mode it prevents.
[00-current-state.md](00-current-state.md) §7 records five documents that describe a system that
does not exist, and §3.8 records seven things sold as delivered that deliver nothing. Both are
the same failure: something was declared done.

---

## 1. Done, for a backlog item

Every item in [08-prioritised-backlog.md](08-prioritised-backlog.md) satisfies all of this
before it is closed. There is no "done except".

| # | Requirement | How it is checked |
| --- | --- | --- |
| 1 | **Code merged to the default branch**, reviewed, no `TODO` naming this item | Branch protection; grep for the item id |
| 2 | **Tests that fail without the change.** A regression fix carries a test named for the defect | The test is run with the fix reverted, once, and must fail |
| 3 | **Contract compatibility.** Additive only, or a stated exception with a migration plan | `contract-compat.yml` — fails on a removed field, a narrowed type, a renamed key |
| 4 | **Consumer contract tests pass** for every recorded consumer of anything it touches | The provider's CI replays every consumer expectation (AD-04) |
| 5 | **Telemetry.** New work emits a trace span; new failure modes emit a metric; new domain facts emit an outbox event | The trace is viewable in Grafana for one real request |
| 6 | **Documentation updated in the same PR** — the repo's `MAP.md` and any affected document in `docs/ecosystem/` | Review. A doc PR that follows later does not count |
| 7 | **Runbook, if it can page.** Anything with an alert has a runbook link in the alert rule | CI on the alert rule fails without a runbook URL |
| 8 | **Feature flag**, with the default stated and the owner named | The flag appears in the release manifest's flag set |
| 9 | **Rollback plan**, written, specific — a revert, a flag flip, a manifest rollback, or "irreversible, and here is why that is acceptable" | Review |
| 10 | **No new muted journeys**, and no journey muted to make this green | The muted count before and after are compared at merge |
| 11 | **Audit event** if the change adds a privileged action | The action appears in `audit_events` in the same transaction as the change |
| 12 | **No SKU without a delivery path** if the change touches a catalogue | The automated catalogue-versus-handler test |

---

## 2. Done, for a service

Every one of the ~24 services in [02-target-architecture.md](02-target-architecture.md) §3
satisfies this. `cloudsforge-service-template` ships with all of it already wired, which is what
makes the list affordable rather than aspirational — the target is a new service reaching every
line below **in under an hour** ([03](03-repository-responsibilities.md) §5).

**Data and schema**

- [ ] Owns **exactly one** database and reads no other. Enforced by a CI check for connection
      strings other than its own env var, *and* by a per-service Postgres role with no grants on
      other schemas.
- [ ] **Versioned migration files**, run by a **one-shot job** under `pg_advisory_lock`, never
      in `index.ts`. Expand/contract only, because a rolling deploy always runs two versions
      against one schema.
- [ ] Migrations proven idempotent against a **restored dump**, not an empty database.
- [ ] Backup scheduled, off-host, and **restore verified** — a dump file is not a backup.

**Runtime contract**

- [ ] `/livez` — static, no dependencies.
- [ ] `/readyz` — checks Postgres, JWKS and every declared upstream. Verified by killing
      Postgres and observing a 503.
- [ ] `/metrics` — Prometheus, scraped.
- [ ] OTLP **traces and logs**, with `trace_id` and `span_id` on every log line and
      `x-request-id` retained as the human-quotable alias.
- [ ] Graceful shutdown: SIGTERM → `ready=false` → serve for one load-balancer interval → stop
      claiming jobs → drain → exit.
- [ ] **Every background timer is a leased job** with the lease key naming the *contended
      resource*, not the row ([04](04-domain-model.md) §10.5). A `setInterval` doing domain work
      fails review.

**Integration**

- [ ] **Outbox** written in the same transaction as every state change others care about.
- [ ] **Inbox** deduping on `(topic, event_id)`.
- [ ] Subscribes to **`identity.user.deleted`** and acknowledges within its stated SLA. This is
      the GDPR erasure path and it is not optional for any service storing `user_id`.
- [ ] **Scoped service tokens**, per caller, never a shared bearer secret.
- [ ] **Per-service secrets.** The repo declares the variables it needs and the deploy provides
      exactly those. `env_file: .env` fan-out is banned.
- [ ] A **published contract package**, versioned, additive-only, schema-diff enforced.
- [ ] **Consumer contract tests** recorded by every consumer and replayed by this service's CI.

**Operability**

- [ ] At least one **Beacon journey** exercising its primary user-visible path.
- [ ] A **Grafana Service Detail dashboard** instance, with exemplar links into Tempo.
- [ ] A **runbook** covering: what it does, what breaks, what each alert means, how to restart
      it safely, and how to restore it.
- [ ] **Audit events** for every privileged action, written in the same transaction as the
      change, mirrored to `admin-api`.
- [ ] Named in the **release manifest**, deployable and rollbackable by manifest alone.
- [ ] Calls the **reusable workflow** from `.github`. A bespoke CI file is a failure of this
      checklist, not an exception to it.

---

## 3. Done, for a frontend

- [ ] **Design system from `@cloudsforge/ui`, imported, never vendored.** Five copies of the
      `--cf-*` tokens already exist and two have drifted ([00](00-current-state.md) §3.7); a
      sixth is a regression.
- [ ] **Runtime host resolution** via `cloudsforgeHosts()`. No build-time API URLs, because a
      build-time URL means one bundle per environment.
- [ ] **No secrets.** A frontend receives none, ever.
- [ ] **Browser telemetry**: page load, first paint, failed fetches, unhandled rejections and
      errors, tagged with the same trace id as the server span that caused them.
- [ ] **Auth callback handling**: the origin-bound SSO handoff, return URLs preserved through
      the round trip, and a truthful signed-in state — `site`'s `Layout.tsx` hardcoding
      `signedIn: false` on the page that promises one account is the anti-example.
- [ ] **Accessibility pass**: keyboard navigation, focus order, contrast, labelled controls, and
      **colour never carrying meaning alone** — status marks ship icon plus label plus colour.
- [ ] **Charts follow [assets/chart-palette.md](assets/chart-palette.md)**: the validated
      categorical palette, **never a dual axis** (two measures become two stacked panels sharing
      an x-axis), money never plotted without its unit and its pricing timestamp, ≤4 series
      direct-labelled, and **every chart has a table view** as the accessibility fallback and
      the export path.
- [ ] **Empty, error and loading states are visually distinguishable.** A chart that cannot load
      says so; an empty chart and a broken chart must not look identical.
- [ ] **Per-tile degradation** where the page aggregates: one dead upstream hides one tile, not
      the page.
- [ ] **No business logic that is not also enforced server-side.** The game client is the
      standing counter-example: it withheld four SKUs from the UI while Pay's routes stayed live
      and chargeable, and its own source says so.

---

## 4. Done, for a phase

Every phase in [06-ecosystem-workflow.md](06-ecosystem-workflow.md) uses one pattern:

1. **Entry criteria met** — the prior phase's exit criteria, verified, not assumed.
2. **Every exit criterion demonstrated**, each one as an artefact: a passing job, a dashboard
   screenshot with a timestamp, a recorded demonstration, or a signed data file.
3. **The rollback strategy exercised at least once**, on staging, not merely written.
4. **The cross-phase requirements green** — all ten, below.
5. **The three topology mitigations reviewed** ([03](03-repository-responsibilities.md) §5):
   Renovate lag, bespoke CI file count, time to stand up a service. These are the early warning
   that the repository decision is costing more than it returns, and they are checked at *every*
   gate, not once.
6. **Risk register updated** — which risks in [16](16-risks-and-open-decisions.md) this phase
   closed, which it opened, which early-warning signals fired.

### Cross-phase requirements

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

---

## 5. Done, for the migration — the P5 exit gate

The decomposition is complete when **all eight** of these are true. Not seven.

1. **Indexer parity for 30 days.** Every deposit that balance-probing would have credited, the
   indexer credits — at the same confirmation depth — and the indexer additionally reports a
   **real transaction hash**. Parity is checked in *both* directions: a deposit the indexer
   credits and probing does not is as much a failure as the reverse.
2. **A simulated reorg past the confirmation depth is detected, alerted and recovered without a
   wrong credit**, per chain family.
3. **BTC and SOL withdraw and sweep on testnet** — the two chains that today can do neither.
4. **No route in any service can return private key material**, asserted by a response-body scan
   across the entire route surface, not by inspection.
5. **The master secret is rotated on staging, end to end** — generate v2, re-encrypt, sign with
   the re-encrypted key, verify.
6. **A second title registers against `worlds` and receives an entitlement**, proven with a stub
   title rather than a real game, because the point is the abstraction and not the content.
7. **All 45+ journeys green, p95 within 20% of the P0 baseline, and the trial balance still
   exactly zero.**
8. **Every legacy repository is unambiguously superseded** — its README states that it is legacy
   and points at the repositories that replaced it, and no CI in it deploys or publishes
   anything. **The nine are also archived read-only**, done 2026-08-03: `asset-forge`,
   `crucible`, `forge-keyvault`, `forge-mint`, `forge-pay`, `ninety-days-after`, `platform`,
   `shared-libs` and `stack`.

   This item has now been written three ways, and the history is the useful part. It began as
   "archived read-only"; it was rewritten earlier on 2026-08-03 to *forbid* archiving, on the
   owner's standing instruction "don't delete any existing repo, dont archive them", because a
   gate item instructing a forbidden action can never be closed and would hold the whole gate
   open for ever; and the owner then reversed that instruction the same day and asked for the
   archive directly. Archiving is reversible, which is why the reversal is cheap — but the
   distinction that survived all three revisions is the one to keep: **read-only-ness is the
   means, and *nobody mistakes a legacy repo for a live one* is the end.** The README and CI
   requirements above are therefore not superseded by the archive flag. An archived repo whose
   README still reads like a live one has met the means and missed the end.

   **Two repositories in the org carry no `micro-` prefix and are NOT legacy**, which is the
   trap this item exists to disarm: `hearth` is the EMBER chain itself — live, in the working
   tree, the thing the testnet runs from, and linked from the organization page as Forge Network
   — and `.github` serves that organization page from `profile/README.md`. Absence of the prefix
   is not evidence of being superseded.

---

## 6. Done, for the first production release — the P13 exit gate

- [ ] A **restore drill completes within the stated RTO**, from an **off-host** backup. The
      existence of a dump file is not evidence.
- [ ] **Every alert has a runbook**, and **no alert is routinely silenced**. An alert without a
      runbook is deleted, not muted.
- [ ] The **public status page is live and accurate through a simulated incident**, including
      the operator broadcast.
- [ ] **SLOs defined with error budgets**, and **a month of data** measured against them.
- [ ] **An incident run end to end as an exercise**, including a public status update and a
      post-incident review.
- [ ] **Financial reports reconcile to the ledger for a full period**, with a completed period
      close.
- [ ] **All eleven "one platform" tests are true** — §7.
- [ ] Every service satisfies §2. Every frontend satisfies §3.
- [ ] Chaos exercise passed for each critical dependency: Postgres, custody, an RPC provider,
      the event relay.

---

## 7. Done, for the ecosystem — the eleven tests

[01-product-vision.md](01-product-vision.md) §2 states that "one platform" means eleven specific
statements are true. **Three are true today.** This is the scoreboard, and each row names the
evidence that proves it — a demonstration, not an opinion.

| # | Statement | Phase | Evidence that proves it |
| --- | --- | --- | --- |
| 1 | One account signs into everything, once | **True today** | A journey signing into all eight surfaces from one session, with no second credential prompt |
| 2 | One identity — the same profile, handle and reputation everywhere | P6 | A `profile` change in Hub renders in Worlds, Market and Trade within the stated cache TTL, verified by journey |
| 3 | One wallet experience — the same receive, send and key screens whichever product you came from | P6 | Every product's wallet link resolves to Hub's wallet. Zero wallet screens outside `hub-web` — verified by route inventory |
| 4 | One portfolio — a single number that is the truth about what you hold | P6, P7 | Hub's portfolio total equals the ledger's summed liability for that user, checked by a journey that asserts the number, not the HTTP status |
| 5 | One activity history — every account, money, asset, game and governance event on one timeline | P6 | The feed shows events sourced from **at least six different services**, covering all sixteen categories in [04](04-domain-model.md) §10.1 |
| 6 | One internal economy — Shards and EMBER spend and earn identically in every product | P10 | A reward earned in a world is spent in Market, in one journey, with both legs visible as ledger postings |
| 7 | Assets you create in one product are usable in the others | P10 | A Studio-generated asset is used as a token's brand, listed in Market, and equipped in a world |
| 8 | One set of notifications, with one preference page | P6, P13 | One preference page governs delivery for every product; a `critical` security notification is delivered **despite** preferences |
| 9 | One operator view — a support agent can answer any question from one place | P13 | An operator answers "where did this user's money go" from `admin-web` alone, by correlation id, without a `docker logs` |
| 10 | One financial source of truth that reconciles against the chain | P7 | Σ user liabilities = Σ custody assets = indexer-observed on-chain holdings, within the stated per-chain tolerance, continuously — and injected drift freezes the correct asset only |
| 11 | A third party can build on all of it | P11 | A third party builds a working integration against the sandbox **using only public documentation**, with no help |

A phase that moves none of these eleven does not ship — which is the rule
[01](01-product-vision.md) §2 already sets and which this scoreboard makes checkable.

---

## 8. Quality gates that apply continuously

These are not phase gates. They are true at all times, from the phase that introduces them
onward, and a breach stops work rather than joining a backlog.

| Gate | Threshold | Breach means |
| --- | --- | --- |
| Beacon journeys | Green, three consecutive runs | Nothing merges until they are |
| p95 latency | Within 20% of the P0 baseline, per route | Investigate before the next gate |
| **Trial balance** | **Exactly zero** | P0 alert. Everything downstream of the ledger is untrustworthy until it is zero |
| Reconciliation drift | Within the per-chain tolerance | Withdrawals freeze for that asset, automatically, un-overridable by one operator |
| Muted journeys | **Zero** | Each is a P1 with an owner; the count gates every phase |
| Bespoke CI files | **Zero** | The topology's cost is not being paid |
| Renovate lag | Under 24 hours, unattended | Over a week: the topology is failing ([03](03-repository-responsibilities.md) §5) |
| New service standup | Under one hour to green CI and a Beacon entry | The template has rotted |
| Alerts without a runbook | Zero | The alert is deleted, not silenced |
| SKUs without a delivery path | Zero | The SKU is withdrawn from the **API**, not just the UI |
| Routes returning key material | Zero | Full stop on feature work |
| Secrets per service | No container holds a variable it does not use | The blast radius of any compromise is total again |

---

## 9. Anti-definitions — what does *not* count as done

Stated because each of these has a precedent in this estate.

- **A feature behind a flag nobody enabled.** Crucible's performance fee is complete, correct,
  well-designed and earns nothing, because `CRUCIBLE_LIVE_ENABLED` defaults to `false`. That is
  the right default *and* it means the revenue line is not done. Shipped means reachable by a
  user, or explicitly recorded as built-and-off with the enabling condition named.
- **A test that was muted to go green.** A muted journey is not a passing journey; it is an
  unmeasured one. The count is a gate precisely so that muting costs something.
- **A doc that describes intent rather than behaviour.** Five documents in this estate describe a
  system that does not exist, including one claiming there is no signing-key rotation when there
  is, and one describing Hearth as a UTXO chain after it became an account-model EVM. A document
  is done when it matches the code, and it is checked against the code, not against the last
  document.
- **A dashboard nobody looks at.** A panel whose value never changes a decision is a screensaver.
  Every dashboard in [02](02-target-architecture.md) §6.2 names its owner and the question it
  answers; one that cannot is deleted.
- **An SKU whose delivery is "planned".** Withheld from a client bundle is not withdrawn: Pay's
  routes stayed live and a stale tab was still charged. Withdrawn means the route returns 404.
- **A migration that ran once on an empty database.** Idempotent against a restored production
  dump, or not done.
- **A backup that has never been restored.** `infra/backup.sh` exists, is unscheduled, and writes
  to the same host. That is a script, not a backup.
- **A runbook that has never been executed.** Especially the break-glass procedure, which
  requires two operators and must be rehearsed in the same release that deletes the admin reveal
  route — not after.
- **"It works on my machine, and staging is close enough."** Staging deploys from the same
  release manifest as production, or it proves nothing.
- **A service that is deployed but not in the release manifest.** If a rollback cannot name its
  previous version, there is no rollback.
