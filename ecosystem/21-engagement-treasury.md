# 21 — The Engagement Treasury: how empty rooms get their first people

Every marketplace in this estate has a cold-start problem, and each one fails differently when
empty. This document decides whether the platform should hold a bucket of its own money to make
early rooms work, where that money honestly comes from, how each service may spend it without
lying to anyone, and how operators control it. It extends the migration plan the way 19 and 20
did: the repositories it touches are named in §8, and every rule in 01–17 applies unchanged.

---

## 1. The problem, per service

| Service | What an empty room does today |
| --- | --- |
| **Foresight** | A parimutuel market with one bettor is a refund machine: the lone winner splits a pool containing only their own stake. Nobody's first bet can ever be interesting. |
| **Market** | Zero listings begets zero buyers begets zero listings. A first seller pays full fees to list into a void. |
| **Worlds titles** | `seasons.reward_budget_shards` already exists (`worlds/src/migrations.ts`) and is required positive — but nothing anywhere says who funds it. A season with an unfunded budget cannot pay a single reward. |
| **Trade** | ~~Backtests charge fees and slippage by design. A new user's first honest experiment costs money before it teaches anything.~~ **False — struck 2026-08-03.** `trade/src/fees.ts` says the opposite: "Trade is free until it makes money. Backtests, the strategy catalogue and paper trading never cost anything." The only charge is a share of a **live** bot's gains against a high-water mark. Trade has no cold-start money problem, because there is no cold-start charge. |
| **Aetherholm / Emberkin** | Season budgets, starter cosmetics, early-cohort incentives — same shape as Worlds. |

The common structure: **fees can only fund engagement after volume exists, and volume is what the
empty room lacks.** Someone must move first, and the only party with a reason to is the platform.

## 2. Do we need the bucket at all? (the owner's question 2, answered first)

**Yes — bounded, disclosed, and denominated in EMBER.** This said "denominated in Shards" until
2026-08-07, which §5's house-seed bullet had already contradicted in practice: SHARD is retired
(`contracts/packages/chain/src/index.ts`), nothing issues it, and a programme designed to *start*
in 2026 cannot be designed in an asset the estate is winding down. The alternative is argued and
refused:

- *"Let organic growth do it"* fails on arithmetic, not on optimism. A parimutuel needs a
  counterparty **by definition**; no amount of patience makes one bettor into two. The first
  hundred users decide whether the rooms feel alive, and they arrive one at a time.
- *"Fake it"* — synthetic bids, ghost bettors, invisible house positions — is refused outright.
  It is the one form of this that costs nothing and it is fraud. Every unit the platform puts
  into a room below is **labelled as the platform's**, on the surface where users see it.

What makes the bucket safe is what makes everything here safe: it is **ledger accounts, not a
service holding money**; every movement is a double-entry posting; the caps live in the schema;
and spending it requires the operator machinery that already exists (`admin-api` actions,
approvals, audit).

## 3. Where the money comes from — the two proposals, judged

**Proposal (b), a consensus carve-out (a share of early block rewards routed to services), is
rejected.** Reasons, in order of weight:

1. The public copy says **"no premine"**, and the org page and `hearth`'s own documents lean on
   it. A founder/treasury output is not technically a premine, but the distinction is lost on
   every reader who matters, and this estate's honesty rule exists precisely for claims like
   that. Changing the claim is possible; quietly outgrowing it is not.
2. It couples engagement budgets to **consensus**. Hearth has no public network yet, so the code
   change is cheap today — but the *promise* change is permanent, and every future reader of the
   emission schedule inherits it.
3. It is unnecessary, because of what "no public network yet" also means: **early difficulty is
   low and miners are few, so honest mining by the platform accumulates early supply anyway**,
   without touching consensus or copy.

**Proposal (a), platform miners, is adopted as the funding leg — formalised:**

- The platform runs ordinary CPU miners under the same rules as everyone (`hearth`'s whole
  thesis). Their coinbase addresses are **published** on the network site — the platform's mining
  is disclosed, not discovered.
- Mined EMBER flows through the front door like anyone's: deposit → indexer confirmation —
  landing as EMBER in **one ledger account: `platform:engagement-treasury`**. The conversion step
  this bullet used to name ("→ conversion to Shards") is deleted rather than re-pointed: it was
  the only thing in the funding leg that turned a chain-backed asset into an administered one, and
  removing it is what lets §4's promise — an auditor reconstructs the programme from the ledger
  alone — rest on a balance the chain can be asked about.
- Second leg, for sustainability once volume exists: **a fee recycle**. A configured percentage
  of platform fee revenue (billing) posts to the same treasury account each period, so the
  engagement budget eventually funds itself from the activity it seeded. The percentage is an
  admin-set value with a schema-capped ceiling.

Nothing here mints anything. The treasury is funded by work the chain already rewards and by
revenue the platform already earns — both visible, both double-entry.

## 4. The ledger architecture

```
platform:engagement-treasury            ← mined-EMBER conversions; fee recycle
   ├── engagement:foresight             ← per-service accounts, funded by
   ├── engagement:market                   operator-approved transfers with
   ├── engagement:worlds                   per-service caps in the schema
   ├── engagement:aetherholm
   ├── engagement:emberkin
   └── engagement:trade
```

- All are ordinary `micro-ledger` accounts. **No new service is created** (01 §5.8: no service
  per capability). No schema change in `ledger` at all.
- Per-service caps and allocation weights live in a small `engagement_policies` table in
  `admin-api` (it already owns cross-service operator state), with CHECK constraints on ceilings
  — an operator can lower a cap freely; raising one is an approval-gated action, the same
  asymmetry the devplatform quota fix established.
- **Every grant a service pays out references its engagement account as the debit side.** An
  auditor reconstructs the entire programme from the ledger alone.

## 5. How each service spends it, honestly

- **Foresight — the house seed.** At market approval, a configured amount is staked
  **symmetrically across all outcomes**, at open, never after. Symmetric means the house
  expresses no opinion; at-open-only means it can never trade on information; a trigger enforces
  that house stakes carry the market's open timestamp. The market page shows it plainly:
  *"CloudsForge seeded this pool with X EMBER so early odds exist."* The house's proportional
  winnings return the way any bettor's do. Per-market and per-day caps are schema-checked. This
  makes the owner's "bet against the market if no other users exist" real — with the platform as a
  **disclosed, opinion-free** counterparty, never a hidden one.

  Three corrections to what this bullet used to say, each made against the built implementation
  rather than against intent. The operator procedure and the full derivation are in
  `deploy/docs/house-seed.md` (repository `micro-deploy`):

  1. **The sentence is served in EMBER, not Shards**, and that is deliberate, not drift. The pool
     is EMBER wei on a public chain, and converting through an administered price would make the
     disclosed number move without anybody staking anything. The honest unit is the pool's own.
     Composed once in `foresight/src/houseseed.ts`, rendered verbatim by the client. SHARD is
     a retired asset (`contracts/packages/chain/src/index.ts`), so this bullet's old wording
     described a live surface naming a retired asset. It never did.
  2. **The stake does not come from the engagement account, and cannot.** `stake(uint8)` is a
     value-bearing contract CALL, and custody has no signing shape for one
     (`custody/src/signing.ts`). The seed is staked on chain from a published platform
     wallet, `FORESIGHT_HOUSE_ADDRESS`, whose key lives outside custody. The ledger account is the
     programme's bookkeeping; it is not the money, and §4's promise that an auditor reconstructs
     the programme from the ledger alone does **not** presently hold for the house seed.
  3. **"Worst-case cost per market is the seed itself" was too pessimistic, by half.** If the
     house stakes `S` per side it commits `2S`, but its payout is bounded strictly below by `S`:
     the maximum loss on any market is **`S` — the per-outcome amount, not the total staked.**
     With no other bettors the house recovers everything but the settlement fee, and that fee goes
     to the platform's own treasury address.
- **Market — subsidies and bounties, never ghost demand.** The engagement account funds zero-fee
  listing windows and first-N-listing bounties (idempotent grants, labelled `engagement.grant` in
  the buyer-visible history). It never places bids: a bid the platform does not mean is ghost
  demand, and ghost demand is the "fake it" this document refuses.
- **Worlds / Aetherholm / Emberkin — season budgets and starter grants.** The funding source for
  `reward_budget_shards` becomes explicit: a season's budget is an operator-approved transfer
  from the title's engagement account. Starter cosmetic grants to early cohorts ride the existing
  entitlement machinery.
- **Trade — nothing to grant, and granting would corrupt the numbers.** This section used to
  promise "a small backtest-fee credit funded from `engagement:trade`". It is **withdrawn**,
  because the premise in §1 was wrong: backtests are already free. A credit against a charge
  nobody makes would be inert at best — and at worst actively harmful, because `backtests.fee_bps`
  is a **simulated exchange fee inside the simulation**, not a charge to the user. Crediting it to
  zero would not refund anything; it would make every backtest **overstate strategy returns**,
  which in a financial tool is a correctness bug rather than a wasted feature. Live-bot capital is
  still never granted — engagement money teaches, it does not trade.

## 6. Operator control — "manageable from the admin panel"

Three new `admin-api` actions, in the existing catalogue/approval shape:

| Action | Approval | What it does |
| --- | --- | --- |
| `engagement.transfer` | required | treasury → a service's engagement account, amount-capped by policy |
| `engagement.policy.set` | required to raise, not to lower | per-service caps, foresight per-market/per-day seed sizes, fee-recycle percentage |
| `engagement.report` | none (read) | balances, spend by service, grants issued — read straight off the ledger |

`admin-web` gains one screen rendering the tree in §4 with balances and the policy table. Until
that screen ships, the actions are fully operable through the existing actions catalogue — the
panel is a view, never the mechanism.

## 7. What must be proven by test, before any engagement money moves

1. A house stake after market open is **unrepresentable** (trigger, fire-tested).
2. House seeding is symmetric by construction — a lopsided seed refuses at the schema.
3. A transfer above a policy cap is refused **by the database**, even for a caller holding a
   connection — `engagement_over_cap_refused`, `admin-api/src/migrations.ts` (raise). This item said "by CHECK" until 2026-08-03 and that was not achievable: a CHECK
   constraint cannot reference another table, and the cap lives in `engagement_policies`. It is a
   constraint **trigger**, which is the same strength by a different mechanism — but the doc
   should not name a mechanism it did not get.
4. Every engagement grant resolves to a ledger entry pair; a grant with no posting cannot exist.
5. The fee-recycle percentage cannot exceed its schema ceiling.
6. The foresight market page renders the house seed disclosure whenever a house stake exists —
   asserted the way admin-web asserts its missing og card: presence with force.
7. Raising any cap without an approval is refused; lowering without one succeeds.

## 8. Programme impact — added to the migration plan

No new repositories. Touched: `admin-api` (policies table, three actions), `foresight` (house
seed + disclosure), `market` (subsidy/bounty grants), `billing` (fee recycle only — the trade
credits are withdrawn, see §5),
`worlds`/`aetherholm`/`emberkin` (budget funding source made explicit), `admin-web` (one screen),
`hearth`/`micro-network-site` (published platform miner addresses), and the ledger — **zero
schema changes**, it already models everything. Build order: admin-api policies and actions
first (nothing may move before the caps exist), then foresight's house seed (the sharpest
cold-start), then the grants, then the screen. Agents may run in parallel from 2026-08-03, but
**partitioned by repository** — two agents must never hold write access to the same repo. The
build order above is a data dependency, not a scheduling preference, and it still binds.

Open decision, recorded not hidden: whether the fee recycle starts at 0% (pure mined funding
until revenue exists) — recommended, since it costs nothing to raise later through the action
that already requires approval.
