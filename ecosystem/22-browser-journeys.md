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
