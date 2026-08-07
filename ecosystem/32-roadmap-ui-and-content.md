# 32 — Roadmap: UI and content

Written 2026-08-07.

**This is a plan, not a ledger.** [18-build-status](18-build-status.md) is the ledger: it records
what has been built and is corrected forwards rather than rewritten. This document records what
should be *written, worded and wired on the screens a stranger sees*, and every item in it is
outstanding work. Nothing here may be read as a statement that something has been done.

**How it was produced, so the reader can price the confidence.** All 66 directories in the working
tree were studied, one agent per repository, and every finding was then re-checked adversarially
against the source and — where the claim was about the live estate — against the deployed
hostnames with `curl`. Findings that did not survive that second pass were dropped or narrowed;
several of the narrowings are recorded inline below, because a corrected finding is more useful
than a deleted one. Where a claim rests on a measurement, the measurement's date is given. Where
something is not known, it says so.

This is one of three roadmap tracks written in the same session. The other two — completion (the
unwired integrations, the stubs, the deployment gaps) and ecosystem (the capabilities one
repository owes another) — are companion documents in this series. This track depends on both, and
says where.

---

## 1. The rules this track works under

These are constraints on the copy itself, stated first because every proposal below is bound by
them and because the most expensive mistake available on a marketing surface is a sentence that is
easy to write and impossible to check.

1. **No number goes on a page that is not checkable against something real.** A figure is
   admissible if it is read at runtime out of a response the page has already fetched, or if a test
   binds it to the source constant it describes. `site` already enforces this — the honesty block
   at `site/src/content/pages.ts:503-506` says "NOTHING here is stated as a number. The container
   count, the smoke-suite score and the chain height are all true right now and all three move
   hourly; a marketing page is the worst possible place to pin one." Three violations of this rule
   survive today and are listed in §4 and §5.
2. **Render a named hole, never a plausible screen over nothing.** An empty state says what is
   missing and why, and never renders `null` as `0`. This is the plane's best existing habit and
   nothing in this document weakens it.
3. **No invented metrics and no fake social proof.** No user counts, no "join N others", no uptime
   percentage that is not derived from a measured record, no "trusted by" anything. Nobody outside
   the project has used any of this yet (18-build-status.md:50), and a page that implies otherwise
   is lying about the one thing a reader cannot check.
4. **EMBER has no monetary value.** No market, no listing, no liquidity, no price
   (18-build-status.md:38, restated for both networks at :118-122). No copy may state or imply that
   EMBER is worth money, may be sold for money, or is priced at anything. Two surfaces currently
   break this and are the highest-priority items in this document.
5. **A claim that invites verification must carry the link that permits it.** "Reproduce this
   against your own node" with nothing to click is a request for trust dressed as a request for
   scrutiny.

---

## 2. The apex page

`cloudsforge.online` is the one address a stranger is most likely to be handed. Both apexes answer
200 and serve the same bytes: measured 2026-08-07, `https://cloudsforge.online/` and
`https://testnet.cloudsforge.online/` both return `/assets/index-B_xOKJbm.js`.

The page is well written. The problems are not prose quality — they are that the page's own
instruction has no button, that the footer quotes the flattering half of a two-part disclosure, and
that the testnet apex serves the mainnet page unmarked.

### 2.1 Copy, current beside proposed

| Slot | Current | Proposed | Why |
| --- | --- | --- | --- |
| Hero headline (`pages.ts:38`) | Mine EMBER on the computer you already own. | *unchanged* | It names the currency and the verb, and `test/content.test.ts` asserts EMBER appears in it. Do not touch it. |
| Hero verb line (`pages.ts:50`) | Then bet with it, trade with it, build with it and play with it — without leaving your account. | *unchanged* | |
| Hero standfirst (`pages.ts:64-65`) | Press start on the mining page and this computer begins earning EMBER — no card to buy, nothing to install. What you mine lands in one wallet, and that wallet is what you bet with, trade crypto with, launch a token with, buy and sell with, and play games with — the same account and the same wallet throughout. | *unchanged, but see the next row* | The sentence is an instruction. The page currently offers no way to obey it. |
| Hero primary CTA (`home.tsx:58-60`) | **See the 7 products** → `/products` | **Start mining** → `hosts().network` + `/mine` | The standfirst says "press start on the mining page". Today the reader must go `/products` → `/products/network` → the aside at `products.tsx:132` before reaching an outbound link. Three clicks and two page loads from the promise to the product. |
| Hero secondary CTA (`home.tsx:61-63`) | See what already works → `/build` | *unchanged* | |
| Hero third action | — | **See the 7 products** → `/products`, demoted to a plain link | Keep it; move the emphasis. The count is already derived by `productCount()`, so it stays admissible under rule 1. |
| Footer note (`shell.tsx:214-216`) | **Open to the public, and days old.** Everything described on this site is built, runs together against real databases and a real EMBER network, and now answers on the public internet under a proper certificate. An automated suite drives a real browser through the real gateway the way a person would, faking nothing. | **Open to the public, and days old.** What that does not mean: the main network is a few hundred blocks old, and EMBER has no market, no listing and no price. Nobody outside the project has used any of this yet. There are no user numbers on this page for the same reason there is no uptime figure — both would be either zero or invented. | The footer renders `BUILD.honesty.body[0]`, the reassuring paragraph. The denial is `body[1]` (`pages.ts:511`) and appears only on `/build`. So the home page invites a reader to mine EMBER and then, under a heading about honesty, tells them everything works — and never says the coin has no price. |
| Testnet banner | — (no environment awareness anywhere in `site/src`) | **This is the test network.** Everything here is a rehearsal — the coins are not the real ones and the chain is reset without notice. → *Go to the live site* | `site/src/content/stages.ts:213-217` already wrote the argument: "A reader told a product is 'Open to the public' and sent to a testnet address is being shown a rehearsal: throwaway money, a chain that gets reset, and nothing on the card that says so." The link must be registry-resolved; `pages.ts:6` forbids a typed hostname. |
| Capability item (`pages.ts:187-190`) | Mining that runs in a browser tab → *How mining works* → `/products/network` | Same body, two links: *How mining works* → `/products/network` and *Start mining* → `hosts().network` | This is the item a convinced reader clicks. It should be able to end the journey rather than extend it. |

### 2.2 Section order

Current order (`home.tsx`): Hero (:41) → Ember, the four steps (:82) → Capabilities, "Three things
worth knowing" (:117) → Products (:152) → Spans, "one account" (:195) → Closing (:222).

Proposed: Hero → Ember → **Products** → Capabilities → Spans → Closing.

The argument is that a reader who has just been told what EMBER is for should meet the seven things
it is for sale in before meeting three pieces of detail about how the platform is put together.
This is the least evidence-backed proposal in this document — it is an editorial judgement, not a
measurement, and it should be made only if the owner agrees with the reasoning. Everything else on
this page is a defect with a citation.

### 2.3 Effort

| Item | Effort |
| --- | --- |
| Hero CTA rework and the capability item's second link | S |
| Footer note switched to `body[1]`, with a test asserting the "no market, no listing and no price" string appears in chrome on every route | S |
| Testnet banner: `environment()` helper in `site/src/lib/hosts.ts`, `TESTNET_NOTICE` in `pages.ts`, rendered in `shell.tsx` above `<SiteNav />`, plus `test/hosts.test.ts` and `test/content.test.ts` cases | S |
| Section reorder | S |

The whole apex page is a day's work. It is the cheapest item in this document and the most visible.

---

## 3. Per-surface

Every frontend studied. "What a stranger sees today" is what was measured or read on 2026-08-07,
not what the code intends. "Highest-leverage change" is one item per surface, deliberately — a list
of twelve is a list nobody starts.

### 3.1 Public product surfaces

| Surface | What a stranger sees today | Highest-leverage change | Effort |
| --- | --- | --- | --- |
| `site` (apex) | A strong page whose instruction has no button, a footer quoting the flattering half of the disclosure, and an unmarked testnet twin serving identical bytes | §2 above, in this order: testnet banner, footer paragraph, hero CTA | S |
| `network-site` | `/mine` opens with "Three things this is not", whose third item says the browser miner cannot mine a block this node accepts — directly above the working browser miner. `/node` says the testnet is unreachable from outside and cites the dead two-label hostname scheme | Retire the two stale copy blocks at `copy.ts:464-470` and `copy.ts:537-541`, and add a `test/content.test.ts` assertion that no caveat denies a capability the same page renders a control for | S |
| `hub-web` | The one indexable address returns an empty body (`<div id="root"></div>`, measured), then a spinner reading "Taking you to sign in", then a page the surface forbids indexing | Static pre-hydration block inside `#root`: product name, the meta-description sentence, a sign-in link and a "What is CloudsForge?" link to the apex | S |
| `market-web` | `{"listings":[]}` on both networks; the empty state is honest ("Nothing failed to load. There is genuinely nobody selling anything right now") but its only action, "Be the first", is gated behind sign-in | Add a second, ungated action to the empty state (`/fees`, `/collections`) and render the three claims the surface can make without a number — money is held by the ledger, a fee is taken only on a completed sale, a dispute freezes the listing — reusing the existing strings | S |
| `mint-web` | A persuasive catalogue whose only CTA leads to a gated route with no warning; the catalogue says orders default to mainnet and the form hard-codes testnet | Say the account requirement at the point of the promise, and reconcile `catalogue.tsx:134-138` with `launch.tsx:50` in one direction or the other, with a test binding the two | S |
| `trade-web` | Ten strategy cards, ten identical CTAs that redirect anonymous visitors off-surface, and a front page that promises live bots while both deployments answer `{"liveTrading":{"enabled":false,…}}` on an unauthenticated route | Read `/v1/capabilities` on the index and render the engine's own `refusal` string verbatim next to the live-bot claim | S |
| `foresight-web` | Every market reports `total:"0"`, `lastBlock:0`, and the page says "Our copy has fallen behind the chain" in a `role="alert"` — a mirror that has never read a block described as stale | Branch `observation()` on `lastBlock === 0` and use the sentence already written at `market.ts:81`: "Nobody has read the chain for this market yet, which makes the figures below not known — not zero" | S |
| `devportal-web` | A page that names Foresight and account identity as bearer-token services above a live scope table containing neither, an empty directory that dead-ends, and no base URL or example request anywhere | Derive the service list from the fetched `/v1/scopes` response instead of hard-coding it, and print the runtime `apiBase()` with one worked request against `/v1/scopes` | M |
| `explorer-web` | A search box that cannot be used without something to paste; every current Ember block renders "Not one transaction from this block has been stored here" although `txCount` is 0 | Split the empty-block branch on `txCount === 0` so an empty block reads as a fact about the chain, and add a head-block link built from the `indexedHeight` the page has already fetched | S |
| `worlds-web` | A title page headed `dec039d0` — a UUID fragment — for a registry holding one DRAFT row with empty capabilities | Fetch `listTitles()` on the title page and render the name; keep `shortId(id)` as the fallback when the registry has no row | S |
| `emberkin-web` | `/` is behind `ProtectedRoute`, so the sitemap's first entry is a redirect. `/dex` shows fifty creature cards, no sentence saying what the game is, and an inert plain-text sign-in prompt | An anonymous front door reusing the starter lede verbatim (`starter.tsx:65-70`) plus the three starter portraits; make the `/dex` prompt a real button | M |
| `aetherholm-web` | The apex redirects to sign-in; the one public page, `/chronicle`, is empty because a season seals only after 120 days; `/battles` is public, fires an authed request, and renders "a valid bearer token is required" under a heading "Your battles" | Lift the four explanatory paragraphs at `map.tsx:164-182` into a shared component rendered on `/chronicle` and on the anonymous index; skip the `listBattles()` effect when there is no session | M |
| `tessera-web` | The Workshop tells sellers EMBER "is money, not points", promises withdrawal "the same afternoon", and anchors pricing at "around 400" Sparks. The front door lists 42 wards all named "Private Ward 178585xx" | Delete the three unbacked claims (§4.1). It is the most urgent copy change in the estate | S |

### 3.2 Operator surfaces

| Surface | What a stranger sees today | Highest-leverage change | Effort |
| --- | --- | --- | --- |
| `status-web` | A green "Operational" verdict above twenty groups each reporting "0.0% of 4 measured days came back clean · 86 days we never measured", and a hundred near-identical incident cards from one afternoon | Fix the underlying fold in `beacon` (§6), then render "Measured since {date}" ahead of the ratio and stop counting never-measured days as "days worth a look" | M |
| `beacon-web` | A blank white page under HTTP 200 if the bundle does not load: `index.html:182-185` is `<body><div id="root"></div><script …>` with no `<noscript>`, and the live document contains zero occurrences of the string | Add a `<noscript>` in this surface's own voice — silence must never read as calm — modelled on the one `status-web/index.html:147-152` already ships | S |
| `lantern-web` | Request ids render as inert `<code>`; the `/request` results table has no scroll wrapper, so a phone loses the sticky sub-nav; five empty states name a destination and offer no route to it | Pass the `action` slot the `Empty` component already accepts (`states.tsx:44`) at the two call sites whose hints name another page in the same app | S |
| `admin-web` | A warning banner naming a consequence that cannot happen in the state that triggers it — it tells the operator their account-portal URL is derived from the wrong apex, in the one state where it is not | Rewrite `shell.tsx:99-102` to describe the state that actually reaches it (served from another operator surface's origin, and therefore sharing that origin's storage), and pin each state to its screen in `test/hosts.test.ts` | S |

### 3.3 Wallet clients

These are not web surfaces and do not share the design system, but they are the estate's only
self-custody products and a first run is a first impression.

| Surface | What a stranger sees today | Highest-leverage change | Effort |
| --- | --- | --- | --- |
| `wallet-desktop` | First run defaults to `http://127.0.0.1:8555/`, which is not running, so the wallet shows "Chain not confirmed — the node did not answer", a balance of "—", and a Receive screen that withholds the address. `grep` of `src/` for `cloudsforge.online` returns nothing | A `NETWORKS` constant beside `DEFAULT_SETTINGS` offering the bundled node, `rpc-testnet.cloudsforge.online` (7412) and `rpc.cloudsforge.online` (7411), rendered as a radio group above the free-text fields — still probed via `eth_chainId` before it is stored | M |
| `wallet-mobile` | The same dead end with `127.0.0.1:8545`, which on a phone is never right; the welcome screen never says what Hearth is; the iOS `AppIcon.appiconset` contains only `Contents.json` | Two prefill buttons in Settings (never a default), plus one sentence on the welcome screen naming Hearth and EMBER with no claim about worth | S |
| `wallet-extension` | The Balance tab tells the user to add a token by contract address; no control anywhere can do it. Every chain record carries an `explorerUrl` no `.tsx` file mentions, so a broadcast hash is a dead 66-character string | Rewrite the tokens empty state to describe what the wallet does, render the already-persisted deployed tokens there, and add one `ExplorerLink` component wired at four sites | M |

### 3.4 What is not a surface

`ui` and `web-template` are the two spines and are covered in §4. The five asset repositories carry
957 assets with exact manifest/disk parity; their one UI-visible defect is that `lantern-web` ships
the apex brand set — its favicon is pixel-identical to `brand/assets/site/favicon-512x512.png` and
19.0% different from the Lantern mark that was designed, prompted and generated for it — plus an OG
card `brand/plan.ts:43` forbids outright for Lantern. Copying four files and deleting one closes
it.

---

## 4. The copy that must change first

Three items in §3 are not polish. They are the estate's own stated rules being broken on live
pages.

### 4.1 EMBER described as money with a price (tessera-web) — P1

`tessera-web/src/pages/workshop.tsx:53-57` reads: "Sell what you have made and you are paid in
Sparks — real EMBER, put there by the person who bought it. It is money, not points: take it out to
a wallet you control the same afternoon, spend it anywhere in the ecosystem, or mine more of it in
a browser tab." `workshop.tsx:209-212` adds: "A Spark is a millionth of an EMBER. Ordinary things go
for around 400 of them."

Three separate claims the estate refuses. "It is money, not points" asserts monetary value that
18-build-status.md:38 denies on both networks. "The same afternoon" is a settlement-timing
commitment nothing on this deployment measures. "Around 400 of them" is a price anchor with nothing
behind it — there is no distribution of sale prices for it to be near, because nobody outside the
project has used any of this. `world.tsx:155-157` carries a milder version of the first claim.

Proposed replacement for `workshop.tsx:53-57`:

> Sell what you have made and you are paid in Sparks — EMBER, credited to your account by the person
> who bought it. You can withdraw it to a wallet you control, spend it anywhere in the ecosystem, or
> mine more of it in a browser tab. EMBER has no market price.

And for `workshop.tsx:209-212`, keep the definition and delete the anchor:

> A Spark is a millionth of an EMBER.

The split table directly below already shows a seller exactly how any price they choose divides,
which is the honest version of the guidance the anchor was trying to give.

### 4.2 Copy that denies a working capability (network-site) — P1

`network-site/src/content/copy.ts:464-470` tells the reader "The browser miner cannot yet mine a
block this node accepts", in the section the page deliberately places *above* the instructions, and
directly above the browser miner mounted at `mine.tsx:81`. Measured 2026-08-07: a key from
`src/mining/account.js` got HTTP 200 from `https://rpc.cloudsforge.online/mining/template` with
`{"height":5040,"coinbasePub":…}`, and `hearth/node/src/block.js:45` verifies `powSig` against that
same `coinbasePub`. Both strings are in the deployed bundle.

The replacement must still be a caveat, because one is owed: the miner submits work the node
accepts, but a block lands only if the nonce wins before the template goes stale, and nothing here
promises a laptop wins one. The section heading is "Three things this is not"
(`copy.ts:439`) — either promote a real open item to keep the count, or drop the numeral so the
section is not arithmetic-bound.

`copy.ts:537-541` is the same failure in the other direction: it says the testnet "is unreachable
from outside", contradicted inside the same repository by `facts.ts:90` and measured directly —
`POST eth_chainId` to `https://rpc-testnet.cloudsforge.online` returns `{"result":"0x1cf4"}`. The
`/node` contribute note additionally re-publishes the retired `<surface>.testnet.<apex>` scheme as
current. A `test/content.test.ts` scan forbidding "unreachable" and "two labels" beside the word
testnet, in the shape of the existing forbidden-word scans, stops it being retyped.

### 4.3 Numbers with nothing behind them — P2

Three survive. Each is small; together they are the rule.

| Where | The number | Fix |
| --- | --- | --- |
| `foresight-web/src/pages/markets.tsx:75` | "Seven currencies and every token minted on the platform are accepted." The lede one card above names six, and the seventh is only reachable by counting SHARD, which `isRetiredAsset` refuses | Delete the numeral; enumerate from the `/stake-assets` response the page can already fetch, or say "the currencies listed on any market page" |
| `devportal-web/src/pages/platform.tsx:137` | `<h2>Two limits worth knowing before you start</h2>` above `{KNOWN_GAPS.map(…)}`. The array has already shrunk once — `devplatform.ts:1242-1251` records a third entry deleted when it was closed | Drop the numeral: "Limits worth knowing before you start" costs nothing. Render the section only when the array is non-empty |
| `trade-web/src/pages/strategies.tsx:37` | "Ten trading rules, every one of them implemented here." True today — `/v1/strategies` returns exactly 10, measured — and pinned by no test, while the fee and slippage figures on the same page are pinned | Prefer removing the claim over guarding it: "Every trading rule here is implemented and measured by the same engine", with the rendered card count as the only statement of quantity |

---

## 5. The design system work this requires

Sixteen frontends share `ui/packages/ui` through `link:../ui/packages/ui`, and sixteen carry a copy
of `web-template`'s `src/lib/obs.ts` byte-identically. Both spines spread by copy rather than by
version, which is why a fix travels badly and a defect travels perfectly. Everything in §3 that
appears on more than one surface belongs here rather than in the consumers.

### 5.1 A sign-in intent panel — the one new component

Six public front doors end in the same call. `ui/packages/ui/src/index.tsx:342` defines
`signInRedirect()` as an immediate `window.location.assign`, and the identical template-copied call
site exists in `market-web`, `mint-web`, `trade-web`, `devportal-web`, `emberkin-web` and
`aetherholm-web` — same line, same shape, six repositories. The destination is live; this is not a
broken link. It is that six independently written landing pages each end by throwing the reader at
another hostname before any of them has said what an account is for.

The component: names the surface, states what the account unlocks, states what the reader can still
do without one, and only then calls `signInRedirect`. It replaces six bespoke `LoadingGate`
captions reading "Taking you to sign in".

Alongside it, a `web-template` journey assertion: every route declared public in `routes.ts` must
render at least one in-surface action for a signed-out visitor. That turns the rule into a
mechanical property instead of six editorial decisions.

### 5.2 Suppressible OG image

`ui/packages/ui/src/seo.ts:167` reads `image: page.image ?? DEFAULT_OG_IMAGE` and the emitter has no
branch, so every surface advertises a card. Measured 2026-08-07:
`https://admin.cloudsforge.online/og-1200x630.png` and
`https://beacon.cloudsforge.online/og-1200x630.png` both 404, while the other surfaces return 200.
The 404 is correct and deliberate — `brand/plan.ts:43` forbids an OG card for Admin, Lantern and
Beacon — and both consumers wrote a paragraph accepting the defect because the shared module gave
them no way to say "no card".

Widen `image` to `string | null`; skip both image tags when it is null; have `applyHead` *remove* a
previously written tag rather than leave the last page's value. Then delete the two acceptance
paragraphs. The shape is what matters: two consumers independently accepted a defect because the
spine offered no affordance, and the next surface without a card would have done the same.

### 5.3 The sitemap scheme

Fourteen nginx configurations build sitemap and robots URLs from `$scheme://$host`. TLS terminates
upstream, so `$scheme` inside the container is always `http`, and each surface's own passing
`sitemap.test.ts` asserts the `http://` form — the test defends the defect. The fix is one `map`
over `$http_x_forwarded_proto` in the template, propagated to fourteen repositories, and fourteen
test edits in the same commit. It is mechanical and it is the clearest illustration of how these
spines propagate: the `useResource` deps fix was made in nine consumers and never returned to
`web-template` at all.

### 5.4 Empty-state actions

The `Empty` component accepts an `action` node. In `devportal-web` not one of nine call sites passes
it; in `lantern-web` not one of five. Two of `lantern-web`'s hints name another page in the same
application in prose. This is not a component change — it is an audit of every `Empty` call site in
the plane, with the rule that an empty state which names a destination must link it, and one that
has no honest destination must say so instead.

### 5.5 Distribution, which is the real constraint

`ui`'s `version: 1.1.0` is decorative while the specifier is `link:`, no CI job in `micro-ui`
compiles a single consumer against a change, and the footer-adoption audit script needs Chromium
plus a running estate so nothing runs it. None of that is fixed by this track and all of it decides
how long §5.1 to §5.4 take to reach twenty repositories. It is a completion-track item; it is named
here because it is the multiplier on everything above.

---

## 6. The onboarding funnel

### 6.1 The sequence, as it should be

1. A stranger arrives at `cloudsforge.online` from a link or a search result.
2. The hero tells them they can mine EMBER on the machine they are holding, and offers one button
   that starts it.
3. They land on `network.cloudsforge.online/mine`, generate a mining key in the browser, press
   start, and watch the tab hash. **No account has been required yet, and this is the estate's one
   genuinely distinctive first action.**
4. Having mined, they want somewhere to put it. The mining page offers a wallet — the self-custody
   client, which needs no account, or the custodial hub, which does.
5. If they choose the hub, they create a CloudsForge account, verify an email, and sign in once.
6. That one account then opens Market, Create, Trade, Foresight and the games, and the sign-in
   intent panel of §5.1 tells them so before it sends them anywhere.

### 6.2 What must be built for that sequence to exist

| Step | Blocker | Owner |
| --- | --- | --- |
| 2 | The apex hero has no outbound link at all; `grep` for `href=` and `hosts()` in `site/src/pages/home.tsx` returns nothing | this track, §2 |
| 3 | `/mine` opens by telling the reader the miner cannot mine a block the node accepts | this track, §4.2 |
| 5 | **A live registration cannot be completed.** See §6.3 | completion track |
| 6 | Six front doors bounce an anonymous visitor off-origin with no interstitial | this track, §5.1 |
| 6 | Every destination is empty: `{"listings":[]}` on both networks, an empty developer directory, one DRAFT row in the Worlds registry, `total:"0"` on every Foresight market | completion track (the Engagement Treasury is designed and switched off) |

### 6.3 Step 5 does not work, and the funnel has no first step until it does

The completion track records that no account created in production can currently be signed into.
Identity creates the account and refuses sign-in until an email is verified; the verification
message usually never arrives. Traced on the host 2026-08-07: the link itself is fine —
`IDENTITY_ACCOUNT_URL` is correct on both networks and points at hub-web's `/account/verify`. What
fails is delivery. **`beacon` registers ~95 throwaway accounts an hour at `@beacon.test`**, a
domain that cannot receive mail, which exhausts the 250/day Mailtrap tier so a real visitor's mail
returns `SMTP 535`; and testnet has no SMTP channel at all. Across both networks 4,483 verification
tokens have been issued and **none has ever been consumed**, so the `/account/verify` page has
never once been exercised by a real click and cannot be assumed to work. See 30 §A1, whose second
correction supersedes an earlier `NOTIFY_PUBLIC_URL` diagnosis. The documented operator fallback —
"the operator hands the link over from the console" — has no console: `listPendingResets` is
exported and called by nothing, and there is no equivalent for pending verifications.

**Stated plainly: as of 2026-08-07 a stranger cannot create a working CloudsForge account.** Every
copy improvement in §2 to §5 makes the path to that wall shorter and better lit. None of them moves
the wall. Sequencing follows from that:

- The mining path (steps 1-4) requires **no account** and can be finished entirely within this
  track. Do it first. It is the only complete stranger-to-first-action journey the estate can
  currently offer, and it is two days of work.
- Everything downstream of step 5 is worth writing but not worth *shipping as an invitation* until
  registration completes. A CTA that ends in an undeliverable verification email is worse than no
  CTA.

There is one unresolved fact in this area that should be checked before the funnel work starts, not
during it. Measured 2026-08-07: `https://hub.cloudsforge.online/account/login` answers 200, and
`https://account.cloudsforge.online/login` answers 404 — the latter is a recorded estate fact
(05-user-journeys.md:38). Different surfaces resolve the sign-in destination differently. Which
value a given bundle's `accountUrl()` produces must be measured per surface before six front doors
are pointed at it.

---

## 7. Repository prose

Not user-facing, and included because in this estate the README is what the next agent reads before
it touches anything, and a wrong number in an otherwise precise document costs more trust than a
vague one. Each of these is small and independently verified.

| Repository | The claim | The fact |
| --- | --- | --- |
| `activity` | README.md:131 "Three migrations" | `src/migrations.ts` declares versions 1, 2, 3 and 4; `SCHEMA_VERSION` computes to 4 and `src/index.ts:56` asserts it at boot |
| `admin-api` | README's Gaps section: identity's role-grant route "does not exist"; the service token lacks `identity:admin`; deploy still owes the `/v1/events` subscriptions | `identity/src/server.ts:1772` defines the route (and README.md:96 in the same file says it landed); `docker-compose.estate.yml:871` grants the scope; `estate-bootstrap.sh:981` seeds the subscriptions |
| `admin-api` | The route table stops at the health routes | Seven backup and restore routes are defined and called by `admin-web`; a quarter of the surface is undocumented, including the confirmation-string requirement on `POST /v1/backups` |
| `identity` | README's route table is "read out of `src/server.ts`" | The four machine-credential routes — the first thing any new service must call — are absent; `estate-web.yml:863` also counts "34 unversioned routes" where the real count is 43 |
| `ledger` | README.md:153 "versioned migrations 1–11"; attribution "is only as good as what each caller passes in" | `SCHEMA_VERSION` is 14 and `retired_assets` exists; `src/server.ts:698` has 403'd a mismatched `originatingService` since the 2026-08-04 incident |
| `notify` | README.md:141 "Nothing is deployed"; `devplatform.*` "is not a registered topic" | The estate compose builds notify and notify-migrate with a healthcheck; `contracts/packages/events/src/index.ts:859` registers `devplatform.key.issued` |
| `aetherholm` | README.md:278 says `-web` and `-assets` do not exist; heraldry has no consumer | Both repositories exist and `-web` is routed live; `worlds/src/server.ts:453` handles the topic |
| `studio` | The Routes table omits five routes | Four repositories integrate against them and each carries a long local comment reconstructing behaviour the README does not state; two of those comments are themselves stale |
| `hearth` | `MAP.md` §10 says mainnet "holds zero transactions" and is "hours old" | Measured 2026-08-07: nonce `0xb` on the miner address, height `0x13fa`, block 1 at 1785870741 — three days. **`MAP.md:77` "Any deployed contract of record — still none" is accurate and must stay**: `eth_getCode` on the Foresight treasury address returns `0x`, because it is an EOA |
| `docs` | `ecosystem/README.md` summarises 27 as finding that no service image is published, calls both cloud targets arm64, and calls 03 "The 46 repositories" | 27 is titled "Fixed" and verifies three tags anonymously pullable; 27:297-314 warns the published images are amd64 only; 18 §1 counts 48 targets and 58 directories |
| `docs` | 18-build-status.md:191 records contracts as four packages and 176 tests | Measured 2026-08-07 by running the suite: five packages, 259 tests, 0 failures. `contracts/packages/README.md` already drafted the replacement sentence and could not apply it, because it does not own this repository |

The `docs` rows matter more than their size. Corrections in this estate land at the top of the
newest document and never propagate back to 02, 05, 06, 08 or 16 — which is exactly where the index
tells a newcomer to begin. A grep gate in CI over the fixed strings that keep recurring
(`X.testnet.cloudsforge.online` outside a correction block, "mainnet is not launched", "all 32
repositories") is the cheapest guard available and does not exist.

---

## 8. Two things this track cannot fix

**The empty room.** Every surface in §3 is finished and empty. The market has no listings, the
directory no applications, the Worlds registry one draft row, every Foresight market
`total:"0"`, Tessera's front door 42 identically named test wards. The estate designed the cure —
the Engagement Treasury, described in [21-engagement-treasury](21-engagement-treasury.md) as the
answer to every empty room's cold start — and has not switched it on. Better copy over an empty
room is better copy over an empty room. Where a surface is empty, the honest empty state is the
deliverable, and every proposal above respects that.

**The public status page.** `status.cloudsforge.online` currently reports every one of twenty
product groups as out for four consecutive days while the estate was serving 30/30 HTTPS 200s.
The cause is in `beacon/src/publicstatus.ts:408-430` — a day is `outage` if anything was down in
it, folded as a boolean over every probe check in the day. No amount of rewording in `status-web`
fixes a renderer that is faithfully rendering a wrong document; the fold must become a ratio first.
It is the estate's only public trust artefact, and it is the single worst thing a stranger can
currently be shown.

---

## 9. Order of work

1. **tessera-web's three money claims** (§4.1). Half a day. It is the only place in the estate that
   tells a reader EMBER is money and quotes a price.
2. **The apex page** (§2). One day. Testnet banner, footer paragraph, hero CTA.
3. **network-site's two stale copy blocks** (§4.2). Half a day, plus the forbidden-word test.
4. **The three unbacked numbers** (§4.3). An hour each.
5. **The beacon fold and the status strip** (§8, §3.2). The public trust artefact.
6. **The sign-in intent panel and the public-route journey assertion** (§5.1), then roll it into six
   front doors.
7. **Everything else in §3**, cheapest first — the four `S` items in the operator table close four
   defects in a day.
8. **The README corrections** (§7), in one pass, because they are read by whoever does items 1-7
   next time.

Items 1 to 4 are entirely within this track, need nothing from any other repository, and take about
three days. They are also the four items where the estate is currently saying something untrue on a
live page, which is why they come before anything that makes a page more attractive.
