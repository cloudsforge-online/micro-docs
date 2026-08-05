# 26 — The first public deployment

**Status when written:** a plan and a set of artefacts, **none of it deployed**.
Written 2026-08-04 against the estate running on the author's laptop.

**Status on 2026-08-05: deployed, and both environments are public.** The plan
below is left as it was written — see the correction immediately following for
the two places where reality took a different route, one of which changes every
testnet hostname in this document.

The target is an **HP ProLiant MicroServer Gen10**, running **two environments**:
mainnet at `cloudsforge.online` and testnet at `testnet.cloudsforge.online`,
behind **Cloudflare Tunnel**, with **no mining on the box**.

Everything in §1–§4 is built and checked in `micro-deploy`. §5 is the part a
tunnel cannot solve. §6 is unresolved and belongs to the owner. §7 is the gate.

---

## 0. Correction, 2026-08-05 — the testnet is a hostname SUFFIX, not a second label

**Read this before §3 or §8.** This document assumes testnet surfaces live at
`<surface>.testnet.cloudsforge.online`. **They do not, and they never did.** That
form is dead in every occurrence below.

| | Mainnet | Testnet |
|---|---|---|
| A surface | `<surface>.cloudsforge.online` | `<surface>-testnet.cloudsforge.online` |
| The front page | `cloudsforge.online` | `testnet.cloudsforge.online` |
| JSON-RPC | `https://rpc.cloudsforge.online` | `https://rpc-testnet.cloudsforge.online` |
| P2P | `wss://p2p.cloudsforge.online/p2p` | `wss://p2p-testnet.cloudsforge.online/p2p` |
| Chain ID | **7411** (`0x1cf3`) | **7412** (`0x1cf4`) |

**Why the change, and it is this document's own §3 that predicted it.** §3 argued
the two-label form needed no code change, and it was right about the code. It was
the *certificate* that killed it: Cloudflare's Universal SSL covers a
single-label wildcard, so `*.cloudsforge.online` matches
`testnet.cloudsforge.online` but not `hub.testnet.cloudsforge.online`, and a
two-label wildcard needs Advanced Certificate Manager, which is paid. Rather than
buy it, the environment was moved into the **first label, as a suffix**. The
registry carries it: `ENV_LABELS` and `splitEnvLabel()`
(`ui/packages/ui/src/surfaces.ts:1030-1078`), with the reasoning and the
before/after stated in the comment above them
(`ui/packages/ui/src/surfaces.ts:995-1010`).

**The split is on the LAST hyphen, and `worlds-api` is why**:
`worlds-api-testnet` must read as the surface `worlds-api` on `testnet`, not as
`worlds` on an environment called `api-testnet`
(`ui/packages/ui/src/surfaces.ts:1042-1046`).

**Consequently, in this document:** §3's worked example (`hub.testnet...` → apex
`testnet...`) describes a shape that was configured and unreachable; §7's
"Browse `testnet.cloudsforge.online`" is done; and §8's "the testnet apex has
never been served" is no longer true. Each is annotated in place.

**Measured over the public internet, 2026-08-05.** All 16 UI surfaces return 200
on each network, plus each apex. `eth_chainId` returned `0x1cf3` from `rpc.` and
`0x1cf4` from `rpc-testnet.`, so §7's "chain IDs confirmed distinct on the wire"
is satisfied. `nimbus`, `pay` and `vault` answer `/livez` with 200 and `/` with
404 on both — correct for `servesUi: false`, and not a fault to be reported.
`p2p.` and `p2p-testnet.` answer 426 at `/p2p`.

**Still broken, and named rather than omitted:** `api.cloudsforge.online` returns
**502** (issue #35). **Retired rather than broken:** `worlds-api.` has no DNS
record because the game API was consolidated into `api.` — so the rename this
document plans in §3 and elsewhere did not happen, and the reverse did. It is
still a registry row (`ui/packages/ui/src/surfaces.ts:770-783`), which is an
inconsistency worth closing.

**Neither network's EMBER has monetary value.** Testnet EMBER is worthless by
construction and comes from the faucet, which is a route on the Network site
rather than a host (`ui/packages/ui/src/surfaces.ts:545-561`) — so the testnet
faucet is **`network-testnet.cloudsforge.online/faucet`**. Nothing gives away
mainnet EMBER.

---

## 1. What was measured, rather than assumed

The brief carried a figure of "64 containers, ~4.3 GiB, ~3.1 cores" and asked for
a re-measurement. It is wrong in a way that matters, and the correction changes
the hardware conclusion.

Measured with `docker stats --no-stream` on the live estate, 2026-08-04:

| Compose project | Containers | Memory | CPU |
|---|---|---|---|
| `cloudsforge-estate` | 48 | **2 661 MiB** | **0.61 cores** |
| `cfmicro` (gateway + telemetry) | 7 | 772 MiB | 0.02 cores |
| `hearth` (seed + 2 miners) | 3 | 430 MiB | **2.17 cores** |
| `*-test-pg` fixtures | 6 | 424 MiB | 0.01 cores |
| **Total** | **64** | **4 287 MiB** | **3.17 cores** |

The 4.3 GiB and 3.1 cores are real, and neither is the estate:

- **2.14 of the 3.17 cores are the two testnet miners**, at 106% and 107% of a
  core each. That is proof-of-work, and it is the one thing the MicroServer is
  specified *not* to do. The estate itself idles at **0.61 cores**.
- **424 MiB is six `*-test-pg` containers** — per-repository test databases, not
  part of the estate at all.

**One environment** is the estate, a gateway, and one non-mining node:
**≈ 3.5 GiB and ≈ 0.65 cores at idle.**

### Two environments on a Gen10

Telemetry is **shared, not duplicated** (§3), so the delta per extra environment
is the estate + gateway + node, not the observability plane:

| | Memory | CPU (idle) | Containers |
|---|---|---|---|
| mainnet | ~2.85 GiB | ~0.63 | 50 |
| testnet | ~2.85 GiB | ~0.63 | 50 |
| shared telemetry | ~0.75 GiB | ~0.02 | 6 |
| **total** | **≈ 6.4 GiB** | **≈ 1.3 cores** | **106** |
| + host OS, Docker, page cache | ~1.5–2 GiB | | |
| **realistic** | **≈ 8 GiB idle** | **≈ 1.3 cores idle** | |

**Where a Gen10 will strain, stated plainly:**

- **32 GB is right, and 16 GB is not comfortable.** 8 GiB idle sounds like 16 GB
  is ample. It is not: that figure is two Postgres instances plus ~90 Node heaps
  *doing nothing*. Node heaps grow under load and Postgres will take whatever
  `shared_buffers` it is given. 32 GB ECC is the correct call.
- **The original Gen10 has 2 cores, and 2 cores is not enough.** The AMD Opteron
  X3216 is 2C/2T. At ~1.3 cores idle, that leaves ~0.7 cores for every request,
  every migration, every backup and every image build. The **Gen10 Plus (Xeon
  E-2224, 4C/4T) is the floor**, and the Gen10 Plus v2 is the safer buy. This is
  a change to the brief's "2–4 cores": 2 is not in range.
- **Disk was not measured and is the largest unknown.** Two chains, two
  Postgres instances, Loki and Tempo retention, and 90 images. The MicroServer
  takes 4 LFF bays. **Budget for SSD, not the bundled spinning disks** — Postgres
  and an indexer on 5400rpm SATA is the kind of decision that is discovered
  months later.

**Caveat, and it is a real one: every figure above is idle.** No load test was
run. Nothing here predicts behaviour under concurrent users, and the CPU number
in particular should be treated as a floor rather than an estimate.

---

## 2. Why Docker Compose and two projects, not Kubernetes

A reader will ask, so here is the argument rather than the conclusion.

**The estate already *is* compose, and it became genuinely reproducible today.**
Three pieces of undeclared runtime state were found and declared: credentials
that blanked on a plain `up`, a missing `:443` binding, and an unattached estate
network. That is the work k3s would have been adopted to avoid, and it is done.

**A single-node k3s adds an orchestrator to buy scheduling nobody needs.** The
things Kubernetes is *for* — bin-packing across nodes, rolling replicas,
self-healing across failure domains — all assume more than one machine. There is
one machine. On one node, a Deployment is a container with more YAML in front
of it.

**`deploy.replicas` is already illegal here, and the gateway file says why.**
Anything routed by DNS name resolves to one container; a second replica is a
second answer to a name the estate treats as singular. The property that would
most justify an orchestrator is the property this architecture has already
excluded.

**Translating ~64 services would fork the source of truth.** And this is the real
argument. These compose files are not manifests, they are *the written record of
why the estate is shaped as it is* — `docker-compose.estate.yml` alone carries,
inline, the diagnosis of a custody volume that meant the key service had never
successfully minted a key, and the reason a named volume rather than a bind mount
keeps private key material out of a git repository. A manifest translation either
discards that reasoning or duplicates it, and this estate's entire recorded
history is that **duplicated facts drift and the drift is what costs**. Four
separate incidents in this codebase are one hand-maintained copy of something
derivable.

**Isolation is therefore a compose project**: separate networks, volumes,
container names and one Postgres per environment. That is six variables (§3), not
a control plane.

**What this gives up, honestly.** No rolling deploys — a service restart is a
brief outage on that surface. No automatic rescheduling if a container dies in a
way `restart: unless-stopped` does not fix. No resource limits enforced by a
scheduler. On a single box with one operator, all three are acceptable; the first
is the one that will eventually be missed.

---

## 3. The two-project overlay

Built and pushed in `micro-deploy` (`compose/testnet.env`,
`compose/env/traefik.testnet.env`).

`.env.example` said of `COMPOSE_PROJECT_NAME`: *"Change only if you run two
copies of this stack on one host, which nothing here is designed for."* That was
accurate, and **the reason it gave was not the reason it was true**. Three things
blocked it, and the documented escape hatch was the one that did nothing:

1. **`name: cloudsforge-estate` was a literal** at
   `docker-compose.estate.yml:64`. A top-level `name:` **overrides
   `COMPOSE_PROJECT_NAME` entirely** — so the variable `.env.example` points at
   had been dead since that line was written.
2. **Four networks were pinned by literal name** with `external: true`
   (`cf-micro-edge`, `cf-micro-app`, `cf-micro-vault`,
   `cloudsforge-estate_default`). Two projects would have *shared* them. That is
   not isolation; it is one estate with two names, each service resolving the
   other's by container alias.
3. **47 fixed host ports** — 45 loopback debug ports, `:443`, and 9095/9096/9097.

All three are now variables **with their current values as defaults**. This was
verified rather than asserted: `docker compose config` renders all three files
**byte-for-byte identically** to `git show HEAD:` with nothing set. The running
estate is unaffected, and CI asserts it.

Six variables produce the second environment:

```
CF_PROJECT=cf-testnet          # container names, default network, volume prefix
CF_NET_PREFIX=cf-testnet       # the three external networks
CF_PORT_BASE=5                 # 4100-4144 -> 5100-5144
CF_GATEWAY_PORT=10443          # 443 -> 10443, still loopback only
CF_GW_PORT_BASE=91             # 9095/6/7 -> 9195/6/7
CF_TRAEFIK_ENV=traefik.testnet # the apex
```

Verified: **45 mainnet ports, 45 testnet ports, zero overlap**; project names
`cloudsforge-estate` / `cf-testnet`. Volumes needed no change — compose
namespaces them by project, so `custody-keys` becomes
`cf-testnet_custody-keys`. That one matters more than it looks: `custody-keys`
holds every key the platform custodies, and two environments sharing it would be
two ledgers spending one set of coins.

**Telemetry is shared, deliberately.** One Prometheus, Grafana, Loki and Tempo
for both environments. Duplicating them costs ~770 MiB and buys nothing — the
question an operator asks during an incident is *"is this happening on both?"*,
and two Grafanas cannot answer it. **The cost:** metrics from two environments
merge unless an `env` label separates them, and a merged EMBER supply figure
across a real chain and a test one is precisely the sort of number that trips a
reconciliation alarm. That label is load-bearing and belongs in
`prometheus/targets/`.

### Does testnet need a code change? No — and this was checked, not assumed

The brief's claim was that `CF_WEB_APEX=testnet.cloudsforge.online` suffices. The
mechanism is different from the claim and **better**: browser bundles do not read
`CF_WEB_APEX` at all. `cloudsforgeHosts()`
(`ui/packages/ui/src/index.tsx:154-162`) derives the apex from
`window.location.hostname`, stripping the first label **only when it is a known
registry subdomain**:

```js
const apex = parts.length > 2 && KNOWN_SUBS.has(first) ? parts.slice(1).join('.') : host
```

Run against the real module:

- `hub.testnet.cloudsforge.online` → `hub` is in `KNOWN_SUBS` → apex
  `testnet.cloudsforge.online` ✓
- `testnet.cloudsforge.online` → `testnet` is **not** → apex unchanged ✓

So one build serves both environments and no rebuild is needed per environment.

> **Superseded, 2026-08-05 (§0).** The *conclusion* held and the *addresses did
> not*. `hub.testnet.cloudsforge.online` was never reachable — Universal SSL does
> not cover a two-label host — so the environment became a **suffix on the first
> label**: `hub-testnet.cloudsforge.online`, apex `cloudsforge.online`. One build
> still serves both, by the same argument; the derivation now splits the first
> label on its last hyphen against `ENV_LABELS` rather than stripping a label
> against `KNOWN_SUBS` alone (`ui/packages/ui/src/surfaces.ts:1030-1078`).

**The one way it could stop being true, which is now a check.** If any surface
ever takes `subdomain: 'testnet'`, `KNOWN_SUBS` gains `testnet`, and the *bare
testnet apex* starts stripping its own first label — resolving every link, every
sign-in redirect and every API base on the testnet front page to
**`cloudsforge.online`, which is mainnet**. Nothing errors. Every address is
real. A test environment silently handing its users to production is the worst
shape this defect could take. `scripts/check-apex-prefix.py` fails on it, and on
`staging`, `preview`, `dev` and `mainnet` for the same reason.

### What hardcodes an apex or a port

Found by grep across all 68 repositories, excluding tests and `dist/`:

| Where | What | Severity |
|---|---|---|
| `contracts/packages/chain/src/index.ts:127-128` | `explorerTxUrl` for EMBER: **mainnet and testnet were the same literal string**, `https://explorer.cloudsforge.online/#/tx/`. Every testnet transaction link pointed at the mainnet explorer, where it would not resolve. | **FIXED** 2026-08-04, `contracts` 326de9d — and the compile-time guard that replaced it found a third instance in SOL. |
| `wallet-extension/src/background/storage.ts:177-186` | Mainnet RPC was `https://rpc.hearth.cloudsforge.online` — a **three-label host that the plan's `rpc.<apex>` does not match**. Testnet was `http://127.0.0.1:8545` with `explorerUrl: null`, so the shipped wallet could not reach a public testnet at all. | **FIXED** 2026-08-04, `wallet-extension` 34912bd — the same dead host was also in `host_permissions`, so MV3 blocked the fetch outright. |
| `sdk/`, `devportal-web`, `site`, `network-site` | `https://api.cloudsforge.online` in OpenAPI servers and prose. Correct for a published SDK; noted so it is not mistaken for drift. | Fine. |
| `deploy/gateway/dynamic/policy.yml` | The **literal** `cloudsforge.online` CORS block, beside the templated one. Deliberate — policy.yml argues the two halves must not be required to match. | Fine, and now checked (§4). |

No hardcoded **port** blocks the second environment: every published port is now
a variable, and services reach each other by container name over the compose
network rather than by port.

---

## 4. The tunnel ingress, derived

Built in `micro-deploy/cloudflared/`. **Four files, generated by `gen.py`,
committed, and diffed by CI.**

**Nothing here is a hand-typed hostname list.** The registry already carries the
two booleans that split the 24 host surfaces into exactly the classes the
deployment needs — and they were added for an unrelated purpose (`adminOnly`
hides a surface from the product switcher):

```
operator = adminOnly            -> admin, foresight-admin, lantern, beacon   (4)
api      = !servesUi            -> nimbus, account, api, worlds-api, pay, vault (6)
public   = everything else      -> the bare apex + 13                        (14)
```

14 / 4 / 6 — the same counts the brief reached by hand, reproduced without a
list. A seventh product is a registry row and nothing else.

**Generated, not hand-written-and-checked** — the opposite of the decision made
for `estate-web.yml`, and the difference is the point: that file is an *argument*
(half of it is prose explaining why `pay` and `vault` cannot live on the API
host), and a generator would discard it. A cloudflared ingress is `hostname →
service` and carries no reasoning. So it is generated, the output is committed so
an operator can read what the tunnel will do without running Python, and
`gen.py --check` regenerates in memory and fails on any difference.

**How drift is caught** — four checks, all in CI:

1. `gen.py --check` — the committed config equals what the registry generates.
2. `gen.py --strict` — the output is *parsed*, and the last rule must be a
   catch-all. cloudflared **refuses to start** without one, so a template slip
   takes down the environment rather than mis-routing one host.
3. Cross-tunnel duplicates — Cloudflare binds a hostname to *one* tunnel, so a
   hostname in both files means whichever connector registered last wins. For an
   operator console that is the difference between Access being in front of it
   and not.
4. `gateway_port_agrees()` — the tunnel's origin port (`443 + offset`) must equal
   what `compose/testnet.env` binds. Two files, two notations, one number;
   a mismatch is a tunnel connecting to a closed port and 502ing everything.

Plus, in `surface-routes.py`, **check 5, new**: the CORS allowlist.

> `policy.yml`'s `cf-cors` block is **eighteen hand-written origins, and they are
> exactly `servesUi === true` in the registry**. Nothing checked it. Its own
> comments record it drifting **four times** — `mint` instead of `create`,
> `devportal` instead of `developers`, `network` and `foresight` missing, then
> emberkin/aetherholm/tessera/foresight-admin missing — every one found by a
> human noticing a broken page. And, in that file's own words, it *"fails closed
> and silently: the browser refuses the response and nothing server-side records
> that anything was refused."* That is the worst available failure shape. It is
> now checked in both directions.

### The operator and utility decision

**Utilities — Grafana, Prometheus, Tempo, Loki, Alertmanager — are not exposed
at all.** No tunnel, either environment.

The reason is about the software, not the tunnel: **four of the five have no
authentication whatsoever.** Not weak — none. Prometheus has no concept of a
user; Loki in single-binary mode has none; Tempo has none; Alertmanager has none.
Only Grafana has a login, and `.env.example` already says of it that *"only
reachable on loopback is not a password policy"*.

Behind a tunnel, Cloudflare Access would not be *a* gate, it would be the **only**
gate, and one application left in bypass is total rather than partial compromise:
Prometheus serves the estate's full topology — every service, every target, a map
of the box; Alertmanager's `/api/v2/silences` accepts a POST, so anyone reaching
it can silence every alert and then take their time; Loki holds whatever the
estate has ever accidentally logged.

They stay on `127.0.0.1`. An operator reaches them with `ssh -L` or Cloudflare
WARP in private-network mode, which routes IPs and never terminates HTTP on a
public hostname — putting the auth decision on a layer that has one. **The cost,
accepted:** `grafana.<apex>` is not a link you can send someone, and no dashboard
from a phone without WARP. The `runbooks/` are written against `docker` and
`psql` on the host, so the incident path does not depend on it.

**The four operator consoles get their own tunnel, with Cloudflare Access.**
Separate because a tunnel is a credential: one tunnel means one token whose
compromise reaches the consoles *and* the shop front. Exposed at all because an
operator console you cannot reach during an incident is a runbook you cannot
execute — and `beacon` is the estate's incident record and the fallback receiver
for every alert when `CF_PAGE_WEBHOOK_URL` is unset, so it is the surface most
needed exactly when the host is least healthy. Unlike the utilities, Access is
the *second* gate here: all four authenticate against Nimbus and check roles.

**`account` is not routed.** Nothing serves it; the registry row reserves the
hostname and says so, and `surface-routes.py` already declares it unrouted. It is
also the address every `Sign in` button *used* to point at — so a live-but-empty
`account.<apex>` is not merely useless, it is the exact shape a phishing page
wants to occupy.

**`pay` and `vault` are public**, which deserves stating because `vault` is the
custodial key service. They cannot be anywhere else: withdrawal and key-export
authorise against the *user's own* token — custody's export ceremony reads `amr`
and `auth_time` off it — so the caller is a first-party browser on `hub.<apex>`
and needs the app CORS allowlist that `api.<apex>` deliberately does not carry.
Their protection is the token, the allowlist, and the `/internal` refusal — not
obscurity.

**The `/internal` refusal is restored at the edge.** `README.md`, `policy.yml`
and `docker-compose.gateway.yml` all cited a rule in
`deploy/cloudflared/config.example.yml` "asserted by a CI job at ci.yml:155".
**Neither existed** — there was no `cloudflared/` directory and CI had one job.
That is `surface-routes.py`'s own check-4 defect (prose describing a control
nobody wrote) sitting one directory outside what check 4 reads. It is now the
first ingress rule in every generated config.

**Per environment: 24 routed hostnames** (20 public incl. `rpc`, 4 operator),
**6 deliberately unrouted** (`account` + 5 utilities) = the 30 the brief counted.

---

## 5. The chain, the seeds, and the part a tunnel cannot solve

**Cloudflare Tunnel is HTTP(S) only. Hearth P2P on 8646 is raw TCP** —
newline-delimited JSON, no dependencies (`hearth/MAP.md:823`) — **and will not
pass through it.** `rpc.<apex>` over the tunnel gives JSON-RPC and nothing else,
and a chain reachable only on JSON-RPC has no peers and is not a network.

The running seed publishes three ports on `0.0.0.0`: **8545** (eth-compatible
JSON-RPC — the one a wallet or exchange speaks), **8645** (Hearth's native REST
RPC), **8646** (P2P). Only 8545 belongs on the tunnel.

### Options for 8646

| Option | How | Trade-off |
|---|---|---|
| **Cloudflare Spectrum** | Proxies arbitrary TCP. | Arbitrary-port TCP is an **Enterprise** feature; the Pro/Business tiers cover only specific applications. Almost certainly not available at this budget — **unverified, no Cloudflare account.** |
| **Direct port-forward for 8646** | Forward 8646 on the router to the MicroServer. | Simplest and free. **Publishes the home IP address to the P2P layer permanently** — every peer records it, and it is a residential connection with a person behind it. Also exposes the box directly to the internet on one port, with the ISP's dynamic IP and DDoS posture as the only protection. |
| **A small VPS as public seed** (recommended) | A €5/month VPS runs a non-mining Hearth node with a public IP. The MicroServer's node connects **outbound** to it and never accepts inbound. | Costs money and is a second machine to run. **Keeps the home IP off the P2P layer entirely** — the VPS is what peers record, it is disposable, and it can be rebuilt from `genesis.json` and a peer list. Gives DDoS separation: an attack on the seed does not touch the estate. |

**Recommendation: the VPS, and not one of them — two.** One seed is a single
point of failure for peer discovery: when it dies, no new node can find the
network, and the chain does not stop but stops being *joinable*, which is
indistinguishable from dead to anyone arriving. Two seeds in different providers
or regions is the smallest configuration that is not a coin flip. They are cheap
and stateless-ish; the chain data can be resynced.

**How seed addresses get published.** `micro-network-site` is the natural home —
it already serves `network.<apex>` and the faucet, and the org page already
promises that platform miner addresses are disclosed, so a `SEEDS` list beside
that is consistent rather than new policy. It must be **derived, not typed**:
this document's entire thesis is that a second hand-maintained copy of a network
fact drifts. A seed list in the site's content module, checked against what the
node actually reports on `/info`, is the shape.

**Genesis.** Chain IDs are already fixed and asserted in the node's own tests:
`hearth` = **7411**, `hearth-testnet` = **7412** (`node/src/params.js:37-38`), and
`node/test/cli.js:1001` asserts genesis carries 7411. `params.js` states the
reason directly: *"If both networks declare 7411 then every testnet transaction
is replayable on mainnet"* — the EIP-155 replay domain. **Mainnet genesis has not
been created**, and creating it is a one-way action: it fixes the premine, the
commons address and the chain's identity forever. It should be done deliberately,
witnessed, and backed up before a single block is mined on top of it.

**Confirmation depth is already decided and is 60** for EMBER
(`contracts/packages/chain/src/index.ts`), ~15 minutes at a 15-second block time,
with a `reorgAlarmDepth` of 5. The comment explains it: Hearth is a young CPU-mined
chain with no finality gadget, and depth is the only defence available. **This is
the number that makes §6 load-bearing** — 60 confirmations requires 60 blocks,
and 60 blocks require somebody mining.

---

## 6. The mining question — unresolved, and for the owner

**Not decided here.** It is the one decision in this document that is a business
decision rather than an engineering one, and it is load-bearing.

**The facts.**

- Hearth is **proof-of-work**. No miner, no blocks.
- The MicroServer **will not mine** — that is the brief.
- Today, two miner containers on the laptop produce every testnet block, at
  **~1.07 cores each**. When the laptop stops, the chain stops.
- **The ledger's solvency reconciliation depends on the chain advancing.** It
  compares the ledger's total against the indexer's *confirmed on-chain* total.
  When no reading can be obtained it records `observed_source = 'unavailable'`
  with a NULL observed total and `status = 'failed'` — **which freezes
  withdrawals for that asset** (`ledger/src/reconcile.ts:2-44`). Before migration
  11 it could *never unfreeze*. The file's own words: a network fault here *"looks
  exactly like insolvency"*. That loop froze EMBER twice today, and was right both
  times.
- Deposits need **60 confirmations**. At a 15s block time that is 15 minutes —
  but only if blocks are being produced at all. With no miner it is never.

**So: a public testnet with nobody mining is dead the moment the laptop stops,
and it does not fail quietly — it freezes the money path and pages.**

**The options, with what each costs:**

1. **Mine on the MicroServer after all.** Contradicts the brief. One miner ≈ 1
   core of the 4, permanently, on a box already at ~1.3 idle. Cheapest in money,
   most expensive in the thing that is scarcest.
2. **Mine on the VPS seeds** (§5). They exist anyway. A cheap VPS mining at low
   throttle keeps both chains advancing. Costs a little more VPS, and means the
   platform is the majority of its own hash rate — which is a **centralisation
   claim that has to be disclosed**, and the org page's existing promise about
   disclosing platform miner addresses is the precedent for how.
3. **Keep mining on the laptop.** Works today, and makes the public network
   depend on a personal machine being awake. Not a public network.
4. **Recruit external miners before launch.** The only answer that makes it a
   real network. Also the slowest, and it cannot be scheduled.
5. **Launch testnet only, and do not create mainnet genesis yet.** Reduces the
   stakes: a testnet that stalls is embarrassing, a mainnet that stalls with real
   value in it is not recoverable by apology. **This is the safest sequencing**
   and it is compatible with 1, 2 and 4.
6. **Change the consensus.** A proof-of-authority testnet needs no hash rate and
   no external miners. It is a real code change in `hearth` and a change to what
   the chain *is*.

**A question worth answering before choosing:** what should the reconciliation
loop do when the chain is *known* to be idle rather than unreachable? Today those
are the same state and both freeze. If the answer is "a stalled chain is not an
insolvency signal", that is a change in `ledger` and it makes options 3 and 5
much less dangerous.

---

## 7. Go-live checklist

**Gated on the release gate. It currently refuses.** Beacon is the gate (AD-04);
conformance has never run, journeys skip, and SEV2s are open — another agent is
working exactly that, and one of its fixes is in `deploy`'s working tree as this
is written.

**The gate's contents are deliberately not restated here.** Copying them would
create the fifth hand-maintained duplicate of a derivable fact, which is the
defect this whole document is organised around. `GET /v1/gate` on beacon is the
authority.

> Measured 2026-08-04: the **running** beacon 404s `/v1/gate` — the route exists
> in source (`beacon/src/*.ts`) but the deployed image predates it. Re-deploy
> beacon before treating any gate response as meaningful.

### Blocking — nothing proceeds until all are true

- [ ] `GET /v1/gate` on beacon returns a pass. **Not** a hand-read summary.
- [ ] `beacon smoke` 17/17 and estate status `operational`, on the MicroServer.
- [ ] Conformance has actually run at least once, with its result recorded.
- [ ] No open SEV2.
- [ ] No skipped critical journey.

### Hardware and host

- [ ] Gen10 **Plus or later — 4 cores minimum**. 2 cores is below floor (§1).
- [ ] 32 GB ECC.
- [ ] **SSD**, not the bundled spinning disks.
- [ ] A load test. Every figure in §1 is idle and none predicts behaviour under users.
- [ ] Backups: `custody-keys` and both Postgres volumes, restore **tested**, not configured. `docker compose down -v` destroys custody seeds and makes every derived address permanently unspendable.

### The two environments

- [ ] `docker compose config` renders both projects; ports disjoint (CI asserts).
- [ ] Both up simultaneously, **each with its own Postgres**, on the real box.
- [ ] `custody-keys` volumes confirmed distinct between projects.
- [x] Browse `testnet.cloudsforge.online` and confirm every sibling link stays on
      testnet. The apex and all 16 testnet UI surfaces returned 200 on
      2026-08-05, under the **single-label** scheme of §0
      (`<surface>-testnet.cloudsforge.online`). The link-derivation half — that a
      sibling link from a testnet page never resolves to mainnet — is enforced by
      `splitEnvLabel()`/`envLabel()` (`ui/packages/ui/src/surfaces.ts:1059-1078`)
      and has not been re-walked click-by-click in a browser since the scheme
      changed.

### Cloudflare

- [ ] DNS for `cloudsforge.online`; `testnet` delegated.
- [ ] Four tunnels created; `tunnel:`/`credentials-file:` filled in — the only
      two undelivered values in the generated configs.
- [ ] `cloudflared ingress validate` on all four. **Never run** (§8).
- [ ] **An Access policy per operator hostname, verified by hand, one at a time.**
      Nothing in the repository creates these. A hostname routed without its
      policy is an operator console on the open internet behind only its own login.
- [ ] Confirm no utility hostname resolves anywhere.
- [ ] `curl` `/internal` on `pay.<apex>` → 404 from the edge.
- [ ] Cross-origin preflight from `hub.<apex>` to `pay` and `vault` echoes the allowlist.

### Chain

- [ ] Mainnet genesis created deliberately, witnessed, backed up **before** any block.
- [x] Chain IDs confirmed distinct on the wire: 7411 / 7412. Done 2026-08-05 —
      `eth_chainId` returned `0x1cf3` from `https://rpc.cloudsforge.online` and
      `0x1cf4` from `https://rpc-testnet.cloudsforge.online`, both over the
      public internet.
- [ ] ≥2 seeds, different providers, both reachable on 8646 from outside.
- [ ] Seed addresses published on `network.<apex>`, derived not typed.
- [x] `rpc.<apex>` answers `eth_chainId` with the right chain, per environment.
      Done 2026-08-05. Note the hostname per §0: testnet's RPC is
      `rpc-testnet.cloudsforge.online`, not `rpc.testnet.cloudsforge.online`.
- [ ] **§6 answered.** Do not launch mainnet without an answer.
- [x] Fix `contracts/packages/chain/src/index.ts:127-128` — testnet explorer links point at mainnet.
      Done 2026-08-04 (`contracts` 326de9d). The table is now built by `explorers()`, which makes two
      equal non-null URLs a compile error rather than a value to be re-checked. That guard found a
      third instance nobody had reported: SOL had the same defect, and its testnet is now `null`,
      because Solana explorers select cluster by query string and no link beats a wrong-cluster link.
- [x] Decide the RPC hostname and reconcile `wallet-extension`, which expects `rpc.hearth.cloudsforge.online`.
      Done 2026-08-04 (`wallet-extension` 34912bd). The hostname is `rpc.<apex>`; both hosts per network
      now derive from one `APEX` constant. The dead three-label host was also in `host_permissions` in
      both manifests, which under MV3 blocked the fetch in-browser — so a fresh install defaulted to a
      node on the user's own machine.

### After

- [ ] `env` label separating the two environments in Prometheus, before merged metrics reach a reconciliation alarm.
- [ ] Alert delivery configured (`CF_PAGE_WEBHOOK_URL`), or accept the Beacon fallback knowingly.
- [ ] `CF_GRAFANA_ADMIN_PASSWORD` and `CF_BEACON_TOKEN` set. The Beacon scrape 401s until the token matches on both sides.

---

## 8. What could not be verified

Stated plainly, because a plan that hides its assumptions is worse than one that
names them.

**No hardware.** There is no Gen10. Every footprint figure is from a MacBook with
11.65 GiB visible to Docker, and **all of it is idle** — no load test was run.
The CPU figures in particular are a floor.

**No Cloudflare account.** Nothing here has touched Cloudflare. Not verified:
that Spectrum is Enterprise-only for arbitrary TCP (§5 says "almost certainly"
because that is the honest confidence); that Access behaves as described; that
four tunnels on one host is within plan limits; any pricing.

**The generated configs have never been parsed or run.** This machine has
neither PyYAML nor a `cloudflared` binary. `gen.py --strict` parses the output
and asserts the catch-all rule, and **CI runs it** — but it has not run here, and
`cloudflared ingress validate` has not run anywhere.

**The testnet apex has never been served.** The claim that `testnet.` needs no
code change was verified by *executing the real derivation* against the real
registry module for both the bare apex and a subdomain — not by loading a page at
`testnet.cloudsforge.online`, which does not exist.

> **No longer true, 2026-08-05 (§0).** `testnet.cloudsforge.online` was fetched
> over the public internet and returned 200, as did all 16 testnet UI surfaces
> under their **single-label** names (`<surface>-testnet.cloudsforge.online`).
> The two-label form this paragraph was written about is the one that does not
> exist.

**Neither compose project has been started.** Both were rendered with `docker
compose config` and the ports proved disjoint; nothing was brought up. The live
estate was deliberately not disturbed — only read-only docker commands were run,
and it stands at 48 + 7 + 3 containers.

**Disk was not measured at all.** No image sizes, no volume sizes, no growth
rate, no IOPS. This is the largest gap in §1 and the one most likely to produce
a surprise.

**The release gate was not evaluated.** `/v1/gate` 404s on the running beacon
because the deployed image predates the route. Its state is asserted from the
brief and from another agent's in-flight work, not measured.
