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
| What runs | the six HTTP journeys, plus the **critical browser subset** marked ★ below | the whole catalogue |
| Where | the deployed monitor | CI, against the dev estate |
| Cadence | the leased schedule | on a release candidate, and nightly |
| Writes | `checks`, incidents, the public status projection | the run's artefacts only |
| Skips | a skip is not a pass, and blocks the gate | a skip is not a pass, and blocks the gate |

The ★ subset is small on purpose — twelve scenarios, listed in §7 — because every one of them
holds a browser open in production every few minutes. Everything else is a CI suite.

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
| ★ | In the continuously-run critical subset (§7) |
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
