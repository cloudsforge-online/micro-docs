# 31 — Roadmap: ecosystem improvements

Written 2026-08-07.

**This is a plan, not a ledger.** [18-build-status](18-build-status.md) is the ledger: it records
what has been built, and it is corrected forwards rather than rewritten. Everything in this
document is outstanding work. Nothing here may be read as a claim that something has been done.

**How it was produced, so the reader can price the confidence.** All 66 directories in the working
tree were studied, one agent per repository, and every finding was then re-checked adversarially
against the source and — where the claim concerned the live estate — against the deployed
hostnames with `curl`. Findings that did not survive the second pass were dropped or narrowed, and
the narrowings are recorded inline where they change what should be built. Measurements carry
their date. Where something is not known, it says so.

This is one of three roadmap tracks written in the same session. The companions are
[32-roadmap-ui-and-content](32-roadmap-ui-and-content.md) and the completion track, which covers
the unwired integrations, the 501s and the deployment gaps repository by repository. **This
document deliberately does not duplicate them.** It covers only work whose payoff is larger than
the repository that does it — leverage rather than repair. Where an item here depends on a
completion-track fix, it says which one, and the dependency is stated as a precondition rather
than restated as a task.

---

## 1. What "leverage" means in this estate, and where it actually sits

A bug fix returns one working feature. The items in this document return one of five things:

- **(a) survivability** — the estate keeps its data and its ability to tell you it is broken;
- **(b) integrability** — a stranger can build against the platform without being handed a
  credential that authenticates against nothing;
- **(c) cold start** — the machinery has money and activity moving through it for the first time;
- **(d) defect-class elimination** — a mechanical check that makes one whole family of mistake
  impossible to commit, in the owning repository, before a consumer discovers it;
- **(e) network effects** — the titles and the economy make each other more valuable rather than
  merely coexisting.

The estate has a genuinely strong record in category (d) and almost none in the other four. That
asymmetry is the single most useful thing this study found, and it is worth stating plainly before
any individual proposal.

**The record in (d) is real.** `org/tools/estate-scopes.mjs` and `org/tools/estate-topics.mjs` are
cross-repository checkers that fail in the repository that owns the vocabulary rather than in the
first consumer that trips over it. `org/.github/workflows/contract-compat.yml` gates surface
changes on the two repositories that call it. The estate has repeatedly gone looking for its own
signature defect — a client calling a route its server does not serve, recorded at
[18-build-status.md §3.3a](18-build-status.md) — and in the money plane's twelve dossiers not one
instance survived. Where a checker exists, the defect class it covers is genuinely dead.

**The gap in (a) through (e) is equally real, and it has one shape.** Almost every repository in
this estate is more finished than its wiring. The recurring finding, arrived at independently in
five plane studies, is that the code is written, tested and deployed, and the thing joining it to
its neighbour is a row in a table, a line in a shell script, or a variable in a compose file that
nobody has typed. Three measurements make the shape concrete:

| Connective tissue | Built | Connected |
| --- | --- | --- |
| Registered bus topics (`contracts/packages/events/src/index.ts`) | 61 | 9 literal `subscribe` lines in `deploy/scripts/estate-bootstrap.sh`, plus two derived `subscribe_all` calls (`:981` admin-api, `:1005` analytics) |
| Deployed services with an operator path | ~46 | admin-api receives four upstream URLs |
| Telemetry producers | 5 stack components configured | 0 services emit OTLP; `deploy/prometheus/targets/services.yaml` is `[]` |

Counted 2026-08-07 by `grep -c "': Object.freeze({" contracts/packages/events/src/index.ts` = 61
and `grep -c "^subscribe " deploy/scripts/estate-bootstrap.sh` = 9.

The conclusion this document is built on: **the highest-leverage work in this estate is not more
code. It is turning hand-typed wiring into derived wiring, and then applying the (d) idiom — a
checker in the owning repository — to the wiring itself.** A subscription that exists because
somebody remembered to type it will be forgotten again. A subscription derived from the consumer's
own classifier cannot be.

### 1.1 What this document does not propose

Three things were considered and refused, and saying so is cheaper than having them proposed again.

**A message broker.** The outbox-relay-plus-`event_subscriptions` pattern is implemented
consistently in every producer, is transactional with the write it announces, and is not the
problem. Replacing it would discard working code to fix a seeding gap. The problem is that the
subscription rows are typed by hand; that is fixed by §5.1, not by Kafka.

**A service mesh or a shared sidecar.** The estate's failure mode is unconnected services, not
badly connected ones. A mesh adds an operational surface to an estate that has one machine and no
off-host backup, which is precisely the wrong order.

**Publishing everything to npm.** `sdk/README.md:64-87` records not publishing as a deliberate
owner decision, and this document respects it. The narrower problem — that `sdk/openapi.json` is
served nowhere while the API it describes is live — is §3.3, and it does not require publication.

---

## 2. Reliability and survivability

This section covers the estate's ability to survive an event and to notice one. It is placed first
because everything else in this document is worth less if the machine it runs on loses its data,
and because the observability chain is the estate's largest single piece of already-paid-for,
unconnected work.

### 2.1 Off-host copies of the backups that already exist — P1, effort M

**What it is.** Every copy of the estate's data is in one chassis. `deploy/backup/` is a complete
service — archive, restore, verify, prune, keyring, manifest, disk-canary, eight test files — and
the restore was genuinely rehearsed: `deploy/docs/estate-backup-restore.md` Appendix A records the
2026-08-05 drill in which five mainnet databases were restored into a throwaway
`postgres:17-alpine` on `127.0.0.1:55432` with the live cluster untouched. The artefacts are
already encrypted at rest to an `age` recipient whose private identity is deliberately not on the
host. Nothing ships them anywhere.

**Why it pays off.** The precondition that makes shipping backups safe — encryption to a recipient
whose key is elsewhere — has already been solved. The remaining work is a destination and a
schedule, and it converts a rehearsed capability into an actual one. The status page's own copy
makes the argument better than this document can: "A backup that has never been restored is a
claim about the future." A backup that has never left the building is a narrower claim, but it is
still a claim.

**The concrete build.** Pick a destination (object storage with a lifecycle policy is the obvious
one; a second physical machine also qualifies). Add an upload step to the backup runner after the
manifest is written, keyed on the same `SHA256SUMS` the verifier reads, so a partial upload is
detectable. Add a restore-from-remote path to `deploy/docs/estate-backup-restore.md` and rehearse
it once. Then correct `deploy/runbooks/runbook-restore-from-backup.md`, whose §"NONE OF THE BELOW
EXISTS YET" contradicts the rehearsal transcript two directories away — an operator woken by
`BackupAgeExceeded` currently reads that no restore has ever succeeded.

**Cost of not doing it.** A disk failure or a filesystem corruption ends the estate. The mainnet
chain store makes this worse and is treated separately in §2.2.

**Precondition.** The backup runner has no bring-up path at all — it is in no Makefile target, not
in `estate-up.sh`, not in `release-deploy.sh`, and in neither compose project's container count.
That is a completion-track item and must land first; there is nothing to ship off-host until
something takes a scheduled backup.

### 2.2 Treat the Hearth mainnet chain store as irreplaceable data — P1, effort S

**What it is.** The backup exclusion list justifies skipping chain data on the grounds that it is
"reconstructible from the network". For chain 7411 there is no network: one full node, zero peers.
Losing that volume loses 5,000+ blocks of mainnet history and the state they encode, permanently.
The miner *keys* are backed up — the manifest even warns that they are plaintext at rest — which
makes the omission of the chain they mint on look like an oversight rather than a decision.

**Why it pays off.** It is the cheapest irreversibility in the estate to remove. One volume, one
exclusion-list entry.

**The concrete build.** Remove chain 7411's (and 7412's) block store from the backup exclusions,
or add an explicit periodic snapshot of the Hearth data volume with the node stopped or a
consistent snapshot taken. Record the decision in `deploy/docs/estate-backup-restore.md` so the
"reconstructible from the network" rationale is qualified rather than silently wrong.

**Cost of not doing it.** The one asset in the estate that genuinely cannot be regenerated — a
proof-of-work history — is the one asset with no copy.

### 2.3 Connect the observability chain — P1, effort M

**What it is.** The chain is complete in every part and connected in none. `deploy/` ships an OTel
collector, Prometheus, Tempo, Loki, Grafana, twenty alert rules and five dashboards. `lantern`
ships a hand-rolled protobuf OTLP decoder with no parsing dependency. `beacon` exports metrics and
computes error budgets in integer ppm. And no service is configured to emit anything: the estate
compose sets `OTEL_` zero times, `deploy/prometheus/targets/services.yaml` is literally `[]` under
a comment claiming "no service in micro/ is deployed yet", and the twenty alert expressions name
metrics no process emits. `runtime/packages/telemetry` cannot emit a trace id either, because no
repository installs an OpenTelemetry SDK — with only `@opentelemetry/api` present and no
`TracerProvider` registered, the span lookup is always undefined and the trace-to-log join key is
never written.

**Why it pays off.** This is the largest ratio of built-to-connected in the estate, and it is what
makes every other failure in this document visible. Three separate findings in this study reduce
to "nobody was listening": the faucet has been emitting a machine-readable `faucet_dry` since it
started with no scraper; custody's rotation backlog gauge — the answer to "can I remove the old
master secret yet", where the wrong answer destroys keys — is on no dashboard and no alert;
lantern's own `lantern_unknown_ingest_path_total`, built specifically to detect a frontend silently
losing all its telemetry, is itself unmonitored.

**The concrete build, in the order that yields signal soonest.**

1. Generate `deploy/prometheus/targets/services.yaml` from the release manifest, which is what its
   own header comment says was always intended. Give each entry the `__meta_cf_service`,
   `__meta_cf_team` and `tier` labels the SLO recording rules in `deploy/prometheus/rules/slo.yaml`
   read, or those rules stay vacuous even with targets present.
2. Fix the port drift before starting anything, or the first run fails for the wrong reason. The
   telemetry configuration was authored against each service's own default port and never revisited
   after the estate normalised every service to `PORT=4000`: `deploy/prometheus/prometheus.yml:98`
   targets `beacon:4011`, `deploy/alertmanager/alertmanager.yml:118` and `deploy/up.sh:43` post to
   `http://beacon:4011/api/alerts/webhook`, and the collector's Lantern exporter names port 4010.
   The deployed beacon and lantern both bind 4000. Nothing has failed yet only because the stack
   has never been started.
3. Several `/metrics` endpoints are token-gated (measured 2026-08-07: `lantern` and `beacon` both
   answer 401 unauthenticated), so a bare scrape target is insufficient. `prometheus.yml:83-99`
   already models the right shape with a secret file for beacon; generalise it rather than
   hand-writing a second bespoke job.
4. Set `OTEL_EXPORTER_OTLP_ENDPOINT` on the services and register a `TracerProvider` in
   `runtime/packages/telemetry`, so Tempo receives spans and the trace-to-log join actually joins.
5. Set `LANTERN_TRACE_URL_TEMPLATE`, which is unset in the estate, so the request-id lookup — the
   half of lantern the README names as its reason to exist — stops answering `traceUrl: null`.

**Cost of not doing it.** The estate has no way to learn about a failure except by a person
looking. That is survivable at one machine and one operator, and it is the constraint that keeps
the estate at one machine and one operator.

### 2.4 Make the alert links resolve, and check that they do — P1, effort S

**What it is.** All twenty `runbook_url` values in `deploy/prometheus/rules/alerts.yaml` point at
the pre-polyrepo monorepo path, e.g. `:70`
`https://github.com/cloudsforge-online/stack/blob/main/micro/deploy/runbooks/runbook-stuck-withdrawal.md`.
Measured 2026-08-07, that URL returns 404 — the repository is `cloudsforge-online/micro-deploy`.
`deploy/Makefile:69` advertises "THE RUNBOOK RULE — every alert carries a link, and it resolves",
but `deploy/scripts/check-runbooks.py:37` strips the URL to a basename and checks only that a local
file exists. The green check conceals the breakage, which is why neither the deploy nor the docs
study flagged it alone.

**Why it pays off.** It is a one-substitution fix that makes twenty alerts actionable at the moment
they matter, and the guard that goes with it is four lines. The stated policy is that an
unactionable page teaches on-call to ignore pages; this currently makes all twenty unactionable.

**The concrete build.** Rewrite the twenty URLs to
`https://github.com/cloudsforge-online/micro-deploy/blob/main/runbooks/<file>.md`. Extend
`check-runbooks.py` to assert the URL prefix matches the repository's own git remote *before* it
strips the basename. Then run one estate-wide grep for `cloudsforge-online/stack` and
`micro/deploy/` outside this repository — the same substitution is present in other siblings'
absolute links.

**Cost of not doing it.** The first alert to fire after §2.3 lands pages an operator with a 404.

### 2.5 Publish the status document outside its own failure domain — P2, effort M

**What it is.** The public status page runs on the single host it reports on. When the estate is
down, the page that would say so is down.

**Why it pays off.** It is the only external signal the estate has, and it is currently guaranteed
to be absent exactly when it is needed.

**The concrete build.** Either a periodic push of `GET /api/status/public` to an object store or
Cloudflare KV that `status-web` falls back to when the live read fails, or — and this is a
legitimate answer — an explicitly recorded decision in
[16-risks-and-open-decisions](16-risks-and-open-decisions.md) that the estate accepts a status page
which dies with the estate. The refusal is defensible at this scale; what is not defensible is
having neither.

**Cost of not doing it.** During the only outage that matters, the estate is silent to the outside.

---

## 3. Making the platform integrable by third parties

The estate has a developer platform, an SDK, a published route table, an OpenAPI document, a scope
registry and a key store. A developer can complete the entire journey — enrol, create an
organisation, create a project, mint a key, see the secret once — and the key they receive
authenticates against nothing. This section is about closing that, and it is the only section in
this document whose payoff is a product rather than an internal property.

### 3.1 Verify API keys at one place — P1, effort L

**What it is.** `devplatform` serves `POST /internal/keys/verify` (`devplatform/src/server.ts:1406`)
and `POST /internal/oauth/verify` (`:1426`). A grep for those paths across every repository returns
only devplatform's own source and tests, `devportal-web`'s route-table comment
(`devportal-web/src/lib/devplatform.ts:120`), the scope description in
`contracts/packages/auth/src/index.ts:332` and a note in `admin-api/src/scopes.ts:31` — zero
callers. The gateway carries no auth middleware that could stand in: a grep for `forwardauth`,
`forwardAuth` and `basicAuth` across `deploy/gateway/dynamic/*.yml` returns only two prose comments
in `estate-web.yml:221-228` explaining why basicAuth was *not* added. Meanwhile
`sdk/packages/sdk/src/credentials.ts:16` states that `apiKey()` "is what a devplatform key will
be", and puts the key straight into `Authorization: Bearer` — where every service behind
`api.cloudsforge.online` verifies it against identity's JWKS as a JWT. An opaque `cfk_live_…`
string is not a JWT. Measured 2026-08-07: a `cfk_`-shaped bearer to
`https://api.cloudsforge.online/v1/wallets` and `/v1/feed` returns 401.

**Why it pays off.** It is the difference between having a developer platform and having a
developer platform's schema. Revocation, scoping and quotas are all enforced correctly in
devplatform's database and none of them ever run, because the credential never reaches the code
that would read them.

**The concrete build.** Decide the enforcement point first, and prefer the gateway: it is the
single choke point, and it keeps the opaque key outside every service's trust boundary. A Traefik
`ForwardAuth` middleware on the `cf-api-*` routers calling `/internal/keys/verify`, exempted from
the internal-refusal router, translates a valid `cfk_` into the scoped principal the downstream
services already understand. Two things must be written down before it lands: the header-trust
boundary (which headers the gateway injects and which it must strip from a client), and the cache
invalidation, which is exactly what `devplatform.key.revoked` exists for — see §5.1, because that
topic has no subscriber today, so a revoked key would keep working for the life of any cache.

The per-service alternative — an `apiKey` branch in `runtime/packages/auth`'s Verifier, matching
`^cfk_(live|test)_[a-z2-7]{16}_` and introspecting with a 30-second cache — is more code in more
places and is the fallback if the header-trust question cannot be settled.

**Ship metering on the same hop.** `POST /internal/usage` likewise has zero callers, so
`usage_events`, `usage_rollups` and `quota_windows` stay empty forever, the `usage.rollup` job rolls
up nothing, and every project's usage screen renders zero. It is not independently actionable —
usage is keyed on API key, project and environment, which nothing outside devplatform can name
until verification returns them — so it is the second half of this item rather than a separate one.

**Cost of not doing it.** The estate's whole third-party story is unreachable. Every authenticated
route in the SDK's 65-route table answers 401 to the only credential the SDK is designed for.

### 3.2 Give a machine credential a whoami — P2, effort S

**What it is.** Every human credential can ask identity who it is; no machine credential can.
`GET /auth/me` (`identity/src/server.ts:1180`) calls `authenticateUser`, which refuses a service
token, and `deploy/gateway/dynamic/public-api.yml:106-108` carries the refusal forward in a comment
on the public route.

**Why it pays off.** An SDK cannot render "you are authenticated as X with scopes Y", and a support
conversation about a mis-scoped key has no self-service answer. It is small and it removes a
recurring class of support load once §3.1 lands.

**The concrete build.** Do *not* widen `/auth/me` — the refusal there is load-bearing, because a
service `sub` read as a user id is a confused-deputy bug waiting to happen. Add either
`GET /service-tokens/self` in identity returning `{service, scopes, exp}` for a service principal,
or confirm devplatform serves the equivalent over its own key store and add a `keys.self` entry to
the SDK route table. Whichever lands, update the two copies of the note — 18 §3.3d item 4 and
`public-api.yml:106-108` — so they do not outlive the gap.

**Cost of not doing it.** Minor on its own; it becomes a visible product hole the day §3.1 gives
API keys somewhere to authenticate.

### 3.3 Serve the OpenAPI document — P2, effort S

**What it is.** [11-data-and-contract-strategy.md:288](11-data-and-contract-strategy.md) names
`sdk/openapi.json` as the artefact third parties are given. Measured 2026-08-07:
`https://api.cloudsforge.online/openapi.json` returns 404, and `developers.cloudsforge.online`
returns 200 but has no reference or OpenAPI page — `devportal-web/src/pages` contains directory,
keys, oauth, organisation(s), platform, project, usage and webhooks, and nothing else.

**Why it pays off.** The description already exists, is committed, and is CI-checked. Serving it
costs a gateway router and is independent of the npm publication decision, which
`sdk/README.md:64-87` records as a deliberate refusal this document does not reopen.

**The concrete build.** A gateway router serving the committed `sdk/openapi.json` at
`api.<apex>/openapi.json`, or a `/reference` page in `devportal-web` that renders it. Feed it from
this repository's committed artefact so the existing `--check` keeps it honest. Then re-run the
publishing-gate checklist in `sdk/README.md:68-87`: item 4 is stale, because devplatform now issues
keys.

**Cost of not doing it.** A developer who obtains a key has no machine-readable description of what
to do with it.

### 3.4 Make the public-surface check run in both directions — P2, effort M

**What it is.** `sdk/tools/public-api.ts`'s `--gateway` mode asserts that every resource in the SDK
route table is routed at the gateway. It does not assert the inverse.
`deploy/gateway/dynamic/public-api.yml:161-166` routes seven resource families on the API host —
`/v1/apps`, `/v1/keys`, `/v1/oauth-clients`, `/v1/organisations`, `/v1/projects`, `/v1/scopes`,
`/v1/webhook-endpoints` — that appear nowhere in `sdk/packages/sdk/src/routes.ts` (65 routes, 8
services) or in `sdk/openapi.json` (52 paths). Measured live: `/v1/scopes` 200, `/v1/apps` 200.

**Why it pays off.** This is the (d) idiom applied to the public surface. The repository whose
entire purpose is to be the estate's one record of what is public is currently missing part of what
is public, and the check that was built to prevent exactly that runs one way.

**The concrete build.** Extend `gatewayGaps` with an inverse pass: parse every `PathPrefix` on the
API-host routers, subtract the table's first path segments, and fail on any remainder unless it is
in a named, commented allowlist. Close the gap it reports by adding the devplatform read routes to
the table or excluding them with a written reason. Extend the CI mutation step to *add* a router as
well as remove one, so both directions are proved non-vacuous.

**Cost of not doing it.** Public surface accumulates without a record, and the record's own
credibility is the product.

### 3.5 Resolve route citations rather than pattern-matching them — P3, effort S

**What it is.** `sdk/packages/sdk/src/routes.ts` gives each route a `verifiedAt` of the form
`<service>/src/server.ts:<line>`, and `sdk/tools/public-api.ts:194` writes "Verified against
`activity/src/server.ts:318`" into the published OpenAPI description. Line 318 is inside the
`/readyz` entry; `/feed` is registered at `activity/src/server.ts:347`. `routes.ts:602` cites
`:351` for `activity.record`; that line is `const limit = parseLimit(...)` inside the `/feed`
handler, and `/feed/:id` is at `:380`. `deploy/gateway/dynamic/public-api.yml:87` repeats the same
wrong 351. `routes.test.ts:15-21` asserts only that the string matches the shape and that the
service prefix agrees; nothing reads the file.

**Why it pays off.** The estate already learned this lesson once — 18 §3.3o records `micro-mint-web`'s
citation test going stale and "failing with a diagnosis that is false", and the fix was to read the
number rather than hardcode it. Applying it here makes every provenance claim in the published
artefact self-verifying, and the first run will surface the other stale ones in one pass.

**The concrete build.** Extend `routes.test.ts` to resolve each `verifiedAt` against the sibling
checkout and assert the cited line falls within the route entry declaring that method and path.
Skip rather than fail when the sibling is absent, so an external `pnpm test` still passes. Correct
the two activity citations and whatever else the pass reports. In `public-api.yml:87`, drop the
line number entirely and cite the SDK entry, so there is one copy rather than two.

**Cost of not doing it.** The estate ships provenance claims that point at the wrong line, in the
one artefact whose value is that its claims are checkable.

---

## 4. Cold start, and giving EMBER real utility

This is the section the whole estate turns on, and it is the one where the study's findings agreed
most completely across planes that did not talk to each other.

**The finding, stated once.** No economic activity has ever originated. Foresight's markets read
`pool: {yes:"0"}`, `stakerCount: 0`, `houseSeed: null`, `provenance: null` on all nine live
markets. Market's browse page serves `{"listings":[]}` on both networks. The developer directory is
empty. The Worlds registry's only mainnet row is smoke residue from a verification script.
Tessera's front door lists 42 wards all named "Private Ward 178585xx", created by a test harness.
The faucet's funding address holds nothing. Billing's `POST /purchases` — fully argued, fully
tested, with the ledger write inside the transaction — has no caller anywhere in the estate.

The invariants would hold. The arithmetic is proven. What has never been demonstrated is money
moving.

**The estate designed the cure and has not switched it on.**
[21-engagement-treasury.md](21-engagement-treasury.md) is a complete design for exactly this
problem, and 18-build-status.md:309 names it. Every consuming surface has already built and tested
its half — `foresight-web` carries `houseseed.test.ts` and a disclosure component that renders only
when `houseSeed` is non-null. The treasury has never been funded and no policy has been raised
above zero.

### 4.1 Fund the testnet faucet, which is the only on-ramp there is — P1, effort S

**What it is.** The testnet money plane is sealed. `deploy/scripts/estate-bootstrap.sh:1010-1132`
mints the faucet's treasury address through custody and writes `FAUCET_FUNDING_ADDRESS` into
`tokens.env`, and there is no step anywhere in the bootstrap or verify scripts that transfers EMBER
into it, and no check that its balance is non-zero. The testnet coinbase holds roughly 10,700
EMBER. The faucet's address appears nowhere in the funding runbook, so it was never a target of any
funding procedure.

**Why it pays off.** It is one transfer, and it is the precondition for every testnet journey a
developer or a tester could walk. Without it, a testnet visitor's first action fails silently: the
faucet accepts the drip, queues it, and holds it forever, reporting plain `queued` with
`failureReason: null` (`faucet/src/server.ts:418-435`).

**The concrete build.** A transfer from the testnet coinbase to the faucet's custody-held treasury
address, a step in the funding runbook that covers it, and a non-zero-balance assertion in
`estate-verify.sh`. The alarm half — `faucet_dry` and `faucet_budget_remaining_wei` are emitted and
nothing scrapes them — is §2.3.

**Cost of not doing it.** Every testnet on-ramp is a dead end that reports success.

### 4.2 Give the administered EMBER price an operator path — P1, effort M

**What it is.** Every USD-denominated sale in the estate converts through a single administered
EMBER price, and no deployed caller can update it. `pricing` serves `PUT /admin/prices`; the seed
at `pricing/src/migrations.ts:181-188` inserts EMBER at 250000 with `set_by` null, deliberately, so
that the board can say nobody has yet taken responsibility for the number. `admin-web` has no
pricing panel and `admin-api` constructs no pricing client, so the only way to move it is to
hand-craft a `pricing:admin` token against a loopback port. The staleness rule exempts the
administered price by design, so a price nobody can change also never goes stale.

**Why it pays off.** Billing prices in USD cents and settles in EMBER; mint, foresight and market
all convert through this one number. It is the single most consequential unowned value in the
estate, and it is unreachable from any console.

**The concrete build.** Add a pricing upstream to `admin-api` following the existing `upstreams.ts`
pattern that forwards the operator's own bearer, so the upstream audit names the human rather than
a service. Expose the administered price as a two-eyes action in `admin-api/src/actions.ts` — this
is a number that moves the value of every entitlement in the estate and should not be a
single-operator write. Render it in `admin-web` with `set_by` and the time of the last change shown
beside it, because the seed's null is a deliberate statement and the console should keep saying it
until someone signs for the number.

**Cost of not doing it.** The estate's unit of account is set by a database seed and cannot be
corrected without a shell.

### 4.3 Switch on the Engagement Treasury — P1, effort L

**What it is.** [21-engagement-treasury.md](21-engagement-treasury.md) describes the mechanism the
estate designed as, in its own framing, the answer to every empty room's cold start. `admin-api`
implements the three treasury actions — `engagement.transfer`, `engagement.policy.set`,
`engagement.report` (`admin-api/src/actions.ts:256-288`) — and can fund `engagement:market`.
`market` implements the whole of the consuming side: `engagement_windows` with a GiST no-overlap
constraint and budget/bounty-pair constraints (`market/src/migrations.ts:658-688`), `activeWindow`
fee waiving at listing creation (`market/src/server.ts:779-808`), settlement-time subsidy funding
from `engagement:market` (`:1111`, `:1234`; `jobs.ts:285-295`) and bounty payment (`:1490-1496`).
There is no HTTP way to open a window, list windows or read grants, and no seeder or SQL in
`deploy/` inserts into `engagement_windows` — a grep over `deploy/` for `engagement_window` returns
nothing.

**Why it pays off.** It is the difference between a marketplace that is empty because nobody has
listed anything, and a marketplace whose first listings the platform itself underwrote on purpose,
with the subsidy disclosed. Every other cold-start proposal in this document is a special case of
it.

**The concrete build.** Three parts, and only the first is new code of any size.

1. Routes on `market` to open a window, list windows and read grants, gated on the operator scope
   the other admin routes use. The enforcement is already in the schema; what is missing is a door.
2. `ADMIN_API_URL` in billing's compose environment — one line — without which migration 10's
   `engagement_fee_recycles` table, the `RECYCLE` job (`billing/src/jobs.ts:232`) and the whole of
   `recycle.ts` are unreachable code. Not one period row has ever been written.
3. An operator flow in `admin-web` that funds the treasury, sets a policy and opens a window, with
   the disclosure text the consuming surfaces already render.

**The refusal that must survive.** Every subsidised transaction must remain visibly subsidised.
`foresight-web`'s `houseSeed` disclosure is the model: the component renders only when the seed is
non-null, so a seeded pool cannot be mistaken for organic depth. Do not relax that to make a page
look busier.

**Cost of not doing it.** Every commerce surface stays empty; every design document that assumes
liquidity stays untested; and the estate's answer to "why is this page blank" remains "because
nobody has used it", which is honest and is not a strategy.

### 4.4 Register the titles so a purchase can become a world — P1, effort S

**What it is.** Two titles implement the worlds provisioning contract and neither is in the
registry. Measured 2026-08-07: `GET https://api.cloudsforge.online/v1/titles` returns the single
title `emberkin` with `capabilities: []` — inserted by `deploy/scripts/estate-verify.sh:858` for
the achievements check — and `GET https://api-testnet.cloudsforge.online/v1/titles` returns
`{"titles":[]}`. Meanwhile `GET https://tessera.cloudsforge.online/v1/title` returns 200
`{"slug":"tessera","name":"Tessera","capabilities":["private_world","cosmetics","inventory"]}`
(served at `tessera/src/server.ts:425,430`) and aetherholm declares `['private_world']` at
`aetherholm/src/server.ts:147` with the same two routes at `:406,411`.

**Why it pays off.** It is the smallest change in this document with the largest product
consequence: it is the difference between a paid entitlement terminating as an `unsupported`
provisioning row and a paid entitlement becoming a world.

**The concrete build.** `deploy/scripts/seed/worlds.mjs`, following the existing `seed/*.mjs`
pattern: mint an admin token, `POST /v1/titles` for tessera (`serviceUrl: http://tessera:4000`) and
aetherholm, with capabilities read from each title's live descriptor rather than typed, idempotent
via the slug upsert at `worlds/src/titles.ts:151-160`. Run worlds' own conformance suite
(`worlds/src/conformance.ts`) against each `serviceUrl` first and refuse to register a title that
fails — that is the check the conformance harness exists for, and it has never had a caller.

**Cost of not doing it.** The paid-world journey — buy, provision, play, earn, publish — cannot be
walked end to end on the deployed estate, and `GET /v1/titles`, which a launcher is meant to list
games from, returns an empty array to every visitor.

### 4.5 Seed the surfaces whose emptiness is content, not liquidity — P2, effort M

Three of the empty rooms are not waiting on money. They are waiting on somebody running an existing
pipeline once.

- **Foresight provenance.** Measured 2026-08-07: `provenance` is null on all five mainnet markets
  sampled. The page then renders "Somebody on our team wrote this question by hand, so there is no
  search behind it to show you." The idea pipeline — search, model proposal, cited sources, operator
  queue — exists and has never been run against the live estate. Running it for at least one market
  per category turns the single strongest differentiator against an ordinary bookmaker from a named
  hole into the thing it was built to be. [22-browser-journeys.md:541](22-browser-journeys.md)
  makes BJ-FOR-07 a starred journey on exactly this ground.
- **Tessera's Commons.** The mainnet front door lists 42 harness-created private wards.
  `tessera-assets/content/objects.json` holds 96 free platform seed objects (12 categories × 8) that
  no table and no route can serve. Seeding the Commons and exposing the seed catalogue turns the
  first screen a stranger sees from residue into the world the copy describes. The route work is a
  completion-track item; the seeding is this one.
- **The developer directory.** Empty on both networks, with an empty state that offers no next
  action. It fills as a consequence of §3, not independently.

**Cost of not doing it.** The estate's best-written screens describe things that are not there, and
the honest empty states — which are genuinely the plane's best asset — are doing the work that
content should do.

---

## 5. Engineering leverage: killing whole classes of defect

This is the estate's idiom and its best habit. `org/tools/estate-scopes.mjs` and
`org/tools/estate-topics.mjs` fail in the repository that owns the vocabulary rather than in the
first consumer to trip over it; `org/.github/workflows/contract-compat.yml` gates surface changes.
Every proposal below is in that shape: a mechanical check or a derived artefact that makes one
family of mistake impossible to commit, rather than a fix for one instance of it.

They are ordered by how many current findings each one retires.

### 5.1 Derive event subscriptions from the consumers that classify the events — P1, effort M

**What it is, and it retires more findings than anything else in this study.** Who receives which
event is 30-odd hand-typed lines in one shell script. Counted 2026-08-07:
`grep -c "^subscribe " deploy/scripts/estate-bootstrap.sh` returns 9 — identity ×5, indexer ×1,
settlement ×2, wallet ×1 — against 61 registered topics. Two consumers escape by being derived:
`subscribe_all admin-api … $audited` at `:981` and `subscribe_all analytics …` at `:1005`. Every
other consumer is fed by whatever somebody remembered to type.

The consequences found independently in five plane studies, all reducing to this one cause:

| Consumer | Rules written | Rules that can fire |
| --- | --- | --- |
| `notify` | ~40 catalogue entries, including the four `critical` ones | 4 identity topics |
| `activity` | 61 topics classified | 3 |
| `worlds` / `emberkin` / `tessera` provisioning | `billing.entitlement.granted` handled in all three | 0 subscriptions in `deploy/` |
| `market` outbox | 11 topics | 2, via `subscribe_all`; notify has none, so the seller-facing templates cannot fire |
| `foresight` outbox | 7 topics | 0 |
| `aetherholm` outbox | 9 topics | 1, via `subscribe_all $audited` |
| `community` outbox | 3 topics | 1 |
| `devplatform` key issued/revoked | notify holds rules and templates for both | 0 |
| `studio.usage.recorded` → billing | emitted at `studio/src/credits.ts:248` | 0, and billing has no handler |

The `notify` row is the one that matters most: nobody is told a private key was exported — the
flagship un-opt-out-able alert of [04-domain-model](04-domain-model.md) §10.3 — that a deposit
landed, that a withdrawal was requested or completed, that a listing sold, or that a token
deployed. `custody/src/exports.ts:459`, `wallet/src/outbox.ts:75`,
`settlement/src/outbox.ts:63` and `market/src/listings.ts:50` all emit. Nothing is subscribed.

**And it is worse than "not yet connected", because the loss is irreversible.**
`community/src/outbox.ts:319-330` states the mechanism in its own words: with no active
subscription "the count below is zero on the first pass, the row is published immediately, and it
is never reconsidered. A subscriber added afterwards gets nothing." Every event produced before the
fix is permanently unrecoverable. This is why the item is P1 and why it should be done before the
cold-start work in §4 rather than after it — seeding activity into an unsubscribed bus produces a
history nobody can ever reconstruct.

**Why deriving beats typing.** A hand-typed list is wrong the moment a consumer adds a rule, and
nothing goes red. A derived list cannot be. The estate already proved the pattern twice:
`subscribe_all admin-api` derives from the audited-topic set, and `subscribe_all analytics` derives
from `EVENT_TOPICS`.

**The concrete build.**

1. Extend the derivation to the two consumers that were never given one: read the topic keys out of
   `activity/src/classify.ts` and `notify/src/catalogue.ts` and subscribe every topic each
   classifies, from whichever producer's database `contracts/packages/events` names as its producer.
   Fail loudly on a parse that returns fewer than a floor, so a refactor that breaks the parse
   presents as a bootstrap failure rather than as a silent estate with no notifications.
2. Do the same for the entitlement bridge: `billing.entitlement.granted` and `.revoked` to
   `worlds`, `emberkin` and `tessera`. Check each title's inbox arm before seeding — see §5.3,
   because a delivery to a title that has moved to contract-only verification will 403.
3. Add the standing check: `deploy/scripts/estate-verify.sh` should assert one non-identity crossing
   end to end (a confirmed deposit reaching the recipient's feed within 30 seconds), and should fail
   when any producer's outbox has a topic with zero subscriptions and no recorded refusal.
4. Where a topic genuinely should have no subscriber, record the refusal the way
   `identity.user.deleted` is recorded, rather than leaving it indistinguishable from an oversight.
   `foresight`'s `.closed`, `.settled` and two `.imaged` topics are the clearest candidates.

**Cost of not doing it.** Every notification the design documents call load-bearing is silent in
production, users still poll — which is the exact behaviour
[02-target-architecture](02-target-architecture.md) §5 lists these topics to end — and each day the
gap stays open produces another day of events that can never be delivered.

### 5.2 Make the topic registry complete, and keep the checker green — P1, effort M

**What it is.** `org/tools/estate-topics.mjs` exists and failed for months. Run on 2026-08-07 it
reported: `estate-topics: FAILED — 2 disagreement(s) between repositories`. One was
`identity.password.reset_requested`, which `notify` holds a rule for at
`notify/src/catalogue.ts:764` and identity emits at `identity/src/passwordReset.ts:362`, with no
registry entry — so password-reset email reached notify only because two repositories guessed the
same string. The other was `studio/src/uploads.ts:220` emitting
`studio.asset.visibility.changed`, which has four segments and is therefore not a legal topic name
under the contract's `TOPIC_PATTERN`.

> **Both live findings were fixed on 2026-08-08 — micro-org#263.** contracts registered
> `identity.password.reset_requested` with the spec identity had been holding in quarantine
> (character for character, `keyedBy: 'user_id'` read off the emit site) and gave it a
> `TOPIC_AUDIT` row; identity deleted the quarantine entry, which is that table emptying itself
> exactly as designed; studio renamed its topic to `studio.asset.visibility_changed`, which cost
> nothing to coordinate because a four-segment name can have no validating consumer to break.
> **Items 1 and 2 below remain open for the quarantine sweep** — market's 7, mint's 4, trade's 4,
> worlds' 3 and custody's 1 — and item 4 is untouched. What changed is that the gate is no longer
> red for two reasons that were already understood, so a new red line means something new.

The same run censused unregistered emitted topics with no
quarantine spec: foresight 7, nda 16, studio 5, custody 4, admin-api 3, worlds 3. `market` holds 7
in an explicit `AWAITING_REGISTRATION` quarantine (`market/src/topics.ts:102-229`); `mint` holds 4
(`mint/src/topics.ts:115-160`); `trade` holds 4.

**Why it pays off.** An unregistered topic is not merely undocumented — it cannot be consumed
safely. `contracts/packages/events/src/index.test.ts:451-457` pins that an unregistered topic fails
`validateEnvelope`, so any consumer that validates envelopes refuses it on arrival, and
`activity/src/ingest.ts:277` takes its unregistered branch, filing the event as `unclassified` /
`internal` with a 90-day quarantine retention rather than the 730 days a security record gets. The
worst instance: `identity.role.changed`, which identity's own registry calls the single most
consequential write in the estate, is unregistered, so a user promoted to or stripped of a platform
role gets no feed entry and the record is retained for 90 days.

**The concrete build.** The quarantine maps are self-emptying by design — each repository's
`topics.test.ts` fails the moment contracts registers an entry, which is the intended forcing
function — so the work is one contracts commit followed by a sweep.

1. Copy the quarantined specs verbatim into `TOPICS` in
   `contracts/packages/events/src/index.ts`: market's 7, mint's 4, trade's 4, worlds' 3
   (`worlds.inventory.granted`, `worlds.inventory.listed`, `worlds.achievement.unlocked` — the last
   is the one worlds event that actually flows today) and custody's `custody.export.cancelled`.
   `keyedBy` is read off the emit site and is contract, not preference.
   (`identity.password.reset_requested` was the sixth on this list and is done — micro-org#263.)
2. Add the matching `TOPIC_AUDIT` rows in `contracts/packages/events/src/audit.ts` in the same
   commit — `trade.fill.settled` and `trade.fee.settled` are the two that move money and are
   currently the least classified; `worlds.achievement.unlocked` is unaudited and so never reaches
   admin-api's mirror.
3. ~~Report the studio rename (`studio.asset.visibility.changed` → `…visibility_changed`) to
   micro-studio.~~ Done 2026-08-08 — renamed in `studio/src/uploads.ts` rather than absorbed into
   `org/tools/estate-topic-gaps.json`, because a gaps entry would have bought a green sweep and
   left the event unconsumable. The gaps file is for a finding waiting on somebody else, not for
   one whose fix is a one-line rename in a repository this estate owns.
4. Add the mirror check each repository is missing: assert that every `_TOPIC` constant in `src/`
   resolves in the registry, and that every topic an inbox branches on is registered. That second
   check is what would have caught `devplatform`'s org-deletion branch, which listens for
   `identity.organisation.deleted` — a topic nothing emits and contracts does not register — so the
   one automatic mass-revocation devplatform implements can never fire.

**Cost of not doing it.** A red estate-wide gate becomes a gate nobody reads, which
`beacon/src/estate.ts` warns is how a check turns into a switched-off check. And the estate's most
consequential security events are filed as unclassified and deleted early.

### 5.3 One signing scheme, enforced by a grep — P1, effort M

**What it is.** 18-build-status §3.3p repaired five producers off a drifted local
`x-cloudsforge-signature: sha256=<hmac over body>` scheme by deleting their local implementations
and importing `signDelivery` from `@cloudsforge/contracts-events`. Four money-plane producers were
never converted — billing, custody, foresight and studio — and `nda`'s outbox was missed while its
*inbox* was repaired: `nda/src/server.ts:53` imports `SIGNATURE_HEADER`/`verifyDelivery` from the
contract, while `nda/src/outbox.ts:101` still declares its own header constant and `:103` signs the
old format. Three of the four money-plane producers at least renamed theirs `LEGACY_` and
documented the deferral; nda's carries no comment at all.

**Why it pays off.** These edges fail *after* being wired, which is the worst possible ordering: a
subscription seeded by §5.1 to a contract-verifying inbox will 403, and the diagnosis looks like a
credential problem. It also blocks a cleanup elsewhere — `emberkin` instruments its legacy arm and
intends to delete it when the legacy counter reaches zero, and a live nda producer would keep that
counter non-zero for a reason unrelated to billing. Meanwhile settlement's legacy arm is now
*definitely* dead: its own stated removal condition, wallet's relay adopting `signDelivery`, has
been met (`wallet/src/outbox.ts:338-351`), and until it is deleted settlement's only inbound path —
the delivery that starts a real payout — still accepts an HMAC with no timestamp binding.

**The concrete build.** Convert the five remaining producers, delete settlement's legacy arm and its
test pins, then add the check: a CI grep in the estate contract-checker step that fails any
repository declaring a local `x-cloudsforge-signature` constant on a producing path. Prove the guard
by reintroducing the defect, which is the estate's own standard for a new check.

**Cost of not doing it.** A sixth instance, and a class of failure that only manifests at the moment
the integration is finally connected.

### 5.4 Assert that every deployed service is reachable by somebody — P1, effort M

**What it is.** Four services — policy, notify, analytics and community — are deployed, tested,
bound to loopback, absent from the gateway, and absent from `admin-api`'s environment. Measured:
`grep -rlo '<svc>:4000' deploy/gateway/` returns nothing for all four, while activity, devplatform,
identity, admin-api and hub-api all match. `admin-api` — the estate's only operator BFF, behind its
only operator console — receives exactly four upstream URLs at
`deploy/compose/docker-compose.estate.yml:3281-3284`: `IDENTITY_URL`, `LEDGER_URL`, `BILLING_URL`,
`MARKET_URL`. A grep for `POLICY_URL|ANALYTICS_URL|NOTIFY_URL|COMMUNITY_URL` across `admin-api/src`
returns nothing.

So an operator cannot freeze a subject, publish or inspect a policy rule, read a funnel or a
retention cohort, see whether a notification was delivered, or look at a governance proposal — in a
live estate where all five capabilities are built, tested and running. `policy/README.md:112`
justifies its one-operator-to-freeze asymmetry with "an operator watching an account being drained
at 3am has to find a colleague first"; that operator has no button at all.

**Loopback-only is the correct posture for these services.** The missing piece is the operator path
through admin-api, not a public gateway route. This document explicitly does not propose exposing
them.

**Why it pays off in the (d) idiom.** The individual wiring is a completion-track fix. The leverage
is the check that makes the class impossible: **every service with a compose block must be either
gateway-routed or named as an upstream of some BFF, or listed in a file that records why it is
neither.** That check would have caught all four at once, and it will catch the fifth.

**The concrete build.** Add the four URLs to admin-api's environment; grant admin-api the scopes
those services demand; add thin proxy routes under `/v1/policy/*`, `/v1/notify/*`, `/v1/analytics/*`
and `/v1/community/*` following the existing `upstreams.ts` pattern that forwards the operator's own
bearer so the upstream audit names the human. Then add the reachability assertion to
`estate-ci.yml`.

**Cost of not doing it.** Five built capabilities remain unusable, and the plane has no way to
answer "why was this decision made" or "was this person told" outside a psql session.

### 5.5 Fix the two spines that propagate by copy — P2, effort M

**What it is.** The estate has four shared foundations and three of them spread by copying rather
than by version.

- **`runtime`** publishes seven packages that 30 repositories depend on. **`ui`** publishes one
  package that 19 frontends depend on. Neither repository runs `contract-compat.yml` on its own
  diff — the only callers estate-wide are `contracts/.github/workflows/ci.yml:54` and
  `sdk/.github/workflows/ci.yml:203`. Because resolution is a sibling symlink rather than a
  published version, a removed field or narrowed type in either reaches every consumer at once with
  no version to pin behind. That is precisely the scenario `compat.ts`'s `compareSurfaces` was
  written to catch, unapplied to the two repositories with the widest blast radius.
- **Consumers resolve runtime by two different pnpm protocols.** 20 repositories declare
  `link:../runtime/packages/auth`; 10 declare `file:`. Under pnpm the two have different failure
  modes for the same edit — `link:` resolves the package's own dependencies through the sibling's
  `node_modules`, which is the mechanism the CI fix at 18-build-status.md:346-352 depends on and
  describes, while `file:` injects a hard-linked copy. `service-template/package.json:28` is on the
  minority protocol, so every new service is born on the one the CI fix was not written for.
- **`web-template` spreads by `git clone`.** So a fix travels badly — the `useResource` deps fix was
  made in nine consumers and never returned to the template — and a defect travels perfectly. The
  `$scheme://$host` sitemap sits identically in fourteen `nginx.conf` files, locked in by each
  repository's own passing test.

**Why it pays off.** These three facts explain a large fraction of the individual defects found
across all four planes. Copy-propagation is not a style problem; it is the delivery mechanism for
every defect in a shared foundation.

**The concrete build.** Add a `compat:` job to `runtime/.github/workflows/ci.yml` and
`ui/.github/workflows/ci.yml` calling `contract-compat.yml`; run it against the last several tags
first to size the existing backlog, and make it required only after. Pick `link:` as the one
protocol — it is what the CI fix is written against and what the 20-repository majority uses — and
change the ten manifests, starting with `service-template`. Add the protocol check to micro-org's
hygiene workflow and prove it by planting a `file:`. For `web-template`, fix the origin first, add a
template test that fails on a literal `$scheme` inside a sitemap or robots block, then sweep the
fourteen consumers and update each `sitemap.test.ts` expectation in the same commit — the
consumer-side sweep is a [32-roadmap-ui-and-content](32-roadmap-ui-and-content.md) item; the
template fix and the guard belong here.

**Cost of not doing it.** The next breaking change in runtime or ui reaches thirty repositories
with no gate, and the next `web-template` defect is copied fourteen times before anyone notices.

### 5.6 Make `cfctl new service` instantiate the service template — P1, effort L

**What it is.** `org/tools/cfctl.ts:1104` resolves the template directory to
`ORG_ROOT/templates/<kind>` with no fallback. `org/templates/service` is a 159-line stub predating
the runtime libraries: `src/env.ts` 33 lines, `src/index.ts` 116, `src/index.test.ts` 10, zero
`@cloudsforge/*` dependencies in its `package.json`, no `assertGeneratedSecret`, and
`src/index.ts:15-16` still carrying `// swap for: import { livez, readyz } from
'@cloudsforge/lifecycle';`. It has no migrations, no migrator, no outbox, no inbox, no leased jobs,
no auth and no Lifecycle. Against that,
[03-repository-responsibilities.md:113](03-repository-responsibilities.md) and 18-build-status.md:194
both state that `cfctl new service` instantiates `micro-service-template`, and
`service-template/README.md:8` says the same. No test in micro-org asserts the two stay in sync.

**Why it pays off.** This is the estate's defect factory. A developer following the documented
one-hour path gets a service satisfying roughly two of the ten rules and must hand-write the outbox,
migrations and secret validation — which is exactly how the four defect families in 18-build-status
§3.3p were created. Every future service is a fresh chance to re-derive them, and every item in
§5.1 through §5.3 is a consequence of somebody having done so.

**The concrete build.** Decide the single source (micro-service-template), resolve `templateDir` to
the sibling checkout for kind `service`, apply the existing token substitution to package name,
`SERVICE`, database URL, port and scope names, and have `instantiate` drop the demonstration files
the template's own README step 3 says to delete. Delete `org/templates/service`. Then add the test
that makes it stay true: run `cfctl new service probe` into a temp directory and assert `pnpm
typecheck` passes and that `src/migrations.ts`, `src/outbox.ts` and the `assertGeneratedSecret` call
are present.

**Fix the template's own gaps in the same pass**, since they will be inherited by everything: it
ships the inbox helper but no ingest route, so every consumer invents its own; it prescribes
`OUTBOX_ACCEPT_SECRETS` rotation in prose without declaring it in `Env`, so ten services re-derived
it; and `src/outbox.ts` still imports the crypto primitives whose local use *was* the §3.3p defect,
leaving them in scope one line above the comment telling you not to use them.

**Cost of not doing it.** Repository 49 starts with the same four defects repositories 1 through 48
had to be repaired for.

### 5.7 Make the request deadline and the trace id survive a hop — P2, effort M

**What it is.** `runtime/packages/http` sets `x-deadline-ms` on every outbound request and nothing
reads it. A grep for the header across the whole estate returns that line,
`sdk/packages/sdk/src/transport.ts:291` (which restates it) and one test. So each hop starts a fresh
10-second budget, and the README's own rule 5 — "A 10-second budget must not be spent three times
down a chain" — describes exactly what happens today: a three-hop chain can burn 30 seconds under a
caller that gave up at 10. Separately, `HttpClient` accepts a `traceparent` and no call site in the
estate supplies one; a grep across every `.ts` returns six files and zero service call sites.
[08-prioritised-backlog.md:348](08-prioritised-backlog.md) states that `@cloudsforge/http` provides
traceparent forwarding. The parameter exists; the forwarding does not.

**Why it pays off.** Deadline propagation is the mechanism that stops one slow peer becoming
estate-wide connection exhaustion — the failure `@cloudsforge/http` was written to remove. Trace
propagation is what makes §2.3's spans worth collecting; without it, correlation stops at every
service boundary and Tempo receives disconnected fragments.

**The concrete build.** Add a `deadlineFrom(headers)` helper and a request budget returning
`min(header, local default)` minus a hop allowance; add a `traceparent?: () => string | undefined`
client-level hook alongside the existing token hook, which is the shape that fits because
`@cloudsforge/http` is deliberately zero-dependency and cannot read the OTel context itself. Wire
both in `service-template` so new services get them free, thread the budget into each service's
`upstreams.ts`, and mirror in the SDK transport. **Test the request, not the response** — assert
that the outbound `x-deadline-ms` is strictly less than the inbound one. Land the traceparent half
with §2.3 so the value is real rather than synthesised.

While in this area, add the guard the SDK is missing: `sdk/packages/sdk/src/transport.ts:46,49`
restates `runtime`'s retriable-status set and idempotent-method set with nothing keeping the two in
sync, so adding 409 to runtime's list would leave the published client silently on the old
behaviour. A test that reads the sibling as text and asserts set equality — skipping when the
sibling is absent — is the same shape as §3.5.

**Cost of not doing it.** Cascading timeouts under load, and an observability plane that cannot
follow a request past its first hop.

### 5.8 Give the conformance corpus a consumer and unblock its sweeps — P2, effort L

**What it is.** `micro-conformance` records real HTTP interactions and replays them, and
[22-browser-journeys.md:207-210](22-browser-journeys.md) names it as the tier-2 stub source for
every frontend. No frontend can consume it: the package is `private` with no `exports` map and a
TypeScript-source bin, so a repository that wanted `loadCorpus` cannot import it.
`market-web/test/fixtures.ts:10-14` says so in a comment and hand-writes its own shapes instead.
Coverage is also thin — the micro corpus records 8 suites against 22 domain services, with nothing
for market, custody, ledger, notify, settlement, pricing, foresight, community or activity.

Two estate-wide invariants it owns are also offline: both sweeps exit 1 without scanning a single
route, because one beacon test fixture embeds a literal NUL byte in source and conformance's readers
throw `UnreadableSourceError` on the first one (`conformance/src/ledgeraccounts.ts:370-373`) with no
per-file catch. One byte in one repository takes the ledger account-type collision sweep and the
private-key leak scan offline, and `estate-ci`'s blind-route ratchet never gets an observed number.

**Why it pays off.** Every frontend currently hand-writes its stubs from its own client's type
declarations — which is a stub agreeing with the client's imagination rather than with the service's
recorded wire, and produces a green frontend suite against a surface that has changed. That is the
estate's signature defect (§3.3i/§3.3m) reintroduced at the test layer.

**The concrete build.** Catch `UnreadableSourceError` per file and report it rather than aborting,
which brings both sweeps back for the price of one try/catch. Give the package an `exports` map for
`./corpus`, `./types` and a new `./stub`. Add a `conformance stub --corpus <dir> --port N`
subcommand serving recorded interactions by method and path — the replay half already exists in
`compare.ts`; only the server does not. Extend the corpus with a market suite first, since
`market-web` is the consumer that has already written the gap down, then convert its fixtures to
read the corpus.

**And fire the Beacon publish wire, which has never been fired.** Both halves exist —
`conformance/src/cli.ts:292-297` and `src/publish.ts:117,179` on one side,
`beacon/src/server.ts:735` `POST /v1/conformance` on the other, whose comment names the CLI as its
only caller. A grep for a conformance invocation across every workflow and shell script in the
estate returns nothing. So `beacon/src/gate.ts:305-306` emits `conformance_never_run`, which is in
the non-overridable list, and the release gate carries a permanent unknown by design. Two mechanical
blockers stand in the way of even a manual run and are named in the conformance dossier: the `micro`
base defaults to a localhost apex, and `assertTlsTrust` demands `NODE_EXTRA_CA_CERTS` for any https
base — which has no correct value for the public estate, since measured 2026-08-07
`https://beacon.cloudsforge.online/livez` returns 200 to plain curl with the system trust store.

**Cost of not doing it.** Two estate-wide invariants produce no measurement at all, every frontend's
stubs drift independently, and the release gate refuses everything the day it is finally wired in.

### 5.9 Close the registry and scope-vocabulary drift in micro-org — P2, effort M

**What it is.** The registry that names every repository is missing five real ones. `cfctl doctor`
reports five `FAIL … is checked out beside the estate and is in no registry row` —
`hearth-wallet-core`, `wallet-assets`, `wallet-desktop`, `wallet-extension`, `wallet-mobile` — each
with a `cloudsforge-online` remote and a CI workflow. This is the failure the registry's own header
narrates twice, arriving a third time: `cfctl list`, `clone`, `pull` and `release` are blind to five
repositories, so a fresh estate checkout does not produce them and no release manifest can pin them.

Two smaller drifts in the same file compound it. `ALLOWED_SCOPED_PACKAGES` is missing
`@cloudsforge/secrets`, so `cfctl doctor` fails 30 repositories — commit `30dd177` changed
`service-ci.yml` alone and `registry.ts` was not touched, although the registry comment says the
list is kept there so the two cannot disagree. And `cfctl doctor` emits 262 warnings per run telling
the estate to undo a decision it recorded, because the doctor was never updated when the
sibling-checkout option was chosen.

**Why it pays off.** A doctor that is always red teaches its operator to ignore it, which is the
same mechanism that makes §2.4's alerts unactionable and §5.2's sweep unread. Fixing the noise is
what makes the signal usable.

**The concrete build.** Append five rows at the *end* of `REGISTRY` — none of the five ships a
Dockerfile, so all are `deployable: false`, and appending therefore moves no derived port and cannot
disturb `deploy/compose` or `estate-verify.sh`; verify with `deploy/scripts/web-check.py`. Add
`@cloudsforge/secrets` to `ALLOWED_SCOPED_PACKAGES` and add a test cross-checking it against
`service-ci.yml`, since a second copy of a list is what this repository exists to prevent. Retire or
rewrite the link warning to match the recorded decision. Give `publish.yml` an honest status: it has
zero callers and a premise the estate proved impossible, and `README.md`'s mitigation table premises
one of its three measured mitigations on published packages that no publish will ever produce.

**Cost of not doing it.** Five repositories holding users' private keys are invisible to every
estate-wide tool, and the estate's own health check cries wolf 262 times a run.

---

## 6. Cross-product network effects

The estate's stated promise is one account, one wallet, one feed and one portfolio across every
product. The economics of that promise are the reason the titles are worth building beside a
marketplace rather than separately. This section is about the joins that make the promise true, and
each one is currently either implemented three times or not implemented at all.

### 6.1 Decide who owns a season, once — P2, effort L

**What it is.** Seasons and reward budgets are implemented three times over, and the one title that
actually pays out bypasses the spine's budget guard. `worlds` owns seasons with a money budget and a
title-facing reward route — `POST /v1/titles/:id/seasons` (`worlds/src/server.ts:824`),
`GET /v1/seasons/:id/budget` (`:848`), `POST /v1/seasons/:id/rewards` (`:871`, scope
`worlds:title`) — guarded by `seasons_within_budget` (`worlds/src/migrations.ts:339`) and a
budget-raise approval trigger (`:455`). `worlds/src/server.ts:824-828` gates opening a season on the
admin scope with the reason stated plainly: a title that could set its own reward budget could pay
itself. `:862-871` says of the reward route that it exists instead of the title crediting a player
itself.

`emberkin` holds `worlds:title` and calls neither route. It creates its own seasons row with a
budget from `EMBERKIN_SEASON_REWARD_BUDGET_SHARDS` (`emberkin/src/env.ts:248`, default 100000) and
posts straight to ledger `/entries` (`emberkin/src/ledgerclient.ts:174`), enforcing its own local
copy of `seasons_within_budget` (`emberkin/src/migrations.ts:198`). `aetherholm` and `nda` carry
their own season state too, and no backend consumer of worlds' reward route exists anywhere in the
estate. Live, the spine's own list is empty:
`GET /v1/titles/dec039d0-…/seasons` returns `{"seasons":[]}`.
[19-new-products.md:111](19-new-products.md) states the intended answer: "Seasons through worlds,
not bespoke."

**Why it pays off.** The estate's stated control on game-economy inflation — one budget per season,
raised only with a recorded approval — is not the control in force for the only title that pays.
An exploit in emberkin is bounded by emberkin's copy of the rule rather than by the service an
operator watches, and worlds' season and budget UI shows nothing for the title actually paying
rewards.

**The concrete build.** Read worlds' budget CHECK beside emberkin's; they are the same constraint
written twice. Move emberkin's `season.reward` job onto `POST /v1/seasons/:id/rewards` with its
existing `worlds:title` token, keep the local CHECK as a backstop for one release, then drop
emberkin's `ledger:post` grant and let the derived grant map prove nothing else needed it. Give
aetherholm the same treatment so the route has real callers. Then **record the outcome in
[16-risks-and-open-decisions](16-risks-and-open-decisions.md)** so nda inherits the answer rather
than inventing a fourth.

**The alternative is legitimate and must be recorded if chosen.** Titles may keep local seasons and
worlds' season subsystem may be documented as spine-only, with the `worlds:title` reward scope
retired. What is not acceptable is four answers and no decision.

**Cost of not doing it.** The inflation control the design put in the path is not in the path.

### 6.2 Have worlds consume the contract it registers against — P2, effort S

**What it is.** `@cloudsforge/contracts-worlds` owns `Capability`, `CAPABILITIES`,
`TITLE_DESCRIPTOR_PATH`, `PROVISION_PATH` and the provision wire pair, and is imported by
`tessera/src/titlecontract.ts:24` and `aetherholm/src/server.ts:67`. `worlds` — the registrar, the
caller, and the owner of the conformance harness that certifies third-party titles — does not
depend on it: `worlds/package.json:36-38` lists contracts-auth, -money and -events only.
`worlds/src/titles.ts:43-46` restates `Capability`/`CAPABILITIES` locally and
`worlds/src/titleclient.ts:122,135` hardcodes `'/v1/title'` and `'/v1/provision'` as string
literals. The contract's own header (`contracts/packages/worlds/src/index.ts:36-39`) names the
duplication and why it is dangerous: two field-for-field identical shapes under two names in two
repositories, agreeing "because one author wrote both within a week".

**Why it pays off.** This is the exact shape of §3.3p items 2 through 4 — drifted local copies of a
header name and a signature format that silently disagreed for months. The failure mode here is a
purchase accepted and never delivered, which is the defect the package was cut to prevent.
The round-trip guard currently proves consumer-to-consumer agreement only; the registrar is
unchecked.

**The concrete build.** Add the dependency, re-export `Capability`/`CAPABILITIES` from the package
in `src/titles.ts` keeping the local names so no call site changes, replace the two path literals
with the exported constants, and parse the descriptor and provision response with the package's
`parse*` pair so the round-trip guard covers worlds' half. Update 18-build-status.md:191, which
lists this package as not yet cut.

**Cost of not doing it.** The one service that decides whether to call a title decides from a stale
capability list, and nothing goes red.

### 6.3 Make studio's bytes reachable by the things that render them — P1, effort M

**What it is.** `micro-studio` is the estate's image origin: brand kits, leased FLUX.2-pro
generation jobs, credit accounts, and the upload origin for Market and Foresight. Measured
2026-08-07 it passes four readiness probes with FLUX configured. Tessera can fire an object from a
prompt and `tessera-web` renders from a static sprite mount, so the Kiln's bytes reach no viewer:
the `WorldObject` wire shape exposes a checksum but no asset path, and generated assets are always
private with no client able to publish them — `visibility` is accepted on uploads and not on
generation, and no consumer calls the visibility route after a job succeeds.

**Why it pays off.** This is the join that makes the creation economy a loop rather than a
one-way pipe. A player fires an object, it appears on their parcel, someone else sees it, buys one
in Market — every step of that is built except the byte path.

**The concrete build.** Either a signed or public URL studio can issue for an asset it generated on
a title's behalf, or a tessera-side proxy that fetches bytes with its own service token and serves
them under the world-asset origin the renderer already reads. Add an asset reference to the
`WorldObject` wire shape — the service already knows it and the wire drops it. Accept `visibility`
on the generate request, symmetric with uploads.

**Meter it at the same time.** `studio.usage.recorded` is emitted at `studio/src/credits.ts:248`
into a void: billing has no handler, `billing/src/server.ts:646` answers `202 {status:'ignored'}`
for any topic outside its erasure set, and no subscription is seeded. So every FLUX image the
estate generates is metered inside studio's `credit_accounts` and never billed, while
[15-monetisation-model.md:146](15-monetisation-model.md) names studio credits as a revenue line and
[07-dependency-map.md:141-142](07-dependency-map.md) calls studio→billing and studio→ledger *hard*
dependencies. The subscription is §5.1; the billing-side handler that resolves a subject to a
subscription and calls `recordUsage` under the idempotency key is this item.

**Cost of not doing it.** The image factory generates images nobody can see and bills nobody for
them.

### 6.4 Make the unified feed and portfolio actually unified — P2, effort M

**What it is.** Three separate holes in the same promise.

- **The feed has no scope of its own.** `activity/src/server.ts:464-484` lets any service principal
  name any `userId`, and `requireReadAccess` returns early on `principal.kind === 'service'` for any
  non-internal record. A grep for `scope` in `activity/src/server.ts` matches nothing outside
  comments, and `contracts/packages/auth/src/index.ts` registers 57 scopes with none starting
  `activity:`. So `hub-api` borrows a different service's capability —
  `hub-api/src/upstreams.ts:439` reads `activity: Object.freeze(['notify:read'] as const)` — in a
  block that spends thirty lines (`:405-434`) arguing that its six narrow tokens *are* the AD-05
  separation. Least privilege is broken at the estate's most personal read surface: a token minted
  for faucet, studio or emberkin can read any named user's entire cross-product history through
  `/feed?userId=`.
- **The portfolio cannot name a minted token.** A `TOKEN:<urn>` ledger balance renders with a null
  amount because decimals are chosen at deploy time and `assetDecimals` correctly refuses to guess
  (`hub-api/src/portfolio.ts:43,255`). `mint` serves `GET /v1/tokens/:id` keyed by mint-request id
  (`mint/src/server.ts:481`) and no route keyed by the URN a ledger balance carries.
- **A deposit has no denominator.** `wallet`'s credit view carries `confirmations` but not the depth
  it counts towards (`wallet/src/deposits.ts:540,721,773`), so hub-api reads the denominator from a
  pinned contracts package and omits the fraction entirely for an asset the build does not know —
  `hub-api/src/nextactions.ts:146` states the reasoning: "41/0 is worse than 41 confirmations".

**Why it pays off.** Each is small; together they are the difference between a dashboard that
composes eleven products and one that composes eleven products with three visible holes in it. The
scope item is also a real security boundary, not a cosmetic one.

**The concrete build.** Register `activity:read` in the contracts registry, gate the service branch
of `feedOwner` and the service early-return in `requireReadAccess` on it, and flip hub-api's
upstream scope — the `satisfies Record<string, readonly LiveScope[]>` clause makes the swap
type-checked. Order matters: seed the grant and deploy hub-api and activity together, because
hub-api's exchange fail-fasts on an unknown scope name. Add `GET /v1/tokens/by-urn/:urn` to mint
returning symbol, decimals, name, chain and network, and read it from hub-api with a long TTL since
token metadata is immutable after deploy. Add `confirmationsRequired` to wallet's credit view from
the same `chainSpec` wallet already credits against, and prefer it in hub-api.

**Cost of not doing it.** The estate's headline promise renders with null amounts and missing
denominators, and any service token in the estate can read any user's financial history.

### 6.5 Close the Market ↔ Worlds inventory loop — P2, effort M

**What it is.** Selling a game item requires pasting a listing reference the page never says how to
obtain: `worlds-web` offers no link to Forge Market, no statement of the order of operations, and no
example of what a reference looks like — while its own success state says "On sale in Forge Market
since …", so the app knows the counterpart surface exists. On the Market side, every listing's
headline is a machine URN, because `micro-market` carries `name` and `description` columns for
*collections* only (`market/src/listings.ts:112-122`) and nothing seller-supplied for a listing.
`market-web/src/components/gallery.tsx:57` comments that the alt text is the URN "because it is the
only true label we have".

**Why it pays off.** This is the one place where a title and the economy touch a user directly, and
it currently reads as two unrelated products sharing an account. A cross-title item with a
human-readable name, listed from the inventory screen that owns it, is the network effect the estate
is built for.

**The concrete build.** Add nullable `title` and `description` to market's `listings` with a length
bound, accept them on `POST /v1/listings`, and put them on the wire shape. Make them optional in
`market-web`'s view type exactly as `images` is, so a bundle newer than the service does not blank
the page, and when a title is absent keep the URN and synthesise nothing. On the worlds side, link
to Market and state the order of operations. Worlds' three inventory topics are among the
unregistered ones in §5.2, so the two items should land together.

**Cost of not doing it.** The marketplace shows a grid of URNs and the inventory screen asks for a
value it never explains.

---

## 7. Order of work

Priority is leverage per unit of effort, not urgency in the operational sense. Effort is S (under a
day), M (a few days), L (a week or more), for one person who already knows the estate.

### 7.1 The order

**Wave 1 — things that are cheap and stop a loss.** These are hours of work each and every one of
them removes a way to lose something that cannot be recovered or to be blind while it happens.

| Item | What | Effort |
| --- | --- | --- |
| 2.2 | Get a second copy of the Hearth mainnet chain store off the host | S |
| 2.1 | Get the estate backup set off the host, and reconcile the two restore documents | M |
| 2.4 | Make the alert runbook links resolve, and make the checker check the anchor | S |
| 4.1 | Fund the testnet faucet | S |
| 4.4 | Register tessera and aetherholm in the worlds registry | S |

**Wave 2 — turn hand-typed wiring into derived wiring.** This is the estate's own idiom applied to
the thing the estate has never applied it to. Every item here ends in a checker in an owning
repository, and each one converts a class of silent failure into a red build.

| Item | What | Effort |
| --- | --- | --- |
| 5.2 | Register the missing topics; make `estate-topics.mjs` green and required | M |
| 5.1 | Derive event subscriptions from the consumers that classify the events | M |
| 5.3 | One signing scheme, enforced by a grep | M |
| 5.4 | Assert that every deployed service is reachable by somebody | M |
| 2.3 | Connect the observability chain end to end | M |

Order within the wave matters once: 5.2 before 5.1, because a subscription derived from an
incomplete registry derives an incomplete answer.

**Wave 3 — the joins that make the estate one product.** Each of these is a promise the design makes
that the deployment does not currently keep.

| Item | What | Effort |
| --- | --- | --- |
| 6.3 | Make studio's generated bytes reachable, and bill for them | M |
| 6.4 | `activity:read`; token metadata by URN; confirmation depth on the wire | M |
| 6.5 | Listing titles in Market; the inventory-to-Market path in worlds | M |
| 3.2 | Machine `whoami` without widening `/auth/me` | S |
| 3.3 | Serve `sdk/openapi.json` from somewhere a client can fetch it | S |

**Wave 4 — the expensive ones, in the order their dependencies allow.**

| Item | What | Effort |
| --- | --- | --- |
| 3.1 | Verify API keys and meter usage at one place | L |
| 4.2 | An operator path for the administered EMBER price | M |
| 4.3 | Switch on the Engagement Treasury | L |
| 5.6 | Make `cfctl new service` instantiate the service template | L |
| 5.5 | Compat-gate the two spines that propagate by copy | M |

4.3 depends on 4.1 and 4.2: a treasury that pays out in an asset with no faucet and no operator
price path is a treasury that pays in a number. 3.1 is worth doing before, not after, the first
external developer, because the migration is a breaking change for whoever has already integrated.

**Wave 5 — worth doing, no forcing function.** 2.5 (status page failure domain), 3.4 (bidirectional
gateway agreement), 4.5 (seed the surfaces whose emptiness is content), 5.7 (deadline and trace id
across a hop), 5.8 (give the conformance corpus a consumer), 5.9 (registry and scope-vocabulary
drift in micro-org), 6.1 (decide who owns a season), 6.2 (worlds consumes its own contract), 3.5
(resolve route citations rather than pattern-matching them).

### 7.2 If only three things are done

**5.1 and 5.2 together.** Sixty-one registered topics, nine hand-typed subscribe lines, and no
checker between them. Every producer in this estate believes it has published an event; most of
them have written a row to an outbox that no relay will ever deliver, and the code that discards
the undeliverable is irreversible. This is one class of defect, it is invisible from every
dashboard, and it is exactly the shape the estate has twice solved elsewhere.

**2.1 and 2.2 together.** Everything in this document assumes the estate still exists next month.
One host holds the only copy of a from-scratch chain's mainnet state and the only copy of the backup
set that would restore everything else. The rehearsal on 2026-08-05 proves the restore procedure
works; it does not prove there is anything to restore from.

**4.3, with 4.1 and 4.2 in front of it.** Every surface in the estate is empty, and the estate
already designed the mechanism that fixes it, wrote it down, and did not switch it on. Nothing else
in this document changes the fact that a visitor arriving today sees eleven working products with
nothing in them.

---

## 8. What this document depends on, and what it deliberately leaves alone

**It depends on the completion track and on
[32-roadmap-ui-and-content](32-roadmap-ui-and-content.md).** Several items here are the back half of
a change whose front half belongs to another track: 6.5's Market listing titles need the listing
form that collects them; 4.5's empty surfaces need the copy that explains what would fill them; 3.3
needs a developer-portal page to link the OpenAPI document from. Where a split exists this document
names the service-side half and leaves the surface-side half where it belongs.

**It leaves the recorded refusals alone.** [18-build-status](18-build-status.md) §§3.3a–3.3q and
[16-risks-and-open-decisions](16-risks-and-open-decisions.md) record a set of gaps the estate
considered and chose not to close. Where an item in this document touches one of them — the
unpublished SDK in §3.1 and §3.3, the subsidised-transaction visibility rule in §4.3, the four
loopback-only services in §5.4 — it says so explicitly and proposes work that keeps the refusal
intact. A refusal reported as a defect is worse than no report at all, because it costs the next
reader the time to rediscover why the decision was made.

**It does not price the work in calendar time.** Effort markers are relative. Anything here that
touches a grant, a scope or a deploy-time constant needs an ordered deploy, and the ordering
constraints are stated per item rather than aggregated into a schedule this document has no standing
to set.

**What would change the plan.** A first external integrator moves 3.1 to the front of everything.
A second host — even a cheap one — makes 2.1 and 2.5 much cheaper and should be evaluated before
either is built as described. And if the answer to §6.1 is that titles keep their own seasons, then
worlds' reward route and the `worlds:title` scope should be retired rather than left as a route with
no callers.

---

Nothing in this document has been built. When any of it is, it belongs in
[18-build-status](18-build-status.md), stated as what was measured rather than as what was intended.

