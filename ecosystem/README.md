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
| **03** | [repository-responsibilities](03-repository-responsibilities.md) | The 46 repositories, what each owns, what each must never contain. |
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
| **27** | [cloud-deployment](27-cloud-deployment.md) | **Step 2: AWS and Azure.** One EC2 `m7g.2xlarge` / one Azure `D8ps_v5`, both arm64, running the same Compose — not Fargate (priced at ~$570/mo floor), not EKS. Measures the disk 26 could not (the estate's images are **0.73 GB**, not 60) and re-derives the footprint. Keeps Postgres self-hosted and shows the migrators, deferred triggers and GiST constraints would all survive RDS anyway. Finds three blockers that are not cloud problems: the node **cannot boot past ~61 days** (`MAX_STRING_LENGTH`), **no service image is published anywhere**, and **29 of 48 services have `restart: no`**. Corrects 26 on P2P and mining. **A design — no cloud account exists.** |
| **28** | [proliant-runbook](28-proliant-runbook.md) | **The runbook for the ProLiant**, where 26 is its design: the order of commands, what each proves, and where it stops. `estate-bootstrap` → `estate-up` → `estate-verify`, the gateway reload that proves it took, the six-variable two-environment overlay, and the release path — usable at last, now that 43 repos publish images. Records the decisions since taken: **the server does not mine** (the Mac and PC do, over plain HTTPS, needing no open ports), and P2P crosses the tunnel over WebSocket rather than raw TCP. Says a 2-core Gen10 is **below the floor**. §10 lists what has never run on the target hardware, which is most of it. |
| **29** | [native-assets](29-native-assets.md) | **The deposit on-ramp: holding the ten coins people actually arrive with.** Corrects the premise it was commissioned on — three of five chain families are *built* (EVM, Bitcoin, Solana), custody already derives ed25519 and XRP, and token movements are already indexed and then discarded one line before they become money (`wallet/src/deposits.ts:541-546`). Ten coins is six families and about four integrations. Rules that **a token must never become an `AssetCode`** — `TOKEN:<urn>` already exists and is the right shape. Resolves the parimutuel unit question: **the account stays native, the pool is one unit, conversion happens at stake time**, and a winner is paid in that unit. Names the traps, including the one specific to this codebase — custody's sweep shape requires empty calldata, so an **ERC-20 sweep is unsignable** — and the gap that a **custodial user cannot stake at all** (`custody/src/gates.ts:35`). **Design authority.** §10 says what could not be verified. |

**Assets.** [assets/](assets/) holds the design-system extension: the
[chart palette](assets/chart-palette.md) (validated, not eyeballed), the
[design system](assets/design-system.md) with the corrected product accents, six brand marks as
SVG, and a rendered [contact sheet](assets/marks-preview.html).

## If you are picking up one phase

1. Read **00** for the baseline and **02** for the decisions. Do not skip either.
2. Read your phase in **06**. It names its entry criteria, exit criteria and rollback.
3. Find your items in **08** by phase. Each has acceptance criteria and test requirements.
4. Check **07** for what you block and what blocks you.
5. Check **12** for the security decisions that constrain your work.
6. Work in `stack/micro/`, per the policy above. Never edit `stack/repos/`.

## Ground rules for this documentation

- Every claim about current behaviour was verified against source, not read from
  documentation. Several repository `MAP.md` files are materially wrong; **00** §7 lists which.
- Where a document disagrees with **02**, **02** wins.
- Where any document disagrees with the repository policy above, the policy wins.
- Estimates are relative durations and complexity, never calendar dates.
