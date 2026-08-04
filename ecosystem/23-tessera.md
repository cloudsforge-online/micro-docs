# 23 — Tessera: the fourth Forge Worlds title, and the first place EMBER is earned

A persistent, user-made world you enter in a browser tab: claim ground, fire objects out of a
prompt, open a place people go to, and get paid in EMBER when they buy what you made. Land is
free and abundant; **location** is scarce, because attention is. Every unit of value in it is
EMBER that already exists on Hearth — the world mints nothing.

Like [19-new-products.md](19-new-products.md), [20-aetherholm.md](20-aetherholm.md) and
[21-engagement-treasury.md](21-engagement-treasury.md), this document extends the original scope:
the repositories it defines join the target set, and every rule in 01–17 applies unchanged. It is
the design authority for the title.

**A tessera** was a small fired tile — and, in Rome, a token: a tally, a ticket, a proof you were
who you said you were. Both meanings are load-bearing here. The world is a mosaic of tiles people
place, and every tile carries a proof of who made it.

---

> ## A NOTE ADDED AFTER THIS DESIGN WAS EXECUTED: Qwen-Image 2512 has been withdrawn.
>
> **This document is the design authority for Tessera and it was written before the run.** It is
> left in the tense it was written in, because a design document rewritten to match its outcome
> stops being evidence of what was decided in advance. But it names a second image model
> throughout, and that model is gone: the owner has withdrawn **Qwen-Image 2512** from the estate,
> and every `candidates/qwen-image-2512*` tree in all four asset repositories has been deleted
> along with its manifests, deployment records and registry entries.
>
> **So read every Qwen instruction here as history, not as a step to carry out.** In particular:
>
> - **§2 and §7's transposition instruction** (*"the Qwen request must send `H×W` to receive
>   `W×H`"`*) described a workaround for one endpoint's bug. The workaround is deleted with the
>   endpoint. **The detection is not** — `generate.ts` still measures every delivered non-square
>   image against what it asked for, for any provider, and `verify.py` still carries the check.
>   That distinction is deliberate and is argued in [24](24-asset-model-comparison.md) §6.1.
> - **The file paths under `candidates/qwen-image-2512/`** — including the `DEPLOYMENT.json` this
>   document cites for cost — **no longer resolve.** What those files recorded has been transcribed
>   into each repository's `COMPARISON.md` and is labelled there as no longer re-derivable.
> - **The two-model comparison this document argues for was run, completed, and concluded FLUX 2
>   Pro.** Tessera was the fair painterly brief §1 asks for, and the challenger lost that one too.
>   The findings are preserved in [24](24-asset-model-comparison.md) §4 and §5.
>
> **§1's constraint is unaffected and is the reason the provider seam was kept.** Neither model
> emits a mesh; the estate's 3D gap is still open, so the registry is still N-provider and
> `candidates/` still exists, empty, waiting for whatever is tried next.

## 1. The constraint, stated first, in the voice 19 used

[19-new-products.md:97](19-new-products.md) says it about creatures; it needs saying again, louder,
about a world:

> **What FLUX and Qwen do not solve, said plainly: they produce 2D.**

Neither FLUX 2 Pro nor Qwen-Image 2512 emits a mesh, a UV layout, a rig or a single frame of
skeletal animation. The estate's only 3D assets today are procedural glTF bakes
(`emberkin-web/src/game/render/scene.js:5-26` renders them; `19-new-products.md:97-100` records
that they stay procedural "until real modelling happens"). Nothing in this estate can author a
mesh, and nothing in this design pretends otherwise.

Second Life was a 3D world behind a 400 MB client. **We cannot build that, we are not going to
try, and the substitution is not a downgrade.** Tessera is **isometric, tile-based and painterly**,
rendered to a canvas in a browser tab with no download, because every other surface in this estate
loads in a tab and a title that needed an installer would be the only thing in the platform a user
could not simply open.

Three reasons this is the better medium here, not merely the available one:

1. **A diffusion model outputs finished art.** A mesh does not: it needs UVs, a rig, LODs, a
   lighting artist and a technical artist before it looks like anything. The single most-cited
   failure of user-generated 3D worlds is that user content looks bad. In Tessera user content
   cannot look bad, because the thing making it is a painter.
2. **Painterly hides what diffusion cannot hold steady.** A hand-painted world is *supposed* to
   vary from tile to tile. A flat-vector world is not — two vector chairs that disagree by three
   pixels read as a bug. This is the argument for painterly over flat, and it is reinforced below
   by a measured one.
3. **Isometric is authored, not simulated.** There is no physics to desync, no collision mesh to
   exploit, no camera to get stuck in a wall. The whole class of griefing that came from 3D
   physics simply has no surface here.

**What we give up, said honestly:** first-person immersion, free-look, flight, and the particular
feeling of standing at human scale in a space someone built. Those are real losses. They are the
price of shipping in a tab, and they are paid once, in this paragraph, rather than discovered in
week three of implementation.

### 1.1 Art direction — painterly, and why the choice is not neutral

Two facts decide it, and the second is measured rather than argued:

- Qwen-Image 2512 reads a flat-graphic brief **photographically**, and returns framed, bevelled
  game-UI artefacts whatever the prompt asks for. On the flat brand set it produced **7.1× the
  file size per megapixel** it produced on the painterly game sets (**2.6×**). A flat brief makes
  the two-model comparison one-sided before it starts — Qwen is not being asked a question it can
  answer.
- The owner has asked for **every asset generated by both models**. That is only worth the spend
  if the comparison is meaningful. Painterly gives Qwen somewhere to go.

So: **luminous painterly gouache, warm ash-and-ember key light against cool shadow, visible brush
economy, no outlines, no bevels, no gloss.** Grounds normalise numerically to `#12100f` as
everywhere else in this estate (`brand/normalise_ground.py:27` — `TARGET = (0x12,0x10,0x0F)`,
because FLUX will not hit an exact hex).

Game art follows the bible; **UI chrome wears Forge Worlds' accent `#6d9a49`**, as Emberkin and
Aetherholm both do (`ui/packages/ui/src/surfaces.ts:455` and `:477`) — a title wears its product's
colour rather than claiming its own.

---

## 2. The asset manifest — 392 assets, both models

This section is written to be **executed, not read**. It is first in the document because
generation is the long pole and an H100 is billing while it waits.

### 2.1 Projection and canvas rules

- **Projection: 2:1 dimetric isometric.** The base ground tile is **256×128**. A 1×1 object
  occupies one tile of floor and is authored on a **512×512** canvas (three tiles of headroom, so
  a lamp-post fits). A 2×2 object uses the same 512×512 canvas at half the depicted scale.
- **One canonical facing per object.** The second facing is a **horizontal mirror applied at
  render time**, not a second asset. This is not laziness, it is forced: `micro-studio` has **no
  `seed` column** — the generation schema at `studio/src/migrations.ts:154-252` records `prompt`,
  `backend_choice`, `backend`, `model`, `requested_size`, `attempts`, `cost_estimate`,
  `provider_cost_units`, `credit_state` and `checksum`, and nothing else. Grepping `seed` across
  `studio/src` returns no hits. **A pipeline that cannot fix a seed cannot render the same chair
  four times.** Four-facing objects become possible the day studio stores a seed; until then, two
  facings, and the design does not depend on more.
- **Every dimension is a multiple of 16.** FLUX floors to a 16-pixel grid
  (`studio/src/specs.ts:126-133`, `DIMENSION_GRANULARITY = 16`, and `requestSizeFor` rounds **up**
  at `:147-158`). Sizes that are not multiples of 16 — the 1200×630 OG card is the only one — are
  **derived** by cropping a compliant generation.
- **`width`/`height`, never `aspect_ratio`.** FLUX ignores `aspect_ratio`; the wire contract is
  pinned at `studio/src/backend.ts:12-17` and the lesson is repeated in all three asset repos'
  generator headers (`brand/generate.ts:16`, `emberkin-assets/generate.ts:8-9`,
  `aetherholm-assets/generate.ts:8-9`).
- **Qwen's `size` is transposed.** Request 1024×384 and you receive 384×1024, reported as
  1024×384. **For every non-square asset below, the Qwen request must send `H×W` to receive
  `W×H`.** Its wire contract is `POST /openai/v1/images/generations` with
  `{"model":"qwen--qwen-image-2512","size":"HxW",...}` (`brand/backends.ts:446-451`,
  `brand/providers.ts:19`); the deployment name `qwen--qwen-image-2512` is the id that works — the
  bare `Qwen-Image-2512` 404s (`brand/backends.ts:144-145`).
- **Transparency is a post-step, not a generation.** Diffusion does not emit alpha. Every object
  sprite is generated on the pinned `#12100f` ground and keyed to alpha by a `cutout.py` derive
  step, recorded in the manifest's `postProcessing` field — the same field
  `aetherholm-assets/MANIFEST.json:42` already carries on 91 of its 101 entries.

### 2.2 Repository layout

`micro-tessera-assets` follows the layout the other three asset repos already use, verified on
disk: **FLUX output in `assets/<set>/`, challengers in `candidates/<provider>/`** — declared at
`brand/providers.json` and were present as real files under each repository's
`candidates/qwen-image-2512/`. **They are not any more** — the model was withdrawn and every one of
those trees was deleted; see the note at the head of this document.

```
micro-tessera-assets/
  ART_BIBLE.md                     the direction, fixed before a single generation
  MANIFEST.json                    per-asset provenance, the shape below
  providers.json                   flux (assets/) + qwen-image-2512 (candidates/)
  content/                         canonical JSON — the same file drives engine and prompts
  assets/<set>/<slug>.png          FLUX 2 Pro
  candidates/qwen-image-2512/
    DEPLOYMENT.json                hours, mean seconds/generation, teardown state
    MANIFEST.json
    assets/<set>/<slug>.png
  generate.ts  normalise_ground.py  cutout.py  project_iso.py  verify.py  compare.py
```

**Two c2pa lessons this repo must inherit rather than relearn:**

- `brand` ships **almost no** C2PA — 96 of its 98 entries are `c2pa: false`, including all but two
  of its 56 FLUX generations, because `normalise_ground.py`'s PNG writer keeps no ancillary chunks
  and the re-encode drops the box the hash is bound to (`brand/verify.py:16-24`,
  `brand/MANIFEST.json:7`). **The two exceptions prove the rule rather than weakening it:**
  `assets/currency-ember/mark-1024x1024.png` and `assets/currency-spark/mark-1024x1024.png` were
  generated after the comparison concluded and never went through the normaliser, so they still
  carry the chunk. `emberkin-assets` and `aetherholm-assets` fixed it properly by copying ancillary
  chunks through (`aetherholm-assets/MANIFEST.json:8`). **Tessera uses the fixed writer from the
  first asset.**
  *(Counts corrected 2026-08-03 against `brand/MANIFEST.json`; this line previously read "zero"
  and "all 94 entries". `brand/COMPARISON.md:8,224` still carries the pre-currency figures —
  see [24](24-asset-model-comparison.md) §8.2.)*
- `emberkin-assets/verify.py` has **no c2pa check at all** — `grep -c c2pa` on it returns 0, so its
  83 `c2pa: true` entries are asserted by `generate.ts:509-510` at write time and never measured.
  **Tessera's `verify.py` measures c2pa off the bytes**, the way `brand/verify.py:328-331` and
  `aetherholm-assets/verify.py:300-303` do: `carries_c2pa = b"c2pa" in data`, compared against the
  manifest flag. The estate measures c2pa and never asserts it; a repo that asserts it is a repo
  that will be wrong quietly.

### 2.3 The totals

| # | Set | Count | Generated | Derived | Canvas |
| --- | --- | --- | --- | --- | --- |
| 1 | Terrain material plates | 32 | 32 | 0 | 1024×1024 |
| 2 | Terrain tiles (projected, cut) | 96 | 0 | 96 | 256×128 |
| 3 | Seed objects | 96 | 96 | 0 | 512×512 |
| 4 | Structure kit | 24 | 24 | 0 | 512×512 |
| 5 | Avatar bases | 8 | 8 | 0 | 256×512 |
| 6 | Avatar overlays | 40 | 40 | 0 | 256×512 |
| 7 | Ward backdrops | 8 | 8 | 0 | 1536×640 |
| 8 | Time-of-day variants | 8 | 8 | 0 | 1536×640 |
| 9 | Kiln & provenance art | 8 | 8 | 0 | 768×768 |
| 10 | Tool & category glyphs | 24 | 24 | 0 | 256×256 |
| 11 | Status & economy icons | 16 | 16 | 0 | 256×256 |
| 12 | Parcel markers, gates, beacons | 12 | 12 | 0 | 512×512 |
| 13 | Key art, social, wordmark ground | 6 | 4 | 2 | mixed |
| 14 | Title chrome | 8 | 2 | 6 | mixed |
| 15 | Event & season splashes | 6 | 6 | 0 | 1024×1024 |
| | **Total** | **392** | **288** | **104** | |

**Sanity check against the estate.** The three existing asset repos hold **332** entries — **233
generated, 99 derived** — verified by counting `derivedFrom` across the three `MANIFEST.json`
files: `brand` 94 (54/40), `emberkin-assets` 137 (83/54), `aetherholm-assets` 101 (96/5). Tessera's
288/104 is **73% generated**, against the estate's 70%. The set is larger than any predecessor
because in a world-building title **the asset set is the product**: Aetherholm's art decorates a
strategy game that would still function as a spreadsheet, and Tessera's art *is* the place.

**Both models, so 784 files on disk.** 392 under `assets/`, 392 under
`candidates/qwen-image-2512/assets/`.

**Estimated spend**, from the measured economics of the three completed runs (computed over kept
generated entries): FLUX averaged **3.0 provider units** and **1.5–2.1 calls per kept asset** —
`brand` 54 kept / 26 retries / 162 units, `emberkin` 83 / 46 / 250.5, `aetherholm` 96 / 107 / 289.5.
So 288 kept ⇒ **~440–600 FLUX calls, ~870 provider units**. Qwen bills by deployment hour, not by
image: the deployment record — since deleted with the candidate trees, and transcribed into each
repository's `COMPARISON.md` — recorded 233 generations in **0.7 hours**
at a mean **10.8 s** each, so 288 ⇒ **~1.0–1.5 deployment-hours**.

> **Live cost defect, recorded rather than inherited:** that same file says
> `teardown.state: "NOT TORN DOWN — STILL BILLING"`. The Qwen A100 deployment from the previous run
> was never torn down. Tessera's generation session must tear its deployment down and record the
> teardown, and somebody should check the standing one now.

### 2.4 Set 1 — Terrain material plates (32 generated, 1024×1024)

Eight ward archetypes × four plates. A plate is a **flat-on painterly material sheet**, not a tile:
diffusion cannot hold an isometric seam, so the seam is produced by `project_iso.py` from a plate
that never had to tile in the first place. Slug form `terrain/<ward>-<plate>`.

| Ward archetype | The place it is | Plates |
| --- | --- | --- |
| `ashfield` | Warm grey volcanic grit, ember-lit, the founding ward | ground · path · verge · water |
| `terrace` | Cut stone steps and planted ledges climbing a slope | ground · path · verge · water |
| `wharf` | Salt-bleached boards over dark water, rope and tar | ground · path · verge · water |
| `undercroft` | Vaulted brick beneath the city, lamplit, no sky | ground · path · verge · water |
| `glasshouse` | Iron frame and green glass, condensation, hot light | ground · path · verge · water |
| `kilnyard` | Fired clay, brick stacks, heat shimmer, the maker's ward | ground · path · verge · water |
| `grove` | Deep loam, moss, filtered canopy light | ground · path · verge · water |
| `saltflat` | Cracked white pan, mineral crust, huge flat sky | ground · path · verge · water |

Prompt template per plate: *"painterly gouache material sheet, {ward description}, {plate} surface,
flat overhead view, even light, no objects, no shadows cast by anything off-sheet, warm
ash-and-ember key against cool shadow, visible brush economy, no outlines"* — the ward description
column above is the substitution, and it lives in `content/wards.json` so the engine and the
prompts cannot drift, exactly as Emberkin's `visuals.json` drives its species prompts.

### 2.5 Set 2 — Terrain tiles (96 derived, 256×128)

Twelve tiles per ward, cut and projected from that ward's four plates by `project_iso.py`. Derived,
so `derivedFrom` names the plate. Slug form `tiles/<ward>-<tile>`.

`ground-a` · `ground-b` · `ground-worn` · `path-straight` · `path-corner` · `path-tee` · `verge` ·
`verge-corner` · `step` · `water` · `water-edge` · `rubble`

`ground-a` and `ground-b` are cut from **different regions of the same plate** so the ground varies
without a second generation — this is where painterly earns its keep, because two cuts of one
painting agree with each other and two vector tiles would not.

### 2.6 Set 3 — Seed objects (96 generated, 512×512)

The platform-authored starter set: **twelve categories of eight**, free to every account forever,
never sold, never removed. This set is the counterweight that makes the Kiln honest — see §7 — so
its size is a commitment, not an estimate. Slug form `objects/<category>-<slug>`.

| Category | The eight |
| --- | --- |
| `seating` | stool · bench · armchair · floor-cushion · long-bench · stump-seat · hammock · high-chair |
| `surfaces` | work-table · round-table · counter · desk · low-table · slab · market-trestle · potting-bench |
| `storage` | crate · barrel · chest · shelf-unit · cabinet · basket-stack · wall-rack · strongbox |
| `lighting` | lantern-post · wall-sconce · brazier · hanging-lamp · candle-cluster · lantern-string · floor-lamp · ember-bowl |
| `structure` | doorway-arch · window-frame · pillar · staircase · balustrade · awning · gate-post · roof-vent |
| `flooring` | rug-woven · rug-round · tile-inlay · boardwalk-patch · mosaic-medallion · straw-mat · hearth-slab · painted-circle |
| `foliage` | potted-fern · sapling · hedge-block · flower-trough · climbing-vine · mushroom-cluster · reed-clump · branch-vase |
| `signage` | hanging-shopsign · sandwich-board · painted-wallsign · banner-vertical · notice-board · direction-post · number-plaque · pennant-line |
| `machines` | hand-press · loom · bellows · water-pump · orrery · still · grindstone · small-kiln |
| `instruments` | upright-piano · drum-pair · lute · chimes · horn-stand · music-stand · gramophone · bell |
| `vehicles` | handcart · moored-rowboat · leaning-bicycle · wheelbarrow · sledge · palanquin · cargo-trolley · dry-docked-skiff |
| `ornament` | statue-bust · tall-urn · wind-mobile · standing-mirror · birdcage · folding-screen · small-fountain · wall-mask |

Prompt template: *"single {slug} in painterly gouache, three-quarter isometric view from above-left,
2:1 dimetric, standing alone on a flat `#12100f` ground, warm ash-and-ember key light from the
upper left, cool shadow, no outline, no bevel, no gloss, no background, no other objects"*.
Footprint (`1x1` or `2x2`) is a field in `content/objects.json`, not something the model is asked
to infer.

### 2.7 Set 4 — Structure kit (24 generated, 512×512)

Building parts, which players assemble rather than model. Slug form `structure/<slug>`.

`wall-plain` · `wall-plaster` · `wall-brick` · `wall-timber` · `wall-glass` · `wall-half` ·
`door-single` · `door-double` · `door-arched` · `window-square` · `window-round` · `window-tall` ·
`stair-straight` · `stair-corner` · `stair-spiral` · `roof-gable` · `roof-flat` · `roof-tiled` ·
`floor-plank` · `floor-stone` · `floor-tile` · `fence-picket` · `fence-iron` · `fence-hedge`

### 2.8 Sets 5–6 — Avatars (48 generated, 256×512)

**Non-square: Qwen requests `512×256` to receive `256×512`.**

A Tessera avatar is a **paper doll**: one base plus overlays composited at render time, which is
how a 2D world gets combinatorial appearance out of 48 assets instead of thousands.

**Set 5 — bases (8):** four builds × two poses (`front`, `side`); the remaining two facings are
mirrors. Slugs `avatar/base-{a,b,c,d}-{front,side}`.

**Set 6 — overlays (40):** five slots × eight, slug form `avatar/<slot>-<slug>`.

| Slot | The eight |
| --- | --- |
| `hair` | crop · braid · long-loose · topknot · curls · shaved · wrapped · tousled |
| `top` | tunic · jacket · apron-smock · shirt-sleeves · shawl · long-coat · vest · robe |
| `legs` | trousers · long-skirt · work-shorts · wrap-skirt · breeches · layered-skirt · overalls · leggings |
| `feet` | boots · sandals · clogs · bare · tall-boots · slippers · work-shoes · wrapped |
| `held` | satchel · lantern · tool-belt · sketchbook · basket · umbrella · cat · walking-stick |

Every overlay is generated **against the same base silhouette**, which is stated in the prompt and
checked by `verify.py` as a bounding-box match — the paper-doll registration problem is the one
place this pipeline can fail invisibly.

### 2.9 Sets 7–8 — Backdrops (16 generated, 1536×640)

**Non-square: Qwen requests `640×1536` to receive `1536×640`.**

**Set 7 (8):** one horizon backdrop per ward archetype, slug `backdrop/<ward>-day`.
**Set 8 (8):** dusk and night variants for the four wards where time of day carries the mood —
`ashfield`, `wharf`, `glasshouse`, `grove`. Slugs `backdrop/<ward>-{dusk,night}`.

### 2.10 Set 9 — Kiln & provenance art (8 generated, 768×768)

The Kiln is a **place in the world**, not a modal dialog, so it needs art. Slug form `kiln/<slug>`.

`kiln-mouth` · `firing` · `cooling-rack` · `provenance-seal` · `authorship-anchor` ·
`licence-plate` · `retirement-mark` · `kiln-empty`

`provenance-seal` and `authorship-anchor` are the two a user sees most: the first is what a finished
object wears, the second is what appears when authorship is written to Hearth.

### 2.11 Set 10 — Tool & category glyphs (24 generated, 256×256)

Twelve category glyphs, one per object category in §2.6 — `seating` · `surfaces` · `storage` ·
`lighting` · `structure` · `flooring` · `foliage` · `signage` · `machines` · `instruments` ·
`vehicles` · `ornament`.

Twelve tool glyphs — `place` · `move` · `rotate` · `remove` · `paint` · `terrain` · `measure` ·
`camera` · `select` · `group` · `lock` · `undo`.

Glyphs sit on brand ground with CVD-safe distinctions per the corrected accent method in `ui/`,
the same rule Emberkin's type icons follow (`19-new-products.md:91`).

### 2.12 Set 11 — Status & economy icons (16 generated, 256×256)

`ember-coin` · `spark` · `deed` · `parcel` · `homestead` · `beacon` · `gate` · `ward` ·
`footfall` · `dwell` · `fallow` · `escrow` · `royalty` · `payout` · `pending` · `available`

`pending` and `available` are not decoration. The economy shows a **pending** balance and an
**available** balance as two separate figures (§6), and they need to be distinguishable at 16 px by
someone who cannot tell the two accent colours apart.

### 2.13 Set 12 — Parcel markers, gates, beacons (12 generated, 512×512)

`gate-arch` · `gate-lit` · `boundary-stone` · `boundary-post` · `beacon-unlit` · `beacon-lit` ·
`homestead-marker` · `fallow-marker` · `for-sale-post` · `venue-marker` · `workshop-marker` ·
`commons-obelisk`

### 2.14 Sets 13–15 — Title art (20: 12 generated, 8 derived)

**Set 13 — key art and social (6: 4 generated, 2 derived).**

| Slug | Size | Source |
| --- | --- | --- |
| `keyart/hero` | 2048×1152 | generated |
| `keyart/wide` | 2048×768 | generated |
| `keyart/social-square` | 1024×1024 | generated |
| `keyart/wordmark-ground` | 1536×512 | generated |
| `keyart/og-1200x630` | 1200×630 | **derived** from `keyart/wide` — 630 is not a multiple of 16, so it is cropped, never requested |
| `keyart/social-wide` | 1600×900 | **derived** from `keyart/hero` |

**Set 14 — title chrome (8: 2 generated, 6 derived).** `chrome/mark` (1024×1024, generated) and
`chrome/capsule` (1024×512, generated); then `favicon-32`, `favicon-192`, `favicon-512`,
`apple-touch-180`, `og-title`, `wordmark-lockup` all **derived from the mark** — the accounting
Aetherholm's run recorded ("favicons cut from the mark, wide cards composited",
[20-aetherholm.md:184](20-aetherholm.md)).

**Set 15 — event & season splashes (6 generated, 1024×1024).** `splash/firstlight` (launch) ·
`splash/the-long-dusk` · `splash/harvest-of-tesserae` · `splash/the-open-kiln` ·
`splash/ward-founding` · `splash/the-quiet-hours`.

### 2.15 What `verify.py` must check, per asset

Carried forward from `brand/verify.py:9-30` and `aetherholm-assets/verify.py`, plus two new ones
this title needs:

1. Dimensions read **from the bytes**, matched against `deliveredSize`.
2. `sha256` recomputed from the bytes.
3. **`c2pa` measured off the bytes** (`b"c2pa" in data`) and compared to the manifest flag — the
   check `emberkin-assets/verify.py` does not have.
4. Ground sampled at four corners against `#12100f`.
5. Accent hue coverage for chrome assets.
6. `assetCount` equals `len(assets)`; cross-provider parity between `assets/` and
   `candidates/qwen-image-2512/assets/`.
7. **New — footprint registration:** every avatar overlay's opaque bounding box lies within its
   base's silhouette. A misregistered overlay is invisible in a contact sheet and obvious in play.
8. **New — Qwen transposition:** for every non-square asset, the Qwen candidate's *measured*
   dimensions equal the FLUX asset's, not their transpose. This catches the `size` bug at verify
   time rather than at contact-sheet time.

---

## 3. What it is, in three sentences

Tessera is a persistent isometric world in a browser tab where the ground is free and the only
scarce thing is other people's attention: you claim a Homestead nobody can ever take, describe an
object into existence in the Kiln, and open a place for people to walk into. Everything anyone
makes is content-addressed by the sha256 of its own bytes, so authorship is not a claim anybody
files but a fact about the file — which is what turns Second Life's copybot problem from a policing
exercise into an accounting one. And every unit of value that moves is **EMBER that already exists
on Hearth**, because the world has no mint: a creator paid 400 Sparks is paid coin somebody else
deposited, and they can withdraw it to their own wallet the same afternoon.

### 3.1 Scale, against the named reference

| Dimension | Second Life | Tessera |
| --- | --- | --- |
| Client | ~400 MB download, GPU required | **A browser tab.** Canvas 2D, no install, no plugin |
| Dimension | 3D, free-look, physics | **2D isometric, 2:1 dimetric.** §1 |
| Creation tool | in-world prims + Blender/Maya + a month of tutorials | **A prompt.** `micro-studio`, FLUX 2 Pro, provenance per asset |
| Scripting | LSL, a bespoke language | **None in v1.** Deliberately — §6.6 |
| Land supply | fixed, operator-controlled, sold | **Elastic.** New wards mint at 70% occupancy; the platform never sells land |
| Land cost | US$ tier fees, monthly, punishing | **Free to claim.** Held by liveliness, not by rent |
| Object budget | prims, sold as a tier upgrade | **Fixed per parcel tier, never purchasable.** §6.2 |
| Currency | Linden Dollar, an operator IOU | **EMBER**, a CPU-mined chain asset, denominated in **Sparks** |
| Cash-out | LindeX + a US$ processor + weeks | **A chain withdrawal.** No fiat path exists anywhere in this estate |
| Anti-theft | DMCA takedowns, after the fact | **Content-addressed authorship + a ledger that enforces royalties**, §9 |
| Governance | operator support tickets | **`micro-community`** — proposals, votes, officers, timelocks |
| Discovery | search that did not work; vast empty regions | **Footfall and dwell**, on the shared activity timeline. Never purchasable |
| Concurrency per region | ~40–100 avatars | **60 per ward instance**, then the ward shards |
| Where it is deliberately smaller | — | No 3D, no physics, no voice, no scripting, no flight, no user-run servers, no adult-content economy |

That last row is not a roadmap. Voice, scripting and physics are the three things most likely to be
asked for and each is refused for a stated reason in §6.6.

## 4. The world

**The Mosaic** is a set of **wards**. A ward is a **256×256 tile grid** — 65,536 tiles — generated
from the world seed against one of eight archetypes (§2.4). It has one **Gate**, which is where
arrivals land, and **Ways** radiating from it, which are public and cannot be claimed.

**Three quarters of a ward is claimable; one quarter is permanently public.** 49,152 tiles of
65,536 may be held; the remaining 16,384 are Ways, verges and the ward Commons. This is a hard
number with a reason: a ward where every frontage is private becomes a corridor of walls, and the
one thing a social world cannot recover from is having nowhere to stand.

**Land is claimed, not bought, and the platform never sells it.** A parcel is a claim over a
rectangle of tiles in one of four tiers (§6.2). Claiming free land costs nothing. Parcels are
traded **between players** on `micro-market`, and the platform takes its ordinary 2.5% fee on that
trade (`market/src/env.ts:183`, `MARKET_PLATFORM_FEE_BPS` default 250) — but it never mints supply
for money, because a platform that sells land has a permanent incentive to keep land scarce, and
that incentive is precisely what strangled the reference.

**Supply is elastic; location is not.** When a ward crosses **70% occupancy**, the next ward mints
automatically. So there is always free ground. What there is not always is *good* ground: a parcel
on a Way, three tiles from a busy Gate, is scarce because the footfall passing it is scarce, and
footfall is scarce because human attention is. **Scarcity here is positional and earned, never
manufactured.** You get a good location by making somewhere people go, or by buying it from
somebody who did.

**The Homestead is the floor nobody can take.** Every account may claim exactly one **16×16
Homestead**, free, forever. It is **never fallow, never contestable, and not tradeable** — a
partial unique index makes a second one unrepresentable (§9). Everything above the Homestead is
subject to the fallow rule; the Homestead is not. You can always come home, and you cannot hoard
the commons.

**Fallow, which replaces rent.** A non-Homestead parcel with **no visitor and no edit for 90 days**
becomes `fallow`; after a further **30 days** its claim may be contested by anyone. An owner may
**bank** a parcel once per year, extending the clock to 270 days, free. This is the structural
answer to the reference's dead continents: there, empty land stayed empty because its owner paid
rent to hold it and nobody could reclaim it. Here, dead land returns to the commons and nobody pays
rent at all.

Fallow is **computed lazily on read** from `(lastFootfallAt, lastEditAt, bankedUntil)` and settled
on write — the Aetherholm discipline ([20-aetherholm.md:139-141](20-aetherholm.md)). There is no
per-day sweep marking parcels dead, because that would be a timer doing domain work and CI
forbids it (`org/.github/workflows/service-ci.yml:1043-1054`).

**Persistence means Postgres, and nothing else.** The authoritative world is rows in
`micro-tessera`'s database. The client is a viewer: it renders what it is told and decides nothing.
Nothing runs on a player's machine but a canvas, no per-user simulation process exists, and there is
no per-ward tick. An object placed is a row; it is there in ten years unless somebody moves it.

**Presence is push-on-change, not polled.** A move writes a row and raises a Postgres `NOTIFY`; the
SSE handler forwards it. There is no broadcast timer anywhere — which is both the rule and, here,
the simpler design. A ward instance carries **60 avatars**; the 61st arrival opens instance 2, and
the ward's own page says which instance holds whom, because a friend you cannot find is worse than
a crowd you cannot join.

## 5. The loop

```
   arrive at the Commons                     a browser tab; no download, no plugin, no account wall
              │
              ▼
   claim a Homestead                         16x16, free, one per account, never fallow, never taken
              │
              ▼
   fire an object in the Kiln                a prompt, not a modelling skill
              │                              micro-studio generates; the sha256 IS the identity
              ▼
   place it; open your gate                  a parcel with an open gate is a place people can enter
              │
              ├──► someone walks in                 footfall and dwell — the only ranking signals
              ├──► they buy what you made           micro-market, custodial, royalty enforced at
              │                                     settlement, not requested afterwards
              ├──► they hire the place              a Venue booking is an escrowed ledger hold
              └──► the ward decides something       micro-community: proposals, one member one vote
              │
              ▼
   EMBER lands in your AVAILABLE account      creator_payout / royalty_paid — double-entry, and the
              │                               counterparty is another human being, not the platform
              ▼
   withdraw to your own wallet on Hearth      settlement signs and broadcasts; ~15 min at depth 60
              │
              ▼
   it was never ours to begin with
```

The loop ends on a chain transaction because that is the only ending that proves the rest of it.
A creator economy whose last arrow points back into the platform is a scrip system.

## 6. Systems at scale

Counts are the contract implementation is built against. The trees live as canonical JSON in
`micro-tessera-assets/content/`, so the engine and the art prompts read the same file and cannot
drift — the Emberkin pattern ([19-new-products.md:86](19-new-products.md)).

### 6.1 Space

| Thing | Count |
| --- | --- |
| Ward archetypes | **8** (§2.4) |
| Wards at launch | **12** — the Commons plus eleven themed |
| Ward grid | **256×256 = 65,536 tiles** |
| Claimable share of a ward | **75%** (49,152 tiles); 25% permanently public |
| New-ward trigger | **70% occupancy** |
| Parcel tiers | **4** |
| Ward instance capacity | **60 avatars** |
| Ward governance | one `micro-community` community per ward |

### 6.2 Parcel tiers, and the object budget

The object cap is **five objects per eight tiles**, applied uniformly. It is a **rendering budget**,
it is stated as one, and it is **not purchasable at any price** — the reference sold prims, which
converted "how much can you build" into "how much can you pay", and that is the exact conversion
§7 forbids.

| Tier | Tiles | Object cap | Per account | Fallow? | Tradeable? |
| --- | --- | --- | --- | --- | --- |
| Homestead | 16×16 = 256 | **160** | exactly 1, free | **never** | **no** |
| Plot | 32×32 = 1,024 | **640** | up to the Deed Slot cap | yes | yes |
| Court | 64×64 = 4,096 | **2,560** | up to the Deed Slot cap | yes | yes |
| Quarter | 128×128 = 16,384 | **10,240** | up to the Deed Slot cap | yes | yes |

A ward's claimable area is therefore **48 Plot-equivalents**, or 192 Homesteads, or 12 Courts, or 3
Quarters, or any mix summing to 49,152 tiles.

**Deed Slots** — how many non-Homestead parcels one account may hold at once — start at **2** and
are the one space-related thing money buys (§7.3). They are **capped at 12 by a CHECK constraint**
regardless of spend, so money buys you up to the cap and never past it.

### 6.3 Things

| Thing | Count |
| --- | --- |
| Object categories | **12** (§2.6) |
| Platform seed objects, free forever | **96** |
| Structure kit parts | **24** |
| Avatar bases | **4 builds × 2 poses = 8** |
| Avatar overlay slots | **5**, eight options each |
| Distinct avatars from 48 assets | **4 × 8⁵ = 131,072** before colourway |
| Object footprints | **2** — `1x1` and `2x2` |
| Facings per object | **2** — one canonical render plus its mirror (§2.1) |

### 6.4 Social spaces — six kinds

**Commons** (platform-held, one per ward, never claimable) · **Gate** (arrival, public) ·
**Parcel** (private by default, gate open or shut) · **Venue** (a parcel flagged for events; gains
Beacon rights and a bookable calendar) · **Workshop** (a creator's public storefront; the only
space that lists) · **Kiln** (where objects are fired — a place, not a modal).

### 6.5 Discovery — two signals, neither for sale

| Signal | What it measures |
| --- | --- |
| **Footfall** | distinct accounts that entered the parcel, per day |
| **Dwell** | median seconds those accounts stayed |

That is the whole ranking function, and the shortness is the point. Dwell is included because
footfall alone rewards a doorway that tricks people in; dwell punishes it. **There is no third
signal, and specifically there is no paid one — ever.** See §7.1.

**Beacons** light a Venue for an event and appear in the feeds of people following that ward or
that creator. Free, and rate-limited to **3 per parcel per 7 days** — a limit that exists so that
a Beacon means something, and which cannot be raised by paying.

Discovery rides `micro-activity`, the estate's shared timeline. That is a real integration with
real constraints, spelled out in §11.

### 6.6 Deliberately not doing, each with its reason

- **No scripting language.** The reference's LSL was its best feature and its worst attack
  surface. A user-authored script executing on our servers is arbitrary code execution with a
  friendly name, and this estate's whole security posture (`12-security-decisions.md`) is built the
  other way. Interactivity in v1 is a fixed vocabulary: a door opens, a seat seats, a sign says, a
  Workshop sells. If scripting ever lands it lands as a sandboxed, declarative, non-Turing-complete
  behaviour grammar, and that is a separate design document.
- **No voice.** Voice moderation is a full-time human function, not a feature, and a world that
  ships voice before it can moderate it has shipped a harassment vector.
- **No physics.** §1.
- **No user-run servers.** The authoritative world is one database; a federated Tessera is a
  different product with a different trust model.
- **No adult-content economy.** The reference's was large, and building the age-assurance and
  payment-risk apparatus it requires is a company, not a feature. `worlds` already models
  `ageBracket` and `parentalControls` (`worlds/src/players.ts:52-64`) and **enforces neither** —
  no route sets a sanction and `parentalControls` is accepted as free-form JSON at
  `worlds/src/server.ts:602-604` and never read by any decision. Building on an unenforced gate
  would be the worst version of this.
- **No land sold by the platform, at any tier, ever.** §4.

---

## 7. No pay-to-win, in a world whose entire point is commerce

`01-product-vision.md:128` states the rule:

> **No pay-to-win.** In Forge Worlds, purchasable means cosmetic, convenience or access — never
> power. Scarcity is the game.

A world about property and trade looks like it violates that on its face, so the rule has to be
resolved here, in writing, because every later implementation decision leans on the resolution.

### 7.1 What "power" means when there is no win condition

Tessera has no victory, no ladder, no stats and nothing to lose a fight with. So "power" cannot
mean what it means in Aetherholm, where a bought shield is power on the defensive axis
([20-aetherholm.md:96](20-aetherholm.md)). It needs a definition that survives having no combat:

> **Power is the ability to affect another player's experience against their will.**

Everything else — space, appearance, capacity, convenience — affects only your own. That single
line resolves every case, and it resolves them the way the owner's instinct predicted, but it does
so from a definition rather than from taste, which is what makes it hold up under a SKU proposal
nobody has thought of yet.

Four things in this world could affect someone against their will. Each becomes a refusal.

**1. Visibility — discovery cannot be bought. Ever.**
This is the one that matters most, because it is the one every virtual world eventually sells and
it is unambiguously advantage over another player: a promoted parcel takes footfall *from* an
unpromoted one, and footfall is the only scarce resource in the design (§4). So: **no promoted
placement, no paid ranking, no sponsored beacons, no boost.** The feed is ordered by footfall,
dwell and recency, and by nothing else, forever. If Tessera ever needs money badly enough to sell
discovery, it needs to be shut down instead.

**2. Voice — governance cannot be bought.**
A ward is a `micro-community` community and votes are **one member, one vote**. That is also the
only resolver actually implemented: `WeightResolver` is a typed seam
(`community/src/votes.ts:111-114`), the sole implementation is `oneMemberOneVote` returning `1n`
(`community/src/votes.ts:122-124`), and the server falls back to it because `deps.weights` is
optional and unwired (`community/src/server.ts:861`, `:168`). **Tessera must never wire a
token-weighted resolver for wards.** Buying votes is buying power over people, and here the code
already agrees.

**3. Safety — protection cannot be bought.**
No purchasable privacy, no paid ban-immunity, no premium moderation queue. Gate controls,
blocking, and appeal to ward governance are free to every account including brand-new ones. A
safety feature behind a paywall is a protection racket with a price list.

**4. Space — land cannot be bought *from the platform*.**
§4. Parcels are claimed free and traded between players; the platform takes a transaction fee and
never mints supply for money.

### 7.2 The sharpest edge, argued rather than dodged

Buying Kiln capacity means making more objects, which means having more to sell, which means
earning more. Is that power?

**No — because income is output, not advantage.** A creator with a bigger workshop has not taken
anything from another creator; they have made more things, which is the behaviour the world exists
to produce. Paying for production capacity is how every real creative economy has ever worked, and
this estate already sells exactly this shape: generation has a genuine marginal cost in USD
(`studio/src/credits.ts:43` holds spend as `UsdMicros`, the cap is a DB CHECK
`credit_accounts_within_cap` at `studio/src/migrations.ts:146-147`, and exceeding it is a 402 at
`studio/src/credits.ts:52-71`). `15-monetisation-model.md` §2 calls work with a marginal cost "the
easiest revenue to explain and the hardest to resent", and it is right.

But that argument only holds while one condition is true, so the condition is written down as a
fifth refusal:

**5. The take is the same for everybody.**
The platform fee and the royalty cap are **identical for every account**, and **no SKU, tier or
subscription reduces either**. A subscription that cut your marketplace fee would convert money
directly into structural earning advantage over every creator who did not buy it — which is
compound, permanent, and exactly the thing §7.1 forbids. The rates are snapshotted onto each
listing at creation (`market/src/listings.ts:29`, `market/src/migrations.ts:218`), so this is
checkable per order rather than promised in a document.

And the free tier is what keeps the whole argument honest: **96 seed objects, free to every
account forever** (§2.6), plus a **free daily firing allowance**. Nobody is ever unable to build.

### 7.3 So what is actually sold

| SKU | Kind | What it grants |
| --- | --- | --- |
| Kiln capacity | metered | firings beyond the free daily allowance. Priced against real provider cost |
| Deed Slots (2 → 12) | entitlement | how many non-Homestead parcels you may hold at once. **Capped at 12 by CHECK, at any price** |
| Appearance sets | entitlement | avatar overlays, parcel skins, gate styles, beacon colours |
| Name reservation | entitlement | a held ward or Workshop name |
| Private Ward | subscription | a ward for a group. **This SKU already exists** — `world.private.small`, 750, 30-day, title-scoped (`billing/src/migrations.ts:405`, `:418`) and no title serves it today |
| Venue calendar | subscription | bookings, ticketing, recurring events — convenience for someone running a place |

**Refusals, stated once and testable:** no discovery, no votes, no safety, no land from the
platform, no object-cap increases, no fee or royalty discount, no loot boxes, no gambling, no
parcel or object as a tradeable chain token that a title mints for money. §12 asserts each one as
an absence with a test, the way `admin-web` asserts its missing og card.

## 8. The economy: EMBER, and Sparks

### 8.1 One asset, not two — and Sparks is a denomination, not a currency

**Shards do not appear in this title.** They are being removed estate-wide; a Shard was one US cent
by definition (`contracts/packages/chain/src/index.ts:146` — `SHARDS_PER_USD = 100n`, "100 Shards =
1 USD, fixed") and its `ChainSpec` says the quiet part out loud at `:112-120`:
`family: 'evm', // never used on chain`. Shards were a US-dollar unit wearing a chain's clothes.

The ledger asset for Tessera is **`EMBER`**. This costs no schema change: `accounts.asset_code` and
`postings.asset_code` are plain `text`, not an enum (`ledger/src/migrations.ts:121`, `:220`), the
balancing invariant is enforced per `asset_code` by trigger (`ledger/src/migrations.ts:302-313`),
and money is `numeric(78,0)` chosen precisely because "78 digits holds any uint256"
(`ledger/src/migrations.ts:215`). EMBER has 18 decimals
(`contracts/packages/chain/src/index.ts:53`); wei is a uint256; it fits with room to spare.

**A Spark is 10⁻⁶ EMBER — one micro-EMBER, exactly 10¹² wei.** And the most important sentence in
this section:

> **Sparks is a display denomination of EMBER. It is not a second `assetCode`, and it must never
> become one.**

If Sparks were its own asset code, the ledger's per-asset balancing trigger would happily let
Sparks and EMBER drift apart, and reconciling them would require a rate — and a rate between an
internal unit and a chain asset is precisely the mechanism of the estate's oldest defect, the
`convertCoinToEmber` path that "credit[s] custodial EMBER with no on-chain movement behind it"
(`ledger/src/migrations.ts:540`, again at `:550`, and `wallet/src/money.ts:41-43`: "a liability
minted against nothing, with no counter-account and therefore nothing that could ever notice").
**One asset, one trial balance, one number to reconcile against the chain.** Sparks is what the
client prints.

The formatters already cope: `formatAmount(smallestUnits, decimals)`
(`contracts/packages/chain/src/index.ts:187`) and `formatMoney` via `assetDecimals`
(`contracts/packages/money/src/index.ts:900`, `:86-93`) are decimals-driven, not cents-driven, so
EMBER formats at 18 places today with no change. What must be rewritten is the Shard-specific
conversion layer, and one line in it deserves naming because it will bite silently:
`contracts/packages/money/src/index.ts:239` takes `assetCode: LedgerAssetCode = 'SHARD'` **as a
default parameter** — a silent fallback that will keep producing SHARD postings long after
everything visible has been changed.

**The legibility contract.** The ratio exists so that ordinary prices are short integers:

| Thing | Sparks | EMBER |
| --- | --- | --- |
| A tip | 5 | 0.000005 |
| A common object | 400 | 0.0004 |
| A good object from a known maker | 5,000 | 0.005 |
| A month on a prime Plot | 40,000 | 0.04 |
| A Homestead | **free** | — |

EMBER's launch price is unknowable — Hearth's mainnet is not live — so if these turn out illegible,
**the design reprices the objects and never redenominates the unit.** A currency whose subunit is
redefined after launch is a currency nobody trusts, and that is a worse failure than a chair
costing an awkward number.

**And a Spark is the floor, enforced in the schema.** Every in-world price is stored in wei and
carries `CHECK (price_wei % 1000000000000 = 0)` — no price finer than one Spark. Prices are
`bigint` in TypeScript and decimal strings on the wire, never a JSON number, following
`market/src/money.ts:222-227` where `parseAmount` requires `/^\d{1,78}$/` **before** calling
`BigInt`, which is how that repo makes the `BigInt('') === 0n` hazard unreachable rather than
merely handled.

### 8.2 Pending and available — two accounts, not two columns

The owner asked for a visible pending-versus-available split. This estate already has the shape,
and it is architectural rather than cosmetic. `ledger/src/accounts.ts:9`:

> **The available/reserved split is two accounts, not two columns.** Reserving funds is a posting
> from `available` to `reserved`, which makes a reservation auditable, reversible and impossible to
> lose track of.

An account is `(subject, asset_code, purpose)` and nothing else (`ledger/src/accounts.ts:4`), and
the purpose set is closed — `available | reserved | escrow | treasury | fees | payout_due |
suspense` (`contracts/packages/money/src/index.ts:309`). So Tessera needs no new concept at all.
But there are **two different things a user calls "pending"**, and conflating them is how you
recreate the estate's oldest bug:

**Pending-out — money that is yours, clearing.** Sale proceeds sit in
`user:<id> / EMBER / payout_due` for the listing's dispute window, then release to `available`.
`micro-market` already does exactly this: the window is snapshotted onto the listing at creation
(`market/src/migrations.ts:234-238`, `market/src/orders.ts:298`) and the proceeds are posted to
`payout_due` (`market/src/ledgerclient.ts:205-211`). It is **visible** — it is a real balance in a
real account — and **structurally unspendable**, because nothing in Tessera ever debits
`payout_due` except the release, and a spend attempt against it would be an overdraft the ledger's
`ledger_assert_no_overdraft` trigger refuses (`ledger/src/migrations.ts:441`, `:479`).

**Pending-in — a deposit that is confirming.** This one is **not a ledger balance and must never
be**. EMBER credits at **60 confirmations** (`contracts/packages/chain/src/index.ts:57`,
rationalised at `:45-47` as ~15 minutes at Hearth's 15-second block time,
`hearth/node/src/params.js:90`). Posting a liability before confirmation is `convertCoinToEmber`
again. So an unconfirmed deposit is displayed **from the indexer**, labelled *"confirming, 34 of
60"*, and is **in no balance and no total**. The indexer already emits both halves —
`DEPOSIT_OBSERVED` and `DEPOSIT_CONFIRMED` (`indexer/src/topics.ts:59`) — and `wallet` deliberately
consumes only the confirmed one (`wallet/src/deposits.ts:422`, whose header calls the event
"evidence, not an instruction"). Tessera shows the observed one and counts neither it nor its
absence as money.

So the wallet strip in the client reads three figures, and they mean three different things:

```
   Available    12,480 Sparks    spendable now
   Clearing      3,200 Sparks    yours, releasing when the dispute window closes
   Confirming    5,000 Sparks    on chain, 34/60 — not yours yet, and not in any total
```

### 8.3 The fifteen minutes, and why gameplay never waits for it

The obvious objection to a chain-backed world is that a 15-minute confirmation cannot sit inside a
loop where somebody buys a chair. It does not have to, because of where the chain actually is:

**In-world payments never touch the chain.** Buying an object is a double-entry posting between two
custodial EMBER accounts. Nothing is minted, nothing is broadcast, and it settles in milliseconds —
and it is nonetheless fully backed, because the EMBER in those accounts got there through a
confirmed deposit at depth 60. **The fifteen minutes is paid once, at the door, and never again per
chair.** Deposits and withdrawals are the only chain-speed operations, and those are exactly the
two places a user already expects a chain to behave like a chain.

**And the world cannot pay out EMBER it does not hold — that is a trigger, not a policy.** Every
grant Tessera makes debits `engagement:tessera`, which is an **`equity`** account, so the ledger's
no-overdraft trigger refuses an unfunded grant at the database. `micro-market` proves the pattern
already works: `market/src/engagement.ts:22-29` names `engagementAccount` from `contracts-money`
with `equity` type precisely "so the ledger's no-overdraft rule refuses an unfunded grant". This is
what "chain-backed by construction" actually reduces to in code: **not a promise that reserves
exist, but a constraint that makes spending non-existent reserves unrepresentable.**

The **pre-funded reserve** is therefore just `engagement:tessera`, topped up ahead of demand by the
approval-gated `engagement.transfer` action ([21-engagement-treasury.md](21-engagement-treasury.md)
§6), whose cap is enforced by a constraint trigger in `admin-api` — `engagement_over_cap_refused`,
`admin-api/src/migrations.ts:585`, raise at `:569`.

### 8.4 What is bought, what is earned, what the platform takes

**Bought from other players, in Sparks:** objects (outright or licensed), parcels, venue bookings,
commissions. **Bought from the platform:** the six SKUs in §7.3, in EMBER through `micro-billing`.
**Earned:** object sales, royalties on every resale, venue bookings, and commissions.

**The platform takes 2.5%.** `MARKET_PLATFORM_FEE_BPS` defaults to 250 bps and
`MARKET_MAX_ROYALTY_BPS` to 1000 bps (`market/src/env.ts:183-184`), boot refuses if they sum to
≥ 10000 (`market/src/env.ts:193-198`), and the database refuses a listing whose
`royalty_bps + platform_fee_bps` reaches 10000 — the constraint is named
`listings_terms_leave_the_seller_something` (`market/src/migrations.ts:266-268`), which is a good
name.

**The arithmetic cannot leak.** `bpsOf` rounds **down**, deliberately in the platform's disfavour
(`market/src/money.ts:41-53`); the seller's proceeds are the **remainder**, `price − fee − royalty`
(`market/src/money.ts:160`), so `fee + royalty + proceeds === price` by construction, asserted on
every call (`assertPartition`, `market/src/money.ts:195-212`) and again by Postgres
(`orders_partition`, `market/src/migrations.ts:516`).

### 8.5 How a creator is paid, and why the royalty is real

Settlement is **one balanced ledger entry** covering the payment, the proceeds, the platform fee,
every royalty share and the item itself (`market/src/orders.ts:324-338`,
`market/src/ledgerclient.ts:232-258`). Proceeds land in `payout_due` (§8.2) and release to
`available`, from which the creator can withdraw to their own Hearth wallet.

**The royalty is enforced, not requested** — and this is the direct answer to the reference's
copybot problem, because it converts theft from a policing exercise into an accounting one:

- It is **snapshotted onto the listing at creation** (`market/src/listings.ts:477-482`,
  `market/src/migrations.ts:324-330`), so an owner cannot re-cut a sale that is already in flight.
- It is **paid as credits inside the settlement entry** (`market/src/ledgerclient.ts:250-252`) and
  audited per order in `order_royalties` (`market/src/migrations.ts:549-554`).
- Multi-recipient splits use **largest-remainder allocation with an index tie-break** so two
  replicas compute the same split (`market/src/money.ts:68-113`), and zero-weight recipients never
  receive dust (`:102`). This matters here specifically: a derivative object splits its royalty
  between the original author and the remixer, so a remix culture is expressible without either
  party trusting the other.

**One verified constraint decides an architectural question for us.** The royalty is enforced
**only on the custodial settlement path** — `market/src/orders.ts:299-345` builds the ledger entry
inside `if (listing.settlementMode === 'custodial')`, and the `else` branch merely demands an
`onchainTransactionId`. For an `onchain` listing the royalty is recorded on the order row and
**never posted**. Therefore: **every Tessera listing is `custodial`, without exception.** That is
not a preference; it is the only mode in which the royalty exists.

**And `micro-market` needs no change to sell a chair.** `listings.item_urn` is `text not null`
with **no format constraint at all** (`market/src/migrations.ts:205`), and `asset_kind` already
includes `game_item` alongside `entitlement` and `membership` (`market/src/migrations.ts:245-247`).
The one constraint that binds is `listings_active_is_escrowed`
(`market/src/migrations.ts:289-293`): an active listing must hold an escrow, so a Tessera object
must be ledger-reservable under an `item_asset_code` before it can go live.

### 8.6 Seeding an empty world — which is not a liquidity problem

[21-engagement-treasury.md](21-engagement-treasury.md) solves cold-start for markets, where the
problem is a missing counterparty. A world's cold-start problem is different and worse:
**emptiness**. A market with one listing is boring; a world with one person is sad.

Funding is the same: `engagement:tessera` under `platform:engagement-treasury`, fed by disclosed
platform mining (doc 21 §3 — the consensus carve-out was rejected because the public copy says "no
premine" and "the distinction is lost on every reader who matters") and later by the fee recycle,
which starts at 0 bps and still writes `status='skipped'` rows so the job's silence is visible
(`billing/src/recycle.ts:14-33`).

**What Tessera spends it on, in order of honesty:**

1. **Commissions.** The platform pays real creators, in EMBER, to build the eleven launch wards —
   and their parcels are **labelled as commissioned**, publicly, on the parcel itself. This is the
   strongest cold-start answer available and it involves no pretence at all: it is the platform
   buying work and saying so.
2. **The free firing allowance.** Every account's daily Kiln allowance is engagement money, because
   a firing costs real USD (`studio/src/credits.ts:43`). Subsidising creation is subsidising
   supply, which is the side of the market that is genuinely missing.
3. **Listing subsidies and first-listing bounties.** Both grant kinds already exist in market —
   `listing_fee_subsidy` and `first_listing_bounty` (`market/src/migrations.ts:738`,
   `market/src/engagement.ts:39`) — labelled `engagement.grant` in buyer-visible history.

**What it must never spend it on, and cannot:** ghost demand. No platform-owned avatars walking
around to look like a crowd, no house-owned shops, no platform bids. Doc 21 §2 refuses "fake it"
outright as fraud, and `micro-market` has already made it **unrepresentable by DB constraint** —
platform-funded bids, offers and escrows cannot be written (`market/src/engagement.ts:11-15`).
Tessera adds the world-specific version of the same rule: **no synthetic footfall**, because
footfall is the ranking signal (§6.5) and a platform that fakes footfall is a platform rigging its
own discovery.

---

## 9. The Kiln, and the answer to copybot

### 9.1 Creating a thing is a prompt

The reference's creation pipeline was its greatest strength and its highest wall: in-world prims
for the patient, Blender or Maya for the serious, and a month of tutorials before anything looked
deliberate. The overwhelming majority of residents never made a thing, and a world where 1% create
and 99% shop is a shopping mall with weather.

Tessera inverts the wall because **the estate has already built the pipeline**. Firing an object
is: describe it, pick a footprint, wait about a minute.

The flow, against the source:

1. The client posts a description to `micro-tessera`, which calls `micro-studio` with a service
   token holding `studio:write`. A **service** principal skips ownership narrowing entirely —
   `assertOwned` returns early at `studio/src/server.ts:561` — and names the acting user via
   `body.userId` (`subjectOf`, `studio/src/server.ts:533-536`). So a title can generate on a
   player's behalf without impersonating them, which is exactly the shape needed.
2. Studio returns **202 with a `statusUrl`** (`studio/src/server.ts:454-465`). Generation is a
   **leased job**, not a request handler: `requestGeneration` opens no socket
   (`studio/src/generation.ts:173-238`) and `runGeneration` executes inside a lease
   (`studio/src/generation.ts:263-386`) claimed `for update skip locked`
   (`runtime/packages/jobs/src/index.ts:183`). The lease key is `owner:<subject>`
   (`studio/src/generation.ts:234`), so one player's firings serialise and cannot stampede the
   provider.
3. The bytes come back, `cutout.py` keys the ground to alpha, and the asset is stored
   **content-addressed**: `ab/<hex>.<format>` under a sha256 checksum prefixed `sha256:`
   (`studio/src/assets.ts:93`, `:77-79`).
4. Provenance is recorded per asset — prompt, backend, model, requested size, attempts, cost
   (`studio/src/migrations.ts:154-252`) — and `c2pa` is **measured off the bytes**, never asserted:
   `const C2PA_MARKER = Buffer.from('c2pa')` at `studio/src/backend.ts:269`, set by
   `outcome.bytes.includes(C2PA_MARKER)` at `:460` under the comment "Read from the bytes rather
   than assumed".

**One studio change is required and it is small:** asset kinds are a fixed eight-item catalogue
(`studio/src/specs.ts:61-73`). Tessera needs a `world_object` kind with a 512×512 default. That is
the only change to `micro-studio` the design depends on.

### 9.2 Why copybot is dead here, and what is honestly still alive

The reference's copybot problem was existential for its creators: a client could read an object's
geometry off the wire and re-upload it as its own, because an object was a mutable database row
with an `owner` field the server had no way to derive. Enforcement was DMCA takedowns — a legal
process applied to a technical failure, arriving weeks after the theft.

Three structural differences, in increasing order of how much they matter:

**1. Identity is the hash, so "copying" resolves to the original.** A Tessera object *is* its
bytes. Re-uploading identical bytes does not create a second object with a second owner; it
resolves to the existing content address and its existing Author of record. The forgeable `owner`
field simply does not exist, because ownership is derived rather than stored. This is not a policy
that must be enforced — it is an addressing scheme.

**2. Placing someone else's object is licensing, not theft.** The response to somebody wanting your
chair is not a takedown, it is a payment: the royalty is enforced inside the settlement entry
(§8.5, `market/src/ledgerclient.ts:250-252`), snapshotted at listing creation so it cannot be
re-cut mid-sale (`market/src/listings.ts:477-482`), and split deterministically across multiple
recipients (`market/src/money.ts:68-113`) so a remix can pay its original. **The estate has a
ledger that can enforce a royalty rather than request one**, and that converts the reference's
central creator grievance from a policing problem into an accounting one.

**3. Provenance is measured, not claimed.** Every object carries the prompt that made it, the model
that made it, and a c2pa flag read off its own bytes.

**What this does not solve, said plainly:** *imitation*. Someone who prompts a chair that looks
like your chair produces different bytes, and content addressing has nothing to say about it. A
design that claimed otherwise would be lying. What dies here is the **cheap, automated, scalable**
theft — the copybot copies bytes, and bytes are the identity — and what remains is hand-imitation,
which is a governance matter for the ward and, at the estate level, `micro-community`'s existing
moderation machinery. That is the same place human societies put it.

### 9.3 Anchoring authorship on Hearth — what is possible today, and what is not

The owner's decision is that nothing exists which the chain does not back. For **value**, §8.3
discharges that completely. For **authorship**, the design anchors a claim on Hearth, and here the
source draws the line for us rather than the other way round.

**The good news: Hearth's EVM is real and Shanghai-complete.** It is a self-written, zero-dependency
JavaScript EVM (`hearth/node/src/evm/`, 3,705 lines) targeting Shanghai
(`hearth/node/src/evm/opcodes.js:2`). It has `CREATE` and `CREATE2` (`opcodes.js:197`, `:204`,
implemented `interpreter.js:707`, `:910` with EIP-1014 address derivation at `:159-161`), the full
call family including `DELEGATECALL` and `STATICCALL` (`opcodes.js:199-206`), **`LOG0`–`LOG4`**
(`opcodes.js:191-194`, feeding a bloom filter at `hearth/node/src/chain/bloom.js`), all nine
precompiles (`precompiles.js:2-5`), and the EIP-170 / EIP-3541 / EIP-3860 deployment guards
(`interpreter.js:474`, `:475`, `:914`). The estate pins **Solidity 0.8.26**
(`hearth/contracts/src/WEMBER.sol:2` and 23 siblings). **Do not target Cancun** — `TLOAD`, `TSTORE`
and `MCOPY` are deliberately undefined (`opcodes.js:38-40`), so no `ReentrancyGuardTransient`.

**The bad news, in two named blockers that decide v1's scope:**

- **A player cannot sign an on-chain transaction through custody.** Signing purposes are
  `deployer | treasury | deposit`; **`user` is deliberately excluded** (`custody/src/gates.ts:31`,
  `:34`) even though the DB constraint admits the address purpose
  (`custody/src/migrations.ts:117`). And a `deployer` key may sign **contract creations only** —
  `custody/src/signing.ts:213` refuses anything with a non-null `to`.
- **The indexer cannot subscribe to a contract's logs.** Its entire emitted-topic set is
  `[DEPOSIT_OBSERVED, DEPOSIT_CONFIRMED]` (`indexer/src/topics.ts:59`); there is no `/logs` route
  (`indexer/src/server.ts:154-162`); and ERC-721 `Transfer`s are *explicitly skipped*
  (`indexer/src/evm.ts:320-322`). **There is no ERC-721 anywhere in the estate** — grepping
  `*.ts`/`*.sol` returns three hits, all in the indexer, all present to exclude it. Logs *are*
  stored and indexed by address and topic0 (`indexer/src/migrations.ts:207`, `:228`, `:231`), so a
  log-query endpoint is cheap — but it is **unbuilt work**, not a capability.

So the design splits, honestly:

**v1 — the Registry of Authorship.** One platform-deployed contract on Hearth storing
`(sha256, authorAddress, firstAnchoredBlock)`, written by a platform key. This needs **zero new
signing paths**: it deploys through the existing `mint` route — a resumable job-driven state
machine, not a request handler (`mint/src/deploy.ts:5`, `:33-38`) — with custody signing the
creation and settlement broadcasting it. Anchoring is **lazy and user-initiated**: written when a
creator first *lists* an object, not when they fire it, because most objects are never sold and
paying gas to anchor a chair nobody sells is waste.

**v2 — player-signed deeds**, gated explicitly on two changes named above: a `user` signing purpose
in `custody`, and a log-query surface or `chain.log` topic in `indexer`. Until both land, a parcel
deed is a `micro-tessera` row plus a ledger position, and the document says so rather than
implying otherwise. **This is exactly the class of assumption that produces an implementation phase
which discovers the problem in week three**, so it is written down in week zero instead.

## 10. Where it lands — three repositories

| Repo | Owns | Port |
| --- | --- | --- |
| `micro-tessera` | World state: wards, parcels, claims, fallow, objects, placements, gates; Kiln orchestration against `micro-studio`; presence and the footfall/dwell counters; **the title contract**; bindings to `market` (listings), `community` (ward governance) and `worlds` (profile, entitlements); the Registry of Authorship deployment | **4022** |
| `micro-tessera-web` | The client: canvas isometric renderer, build and place tools, the Kiln, the ward map, Workshop pages, the three-figure wallet strip | vite **5172** |
| `micro-tessera-assets` | `ART_BIBLE.md`, `content/` canonical JSON, FLUX in `assets/`, Qwen in `candidates/qwen-image-2512/`, `verify.py` | — |

### 10.1 The port, stated carefully, because this estate has three port spaces

Getting this wrong is easy and two live repos already have. The three spaces are:

1. **The port a service binds in its container.** Every domain service ships `PORT=4000`
   (`service-template/.env.example:26`, and `worlds/.env.example:51`, `market`, `community`,
   `ledger`, `identity`, all the same).
2. **The host port in the estate compose file.** This is **derived, never chosen**: `4100 + index
   in deployableRepos()` (`org/tools/cfctl.ts:864-871`, `org/tools/registry.ts:134`), documented at
   `deploy/compose/docker-compose.estate.yml:1313-1321`. The four repos absent from micro-org's
   registry got hand-picked numbers at `deploy/compose/docker-compose.estate.yml:1333-1338` —
   foresight-web 4136, foresight-admin-web 4137, emberkin-web 4138, aetherholm-web 4139.
3. **The `devPort` in the `micro-ui` surface registry**, which is documented as *"not an
   allocation; it is a fact about a service"* (`ui/packages/ui/src/surfaces.ts:455`) — the port the
   service actually binds.

**The live defect Tessera avoids:** emberkin binds 4100 (`emberkin/.env.example:40`), which is
identity's compose host port; aetherholm binds 4120 (`aetherholm/.env.example:31`), which is
admin-api's; `nda` binds 4110, which is notify's. Spaces (2) and (3) already collide three times.

So **`micro-tessera` binds 4022** — verified free, and chosen deliberately *below* the derived
4100+ block so that it can never be collided with by a future `deployableRepos()` index no matter
how many repos are appended. Compose host ports **4140** (service) and **4141** (web), the next
after aetherholm-web's 4139. Vite dev port **5172** — verified free, adjacent to aetherholm-web's
5171 and in the gap before 5173, which is vite's default and is avoided.

### 10.2 What existing repositories must change

Every item below is a required edit, with the line that will need it. Nothing here is optional and
nothing here is large — but several are the kind that are silently forgotten and then surface as a
quarantined event or a failing estate check.

| Repo | Change | Line |
| --- | --- | --- |
| `ui` | A registry row: `kind: 'service'`, `subdomain: 'tessera'`, `devPort: 4022`, `accent: '#6d9a49'`, `inSwitcher: false`, `verb: null`, `glyph: '◆'`, `markId: null` | `ui/packages/ui/src/surfaces.ts:169` |
| `ui` | A `BOUND` entry pinning 4022 with a `tessera/src/env.ts:NN` citation; the test asserts the registry agrees with what the service binds and that no two unrelated surfaces share a port | `surfaces.test.ts:187`, `:189-196`, `:326` |
| `contracts` | **`'tessera'` added to the `ProducerService` union** — a topic cannot be registered without it | `contracts/packages/events/src/index.ts:183-205` |
| `contracts` | Tessera's topics registered as `TopicSpec`s (`producer`, `payloadType`, `version`, `keyedBy`, `description`) | `contracts/packages/events/src/index.ts:231-740` |
| `contracts` | The **pinned enumerated inventory** — a sorted literal list of every topic — must be edited or the package test fails | `contracts/packages/events/src/index.test.ts:153-215` |
| `contracts` | Tessera's scopes registered | `contracts/packages/auth/src/index.ts:168-458` |
| `studio` | A `world_object` asset kind, 512×512 default | `studio/src/specs.ts:61-73` |
| `activity` | Classify rules mapping Tessera's topics to `category` / `visibility` / `userId` / `summary`. **No new category is needed** — the sixteen are closed (`activity/src/categories.ts:31-51`) and Tessera's events land on `ownership`, `market`, `reward` and `community`, as worlds, emberkin and aetherholm already do | `activity/src/classify.ts:1134` |
| `notify` | Routing rules and templates — both are hardcoded maps, so registration is a PR, not an API | `notify/src/catalogue.ts:276`, `notify/src/templates.ts:54` |
| `billing` | Seed rows for the §7.3 SKUs. `world.private.small` already exists and is unserved | `billing/src/migrations.ts:405`, `:418` |
| `worlds` | **A data row, not code** — `POST /v1/titles` with capabilities drawn from the closed set | `worlds/src/server.ts:524-554`, `worlds/src/titles.ts:43-51` |
| `org` | Append to `REGISTRY`. **Warning: appending renumbers every host port after the insertion point**, so append at the end of the block | `org/tools/registry.ts:52`, `:134` |
| `deploy` | Compose services, gateway routes (`cf-web-aetherholm` at `estate-web.yml:310-315`, `:426-428` is the pattern), CORS origins, scope grants, smoke checks | `docker-compose.estate.yml`, `gateway/dynamic/estate-web.yml`, `policy.yml:80`, `:118`, `estate/grant-gaps.json`, `scripts/estate-verify.sh` |

**And two repositories that need nothing, which is the more useful finding:**

- **`micro-market` needs no change to sell a Tessera object.** `item_urn` has no format constraint
  (`market/src/migrations.ts:205`) and `asset_kind` already includes `game_item`
  (`market/src/migrations.ts:245-247`). §8.5.
- **`micro-community` needs no change to govern a ward.** A ward is a community of
  `kind: 'public'` with `governance_model: 'one_member_one_vote'`
  (`community/src/migrations.ts:121-123`, `:129-131`). Ward decisions ride **`parameter_change`**
  proposals — one of the four kinds in the closed catalogue
  (`community/src/proposals.ts:23-28`) — and Tessera **subscribes to
  `community.proposal.executed`**, which is one of only three community topics actually registered
  in contracts (`community/src/events.ts:4-8`), and applies the parameter itself. This matters:
  community's execution handler does nothing for any kind except `treasury_spend`
  (`community/src/executions.ts:217-219`), so a design that expected community to *enact* a world
  change would have needed a new execution kind and a new handler in somebody else's repo. Putting
  the effect in Tessera keeps the change count at zero and puts the game logic in the game.

---

## 11. The rules it inherits, applied concretely

Assertion is not application. Each rule below is followed by what Tessera actually does about it.

### 11.1 Outbox → signed HTTP → inbox

Events leave through an outbox row written **in the same transaction as the domain change**, and a
relay job delivers them. The relay pattern to copy is `community/src/outbox.ts:281-357`: scan
unpublished rows in `occurred_at` order, resolve active subscriptions per topic, **sign the exact
bytes** (`signEvent(JSON.stringify(envelope), …)` at `:317`), mark published only when zero
deliveries are outstanding (`:340-351`), and call `ctx.heartbeat()` so a long backlog does not
outlive its lease (`:354`).

Signing is `t=<seconds>,v1=<hmac>` under `cf-signature`
(`contracts/packages/events/src/index.ts:1272-1275`), with a 5-minute tolerance (`:1243`) and
`timingSafeEqual` comparison plus multi-secret rotation in `verifyDelivery` (`:1285-1330`).

On the receiving side Tessera **verifies the signature over the raw bytes before parsing** —
`activity/src/ingest.ts:83-95`, whose header at `:76-82` explains why re-serialising before
verifying is forbidden — and dedupes with `withInbox`: `insert into inbox (topic, event_id) … on
conflict (topic, event_id) do nothing returning event_id`, with the handler running **inside the
same transaction**, so a failed handler leaves no row and the event is retried
(`service-template/src/outbox.ts:311-328`, `:307-309`).

**Versions are `"major.minor"` strings**, per `EventVersion = \`${number}.${number}\``
(`contracts/packages/events/src/index.ts:110`). One trap worth naming: `worlds` stores its version
as an `integer` column (`worlds/src/migrations.ts:65`) and maps it to `"n.0"` on the wire via
`wireVersion` (`worlds/src/outbox.ts:52`). **Tessera stores the string**, so the stored value and
the wire value are the same value.

### 11.2 Topics, keyed by a subject that is the right one

Names are `<service>.<aggregate>.<past-tense-verb>`, exactly three lowercase segments, first
segment equal to the producer (`contracts/packages/events/src/index.ts:749-756`, enforced at
`contracts/packages/events/src/index.test.ts:37`, `:43`). `keyedBy` is documented as the ordering
partition and therefore **part of the contract, not a producer's private choice** (`:213-218`).

| Topic | `keyedBy` | Why that key |
| --- | --- | --- |
| `tessera.parcel.claimed` | `parcel_id` | two claims on one parcel must serialise |
| `tessera.parcel.fallowed` | `parcel_id` | fallow and contest order against the same parcel |
| `tessera.parcel.transferred` | `parcel_id` | a transfer must not overtake the claim that preceded it |
| `tessera.object.fired` | `object_id` | |
| `tessera.object.anchored` | `object_id` | the authorship write, §9.3 |
| `tessera.ward.opened` | `ward_id` | |
| `tessera.venue.booked` | `parcel_id` | **not `booking_id`.** The contended resource is the parcel's calendar; keying by booking would let two bookings for one slot be processed in either order, which is precisely the failure `keyedBy` exists to prevent |

That last row is the rule doing work rather than being quoted. Seven topics, all registered in
`contracts-events` **in the same commit** as the code that emits them — otherwise they are
quarantined as `internal` and appear in nobody's feed (`activity/src/classify.ts:1139-1150`), which
is how `micro-market` ended up emitting ten topics with one registered
(`market/src/topics.ts:65`, `contracts/packages/events/src/index.ts:497`) and `micro-community`
eleven with three (`community/src/events.ts:4-8`).

### 11.3 Scopes, registered in the same commit as the gate

Convention is `service:noun` or `service:noun:verb`, first segment equal to the service
(`contracts/packages/auth/src/index.ts:150-153`). Tessera registers **`tessera:read`**,
**`tessera:write`** and **`tessera:provision`** — the last following Aetherholm's precedent for the
title contract (`aetherholm/src/server.ts:119`).

"Same commit" is not a convention here, it is a build failure: the check lives in CI at
`org/.github/workflows/service-ci.yml:197-212` ("Every scope this service demands is registered"),
derives demanded scopes from inline literals, sibling constants and wrapper arguments
(`:495-597`), treats an unresolvable derivation as fatal (`:550`, `:556`, `:597`), and is itself
unit-tested at `org/test/workflow-shell.test.ts:300` — "a demanded scope missing from the registry
fails the build **and names the gate**".

**A caution, verified rather than assumed:** the reverse direction is weaker. `community` demands
`community:read` (`community/src/scopes.ts:37-46`) and that scope is **absent** from the registry —
grepping `'community:` in `contracts/packages/auth/src/index.ts` returns exactly two hits,
`community:execute` at `:236` and `community:write` at `:241`. Tessera registers all three of its
scopes before the first gate ships.

### 11.4 Leased jobs, and no timer doing domain work

**The lease key names the contended resource, not the row** (`service-template/src/jobs.ts:10-20`).
Tessera's keys:

| Key | Contended resource |
| --- | --- |
| `parcel:<parcelId>` | claim, transfer, fallow settlement, contest resolution |
| `ward:<wardId>` | ward minting, occupancy recompute |
| `owner:<subject>` | Kiln firings — deliberately the same key shape studio uses (`studio/src/generation.ts:234`), so one player's firings serialise consistently on both sides |
| `stream` | the outbox relay singleton, as `market/src/jobs.ts:104-110` and `settlement/src/jobs.ts:91` both do |

Claims are `for update skip locked` (`runtime/packages/jobs/src/index.ts:183`, full query
`:168-194`). Backoff is `min(1000 × 2^(attempt−1), 5 min)` with full jitter (`:275-279`, applied
`:417`); five attempts then `dead` (`:90`, `:93`).

**No `setInterval` doing domain work** is enforced by a CI grep, not a lint rule:
`org/.github/workflows/service-ci.yml:1036-1056`, exiting 1 on a hit (`:1054`), with an inline
`cfctl-allow setInterval` comment as the only escape hatch (`:1046`). **Tessera uses no escape
hatch**, and it does not need one, because the two things that look like they want a timer do not:

- **Presence** is push-on-change — a move writes a row and raises a Postgres `NOTIFY`; the SSE
  handler forwards. No broadcast loop exists.
- **Fallow** is lazy — computed on read from `(lastFootfallAt, lastEditAt, bankedUntil)` and
  settled on write, so there is no nightly sweep marking parcels dead. Aetherholm's lazy-accrual
  discipline ([20-aetherholm.md:139-141](20-aetherholm.md)), applied to time rather than resources.

### 11.5 Money as `bigint`, and `BigInt('')`

`BigInt('')` is `0n`, which turns a missing amount into a free purchase. `micro-market` makes it
**unreachable rather than handled**: `parseAmount` requires `/^\d{1,78}$/` before calling `BigInt`
(`market/src/money.ts:222-227`). **Tessera imports that helper rather than writing a second one.**

Amounts are `numeric(78,0)` in Postgres, read as `::text` then `BigInt`
(`market/src/escrow.ts:100-102`), and decimal strings on the wire — never a JSON number, because
`Number.MAX_SAFE_INTEGER` is about 9×10¹⁵ and a single EMBER is 10¹⁸ wei.

### 11.6 Invariants in the schema, in all three forms

**CHECK constraints** — the form for a single-row, single-column truth
(`ledger/src/migrations.ts:227` is the estate's canonical example):

- `tessera_price_whole_sparks CHECK (price_wei % 1000000000000 = 0)` — §8.1's floor, in the
  database rather than in a validator.
- `tessera_deed_slots_capped CHECK (deed_slots BETWEEN 2 AND 12)` — §7.3's pay-to-win ceiling. A
  purchase path that tried to grant a thirteenth slot fails at the database, which is the only
  place a monetisation refusal is actually safe.
- `tessera_parcel_tier_known CHECK (tier IN ('homestead','plot','court','quarter'))`.

**Partial unique indexes** — the form for "at most one of these, under a condition"
(`identity/src/migrations.ts:292-294` is the pattern):

- `create unique index tessera_one_homestead on parcels (owner_subject) where tier = 'homestead'
  and status = 'held'` — **a second Homestead is unrepresentable**, not merely refused.
- `create unique index tessera_one_open_booking on bookings (parcel_id, slot) where status =
  'open'`.

**Deferred constraint triggers** — the form for a cross-row invariant Postgres cannot express as a
CHECK. The rationale is written out at `community/src/migrations.ts:660-670` and the shape at
`:691-695`:

- **Object cap.** Placements may not exceed the parcel's cap, checked `deferrable initially
  deferred` at commit — so pasting 200 objects is one check, not 200.
- **Contest window.** A fallow parcel cannot be contested before its 30 days, evaluated on the
  **database clock**, the way community enforces timelocks before insert on the DB clock
  (`community/src/migrations.ts:720-752`) rather than on a clock the caller supplies.
- **The Homestead is not tradeable.** An UPDATE moving `owner_subject` on a `homestead` row raises.
  An error, not a policy.

### 11.7 Postgres per service, no shared schema

`micro-tessera` owns its own database and reaches no other service's. Ward governance is HTTP to
`community`; listings are HTTP to `market`; balances are HTTP to `ledger`. Migrations run in a
**separate migrator process**, serialised by an advisory lock derived from the service name, and
never from `index.ts` (`service-template/src/migrator.ts:34-53`, `:4-15`).

Migrations are versioned, ascending and **immutable once released** — `@cloudsforge/db` checksums
the text and refuses a changed migration; the fix is always a new one
(`service-template/src/migrations.ts:1-15`). Version 1 is `JOBS_SCHEMA_SQL` taken **verbatim** from
`@cloudsforge/jobs` (`service-template/src/migrations.ts:29`) so the lease claim query's table
cannot drift from the query that claims against it.

### 11.8 The title contract, which Tessera actually implements

`worlds` calls exactly two routes, despite its own client header saying four
(`worlds/src/titleclient.ts:7`): `GET /v1/title` returning `{slug, name, capabilities[]}`
(`worlds/src/titleclient.ts:122`), and `POST /v1/provision` taking
`{entitlementId, subject, userId, sku, scope, metadata}` and returning `{urn, replayed}`
(`:134-152`, `:69-74`), with the `entitlementId` sent as **both** the `Idempotency-Key` header and
a body field (`:149`).

Capabilities come from a **closed set** — `private_world | cosmetics | achievements | seasons |
inventory` (`worlds/src/titles.ts:43`, runtime array `:45-51`), duplicated in the contract package
at `contracts/packages/worlds/src/index.ts:121`. Tessera declares
**`['private_world', 'cosmetics', 'inventory']`**. `private_world` is the one that matters: the
provisioning bridge calls a title only when that capability holds
(`worlds/src/provisioning.ts:441-451`), and provisioning a **Private Ward** is how the existing,
currently-unserved `world.private.small` SKU (`billing/src/migrations.ts:405`) finally gets a code
path.

## 12. What must be proven by test, before it ships

1. A second Homestead is refused **by the database**, even for a caller holding a connection.
2. A price that is not a whole number of Sparks is refused by CHECK.
3. Deed Slots cannot exceed 12 through **any** purchase path — asserted as an absence with force,
   the way `admin-web` asserts its missing og card.
4. **No SKU grants discovery ranking, a vote, safety, land, object-cap headroom, or a fee or
   royalty discount.** Six absences, each a test. And the converse: every SKU in §7.3 resolves to a
   deliverable entitlement or billing product, or the suite fails — principle 3 of
   `01-product-vision.md`.
5. Two replicas racing one parcel claim produce exactly one claim. Lease, not luck.
6. Placing past the object cap is refused at commit by the deferred trigger, including via a bulk
   paste that is individually under the cap and collectively over it.
7. `fee + royalty + proceeds === price` across randomised prices, fee/royalty rates and recipient
   splits — property-tested, and asserted again by `orders_partition`
   (`market/src/migrations.ts:516`).
8. A grant against an unfunded `engagement:tessera` is refused by the overdraft trigger
   (`ledger/src/migrations.ts:441`, `:479`) — the world cannot pay EMBER it does not hold.
9. **An unconfirmed deposit appears in no balance and no total.** An absence, asserted with force,
   because the alternative is the estate's oldest defect.
10. `payout_due` cannot be spent; the release moves it to `available` and only the release does.
11. `GET /v1/title` and `POST /v1/provision` satisfy `worlds`' client against the real service, and
    provision replays idempotently on `entitlementId` — same `urn`, `replayed: true` on the second
    ask, the way `worlds/src/conformance.ts:233-246` checks it.
12. Ranking admits exactly two inputs. A test on the ranking function's signature, so that adding a
    third — paid or otherwise — cannot happen quietly.
13. No `setInterval` doing domain work, and **no `cfctl-allow` escape hatch anywhere in the repo**.
14. Every topic emitted is registered in `contracts-events`; every scope demanded is registered in
    `contracts-auth`. Both are already CI, and both name the offending gate.
15. Assets: `verify.py` passes on all 392 × 2 — c2pa measured off the bytes, cross-provider parity,
    avatar-overlay bounding-box registration, and the Qwen transposition check (§2.15).

## 13. What I could not verify, recorded rather than smoothed over

Every claim above about existing code was read from source and cited. These were not, and the
document says so rather than writing a plausible sentence:

- **Whether a Solidity contract has ever actually been deployed to a running Hearth node.** The EVM
  is Shanghai-complete by inspection and 24 contracts carry pinned `0.8.26` pragmas, but I read the
  interpreter; I did not run it. §9.3's v1 anchor depends on this working.
- **EMBER's value.** Hearth's mainnet is not live, so §8.1's price table is a design target, not a
  tested one. The structural claims around it (one asset code, Sparks as a denomination, whole-Spark
  prices) hold regardless of the number.
- **Whether `micro-studio`'s FLUX endpoint is live right now.** `studio/src/backend.ts` probes it
  and the three completed asset runs prove it worked; I did not call it.
- **Browser rendering performance for a densely built parcel.** No prototype exists. The object
  caps in §6.2 are reasoned from tile counts, not measured. **This is the riskiest unmeasured
  number in the document**, and measuring it should be the first thing phase 1 does — if 640
  sprites in a Plot does not hold 60 fps on a mid laptop, the caps change and several other numbers
  move with them.
- **Whether the withdrawn deployment is still billing — and this one can no longer be resolved from
  here.** Its record read `teardown.state: "NOT TORN DOWN — STILL BILLING"` and named the manual
  Azure portal action required, because none of three ARM routes could delete it. I read the file;
  I did not check Azure. **That file has since been deleted with the candidate trees** and is
  transcribed into each repository's `COMPARISON.md`; it was a record of a moment
  (2026-08-03T08:30:17Z) and never a live reading. If nobody removed the deployment by hand, it is
  still billing. Somebody should still check.
- **The true scope of the estate-wide Shard removal.** A recount found **2,457 occurrences across
  340 files in 44 repos** — larger than the 1,541/38 figure circulating — but I did not check that
  every occurrence is in scope, and the 193 in `emberkin*` are a different game's shard item that
  may not be.
- **Concurrency behaviour of Postgres `LISTEN/NOTIFY` at ward scale.** The presence design in §4
  assumes it carries 60 avatars per ward across many wards. That is a normal load for the mechanism
  and an abnormal one to assume without measuring.

## 14. Programme impact

Target set grows **55 → 58**.

### 14.1 Which of the eleven "one platform" claims it moves

`01-product-vision.md` §2 lists eleven statements and records that three are true. Tessera moves
two outright and contributes to three more.

| # | Claim | Today | With Tessera |
| --- | --- | --- | --- |
| **7** | Assets you create in one product are usable in the others | **False** (`01:55`) | **True.** A Tessera object is a `micro-studio` asset with provenance, sold on `micro-market` as `asset_kind: 'game_item'`, and wearable as a cosmetic on the `worlds` shared profile (`worlds/src/players.ts:56`). One asset, three products, no export step |
| **6** | One internal economy — spend and earn identically everywhere | **Partly** — `01:54` says it plainly: "Shards are universal; **nothing earns them**" | **True.** Tessera is the first surface in the estate where a user *earns*, and it earns EMBER, not scrip |
| **10** | One financial source of truth that reconciles against the chain | False | **Moved, not closed.** The custody-vs-chain half of reconciliation still needs the indexer and is unwired (`ledger/src/migrations.ts:547-551`). But a chain-backed world economy is the most demanding possible test of the half that exists |
| **5** | One activity history | False | **Contributes.** Tessera's seven topics land on the shared timeline in existing categories — no new category needed (`activity/src/categories.ts:31-51`) |
| **2** | One identity — the same profile and reputation everywhere | Partly | **Contributes, specifically.** `players.reputation` is a column **no code writes**: it is declared at `worlds/src/migrations.ts:146` and read at `worlds/src/players.ts:56`, `:70`, `:89`, and grepping `worlds/src` finds no UPDATE anywhere. Tessera would be the first surface to write it, from footfall and completed sales |

Claim 7 is the one Tessera exists for. The platform has claimed cross-product assets since
`01-product-vision.md` was written and has never had a product that produced one.

### 14.2 Build order, and the one hard dependency

1. **`micro-tessera-assets` — first, and in parallel with everything else.** Art bible, content
   JSON, then the generation session batched like the brand run. It blocks nothing and nothing
   blocks it, and an H100 is billing.
2. **`micro-tessera` phase 1** — schema, wards, parcels, claims, the fallow clock, placements, the
   title contract, the registry row. The highest-certainty slice, and it closes the
   `world.private.small` gap.
3. **`micro-tessera` phase 2** — the Kiln against `micro-studio`, market bindings and royalties,
   community bindings, presence, footfall and dwell.
4. **`micro-tessera-web`** — against the routes phases 1–2 actually serve, cited line by line, the
   way `aetherholm-web` pins every route to the line that serves it.
5. **The Registry of Authorship** contract and its deployment.

**The one hard dependency is not in this document.** Tessera cannot ship denominated in EMBER while
`micro-billing`'s SKUs are priced in SHARD (`billing/src/migrations.ts:402-406`) and
`contracts/packages/money/src/index.ts:239` still defaults `assetCode` to `'SHARD'` as a silent
parameter default. **The estate-wide Shard removal is a prerequisite for phase 2, not a parallel
tidy-up**, and §13 records that it is roughly 60% larger than currently briefed.

Nothing else here blocks, or is blocked by, deployment work — the two proceed independently.
