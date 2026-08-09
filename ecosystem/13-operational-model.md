# 13 — Operational model

How CloudsForge is observed, alerted on, staffed, recovered and measured. This document expands
**AD-20**, **AD-21** and **§6** of [02-target-architecture.md](02-target-architecture.md) into an
operational specification; where it adds numbers, thresholds and names, those are the
specification.

The estate it replaces is [00-current-state.md](00-current-state.md) §3.6: no metrics scraped
anywhere, no traces, no dashboards, no scheduled backups, and exactly one alerting mechanism —
a single outbound webhook fired by Beacon on incident open and close
(`infra/beacon/src/notify.js`). A platform holding customer money across 38 repositories cannot
be operated by reading `docker logs`.

> **Correction, from building the stack.** The metric names in this document were written before
> `@cloudsforge/telemetry` existed and they do not match it. **The library's names win** — they
> are implemented, tested and already emitted by the service template, and the Prometheus rules
> and Grafana dashboards in `micro-deploy` are written against them. Where this document says
> otherwise, it is stale:
>
> | This document said | The library emits |
> | --- | --- |
> | `http_server_requests_total` | `http_requests_total` |
> | duration in seconds | `http_request_duration_ms` — **milliseconds** |
> | `jobs_dead_lettered_total` | `jobs_dead_total` |
> | `jobs_lease_expired_total` | does not exist; use `jobs_overdue` |
>
> Two further figures here were also wrong and are corrected in
> [02-target-architecture.md](02-target-architecture.md) AD-20: Prometheus does not downsample,
> so the 400-day retention applies to Beacon's `check_rollups` table and not to Prometheus; and
> scraping Beacon needs `BEACON_TOKEN`, not merely a scrape config.

Phase placement per [06-ecosystem-workflow.md](06-ecosystem-workflow.md): the pipeline lands in
**P2**, before the first repository is split; SLOs, the public status page and full alert
routing complete in **P13**.

---

## 1. The telemetry pipeline

### 1.1 One instrumentation contract

`@cloudsforge/telemetry`, published from `cloudsforge-runtime`, is the only way a service is
instrumented. It replaces the six hand-copied `services/*/src/obs.ts` forks (five byte-identical
at 375 lines, one drifted to 428 — [00-current-state.md](00-current-state.md) §3.7), the six
`apps/*/src/lib/obs.tsx` copies, and the five divergent Nimbus JWKS auth middlewares (54–93
lines, in pay, game, forge-mint, crucible and keyvault). The vendoring convention in
`infra/observability/service-obs.ts` and `web-obs.tsx` — two files meant to be hand-copied into
services — is deleted, not maintained.

One call, `initTelemetry({ service, version })`, configures the OTel SDK and returns the logger,
tracer, meter and typed domain-metric registry. A service that does not call it fails its own
`/readyz`, and `service-ci.yml` (AD-03) fails a build whose entrypoint does not import it.

### 1.2 The four signals

| Signal | Automatic | Declared by hand |
| --- | --- | --- |
| Traces | HTTP server/client, `pg` queries, job runner (claim → execute → ack), outbox relay, inbox handlers | Domain spans for multi-step operations — `wallet.withdrawal.submit`, `settlement.sweep.execute` |
| Metrics | RED per route (`http_server_requests_total`, `http_server_request_duration_seconds`); USE for the job runner (`jobs_claimed_total`, `jobs_inflight`, `jobs_lease_expired_total`, `jobs_retried_total`, `jobs_dead_lettered_total`); `db_pool_in_use`, `db_pool_waiting`; `outbox_pending`, `outbox_relay_lag_seconds` | Domain metrics via a typed API — `ledger_postings_total`, `custody_sign_refused_total`, `indexer_lag_blocks` |
| Logs | Structured pino, unchanged in shape, with `trace_id`, `span_id`, `service`, `version`, `request_id` on every line | Nothing. A domain fact worth counting is a metric, not a log line to be regex-counted later |
| Exemplars | Trace ids on histogram buckets, so a p99 spike links to a slow trace | — |

The join key is `trace_id` on every log line: it is what makes "click the slow trace, get its
logs" and "open a Lantern issue, jump to the trace" work.

### 1.3 Correlation: `traceparent` plus the human alias

Propagation is W3C `traceparent`/`tracestate`. The existing `x-request-id` header is
**retained**, not replaced: generated at the gateway if absent, carried in OTel baggage as
`cf.request_id`, echoed on every response, shown on every user-facing error page, and indexed in
Loki, Lantern and the `audit_events` tables.

The reason is a workflow that already works: a user quotes an id from an error screen and an
operator pastes it into one search box. Lantern already parses `reqId` from three log shapes
(`infra/lantern/src/parse.js,102,178`) and accepts it on browser error reports
(`infra/lantern/src/server.js`). A `traceparent` is 55 hex characters and nobody reads one
aloud. `cf.request_id` is what humans quote, `trace_id` is what machines join on, and every
record carries both.

### 1.4 Collection and backends

An OTel Collector runs per host (`stack/deploy/otel-collector/`), taking OTLP/gRPC on 4317 from
services and OTLP/HTTP on 4318 from browsers via the gateway. It is the only component that
knows where telemetry goes, which is what makes adopting a commercial APM later a collector
export change rather than a re-instrumentation.

Pipeline, in order: `memory_limiter` → resource detection → `attributes/redact` (drops
`authorization`, `cookie`, `set-cookie` and any key matching
`/token|secret|password|mnemonic|private_key|seed/`; truncates addresses to first-6/last-4) →
`tail_sampling` (traces only) → `batch` → exporters.

| Signal | Backend | Retention | Notes |
| --- | --- | --- | --- |
| Metrics | Prometheus, remote-write ready | 15d raw, 400d downsampled at 5m | Scrapes the collector, Beacon's existing `/metrics` (`infra/beacon/src/metrics.js`), Postgres exporter, Traefik, node exporter |
| Traces | Tempo | 7d | Tail-sampled: **100% with an error span, 100% over 2s, 100% touching `custody` or `ledger`, ~5% of the rest** |
| Logs | Loki | 30d | Labels limited to `service`, `env`, `level`, `route_class` — never `user_id` or `request_id`; those are line content, searched not labelled |
| Dashboards | Grafana | — | CloudsForge theme JSON generated from [assets/chart-palette.md](assets/chart-palette.md) §8, so operator dashboards and product charts agree |
| Alerts | Alertmanager → on-call channel **and** a Beacon incident | — | Beacon already owns incident open/close and hysteresis; alerts land where incidents already live |

Tail sampling is chosen over head sampling because the decision needs the whole trace, and the
traces worth keeping are exactly the ones a head sampler discards before knowing they failed.
The custody/ledger rule exists because those two must be reconstructable request-by-request for
an audit, not statistically. Retention is a cost decision (§13): 15d raw is enough for an
incident, 400d downsampled for a capacity trend and the 90-day uptime bars, 7d of traces enough
to debug last week.

---

## 2. Lantern, repositioned

Kept because it does two things Loki does not; repositioned because its collection method does
not survive the target runtime.

**What it does that Loki does not.** `infra/lantern/src/fingerprint.js` normalises a message —
UUIDs, hex addresses, hashes, timestamps, emails, IPs, URLs, source positions and numerics all
collapse to placeholders — hashes it with the service, error type and first non-`node_modules`
stack frame, and groups occurrences into an *issue*: "this failure, 1,240 times, first seen
09:12" rather than 1,240 rows. It deliberately refuses to fingerprint Fastify's own
`request completed` / `incoming request` lines (`fingerprint.js`) so one fault is not filed
twice. Loki will return the 1,240 rows and never tell you there are four distinct problems.
Error grouping is the product; log search is the commodity.

It also owns browser errors — `POST /ingest/client` (`infra/lantern/src/server.js`) is
already the only push path in — and gains RUM basics: page load, first contentful paint, failed
fetches, unhandled rejections, each tagged with the `trace_id` of the request that caused them.
Today a front-end failure and its backend cause are two unrelated records in two systems.

**What changes.**

| Today | Target |
| --- | --- |
| Pull collection following the host Docker socket (`infra/lantern/src/collector.js`, `docker.js`) | **OTLP log push from the collector.** The socket collector is demoted to a dev fallback behind `LANTERN_DOCKER_COLLECTOR`, off outside `dev` |
| Lantern is the only place logs exist | **Loki holds the raw stream; Lantern holds the triage view** — which is what makes Lantern's 7-day event retention acceptable (`LANTERN_RETENTION_DAYS=7`, issues 90 days — `env.js`) |
| Issues have no owner, no state beyond seen/resolved | Assignee, status (`new → acknowledged → resolved → regressed`), a linked runbook, and a link to the Tempo trace of the first occurrence |
| Browser errors carry `requestId` only | Browser errors carry `traceparent`, so the browser record and the server trace are one story |

The socket collector's three stated advantages — nothing to reconfigure, a dying service's last
words still captured, no agent to install — are real, and are why it survives as the dev path.
They do not survive a second host or Kubernetes. Lantern is the tool most needed on the day of
that move, so it cannot be the tool that breaks on it.

---

## 3. Beacon, promoted

Beacon is already a synthetic monitor with 32 probe targets across six groups (`chain`, `edge`,
`frontend`, `platform`, `service`), a journey harness with 24 registered journeys
(`infra/beacon/src/journeys/index.js`), an EVM conformance runner
(`infra/beacon/src/conformance.js`), incident hysteresis, Prometheus exposition that nothing has
ever scraped, and a redacted public status projection. It gains four roles.

**1 — The release gate (AD-04).** Every release candidate deploys to staging and must pass the
full journey suite three consecutive times before its manifest is promoted; `cfctl release`
refuses to promote a manifest whose Beacon run is not green. Journey count grows per phase: 24
today → ~45 at the end of P0 → the exit criteria in
[06-ecosystem-workflow.md](06-ecosystem-workflow.md) name what each phase adds.

The harness's three rules are load-bearing and must not be relaxed: an assertion failure is
`fail` (the product is broken) while any other throw is `error` (Beacon is broken); a journey
without credentials is `skip` and **a skip is never green** — the metric emits 0.5 for skip and
never 1 (`infra/beacon/src/metrics.js`); teardown runs on every exit path.

**2 — SLO evaluation.** Beacon gains an `slos` table and a Prometheus query client. Each SLO is
`{ service, sli_query, objective, window, budget_policy }`, evaluated every 5 minutes, exposed
as `beacon_slo_budget_remaining_ratio` and `beacon_slo_burn_rate`. Definitions in §8. Beacon
evaluates them because Beacon owns the status page they are displayed on.

**3 — The single incident record.** `infra/beacon/src/incidents.js` is already the one place
that decides what reaches the incident log, and it holds open incidents in memory so the status
page works with Postgres down. It gains severity levels beyond `minor|major` (§10), free-text
updates with an author, a manual open/close API for the on-call operator, and an Alertmanager
receiver endpoint so a Prometheus alert opens a Beacon incident rather than a second system.

**4 — Hearth conformance as an operational signal.** `beacon_conformance_vectors` is already
emitted per suite by result, and a suite that could not be run reports under `result="skipped"`,
never under `passed`. Hearth's 31 suites / 20,874 vectors are run by Beacon rather than by
Hearth's own CI ([00-current-state.md](00-current-state.md) §3.9); a non-zero `failed` on any
suite is a ticket that blocks the next Hearth release.

---

## 4. The four separated planes

| Plane | Question | System | Readers | Durability | PII |
| --- | --- | --- | --- | --- | --- |
| Operational observability | Is the system healthy? Why is this slow? | OTel → Prometheus / Tempo / Loki / Grafana; Lantern; Beacon | Engineers, on-call | Best-effort: sampled, redacted, expires | Redacted |
| Security audit | Who did what, to whose data, and was it allowed? | `audit_events` per service, written in the same transaction as the change; tamper-evident mirror in `admin-api`; `policy` decisions | Security, compliance, support with a reason code | **Transactional. Never dropped, never sampled** | Yes, deliberately, access-logged |
| Financial reporting | What is the money? | The `ledger` journal and reconciliation runs | Finance, operators, the user | Permanent, append-only | Yes |
| Product analytics | What do people do, and where do they drop off? | `analytics`, from the event bus, pseudonymised | Product | Durable but lossy by design | Pseudonymous by construction |

**The rule: no plane is derived from another.** Each has its own write path.

- *Analytics is never derived from logs.* Logs are tail-sampled at ~5%, redacted, and gone at 30
  days. A funnel computed from a 5% sample of a redacted stream is a guess presented as a number.
- *Financial reporting is never derived from analytics.* Analytics stores amounts **bucketed
  into ranges** and no `user_id`. It is structurally incapable of producing a balance.
- *Security audit is never derived from application logs.* A log line can be dropped by a
  `memory_limiter` under load; an audit record cannot. Today the only audit tables in the estate
  are custody's `key_reveals` and Lantern's issue store — everything else is
  `log.warn({audit:…})`, a line that can be sampled away.
- *Operational observability is never derived from the ledger.* Money metrics reach Prometheus
  as counters and gauges the ledger *emits*, not as queries Grafana *runs* — the one exception
  being `ledger_trial_balance_delta`, computed by a leased job every 60 seconds and published as
  a gauge.

Beacon already applies the principle: its `/metrics` reads live state from memory and never
touches Postgres, because "a metrics endpoint that queries the database gives anyone who can
reach it a way to put load on the database by scraping in a loop, and the one thing a monitor
must never be is the reason for the outage" (`infra/beacon/src/metrics.js`).

---

## 5. The nine Grafana dashboards

Each has one owner, one question, and panels that change a decision. A panel that cannot change
a decision is removed at review.

### 5.1 Platform overview — owner: on-call

| Panel | Form | Metric | Decision |
| --- | --- | --- | --- |
| Global RED | Stat row + sparkline | `sum(rate(http_server_requests_total[5m]))`, error ratio on `status=~"5.."`, `histogram_quantile(0.5/0.95/0.99, http_server_request_duration_seconds_bucket)` | Is anything wrong now |
| Error-budget burn | Sorted horizontal bars per SLO | `beacon_slo_burn_rate` | Which SLO to defend this week |
| Top 5 failing routes | Table | `topk(5, sum by (service,route) (rate(http_server_requests_total{status=~"5.."}[5m])))` | Where to look first |
| Journey status grid | Status cells, icon + label + colour | `beacon_journey_status` | Is a *user* blocked, versus a metric being ugly |
| Active incidents | Timeline | Beacon incidents API | What is already known |
| Deploy markers | Annotations from the release manifest | `cfctl release` webhook | "Did this start at 14:02?" in one glance |

### 5.2 Service detail (templated by `$service`) — owner: the service's team

RED per route · saturation (`process_cpu_seconds_total`, `process_resident_memory_bytes`,
`db_pool_in_use / db_pool_size`, `db_pool_waiting`) · Postgres statement p99 from
`pg_stat_statements` · job runner (`jobs_claimed_total`, `jobs_inflight`,
`jobs_lease_expired_total`, `jobs_retried_total`, `jobs_dead_lettered_total`, queue depth by
`state`) · outbox (`outbox_pending`, `outbox_relay_lag_seconds`) · upstream call latency and
`circuit_breaker_state` per dependency · **exemplar links straight into Tempo** on every latency
histogram. `jobs_lease_expired_total > 0` means a worker died holding a lease — the class of bug
that produced the double-billing in [00-current-state.md](00-current-state.md) §3.1.

### 5.3 Money integrity — owner: the ledger team, read daily by finance

| Panel | Metric | Threshold |
| --- | --- | --- |
| **Trial balance** | `ledger_trial_balance_delta` (Σ debits − Σ credits, per currency) | **Must be exactly 0. Any non-zero value for 2 consecutive evaluations pages immediately** |
| Posting rate by source | `sum by (source) (rate(ledger_postings_total[5m]))` | Per-product revenue derivable — the gap named in §3.3 |
| Reconciliation drift per chain | `ledger_reconciliation_drift_native{chain}` — ledger custody account vs indexer-observed on-chain balance | Ticket at any non-zero; page above the per-chain dust threshold |
| Unreconciled entries by age | `ledger_unreconciled_entries{age_bucket}` histogram | Ticket at any entry > 24h |
| Reservations older than 24h | `ledger_reservations_open{age_bucket}` | A stuck reservation is a user's money they cannot see |
| Failed postings | `ledger_posting_failures_total{reason}` | `reason="unbalanced"` is a code bug and pages |
| Idempotency replay rate | `ledger_idempotency_replay_total / ledger_postings_total` | A sudden rise means a caller is retrying, i.e. something upstream is timing out |

### 5.4 Deposits & withdrawals — owner: the wallet team

Funnel `detected → confirmed → credited` as an ordinal funnel from `wallet_deposit_total{stage}`
· confirmation lag per chain p50/p95 (`indexer_confirmation_lag_seconds{chain}`) plotted against
the configured policy depth as a threshold annotation · **withdrawal state age histogram**,
`withdrawal_state_age_seconds{state="pending|signed|broadcast"}` · **stuck count**,
`withdrawal_stuck_total` — **pages on ≥1** · treasury balance vs target float per chain,
`settlement_treasury_balance_native{chain}` with the target as a threshold line, not a second
series · sweep backlog `settlement_sweep_pending`. Crediting freezing on one address until an
operator records a manual sweep is a live failure mode today
([00-current-state.md](00-current-state.md) §3.4); `wallet_deposit_address_frozen` exists so it
is visible before the user complains.

### 5.5 Chain health — owner: the indexer team

`indexer_lag_blocks{chain}` — **pages when lag exceeds the chain's confirmation depth**, because
past that point deposits are provably not being credited · `indexer_reorg_depth` events as a
bar per occurrence · `indexer_rpc_success_ratio{provider}` and `indexer_rpc_failover_total` ·
`indexer_rpc_rate_limited_total{provider}` · Hearth height, peers, hashrate, difficulty and
mempool from `beacon_chain_height`, `beacon_chain_peers`, `beacon_chain_mempool` · **height
spread** `beacon_chain_height_spread` — sustained non-zero is a partition or a fork · block-time
distribution as a histogram · `beacon_conformance_vectors{result="failed"}` per suite.
Per [assets/chart-palette.md](assets/chart-palette.md) §10, hashrate and difficulty are two
panels, never one chart with two axes.

### 5.6 Custody & security — owner: security

`custody_sign_requests_total{purpose,outcome}` · **`custody_sign_refused_total{reason}`**, reason
in `binding_mismatch|purpose_forbidden|treasury_pin_mismatch|policy_deny` — a refusal is the
policy layer working, a *rise* in refusals is either an attack or a bug ·
`custody_key_export_inflight{stage}` across `requested → cooling_off → redeemable → delivered` ·
`policy_decisions_total{decision}` for `deny|challenge|review` · admin actions per operator from
the audit mirror · `auth_failures_total` by IP prefix · `identity_new_device_signins_total`.
Custody's single-replica constraint makes `up{job="custody"}` a panel with an alert.

### 5.7 Business — owner: the commercial owner

Revenue by source (`ledger_postings_total{account_type="platform:revenue", source}` over the
period) covering mint fees, trade performance fees, market fees, subscriptions and studio
credits · GMV and take rate · active subscriptions and churn · creator payouts owed vs paid ·
refunds and disputes. Sourced from the ledger, never from analytics. Model in
[15-monetisation-model.md](15-monetisation-model.md).

### 5.8 Product funnels — owner: product

Register → wallet created → deposit confirmed → first conversion → first product action as an
**ordinal funnel** · cohort retention heatmap by signup week (sequential ember ramp, palette §4)
· cross-product usage matrix · time-to-first-deposit distribution. Sourced from `analytics`, so
every number is pseudonymous and no panel drills to a named user.

### 5.9 Developer platform — owner: the devplatform team

`devplatform_api_calls_total{project,env}` · error rate by API key (top 10; the long tail is a
table) · `devplatform_rate_limit_hits_total` · webhook delivery success and retry depth
(`notify_webhook_delivery_total{outcome}`, `notify_webhook_retry_depth`) · sandbox vs production
split. Every panel is also the data behind a customer-visible chart in the developer portal
(§7), and they must agree — one query, two renderings.

---

## 6. The public status page

`status.cloudsforge.online`, served by `status-web` from Beacon's `redactStatus` projection
(`infra/beacon/src/server.js`), pre-auth, cached at the edge, and hosted so that it does not
share a failure domain with the platform it reports on. A platform holding customer money owes
one.

### What is shown

| Panel | Form | Source |
| --- | --- | --- |
| Overall state | Hero status chip + one sentence | Beacon `summary` |
| Service grid by product group — Account · Wallet · Trading · Worlds · Network · Create · Market | Status cells, **icon + label + colour** | Beacon targets mapped to product groups |
| 90-day uptime per group | One bar per day | `check_rollups`, retained 400 days (`BEACON_ROLLUP_RETENTION_DAYS=400`) |
| Active and recent incidents | Timeline: severity, opened, closed, updates | Beacon incidents |
| Chain state (Forge Network) | Height, peers, mempool depth, last block age | Beacon chain probes — EMBER is a public network and its liveness is public information |
| Scheduled maintenance | List | `admin-api` broadcasts |

### What is deliberately withheld

Per-service latency numbers, error rates, internal target names, replica counts, journey step
names, error strings, and the `proves` text on each probe. Those are an availability map for an
attacker: "our status page told the attacker which service fell over first" is not worth a nicer
page.

**Gap against the current code, and the P13 change.** `redactStatus` already strips latency,
error strings, `proves` text, journey step names and chain internals — but it emits `t.name`
verbatim and `incidents[].subject`, which are internal target names such as `pay.rates` and
`hearth.seed`. The spine requires product-group labels, so `status-web` consumes a **new**
`/api/status/public` projection that maps each target to a product group and emits the group's
rolled-up state with target names removed entirely. Until that lands, `BEACON_PUBLIC_STATUS`
stays `false` (its current default, `infra/beacon/src/env.js`).

### Incident updates: who writes them, and when

The on-call operator writes them; nobody else publishes to the public page. An automated
incident opens with a **generic** template ("We are investigating elevated errors affecting
Wallet") — never the alert text, which carries internal names.

| Severity | First public update | Cadence until resolved | Final |
| --- | --- | --- | --- |
| SEV1 | Within 15 minutes of declaration | Every 30 minutes, even if the update is "no change" | Resolution note within 1 hour; public post-incident review within 5 working days |
| SEV2 | Within 30 minutes | Every 60 minutes | Resolution note |
| SEV3 | Only if user-visible for > 30 minutes | Every 2 hours | Resolution note |
| SEV4 | Not published | — | — |

Updates are written in `admin-web`, stored on the Beacon incident, and are the same record the
internal timeline uses — one incident, two audiences, one write.

---

## 7. In-product graphs

Colour, mark, spacing, legend and interaction rules are fixed by
[assets/chart-palette.md](assets/chart-palette.md) and not restated here: the palette is
validated against the real panel surface `#141110`, series colours come from `--cf-viz-1..8` in
order and are never cycled, and all-pairs forms cap at four series from the dedicated quartet.

| Surface | Chart | Form |
| --- | --- | --- |
| Hub · dashboard | Portfolio value, 24h/7d/30d/1y | Area, one series, crosshair tooltip, no legend |
| Hub · dashboard | Allocation by asset | Sorted horizontal bar, direct-labelled; ≥8 assets fold to "Other" |
| Hub · dashboard | Balance movement in/out | Diverging bars around a zero baseline |
| Hub · activity | Activity volume by type | Stacked bars per day, 2px surface gap |
| Hub · receive | Confirmation progress | Ordinal step meter with an ETA — not a chart |
| Trade | Equity vs buy-and-hold | Two lines, direct-labelled. `EquityChart.tsx` restyled, not rebuilt |
| Trade | Drawdown | Filled area below zero |
| Trade | Cross-bot portfolio (new) | Stacked area of allocated capital + a P&L bar per bot |
| Trade | Strategy comparison | Small multiples, ≤4 series, all-pairs quartet |
| Network | Hashrate · difficulty · block time | Three separate one-series charts |
| Network | Supply and emission | Area with the modelled curve dashed, "modelled — not a promise" |
| Explorer | Blocks/day · tx/day · active addresses | Bar, bar, line |
| Market | Floor price and volume per collection | Line + volume bars, stacked vertically on one x-axis |
| Market | Listing/sale activity | Bar per day |
| Worlds | Season progress, resource scarcity | Ordinal meters + a world stock line |
| Developer portal | Usage vs quota, error rate, latency | Lines with quota as a threshold annotation, not a series |
| Admin | — | Every panel links to its Grafana equivalent. Admin shows *state*, Grafana shows *trend*. Do not rebuild Grafana in React |

**The five hard rules, restated because they are violated by default.**

1. **Never a dual axis.** Two measures of different scale are two stacked panels sharing an
   x-axis, or two charts.
2. **Never a pie for allocation.** Sorted horizontal bars with direct labels.
3. **Money is never plotted without its unit and its pricing timestamp.** The oracle can be
   stale by up to `PAY_ORACLE_MAX_AGE_SECONDS`; a portfolio chart drawn on a stale price is a
   lie with a gradient on it. Every money chart renders "priced at HH:MM:SS UTC" and degrades to
   a warning state past the threshold.
4. **An empty chart and a failed chart must not look the same.** Beacon and Lantern already
   render an explicit "no data answered" state; every product chart does the same.
5. **Every chart has a table view** — the accessibility fallback and the export path. Trade
   needs exportable history for tax regardless.

---

## 8. SLOs and error budgets

Three tiers. Windows are rolling 28 days unless stated. Availability SLIs are computed from
`http_server_requests_total`; latency SLIs from the duration histogram; journey SLIs from
`beacon_journey_status`.

> **This section defines what a tier means and what each one is held to. It is no longer the
> list of which services are in which tier.** That list is
> [`deploy/prometheus/tiers.yaml`](https://github.com/cloudsforge-online/micro-deploy/blob/main/prometheus/tiers.yaml)
> in micro-deploy, and it is read at deploy time: the Prometheus scrape list is rendered from
> the release manifest and stamps a `tier` label on every target, which is what
> `prometheus/rules/slo.yaml` selects on (micro-org#308).
>
> Membership moved because it has to be **executable** by the thing that applies it, and this
> document is not on the deploy host — `/home/malf/dev/cloudsforge` holds `org` and `deploy` and
> nothing else, measured 2026-08-09. A prose list here and a machine list there is two lists, and
> the two-list version of this had already drifted: `slo.yaml` selected Tier 1 with
> `service=~"…|billing"` while the paragraph below correctly calls `billing` Tier 2. Nobody
> noticed for as long as it existed, because Prometheus was scraping no estate service at all, so
> the expression that regex filtered had no series in it to be wrong about.
>
> The tables below therefore keep their **per-service SLIs and objectives**, which are decisions
> and belong in a document. Read them as "if a service is Tier 1, this is what Tier 1 costs" —
> and read `tiers.yaml` for who is.
>
> Two services carry a Tier 1 objective that this section never assigned them, recorded with
> their reasoning in that file: `pricing` (the USD price oracle — four-source median, fails
> closed on staleness; every conversion and every withdrawal valuation reads it) and `policy`
> (the single risk-decision authority — freezes, limits, velocity, holds). Neither appears in
> either list below, which is itself the defect: a money-path service that no tier names gets no
> objective at all.

### Tier 1 — money services

| Service | SLI | Objective | 28d budget |
| --- | --- | --- | --- |
| `ledger` | Postings accepted without a 5xx | 99.95% | 21 min |
| `ledger` | **Trial-balance correctness** — minutes with `ledger_trial_balance_delta == 0` | **100%. No budget** | 0 |
| `ledger` | p99 posting latency < 250ms | 99.9% | — |
| `wallet` | Deposit credited within confirmation depth + 5 min | 99.5% | — |
| `wallet` | Portfolio read availability | 99.9% | 40 min |
| `settlement` | Withdrawal broadcast within 15 min of approval | 99.0% | — |
| `settlement` | Zero withdrawals `stuck` at end of day | 100% of days | 0 |
| `custody` | Sign request answered (allow or refuse) within 5s | 99.9% | 40 min |
| `custody` | Availability | 99.5% — **lower on purpose**: single replica, permanently (AD-18) | 3h 22m |
| `indexer` | `indexer_lag_blocks` below confirmation depth | 99.5% per chain | — |

**Tier 2 — product services.** `identity`, `mint`, `market`, `trade`, `worlds`, `nda`,
`community`, `studio`, `billing`, `notify`, `activity`, `hub-api`, `devplatform`: availability
**99.5%** (3h 22m per 28 days), p95 latency under the route's declared budget for **99%** of
minutes. `notify` additionally: 95% of `priority=critical` notifications delivered within 60s.

**Tier 3 — edge.** Gateway availability **99.9%**; TLS handshake p99 < 300ms; SPA first
contentful paint p75 < 2.0s per app, measured from Lantern RUM, not synthetically.

**Journey SLOs.** Every Beacon journey in the critical-path set — register, sign in, SSO
handoff, deposit, convert, spend, withdraw, mint deploy, market purchase — must have **99% of
scheduled runs pass**. A skip counts against it, because a skip is not a pass.

### What happens when a budget is exhausted

| Budget consumed | Consequence |
| --- | --- |
| 50% | Ticket to the owning team. Named in the weekly operations review |
| 75% | Reliability work is prioritised above new feature work for that service in the next sprint |
| 100% | **Change freeze on that service.** Only reliability fixes, security fixes and rollbacks merge. Lifted by the service owner plus one other, recorded as an entry in the operations log |
| Two consecutive windows at 100% | The SLO is wrong or the service is wrong. Either way the outcome is a written decision — a re-set objective with a reason, or a funded remediation |

Burn-rate alerting uses the standard multi-window pair: **14.4× over 1h** (2% of a 28-day budget
in an hour) pages; **6× over 6h** tickets. That prevents both "the alert fires after the budget
is already gone" and "every small blip pages".

---

## 9. Alerting

### Page vs ticket

**Page** — a human is woken — only for user-visible failure or irreversible money risk:

| Condition | Rule |
| --- | --- |
| A critical Beacon journey fails twice consecutively | `beacon_journey_status{journey=~"critical.*"} != 1 for 2 runs` |
| Trial balance non-zero | `ledger_trial_balance_delta != 0 for 2m` |
| Any stuck withdrawal | `withdrawal_stuck_total >= 1 for 5m` |
| Custody unreachable | `up{job="custody"} == 0 for 2m` |
| Indexer lag past confirmation depth | `indexer_lag_blocks{chain} > on(chain) chain_confirmation_depth for 10m` |
| Chain height spread sustained | `beacon_chain_height_spread > 3 for 15m` |
| Fast SLO burn | `beacon_slo_burn_rate > 14.4 for 1h` on a Tier-1 SLO |
| Gateway 5xx ratio | `> 5% for 5m` |
| Postgres unreachable from any money service | `db_pool_waiting > 0 and up{job=~"ledger\|wallet\|settlement"} == 1 for 3m` |
| Backup age | `backup_last_success_age_seconds > 129600` (36h) |

**Ticket** — everything else: slow SLO burn, single-target degradation, RPC provider failover,
elevated 4xx, a new Lantern issue crossing 100 occurrences in an hour, dead-lettered jobs,
`jobs_lease_expired_total` increasing, conformance vectors failing, certificate expiry inside 14
days.

A metric says "p99 is high"; a journey says "a user cannot withdraw". Page on the second.

### Routing

Alertmanager routes by `severity` and `team` labels, mandatory on every rule. Every alert also
**opens a Beacon incident** through the Alertmanager receiver, so the public page and the
internal timeline share one record. Grouping is by `(service, alertname)`, `group_wait: 30s`,
`group_interval: 5m`, `repeat_interval: 4h`. Inhibition: a firing `ServiceDown` suppresses every
latency and error-rate alert for that service; `PostgresDown` suppresses everything bound to
that instance.

The estate today has exactly one alerting mechanism — `BEACON_WEBHOOK_URL`, fired on incident
open and close only, best-effort, no retry, minimum severity `major`
(`infra/beacon/src/notify.js`, `env.js`). It is kept as the chat-channel receiver, not
as the paging path: paging needs acknowledgement and escalation, and a fire-and-forget POST has
neither.

### The runbook rule

**Every alert rule carries a `runbook_url` annotation, and CI fails the alert-rules build if any
rule lacks one or points at a 404.** An alert without a runbook is deleted, not silenced,
because an unactionable page teaches the on-call to ignore pages.

### Alert fatigue controls

- Monthly review: any alert that fired more than 5 times without a corresponding incident is
  retuned or deleted; any alert acknowledged twice with no action taken is deleted.
- No alert on a *cause* where an alert on the *symptom* exists. CPU is not an alert; latency is.
- Maintenance windows silence by label, declared in advance, and appear on the public page.
- Hysteresis is applied at the source, as Beacon already does: an incident is a state transition
  that survived `BEACON_FAIL_THRESHOLD=3`, not a failed check. A `pending` target publishes its
  raw reading and leaves hysteresis to the rule's `for:` (`metrics.js`) — do not
  double-apply it.

---

## 10. On-call

One rotation, weekly handover on Tuesdays (never Monday, never Friday), minimum three people
before the rotation is real. Below three, alerts route to a shared channel with a publicly
stated best-effort SLA — pretending to have 24/7 cover is worse than not having it.

| Level | Who | Trigger |
| --- | --- | --- |
| Primary | On-call engineer | Page fires |
| Secondary | Next in rotation | Primary has not acknowledged in 5 minutes |
| Tertiary | Owner of the affected service | Secondary has not acknowledged in 5 minutes, or primary escalates |
| Money escalation | Ledger owner + one operator with break-glass authority | Any SEV1 touching custody, ledger or settlement |

### Severity

| Sev | Definition | Examples | Response |
| --- | --- | --- | --- |
| **SEV1** | Money at risk, or the platform unusable for most users | Trial balance ≠ 0; custody unreachable > 15m; withdrawals broadcasting twice; gateway down | Page immediately, 24/7. Public update within 15 min |
| **SEV2** | A product unusable, or money delayed but safe | Deposits not crediting on one chain; mint deploys failing; a Tier-1 journey failing | Page in extended hours, ticket overnight unless worsening. Public update within 30 min |
| **SEV3** | Degraded but working | Elevated latency; one RPC provider failing over; one frontend erroring | Ticket, next business day |
| **SEV4** | No user impact | Dead-lettered job; certificate expiring in 14 days | Backlog |

### The operator's first five minutes

**Any severity, first 60 seconds:** acknowledge the page (stops escalation), open the Beacon
incident, note the `cf.request_id` or `trace_id` from the alert.

**SEV1.** Min 1: declare in the incident channel and name yourself incident commander. Min 2:
Money integrity dashboard first, always — `ledger_trial_balance_delta`, `withdrawal_stuck_total`,
`ledger_reconciliation_drift_native`. Min 3: check the deploy annotation on Platform overview; if
a release landed in the window, **roll back to the previous release manifest before diagnosing**
— the manifest is the rollback unit (AD-03). Min 4: if money movement is implicated, invoke
`runbook-freeze-withdrawals`; freezing is reversible, a duplicated payout is not. Min 5: post
the first public update.

**SEV2.** Min 1: one service or one journey? Beacon's journey grid before Grafana, because a
journey names the user-visible failure. Min 2: open Service detail for the implicated service.
Min 3: Lantern's issue list sorted by first-seen — a new issue in the last hour is almost always
the cause. Min 4: check the deploy annotation, roll back if correlated. Min 5: decide
page-or-ticket for overnight and say so in the channel.

**SEV3.** Min 1–2: confirm it is not a SEV2 in disguise, via the journey grid. Min 3: assign to
the owning team with the trace id attached. Min 4: if an alert already covers the same cause,
mark this one for the monthly review. Min 5: close the page.

**SEV4.** Acknowledge, file, close. Do not investigate out of hours.

---

## 11. Incident response and post-incident review

Roles for SEV1 and SEV2: **incident commander** (decides, does not debug), **operations lead**
(runs commands), **communications** (writes public and internal updates), **scribe** (timestamps
everything in the Beacon incident). One person may hold several roles below SEV1; the commander
never also holds operations lead in a SEV1.

Lifecycle: `detected → declared → mitigated → resolved → reviewed`. Mitigation precedes
diagnosis — roll back, freeze, fail over, then investigate. The record carries the detection
source (alert / journey / customer report), and the ratio of customer-reported to self-detected
incidents is a tracked monthly number; above 10% means the monitoring is wrong.

**Post-incident review** is mandatory for every SEV1 and SEV2, within 5 working days, blameless,
written by the incident commander. It contains: the timeline from the Beacon record; user impact
quantified from metrics (how many users, how much money delayed, for how long); contributing
causes, plural — "root cause" is usually a story told to stop looking; what detection missed and
why; and **action items with an owner and a date**. Actions land in the backlog labelled
`post-incident`; an unclosed action older than 30 days is escalated at the operations review. A
review producing no action item is either wrong or the incident should not have been a SEV.

Money-touching incidents also produce a **reconciliation statement**: what the ledger said
before, what it says after, what was adjusted, under whose dual approval, with which reason code.

---

## 12. Product analytics

`cloudsforge-analytics` (AD-21) consumes the event bus alongside `activity`. Frontends emit
`page_viewed`, `cta_clicked` and `form_abandoned` through the same envelope. No third-party tag,
ever.

### The pseudonymisation boundary

Analytics receives `subject_key = HMAC-SHA256(user_id, analytics_pepper)` and never the
`user_id`. The pepper exists only in the analytics service's secret store, is never in a backup
that also contains the identity database, and is rotated only with a documented re-keying that
breaks historical joins by design. Analytics stores **no email, no handle, no wallet address, no
exact balance and no exact amount** — money appears only as bucketed ranges
(`<10, 10–100, 100–1k, 1k–10k, >10k` USD-equivalent at event time).

**What this deliberately makes impossible:** answering "what did user X do"; reconstructing a
balance; joining analytics to the ledger; exporting a user list to a marketing tool; resolving a
support ticket from the funnel dashboard. Those questions are answered by `admin-api` against
the owning service, with an audit record and a reason code. The first person to ask for a
`user_id` column in analytics should be sent this paragraph.

### Metric catalogue

Every metric states numerator, denominator and window. "Active" means at least one
non-authentication event in the window.

| # | Metric | Numerator | Denominator | Window |
| --- | --- | --- | --- | --- |
| 1 | Acquisition | Distinct `subject_key` with a first-ever `page_viewed`, by referrer class | — (count) | Daily, weekly |
| 2 | Registration conversion | `identity.user.registered` | Visitors reaching `/register` | Session, 7d attribution |
| 3 | Email verification | `identity.email.verified` | Cohort registrations | 7d from registration |
| 4 | Wallet activation | Users with ≥1 `wallet.address.assigned` | Cohort registrations | 7d, 30d |
| 5 | First deposit | Users with ≥1 `wallet.deposit.confirmed` | Wallet-activated cohort | 7d, 30d, 90d |
| 6 | Time to first deposit | `deposit.confirmed.ts − user.registered.ts` | Users with a first deposit | p50/p90 per weekly cohort |
| 7 | First transaction | Users with ≥1 `ledger.entry.posted` on a user-subject account | Users with a first deposit | 30d |
| 8 | Token creation | Users with ≥1 `mint.deploy.confirmed` | Active users | 30d |
| 9 | Token creation funnel | `mint.order.created → deploy.submitted → deploy.confirmed` | Step over previous step | Per attempt |
| 10 | Marketplace activity | Users with `market.listing.created` or `.sold` | Active users | 7d, 30d |
| 11 | Trading activation | Users with ≥1 `trade.bot.started` | Users who viewed a strategy | 30d |
| 12 | Game retention | Users with `worlds.session.started` on day N | Cohort whose first session was day 0 | D1, D7, D30 |
| 13 | Community participation | Users with `membership.joined`, `proposal.voted` or a post | Community members | 30d |
| 14 | Developer adoption | Projects with ≥1 production API call | Projects created | 30d from creation |
| 15 | Revenue *(shape only)* | Revenue events by source, in amount **buckets** | — | Daily. **Actual revenue comes from the ledger, never here** |
| 16 | Cross-product usage | Users active in ≥2 product groups | Active users | 30d |
| 17 | Onboarding funnel | register → verify → wallet → deposit confirmed → first conversion → first product action | Step over previous step | 30d cohort |
| 18 | Cohort retention | Users active in week N | Signup-week cohort | 12 weeks, heatmap |
| 19 | Form abandonment | `form_abandoned` | `form_started` per form id | Session |
| 20 | Feature adoption | Users emitting a feature's first-use event | Users exposed to the surface | 30d from release |

Definitions are **versioned in the analytics repository** with a changelog. A redefinition
creates a new metric id and never silently changes an existing series: a retention number that
changed definition in March is a chart that lies about February.

---

## 13. Capacity and cost

| Thing | Scales with | Constraint |
| --- | --- | --- |
| Stateless services | Request rate | Horizontal once the gateway removes the 18 `container_name:` entries and fixed host ports (AD-17). Until then `deploy.replicas` is rejected outright |
| Postgres per service | Write rate, retention | Vertical first, then read replicas for `indexer` and `analytics` only |
| `indexer` workers | Chains × blocks/second × addresses watched | One worker per chain family; parallel within a family by block range |
| `custody` | Addresses under management | **Permanently single-replica** (AD-18). One container per address; it blocks any multi-host move, and that is accepted |
| Hearth nodes | — | **Stateful singletons.** Adding a node adds a validator, not capacity |
| Prometheus | Active series | Cardinality budget: 500k active series. `user_id`, `address`, `request_id` and `trace_id` are never labels |
| Tempo | Trace volume × sampling | Object storage. 7d |
| Loki | Log bytes | Label cardinality is the cost driver, not volume |
| `analytics` | Event volume | Append-only, partitioned monthly |

Cost drivers in order: Postgres storage and IOPS across ~20 databases; object storage for Tempo
and Loki; chain RPC provider calls (the indexer is the largest consumer and `indexer_rpc_*`
metrics are the bill); egress; staging, which is now mandatory infrastructure rather than a
nicety. Custody's per-address container model has a container-count cost that grows linearly
with users and is the first thing to hit a host limit — `custody_addresses_total` is a capacity
panel, not a business one.

---

## 14. Backups, DR, RPO and RTO

`infra/backup.sh` exists, is **unscheduled**, and writes to a local destination directory. It
correctly captures all Postgres databases via `pg_dumpall`, the `keyvault-data` FileVault volume
and every `kv-*` per-address volume, and correctly excludes `KEYVAULT_MASTER_SECRET` by design.
It is a good script that is not a backup: **a copy on the same disk as the original is not a
backup**, and a backup nobody has restored is a hypothesis.

| Service | RPO | RTO | Method |
| --- | --- | --- | --- |
| `ledger` | **0** | 30 min | Streaming WAL archiving to off-host object storage + PITR. The journal is append-only and must lose nothing |
| `custody` (key material) | 0 | 1 h | Encrypted volume snapshots off-host, plus the master secret held separately in a password manager or KMS. Both are needed; either alone is useless |
| `wallet`, `settlement`, `billing` | 5 min | 1 h | WAL archiving + PITR |
| `identity` | 5 min | 1 h | WAL archiving + PITR |
| `indexer` | 24 h | 4 h | Nightly dump. **Rebuildable from chain** — the recovery path is re-sync, and the RPO is a convenience |
| Product services (`mint`, `market`, `trade`, `worlds`, `nda`, `community`, `studio`) | 1 h | 4 h | Nightly dump + hourly WAL |
| `analytics` | 24 h | 24 h | Nightly dump. Lossy is acceptable here and nowhere else |
| `lantern`, `beacon` | 24 h | 4 h | Nightly dump. Beacon's 400-day rollups are the only irreplaceable part |
| Prometheus / Tempo / Loki | 24 h | best-effort | Not backed up beyond object-storage durability. Losing a week of traces is not a business event |
| Hearth chain data | 0 | 2 h | The chain is its own backup if ≥1 node survives; snapshots exist to shorten a re-sync, not to preserve state |

**Scheduling and verification.** It becomes a leased job with off-host destinations, emitting
`backup_last_success_timestamp_seconds{target}` and `backup_bytes_written`. The alert is on
**age**, not on failure: a backup job that silently stops firing produces no failure to alert on.

**Restore drills, quarterly, per the P13 exit criteria.** Restore into an isolated environment
and verify: identity can mint a token; the ledger's trial balance is 0; custody can decrypt one
known address using the separately-held master secret; the indexer resumes from its checkpoint.
Record the wall-clock time against the RTO above. **A drill that exceeds its RTO changes the RTO
or changes the method — it is never just noted.**

DR posture is single-region, single-host, and stated rather than implied. Custody and Hearth
nodes cannot move hosts without a planned migration; everything else can. The documented
degradation for a custody outage is AD-18's: deposits still land, withdrawals and sweeps queue,
and **that must be visible on the public status page** rather than discovered by a user whose
withdrawal is silent.

---

## 15. Runbook index

Each is a file in `stack/docs/runbooks/`, linked from the alert that needs it, and reviewed
after any incident that used it. A runbook that has never been executed is rehearsed in the
quarterly drill.

| Runbook | Triggered by |
| --- | --- |
| `runbook-trial-balance-nonzero` | `ledger_trial_balance_delta != 0` |
| `runbook-reconciliation-drift` | `ledger_reconciliation_drift_native` non-zero |
| `runbook-stuck-withdrawal` | `withdrawal_stuck_total >= 1` |
| `runbook-abandon-withdrawal` | Operator decision inside the above |
| `runbook-frozen-deposit-address` | `wallet_deposit_address_frozen` |
| `runbook-manual-sweep` | The only fix for the above |
| `runbook-custody-unreachable` | `up{job="custody"} == 0` |
| `runbook-custody-break-glass` | Two-operator key recovery (AD-13) |
| `runbook-freeze-withdrawals` | Any SEV1 touching money |
| `runbook-indexer-lag` | `indexer_lag_blocks` past confirmation depth |
| `runbook-reorg-recovery` | `indexer_reorg_depth` beyond the policy depth |
| `runbook-rpc-provider-failover` | `indexer_rpc_success_ratio` low |
| `runbook-hearth-node-down` | `beacon_chain_peers == 0` or height spread |
| `runbook-hearth-fork` | `beacon_chain_height_spread` sustained |
| `runbook-postgres-failover` | Postgres unreachable |
| `runbook-restore-from-backup` | DR, and the quarterly drill |
| `runbook-event-relay-backlog` | `outbox_relay_lag_seconds` high |
| `runbook-dead-letter-drain` | `jobs_dead_lettered_total` increasing |
| `runbook-lease-expiry-storm` | `jobs_lease_expired_total` increasing |
| `runbook-rollback-release` | Any deploy-correlated incident |
| `runbook-certificate-renewal` | Expiry inside 14 days |
| `runbook-secret-rotation` | Scheduled, and on any suspected exposure |
| `runbook-incident-comms` | Every SEV1 and SEV2 |
| `runbook-gdpr-erasure` | `identity.user.deleted` not acknowledged within SLA |
| `runbook-manual-ledger-adjustment` | Dual-approval correction |

---

## 16. Operator tooling

`admin-api` plus `admin-web` is the operator surface, and **every action writes an `audit_event`
in the same transaction as the change**, mirrored to the tamper-evident store. Every operator
action requires MFA; destructive ones require a reason code from a closed list.

**Investigation by correlation id.** One search box accepts a `cf.request_id`, `trace_id`, user
id, wallet address, transaction hash or ledger entry id, and fans out to Tempo (the full trace
across gateway → hub-api → wallet → policy → ledger → settlement → custody → indexer), Loki
(every log line on that trace), Lantern (any issue fingerprinted from it), the `audit_events`
mirror, the ledger journal, and the owning service's domain record. Without it, "why did this
withdrawal fail" is eight `docker logs` invocations and a guess.

**Manual ledger adjustment.** Never an `UPDATE`. An adjustment is a new balanced journal entry
with a reason code, requiring **two distinct operators** — one to propose with a reason and a
supporting correlation id, one to approve — and a mandatory link to an incident or dispute
record. Self-approval is refused by the service, not by documentation. Reversals are new entries
(AD-06), so an adjustment is auditable as a pair and the trial-balance invariant holds across it
by construction.

**The two remedies that are curl-only today, and get a UI.**

| Remedy | Today | Target |
| --- | --- | --- |
| **Record a manual sweep** — the only fix for a deposit address whose crediting is frozen by a regression in the observed balance ([00-current-state.md](00-current-state.md) §3.4) | An internal route invoked by curl. No UI, no preview, no audit beyond a log line | An `admin-web` screen: the address, its high-water mark, the indexer's observed on-chain history, a preview of the postings to be created, dual approval, a reason code, an audit event, and a ledger entry reconciliation can see |
| **Abandon a stuck withdrawal** | An internal route invoked by curl | A screen showing the full state history, the broadcast attempts, the chain's view from the indexer, an explicit confirmation that **no transaction is in flight**, dual approval, and a reversing journal entry rather than a status edit |

Both are money-touching operations performed under pressure by someone already having a bad day.
A curl command with a hand-typed address is how a bad day becomes an incident.

Beyond those: user and session management, device revocation, wallet inspection, key-event
history, deposit and withdrawal search, reconciliation runs, bot and token inspection,
marketplace moderation, community and governance views, broadcast composition, API client
management, risk-event review, feature flags, service health and the audit history itself — the
P13 administration scope in [06-ecosystem-workflow.md](06-ecosystem-workflow.md).
