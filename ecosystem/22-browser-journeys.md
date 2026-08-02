# 22 — Browser journeys

The complete browser-level scenario catalogue, and the three design decisions needed to implement
it. This is a specification, not test code.

It extends [05-user-journeys.md](05-user-journeys.md) rather than restating it: 05's twenty-one
journeys are the spine, and every one of them appears below decomposed into scenarios a browser
can actually run. It sits under [14-testing-strategy.md](14-testing-strategy.md) §8 (synthetic
journeys as the release gate) and §11 (frontend testing), and it corrects one line of §11 — see
§9.

**Every claim about a surface below was read out of the working tree, not out of a document.**
Where a scenario cannot be written because the functionality does not exist, that is said in §8
rather than papered over with a plausible-looking scenario. Three documents in this estate have
been found stale; a claim in a document is a lead, never evidence.

Last verified: 2026-08-03, against the 58-directory working tree.

---

## 1. Where browser coverage stands today

| Claim | Verified | Where |
| --- | --- | --- |
| No Playwright, Puppeteer or Cypress anywhere in the estate | **true** | `grep -rl playwright --include=package.json` over all 58 directories returns nothing |
| `micro-beacon` runs HTTP journeys only, and declares exactly six | **true** | `beacon/src/estate.ts:360-367` — `IDENTITY_REGISTER`, `IDENTITY_SIGNIN`, `IDENTITY_HANDOFF`, `MARKET_CATALOGUE`, `WORLDS_REGISTRY`, `ESTATE_REACHABLE`. `beacon/package.json` has no browser dependency |
| Beacon refuses to declare journeys it cannot run | **true, and it is the rule this document adopts** | `beacon/src/estate.ts:5-22` |
| Frontends have tests, but none renders a component | **true** | every `*-web/package.json` runs `node --import tsx --test test/*.test.ts`; `hub-web/test/browser-stubs.ts:1-9` states the position: "There is no DOM in this suite on purpose" |
| Doc 14 §11 names Vitest, Testing Library and `@axe-core/playwright` | true as an intention; **none is installed anywhere** | no `*-web/package.json` lists any of the three |
| The `surfaceJourney` helper exists | **true — in the frozen legacy repo only** | `stack/infra/beacon/src/journeys/web.js:19`, driving `playwright-core` (`stack/infra/beacon/package.json:20`) via `stack/infra/beacon/src/browser.js`. It is **not** in `micro-beacon` and has no successor there |

So browser coverage of the estate being built is zero, and the estate it was written for is
frozen. The catalogue below starts from nothing.

---

## 2. Decision 1 — where the suite lives

### 2.1 The proposal I was asked to challenge

*One shared home, because the highest-value scenarios cross surfaces and thirteen per-frontend
suites drift thirteen ways.* The counter-argument is that a frontend PR then cannot get fast
feedback from its own repository.

### 2.2 The resolution: split by tier, not by repository

The premise that "one shared home" and "fast feedback in the frontend repo" are alternatives is
false. They are answers to different questions, and both are right for their own question.

**Tiers 1 and 2 live in the frontend repository. Tier 3 lives in `micro-beacon`.**

That is not a compromise between the two positions; it follows from what each tier needs to run
(§4). A test that needs nothing but the bundle belongs beside the bundle. A test that needs eight
services and two hostnames cannot live in any one of the thirteen repositories that would each
need to stand the estate up to run it.

### 2.3 Why `micro-beacon` and not a new repository

The obvious alternative is a new `micro-journeys` repo. Beacon wins on four counts:

1. **Beacon already defines what a journey is.** `ctx.step` / `ctx.assert` / `ctx.skip` /
   `ctx.cleanup`, and the three rules in `beacon/src/journeys.ts` — an assertion failure is `fail`
   (the product is broken), any other throw is `error` (the harness is broken), and a skip is not
   a pass. A second harness would be a second definition of green, and the two would disagree
   within a quarter.
2. **Beacon is already the release gate** (AD-04; 14 §8; `beacon/README.md:6`). A browser suite
   that is not wired into the gate is a report nobody reads; a browser suite wired into a
   *second* gate is two gates a release has to satisfy and one of them gets switched off.
3. **The step-duration budget in 14 §13 is beacon's metric series.** "Journey step duration within
   20% of its own trailing 7-day median" is computed from beacon's `checks` history and requires
   stable step names. A separate runner would have to reimplement that or go unmeasured.
4. **The precedent is exactly this shape and it worked.** The legacy estate's browser journeys
   were `infra/beacon/src/browser.js` plus `journeys/web.js`, on `playwright-core`, inside beacon,
   sharing beacon's runner. That is the design being re-adopted, not invented.

**The argument against, stated because it is real:** beacon is a deployed monitoring service with
a Postgres schema, a scheduler and a five-minute cadence. A two-hundred-scenario browser catalogue
with fixtures and per-surface setup is not a monitor and must never run on that cadence against
production.

**The resolution is two entry points, one definition.**

| | `beacon` (the service) | `beacon browse` (the CLI) |
| --- | --- | --- |
| What runs | the six HTTP journeys, plus the **continuously-run browser set** (§7.1) | the whole catalogue |
| Where | the deployed monitor | CI, against the dev estate |
| Cadence | the leased schedule | on a release candidate, and nightly |
| Writes | `checks`, incidents, the public status projection | the run's artefacts only |
| Skips | a skip is not a pass, and blocks the gate | a skip is not a pass, and blocks the gate |

Two different sets, and conflating them is the mistake to avoid:

- **★ in the catalogue = release-gate.** A release candidate does not promote until every ★
  scenario is green. 119 of the 318 scenarios are ★.
- **§7.1 = continuously-run.** A much smaller set, because each one holds a browser open against
  production every few minutes. It is currently **eleven scenarios plus the fifteen 404
  assertions**, and it is small for the reason beacon already gives: a declared journey that can
  only skip refuses every release for ever, and the gate is switched off within a week
  (`beacon/src/estate.ts:15-16`).

`playwright-core`, not `playwright`: the legacy repo already recorded the reason
(`stack/infra/beacon/src/browser.js:9-11`) — the full package downloads its own ~1.5 GB browser
set, and the core package drives a Chromium the image already has.

### 2.4 How a frontend PR still gets a fast signal

Three mechanisms, none of which needs the estate:

1. **Tiers 1 and 2 run in the frontend repo's own CI**, on `node --test` as today, in under a
   minute. That is where the component, interaction, axe and surface-smoke scenarios live, and it
   is the majority of the catalogue by count.
2. **The route manifest is a contract, and it is already half-built.** Every frontend already
   declares its routes as data in `src/lib/routes.ts` precisely so a test can read them without
   booting a browser (`hub-web/src/lib/routes.ts:22-23`), and `test/routes.test.ts` already fails
   the build when `app.tsx` and `nginx.conf` disagree with it. The shared suite selects surfaces
   and routes **through that same module**, exported as `journeys.manifest.json` at build time. A
   frontend PR that renames a route breaks its own repo's test first — before the shared suite has
   an opinion.
3. **Selector stability is the frontend's contract, not the suite's.** Tier 3 addresses elements
   by accessible role and name (`getByRole('button', { name: 'Approve' })`), never by class or DOM
   path. A frontend PR that changes markup does not break tier 3; one that changes an accessible
   name does, and that is a change a reviewer should see.

**What this costs, said plainly.** A frontend PR still cannot prove a cross-surface journey. The
signal for that arrives when the release candidate is assembled. That is the correct place for it:
a cross-surface journey is a property of a *set* of versions, and no single repository's PR can
establish one.

---

## 3. Decision 2 — the layer boundary, made testable

**A browser scenario may never assert a business rule.**

The reason is a real incident, recorded in 14 §11: a game client withheld four SKUs from its UI
while the payment routes stayed live and chargeable. A client-side test asserting "the four SKUs
are not shown" would have passed, green, against the defect — because the defect was that hiding
them was the *entire* control.

Advice does not survive a deadline. So the boundary is three declarations and a meta-test.

### 3.1 What a browser scenario is allowed to assert

Every scenario declares exactly one `asserts` kind:

| `asserts` | Means | Example |
| --- | --- | --- |
| `presentation` | what a human can see, **relative to what the API returned in this same run** | "every listing in the `GET /v1/listings` response has a row; the row's price equals the response's price" |
| `client-request` | what the client SENT, captured from the browser's own network log | "the destination address in the `POST` body is byte-identical to the one rendered on the confirmation step" |
| `navigation` | where the browser ended up, and under what HTTP status | "an unknown address renders the not-found screen **under a 404**" |

Nothing else. `absence` is not an assertion kind — a scenario that would assert something is *not*
on screen must instead assert the positive presentation fact ("the catalogue shows exactly the
SKUs the API returned") or it is not a browser scenario at all.

### 3.2 The meta-test that enforces it

Each scenario definition carries two fields, and `beacon` fails its own test suite without them:

- `asserts` — one of the three above.
- `ownedBy` — **required whenever the scenario's outcome depends on a server-side rule**: the
  path of the server-side test that owns that rule. Not a description. A path, resolvable by
  `grep`, in the service that enforces the rule.

The meta-test is mechanical: a scenario whose expected outcome is a 4xx, a refusal, a denial or an
absence, and which carries no `ownedBy`, fails. The suite refuses to run rather than reporting
green. This is the same shape as beacon's existing rule that a declared-but-faked journey is worse
than no journey (`beacon/src/estate.ts:17-18`).

### 3.3 The incident, written as it would be covered now

| Layer | Assertion | Where it lives |
| --- | --- | --- |
| Server | the payment route refuses a withdrawn SKU with a named reason | the service's own test — this is the one that would have caught it |
| Browser (`presentation`) | the catalogue renders one card per SKU in `GET /v1/catalogue`, and each card's price equals the response's price | `mint-web` tier 2 |
| Browser (`client-request`) | pressing Buy sends the SKU id shown on the card, and no other | `mint-web` tier 1 |

Note what the browser does **not** assert: that four SKUs are missing. If the API returns them,
the browser renders them, and the browser scenario passes — correctly, because the browser is not
where that rule lives.

### 3.4 The corollary the catalogue obeys

Several scenarios below end in a refusal — a policy denial, a 403 on an operator action, a
single-use code rejected the second time. In every case the assertion is on the **sentence the
user is shown**, never on the refusal itself. "The user is told the limit, when it resets, and one
route to raise it" is presentation. "The withdrawal was denied" is the server's test, cited in
`ownedBy`.

---

## 4. Decision 3 — the three tiers, and what each needs to run

A catalogue where everything needs the whole estate is a catalogue that runs never.

| Tier | Name | Needs up | Runs | Where the code lives |
| --- | --- | --- | --- | --- |
| **T1** | Component / interaction / axe | **nothing.** The bundle, a browser, and stubbed responses | every PR in the frontend repo | `<surface>/test/` |
| **T2** | Surface smoke | the built bundle behind its own `nginx.conf`, plus **one** API — the surface's own | every PR in the frontend repo; nightly against dev | `<surface>/test/` |
| **T3** | Journey | the dev estate (`deploy/compose/docker-compose.estate.yml`), the frontends, and a sign-in surface | release candidate; ★ subset continuously | `beacon/src/browser/` |

**T1 is the tier this catalogue puts most in.** Every degradation state, every confirmation gate,
every "a zero and an unknown must not look identical" rule and every axe sweep is T1 — because a
stubbed response can express "the ledger tile failed and the pricing tile did not", and a live
estate cannot be asked to produce that on demand.

**T2's stub source is `micro-conformance`.** The corpus is already one JSON file per HTTP
interaction, redacted and normalised at capture (`conformance/README.md` §1). A T2 run serves the
real bundle and answers its API calls from the corpus. That makes T2 a *contract* test between a
frontend and the recorded behaviour of its service, which is the thing a per-frontend suite is
uniquely good at and a cross-surface suite cannot do.

**T3 has a hard prerequisite that does not exist yet** — see §8.1. The estate compose file defines
22 domain services and **no frontend container at all**
(`deploy/compose/docker-compose.estate.yml`, services `postgres` … `hub-api`).

### 4.1 The ten-minute cliff, and what it means for T3

`deploy/README.md` records it: identity issues service tokens with a 600-second TTL
(`identity/src/tokens.ts:28`) and nothing re-mints one, so ten minutes after
`scripts/estate-bootstrap.sh` the money-tier service-to-service calls begin failing 401.

A T3 run that takes longer than ten minutes will therefore go red in the money group for a reason
that is not the product. Two consequences, both binding on the catalogue:

- **The T3 suite is sharded so that no shard exceeds eight minutes**, and each shard re-runs the
  bootstrap. Groups are already the shard boundary below.
- **A 401 from a service token is an `error`, not a `fail`** — beacon's own distinction. The
  harness is broken (the environment expired), the product is not. Collapsing them would open an
  incident against a working estate every eleventh minute.

---

## 5. The surfaces, enumerated from the working tree

Sixteen bundles exist. `web-template` is a scaffold rather than a product surface, so fifteen are
in scope. Route tables are from each repo's `src/app.tsx` and `src/lib/routes.ts`.

| Key | Repo | Routes | Gate |
| --- | --- | --- | --- |
| `hub` | `hub-web` | `/`, `/portfolio`, `/wallet/*`, `/activity`, `/security`, `/entitlements`, `/settings`, `/search`, `/account/*`, `/billing/*` | every route protected |
| `market` | `market-web` | `/`, `/listings/*`, `/collections/*`, `/sell`, `/orders/*`, `/fees` | `/sell` and `/orders` protected; rest public |
| `trade` | `trade-web` | `/`, `/backtests`, `/backtests/new`, `/backtests/:id`, `/bots`, `/bots/new`, `/bots/:id` | index public; rest protected |
| `worlds` | `worlds-web` | `/`, `/player`, `/inventory`, `/entitlements`, `/entitlements/:id`, `/titles/:id` | index and `/titles/:id` public |
| `create` | `mint-web` | `/`, `/launch`, `/tokens`, `/tokens/:id`, `/projects/:id` | index and `/projects/:id` public |
| `admin` | `admin-web` | `/`, `/approvals`, `/approvals/:id`, `/actions`, `/audit`, `/engagement`, `/flags`, `/broadcasts` | every route protected |
| `status` | `status-web` | `/`, `/history`, `/about` | **no `ProtectedRoute` in the repository at all** |
| `explorer` | `explorer-web` | `/`, `/chains`, `/chains/:chain/:network`, `/blocks/:c/:n/:height`, `/tx/:c/:n/:hash`, `/address/:c/:n/:addr`, `/tokens/:c/:n/:addr` | all public, deliberately |
| `developers` | `devportal-web` | `/`, `/apps`, `/apps/:slug`, `/organisations`, `/organisations/:id`, `/projects/:id` + `keys`, `webhooks`, `oauth`, `usage` | index and `/apps*` public |
| `foresight` | `foresight-web` | `/`, `/markets/*`, `/portfolio/*`, `/rules` | **no `ProtectedRoute` in this app** |
| `foresight-admin` | `foresight-admin-web` | `/`, `/markets`, `/markets/:id`, `/categories` | every route protected |
| `emberkin` | `emberkin-web` | `/`, `/party`, `/dex`, `/satchel`, `/wardrobe`, `/settings`, `/credits` | `/dex`, `/settings`, `/credits` public |
| `aetherholm` | `aetherholm-web` | `/`, `/cities`, `/fleets`, `/battles`, `/alliance`, `/chronicle`, `/map` | `/battles`, `/chronicle` public |
| `site` | `site` | `/`, `/products`, `/products/:slug`, `/platform`, `/build`, `/about`, `/terms`, `/privacy` | none |
| `network` | `network-site` | `/`, `/chain`, `/mine`, `/node`, `/faucet` | none |

Hostnames, dev ports and the apex-derivation rule come from the surface registry
(`ui/packages/ui/src/surfaces.ts:168-572`), which is the single declaration the suite resolves
targets from. It must never be restated in the suite: the registry's own header records that the
same list was maintained by hand in eight places and had already drifted
(`ui/packages/ui/src/surfaces.ts:8-11`).

**Where doc 05's surface table is out of date.** 05:27-38 lists ten surfaces. It predates
`foresight-web`, `foresight-admin-web`, `emberkin-web`, `aetherholm-web` and `site`, and its
"Identity screens — `identity` (server-rendered) — Login, register, forgot, reset, consent" row is
false of this estate: `micro-identity` serves JSON only and renders no HTML (§8.1).

### 5.1 One universal property, asserted on every surface

Every one of the fifteen bundles states in its own `not-found.tsx` that nginx enumerates the real
routes and lets everything else fall to `error_page 404 /index.html`, which serves the bundle
while **keeping the 404 status** — as opposed to `try_files $uri /index.html`, which answers 200
for every address in existence. This is asserted once per surface as `BJ-<KEY>-404`, tier 2,
`asserts: navigation`. Fifteen scenarios; they are not repeated in each group's table.

---

## 6. The catalogue

### 6.0 How to read a row

| Column | Meaning |
| --- | --- |
| **id** | Stable. Never renumbered — a renamed scenario abandons its metric history, the same rule beacon already applies to step names (14 §8) |
| ★ | **Release-gate.** A release candidate does not promote until this scenario is green. The much smaller continuously-run set is §7.1 |
| ⛔ | **Cannot be run today.** The functionality or the environment does not exist. The blocker is named in §8 and the scenario is a specification, not a claim of coverage |
| **A** | What it asserts: **P**resentation, **C**lient-request, **N**avigation (§3.1) |
| **T** | Tier (§4) |
| **Needs** | Services that must be up. T1 rows read "—": stubs only |

An `ownedBy` column is deliberately absent from these tables: it belongs on the scenario
definition in code, where the meta-test can read it, and a path in a document is a path that rots.
Where a scenario's outcome depends on a server rule, the rule is named in the row so the author
knows which test to point `ownedBy` at.

---

### 6.1 Group A — account and session
*Doc 05 §1.1, journey 2, journey 21.*

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-ACC-01 ⛔★ | Register: open the sign-in surface from `site`, choose register, submit email/handle/password | after the redirect the browser is on the return address with a session, and the account handle rendered in the bar equals the handle submitted | P | T3 | sign-in surface (§8.1), identity |
| BJ-ACC-02 ⛔ | Register with a taken handle | the field carries an inline error and **the other fields keep their values** — 05:91 makes form-state preservation the requirement, and a form that clears on 409 is the failure | P | T3 | sign-in surface, identity |
| BJ-ACC-03 ⛔★ | Sign in on Hub, arriving from a protected deep link (`/portfolio`) | after sign-in the browser is on `/portfolio`, not on `/` — the `return` parameter survives the round trip (`ui/packages/ui/src/index.tsx:175-178`) | N | T3 | sign-in surface, identity, hub-api |
| BJ-ACC-04 ⛔★ | SSO handoff: signed in at Hub, open Worlds in the same browser | Worlds renders `/player` without a second credential prompt, and the network log shows exactly one code redemption | C | T3 | sign-in surface, identity, worlds |
| BJ-ACC-05 ⛔ | The handoff code is single-use: replay the callback URL in a second tab | the second tab does **not** end up signed in. Server rule; the browser asserts the sentence shown | P | T3 | sign-in surface, identity |
| BJ-ACC-06 | The callback code never reaches the address bar: boot a surface with `#cf_code=…` | after boot `location.hash` no longer contains `cf_code`, and the strip happened **before** the exchange request was sent — the order is the point (`ui/packages/ui/src/index.tsx:202-207`) | C | T1 | — |
| BJ-ACC-07 | Anonymous visit to every protected route of every surface | the sign-in prompt renders and **no protected content is on the page**. Hiding is not the boundary (`hub-web/src/app.tsx:10-17`), so this asserts the prompt, not the security | P | T2 | the surface only |
| BJ-ACC-08 | Anonymous visit to every public route of every surface | the page renders its content with no sign-in prompt. `trade-web/src/app.tsx:13-14` gives the reason: a public catalogue behind a gate sends a visitor to sign in for a page the service would have served | P | T2 | the surface's API |
| BJ-ACC-09 ★ | Session expires mid-flow: a valid session, then the token is invalidated, then a protected read | the page shows the re-authentication path, not a screen made of failures, and no stale data is left rendered as current | P | T3 | identity, hub-api |
| BJ-ACC-10 | Concurrent-tab refresh: two tabs both refresh at the same instant | both tabs stay signed in — the single-flight refresh in each surface's `lib/api.ts` collapses them, and identity's 10-second reuse grace covers the rest (05:249-250) | C | T1 | — |
| BJ-ACC-11 | Sign out in tab A while tab B is open; act in tab B | tab B's next protected read shows the re-authentication path rather than a silent empty state | P | T2 | identity |
| BJ-ACC-12 | Hub → Security → end one session | the session list reloads and that row is gone. It reloads rather than removing the row locally, because `DELETE /sessions/:id` answers 204 whether or not there was one (`hub-web/src/pages/security.tsx:15-18`) | P | T3 | identity, hub-api |
| BJ-ACC-13 | Hub → Security → "sign out everywhere" | the current session is revoked too, and the browser lands on the re-authentication path — a sign-out-everywhere that spares the device performing it has not done what it says (`hub-web/src/pages/security.tsx:94-96`) | N | T3 | identity, hub-api |
| BJ-ACC-14 | Security page with identity unreachable but hub-api healthy | the session panel shows its own failure with the request id to quote, and **everything else on the page still renders** (`hub-web/src/pages/security.tsx:280-292`) | P | T1 | — |
| BJ-ACC-15 ⛔ | MFA lockout (05 journey 21): recovery-code path, then the no-codes path | the no-codes path never clears MFA on email control alone; the waiting period and the cancel link are both on screen | P | T3 | sign-in surface, identity |
| BJ-ACC-16 | Settings page states where each account setting lives | the environment this bundle is talking to is rendered from `window.location.hostname` at runtime, and there is no build-time constant (`hub-web/test/no-build-time-config.test.ts` is the unit half; this is the rendered half) | P | T2 | hub-api |

**Note on BJ-ACC-16.** `hub-web/src/pages/settings.tsx:15-24` records that notification
preferences are unreachable from Hub — `notify` has no surface-registry entry, so
`cloudsforgeHosts()` cannot produce a URL for it, and the `notifications` tile is permanently
`unavailable`. The scenario asserts the page *says so*. It must not assert a preferences UI that
does not exist.

---

### 6.2 Group B — wallet, deposits, withdrawals, key export
*Doc 05 §1.2, §1.3, journeys 3, 4, 5, 6, 17, 18. Everything that touches withdrawal is in this
group, including the operator half — see BJ-ADM-01..05, cross-referenced here.*

**Read this before the table.** `hub-web`'s Wallet page is **read-only**. It contains no `<form>`,
no `<button>`, no `onClick` and no mutation — verified by grep over
`hub-web/src/pages/wallet.tsx`. It reads `/v1/dashboard` and renders three tiles: the wallet
registry, deposits still confirming, and withdrawals in flight (`wallet.tsx:41`). There is no Send
form, no receive-address action, and no key-export ceremony anywhere in the estate's frontends.

So this group splits in two. The read scenarios are runnable. The write scenarios — 05's journey 4
and journey 5, the two most security-sensitive flows in the programme — are specified in full and
marked ⛔, because there is nothing to click. This is the largest coverage gap in the estate and
§8.2 states it as one.

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-WAL-01 ★ | Hub → Wallet with wallets, deposits and withdrawals present | one row per wallet, and each row's chain, network badge and lifecycle state match the dashboard response | P | T3 | hub-api, wallet, ledger |
| BJ-WAL-02 | A wallet with `status: exported` | the row carries the `exported` chip. A key that has left custody and a key that has not must not look the same (`hub-web/src/pages/wallet.tsx:119-122`) | P | T1 | — |
| BJ-WAL-03 | Mainnet and testnet wallets for one chain | two separate rows, and neither is inferred from the other. 05:114-116 names the XRP testnet/mainnet address collision this rule prevents | P | T1 | — |
| BJ-WAL-04 | A deposit confirming | the row shows the ordinal confirmation meter and the count matches the response; the label says deposits **confirming**, not "your deposits" — the tile holds only credits not yet credited (`wallet.tsx:19-21`) | P | T1 | — |
| BJ-WAL-05 | A withdrawal in state `stuck` | the row carries the warn chip and the service's own failure reason, or "awaiting confirmation from the chain" when there is none (`wallet.tsx:204-219`) — this is 05 journey 18's user-facing half | P | T1 | — |
| BJ-WAL-06 | Deep link `/wallet/deposits/<id>` and `/wallet/withdrawals/<id>` | both render the wallet page rather than 404. hub-api's next-action cards emit exactly these addresses (`hub-web/src/app.tsx:55-59`), and a card whose button 404s is worse than no card | N | T2 | hub-api |
| BJ-WAL-07 | Wallet page with `wallet` down and `ledger` up | the wallet tile says it is unavailable; the deposits and withdrawals tiles render independently | P | T1 | — |
| BJ-WAL-08 ⛔ | **Send (05 journey 4):** asset, network, destination, amount → address validated per family → untrusted-destination warning → fee quote → confirm | the destination submitted is byte-identical to the destination rendered on the confirmation step, and the fee is shown **before** confirmation, never after (05:269) | C | T3 | no UI exists (§8.2) |
| BJ-WAL-09 ⛔ | Send: double-submit the confirm button | exactly one withdrawal request leaves the browser. The key is minted when the intent is formed, not per fetch — `market-web/src/lib/idempotency.ts:12-16` already states the rule and is the model | C | T1 | no UI exists |
| BJ-WAL-10 ⛔ | Send: back-button after the confirmation screen | the previous step does not re-arm a second submit against the same intent | N | T1 | no UI exists |
| BJ-WAL-11 ⛔ | Send: the request fails after the optimistic UI has moved | the row reverts to a stated failure with the reason, and the balance shown is the server's, not the optimistic one | P | T1 | no UI exists |
| BJ-WAL-12 ⛔ | Send: policy returns `deny` (05 journey 20) | the reason in plain language, the limit, when it resets, and one route to raise it. **Never a bare 403** | P | T3 | no UI exists |
| BJ-WAL-13 ⛔ | Send: policy returns `challenge` | MFA is prompted inline and the flow continues afterwards without re-entering the amount | P | T3 | no UI exists |
| BJ-WAL-14 ⛔ | Send: policy returns `review` | the user is told the expected turnaround, and the request is visible as queued rather than as failed | P | T3 | no UI exists |
| BJ-WAL-15 ⛔ | Send: safe retry on a stuck withdrawal | the retry control exists, and pressing it twice produces one in-flight outbound (05:485-487) | C | T3 | no UI exists |
| BJ-WAL-16 ⛔ | **Receive (05 §1.3):** select asset and network, get address, QR and confirmation policy | the address rendered is the address in the response, and the confirmation depth shown matches the chain's policy | P | T3 | no UI exists |
| BJ-WAL-17 ⛔ | Receive: the screen explains managed wallet vs deposit address **in the UI** (05:257-259) | both sentences are on the page at body size, not in a tooltip | P | T2 | no UI exists |
| BJ-WAL-18 ⛔★ | **Key export ceremony (05 journey 5), all ten stages** | each stage is refused until the previous one completed; the cooling-off period is stated with its cancel route; the secret is revealed once and is not in any cacheable body | P | T3 | no UI exists |
| BJ-WAL-19 ⛔ | Key export: cancel from the notification link | cancellation needs no MFA and is available at every point in the window (05:296) | N | T3 | no UI exists |
| BJ-WAL-20 ⛔ | Key export: the ceremony is unavailable with no factor enrolled | the page says enrol first, and offers the enrolment route — not a disabled button | P | T2 | no UI exists |
| BJ-WAL-21 ⛔ | **Connect an external wallet (05 journey 6):** challenge nonce → sign → verify → grant authorisations individually | the authorisation set offered is exactly the closed five (`withdrawal_destination`, `token_owner`, `community_membership`, `governance_vote`, `market_settlement`) and each is granted separately | C | T3 | no UI exists |
| BJ-WAL-22 ⛔ | An unverified external address contributes to portfolio display only | it is not offered as a withdrawal destination. Server rule (14 §12 "Withdrawal destination negative"); the browser asserts the absence of the option relative to the authorisations the API returned | P | T3 | no UI exists |
| BJ-WAL-23 ⛔ | **A deposit that reorgs out, uncredited (05 journey 17)** | the pending row disappears with the explicit "this transaction was reorganised out of the chain" note. A row that vanishes silently is the failure | P | T1 | needs the reorg fixture |
| BJ-WAL-24 ⛔ | A deposit that reorgs out **after** crediting | the balance goes down **and** a notification names the transaction hash in plain language. A balance that drops with no explanation is the failure | P | T1 | needs the reorg fixture |

---

### 6.3 Group C — dashboard, portfolio, activity, access
*Doc 05 §1.4, §1.12, journey 19. This is where "a tile that cannot load says so" is asserted, and
it is the single richest T1 group in the catalogue.*

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-DSH-01 ★ | Hub overview, every upstream healthy | all eleven tiles render, and the portfolio total equals the sum the response implies | P | T3 | hub-api + its 7 upstreams |
| BJ-DSH-02 | Overview with `ledger` unavailable | the portfolio tile says "unavailable" and **no zero is displayed**. 05:497 — a zero and an unknown must not look identical. Everything else on the page renders | P | T1 | — |
| BJ-DSH-03 | Overview with `pricing` unavailable | balances render in native units with a "valuation unavailable" note; the amount cell is unaffected | P | T1 | — |
| BJ-DSH-04 | Overview with `indexer` unavailable | the pending-deposit tile degrades; confirmed balances are unaffected | P | T1 | — |
| BJ-DSH-05 | Overview with `activity` unavailable | the feed panel is absent and the page says so — activity is additive by design (05:501) | P | T1 | — |
| BJ-DSH-06 | Overview with each of `trade`, `market`, `worlds` down in turn | only that product's tile degrades | P | T1 | — |
| BJ-DSH-07 | Overview with `custody` unavailable | new wallets show as queued; existing wallets and balances render normally | P | T1 | — |
| BJ-DSH-08 ★ | Overview with **every** upstream down but hub-api up | the page still paints. `GET /v1/dashboard` answers 200 with holes and never 500 (`hub-api/src/dashboard.ts:4-11`), and a client that renders one failure screen because one tile failed throws that away (`hub-web/src/pages/overview.tsx:5-12`) | P | T1 | — |
| BJ-DSH-09 | Overview with hub-api itself rejecting | *now* a failure state is correct — the only two things that produce one are the session and hub-api (`overview.tsx:10-12`) | P | T1 | — |
| BJ-DSH-10 | A dashboard with nothing in it | **no page-level empty state.** Each tile renders its own empty value; a single "nothing here" would replace eleven specific answers with one vague one (`overview.tsx:33-40`) | P | T1 | — |
| BJ-DSH-11 | "Needs you" cards | each card carries a verb and a destination, and **every destination resolves** — including `/account/security`, `/account/restrictions/:id` and `/billing/subscriptions/:id`, which hub-api emits and `hub-web/src/app.tsx:109-123` honours | N | T2 | hub-api |
| BJ-DSH-12 ★ | Portfolio: a holding whose rate is unavailable | the value cell shows the **reason**, the amount cell is unaffected, and the holding is excluded from the total. Never a zero (`hub-web/src/pages/portfolio.tsx:6-11`) | P | T1 | — |
| BJ-DSH-13 ★ | Portfolio: the two timestamps | the summary shows `pricedAt` (the **oldest** contributing observation) and each row shows its own `quotedAt`, and the two are different numbers (`portfolio.tsx:13-20`) | P | T1 | — |
| BJ-DSH-14 | Portfolio with zero holdings vs an unavailable tile | the two render differently. A 200 carrying an unavailable tile is not the empty state (`portfolio.tsx:38-41`) | P | T1 | — |
| BJ-DSH-15 | Portfolio allocation chart | a sorted horizontal bar, and its table view is present (14 §11 makes the table both the accessibility fallback and the export path) | P | T1 | — |
| BJ-DSH-16 | Portfolio chart with no data vs a chart that failed | the empty chart and the broken chart do not look the same (05:504) | P | T1 | — |
| BJ-DSH-17 ★ | Activity feed: load, then load more | the second page is **appended**, not substituted, and the cursor is passed back byte-for-byte without being parsed (`hub-web/src/pages/activity.tsx:12-17`) | C | T3 | hub-api, activity |
| BJ-DSH-18 ★ | Activity feed: the third page fails | the first two pages stay on screen. A failed page that clears the feed is the failure | P | T1 | — |
| BJ-DSH-19 ★ | Activity with the service down: 200, `status: 'unavailable'`, `records: []` | the page says the feed was unavailable. **Rendering that empty array is how an outage reads as a quiet week** (`activity.tsx:19-23`) — this is the assertion | P | T1 | — |
| BJ-DSH-20 | Activity shows events from at least six different services | 05:552 makes six-service provenance the P6 exit criterion; the browser asserts the distinct `originating_service` values rendered | P | T3 | hub-api, activity, 6 producers |
| BJ-DSH-21 | Access page: entitlements and subscriptions in one panel | `active` and `confersAccess` are rendered as billing sent them; no date on the page is recomputed into a flag by the browser's clock (`hub-web/src/pages/entitlements.tsx:9-16`) | P | T1 | — |
| BJ-DSH-22 ★ | Search: a query matching nothing in the fetched page | the result says "showing matches from your recent history", **not "no results"** — `truncated` must be rendered, because a search that answers nothing when it means nothing-in-the-last-hundred has told the reader their transaction does not exist (`hub-web/src/pages/search.tsx:6-15`) | P | T1 | — |
| BJ-DSH-23 | Search with one of the four groups unavailable | that group degrades alone and the other three return results | P | T1 | — |

---

### 6.4 Group D — Forge Create
*Doc 05 §1.5, journey 7. Surface: `mint-web`.*

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-CRE-01 ★ | Anonymous visitor opens the catalogue | the catalogue renders one entry per entry in `GET /v1/catalogue` with its cost, **without a sign-in prompt** — the handler takes no principal and a catalogue behind a token cannot be browsed (`mint-web/src/pages/catalogue.tsx:4-6`) | P | T2 | mint |
| BJ-CRE-02 | Launch form: it opens an order and charges nothing | the sentence saying so is **above** the button. A form taking a wallet id and an owner address looks exactly like one about to spend money (`mint-web/src/pages/launch.tsx:4-6`) | P | T1 | — |
| BJ-CRE-03 ★ | Launch → `POST /v1/tokens` → the order page | the browser lands on the order, and the order state rendered is the state in the response | N | T3 | mint, identity |
| BJ-CRE-04 ★ | Press Deploy | the page renders **"accepted", never "deployed"**. `POST /v1/tokens/:id/deploy` answers 202 and a status URL; a screen that says deployed because a button returned tells a customer their contract exists at a moment when nothing has been broadcast (`mint-web/src/pages/token.tsx:12-23`) | P | T3 | mint |
| BJ-CRE-05 | The truth arrives by re-reading the order, not by the button's response | after the deploy job completes, a reload shows the deployed state and the chain facts | P | T3 | mint, indexer |
| BJ-CRE-06 | Buttons offered from the order's own state | on an order that is not `awaiting_payment`, there is **no pay button**; on one that is not `CLAIMABLE`, no deploy button. A button that will answer 409 has told the customer something false about what is possible (`token.tsx:25-29`) | P | T1 | — |
| BJ-CRE-07 | Pay twice under one intent | the second press replays: 200 rather than a second charge, and the page does not render `replayed` as an error | C | T1 | — |
| BJ-CRE-08 | Your launches list is capped at 100 with no cursor | the list **says it is capped** rather than offering a "next" button that cannot work (`mint-web/src/pages/tokens.tsx`) | P | T1 | — |
| BJ-CRE-09 | Public project page, no account | it renders for anybody with the address; a project page nobody can read without an account cannot do the one job it has (`mint-web/src/pages/project.tsx:3-6`) | P | T2 | mint |
| BJ-CRE-10 ⛔ | The ten-step launch flow of 05 journey 7 (brand kit → … → publish to Market → create a community) | each step is reachable from the previous one | N | T3 | only five of the ten steps have UI (§8.3) |
| BJ-CRE-11 | Mainnet is closed by default | the mainnet option is not offered as available; the allowlist refusal is rendered in words, not as a bare disabled control | P | T2 | mint |

---

### 6.5 Group E — Forge Market
*Doc 05 §1.7, journeys 8 and 15. Surface: `market-web`.*

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-MKT-01 ★ | Browse, anonymous | one card per listing in `GET /v1/listings`; the filter set offered is exactly the four the route reads, and there is **no search box** — the route reads no text query, and a box that filtered fifty rows client-side would imply an index that is not there (`market-web/src/pages/browse.tsx:3-6`) | P | T2 | market |
| BJ-MKT-02 ★ | One listing: four independent reads | with the risk call failing, the listing still renders and is still buyable; the page names what is missing rather than showing less and saying nothing (`market-web/src/pages/listing.tsx:12-15`) | P | T1 | — |
| BJ-MKT-03 ★ | Buy: the price breakdown before the button | platform fee and royalty split in bps are on screen before confirmation, and the total submitted equals the total shown | C | T3 | market, ledger |
| BJ-MKT-04 ★ | **Double-click Buy** | exactly one order. The `Idempotency-Key` is minted when the intent is formed and reused for every retry of that intent; a key minted per fetch means two clicks are two orders (`market-web/src/lib/idempotency.ts:12-16`) | C | T1 | — |
| BJ-MKT-05 | Buy: the service replays under the same key | the page reads back the **first** order and does not render `replayed: true` as an error (`idempotency.ts:17-19`) | P | T1 | — |
| BJ-MKT-06 | Buy: the same key with a different body → 409 `idempotency_key_reused` | this **is** rendered as an error, because it means the client sent two intents under one key — a bug here, not a fault the user can fix (`idempotency.ts:21-24`) | P | T1 | — |
| BJ-MKT-07 | Back-button after a confirmed purchase | the previous step does not re-arm a second submit against the settled intent | N | T1 | — |
| BJ-MKT-08 | Two tabs, one listing, both press Buy | exactly one order exists afterwards, and the losing tab shows the reservation refusal in words. The reservation is the lock (05:343) | C | T3 | market, ledger |
| BJ-MKT-09 ★ | Sell: create an `onchain` listing, then activate it, with the indexer **unavailable** | the page says "we could not confirm — wait", the 503 wording (`market-web/src/pages/sell.tsx:7-18`) | P | T1 | — |
| BJ-MKT-10 ★ | Same, but the index answers and the escrow is not confirmed (409 `state_conflict`) | a **different sentence, tone and suggested action** from BJ-MKT-09. The estate has already spent a release on a client that reported the two as one | P | T1 | — |
| BJ-MKT-11 | Sell: your own drafts are visible to you and to nobody else | the draft rows render on `/sell` and are absent from an anonymous `/` | P | T2 | market |
| BJ-MKT-12 | Orders: raise a dispute | the confirmation names the two facts that **are** visible to the parties — proceeds still held, listing frozen — and says plainly that the dispute's own state is not readable here. It must not invent a status (`market-web/src/pages/orders.tsx:7-18`) | P | T3 | market |
| BJ-MKT-13 | Orders: re-opening the page after a dispute | the page does **not** re-POST under the old key to scrape the stored response — a write dressed up as a read (`orders.tsx:16-18`) | C | T1 | — |
| BJ-MKT-14 | Collections index and one collection | both render anonymously; a collection behind a sign-in is a shopfront nobody can link to (`market-web/src/pages/collections.tsx:4-5`) | P | T2 | market |
| BJ-MKT-15 | Fees page | it makes **no request and cannot fail**, and it says the figures are the platform's stated position rather than the rate charged on any given sale (`market-web/src/pages/fees.tsx:3-8`) | P | T1 | — |
| BJ-MKT-16 | An auction listing with a leading bid | the leading-bid caveat is rendered beside the figure, not omitted | P | T1 | — |
| BJ-MKT-17 | A moderated (taken-down) listing | the moderation notice renders and the buy control is not offered; 05 journey 15's user-facing half | P | T1 | — |
| BJ-MKT-18 ⛔ | 05 journey 15 operator half: moderate a fraudulent listing with computed risk indicators | the indicators are shown as **facts, never as an editorial score** | P | T3 | no moderation UI in `admin-web` (§8.4) |

---

### 6.6 Group F — Forge Trade
*Doc 05 §1.6, journey 9. Surface: `trade-web`.*

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-TRD-01 | Strategy catalogue, anonymous | it renders without a sign-in prompt; `GET /v1/strategies` makes no `authenticate()` call and a product's front page is where a signed-out visitor arrives (`trade-web/src/pages/strategies.tsx:3-6`) | P | T2 | trade |
| BJ-TRD-02 ★ | Queue a backtest | the browser navigates to the **status page**, and the page says the run has not happened. `POST /v1/backtests` answers 202 (`trade-web/src/pages/new-backtest.tsx:3-6`) | N | T3 | trade |
| BJ-TRD-03 | Backtest status → report once complete | the report replaces the status only when the run reports complete, never on the 202 | P | T3 | trade |
| BJ-TRD-04 | Another customer's backtest id | the not-found screen, not a permission error — a 404 is the same answer as "no such run", so ids cannot be enumerated (`trade-web/src/pages/backtest.tsx:3-4`) | N | T3 | trade |
| BJ-TRD-05 | `/backtests/new` is routed before `/backtests/:id` | opening `/backtests/new` renders the form, not a detail view for an id called "new" (`trade-web/src/app.tsx:52-53`) | N | T2 | trade |
| BJ-TRD-06 ★ | Create a bot | it is created as a **draft**: the page states that nothing is reserved and nothing trades until start | P | T3 | trade |
| BJ-TRD-07 | Create the same bot twice under one intent | 200 on the replay, not a second bot | C | T1 | — |
| BJ-TRD-08 ★ | A **stopped** bot | there is **no start button**, and the page says why. Stop is terminal (`trade-web/src/pages/bot.tsx:20-22`) | P | T1 | — |
| BJ-TRD-09 ★ | A live bot started while the deployment kill switch is off | the button **is** offered and the 409 refusal is rendered in full. Hiding it would remove a feature nobody could file a bug against (`bot.tsx:23-28`) | P | T1 | — |
| BJ-TRD-10 | Pause a running bot | the page says pause is **not** a flatten and the position stays open, and the equity figure is labelled a mark from the last tick (`bot.tsx:30-33`) | P | T1 | — |
| BJ-TRD-11 | Bot list equity column | labelled a mark, not a settlement | P | T1 | — |
| BJ-TRD-12 | Fee settlements panel | one row per settlement and no duplicate settlement id — 05 journey 9's double-billing defect, asserted as presentation against the response | P | T3 | trade, billing |
| BJ-TRD-13 | Another customer's bot id | the not-found screen (owner-scoped 404) | N | T3 | trade |

---

### 6.7 Group G — Forge Worlds
*Doc 05 §1.6, §1.8, journey 10. Surface: `worlds-web`.*

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-WLD-01 ★ | The platform index with an **empty** title registry | it renders as a stated finding with citations — **never a spinner, a skeleton or an empty state implying something is on its way**. `{"titles":[]}` is a 200 and a true answer (`worlds-web/src/pages/platform.tsx:19-24`) | P | T2 | worlds |
| BJ-WLD-02 | The index is not two game cards | the page opens with what the platform owns; the registry is a section within it (`platform.tsx:5-17`) | P | T1 | — |
| BJ-WLD-03 ★ | Inventory: a `bound` item | **no sell control at all — not a disabled one.** A disabled button reads as "not yet, ask somebody", and this is never (`worlds-web/src/pages/inventory.tsx:16-20`) | P | T1 | — |
| BJ-WLD-04 | Inventory: an unbound item | the sell control is offered, and the sentence beside the item describes what it **is** and where it may go — never as an advantage (`inventory.tsx:21-23`) | P | T1 | — |
| BJ-WLD-05 ★ | Entitlements: an `unsupported` provision | the service's **own sentence, verbatim** (`provisions.last_error`), the word **UNDELIVERABLE** rather than "failed", a pointer to a refund, and **no retry control, not even a disabled one** — the retry route demands admin and could only 403 (`worlds-web/src/pages/entitlements.tsx:12-20`) | P | T3 | worlds |
| BJ-WLD-06 | Player profile is `null` | rendered as **a new player** — not an error and not a loading state (`worlds-web/src/pages/player.tsx:4-6`) | P | T1 | — |
| BJ-WLD-07 | A title page, anonymous | achievements and seasons render with no sign-in prompt; both routes are public (`worlds-web/src/pages/title.tsx:3-8`) | P | T2 | worlds |
| BJ-WLD-08 ⛔ | 05 journey 10: join a world, claim a homestead, complete an objective, see the reward in the Hub portfolio | the reward is visible in Hub **and** spendable in Market — the "one internal economy" test (05:553) | P | T3 | no join/objective UI (§8.3) |

---

### 6.8 Group H — Emberkin
*A Forge Worlds title, not a sixth product (`ui/packages/ui/src/surfaces.ts:397-420`). Doc 05
predates it entirely.*

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-EMB-01 ★ | Play: compose turns, submit the battle | the client posts **an intent** — an enemy and a list of turns — with an Idempotency-Key, and animates the log that came back. The browser must not compute an outcome (`emberkin-web/src/pages/play.tsx:5-11`) | C | T3 | emberkin |
| BJ-EMB-02 ★ | Play: submit the same battle twice | one battle recorded; the second is a replay | C | T1 | — |
| BJ-EMB-03 | Play: the whole battle is submitted at once | the screen does not fake an interactive round trip it cannot make (`play.tsx:15-17`) | P | T1 | — |
| BJ-EMB-04 | Play with WebGL unavailable | the page degrades to the non-WebGL path rather than blanking; `webglAvailable` is asked from its own module so the question does not statically import the renderer (`play.tsx:37-38`) | P | T1 | — |
| BJ-EMB-05 | Play with reduced motion preferred | the animation honours the preference | P | T1 | — |
| BJ-EMB-06 | Party: six Kin with Resonance, Temperament and Sync | each meter has its **effect written next to it**; a bar with no caption is not identity (`emberkin-web/src/pages/party.tsx:4-7`) | P | T1 | — |
| BJ-EMB-07 | Party is not editable | **no reorder, rename or move-to-box controls, and no disabled ones** — the page says so once rather than growing five dead buttons (`party.tsx:9-12`) | P | T1 | — |
| BJ-EMB-08 | Satchel is read-only, and says why | items are described as spendable **inside a battle**; there is no "use" button with nowhere to send the request (`emberkin-web/src/pages/satchel.tsx:3-11`) | P | T1 | — |
| BJ-EMB-09 ★ | Wardrobe: the cosmetics claim | "none of this changes a number" appears in the lede, under **every** item, and beside the season pass. A shop that hedges is a shop that expects to be asked (`emberkin-web/src/pages/wardrobe.tsx:5-15`) | P | T1 | — |
| BJ-EMB-10 ★ | Wardrobe: billing did not answer vs billing answered empty | **two different screens.** "We could not check what you own", with a request id, must never render as "you own no cosmetics yet" — a player who bought something yesterday will read it as a theft (`wardrobe.tsx:17-22`) | P | T1 | — |
| BJ-EMB-11 | Equip a cosmetic | the applied item changes no stat anywhere on the page | P | T3 | emberkin, billing |
| BJ-EMB-12 | Dex, anonymous | all fifty Kin render; the "seen" state is absent because it comes from the save (`emberkin-web/src/pages/dex.tsx:3-6`) | P | T2 | emberkin |
| BJ-EMB-13 | Credits page | it fetches `/art/MANIFEST.json` and renders **the manifest's own words** — the AI-generation disclosure is not paraphrased by the client (`emberkin-web/src/pages/credits.tsx:3-6`) | P | T2 | the bundle |
| BJ-EMB-14 | Settings: what this build is talking to | every host is resolved at runtime from `window.location.hostname`; no `VITE_` constant, no baked URL (`emberkin-web/src/pages/settings.tsx:3-8`) | P | T1 | — |

---

### 6.9 Group I — Aetherholm
*The third Forge Worlds title (`ui/packages/ui/src/surfaces.ts:421-442`). Doc 05 predates it.*

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-AET-01 | The map renders as plain SVG on three altitude rings | islands are click targets and each carries its label; no renderer dependency loads | P | T2 | aetherholm |
| BJ-AET-02 ★ | City view: stocks tick without a request | the projected number advances between repaints, **the network log shows no poll**, and the projection uses the same floor arithmetic as the server (`aetherholm-web/src/pages/cities.tsx:3-10`) | C | T2 | aetherholm |
| BJ-AET-03 ★ | City: a write answers | the server's settled stocks replace the projection immediately — the server is the truth the moment any write answers (`cities.tsx:9-10`) | P | T3 | aetherholm |
| BJ-AET-04 | Building and research forms | costs come from `GET /v1/content/buildings` and `/research` at runtime, never from a copy in this repo (`cities.tsx:12-16`) | C | T2 | aetherholm |
| BJ-AET-05 ★ | Fleets: the launch button before a preview exists | it is **disabled until a preview exists** — travel time each way, round-trip Aether lift, cargo hold — because the price tag is the rule (`aetherholm-web/src/pages/fleets.tsx:5-9`) | P | T1 | — |
| BJ-AET-06 | Fleets: the server's `aetherLift` disagrees with the preview | the fleet row shows the **server's** number; the preview was an estimate and the page treats it as one (`fleets.tsx:8-9`) | P | T1 | — |
| BJ-AET-07 | Fleets: double-submit a launch | one fleet, one idempotency key per intent | C | T1 | — |
| BJ-AET-08 | No battle is fought on the fleets page | the page shows the flight only; reports are read on Battles, by id (`fleets.tsx:11-14`) | P | T1 | — |
| BJ-AET-09 ★ | A battle report | rendered **from the store**, exactly as `GET /v1/battles/:id` returned it. This page holds no combat rules; a client that can resolve a battle can lie about one (`aetherholm-web/src/pages/battles.tsx:3-7`) | P | T2 | aetherholm |
| BJ-AET-10 ★ | Alliance: found one | the form asks for the id of a community that **already exists** and says where governance lives. **A "create community" button on this page is the failure** — it would be the second voting system the design forbids (`aetherholm-web/src/pages/alliance.tsx:3-11`) | C | T3 | aetherholm, community |
| BJ-AET-11 | Alliance directory | it lists the world with the caller's own membership marked | P | T3 | aetherholm |
| BJ-AET-12 | Chronicle, anonymous | sealed seasons render and **every read goes out with no token** — sending a credential to a route that does not read one is the defect (`aetherholm-web/src/pages/chronicle.tsx:5-8`) | C | T2 | aetherholm |

---

### 6.10 Group J — Forge Foresight, the player surface
*Doc 05 predates this product entirely. Surface: `foresight-web`. It has no `ProtectedRoute`:
resolution criteria are a contract with strangers and are readable without an account.*

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-FOR-01 ★ | **The page order is the argument.** Open one market | in document order: the question, the resolution criteria, the settling source, the close time and dispute window, why the market exists — and **only then** the pool and the stake form. A stake button above the terms is a signature line above a contract (`foresight-web/src/pages/market.tsx:4-11`) | P | T1 | — |
| BJ-FOR-02 ★ | **The house-seed disclosure is visible.** A market with a planned or placed house seed | the disclosure is **inside the pool panel, above the ratio bar, and therefore above the stake form**, as a sentence in running text at body size — not a chip, not an icon, not a tooltip (`foresight-web/src/components/houseseed.tsx:5-26`) | P | T1 | — |
| BJ-FOR-03 ★ | The house seed's sentence is the platform's own | it is rendered **verbatim** from `disclosure.sentence`; the client composes no wording of its own (`houseseed.tsx:60-62`) | P | T1 | — |
| BJ-FOR-04 ★ | The house seed fails its symmetry check | the panel renders as an **alert** (`role="alert"`), in the same shape as a document-hash mismatch, because it is the same kind of failure: the page saying something the numbers on it do not support (`houseseed.tsx:28-33`, `:50-56`) | P | T1 | — |
| BJ-FOR-05 | The service sends an explicit `null` disclosure | nothing renders — the one case where silence is correct, because no house money was ever planned. **Every other degradation still discloses** (`houseseed.tsx:41-43`) | P | T1 | — |
| BJ-FOR-06 | The share-of-pool and symmetry figures | re-derived in the browser from the pool numbers rather than repeated off the wire (`foresight-web/src/lib/houseseed.ts`) | P | T1 | — |
| BJ-FOR-07 ★ | Provenance is rendered | query, sources, model id, prompt hash and timestamp are on the market page. The pipeline records them so this page can show them; a page that dropped them makes the whole provenance apparatus decorative (`market.tsx:13-19`) | P | T2 | foresight |
| BJ-FOR-08 ★ | Stake panel: where the money goes | the panel **names the contract** and says in as many words that the stake is not sent to, held by, or refundable from CloudsForge (`foresight-web/src/components/stakepanel.tsx:3-9`) | P | T1 | — |
| BJ-FOR-09 ★ | Stake panel: the projection | the sentence saying the projection is only true if nobody stakes after you is present. It is the difference between a projection and a quote, and it is **not optional decoration** (`stakepanel.tsx:11-17`) | P | T1 | — |
| BJ-FOR-10 ★ | Stake: build the transaction with a stubbed EVM provider | the transaction the browser hands to the wallet carries the contract, the outcome and the amount shown on screen — byte-identical | C | T1 | — |
| BJ-FOR-11 | Stake: the user rejects in the wallet | a rejection is rendered as a rejection, not as a failure | P | T1 | — |
| BJ-FOR-12 | Stake: no injected provider at all | the panel says so and does not offer a button that cannot work | P | T1 | — |
| BJ-FOR-13 | Markets list: the filter set | exactly the seven statuses the service knows. A filter this page offered that the service did not know would be a 400 rendered at a reader who cannot act on it (`foresight-web/src/pages/markets.tsx:3-6`) | P | T2 | foresight |
| BJ-FOR-14 ★ | Portfolio by address, no account | `/portfolio/<address>` renders for a reader with no wallet, **every figure carries the instant it was observed**, the page carries the oldest of them, and a row that did not load says so instead of disappearing (`foresight-web/src/pages/portfolio.tsx:4-10`) | P | T2 | foresight |
| BJ-FOR-15 | Portfolio says it is a mirror | the caveat is on **every row**, not once at the top (`portfolio.tsx:4-11`) | P | T1 | — |
| BJ-FOR-16 | Claim panel on a resolved market | the claim path is offered against the contract, and the page states that a dead mirror does not stop a claim (`portfolio.tsx:7-8`) | P | T1 | — |
| BJ-FOR-17 ★ | Rules page, anonymous | the refusal list renders without a token. **A refusal list behind a token is a refusal list nobody can hold the platform to** (`foresight-web/src/pages/rules.tsx:4-8`) | P | T2 | foresight |
| BJ-FOR-18 | `/markets` on its own, and `/markets/a/b` | both render the not-found screen under a 404 — there is nothing at either address (`market.tsx:47-50`) | N | T2 | the bundle |
| BJ-FOR-19 | A market's settlement document hash mismatches | rendered as an alert, in the same shape as the seed symmetry failure | P | T1 | — |

---

### 6.11 Group K — Foresight operator console
*Surface: `foresight-admin-web`. Every route protected.*

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-FADM-01 ★ | The idea queue: a proposal whose sources have not been opened | the approve control **does not release**. The gate is `approvalGate`, a pure function so it can be proven to refuse rather than reviewed for whether it does (`foresight-admin-web/src/pages/queue.tsx:5-16`) | P | T1 | — |
| BJ-FADM-02 ★ | A model proposal with **no sources** | it **cannot be approved at all** — not a warning, a refusal. Nothing a model produces may open a market (`queue.tsx:5-7`) | P | T1 | — |
| BJ-FADM-03 | The sources are the loudest thing on each card | they precede the approve control in document order | P | T1 | — |
| BJ-FADM-04 | There is no per-idea address | `/ideas/<id>` is not a route; the queue holds all of them (`queue.tsx:18-22`) | N | T2 | the bundle |
| BJ-FADM-05 | Default market filter is `closed`, not everything | the front page opens on the one lifecycle state that is waiting on a person with money already in it (`foresight-admin-web/src/pages/markets.tsx:4-8`) | P | T2 | foresight |
| BJ-FADM-06 ★ | One market: decision order | question and criteria, then the named source, then the pool with its observation time and mirror caveat, then the actions — **the two reversible ones before the two irreversible ones** (`foresight-admin-web/src/pages/market.tsx:4-11`) | P | T1 | — |
| BJ-FADM-07 ★ | Resolve and Void are not two buttons in a row | they are two clearly separate blocks with different words. A console that renders them side by side is one where the difference between paying one side and refunding everybody is four pixels (`market.tsx:13-18`) | P | T1 | — |
| BJ-FADM-08 ★ | Void on a deployed market | the button is not offered, and **the resolve block says in words why** rather than leaving a disabled control for the operator to wonder about (`market.tsx:19-22`) | P | T1 | — |
| BJ-FADM-09 ★ | Resolve: the confirmation gate | the operator must write out a phrase naming the market and the outcome. "Are you sure?" has never once been answered no by somebody about to make a mistake (`admin-web/src/components/irreversible.tsx:14-19`, the shared pattern) | C | T1 | — |
| BJ-FADM-10 | Categories page has no controls | it is a reference an approver reads at the moment of decision; a rule an operator cannot find then is a rule they apply from memory (`foresight-admin-web/src/pages/categories.tsx:3-6`) | P | T2 | foresight |

---

### 6.12 Group L — the developer platform
*Doc 05 journey 12. Surface: `devportal-web`.*

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-DEV-01 | The platform index, anonymous | the scope catalogue renders for somebody who has not signed in and is deciding whether to (`devportal-web/src/pages/platform.tsx:3-5`) | P | T2 | devplatform |
| BJ-DEV-02 | The application directory and one listing, anonymous | both render with no credential (`devportal-web/src/pages/directory.tsx:3-6`) | P | T2 | devplatform |
| BJ-DEV-03 | Enrol an identity organisation | the enrolment screen **does not mutate in order to read** (`devportal-web/src/pages/organisations.tsx:5-8`) | C | T3 | devplatform, identity |
| BJ-DEV-04 | Create a project inside an organisation | owner or admin only; a member sees the refusal in words, not a 403 dump | P | T3 | devplatform |
| BJ-DEV-05 ★ | **Issue an API key** | the secret appears in a **modal** — `role="dialog"`, `aria-modal="true"`, focus moved into it on mount, a full-viewport scrim, and a focus trap (`devportal-web/src/components/once.tsx:29-31`, `:160-161`). A toast is the failure | P | T1 | — |
| BJ-DEV-06 ★ | The once-modal cannot be dismissed by accident | a click on the scrim, an `Escape`, or a click outside does not close it without the explicit acknowledgement | C | T1 | — |
| BJ-DEV-07 ★ | The once-modal's sentence | it says the credential **is live and nobody on Earth can tell you what it is** if the window closes — not "please copy this". There is no column the secret could be read back from (`once.tsx:14-26`) | P | T1 | — |
| BJ-DEV-08 | Reload after dismissing the modal | the key is listed, the secret is not, and the page does not offer a "show again" control | P | T3 | devplatform |
| BJ-DEV-09 | Revoke a key | the row shows revoked and its usage history is retained (05:385) | P | T3 | devplatform |
| BJ-DEV-10 ★ | **Rotate a webhook secret** | the once-modal again — this route returns a secret twice as often as any other in the service, and a retry without the idempotency wrapper mints a second one (`devportal-web/src/pages/webhooks.tsx:14-18`) | C | T3 | devplatform |
| BJ-DEV-11 | Rotate twice under one intent | one rotation, and the modal shows the first secret | C | T1 | — |
| BJ-DEV-12 | Register a webhook endpoint, then read deliveries and retries | the delivery list renders with each attempt's outcome | P | T3 | devplatform, notify |
| BJ-DEV-13 | Disable and delete a webhook endpoint | both are offered and both take effect on reload | P | T3 | devplatform |
| BJ-DEV-14 ★ | **Register an OAuth client** | the client secret goes through the once-modal, and the create call carries an `Idempotency-Key` — the route is wrapped and requires one (`devportal-web/src/pages/oauth.tsx:3-4`) | C | T3 | devplatform |
| BJ-DEV-15 | Quotas and usage | both render, and a quota **raise** is not offered — the direction is the authority (`devplatform/src/server.ts:981`, the rule `admin-web` cites) | P | T3 | devplatform |
| BJ-DEV-16 | Project shell fetches the project once | the five sections each fetch their own resource; opening a project does not fan out to five calls on mount (`devportal-web/src/pages/project.tsx:3-6`) | C | T1 | — |
| BJ-DEV-17 ⛔ | 05 journey 12's sandbox leg: resettable state and testnet wallets | a third party completes an integration against the sandbox from public documentation alone | C | T3 | no sandbox UI (§8.3) |

---

### 6.13 Group M — the operator console
*Doc 05 journeys 13, 14, 15, 16, 20. Surface: `admin-web`. Every route protected.*

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-ADM-01 ★ | The console bundle served from a **public origin** | it renders the misplaced-bundle screen rather than the console (`admin-web/src/app.tsx:40`) | P | T2 | the bundle |
| BJ-ADM-02 ★ | Anonymous browser on the console | a sign-in prompt, and **no operator content anywhere in the body** — this is the legacy suite's one security assertion and it is kept (`stack/infra/beacon/src/journeys/web.js:99-111` is the ancestor) | P | T2 | the bundle |
| BJ-ADM-03 ★ | **Four-eyes: the operator who raised the request opens it** | the decision controls are **replaced by a sentence naming that fact** — not disabled. A disabled control reads as "not yet" and gets clicked at (`admin-web/src/pages/approval.tsx:10-13`) | P | T1 | — |
| BJ-ADM-04 ★ | An **approved but unexecuted** request whose execution failed | the screen says "authorised, and the run failed", with the upstream's reason, and offers a retry **that does not need another signature**. Rendering it as "nothing happened" is how a third operator authorises what two already did (`approval.tsx:15-22`) | P | T1 | — |
| BJ-ADM-05 ★ | A request past its deadline but still reading `pending` | the deadline is **computed**, not read off `state`; the controls reflect the computed answer, because `decide()` answers 409 in that gap (`approval.tsx:24-26`) | P | T1 | — |
| BJ-ADM-06 ★ | Approve: the confirmation | the operator writes out a phrase naming **the request and the outcome** — "approve 3f2a1b9c ledger.entry.reverse" cannot be typed without reading which request and which way (`admin-web/src/components/irreversible.tsx:14-19`) | C | T1 | — |
| BJ-ADM-07 ★ | Approve: the order of the confirmation panel | consequences in **sentences**, then the audit rows the action will write, then the facts the decision turns on, then a rationale, then the phrase (`irreversible.tsx:14-17`) | P | T1 | — |
| BJ-ADM-08 | The gate refuses in every direction | wrong phrase, missing rationale, self-raised request, decided request — each refuses, and each says which. `confirmationGate` is a pure function (`admin-web/src/lib/gate.ts:87`) so the unit half is already testable; this is the rendered half | P | T1 | — |
| BJ-ADM-09 | Approvals queue with each filter | `state`, `action`, `requestedBy`, `limit` — each produces the rows the response contains | P | T3 | admin-api |
| BJ-ADM-10 ★ | Action catalogue including the blocked action | the blocked entry **and its reason** render, so the operator sees the 501 before hitting it (`admin-web/src/pages/actions.tsx:3-6`) | P | T3 | admin-api |
| BJ-ADM-11 | The reason-code list offered on a decision | exactly the closed list; no free-text reason field | P | T1 | — |
| BJ-ADM-12 ★ | **Audit: a truncation below a checkpoint** | the checkpoint findings render **separately** from the link findings, in words that distinguish them. An operator who reads "chain OK" after a truncation has been told something the chain alone cannot know (`admin-web/src/pages/audit.tsx:8-20`) | P | T1 | — |
| BJ-ADM-13 ★ | Audit: verification has **never run** | a **third answer**, not a green one. A verification that has never run is a control that is not running (`audit.tsx:18-20`) | P | T1 | — |
| BJ-ADM-14 ★ | Audit: one correlation id (05 journey 16) | one search returns every audit event across the services for that id, and there is **no free-text box over the payload** — a console offering a LIKE over `payload` table-scans the audit of record during an incident (`audit.tsx:24-30`) | P | T3 | admin-api |
| BJ-ADM-15 ★ | **Engagement treasury: there is no raise button** | it is **absent and explains itself**, not present and 403ing. A raise needs a two-operator approval and the schema trigger refuses it three ways (`admin-web/src/pages/engagement.tsx:17-25`) | P | T1 | — |
| BJ-ADM-16 | Engagement: lower a policy | the write goes down and takes effect; the transfer rows beside the balances say only **which approval** authorised each | C | T3 | admin-api, ledger |
| BJ-ADM-17 | Engagement balances come from the ledger | nothing on the screen is a number the console computed (`engagement.tsx:27-31`) | P | T1 | — |
| BJ-ADM-18 | Estate view with a dead upstream | it answers 200 and the tile names **which** upstream. The console that exists to be read during an incident has no failure mode in which the incident hides it (`admin-web/src/pages/estate.tsx:3-6`) | P | T1 | — |
| BJ-ADM-19 | Feature flags: set one | `enabled` must be boolean and `description` and `owner` are required non-empty; the form refuses locally with the same rules (`admin-web/src/pages/flags.tsx:3-6`) | C | T3 | admin-api |
| BJ-ADM-20 ★ | **Broadcast: publish an estate-wide notice twice** | one notice. The route requires an `Idempotency-Key` because a retry must not publish a second (`admin-web/src/pages/broadcasts.tsx:4-6`) | C | T1 | — |
| BJ-ADM-21 ⛔ | 05 journey 13: a stuck withdrawal, filtered `state=broadcast`, sorted by age, bump-fee or abandon with dual approval | the abandon path requires a reason code and two signatures | C | T3 | no withdrawals screen (§8.4) |
| BJ-ADM-22 ⛔ | 05 journey 14: a reconciliation drift alert freezes withdrawals for one asset, and one operator cannot override it | the freeze is visible and the override control is absent for a single operator | P | T3 | no reconciliation screen (§8.4) |
| BJ-ADM-23 ⛔ | 05 journey 16: a support agent answers "my balance is wrong" from the console alone | every read carries an audit record and a reason code | C | T3 | no support-lookup screen (§8.4) |

---

### 6.14 Group N — Forge Network: the site, the faucet, the explorer
*Doc 05 §1.3, §1.8.*

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-NET-01 | Network home | the status table is the **second block**, not a footnote; a reader who finds out at the bottom of the page has been misled by the layout (`network-site/src/pages/home.tsx:3-8`) | P | T1 | — |
| BJ-NET-02 ★ | Chain page | every number is fetched at render time **or is absent**. There is no third option (`network-site/src/pages/chain.tsx:4-5`) | P | T2 | the chain read |
| BJ-NET-03 | Chain page with the chain unreachable | figures are absent and the page says so; no stale or defaulted number is rendered as current | P | T1 | — |
| BJ-NET-04 | Mining page | the **caveats come before the instructions**, and that order is the point (`network-site/src/pages/mine.tsx:4-5`) | P | T1 | — |
| BJ-NET-05 | Node page | it states at the top that everything runs on one machine and offers no bootstrap list or peer to dial (`network-site/src/pages/node.tsx:3-8`) | P | T1 | — |
| BJ-NET-06 ★ | **Faucet: every number is the faucet's** | drip, cooldown, per-requester limit, window and remaining budget all come from `GET /v1/faucet`; there is no fallback set in the bundle (`network-site/src/pages/faucet.tsx:9-14`) | P | T2 | faucet |
| BJ-NET-07 ★ | Faucet with the service unreachable | the panel says the faucet did not answer and **the form is disabled** — a request posted into an unreachable service fails in a way that looks like a refusal, and a reader would read it as one (`faucet.tsx:14-17`) | P | T1 | — |
| BJ-NET-08 ★ | **Faucet: the form sends no amount** | there is no amount field and the request body carries `address` and `idempotencyKey` and nothing else. Every faucet that has ever been drained let the caller influence the amount (`faucet.tsx:19-24`) | C | T1 | — |
| BJ-NET-09 ★ | Faucet refusal (rate limited) | the message shown is **the limiter's, verbatim**. A second wording here would be a second thing to keep true, and the softer of the two is the one a reader would quote (`faucet.tsx:26-30`) | P | T3 | faucet |
| BJ-NET-10 | Faucet: double-submit | one drip, one idempotency key | C | T1 | — |
| BJ-NET-11 | Explorer index | a search box and **no API call at all** — there is no question yet (`explorer-web/src/pages/search.tsx:3-6`) | C | T1 | — |
| BJ-NET-12 | Explorer: paste a height, a hash and an address | each routes to the right two-segment scope path; the scope is two path segments everywhere (`explorer-web/src/app.tsx:21-25`) | N | T2 | indexer |
| BJ-NET-13 | Explorer: a `(chain, network)` the estate does not run | the **unknown-scope screen**, which names the five chains and two networks — not a generic 404. That is what turns a typo into a fix (`explorer-web/src/pages/unknown-scope.tsx:3-6`) | N | T2 | the bundle |
| BJ-NET-14 ★ | Chains page: ten scopes | one row per scope with the state its own index reports (`explorer-web/src/pages/chains.tsx:3-6`) | P | T3 | indexer |
| BJ-NET-15 ★ | **Transaction page: two reads, never crossed over** | the record supplies the facts and the confirmations answer supplies the verdict, and **the word "final" appears nowhere on the page** (`explorer-web/src/pages/transaction.tsx:9-20`) | P | T1 | — |
| BJ-NET-16 ★ | Transaction: 404 `transaction_not_found` vs 200 `confirmed: false` | **two different screens.** The caller separates them by the error **code**, never by the status. `micro-market` merged them and reported "escrow not confirmed" for every activation (`transaction.tsx:22-29`) | P | T1 | — |
| BJ-NET-17 ★ | Transaction: a **reverted** transaction at full depth | the status sits beside the depth at the same weight, and the verdict panel says which of the four inputs failed. A confirmation test that only counted blocks would tell a marketplace that a failed escrow deposit is confirmed (`transaction.tsx:31-36`) | P | T1 | — |
| BJ-NET-18 | Chain page: reorgs recorded | each reorg renders with its depth; a chain behind its tip states the lag rather than implying it is current | P | T3 | indexer |
| BJ-NET-19 | Address page | activity and token balances are two reads; one failing does not blank the other | P | T1 | — |
| BJ-NET-20 | Token page | supply and authorities are **as the contract reports them**, not as an order record claims (05:191) | P | T3 | indexer |
| BJ-NET-21 | Block page | height, hash and the transactions in it, from `GET /v1/blocks/...` | P | T3 | indexer |

---

### 6.15 Group O — the status page
*Surface: `status-web`. Public, pre-auth, redacted. No `ProtectedRoute` exists in the repository.*

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-STA-01 ★ | Current page, feed healthy | the verdict and **when it was observed** are above the fold, then anything currently broken, then the grid, then planned work — the reading order of somebody who has just been told the site is down (`status-web/src/pages/current.tsx:3-7`) | P | T2 | beacon |
| BJ-STA-02 ★ | **Nothing states a state without its observation time** | every state chip on the page has an `Observed` stamp beside it (`current.tsx:6-7`) | P | T1 | — |
| BJ-STA-03 ★ | The status feed itself is unavailable | the page renders the last good status **with its age**, and does not show green. An unknown is never a pass — beacon's own rule (`beacon/README.md:44-46`) | P | T1 | — |
| BJ-STA-04 | The feed has never been reachable | a third state again: no verdict at all, said plainly | P | T1 | — |
| BJ-STA-05 | History page | the window is **beacon's**, and the page says so rather than implying it is the complete history of the estate (`status-web/src/pages/history.tsx:3-6`) | P | T2 | beacon |
| BJ-STA-06 ★ | About page | it states what the page measures and **what it deliberately does not show**; the withheld list is on the page (`status-web/src/pages/about.tsx:3-6`) | P | T1 | — |
| BJ-STA-07 ★ | Nothing on the page identifies a service by its internal name | the product groups are the public names (`beacon/src/estate.ts:60-67`); a service name leaking to a pre-auth page is the failure | P | T2 | beacon |
| BJ-STA-08 | Uptime strip | one cell per day in the published window, and a day with no data is drawn as no data — not as green | P | T1 | — |

---

### 6.16 Group P — the marketing site

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-SITE-01 ★ | Home | four blocks in order — what it is, the loop, what you can do inside it, **and the state it is in**, on the home page rather than buried (`site/src/pages/home.tsx:3-8`) | P | T1 | — |
| BJ-SITE-02 ★ | Build-status page | it says **at the top** that none of it is running, then goes surface by surface. A crypto front door that implies everything on it is running is the failure this page exists to avoid (`site/src/pages/build.tsx:3-6`) | P | T1 | — |
| BJ-SITE-03 ★ | Products index and each product page | both are generated from the surface registry; the number of product cards equals `PRODUCTS.length` (`ui/packages/ui/src/surfaces.ts:587`). A hand-maintained card is the failure (`site/src/pages/products.tsx:3-6`) | P | T1 | — |
| BJ-SITE-04 | Platform page | the eleven "one platform" statements are published **in full**, including the ones not yet true (`site/src/pages/platform.tsx:3-8`) | P | T1 | — |
| BJ-SITE-05 | About page | the tie-breakers and the refusals come from the vision document, not from a copywriter | P | T1 | — |
| BJ-SITE-06 ★ | Terms and privacy | the notice saying the document is **incomplete** is at the top, and every undrafted section is drawn as a **visible hole** with a note saying what belongs in it (`site/src/pages/legal.tsx:3-6`) | P | T1 | — |
| BJ-SITE-07 | The product switcher | it renders every switcher surface for a signed-out reader and **hides the three `adminOnly` ones**; a signed-in operator sees all nine (`ui/packages/ui/src/index.tsx:246-258`). Hiding is not the boundary and the scenario asserts the menu, not the access | P | T2 | identity |
| BJ-SITE-08 | Every switcher entry has a glyph as well as an accent | colour is never the only channel (`ui/packages/ui/src/surfaces.ts:73`) | P | T1 | — |

---

### 6.17 Group Q — community and governance
*Doc 05 §1.9 and journey 11.*

**`micro-community` is built** — proposals, votes, delegations, tally, gating, executions, all with
tests (`community/src/`). **No frontend surfaces any of it.** A grep for `proposal`, `governance`
and `community` across all fifteen bundles returns only `aetherholm-web`'s alliance binding, which
deliberately does the opposite: it stores a `communityId` and says governance lives elsewhere
(`aetherholm-web/src/pages/alliance.tsx:3-11`).

So the whole of 05 journey 11 is uncoverable. It is specified here anyway, so that the scenarios
exist the day a surface does.

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-COM-01 ⛔ | Found a community with `kind=token_gated`, `join_policy=token_holding` | the treasury accounts under `community:<id>` are visible after creation | P | T3 | no UI (§8.5) |
| BJ-COM-02 ⛔ | Join; holdings verified; membership re-evaluated on a schedule | the grace period is stated on screen — membership never re-checked is not token-gating (05:370-371) | P | T3 | no UI |
| BJ-COM-03 ⛔ | Open a `treasury_spend` proposal | the `snapshot_block`, quorum and threshold are all rendered before a vote is offered | P | T3 | no UI |
| BJ-COM-04 ⛔ | Vote under each of the three weighting schemes | the weighting in force is named on the ballot, not inferred | P | T3 | no UI |
| BJ-COM-05 ⛔ | `passed → timelocked → executed` | the timelock is visible with its expiry; execution appears once and only once | P | T3 | no UI |
| BJ-COM-06 ⛔ | Platform governance is **not** tokenised | there is no platform-wide proposal surface anywhere. A platform holding customer money does not put custody policy to a vote (05:376-377) | N | T3 | no UI |
| BJ-COM-07 ⛔ | The Aetherholm alliance is bound to a community created elsewhere | the alliance screen never offers to create one (this one **is** runnable — it is BJ-AET-10) | C | T3 | see BJ-AET-10 |

---

### 6.18 Group R — cross-surface journeys
*This is the group that justifies a shared home. None of these can be expressed by a per-frontend
suite, because none of them happens on one surface.*

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-XS-01 ⛔★ | **One account signs into everything, once** (vision test 1). Sign in at Hub → switcher → Worlds → switcher → Market | no second credential prompt on either hop, and the same subject renders in the bar on all three | P | T3 | sign-in surface, identity, hub-api, worlds, market |
| BJ-XS-02 ⛔ | **One identity everywhere** (test 2). The profile created at registration renders in Market, Worlds and Community | the same handle and avatar on each; today the only renderable identity is a handle | P | T3 | sign-in surface + community UI |
| BJ-XS-03 ⛔ | **One wallet experience** (test 3). Arrive at the wallet from Worlds, from Trade and from Create | the same screen each time, at the same address — `wallet` is a `basePath` on Hub, not a host (`ui/packages/ui/src/surfaces.ts:346-365`) | N | T3 | wallet UI (§8.2) |
| BJ-XS-04 ★ | **One portfolio** (test 4). The total on Hub overview and the total on Hub portfolio | the two figures are equal and carry the same `pricedAt` | P | T3 | hub-api, ledger, pricing |
| BJ-XS-05 ★ | **One activity history** (test 5). Act in three products, then open Hub activity | all three actions appear in one feed, with at least six distinct originating services present | P | T3 | hub-api, activity, 6 producers |
| BJ-XS-06 ⛔ | **One internal economy** (test 6). Earn a reward in a world → spend it in Market → both legs on the activity timeline | the reward and the spend are two entries in one feed, and the balance between them reconciles | P | T3 | no world-objective UI (§8.3) |
| BJ-XS-07 ⛔ | **Assets created in one product usable in others** (test 7). A Studio brand kit becomes game content and a Market listing | the same asset id is rendered on both surfaces | P | T3 | no studio UI (§8.3) |
| BJ-XS-08 ⛔ | **One set of notifications, one preference page** (test 8) | changing a preference on one surface changes what is delivered. `notify` is not in the surface registry and has no UI (`hub-web/src/pages/settings.tsx:15-24`) | C | T3 | no notify UI (§8.6) |
| BJ-XS-09 ⛔ | **One operator view** (test 9). Answer a balance question from `admin-web` alone | see BJ-ADM-23 | P | T3 | no support-lookup screen |
| BJ-XS-10 ★ | The switcher's URLs resolve | every entry in the rendered switcher opens a surface that answers 200 on its index | N | T3 | all frontends |
| BJ-XS-11 ★ | The apex is derived, not configured | the same bundle addresses `localhost:<devPort>` from localhost and `https://<sub>.<apex>` from the apex, with **no rebuild** (`ui/packages/ui/src/index.tsx:140-158`) | C | T2 | two origins |
| BJ-XS-12 | An unknown subdomain prefix is left alone | a preview deployment at `pr-42.example.dev` is its own apex and its sign-in redirect does not go somewhere that does not exist (`ui/packages/ui/src/index.tsx:144-147`) | C | T1 | — |
| BJ-XS-13 ★ | Explorer deep links from Hub and Market | a transaction link from a wallet row and from an order both land on the explorer's two-segment scope path and render the transaction | N | T3 | hub-api, market, indexer |
| BJ-XS-14 | A Worlds title page links to its Market listings and back | both directions resolve | N | T3 | worlds, market |

---

### 6.19 Group S — the adversarial matrix
*Doc 05's Part 4 is the strongest section of that document and the weakest part of most browser
suites. This group is a **matrix**, not a list: six hazards applied to every form in the estate
that commits something.*

#### The hazards

| # | Hazard | The assertion, in general |
| --- | --- | --- |
| H1 | **Double-submit** — the commit control is pressed twice before the first response | exactly one effect. The idempotency key is minted when the intent forms, not per fetch |
| H2 | **Back-button after a confirmation** | the previous step does not re-arm a second commit against a settled intent |
| H3 | **Two tabs, one intent** | exactly one effect; the losing tab renders the refusal or the replay in words, never a stack trace |
| H4 | **The request fails after the optimistic UI moved** | the UI reverts to the server's state with a stated reason. A screen left showing the optimistic value is the failure |
| H5 | **Session expires mid-flow** | the re-authentication path, with the form's data preserved where it can be, and **no stale data left rendered as current** |
| H6 | **The upstream is degraded, not down** — slow, or 503 with a retry-after | the control is disabled with the reason, rather than left clickable into a service that will not answer |

#### The forms

Every one below was found by grepping for `<form`, `onSubmit` and `useMutation` across the fifteen
bundles. **Fifteen commit points exist in the estate today.** None of them is a withdrawal.

| id | Form | Repo | Hazards that apply | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-ADV-01 ★ | Buy / bid / offer | `market-web/src/pages/listing.tsx` | H1 H2 H3 H4 H5 H6 | T1 (H1-H4), T3 (H5) | market |
| BJ-ADV-02 | Create listing, then activate | `market-web/src/pages/sell.tsx` | H1 H3 H4 H6 | T1 | — |
| BJ-ADV-03 | Open a dispute | `market-web/src/pages/orders.tsx` | H1 H2 H4 | T1 | — |
| BJ-ADV-04 | Launch order | `mint-web/src/pages/launch.tsx` | H1 H4 H5 | T1 | — |
| BJ-ADV-05 ★ | Pay, then deploy | `mint-web/src/pages/token.tsx` | H1 H2 H3 H4 H6 | T1 | — |
| BJ-ADV-06 | Queue a backtest | `trade-web/src/pages/new-backtest.tsx` | H1 H2 | T1 | — |
| BJ-ADV-07 | Create a bot | `trade-web/src/pages/new-bot.tsx` | H1 H4 | T1 | — |
| BJ-ADV-08 ★ | Bot actions: start, pause, stop | `trade-web/src/pages/bot.tsx` | H1 H3 H4 H6 | T1 | — |
| BJ-ADV-09 | List an inventory item | `worlds-web/src/pages/inventory.tsx` | H1 H4 | T1 | — |
| BJ-ADV-10 ★ | Issue a key / register a webhook / rotate a secret / register an OAuth client | `devportal-web` (4 forms) | H1 H2 H3 H4 H5 | T1 | — |
| BJ-ADV-11 ★ | Stake | `foresight-web/src/components/stakepanel.tsx` | H1 H2 H4 H6 | T1 | — |
| BJ-ADV-12 ★ | Approve / reject an approval request | `admin-web/src/pages/approval.tsx` | H1 H2 H3 H4 H5 | T1 | — |
| BJ-ADV-13 ★ | Resolve / void / deploy / open a market | `foresight-admin-web/src/pages/market.tsx` | H1 H2 H3 H4 | T1 | — |
| BJ-ADV-14 | Approve / discard / edit an idea | `foresight-admin-web/src/pages/queue.tsx` | H1 H4 | T1 | — |
| BJ-ADV-15 | Set a flag / publish a broadcast / lower an engagement policy | `admin-web` (3 forms) | H1 H2 H4 | T1 | — |
| BJ-ADV-16 | Launch a fleet / claim an island / found or join an alliance / queue a building | `aetherholm-web` (5 forms) | H1 H3 H4 H6 | T1 | — |
| BJ-ADV-17 | Submit a battle / equip a cosmetic | `emberkin-web` (2 forms) | H1 H4 | T1 | — |
| BJ-ADV-18 ★ | Request a drip | `network-site/src/pages/faucet.tsx` | H1 H2 H6 | T1 | — |
| BJ-ADV-19 | Revoke one session / revoke all | `hub-web/src/pages/security.tsx` | H1 H3 H5 | T1 | — |
| BJ-ADV-20 ⛔★ | **Send** | does not exist | H1 H2 H3 H4 H5 H6 — all six | T1 | no UI (§8.2) |
| BJ-ADV-21 ⛔★ | **Key export** | does not exist | H1 H2 H3 H5 — and H2 is the dangerous one: a back-button that re-arms a reveal | T1 | no UI (§8.2) |

Each row expands to one scenario per applicable hazard, which is the arithmetic behind the count
in §10. BJ-ADV-01's six hazards are six scenarios: `BJ-ADV-01-H1` … `BJ-ADV-01-H6`.

#### Two hazards that are not in the matrix, because they are page-level

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-ADV-22 ★ | **Degraded, not down**: every read page with each upstream answering slowly rather than failing | the page paints inside its deadline with the slow tile marked pending, and no request is left hanging past the client deadline | P | T1 | — |
| BJ-ADV-23 ★ | **A request id is offered on every failure** | every failure state in every bundle that has one renders the request id to quote to support (the pattern in `hub-web/src/pages/security.tsx:288-291`) | P | T1 | — |

---

### 6.20 Group T — accessibility, as scenarios

14 §11 asks for axe on every route and every modal, failing on any serious or critical violation,
plus keyboard-only traversal of the send flow and the export ceremony. Neither of those two flows
exists (§8.2), so the keyboard scenarios are written against the four places in the estate where a
mis-tab **does** cost something today.

| id | Scenario | The assertion that fails if it breaks | A | T | Needs |
| --- | --- | --- | --- | --- | --- |
| BJ-A11Y-01 ★ | axe on **every route of every surface** — the ~80 addresses in §5, driven from each repo's own `ROUTES` module | zero serious or critical violations | P | T2 | the surface |
| BJ-A11Y-02 ★ | axe on every **modal and every confirmation panel** | zero serious or critical violations, with the dialog open and focus inside it | P | T1 | — |
| BJ-A11Y-03 ★ | axe on every **failure and degraded state** | a degraded tile is still announced; an error is not colour-only | P | T1 | — |
| BJ-A11Y-04 ★ | **Keyboard-only: the once-modal** (`devportal-web`) | focus moves into the dialog on mount, `Tab` cycles within it and never escapes to the page behind, and the acknowledgement is reachable and operable by keyboard alone. This is the estate's one irreversible reveal, so it is the send flow's stand-in | P | T1 | — |
| BJ-A11Y-05 ★ | **Keyboard-only: the irreversible-action gate** (`admin-web`, and the same component in `foresight-admin-web`) | the whole sequence — consequences, audit preview, facts, rationale, phrase, commit — is traversable and completable with the keyboard, and the commit control is not reachable before the phrase field is satisfied | P | T1 | — |
| BJ-A11Y-06 ★ | **Keyboard-only: the stake panel** (`foresight-web`) | outcome selection, amount, and the commit are all keyboard-operable, and the house-seed disclosure precedes the form in **tab order**, not only visually | P | T1 | — |
| BJ-A11Y-07 | **Keyboard-only: the faucet form** | address field and submit reachable; the disabled state when the faucet did not answer is announced, not merely styled | P | T1 | — |
| BJ-A11Y-08 ★ | Every chart has its table view | the table is reachable by keyboard and carries the same numbers. 14 §11 makes it both the accessibility fallback and the export path | P | T1 | — |
| BJ-A11Y-09 ★ | The house-seed panel is a live region | `role="status"` normally and `role="alert"` when symmetry fails, so a screen-reader user is told either way (`foresight-web/src/components/houseseed.tsx:50-56`) | P | T1 | — |
| BJ-A11Y-10 | Colour is never the only channel | every switcher entry, every state chip and every tone badge carries a glyph or a word as well as a colour | P | T1 | — |
| BJ-A11Y-11 | Reduced motion is honoured | `emberkin-web`'s battle animation, and any chart transition, respect `prefers-reduced-motion` | P | T1 | — |
| BJ-A11Y-12 | Skip-to-content and landmark structure on every surface | one `main` landmark, a reachable skip link, and a heading order with no level skipped | P | T1 | — |
| BJ-A11Y-13 ⛔★ | **Keyboard-only: the send flow** | 14 §11's named requirement | P | T1 | no UI (§8.2) |
| BJ-A11Y-14 ⛔★ | **Keyboard-only: the export ceremony** | 14 §11's named requirement | P | T1 | no UI (§8.2) |

---

## 7. What runs when

### 7.1 The continuously-run set

The scenarios `beacon` holds a browser open for, on its own schedule, against the deployed estate.
The rule for inclusion is beacon's own: **a journey is declared only if it exercises something,
and one that could only ever skip must not be declared at all** (`beacon/src/estate.ts:5-22`).

Applied to the catalogue, that filters twice — once for value, once for whether it can run today.
What survives is every scenario needing no sign-in surface and no missing UI:

| BJ-SITE-02 | the front door says what is running |
| --- | --- |
| BJ-CRE-01 | the Create catalogue is browsable anonymously |
| BJ-MKT-01 | the Market front door lists what the service returned |
| BJ-WLD-01 | the Worlds registry renders its emptiness as a finding, not a spinner |
| BJ-FOR-17 | the Foresight refusal list is readable without a token |
| BJ-STA-01 | the status page states a verdict with its observation time |
| BJ-STA-03 | the status page does not show green when its own feed is unavailable |
| BJ-ADM-02 | the operator console shows nothing to an anonymous browser |
| BJ-NET-06 | the faucet's numbers are the faucet's |
| BJ-NET-07 | the faucet form is disabled when the faucet did not answer |
| BJ-XS-11 | the same bundle resolves its hosts from the address bar |
| `BJ-<KEY>-404` ×15 | every surface answers 404 for an address it does not own |

**Twenty-six checks.** Everything else in the catalogue is a CI suite until §8.1 is closed. That is
the same position `micro-beacon` already takes about the five money journeys, and it is the safe
one in both directions.

### 7.2 The rest

| Trigger | Runs |
| --- | --- |
| Any PR in a frontend repo | that surface's T1 and T2 scenarios |
| Any PR in `ui` | every surface's T1 axe and visual-regression set — a design-system change is estate-wide by construction |
| Any PR in a service repo | nothing browser-level. The service's own tests own its rules (§3) |
| Nightly | the whole catalogue against the dev estate, sharded per §4.1 |
| Release candidate | every ★ scenario. The candidate does not promote until they are green |

---

## 8. What no scenario can cover, because the functionality does not exist

Forty-eight of the 318 scenarios are marked ⛔. They are specified rather than omitted, because a
scenario that exists and cannot run is a gap somebody can close, and an absent scenario is a gap
nobody can see. Each blocker below is a fact about the estate, not about this catalogue.

### 8.1 Nothing in the estate serves a sign-in page

**This is the largest blocker, and it blocks most of the ★ set.**

- Every SPA's sign-in is `signInRedirect()`, which sends the browser to
  `${accountUrl()}/login?return=…` (`ui/packages/ui/src/index.tsx:175-178`). `accountUrl()`
  resolves the `account` surface (`surfaces.ts:499-514`).
- **No repository in the working tree serves `/login`.** There is no `nimbus` directory among the
  58, and a grep for a `/login` route across all `*/src` returns only beacon's and conformance's
  *API* calls to `POST /auth/login`.
- `micro-identity` renders no HTML at all. Its 34 routes are JSON (`identity/src/server.ts:618`
  onward); the only `text/html` reference in the repository is a test asserting the shape of an
  `accept` header (`identity/src/server.test.ts:894`).
- The SSO callback compounds it: `consumeAuthCallback` posts the code to
  `${nimbus}/auth/exchange` (`ui/packages/ui/src/index.tsx:225`). **`micro-identity` has no
  `/auth/exchange` route** — it has `POST /auth/handoff` and `POST /auth/handoff/redeem`
  (`identity/src/server.ts:1043`, `:1051`). The shared UI and the identity service do not agree on
  the redemption route.

So the whole of doc 05 §1.1 and journey 2 is unrunnable in a browser, and so is every scenario
downstream of a session. `micro-beacon` can register and sign in over HTTP because it calls
identity directly (`beacon/src/estate.ts:144-226`); a browser cannot, because there is no page.

Two things have to land before BJ-ACC-01 can be written as code: a sign-in surface in the estate,
and agreement between `@cloudsforge/ui` and `micro-identity` on the exchange route. The second is
a defect independent of this catalogue and is worth raising on its own.

### 8.2 There is no wallet write surface anywhere

`hub-web/src/pages/wallet.tsx` contains no `<form>`, no `<button>`, no `onClick` and no mutation.
The Wallet page reads three tiles of `/v1/dashboard` and renders them. Consequently:

- **No Send flow.** 05 journey 4 — the flow with a policy gate, a fee quote, a confirmation step
  and a settlement state machine — has no UI. BJ-WAL-08..15 and BJ-ADV-20 are all blocked on this
  one absence.
- **No Receive flow.** 05 §1.3's receive screen, with the address, the QR and the confirmation
  policy, does not exist. BJ-WAL-16, BJ-WAL-17.
- **No key-export ceremony.** 05 journey 5 — "the most security-sensitive flow in the programme",
  ten stages, a 24-hour cooling-off and two MFA challenges — has no UI. BJ-WAL-18..20,
  BJ-ADV-21, BJ-A11Y-14.
- **No external-wallet connection.** 05 journey 6's challenge-nonce and per-scheme signature flow
  has no UI. BJ-WAL-21, BJ-WAL-22.
- **No MFA enrolment.** `micro-identity` serves six MFA routes (`identity/src/server.ts:1112-1222`)
  and `hub-web/src/pages/security.tsx` renders `mfaEnabled` as a fact but offers no enrolment,
  no recovery-code issue and no factor removal. BJ-ACC-15.

**14 §11 names exactly two flows for keyboard-only traversal — the send flow and the export
ceremony — and neither exists.** That is worth stating in those terms: the estate's own testing
strategy specifies accessibility coverage of two flows it has not built.

### 8.3 Product flows with a service but no screen

| Flow | Service exists | Screen |
| --- | --- | --- |
| Studio brand kits, 05 §1.5 step 1 | `studio/src/` | none — no `studio-web`, and no `mint-web` page fetches it. BJ-CRE-10, BJ-XS-07 |
| Joining a world and completing an objective, 05 journey 10 | `worlds/`, `nda/` | none. `worlds-web` is a registry and account surface; there is **no client for Ninety Days After** in the estate, though there is one for Emberkin and one for Aetherholm. BJ-WLD-08, BJ-XS-06 |
| The developer sandbox, 05 journey 12 | `devplatform/` | `devportal-web` has keys, webhooks, OAuth, usage and organisations, and no sandbox screen. BJ-DEV-17 |

### 8.4 Operator flows with no console screen

`admin-web` has eight routes: overview, approvals, actions, audit, engagement, flags, broadcasts
(`admin-web/src/app.tsx:46-114`). It has no withdrawals screen, no reconciliation screen, no
moderation screen and no support-lookup screen. So:

- 05 journey 13 (investigating a stuck withdrawal) — BJ-ADM-21.
- 05 journey 14 (a reconciliation drift alert) — BJ-ADM-22.
- 05 journey 15's operator half (moderating a fraudulent listing) — BJ-MKT-18.
- 05 journey 16 (a support request about a balance) — BJ-ADM-23, BJ-XS-09.

Note that 05 journey 13 itself says the equivalent today is reachable only by curl and "there is no
UI for it" (05:411-413). That remains true.

### 8.5 Community and governance have no surface at all

`micro-community` is built and tested — proposals, votes, delegations, tally, gating, executions
(`community/src/`). Nothing renders any of it. All seven BJ-COM scenarios are blocked, and so is
05 §1.9 in its entirety.

### 8.6 `notify` is not addressable from a browser

`notify` has no entry in the surface registry, so `cloudsforgeHosts()` cannot produce a URL for it,
and it is not one of hub-api's upstreams — which is why the notifications tile of every dashboard
is permanently `unavailable` (`hub-web/src/pages/settings.tsx:15-24`). Doc 05 §1.12 and vision test
8 (one set of notifications, one preference page) are therefore unrunnable. BJ-XS-08.

### 8.7 The environment cannot serve a browser yet

`deploy/compose/docker-compose.estate.yml` defines 22 domain services and **no frontend
container**. There is no compose file anywhere in `deploy/` that serves `hub-web`, `site` or any
other bundle, and `foresight`, `emberkin`, `aetherholm`, `faucet` and `beacon` are absent from the
estate file too — though the gateway config already routes to `http://foresight:4021`
(`deploy/gateway/dynamic/public-api.yml:193`), which is an upstream nothing brings up.

Until a compose profile serves the bundles behind the gateway, **no T3 scenario can run at all**,
including the eleven in §7.1. That is a smaller piece of work than §8.1 and it unblocks the most.

### 8.8 Two fixtures the catalogue needs and the estate cannot yet produce

- **A reorg** past the confirmation depth, for BJ-WAL-23 and BJ-WAL-24. 05:479 already makes a
  simulated reorg a P5 exit criterion; the browser scenarios consume the same fixture.
- **A `dashboard` response with each upstream individually failed.** This is the whole of BJ-DSH-02
  through BJ-DSH-10 and it is why they are T1: `hub-api` has seven degradation tests of its own,
  and the browser tier needs the *responses* those tests produce, captured as fixtures, not a live
  estate with services stopped one at a time.

---

## 9. Corrections to documents 05 and 14

### 9.1 14 §11, the bundle-boot row — corrected

The row read: *"Already covered by Beacon's `surfaceJourney`, which asserts the body rendered more
than 40 characters and collects console errors and failed requests"*, tool column "Beacon".

Every factual clause in it is true — of the **frozen legacy repository**. `surfaceJourney` is at
`stack/infra/beacon/src/journeys/web.js:19`; it asserts `text.trim().length > 40` at `:48-52`; it
calls `assertClean` over collected console errors and failed requests at `:53`; and it drives
`playwright-core` (`stack/infra/beacon/package.json:20`) through `stack/infra/beacon/src/browser.js`.
Doc 14's own §8 attributes it to `journeys/web.js`, which is the correct relative path.

**What was false was the word "Already".** `micro-beacon` declares six journeys, none of which
opens a browser (`beacon/src/estate.ts:360-367`), and has no browser dependency
(`beacon/package.json`). The row made one line of the frontend table read as done while nothing in
the estate being built covers it. It has been rewritten to say so and to point here.

### 9.2 14 §8's journey counts — dated, not wrong

"It already runs **24 journeys** across eight files (2,018 lines) — 19 defined directly and 5
through the `surfaceJourney` helper" reproduces exactly: eight journey files, 2,018 lines,
3 `chain` + 2 `crucible` + 3 `game` + 3 `identity` + 1 `mint` + 4 `pay` + 2 `platform` + 6 `web`
= 24. Every number checks out **against the frozen repository**. `micro-beacon` ships six. A note
has been added; the figures are not changed, because they are correct about the thing they
describe.

### 9.3 05's surface table — three corrections

`05:27-38` is the table this catalogue was built to extend, and three of its rows are wrong:

1. **"Identity screens | `identity` (server-rendered) | Login, register, forgot, reset, consent"**
   — false. `micro-identity` serves JSON only (§8.1). Nothing in the estate serves those screens.
2. **The table predates five surfaces**: `foresight-web`, `foresight-admin-web`, `emberkin-web`,
   `aetherholm-web` and `site`. Doc 05 lists ten surfaces; there are fifteen.
3. **"Forge Create | `mint-web` → `mint`, `studio`"** — `mint-web` does not call `studio`. No page
   in `mint-web/src/pages/` fetches a brand kit, and there is no studio surface (§8.3).

### 9.4 05:560 — the journey inventory

"24 journeys exist today in `infra/beacon/src/journeys/`" is accurate about the legacy path it
names, and stale as a statement about the estate. A note has been added beside it.

---

## 10. The catalogue in numbers

**318 numbered scenarios.** 303 in the tables above, plus the fifteen `BJ-<KEY>-404` rows (§5.1).
The adversarial matrix expands: its 21 form rows are one scenario per applicable hazard, so the
runnable case count is **373**.

| By tier | | | By status | |
| --- | ---: | --- | --- | ---: |
| T1 — nothing up | 169 | | Runnable against the estate as built | 270 |
| T2 — one surface | 47 | | ⛔ blocked on §8 | 48 |
| T3 — the estate | 86 | | ★ release-gate | 119 |

| Group | id | n | Doc 05 coverage |
| --- | --- | ---: | --- |
| Account and session | `BJ-ACC` | 16 | §1.1, J2, J21 |
| Wallet and withdrawal | `BJ-WAL` | 24 | §1.2, §1.3, J3, J4, J5, J6, J17, J18 |
| Dashboard, portfolio, activity | `BJ-DSH` | 23 | §1.4, §1.12, J19 |
| Forge Create | `BJ-CRE` | 11 | §1.5, J7 |
| Forge Market | `BJ-MKT` | 18 | §1.7, J8, J15 |
| Forge Trade | `BJ-TRD` | 13 | §1.6, J9 |
| Forge Worlds | `BJ-WLD` | 8 | §1.6, §1.8, J10 |
| Emberkin | `BJ-EMB` | 14 | — (postdates 05) |
| Aetherholm | `BJ-AET` | 12 | — (postdates 05) |
| Foresight, player | `BJ-FOR` | 19 | — (postdates 05) |
| Foresight, operator | `BJ-FADM` | 10 | — (postdates 05) |
| Developer platform | `BJ-DEV` | 17 | §1.11, J12 |
| Operator console | `BJ-ADM` | 23 | J13, J14, J15, J16, J20 |
| Network, faucet, explorer | `BJ-NET` | 21 | §1.3, §1.8 |
| Status | `BJ-STA` | 8 | — |
| Marketing site | `BJ-SITE` | 8 | — |
| Community and governance | `BJ-COM` | 7 | §1.9, J11 — all blocked |
| Cross-surface | `BJ-XS` | 14 | Part 5's eleven tests |
| Adversarial matrix | `BJ-ADV` | 23 → 78 | Part 4 |
| Accessibility | `BJ-A11Y` | 14 | 14 §11 |
| Per-surface 404 | `BJ-<KEY>-404` | 15 | — |

**Every one of doc 05's twenty-one journeys appears.** Nine are fully covered by runnable
scenarios (2, 8, 9, 10, 12, 15 partly, 19, 20 partly, and §1.4/§1.12's readable halves); the
remainder are specified and blocked, and §8 says on what.

### 10.1 Where to look for one thing

| Looking for | Read |
| --- | --- |
| everything that touches **withdrawal** | §6.2 (BJ-WAL-05, 08-15, 18), BJ-ADM-21, BJ-ADV-20, BJ-A11Y-13 |
| everything that touches **key material** | BJ-WAL-02, BJ-WAL-18..20, BJ-DEV-05..08, BJ-DEV-10, BJ-DEV-14, BJ-ADV-21, BJ-A11Y-04, BJ-A11Y-14 |
| everything that **commits money** | §6.19's fifteen forms |
| every **degradation** assertion | BJ-DSH-02..10, BJ-ACC-14, BJ-MKT-02, BJ-ADM-18, BJ-STA-03, BJ-NET-07, BJ-EMB-10 |
| every **idempotency** assertion | BJ-MKT-04..06, BJ-CRE-07, BJ-TRD-07, BJ-EMB-02, BJ-AET-07, BJ-ADM-20, BJ-DEV-11, BJ-NET-10, and every H1 in §6.19 |
| every **irreversible** moment | BJ-DEV-05..07, BJ-DEV-10, BJ-DEV-14, BJ-ADM-06..08, BJ-FADM-07..09, BJ-WAL-18 |
