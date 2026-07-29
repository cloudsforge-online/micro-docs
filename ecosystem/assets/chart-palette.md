# CloudsForge chart palette and mark spec

The data-visualisation layer of the CloudsForge design system. Every value here was produced
by running the palette validator against the estate's real dark surface — none of it was
chosen by eye.

**Surface used for every check:** `--cf-bg-raised` = `#141110` (the panel colour, which is what
charts actually sit on — not `--cf-bg`).
**Mode:** dark only. The CloudsForge system is dark-first (`.cf-dark`, `color-scheme: dark`);
there is no light mode in any app. Light steps are derived only for exported PDF financial
statements, which are the one printed artefact.

Reproduce any claim below with:

```
node scripts/validate_palette.js "<hex,hex,…>" --mode dark --surface "#141110"
```

---

## 1. Why the product accents cannot be the chart palette

The registry ships six product accents: ember `#e8622c`, crypto `#ff5a1e`, mint `#ff8a1f`,
play `#d9812f`, lantern `#f4a63c`, crucible `#3fc8bb`. **Five of the six are orange.** As a
categorical palette they collapse — under deuteranopia they are one hue, and under normal
vision four of them are within ΔE 10 of each other.

So the chart palette is a **separate, validated set that lives beside the brand**, anchored by
ember in slot 1 so charts still read as CloudsForge. Product accents keep doing what they are
for: chrome, the active nav state, the primary CTA. They are never a series colour, with one
exception — a single-series chart *about that product* may use that product's accent, because
with one series there is no identity work for colour to do.

## 2. Categorical — adjacent forms (bar, stacked bar, line, area)

Eight slots, assigned **in this order, never cycled**. The ordering is the CVD-safety
mechanism: it was derived by enumerating all 5,040 orderings with ember pinned to slot 1 and
keeping the one that maximises the minimum adjacent separation.

| Slot | Hue | Hex | Token |
| --- | --- | --- | --- |
| 1 | ember | `#e8622c` | `--cf-viz-1` |
| 2 | teal | `#2a9e93` | `--cf-viz-2` |
| 3 | gold | `#ad8418` | `--cf-viz-3` |
| 4 | cyan | `#2494b4` | `--cf-viz-4` |
| 5 | violet | `#7d5ce0` | `--cf-viz-5` |
| 6 | rose | `#cc5384` | `--cf-viz-6` |
| 7 | blue | `#3d7ed6` | `--cf-viz-7` |
| 8 | green | `#4f9c40` | `--cf-viz-8` |

```
[PASS] Lightness band      all 8 inside L 0.48–0.67
[PASS] Chroma floor        all 8 >= 0.1
[PASS] CVD separation      worst adjacent #7d5ce0↔#2494b4  ΔE 12.3 (deutan)
[PASS] Normal-vision floor worst adjacent #ad8418↔#2a9e93  ΔE 17.3
[PASS] Contrast vs surface all 8 >= 3:1
```

A ninth series is never a generated hue. It folds into "Other", becomes small multiples, or
the chart is the wrong form.

## 3. Categorical — all-pairs forms (scatter, bubble, choropleth, small multiples)

In these forms any two marks can sit side by side, so every pair must separate, not just
neighbours. **The eight-slot order does not survive that test** — ember↔gold collapses to
ΔE 2.8 under deuteranopia, and teal↔cyan to ΔE 6.7 under normal vision.

**Cap: four series, from this dedicated quartet.**

| Slot | Hue | Hex |
| --- | --- | --- |
| 1 | gold | `#ad8418` |
| 2 | cyan | `#2494b4` |
| 3 | violet | `#7d5ce0` |
| 4 | rose | `#cc5384` |

```
--pairs all
[PASS] CVD separation      worst #ad8418↔#cc5384  ΔE 8.6 (deutan)
[PASS] Normal-vision floor worst  ΔE 18.7
[PASS] Contrast vs surface all 4 >= 3:1
```

Beyond four series in an all-pairs form: facet, fold to "Other", or direct-label. Do not add a
hue. No five-hue subset of the eight passes all-pairs on this surface — that was checked
exhaustively, not assumed.

## 4. Sequential — magnitude (heatmaps, choropleths, density)

One hue, ember, seven steps. On a dark surface the ramp runs dark→light, and the step nearest
the surface still clears 2:1 so "near zero" is visible rather than invisible.

| Step | Hex | | Step | Hex |
| --- | --- | --- | --- | --- |
| 100 | `#6b3a22` | | 500 | `#e88a55` |
| 200 | `#8c4522` | | 600 | `#f2a97b` |
| 300 | `#ae5025` | | 700 | `#f8c8a5` |
| 400 | `#d66430` | | | |

```
--ordinal
[PASS] Lightness monotone · [PASS] Adjacent ΔL all >= 0.06
[PASS] Light-end contrast  #6b3a22 at 2.02:1 vs surface
[PASS] Single hue          spread 15°
```

When two sequential contexts appear at once, the second takes teal (`--cf-viz-2`) as its own
one-hue ramp.

## 5. Diverging — polarity (P&L, balance change, drift from target)

**Gain `#8fd06a` · neutral `#493c2d` (ash-500) · loss `#e2705a`.**

These are the values Crucible already ships (`apps/crucible/src/components/EquityChart.tsx`),
and this spec **endorses them rather than replacing them**. They deliberately sit outside the
categorical lightness band, and that is the point: the two poles are separated by *lightness*,
not only by hue, which is what makes a green/red financial convention survive deuteranopia.

```
[PASS] CVD separation      ΔE 10.9 (deutan) · 27.5 (tritan)
[PASS] Normal-vision floor ΔE 26.0
[PASS] Contrast vs surface both >= 3:1
[----] Lightness band      deliberately exceeded — lightness IS the encoding here
```

Darkening them into the categorical band was tested and **collapses CVD separation to ΔE 4.5**.
Do not "fix" this pair.

Equal step count per arm; the midpoint is neutral ash, never a hue.

## 6. Status — reserved, never a series colour

| Role | Chart hex | Chrome token today | Icon |
| --- | --- | --- | --- |
| good / operational | `#7fae5c` | `--cf-success #93a97c` | ● |
| warning / degraded | `#f4a63c` | `--cf-warn #f4a63c` | ▲ |
| critical / down | `#d2543a` | `--cf-danger #d2543a` | ■ |

The chart green is a step greener than the chrome token: at `#93a97c` the good↔warning pair
lands at normal-vision ΔE 14.9, below the 15 floor. `#7fae5c` clears it at 16.7. **The chrome
token is not changed** — sage `#93a97c` is doing brand work in the bar and in Forge Pay's
accent, where it never sits next to amber.

Three states, not four. A "serious" step between warning and critical was tested and cannot
clear the normal-vision floor against warning on this surface (`#e8834f` ↔ `#f4a63c`,
ΔE 9.4). Beacon's existing three-state model is correct; keep it.

**Status colour never appears alone.** Every status mark ships icon + label + colour, because
the status page is the one surface a colourblind user reads under stress.

## 7. Mark and layout spec

| Element | Spec |
| --- | --- |
| Bar / column | 4px rounded data-end anchored to the baseline; square at the baseline |
| Stacked segments, adjacent bars | **2px gap in the surface colour** between fills |
| Overlapping marks (scatter, dots on lines) | 2px ring in the surface colour |
| Lines | 2px, no shadow, no gradient stroke |
| Markers | ≥8px hit-visible; ≥24px hit target |
| Grid | `--cf-line` at 1px, horizontal only, behind the marks |
| Axes | `--cf-fg-mute`, no axis line on the value axis |
| Labels, values, legends | **Text tokens only** (`--cf-fg`, `--cf-fg-dim`, `--cf-fg-mute`) — never the series colour |
| Legend | Always present for ≥2 series; **absent for 1** (the title names it) |
| Direct labels | For ≤4 series, in addition to the legend; never a number on every point |
| Numerals | `--cf-font-mono` for all values, tabular alignment |
| Hover | Crosshair + tooltip on line/area; per-mark tooltip on bar/dot/cell. The only exception is a bare stat tile with no plot |
| Filters | One row above the chart, never inside it |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` disables all transitions — already honoured in `ui.css` |

## 8. CSS token block

Add to `@cloudsforge/ui/tokens.css` under the existing semantic layer. These are chart roles,
not new brand colours.

```css
:root, [data-cf-substrate] {
  /* categorical — adjacent forms, assigned in order, never cycled */
  --cf-viz-1: #e8622c;  --cf-viz-2: #2a9e93;
  --cf-viz-3: #ad8418;  --cf-viz-4: #2494b4;
  --cf-viz-5: #7d5ce0;  --cf-viz-6: #cc5384;
  --cf-viz-7: #3d7ed6;  --cf-viz-8: #4f9c40;

  /* all-pairs forms (scatter, bubble, small multiples) — cap 4 */
  --cf-viz-ap-1: #ad8418; --cf-viz-ap-2: #2494b4;
  --cf-viz-ap-3: #7d5ce0; --cf-viz-ap-4: #cc5384;

  /* sequential — ember, dark→light */
  --cf-viz-seq-100: #6b3a22; --cf-viz-seq-200: #8c4522;
  --cf-viz-seq-300: #ae5025; --cf-viz-seq-400: #d66430;
  --cf-viz-seq-500: #e88a55; --cf-viz-seq-600: #f2a97b;
  --cf-viz-seq-700: #f8c8a5;

  /* diverging — P&L */
  --cf-viz-gain: #8fd06a;
  --cf-viz-mid:  #493c2d;
  --cf-viz-loss: #e2705a;

  /* status — reserved, always with icon + label */
  --cf-viz-good: #7fae5c;
  --cf-viz-warn: #f4a63c;
  --cf-viz-crit: #d2543a;

  /* chart chrome */
  --cf-viz-surface: var(--cf-bg-raised);
  --cf-viz-grid:    var(--cf-line);
  --cf-viz-axis:    var(--cf-fg-mute);
}
```

## 9. Where this replaces something that exists

| Today | Change |
| --- | --- |
| Crucible's local gain/loss pair | **Promoted, unchanged**, into `--cf-viz-gain` / `--cf-viz-loss`. It was right. |
| Crucible's ad-hoc chart series colours in `EquityChart.tsx:20-25` | Replaced by `--cf-viz-1..8` |
| Lantern's Lantern-only 5-level severity ramp | Keep — log severity is an **ordinal** scale, not a status scale, and correctly uses one hue's steps |
| Beacon's `charts.js` hand-rolled series colours | Replaced by the token block |
| Grafana default palette | Overridden by a CloudsForge theme JSON generated from this block, so operator dashboards and product charts agree |

## 10. Anti-patterns, specific to this estate

- **No dual-axis charts.** Hashrate and difficulty are two scales; they are two panels.
- **No pie charts for allocation.** Sorted horizontal bars with direct labels; ≥8 assets fold
  to "Other".
- **Never colour nominal bars by their value** — bar length already encodes magnitude; spending
  the identity channel on it wastes it.
- **Never recolour survivors when a filter changes the series count.** Colour follows the
  entity, not its rank.
- **Never plot a balance without its pricing timestamp.** The oracle can be stale by up to
  `PAY_ORACLE_MAX_AGE_SECONDS`; a chart that hides that is a chart that lies.
- **An empty chart and a failed chart must not look the same.** Render an explicit "no data
  answered" state, as Beacon and Lantern already do.
