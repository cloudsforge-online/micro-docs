# 15 — Monetisation model

What CloudsForge charges for, what it must never charge for, and why. This document is the
commercial half of [01-product-vision.md](01-product-vision.md) §5–6: the vision states that
the spine is free and that "do not sell what cannot be delivered" is a principle; this states
what that leaves as revenue, at what price, in which phase, and what each price costs in trust.

Every current-state claim below is cited to source. The prices that already exist are recorded
as they are, not as they should be, and where the two differ that is called out rather than
quietly corrected.

---

## 1. The principle: the spine is free forever

[01](01-product-vision.md) §6 rejects "monetising the spine". This is not modesty, it is
arithmetic. The spine — accounts, wallets, transfers, key access, activity history, portfolio,
notifications — is the thing that makes eight products one platform. Its value is entirely in
being *ubiquitous*: test 4 in [01](01-product-vision.md) §2 ("one portfolio — a single number
that is the truth about what you hold") is false the moment some balances sit behind a paywall.
A metered portfolio is not a portfolio, it is a report.

There is a second, harder reason. A custodial platform's only real product is the belief that
your money is where it says it is. Every charge levied on *getting to your own money* trades
that belief for revenue at a terrible rate: the fee is small and recurring, the loss of trust is
large and permanent.

So the boundary is drawn once, here, and it is a boundary of **kind**, not of size:

> **The platform charges for work it does on your behalf, and for access to markets and
> capacity it operates. It never charges for custody, for movement, or for exit.**

Everything in §3 is work or access. Everything in §4 is custody, movement or exit.

**Free forever, with no usage cap and no premium tier:**

| Capability | Where it lives | Why free |
| --- | --- | --- |
| Account, profile, SSO across every product | `identity` | Charging for an account is charging for the ability to be a customer |
| Managed wallet provisioning, any chain, any number | `wallet` + `custody` | A wallet is a container for money we already hold. Renting the container is a hostage fee |
| Deposits, including detection and crediting | `indexer` + `wallet` | Charging to receive money is charging for the privilege of funding us |
| Internal transfers between CloudsForge accounts | `ledger` | A ledger posting costs microseconds. A fee on it exists only to be a fee |
| Withdrawal, less pass-through network cost | `settlement` | §4.1 |
| Private-key and recovery-phrase export | `custody` (AD-13) | §4.2 |
| Portfolio, balances, valuation | `hub-api` + `ledger` + `pricing` | Test 4 |
| Unified activity history, unlimited retention | `activity` | Test 5 |
| Notifications on all channels | `notify` | §4.3 |
| Backtesting, the full strategy catalogue, paper trading | `trade` | Already free and already stated in source: "Crucible is free until it makes you money" (`crucible/packages/contracts/src/index.ts:773-779`) |
| Everything on testnet | all | §4.6 |
| Block explorer, node software, mining, faucet | Forge Network | A public chain whose explorer is paywalled is not a public chain |

---

## 2. Where revenue actually comes from

Four surfaces, in descending order of how defensible each is:

1. **Work with a marginal cost** — a token deployment burns gas; an asset generation burns an
   OpenAI call. The customer is paying for a resource that was genuinely consumed, plus a
   margin. This is the easiest revenue to explain and the hardest to resent.
2. **A market we operate** — a marketplace sale, a performance fee on a live bot. The platform
   is paid a share of value it helped create, and is paid nothing when no value is created.
   Alignment is structural rather than promised.
3. **Access and capacity** — a private world, a developer plan above the free tier, a community
   plan. The customer is buying reserved capacity that would otherwise be shared.
4. **Cosmetics and passes** — pure want. Zero marginal cost, zero gameplay effect, and
   therefore zero obligation on anyone who does not want them.

Anything that fits none of these four is not a product, it is a toll.

---

## 3. Revenue sources

### 3.1 Summary

| # | Source | Model | Who pays | Indicative price | Phase | Trust risk |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Token deployment | Fixed per-tier fee | Creator | 1,500 / 4,000 / 9,000 Shards | Live; extended P8 | Low |
| R2 | Asset generation credits | Prepaid credits, consumed per image | Creator | 5 Shards per standard image | P8 | Medium — cost is opaque to the buyer |
| R3 | Marketplace take rate | % of sale, custodial and on-chain | Seller | 250 bps | P9 | High — a fee on a fraudulent sale is complicity |
| R4 | Creator royalties | % of resale, paid **to** the creator | Buyer (via sale price) | 0–1,000 bps, creator-set | P9 | Medium — unenforceable off-platform |
| R5 | Verified-project service | One-off review fee | Project team | 5,000 Shards | P9 | **Highest** — sells the appearance of endorsement |
| R6 | Trading performance fee | 15% of gains above a high-water mark | Live-bot operator | 1,500 bps, 5-Shard floor | Built, disabled; live P10 | Medium |
| R7 | Conversion spread | Basis points both ways on coin↔Shard | Converter | 200 bps | Live | Medium — invisible unless quoted |
| R8 | Private worlds | Per-world rental, time-boxed | Host | 1,800 / 2,500 Shards | Sold, **undelivered**; P10 | **Currently critical** — §9 |
| R9 | Season pass | Per-season, cosmetic track | Player | 500 Shards | Sold, partly undelivered; P10 | Medium |
| R10 | Cosmetics | Per-item | Player | 120–600 Shards | Live, partly undelivered | Low once §9 is done |
| R11 | Developer plans | Tiered subscription + metered overage | Developer | Free / $29 / $199 per month | P11 | Low |
| R12 | Community plans | Per-community subscription | Community treasury | 2,000 Shards per month | P12 | Medium |
| R13 | Premium analytics | Add-on subscription | Creator, project, developer | $19 per month | P13 | Medium — must never be user-level data |
| R14 | Platform subscription (Forge Plus) | Monthly bundle | Enthusiast | $9 per month | P13, **conditional** | High — bundles drift into paywalling the spine |

### 3.2 R1 · Token deployment fees

**What it is.** ForgeMint deploys a real ERC-20 to one of five EVM chains; the customer's own
wallet is the contract owner and the platform's deployer key only pays gas.

**Pricing today**, verbatim from `shared-libs/packages/shared/src/forgemint.ts:150-183`:

**Pricing basis, decided 2026-08-04.** These tiers keep their **stated USD** and change unit: the
Shard column is historical, converted at the documented 100-Shards-to-the-dollar peg. So `Fixed`
remains $14.99, `Mintable` $39.99, `Foundry` $89.99, and the amount of EMBER that buys is whatever
those dollars buy at settlement.

**The numbers below have not moved yet, and this is deliberate.** `micro-billing` still prices every
row in `SHARD` — measured, not assumed: its `prices` table holds `SHARD` amounts of 250, 400, 500,
750 and 1000. Rewriting this table to EMBER before the service changes would make the document
disagree with the code, which is the failure the estate's claims checkers exist to catch. The unit
here changes when billing's does, in the same change.

There is also no EMBER/USD rate to convert *at* — a coin with no mainnet has no price — so the USD
figure is the durable one and the EMBER amount is a settlement-time question, not a table entry.

| Tier | Shards | Stated USD | USD at the 100:1 peg | Features |
| --- | --- | --- | --- | --- |
| Fixed | 1,500 | $14.99 | $15.00 | Fixed supply, ERC-20, one EVM chain |
| Forge | 4,000 | $39.99 | $40.00 | Mint, burn, ownable |
| Foundry | 9,000 | $89.99 | $90.00 | Mint/burn/pausable/capped, EVM or Solana |

**Rationale.** Deployment is category 1 work: it consumes gas the platform pre-funds, plus a
contract the platform wrote, audited and maintains. Fixed per-tier pricing beats a percentage
because there is nothing to take a percentage *of* — a token has no value at deployment.

**Recommended changes.** Keep the tiers. Make the Shard price the *only* price, with USD derived
from the peg for display, so the catalogue stops carrying two numbers that disagree by a cent.
Add a **mainnet gas surcharge quoted at order time**: the tier price was set against testnet
reality (`FORGE_MINT_MAINNET_ENABLED` is off by default with an allowlist,
`forge-mint/services/forge-mint/src/env.ts:115,119`), and a $90 Foundry deploy on Ethereum
mainnet during congestion can cost more in gas than the tier charges in total. The surcharge is
a quote, honoured for a stated window, refunded if the deploy fails.

**Trust risk: low.** The deliverable is a contract address on a public chain; it is either there
or it is not. The one live hazard — selling "verified metadata" and a "liquidity-lock helper"
that existed nowhere — is already fixed: `shared-libs` commit `620230c`, *"fix: stop selling a
liquidity locker and metadata verification"*, and no occurrence of `liquidity` remains in
`shared-libs` or `forge-mint`. This supersedes [00-current-state.md](00-current-state.md) §3.8
item 4.

### 3.3 R2 · Asset-generation credits

**What it is.** `cloudsforge-studio` (P8) wraps `asset-forge` and generates brand marks,
wordmarks, favicons, OG images, banners and game tiles.

**Pricing model: prepaid credits, not per-call billing.** Generation is the one place in the
estate where a customer action costs the platform real, variable money on a third-party API. The
published rates the CLI already uses (`asset-forge/src/model.ts:57-63`) are, for `gpt-image-1` at
1024²: **$0.011 low, $0.042 medium, $0.167 high**. The CLI's guard is a `$2` default spend limit
and a TTY prompt (`asset-forge/src/generate.ts:55`), which is not a service-grade control.

Recommendation: **5 Shards (5 cents) per standard image, 20 Shards for high quality**, sold in
credit packs, with a free allocation of 10 standard images per account per month so a first
brand kit costs nothing. That is roughly a 20% gross margin at medium quality and a slight loss
at high quality — deliberately, because high quality is where the output is good enough to make
the customer buy R1.

**Trust risk: medium.** The buyer cannot see what the generation cost. Mitigation: every
generated asset records the model, prompt, spec and cost that produced it
([04-domain-model.md](04-domain-model.md) §5.1), and the credit ledger is visible per
generation.

### 3.4 R3 · Marketplace fees, and R4 · creator royalties

**Take rate: 250 bps (2.5%) on the sale price, paid by the seller.** Charged identically on
custodial and on-chain settlement, so the settlement mode is chosen on the merits in AD-14 and
not to dodge a fee.

**Royalties: 0–1,000 bps, set by the creator at listing, paid on every resale.** The royalty is
revenue for the *creator*, not the platform, and it is a posting in the same journal entry as
the sale (`royalty_paid`). CloudsForge takes no cut of a royalty.

**Rationale.** A marketplace is category 2: the platform earns only when a trade happens. 250 bps
sits deliberately below general marketplace rates because Forge Market's job in its first years
is to give Forge Create a destination — liquidity is worth more than take rate.

**Fees are shown before confirmation, always.** A fee discovered after settlement is a dark
pattern regardless of its size.

**Trust risk: high, and structural.** Taking a percentage of a sale means the platform is paid
when a fraudulent token sells. The mitigations are in [06](06-ecosystem-workflow.md) P9 —
computed risk indicators shown as facts, invite-only launch, value caps, moderation SLAs — plus
one commercial rule stated here: **fees on a reversed sale are reversed in full**, or the
platform profits from its own moderation failure.

### 3.5 R5 · Verified-project services

**What it is.** A paid review that moves a project from `claimed` to `verified`
([04](04-domain-model.md) §6.3): team identity checked, contract source verified against the
deployed bytecode, authorities and supply concentration documented, links confirmed.

**Price: 5,000 Shards ($50) one-off**, plus 2,000 Shards for a re-review after a contract change.

**This is the single most dangerous SKU in the model** and it is included only with the
following constraint written into the product: **verification is a statement about identity and
disclosure, never about quality, safety or investment merit.** The badge copy says exactly what
was checked and what was not, and the risk indicators next to it are *computed from indexer
data* — mint authority present, ownership renounced or not, supply concentration, age, whether
the deployer wallet has been exported — and are never editable by the reviewer or the project.
A paid badge that reads as an endorsement is how a marketplace becomes complicit in its worst
listing.

If that constraint cannot be held in the UI, this SKU is withdrawn. It is worth less than the
first time a verified project rugs.

### 3.6 R6 · Trading performance fees

**What it is.** A 15% fee on a live bot's gains above its high-water mark.
`PERFORMANCE_FEE_BPS = 1500` and `MIN_FEE_SHARDS = 5`
(`crucible/packages/contracts/src/index.ts:780-786`); the calculation floors at zero when equity
has not exceeded the mark (`performanceFee()`, `:803-808`).

**This is the best-designed price in the estate and it should be copied, not changed.** The
high-water mark means the same gain is never billed twice and a recovery from a drawdown is
billed nothing. The 5-Shard floor means the platform does not bill 3 cents and spend more than
that recording it. Rounding is *down*, deliberately, "with an integer currency somebody has to
eat the fraction, and it should be the house" (`:797-802`).

**It earns nothing today.** `CRUCIBLE_LIVE_ENABLED` defaults to `false`
(`crucible/services/crucible/src/env.ts:107`) — the correct default for a product whose engine
has one test file ([00](00-current-state.md) §3.9), but it means Forge Trade's revenue line is
**zero until P10**, and any plan that counts it before then is counting a flag.

**Limits stay as they are** (`CRUCIBLE_LIMITS`, `:788-798`): 200 backtests per day, 10 paper
bots, 5 live bots, minimum live allocation 1,000 Shards ($10) because below that the fee floor
dominates.

**Trust risk: medium.** The fee settles against Pay's price oracle, not an exchange
([01](01-product-vision.md) §6). Every assessment shows equity, the high-water mark, the gain
and the rate, and the honest copy already in the product — "fees and slippage charged, because a
strategy that only works for free does not work" — is a commercial asset and stays.

### 3.7 R7 · Conversion spread

**What it is.** `PAY_CONVERSION_SPREAD_BPS`, default **200** (`forge-pay/services/pay/src/env.ts:68`),
applied in both directions on coin↔Shard conversion
(`forge-pay/services/pay/src/pricing.ts:370-406`).

**Why this is not monetising the spine.** Holding is free; moving is free; *converting* is a
position the platform takes, carrying price risk on a real asset it must hold. 200 bps is the
price of that risk, and the source already says the spread "runs against the user, in both
directions and on purpose" (`pricing.ts:179-181`) — the right posture, honestly stated.

**Conditions.** The spread is quoted as an explicit number before confirmation, in both
directions, with the mid-price and the timestamp shown; a spread inferred from two rates is a
hidden fee. Review the 200 bps against measured oracle volatility at P7, when reconciliation
makes the real carrying cost measurable for the first time.

### 3.8 R8–R10 · Play: private worlds, season passes, cosmetics

All three exist and all three are partly undelivered. §9 is the remediation; the model is here.

**Private worlds — access, priced by capacity and duration.** Today:
`private_skirmish` 1,800 Shards / 30 days / 12 players, `private_saga` 2,500 Shards / 90 days /
40 players (`shared-libs/packages/shared/src/pay.ts`, `PRIVATE_WORLD_OFFERS`). A private world
is a genuinely reserved simulation: its own tick, its own stock, its own seed. Category 3, and a
correct thing to charge for — *once something creates it*.

**Season pass — 500 Shards, a cosmetic track, time-boxed.** `SEASON_PASS.priceShards = 500`,
unlocking `frame_ember`, `crest_phoenix` and `flair_founder`. The pass model is right (it funds
a season's content and expires with it); the implementation is not (it unlocks all three ids
wholesale at purchase, with no progression track, and two of the three are cosmetic kinds
nothing draws).

**Cosmetics — 14 items, 120–600 Shards.** Zero marginal cost, zero gameplay effect.
`@cloudsforge/shared`'s catalogue comment states the rule already: "free-to-play, NEVER
pay-to-win… No AP, resources, XP, or combat power is ever sold". That rule is upheld in schema
by `inventory_item.bound` ([04](04-domain-model.md) §7.3).

**A pricing correction all three need.** The Shard and USD prices in these catalogues do not
agree with the 100:1 peg: the pass is 500 Shards but declares `priceUsd: 4.99`; the private
worlds are 1,800 and 2,500 Shards but declare `$14.99` and `$19.99` — that is $18.00 and $25.00
at the peg, a 17% and 20% discrepancy. **One price, in Shards, with USD derived from the peg for
display.** Two hand-maintained prices is how a catalogue tells two different customers two
different numbers.

### 3.9 R11 · Developer plans

Metered where cost is metered, flat where it is not.

| Plan | Price | Included | Overage |
| --- | --- | --- | --- |
| Free | $0 | 10,000 API calls/month, 2 projects, sandbox unlimited, testnet unlimited | Hard stop, not a bill |
| Builder | $29/month | 500,000 calls, 10 projects, webhooks, 99.5% SLO | $0.50 per 10,000 calls |
| Scale | $199/month | 5,000,000 calls, unlimited projects, priority support, 99.9% SLO | $0.30 per 10,000 calls |

**The free tier must be genuinely useful**, because the developer platform's product is
applications the platform did not have to write ([06](06-ecosystem-workflow.md) P11). A free
tier that cannot ship anything produces no applications and therefore no paying developers.

**A free tier stops, it does not bill.** Nobody gets a surprise invoice from a runaway loop; the
key rate-limits and the dashboard says why.

### 3.10 R12 · Community plans, R13 · premium analytics, R14 · Forge Plus

**Communities** are free to create, free to join, free to govern. A plan (2,000 Shards/month,
paid from the community treasury) buys capacity, not governance: more members, custom roles,
private channels, a verified community page. **Governance is never a paid feature** — a
community that cannot vote until it pays is not a community.

**Premium analytics** ($19/month) sells creators, projects and developers analytics about *their
own* listings, tokens and API usage. Bound by AD-21: `analytics` never receives a `user_id`, an
email, a handle or an exact balance. Nothing sold here can identify an individual user to a
third party. The platform's own analytics remain internal and free.

**Forge Plus** ($9/month) is listed as **conditional and unbuilt**. A platform-wide subscription
is the most reliable revenue in the model and the most reliable way to end up paywalling the
spine — the drift is imperceptible and it always goes the same direction. It ships only if it
can be composed entirely of items from §3 that are already independently purchasable (a monthly
credit allocation, a season pass, a developer tier), such that it is a bundle discount and never
an access gate. If someone cannot state which existing SKUs it bundles, it does not ship.

---

## 4. What must not be monetised, argued

### 4.1 Withdrawal fees

**A withdrawal fee on a custodial platform is a hostage fee.** The platform holds the money; the
fee is charged for the act of stopping holding it. There is no service rendered and no cost
incurred beyond the network fee.

**Pass through the network cost, exactly, and nothing more.** This is already the behaviour:
`send = amount - fee` where `fee` is `estimateFee()` — `gasPrice × TRANSFER_GAS` for EVM, the
node's fee in drops for XRP (`forge-pay/services/pay/src/withdrawer.ts:193-194`,
`outbound.ts:979-999`) — quoted once and locked into the row so two attempts cannot produce two
different transactions. Keep it exactly as it is. The one addition: **show the estimate and the
actual, and refund the difference** when the chain charges less than quoted.

`PAY_WITHDRAWAL_MIN_FEE_MULTIPLE` (default 3, `env.ts:93`) stays a dust guard, not a minimum fee.
It exists so a withdrawal is not consumed by its own gas, and it must never be repurposed as a
floor that earns.

### 4.2 Key export

Charging for key export monetises exit, and it inverts principle 2 of
[01](01-product-vision.md): "a user can always leave with their assets… the right is not ours to
withhold". A fee on export also creates an incentive to make export slow — which is precisely
the failure mode AD-13's safeguards must be *above* suspicion of.

The export ceremony's friction (re-auth, MFA, policy decision, 24-hour cooling-off, second MFA)
is a security control and must be defensible purely as one. Attaching revenue to it makes every
one of those steps arguable as a dark pattern. Free, unlimited, on every managed wallet.

### 4.3 Basic notifications, the activity feed and the portfolio

Notifications are how a user finds out their key left, a device signed in, or a withdrawal
completed. `notification.priority = critical` already ignores preferences by design
([04](04-domain-model.md) §10.3) precisely because safety is not optional. A tier where the
paying user hears about a security event sooner is indefensible.

The activity feed and the portfolio are tests 4 and 5 in [01](01-product-vision.md) §2. A capped
history is a capped truth. Retention is unlimited and the export is free — a user needs their
own transaction history for tax, and charging for it is charging for a legal obligation the
platform created by being custodial.

### 4.4 First-party wallet provisioning

Provisioning a managed wallet costs a key derivation. Charging per wallet pushes users toward
address reuse across purposes, which is worse for their privacy and worse for our
reconciliation. Unlimited, on every chain family.

### 4.5 Security features

MFA, session management, device lists, trusted addresses and withdrawal limits are never a paid
tier. "Pay to be safe" is the most cynical pattern in the industry and the platform's own
principle 4 — "nothing that widens authority ships before the thing that bounds it" — makes
security a *precondition*, not a product.

### 4.6 Testnet anything

Testnet deployment, testnet trading, testnet worlds, the faucet, sandbox API calls: free and
unmetered. Testnet is how a user avoids making an irreversible mistake with real money. Metering
it prices safety, and it also removes the one place where the platform can be tried honestly
before it is trusted.

---

## 5. The Shards model

**What a Shard is.** A platform-internal accounting unit, pegged at **100 Shards = 1 USD** —
`shardsPerUsdScaled = 100n * RATE_SCALE` (`forge-pay/services/pay/src/pricing.ts:181`). A Shard
is one US cent. The same constant anchors Crucible's paper trading (`SHARDS_PER_USD = 100`).

**Why a platform currency at all**, when it could all be priced in a coin:

1. **Prices must be stable and comparable.** A cosmetic that costs 150 Shards costs $1.50 today
   and $1.50 next month. Priced in EMBER it costs a different amount every hour, and every
   catalogue is a live re-pricing exercise.
2. **Integer arithmetic, no floats.** A Shard is the smallest unit and every price is an
   integer, which is what makes the fee floor, the round-down rule and the double-entry
   invariant expressible without floating-point error.
3. **One internal economy.** Test 6 in [01](01-product-vision.md) §2 requires that value earned
   in a world spends in Market and funds a bot. That requires one unit that every product
   understands.

**How Shards are earned.** By on-chain deposit and conversion — and *only* that, today. There is
no fiat rail: the invoice and provider stack was deleted rather than configured, because
`PAY_PROVIDER` defaulted to `'mock'` and `POST /invoices/:id/mock-pay` was an unlimited
free-Shards hole (`shared-libs/packages/shared/src/pay.ts`, the retirement comment). **Do not
restore it.** From P9 and P10, Shards are additionally earned by marketplace sales and game
rewards — both ledger postings against capped budgets, never mints.

**How Shards are spent.** Every SKU in §3 priced in Shards, plus conversion back to a coin.

**The float risk, stated plainly.** Outstanding Shards are a **liability** — a promise to
redeem at 100:1. If a customer converts EMBER to Shards and EMBER then falls, the platform holds
a depreciated asset against an undiminished liability. That is why the 200 bps spread exists,
and it is bounded by three things:

- Shards are backed by the coin holdings that funded them, held in custody, and the
  **reconciliation invariant** ([04](04-domain-model.md) §2.4) makes the backing checkable: Σ
  user liabilities = Σ custody assets = indexer-observed on-chain holdings, within a per-chain
  tolerance. Drift beyond tolerance freezes withdrawals for that asset and pages.
- `convertCoinToEmber` — which today credits custodial EMBER with **no on-chain movement and no
  reserve check** ([00](00-current-state.md) §3.2) — is disabled in P1 and re-enabled in P7 only
  behind a real reserve check. That is the float risk in its purest form and it is currently
  unbounded.
- A **float report** in the Business dashboard: total Shard liability, total custody assets by
  coin, and the coverage ratio. If coverage falls below 100%, Shard issuance stops before
  redemption does.

**In the ledger.** Shards are `asset_code = SHARD` on `liability` accounts with subject
`user:<id>` ([04](04-domain-model.md) §2.1). Platform revenue is a `revenue` account. Every
purchase is one balanced entry: debit the user's SHARD liability, credit `platform` revenue. The
account key `(subject, asset_code, purpose)` is what lets a user balance, an escrow and a
revenue line coexist with no special case.

---

## 6. EMBER's economic role

Decided in [06](06-ecosystem-workflow.md) P10 and restated here as the commercial position.

**What EMBER is for:**

| Role | Mechanism | Phase |
| --- | --- | --- |
| Mining reward | Homefire PoW block subsidy on a CPU-mineable chain | Live on testnet |
| Settlement asset | A marketplace listing may be denominated in EMBER and settle in it | P9 |
| Treasury denomination | Community treasuries hold EMBER as a ledger sub-account (AD-15) | P12 |
| Governance weight | Token-weighted voting at a snapshot block, in EMBER-denominated communities only | P12 |
| Game reward | Worlds pay rewards in Shards or EMBER, from a capped budget | P10 |
| Developer incentive | Grants and revenue share to directory applications | P11 |

**What EMBER is not.** It is **not** a governance token for CloudsForge itself — a platform
holding customer money does not put custody policy to a vote — and it is **not** required to use
CloudsForge. Not one SKU in §3 is EMBER-only; every one is priced in Shards, and Shards are
funded by any supported coin.

**Why that constraint is commercial, not merely principled.** Requiring EMBER makes every user a
speculator, every price a function of a thin market, and the platform's revenue a leveraged bet
on its own token. It converts a product problem into a token-price problem, which is the failure
mode of most crypto platforms: the product stops being the thing that has to work.

**The honest position on EMBER's value.** Hearth mainnet is not launched
([02](02-target-architecture.md) §7.6). Everything EMBER-denominated is testnet, and nothing in
this model assumes a mainnet date or an EMBER price. The supply and emission chart stays
labelled "modelled — not a promise", as the site already does.

---

## 7. Billing mechanics, mapped to the ledger

`billing` owns the commercial vocabulary; `ledger` owns the money. `billing` never holds a
balance and `ledger` never knows what a cosmetic costs
([03-repository-responsibilities.md](03-repository-responsibilities.md) §4).

| Billing concept | Owned by | Ledger entry kind ([04](04-domain-model.md) §2.2) | Notes |
| --- | --- | --- | --- |
| Product, price | `billing` | — | Catalogue only; no postings |
| One-off purchase | `billing` | `purchase` | Debit user SHARD liability, credit platform revenue |
| Entitlement grant | `billing` | — | Emits `billing.entitlement.granted`; the delivering service subscribes |
| Subscription charge | `billing` | `subscription_charge` | Recurring, per period, idempotent on `(subscription_id, period)` |
| Usage-based billing | `billing` | `fee_charged` | `usage_record` rows aggregated per period, then one entry |
| Invoice | `billing` | — | A document over entries, not a separate money movement |
| Discount | `billing` | — | Reduces the posted amount; the discount is recorded on the entry's `metadata` |
| Refund | `billing` | `reversal` with `reverses_entry_id` | Never an edit; also revokes the entitlement |
| Marketplace fee | `market` → `billing` | `market_settled` | Fee and royalty are postings **in the same entry** as the sale |
| Royalty | `market` | `royalty_paid` | To the creator's account, not the platform's |
| Performance fee | `trade` | `performance_fee` | Idempotent on `(bot_id, period)` — the P1 fix |
| Creator payout | `billing` | `creator_payout` | A ledger movement, plus optionally a withdrawal. Never a second money system |
| Revenue share | `billing` | `creator_payout` | Split computed at settlement, posted as multiple credits in one entry |
| Community treasury spend | `community` | `treasury_spend` | Threshold approval plus timelock (AD-15) |
| Reward | `worlds`, `market` | `reward_granted` | Against a capped budget account, so an exploit is bounded and visible |
| Manual correction | operator | `adjustment` | Dual approval, mandatory reason code, audit event |

**Entitlements are the delivery contract.** Today's entitlements are grant-only, Bearer-only,
with no product dimension, no expiry, no revocation and no service-readable API — four gaps,
each of which is a live defect ([04](04-domain-model.md) §8.1). All four close in P4:

- **`scope`** makes "does this user own X *for this title*" answerable.
- **`expires_at`** makes a season pass end.
- **`revoked_at`** makes a refund remove what it paid for.
- **A service-readable API** is what lets `worlds` provision the private world it was paid for.

**Revenue recognition.** One-off SKUs recognise at delivery, not at charge — which requires the
delivering service to acknowledge, which is exactly what `billing.entitlement.granted` plus a
subscriber gives us. Subscriptions recognise rateably; season passes recognise over the season.
Unrecognised revenue sits in a `clearing:deferred_revenue` account, which is why `clearing` is
an account type ([04](04-domain-model.md) §2.1) rather than a special case.

**Tax data.** Billing stores the customer's country, the tax treatment applied and the rate, per
invoice, from P13. It does not compute tax positions for users; it exports the transaction
history that lets them or their accountant do so — free and machine-readable, because the
platform created the reporting obligation by being custodial.

**Financial reporting** is derived from the journal and from nothing else — never from logs,
never from analytics ([02](02-target-architecture.md) AD-20, the four-planes rule). Revenue by
product becomes derivable for the first time because every posting records
`originating_service`. Today it is not: `ledger.source` is written only by `/internal/*`, and
ForgeMint charges through the user-token `POST /spend` path
(`forge-mint/services/forge-mint/src/clients/pay.ts:38-60`), so **token deployment revenue
currently carries no source at all**, while Crucible's does (`source: 'crucible'`,
`crucible/services/crucible/src/clients/pay.ts:134`).

---

## 8. Proposed fee schedule

Every number here is a proposal with a reason, not a default.

| Item | Fee | Basis | Reasoning |
| --- | --- | --- | --- |
| Deposit, any chain | 0 | — | Charging to receive money is charging to fund us |
| Withdrawal | Network cost only | Quoted, locked, difference refunded | §4.1 |
| Internal transfer | 0 | — | A ledger posting |
| Coin → Shard conversion | 200 bps | Existing default | Price risk on a position we take |
| Shard → coin conversion | 200 bps | Existing default | Same, symmetric |
| Token deploy — Fixed | 1,500 Shards | Existing | Fixed-supply ERC-20 |
| Token deploy — Forge | 4,000 Shards | Existing | Mint/burn/ownable |
| Token deploy — Foundry | 9,000 Shards | Existing | Full features, EVM or SPL |
| Mainnet gas surcharge | Quoted at order | New, P8 | A $90 tier cannot absorb a $200 gas spike |
| Asset generation — standard | 5 Shards/image | New, P8 | ~$0.042 cost at medium quality |
| Asset generation — high | 20 Shards/image | New, P8 | $0.167 cost; margin is thin on purpose |
| Free generation allowance | 10 images/month | New, P8 | A first brand kit costs nothing |
| Marketplace take | 250 bps | New, P9 | Below market; liquidity beats take rate |
| Creator royalty | 0–1,000 bps | Creator-set, P9 | Platform takes no cut of it |
| Verified project | 5,000 Shards | New, P9 | Reviewer time; §3.5 constraints apply |
| Trading performance fee | 1,500 bps above HWM | Existing | Only on gains, never twice |
| Minimum fee | 5 Shards | Existing | Below this the accounting costs more |
| Minimum live allocation | 1,000 Shards | Existing | Below this the floor dominates |
| Private world — 30 days, 12 players | 1,800 Shards | Existing | Reserved simulation capacity |
| Private world — 90 days, 40 players | 2,500 Shards | Existing | Same, longer and larger |
| Season pass | 500 Shards | Existing | One season, cosmetic track |
| Cosmetics | 120–600 Shards | Existing | Rarity-banded, zero gameplay effect |
| Developer — Free | $0 | New, P11 | 10,000 calls; hard stop, never a bill |
| Developer — Builder | $29/month | New, P11 | 500,000 calls, $0.50/10k overage |
| Developer — Scale | $199/month | New, P11 | 5,000,000 calls, $0.30/10k overage |
| Community plan | 2,000 Shards/month | New, P12 | Capacity only; governance never paid |
| Premium analytics | $19/month | New, P13 | Own data only, AD-21 bound |
| Refunds | Fee reversed in full | New, P7 | Never profit from a reversal |
| Chargeback / dispute | 0 | — | No fiat rail, so no chargeback concept |

---

## 9. The undelivered-SKU remediation

Principle 3 of [01](01-product-vision.md): *every SKU has a code path that delivers it, or the
SKU is withdrawn — including from the API, not just from the UI.* Today the game client withheld
the listings and **Pay's routes stayed live**, so a script or a stale browser tab is still
charged (`ninety-days-after/apps/game/src/lib/shop.ts`, "WHAT THIS FILE CANNOT DO").

| # | SKU | Price | State today | Action | Phase | Reasoning |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Private worlds ×2 | 1,800 / 2,500 Shards | Charged; nothing provisions; `ownOnce: false` so repeat-chargeable | **Refund every entitlement, remove the routes** | P1; re-sell in P10 | The world type does not exist. A refund is honest where a promise is not |
| 2 | Convenience items ×4 | 120–200 Shards | Charged; the feature each names does not exist | **Refund and withdraw from the API** | P1 | There are no presets to add slots to, no extra charts, no extra filters, no longer history |
| 3 | Cosmetics of three undrawable kinds — `map_banner`, `commune_crest`, `herald_flair` | 150–600 Shards | Charged; no renderer, and the game service refuses to equip them | **Refund and withdraw from the API** | P1; deliver in P10 | Six of the fourteen catalogue items. Buying one buys a row |
| 4 | Season pass | 500 Shards | Sold; unlocks 3 ids wholesale; 2 of the 3 are undrawable kinds; no progression track | **Keep selling, deliver in P10** | P1 corrects the copy | The pass delivers *something* (`frame_ember` renders). Correct the description to name only what exists, then build the track |
| 5 | ForgeMint "verified metadata" and "liquidity-lock helper" | Bundled | **Already withdrawn** — `shared-libs` commit `620230c` | None | Done | Supersedes [00](00-current-state.md) §3.8 item 4 |
| 6 | Game `tokens` currency | Earned, not sold | No sink; `resolve.ts:79` notes the tick never awards them | **Deliver a sink in P10, or remove the currency** | P10 | Not a refund case — nobody paid — but an unspendable currency is a broken promise of the same kind |
| 7 | Crucible live trading | 15% of gains | Earns nothing: `CRUCIBLE_LIVE_ENABLED=false` | **Keep off until P10** | P10 | Not a defect. Correct caution for an engine with one test file |
| 8 | Refunds | — | **No refund path exists anywhere**; `/internal/credit` has no caller | **Build the path in P1, complete it in P7** | P1, P7 | Items 1–3 cannot be remediated without it. This is the blocking dependency |

**The enforcement, not the intention.** [06](06-ecosystem-workflow.md) cross-phase requirements
already include *"no SKU without a delivery path — automated catalogue-versus-handler test"*.
That test is the mechanism: it enumerates every catalogue entry and asserts a delivery handler
exists for it, and it runs at every phase gate. A SKU that cannot name its handler fails CI. The
client-side filter in `shop.ts` was the right instinct executed at the wrong layer — a filter in
a browser bundle cannot stop a charge.

---

## 10. Anti-patterns rejected

- **Pay-to-win in Forge Worlds.** Purchasable means cosmetic, convenience or access — never
  power ([01](01-product-vision.md) principle 6). Scarcity *is* the game; selling relief from it
  sells the game. This is enforced in schema, not in policy: anything conferring power is
  `bound` in `inventory_item` and a `bound` item cannot be listed in Market
  ([06](06-ecosystem-workflow.md) P9).
- **Withdrawal fees.** §4.1.
- **Monetising security.** §4.5. No paid MFA, no paid device management, no faster security
  alerts for paying users.
- **Dark patterns in cancellation.** Cancelling a subscription is the same number of clicks as
  starting one, on the same screen, with no retention interstitial, no "are you sure" chain and
  no phone call. The entitlement expires at period end and the user is told the date.
- **Selling user data.** Not to advertisers, not to analytics vendors, not to chain-analytics
  firms beyond what regulation compels. AD-21 makes this structural: `analytics` receives
  `HMAC(user_id, pepper)` and never an email, a handle, an address or an exact balance, so the
  data that would be saleable does not exist in the system that would sell it.
- **A token sale for CloudsForge equity or governance.** [01](01-product-vision.md) §6 rejects
  it and P12 restates it: platform governance is not tokenised.
- **Fiat and mock payment providers.** Deleted, not deferred. The invoice path was a live
  free-Shards hole and the retirement comment in `pay.ts` is explicit that "re-publishing the
  type is the first step of rebuilding that hole".
- **Loot boxes and randomised paid rewards.** Not in the catalogue, not proposed. They are a
  regulatory liability in several jurisdictions and they are pay-to-win with a probability
  distribution in front.
- **Charging for API access to a user's own data.** A user's transaction export, portfolio and
  activity are free through the developer platform when the caller is the user.

---

## 11. Unit economics

Where margin actually comes from, and what erodes it.

| Revenue line | Direct cost driver | Cost shape | Gross margin | Real constraint |
| --- | --- | --- | --- | --- |
| Token deployment | Chain gas, pre-funded by the platform deployer | Volatile, chain-dependent, can spike 10× | High on testnet and L2s; **can go negative on Ethereum mainnet** | The mainnet gas surcharge (§3.2). Without it this line is a short position on gas |
| Asset generation | OpenAI `gpt-image-1`: $0.011 / $0.042 / $0.167 per image | Linear, predictable, per call | ~20% at medium, negative at high | Per-account credit caps in `billing`. `asset-forge`'s $2 TTY prompt is not a control |
| Marketplace | Ledger postings (custodial) or gas (on-chain) | Near-zero custodial; gas on-chain | Very high custodial | Moderation and dispute handling is the real cost, and it is human |
| Performance fees | Pricing oracle calls, bot tick compute | Near-zero per bot | Very high | Only realised when bots profit. Zero-revenue in a flat market by design |
| Conversion spread | Price risk between quote and settlement | Volatility-driven | Positive on average, negative in a gap | Reconciliation (P7) is what makes the true cost measurable |
| Private worlds | One world tick per world, per day, plus storage | Linear in worlds, not in players | High | Compute per world is small; the cost is the leased job slot |
| Cosmetics, passes | Zero marginal cost | Flat | ~100% | Content production, which is capital not marginal cost |
| Developer plans | RPC provider calls, gateway capacity, storage | Linear in call volume | High above the free tier | The free tier is a marketing cost with a hard stop |
| Analytics | Storage and query on an append-only store | Sub-linear | High | Bound by AD-21, which limits what can be sold |

**Shared infrastructure cost, unattributed to any line:** RPC provider subscriptions across five
chain families with failover (P5), Postgres per service across ~24 services, the telemetry stack
(Prometheus 15d raw / 400d downsampled, Tempo 7d tail-sampled, Loki 30d), object storage for
generated assets and indexer transaction bodies, and a staging environment that
[02](02-target-architecture.md) §7.2 makes mandatory rather than optional.

**Where margin actually comes from.** Not from any single fee, but from the *loop*: a
platform-currency economy where the marginal cost of an internal transaction is a database
write. Deposits cost gas we do not pay; conversions carry a spread; everything a user then does
with Shards — deploy, generate, buy, sell, trade, host — is served at near-zero marginal cost
against a price denominated in cents. The expensive lines (gas, generation) are the *entry* to
that loop and should be priced near cost to widen it; the cheap lines (marketplace, performance
fees, passes, plans) are where margin lives.

**The three things that break this model:**

1. **Gas on mainnet outruns a fixed tier price.** Mitigated by a quoted surcharge; watched on the
   Business dashboard as deployment margin per chain.
2. **Generation cost runs away on a free tier.** Mitigated by hard per-account caps in `billing`
   and a spend dashboard ([06](06-ecosystem-workflow.md) P8 risk).
3. **Shard float coverage falls below 100%.** Mitigated by reconciliation, the coverage ratio
   report, and stopping issuance before redemption. This is the only one of the three that is an
   existential failure rather than a margin failure, and it is why
   [04](04-domain-model.md) §2.4's invariant is the thing the whole platform rests on.
