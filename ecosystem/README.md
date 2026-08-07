# CloudsForge — the ecosystem programme

The plan for turning nine loosely-related repositories into one platform: one account, one
identity, one wallet experience, one portfolio, one activity history, one internal economy,
multiple products, a marketplace, a developer platform, community and governance, and the
operational and financial controls a platform holding customer money owes its customers.

---

> ## ⚠ Repository policy — read this before writing any code
>
> **No existing repository is modified, deleted, archived or renamed by this programme.**
>
> `repos/platform`, `repos/forge-pay`, `repos/forge-keyvault`, `repos/forge-mint`,
> `repos/crucible`, `repos/ninety-days-after`, `repos/hearth`, `repos/asset-forge`,
> `repos/shared-libs`, `infra/lantern` and `infra/beacon` **stay exactly as they are** and keep
> running. They are the reference implementation and the fallback.
>
> **All new work goes into a new, parallel set of repositories under the `micro-` prefix**,
> checked out into `stack/micro/`:
>
> ```
> stack/
>   repos/        ← the existing estate. READ ONLY for this programme. Never edited.
>   micro/        ← the new microservice estate. All work happens here.
>     identity/       (repo: micro-identity)
>     ledger/         (repo: micro-ledger)
>     custody/        (repo: micro-custody)
>     hub-web/        (repo: micro-hub-web)
>     ...
> ```
>
> **Naming.** Where this documentation names a repository `cloudsforge-<name>` — which it does
> throughout, and in [03-repository-responsibilities.md](03-repository-responsibilities.md) in
> particular — the actual repository is **`micro-<name>`** and the local checkout is
> **`stack/micro/<name>/`**. The mapping is exactly that substitution, with no other change.
>
> **Consequences that follow, and must not be quietly dropped:**
>
> 1. **Nothing is "extracted" in the destructive sense.** Code is *copied forward* into a new
>    repository. The source repository is left untouched and keeps building and deploying.
> 2. **`git subtree split` becomes a read-only operation** — it produces history for the new
>    repository and does not alter the source. See
>    [10-migration-strategy.md](10-migration-strategy.md).
> 3. **The two estates run side by side.** Cutover is by gateway routing and the release
>    manifest, not by deleting the old service. The old service stays deployable for as long as
>    it takes to trust the new one, and longer.
> 4. **Rollback is always "route back to `repos/`".** This is a materially stronger position
>    than the plan originally assumed, and it lowers the risk of every decomposition phase.
> 5. **Archiving is not a phase exit criterion.** Any exit criterion in
>    [06-ecosystem-workflow.md](06-ecosystem-workflow.md) that says "old repositories archived"
>    is superseded by this policy and means only "no longer receiving new work".
>
> This policy overrides any statement to the contrary anywhere else in this directory.

---

## Read in this order

| # | Document | What it answers |
| --- | --- | --- |
| **00** | [current-state](00-current-state.md) | What exists today, verified against source. The defect register, the functionality inventory, the technical debt. **Read this first.** |
| **01** | [product-vision](01-product-vision.md) | What CloudsForge is for. The eleven tests that define "one platform". |
| **02** | [target-architecture](02-target-architecture.md) | The 21 architecture decisions, with alternatives rejected. The service catalogue. The observability stack. Status pages, dashboards and graphs. **Has decision authority.** |
| **03** | [repository-responsibilities](03-repository-responsibilities.md) | The 46 repositories it was written against, what each owns, what each must never contain. **The estate now holds 67 directories / 66 CloudsForge repositories** — for the complete current list use [34-service-catalogue](34-service-catalogue.md); use 03 for the *ownership rules*, which still hold. |
| **04** | [domain-model](04-domain-model.md) | The shared language: entities, ownership, states, invariants. |
| **05** | [user-journeys](05-user-journeys.md) | End-to-end journeys, including the failure journeys. |
| **06** | [ecosystem-workflow](06-ecosystem-workflow.md) | **The main deliverable.** Fourteen executable phases, P0–P13. |
| **07** | [dependency-map](07-dependency-map.md) | What calls what, what blocks what, and the critical path. |
| **08** | [prioritised-backlog](08-prioritised-backlog.md) | 203 items with acceptance criteria. The P0 list and the critical path. |
| **09** | [release-roadmap](09-release-roadmap.md) | Release trains, environments, milestones, and what v1.0 means. |
| **10** | [migration-strategy](10-migration-strategy.md) | How each move happens without losing anything. |
| **11** | [data-and-contract-strategy](11-data-and-contract-strategy.md) | Contract packages, versioning, retention, privacy boundaries. |
| **12** | [security-decisions](12-security-decisions.md) | Every major security decision and its rationale. The debt register. |
| **13** | [operational-model](13-operational-model.md) | Telemetry, dashboards, SLOs, alerting, on-call, analytics, DR. |
| **14** | [testing-strategy](14-testing-strategy.md) | How correctness is established across repositories no single CI can span. |
| **15** | [monetisation-model](15-monetisation-model.md) | What is charged for, what is free forever, and why. |
| **16** | [risks-and-open-decisions](16-risks-and-open-decisions.md) | 55 risks, and what this plan deliberately does not decide. |
| **17** | [definition-of-done](17-definition-of-done.md) | What "done" means at every level. |
| **18** | [build-status](18-build-status.md) | What has actually been built, by repository, with test counts. **A ledger, not a plan — read it before assuming anything in 00–17 exists yet.** |
| **19** | [new-products](19-new-products.md) | Emberkin (the second Forge Worlds title, rebranded from *Kindred: Resonance*) and Forge Foresight (a Hearth-native prediction market). **Design authority for both.** |
| **20** | [aetherholm](20-aetherholm.md) | Aetherholm, the third Forge Worlds title: a sky-island strategy MMO. **Design authority.** |
| **21** | [engagement-treasury](21-engagement-treasury.md) | The house seed, what the platform stakes with its own money, and the disclosure a user must be able to see. |
| **22** | [browser-journeys](22-browser-journeys.md) | The complete browser-level scenario catalogue — 318 scenarios in three tiers across fifteen surfaces — and where the suite lives. Extends **05**; corrects one row of **14** §11. |
| **23** | [tessera](23-tessera.md) | Tessera, the fourth Forge Worlds title: a browser-native user-made world, and the first surface in the estate where EMBER is **earned**. Isometric and 2D by design, because neither image model emits a mesh. **Design authority**, including the 392-asset manifest and the no-pay-to-win resolution. |
| **24** | [asset-model-comparison](24-asset-model-comparison.md) | **Every asset repository holds two or three complete packs, generated by different models** — where each set lives, how the estate switches between them with no consumer change, and the verdict: FLUX 2 Pro decisively, with lettering the one criterion the challenger cleanly won. Records the rejected positive-dialect experiment and the parity-by-re-derivation mechanism. Owns no counts; cites the manifests that do. |

| **25** | [wallet-clients](25-wallet-clients.md) | The **self-custody** wallet on nine platforms — Windows, macOS, Linux, Android, iOS, Chrome, Firefox, Opera and the existing CLI — around one signing core and one threat model. **Design authority.** Distinct from `micro-wallet`/`micro-custody`, which are custodial; §1 argues that letting a user confuse the two is the most dangerous thing the design can do. |
| **26** | [public-deployment](26-public-deployment.md) | **The first public deployment**: two environments on one HP MicroServer Gen10 behind Cloudflare Tunnel, as compose projects rather than Kubernetes. Re-measures the estate's real footprint (the headline "3.1 cores" is 2.1 cores of proof-of-work), argues the ingress and utility-exposure decisions, sets out the P2P and seed options a tunnel cannot solve, frames the unresolved **mining question**, and gates go-live on beacon's `/v1/gate`. Names what could not be verified. **Written as a plan; deployed on 2026-08-05.** §0 carries the correction that matters most: the testnet is a hostname **suffix** (`hub-testnet.cloudsforge.online`), never a second label, and every `X.testnet.cloudsforge.online` in the body is dead. |
| **27** | [cloud-deployment](27-cloud-deployment.md) | **Step 2: AWS and Azure.** One EC2 `m7g.2xlarge` / one Azure `D8ps_v5`, both arm64, running the same Compose — not Fargate (priced at ~$570/mo floor), not EKS. Measures the disk 26 could not (the estate's images are **0.73 GB**, not 60) and re-derives the footprint. Keeps Postgres self-hosted and shows the migrators, deferred triggers and GiST constraints would all survive RDS anyway. Finds three blockers that are not cloud problems: the node **cannot boot past ~61 days** (`MAX_STRING_LENGTH`), **no service image is published anywhere**, and **29 of 48 services have `restart: no`**. Corrects 26 on P2P and mining. **A design — no cloud account exists.** **§2.3's restart blocker was re-measured on the host on 2026-08-07 and is fixed** — all 105 long-running containers are `unless-stopped`; only the missing systemd unit survives from that item. |
| **28** | [proliant-runbook](28-proliant-runbook.md) | **The runbook for the ProLiant**, where 26 is its design: the order of commands, what each proves, and where it stops. `estate-bootstrap` → `estate-up` → `estate-verify`, the gateway reload that proves it took, the six-variable two-environment overlay, and the release path — usable at last, now that 43 repos publish images. Records the decisions since taken: **the server does not mine** (the Mac and PC do, over plain HTTPS, needing no open ports), and P2P crosses the tunnel over WebSocket rather than raw TCP. Says a 2-core Gen10 is **below the floor**. §10 lists what has never run on the target hardware, which is most of it. |
| **29** | [native-assets](29-native-assets.md) | **The deposit on-ramp: holding the ten coins people actually arrive with.** Corrects the premise it was commissioned on — three of five chain families are *built* (EVM, Bitcoin, Solana), custody already derives ed25519 and XRP, and token movements are already indexed and then discarded one line before they become money (`wallet/src/deposits.ts`). Ten coins is six families and about four integrations. Rules that **a token must never become an `AssetCode`** — `TOKEN:<urn>` already exists and is the right shape. Resolves the parimutuel unit question: **the account stays native, the pool is one unit, conversion happens at stake time**, and a winner is paid in that unit. Names the traps, including the one specific to this codebase — custody's sweep shape requires empty calldata, so an **ERC-20 sweep is unsignable** — and the gap that a **custodial user cannot stake at all** (`custody/src/gates.ts`). **Design authority.** §10 says what could not be verified. |
| **30** | [roadmap-completion](30-roadmap-completion.md) | **Roadmap track 1: completing what is unfinished.** Ten phases, A to J, over the unwired integrations, stubs, deployment gaps and capabilities that exist in code and cannot be reached. Phase A (a stranger can create an account), Phase B (the bus carries what it signs) and Phase C (the estate can be measured) are P0 and gate everything after them. §12 records twelve findings **considered and excluded**, with the reason, so a future session does not rediscover them; §13 states what the document does not know. **A plan, not a ledger.** |
| **31** | [roadmap-ecosystem](31-roadmap-ecosystem.md) | **Roadmap track 2: ecosystem improvements.** The work that returns survivability, integrability, cold start, defect-class elimination or network effects rather than one feature. Its central finding: 61 registered topics against 9 hand-typed `subscribe` lines, ~46 deployed services against one operator path, 5 telemetry components against 0 producers — **the highest-leverage work is turning hand-typed wiring into derived wiring, then applying the estate's own checker idiom to the wiring itself.** §7 orders it in five waves. **A plan, not a ledger.** |
| **32** | [roadmap-ui-and-content](32-roadmap-ui-and-content.md) | **Roadmap track 3: UI and content.** The apex page, the per-surface pass, the copy that must change first, the one new design-system component (a sign-in intent panel), the onboarding funnel and the repository prose corrections. §4 names four places a **live page currently says something untrue**; §8 names the two things this track cannot fix — the empty room, and a status page faithfully rendering a wrong document. **A plan, not a ledger.** |
| **33** | [roadmap-index-and-next-sessions](33-roadmap-index-and-next-sessions.md) | **The index to 30–32 and the one order to work in.** Merges the P0 and P1 items of the three tracks into a single critical path, naming which items in different documents are the same prerequisite, and lists twenty discrete work packages a future session can pick up cold — each with its prerequisites, its definition of done and the first file to open. §4 states how each of these documents is kept honest, and that an item is closed only by **17**. |
| **34** | [service-catalogue](34-service-catalogue.md) | **What every repository is, what it does, and whether it is deployed.** All 66 CloudsForge repositories, partitioned into five planes, with the hostname, the surface and the deployment state of each as measured on 2026-08-07. The reference answer for "which repo owns this". Says in place where a sibling document's row is now stale, rather than correcting it silently. **A plan, not a ledger** — where it and **18** disagree about doneness, 18 wins. |

**Roadmap tracks 30–34 were written on 2026-08-07** by studying all 66 repositories, one agent per
repository, and adversarially verifying every finding against the cited line or a re-issued HTTP
request. Start at **33**: it is the only one of the five that carries a single order of work.

**Assets.** [assets/](assets/) holds the design-system extension: the
[chart palette](assets/chart-palette.md) (validated, not eyeballed), the
[design system](assets/design-system.md) with the corrected product accents, six brand marks as
SVG, and a rendered [contact sheet](assets/marks-preview.html).

## If you are picking up work

> **Changed 2026-08-07.** The route below used to start at **00** and pick items from **08**.
> Both describe the *pre-migration* estate and now carry supersession banners: the migration is
> complete, every service is built, and both networks are deployed. Picking an item from **08**
> today is the most likely way to spend a session rebuilding something that already runs.

1. Read **33** §1 for what state the estate is actually in, then **33** §3 for the work queue.
   Each package names its files, its acceptance test and its predecessor.
2. Read **02** for the architectural decisions. They still hold — 02 is a decision record, not a
   status report, and nothing in the migration reversed one.
3. Read the track your package belongs to for its reasoning: **30** (completion), **31**
   (ecosystem), **32** (UI and content).
4. Check **18** for what is genuinely done. Where 18 and any other document disagree about
   doneness, **18** wins.
5. Check **12** for the security decisions that constrain your work.
6. Work in the repository's own directory at the root of the tree — each is its own git repo,
   pushing to `cloudsforge-online/micro-<dir>`. There is no monorepo and no `stack/micro/`.

**Historical route, for reading the plan as it was conceived:** 00 for the baseline, your phase
in **06** for entry/exit criteria, your items in **08**, **07** for the dependency graph.

## Ground rules for this documentation

- Every claim about current behaviour was verified against source, not read from
  documentation. Several repository `MAP.md` files are materially wrong; **00** §7 lists which.
- Where a document disagrees with **02**, **02** wins. Where they disagree about what is *built*,
  **18** wins; about what is *deployed*, the host wins and the document is corrected in place.
- **Retired things are gated in CI.** `tools/check-dead-patterns.mjs`, run by the `dead-patterns`
  job, fails the build when a document tells a reader to build something the estate has already
  retired — currently the `worlds-api.` rename and the two-label `X.testnet.` hostname scheme. <!-- dead-ok -->
  A deliberate mention escapes with a trailing `<!-- dead-ok -->`, or by carrying a blockquote
  correction near it. Add a pattern when a decision is reversed; that is cheaper than finding
  the stale sentence again in six documents, which is exactly what happened to both of these.
- Where any document disagrees with the repository policy above, the policy wins.
- Estimates are relative durations and complexity, never calendar dates.
