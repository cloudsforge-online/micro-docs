# 33 — Roadmap index, critical path and next sessions

Written 2026-08-07.

**This is a plan, not a ledger.** [18-build-status](18-build-status.md) is the ledger: it records
what has been built and it is corrected forwards rather than rewritten. Nothing in this file may be
read as a statement that something has been done.

## What this is

This document is the index to the four documents written in the same session —
[30-roadmap-completion](30-roadmap-completion.md),
[31-roadmap-ecosystem](31-roadmap-ecosystem.md),
[32-roadmap-ui-and-content](32-roadmap-ui-and-content.md) and
[34-service-catalogue](34-service-catalogue.md) — and it exists because those four were written as
separate tracks and the owner has to work in one order. It was produced by studying all 66
CloudsForge repositories in the working tree, one dedicated agent per repository, consolidating the
results per plane, and then adversarially verifying every finding: re-opening the cited line for a
claim about code, and re-issuing the request with `curl -m 15` against the live hostname for a claim
about the deployed estate. Findings that did not survive the second pass were dropped or narrowed,
and findings that turned out to be decisions the estate had already taken and refused to reverse —
recorded in [18-build-status](18-build-status.md) §§3.3a–3.3q and
[16-risks-and-open-decisions](16-risks-and-open-decisions.md) — were excluded on that ground and are
not restated here as gaps. That is the confidence level to read this at: every file:line was opened
once by the finding agent and again by a verifier, every measurement carries the date 2026-08-07,
and where something is not known it is said rather than smoothed over. The effort letters S, M and L
order work; they are not estimates in days, because nothing in this estate has ever been measured
against one.

---

## 1. The state of the estate in one page

**What is built.** Forty-eight target repositories plus the design-system, brand, wallet-client and
documentation repositories — 66 in all — are written, typechecked, tested and CI-green, at roughly
6,750 tests. [34-service-catalogue](34-service-catalogue.md) §1 partitions them into five planes:
money/chain/markets (17), identity/platform/developer (15), worlds/games/content (6),
frontends/design-system/brand (24), deployment/operations/documentation (4). Almost nothing in this
survey was found unwritten. The recurring finding, arrived at independently in five plane studies,
is stated at [31-roadmap-ecosystem](31-roadmap-ecosystem.md):55: *every repository in this estate is
more finished than its wiring* — the code exists, is tested and is deployed, and the thing joining
it to its neighbour is a row in a table, a line in a shell script, or a variable in a compose file
that nobody has typed.

**What is live.** The estate is public. Mainnet answers at `<surface>.cloudsforge.online` on chain
7411, testnet at `<surface>-testnet.cloudsforge.online` on chain 7412, with apexes at
`cloudsforge.online` and `testnet.cloudsforge.online`; the two-label `<surface>.testnet.<apex>`
scheme is dead and any surviving reference to it is a live defect. Hearth mainnet is mining. Around
46 services run in the estate compose on one HP MicroServer Gen10 behind a Cloudflare tunnel.
Seventeen browser surfaces and three operator consoles answer 200.

**What there is not, and it changes how every item below should be read: there is no real volume
yet.** The estate is public but has no organic traffic. The 7,355 mainnet and 5,299 testnet rows in
`identity.users`, the ~10,400 in-app notifications on each network and the thousands of failed email
deliveries are residue from agent and test runs, not from people. So **nothing in these documents is
an outage.** Not one defect listed here is currently interrupting a real user, because there is no
real user to interrupt. Every item is a cold-start problem: it is about what would happen to the
first genuine visitor. Where a finding below is phrased as "users are blocked" or "customers cannot
sign in", read it in that mood — as a description of the wall a stranger would hit, not of damage
being done now. This also inverts one priority instinct: work that repairs volume nobody is
generating ranks below work that makes a first real visitor possible.

**What is genuinely missing, stated so that a reader of only this section is not misled in either
direction.**

| | |
| --- | --- |
| No account created on the live estate can sign in | Registration returns 202, sign-in returns 403 `email_unverified`. Traced end-to-end on the host 2026-08-07 through a real address: mainnet's relay works and is externally deliverable (SPF/DKIM/DMARC all pass), and `IDENTITY_ACCOUNT_URL` — which is what builds the link — is correct on **both** networks. What blocks it is that **`beacon` registers ~95 throwaway accounts/hour at `@beacon.test`**, exhausting the 250/day Mailtrap tier so a real visitor's mail returns `SMTP 535`; and testnet has no `SMTP_HOST` at all. 4,483 verification tokens issued across both networks, **0 ever consumed**. See 30 §A1, which carries two corrections — read the second first |
| The event bus does not carry the money plane | 61 registered topics; 9 literal `subscribe` lines in `deploy/scripts/estate-bootstrap.sh` plus two derived `subscribe_all` calls. Four producers still sign the retired scheme their consumers reject by test |
| Nothing measures the estate | `deploy/prometheus/targets/services.yaml` is `[]`, no service is given an OTLP endpoint, 20 alert rules evaluate over series that do not exist, and the release gate that was built to refuse a bad promotion has never been called by a pipeline |
| Every surface is empty | No listings on either network, one DRAFT row in the Worlds registry, `total:"0"` on every Foresight market, 42 identically-named test wards on Tessera's front door. The cure — the Engagement Treasury of [21-engagement-treasury](21-engagement-treasury.md) — is designed, built and switched off |
| One host holds every copy of everything | The Hearth mainnet chain store is on one unbacked-up docker volume with zero peers, and the backup data plane is complete, tested and referenced by no bring-up path |

**What "missing" does not mean here.** It does not mean unwritten. In every row above the code
exists and passes its tests; what is absent is a value, a row, a subscription or a pipeline step.
It also does not mean the estate overlooked it: several things that look unfinished were refused on
purpose and are recorded as refusals — [30-roadmap-completion](30-roadmap-completion.md) §12 lists
twelve findings excluded for that or a related reason, and one of them (mint's endpoint-free retry
loop) was collected as a defect during this survey before the refusal at
[18-build-status](18-build-status.md):859-863 was found. Grep those two files before adding anything
to any of these documents.

---

## 2. The critical path

The three roadmap tracks were written separately and each has its own internal order:
[30](30-roadmap-completion.md) runs in phases A–J, [31](31-roadmap-ecosystem.md) in waves 1–5, and
[32](32-roadmap-ui-and-content.md) in a numbered list of nine. This section is the one sequence that
draws their P0 and P1 items together. Where two tracks name the same prerequisite the two items are
merged here and the merge is stated, because doing them as two pieces of work is how one of them
ends up half-done.

**Merges, stated once so they are not scheduled twice.**

| Item in 30 | Same work in 31 or 32 | Why they are one item |
| --- | --- | --- |
| B1 — finish the signature migration | 31 §5.3 — one signing scheme, enforced by a grep | The repair and the guard that stops it recurring. 30 B1 without 31 §5.3 will be undone by the next service |
| B2 — seed subscriptions from the classifier tables | 31 §5.1 — derive subscriptions from the consumers | Identical proposal, arrived at independently by the completion and ecosystem studies |
| C1 + C2 — point services at the collector, give Prometheus something to scrape | 31 §2.3 — connect the observability chain | One chain. The port-normalisation defect (telemetry addresses 4011 and 4010; every service binds 4000) sits inside it and must be fixed before the stack is first started, not after |
| C4 — make the Beacon gate run | 31 §2.4's sibling; the beacon+deploy+docs finding | The gate is served, fail-closed and tested, and no pipeline calls it |
| D1 — bring the backup runner up and prove a restore | 31 §2.1 — get the backup set off the host | Two halves of one guarantee. A backup runner whose artefacts never leave the chassis has not changed the failure mode |
| E1 — reconcile the faucet's funding address | 31 §4.1 — fund the testnet faucet | Same address, same transfer, same missing runbook step |
| E2 — give the administered EMBER price a writer | 31 §4.2 — an operator path for the price | Same |
| F1 — populate the worlds title registry | 31 §4.4 — register tessera and aetherholm | Same |
| F4 — publish studio's generated assets | 31 §6.3 — make studio's bytes reachable | Same |
| G1 — turn the engagement treasury on | 31 §4.3 — switch on the Engagement Treasury | Same |
| I8 — fix the `$scheme` sitemaps | 32 §5.3 — the sitemap scheme | One line in `web-template/nginx.conf` copied fourteen times, plus fourteen tests that currently assert the defect |
| Phase A — a stranger can create an account | 32 §6.3 — step 5 does not work | 32's funnel has no first step until 30's Phase A closes. It is not a second item |

### 2.1 The order

**Step 1 — stop the losses that cannot be undone.** Hours to days, blocks nothing, and everything
below assumes the estate still exists next month. Get a second copy of the Hearth mainnet chain
store off the host (31 §2.2): the exclusion rationale that justifies skipping Bitcoin and Litecoin —
"reconstructible from the network" — is false for chain 7411, because there is one full node with
zero peers. Then bring the backup runner up (30 D1) and ship its artefacts off-host (31 §2.1). The
runner is complete — `deploy/backup/src/` has archive, restore, verify, prune, keyring, manifest and
eight test files, and `deploy/compose/docker-compose.backup.yml` exists — and no Makefile target,
`estate-up.sh` or `release-deploy.sh` path brings it up. The same absence is why `POST /v1/backups`
on admin-api queues work no deployed process claims.

**Step 2 — make registration complete (30 Phase A, P0).** One suppression rule, one testnet
channel, and one test that has never been run. **Stop `beacon`'s synthetic registrations reaching
the email channel** — it creates ~95 accounts/hour at `@beacon.test`, a domain that cannot receive
mail, and that alone exhausts the 250/day Mailtrap tier so a real visitor's verification mail
returns `SMTP 535`. Then give **testnet** an SMTP channel or a local sink, since it has none. Then
**complete one verification end to end on each network**, which has never happened: 4,483 tokens
issued, 0 consumed. Mainnet's relay is configured, authenticated and externally deliverable, and
`IDENTITY_ACCOUNT_URL` is correct on both networks — neither needs changing. See 30 §A1, whose
second correction supersedes the `NOTIFY_PUBLIC_URL` diagnosis given in its first. The suppression
rule is the first change to make anywhere in this roadmap — it is **work package 1** in §3 below and
is specified line by line, against the real call sites, in **30 §A1.1**. It costs no credentials, no
provider decision and no coordination with any other repository, and until it lands every other mail
fix is spending an allowance that beacon has already eaten. Add the operator fallback (30 A2) in the same
session, because `listPendingResets` is exported and called by nothing and
[07-dependency-map](07-dependency-map.md):318 already promises a console that does not exist. Until
this closes, no user-facing journey in the estate can be demonstrated end to end by anyone who is
not already an operator, and every CTA improvement in track 32 shortens the path to the same wall.

**Step 3 — the bus, in this order and no other.** Signatures, then registry, then subscriptions,
then the assertion.

1. **Signatures (30 B1 + 31 §5.3).** Billing, custody, foresight and studio still sign
   `x-cloudsforge-signature: sha256=<hmac>`; nda's producer speaks a third variant. Seeding
   subscriptions first would convert silence into a permanent 401 retry loop, which is worse,
   because the relay retries a 4xx for ever while `/livez` stays green.
2. **Registry (31 §5.2).** Register the missing topics and make `org/tools/estate-topics.mjs` green
   and required. A subscription derived from an incomplete registry derives an incomplete answer.
3. **Subscriptions (30 B2 + 31 §5.1).** Derive them from `activity/src/classify.ts` and
   `notify/src/catalogue.ts` rather than typing them, with a floor that fails loudly. Activity is
   subscribed to 3 of the 61 topics it classifies and notify to 4 of about 40.
4. **Assertion (30 B3 + 31 §5.4).** Assert that a delivery actually lands, and that every deployed
   service is reachable by somebody.

Community's governance events are the one place where order has a deadline: because the relay
publishes immediately when no subscriber exists, every `community.proposal.executed` produced before
the subscription is seeded is permanently unrecoverable.

**Step 4 — make the estate measurable (30 Phase C, P0; 31 §2.3, §2.4).** Fix the 4011/4010 port
addresses before starting the stack. Generate `deploy/prometheus/targets/services.yaml` from the
release manifest as `services.yaml:3-4` always intended. Give the services an OTLP endpoint. Make
the alert runbook links resolve and make the checker check the anchor rather than the file. Decide
the SLOs and seed the error budgets so beacon's `/objectives` stops being a named hole. Call the
Beacon gate from the release pipeline — it exits 2 rather than 0 when it cannot reach the gate, and
no pipeline invokes it, so the fail-closed design protects nothing. Unblock the conformance sweeps
first (30 I3, pulled forward from Phase I): one literal NUL byte in a beacon test fixture takes both
estate-wide invariants offline, so the private-key leak scan and the ledger account-type collision
sweep currently produce no measurement at all and `estate-ci` is red for a reason that is not a leak.

**Step 4a — in parallel from day one, the four places a live page says something untrue (32 §4,
§8).** These need nothing from any other repository, take about three days between them, and are
the only items in any of the three tracks where the estate is currently making a false statement to
a stranger. They should not wait behind steps 1–4.

- tessera-web's Workshop tells sellers EMBER "is money, not points", promises withdrawal "the same
  afternoon" and anchors a price at "around 400 of them". The ledger refuses all three (32 §4.1).
- network-site's mining page tells the reader the browser miner cannot work, directly above the
  working browser miner (32 §4.2).
- The apex serves the mainnet page unmarked on `testnet.cloudsforge.online` — no environment marker
  anywhere in the rendered bundle, though every button correctly resolves to a `-testnet` host.
- `status.cloudsforge.online` publishes four consecutive days of outage for all twenty product
  groups while the estate served 30/30 HTTPS 200s. The cause is a boolean fold over every probe
  check in a day at `beacon/src/publicstatus.ts:408-430`; it must become a ratio before any wording
  in status-web is worth changing. It is the estate's only public trust artefact.

**Step 5 — money can move once, end to end (30 Phase E).** E1 (fund the faucet — the testnet money
plane is otherwise sealed, and no stranger can obtain a single EMBER), E2 (an operator path for the
administered price), E4 (a writer for the custody token allowlist), E5 (a rule set for policy, which
today returns `allow`/`no_rule_matched` to ten synchronous callers), E6 (settlement's discarded HTTP
Basic credentials, the missing `ltc` key in `SETTLEMENT_RPC_URLS`, and mint's chain buildability
gate — a customer can today pay for a Solana token that can never be deployed), E7 (billing's
`ADMIN_API_URL`, wallet's platform-address blocklist), E8 (record the LTC ingress-without-egress
decision rather than leaving it implicit), then E3 (connect `POST /purchases` to a caller — it is
served, argued, tested and called by nothing, so its first production execution will be its first
execution).

**Step 6 — a paid world can be raised (30 Phase F).** F1 first: worlds' title registry holds one row
and it is the one title that implements no title contract, and testnet's registry is empty. Then F2
(bridge `billing.entitlement.granted` into worlds, nda, tessera and emberkin — it has four consumers
in this plane and zero subscriptions), F3 (the emberkin season-pass SKU that billing does not sell),
F4 (studio's generated bytes, which nothing in tessera or its viewer can fetch, so a paid Kiln firing
is invisible in the world), F5 (register nda, whose achievements are otherwise permanently
undeliverable and whose job backlog grows for ever), F6 (`COMMUNITY_URL`), F7 (aetherholm's
not-deployed claims). Step 6 depends on step 3: without the signature repair the entitlement bridge
delivers 401s instead of nothing.

**Step 7 — seed the empty rooms (30 Phase G; 31 §4.3).** G1 turns the Engagement Treasury on, which
depends on E1 and E2: a treasury that pays out in an asset with no faucet and no operator price path
is a treasury that pays in a number. G2 seeds market, Foresight and Worlds with first content. G3
clears the mainnet residue — the 42 `Private Ward 178585xx` rows a test harness created and the one
DRAFT registry row — which is a prerequisite for G2 rather than a cosmetic follow-up, because
smoke-test residue presented as content is worse than an honest empty state.

**Step 8 — the funnel, once step 2 is closed (32 §2, §5.1, §6).** The apex hero has no outbound link
at all. Six public front doors offer a stranger one action and it is the same hard off-origin
sign-in bounce, which is the one new component this track proposes (32 §5.1). The mining path —
steps 1 to 4 of 32 §6.1 — requires no account, is the estate's only complete stranger-to-first-action
journey, and can be finished entirely inside track 32; do that part before step 2 closes and the
rest after. Fix the fourteen `http://` sitemaps (30 I8 + 32 §5.3) here, including the fourteen tests
that currently assert the defect.

**Step 9 — integrability (31 §3).** §3.1 is the largest single item in any of the three tracks: a
third-party developer can complete the whole devportal journey, mint a `cfk_live_…` key, and that
key authenticates against nothing, because every service behind `api.<apex>` verifies a JWT and
there is no forwardAuth middleware in `deploy/gateway/dynamic/*.yml`. `/internal/keys/verify` and
`/internal/usage` both have zero callers. It is worth doing before the first external developer
rather than after, because the migration is breaking for anyone who has already integrated. §3.2
(machine `whoami`) and §3.3 (serve `sdk/openapi.json` from somewhere a client can fetch it) are S
each and can ride along.

**Step 10 — the guards, and then the rest (30 Phase I, Phase H, Phase J; 31 §5.5, §5.6, §5.9).**
31 §5.6 — making `cfctl new service` instantiate `service-template` rather than a 159-line stub
predating the runtime library — is the highest-leverage item here, because that stub is how the
four defect families in [18-build-status](18-build-status.md) §3.3p were created and every future
service is a fresh chance to re-derive them. Phase H's ten client-side dead ends are the most
visible defects and the least blocking; 30 §9 says putting them first is the most tempting mistake
in the roadmap, and this order agrees.

### 2.2 If only three things are done

Both [30](30-roadmap-completion.md) §1 and [31](31-roadmap-ecosystem.md) §7.2 answer this, and they
do not conflict. Taken together the three are: **step 2**, because without it the estate cannot
onboard a single account through its own front door; **step 3's items 1–3 together**, because most producers in
this estate believe they have published an event when they have written a row to an outbox no
subscription will ever route, and the discard is irreversible; and **step 1**, because everything else assumes there is something left to fix.

Before any of the three, though, is the smallest change in the roadmap: the reserved-domain
suppression in `notify` (**work package 1**; specified in [30](30-roadmap-completion.md) §A1.1). It
is not on this list because it is not one of the three large pieces of work — it is half a day, it
touches one repository, and it is the precondition for step 2 producing any observable effect at
all.

---

## 3. Next sessions

Twenty-one discrete work packages, sequenced so that the early ones unblock the later ones. Each is
sized to be picked up cold by a session with no memory of this one. The last column is the one that
matters most: a session that begins by re-deriving where the problem lives has spent a third of
itself before it changes anything. Paths are relative to the estate root.

| # | Session | Source | Repos touched | Prerequisite | Done when | First file to open |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Stop the mail spam at its source | 30 §A1 step 1, §A1.1 | `notify` | none | notify sends no mail to `@beacon.test` or any other RFC 2606 / RFC 6761 reserved domain, the daily allowance is spent on real addresses only, and `deliveries` stops accruing `dead` rows at ~95/hour | `notify/src/pipeline.ts:241` — `channelsAvailable`, which decides a notification’s channels. **30 §A1.1 specifies the whole change**: a new `notify/src/reserved.ts`, the guard in `channelsAvailable`, and a backstop in `notify/src/email.ts:83`. It was written against the real code and deliberately left unimplemented — read it before writing anything. Do **not** change `beacon`: its synthetic registrations are a deliberate probe (`beacon/src/calls.ts:143`) |
| 2 | Get the chain store off the host | 31 §2.2 | `hearth`, `deploy` | none | A copy of the chain 7411 block store exists in a second physical location, and `estate-verify.sh` checks its age | `deploy/backup/src/catalogue.ts` — note which volumes are catalogued and that hearth's is not |
| 3 | Bring the backup runner up and prove a restore | 30 §5 D1; 31 §2.1 | `deploy`, `admin-api` | 2 | The backup overlay is in a bring-up path, `POST /v1/backups` on admin-api reaches a process that claims the job, and one restore has been performed from an off-host artefact | `deploy/compose/docker-compose.backup.yml` — then grep `estate-up.sh`, `release-deploy.sh` and the `Makefile` for it and confirm it appears in none |
| 4 | Make registration complete | 30 §2 A1, A2; 32 §6.3 | `deploy`, `notify`, `identity` | 1 | `register → mail → verify → login 200` completes on both networks for a fresh address, driven by `estate-verify.sh` rather than by an operator's memory, and an operator can enumerate who is stuck | `deploy/compose/estate/tokens.testnet.env` **on the estate host** (untracked; `ssh malf@192.168.1.42`) — it carries `MAIL_DOMAIN` and no `SMTP_*`, so testnet has no email channel at all. That is what remains once package 1 has freed mainnet’s quota. Do **not** touch mainnet’s `SMTP_*` (configured, and externally deliverable — SPF, DKIM and DMARC all pass) or `IDENTITY_ACCOUNT_URL` (correct on both networks). `NOTIFY_PUBLIC_URL` is a separate, lesser defect tracked as 30 §A3 — it is not what builds the verification link |
| 5 | One signing scheme, and the grep that keeps it | 30 §3 B1; 31 §5.3 | `billing`, `custody`, `foresight`, `studio`, `nda`, `contracts`, `org` | none (do before 7) | No repository declares a local `x-cloudsforge-signature` constant on a producing path, CI fails any that does, and one delivery from each of the five is observed accepted | `billing/src/outbox.ts:22` — it already imports from `@cloudsforge/contracts-events` for the inbound arm and not the outbound one |
| 6 | Complete the topic registry and make the checker required | 31 §5.2 | `contracts`, `market`, `mint`, `trade`, `worlds`, `org` | none (do before 7) | `org/tools/estate-topics.mjs` is green and is a required check; every emitted topic is registered | `org/tools/estate-topics.mjs` — run it first and read its two current failures |
| 7 | Derive the subscriptions from the classifiers | 30 §3 B2; 31 §5.1 | `deploy`, `activity`, `notify` | 5, 6 | Activity receives every topic `classify.ts` classifies and notify every topic its catalogue has a rule for; the seeder fails loudly below a floor rather than seeding a subset | `deploy/scripts/estate-bootstrap.sh:960` — the `subscribe_all` helper, already used for admin-api at `:981` and analytics at `:1005` and never for activity |
| 8 | Assert that a delivery lands and that every service has a consumer | 30 §3 B3; 31 §5.4 | `deploy`, `conformance` | 7 | A standing check publishes one event per producer and asserts it was accepted, and any deployed service reachable by nobody fails the check | `deploy/scripts/estate-verify.sh` — find where it asserts activity's inbox today |
| 9 | Unblock the conformance sweeps | 30 §10 I3 | `conformance`, `beacon` | none | Both estate-wide sweeps scan every repository, per-file failures are reported rather than aborting the run, and `estate-ci` is green or red for a real reason | `conformance/src/ledgeraccounts.ts:370-373` — the `UnreadableSourceError` raised on the first NUL byte |

| # | Session | Source | Repos touched | Prerequisite | Done when | First file to open |
| --- | --- | --- | --- | --- | --- | --- |
| 10 | Say four true things on live pages | 32 §4.1, §4.2, §4.3; §2.1 | `tessera-web`, `network-site`, `site` | none | No live page asserts EMBER has a price or a settlement SLA, the mining caveats match the shipped miner, the testnet apex carries an environment marker, and a forbidden-word test defends each | `tessera-web/src/pages/workshop.tsx` — the three money claims are in one screen |
| 11 | Make the status page tell the truth | 32 §8; 31 §2.5 | `beacon`, `status-web` | none | A day is `outage` by a ratio and a minimum duration rather than a boolean fold, and the 90-day strip and the hero verdict agree on the live page | `beacon/src/publicstatus.ts:408-430` |
| 12 | Give Prometheus something to scrape, on the right ports | 30 §4 C1, C2; 31 §2.3 | `deploy`, `runtime`, `lantern`, `beacon` | 9 | The file_sd list is generated from the release manifest, every service exports OTLP, and the telemetry stack addresses every service on 4000 | `deploy/prometheus/targets/services.yaml` — it is `[]`, and its header says it was always meant to be generated |
| 13 | Seed the objectives and call the gate | 30 §4 C3, C4, C5; 31 §2.4 | `beacon`, `deploy`, `org`, `docs` | 12 | `beacon slo-seed` runs from a deploy step, `/objectives` is populated, the release pipeline calls `beacon gate` and refuses on exit 1 or 2, and every alert's runbook link resolves to an anchor the checker verified | `deploy/prometheus/rules/alerts.yaml` — read one runbook URL and try it |
| 14 | Open the money valves | 30 §6 E1, E2, E4, E5, E6, E7, E8; 31 §4.1, §4.2 | `faucet`, `pricing`, `custody`, `policy`, `settlement`, `mint`, `wallet`, `billing`, `indexer`, `deploy`, `admin-api`, `admin-web` | 4 | A testnet visitor receives EMBER from the faucet; an operator can write the administered price, a policy rule, a custody allowlist entry and a platform address from a console; an LTC withdrawal either broadcasts or is refused before the deposit is credited; a `sol` mint order is refused before payment | `deploy/scripts/estate-bootstrap.sh:1010-1132` — §5e mints the faucet treasury address and never funds it |
| 15 | Register the titles and bridge the entitlements | 30 §7 F1, F2, F3, F5, F6, F7; 31 §4.4 | `worlds`, `tessera`, `aetherholm`, `nda`, `emberkin`, `billing`, `deploy` | 5, 7 | `GET /v1/titles` returns tessera and aetherholm with their real `serviceUrl`s on both networks, and a purchased private world produces a `provisions` row that reaches `active` | `worlds/src/provisioning.ts` — the webhook that is the only writer of a `provisions` row |
| 16 | Make studio's bytes reachable | 30 §7 F4; 31 §6.3 | `studio`, `tessera`, `tessera-web`, `billing`, `deploy` | 15 | A fired Kiln object renders in the world canvas, `WorldObject` names where its bytes live, and `studio.usage.recorded` reaches billing's `recordUsage` | `tessera/src/migrations.ts` — migration 5's `objects` table, which has a checksum and no asset path |
| 17 | Complete the Tessera loop and open the Commons | 30 §7, §8 G2, G3; 30 §9 H3 | `tessera`, `tessera-web`, `deploy` | 16 | A player can place and remove a fired object on a parcel from the UI, a public named ward exists on both networks, the 96 free seed objects are reachable, and the 42 test wards are gone | `tessera-web/src/pages/world.tsx:104-106` — the honest empty state testnet already renders and mainnet cannot reach |
| 18 | Switch on the Engagement Treasury and seed the rooms | 30 §8 G1, G2; 31 §4.3, §4.5 | `market`, `foresight`, `worlds`, `market-web`, `foresight-web`, `worlds-web`, `devportal-web`, `admin-web` | 14, 17 | The treasury has been funded, `houseSeed` is non-null on a live Foresight market and its disclosure renders, and no public surface shows an empty state where content was intended | `21-engagement-treasury.md` — the design is complete; read it before writing anything |
| 19 | Build the funnel's first four steps | 32 §2, §5.1, §5.3, §6 | `site`, `network-site`, `ui`, `web-template`, and the six front doors | 4 (for step 5 onward only) | The apex hero has a working CTA, the sign-in intent panel exists and is used by six front doors, and every sitemap advertises `https://` with the tests updated to match | `site/src/pages/home.tsx` — grep it for `href=` and `hosts()` and find nothing |
| 20 | Make an API key authenticate something | 31 §3.1, §3.2, §3.3 | `devplatform`, `deploy`, `sdk`, `contracts`, `identity` | 4 | A `cfk_live_…` key authenticates an SDK call against a public route, usage is metered, revocation takes effect, and `sdk/openapi.json` is fetchable from a hostname | `deploy/gateway/dynamic/public-api.yml` — the public routers carry only `cf-api-headers` and `cf-api-strip-version` |
| 21 | Make `cfctl new service` instantiate the template | 31 §5.6; 30 §10 I5 | `org`, `service-template` | none | `cfctl new service` produces a service with migrations, outbox, inbox, leased jobs, secret guard and Lifecycle, and a test in `org` fails if the two drift | `org/tools/` — find the 159-line stub the command copies today |

Sessions 9, 10, 8 and 20 have no prerequisites and can be run at any time, including in parallel
with 3. Sessions 1 and 2 are the only ones whose delay carries a risk that compounds.

**What is not in the table.** The twenty sessions above cover the P0 and P1 items. The remaining
P2 and P3 work is collected in [30](30-roadmap-completion.md) §9 (Phase H, ten client-side dead
ends), §10 (Phase I, the guards), §11 (Phase J) and [31](31-roadmap-ecosystem.md) §7.1 wave 5. It is
listed there so that it is not rediscovered as new, and it is not scheduled here because nothing
downstream depends on it.

---

## 4. How to keep these documents honest

Five documents now describe this estate and they do different jobs. Confusing them is how a plan
becomes a false claim of completion.

| Document | What it is | How a session updates it |
| --- | --- | --- |
| [18-build-status](18-build-status.md) | **The ledger.** What has been built, by repository, with test counts | Append. Never rewrite a finding: when a finding becomes false, record the correction above it with its date, the way §0 and §0.1 already do. Only a landed, tested, pushed change earns an entry |
| [34-service-catalogue](34-service-catalogue.md) | **The catalogue.** What each repository is for, what it exposes, and where it sat on 2026-08-07 | Edit in place when a repository's purpose or surface changes, and re-date the measurement. Every HTTP claim in it carries a date; a claim without one is not a measurement |
| [30](30-roadmap-completion.md), [31](31-roadmap-ecosystem.md), [32](32-roadmap-ui-and-content.md) | **Plans.** What is unfinished and how to finish it | Strike an item when it is closed, and say in the strike which commit or measurement closed it. Add an item only after grepping [16-risks-and-open-decisions](16-risks-and-open-decisions.md) and [18](18-build-status.md) §§3.3a–3.3q to confirm it is not a refusal |
| This document | **The index.** One order across the three plans | Re-derive §2 whenever a step closes; the order is the deliverable and a stale order is worse than none. §3's prerequisite column is the thing to check first |

**A roadmap item is closed only by the definition of done in
[17-definition-of-done](17-definition-of-done.md).** Each item in 30, 31 and 32 states its own
"Done when", and that statement is in addition to, not instead of, 17: §2 for a service change, §3
for a frontend, §8 for the continuous quality gates. Nothing here is closed on the strength of a
commit that looks right. In this estate the standing rule is stronger still, and it is the largest
single lesson of this survey: **a fix that nothing asserts is a fix that will be undone.** The
majority of findings in these three documents are capabilities that were built, wired once, and
then silently lost their wiring because no check measured it. Several items are therefore two-part
— change the thing, then add the check — and the second half is the deliverable, not padding.

**Three things this index does not know, stated rather than guessed.** First, the effort letters
order work and do not estimate it. Second, several items are known to be missing and not known to be
sufficient: the policy rule set, the SLO objectives and the seed content are decisions before they
are tasks, and the correct first step for each is to write the decision down somewhere it can be
argued with. Third, everything here was checked against the working tree and the live hostnames on
2026-08-07 and not, with the exceptions listed below, against the running containers' environments.

> **This third caveat stopped being hypothetical on the day it was written.** It was phrased as
> "a value that reads as unset in `docker-compose.estate.yml` could *in principle* be set by a
> host-level override". It was. The original §A1 of [30](30-roadmap-completion.md) declared
> email dead on both networks because `SMTP_*` appears nowhere in the tree; measured on the host,
> mainnet sends through Mailtrap and has delivered 344 verification emails. The finding was
> inverted and the fix it prescribed would have been wasted work.
>
> **The rule that follows from it.** In `docker-compose.estate.yml`, `${SMTP_HOST:-}` is an
> *interpolation* — the tree cannot tell you its value, only the host can. `NOTIFY_PUBLIC_URL:
> http://localhost:4110` is a *literal* — no env file can override it, so the tree is
> authoritative and the defect is real. Before trusting any finding about configuration, decide
> which of the two you are looking at.
>
> **And then the corrected finding was wrong too, in a second way.** Knowing the value of
> `NOTIFY_PUBLIC_URL` was not the same as knowing it mattered. It does not build the verification
> link — `IDENTITY_ACCOUNT_URL` does, and it is correct on both networks. The real cause was two
> services away, in `beacon`, and was only found by tracing one real account
> (`savvaniss@yahoo.gr`) through `users` → `email_verification_tokens` → `deliveries` → the
> notify logs. **The second rule: measuring a variable is not the same as reading the code that
> consumes it.** Grep for the consumer before drawing a conclusion from the value.
>
> **Host-verified so far**, everything else being tree-only: `SMTP_*`, `NOTIFY_PUBLIC_URL` and
> `IDENTITY_ACCOUNT_URL` on both networks; the full registration → token → delivery chain for one
> real address; `notify.deliveries` counts and states; `users` counts by email domain; schema
> migration timestamps; container restart policies (181 containers, 105 `unless-stopped`, 76
> one-shot jobs at `no` — which closed [27](27-cloud-deployment.md) §2.3). Re-verifying the rest
> of the deploy-plane findings against the host is itself an unlisted work package, and a cheap
> one — and on the evidence of these two corrections, not an optional one.

### 4.1 What was archived on 2026-08-07, and why nothing was moved

Four documents describe an estate that no longer exists and were the most likely source of wasted
sessions. They were **banner-marked in place rather than moved**: 57 inbound references point at
them — 15 documents and 37 files outside `docs/` cite `00`'s `TD-01`–`TD-20` ids alone — and every
relative link in `ecosystem/` currently resolves. Moving four files to break 57 references, to
solve a problem a banner solves, is a bad trade.

| Document | Banner | Why it misleads |
| --- | --- | --- |
| [00-current-state](00-current-state.md) | ⚠ SUPERSEDED AS A DESCRIPTION | A pre-migration monorepo baseline. Retained for its `TD-` ids, which are cited from 37 places outside `docs/` |
| [08-prioritised-backlog](08-prioritised-backlog.md) | ⚠ SUPERSEDED AS A WORK QUEUE | 3,399 lines of items mostly already shipped. The live queue is §3 of this file. **MIG-26 is known-inverted** and carries its own banner |
| [09-release-roadmap](09-release-roadmap.md) | ⚠ PREMISE SPENT | Sequences a launch that happened on 2026-08-05 |
| [10-migration-strategy](10-migration-strategy.md) | ⚠ CUTOVER COMPLETE | Plans a cutover that is done |

Two decisions in [16-risks-and-open-decisions](16-risks-and-open-decisions.md) were marked
**RESOLVED**: §2.1 (mainnet launched — with the qualifier that *launched ≠ valued*, since EMBER
still has no monetary value on either network) and §2.10 (FLUX 2 Pro chosen on evidence, per
[24-asset-model-comparison](24-asset-model-comparison.md), not defaulted to OpenAI).

Six documents that still prescribe the reversed `worlds-api` rename — 02:407, 05:397, 06:1136, <!-- dead-ok -->
08's MIG-26, 09:349, 11:310 — now carry a correction at the point of the instruction, and
**`docs/tools/check-dead-patterns.mjs` fails CI** if a new one appears. [18](18-build-status.md)
§1 lost three sentences that had become false, under the instruction in its own §4, with a record
of what they said. The estate holds **67 directories**, not the 58 that 18 §1 recorded, and none
of them carries the `micro-` prefix locally — that is the *remote* name.

---

## 5. Session log: release 2.4.0, package 1

*Appended 2026-08-07. This section records what a session actually hit, not what it planned. Read
it before starting a release; two of the three findings below cost most of the session's time.*

### 5.1 Where it got to

Package 1 — *stop the mail spam at its source* — is **written, CI-green against a real Postgres,
and on a `release/2.4.0` branch in all forty-six deployables plus `micro-deploy`. Nothing is
merged and nothing is deployed.** The one thing blocking deployment is
[micro-org#244](https://github.com/cloudsforge-online/micro-org/pull/244), described below.
The defect itself is [micro-org#243](https://github.com/cloudsforge-online/micro-org/issues/243).

### 5.2 A skipped job renders as green, and that is how a release publishes nothing

`publish-image.yml` in `micro-org` carries a defence-in-depth `if:` that admitted `refs/heads/main`
and `refs/heads/design-system/*` and nothing else. Every caller references it **`@main`**, so a
branch copy of the fix is never used — the change has to reach `main` before any release branch can
publish, and that is the single ordering constraint in a release.

Extending each *caller's* publish `if:` is necessary and not sufficient, and neither is enough on
its own, because a third gate sits above both: `on: push: branches: [main]`. **Three gates, all of
which must admit the branch:**

| Gate | Where | Symptom when it refuses |
| --- | --- | --- |
| `on: push: branches:` | each repo's `ci.yml` | no run appears at all — `gh run list --branch …` prints nothing |
| `publish:` job `if:` | each repo's `ci.yml` | run is green, publish job shows `- publish … in 0s` |
| producer's own `if:` | `micro-org/.github/workflows/publish-image.yml` | identical to the above, and invisible from the calling repo |

The middle and bottom rows both render as a **green tick with a skipped job**. Forty-six
repositories were green on `release/2.4.0` with no `2.4.0` tag anywhere in GHCR.

> **The rule.** A green run is not a published image. `gh run list` answers a different question
> from `gh api /orgs/cloudsforge-online/packages/container/micro-<repo>/versions`. Ask the second
> one. This is the release doc's existing warning — *"a green CI run and a published package are
> not the same claim"* — and it is written there because it has now happened twice.

### 5.3 A test fixture pinned to a domain the code later refused

Sixty-four fixtures across `notify`'s suite addressed mail at `@example.test`, which is precisely
what the new rule refuses. The unit suite caught three; **the database-backed suite caught none,
because it skips without Postgres and Docker is unavailable on the development machine.** CI then
failed sixteen tests in `pipeline.test.ts` — backoff, dead-lettering, the digest window, the
critical-preference override, the verification-mail path. Each had silently stopped exercising
email while its assertions still ran and, in six other cases, still passed.

Two generalisations worth carrying:

- **A guarantee that is not about a domain should not be pinned to one.** None of those tests is
  about `example.test`; they are about retry state. The fixtures now use the estate's own domain,
  which is deliverable, is never dialled because the rig passes a transport, and cannot become
  reserved later. The tests that *do* want a refused address name `beacon.test` where a reader can
  see why.
- **A suite that skips silently when its dependency is missing will hide exactly this.** Locally it
  reported 111/111. The estate already fails CI when the database suite skips; the development
  machine has no equivalent, and that gap is the whole of this finding.

### 5.4 The pre-deploy baseline, so the fix can be measured rather than asserted

Measured on the host at **2026-08-07T21:42Z**, before anything was deployed:

| | testnet (`cf-testnet`) | mainnet (`cloudsforge-estate`) |
| --- | --- | --- |
| `identity.users` | 5,451 | 7,510 |
| `notify.deliveries` where `channel='email'` | 161 | 448 |
| …of those, in the last hour | **96** | **96** |
| …in state `undeliverable` | 104 | 0 |

**Both networks emit ninety-six email deliveries an hour, to the address and the digit.** That is
not a coincidence and it is not user traffic: it is `beacon` registering a synthetic account at a
fixed interval on each network, and it is the number this package exists to take to zero.

The verification after deploy is therefore a *pair* of numbers, and only the pair means anything:
`deliveries where channel='email'` in the last hour must fall to ~0 **while `users` keeps
climbing**. A flat user count would mean beacon stopped, which measures nothing at all.

### 5.4a The testnet hostname, and a correction this session had to make

**The testnet is a suffix on the FIRST LABEL: `hub-testnet.cloudsforge.online`. It is never a
second label.** This session queried `hub.testnet.cloudsforge.online`, got nothing back from two <!-- dead-ok -->
resolvers, and filed [micro-org#245](https://github.com/cloudsforge-online/micro-org/issues/245)
claiming sixteen frontends had no reviewable URL. All of them resolve and serve 200. The issue was
withdrawn.

Every surface, measured 2026-08-08, and each one byte-identical to what its container serves:

| Hostname | HTTP | Title |
| --- | --- | --- |
| `testnet.cloudsforge.online` | 200 | CloudsForge — Mine EMBER on the computer you already own. |
| `hub-testnet.cloudsforge.online` | 200 | Forge Hub |
| `explorer-testnet.cloudsforge.online` | 200 | Network Explorer |
| `status-testnet.cloudsforge.online` | 200 | CloudsForge Status |
| `developers-testnet.cloudsforge.online` | 200 | Developer Platform |
| `api-testnet.cloudsforge.online` | 404 | API root; expected |
| `rpc-testnet.cloudsforge.online` | 405 | JSON-RPC wants POST; expected |

It was already documented in three places, one of which exists solely to prevent this:
[26-public-deployment](26-public-deployment.md) §0 — *"the testnet is a hostname **suffix**
(`hub-testnet.cloudsforge.online`), never a second label, and every `X.testnet.cloudsforge.online`
in the body is dead"* — plus [27](27-cloud-deployment.md):638 and
[30](30-roadmap-completion.md):102, which prints a working URL outright.

> **The third rule, alongside the two in §4.** An empty resolver answer is evidence about the
> string you typed before it is evidence about the estate. The same holds for a 404, an empty
> `grep` and a missing container: *absence is a claim about your query first.* Grep the docs for
> the identifier before reporting that the thing it names does not exist — this one had a
> correction sitting one `grep` away, written by a previous session that made the same mistake.

### 5.5 What the next session picks up

1. Merge [#244](https://github.com/cloudsforge-online/micro-org/pull/244) to `micro-org` `main` —
   it is one `if:` and its comment, and it gates everything below.
2. Re-run CI on the forty-six `release/2.4.0` branches so they re-resolve the producer at `@main`,
   then confirm the `2.4.0` tag exists in GHCR **for every one of them** by the packages API, not
   by the run list.
3. `scp deploy/compose/docker-compose.design.yml` to the host — it is already bumped to 2.4.0 on
   `micro-deploy`'s release branch. **The host is not a checkout and does not pull.**
4. Deploy testnet, then *look at it in a browser*, then take the §5.4 measurement again an hour
   later.
5. Only then ask about merging to `main`. Package 4 (registration) is the next item and its first
   file is `tokens.testnet.env` **on the host**.

---

## 6. Session log: release 2.5.14, and working several repositories at once

*Appended 2026-08-10. Same job as §5 — what a session actually hit, not what it planned. §5 is
about one release that could not publish; this one is about a release that did, and about the
mechanics of running four streams of work over 66 repositories without them colliding. Read §6.1
before cutting a release and §6.5 before spawning a second worker.*

### 6.0 The operating mode this session ran in, because it changes what is safe

Two standing decisions were taken by the owner and both invert instructions written elsewhere in
these documents:

- **Testnet is paused** so that the host's `bitcoind` can finish its initial block download.
  Changes therefore go **straight to mainnet** and are merged to `main` after they have been
  measured there. Anything in these documents that says "deploy testnet first" does not apply
  while that holds, and every item gated on testnet — the testnet administrator rotation, testnet
  `SMTP_*` — is **blocked, not skipped**, and must be picked up when testnet restarts.
- **A green CI run authorises the deploy and the merge**, in that order: deploy, verify on the
  live estate, then merge the pull requests. §5's ordering constraint still binds underneath it —
  an image publishes on `main` only — so the release branches merge before `cfctl release` pins a
  manifest.

### 6.1 The release procedure that worked, in the order it has to happen

Release 2.5.14 went out end to end: **48 repositories bumped, 48 pull requests merged,
`releases/2.5.14.yaml` pinned with 48 of 48 digests and `--verify` green,
[micro-org#337](https://github.com/cloudsforge-online/micro-org/pull/337) merged, deployed to
mainnet and verified on the host.** The sequence, with the two steps that are easy to get wrong
marked:

1. `pnpm -s cfctl bump <version>` from `org/` — one `release/<version>` branch per repository. It
   refuses a dirty tree and refuses a checkout that is not on `main`.
2. Push the branches, open one pull request per repository, and get CI green on each.
3. **Merge to `main`.** Nothing publishes from a branch (§5.2). This is still the only ordering
   constraint in a release.
4. `pnpm -s cfctl release <version>` — pins every image by digest into `releases/<version>.yaml`
   in `org`, and `--verify` re-resolves them. Merge that manifest pull request.
5. On the host, `git pull` in **both** `org` and `deploy`, then
   `./scripts/release-deploy.sh <version>`. ⚠ It invokes `release-render.py` itself; running the
   renderer standalone fails with `error: the following arguments are required: manifest` and
   there is no separate render step to run.
6. ⚠ `./scripts/estate-verify.sh` needs the estate administrator password in the environment and
   will exit immediately with `ADMIN_PASSWORD (or ESTATE_ADMIN_PASSWORD) is not set` without it.
   Run it as `bash -c "set -a; . compose/estate/tokens.env; set +a; ./scripts/estate-verify.sh"`.
   The file is untracked and host-only, which is why no repository check can tell you this.

**Never deploy with a bare `docker compose up -d`.** Compose bakes a container's environment at
**create** time; a container that is already running keeps the environment it was created with no
matter what the env files now say. Only `--force-recreate` re-reads them, and
`release-deploy.sh` is the path that does it — a bare `up` also drops `mainnet.env`, at which
point the public hostnames silently revert to `localtest.me`.

`backup-runner` is **not in any release manifest**: its compose entry is a `build:` context, so it
is rebuilt on the host and a release cannot regress or advance it. Anything that ships in it ships
outside this procedure.

`estate-verify.sh` finished with exactly one failure, and it is the **known** one:
`market.listings is EMPTY`. The four seeded listings are all `draft`, and they are draft because
publishing one needs `micro-ledger` to escrow the ITEM asset. That is §3's package 18 territory
and not a regression from this release.

### 6.2 An assertion that pins a literal in another repository decays into a false alarm

Two repositories were red. Neither was red for the reason the failure named.

**`micro-activity` — one omission, three compiler errors.** A `TS1360` on the classifier table's
`satisfies` clause and two `TS7053`s in the test file were all downstream of a single missing entry
for `wallet.deposit.token_uncredited`. Fixing the table cleared all three. Two decisions inside
that entry are worth carrying because both are invisible from the topic name:

- The event **declares no `amount`**, deliberately, so that the field is dropped at ingest. The
  record's `amount` column is rendered as a decimal beside an asset code; the payload carries the
  token's *smallest units, unscaled*, because the emitting service does not know the token's
  decimals. Rendering it would print a wrong number confidently.
- It resolves the user with `userFromPayload`, not `userFromKey`, because the topic is keyed by
  `wallet_id` — a uuid. `userFromKey` would not fail; it would return a well-formed **wrong** id.

**`micro-pool-web` — a stale cross-repo assertion, not a defect.** Its contract test asserted that
`micro-pool`'s server published the two literals `payoutsImplemented: false`. `micro-pool` had
since replaced both with `deps.payoutsImplemented`, derived from `CUSTODY_BACKING_CLOSED` — the
correct change — and the guard went red for it. The test now asserts the **derivation**: that both
publication sites read the derived value, that `CUSTODY_BACKING_CLOSED` is still `false`, and that
the payouts path still throws.

> **The rule.** A test that pins a *literal* in another repository's source is a test that holds
> only for as long as somebody keeps typing the word. Assert the derivation, or assert the
> behaviour; never assert the spelling. And when you rewrite a guard, **mutation-prove it** —
> temporarily reintroduce the defect it exists to catch and confirm it goes red — because a
> rewritten assertion that is merely green has proved nothing. This one was proved by reverting a
> handler to the literal, watching the test fail, and restoring from a copy taken first.

### 6.3 Three tools that lie about what happened

- **`cfctl bump` reports a false refusal when the release branch already exists.** It reads the
  version from the *current* checkout (`main`), then switches to the existing `release/<v>` branch,
  where the bump is already applied — so the rewrite finds nothing to change and it prints
  `package.json parses as <old>, but the first "version" line does not say that`, alongside its
  generic `::error::the estate ships ONE version across every deployable`. Nothing is wrong, and
  it leaves the repository **on the release branch**. Check `git branch -r --list 'origin/release/<v>'`
  before believing that message.
- **`gh run rerun --failed` does not pick up a new base.** Release branches went red on a defect
  that had already been merged to `main`; re-running reused the same stale merge ref and they
  stayed red. The fix is to merge `origin/main` into the release branch and push — a re-run cannot
  change what it is testing.
- **`grep -q` exits 0 on a file that no text tool will show you.** A guard test in `site` carried a
  NUL byte, which made the whole file binary: `rg` skipped it, `grep -rIl` did not list it, and the
  CI check that greps it kept passing. The guard was unreadable and green at the same time. This is
  the same failure class as package 9's `UnreadableSourceError`, from the other side — there, one
  NUL byte aborted a sweep loudly; here it silenced one.

### 6.4 Never put a regular expression over an environment **value**

Reading deployed configuration means reading it from the running container (§4's third caveat), and
this session established, twice the hard way, how not to print it.

| Attempt | What leaked |
| --- | --- |
| `sed -E "s#://[^@]*@#://***:***@#g"` | `[^@]*` runs across a JSON object and collapses two entries into one, printing a credential from the middle |
| `grep -iE "ember"` on the environment | matched a substring of a *name* and printed `EMBERKIN_IDENTITY_CREDENTIAL` in full |
| filtering by name shape | missed `CUSTODY_DATABASE_URL` and printed the shared postgres password |

**Print names only: `printenv | sed -E 's/=.*//'`.** For one specific value known not to be secret,
`printenv VAR`. To compare a secret across two places without revealing it, compare a
`sha256sum | cut -c1-12` fingerprint. One caveat that is not obvious: the names-only technique
still prints the *continuation lines* of a multi-line value, so it is unsafe for any variable
holding JSON. Related: a URL redaction that works is
`sed -E "s#//[^:/@\"]+:[^@\"]+@#//***:***@#g"`, and an RPC URL that carries a password should not be
echoed at all.

### 6.5 Running four streams over 66 repositories

Most of this session's work ran as concurrent workers, and the discipline that made it safe is
one rule: **a repository has exactly one owner at a time.** The streams were partitioned by
repository before any of them started — the trading engine took `trade`, `trade-web` and
`contracts`; the Hearth coinbase work took `hearth`, `hearth-wallet-core`, `emberkin` and
`emberkin-web`; the frontend stream took `ui` and the fifteen `*-web` surfaces; the release and
sweep work took everything else. Two consequences:

- **Never check out a second branch in a tree somebody else is working in.** Use
  `git worktree add <path> -b <branch> origin/main`. This document's own change was made that way,
  because `docs` was checked out on another stream's branch at the time.
- **A stream that needs a repository it does not own asks for it rather than taking it.** Handing
  `hub-web` between streams mid-flight worked; two streams editing it would have produced a merge
  neither of them could review.

Two small mechanical notes that cost time: **heredocs do not survive as `git`/`gh` message
bodies** — use `git commit -F <file>`, `gh pr create --body-file <file>`,
`gh issue comment --body-file <file>` (a heredoc *writing* the file first is fine) — and
`head -n -N` and `timeout` **do not exist on macOS**.

### 6.6 What was decided, filed and dispositioned

- **The chain/application split** — moving the application plane to a second machine on the network
  and leaving the chain nodes on the current host — is planned in
  [micro-org#338](https://github.com/cloudsforge-online/micro-org/issues/338). It is a plan, not
  work in progress. It bears directly on §3 package 2: a split that leaves the block store on one
  unbacked-up volume has not changed the failure mode it exists to fix.
- **The mainnet estate administrator password is rotated**, and the rotated value exists only in
  `compose/estate/tokens.env` on the host as `ESTATE_ADMIN_PASSWORD`; no literal remains in any
  repository. What is *not* done is the **testnet** administrator
  ([micro-org#276](https://github.com/cloudsforge-online/micro-org/issues/276) item 3), blocked on
  the paused testnet — and the more interesting gap: **the rotation procedure exists only as a
  comment on an issue.** It is in none of the 29 runbooks and not in `releasing.md`. A procedure
  that lives in an issue comment is a procedure the next session will re-derive.
- **[micro-org#313](https://github.com/cloudsforge-online/micro-org/issues/313)** (the privacy
  notice) had already been fixed by an earlier change and was verified live before closing — which
  is the only way a sweep should close anything it did not itself write.

New key material generated during this work used `openssl rand -base64 48` (or `os.urandom(48)`),
was never printed, never pasted into a terminal whose scrollback is captured, and never written
into a commit message.

### 6.7 Findings raised and deliberately not actioned

Recorded here so they are not rediscovered as new. None is scheduled.

| Finding | Why it matters |
| --- | --- |
| `deploy`'s CI never runs `backup/`'s tests | The backup runner has eight test files and no pipeline executes them. §3 package 3 depends on that code being correct |
| The promtool unit test for `BackupDestinationFilesystemErrors` was written and never committed | An alert rule with no test, in the same area |
| `aetherholm-web`'s mechanic-claims test is now vacuously green | It asserts over a set that has become empty; it passes and guards nothing |
| `custody-v1-disclosure.md` §4 omits the nine mainnet deployer keys | [micro-org#25](https://github.com/cloudsforge-online/micro-org/issues/25) |

**Owner-only, and no session can close them:** reissuing `SMTP_PASS` at Mailtrap
([#156](https://github.com/cloudsforge-online/micro-org/issues/156)), the custody artefact C backup
([#25](https://github.com/cloudsforge-online/micro-org/issues/25) §4), and the production `age`
identity ([#214](https://github.com/cloudsforge-online/micro-org/issues/214)).

**Chain state, as at 2026-08-10.** The UTXO nodes are host processes, not containers. Litecoin is
synced; Bitcoin is at 917,518 of 961,839 and Dogecoin is roughly 1.13M blocks behind. Two
configuration changes are held on that: `POOL_LTC_AUX_CHAINS=doge` once `dogecoind` leaves IBD, and
adding `btc` to `POOL_CHAINS` once `bitcoind` reports `initialblockdownload: false`. Neither is a
code change and neither should be made early — a pool advertising a chain whose node is still in
IBD advertises work it cannot validate.

### 6.8 What the next session picks up

1. Merge the frontend, trading-engine and Hearth-coinbase pull requests as their CI goes green,
   then cut **2.5.15** by §6.1. They are separate releases only if they land days apart.
2. Put the administrator-rotation procedure into a runbook and into `releasing.md`, then rotate the
   **testnet** administrator when testnet restarts.
3. Rotate the host's `CUSTODY_MASTER_SECRET_V3` to V4.
4. Rename the `cfmicro` gateway compose project to `cloudsforge-estate` on mainnet. It is a
   project rename and therefore recreates containers; do it in its own window, not inside a release.
5. Then §3's table resumes at its own order — packages 1 and 2 remain the only two whose delay
   compounds.

---

*Written 2026-08-07, §6 appended 2026-08-10. If this file and
[18-build-status](18-build-status.md) disagree about whether something exists, 18 is right.*

