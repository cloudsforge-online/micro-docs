# 24. One asset set per repository, and the comparison that decided which

> ## CONCLUDED. The challenger was evaluated, FLUX 2 Pro ships, and the candidate sets are deleted.
>
> **This document used to be called "Two asset sets, from two models" and described a comparison in
> flight.** It is now the record of one that finished. The owner has withdrawn **Qwen-Image 2512**
> from the estate; every `candidates/qwen-image-2512/` and `candidates/qwen-image-2512-positive/`
> tree in the four asset repositories has been deleted, along with their manifests, their deployment
> records and their registry entries. Each repository holds exactly one asset set again, and it is
> the FLUX 2 Pro set it always shipped.
>
> **The findings are kept in full, and that is the point of this rewrite.** The estate paid a
> deployment lifetime and 233 generations for them. Deleting the images must not delete the reason
> the estate chose what it chose, so §4 and §5 — the register finding, the one criterion the
> challenger cleanly won, and the rejected dialect hypothesis — are unchanged in substance. What
> changed is the tense, the file paths that no longer resolve, and the honest labelling of which
> figures can still be re-derived and which have outlived their source.
>
> **Nothing here is waiting on a re-run, a replay or a redeployment.**

This document records the shape of what is on disk, the machinery that makes a set switchable, and
the verdict — **FLUX 2 Pro, decisively** — with the one criterion the challenger cleanly won stated
as plainly as the ones it lost.

> **This document owns no numbers.** Every count, cost and defect tally lives in a `MANIFEST.json`
> or a `COMPARISON.md` inside the repository it describes, and this document cites those rather
> than copying them. That is deliberate and it is the estate's own recent lesson: the colour hexes
> duplicated into `assets/design-system.md` were wrong throughout a defect *and after the fix*,
> because only the test inside the package could stay honest. §7 lists what is not duplicated here
> and where its truth lives. §8 lists claims elsewhere that measurement has now made false.

---

## 1. What is on disk

Measured directly, **2026-08-04**, after the challenger was withdrawn and the candidate trees were
deleted. Counts are files under `assets/` (images only) against entries in `MANIFEST.json`.

| repository | reference set `assets/` | candidate sets |
| --- | ---: | --- |
| `micro-brand` | 98 files / 98 manifest entries (56 generated, 42 derived) | none — deleted |
| `micro-emberkin-assets` | 137 / 137 (83 gen, 54 der) | none — deleted |
| `micro-aetherholm-assets` | 101 / 101 (96 gen, 5 der) | none — deleted |
| `micro-tessera-assets` | 392 / 392 (288 gen, 104 der) | none — deleted |

The generated/derived split is the `derivedFrom` field: an entry carrying one is a deterministic
Pillow operation on that provider's *own* output — a Lanczos downscale or a centre crop — and is
therefore **not evidence about the model**. Only the generated entries were compared.

**These four counts are re-derived, not transcribed.** Each repository runs `python3 claims.py`,
which reads every figure its own documents state and recomputes it from the manifests; the three
sibling repositories additionally re-derive each other's, so a count copied between files cannot
stay wrong in only one of them. The figures above were also counted independently off the file tree
while this document was rewritten, and the `assets/` trees and `MANIFEST.json` blobs were confirmed
byte-identical to their previous commit — the FLUX packs are permanent by owner instruction and the
removal did not touch a single one of them.

> ### What was deleted, so the size of it is on record
>
> | repository | files removed | of which images | across |
> | --- | ---: | ---: | --- |
> | `micro-brand` | 105 | 101 | the literal set and the positive-dialect pilot |
> | `micro-emberkin-assets` | 147 | 143 | as above |
> | `micro-aetherholm-assets` | 109 | 105 | as above |
> | `micro-tessera-assets` | 394 | 392 | the literal set only; it had no positive pilot (§2.3) |
> | **total** | **755** | **741** | |
>
> Counted from the removal commits themselves (`git show --diff-filter=D --name-only`), not from
> the prose. The non-image files are each set's `MANIFEST.json` and `DEPLOYMENT.json`.
>
> **One figure in `micro-tessera-assets` does not survive that check and is flagged rather than
> repeated.** Its `COMPARISON.md` banner and its removal commit both describe its own challenger as
> *"288 assets + 104 derivatives, 741 files"*. 288 + 104 is 392, and its commit deleted 394 paths;
> **741 is the estate-wide image total across all four repositories, not tessera's.** The number is
> right and the scope attached to it is wrong — which is the same defect as §8.3 and §8.4 and
> reached this document by the same route, a figure quoted rather than re-derived. It is recorded
> here because `micro-tessera-assets` is not this author's to edit.
>
> **`micro-tessera-assets` is complete and is no longer in flight.** An earlier revision of this
> document recorded it mid-generation with rising file counts and warned that every tessera figure
> was a floor. The run finished at the target [23](23-tessera.md) states, its `COMPARISON.md` §8 is
> written, and **it reached that state at 0 verify failures from 70** — 40 of which were prompt-parity
> disagreements that vanished when the challenger was deleted rather than being repaired. That
> arithmetic is stated in its own commit message rather than left for a reader to assume, and it is
> the reason for §6.1 below.

---

## 2. The layout, and why it is deliberately not symmetric

### 2.1 Where each set lives

```
micro-<asset-repo>/
  MANIFEST.json                        ← the REFERENCE set's provenance. FLUX 2 Pro.
  assets/<surface>/<kind>-<w>x<h>.png  ← the REFERENCE set's bytes. Shipped.
  providers.json                       ← the registry: which models, where each set lives
  candidates/<provider-id>/            ← where a challenger goes. EMPTY TODAY.
    MANIFEST.json                      ← its OWN manifest, never merged with the reference's
    assets/...                         ← same relative paths, different bytes
```

The reference provider's root is the repository itself (`providers.json`, `"root": "."`), and a
challenger sits under `candidates/<provider-id>/`. **`candidates/` holds nothing today** — the
withdrawn model's two trees were deleted from it — and the layout is kept rather than flattened,
for the reason §6.1 gives.

**FLUX's set is not moved to `sets/flux/` to make the three roots look alike, and must not be.**
The reasoning is recorded at length in `micro-brand/providers.json`'s `$comment` block and again in
`micro-brand/materialise.py`, and it is a measurement rather than a preference:

- roughly twenty sibling repositories point at `assets/<surface>/favicon-32x32.png` and friends —
  each web app's `test/brand-chrome.test.ts`, `network-site/src/components/shell.tsx`,
  `deploy/compose/docker-compose.estate.yml`;
- four CI jobs byte-compare against those exact paths, and this repository's own CI globs
  `assets/**/*.png`;
- moving the tree would rewrite the `path` of **every entry in every manifest** — the precise
  opposite of leaving the reference byte-identical.

The asymmetry also states something true: the reference set is **shipped**, the others are **on
trial**. Promotion, if a challenger ever wins, is moving its tree to `assets/` and recording the
model on each entry's `provider` field.

> **The FLUX packs are permanent by owner instruction.** They are never moved, never regenerated
> and never deleted. A challenger writes to `candidates/` only.

### 2.2 One manifest per set, never one merged manifest

Regenerating a candidate must not be able to rewrite the file holding the reference set's
provenance, and a candidate is *expected* to be red for most of its life while the reference stays
green. `verify.py` takes `--provider` and reads exactly one manifest, so the two states cannot
collide. This is stated in `micro-brand/providers.json`'s `$comment`.

### 2.3 What makes the tooling shareable — and how far that actually goes

`providers.json` carries an `identity` block declaring how an asset is keyed in *that* repository —
`micro-brand` keys on `surface + kind + declaredSize`, the game sets on a single dotted `asset`
path. Naming the difference in data rather than in code is what lets the tooling be one copy
instead of three forks.

**Verified by hashing, and re-measured after the challenger was removed** — because two of the
claims this table used to make had gone stale, and a table of hashes that nobody re-runs is worth
less than no table. Measured 2026-08-04:

| file | md5 across the three siblings | in `micro-tessera-assets` |
| --- | --- | --- |
| `providers.py` | `291c546e00f17bbfe9ea74e9745820f1` | **identical** |
| `providers.ts` | `99e37bb1a46a77c96e6db2372b133d78` | **identical** |
| `backends.ts` | `b18bbc1501074777056cf49e3fccf4c1` | **identical** |
| `probe.ts` | `83761086f55e1558252351da3ead7ba2` | **identical** |
| `dialects.py` | `06b9295b414ebaf39bf1993cb7c06ccb` | **identical** |
| `dialects.json` | `933efdd97f88c2aae59d971e8dc0566e` | **identical** |
| `claims.py` | `a0a17ce8b11bc6a06e6ef15d25f94e83` | **absent** |
| `materialise.py` | `01e3fe0fb914bfc8deed55d26e343220` | **differs** (`b8b26daf…`) |
| `verify.py`'s `check_parity` function | `112f3a3c963df0fbcfc03f635557a987`, 9327 bytes | **differs** — 3295 bytes, no dialect re-derivation |

**Two things this table used to say are false and are corrected rather than quietly dropped.** It
recorded `materialise.py`, `dialects.py` and `dialects.json` as **absent** from
`micro-tessera-assets`; all three are present. And it concluded from the first of those that *"the
set-switching in §3 does not exist for tessera"*, which followed validly from a false premise and
was therefore wrong. `micro-tessera-assets` has `materialise.py` and differs from the siblings'
copy; whether that difference matters for set-switching is not measured here and is not claimed
either way.

**The four estate-shared files converged again during the removal**, which is why the top of the
table is now `identical` where it once read `differs`. `micro-tessera-assets` removed the
challenger first and the three siblings followed it, taking its post-removal `backends.ts`,
`probe.ts`, `providers.ts` and `providers.py` verbatim rather than re-deriving the same edits four
times. One consequence is worth flagging: `micro-tessera-assets/providers.json`'s header, written
mid-migration, still says the siblings *"still carry"* the OpenAI-images envelope. That was true
when it was written and is not now.

**`compare.py` is not byte-identical anywhere**, and `micro-brand/providers.json`'s `$identity`
comment used to claim it was. Measured: 52 differing lines between `micro-brand` and each game set,
4 between the two game sets, 121 against `micro-tessera-assets`. The divergence is real logic, not
commentary — the brand set reads a single registry accent (`read_accent`, with a per-kind coverage
floor) while the game sets read a polychrome image (`read_image`, coverage floor `0.005`), because
*a second hue is the specification in a painterly set and the defect in a flat one*. That is a good
reason for three implementations; it is not a reason for a comment to say there is one. **See
§8.1**, where that claim is now repaired at source and machine-checked in both directions.

---

## 3. Switching the estate onto a different set

`materialise.py` resolves every asset **the reference manifest defines** against a chosen set, and
writes the bytes out under the same relative path:

```
python3 materialise.py --provider flux-2-pro --into ../network-site/public --only network --flatten
```

A consumer never names a model. It names a destination. Because the relative path is identical in
every manifest by construction, a consumer's `/favicon-32x32.png` keeps working byte for byte
whichever set is behind it, and the variable lives in exactly one place: the invocation. A
`SET.json` receipt is written beside the files naming the provider, the count and the sha256 of
every file, so "which set is this container serving?" is answerable without an eye.

### 3.1 An incomplete set fails loudly and writes nothing

`micro-brand/materialise.py` raises `IncompleteSetError`, naming every gap, before the
first byte is written. There is **no fallback to the reference, ever.** A blend would produce a
directory that is mostly one model and quietly partly another, and every judgement made by looking
at it — which is the entire point of running a challenger — would be a judgement about something
nobody chose and nothing recorded.

This matters because incompleteness is the *common* case: a challenger is partial for most of its
life. That was measured rather than assumed — the withdrawn challenger stood at 97 of `micro-brand`'s
98 entries and 134 of Emberkin's 137 when it was last scored, and its positive-dialect pilot was 15
assets out of 235 on purpose. **Those two figures are no longer re-derivable**, since the manifests
they were read from went with the candidate trees; they are transcribed into `materialise.py`'s own
prose and labelled there. `--only` narrows the contract as well as the copy, so one web app can
take its own surface out of a set that is incomplete elsewhere.

### 3.2 Two alternatives rejected on measurement, not taste

Both rejections are recorded in `micro-brand/materialise.py`, and both rest on the same
measured fact: **nothing in the estate reads these repositories at run time.** Every consumer holds
a committed copy in its own `public/`, which Vite copies into `dist/` and the Dockerfile bakes into
an nginx image; `deploy/compose/docker-compose.estate.yml` mounts exactly one volume and it is
`initdb.sql`.

- **Serve-time selection** (a gateway mapping a stable URL onto a chosen directory) has no shared
  origin to rewrite — each app's nginx serves its own baked copy — and `deploy/gateway/dynamic/`
  routes by Host with no `/assets` rule to hang it on. Choosing it would mean first inventing the
  runtime seam it assumes.
- **A build-time variable every consumer honours** would mean roughly fifty edits across sixteen
  `index.html` files, nine CI `test -f` checks and seven byte-comparing tests — each one a place
  the switch can be half-applied. Materialising leaves every one of those literals correct and
  untouched.

The seam that actually exists is the **copy**, and before this it was manual, unrecorded and
undated.

---

## 4. The comparison, and its verdict

### 4.1 The criteria were fixed before any challenger image existed

`micro-brand/COMPARISON.md` is the estate-wide statement; the game repositories carry a short file
each recording only what is set-specific. It opens by saying why the timing matters: *once the
images are on screen it is very easy to discover that the thing the winner happens to be good at
was the thing that mattered all along.*

Six criteria: prompt adherence, **style coherence within the set** (named the one that matters
most, and measured as *spread, not average* — a uniform bias is correctable and invisible, an
erratic one has no house style), legibility at the size the asset is actually used at, artefact
rate, retries, and cost in the unit each model bills in.

Two properties of that document are worth carrying up to this level, because they are what makes
the verdict trustworthy rather than merely stated:

- **It grades its own favourite down.** Criterion 3's baseline is the *reference* set's:
  11 of its marks fall below 50% contrast retention at 16px. This is not a criterion FLUX passes
  and a challenger might fail — it is one FLUX already partly fails.
- **It refuses to score what it cannot measure.** The four by-eye defects are tallied by hand into
  `review/compare/artefacts.json`, and `compare.py` **says the criterion has no verdict** if that
  file is absent, rather than printing zero.

### 4.2 The failure is register, not quality

This is the finding, and it is unusually clean. Qwen-Image 2512 returns polished, competent,
internally consistent game-UI artefacts **whatever it is asked for**. From the by-eye tallies:

- `micro-emberkin-assets/review/compare/artefacts.json` — **9 of 9** type icons framed, **9 of 9**
  non-flat (bevel, glow or photographic texture), against 0 and 0 for FLUX. Its own note: *"the
  consistency is the point: this is not noise, it is a house style being applied over the brief."*
- `micro-aetherholm-assets/review/compare/artefacts.json` — **4 of 4** resource icons framed and
  bevelled. Its note: Qwen read every one as a mobile-game **item card** — decorative frame,
  bevelled centre panel, lighter background. *The subject is right every time*; the artefact type
  is wrong, which is why criterion 1's arithmetic largely passes it and the eye does not.

The same reading is visible in the bytes: **7.1× the file size per megapixel** on `micro-brand`'s
flat vector set against **2.6×** on the painterly game sets
(`micro-tessera-assets/COMPARISON.md`, `micro-tessera-assets/ART_BIBLE.md`). Flat
vector art does not compress to 1.3MB.

Two individual failures are worth naming because they are different in kind from being off-style:

- **`types/gale`** — the brief is a wind glyph; Qwen returned *a recursive grid of framed
  picture-boxes with no wind in it at all*. Its own repository calls this "Qwen's worst single
  asset in the estate".
- **`types/tide`** — a recognisable pastiche of Hokusai's *Great Wave* rather than a flat wave
  glyph. Flagged there beyond aesthetics: **a set of shipped brand assets that quotes a specific
  famous artwork is a different class of risk** from one that is merely off-style.

**The one criterion the challenger cleanly won: lettering.** Qwen spelled all **9 of 9** wordmark
names correctly and set them more confidently. FLUX rendered `hub/wordmark` as *"Home on the
Ridge"* — a phrase lifted from its own idea text rather than the registry name "Forge Hub", and the
same failure mode as its documented *"Sftware Company"* and *"Cartre Pere"*. Recorded in
`micro-brand/review/compare/artefacts.json`'s `$notes`, which states it as the one criterion where
the challenger is cleanly better. Anyone choosing a model **for a lettered asset** should read that
file and not this section's verdict.

**Verdict: FLUX 2 Pro, decisively** — `micro-brand/COMPARISON.md` §9.4.

### 4.3 The verdict was scoped, and tessera was the fair test it asked for

`micro-tessera-assets/COMPARISON.md` made the argument against inheriting the verdict, and it was a
fair one: a *flat* brief makes this comparison one-sided before it starts, Tessera's art direction
is painterly on purpose ([23](23-tessera.md) §1.1 cites the 7.1×/2.6× measurement as one of the two
facts that decided it), and so tessera was **the first genuinely fair brief the estate put to the
challenger**. Its §7.1 also noted the converse: that set generates *no lettering whatsoever*, so
the run was **blind to the challenger's single best measured capability**.

Both caveats were the repository's own, made before its results existed — which is what makes them
worth anything.

**The run completed, and the challenger lost that one too.** Its `COMPARISON.md` §8 is now written
and records the same verdict on criterion 1, by margins nothing else offsets. Its own summary of
why is the sharpest sentence in the whole exercise: *"Every one of its losses is a refused
constraint and none is a failure of craft."* The estate therefore has a consistent result across
four briefs — three prohibition-heavy and flat, one painterly and fair — rather than three and an
open question.

**The caveat that survives the verdict, restated so it is not lost.** Tessera generates no
lettering, so it could not re-test §4.2's one clean challenger win. Anyone choosing a model **for a
lettered asset** should still read `micro-brand/review/compare/artefacts.json`'s `$notes` rather
than this section's verdict.

---

## 5. The dialect experiment, and its rejection

### 5.1 The hypothesis was worth testing

The owner asked a fair question: if Qwen honours positives and disregards prohibitions, and this
estate's briefs are prohibition-heavy, then the defects in §4.2 may be partly **ours**.

It was not idle speculation — it rested on a measurement. **Qwen does not truncate.** A
2,238-character prompt with the ground clause deliberately last was received in full and
disregarded. So the prohibition-last technique this estate had built against FLUX does not
transfer, and a brief that is mostly prohibitions is close to the worst possible shape for that
model.

### 5.2 A dialect, so a second prompt style does not weaken parity

A **dialect** is a named, deterministic, total function from the prompt *on record* for an asset to
the prompt a set is actually sent. `literal` is the identity transform, has zero rules, and is what
every set before this was generated in. `positive` is an ordered rule list in `dialects.json`, read
by both `dialects.ts` and `dialects.py` — the same one-file-two-loaders arrangement `providers.json`
uses, so the halves cannot drift.

The two registry entries the pilot used differed in **exactly one field**. Same model, same
deployment, same route, same key, same concurrency — asserted by test — so a difference in output
had exactly one available explanation. Both entries have been deleted with the model; the test that
asserted the property now asserts it against a pair CONSTRUCTED in the test, because the property
worth keeping is *"the registry can express such a pair"* and not *"those two entries exist"*.

**"Positive" is enforced, not claimed.** `dialects.json` declares the vocabulary the dialect forbids
itself — *no, not, never, nothing, neither, nor, without, cannot, avoid, omit, exclude*
(`micro-brand/dialects.json`) — the transformed prompt is scanned for it on word boundaries
(`dialects.py` and `dialects.ts`, both `\b`-anchored regexes), and a prompt still
carrying any of it **cannot be sent**: `prompts.ts` throws `ResidualNegationError` before a
socket is opened.

The error class is worth reading (`dialects.ts`), because it names why it exists rather
than merely what it checks: *"This is a refusal to SPEND, not a lint… generating against a brief
that still holds four of them would answer a question nobody asked, on a deployment billed by the
hour, and the resulting set would carry a `dialect: positive` label that is not true of its own
prompts."*

### 5.3 The result: rejected on measurement

A pilot restated the prohibitions positively and regenerated **15** of the worst-documented assets.
The full tally is `micro-brand/COMPARISON.md` §9.3; the shape of it:

| | Qwen, literal | Qwen, positive | re-derived? |
| --- | --- | --- | --- |
| framed / bordered / boxed | 14 / 15 | **15 / 15** | yes |
| non-flat (3D, bevel, gradient, glow) | 15 / 15 | **15 / 15** | yes |
| ground not the flat ash field | 8 / 15 | **9 / 15** | yes |
| idea not recognisable from the plan | 1 / 15 | **8 / 15** | yes |
| construction guides drawn | 1 / 15 | **0 / 15** | **no — one repository did not score this row** |
| recognisable pastiche of an existing artwork | 1 / 15 | **0 / 15** | **no — one repository did not score this row** |

(FLUX is 0 in every row. The literal column's single un-framed asset is `currency-ember`, which came
back as a plinth-mounted 3D ring — *the positive dialect added the frame*.)

**The `re-derived?` column is not decoration, and an earlier revision of this table got this wrong.**
The first four rows are sums that `claims.py` recomputes from all three repositories'
`review/compare/artefacts.json` on demand; idea drift is **1 / 15**, and this document previously
printed 2 while §8.4 below simultaneously flagged 2 as the error. The last two rows are **not**
summable: one repository each declined to score them and recorded the absence in `$unscored` with
its reasoning, so `claims.py` reports those rows UNVERIFIED rather than summing a partial total. An
unscored row and a row scored zero are different statements and only one of them is evidence — so
they are printed with the reviewers' figures and marked, rather than being silently totalled or
silently dropped.

**The hypothesis is rejected.** Framing and bevelling survived a brief containing **not one
prohibition word** — verified rather than assumed, by the residual gate in §5.2. We asked in the
negative and it framed everything; we asked in the positive and it framed everything. That is the
model's register. It is not truncation and it is not a misread brief, and §4.2's finding is
strengthened rather than qualified.

**What positive phrasing genuinely fixed**, and it is a real effect worth keeping: construction
guides went to zero, and both assets flagged as a *different class* of failure came back
on-subject — `types/gale` stopped being a recursive grid of picture frames, and `types/tide`
stopped being a Hokusai pastiche and returned a plain wave curl. So the dialect does pull the model
back onto the subject when it has wandered off it entirely.

**What it made worse**, and why: idea drift more than tripled. Restating a *shape prohibition* as a
*positive description* hands the model more shape vocabulary, and it elaborates on it — `types/lumen`
grew three bevelled spheres, `types/umbra` became a segmented ring rather than a disc with a
crescent bitten out, `icons/resource-skysteel` became a plain cube rather than a notched ingot.
**Long positive descriptions crowd out the subject.**

### 5.4 Phase 2 was correctly not run

Regenerating all 233 assets in this dialect would have spent a deployment lifetime to confirm a
negative already established at 15 of 15 with zero variance, and would first have required writing
rules for the recorded prompts the transform does not clear (`python3 dialects.py --residuals`
reports the state of the corpus). **Stopping was the finding**, and it is recorded as one.

**What is kept, now that the model itself is gone.** The mechanism, because the next model will
raise the same question and `dialects.json` is estate code shared byte-for-byte across four
repositories. The measurement, because *"the register did not move under a positively-phrased
brief"* is a stronger statement about that model than anything obtainable without running it. The
recorded literal prompts in every `MANIFEST.json`, which remain the corpus whenever there is a
second model to put them to.

**What is not.** The 15 pilot images were the evidence and they have been deleted with the rest of
the candidate trees. Their scored tallies survive in each repository's
`review/compare/artefacts.json` — which is what §5.3's table is drawn from and what `claims.py`
still re-derives it against — but the images themselves are gone and cannot be re-examined. That is
a real loss and it is stated rather than glossed: a reader who wants to disagree with the by-eye
scoring no longer can.

---

## 6. What was kept, what it cost to keep, and the check that lost its operand

### 6.0 The mechanism, worth keeping regardless of the verdict

Prompt parity used to mean **"every provider was sent the byte-identical string"**. Once two sets
are legitimately sent *different* strings, equality can no longer be the check — and what replaced
it is **stronger**, not weaker.

| | before | now |
| --- | --- | --- |
| two sets, same dialect | byte-identical prompts | **unchanged** |
| two sets, different dialects | could not happen | the candidate's recorded prompt must be **exactly what its dialect's rules produce from the reference's record** |

Equality could only ever say *"these two strings differ"*. **Re-derivation says "this string is not
what this dialect produces from the record."** That catches three things none of which look like
disagreement, and none of which was catchable before:

1. a hand-edited prompt,
2. a rule added after a run,
3. **a set whose declared dialect is not the one it was actually generated in.**

Four properties hold alongside it, asserted rather than described: a candidate still cannot invent
an asset the reference never generated (the transform's *input* is the reference record, so
`MissingReferencePromptError` fires as before); `promptFor` still takes no provider argument, so a
dialect is per-*set* and declared in a registry rather than a per-model tweak hidden in a builder;
`--reprompt` is refused outside the literal dialect, which holds the record every other derives
from; and `compare.py` refuses to print a single-question verdict over a cross-dialect selection,
naming the dialect of every column in its header.

This generalises past image models. It is the correct shape for any comparison where the inputs are
allowed to differ **by a named, declared rule** and by nothing else.

---

### 6.1 The seam is kept whole, and the reason is written down rather than assumed

**Nothing was collapsed because there is one provider today.** `providers.json` is still an
N-provider registry, `backends.ts` still exposes a provider-agnostic backend interface,
`dialects.json` still registers the `positive` dialect no set was ever shipped in, and `verify.py`
still carries the cross-set prompt-parity check. `candidates/` still exists and is empty.

The argument is not sentiment. The estate has a **stated 3D and animation gap FLUX cannot fill**
([19](19-new-products.md):97), so a next challenger is a question of when rather than if — and
reinstating that machinery later would be a rewrite rather than an edit, while keeping it costs a
directory that is empty and a check that has nothing to do.

**What was deleted is only what could not outlive the model.** Its OpenAI-images envelope in
`backends.ts`, and the transposed-`size` compensation written for that one endpoint's bug — the
endpoint took `size` and returned the transpose while *reporting* the size it was asked for, which a
square probe cannot see and which nearly rotated every non-square asset in the estate. The tests
that pinned that workaround went with it, because **a test pinning a deleted workaround can only
ever fail for the wrong reason.**

**The transposition DETECTION was kept and generalised**, and this is the distinction worth carrying
up to this level: the workaround was one vendor's, the *measurement* is not. `generate.ts` still
measures every delivered non-square image against what it asked for and refuses to keep a transpose,
for any provider. Deleting the smoke alarm along with the fire is how the bug comes back.

### 6.2 A check that lost its operand, and how four repositories were made to say so

**This is the part of the removal most likely to have gone wrong quietly, and it is the estate's
most-repeated defect.** Prompt parity compares sets *to each other*. Deleting the only challenger
left it with one operand, so it now returns clean **because it was handed one document, not because
it looked and found nothing** — and an exit code cannot tell those two apart. In
`micro-tessera-assets` this was dramatic: 40 of its 70 failures were prompt-parity disagreements
against the deleted set, and all 40 vanished at a stroke with nothing about the shipped set changed.
In the other three it is subtler and more dangerous, because they were already at zero: **a check
that stopped looking produces the identical output to a check that looked and passed.**

The estate found five other instances of that shape in a single day — a CI job that read image
metadata without decoding the image, a grep that skipped files containing NUL bytes, a secret scan
whose `-I` discarded the binary stream it was meant to search, a watchdog polling the wrong node, a
browser suite that stubbed every request it was meant to exercise.

So all four asset repositories now do two things instead of printing a zero:

1. **`verify.py` prints the word `DORMANT`** on every run, naming the check, saying it had one set
   to look at, and stating that the clean result is a fact about how many manifests are on disk.
2. **`verify.py --self-test` hands the real function two-set fixtures**, in CI, before the verifier
   runs. It asserts in **both directions** — a check that always fails is exactly as useless as one
   that never does — over the four ways two sets stop being comparable: divergent prompts within a
   dialect, a set whose prompt is not what its declared dialect derives, a `positive` set whose
   prompt still carries prohibition vocabulary, and a set holding an asset the reference never
   generated.

**Proven rather than asserted, in each of the three sibling repositories.** Neutering `check_parity`
turns exactly the four *must-fail* self-tests red and leaves the six *must-pass* ones green.
Registering a second **live** provider against a copy of the shipped manifest with one word changed
in one prompt turns the full run red on exactly that asset. Appending one byte to a shipped image is
reported as a checksum failure, which is the evidence that the checks that are *not* dormant — every
per-asset check, and they are the overwhelming majority — still bite.

**One instance of the same defect was found in the test suites while doing this**, and it is
recorded because the fix is the interesting part. `parity.test.ts`'s cross-dialect test ended
`assert.ok(checked > 0, 'no non-literal provider is registered, so this property is untested')` — a
dormancy guard its author was right to write, and which started **failing** the moment the
positive-dialect entry was deleted. It was **not** relaxed to `>= 0`, which would have made a check
pass by removing its ability to fail. The loop was moved onto the set the property is actually
about: *dialects*, which `dialects.json` still registers whether or not any set was generated in
one. That is strictly broader coverage than what it replaced.

### 6.3 Figures that outlived their source, and are labelled as such

`compare.py` reads manifests. Two of the three it compared are gone, so **it can never print those
columns again.** Each repository's `COMPARISON.md` therefore carries the last output it did print,
transcribed verbatim, together with the deployment record that lived in the deleted tree — hours,
the 233-generation window shared across all three repositories, the mean seconds per generation, the
17 minutes of billed warming before it served, and the three ARM routes that failed to delete it.

**Every one of those transcribed figures is explicitly labelled as no longer re-derivable, and
`claims.py` no longer pins it.** That labelling is the whole discipline: a number that outlives its
source while keeping a confident tone is precisely the defect `claims.json` was written after, and
§8.3 below is a list of five such numbers. Five claims per repository were deleted along with the
manifests they read; the rest still bind, and `claims.py` caught two real breakages during this
rewrite — including a figure the rewrite itself had dropped, which was restored rather than having
its claim removed.

---

## 7. What this document deliberately does not duplicate

| what | where its truth lives |
| --- | --- |
| per-asset provenance, prompt, cost, retries, checksums, c2pa | each set's own `MANIFEST.json` — never a merged one (§2.2) |
| the criteria, the full tallies, the asymmetries, the wall-clock and cost analysis | `micro-brand/COMPARISON.md`, with a short set-specific file in each game repository |
| the by-eye artefact tallies and their denominators | `review/compare/artefacts.json` in each repository — each carries a `$scope` naming exactly what it is counted out of |
| the measured wire contract for each model | `providers.json`, per provider, in the `notes` array |
| deployment hours and teardown state | **transcribed** into each repository's `COMPARISON.md` cost section. The operator's `candidates/<id>/DEPLOYMENT.json` was deleted with the candidate trees, so this row no longer points at a live file and the figures it held are no longer re-derivable — see §6.2 |
| the positive dialect's 31 rules and its forbidden vocabulary | `dialects.json` |
| Tessera's manifest and art direction | [23](23-tessera.md) |

Two figures in particular are **not** repeated here because they are traps that the source files
already document as traps: summing `providerCostUnits` across a manifest **double-counts**, since a
derivative inherits its parent's cost so a reader can see what the file behind it cost; and a
per-image cost for a per-hour provider is a statement about *how well the run was organised*, not
about the model — Cosmos 3 Super billed for its entire deployment lifetime and produced **zero
images**, and no per-image figure can express that.

---

## 8. Claims elsewhere that measurement had made false — and which are now repaired

Found while verifying an earlier revision of this document, when they were outside its author's
scope and could only be flagged. **Most have since been repaired at source**, and each entry below
now says which. The section is kept rather than deleted because the repairs are only trustworthy if
the reader can see what was wrong, and because two of them are still open.

| | claim | state |
| --- | --- | --- |
| 8.1 | `compare.py` described as byte-identical across repositories | **repaired** — `providers.json` now carries a machine-readable `shared` block that `claims.py` re-derives in both directions |
| 8.2 | `23-tessera.md` — brand ships zero C2PA | **repaired in place** here; the `micro-brand` copies are repaired too |
| 8.3 | five stale figures in `micro-brand` | **repaired**, and four of the five are now pinned by `claims.py` |
| 8.4 | table and prose disagreeing about idea drift | **repaired** — both are now pinned to the same derivation |
| 8.5 | two ledger lines predating the current sets | **still open**, and deliberately so — see below |

### 8.1 `micro-brand/providers.json` — `compare.py` is not byte-identical across repositories

Its `$identity` comment says naming identity in the registry *"lets `providers.py`, `compare.py` and
`verify.py`'s parity check be byte-identical copies across all three repositories"*. Two of those
three hold; `compare.py` does not, by 52 lines against each game set (§2.3). The narrower claim
about `verify.py`'s *parity check* specifically is exactly true — 6514 bytes, one md5, three
repositories — which is worth noting, because the imprecision is in the paraphrase and not in the
engineering.

### 8.2 `docs/ecosystem/23-tessera.md` — brand's C2PA claim is now wrong twice over

It reads: *"`brand` ships **zero** C2PA — all 94 entries are `c2pa: false`, including the 54 FLUX
generations."* Measured against `micro-brand/MANIFEST.json` today: **98 entries, 56 generated, and
2 carry `c2pa: true`** — `assets/currency-ember/mark-1024x1024.png` and
`assets/currency-spark/mark-1024x1024.png`.

The mechanism behind the exception is consistent with the lesson the line was drawing, which is why
it is worth stating rather than merely correcting: the two currency marks were generated *after*
the comparison concluded, and were not put through `normalise_ground.py`, whose PNG writer drops
the ancillary chunk the C2PA hash is bound to. So the lesson tessera inherits — *use the fixed
writer from the first asset* — is unchanged and still correct. Only the count and the word "zero"
are wrong. **This line is in this repository and is corrected in place; the note is kept here
because the same stale numbers appear in `micro-brand/COMPARISON.md` and, which are not
mine to edit.**

### 8.3 `micro-brand/COMPARISON.md` — three stale figures, all from the same cause

The document was written before `currency-ember/mark` and `currency-spark/mark` were generated, and
its §8 says so explicitly. It was not renumbered afterwards:

| claim | source | measured today |
| --- | --- | --- |
| `micro-brand` (94) | `COMPARISON.md` | 98 manifest entries |
| 54 generated | `COMPARISON.md`, §5 | 56 |
| C2PA on **0 of 94** files | `COMPARISON.md` | 2 of 98 (§8.2) |
| *"32 rules, applied in order"* | `COMPARISON.md` | **31** rules in `dialects.json`'s `positive` dialect |
| *"the Qwen brand set is 93 of 94 today"* | `materialise.py` | 97 of 98 |

**None of these changed any verdict** — the currency marks are that document's own §8 subject and
reproduce the finding rather than disturbing it. They are recorded because the estate has repeatedly
been bitten by exactly this: a number written once, correct at the time, and never re-derived.

**All five are now repaired, and four are pinned so they cannot rot again.** `micro-brand/claims.json`
re-derives the entry count, the generated count, the C2PA count and the dialect rule count from the
manifests and `dialects.json` on demand, and a pattern that stops matching is a **failure** rather
than a pass — which is the failure mode this kind of guard normally rots into. The fifth,
`materialise.py`'s challenger-completeness figure, was pinned to the candidate manifest and could
not survive its deletion; it has been transcribed into that file's prose and **explicitly labelled
as no longer re-derivable**, and its claims were removed rather than left to report UNVERIFIED for
ever. `claims.py` treats "could not be checked" as *not a pass*, and a permanent not-a-pass is a
broken build that teaches people to ignore the exit code.

### 8.4 An internal inconsistency in the pilot's own prose

`micro-brand/COMPARISON.md` §9.3's **table** gives "idea not recognisable" as 2/15 → 8/15; its
**prose** three paragraphs later says *"Idea drift went from 1 of 15 to 8 of 15."*
`micro-emberkin-assets/COMPARISON.md` independently said 2 of 15, and the per-repository tallies
sum to **1**. **The table was the outlier, not the prose** — the opposite of what this section
originally concluded, and the correction is left visible rather than quietly rewritten.

**Repaired, and repaired in the only way that holds.** Both the table and the prose in all three
repositories are now pinned to the *same* derivation, summed over the three repositories' own
`$pilot` blocks, so they cannot disagree with each other or with the scoring again. §5.3's table
above carries the corrected figure.

### 8.5 Two ledger lines that predate the current sets

`18-build-status.md` records `micro-brand` as *"73 generated assets"* and
`19-new-products.md` refers to *"The 73-asset brand run"*. The manifest holds 56 generated and
98 total. [18](18-build-status.md) is a dated ledger and 73 may have been an accurate total at the
moment it was written, so **this is flagged, not corrected** — reconstructing the historical state
would need the run's own history and I did not do that. A reader should treat `MANIFEST.json` as
the count and those two lines as history.

---

## 9. What is verified, and what still is not

**Three things on the earlier revision of this list have since been settled, and saying which is the
point of keeping the list at all.**

### 9.1 Settled

- **CI runs, and it is green.** The earlier revision recorded *"GitHub Actions is billing-blocked
  org-wide — jobs fail in seconds with zero steps executed — so no green run was observed and none
  is claimed."* That is no longer true: the repositories are public and Actions is free for them.
  The removal commit's run in `micro-brand` is **`success`**, both jobs (`verify.py` and `hygiene /
  Secret hygiene`), and its log carries the `--self-test` step at `0 of 10 self-test(s) failed`
  followed by the verifier's `DORMANT` line and `0 failure(s) across 1 set(s)`. **A green run was
  observed and is claimed.** Red runs elsewhere in the estate's history are left in place; none was
  deleted.
- **Tessera's final figures.** The run completed at 392 entries and its `COMPARISON.md` §8 is
  written (§1, §4.3). Nothing about that repository in this document is a floor any more.
- **The four estate-wide asset counts.** Re-derived by `claims.py` in each repository and counted
  independently off the file trees during this rewrite (§1).

### 9.2 Still not verified, and one of them is now permanent

- **That the FLUX packs cost what the manifests say.** `providerCostUnits` is copied from
  `request_meta.cost` on each response; there is no invoice in the estate to reconcile it against.
- **The by-eye artefact tallies.** These are human judgements in `artefacts.json`. What is verified
  is that each file's `$scope` states its denominator honestly, that its counts are internally
  consistent, and — now — that every summable row agrees with the column it was taken from, which
  `claims.py` checks. **Not** that any given image is or is not framed. §4.2 and §5.3 restate scored
  tallies, not this document's own scoring.
- **Whether the withdrawn deployment was ever torn down.** Its record read `teardown.state: "NOT
  TORN DOWN — STILL BILLING"` and named the manual portal action required, because none of three ARM
  routes could delete it. **That record has itself been deleted** along with the candidate trees and
  is now transcribed into each repository's `COMPARISON.md`. It was a record of a moment
  (2026-08-03T08:30:17Z) and never a live reading; nothing in this estate can confirm the current
  state, and **this is the one item on this list that can no longer be resolved from here.** If the
  deployment was never removed by hand it is still billing.
- **The scored pilot images themselves.** They were deleted with the candidate trees (§5.4). The
  tallies survive; the evidence behind them does not, so a reader who disagrees with the scoring
  can no longer inspect what was scored.
