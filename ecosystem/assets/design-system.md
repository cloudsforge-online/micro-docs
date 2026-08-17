# CloudsForge design system — ecosystem extension

What the existing design system is, what the ecosystem adds to it, and the validated values for
every new surface. This extends `@cloudsforge/ui`; it does not replace it. The warm ash/ember
palette is distinctive and is an asset — replacing it with another neutral SaaS grey would be a
downgrade.

Companion document: [chart-palette.md](chart-palette.md) covers data visualisation.

---

## 1. What already exists, and is kept

Three layers of CSS custom properties in `@cloudsforge/ui/tokens.css`, selected by two HTML
attributes on `<html>`:

- `data-cf-substrate="warm|cool"` — the ash ramp.
- `data-cf-product="<key>"` — the accent.

**Substrate, warm (default).** Ash `950 #0b0908` · `900 #0e0c0a` · `850 #141110` ·
`800 #1b1710` · `700 #262019` · `600 #362d22` · `500 #493c2d`. Bone `#ece5d6`, dim `#b7ae9b`,
khaki `#8e866f`.

**Substrate, cool.** Ash `#0b0f11 → #43555e`, bone `#dfe6e4 / #abbcbd / #7d9399`. Three consumers
today: `micro-web-template` (and so every frontend cut from it), `micro-aetherholm-web`,
`micro-foresight-admin-web`.

> **These six values are a copy, and the copy has already been wrong.** As shipped, the cool bone
> ramp read `#dfe6e4 / #96a5a6 / #63757a`, and it was **not** a hue rotation of the warm ramp: it
> darkened the two dimmed steps while lightening the ash beneath them. `--cf-fg-mute` therefore
> landed at **3.54:1** on the cool panel `#151d21`, under the 4.5:1 AA floor for normal text — and
> since that token draws every secondary label, timestamp, caption and chart axis, it failed on all
> three cool surfaces and on none of the fourteen warm ones. `micro-ui` `2f990be` retuned it to the
> values above (`--cf-fg-dim` 8.67:1, `--cf-fg-mute` 5.29:1). This paragraph was stale for as long
> as that defect existed and for a while afterwards.
>
> **So do not read hexes off this page.** `@cloudsforge/ui/tokens.css` is the definition; the
> values here are an orientation for a reader deciding whether the system suits them. The reason
> the estate now has `ui/packages/ui/src/contrast.test.ts` — which resolves the real stylesheet per
> substrate and measures every `color:` against the ground it is actually painted on — is precisely
> that duplicated colour cannot be kept honest by review. A prose copy is not checkable, and a
> per-frontend axe run only fires on surfaces that happen to render the token, which is why one
> number (3.54:1, the cool panel) was reported three times and the warm ramp was never measured at
> all. Anything load-bearing belongs in the package, with a test; this document should be shrinking
> towards prose that explains *why* the ramps are shaped as they are.

**Semantic layer.** `--cf-bg` (ash-900) · `--cf-bg-raised` (ash-850) · `--cf-bg-sunken`
(ash-950) · `--cf-fg` (bone) · `--cf-fg-dim` · `--cf-fg-mute` · `--cf-line` · `--cf-line-strong`
· `--cf-surface` · `--cf-surface-solid` · `--cf-surface-hover`.

**Type.** Display `Bricolage Grotesque` → `Oswald` → sans. Sans `Inter`. Mono `JetBrains Mono`.
Scale `2xs .62` → `4xl 2.1` rem. Space `3xs .125` → `3xl 2` rem.

**Geometry.** Radius `4 / 6 / 10px`. Max width `1200px`. Bar height `46px`.
**Motion.** `--cf-ease: cubic-bezier(.2,.6,.2,1)`, `--cf-speed: 160ms`, with
`prefers-reduced-motion` honoured.

**Chrome.** `CloudsForgeBar`, `ProductSwitcher`, `AccountMenu`, `CloudsForgeLogo`, and the
`.cf-*` class set in `ui.css`. Colour comes from the semantic layer only, except `--cf-ember` in
exactly three places: the logo mark, the sign-in CTA, and the bar's top seam.

---

## 2. The accent problem, measured

The registry currently ships six product accents. **Five of the six are orange.**

| Product | Accent |
| --- | --- |
| Company / site | `#e8622c` |
| Hearth | `#ff5a1e` |
| ForgeMint | `#ff8a1f` |
| Games | `#d9812f` |
| Lantern | `#f4a63c` |
| Crucible | `#3fc8bb` |

Validated as a set on the panel surface `#141110`:

```
[FAIL] CVD separation      worst all-pairs #ff5a1e↔#e8622c  ΔE 1.3 (protan)
[FAIL] Normal-vision floor worst all-pairs #ff5a1e↔#e8622c  ΔE 4.1
```

ΔE 4.1 means **full-colour readers cannot reliably tell Hearth's accent from the company's**.
Under protanopia they are the same colour. The product switcher currently distinguishes six
products by a channel that distinguishes two.

This was also already leaking: `platform/apps/admin/index.html` sets `data-cf-product="admin"`,
for which no accent block exists, so it silently falls through to the ember default. Five values
of ember ship across the estate (`#e8622c`, `#d9812f`, `#ff5a1e`, `#ff7a2f`, and `#ff4d00` baked
into generated artwork).

## 3. The accent system, corrected

Two rules resolve it.

**Rule 1 — ember is company chrome, never a product accent.** `#e8622c` belongs to the logo,
the primary CTA, the bar seam and Forge Hub. Hub is the container the user is already inside,
not a destination in the switcher, so it never needs to be told apart from anything.

**Rule 2 — the switcher is a vertical list, so adjacent separation is the correct gate.** Only
neighbours touch. Requiring all-pairs separation across eight brand-faithful hues is
unachievable (verified exhaustively — no ordering of eight passes, and the best evenly-spread
set at constant lightness reaches only ΔE 9.6). Requiring adjacent separation is achievable and
is the honest test for a list.

**The five product accents:**

| Slot | Product | Name | Hex | Token | Glyph |
| --- | --- | --- | --- | --- | --- |
| 1 | Forge Network | molten | `#d6412f` | `[data-cf-product='network']` | ● |
| 2 | Forge Trade | quench | `#2a9e93` | `[data-cf-product='trade']` | ◐ |
| 3 | Forge Create | brass | `#b28e1e` | `[data-cf-product='create']` | ✦ |
| 4 | Forge Market | amethyst | `#9b7bf0` | `[data-cf-product='market']` | ◇ |
| 5 | Forge Worlds | moss | `#6d9a49` | `[data-cf-product='worlds']` | ▲ |

**Switcher order is this order** — it is chosen for separation, not for narrative, because a
switcher is a lookup list rather than a story.

```
[PASS] Lightness band       all 5 inside L 0.48–0.67
[PASS] Chroma floor         all 5 >= 0.1
[PASS] CVD separation       worst adjacent #2a9e93↔#d6412f  ΔE 12.9 (deutan)
[PASS] Normal-vision floor  worst adjacent #ae8b1c↔#2a9e93  ΔE 17.0
[PASS] Contrast vs surface  all 5 >= 3:1
```

ΔE 4.1 → 17.0. Reproduce with:

```
node scripts/validate_palette.js "#d6412f,#2a9e93,#b28e1e,#9b7bf0,#6d9a49" \
  --mode dark --surface "#141110"
```

**Colour is still never the only channel.** Every switcher entry ships a glyph, a name and a
blurb. The accent reinforces; it does not carry.

### Non-product surfaces

| Surface | Accent | Note |
| --- | --- | --- |
| Forge Hub | `--cf-ember #e8622c` | The container. Not a switcher entry. |
| Marketing site | `--cf-ember` | Removed from the switcher — the logo already links there |
| Admin | `#c2704f` (clay) | Given an explicit block. Today it falls through silently |
| Lantern | `#f4a63c` (amber) | Unchanged. Note Lantern's own UI forces ember for chrome because amber collides with its WARN level |
| Beacon | `#7fae5c` (signal) | New. Matches the chart `good` step, which is correct for a status tool |
| Developer platform | `#4a86e0` (azure) | New. Reached from the footer, not the product switcher |
| Forge Exchange | `#d05870` (rose) | **A switcher entry, and the only non-product one that is not `adminOnly`.** Last in the customer-facing run — see below |
| Community | inherits the host surface | Community lives inside Hub and inside products; it is not a destination |

Admin, Lantern and Beacon are `adminOnly` and render in a separate group below a separator, so
they are never adjacent to a product entry.

**Forge Exchange joined the switcher on 2026-08-16, and it is the exception the two rules above
were written to make possible.** The owner's report was that it "is not available in the product
menu". It is not a product — no verb, no mark, contracts CloudsForge does not operate — so it does
not join the run whose order the separation search fixed. It sits AFTER that run and BEFORE the
`adminOnly` separator: a signed-out visitor sees it last with `trade` above it, and an operator
sees it between `trade` and `admin`.

That placement is what lets rule 2 do the work. All-pairs separation against every accent in the
estate is exactly what rule 2 says is unachievable, and a sweep confirmed it again — nothing clears
ΔE 18 against all fifteen existing, retired and company hues. Scored against the two rows it
actually touches, `#d05870` clears ΔE 12.8, more than twice the validator's default floor, holds
the same ΔE 12.8 against everything else, and measures 4.75:1 on `#141110`. Reproduce with:

```
node scripts/find_exchange_accent.mjs        # the sweep itself, in ui/
node scripts/validate_palette.mjs "#2a9e93,#d05870,#c2704f" --mode dark --surface "#141110"
```

**The sweep gates legibility as well as separation, and it did not always.** Its first answer was
`#dcde5e`, a lime that cleared every distance gate by a wide margin (ΔE 21.2 to its neighbours,
13.11:1 on the dark panel) and then failed axe on the live `/products/exchange` with three serious
`color-contrast` violations. `micro-site` sets type IN the accent and normalises it for a light
ground by darkening it a fixed 68% toward black — and a fixed mix is a fixed *step*, not a fixed
*result*. The six product accents land between 5.07:1 and 6.87:1 after that step; the lime landed
at 2.63:1.

So `find_exchange_accent.mjs` now applies both of the site's mixes and drops any candidate that
falls under 4.5:1 on either ground, before it spends a subprocess on separation. Both directions
are gated: run it with the light gate alone and the survivors are deep roses that then fail on the
dark panel. `site/test/contrast.test.ts` was widened at the same time — it measured
`PRODUCT_ACCENTS`, which by construction excludes every `kind: 'service'` entry, so it could not
have seen this; it now measures whatever the site scopes.

The row is deliberately NOT wedged between two products, which was the other tempting position
(the tokens traded here are Forge Create's). The ΔE 30 adjacency gate is computed over the products
alone, so a non-product between two of them would change what a reader's eye compares while the
gate went on measuring a pair that is no longer adjacent — green, and wrong.

> The five-product table above is the ORIGINAL specification and has not been re-cut since. The
> registry has added Forge Foresight (`#1e89c7`) and moved Forge Trade last by instruction.
> `ui/packages/ui/src/surfaces.test.ts` holds the current order as an independent literal, and it
> is the copy that fails when the two disagree.

### Migration from today's values

| Today | Becomes | Why |
| --- | --- | --- |
| `crypto` `#ff5a1e` | `network` `#d6412f` | ΔE 1.3 from the company ember |
| `mint` `#ff8a1f` | `create` `#b28e1e` | Third orange |
| `play` `#d9812f` | `worlds` `#6d9a49` | Fourth orange |
| `crucible` `#3fc8bb` | `trade` `#2a9e93` | Same hue, stepped into the lightness band |
| `wallet` `#93a97c` | retired as an accent | Forge Pay stops being a destination; sage stays as `--cf-success` |
| `admin` (no block) | `#c2704f` explicit | Silent fallthrough is a latent bug |
| `#ff4d00` in generated artwork | per-product accent from the registry | Art currently bakes a sixth ember |

---

## 4. Token block to add

```css
:root, [data-cf-substrate] {
  /* company chrome — never a product accent */
  --cf-ember:       #e8622c;
  --cf-ember-hover: #ff7b41;
  --cf-ember-ink:   #1a0f08;
  --cf-ember-glow:  rgba(232, 98, 44, .28);
}

[data-cf-product='network'] {
  --cf-accent: #d6412f; --cf-accent-hover: #ef5a45;
  --cf-accent-ink: #1c0806; --cf-accent-glow: rgba(214, 65, 47, .26);
}
[data-cf-product='trade'] {
  --cf-accent: #2a9e93; --cf-accent-hover: #3fc8bb;
  --cf-accent-ink: #04201d; --cf-accent-glow: rgba(42, 158, 147, .26);
}
[data-cf-product='create'] {
  --cf-accent: #b28e1e; --cf-accent-hover: #d4ad35;
  --cf-accent-ink: #1a1404; --cf-accent-glow: rgba(178, 142, 30, .26);
}
[data-cf-product='market'] {
  --cf-accent: #9b7bf0; --cf-accent-hover: #b79cff;
  --cf-accent-ink: #120a26; --cf-accent-glow: rgba(155, 123, 240, .26);
}
[data-cf-product='worlds'] {
  --cf-accent: #6d9a49; --cf-accent-hover: #88b862;
  --cf-accent-ink: #0d160a; --cf-accent-glow: rgba(109, 154, 73, .26);
}
[data-cf-product='hub'], [data-cf-product='site'] {
  --cf-accent: var(--cf-ember); --cf-accent-hover: var(--cf-ember-hover);
  --cf-accent-ink: var(--cf-ember-ink); --cf-accent-glow: var(--cf-ember-glow);
}
[data-cf-product='admin'] {
  --cf-accent: #c2704f; --cf-accent-hover: #db8a68;
  --cf-accent-ink: #190c06; --cf-accent-glow: rgba(194, 112, 79, .26);
}
[data-cf-product='lantern'] {
  --cf-accent: #f4a63c; --cf-accent-hover: #ffc061;
  --cf-accent-ink: #1c1204; --cf-accent-glow: rgba(244, 166, 60, .26);
}
[data-cf-product='beacon'] {
  --cf-accent: #7fae5c; --cf-accent-hover: #9bc978;
  --cf-accent-ink: #0e1608; --cf-accent-glow: rgba(127, 174, 92, .26);
}
[data-cf-product='developers'] {
  --cf-accent: #4a86e0; --cf-accent-hover: #6ba1f0;
  --cf-accent-ink: #060f1f; --cf-accent-glow: rgba(74, 134, 224, .26);
}
```

Plus the chart roles in [chart-palette.md](chart-palette.md) §8.

---

## 5. Brand marks

`CloudsForgeLogo` is an inline SVG in a 24-unit viewBox: an ash ridge with an ember spark. Every
product mark follows the same construction so the set reads as one family:

- **24×24 viewBox**, 2-unit stroke, round caps and joins.
- **A ground line** — the ash ridge, in `--cf-fg-mute`, present in every mark.
- **One accent element** — the product's idea, in `--cf-accent`.
- **No gradients, no shadows, no more than two colours.**
- Legible at 16px. Test at 16, 24 and 32.

The five product marks are in this directory as SVG, authored to that spec:

| File | Product | Idea |
| --- | --- | --- |
| [mark-network.svg](mark-network.svg) | Forge Network | A hearth flame over the ridge — the chain as the fire the estate is built around |
| [mark-trade.svg](mark-trade.svg) | Forge Trade | A quench curve crossing the ridge — the equity line |
| [mark-create.svg](mark-create.svg) | Forge Create | A struck spark above an anvil edge |
| [mark-market.svg](mark-market.svg) | Forge Market | A stall awning over the ridge — a place things are offered |
| [mark-worlds.svg](mark-worlds.svg) | Forge Worlds | A horizon with a settlement peak |
| [mark-hub.svg](mark-hub.svg) | Forge Hub | The company mark's ridge with the spark centred — home |

These are **wordless marks** for the switcher, favicons and tab icons. The full brand set per
product — mark 1024², wordmark 1024×384, favicon 512/192/32, OG 1200×630, social 1280×640,
apple-touch-icon — is generated from the registry by the pipeline in §7.

---

## 6. Forge Hub layout

The reference layout for the control centre. Regions, not pixels.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ◆ CloudsForge  │ ▾ Products │                    │ ⌘K search │ ◔ 3 │ ⬤ ash │  46px bar
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Portfolio                                            priced 14:22 · live  │
│  ┌──────────────────────────────┐  ┌────────────────────────────────────┐  │
│  │ £12,480.22          ▲ 2.4%   │  │ ▓▓▓▓▓▓▓▓░░░░  EMBER      42%      │  │
│  │ ╱╲    ╱╲                     │  │ ▓▓▓▓▓░░░░░░░  ETH        26%      │  │
│  │╱  ╲__╱  ╲___╱╲__             │  │ ▓▓▓░░░░░░░░░  SOL        18%      │  │
│  │  24h  7d  30d  1y            │  │ ▓▓░░░░░░░░░░  BTC        14%      │  │
│  └──────────────────────────────┘  └────────────────────────────────────┘  │
│   area, one series, no legend        sorted bars, direct-labelled, no pie   │
│                                                                            │
│  Needs you                                                                 │
│  ┌──────────────┐┌──────────────┐┌──────────────┐┌──────────────┐          │
│  │ ⏳ Deposit   ││ ⚠ 2FA is     ││ ▲ Bot paused ││ ◇ Offer on   │          │
│  │ 41/60 conf   ││ not enabled  ││ risk limit   ││ your listing │          │
│  │ ~9 min       ││ Enable →     ││ Review →     ││ 240 EMBER    │          │
│  └──────────────┘└──────────────┘└──────────────┘└──────────────┘          │
│   pending          security         trade           market                 │
│                                                                            │
│  ┌─── Wallets ──────────────────┐  ┌─── Activity ──────────────────────┐   │
│  │ ● EMBER  ember1q…4f2  primary│  │ 14:02 ◇ Listing sold      +240    │   │
│  │ ● ETH    0x8a…c31            │  │ 13:48 ● Deposit confirmed +0.5    │   │
│  │ ● BTC    bc1q…9k2   exported │  │ 11:20 ▲ Reward earned     +50     │   │
│  │ ○ 0x44…a1  external·verified │  │ 09:05 ✦ Token deployed           │   │
│  │ + Add or connect a wallet    │  │ Everything →                      │   │
│  └──────────────────────────────┘  └───────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
```

**Rules this layout encodes:**

1. **Portfolio first, and it carries its pricing timestamp.** A balance without one is a number
   the oracle may have stopped updating fifteen minutes ago.
2. **"Needs you" replaces a notification bell as the primary call to action.** Each card is a
   suggested next action with a verb, sourced from a different service, and each degrades
   independently — a card that cannot load is absent, not broken.
3. **Wallet lifecycle state is visible in the list**, not behind a detail view. `exported` and
   `external·verified` are facts a user must be able to see at a glance.
4. **Activity is a preview with one link out.** The full feed is its own page; the dashboard
   shows the last four.
5. **Every tile degrades alone.** The dashboard fans out to ten services; one slow upstream must
   cost one tile, not the page. This is an exit criterion of Phase 6.

The allocation bar showed `Shards 18%` and the offer card `240 SHARD` until 2026-08-07. Both were
replaced rather than deleted, because the point of a reference layout is the *shape* — four
allocation rows, a two-line offer card — and dropping a row would have quietly changed the shape
while fixing the copy. The asset codes here are illustrative and always were; what makes them
worth correcting is that a wireframe is what a designer copies, and copying a retired asset
(`RETIRED_ASSETS`, `contracts/packages/chain/src/index.ts`) into a new screen is how a dead
currency gets a second life. Percentages still total 100.
6. **No pie chart.** Allocation is sorted horizontal bars with direct labels, folding to "Other"
   past eight assets.

---

## 7. Asset pipeline extension

`asset-forge` today has 30 brand assets across 6 branded surfaces and 29 hand-written game
specs, generated by `gpt-image-1`, sized by shelling out to macOS `sips`, and written directly
into sibling repositories' working trees. Four changes make it serve the ecosystem:

1. **Derive the brand track from the registry.** For each surface with a `markId`, generate
   mark 1024², wordmark 1024×384, favicon 512/192/32, OG 1200×630, social 1280×640 and
   apple-touch-icon, seeded with **that surface's accent from the registry** rather than the
   hardcoded `#ff4d00` currently baked into `BRAND_STYLE`.
2. **Add the new surfaces**: market, worlds, hub, developers, beacon, status. Adding a product
   should generate its whole brand set for free.
3. **Replace `sips` with a cross-platform resize** so the pipeline runs in CI rather than only
   on one laptop. Twelve game masters currently sit at 1024² against declared 512²/256² because
   the refit has never been run.
4. **Record provenance.** Model, prompt, spec, cost and checksum per asset, so a brand kit is
   reproducible and a spend is attributable. This is the `asset` entity in
   [04-domain-model.md](../04-domain-model.md) §5.1 and is what lets `cloudsforge-studio` wrap
   the engine as a service with per-account credits.

**Brand style, stated so generated art matches the system:** flat geometric vector, warm ash
ground `#12100f`, single accent from the registry, no gradients, no photographic texture, no
text in the mark. Hearth's mark is currently generated in the *game* art style rather than the
brand style, which is why it does not visually match its siblings; that is corrected by making
the track derive from the registry rather than from a hand-written spec.

---

## 8. Accessibility rules

- **Contrast.** Body text ≥ 4.5:1 on its surface; large text and UI marks ≥ 3:1. Every accent
  above clears 3:1 on `--cf-bg-raised`, verified.
- **Never colour alone.** Status ships icon + label + colour. Product identity ships glyph +
  name + accent.
- **Focus is always visible.** `:focus-visible` styling exists in `ui.css` and must not be
  removed by a product's local CSS.
- **Reduced motion** is honoured globally; a product may not reintroduce animation.
- **Targets** are at least 24×24 CSS pixels, larger than the mark they contain.
- **Dark only.** The system has no light mode and does not pretend to. The one printed artefact —
  exported financial statements — uses its own light steps rather than an automatic inversion.
