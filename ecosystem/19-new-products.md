# 19 — Two new products: Emberkin and Forge Foresight

Added to the programme by the owner on 2026-07-31, mid-migration. This document is their design
authority, in the same sense that [02](02-target-architecture.md) holds decision authority for the
original scope: the repositories it defines are added to the target set in
[18-build-status](18-build-status.md), and every rule in [03 §2](03-repository-responsibilities.md)
applies to them unchanged. Nothing here modifies an existing repository.

The two products are deliberately different tests of the platform. Emberkin proves that a game
built *outside* the ecosystem can be brought inside it — onto worlds, billing, identity and the
brand — without its gameplay being colonised by the platform. Foresight proves the opposite
direction: a product born inside the ecosystem, using the chain, custody, settlement, indexer,
policy and ledger as its native substrate.

---

## 1. Emberkin — the second Forge Worlds title

### 1.1 What it is today, verified against source

`github.com/savvaniss/kindred-resonance` ("KINDRED: Resonance") is a monster-collecting RPG with
more real machinery than its README's genre suggests:

| Piece | Evidence | State |
| --- | --- | --- |
| Deterministic battle core | `src/Kindred.Core/Battle/BattleEngine.cs` (406 lines), `DamageCalculator.cs`, `TypeChart.cs`, `Catching.cs` | Real, tested (`tests/Kindred.Core.Tests/`) |
| Content | `content/species.json` (50 species), `moves.json` (47), `types.json` (9 elements + chart), `campaign.json` (6 regions, 3 starters) | Real, schema'd (`docs/SCHEMA.md`) |
| Signature system | Resonance / Temperament / Sync — bond depth shapes stats, moves and *which creature a Kin evolves into* (`docs/GAME_DESIGN.md` §3–4) | Designed and implemented in core |
| Web client | `web/game/` — buildless Three.js, over-the-shoulder battles, six biomes | Real, playable |
| Assets | `web/tools/bake*.mjs` — procedurally generated glTF + baked PBR from code | **Placeholders by its own admission** — `docs/ART_BIBLE.md` scope note says production assets "are not checked into this repo" |
| Unity port | `unity/` | Notes only |

The owner's assessment is confirmed: the "real assets" in the README are code-baked primitives,
not art. The *specification* for the art, however, is excellent — `content/visuals.json` defines a
silhouette motif, palette and body plan for all 50 creatures, and the art bible's pillars
(silhouette-first, type-is-colour, families-read-as-families) are exactly the kind of constraints
a generation pipeline needs.

### 1.2 The rebrand, and why it is nearly free

The game is *already accidentally set in the CloudsForge universe*:

| In the game today | In the ecosystem today |
| --- | --- |
| The world of Aurea is shattered into floating **shards** | The internal currency is **Shards** |
| The first creature type is **ember**; the starter is Cindercub of *Emberfall Vale* | The chain token is **EMBER**; the chain is **Hearth** |
| **Aether** — the resonant energy binding the shards | The network the platform runs on |

So the rebrand is a tightening, not a rewrite:

- **Title: `Emberkin`** (subtitle *Resonance* is kept — it names the signature system, which is
  the game's actual identity and survives untouched).
- **Kin, Wardens, Resonance, Temperament, Sync** — all kept verbatim. The bond system is the
  product; renaming it would spend recognition to buy nothing.
- **Lore joins, gameplay does not.** Aurea's shards become shards of the same world the platform's
  Shards are named for; Aether and the Hearth are one mythology. That is as far as the chain gets
  into the game: **no gameplay value on-chain, no Kin-as-NFT, no pay-to-win.** Monetisation is
  what [15](15-monetisation-model.md) already sells for worlds titles — cosmetics and season
  passes through billing entitlements, never stat advantage. The sanctions and parental-controls
  surface of `micro-worlds` applies in full.

### 1.3 Where it lands — two repositories

| Repo | Owns | Derived from |
| --- | --- | --- |
| `micro-emberkin` | The game service: authoritative saves, campaign progress, party/inventory, catches, Resonance state; the battle engine as a deterministic TypeScript module; content as canonical JSON with schema tests; worlds integration (title registration, shared profile, achievements, entitlement bridge); leased jobs; outbox | `kindred-resonance` `src/Kindred.Core` + `content/` |
| `micro-emberkin-web` | The Three.js client, restructured to estate conventions — `cloudsforgeHosts()`, runtime config, obs, auth callback, honest 404 — with the real generated art | `kindred-resonance` `web/` |

Porting rules:

1. **The battle engine port is behavioural, not textual.** The C# core is the reference
   implementation; the TS port must replay a recorded corpus of battles seed-for-seed and match
   outcomes exactly, the way `micro-conformance` records the estate. Same discipline as the trade
   backtest rule: same seed → byte-identical battle log, proven by test.
2. **Content is data, and data has tests.** Schema validation, type-chart symmetry where the
   design intends it, every learnset move exists, every evolution target exists, every species has
   a visual spec. These are cheap and they catch the class of error hand-edited JSON accumulates.
3. **The upstream repository is not modified.** Code is copied forward; `kindred-resonance` keeps
   working exactly as it does today. Same policy as the rest of the migration.

### 1.4 Assets — FLUX 2 Pro, same pipeline as the brand set

The 73-asset brand run established the pipeline and its two hard lessons (FLUX ignores
`aspect_ratio` — use `width`/`height`, floored to multiples of 16; FLUX will not hit an exact hex —
grounds are normalised numerically to `#12100f` by `normalise_ground.py`). The Emberkin set reuses
all of it, prompted from `visuals.json` so the art matches the spec that already exists:

| Set | Count | Notes |
| --- | --- | --- |
| Species portraits | 50 | Silhouette-first, type-palette albedo per the art bible; evolutions deepen, never recolour, so families read as families |
| Type icons | 9 | On brand ground, CVD-safe distinctions per the corrected accent method in `ui/` |
| Biome keyart | 6 | One per region |
| Title lockup + capsule/OG art | ~6 | Emberkin wordmark in the estate's brand voice |
| UI chrome (frames, HUD glyphs) | ~12 | Replacing `bake-ui.mjs` output |

Provenance is recorded per asset (prompt, model, dimensions, post-processing), as `micro-studio`
already does. **What FLUX does not solve, said plainly: it produces 2D.** The 3D creature models
remain the procedural glTF bakes until real modelling happens; the generated art replaces
portraits, icons, keyart and UI — which is most of what a player actually reads — and the art
bible's import pipeline means real models can land later without touching gameplay code.

### 1.5 Design improvements and extensions (requested, in leverage order)

1. **Determinism as a feature, not just a test.** The engine is already seed-driven
   (`Rng.cs`). Making the TS port strictly deterministic enables replay-from-log, spectating,
   and — the real prize — **async PvP**: two parties, one seed, server-resolved, no realtime
   netcode. That is the cheapest multiplayer a battle RPG can buy.
2. **Resonance meets the shared profile.** Worlds owns cross-title reputation; a Warden's care
   history (Resonance milestones, dex completion) becomes profile achievements visible across the
   estate. The bond system stops being local colour and starts being identity.
3. **Seasons through worlds, not bespoke.** `micro-worlds` already owns seasons and rewards. An
   Emberkin season is content (a featured region, a cosmetic track) riding existing machinery —
   and the season pass is the R9 SKU billing already sells.
4. **Balance harness.** The deterministic engine makes property tests cheap: simulate N battles
   per matchup, assert no type or species falls outside a win-rate envelope. Run it in CI so a
   content edit that breaks balance fails the build, the way a broken learnset does.
5. **Cosmetic trading, later and gated.** `micro-market` escrow could carry cosmetic trades
   (never Kin, never stats). Deliberately out of v1: it needs the policy service's
   parental-control gates in front of it, and it is exactly the feature to get wrong by rushing.
6. **Deliberately not doing:** the Unity/console port (stays upstream), realtime PvP, any
   on-chain gameplay object.

---

## 2. Forge Foresight — a prediction market native to Hearth

### 2.1 What it is

Markets on future events, staked and settled in EMBER **on the chain itself** — the service
orchestrates, the contract is the custodian. Three sentences of shape: an idea pipeline (web
search + an external AI model) proposes markets with cited sources and an operator approves or
discards them; an approved market is a deployed contract on Hearth taking parimutuel stakes until
close; resolution posts the outcome on-chain after a dispute window, and winners are paid from the
pool by the contract, not by anybody's database.

### 2.2 Where it lands — three repositories

| Repo | Owns |
| --- | --- |
| `micro-foresight` | Market registry and lifecycle (`draft → approved → open → closed → resolved → settled`, plus `void`); the idea pipeline (leased jobs: search → AI proposal → provenance → operator queue); contract deployment orchestration (custody signs, settlement broadcasts — the mint pattern); position/stake mirror fed by the indexer; resolution and dispute bookkeeping; fee reporting to the ledger; operator routes |
| `micro-foresight-web` | Public frontend: browse, market detail **with the idea's cited sources**, stake, portfolio of positions, claim |
| `micro-foresight-admin-web` | The operator panel: idea queue, open/close/resolve/void, dispute handling. Kept as its own small surface for now and folded into `admin-web` (P13) when that exists — an operator UI must not share a bundle with an unauthenticated public page |

Plus Solidity in `micro-foresight/contracts/`: a parimutuel market contract (v1), factory, and the
resolution/dispute mechanism. **Parimutuel first, deliberately** — no order book, no AMM, no
liquidity provisioning, no impermanent-loss surface. Odds are the pool ratio; payout is pro-rata.
A CPMM AMM is a v2 decision to be taken with real usage in front of us, not before.

### 2.3 The rules it inherits, applied concretely

1. **The service holds no money — harder than usual.** Stakes never touch the service at all:
   they go wallet → contract. The service's `positions` table is a *mirror* of chain events via
   `micro-indexer` (the same reorg-safe machinery wallet trusts), used for browsing and
   notifications. If the mirror dies, funds are untouched and `claim` still works against the
   contract. Fees are taken by the contract on settlement to the treasury address;
   `micro-ledger` records them from indexed events for reporting — bookkeeping mirrors the chain,
   never the reverse.
2. **Settlement is chain settlement.** Resolution is posted on-chain by the operator oracle key
   (a custody-held key, signed by custody, broadcast by settlement — no new signing path). After
   the dispute window, payout is claimable per-winner from the contract; a leased job may batch
   `claimFor` broadcasts as a convenience, and its loss costs nobody anything.
3. **The AI proposes; a person opens.** The idea pipeline searches the web on a schedule (leased
   jobs, no `setInterval`), asks an external model to draft candidate questions with resolution
   criteria, and stores each with full provenance: query, sources, model id, prompt hash,
   timestamp. **Nothing the model produces can open a market.** An operator approves, edits, or
   discards — because a market is a financial instrument and its resolution criteria are a
   contract with strangers; those get authored by someone accountable. Sources are carried through
   to the public market page, so a bettor can see *why* the market exists.
4. **Policy gates participation.** `micro-policy` fronts staking (limits, velocity, freezes),
   fail-closed as for withdrawals. Market **categories are an allowlist** — protocol/network
   events, market prices, scheduled public events. No markets on named private individuals, none
   on deaths or violence, none whose resolution the operator cannot verify from a source it would
   cite in public. The category list is a policy decision, versioned in the repo.
5. **Resolution honesty is structural.** Every market carries machine-checkable metadata: the
   resolution source named *at open* (not chosen at resolve time), the close time, the dispute
   window. A market whose named source is gone at resolution is `void` — refund, not operator
   improvisation.

### 2.4 What must be proven by test, before it ships

- Contract: stake accounting sums exactly (bigint, no rounding leak — the market royalty
  discipline); double-claim impossible; claim-after-void refunds exactly; resolution before close
  impossible; only the oracle key resolves; dispute window enforced.
- Service: two workers, one due idea job → one run; deployment retry after a lost broadcast
  response → exactly one contract (settlement's chain-keyed lease pattern); mirror replays a
  reorg without double-counting a stake; an unapproved idea can never reach `open` (state-machine
  test *and* a DB constraint, the beacon discipline).
- Frontends: template suites plus the redaction rule for admin (nothing internal in the public
  bundle), degradation when the mirror is stale — the page says *as of when*, the wallet's
  `asOf` discipline.

### 2.5 Monetisation, added to the register

Settlement fee on winning pools (basis points, taken by the contract), listed in the [15](15-monetisation-model.md)
register as a new row once live. Free to browse; no fee to stake beyond gas. No fee on `void` —
refunds are whole.

---

## 3. Programme impact

The target set grows **43 → 48**:

| New repo | Group | Depends on |
| --- | --- | --- |
| `micro-emberkin` | Domain services | worlds, identity, billing |
| `micro-emberkin-web` | Frontends | emberkin, web-template, ui, brand |
| `micro-foresight` | Domain services | custody, settlement, indexer, policy, ledger, contracts-chain, hearth |
| `micro-foresight-web` | Frontends | foresight, wallet, web-template, ui |
| `micro-foresight-admin-web` | Frontends | foresight, identity; folds into `admin-web` at P13 |

Build order under the one-agent capacity constraint, and why: **emberkin content+engine first**
(pure port with a conformance corpus — highest certainty), then **foresight contracts+service**
(the hard invariants), then the three frontends, then the FLUX asset runs (a generation session
against the Azure endpoint, batched like the brand run). Asset generation does not block any code
repo and is scheduled independently.

Neither product modifies an existing repository. `kindred-resonance` upstream stays exactly as it
is, like every other ancestor in this programme.
