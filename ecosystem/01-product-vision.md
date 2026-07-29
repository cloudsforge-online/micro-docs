# 01 — Product vision

What CloudsForge is for, what the products are, and what makes them one platform rather than
nine applications sharing a name. This document sets the intent that
[02-target-architecture.md](02-target-architecture.md) then serves.

---

## 1. The thesis

> **One crypto world. Mine it, hold it, forge it, trade it, sell it, play in it, build on it.**

Almost every consumer crypto platform is an exchange with features bolted on. CloudsForge is
the inverse: a set of things worth doing, funded by a currency you can produce yourself on a
laptop, with the account, the wallet and the ledger shared across all of them.

The loop is the product. Every arrow already exists in code except the last two:

```
   mine EMBER on your own CPU               Hearth — Homefire PoW, no farms, no pools
              │
              ▼
   deposit into your CloudsForge wallet     custody mints the key, the indexer confirms it
              │
              ▼
   hold, convert, or reserve                one ledger, double-entry, one portfolio
              │
              ├──► forge a token or a brand         Forge Create
              ├──► run a strategy                   Forge Trade
              ├──► play, earn, own                  Forge Worlds
              ├──► sell it, buy someone else's      Forge Market      ← does not exist yet
              └──► build on all of it               Developer Platform ← does not exist yet
              │
              ▼
   withdraw back out on-chain, or to        one activity history, one set of notifications
   your own external wallet
```

A CPU-mineable coin that is the actual funding rail for real products is a story no one else
can tell. It is roughly 80% built and 0% marketed.

## 2. What "one platform" has to mean concretely

The test is not whether the products share a logo. It is whether these eleven statements are
true. Today, three are.

| # | Statement | Today |
| --- | --- | --- |
| 1 | One account signs into everything, once. | **True** |
| 2 | One identity — the same profile, handle and reputation everywhere. | Partly — one `users` row, but no profile beyond a handle |
| 3 | One wallet experience — the same receive, send and key screens whichever product you came from. | False — three different "wallet" concepts |
| 4 | One portfolio — a single number that is the truth about what you hold. | False — nothing aggregates |
| 5 | One activity history — every account, money, asset, game and governance event on one timeline. | False — no cross-product feed exists |
| 6 | One internal economy — Shards and EMBER spend and earn identically in every product. | Partly — Shards are universal; nothing earns them |
| 7 | Assets you create in one product are usable in the others. | False |
| 8 | One set of notifications, with one preference page. | False |
| 9 | One operator view — a support agent can answer any question from one place. | False |
| 10 | One financial source of truth that reconciles against the chain. | False |
| 11 | A third party can build on all of it. | False |

Every phase in [06-ecosystem-workflow.md](06-ecosystem-workflow.md) is justified by which of
these eleven it moves from false to true. A phase that moves none of them does not ship.

## 3. The products

Seven customer-facing products, one control centre, one developer surface. Everything else is
spine — and spine must never appear in a product grid as a peer, because an account is not
something a person chooses, it is something they are given.

| Surface | Verb | What it is | Built from |
| --- | --- | --- | --- |
| **Forge Hub** | — | The control centre: dashboard, portfolio, wallet, activity, settings, security. The default landing place after sign-in. | New — `hub-api` + `hub-web` |
| **Forge Network** | Mine | The EMBER chain: node, mining, explorer, faucet, network stats, RPC and SDK. | `hearth` |
| **Forge Create** | Forge | Brand generation, token deployment, project pages, launch flow. | `asset-forge` + `forge-mint` |
| **Forge Market** | Sell | Discovery, listings, auctions, offers, escrow, creator and project profiles. | New |
| **Forge Trade** | Trade | Backtesting, strategy catalogue, paper and live bots, performance reporting. | `crucible` |
| **Forge Worlds** | Play | The game platform. *Ninety Days After* is its first title, not its definition. | `ninety-days-after`, generalised |
| **Forge Pay** | Spend | Wallet, deposits, withdrawals, conversions, Shards. Presented **inside Forge Hub**, not as a separate destination. | `forge-pay`, decomposed |
| **Developer Platform** | Build | Projects, API keys, webhooks, SDK, CLI, sandbox, application directory. | New |

**Spine, never a product:** identity, ledger, custody, indexer, policy, activity,
notifications, billing, gateway, Lantern, Beacon.

### Why Forge Pay stops being a destination

Forge Pay is the best-built thing in the estate and the worst-positioned. Nobody wakes up
wanting to visit a payments product. Its screens — balance, receive, send, convert, history —
are exactly the screens Forge Hub owes the user on arrival. So Forge Pay becomes the *engine*
under Hub's wallet tab, and the standalone `pay.` surface is retired from the product
switcher. The API keeps its name and its repo lineage; the destination goes away.

## 4. The intended journey, end to end

This is the journey named in the brief, mapped onto the surfaces that serve each step and the
phase that makes it work. Detail is in [05-user-journeys.md](05-user-journeys.md).

| Step | Surface | Phase |
| --- | --- | --- |
| Register | Identity → Hub | P6 |
| Create or connect wallets | Hub · Wallet | P6 |
| Fund account | Hub · Receive → indexer confirms | P6, P7 |
| Hold assets | Hub · Portfolio | P6 |
| Create assets | Forge Create | P8 |
| Use assets | Forge Worlds, Forge Trade | P10 |
| Trade or sell assets | Forge Trade, Forge Market | P9, P10 |
| Earn rewards | Forge Worlds, Forge Network, Forge Market | P10 |
| Participate in communities | Communities & governance | P12 |
| Withdraw assets | Hub · Send | P6, P7 |
| Build integrations | Developer Platform | P11 |
| Return through notifications | Notifications | P13 |

## 5. Principles

These are the tie-breakers. When two designs are defensible, the one that satisfies more of
these wins.

1. **The ledger is the source of truth for value; the chain is the source of truth for
   ownership.** Where they disagree, the system stops and tells an operator. It never guesses.
2. **A user can always leave with their assets.** Private-key access for a wallet the user
   owns is a product requirement, not a favour. The safeguards are ours to design; the right
   is not ours to withhold.
3. **Do not sell what cannot be delivered.** Every SKU has a code path that delivers it, or the
   SKU is withdrawn — including from the API, not just from the UI.
4. **Nothing that widens authority ships before the thing that bounds it.** The estate already
   follows this rule: the treasury pin shipped in the same change as the sweep shape.
5. **Honest copy.** "Modelled — not a promise." "Fees and slippage charged, because a strategy
   that only works for free does not work." This voice is an asset. Protect it.
6. **No pay-to-win.** In Forge Worlds, purchasable means cosmetic, convenience or access —
   never power. Scarcity is the game.
7. **One system, many accents.** The warm ash/ember palette is distinctive. New products get an
   accent, not a new visual language.
8. **Prefer the simplest architecture that preserves clear ownership, data integrity and
   security boundaries.** Do not create a service per capability.
9. **Reversibility beats cleverness.** Every phase ships behind a flag with a stated rollback.

## 6. What this vision explicitly rejects

- **A CloudsForge exchange.** Order books, custody of other people's trading pairs and market
  making are a different company with a different regulatory posture. Forge Trade settles
  against a price oracle on coins we already custody; that is the boundary.
- **Selling the spine.** "CloudsForge ID" and "CloudsForge Wallet" as products is how you end
  up with nine things nobody wants.
- **A rewrite of Hearth or the custody model.** Both are correct for what they are. Hearth's
  chain node stays a stateful singleton; custody stays single-replica. Say so out loud rather
  than discovering it during a migration.
- **A new product before the ecosystem works.** Forge Market is the one exception, and only
  because it is the missing verb — "sell" — without which "create" has no destination.
- **Monetising the spine.** Wallets, transfers, key access, activity history and the account
  are free forever. Revenue comes from creation, trading, play and developer scale. See
  [15-monetisation-model.md](15-monetisation-model.md).
