# 18 — Build status

Where the programme actually stands, by repository. Everything else in this directory describes
what *should* be built; this file records what *has been*, so that anyone picking the work up —
including a future agent with no memory of the sessions that produced it — can tell the two
apart without reading 46 repositories.

**This document is a ledger, not a plan.** It is updated when a repository lands, and it never
claims a repository is done on the strength of intent. "Done" here means the specific thing
[17-definition-of-done](17-definition-of-done.md) says it means: installs, typechecks under the
strict settings, tests green, migrations present, `.env.example` with placeholders only, CI
calling the org's reusable workflow, and pushed to `cloudsforge-online`.

Last verified: 2026-08-01.

---

## 0. Correction, 2026-08-05: the estate is public

**This document is a ledger, so nothing below is rewritten — but two of its findings are now
false, and they are cited from other repositories, so the correction belongs at the top rather
than in the entry it corrects.**

§3.5(1) reads "**Nothing is deployed.** No environment, no gateway routing, no release manifest
exercised", and the deployment bullet in §2 reads "Repository-complete and deployment-zero is the
honest summary". Both were true when written. On 2026-08-05 the estate went public:

- **23 mainnet hostnames answer** over the public internet, on a certificate the public already
  trusts (Google Trust Services, via Cloudflare), served from one home server behind a tunnel.
  17 of them return 200 — 14 product and marketing surfaces plus 3 operator consoles.
- **Hearth mainnet is running and mining**, chain id **7411**, JSON-RPC at
  `https://rpc.cloudsforge.online`. Verified by `eth_chainId` returning `0x1cf3` and
  `eth_blockNumber` advancing across successive calls.

**What this does not mean, stated here because a ledger is where an overstatement would be
inherited from:**

- **EMBER has no monetary value.** No market, no listing, no liquidity, no price. That was true
  before today and is untouched by any of the above.
- Mainnet is a few hundred blocks old. Reachable is not established.
- **Two configured hostnames do not work**: `api.cloudsforge.online` answers 502, and
  `worlds-api.cloudsforge.online` has no DNS record at all.
- **There is no publicly reachable testnet.** Cloudflare's Universal SSL covers the single-label
  wildcard `*.cloudsforge.online`, which matches `testnet.cloudsforge.online` but not
  `hub.testnet.cloudsforge.online`. A two-label wildcard needs Advanced Certificate Manager, which
  is paid and is not bought, so every testnet subdomain fails the TLS handshake at Cloudflare's
  edge before reaching the estate.
- One machine. No redundancy, no failover, and no backup that has ever been restored.
- Nobody outside the project has used any of it.

§3.5(2), (3) and (4) are not addressed here and are not claimed to have changed.

---

## 0.1. Correction to the correction, later on 2026-08-05: the testnet is public

**§0 was measured earlier the same day and two of its bullets did not survive it.** They are left
above rather than edited, because §0 is itself cited from other repositories, and a bullet that
quietly changes meaning is worse than one that is superseded in writing.

**The testnet is publicly reachable.** §0 said it was not, and gave the certificate as the reason.
The reason was right and the conclusion was overtaken: rather than buy Advanced Certificate
Manager, **the hostname scheme was changed so that every testnet hostname is a single label.**

| | Mainnet | Testnet |
|---|---|---|
| A surface | `<surface>.cloudsforge.online` | `<surface>-testnet.cloudsforge.online` |
| The front page | `cloudsforge.online` | `testnet.cloudsforge.online` |
| JSON-RPC | `https://rpc.cloudsforge.online` | `https://rpc-testnet.cloudsforge.online` |
| P2P | `wss://p2p.cloudsforge.online/p2p` | `wss://p2p-testnet.cloudsforge.online/p2p` |
| Chain ID | **7411** (`0x1cf3`) | **7412** (`0x1cf4`) |

The environment is a **suffix on the first label**, not a second label. `ENV_LABELS` and
`splitEnvLabel()` carry it in the registry (`ui/packages/ui/src/surfaces.ts:1030-1078`), and the
comment above them states the change and its cause directly
(`ui/packages/ui/src/surfaces.ts:995-1010`). The split is on the **last** hyphen, so that
`worlds-api-testnet` reads as `worlds-api` on `testnet` rather than as `worlds` on an environment
called `api-testnet` (`ui/packages/ui/src/surfaces.ts:1042-1046`).

**`X.testnet.cloudsforge.online` is dead in every form.** Any document still showing it — including
§0 above, §3 and §8 of [26-public-deployment](26-public-deployment.md), and
[27-cloud-deployment](27-cloud-deployment.md) — is describing a scheme that was never reachable.

**Measured over the public internet on 2026-08-05**, after §0 was written:

- **All 16 UI surfaces return 200 on each network**, plus the apex on each: mainnet
  `cloudsforge.online` and testnet `testnet.cloudsforge.online`. The 16 are `admin`, `aetherholm`,
  `beacon`, `create`, `developers`, `emberkin`, `explorer`, `foresight`, `hub`, `lantern`,
  `market`, `network`, `status`, `tessera`, `trade` and `worlds`.
- **Both chains answer with their own identity.** `eth_chainId` over JSON-RPC POST returned
  `0x1cf3` from `rpc.` and `0x1cf4` from `rpc-testnet.` — the EIP-155 replay domains are distinct
  on the wire, which is the thing `node/src/params.js:37-38` exists to guarantee. Mainnet
  `eth_blockNumber` was `0x477`.
- `nimbus`, `pay` and `vault` return **200 on `/livez` and 404 at `/`** on both networks. That is
  correct rather than a fault: they are `servesUi: false`
  (`ui/packages/ui/src/surfaces.ts:728-925`) and are not pages. Neither they, nor `account`, `api`
  or `worlds-api`, may be linked from a nav or a footer.
- `p2p.` and `p2p-testnet.` return **426** at `/p2p`, which is the WebSocket upgrade response.
  Only that path is routed.

**The `worlds-api` bullet in §0 is misleading, and is corrected here.** It has no DNS record, which
is true, but §0 lists it beside a 502 as though both were faults. The game API was consolidated
into `api.`, so **`worlds-api.` is retired, not broken** — it should be dropped from documents as a
live endpoint rather than reported as down. It does, however, **still exist as a registry row**
(`ui/packages/ui/src/surfaces.ts:770-783`), which is a genuine inconsistency: the registry
publishes a surface for a hostname the estate no longer serves.

**What has not changed, repeated so §0's honesty is not diluted by better news:**

- `api.cloudsforge.online` still answers **502**. Open defect, issue #35, and until it is fixed
  nothing external can be built against the public API.
- `www.cloudsforge.online` does not resolve at all.
- **EMBER has no monetary value on either network.** Testnet EMBER is worthless *by construction* —
  it is given away, and the testnet may be restarted from genesis. Mainnet EMBER is worthless *so
  far*: no market, no listing, no price. The faucet is a route on the Network site rather than a
  host of its own (`ui/packages/ui/src/surfaces.ts:545-561`), so **the testnet faucet is
  `network-testnet.cloudsforge.online/faucet`**, and nothing gives away mainnet EMBER.
- Still one machine, still no restored backup, still nobody outside the project using any of it.

---

## 1. The number

Of the repositories this programme creates or changes — the 46 in
[03-repository-responsibilities](03-repository-responsibilities.md) less the three left exactly
as they are (`hearth`, `asset-forge`, `stack`), plus the five added by
[19-new-products](19-new-products.md) and the three added by [20-aetherholm](20-aetherholm.md) —
**every one is built, and all of them are green.**

| Group | Target | Done | Left |
| --- | ---: | ---: | ---: |
| Domain services | 24 | **24** | **0** |
| Frontends | 14 | **14** | **0** |
| Operations | 3 | 3 | 0 |
| Libraries | 4 | 4 | 0 |
| Org infrastructure | 3 | 3 | 0 |
| **Total** | **48** | **48** | **0** |

Five further repositories exist that the plan did not enumerate as products — `brand`,
`conformance`, `deploy`, `docs` and `emberkin-assets` — and Aetherholm added three more. The
working tree holds **58 directories**: 56 `micro-` repositories in `cloudsforge-online`, plus
`hearth` (the legacy repo, deliberately unchanged) and `kindred-upstream` (a mirror of
`savvaniss/kindred-resonance`, not a CloudsForge repo at all). Neither of the last two is
`micro-` prefixed, which is worth knowing before running any estate-wide sweep by name: a sweep
that assumes the prefix reports them as having no CI rather than as unmigrated, and that is how
`hearth`'s one red workflow stayed invisible.

Verified 2026-08-03 by sweeping all 58: every working tree clean, nothing unpushed, and the
latest `main` run green in all 56 `micro-` repositories. `hearth`'s `ci.yml` and `publish.yml`
are green; its `pages.yml` fails because GitHub Pages is not enabled on that repository, which
is a settings decision left to the owner rather than a defect in the code.

**This section used to contradict §3.2**, saying "40 done, 8 left" while §3.2 said 52 built
against 48 targeted. Both cannot be true. The count above is the one that was checked against
the repositories themselves rather than against a previous revision of this file.

**Repository count is the least useful measure of the three, and it is the one that flatters.**
The truthful reading is that the *expensive* half is behind us. Everything that touches money,
keys, chain state or identity is built and adversarially tested: ledger, custody, settlement,
indexer, wallet, pricing, billing, identity, policy. What remains is dominated by frontends,
which are lighter per repository, and by three operational services whose behaviour is already
specified in [13-operational-model](13-operational-model.md).

**CI is green across all 32 repositories** (verified on the runner, 2026-07-31) — including the
sixteen that silently had no workflow file at all, despite the definition of done claiming CI
everywhere. That claim is now true rather than assumed.

**Two services now run together** — identity and ledger, with real migrations, a real database and
real cross-service authentication (§3.3g). The other eighteen still do not, and no environment
exists beyond a local compose file. Phase exit is
defined by behaviour in an environment, so on the criteria in
[06-ecosystem-workflow](06-ecosystem-workflow.md) no phase has formally exited.

---

## 2. Done

Test counts are `test(` declarations counted statically across each repository's `*.test.ts`.
Actual run counts are equal or slightly higher, because a few suites generate cases in a loop.

### 2.1 Libraries and org infrastructure

| Repo | Tests | Notes |
| --- | ---: | --- |
| `micro-runtime` | 117 | Six packages. Replaces the six byte-identical `obs.ts` copies and five divergent auth middlewares. |
| `micro-contracts` | 176 | Four packages built (`-chain`, `-events`, `-money`, `-auth`). `-market`, `-worlds`, `-create`, `-devplatform` are not yet cut. |
| `micro-ui` | 70 | Design system. Product accents corrected from ΔE 4.1 to 17.0 — the original set was not distinguishable under two of the three common CVD simulations. |
| `micro-org` | 33 | The `.github` repo: `cfctl`, reusable workflows, the contract-compat checker. |
| `micro-service-template` | 41 | Wires every runtime lib. `cfctl new service` instantiates it. |
| `micro-web-template` | 65 | Vite, React 19, design system, runtime host resolution, honest 404. |

| `micro-sdk` | 148 | The public SDK and CLI, and **zero runtime dependencies** — a public package cannot `link:` a private repository. All 65 exposed routes carry a `verifiedAt` citation into the serving line, a test walks the client to prove no method reaches outside that table, and the 24 routes whose services never call `authenticate()` are sent **no `Authorization` header** — the 403-on-every-listing defect encoded as a test. The CLI is read-only by design: the SDK can spend and withdraw, the CLI cannot, because a shell is where a typo becomes a request. |

### 2.2 Domain services

| Repo | Tests | The thing it proves |
| --- | ---: | --- |
| `micro-identity` | 137 | MFA, sessions, refresh-token family reuse detection, JWKS rotation. |
| `micro-ledger` | 122 | Double-entry. The deferred constraint is proven by bypassing the service with raw SQL — an unbalanced journal cannot be committed even by an attacker with a database connection. |
| `micro-custody` | 173 | HD BIP-39/BIP-44 derivation. The admin reveal endpoint was deleted rather than guarded. |
| `micro-wallet` | 180 | Holds no balances. Composes ledger, custody and indexer. |
| `micro-settlement` | 116 | The chain-keyed lease, proven by running two workers against one chain — this is the lost-payment race. |
| `micro-indexer` | 130 | Multi-chain with a simulated reorg, tested against a real Hearth node. Its second row below records what it gained since; the two rows are one repository. |
| `micro-pricing` | 82 | Quotes live in a table, not a `Map`, so a restart does not silently reprice. |
| `micro-billing` | 90 | Entitlements with scope, expiry and revocation. |
| `micro-policy` | 66 | Fail-closed and fail-open are separated deliberately, per decision in [12-security-decisions](12-security-decisions.md). |
| `micro-activity` | 43 | Inbox deduped on `source_event_id`. |
| `micro-notify` | 119 | A critical notification ignores preferences — enforced three independent ways, because one mechanism is a mechanism that gets refactored away. |
| `micro-mint` | 125 | A deploy leaves the request (202). The estate's 180-second held request is gone. **An order that cannot be built is refused before it can be paid for** — the order route runs the deploy path's own `variantFor` and `constructorArgs` against the request rather than a second copy of the rule (§3.3n). |
| `micro-worlds` | 119 | A private world is finally provisioned — the defect that made the feature inert. |
| `micro-studio` | 121 | FLUX 2 Pro generation with provenance recorded per asset. |
| `micro-hub-api` | 77 | Seven degradation tests: one upstream down never blanks the dashboard. |
| `micro-market` | 291 | Escrow is a *reference* to a ledger reservation, never a balance. Royalty splits sum exactly to the sale price in bigint. Proven end to end: one balanced entry, debit 1000 SHARD against credit 925 + 25 + 50. |
| `micro-trade` | 227 | A backtest is byte-identical across 100 runs on one seed, and genuinely differs on another. A fill whose ledger answer was lost is credited once. Two workers, one bot tick, one execution. |
| `micro-foresight` | 153 | The Hearth-native prediction market. **The service has no key and holds no stake** — `stake-intent` hands a wallet the contract address and calldata, and the wallet signs. Drop the `positions` table and every stake is still in the contract and every winner can still `claim()`. Contract invariants are proven against the *executed committed bytecode* on `@ethereumjs/evm`: fee + payouts + residue == pool exactly, residue < winners, double-claim reverts, claim-after-void refunds whole with zero fee. The fee comes off the losing pool only, so a winner never gets back less than they staked; a market nobody won voids rather than handing the treasury a windfall. |
| `micro-indexer` | (same repo, above) | Gained two read routes two services were blocked on (§3.3j). **`confirmed` requires `status = 'success'`**, not merely depth: a reverted EVM transaction is mined and gathers confirmations exactly like one that worked, so a depth-only check would have called a failed escrow deposit confirmed. Confirmations count against the **stored canonical head**, never the provider-claimed tip — the head is what the service walked and would have found a reorg in. A balance is absent, never zero, unless the canonical chain runs unbroken from genesis to the asked height. |
| `micro-analytics` | 283 | **Every domain service is now built.** Pseudonymity is salted, because the specified `HMAC(user_id, pepper)` is a pure function of two surviving inputs and **cannot be erased** — so erasure destroys a per-subject salt, and the constraint is written as two legal states rather than an equivalence, since the obvious equivalence admits a row that nulled the pseudonym and kept the salt, which erases nothing. There is no free-text property type at all: enum, short code, bounded integer, boolean. A raw subject is refused by `sql.unsafe` with the service bypassed. |
| `micro-community` | 268 | Governance, and **the treasury subject is a generated column** (`'community:' || id`): a CHECK cannot express it, because the value derives from an id the INSERT creates, so generation removes the code path that could write a wrong one rather than guarding it. A vote row is keyed by *whose power it spends* rather than who pressed the button, which makes both orders of the double-vote race impossible — a member voting in person overrides their own proxy. Delegation cycles are refused by a recursive CTE **under a per-community advisory lock**, without which two concurrent inserts each see a graph missing the other's uncommitted row and both commit a loop. |
| `micro-admin-api` | 257 | The operator BFF. **The audit chain is honest about what a chain cannot see**: a hash chain catches an edit or an interior deletion, but truncation followed by a full re-hash verifies perfectly — so checkpoints catch that, and the test asserts BOTH directions, including that the truncated remainder verifies without them. Four eyes are enforced three times over, with the layer above bypassed at each level: the route, a `WHERE` clause, and a CHECK constraint. |
| `micro-devplatform` | 256 | The credential-issuing service, and **the database refuses a fast hash**: `api_keys_slow_kdf_only` constrains `secret_algo` to a scrypt parameter string, so an SHA-256 row cannot be stored even by a caller holding a connection — the ledger's deferred-constraint discipline applied to a password table. Keys are `cfk_live_<lookup>_<secret>`: the lookup id is stored clear and unique, so a leaked key is revocable from a log line and a verification costs one indexed lookup rather than a scrypt run per row. A revoked key and an unknown one are byte-identical over HTTP and cost exactly one KDF run each. |
| `micro-nda` | 175 | *Ninety Days After*. **The resolution engine is byte-identical to the ancestor, proved against the ancestor EXECUTING** — the corpus recorder imports the frozen `resolve.ts` unmodified, seeds a real Postgres with 21 hand-built worlds and reads back every row, rather than comparing against a re-implementation. The corpus was itself mutation-tested: its first version survived one-digit changes to upkeep, the warband threshold and the raid divisor, which is how it came to catch 18. |
| `micro-emberkin` | 75 | The second Forge Worlds title, ported from *Kindred: Resonance*. **The ported RNG reproduces the C# `NextDouble()` bit-for-bit** (compared as raw IEEE-754 int64, not epsilon), and a corpus of 10 recorded battles replays byte-identically from seed — the same behavioural-equivalence discipline the trade backtest uses. No balance column; a cosmetic equip is a billing entitlement and never a stat. |

### 2.3 Frontends

| Repo | Tests | The thing it proves |
| --- | ---: | --- |
| `micro-hub-web` | 174 | Every call cites the `hub-api` line that serves it. Where hub-api serves no route — transfers, notification preferences, a device inventory — the page renders a named hole rather than a plausible screen over nothing. |
| `micro-site` | 185 | No number appears on the marketing site that is not checkable against something real in this estate. |
| `micro-emberkin-web` | 430 | The game client. **It deletes the battle engine, the RNG and the localStorage save path it inherited** — a client that can resolve a battle can lie about one, so battles resolve server-side and a test plus a CI step fail if any of it returns. `three` is lazy: the dex, party and wardrobe download no renderer. |
| `micro-foresight-admin-web` | 241 | The operator console, its own bundle by design. Irreversible actions are gated by consequence-in-sentences, then a required rationale, then typing a phrase naming the market AND the outcome — never "Are you sure?". It asserts the ABSENCE of three routes it might have invented, including a close endpoint (the contract closes itself). |
| `micro-status-web` | 204 | The public status page, and **green-on-unknown is structurally unreachable**: one rule — an incomplete answer may report a problem, never health — driven through every one of eight failure outcomes. Its redaction allowlist is restated on the reading side and tested by bolting internal fields onto every level of a document and searching the *rendered HTML*. The uptime strip encodes each day three times, because the estate's reserved status hues are ΔE 4.6 apart under protanopia. |
| `micro-foresight-web` | 357 | The public prediction market. **It recomputes the question hash in the browser** from the canonical bytes the service serves — `foresight/src/server.ts:420-423` puts that document on the wire precisely so nobody has to take the platform's word for what they staked on. Odds are the pool ratio in bigint, always rendered with the pools that produce them; the stake projection adds the stake to the pool it is paid from, showing dilution rather than the ~33% overstatement the naive formula gives. `claim` reads the contract through the reader's own wallet — chain outranks mirror and the two are never blended, so the page keeps the button live even when it cannot confirm the amount. |

Cutting it found two defects in `micro-web-template`, both fixed there and both worth recording
because the template is the source of the ten frontends still to come: the error envelope is
**nested** (`{error:{code,message,requestId}}`) and was read as flat, so every server-side failure
would have rendered `[object Object]` while discarding the request id the support flow runs on;
and the CI step forbidding the SPA 200-fallback grepped `nginx.conf` unstripped, matching the
comment that explains why the fallback is forbidden — so the template failed its own pipeline,
and a guard that fires on its own rationale is a guard people delete.

### 2.4 Operations

| Repo | Tests | The thing it proves |
| --- | ---: | --- |
| `micro-lantern` | 204 | Log triage. Credentials are scrubbed at ingest before persistence — a planted `sk-`/`ghp_`/`AKIA`/bearer/DSN-password/`Set-Cookie` is provably absent from the database afterwards, which the frozen ancestor never did (it stripped NUL bytes and called it sanitising). A noisy message carrying a UUID or address groups stably instead of once per occurrence. |
| `micro-faucet` | 157 | Testnet EMBER faucet, and **the process holds no key**: a drip is a native transfer with empty calldata, which is exactly the `transfer` shape custody's `treasury` purpose maps to, so custody signs it. It uses its own treasury address rather than the platform's, so it and settlement never share a nonce. The lease was proven by *removing* it — two and four workers then rely on the partial unique index alone. |
| `micro-beacon` | 369 | **The release gate (AD-04), and it is fail-closed.** An unknown refuses before anything else is considered, and an override cannot reach an unknown — enforced three independent ways: in `decide()`, by the CHECK constraint `gate_decisions_indeterminate_never_promotes`, and by the CLI exiting 2 when it cannot reach Beacon. Six known refusal codes and six unknown ones. |

Two design corrections it found while building, both worth keeping: budget exhaustion derives from
consumed parts-per-million rather than `remaining <= 0`, because a 100%-objective SLO allows zero
bad events and would otherwise have been frozen permanently *for being perfect*; and
`probe_state.updated_at` is nullable on purpose, because defaulting it to `now()` makes every newly
added probe wait a full interval before its first run.

It also retired an inherited rationale rather than inherit it: the old implementation argued
`/metrics` must never touch Postgres, which is sound for one replica holding state in a `Map` and
wrong with replicas, where it yields a different answer depending on which one Prometheus reached.

### 2.5 Supporting repositories

| Repo | Tests | Notes |
| --- | ---: | --- |
| `micro-emberkin-assets` | — | 83 planned, **83 delivered** (134 files with derivatives), CI run 30663724437 green. Prompted from the `visuals.json` spec the game already ships. Grounds normalised numerically: delivered range was `#040404`–`#4c4c44` across 20 distinct values; all 123 flat assets now measure `#12100f` exactly in four corners (the 11 exceptions are full-bleed scenes, where a brand ground does not apply). All 24 evolution lines inside the 45° family ceiling. |
| `micro-brand` | — | 73 generated assets. Grounds normalised numerically to exactly `#12100f`; FLUX will not reproduce an exact hex and delivered `#232324`–`#3f3a3b` across the run. |
| `micro-conformance` | 59 | A recorded corpus of 60 interactions from the live estate — the behavioural baseline a successor must match. |
| `micro-deploy` | — | OTel collector, Prometheus, Tempo, Loki, Grafana. Configuration only; not running. |
| `micro-docs` | — | This directory. |

Across the estate: **~6,750 tests**, all green at last run.

---

## 3. Left

### 3.1 Partially built, paused on disk

**Nothing.** `micro-community`, which sat here, is built and green.

### 3.2 Not started

**No repository in the migration plan remains unbuilt.** All 24 services, all 14 frontends
(`micro-network-site` was the last), `faucet`, `beacon`, `sdk` and every library are built, tested
and green — 52 repositories against the 48 the plan targeted. An earlier revision of this section
listed twelve frontends, an operations repo and a library as not started; every one of them has
since shipped, and the section was describing a world several weeks gone. **A status document
whose "Left" section is the least accurate part of it is worse than no status document**, because
it is the first thing a successor reads.

What is genuinely left is not repositories:

- **Deployment.** The only running composition is the two-service slice (identity + ledger).
  Nothing is deployed beyond it; no host routing exists for any frontend; the indexer is reachable
  through no public host (its reads are anonymous and CORS-enabled now, so the gap is routing, not
  the service). Repository-complete and deployment-zero is the honest summary.
- **The bootstrap.** No route grants `admin` (§3.3g, deliberate); a fresh deployment has no
  operator until a manual database update, and nothing documents that as a deploy step yet.
- **The open findings below**, each recorded in its own subsection with what would close it.
- **Aetherholm** ([20-aetherholm.md](20-aetherholm.md)) — the third Worlds title. The service is
  complete through phase 2 (title contract, fleets, battles, sealing — the title-contract gap this
  document recorded is closed, and heraldry now lands on the shared profile); the client and the
  art run remain, target set 52 → 55.
- **The Engagement Treasury** ([21-engagement-treasury.md](21-engagement-treasury.md)) — the
  answer to every empty room's cold start: a disclosed, ledger-native platform bucket funded by
  the platform's own published miners (the consensus carve-out was considered and refused — it
  would quietly outgrow the "no premine" copy), spent as symmetric at-open-only house seeds in
  Foresight, subsidies and bounties in Market, season budgets in the titles, and free first
  experiments in Trade — never as ghost demand. Operator-controlled through three approval-gated
  admin actions with caps in the schema. Build order in its §8; nothing may move before the caps
  exist.
- **One registry footnote:** `faucet`'s row carries `devPort: 3003`, which is *correct by the
  field's contract* — a `basePath` surface's devPort names the host it rides on (`network`), and
  the co-hosting is declared in `CO_HOSTED`. The gap is that no field names where `micro-faucet`
  itself binds (4013); readers keep re-reporting it as the sixth wrong devPort. It is not — it is
  the one place the registry's own schema has nowhere to put a true fact.

### 3.3 What the CI could not do, and can now

Recorded because it is the most consequential thing found so far and none of it is visible in a
repository count. Every service and frontend declared a call to the org's reusable workflows, no
repository had pushed, and so **the workflows had never once run**. They could not have worked:

| Defect | Consequence |
| --- | --- |
| `micro-org`'s Actions access was `none` | No repository in the org could call a reusable workflow at all. |
| `service-ci.yml` had no Postgres container | Fifteen database-backed suites could not run. |
| Suites *skip* without a DSN rather than fail | So the consequence was a **green** pipeline that had executed none of the ledger's deferred-constraint, custody's overdraft-trigger or settlement's lease assertions. Green while proving nothing, and believed. |
| Rule 1 compared the declared variable by exact string | Rejected all fifteen services, for reading their own test database. |
| Thirteen `grep` captures lacked `|| true` | `grep` exits 1 on no match and GitHub runs `bash -e`, so each check **aborted on a clean repository**. They were red on correct code and had never passed anywhere. |
| `secret-hygiene` knew `changeme`, not `CHANGE_ME` | Failed five services on obvious placeholders — while passing a remote `postgres://` DSN carrying its password. |
| `web-ci.yml` required an invented deep link to return 200 | The exact opposite of the estate's honest-404 rule, which `web-template` fails the build over. A frontend could satisfy one guard or the other, never both. |
| The `image` smoke test booted the container against a DB that was not there | `index.ts` asserts its schema before binding and `env.ts` validates at import, so with no database and no config the container exits before serving. The job could never pass for any service. (9th defect, fixed with the test job's Postgres, `--network host`, and a `smoke-env` input.) |

All fixed, each verified in both directions — correct code passes, a planted violation is still
caught — and pinned by 56 tests in `micro-org`.

**Resolved on 2026-07-31: all 32 repositories are green on the real GitHub runner.** The root
cause was as diagnosed — the npm scope `@cloudsforge` does not match the org `cloudsforge-online`,
so GitHub Packages cannot host these packages and publishing was never available. Option 2 was
therefore the only coherent exit: the reusable workflow now checks out `micro-runtime` and
`micro-contracts` (and `micro-ui` for frontends) as siblings with a `contents:read` token, installs
each sibling's OWN dependencies first — `link:` resolves through the sibling's `node_modules`, so a
`link:` with no sibling installs as a *dangling symlink*, which is why `Install` passed while
`Typecheck` could not find one `@cloudsforge` module — and passes the same directories to
`docker build` as named build contexts.

Three further defects surfaced only by running it (10–12), all fixed with regression tests:
`contract-compat.yml` fetched the checker from the private org repo with the **job token**, scoped
to the calling repository, so it failed for every contract repo; the checker linked only the
workspace-root `node_modules`, so under pnpm the base side resolved to `any` and every real type
read as a breaking change; and well-known-symbol members carry TypeScript's per-compilation symbol
id, producing hundreds of phantom findings. On the real repository this moved a wall of false
breakage to 256 vs 256 paths and exit 0 — while deleting `Posting.sequence` still exits 1 and names
it. **`micro-contracts`' `pnpm compat` had been pointing at a `tools/compat.ts` that has never
existed in that repository, so the estate's contract-compatibility gate had never run anywhere.**

### 3.3a Cross-service defects, and the only thing that finds them

Every service's suite is green, and that has now twice failed to catch a client calling a route
that does not exist. Both were found the same way — by a *new* service reading the upstream's
actual route table while writing its own client — and never by a test.

| Defect | Consequence |
| --- | --- |
| `wallet` called `GET /v1/quotes`; pricing serves `GET /rates` | Found by `hub-api` reading both. |
| `market` called `POST /v1/decisions/market.listing`; policy has **no `/v1` routes at all** and takes the action in the body, and registers `market.listing.create` not `market.listing` | Found by `foresight`. |

The second is worth stating precisely, because it was first reported to me as the gate being
*bypassed* — a 404 swallowed into `review` + `degraded`. Checking it against the source showed the
opposite: `peerDecided` is true for **any** 4xx (`runtime/packages/http/src/index.ts:49-51`), so the
404 landed on the `deny` branch and `market/src/server.ts:678` turns a deny into 403. The
marketplace was not unmoderated — **it was closed. Every listing creation returned 403.** The two
failures need opposite fixes, so guessing between them would have fixed neither.

Fixed, plus the flaw the investigation exposed: a 404 or 405 no longer counts as a decision at
all, because a route that does not exist is our own misconfiguration and says nothing about a
seller's listing. Eight new tests assert the **request** — path, action name, body shape, the
amount crossing as a decimal string — rather than the response, which is the gap that let both
defects live: every existing test stubbed fetch and asserted behaviour given a reply.

A third instance followed within a day, and it was not a route: `micro-foresight-web` found that
the accent added to `micro-ui` for its own product was written `[data-product='foresight']`,
missing the `cf-` prefix every other product carries. The rule matched nothing, so the product
rendered in the company ember — **it looked entirely correct while wearing the wrong colour** — and
seventy-five green tests in `micro-ui` could not see it. The same commit gave the product
`devPort: 4011`, which is `beacon`'s, so a local Forge Foresight resolved to the monitoring
service. Both are fixed, with guards proven against the defects by reintroducing them.

**This is the case for the consumer-driven contract testing in
[14-testing-strategy](14-testing-strategy.md), which is still a strategy rather than a passing
gate.** Three for three, what caught the defect was a downstream reader consuming the upstream for
the first time — never the upstream's own suite. That does not scale to 48 repositories, and the
third case shows the gap is wider than routes: it is any promise one repository makes that another
consumes.

### 3.3b What generating the Emberkin art taught, worth keeping

The run cost ~129 generations for 83 assets — 46 of them retries — and every retry traced to a
prompt defect rather than model randomness. Four are worth recording because they generalise:

1. **Two copies of the colour table.** `plan.ts` wrote the subject noun and `generate.ts` wrote the
   albedo clause, each holding its own nine colour words. Correcting only one produced a
   regenerated asset that measured *identically wrong*, and cost a paid call to discover. One
   table now, looked up by hex. Duplicated constants drift in prompts exactly as they drift in
   code.
2. **A motif names a shape and a material, never a colour.** All seven verdant Kin inherit
   `"leaf frills, bark plating"` verbatim from upstream `visuals.json` — and bark is brown. The
   same clause explains frost (`"ice crystal spines"` → white), Stormcrow
   (`"hollow bones, streamer feathers"` → black) and umbra (`"void-black core"` → black). Four
   apparently separate defects, one cause.
3. **"Deepened" means richer, not darker.** The apex-stage direction said "darker shadow ramps";
   the model took that to black, so branch tips passed every numeric measure and still did not read
   as family members. A metric can be satisfied by an image that fails the intent.
4. **Colour words are measurable, so measure them.** Same prompt otherwise: "fresh leaf green" →
   hue 74, "emerald" → 96, "jade — halfway between emerald and teal" → 132–134, and adding
   "SATURATED" pushed it back to 103. Choosing words by measurement rather than by taste is what
   made the fix converge.

The method that kept it cheap: **all fifty portraits were measured against their anchors before
anything was regenerated**, and each correction was trialled on one asset before a line of seven
was re-run. That is why the pass cost 37 calls rather than ~150.

### 3.3c A defect in the frozen estate: the testnet faucet defaults to mainnet

Found while porting `hearth/tools/faucet`, and recorded rather than fixed, because
`stack/` is frozen and the successor supersedes it.

`stack/repos/hearth/tools/faucet/src/env.js:94` defaults `chainId` to **7411**. The exact-pinned
`contracts-chain` package puts EMBER at `{mainnet: 7411, testnet: 7412}`
(`contracts/packages/chain/src/index.ts:57`). So the faucet's shipped default is **mainnet**, and
its boot check (`src/index.js:71-75`) compares the node against that *configured* value — it
verifies agreement, not identity — so a mainnet node passes cleanly. The configuration did not
even match the network it runs against: the local testnet node answers `0x1cf4`, 7412.

It was never deployed, which is the only reason this is a finding rather than an incident. A
faucet exists to give away money; one that can be pointed at mainnet by leaving a variable unset
will eventually be.

`micro-faucet` refuses to start against any chain id that is not the testnet's, and proves the
refusal with a test — the difference between checking that two values agree and checking that a
value is the right one.

### 3.3d The public API has no description, and no route map

Found by `micro-sdk`, which needed both and could get neither. Recorded because each is a P11
blocker in its own right and neither is visible from any repository's tests.

1. **No OpenAPI description exists anywhere in the estate**, though
   [11-data-and-contract-strategy](11-data-and-contract-strategy.md):288 names it as the mechanism:
   the public API's description is "published, used to generate `@cloudsforge/sdk`". The named
   mechanism has no artefact, so the SDK is hand-written against verified route tables instead —
   65 of them, each citing the line that serves it.
2. **The gateway has no public-API route map.** `deploy/gateway/dynamic/policy.yml` carries CORS,
   security headers and the `/internal` refusal, and nothing that mounts a public API at all. The
   public path layout is therefore undefined, which is why the SDK uses the services' own paths and
   exposes a `pathPrefix` seam rather than inventing one.
3. **Path versioning is split down the middle.** `wallet`, `market`, `mint` and `worlds` serve
   `/v1/…`; `ledger`, `foresight`, `pricing`, `activity` and `identity` do not. The public API is
   specified as URL-versioned, so either the gateway rewrites — undefined, per (2) — or half the
   public surface ships unversioned.
4. **A machine credential has no whoami.** `identity/src/server.ts:540` refuses a service token on
   `GET /auth/me`, so a devplatform API key will have no way to ask what it is.
5. **Nothing in `ledger` is third-party reachable** (`ledger/src/server.ts:575` refuses any
   non-service principal). That is correct — but it means the eleventh test of "one platform", one
   financial source of truth, has no public surface at all.

**`mint` has no route-level idempotency infrastructure** — no helper, no table, no module — so
`POST /v1/tokens` creates a second draft order on a retry. Left as a recorded gap rather than
fixed: the consequence is a duplicate draft (the route charges nothing and deploys nothing), and
porting a subsystem into a shipped service is not a change to make unattended. `market`'s
equivalent gaps *were* fixed, because it already had the machinery.

### 3.3e Three frontends shipped with no favicon

An audit of all fourteen planned frontends against the brand sets, prompted by the owner asking
whether any component was missing assets.

Two surfaces had **no assets at all** — `status` and `explorer`. Both carry `markId: null` in the
registry, deliberately: a status page is Beacon with its internals removed and an explorer is part
of Forge Network, so neither should claim a mark. But that reasoning covers the mark and stops
there, and each is served from its **own subdomain**, which inherits neither a tab icon nor a share
card. A third kind set — favicon and og, no mark, no wordmark — now covers that case.

Worse, three finished frontends **shipped no favicon and linked none**: `foresight-web` and
`foresight-admin-web` were built before their product's assets existed, and `emberkin-web` copied
180 game images into `public/` without the four a browser actually asks for. Each passed its suite,
typechecked, built, and went green in CI, because **nothing anywhere asserted that a page has an
icon**. `micro-status-web` then did the same thing a day later, which is the argument for a guard
rather than four fixes: the web template now carries `test/brand-chrome.test.ts`, checking both
directions and requiring a relative `og:image` — an absolute one bakes a hostname into the
artefact, which is build-time configuration by another name. The template failed its own new test.

**And a mistake repeated within hours.** `emberkin` was registered with `devPort: 3014` while the
service binds 4100 — the same defect as giving `foresight` beacon's 4011, made again for the same
reason: a port chosen by looking for a free one rather than by reading the service. The collision
guard written for the first could not catch the second, because 3014 collided with nothing; it was
merely wrong. **A devPort is a fact about a service, not an allocation.**

The upside: three self-deleting workarounds fired exactly as designed. `foresight-web` and
`emberkin-web` had pinned their local corrections to the WRONG answers so their tests would go red
the day the upstream was fixed. It was, they did, and both workarounds are now deleted rather than
outliving their cause.

### 3.3f A defect in the frozen game, pinned rather than repaired

`ninety-days-after/services/game/src/engine/events.ts:130` computes
`severity = 1 + ((h >> 8) % baseSeverity)`. `hash()` returns `h >>> 0` — unsigned — and the caller
then uses `>>`, an **arithmetic** shift, so the value is negative for roughly half of all seeds and
JavaScript's `%` keeps the sign.

Reproduced over 20,000 seeds: `h >> 8` is negative for **48.2%**, severity lands on **0 for 16.2%**
and **−1 for 15.9%**. A negative severity means an event announcing that the region's stores swell
**drains** them — a `resource_boom` that removes 12 of each scarce resource, in the season's final
third, when it hurts most.

**It is pinned by a named corpus scenario and a two-directional test, not fixed.** Repairing it
would falsify the thing `micro-nda` exists to guarantee — that the port resolves a day exactly as
the ancestor does — for every world anyone has ever played. It can now only change as a deliberate
decision, which is the correct status for a defect that is also, by now, the rules of the game.

Two columns are deliberately excluded from the comparison and the port derives them instead:
`reports.id` and `world_events.id` were `randomUUID()` upstream, so they do not match a second run
of the *ancestor* either.

### 3.3g What only DEPLOYMENT could catch: the estate cannot bootstrap itself

The first two services were run together on 2026-08-01
(`deploy/compose/docker-compose.slice.yml`). Until then nothing in this estate had ever executed
against anything else, and the finding below is the reason that mattered.

**A fresh deployment cannot issue its first service token, so no service can ever authenticate to
another.**

- `POST /service-tokens` requires the `admin` role (`identity/src/server.ts:1266`, via
  `authenticateAdmin` at `:545`).
- `users.roles` is `text[] not null default '{}'` (`identity/src/migrations.ts:119`) — every user
  is created with none.
- **No route in identity grants a role.** All twenty of its POST/PUT/PATCH routes were enumerated;
  none assigns one.

Verified rather than reasoned about: a freshly registered user receives a working access token,
and `POST /service-tokens` answers **403 `this route requires the admin role`**. The only way
through is `update users set roles = array['admin']` against the database by hand, which is what
`scripts/slice-verify.sh` does — and asserts, so that the day identity grows a bootstrap the check
fails and is deleted.

This is invisible to every test in the estate. Identity's own suite creates admins directly; every
consumer's suite stubs the token. It can only appear when a real deployment tries to start from
nothing, which is exactly what had never happened.

**`micro-admin-api` split the problem three ways rather than solving the wrong part of it.** The
*write* belongs to identity — and not as a matter of taste: rule 1 is a CI grep for any connection
string that is not the service's own, so a version of admin-api that reached into identity's
database would fail its own build. The *authorisation* belongs to admin-api and is built: two
operators, a closed reason-code list, a hash-chained row. The *bootstrap* belongs to neither, because
a service that can mint its own first `admin` is a service whose compromise grants the estate — and
the approval queue could not authorise the first grant anyway, since approving requires someone who
already holds the role.

So the action is a first-class catalogue entry **with no executor**: `POST /v1/approvals` returns
**501**, naming the route identity would need (`PUT /internal/users/:id/roles` behind a service
token holding `identity:admin` — not `authenticateAdmin`, which refuses service tokens at
`identity/src/server.ts:540`). A queue that accepts work it cannot do leaves a row at `approved`
for ever, which reads as two operators having authorised something that never happened. **The first
admin remains a documented `UPDATE`**, as `slice-verify.sh` performs and asserts.

**What the slice proved working**, all for the first time outside a test process: the migrator run
one-shot against an empty database; `/livez` and `/readyz` over a real socket; `@cloudsforge/auth`
fetching a JWKS across a network rather than from a stub; a token minted by identity and verified
by ledger; and both negatives — an absent token and a forged one are 401.

**The estate is closer to running than the deployment gap suggested.** Two services, a real
database, real migrations and real cross-service auth needed one compose file and two corrections,
neither in a service.

### 3.3h Two scope matchers, two answers — a decision, not a defect

Found by `micro-devplatform`, which had to choose between them and could not.

| Package | Line | Semantics |
| --- | --- | --- |
| `contracts/packages/auth` | `src/index.ts:209` | `granted.includes(required)` — **exact match only** |
| `runtime/packages/auth` | `src/index.ts:178` | honours **one wildcard level**: `foo:*` grants `foo:bar` |

So `devplatform:*` is refused by one and accepted by the other, and **a service's effective
privilege depends on which package it imported**. Both are shipped, both are CI-green, and neither
is wrong on its own terms — runtime's wildcard is deliberate and documented (a *bare* `*` still
grants nothing, which is the omnipotent credential the estate exists to remove).

**Left as it is, deliberately.** Changing an authorisation matcher is the highest-blast-radius edit
available in this estate: relaxing the strict one over-grants across every consumer, and tightening
the permissive one can deny in production what every test allowed. It is a decision about what a
scope *means*, and it wants the owner rather than an agent at four in the morning.

`micro-devplatform` navigated it by using `includes` rather than `hasScope` on
`/internal/keys/verify`, with a test proving `devplatform:*` is refused there — the conservative
reading, chosen because a credential service should not be the place the estate discovers its
wildcard semantics.

Three smaller findings from the same build, all recorded rather than fixed: `devplatform.*` is not
a registered event topic (`contracts/packages/events/src/index.ts:222`), so the
`devplatform.key.revoked` mechanism named by 11:363 cannot be built through `makeEvent`;
`@cloudsforge/contracts-devplatform` is still uncut, so the scope vocabulary lives in the service;
and there is no OAuth token endpoint, because signing one needs identity's key and that half
belongs to another repository.

### 3.3i An imagined surface, and the first that lied about money

`micro-market`'s indexer client called `/v1/tokens/:urn/facts` and
`/v1/chains/:chain/transactions/:hash/escrow`. `micro-indexer` serves neither route, so every call
404'd, always.

**A correction to this section's first version, which I got wrong and repeated confidently.** It
said the indexer "serves no `/v1` paths at all". It does: `indexer/src/server.ts:134` is
`PREFIXES = ['/v1', '']` and every route is mounted under both spellings. The 404s were caused by
the missing `/tokens` route and the missing `/escrow` sub-resource — not by the prefix. The
diagnosis was right in substance and wrong in the detail I was most emphatic about, and the agent
adding the capabilities caught it by reading the file rather than the finding. Left visible rather
than silently amended: this ledger's whole value is that a claim in it can be checked, and one that
was wrong should say so.

The escrow branch turned that into `{confirmed: false}`, and `market/src/server.ts:761` turns that
into *"the on-chain escrow is not confirmed yet"*. So **every on-chain escrow activation failed
with a diagnosis that was false**: a seller retries for ever, and an operator investigates the chain
rather than the integration. The facts branch returned `null`, rendering "no indicators" on every
listing, permanently and silently.

Failing closed was right and is unchanged — an unconfirmed escrow must never be listed. What
changed is that **"we could not ask" is now an outage rather than a negative answer**, which is the
distinction the fail-closed argument depends on. The paths cannot be repointed: the indexer does
not serve these capabilities in any form, so the test pins the *size* of the gap rather than
claiming it is closed.

**Every one of market's tests passed before the change and after it**, because every one stubbed the
response rather than asking whether the request could reach a route. That was the seventh instance
of this shape in the estate and the third in this repository — and `micro-community` found two more
of the same kind while building against the same neighbours: `policy` has no `community.*` action
and no `community:` subject arm, so the obvious spend request would 400 and, fail-closed, **no
community could ever spend its treasury**; and `micro-indexer` has no balance route at all, so
`07-dependency-map.md:139`'s hard dependency cannot be satisfied.

**This heading used to read "The seventh imagined surface", and the count has been taken out of
it.** A running total in a heading is a fact stored in the worst possible place: it is the part of
a section nobody edits when they add to the body, it is quoted verbatim by other repositories, and
it is wrong the moment a new instance lands anywhere in the estate. It had already drifted — four
files in `micro-sdk` said *five* while this said *seven* — and silently, because a number in prose
has nothing to check it against.

A numbered register here, cited by row, was the other option and was rejected: it puts the fact in
one place instead of nine, which is better, but it is still a hand-maintained count over nine
repositories that can each create an instance without touching this file. **So this document no
longer maintains a total.** What is worth keeping is the class and the guards that catch it, and
those live in code that fails a build rather than a proofread —
`mint/scripts/checkindexerroutes.mjs` and `market/src/indexerclient.test.ts`. Where an ordinal is
genuinely useful it stays in the body, in the past tense, as a statement about a moment. Anything
citing this class should cite the **section**, never a number.

### 3.3j Planned: the three indexer capabilities two services are blocked on

Recorded in §3.3i as gaps and then, correctly, challenged: a gap two consumers are already blocked
on is work, not a finding. All three are **additive read routes** — they change no existing path's
behaviour, which is why they can be added to a shipped service.

| Capability | Wanted by | Consequence today |
| --- | --- | --- |
| Token facts for an item URN | `market` (`indexerclient.ts`) | Every listing renders "no indicators", permanently |
| Transaction confirmation for an escrow | `market` (`server.ts:757`) | **Every on-chain escrow activation fails** with a false diagnosis |
| Address token balances at a block | `community` (gating job) | `07-dependency-map.md:139` names this a **hard** dependency; the re-evaluation job cannot run |

The second is the one that matters most: it is the only defect found in this programme that made a
shipped service lie about money rather than merely fail.

**Outcome: two built, one refused.** The confirmation and balance routes exist and both consumers
are repointed. **Token facts was refused, and the refusal is the right answer**: it is keyed by a
`micro-mint` item URN the indexer has no registry for, and five of the eight fields are contract
state, total supply, complete holder history or a custody fact about a private key. Serving it
would have meant inventing numbers. That is a gap in the estate's *design* rather than an unbuilt
route, so market's workaround stays and its test now pins **one** unserved path instead of two.

The self-deleting workarounds behaved exactly as intended: both went red the day the capability
landed and were removed as part of the same change.

### 3.3k Planned: brand chrome for every frontend

Scoped by auditing all fourteen planned frontends against the brand sets, rather than left as
"generate the remaining assets". The step is much smaller than it sounds, and most of it is
already enforced.

**Generation: done.** Only two sets lacked an `og` card. `developers` has one now, because
`devportal-web` is a public surface whose links get shared. `admin` deliberately does not —
nobody shares an operator console outward, and a card there would exist to satisfy a pattern
rather than a need. Every other set is complete. **94 assets, 0 verify failures** — 93 generated, plus the GitHub
organisation avatar, which is a crop-and-rescale of `site/mark-1024x1024.png` recorded as a
derivative with `c2pa` measured off its own bytes rather than inherited from its source.

**Wiring: one step per frontend, and it cannot be forgotten.** Each frontend must copy its set's
favicons and `og` into `public/` and link them in `index.html`. Seven of the eight are done.
That is not a chore anyone has to remember: `web-template/test/brand-chrome.test.ts` fails until
it is done, in both directions — every icon linked must be shipped and every icon shipped must be
linked — and it requires a **relative** `og:image`, because an absolute one bakes a hostname into
the artefact, which is build-time configuration by another name.

That guard exists because four finished frontends shipped with no favicon at all and went green in
CI, since nothing anywhere asserted that a page has an icon (§3.3e).

| Frontend | Set | State |
| --- | --- | --- |
| `hub-web`, `site`, `foresight-web`, `foresight-admin-web`, `status-web` | hub, site, foresight ×2, status | wired |
| `emberkin-web` | own repo (`micro-emberkin-assets`, 83 assets) | wired |
| `admin-web`, `mint-web`, `market-web`, `trade-web`, `worlds-web`, `explorer-web`, `devportal-web` | admin, create, market, trade, worlds, explorer, developers | **wired** — each was built after this table was written, and each linked its set on the way |
| `network-site` | network | assets ready; the last frontend, in build |

**`admin-web` links no `og:image`, and that is the decision above holding rather than an
omission.** Its `index.html` names the tag only in a comment explaining why it is absent, and
`test/brand-chrome.test.ts` asserts the absence with the same force the other frontends assert
presence — so adding a card later fails the build. A naive `grep -c og:image` reports 1 for that
file and 1 for every other, which is the estate's recurring "the guard matches the prose that
documents the guard" shape, arrived at from the reader's side rather than the checker's.

### 3.3l Two documents specify the analytics key differently

`03-repository-responsibilities.md:204` — "**`analytics` must never receive a `user_id`**, an email,
a handle or an exact balance."

`10-migration-strategy.md:509-510` — the key is `HMAC(user_id, analytics_pepper)`, and the document
itself notes analytics "never receives a `user_id` … and therefore cannot compute the key itself,
so if the event does not carry it" the key must come from elsewhere.

Read together, the second requires every **producer** to hold the analytics pepper in order to
compute the key — which spreads the one secret that makes the whole store pseudonymous across
eighteen services, and makes any one of their compromises a de-anonymisation of the entire event
history.

`micro-analytics` resolved it by not implementing either literally: the pepper stays in one service,
and pseudonymity is **salted per subject** — the specified `HMAC(user_id, pepper)` is a pure
function of two inputs that both survive account deletion, so it cannot be erased at all. A
deletion destroys the salt.

Worth recording as a specification conflict rather than a service decision, because the next person
to read 10 §509 will implement the pepper distribution unless something says otherwise. Also from
the same build: `contracts/packages/events` registers 18 server-side topics and **no frontend
topic**, though AD-21 requires `page_viewed`, `cta_clicked` and `form_abandoned` — so four of the
metrics in 13 §12 cover the server side only, and seven others name events that are not registered
at all. Their definitions are deliberately absent rather than reporting zero for ever.

### 3.3m The eighth imagined surface, and the guard that would have passed it

Same class as §3.3i, in `micro-mint`, and the reason it is worth its own entry is not the count.

**What was believed.** `mint/src/indexerclient.ts` had two methods and both were written against
the *status* route's shape with a resource bolted on: `transaction()` asked for
`/v1/chains/:chain/:network/transactions/:hash` and `token()` for
`/v1/chains/:chain/:network/tokens/:address`.

**What was true.** `micro-indexer`'s convention is the RESOURCE first, then `:chain/:network`, then
the key (`indexer/src/server.ts:153-163`). Neither path has ever existed in either spelling. Every
call 404'd; the 404 became `null`; and `null` rendered as *"the indexer has not yet indexed this
contract"* on **every ForgeMint project page, permanently and silently** — while
[04-domain-model](04-domain-model.md) §5.3 requires those pages to show supply and authorities
**from the indexer**. The invariant was not merely unmet; it was reported as met-but-pending, for
ever. Every one of mint's tests passed throughout, because every one stubbed the client rather than
asking whether the request could reach a route.

**How it was found.** By reading `micro-indexer`'s route table against the client, one path at a
time. Not by a test.

**Why the count is not the lesson.** `micro-market` already had a guard written against precisely
this class — §3.3i is its origin — and **it would have passed this defect**. It matched by *prefix*
against a list containing `/v1/chains/`, and pinned the *count* of unserved paths rather than their
shapes. Run against mint's two dead paths, that guard judges **zero** of them unserved: both begin
with `/v1/chains/`, which the indexer genuinely does serve. A guard built for a class of defect,
that the next instance of that class walks straight through, is worse than no guard, because it is
counted as coverage.

**What now prevents it.**

| Where | What it does |
| --- | --- |
| `mint/scripts/checkindexerroutes.mjs` | A CI job, not a test: checks `micro-indexer` out, parses `DOMAIN` and `PREFIXES` out of its source as text, and compares **whole path shapes** — same segment count, `:param` matches anything, literals must match. Then CI **mutates the checkout** and requires the job to go red, because a job that graded a file it failed to fetch looks exactly like a job that passed. |
| `mint/src/indexerclient.test.ts` | The in-suite half: the exact path **on the wire**, and a source-level shape assertion so a regression is visible in `pnpm test` too. |
| `market/src/indexerclient.test.ts` | Rewritten to compare whole shapes in the same dialect, with a mutation test of five paths the indexer does not serve — including mint's real one. Two source changes came with it: the escrow path is now one whole template literal (a `${scope}` helper standing for `chain/network` is **one opaque segment** to any checker, and that path matched `/transactions/:chain/:network/:hash` — the wrong route, reported as fine), and the stale `eth_call` argument in `tokenFacts` was corrected. |

**And the capability landed rather than the workaround.** The transaction path was corrected in
`mint`, and `micro-indexer` gained `GET /tokens/:chain/:network/:address`
(`indexer/src/server.ts:159`) — one `eth_call` per field at the indexer's own stored canonical head,
and **only after fetching the node's block at that height and comparing its hash to the one this
service walked** (`indexer/src/tokenstate.ts:207-215`). If they disagree the node is not on the
chain this service indexed and **no observation is returned at all**: `head_diverged`, which is an
honest "ask me again", not a number from somebody else's fork.

That new route also retires one line of §3.3i's reasoning. `micro-market`'s refusal to serve token
facts said `mintAuthorityPresent` and `ownershipRenounced` are contract state behind "an `eth_call`
this service deliberately never makes". The indexer makes one now. **The refusal still stands and
is unchanged**, on the grounds that survive: the capability is keyed by a `micro-mint` item URN the
indexer has no registry for, and three of `TokenFacts`' eight fields need complete holder history or
a custody fact about a private key. The dead argument is marked in place rather than deleted.

### 3.3n A customer could pay for a token that could never be built

Second defect in this estate to reach a customer's money, after §3.3i, and it has the same shape as
the imagined surfaces above with the sides swapped: not a client asking for something that does not
exist, but **a validation rule that ran one call too late**.

**What was believed.** That `POST /v1/tokens` refuses an order it cannot fulfil. The route's own
comment said so.

**What was true.** The route called `variantFor(features)`, which validates the FEATURE SET and
never reads the cap. The cap rule lived in `constructorArgs`
(`mint/src/catalogue.ts:138-148`), first reached from `dataFor` inside the **deploy job**
(`mint/src/families.ts:336-348`) — after `POST /v1/tokens/:id/pay` had already debited the
customer's Shards. So an order for the capped variant with no cap, or a cap on a variant whose
contract takes none, was accepted **201**, paid for, and then unbuildable.

**And it did not fail cleanly.** The `ChainError` from `constructorArgs` matches none of
`driveDeploy`'s four classified failures (`mint/src/deploy.ts:118-169`), so the lease was released
and the error rethrown; the row stayed `deploying`, `deploying` is in `CLAIMABLE`
(`mint/src/tokens.ts:68-73`), and `token.sweep` put it straight back on the queue on the next tick.
Not a terminal `failed` with a reason a customer can read — **a permanent loop with the money
gone**, `deploy_attempts` climbing without a ceiling (`mint/src/tokens.ts:386`), and no state any
human is ever shown.

**Measured, not reasoned about.** Mutating the order route back to `variantFor(features)` and
running mint's HTTP suite against a real database gives **201** for a foundry order with no cap and
**201** for a cap on an uncapped variant — both payable. The third case, a cap below the supply, is
a **500**: `constraint tokens_cap_covers_supply` (`mint/src/migrations.ts:176`) catches it at the
insert. So two of three were reachable, and the constraint that saved the third is a coincidence of
what a CHECK can see, not a design.

**The fix reaches for the existing rule rather than restating it.** `assertBuildable`
(`mint/src/catalogue.ts:179`) calls the deploy path's own `variantFor` and `constructorArgs` against
the request and discards the encoded arguments; the throw is the product. It answers **400
`unbuildable_order`** with the offending `field` — deliberately distinguishable from the generic
`bad_request`, because "your order is invalid" and "`cap` is the word that made this impossible" are
not the same answer. The deploy-time call stays: the route sees one request, and the job is the last
thing between a stored row and a signed contract creation. A test asserts the two gates agree on all
forty feature/cap combinations, so replacing that call with a hand-written check goes red on
whichever case it got wrong.

**Why that mattered more than usual here.** `micro-mint-web` already carried a *second* copy of the
cap rule, written precisely because the service had none, with a header comment saying so. Two
copies of one rule is how this estate got a client and a server that disagreed. The client's copy
stays — a disabled button beats a red banner — but it is a mirror now, and its comment says which
side is the authority.

**No stored order is in this state, and this was checked rather than assumed.** `micro-mint` has
never run against a persistent database: the only environment that exists is
`deploy/compose/docker-compose.slice.yml`, which brings up identity and ledger and nothing else
(§1, §3.3g). So there is nothing to migrate and nothing was touched. The read-only query that finds
such rows, for the day there is a store to run it against, is recorded in `micro-mint`'s README
under Known gaps.

**Left open, and recorded rather than fixed:** the loop itself. An unclassified throw anywhere on
the deploy path still releases the lease and leaves a `CLAIMABLE` row for the sweep to re-enqueue
for ever. Closing the cap defect removes the only known way to reach it, not the mechanism, and the
alternative — failing a row terminally on an error nobody has classified — is exactly what
`CLAIMABLE`'s exclusion of `failed` exists to prevent.

### 3.3o The contract checker made "never correct a citation" the rule

Found by the two entries above, and only because they moved a service's line numbers.

`micro-sdk`'s `ROUTES` is the estate's one record of the public surface, and its value is that every
entry carries `verifiedAt` — the exact `path:line` in the owning service where the route is
registered. It is declared `as const`, so **every field became a literal TYPE**, including that one:
`ROUTES.mint.pay.verifiedAt` was the type `'mint/src/server.ts:454'`.

`micro-org/tools/compat.ts` judged any changed scalar text breaking. So when micro-mint's routes
moved twenty-four lines and the eight citations were corrected to match, the estate's additive-only
gate reported **eight breaking changes to a public contract** — over a field no consumer can observe
the type of. The effective rule was *never correct a citation*, which turns the one thing making
that table trustworthy into the one thing nobody may touch. It had never fired before because no
cited service had moved since the table was written.

**Both halves are fixed.** The checker now treats a literal replaced by the primitive it is a
literal *of* as a widening rather than a break — which is the judgement `widened-union` in the same
function has always made, and the relaxation is deliberately no wider than that: a scalar changing
to any other type, to a union, or to `any` is still breaking, asserted in the same fixture so the
two halves cannot go stale separately. And `ROUTES` now re-exports `verifiedAt` as `string` while
every other field keeps its literal type, because every other field is something a consumer can
depend on.

**The shape worth remembering** is not the checker's rule; it is that a mechanism which cannot be
corrected stops being evidence. The same push turned up a second instance: `micro-mint-web`'s CI
bends one route citation by one line and requires the suite to go red — and it *named* the line, so
the day micro-mint's table moved the mutation silently applied to nothing, the suite passed
unmutated, and the step failed reporting that the cross-check had accepted a wrong citation. A
mutation test that hardcodes the value it mutates goes stale exactly when the thing it guards
changes, and fails with a diagnosis that is false. It reads the number now, and refuses to grade an
unmutated file.


### 3.3p The event bus had never carried one event, and six defects said why

The slice grew a third service (`activity`) and a check that a sign-in crosses
outbox → signed HTTP → inbox and lands in the user's own feed. It failed, and each fix exposed
the next layer — none findable by any single repository's suite, every one a pair of suites
green against imagined counterparts:

1. **Both consumer inboxes demanded a bearer no producer presents.** `activity` and `notify`
   authenticated a service principal before reading a byte; every outbox relay sends the HMAC and
   no Authorization header. The routes built to receive the bus refused the bus, always. The MAC
   over the raw bytes is now the gate (`trade` and `worlds` had this shape from the start), which
   also means an identity outage no longer takes the whole bus down with it.
2. **The signature header name had two spellings.** The contract says `cf-signature`; five
   producers carried a local `const` saying `x-cloudsforge-signature` — a drifted second copy of
   the exact value `micro-contracts` exists to be the single source of.
3. **The signature format had two shapes.** The contract signs `t=<seconds>,v1=<hmac over
   "seconds.body">` with a freshness window; the same five local copies signed
   `sha256=<hmac over body>`. Aligned by deleting the local implementations: `signEvent` /
   `verifyEventSignature` now delegate to the contract's `signDelivery` / `verifyDelivery`, and
   the five repositories import `@cloudsforge/contracts-events` instead of restating it.
4. **The envelope version had two types.** The contract types it `"major.minor"` string; the
   producers sent integer `1` and were refused with `version: missing`. The stored column stays an
   integer; `wireVersion()` maps at the wire in one place per producer.
5. **`activity` attributed sign-ins to the session id.** Identity keys `session.created` by
   session and `device.added` by device, with the user in the payload; activity's `userFromKey`
   accepted any uuid, so every sign-in landed in nobody's feed — silently, because a wrong uuid
   queries as cleanly as a right one. Its own fixtures keyed the events by the user, a shape the
   producer never sends: a suite green against an imagined producer, §3.3i in the event plane.
6. **The topic lists disagree three ways.** The registry knows `identity.session.created` and
   `identity.user.deleted`; identity also emits `mfa.changed`, `device.added` and
   `session.revoked` unregistered, and never emits the `user.registered` that activity classifies
   ("your account was created" can never appear). `emberkin` emits six unregistered topics and
   `worlds` three, with neither owning a registered topic as a `ProducerService`. Open: register
   the real topics, emit `identity.user.registered`, reconcile `mfa.changed` vs the `mfa.removed`
   activity expects.

The seam is now a standing check: `slice-verify.sh` seeds the one subscription no route creates
(deliberately — who receives which topic is deploy configuration), signs in, and fails unless the
record reaches the right user within 30 seconds. **It passes.** The first event the estate ever
delivered was `identity.session.created`, and it took six fixes to get one login across.

**And the second thing it delivered was an erasure.** The registry's header had said since it was
written that `identity.user.deleted` has no subscriber anywhere, "which is precisely why there is
no GDPR erasure path at all". The slice now drives that path end to end: an account is deleted
(grace zeroed in the slice, the hourly tombstone pulled forward — the clock compressed, the sweep
not bypassed), the event is written in the same transaction as the state change, delivered over
the signed bus, and `activity` provably forgets the subject — records for the user go to zero and
the inbox row is the acknowledgement the registry demands. Remaining: wire `notify` (addresses,
phone numbers, push tokens — the service that most needs it) and every other user-data holder
into the same subscription at deploy time.

### 3.3q The scope registry knew 14 scopes; the estate's gates demanded 57

What was believed: `contracts/packages/auth` is "the closed set of service scopes", identity
validates every service-token grant against it and fail-fasts on an unknown name
(`identity/src/env.ts:141`), so a granted scope is a real capability. What was true: the
registry held 14 scopes while the estate's services gated on 57. Every one of `beacon`,
`trade`, `market`, `mint`, `settlement`, `studio`, `analytics`, `admin-api`,
`devplatform`, `community`, `emberkin`, `nda`, `faucet`, `lantern` and `notify` had
**zero** of its gates mintable; `wallet` could be read but neither written nor spent from;
`custody`'s address-creation and treasury-read surfaces were unreachable beside its three
signing scopes; `worlds`, `aetherholm`, `pricing` and `indexer` were part-covered.
Identity could not mint a token for most service-to-service surfaces in the estate, and nothing
was red anywhere, because every suite mints its own fake principals — the same
green-against-an-imagined-counterpart shape as §3.3i and §3.3p, this time in the authorisation
plane.

How it was found: the pre-slice-growth question "can any token hold `aetherholm:provision`?" —
asked before wiring the title bridge, answered no, and then asked of every other scope a gate
demands. Three successive audit sweeps each had a different blind spot: the first read constants
and missed inline literals (`community/src/server.ts:1056` hardcodes `'community:write'` one
file away from its own `WRITE_SCOPE`); the second read `requireScope` calls and missed wrapper
third arguments (`ledger`, `beacon`, `indexer` and nine others gate through a local
`authorise`/`authenticate` whose scope is a parameter); the third missed the computed family
(`custody/src/gates.ts:177` returns `` `custody:sign:${purpose}` ``). Three sweeps, three
different misses, is proof the audit must be a checker, not a grep session.

What now prevents it: a step in micro-org's `service-ci.yml` (org `26caed1`) **derives** the
scopes a repository's gates demand — inline literals, sibling-file constants, wrapper arguments
propagated through parameter flow to a fixpoint, three-part names, computed families closed
over an enumerated set — and fails that repository's build if one is absent from the checked-out
`@cloudsforge/contracts-auth` `SCOPE_NAMES`. Anything the checker cannot resolve fails loudly
rather than passing silently; comments are stripped and test files excluded before matching (six
guards in this estate have fired on their own prose); and the checker is mutation-tested in
micro-org's own suite — a gate demanding an unregistered scope is injected into a fixture, the
fixture is asserted to have *actually changed* before the run is graded (this estate has had a
canary that graded an unchanged file), red is asserted, the restore is asserted byte-identical
and green. A deliberate non-registration is an exemption in the repository's
`scope-exemptions.json` with a reason of at least forty characters, and a stale or unreasoned
exemption fails: `custody:sign:user` (demandable at the gate, refused unconditionally by
`purposeGate` — the platform signs nothing on a customer's behalf) and the service template's
placeholders are the estate's three.

The registry is total as of 2026-08-02: all 39 missing scopes registered with the gate line
that demands each (contracts `0287fa1`), the closed-set pin test grown in the same commit.
Found along the way, recorded rather than fixed here: `wallet:provision` and `notify:send` are
registered scopes **no gate demands** — the wallet gates on `wallet:write`/`wallet:money` and
notify's inbox went MAC-only in §3.3p (its dead `notify:ingest` constant is deleted in
micro-notify rather than registered or exempted); `nda:read`, `emberkin:read` and
`community:read` are scope constants no gate uses. The bespoke-CI gap is **closed as of
2026-08-03**: all nine remaining repositories (`service-template`, `beacon`, `hub-api`, `mint`,
`settlement`, `studio`, `wallet`, `worlds`, `web-template`) now call a reusable workflow and are
green, so the checker runs everywhere it can — beacon 3 scopes, wallet 3, worlds 4,
mint/settlement/studio 2 each, `service-template` 2 exempted, and hub-api a *checked* zero.
`hearth` is deliberately excluded and keeps its bespoke CI: its remote is
`cloudsforge-online/hearth`, it is a Rust/Node blockchain with no `src/`, no `@cloudsforge/*`
dependency, no `/livez` and **zero scope gates**, so the reusable workflow cannot apply and the
audit would assert nothing there.

Enforcing the audit is what found the defects, which is the point of enforcing it:

- **`service-template`'s image could never boot**, and every repository cut from the template
  inherited that. Its Dockerfile's final stage copied `/runtime` but not `/contracts`, while
  `node_modules/@cloudsforge/contracts-events` is a `link:` symlink into
  `/contracts/packages/events` that `index.ts → jobs.ts → outbox.ts` imports. The old `docker`
  job built the image and read its metadata **without ever running it** — a check that could not
  fail. It now boots and answers `/livez` in two seconds.
- **`web-ci.yml` had zero callers** across the estate and was not merely waiting for adoption:
  it did one checkout, while all 13 frontends use `link:../ui/packages/ui`, so `Typecheck` could
  never have resolved `@cloudsforge/ui`. This is the same defect `service-ci.yml` had already
  been fixed for.
- **`service-ci.yml` read `testsupport.ts` as source in rule 1 while the scope audit in the same
  file skips it** — one file, three readings, and the inconsistent one failed correct work. One precision defect in the compat checker
surfaced and was fixed both directions (org `1279280`): regrouping the registry's keys
reordered every union derived from `keyof typeof SCOPES`, and a union is a set — six
semantically identical signatures read as breaking until member order was canonicalised away,
with removal-hidden-by-reordering verified to still break.

### 3.4 What only CI could catch

The point of the exercise, and the answer to "the suites pass locally, why bother": four real
defects were invisible to a green local run.

| Defect | Why local missed it |
| --- | --- |
| `runtime/packages/lifecycle` — two `unref()`'d timers. The drain-delay one is the serious one: unref'd, a draining process **exits the event loop instead of pausing**, so it skips the delay that exists to let the load balancer notice it is going away — dropping precisely the in-flight requests the drain was written to protect. | Node 24 hid it incidentally; Node 22 (the CI runtime) showed 16 cancelled tests. Now 21/21 on Node 22 and 117/117 on Node 24. |
| `custody/src/hd.ts` — `import { ECDSA } from 'xrpl'` throws at import. xrpl is CommonJS and defines `ECDSA` through a `defineProperty` getter Node 22's CJS lexer cannot see, so **every suite touching `hd.ts` died before running**. | Node 24's lexer finds it. A version difference between laptop and runner. |
| `billing` — fixtures asked questions on a frozen timeline while grants defaulted to the database's `now()`. | It agreed *by luck* until the wall clock passed 2026-07-30; then 8 tests failed and the expiry fixtures violated a CHECK constraint. A test that passes because of today's date. |
| `beacon` — the same class: fixture-time setup evaluated against real time, stale from 11:00 UTC on the fixture's own date. | Identical reason. |

Two of these are latent production defects, not test artefacts — the drain hole is in the shutdown
path of every service in the estate, and the xrpl import is in the custody service's key
derivation.

### 3.5 The work that is not a repository

Listed because a repository-count metric hides it, and because it is what stands between this
programme and a running platform:

1. **Nothing is deployed.** No environment, no gateway routing, no release manifest exercised.
2. **No cross-service integration has ever run.** Every service is proven against its own tests
   and its siblings' route tables. The consumer-driven contract tests described in
   [14-testing-strategy](14-testing-strategy.md) exist as a strategy, not as a passing gate.
3. **No data has been migrated.** [10-migration-strategy](10-migration-strategy.md) is unexercised.
4. **The four uncut contract packages** (`-market`, `-worlds`, `-create`, `-devplatform`) are
   currently local types inside their services, which is the exact drift the contracts repo
   exists to prevent.

---

## 4. How to update this file

Add the repository to §2 with its real test count and one line naming the defect or invariant it
proves — not what it does, which §03 already says. Remove it from §3. Correct §1's table and its
narrative, including the sentence about what the remaining work is dominated by, which stops
being true at some point and should not be left standing when it does.

Do not mark a repository done because its code is written. It is done when it is pushed and its
suite is green, and the count in §2 is evidence of that rather than decoration.
