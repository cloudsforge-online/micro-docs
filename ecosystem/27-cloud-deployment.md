# 27 — Cloud deployment: AWS and Azure

**Status:** a design. **Nothing here has been deployed, and there is no AWS
account and no Azure account.** Written 2026-08-04 against the estate running on
the author's laptop.

This is step 2 of the deployment path. Step 1 — the HP ProLiant MicroServer at
home behind a Cloudflare Tunnel — is [26](26-public-deployment.md) and is in
flight elsewhere. **Read 26 first.** Most of its analysis is not cloud-specific
and is not repeated here: the two-project overlay (26 §3), the derivation of
ingress from the surface registry (26 §4), what is public versus operator-only
versus not exposed at all (26 §4), and the argument against Kubernetes on one
box (26 §2) all carry over unchanged. This document states what **differs**, and
corrects three things 26 got wrong or could not know.

**The one-sentence difference.** 26 is shaped almost entirely by "no static IP",
which forces every byte through a tunnel that carries HTTP and WebSocket but not
raw TCP. On cloud there is a real address, so **the tunnel is a home-specific
workaround and not an architecture** — but it stays viable, because the tunnel
turns out to be sufficient for more than 26 believed (§9).

---

## 1. Measured again, on this machine, today

26 §1 correctly refused the brief's inherited "3.1 cores" and re-measured. I did
not inherit 26's numbers either. Second measurement, `docker stats --no-stream`,
2026-08-04, same laptop, estate still up:

| Compose project | Containers | Memory | CPU |
|---|---|---|---|
| `cloudsforge-estate` | 48 | 2.42 GiB | **0.80 cores** |
| `cfmicro` — gateway only | 1 | 0.10 GiB | 0.03 cores |
| `cfmicro` — telemetry (6) | 6 | 0.86 GiB | 0.01 cores |
| `hearth` seed (non-mining) | 1 | 0.11 GiB | **0.01 cores** |
| `hearth` miners (2) | 2 | 0.33 GiB | **2.03 cores** |
| unlabelled (other projects) | 5 | 0.24 GiB | 0.00 cores |
| **total** | **63** | **4.04 GiB** | **2.95 cores** |

**26's shape is confirmed; one of its numbers is not.** The estate idles at
**0.80 cores here, not 0.61**. Both measurements are real and the difference is
sampling — `docker stats` over an estate of 48 Node processes doing periodic work
is noisy at this magnitude. Treat **0.6–0.9 cores** as the idle band rather than
either figure as a value. 26's structural claim — that ~2 of the ~3 cores are
proof-of-work and not the estate — is exactly right, and reproduces: 2.03 of 2.95.

**Derived, one environment** (estate + gateway + one non-mining node):
**2.63 GiB, ~0.84 cores at idle.**

**Derived, both environments** (telemetry shared once, per 26 §3):
**6.12 GiB, ~1.69 cores at idle**; ~8 GiB with host OS, Docker and page cache.

Every figure above is **idle**. No load test has been run, here or in 26.

### Disk — 26 §8 called this its largest gap. It is now measured.

| What | Measured | How |
|---|---|---|
| **Estate images, all 75** | **0.73 GB** | 0.50 GB shared base layer + 0.23 GB summed unique layers, `docker system df -v` |
| Postgres data directory | 371 MB | `du -sh /var/lib/postgresql/data` in the running container |
| Chain data, one node | 5.6 MB at height 3,833 | `du -sh /data` |
| Build cache | **41.25 GB** | `docker system df` |
| All images on this host | 60.87 GB / 233 images | `docker system df` |

Two of these change a decision.

**The estate's images are 0.73 GB, not 60.** The 60.87 GB is dominated by dead
images from prior project names (`stack-*`, `fable-*`, `cf-*`). Every estate
service is built `FROM node:22-slim` and shares one 503.9 MB layer; the unique
layer per service is **14.87–15.34 kB**. A clean cloud host pulling this estate
needs **under 1 GB**, and container-registry storage is therefore a rounding
error on any pricing model. This is the number that kills the "we need a big
disk" instinct.

**The 41.25 GB build cache is the argument for not building on the box.** See §3.

**Chain growth is trivial on disk and is not the problem.** 5,865,895 bytes over
3,833 blocks = **1,530 bytes/block**; at 15-second blocks that is 5,760
blocks/day, **8.8 MB/day, 3.2 GB/year**. The chain's problem is RAM and boot time
(§2), not storage.

**Sizing conclusion: 8 vCPU / 32 GiB / 200 GB SSD.** 32 GiB is ~4× measured idle,
which is the same headroom argument 26 §1 made for the MicroServer and is right
for the same reason: that idle figure is two Postgres instances and ~90 Node
heaps *doing nothing*. 200 GB is ~5× everything measured plus a year of chain and
telemetry retention.

---

## 2. Three things block cloud, and none of them is a cloud problem

These are prerequisites. An implementing agent that skips them will produce a
deployment that comes up, looks correct, and fails later in a way that is
expensive.

### 2.1 The chain node cannot run for two months. This is arithmetic.

`Blockchain.load()` reads the entire chain into **one JavaScript string**:

```js
const lines = fs.readFileSync(this.file, 'utf8').split('\n').filter(Boolean);
```
— `hearth/node/src/chain/blockchain.js`

Node's `MAX_STRING_LENGTH` is **536,870,888 bytes** (verified locally on
v24.14.0). At the measured 1,530 bytes/block that ceiling is reached at
**~350,900 blocks**, which at 15-second blocks is **60.9 days**. Past that the
node throws `ERR_STRING_TOO_LONG` on start. The data is intact; this code cannot
read it.

It compounds. State lives in a `MemoryDB` that is a bare `Map` with `get`, `put`,
`has` and `size` and **no `delete`** (`hearth/node/src/state/trie.js`), one
instance shared by the whole chain (`blockchain.js`). Nothing is ever pruned,
and the file says so and says why: *"nothing is ever pruned; spec §9 puts pruning
out of scope for v1"* (`blockchain.js`). Every block object and its receipts
are also retained in `this.store`, including orphaned forks. V8's `Map` ceiling is
16,777,216 entries, and no `NODE_OPTIONS` sets `--max-old-space-size`, so the
default ~4 GB heap binds first.

And boot re-verifies proof-of-work on every block: `load()` → `_ingest(b, false)`
→ `_validate` → `HDR.verifyPow(hdr)` at `blockchain.js`. **There is no
trusted-checkpoint, snapshot, or skip-validation path anywhere in the tree.** At
the repo's own measured 6.57 ms per Homefire evaluation at shipped mainnet
parameters (`hearth/docs/pow-parameters.md`; `POW_SCRATCH_KIB: 64`,
`POW_WALK_STEPS: 256` at `node/src/params.js`), a one-year chain is
**~3.8 hours of PoW alone** to boot, before JSON parsing and state re-execution.
Testnet uses 1 KiB / 8 steps, ~100× cheaper, which is why nobody has noticed.

**Why this matters more on cloud than at home.** A MicroServer that runs a testnet
for a few weeks never reaches the wall. A cloud host is the thing that is
*supposed* to run continuously, and mainnet is the network whose parameters make
the boot cost real. **Do not create mainnet genesis until this is fixed** — 26
§5 already says genesis is a one-way action, and this is a second reason.

The fix is not in scope here, but its shape is: stream `blocks.ndjson` line by
line instead of `split('\n')` (removes the 61-day wall alone, cheaply), and add a
trusted-restart path so a node does not re-verify PoW on blocks it wrote itself.
Both are `hearth` changes. **Neither cloud can work around this**; an
auto-restarting instance simply fails to come back.

### 2.2 There were no published images. CI built them and threw them away. Fixed — but not the way this section used to prescribe.

**The defect, as it stood.** `org/.github/workflows/service-ci.yml` builds each
service image and then:

```yaml
push: false
load: true
tags: ${{ inputs.service }}:ci
```

Only `hearth/.github/workflows/publish.yml` referenced `ghcr.io` at all. Across
68 repositories with a `ci.yml`, **zero service images were published anywhere**.

The consumer side was finished and waiting: `deploy/scripts/release-render.py`
turns a release manifest into an overlay that pins every image and removes
`build:` with `!reset`, and `org/releases/2026.08.0-example.yaml` already shows the
intended `ghcr.io/cloudsforge-online/micro-<svc>` tags. There was a format, a
generator (`cfctl release`) and a consumer — and no producer of the artefact they
all describe.

**On cloud this stops being a nicety.** Building on the instance means checking
out ~60 sibling repositories, because the frontends' build contexts reach across
them by design (`uipkg: ../../ui`, `docker-compose.estate.yml`, with a
long note explaining that `@cloudsforge/ui` is a `link:` into a sibling repo). It
also means carrying that 41 GB build cache on a paid volume and spending instance
CPU on builds. The estate is public (61 repos), so GHCR storage and Actions
minutes are free — which makes ECR and ACR line items that do not need to exist.

#### The fix this section used to prescribe cannot work. Measured, not argued.

Until now this section said: *turn on `push: true` to GHCR*. Read as an
instruction to flip `service-ci.yml` and `web-ci.yml` and add
`packages: write` there, **that change breaks every repository in the estate**,
and it does not fail softly.

A called workflow's `GITHUB_TOKEN` can only be *maintained or reduced, never
elevated*. All 35 repositories that call `service-ci.yml` or `web-ci.yml` pin
`permissions: {contents: read, packages: read}` on the calling job
(`ledger/.github/workflows/ci.yml` is the canonical copy). A reusable
workflow declaring `packages: write` therefore fails its callers at **startup**,
before a single step runs, on pull requests as well as on `main`:

| micro-org run | caller grants | result |
|---|---|---|
| [30900277471](https://github.com/cloudsforge-online/micro-org/actions/runs/30900277471) | `packages: read` | **`startup_failure`** — the run never begins |
| [30900280323](https://github.com/cloudsforge-online/micro-org/actions/runs/30900280323) | `packages: write` | success |

`push: false` in the two gate builds is also **correct and stays**. Those jobs
exist to `load:` the image into the runner's daemon so they can boot it and read
`/livez` (`service-ci.yml`) or fetch `/` (`web-ci.yml`); `load`
and `push` want different things from buildx. A gate is not a producer.

#### What was built instead

`org/.github/workflows/publish-image.yml` — a separate reusable workflow that
each repository **opts into with its own `packages: write` grant**, so no
permission is ever elevated across the call boundary:

```yaml
  publish:
    needs: [ci, hygiene]          # only publish what passed
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    uses: cloudsforge-online/micro-org/.github/workflows/publish-image.yml@main
    with:
      kind: service               # or: web — selects the sibling build contexts
    secrets:
      estate_token: ${{ secrets.ESTATE_READ_TOKEN }}
    permissions:
      contents: read
      packages: write             # <- granted by the CALLER, never asked for by the callee
```

It pushes three tags and deliberately **not `latest`**
(`publish-image.yml`):

| tag | why |
|---|---|
| `<version>` | `package.json`'s version — the load-bearing one, because `cfctl release` writes exactly this into the manifest (`org/tools/cfctl.ts`). Treated as **immutable**: an already-published version is never moved, and that is a warning rather than a failure, since most commits on `main` are not releases (`publish-image.yml`). |
| `sha-<sha>` | always unique, always safe to push, and the only tag that answers "what code is this" for a commit that did not bump the version. |
| `main` | the moving head of the branch, which is what a compose file without a manifest defaults to. |

The last step re-checks that the package answers an **anonymous** pull
(`publish-image.yml`), because the reader is a deploy host with no
credentials: a push proves the writer's rights and nothing about the reader's.
A GHCR package inherits the visibility of the repository the
`org.opencontainers.image.source` label links it to, so on a public repository
this resolves itself — and the workflow says so loudly when it does not.

Verified end to end on `micro-service-template`,
[run 30901257906](https://github.com/cloudsforge-online/micro-service-template/actions/runs/30901257906):
all three tags present and anonymously pullable, which is precisely what
`cfctl release --verify` (`cfctl.ts`) and
`deploy/scripts/release-deploy.sh` run.

### 2.3 29 of 48 running services will not restart. Measured, not read.

> ## ✅ FIXED SINCE — re-measured on the host, 2026-08-07
>
> This blocker no longer holds. Across both networks the host runs **181 containers: 105
> `unless-stopped`, 76 `no`** — and all 76 are one-shot `*-migrate`, `*-init` and `*-check` jobs
> (each appearing twice, once per network), for which `no` is the correct policy. Every one of
> the 105 long-running services carries `unless-stopped`; the count of *running* containers is
> also 105, i.e. the two sets coincide exactly.
>
> ```
> $ docker ps -a --format '{{.Names}}' | wc -l                 # 181
> $ … docker inspect -f '{{.HostConfig.RestartPolicy.Name}}'   # 105 unless-stopped, 76 no
> $ docker ps -a --filter status=exited --format '{{.Names}}'  # 76, all *-migrate/-init/-check
> ```
>
> **The second half of the requirement below still stands**: there is still no systemd unit in
> `deploy/`, so nothing brings the estate up at host boot. `unless-stopped` restarts a crashed
> container but does not survive a reboot of the machine — treat that as the live remainder of
> this item. The section below is retained as written, because its reasoning about *why* the
> policy matters on a cloud instance is unaffected.

```
$ for c in $(docker ps --filter label=com.docker.compose.project=cloudsforge-estate --format '{{.Names}}'); do
    docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' $c; done | sort | uniq -c
  29 no
  19 unless-stopped
```

The compose file has exactly five `restart:` lines. `x-web-defaults` sets
`unless-stopped` (`docker-compose.estate.yml`) so the 19 frontends and
Postgres are covered; `x-migrate-defaults` sets `"no"`
(`docker-compose.estate.yml`) which is correct for a one-shot. **The
backend services set nothing and therefore default to `no`.** A crashed `ledger`,
`identity` or `custody` stays down until a human runs `docker compose up`.

At home that is a bad afternoon. On a cloud instance — which will be stopped,
started, resized, and live-migrated by the provider without asking — it is the
default state after any of those events. There is also no systemd unit anywhere
in `deploy/`, so nothing brings the estate up at boot at all.

**Required before cloud:** an `x-service-defaults` anchor carrying
`restart: unless-stopped`, applied to every long-running service, and a systemd
unit per compose project. This is also the single largest thing 26 §2 gave up
("no automatic rescheduling if a container dies in a way `restart: unless-stopped`
does not fix") — except that today the estate does not have `restart:
unless-stopped` to begin with.

### 2.4 (Corollary) The database password is a literal, 57 times.

`POSTGRES_PASSWORD: estate-only-not-a-real-password`
(`docker-compose.estate.yml`) and the same string in 56 DSNs. It is not
parameterised by anything. It is honestly named and correct for a laptop; it
cannot leave one. See §5 and §7.

---

## 3. AWS — the shape, and why

**Recommendation: one EC2 instance running the same Docker Compose, on Graviton.**

| | |
|---|---|
| Instance | **`m7g.2xlarge`** — 8 vCPU Graviton3, 32 GiB, `arm64` |
| Region | `eu-west-1` (Ireland) |
| Storage | one **gp3** root/data volume, **200 GB**, 3,000 IOPS and 125 MB/s included |
| Network | one VPC, **one public subnet**, internet gateway, **no NAT gateway**, **no ALB** |
| Address | one **Elastic IP** — required, and the whole point of leaving home |
| Images | pulled from **GHCR**, not ECR (§2.2) |
| Ingress | **Traefik on the instance**, exactly as today, file provider only |
| Both environments | two compose projects on the one instance (26 §3), until §8's trigger fires |

**arm64 is available and free money here.** Every estate image already builds
`arm64` on this machine (`docker image inspect cloudsforge-estate-indexer:latest`
→ `arm64 linux`), the base images are the multi-arch `node:22-slim` and
`node:22-alpine`, and **there is not a single `--platform` or `platform:` pin
anywhere in the tree**. Graviton is ~19% cheaper than the equivalent Intel
`m7i.2xlarge` for hardware the estate has already been proven to run on. The one
risk is a native dependency that has no arm64 prebuild; the estate builds clean on
this arm64 Mac today, which is evidence but not proof for glibc arm64 Linux.

> **BUT THE PUBLISHED IMAGES ARE `amd64` ONLY, AND THIS PAGE IS THE ONLY PLACE THE
> TWO DECISIONS MEET.** The evidence above is about images built *locally* — Colima
> on an arm64 Mac naturally builds arm64. The images CI publishes are a different
> artefact: `org/.github/workflows/publish-image.yml` defaults `platforms`
> to `linux/amd64`, reasoning that arm64 "roughly doubles the build for an
> architecture nothing deploys to yet". Both statements were true when written, on
> the same day, by different hands.
>
> This matters because the cloud path deploys **published** images, and
> `deploy/scripts/release-deploy.sh` changes nothing until every image in the
> manifest pulls. Provision Graviton or Ampere against today's registry and the pull
> either fails or silently lands an `amd64` image on an `arm64` host.
>
> So arm64 is not free money yet — it costs one input. **Set `platforms:
> linux/amd64,linux/arm64` on the publisher before provisioning any arm64 host**, and
> expect roughly double the build time, which is the cost the publisher's note was
> weighing. Verified 2026-08-04: `docker pull ghcr.io/cloudsforge-online/micro-status-web:main`
> on this arm64 Mac fails with *"no matching manifest for linux/arm64/v8"*.

**`t4g.2xlarge` is the cheaper option and is genuinely defensible.** It is also
8 vCPU / 32 GiB, costs $215/mo on-demand against $266, and its baseline is 40% of
8 vCPUs = **3.2 vCPU — well above the measured 1.69-core idle**. The reason I do
not lead with it: nothing here has ever been load-tested, so there is no evidence
about what happens above idle, and the failure mode of exhausting CPU credits on
a burstable instance is a platform that gets slower under exactly the load that
made it interesting. Take `t4g.2xlarge` if the first months are quiet and the
saving matters; take `m7g.2xlarge` if you would rather not think about it.

### Not ECS/Fargate, and the reason is a number

Fargate bills per task. 79 containers, each at the **smallest legal task size**
(0.25 vCPU / 0.5 GB — Fargate only permits fixed vCPU↔memory combinations):

```
79 × 0.25 vCPU × 730 h × $0.03238/vCPU-h  =  $467/mo
79 × 0.5  GB   × 730 h × $0.003560/GB-h   =  $103/mo
                                    total ≈ $570/mo   (ARM64 rates, floor)
```

That is **2.6× the recommended instance**, for an absolute floor that assumes
every service — including Postgres — fits in half a gigabyte, which several do
not. Add an ALB ($18.40/mo + LCU) because Fargate tasks need something in front
of them, and a NAT gateway ($35/mo + $0.048/GB) because tasks in private subnets
need one. Fargate is the wrong billing model for an estate whose defining
property is *many small always-on processes*.

It is also the wrong data model. The estate resolves services **by container name
over the compose network** (26 §3), and `deploy.replicas` is already illegal here
because *"anything routed by DNS name resolves to one container"* (26 §2). Fargate
gives you exactly the multi-replica service discovery this architecture has
excluded.

### Not EKS

$73/mo for a control plane, plus the same EC2 nodes underneath, plus translating
82 compose services into manifests. 26 §2 made the argument and it does not change
in a cloud: these compose files carry, inline, the reasoning for why the estate is
shaped as it is, and *"a manifest translation either discards that reasoning or
duplicates it"*. Kubernetes buys bin-packing, rolling replicas and cross-node
self-healing. There is one machine, replicas are excluded by design, and the
self-healing this estate actually needs is `restart: unless-stopped`, which costs
one YAML anchor (§2.3).

### The strongest argument against my own recommendation

**One instance is one failure domain, and EC2 costs ~4× a dedicated server that
would do this better.** A Hetzner AX41 — 6c/12t, **64 GB**, 2×512 GB NVMe,
**unmetered** 1 Gbit — is €59/mo ex-VAT, about **$68**. The recommended AWS shape
is **$254/mo** on a one-year commitment. That is 3.7×, for less RAM, slower disk,
and metered egress on a workload that is a chain node gossiping continuously.
There is no availability argument to offset it, because the design is one
instance either way.

The honest position: **if the requirement were only "run this ecosystem cheaply on
real infrastructure with a static IP", a dedicated server would win on every axis
that matters here.** What AWS buys is snapshots as an API call, IAM, KMS-backed
secrets, a console the owner can operate from a phone, and the ability to change
the instance size in ninety seconds — and the owner asked for AWS and Azure. Both
are legitimate; the premium should be paid knowingly rather than discovered.

---

## 4. Azure — the shape

**Recommendation: one VM running the same Docker Compose, on Ampere.**

| | |
|---|---|
| VM | **`Standard_D8ps_v5`** — 8 vCPU Ampere Altra, 32 GiB, `arm64` |
| Region | **West Europe** |
| Storage | **Premium SSD v2**, 200 GiB, 3,000 IOPS and 125 MB/s included |
| Network | one VNet, one subnet, **NSG in place of a security group**, one **Standard static public IP** |
| Images | GHCR (§2.2) — **not** ACR |
| Ingress | Traefik on the VM |

`D8ps_v5` is the cheapest 8 vCPU / 32 GiB SKU on Azure at $268.64/mo PAYG, and
Azure's reserved-instance discounts are much steeper than AWS's savings plans —
**41% at one year** against AWS's 17.8% for Graviton — which makes Azure the
cheaper of the two clouds on a committed footing by a wide margin (§7).

**Do not use `D8pls_v5`.** The `Dpls` family is 2 GiB/vCPU, so it is 8 vCPU /
**16 GiB**, not 32. It is cheaper and it is the wrong machine, and the naming is
close enough to be an easy mistake for an implementing agent to make.

**Premium SSD v2 rather than P20.** A 512 GiB P20 is $80.54/mo for a fixed size
and fixed IOPS. Premium SSD v2 is $0.0949/GiB-mo with the same 3,000 IOPS / 125
MB/s free baseline, so the 200 GiB actually needed is **$18.98** — a quarter of
the cost, and resizable.

### Not ACI, not AKS

ACI has no equivalent of a compose network with stable container-name DNS across
79 containers, and its per-second billing for always-on workloads lands in the
same place Fargate does. AKS's control plane is free on the Free tier, which
removes the $73 argument — but every other line of §3's EKS reasoning survives
intact, and a free control plane for a single-node cluster is still an
orchestrator adopted to buy scheduling nobody needs.

### The strongest argument against

**Ampere arm64 is the least-exercised thing in this document.** AWS Graviton is
the same instruction set and a much larger deployed base; Azure's arm64 SKU
availability is narrower by region and quota, and nothing in this estate has ever
run on Ampere. If the images are ever found not to run, the fallback is
`D8as_v5` (AMD, x86, $303.68 PAYG / $187.33 at 1-year RI), which is **still
cheaper than the AWS equivalent** — so the risk is bounded and the downside is
one SKU change, not a redesign.

---

## 5. Postgres — self-hosted, and this is not a close call

**Recommendation: keep Postgres as a container on the instance, one per
environment, exactly as today.** Take managed only if and when someone other than
the owner is on call.

### What managed would cost

Two environments need two instances; they cannot share, for the same reason two
environments cannot share `custody-keys` (26 §3).

| | AWS RDS `db.t4g.large` ×2 | Azure PG Flex `B2ms` ×2 |
|---|---|---|
| Compute, Single-AZ / no HA | $201.48 | $232.44 |
| Storage, 100 GB each | $25.40 | $27.38 |
| **Added to the monthly bill** | **~$227** | **~$260** |
| With HA | ~$455 | **not possible** — zone-redundant HA is unsupported on Burstable at any price |

**Managed Postgres roughly doubles the total bill** ($254 → $481 on AWS), for a
measured 371 MB of data across 28 databases.

### What it would buy, honestly

Automated backups with point-in-time recovery, patching, and a failover that does
not involve the owner. Those are real, and PITR is the one I would miss most —
§6 argues that the ledger's durability requirement is genuinely higher than the
chain's.

### What breaks — the specific questions asked

**The migrator pattern survives, unchanged.** This was the thing most likely to
block managed Postgres and it does not. 28 one-shot migrator containers
(`x-migrate-defaults`, `docker-compose.estate.yml`) run
`node --import tsx src/migrator.ts`, and the service gates on
`condition: service_completed_successfully`. The runner
(`runtime/packages/db/src/index.ts`) takes a **session-scoped
`pg_advisory_lock`** on an FNV-1a hash of the service name (, taken), records applied versions in a `schema_migrations` table,
checksums migrations so an edited-after-applied one throws rather than runs, and wraps DDL and the ledger insert in one transaction.
**Every one of those is an ordinary client operation.** No superuser, no
filesystem, no `ALTER SYSTEM`. The migrators would run against RDS as they are,
given a DSN.

**The deferred constraint triggers survive.** There are **11**, of which 9 are
`INITIALLY DEFERRED`, and they carry the estate's most important invariants —
`journal_entries_balanced` and `postings_balanced` (`ledger/src/migrations.ts`)
enforce Σdebits = Σcredits at COMMIT, and `users_roles_need_a_grant`
(`identity/src/migrations.ts`) makes a bare `update users set roles=…`
from psql fail. All are plain `plpgsql` functions created by the table owner,
which RDS and Azure Flexible Server both permit.

**The GiST exclusion constraints survive.** Three of them —
`engagement_windows_no_overlap` (`market/src/migrations.ts`),
`tessera_parcels_do_not_overlap` (`tessera/src/migrations.ts`) and
`tessera_no_overlapping_bookings` (`tessera/src/migrations.ts`). Two
need `btree_gist` for the `uuid with =` operand, and `btree_gist` is the **only**
extension this entire estate creates (`market/src/migrations.ts`,
`tessera/src/migrations.ts`). It is allow-listed on both RDS and Azure
Flexible Server. `gen_random_uuid()` is used at 162 sites and needs no extension
on PG13+.

**Two things do break, and both are small.**

1. **`deploy/compose/estate/initdb.sql` becomes dead.** It is 28 bare
   `CREATE DATABASE` statements mounted at
   `/docker-entrypoint-initdb.d/10-databases.sql` — a path that does not exist on
   a managed instance. The 28 databases must be provisioned by Terraform or by a
   bootstrap role holding `CREATEDB`. Note `admin_api` with an underscore
   (`initdb.sql:56-58`); a hyphen is a syntax error unquoted.
2. **`deploy/scripts/verify-chain-backing.sh`** shells
   `docker exec … psql -c "create database $db"`. It needs a DSN instead of a
   container name.

### Why self-hosted anyway

Because the list above is the *good* news — managed Postgres is compatible — and
compatibility was never the question. The question is $227–260/month against 371
MB of data on an instance that already has 32 GiB of RAM and is being paid for
regardless. `max_connections=400` (`docker-compose.estate.yml`) is sized
for 28 services × pool-of-10 and carries over either way.

**The condition under which this flips**, stated so it is a decision and not a
deferral: **take managed Postgres the first time real money is in the ledger and
the owner is not the only operator.** At that point PITR and a failover nobody has
to be awake for are worth $227/month, and the migration is a `pg_dump`/`pg_restore`
plus 28 DSN changes — genuinely reversible, which is why deferring it is safe.

---

## 6. Persistence, the chain, and what backup means

**Three things on this estate cannot be re-derived. Everything else can.**

### 6.1 `custody-keys` — the one that ends the platform

Declared at `docker-compose.estate.yml`, mounted by `custody-keys-init` and `custody`. The comment block states the
consequence: `docker compose down -v` makes every `custody_keys` row
**permanently unspendable**. This is not a database that can be restored from a
dump — the keys *are* the assets.

**On cloud: it is a directory on an EBS/Managed Disk volume and must be backed up
out of band, encrypted, with a restore that has been performed.** Not configured —
performed. A daily EBS snapshot of the data volume covers it, but a snapshot of a
volume containing custody keys is itself custody-grade material: **encrypt the
volume with a customer-managed KMS key (AWS) or a disk encryption set (Azure) and
restrict snapshot-copy permissions.** 26's checklist already requires a tested
restore; this is the same requirement with a cloud IAM boundary around it.

### 6.2 The chain — and the surprise is that it is *nearly* stateless

A Hearth node's entire durable state is **three files** in its data directory
(`HEARTH_DATA`, default `/data`, `hearth/node/Dockerfile:17`):

| File | Re-derivable? |
|---|---|
| `blocks.ndjson` | **No** — from peers only, and only while a peer with full history is alive |
| `genesis.json` | No — it *is* the chain's identity |
| `coinbase-key.json` | **No** — mode 0600, `evmnode.js,68-83`. Lose it, lose the mining rewards |

**Everything else a node holds is rebuilt on boot** — accounts, storage, receipts,
the tries, the tx index — because `load()` replays and re-validates every block
from genesis (`blockchain.js`). So a chain backup is `cp` of three files,
totalling 5.6 MB today and growing 8.8 MB/day.

**But "resync from the network" is not a recovery story here, and the reason is
structural.** Sync is full block download only: `hello` → `getblocks` with an
exponentially-spaced locator → `blocks`, ≤200 blocks and ≤3 MiB per frame
(`p2p.js`; `P2P_MAX_BLOCKS`, `params.js`). **There is no fast sync, no
snap sync, no state download, and no snapshot import command** — the CLI offers
`trace, watch, wallet, call, send, deploy, devnet` (`node/bin/hearth.js`)
and nothing else. Recovering from the network means re-downloading and
**re-executing** every block. And if every node holding the history dies at once,
the chain is gone.

**Therefore: `blocks.ndjson` is mandatory backup, not optional**, and it should go
somewhere that is not the instance — S3 with versioning, or Azure Blob with
immutability. It is 8.8 MB/day; this costs cents.

**The recovery story, stated end to end.** Restore the three files to a fresh
volume, start the node, and it replays. **That replay is §2.1's problem**, and it
is why §2.1 is a prerequisite rather than a footnote: at mainnet PoW parameters a
one-year chain takes ~3.8 hours of pure hashing to boot, and past ~61 days it does
not boot at all. **Until §2.1 is fixed, the chain's recovery time is unbounded and
eventually infinite.** That is the single most important sentence in this document.

### 6.3 Postgres — and the honest ranking

371 MB across 28 databases. Restorable from `pg_dump` if dumps exist, and
**not otherwise** — a ledger is not re-derivable from the chain, which is
precisely what `ledger/src/reconcile.ts` exists to check (26 §6). Daily
`pg_dumpall` to S3/Blob, plus the volume snapshot, plus a tested restore.

**Ranking, because it decides what to do first when time is short:**
`custody-keys` (unrecoverable, ends the platform) > Postgres (unrecoverable, ends
the money) > `blocks.ndjson` (unrecoverable in the limit, but survivable while any
peer lives) > everything else (re-derivable from GHCR and git).

---

## 7. TLS and secrets

### TLS — the internal CA goes away, and it is a subtraction

Today the gateway serves a **locally minted CA and one wildcard leaf**
(`deploy/scripts/gateway-cert.sh`, `gateway/dynamic/tls.yml`), because the estate
was previously terminating on Traefik's built-in self-signed default and *every*
verification path had certificate checking turned off — `curl -k` 183 times,
`ignoreHTTPSErrors: true` in the browser harness. `gateway/certs/` is gitignored
because `ca.key` is a real CA private key.

**On cloud, with a real address, this becomes a real certificate and the CA is
deleted.** Two options, and I am choosing:

**Choose Cloudflare Origin CA certificates with Full (Strict), not ACME.** DNS is
already at Cloudflare (26 §7 requires it), the estate is already designed to sit
behind Cloudflare, Origin CA certs are free and valid for 15 years, and they drop
into `tls.yml`'s existing `defaultCertificate` block **with no change to the file's
shape** — one `certFile`/`keyFile` pair, exactly as now. That preserves the
argument `tls.yml` makes for `defaultCertificate` over an SNI list ("enumerating
them here would be the sixteenth copy of the registry").

The alternative, Let's Encrypt via Traefik's ACME resolver, needs **DNS-01** —
because these are wildcards and HTTP-01 cannot issue them — and therefore needs a
Cloudflare API token with DNS-edit rights sitting on the instance, which is a
broader credential than an origin certificate. It also needs **two separate
certificates**, since `*.cloudsforge.online` does **not** cover
`hub.testnet.cloudsforge.online` — wildcards do not nest, and this is the kind of
detail that is discovered at go-live. Origin CA has the same two-certificate
requirement but no renewal machinery to fail.

> **Update, 2026-08-05.** It *was* discovered at go-live, and the resolution was
> to change the hostnames rather than the certificates. The environment is now a
> **suffix on the first label** — `hub-testnet.cloudsforge.online`, not
> `hub.testnet.cloudsforge.online` — so both environments sit under the single
> `*.cloudsforge.online` wildcard and the **two-certificate requirement is
> gone**, for ACME and Origin CA alike. See
> [26-public-deployment §0](26-public-deployment.md) and
> `ui/packages/ui/src/surfaces.ts`. The Origin CA recommendation above
> is unaffected on its own merits; only the certificate *count* changes.

**What is lost:** an Origin CA certificate is only trusted by Cloudflare, so the
origin cannot be reached directly by a browser. That is already true and already
intended.

### Secrets — SSM Parameter Store / Key Vault, and one blocker first

Today `estate-bootstrap.sh` mints ~35 service tokens and credentials into
`compose/estate/tokens.env`, which `.gitignore` refuses at line 7 with the
comment *"Real credentials, 10-minute TTL, never committed"*. `estate-verify.sh`
asserts the ignore rule with `git check-ignore -v` rather than assuming it. That
design is sound and should not be replaced — an env file is what compose reads.

**What changes is where the file comes from.** It must not be baked into an image
or an AMI, and it must not be typed by hand on the instance.

- **AWS: SSM Parameter Store, `SecureString`, KMS-encrypted.** Standard-tier
  parameters are **free**; Secrets Manager would be $0.40/secret/month × ~35 =
  **$14/mo** for no benefit this estate uses. The instance profile gets
  `ssm:GetParametersByPath` on `/cloudsforge/<env>/*` and nothing else; a boot
  unit renders `tokens.env` to `tmpfs`.
- **Azure: Key Vault** with a system-assigned managed identity on the VM, same
  render-to-tmpfs pattern. Effectively free at this volume.

**The blocker: `POSTGRES_PASSWORD: estate-only-not-a-real-password`
(`docker-compose.estate.yml`) appears 57 times in that file and is
parameterised by nothing.** Before any cloud deployment it must become a variable
sourced from the same store — and 26 §3's precedent is exactly how: make it a
variable *with its current value as the default*, and prove `docker compose config`
renders byte-for-byte identically with nothing set, so the running estate is
unaffected and CI can assert it.

Also to move: `CF_GRAFANA_ADMIN_PASSWORD`, `CF_BEACON_TOKEN`,
`prometheus/secrets/beacon_token`, and `alertmanager/secrets/*_webhook_url`.

---

## 8. Two environments — one account, one VPC, one instance, two compose projects

**Decision: both environments on one instance, in one account, in one VPC/VNet,
as the two compose projects 26 §3 already built** — until the trigger below fires.

**Why not two accounts.** Two accounts doubles every fixed cost — instance,
volume, public IP, snapshots — for an environment that is by definition
disposable. It also splits the telemetry plane, and 26 §3 argues persuasively
that the question an operator asks during an incident is *"is this happening on
both?"*, which two Grafanas cannot answer.

**Why not two VPCs.** A VPC is a network boundary, and the boundary that matters
here is not network. The things that must not be shared are the **Postgres
instance**, the **`custody-keys` volume**, and the **chain id** — and all three
are already separated by the compose project, which namespaces volumes
(`custody-keys` → `cf-testnet_custody-keys`) and networks. 26 §3 verified this
gives 45 mainnet ports and 45 testnet ports with zero overlap. A second VPC adds
a boundary around a risk that does not live there.

**What *is* different on cloud, and it is the security group.** At home, 53
loopback bindings and a Cloudflare Tunnel meant nothing was reachable. On a public
subnet the instance has a real address, and **the security group / NSG is the only
thing between the internet and 90 debug ports.** The rule set is short and should
be written as a deny-by-default allowlist:

| Port | From | Why |
|---|---|---|
| 443 | `0.0.0.0/0` | the gateway, both environments (SNI-routed by Traefik) |
| 80 | `0.0.0.0/0` | redirect to 443 only (`--entrypoints.web.http.redirections`, `docker-compose.gateway.yml`) |
| **8646 / 8746** | `0.0.0.0/0` | Hearth **raw-TCP** P2P, mainnet / testnet — §9 |
| (8648 / 8748) | **loopback only** | Hearth **WebSocket** P2P — reached through Traefik on 443, never bound publicly |
| 22 | operator only, or **none** (SSM Session Manager / Azure Bastion) | |
| everything else | **denied** | the 45+45 debug ports and all five telemetry UIs stay loopback |

26 §4's decision that Grafana, Prometheus, Tempo, Loki and Alertmanager are **not
exposed at all** — because four of the five have no authentication whatsoever —
carries over verbatim and is *more* important here, because at home the tunnel was
a second accident-proof layer and on a public subnet it is not. **Reach them with
SSM Session Manager port-forwarding (AWS) or Azure Bastion**, which is strictly
better than 26's `ssh -L`: no open SSH port, and the auth decision sits on IAM.

**The trigger that splits them.** **When mainnet genesis is cut and real EMBER
exists, mainnet moves to its own instance.** The reason is not load, it is blast
radius: one host means a testnet compromise is a mainnet compromise, and
`custody-keys` for mainnet is on that disk. Until there is real value, the risk is
theoretical and the saving is real; after, it inverts. That is a decision with a
stated condition, and an implementing agent should build the Terraform/Bicep with
the environment as a module parameter so the split is a second `terraform apply`
and not a rewrite.

---

## 9. P2P and mining — 26 §5 and §6 are partly wrong, in a useful direction

This section corrects the previous document. Both corrections make the problem
smaller.

### 9.1 Miners do not use P2P. They pull work over HTTP.

26 §6 treats mining as something that must happen on a machine that is part of the
chain's P2P layer. **It is not.** Hearth's remote mining protocol is two HTTP
endpoints on the **REST port 8645**:

- `GET /mining/template?pub=<65-byte uncompressed key>` — `evmnode.js` →
  `Templates.issue`, `chain/miner.js`
- `POST /mining/submit` with `{templateId, nonce, powDigest, powSig}` —
  `evmnode.js` → `chain/miner.js`; 409 means stale work, pull again

The REST handler sets `access-control-allow-origin: '*'`
(`evmnode.js`), which is the node telling you this surface is meant to be
public.

**Three consequences.**

1. **The owner's Mac and PC need no inbound ports and no P2P peering at all.**
   They need outbound HTTPS to one hostname. Everything 26 §6 says about miners is
   still true about *hash rate*; nothing about it is true about *connectivity*.
2. **Mining works over Cloudflare Tunnel.** It is HTTP. 26's central constraint —
   the tunnel carries HTTP but not raw TCP — never applied to mining. This means
   **option 3 in 26 §6 ("keep mining on the laptop") was never blocked by the
   tunnel**, and the mining question was always a question about decentralisation
   and availability rather than about networking.
3. **`/mining/*` must be routed, and the rest of 8645 is a decision.** Port 8645
   also serves `/info`, `/supply`, `/mempool` and an SSE `/events` stream. Route
   `/mining/template` and `/mining/submit` through Traefik on the public
   `rpc.<apex>` host; treat `/events` as a deliberate choice, because an
   unbounded SSE stream per client is a cheap way to hold connections open.
   Template issuance does real work per request and has no authentication —
   permissionless mining is the intent, so **rate-limit it at the edge rather than
   authenticating it.**

### 9.2 P2P now has two transports — and that makes the cloud host a bridge

**This changed underneath this document while it was being written**, and the code
wins. 26 §5 describes P2P as raw TCP only, and that was true when 26 was written.
As of `hearth` **6d590d4** — *"feat(p2p): carry gossip over WebSocket, so a
tunnelled node can be reached at all"* — there are **two transports and one
protocol**, and `p2p.js` states the reason in the file itself:

> *A Cloudflare Tunnel carries HTTP and WebSocket and cannot carry raw TCP, so a
> node published from a home server with no static IP can be reached on
> `wss://p2p.<apex>/p2p` and on nothing else.*

| | TCP | WebSocket |
|---|---|---|
| Server | `net.createServer`, `p2p.js`, `listen` | `WS.createServer`, `listen` |
| Dial | `net.connect(this._tcpTarget(peer))` | `WS.connect(url)` |
| Port | **8646** (`params.js`) | **8648** (`params.js`) |
| Path | — | `/p2p` (`params.js`) |
| Flag / env | `--p2p` / `HEARTH_P2P` | `--p2p-ws` / `HEARTH_P2P_WS` (`hearthd.js`) |

`this.peers` is *"sockets and WebSocket connections, indistinguishably"*
(`p2p.js:~77`), and `--peer` takes either form — `host:port` for TCP or a
`ws://`/`wss://` URL (`hearthd.js,52`), dispatched by
`isWsUrl(peer) ? this._dialWs(…) : net.connect(…)`.

**This is better for the cloud design than raw TCP alone, and it is the argument
for the cloud host existing at all.** Expose **both**: raw TCP on 8646 for peers
that can open a socket, and `wss://p2p.<apex>/p2p` through Cloudflare for peers
that cannot. The cloud instance then **bridges the two populations** — the home
MicroServer, which can only ever be reached over `wss://`, gossips with the cloud
node, which is simultaneously reachable on a raw port by anyone else. Neither
deployment has to choose a transport, and 26's home plan does not need revising.

**The part with no workaround, and it did not change: there is no peer
discovery.** Peers come from `--peer` (`node/bin/hearthd.js`) or the
`HEARTH_PEERS` environment variable (, comma-separated), dialled at start,
with one 3-second reconnect loop shared by both transports (`p2p.js`).
**No message type carries a peer address** — the protocol is still exactly
`hello | getblocks | getblock | blocks | block | tx`
(`p2p.js,545,573,581,600,612`). Every node must be *told* its peers by
configuration, and a node whose configured peers are all down cannot find the
network by any other means.

**So the cloud host's value is precisely that it is a stable, publishable
address.** This is the thing the home deployment cannot provide and the reason
step 2 exists. Concretely:

- Open **8646** (mainnet TCP) and **8746** (testnet TCP) to `0.0.0.0/0` on the
  security group. Two ports, one Elastic IP — `HEARTH_P2P` is settable per
  environment, so this needs no code change and fits 26 §3's port-offset
  convention.
- Route **`wss://p2p.<apex>/p2p`** through Traefik to the node's WebSocket P2P
  port (**8648** mainnet, **8748** testnet, `HEARTH_P2P_WS`). This is an ordinary
  proxied HTTPS hostname and costs one more row in the ingress derivation
  (26 §4) — it is the only address a tunnelled or firewalled peer can use.
- **The raw-TCP endpoint must be a DNS-only (grey cloud) record**, and the
  `wss://` one a proxied record. Cloudflare's proxy is HTTP; a proxied record in
  front of 8646 silently does not work. Publishing both is the point — one
  hostname per transport, not one hostname that half-works.
- 26 §5's recommendation of **two VPS seeds in different providers** stands and is
  now cheap to satisfy: the cloud instance is one, and a €5 VPS is the second.
  One seed is a single point of failure for *joinability* — with no discovery
  protocol, a new node whose only configured peer is down cannot find the network
  by any other means.
- Publish seed addresses on `network.<apex>`, **derived from what the node reports
  on `/info`, not typed** (26 §5).

**The server still does not mine.** Nothing above changes that; it makes the
owner's Mac and PC able to mine into it from anywhere, over HTTPS, which is what
was wanted. 26 §6's actual question — *should the platform be the majority of its
own hash rate, and what does the ledger do when the chain is idle rather than
unreachable* — is untouched by this document and still belongs to the owner.

---

## 10. Cost

**Assumptions, stated because a number without one is worse than no number:**
730 hours/month; EU regions (`eu-west-1`, West Europe); Linux; **200 GB** of block
storage (§1); **200 GB/month egress**, of which the first 100 GB is free on both
clouds — this is a **guess**, nothing has measured this estate's egress, and a
continuously gossiping chain node could plausibly be several times it; one public
IPv4; images from GHCR at $0; self-hosted Postgres; **both environments on one
instance**. Prices pulled 2026-08-04 from the AWS Price List Bulk API and the
Azure Retail Prices API — the marketing pages render client-side and cannot be
scraped.

| Line | AWS `m7g.2xlarge` | Azure `D8ps_v5` |
|---|---|---|
| Compute, on demand | $265.57 | $268.64 |
| Compute, **1-year commit, no upfront** | **$218.34** (−17.8%) | **$158.50** (−41%) |
| Block storage, 200 GB | $17.60 (gp3 @ $0.088) | $18.98 (Premium SSD v2 @ $0.0949) |
| Snapshots, ~100 GB | $5.00 | ~$5.00 |
| Public IPv4 | $3.65 | $3.65 |
| Egress, 100 GB billable | $9.00 | $8.70 |
| Registry | $0 (GHCR) | $0 (GHCR) |
| **Total, on demand** | **~$301/mo** | **~$305/mo** |
| **Total, 1-year commit** | **~$254/mo** | **~$195/mo** |

**Azure is the cheaper cloud on a committed footing, by ~23%**, entirely because
its reserved-instance discount is 41% against AWS's 17.8% for Graviton. At
3 years the gap widens: Azure $102.08/mo compute against AWS $156.22.

**Options priced, so they are not re-argued:**

| | Monthly |
|---|---|
| Managed Postgres, both environments, no HA (§5) | **+$227** AWS / **+$260** Azure |
| ECS Fargate instead of an instance, absolute floor (§3) | **~$570** + ALB $18 + NAT $35 |
| EKS control plane, on top of the same nodes | **+$73** |
| AKS Free-tier control plane | +$0 |
| A second instance to split mainnet from testnet (§8) | **+$218** AWS / **+$159** Azure |
| Hetzner AX41 dedicated — 6c/12t, **64 GB**, 2×512 NVMe, **unmetered** | **~$68** |

**The comparison the owner should see: the recommended AWS shape is 3.7× a
dedicated server with twice the RAM and no egress meter; Azure is 2.9×.** Egress
is the line most likely to break these estimates — both clouds charge ~$0.09/GB
past 100 GB, so a node doing 2 TB/month is $170/month of bandwidth against €0 at
Hetzner. **Instrument egress in the first month and revisit**; it is the one
number here with no measurement behind it at all.

---

## 11. What an implementing agent builds

Named, so nothing is deferred to the person holding the keyboard.

**Prerequisites, in `hearth`, `org` and `deploy` — before any cloud work:**

1. `hearth`: stream `blocks.ndjson` rather than `split('\n')`; add a trusted
   restart path that does not re-verify PoW on self-written blocks (§2.1).
2. ~~`org`: `push: true` to `ghcr.io/cloudsforge-online/*` in `service-ci.yml`'s
   image job, and the same for `web-ci.yml`.~~ **Done, and NOT that way — that
   way fails all 35 callers at startup** (micro-org runs 30900277471 vs
   30900280323). `org/.github/workflows/publish-image.yml` is a separate
   reusable workflow each repository opts into with its own `packages: write`
   grant; `push: false` stays in the two gate builds, which need `load:`. What
   remains for an implementing agent is only to check every deployable
   repository carries the `publish` job — `cfctl release --verify <version>`
   answers that in one command (§2.2).
3. `deploy`: an `x-service-defaults` anchor with `restart: unless-stopped` on
   every long-running service; a systemd unit per compose project (§2.3).
4. `deploy`: `POSTGRES_PASSWORD` and its 56 DSN copies parameterised, with the
   current value as the default and a `docker compose config` byte-equality check
   in CI, per 26 §3's precedent (§2.4, §7).

**AWS (Terraform):** one VPC, one public subnet, IGW; `aws_instance`
`m7g.2xlarge` (`arm64` AMI — Amazon Linux 2023 or Ubuntu 24.04); one 200 GB
`gp3` volume, **encrypted with a customer-managed KMS key**; one Elastic IP;
security group per §8's table; instance profile with `ssm:GetParametersByPath` on
`/cloudsforge/<env>/*`, `s3:PutObject` on the backup bucket, and SSM Session
Manager; one S3 bucket, versioned, for `blocks.ndjson`, `pg_dumpall` and the
`custody-keys` archive; DLM policy for daily snapshots. **No NAT gateway, no ALB,
no ECR, no RDS.** Environment as a module variable, so §8's split is a second
apply.

**Azure (Bicep or Terraform):** one resource group per environment, one VNet, one
subnet, NSG per §8; `Standard_D8ps_v5` (fall back to `D8as_v5` if arm64 quota or
images disappoint); one 200 GiB Premium SSD v2 with a disk encryption set;
Standard static public IP; system-assigned managed identity with Key Vault get
rights and Blob write; one storage account with immutability for backups; Azure
Bastion **or** SSM-equivalent access only. **No ACR, no AKS, no Flexible Server.**

**On the instance, both clouds:** Docker Engine + compose plugin; a boot unit that
renders `tokens.env` to `tmpfs` from the secret store; `docker compose pull` +
`up -d` against the release-manifest overlay (`release-render.py`); Traefik with
the Cloudflare Origin CA certificate pair in the existing `defaultCertificate`
block; two Hearth nodes, neither mining, with `HEARTH_P2P=8646`/`8746` bound
publicly and `HEARTH_P2P_WS=8648`/`8748` bound to loopback behind Traefik.

**Cloudflare:** proxied records for all 24 routed hostnames per environment
(26 §4) **plus `p2p.<apex>` for the WebSocket transport**; **DNS-only** records
for the two raw-TCP P2P endpoints; Full (Strict) mode.
26 §4's four generated tunnel configs remain valid and are the fallback path if
the cloud host ever needs to be reachable without a public address.

---

## 12. What could not be verified

**There is no AWS account and no Azure account.** Nothing in this document has
been applied, priced against a real bill, or run. Every architectural claim about
either provider is from documentation and pricing APIs.

**No load test, here or in 26.** Every footprint figure is idle, on a MacBook
with 11.65 GiB visible to Docker and 6 CPUs. The instance sizes are derived from
idle measurements times a headroom factor, which is a judgement and not a
measurement.

**Egress is entirely unmeasured** and is the line most able to break the cost
estimate. 200 GB/month is a guess.

**arm64 on Linux is inferred, not proven.** The images build `arm64` on this
machine and nothing pins a platform, which is strong evidence and not the same as
having run the estate on Graviton or Ampere glibc. Ampere specifically has never
run any part of this.

**The chain figures extrapolate from one data point.** 1,530 bytes/block is
measured over 3,833 blocks on a testnet whose blocks are essentially empty — it is
a **floor**, and a chain carrying real transactions will exceed it. The 61-day
`MAX_STRING_LENGTH` wall is arithmetic and is solid; the RAM and boot-time
projections at one year are **low confidence, ±2×**, and the honest way to get
real numbers is to generate synthetic `blocks.ndjson` at 100k/250k/500k blocks
offline and time `load()` while sampling `heapUsed`. That was not done.

**Nothing was restarted to measure it.** The 29-of-48 restart-policy figure comes
from `docker inspect` on the live estate; no container was stopped to observe what
happens. The estate was read, not disturbed.

**Cloudflare Origin CA is a documentation-based choice.** No Cloudflare account
exists (26 §8 says the same), so the claim that an Origin CA pair drops into
`tls.yml` unchanged is reasoning from the file's shape, not a tested
configuration.

**Backup restore has never been performed** for any of the three
non-re-derivable artefacts, on any platform. 26's checklist requires it; this
document adds a cloud IAM boundary to the same untested requirement.
