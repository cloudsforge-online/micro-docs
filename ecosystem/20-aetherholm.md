# 20 — Aetherholm: the third Forge Worlds title

A sky-island strategy MMO at Ikariam scale: build a floating city, mine Aether, command airship
fleets, forge alliances, and contest an archipelago that **seals into history when the season
ends**. Free to play; monetised through convenience, cosmetics and access — never power.

Like [19-new-products.md](19-new-products.md), this document extends the original scope: the
repositories it defines join the target set, and every rule in 01–17 applies unchanged. Unlike 19,
there is no ancestor to port — Aetherholm is the estate's first game designed *inside* the
standards rather than migrated up to them.

---

## 1. What it is

Three sentences of shape: a persistent tick-free world where every island city accrues resources
lazily and every contested action resolves deterministically at its own moment; airship fleets
travel a directed wind lattice, so geography is a graph and position is strategy; and a 120-day
season crowns whoever holds the Aether Spires at the end, then seals the whole archipelago into a
replayable chronicle.

Scale reference, since "Ikariam-sized" is the brief:

| Dimension | Ikariam | Aetherholm |
| --- | --- | --- |
| Resource kinds | 5 | 4 + population (Aether, Cloudstone, Skysteel, Provisions) |
| Building types | ~15 | 20 (see §4) |
| Unit types | ~8 ships + ~8 troops | 10 airship classes (no ground game — the ground is sky) |
| Research | ~48 nodes, 4 branches | 32 nodes, 4 branches |
| Island occupancy | ~16 towns per island | 12 city plots + 1 communal well per island |
| Round length | open-ended | **120 days, then the world seals** |

## 2. The world

**Islands.** The archipelago is generated from the season seed: ~200 islands across three
altitude bands (Shallows, Midreach, Highwind), each with 12 city plots and one **Aether well**.
Higher bands yield richer Aether and harsher storm exposure.

**The well is communal, and it strains.** Every city on an island draws from the same well.
Extraction above the well's regeneration raises `strain`; strain past threshold spawns storms
that ground fleets and damage rigs. Neighbours therefore share a commons problem — the game's
first diplomatic pressure is not war, it is the well meeting. This is the Worlds ethos (resources
genuinely run out) applied economically rather than terminally.

**The wind lattice.** Travel is not euclidean. Islands are nodes on a directed graph of wind
lanes; a lane has a direction multiplier, so A→B may be 2 hours while B→A is 5. Control of lane
junctions is worth more than control of islands, and the lattice re-rolls each season with the
seed — no permanent geography knowledge to buy or hoard.

**Seasons seal.** At day 120 the archipelago freezes: final state, every battle digest and the
full chronicle become immutable history. Victors receive heraldry — cosmetic entitlements on the
**shared Worlds player profile**, visible in every title. A new season is a new seed, a new
lattice, a level field.

## 3. The loop

```
   found a sky-city on a plot            one plot, one city, per player per island
              │
              ▼
   mine Aether, quarry, farm             lazy accrual — no tick, computed on read
              │
              ▼
   build, research, launch fleets        queues; leased jobs resolve arrivals
              │
              ├──► trade along the lanes         Trade Gantry, alliance routes
              ├──► raid, besiege, blockade       deterministic battles, digest per report
              └──► found or join an alliance     an alliance IS a micro-community
              │
              ▼
   hold Aether Spires as the season closes
              │
              ▼
   the world seals; heraldry outlives it         entitlements on the Worlds profile
```

## 4. Systems at scale

Counts here are the contract; the full trees live as seeded content JSON in
`micro-aetherholm-assets` (the Emberkin pattern — content drives both the engine and the art
prompts, so the game and its assets cannot drift apart).

- **Buildings (20):** Skyhall · Well Rig · Cloudstone Quarry · Skysteel Forge · Terrace Farm ·
  Warehouse · Vault · Residences · Aerodock · Launch Rails · Windworks · Academy · Watchspire ·
  Storm Anchor · Bulwark Ring · Trade Gantry · Guild Beacon · Charthouse · Infirmary · Hall of
  Banners.
- **Airships (10):** Skiff (scout) · Cutter · Corvette · Gunship · Frigate · Ironclad · Breaker
  (siege) · Hauler · Grand Hauler · Flagship. Freight and war split deliberately: a raid needs
  Haulers to steal anything, so pure-combat doom-stacks carry nothing home.
- **Research (32):** Economy, Aeronautics, Warfare, Statecraft — 8 nodes each.
- **Combat:** round-based, initiative by class, wind-advantage modifier from the lane of
  approach; resolved entirely from `(battleId, seasonSeed, both orders-of-battle)` by a seeded
  PRNG. The report carries a sha256 digest over the canonicalised result — the determinism claim,
  written down, exactly as `trade` does for backtests.
- **Protection:** a new city holds a free 7-day aegis; a vacation shield exists and is free.
  Neither is ever sold — a shield you can buy is pay-for-power on the defensive axis.

## 5. Where it lands — three repositories

| Repo | Owns | Port |
| --- | --- | --- |
| `micro-aetherholm` | World state, cities, economy, fleets, battles, seasons, the chronicle; **the title contract**; alliance bindings to `community`; entitlement consumption | 4120 |
| `micro-aetherholm-web` | The client: archipelago map, city view, fleet control, battle reports, chronicle browser | vite 517x, collision-checked |
| `micro-aetherholm-assets` | Art bible, content JSON (canonical trees), FLUX 2 Pro generated art with per-asset provenance | — |

Dependencies: `worlds` (title registry, profile, entitlements), `community` (alliances),
`billing` (Charter, season pass), `ledger` (every Shard movement), `identity`, `notify`,
`activity`, `contracts` (topics), `ui` (registry row, chrome). **Nothing existing is modified**
except the registry row in `micro-ui` and the topic registry in `micro-contracts`.

## 6. The rules it inherits, applied concretely

- **It is the first title to implement the contract `worlds` actually calls.** `18-build-status`
  records that no title serves `GET /v1/title` or `POST /v1/provision`
  (`worlds/src/titleclient.ts:122`, `:134-135`) — the bridge is complete and tested against a
  fake, and a private-world entitlement ends as a terminal `unsupported` row. Aetherholm closes
  that: the descriptor answers `slug: 'aetherholm'` with `capabilities: ['private_world']` — **not
  `['provision']`, which this document first said**: worlds' capability set is closed
  (`worlds/src/titles.ts:43-51`), its conformance fails anything outside it, and the bridge calls a
  title only if `hasCapability(title, 'private_world')` holds (`worlds/src/provisioning.ts:441`).
  The build agent caught the doc against the source, which is the direction checking is supposed
  to run, and
  provision creates a **Private Skerry** — a small private archipelago for a group — returning
  its `urn`, idempotently on `entitlementId`, `replayed: true` on the second ask. The day this
  ships, `worlds`' own suite proves the gap closed, because its checks fail if the routes stop
  being served.
- **An alliance is a `micro-community` community.** Proposals, votes, officers, timelocks and the
  treasury already exist there and are governance, not game logic. Aetherholm stores the
  `communityId`, exposes alliance *play* (claims, beacons, shared lanes), and never grows a
  second voting system. The alliance treasury is a ledger account; a war chest spend is a ledger
  entry with the game as `producer`.
- **No service holds money.** Charter and season pass are `billing` products; cosmetics are
  `worlds` entitlements; every Shard movement is double-entry in `ledger`.
- **Determinism is proven, not claimed.** Same seed + same orders ⇒ byte-identical battle report
  and digest; the chronicle replays a season from stored inputs. The suite asserts it the way
  `emberkin` asserts bit-identical RNG and `trade` asserts backtest digests.
- **No timers.** Arrivals, battle resolution, well regeneration checkpoints, season close — all
  leased jobs claimed `FOR UPDATE SKIP LOCKED`; the lease key names the contended resource
  (`plot:<islandId>:<n>` for a siege, `fleet:<id>` for an arrival). Resource balances are **lazy**:
  computed on read from `(lastSettledAt, rates, caps)` and settled on write, so there is no
  per-minute world tick to shard or to miss.
- **Invariants live in the schema.** A CHECK refuses a negative stock and a stock above warehouse
  cap at settlement; a partial unique index makes one city per player per island unrepresentable
  twice; a deferred constraint refuses a fleet that departs with more cargo than hold; sealed
  seasons are immutable via trigger — an UPDATE on a sealed row is an error, not a policy.
- **Registry row.** `kind: 'service'`, `subdomain: 'aetherholm'`, `devPort: 4120` (the port the
  service binds, pinned in `surfaces.test.ts` with its citation like the other six), accent
  `#6d9a49` — a title wears Worlds' colour rather than claiming its own, as Emberkin does.

## 7. Monetisation, added to the register

| SKU | Kind | What it grants |
| --- | --- | --- |
| Skywright's Charter | subscription | +2 build-queue slots, trade-route automation, city planner, chronicle bookmarks |
| City & fleet cosmetic sets | entitlement | city skins, airship liveries, engine trails |
| Season pass | entitlement | a **cosmetic-only** track alongside free progression |
| Heraldry studio | entitlement | banner fields, charges and crests for player and alliance sigils |
| Name reservation | entitlement | carry a city name across seasons |

**Refusals, stated once:** no resources for money; no build/travel/research speed-ups — in a
competitive world, time *is* power, so "time monetisation" here means the Charter's convenience,
never acceleration; no purchasable shields; no loot boxes; no city or ship as a token. Principle
3 of 01 applies: every SKU above has a code path that delivers it, or it is withdrawn including
from the API.

## 8. Assets — FLUX 2 Pro, art bible first

The Emberkin pipeline, not the brand pipeline: an `ART_BIBLE.md` in `micro-aetherholm-assets`
fixes the direction (luminous stratified cloud-sea, warm-lit isles against storm depths,
painterly key art, readable flat sprites for play), content JSON drives the prompts, and every
asset lands with full provenance in a manifest `verify.py` checks — including the `c2pa` flag
measured off the bytes, which the brand repo learnt the hard way.

| Set | Count |
| --- | --- |
| Island archetypes (3 bands × 4 biomes) | 12 |
| Building sprites | 20 |
| Airship profiles + icons | 20 |
| Resource, UI and status icons | 16 |
| Heraldry components | 16 |
| Key art, og, social, wordmark backdrop | 4 |
| Season/event splashes | 6 |
| Title chrome (favicons, og, wordmark) | 8 |
| **Total** | **~102** |

Estimate at the brand run's measured economics (80 generations, 26 retries, 240 units for 93
kept): **~140 generations, ~420 provider units**. The actual spend is recorded per asset in the
manifest, as always. UI chrome uses Worlds' accent; game art follows the bible, not the product
palette — a title's art is its own, as Emberkin's is.

## 9. What must be proven by test, before it ships

1. Two resolutions of one battle from stored inputs produce one digest, byte-identical.
2. Lazy accrual can never settle negative or above cap — property-tested across random
   rate/cap/elapsed triples, enforced again by the CHECK.
3. Two replicas racing one arrival produce exactly one battle (lease, not luck).
4. `GET /v1/title` and `POST /v1/provision` satisfy `worlds`' client against the real service;
   provision replays idempotently on `entitlementId`.
5. A sealed season refuses UPDATE and DELETE at the database, even to a caller holding a
   connection.
6. The aegis cannot be granted by any purchase path — asserted the way `admin-web` asserts its
   missing og card: an absence with a test.
7. Every SKU in §7 resolves to a deliverable entitlement or billing product; a SKU without a code
   path fails the suite.
8. No `setInterval` doing domain work; CI's existing rule, plus the estate suite.

## 10. Extensions proposed (not committed)

- **Chronicle spectating:** sealed seasons are public data; a replay browser on the web client
  costs nothing at runtime and shows the game to people who have not installed it.
- **Foresight season markets:** "who holds the Spires at seal?" is an operator-approvable market
  whose resolution source is the sealed chronicle digest — provenance the contract can cite.
  Needs nothing from Aetherholm but the digest it already publishes.
- **Creator heraldry on Forge Market:** later, if creator cosmetics get a marketplace lane;
  requires nothing now beyond keeping heraldry as ordinary entitlements.
- **Well politics:** a season variant where well regeneration is votable per-island through the
  alliance community — the commons problem made explicit governance.

## 11. Programme impact

Target set grows **52 → 55**. Build order under the one-agent capacity constraint:

1. **`micro-aetherholm` phase 1** — schema, cities, lazy economy, build/research queues, the
   title contract, registry row. The highest-certainty slice, and it closes §3.3's title gap.
2. **`micro-aetherholm` phase 2** — wind lattice, fleets, battles, sieges, seasons, chronicle,
   alliance bindings.
3. **`micro-aetherholm-web`** — against the routes phase 1–2 actually serve, cited line by line.
4. **`micro-aetherholm-assets`** — art bible, content JSON, then the generation session, batched
   like the brand run.

Nothing here blocks, or is blocked by, deployment work — the two proceed independently.
