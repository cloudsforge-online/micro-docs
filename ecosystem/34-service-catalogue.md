# 34 — Service catalogue

## What this is

Written 2026-08-07. This is the estate's reference answer to one question: *what is every
repository, what does it do, and is it deployed?*

**This is a plan, not a ledger.** [18-build-status.md](18-build-status.md) is the ledger — it
records what landed and when, and it is the file to trust when the two disagree about doneness.
This document describes the shape of the estate rather than its progress: what each repository is
*for*, what it exposes, and where it sits on 2026-08-07.

It was produced by studying all 66 repositories, one agent per repository, and then adversarially
verifying every finding — re-reading the cited line, or re-issuing the cited HTTP request, before
it was allowed into this file. That is the confidence level to read it at: every file:line here
was opened, and every HTTP response was measured on 2026-08-07 rather than inferred from
configuration. Where a finding could not be verified, it is stated as unknown rather than smoothed
over.

Three limits are worth stating up front. First, a measurement is a measurement of one moment; a
hostname that answered 200 today is not a claim about tomorrow. Second, "deployed" in the tables
below means *a container exists in the estate compose and the estate is running it* — it does not
mean publicly reachable, and several services are deliberately loopback-only. Third, several
sibling documents cited here contain rows that are now stale; where that is known, it is said in
place rather than corrected silently in the other file.

---

## 1. The estate, and the five planes

CloudsForge is a polyrepo. Each top-level directory under the estate root is its own git
repository in the GitHub organisation `cloudsforge-online`, named `micro-<dir>` — with one
exception, `hearth`, which is `cloudsforge-online/hearth` because it is the chain rather than a
micro-service.

There are 69 directories under the estate root, counted 2026-08-09. One of them,
`kindred-upstream`, is not a CloudsForge repository at all: its remote is
`github.com/savvaniss/kindred-resonance`, and it is a frozen ancestor kept for the behavioural port
that produced `emberkin`. That leaves **68 CloudsForge repositories**, and they partition cleanly
into five planes:

| Plane | Repositories | What it owns |
| --- | --- | --- |
| Money, chain and markets | 18 | The chain, the keys, the value, and every surface that asks for money |
| Identity, platform and developer | 15 | Who you are, what you may do, what happened, and the shared substrate |
| Worlds, games and content | 6 | The title spine, four game services, and the image origin |
| Frontends, design system and brand | 25 | Eighteen browser bundles, two spines, five asset repositories |
| Deployment, operations and documentation | 4 | The compose topology, the watchers, and the memory |

Two of those 68 arrived after the sweep this document was written from, and are the only entries
below that sweep did not produce: `pool` and `pool-web`, added to `org/tools/registry.ts` by
micro-org#282, merged 2026-08-09. Both are described from their source and their own test suites
rather than from a live HTTP measurement, because neither is running — §2.5 says why, and the
`pool-web` row in §5 says the same for its console.

Read that at the right confidence, because it is weaker than every other entry here in a way worth
naming. Only the *registry rows* merged. The code of both repositories sits on an open pull request
— micro-pool#1 and micro-pool-web#1, both open on 2026-08-09 — so `main` in each is still the empty
repository it was initialised as, and everything §2.5 and the `pool-web` row describe was read from
a branch. A branch is a claim about what will merge.

The estate is live. Mainnet surfaces answer at `<surface>.cloudsforge.online` (chain 7411),
testnet at `<surface>-testnet.cloudsforge.online` (chain 7412), with apexes at
`cloudsforge.online` and `testnet.cloudsforge.online`. The earlier two-label
`<surface>.testnet.cloudsforge.online` scheme is dead — Cloudflare's Universal SSL does not cover
a two-label wildcard, and the paid certificate that would was refused (18-build-status.md §0).
The registry of every hostname is one file, `ui/packages/ui/src/surfaces.ts`, which carries 29
`subdomain:` rows and is read by deploy scripts to check the gateway rather than by humans to
remember. That count is `SURFACES.length` evaluated on 2026-08-09, not a grep: a grep for
`subdomain:` in that file answers 34, because it also finds the field's own type declaration and the
two label helpers at the bottom. The 33 this document previously carried was the grep, one row ago.

---

## 2. Money, chain and markets

Eighteen repositories. This plane is a deliberate separation of powers, and the separation is the
design. Hearth is the base: a from-scratch proof-of-work L1 running mainnet 7411 and testnet 7412,
whose only issuance is a mined block, and whose `eth_*` RPC every other repository here speaks.
`micro-indexer` is the single reader of that chain (and of Litecoin) — it replaced balance-probing
outright, so nobody else is allowed to ask a node what an address holds. `micro-custody` is the
single holder of private keys; it derives, seals and signs, and refuses before it decrypts.
`micro-ledger` is the single holder of value: double-entry, immutable by trigger and by `REVOKE`,
with no user principal able to reach it at all.

Everything else in the plane is an orchestrator that owns state but not money. `micro-wallet` is
the user's money API and owns no balance column — a test fails the build if one appears.
`micro-settlement` turns `wallet.withdrawal.requested` into signed, broadcast,
confirmation-tracked bytes and holds one in-flight transaction per chain by partial unique index.
`micro-billing` prices in USD cents and settles in EMBER, answering "does this subject own this"
for the rest of the estate. `micro-pricing` is the oracle joining the two. `micro-market`,
`micro-mint`, `micro-trade` and `micro-foresight` are the four demand surfaces — listings, token
launches, bots, parimutuel markets — each of which records intent while the ledger records value.
`micro-faucet` is testnet's on-ramp. `micro-pool` is the newest and the only one whose users bring
hardware rather than a browser: a Stratum v1 mining pool for the Bitcoin-family chains the estate
already runs nodes for, which records what a miner is owed and — deliberately, and stated in its own
first screen — pays nobody. The three self-custody shells (desktop, extension, mobile) and their
shared `hearth-wallet-core` sit deliberately outside all of it: same chain, no CloudsForge service
on any path.

What genuinely works is more than it looks. The invariants are in Postgres, not in handlers:
`orders_one_settlement_artefact = 1`, `tokens_paid_before_broadcast`, `outbound_in_flight_uniq`,
`prices_no_new_shard`, `fee_settlements_bot_period_uniq`, and custody's treasury foreign key
pinned to `purpose='treasury'`. Both chains are advancing and the indexer is at lag 0 on both plus
real Litecoin mainnet. Foresight's payout arithmetic is proven against executed committed
bytecode. Pricing serves four-source medians live. The plane has repeatedly gone looking for the
estate's signature defect — a client calling a route its server does not serve — and in twelve
dossiers not one instance survives.

The real seams are all in the connective tissue rather than in any service. Four producers here
still sign the retired `x-cloudsforge-signature: sha256=` scheme that their intended consumers now
reject by test, so those edges would fail even after being wired. The subscription table that
carries the bus has four money-plane rows; every other topic is published into nothing, while
`notify` holds finished rules for twenty-two of them. Litecoin has a complete ingress and a
structurally impossible egress. Every USD-denominated sale in the plane converts through a single
administered EMBER price that no deployed caller can update and that the staleness rule
deliberately exempts. And underneath all of it, no economic activity has ever originated:
foresight pools read zero, market's browse page is empty because activation would require an
unbacked liability, faucet's funding address holds nothing, billing's `/purchases` has no caller.
The machinery is real and the invariants would hold; what has never been demonstrated is money
moving through it.

| Repo | What it is for | What it exposes | Deployed? |
| --- | --- | --- | --- |
| `hearth` | The PoW L1 the estate is denominated in; EMBER, zero premine | 41 `eth_*` JSON-RPC methods on 8545, legacy REST/SSE on 8645, P2P on 8646/8648; `hearthd`, `hearth-mine`, `hearth-cli` | Yes — mainnet 7411 and testnet 7412, `rpc.` and `rpc-testnet.` public |
| `indexer` | The single reader of chain state; replaced balance-probing (AD-07) | 10 domain routes under `/v1` and bare, plus `/livez` `/readyz` `/metrics`; emits `indexer.deposit.confirmed` | Yes — public at `explorer.<apex>/v1` |
| `custody` | The single holder of private keys; derive, seal, sign, refuse | 22 routes: addresses, keys, treasuries, `/v1/sign`, the export ceremony, admin | Yes — loopback 4107, browser-reachable on `vault.<apex>` |
| `ledger` | The single holder of value; double-entry, service-principals only | 13 unversioned routes: entries, reservations, balances, trial balance, reconciliation | Yes — internal only, no hostname |
| `wallet` | The user's money API; owns no balance column | 22 routes: wallets, deposits, withdrawals, spend, transfers, conversions, portfolio | Yes — public on `api.<apex>/v1` and `pay.<apex>` |
| `settlement` | Money out: build, sign via custody, broadcast, track confirmations | 12 routes: fee quotes, outbound state, in-flight, adjudicate, treasuries, sweep sources | Yes — loopback 4104, no gateway route |
| `billing` | Catalogue, purchase, entitlement; prices USD, settles EMBER | 10 routes: products, purchases, entitlements, subscriptions, event inbox | Yes — internal only |
| `pricing` | The USD price oracle; four-source median, fails closed on staleness | 8 routes: `/rates`, `/rates/:asset`, administered prices, history | Yes — public on `api.<apex>/v1/rates` |
| `market` | Listings, auctions, bids, offers, orders, disputes, moderation | 33 routes under `/v1` | Yes — public on `market.<apex>/v1` and `api.<apex>` |
| `mint` | ForgeMint: token orders, payment, background deploy, project pages | 12 routes: catalogue, tokens, pay, deploy, page, event inbox | Yes — public on `create.<apex>` and `api.<apex>` |
| `trade` | Strategy catalogue, deterministic backtests, paper and live bots | 14 routes: strategies, capabilities, series, backtests, bots, event inbox | Yes — public on `trade.<apex>/v1` |
| `foresight` | Hearth-native parimutuel markets; never custodies stake | 29 unversioned routes: markets, stakes, ideas, resolution, images | Yes — public on `foresight.<apex>` and `api.<apex>` |
| `faucet` | Testnet EMBER on-ramp; testnet-only in the type system | 6 routes: terms, drips, poll, CORS preflight | Yes — testnet only, served at `network-testnet.<apex>/faucet` |
| `pool` | Stratum v1 mining pool for BTC and LTC; records a PPLNS debt, credits nobody | 7 anonymous HTTP routes (`/v1/pool`, `/blocks`, `/workers`, `/shares`, plus the three probes) and a raw-TCP stratum listener | No — behind compose profile `pool`, and refuses to start without a fee and a payout address |
| `hearth-wallet-core` | The one signing core for the three self-custody shells | One package, ~130 exports: BIP-39/32/44, secp256k1, keccak, RLP, EIP-155/1559/712, keystore | No — library, unpublished |
| `wallet-desktop` | Tauri self-custody wallet that bundles a Hearth node | 7 in-app views; Rust commands for node start/stop/logs/provenance | No — builds `.dmg`/`.msi`/`.deb` in CI, nothing released |
| `wallet-extension` | MV3 self-custody wallet, Chrome and Firefox from one source | 3 pages, 8 popup tabs, EIP-1193 + EIP-6963 dapp surface | No — not published to any store |
| `wallet-mobile` | React Native self-custody wallet; biometrics perform the decrypt | 9 hand-routed screens, `hearthwallet://proof` deep link | No — neither binary signed for distribution |

### 2.1 `hearth` — the chain

**Purpose.** The settlement layer the whole estate is denominated in: an EVM-equivalent
proof-of-work L1 built from scratch, native coin EMBER. Its thesis is fair distribution — zero
premine, zero genesis supply, CPU-mineable, issuance only via a mined block.

**Surface.** `node/` is the network and the only consensus implementation: `node/src/evm/`
(interpreter, gas, opcodes, precompiles 0x01–0x09 including bn128 and blake2f),
`node/src/state/` (Merkle-Patricia trie and StateDB), `node/src/chain/` (blocks, transactions,
receipts, state transition, LWMA retarget), `node/src/jsonrpc/` (41 `eth_*` methods, mounted by
`node/src/evmnode.js` on 8545), `node/src/rpc.js` (legacy UTXO REST and SSE on 8645, including
`/mining/template`), `node/src/p2p.js` (newline-delimited JSON over TCP 8646 and WebSocket 8648).
Binaries are `hearthd`, `hearth-mine`, `hearth-cli` and `hearth`. `contracts/` holds WEMBER,
Uniswap V2 and Multicall3, exercised by `node/test/dex.js`. `tools/` is the developer kit —
faucet, an Etherscan-shim explorer API, a `forge verify-contract`-compatible verifier, Hardhat and
Foundry templates, an RPC probe.

**Invariants.** One consensus implementation, in `node/`. `rust/hearthd` is a self-check and
benchmark and is explicitly *not* a node — `rust/README.md` names two modules, `pow.rs` and
`difficulty.rs`, that would give wrong answers if wired up. `proto/` is teaching scripts and is
imported by nothing.

**Deployed state.** Serving. The seed is
`deploy/compose/docker-compose.hearth-seed.yml`, overlaying `hearth/docker-compose.testnet.yml`
as container `cf-hearth-seed`, ports narrowed to 127.0.0.1 and 172.17.0.1. Mining runs as light
HTTP miners, `deploy/compose/docker-compose.miners.yml:80-135`, against the public RPC through the
Cloudflare tunnel with keys bind-mounted from `${CF_MINER_KEYS}`; the seed's own two miner
services are deliberately not started, because the compose comment records that they took a
four-core host to load average 37. Measured 2026-08-07: `eth_chainId` returns `0x1cf3` on
`https://rpc.cloudsforge.online` and `0x1cf4` on `https://rpc-testnet.cloudsforge.online`;
`p2p.cloudsforge.online/p2p` and its testnet twin both answer 426 Upgrade Required. `net_peerCount`
returns `0x0` on **both** chains — no second full node has ever connected to either.

### 2.2 `ledger` — the single holder of value

**Purpose.** Double-entry financial truth: accounts, journal entries, postings, a rebuildable
balances projection, reservations, and the reconciliation run that freezes withdrawals when the
ledger's claim and the chain's reading disagree.

**Surface.** 13 routes, all registered via `define(...)` in `ledger/src/server.ts:389-594`, none
path-versioned. `GET /livez` (:389), `/readyz` (:391), `/metrics` (:396) are the only three that
make no `authorise()` call. Then `POST /entries` (:411, `ledger:post`), `GET /entries` (:437),
`GET /entries/:id` (:455), `POST /entries/:id/reverse` (:462), `POST /reservations` (:499,
`ledger:reserve`), `POST /reservations/:id/release` (:537), `GET /accounts/:subject/balances`
(:565), `GET /trial-balance` (:579), `GET /reconciliation` (:594).

**Invariants.** `authorise()` refuses every non-service principal, so no user token can reach it
at all — wallet, market, mint, trade, tessera, billing, settlement, worlds, community, emberkin,
foresight and admin-api are the only writers. Idempotency is a **body field**
(`idempotencyKey`), never a header. Immutability is enforced by trigger and by `REVOKE`, not by
handler discipline. Four leased recurring jobs in `src/jobs.ts` — `outbox.relay`,
`ledger.reconcile`, `ledger.balances.rebuild`, `ledger.idempotency.reap` — and no timers. Two
events, `ledger.entry.posted` and `ledger.reconciliation.completed`, both `audited: true` in
`contracts/packages/events/src/audit.ts:138-140`.

**Deployed state.** Running, internal only. `deploy/compose/docker-compose.estate.yml:959`
(`ledger-migrate`) and `:973` (`ledger`), with `LEDGER_RECONCILE_ASSETS: "SHARD,EMBER"` and
`INDEXER_URL: http://indexer:4000` (:1082). It has no public hostname: `ledger.cloudsforge.online`
and `ledger-testnet.cloudsforge.online` both fail DNS resolution, which is the correct state —
18-build-status.md:469 records that nothing in ledger is third-party reachable.

### 2.3 `custody` — the single holder of keys

**Purpose.** Every private key the platform custodies. It derives BIP-39/32/44 per
`(user, family)`, encrypts AES-256-GCM under a versioned master-secret keyring, and enforces the
signing policy: a purpose gate, a five-field binding check, chain-id resolution, a vault-chosen
treasury pin, and only then a decrypt. It also runs the user-facing export ceremony that replaced
the deleted admin reveal route.

**Surface.** 22 routes, declared as data in `buildRoutes()` and republished by `routeTable()`
(`custody/src/server.ts:312`) so the body scan cannot drift from them. `POST /v1/addresses` (:348),
`GET /v1/addresses/:address` (:400 — publishes neither `userId` nor `orderId`, deliberately, or
the `/sign` binding check would be circular), `GET /v1/treasuries/:chain/:network` (:438),
`POST /v1/sign` (:510, scope `custody:sign:<row purpose>` from `signScopeFor` in `gates.ts:258`),
the owner-only export ceremony (:560–:640), and the admin block (:670–:820).
`POST /admin/keys/:address/reveal` is deleted and answers 404.

**Invariants.** It makes exactly one outbound call, to policy. The treasury foreign key is pinned
to `purpose='treasury'` in the schema. The keyring and outbox secrets arrive by `env_file` and
never by `environment:` — the compose file states that `environment:` wins over `env_file:`, so
reinstating a line there would silently revive the placeholder. `pnpm reencrypt` exits non-zero
while blobs remain, so it works as a deploy gate.

**Deployed state.** Running. `deploy/compose/docker-compose.estate.yml:1597` (`custody`), `:1577`
(`custody-migrate`), `:1565` (`custody-keys-init`, a root busybox that chowns the named volume to
1000:1000 and chmods 700). Bound loopback-only at 4107 (:1639) and reached from the browser
through the gateway on `vault.<apex>`; `deploy/scripts/estate-verify.sh:2097` asserts that
`https://vault<suffix>/v1/exports` is not 404 and that hub's origin is CORS-allowed. Measured
2026-08-07: 200/401 on both mainnet and testnet hostnames.

### 2.4 `indexer` — the single reader of the chain

**Purpose.** Follows EVM (Ember), Bitcoin-family (LTC) and Solana chains into one normalised
schema with checkpointing, reorg recovery and provider failover. It exists to make AD-07 true:
nobody else probes a node for a balance.

**Surface.** The route table is the module-level `DOMAIN` constant at
`indexer/src/server.ts:163-174`, mounted under both `/v1` and bare (`PREFIXES = ['/v1','']`,
:144), and exported as `ROUTE_PATTERNS` (:182). Ten domain routes cover chain status, address
activity and token balances, transactions and confirmations, token metadata, the custody
aggregate, blocks by height, watch registration and backfills. Three operational routes —
`/livez`, `/readyz`, `/metrics` — are registered separately at :382-402 and are unprefixed, so
`/v1/livez` is a 404 (measured).

**Invariants.** Reads are anonymous — `authoriseRead` returns null with no bearer. `POST /watch`
and `POST /backfills` need `indexer:write` or admin. `GET /custody/.../total` is the single read
that demands a bearer, measured 401 at
`https://explorer.cloudsforge.online/v1/custody/ember/mainnet/total`.

**Deployed state.** Running on both estates.
`deploy/compose/docker-compose.estate.yml:1428-1470`; the former `profiles: [indexer]` gate was
removed with the reason recorded at :1388-1412. Chain configuration is in
`deploy/compose/env/chain.mainnet.env` (`INDEXER_CHAINS=ember:mainnet,ltc:mainnet`) and
`chain.testnet.env` (`ember:testnet`). Publicly routed at `explorer.<apex>` under a
`PathPrefix('/v1')` router with no rewrite (`deploy/gateway/dynamic/estate-web.yml:424-429`).
Measured: 200 on mainnet, testnet and LTC status; `/metrics` and `/readyz` 404 through the
gateway, so the unauthenticated metrics endpoint is in-network only.

### 2.5 `pool` — the mining pool that records a debt and pays nobody

**Purpose.** A Stratum v1 mining pool for the Bitcoin-family chains the estate already runs its own
nodes for, implementing §5 of
[36-multi-chain-and-mining-pool.md](36-multi-chain-and-mining-pool.md). It builds block templates
with `getblocktemplate`, hands work to real hardware over raw TCP, judges the shares that come back
against a per-connection target, submits the blocks, and records who is owed what under PPLNS. The
last clause is the whole boundary: **it records a debt and it does not pay one.** `pool/src/payouts.ts`
is a named, typed seam that throws, there is no payouts table in the schema, `/v1/pool` carries
`payoutsImplemented: false` as a response field rather than a README sentence, and the boot log line
says the same thing on every boot. That is the estate's usual posture — a named hole rather than a
plausible screen — applied to the one product where the alternative would be a service that appears
to pay.

**Surface.** Two listeners, and they are deliberately not alike.

The HTTP surface is seven routes in one `buildRoutes()` table in `pool/src/server.ts`: `/livez`,
`/readyz`, `/metrics`, and `GET /v1/pool`, `/v1/pool/blocks`, `/v1/pool/workers`,
`/v1/pool/shares`. There is no POST, PUT or DELETE anywhere on that port, and no bearer token on any
route — `pool/src/env.ts` declares no `IDENTITY_JWKS_URL` and says why: the only identity a miner
has here is the stratum username they typed into their own firmware, and 36 §6 makes a miner's
ability to check their own share history a product requirement. So `account` is a query parameter
rather than an authenticated subject, anybody may read anybody's shares, and every list clamps its
`limit` rather than trusting it. `/v1/pool/shares` returns the job id, the difficulty a share was
credited at *and* the difficulty it actually achieved, which is what makes it reconcilable line for
line against a miner's own log; a count would be checkable against nothing.

The mining surface is plain TCP, newline-delimited JSON-RPC, on its own port — 3334 for LTC and 3333
for BTC by default. `pool/src/stratum.ts` owns the socket and the framing (a line cap, a handshake
timeout, a write-buffer ceiling, because each of those is otherwise free for an attacker) and
`pool/src/session.ts` owns the per-connection state machine with no socket in it. Behind them:
`template.ts` polls `getblocktemplate` with longpoll where the node offers it, `coinbase.ts`,
`merkle.ts` and `bytes.ts` assemble the block, `mweb.ts` handles Litecoin's HogEx — the MimbleWimble
integrating transaction that must be the final transaction or the node cannot deserialise the block
at all, and which is detected by parsing rather than by trusting template order — `pow.ts` dispatches
SHA-256d for BTC and scrypt for LTC, `validate.ts` reconstructs the header and returns one of three
verdicts with the numeric error code miner firmware prints, `vardiff.ts` retargets each connection,
`pplns.ts` does the accounting and `blocks.ts` the seconds after a share turns out to be a block.
The schema is two migrations and three tables — `pool_workers`, `pool_shares`, `pool_blocks` —
and one leased job, `pool.prune-shares`, keyed on `chain:<chain>` because the contended resource is
one chain's share table.

**Invariants.** Every difficulty is stored as an integer `difficulty × 10^8` bigint and never as a
float, because share weights are summed over hundreds of thousands of rows to divide a block reward
and `double precision` sums are not associative; the PPLNS split is largest-remainder, so the parts
sum to exactly the amount being allocated. `POOL_FEE_BASIS_POINTS` is required with **no default
anywhere in the repository** — `env.ts` gives it its own `requiredInteger` helper, used for nothing
else — because 36 §7.1 records that the fee has not been chosen, and a default would answer an open
product question by omission. DOGE, ETC and EMBER are refused *by name* in `REFUSED_CHAINS` rather
than merely absent, each with its reason, so that adding a row cannot look like a one-line change:
Dogecoin is merge-mined under AuxPoW and ordinary scrypt work against it would validate perfectly
against the pool's own target and produce a block the network discards. Stratum ports open only
after each chain has checked the node's reported network, had the node validate the payout address,
and fetched one template — and on the way down they close first. A node that answers wrongly is
fatal; a node that does not answer is retried, because those are different faults. A found block is
submitted before anything is written and then recorded synchronously, including the node's rejection
string verbatim; ordinary shares are buffered and flushed on a timer, and the cost of that — a hard
kill loses up to one flush interval — is stated in the file rather than hidden. `poolPayoutCreditKey`
is written and tested now, called by nothing, so that whoever implements crediting cannot invent a
second idempotency key alongside the one `wallet/src/deposits.ts` already established.

**Deployed state.** **Deployed on mainnet and serving two chains, measured 2026-08-11.** The
paragraph that follows is the 2026-08-09 record and is kept because its *reasoning* about what
blocked the deploy is still the reasoning; its status line is not. As at 2026-08-09 nothing on the
path was merged: the service's own code was micro-pool#1, its compose block was micro-deploy#15,
and both were open — so `micro-pool`'s `main` was an empty repository and the estate compose had no
pool in it at all. Even landed, the service sits behind `profiles: ["pool"]`, so a plain `up`
brings up no pool; bringing it up takes `COMPOSE_PROFILES=pool`. And two required values did not
exist yet, both decisions rather than oversights. `POOL_LTC_PAYOUT_ADDRESS` needed a
custody key with a `pool` purpose that custody did not have — micro-custody#4 was open and unmerged
— and the existing `treasury` purpose must not be borrowed, because a treasury-purpose key on
ltc/mainnet is a rotation candidate for settlement's pinned treasury and every block the pool had
mined to it would become unbooked custody inflow. `POOL_FEE_BASIS_POINTS` is the unmade product
decision above, and `requiredInteger` means the service exits at import without it. So does
`pool-migrate`, which imports the same eager `env.ts`, so the database was not created either. Both
of those are now answered, and the running service is the evidence rather than anything read here:
a micro-pool that answers `GET /v1/pool` at all is one that got past that eager `env.ts`.

`POOL_CHAINS` defaults to `ltc` alone, and that default was a measurement rather than a preference:
the compose block recorded litecoind synced and bitcoind still in initial block download on
2026-08-09, and `getblocktemplate` against a node in IBD returns work for a tip no other miner has
seen. That figure was read from the deploy branch, not taken here — this document did not touch the
host. **The measurement has since expired and the default has been overridden.** bitcoind finished
its initial block download on 2026-08-10; measured 2026-08-11 at height 961,975, difficulty
1.2748e14, mainnet has run `POOL_CHAINS=ltc,btc` since release 2026.08.16 and `GET /v1/pool` returns
both chains `ready: true`, ltc at height 3,157,960. **BTC is served to mining hardware and refused
to browsers, deliberately** ([micro-org#360](https://github.com/cloudsforge-online/micro-org/issues/360),
closed): it carries `browserMining: {available: false}` with the pool's own sentence for why, and
`websocketEndpoint: null`, because that difficulty is about 793 EH/s of purpose-built SHA-256
silicon and a browser tab cannot produce a share this pool could turn into a block. The refusal is
a property of the chain rather than of a deployment setting, which is why it travels as its own
field and not as a missing endpoint.

Stratum is raw TCP, so neither Traefik nor the Cloudflare Tunnel can carry it: the port is
published directly by the container and binds loopback unless an operator widens it on purpose, and
`pool.<apex>` will therefore serve the page that describes the connection and never the connection
itself.

The limit of the evidence here is worth stating, because it is unusually sharp. Its own suite ran
333 tests on 2026-08-09: 306 passed, 0 failed, 27 skipped — 24 in `store.test.ts` which need a real
Postgres (`POOL_TEST_DATABASE_URL`), and 3 in `regtest.test.ts` which need a real `litecoind` in
`-regtest` (`POOL_REGTEST_NODE_URL`). One of those three is "the pool mines a block a real litecoind
accepts". So what is green in a bare checkout is the arithmetic, the byte layout and the protocol
behaviour; the single assertion that this repository produces a block a node will take is among the
ones that did not run.

---

## 3. Identity, platform and developer

Fifteen repositories. This plane is the estate's spine: the things that decide who you are, what
you may do, what happened, and what a stranger is allowed to see. It has four layers, and they are
built to very different standards of completeness.

At the bottom sit the three non-deployed repositories that everything else is made of.
`contracts` publishes the frozen wire vocabulary — 61 topics, the scope registry, chain constants,
the one `cf-signature` HMAC implementation. `runtime` publishes the substrate seven packages deep
(Verifier, migrate, HttpClient, JobQueue, Lifecycle, secrets, telemetry), adopted by 30 sibling
repositories with no local copies left. `service-template` is the composition root that makes both
true on day one, and `org` is the registry that names every repository, derives every port and
runs the CI that proves it. This layer is genuinely excellent: 259 + 117 + 105 tests, invariants
pushed into the type system (`LiveScope = Exclude<Scope, DeprecatedScope>`), and cross-repository
checkers (`estate-scopes.mjs`, `estate-topics.mjs`, `contract-compat.yml`) that fail in the owning
repository rather than in the first consumer. Its one structural weakness is distribution: nothing
here can be published, because the npm scope `@cloudsforge` does not match the org
`cloudsforge-online` (18-build-status.md:346-352), so it reaches production as a copied build
context and consumers resolve it by two different pnpm protocols.

Above it, `identity` is the only signer and sits upstream of everything — 43 routes, JWKS, `cfsc_`
credential exchange for ten services, database-enforced role grants and refresh-family reuse
detection, live and measured on both chains. `policy` is the risk authority it feeds;
`devplatform` is its machine-facing twin, issuing revocable scrypt-hashed API keys with the
constraint work done in SQL. `activity`, `notify` and `analytics` are the three read-only
consumers of the signed event bus, each MAC-only on ingest after §3.3p, each with immutability
enforced by trigger rather than convention. `admin-api` is the operator authority — hash-chained
audit, two-eyes approvals, engagement caps — and `hub-api` is the user-facing BFF that composes
eleven tiles and owns no state at all. `community` is governance; `conformance` and `sdk` are the
outward-facing edges.

The seams are not in the code. They are in *deploy configuration and wiring*, and they repeat.
Four of these services — policy, notify, analytics, community — are deployed on loopback with no
gateway route and no upstream URL in `admin-api`'s environment, so their operator surfaces
(freezes, rules, deliveries, funnels, proposals) are served, tested and unreachable from any
console in the estate. Two more repeat the same shape one layer up: the event bus's subscription
rows are hand-typed in `estate-bootstrap.sh`, so `activity` sees 3 topics of the 61 it classifies
and `notify` 4 of roughly 40 — not because either is unfinished, but because one shell script is
the only place a subscription exists. And where the plane does connect end to end, the joins are
half-migrated: four producer relays still sign the pre-§3.3p header that `admin-api`'s audit
mirror cannot read, and the registration funnel identity opens has no reachable other end. The
recurring lesson is that this estate's repositories are far more finished than its wiring.

| Repo | What it is for | What it exposes | Deployed? |
| --- | --- | --- | --- |
| `identity` | Accounts, sessions, MFA, orgs, roles, machine credentials; the only signer | 43 unversioned routes incl. JWKS, `/auth/*`, `/service-tokens`, `/internal/users/:id/roles` | Yes — `nimbus.<apex>` and `api.<apex>/v1/auth` |
| `policy` | The single risk-decision authority; freezes, limits, velocity, holds | `POST /decisions`, rules, trusted addresses, freezes, `POST /v1/events` | Yes — loopback 4101, no gateway route |
| `devplatform` | Third-party credentials: orgs, projects, API keys, OAuth, webhooks, quotas | 38 routes under `/v1` plus `/internal/*` refused at the edge | Yes — `api.<apex>/v1` under seven prefixes |
| `admin-api` | Operator BFF: hash-chained audit, two-eyes approvals, flags, backups | 27 routes; scope vocabulary is exactly one entry, `admin:read` | Yes — `admin.<apex>/v1` |
| `hub-api` | The Forge Hub BFF; eleven tiles from seven upstreams, no database | 8 read-only routes; no POST/PUT/DELETE anywhere | Yes — `hub.<apex>/v1` |
| `activity` | One immutable row per user-visible fact; the canonical narrative | 6 routes: `/feed`, `/feed/:id`, `/ingest`, plus probes | Yes — `api.<apex>/v1/feed` |
| `notify` | Was this person told, on which channel, and did it arrive | 9 routes, each served under `/v1` and bare; `/ingest` is MAC-only | Yes — loopback 4110, no gateway route |
| `analytics` | Pseudonymised append-only product analytics; never a page tag (AD-21) | 11 routes: ingest, daily/active reports, funnels, cohorts, definitions | Yes — loopback 4121, no gateway route |
| `community` | Governance: communities, proposals, delegation, weighted voting, treasury | ~35 routes incl. `/internal/proposals/:id/execute` | Yes — loopback 4117, no gateway route |
| `contracts` | The frozen wire vocabulary two or more repos would otherwise copy | 5 packages: auth, chain, events, money, worlds | No — build context, unpublished |
| `runtime` | The shared service substrate; one PR instead of forty | 7 packages: auth, db, http, jobs, lifecycle, secrets, telemetry | No — build context, unpublishable |
| `service-template` | The canonical service skeleton that makes the ten rules of 03 §2 true | A runnable service plus a copy-source; `/v1/widgets` | No — exercised in CI only |
| `org` | The `.github` repository: registry, reusable workflows, `cfctl`, manifests | 6 reusable workflows, `tools/registry.ts` (70 rows), `tools/cfctl.ts` | No — not deployable by construction |
| `sdk` | The only public-facing artefact: typed client and read-only CLI | `@cloudsforge/sdk` (65 routes over 8 services), `@cloudsforge/cli` | No — unpublished; npm returns 404 |
| `conformance` | Characterisation corpus plus two estate-wide static sweeps | CLI: `record`, `compare`, `report`, `ledger-accounts`, `body-scan` | No — dev/CI tool by design |

### 3.1 `identity` — the only signer

**Purpose.** The account and credential authority. It owns users, profiles, passwords, sessions
and refresh-token families, MFA, devices, organisations, platform roles, machine credentials, and
the RS256 signing keys published at JWKS. Every other service verifies tokens against its JWKS and
exchanges a long-lived `cfsc_` credential for a short service token here, so it sits upstream of
nearly everything (`deploy/compose/docker-compose.estate.yml:27-30`). It supersedes the legacy
Nimbus service, whose hostname it still answers on.

**Surface.** 43 routes, all unversioned, registered via `define(...)` in
`identity/src/server.ts:753-1930`. `GET /.well-known/jwks.json` (:782) is the only route not sent
`no-store` — it carries `public, max-age=300`. Authentication is `/auth/register` (:790, answers
202 and **no session**), `/auth/email/verify` (:847), `/auth/login` (:969), `/auth/mfa` (:1074),
`/auth/refresh` (:1133), `/auth/handoff` (:1332) and `/auth/handoff/redeem` (:1349). Sessions,
MFA factors, organisations and account deletion follow. Machine credentials are
`POST /service-tokens` (:1571), `/service-tokens/exchange` (:1627) and the `/service-credentials`
block (:1686-1725). `/internal/users/:id/roles` (:1772) requires a service token holding
`identity:admin`. Signing-key rotation is `/admin/signing-keys` with `activate` and `retire`
(:1888-1926). WebAuthn is a deliberate 501 at `mfa.ts:44-48`.

**Invariants.** Registration never returns a session. Role grants are enforced in the database,
not in a handler. Refresh-family reuse is detected and kills the family. It emits nine topics
(`src/topics.ts:59-67`) through the standard outbox relay, and ships a `pnpm rewrap` CLI
(`src/rewrap-cli.ts`) plus a one-shot migrator.

**Deployed state.** Public on both networks. `identity-migrate` and `identity` at
`deploy/compose/docker-compose.estate.yml:679-812`, pinned as
`ghcr.io/cloudsforge-online/micro-identity:2.3.0` in `docker-compose.design.yml:222`. Routed two
ways: the whole host `nimbus<CF_WEB_SUFFIX>` (`estate-web.yml:867-871`) and
`Host(CF_API_HOST) && PathPrefix(/v1/auth)` with the version strip
(`public-api.yml:109-114`). Measured live on both mainnet and testnet.

### 3.2 `contracts` — the frozen wire vocabulary

**Purpose.** A private pnpm workspace of five zero-runtime-dependency TypeScript packages holding
the shapes and constants two or more repositories would otherwise each keep a copy of. Its job is
to make a disagreement between two services fail in one build.

**Surface.** Five packages, each `exports: { ".": "./src/index.ts" }` with a `publishConfig`
pointing at `dist`; consumers resolve `link:../contracts/packages/<x>`.

- `@cloudsforge/contracts-auth` (1,284 lines) — the frozen `SCOPES` registry, the live-versus-
  deprecated split (`LIVE_SCOPE_NAMES:588`, `DeprecatedScope`, `LiveScope`), matchers
  (`grantsScope:689`), claims (`hasScope:752`), MFA classification (:809), organisation
  orphan-checking (`wouldOrphanOrganisation:1016`), and validation (`checkPassword:1147`,
  `truncateIp:924`).
- `@cloudsforge/contracts-chain` (592 lines) — `CHAINS:191` with EMBER's
  `chainId {mainnet:7411, testnet:7412}` at :199, asset registry and retirement
  (`assertIssuable`), `EMBER_DECIMALS:416` / `WEI_PER_SPARK:425`, `RATE_SCALE`, confirmation and
  reorg predicates, explorer URLs, and a type-level guard
  `MainnetAndTestnetExplorersMustDiffer:110` that makes a reused explorer a compile error.
- `@cloudsforge/contracts-events` (1,560 lines plus `audit.ts`, 431) — `TOPICS:232`, 61 topics
  across 15 producer services; the envelope, `makeEvent:1062`, `inboxKey`, version negotiation
  (`acceptsVersion:147`); and the delivery signature —
  `SIGNATURE_HEADER = 'cf-signature':1458`, `signDelivery:1498`, `verifyDelivery:1511`.
- `@cloudsforge/contracts-money` (1,254 lines; the only package with a dependency) — account
  subjects and `accountKey`, entry kinds, `balanceEntry:649` / `assertBalanced`, reserve/release/
  move posting builders, `Money` arithmetic, entitlement and payout shapes.
- `@cloudsforge/contracts-worlds` (633 lines) — capabilities, `SCOPE_FOR:171`, title URNs, and
  the pinned wire documents: `TITLE_DESCRIPTOR_PATH '/v1/title'`, `PROVISION_PATH '/v1/provision'`,
  achievement paths, and the `422 unsupported` code.

**Invariants.** Zero runtime dependencies outside the workspace. CI runs typecheck, test and build,
then calls `micro-org`'s reusable `contract-compat.yml` with `fetch-depth: 0`, so a breaking
contract change fails here rather than in the first consumer to upgrade.

**Deployed state.** Not deployed, correctly — no container, no route, no database. Its own
`ci.yml` says `micro-org`'s `service-ci.yml` "does not fit it… and forcing it through would mean
weakening the rules for everyone else". It reaches production by source: 28 service Dockerfiles
copy `/contracts` alongside `/runtime`, because `node_modules/@cloudsforge/contracts-*` are `link:`
symlinks out of the service tree. 18-build-status.md:1010-1012 records the ledger image that
shipped without that copy and crashed on `index.ts → jobs.ts → outbox.ts`.

### 3.3 `runtime` — the shared substrate

**Purpose.** Seven pnpm-workspace packages every CloudsForge Node service links against, so a
cross-cutting fix is one pull request rather than forty. It was created to delete duplication that
had already become structural in a polyrepo: six byte-identical `obs.ts` copies, five divergent
JWKS middlewares, five boot-time DDL arrays, eight unleased `setInterval` timers, twenty-five
private `requiredSecret` deny-lists.

**Surface.** `@cloudsforge/auth` — `Verifier`, `Principal`, the 401/403/503 error taxonomy,
`requireScope`, `statusFor` (`src/index.ts:27-240`), plus `ServiceTokenProvider` and
`CREDENTIAL_PREFIX='cfsc_'` (`src/serviceToken.ts:98-491`). `@cloudsforge/db` — `migrate`,
`assertSchemaAtLeast`, `lockKeyFor`, `checksumOf`. `@cloudsforge/http` — `HttpClient`, `HttpError`
with `peerDecided`, `TimeoutError`, `CircuitOpenError`, `redactUrl`. `@cloudsforge/jobs` —
`JobQueue`, `JobRunner`, `JOBS_SCHEMA_SQL`, `backoffFor`. `@cloudsforge/lifecycle` — `Lifecycle`
(`livez`/`readyz`/`track`/`shutdown`), `installSignalHandlers`, `postgresProbe`, `httpProbe`.
`@cloudsforge/secrets` — `assertGeneratedSecret`, `assertServiceCredential`, `entropyPerChar`.
`@cloudsforge/telemetry` — `Logger`, `Metrics` with Prometheus-text `render()`, `redactValue`,
`newRequestId`, `registerHttpMetrics`, `registerJobMetrics`.

**Invariants.** Leased jobs rather than timers; secrets validated for shape at boot; migrations run
by a separate one-shot process holding an advisory lock.

**Deployed state.** Deployed as source. It ships no image by design (`ci.yml: build-image: false`)
and is mounted into every service build as the named context `runtimepkgs: ../../runtime`
(`deploy/compose/docker-compose.estate.yml:97`). It cannot be published for the scope/org reason
above, so the `publishConfig` blocks in all seven manifests are aspirational; 20 repositories
resolve it via `link:` and 10 via `file:`. Its behaviour is observable through the gateway only
indirectly — `https://api.cloudsforge.online/v1/rates` answered 200 on 2026-08-07, while
`/livez` is not routed publicly and answers 404, so `Lifecycle` cannot be observed from outside.

---

## 4. Worlds, games and content

Six repositories: one spine, four titles and an image factory. `micro-worlds` owns everything a
game must not own — the title registry, the account-scoped player profile with inventory and
sanctions, cross-title achievements, seasons carrying a money budget, and the entitlement bridge
that turns a paid purchase into a world a title service actually raised. The titles own simulation
and nothing else: aetherholm's archipelagos, cities and lazy no-tick economy; tessera's wards,
parcels, placements and venue bookings; emberkin's deterministic battle engine ported bit-for-bit
from a C# ancestor; nda's tile map and day-resolution engine replayed against 21 recorded ancestor
worlds. `micro-studio` sits beside them as the estate's image origin, productising `asset-forge`
into brand kits, leased FLUX.2-pro generation jobs and credit accounts, and doubling as the upload
origin for Market and Foresight outside this plane.

Two contracts bind the plane. Downward: `@cloudsforge/contracts-worlds` — `GET /v1/title` plus
`POST /v1/provision`, implemented by tessera (`server.ts:425,430`) and aetherholm
(`server.ts:406,411`), and called only by worlds' `titleclient.ts:122,135`. Upward: the
`worlds:title` scope, by which emberkin and nda push achievement definitions and unlocks into the
spine (`worlds/src/server.ts:778,799`). Money is asymmetric on purpose — no title holds a balance
column, and rewards are meant to be ledger postings the spine makes under `seasons_within_budget`.

What genuinely works is measurable. Every service here is live on both networks and was curled on
2026-08-07: aetherholm's title descriptor, tessera's 42 public wards, emberkin's 50-species dex,
studio's four passing readiness probes with FLUX configured, worlds' registry on
`api.cloudsforge.online`. The plane's real cultural achievement is that its rules live in
Postgres, not in handlers — GiST exclusions for non-overlapping parcels and bookings, a
generated-column object cap, `cities_stocks_settled_within_caps`, `tiles_world_xy_uniq`,
`credit_accounts_within_cap`, `provisions_entitlement_uniq`. Background work is leased jobs keyed
on the contended resource, never timers, in all five servers. And the estate's phantom-route
disease (§3.3i, §3.3m) has been genuinely cured on the client side here: tessera's Kiln,
emberkin's and nda's worlds clients each carry a header recording the invented route that was
deleted, and every dossier's route-by-route check found no survivors.

The seams are all at the joins, and all in the same direction: the plane's simulation is finished
and its *wiring* is not. Worlds' registry contains exactly one row — emberkin, inserted by a
verification script, with empty capabilities and no title contract behind it — while the two
services that do implement the contract are absent from both networks' registries. The event that
would drive provisioning is subscribed by four services in code and seeded nowhere. Studio can
fire an object from a prompt, but tessera-web renders from a static sprite mount, so the Kiln's
bytes reach no viewer. Seasons exist three times over. nda is a complete 34-route backend with no
gateway route and no caller. The consequence is a plane where each repository is individually
finished and the paid-world journey — buy, provision, play, earn, publish — cannot be walked end
to end on the deployed estate.

| Repo | What it is for | What it exposes | Deployed? |
| --- | --- | --- | --- |
| `worlds` | The cross-title spine: registry, player, inventory, seasons, entitlement bridge | 22 routes; `POST /v1/events` is HMAC-only; four scopes `worlds:read\|write\|title\|admin` | Yes — `api.<apex>/v1/{titles,players,provisions,seasons}` |
| `tessera` | Persistent isometric world: wards, parcels, objects, placements, venues | 43 routes incl. `/v1/title`, `/v1/provision`, `/v1/kiln/firings` | Yes — `tessera.<apex>`, API same-origin |
| `aetherholm` | Sky-island strategy MMO: archipelagos, cities, fleets, sieges, chronicle | 31 routes incl. `/v1/title`, `/v1/provision`, anonymous chronicle | Yes — `aetherholm.<apex>` |
| `emberkin` | Monster-collecting RPG; server-authoritative deterministic battles | 10 routes: saves, battles, cosmetics, achievements, public dex | Yes — `emberkin.<apex>/v1` |
| `nda` | *Ninety Days After*: tile map, homesteads, day-resolution engine, communes | 34 routes; 14 emitted topics | Yes (compose) — loopback 4116, no gateway route |
| `studio` | The estate's image origin: brand kits, leased FLUX jobs, credits, uploads | 14 routes incl. `/v1/uploads` and `/v1/assets/:id/bytes` | Yes — `studio.<apex>` |

### 4.1 `worlds` — the title spine

**Purpose.** The cross-title spine. Its headline job is the entitlement bridge: consume
`billing.entitlement.granted` and turn a paid private world into a world a title service actually
raised, idempotently, with an operator view of every failure. It owns nothing a title owns — no
simulation state, no money balances.

**Surface.** 22 routes, all defined via `define(...)` in `worlds/src/server.ts`. Unauthenticated:
`/livez` (:385), `/readyz` (:387), `/metrics` (:392), `GET /v1/titles` (:531),
`GET /v1/titles/:id/achievements` (:765), `GET /v1/titles/:id/seasons` (:819). HMAC-authenticated
with no bearer, signature over raw bytes before `JSON.parse`: `POST /v1/events` (:411),
dispatching `billing.entitlement.granted` to provisioning and `aetherholm.season.sealed` to
heraldry; every other topic is a 202 and ignored. Bearer routes cover title registration (:548),
the player profile (:588, :615), cosmetics (:640), inventory (:662-695), provisions (:706-747),
achievement definition and unlock under `worlds:title` (:778, :799), seasons (:824), season budget
(:848) and rewards (:871).

**Invariants.** Four scopes, `worlds:read|write|title|admin`. Rewards are real ledger postings
against a season budget. Jobs are leased: `outbox.relay` (1s, lease `stream`),
`provision.deliver` (lease `title:<id>`), `provision.sweep` (5s). It emits seven topics. It also
ships an executable conformance suite for candidate titles (`src/conformance.ts`, nine checks, run
by `pnpm conformance`).

**Deployed state.** Running. `deploy/compose/docker-compose.estate.yml:2106` (`worlds-migrate`)
and `:2122` (`worlds`); database created at `deploy/compose/estate/initdb.sql:51`. The gateway
routes it at `deploy/gateway/dynamic/public-api.yml:155` on
`Host(CF_API_HOST) && (PathPrefix(/v1/titles) || /v1/players || /v1/provisions || /v1/seasons)`.
Measured 200 on `api.cloudsforge.online/v1/titles` and its testnet twin. The gateway rule
deliberately does not expose `/v1/events`; that is an in-cluster call from billing to
`http://worlds:4000`. The registry it serves is effectively empty — one row on mainnet, inserted
by a verification script, with empty capabilities.

### 4.2 `studio` — the image origin

**Purpose.** Productises the `asset-forge` CLI as an HTTP service owning brand kits, asset specs,
leased generation jobs, generated assets and per-account generation credits. It generates through
FLUX.2-pro on Azure AI Foundry with a deterministic SVG placeholder fallback, stores every asset's
full provenance (model, prompt, spec, cost, C2PA), and is also the estate's upload and image-bytes
origin for Market and Foresight.

**Surface.** 14 routes in one `buildRoutes()` table in `studio/src/server.ts`: probes (:418-429),
`GET /v1/backend` (:454, unauthenticated), brand kits (:464-535),
`POST /v1/brand-kits/:id/generate` (:557, answers 202 with a job), `GET /v1/jobs/:id` (:634),
`GET /v1/assets/:id` (:643), `GET /v1/assets/:id/bytes` (:685), `POST /v1/uploads` (:780, raw
image bytes as body), `POST /v1/assets/:id/visibility` (:840). Scopes are `studio:read` and
`studio:write`. It publishes `studio.asset.created`, `studio.generation.requested`,
`studio.usage.recorded` and `studio.asset.visibility_changed`.

**Deployed state.** Running on both networks. `deploy/compose/docker-compose.estate.yml:1310`
(`studio`), `:1296` (`studio-migrate`), `:1284` (`studio-assets-init`, a sidecar that chowns the
volume to 1000:1000). The compose comment at :1244-1282 records the live incident it fixes:
`STUDIO_ASSET_ROOT` was unset, the default `./out` resolved to a root-owned `/app/out` under
`USER node`, and generation failed silently. Gateway router `cf-web-studio` at
`estate-web.yml:988` applies `cf-web-headers` deliberately, because studio is an untrusted-upload
origin. The gateway comment at :980 saying the DNS records do not exist is stale — both hostnames
resolve and answer 200.

---

## 5. Frontends, design system and brand

Twenty-five repositories, seven of which are not surfaces at all. (The plane's own narrative
counts "twenty", treating the five asset repositories as one group; the count here is the number
of git repositories.) Eighteen are browser bundles. `ui` is the plane's spine: one unpublished
package holding the surface registry, the tokens, three typefaces, the chrome and the
SEO/sitemap/consent helpers — 276 tests, all green on 2026-08-09, `dist/` committed and
byte-verified, and a registry whose `servesUi` column was measured against the wire rather than
reasoned about. `web-template` is the second spine: not a package but a copy-source, and
`src/lib/obs.ts` is byte-identical — one sha256 across all of them, checked 2026-08-09 — in the
eighteen consumers that carry it. The five asset repositories are the third: 957 assets with exact
manifest/disk parity and provenance per entry, delivered either by bind mount
(`/world-assets/SET.json`, 392 of 392 live) or by copy into each bundle's `public/`. Everything
else is a thin SPA over exactly one service — admin-web over admin-api, explorer-web over indexer,
beacon-web and status-web over the two halves of Beacon, pool-web over the pool,
market/mint/trade/devportal/hub over their own, and four game clients over four Worlds services.

What genuinely works is measurable. Every one of the sixteen UI hostnames plus both apexes answers
200; every `servesUi: false` row answers 404; an unknown path answers a real 404 on every surface,
because the route table exists in triplicate (`routes.ts`, `app.tsx`, `nginx.conf`) and a test
reads the nginx file rather than trusting a comment. No hostname is baked into any artefact.
Roughly 5,000 frontend tests are green. And the editorial discipline is the plane's best asset: a
named hole rather than a plausible screen, `null` never rendered as `0`, four visually distinct
states, and copy that states the limit of its own evidence — "A backup that has never been
restored is a claim about the future".

The seams are all in how the spines propagate. Both spread by copy, not by version: `ui` reaches
twenty repositories through a symlink with no version gate, `web-template` through `git clone`. So
a fix travels badly — the `useResource` deps fix was made in nine consumers and never returned to
the template — and a defect travels perfectly. The `$scheme://$host` sitemap is that defect,
sitting identically in fifteen nginx files on 2026-08-09 — the newest of them `pool-web`'s, which
inherited it from the template two days after this document first recorded it — and locked in by
each repository's own passing test.

The second seam is that the field a bundle uses to decide its own gate is the same field that
invites crawlers, and on two surfaces it disagrees with the service. The third is more
uncomfortable: this plane is uniformly finished and uniformly empty. Market serves
`{"listings":[]}`, the developer directory is empty, the Worlds registry's only mainnet row is
smoke residue, Tessera's front door lists 42 "Private Ward" test rows, and every Foresight market
reports `total:"0"`, `houseSeed:null`, `provenance:null`. The estate designed the cure — the
Engagement Treasury, "the answer to every empty room's cold start" (21-engagement-treasury.md) —
and has not switched it on. Fourth, the anonymous visitor is the one user nobody owns: the shared
sign-in helper is an immediate off-origin `location.assign`, copied identically into six public
front doors.

One correction this catalogue can make that the individual dossiers could not: six repositories
flagged `docker-compose.release.yml` pinning frontends at `1.0.0`. That file is generated output —
`release-deploy.sh:205` re-renders it from `org/releases/2.3.0.yaml`, which pins 2.3.0. It is a
stale artefact, not a deployment gap.

| Repo | What it is for | What it exposes | Deployed? |
| --- | --- | --- | --- |
| `ui` | The single source of visual and structural truth; the surface registry | `@cloudsforge/ui` with 9 export subpaths: chrome, surfaces, seo, sitemap, consent, charts, cite, test-loader, CSS | No — ships inside every frontend image |
| `web-template` | The scaffold every SPA is cut from; a defect here ships eighteen times | No exports; a fixed file set copied by `git clone` | No — image built in CI only |
| `site` | The marketing site and the estate's apex | 9 addresses: home, products (7 slugs), platform, build, about, legal | Yes — both apexes |
| `hub-web` | Forge Hub: the one signed-in surface, and the estate's only sign-in | 8 routes plus 6 ungated `account/*` addresses | Yes — `hub.<apex>` |
| `admin-web` | The operator console; renders what admin-api enforces | 11 routes plus the nested `/foresight` section | Yes — `admin.<apex>` |
| `explorer-web` | The block explorer; the estate's most linkable public artefact | 7 routes over indexer's anonymous reads | Yes — `explorer.<apex>` |
| `network-site` | The chain's front door; hosts the testnet faucet form | 5 routes: `/`, `/chain`, `/mine`, `/node`, `/faucet`; in-browser miner | Yes — `network.<apex>` |
| `pool-web` | The mining pool's console; an instrument panel, not a product page | 3 routes: `/`, `/workers` (and `/workers/:chain/:account`), `/blocks`; no account menu, no sign-in | No — the bundle is micro-pool-web#1 and its compose service micro-deploy#15, both open; that service carries no profile, so it starts with the estate the day both land |
| `market-web` | Forge Market's front door | 6 routes: browse, listing, collections, sell, orders, fees | Yes — `market.<apex>` |
| `mint-web` | Forge Create: order, pay, deploy, project page | 6 routes incl. the public `/projects/:id` | Yes — `create.<apex>` |
| `trade-web` | Forge Trade: strategies, backtests, bots | 7 routes; everything but `/` is gated | Yes — `trade.<apex>` |
| `foresight-web` | The parimutuel market's public face; read-first, every route public | 4 routes: markets, market, portfolio, rules | Yes — `foresight.<apex>` |
| `worlds-web` | The Forge Worlds platform surface; names no title anywhere | 6 addresses: platform, player, inventory, entitlements, title | Yes — `worlds.<apex>` |
| `tessera-web` | Tessera's client; Canvas 2D isometric renderer, no engine dependency | 6 routes, 7 screens; consumes 22 typed API functions | Yes — `tessera.<apex>` |
| `aetherholm-web` | Aetherholm's client; plain SVG archipelago | 6 routes; `/battles` and `/chronicle` public | Yes — `aetherholm.<apex>` |
| `emberkin-web` | Emberkin's client; deliberately deleted the inherited battle engine | 7 routes; only `/` loads `three` | Yes — `emberkin.<apex>` |
| `devportal-web` | The developer console plus the public application directory | 4 top-level routes, 5 nested project sections | Yes — `developers.<apex>` |
| `beacon-web` | Beacon's operator console; release gate first | 6 routes; GET-only, waivers visible and uncreatable | Yes — `beacon.<apex>` |
| `status-web` | The public status page; built to work when the rest does not | 4 routes; one outbound call, `GET /api/status/public` | Yes — `status.<apex>` |
| `lantern-web` | Lantern's operator console; trade a request id for a trace | 4 routes: issues, events, browser, request | Yes — `lantern.<apex>` |
| `brand` | Surface chrome for 16 surfaces: favicons, OG cards, marks, wordmarks | `assets/`, `MANIFEST.json`, `verify.py`, `plan.ts`, `materialise.py` | Data — copied into each bundle's `public/` |
| `wallet-assets` | Icons and illustrations for the three self-custody clients | `assets/`, `content/` JSON, `MANIFEST.json`, `verify.py` | Data — bundled into the wallet shells |
| `emberkin-assets` | Emberkin's game art, driven by canonical content JSON | `assets/`, `MANIFEST.json`, `verify.py`, `COMPARISON.md` | Data |
| `aetherholm-assets` | Aetherholm's game art | `assets/`, `MANIFEST.json`, `ART_BIBLE.md`, `COMPARISON.md` | Data |
| `tessera-assets` | Tessera's world art plus the canonical content specs | `content/`, `materialise.py`, `SET.json` | Data — bind-mounted at `/world-assets` |

### 5.1 `ui` — the design system and the surface registry

**Purpose.** The estate's single source of visual and structural truth. One pnpm workspace
publishing one package, `@cloudsforge/ui`, deliberately unsplit: design tokens, three self-hosted
typefaces, brand marks, the product switcher, account menu, footer, chart primitives, and the
surface registry that names every CloudsForge hostname. It is unsplit because the previous split —
accents in one package, product list in another — had already drifted.

**Surface.** Nine export subpaths declared in `ui/packages/ui/package.json`:

- `.` (`src/index.tsx`, 1,481 lines) — chrome (`CloudsForgeBar`, `ProductSwitcher`, `AccountMenu`,
  `CloudsForgeFooter`, `Mark`, `SkipLink`, `MainRegion`, `StatusPill`, `CookieBanner`); host
  resolution (`cloudsforgeHosts()` at :269, `accountUrl()`); auth (`signInRedirect`,
  `IDENTITY_AUTH_ROUTES:383`, `mintHandoffCode:404`, `handoffReturnUrl:433`,
  `consumeAuthCallback:458`); constants (`MAIN_ID`, `FOOTER_LEGAL_LINKS:1325`).
- `./surfaces` (`src/surfaces.ts`, 1,121 lines) — `SURFACES`, the registry itself, plus
  `surface()`, `PRODUCTS`, `SWITCHER_SURFACES`, `FOOTER_GROUPS`, `KNOWN_SUBS:1018`,
  `ENV_LABELS:1065`, `splitEnvLabel():1101`, `envLabel():1118`, `PRODUCT_ACCENTS`,
  `RETIRED_ACCENTS`. The registry carries 29 rows — 6 products, 17 services, 6 surfaces — each with
  a `subdomain:`; the newest is `pool`, `kind: 'service'` with `inSwitcher: false` and
  `markId: null`, because `brand` has no asset set for it and naming a mark that does not exist
  renders nothing.
- `./seo` — `surfaceMeta()`, `metaTags()`, `applyHead()`, `canonicalHref()`, `robotsDirective()`,
  `INDEXABLE_SURFACES`.
- `./sitemap` — `sitemapUrls()`, `sitemapXml()`, `robotsTxt()`, all *functions of an origin* rather
  than files, so nginx can serve a correct sitemap per hostname.
- `./consent` — the consent cookie, storage key, `analyticsAllowedHere()`, grant/deny/revoke,
  `deleteAnalyticsCookies`, `initAnalytics`.
- `./charts` — `Sparkline`, `AreaChart`, `BarChart`, `StatTile`, `Meter`, `Delta` plus the
  geometry helpers.
- `./cite` — `cite()`, `citeIfPresent()`, `block()`, for content pinning across repositories.
- `./test-loader` — `installReactDedupe()`, `canonicalReact()`, a Node loader that resolves React
  from `process.cwd()`, which is what makes `link:`-symlinked components testable at all.
- `tokens.css` (1,333 lines) and `ui.css` (1,096), plus six woff2 subsets.

**Invariants.** The registry is the one place a hostname exists; deploy scripts read it to check
gateway routes, and `docker-compose.estate.yml` derives its 18-origin handoff allowlist in
registry order. A `servesUi: false` row must answer 404, and that is tested against the wire.

**Deployed state.** Not deployed as a service, and correctly so: `ui/.github/workflows/ci.yml`
records that it "serves no /livez, /readyz or /metrics, owns no database and ships no container",
which is why it runs a bespoke CI instead of `micro-org`'s `service-ci.yml`. It ships inside every
frontend image via the `uipkg` Docker build context. It is demonstrably live —
`https://hub.cloudsforge.online/` returns an `index.html` whose comment block names
`@cloudsforge/ui/tokens.css` and sets `data-cf-product`, `data-cf-substrate` and
`data-cf-scheme="auto"`, the last "added with @cloudsforge/ui 1.1". It is **not published to any
registry**: every consumer uses `link:../ui/packages/ui`, and the package.json comments across 20
repositories say it "becomes a registry version ('^1.0.0') the day it is".

### 5.2 `web-template` — the second spine

**Purpose.** The scaffold every CloudsForge SPA is cut from. Not a published package: a
copy-source that fixes, once, the decisions each of the estate's eighteen frontends would
otherwise get wrong independently — runtime host resolution with no build-time configuration, the
nested error envelope and single-flight token refresh, the Lantern RUM envelope, the four-state
resource reducer, an nginx config whose unknown paths answer 404, and the browser-journey harness.

**Surface.** No npm exports (`package.json:5`, `"private": true`). Its contract is the set of files
consumers copy verbatim: `src/lib/hosts.ts` (`PRODUCT`, `resolveApiBase`, `hosts`, `apiBase`,
`pageOrigin`), `src/lib/api.ts` (`ApiError`, `readErrorBody`, `noticeFor`, `refreshSession`,
`AUTH_EXPIRED_EVENT`, `ACCESS_KEY='cf.accessToken'`), `src/lib/obs.ts` (`report`, `envelope`,
`flush`, `enqueueBounded`, `kindFor`), `src/lib/resource.ts` (`resourceState`, `useResource`),
`src/lib/series.ts`, `src/components/{shell,states}.tsx`, the five journey harness files,
`nginx.conf`, `Dockerfile` and `.github/workflows/ci.yml`. Consumption is by `git clone` plus the
seven-step checklist at `README.md:67-90`.

**Invariants.** Copying is the distribution mechanism, and it has no version gate. That is the
known cost: a fix travels badly and a defect travels perfectly.

**Deployed state.** Not deployed, correctly. `grep -rn "web-template" deploy/compose/*.yml` returns
nothing. 22-browser-journeys.md:236 states it directly: "`web-template` is a scaffold rather than
a product surface". Its image is still built and published by CI so that the `served-headers` probe
and the release-manifest path exercise the same artefact every frontend inherits. Its effects are
visible second-hand on the live estate: the honest-404 behaviour and the Lantern ingest calls
measured on production surfaces are this repository's `nginx.conf` and `obs.ts` running.

---

## 6. Deployment, operations and documentation

Four repositories. This plane is where the estate stops being source code and becomes a thing on
the internet, plus the memory that explains why. `micro-deploy` owns everything physical: one home
server at `malf@192.168.1.42` running two compose projects (`cloudsforge-estate`, `cf-testnet`), a
4,011-line estate file with roughly 46 services and a single `postgres:17-alpine` holding 29
databases, a Traefik route map keyed on ``Host(`x{{ env "CF_WEB_SUFFIX" }}`)``, four cloudflared
ingress files, and the release consumer that turns `micro-org`'s manifest into a deploy.
`micro-beacon` watches from inside, probing nine in-cluster targets and the public hostnames over
real TLS, folding failures into incidents and publishing the redacted projection that
`status.cloudsforge.online` renders. `micro-lantern` catches what breaks in the browser and in
logs, fingerprinting occurrences into issues so an operator can trade a request id for a trace.
`micro-docs` governs all of it: thirty numbered documents, 18-build-status as the ledger, cited by
471 lines of source and configuration across the estate.

The runtime half genuinely works, and works better than its own ledger says. Fifteen UI surfaces
answer 200 on both networks, `eth_chainId` returns `0x1cf3` and `0x1cf4` through routes that exist
only in this repository, 2.3.0 is live on both projects as of 2026-08-07, and beacon and lantern
both answer `/readyz` with postgres passing and refuse `/metrics` with 401. The disciplines are
mechanical rather than aspirational: fail-closed image pre-flight, registry–gateway–tunnel
agreement enforced in CI, a gateway that cannot log a client IP, a keyring that refuses to boot
beside custody ciphertext, and a backup destination that writes a canary because snap-confined
Docker silently binds an empty directory.

The seams are all at the same joint: the observability chain is complete in every part and
connected in none. `deploy` ships an OTel collector, Prometheus, Tempo, Loki, Grafana, twenty
alerts and five dashboards; `lantern` ships a hand-rolled protobuf OTLP decoder with no parsing
dependency; `beacon` exports metrics and computes error budgets in integer parts per million. Yet
the estate compose sets `OTEL_` zero times, `prometheus/targets/services.yaml` is literally `[]`
with a comment claiming "no service in micro/ is deployed yet", and the twenty alert expressions
name metrics no process emits. Only lantern's browser sink has a live producer, because the
seventeen surfaces ship `obs.ts` themselves and do not go through the collector.

Underneath that sits a second, quieter pattern: the telemetry configuration was written against
each service's own default port, and the estate later normalised every service to `PORT=4000`.
Prometheus and Alertmanager address beacon on 4011; the collector's Lantern exporter names 4010.
Nothing has failed yet only because the stack that would make those calls has never been started —
the defect is latent, waiting for the day someone runs `make up`.

The documentation half is disciplined about correcting itself, but only forwards. Corrections land
at the top of the newest document and never propagate back to 02, 05, 06, 08 or 16, which is
exactly where the index tells a newcomer to begin. One consequence is visible from all three
sibling dossiers at once: the ledger's only row for `micro-deploy` still reads "Configuration
only; not running", which is true of five telemetry containers and false of the eighteen-container
production estate the same repository operates. A future session with no memory reads that row and
concludes the estate has never been deployed.

| Repo | What it is for | What it exposes | Deployed? |
| --- | --- | --- | --- |
| `deploy` | The operations plane; the only place any other repo becomes reachable | 10 compose files, the Traefik route map, 4 tunnel configs, ~30 Make targets, 24 runbooks, a backup service | Yes — it *is* the deployment |
| `beacon` | Synthetic monitor and release gate; an unknown always refuses | ~20 routes incl. `/v1/gate`, `/api/status/public`, `/api/alerts/webhook`; CLI `beacon gate\|smoke\|browser\|slo-seed` | Yes — `beacon.<apex>`, `status.<apex>` |
| `lantern` | Error triage: OTLP logs in, browser RUM in, issues and request lookup out | 9 routes incl. `POST /otlp/v1/logs` and the CORS-guarded `/ingest/client` | Yes — `lantern.<apex>` |
| `docs` | The estate's memory and design authority | 30 numbered documents in `ecosystem/`, 20,664 lines | No — consumed as a GitHub repository |

### 6.1 `deploy` — the operations plane

**Purpose.** The compose topology for both networks, the Traefik gateway route map, the Cloudflare
tunnel ingress, the telemetry stack configuration, the runbooks, the operator scripts, the release
consumer, and a backup/restore data-plane service.

**Surface.** Ten compose files in `deploy/compose/`: `docker-compose.estate.yml` (4,011 lines,
roughly 46 services plus one `postgres:17-alpine` holding 29 databases),
`docker-compose.release.yml` (74 image pins for mainnet), `docker-compose.design.yml` (74 pins,
testnet), the two gateway files, `.telemetry.yml` (otel-collector, prometheus, tempo, loki,
alertmanager, grafana), `.backup.yml`, `.miners.yml`, and two hearth-seed files. The route map is
`gateway/dynamic/estate-web.yml`, with `cf-web-*` and `cf-api-*` routers keyed on the
`CF_WEB_SUFFIX` host template (hub at :253, nimbus at :867, vault at :946, studio at :988).
Ingress is `cloudflared/config.{mainnet,testnet}.{public,operator}.yml` — 21 public hostnames per
network plus three operator (admin, beacon, lantern). Observability configuration is
`prometheus/rules/alerts.yaml` (20 alerts), `rules/slo.yaml`, five Grafana dashboards,
`otel/collector.yaml`, `loki/loki.yaml`, `tempo/tempo.yaml`. The `Makefile` exposes roughly 30
targets, including `estate-up`, `estate-verify`, `estate-browser`, `check-gateway`,
`check-surfaces`, `check-restart-live`, `check-handoff-live`, `gateway-reload`. `backup/` is a real
TypeScript service (archive, restore, verify, prune, keyring, manifest, disk; eight test files)
that leases `backup.*` jobs from `admin_api`'s `jobs` table.

**Invariants.** Registry, gateway and tunnel must agree, and CI enforces it. Image pre-flight fails
closed. The gateway cannot log a client IP. The backup destination writes a canary, because
snap-confined Docker silently binds an empty directory.

**Deployed state.** It is the deployment. Thirty successful HTTPS measurements against
`*.cloudsforge.online` and `*-testnet.cloudsforge.online` on 2026-08-07 (fifteen surfaces on each
network at 200, both apexes, admin, beacon, lantern); `eth_chainId` `0x1cf3`/`0x1cf4` and
`eth_blockNumber` advancing through `rpc.`, a hostname that exists only in
`cloudflared/config.mainnet.public.yml:96`; `docs/releasing.md:9-12` records 2.3.0 on both projects
as of 2026-08-07. The host is a single home server
(`scripts/check-running-provenance.sh:45`, `docs/estate-backup-restore.md:3`). What is *not*
deployed: Grafana and Prometheus have no tunnel route at all — `grafana.cloudsforge.online` and
`prometheus.cloudsforge.online` both fail DNS — and no service exports OTLP; the `backup-runner`
container is referenced by exactly one line in the entire repository, a comment inside its own
file.

### 6.2 `beacon` — the release gate

**Purpose.** The estate's synthetic monitor and its release gate. It runs probes, service journeys
and real-browser journeys on a leased schedule, folds failures into incidents with hysteresis and
dedupe, keeps SLOs whose error budget is integer parts-per-million arithmetic, records conformance
runs, exposes Prometheus metrics, publishes a redacted public status projection, and answers one
question for a deploy pipeline: may this promote?

**Surface.** Registered by `define()` in `beacon/src/server.ts`: `/livez` (:359), `/readyz`
(:361), `/metrics` (:366, auth-gated), `GET`+`POST /v1/gate` (:390, :410),
`GET /v1/gate/history` (:429), `POST /v1/gate/overrides` (:439), `GET /api/status/public` (:472,
open only when `BEACON_PUBLIC_STATUS=true`), probes (:499, :515), journeys (:535, :551), incidents
(:574-612), `POST /api/alerts/webhook` (:632, the Alertmanager receiver), SLOs (:668, :698) and
conformance runs (:722, :735). The CLI (`src/cli.ts`, bin `beacon`) has `gate` — exit 1 on refuse,
exit 2 when it cannot ask — plus `smoke`, `browser` and `slo-seed`.

**Invariants.** An unknown always refuses and can never be overridden. `PUT /v1/probes/:name` and
`PUT /v1/slos/:name` are the sole callers of `upsertProbe` and `upsertSlo`, so there is one way
each of those rows can come into being.

**Deployed state.** Running. `beacon` and `beacon-migrate` at
`deploy/compose/docker-compose.estate.yml:2897` and `:2911`, host-bound 4142 to 4000 (:2996),
depending on postgres, identity, ledger, market, worlds, activity and hub-api. `beacon-web` at
:3749, routed by `cf-web-beacon` (bundle, priority 500) and `cf-api-beacon` (API prefixes,
priority 600) at `estate-web.yml:653-663`. Both networks answer live. What is **not** running is
the telemetry plane that consumes it: `docker-compose.telemetry.yml`, `prometheus.yml` and
`alertmanager.yml` are written and point at `beacon:4011`, a port no deployed beacon binds — the
estate compose normalises `PORT` to 4000 (`docker-compose.estate.yml:104`) while beacon's own
default is 4011 (`src/env.ts:378`).

---

## 7. What this catalogue is not

**It is not a ledger of doneness.** That is [18-build-status.md](18-build-status.md), and where the
two disagree about whether something landed, the ledger wins. This document says what each
repository *is* and where it *sat on 2026-08-07*; it does not track progress, does not record when
a thing was built, and does not certify anything against
[17-definition-of-done.md](17-definition-of-done.md). "Deployed: yes" in a table above means a
container exists in the estate compose and the estate is running it — nothing more. Several rows
marked yes are deliberately unreachable from the public internet, and several rows marked no are
correctly non-deployable libraries.

**It is not a plan.** The 30-series documents carry the forward work; this one carries the present
tense only. Where a repository is described as having a seam — an unwired subscription, a route
with no caller, an empty registry — that is a measurement, not a commitment to close it. This
estate deliberately records gaps it refused to close (18-build-status.md §3.3a-3.3q,
[16-risks-and-open-decisions.md](16-risks-and-open-decisions.md)), and a refusal recorded there is
a decision rather than a defect. Reading a refusal in this catalogue as a task is the main way it
will be misread.

**It is not complete about behaviour.** Each repository entry gives the purpose, the surface and
the deployed state. It does not give the schema, the test counts, the invariant list, the runbook
or the failure modes; those live in the repository's own README and in the design documents
19-29 and 32. Where an entry cites a file:line, that line was opened; where it cites an HTTP
response, that request was issued on 2026-08-07. Nothing here was inferred from a name or from
configuration alone, and where a fact could not be established it is written as unknown rather
than smoothed.

**It is not durable.** Six of the findings above are corrections to sibling documents that are
themselves cited from elsewhere — the stale `micro-deploy` ledger row, the stale
`docker-compose.release.yml` `1.0.0` pins, the stale aetherholm "client remains" line, the stale
`notify` README, the stale `estate-verify.sh` aetherholm assertion, the stale studio DNS comment.
Those corrections were true on 2026-08-07 and will rot at the same rate as the lines they correct.
A reader arriving later should re-measure before citing.

