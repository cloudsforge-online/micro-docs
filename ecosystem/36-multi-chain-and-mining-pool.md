# 36 — Multi-chain assets, and a mining pool that is actually a mining pool

Written 2026-08-08.

**This is a plan, not a ledger.** [18-build-status](18-build-status.md) is the ledger. Every item
here is outstanding work unless it says otherwise, and nothing here may be read as a statement that
something has been done.

Two tracks were commissioned together and are written together because one of them is only honest
in the light of the other:

1. **Bring Bitcoin, Dogecoin and Ethereum Classic in beside Litecoin**, to full parity — deposit,
   withdraw, balance, reconcile — and finish Litecoin, which is not finished.
2. **Let people mine those chains through CloudsForge.** The original framing was "as we allow
   users to mine EMBER natively in the browser, how do we allow them to mine the others" — and the
   answer, developed in §5, is that a browser cannot, that the reason is arithmetic rather than
   effort, and that the thing worth building instead is a real pool for real hardware.

---

## 1. What is already true, measured

Measured on the estate host 2026-08-08 unless stated.

| Chain | Node | State | Estate integration |
| --- | --- | --- | --- |
| EMBER | Hearth, in-estate | height 6,777 | complete — it is the estate's own chain |
| LTC | `litecoind 0.21.5.6`, host process from `/etc/rc.local`, `-datadir=/data/chains/litecoin` | **synced**, 3,156,491 blocks, `initialblockdownload:false` | **deposit only.** See §2 |
| BTC | `bitcoind 27.0`, host process from `/etc/rc.local`, `-datadir=/data/chains/bitcoin` | **syncing**, 867,270 / 961,634, `verificationprogress` 0.749 | asset code and price sources already exist; **no node wiring at all** |
| DOGE | not running | datadir staged at `/data/chains/dogecoin` (blocks, chainstate, `dogecoin.conf` present) | **nothing exists** |
| ETC | not running | datadir staged at `/data/chains/ethereum-classic` → `/data2/chains/ethereum-classic`, geth-family layout (`geth/`, `keystore/`) | **nothing exists** |

The owner's stated sync order is **BTC, then DOGE, then ETC**. That is the operational sequence.
It is deliberately *not* the code sequence — see §4.

### 1.1 The single source of truth, and the twenty places that copy it

`contracts/packages/chain/src/index.ts` is the source of truth: `ChainFamily` (:24),
`AssetCode` (:49), `CHAINS: Record<AssetCode, ChainSpec>` (:191), `ON_CHAIN_ASSETS` (:371). Its
header comment at :327-369 is literally the "how to add an asset" runbook, written from the
Litecoin experience, and it should be followed rather than improved on.

It is a `link:` dependency resolved at HEAD, so **widening `AssetCode` breaks every consumer's
typecheck at once.** That is the estate's usual forcing function and it is working as designed, but
it dictates the order of work in §4: contracts and pricing merge first, consumers second.

The list is nonetheless repeated in about twenty places, each of which must be widened per asset.
The full enumeration is in the working notes for this document; the load-bearing ones are
`indexer/src/chains.ts:50-63`, `indexer/src/btcaddress.ts:35`, `custody/src/chains.ts:38-46`,
`custody/src/hd.ts:66-72` (SLIP-0044), `wallet/src/addresses.ts:73-156`,
`settlement/src/chains.ts:72-147`, `settlement/src/registry.ts:53-76`, `ledger` migrations
(`chain_assets`, one new checksummed migration per asset), `pricing/src/sources.ts:106-158` (four
venue symbol maps), `sdk/packages/sdk/src/chain.ts:63-99` (a deliberate copy, policed by
`sdk/tools/drift.ts`) and `hub-web/src/lib/money.ts:142` (deliberately hand-maintained, and
:107-130 explains why).

---

## 2. Litecoin is not finished, and that is the first thing to fix

Litecoin is fully synced and its deposit path works end to end. Two things are missing, and both
are worse than they sound.

**2.1 No Litecoin withdrawal can be built or broadcast. At all — but not for the reason this
document first gave.**

The first draft said `LTC_RPC_URL` was unset, so `SETTLEMENT_RPC_URLS` had no `ltc` entry and
`settlement/src/registry.ts:99` raised `NoEndpointError`. **That was wrong**, and it was wrong in
the way worth recording: it was inferred from the compose expression rather than measured against
the running estate. `LTC_RPC_URL` *is* set in `compose/estate/tokens.env`, the `ltc` entry *is*
present, and settlement's boot line reports `{"chain":"ltc","endpoint":true}`.

The real blocker is one line of transport code. `settlement/src/registry.ts:161` builds its client
with `baseUrl: parsed.origin`, and **`URL.origin` discards userinfo**, so an endpoint written
`http://user:pass@host:50002` sends no `Authorization` header. Bitcoin-family nodes have no
cookie-auth path over that transport and answer 401. Measured from inside the running settlement
container, against the endpoint it already holds:

```
NO-AUTH   (baseUrl = parsed.origin — what registry.ts does today) -> 401 Unauthorized
WITH-AUTH (Authorization: Basic base64(user:pass))                -> 200, blocks=3156498, ibd=false
```

So the estate can take custody of Litecoin and has no path to send it back, and the reason has
nothing to do with Litecoin. Filed as **micro-org#267**. It will block BTC and DOGE identically —
same family, same auth scheme — which is why it moves to the front of §4.

**2.2 Litecoin deposits credit with no solvency check whatsoever.**
`deploy/compose/docker-compose.estate.yml:1009` reads `LEDGER_RECONCILE_ASSETS: "SHARD,EMBER"`.
This is gap G6 in [35-chain-solvency-invariant](35-chain-solvency-invariant.md):129-133. The
reconciliation machinery exists and is proven — `estate-verify.sh` demonstrates it for EMBER,
including a deliberate failure injection that freezes the asset and a clean run that lifts the
freeze — but Litecoin is simply not named, so none of it runs for LTC.

There is a trap here worth stating loudly, because it is the kind that is discovered at the worst
moment. `indexer/src/custody.ts:133-135`: **naming an asset in `LEDGER_RECONCILE_ASSETS` against a
build that cannot observe it freezes that asset permanently**, because only a clean *observed* run
lifts a freeze. So the flip is last, not first, and it is gated on a real observed run.

**2.3 The remaining Litecoin items**, each smaller:

- ~~`WALLET_FEE_QUOTES` carries `LTC: 10000` … "REVISIT once `estimatesmartfee` answers". Now that
  the node is synced, it answers. Measure it.~~ **Done, and the premise was wrong: it will never
  answer.** The node runs `blocksonly=1`, so it holds no mempool, and the fee estimator learns
  only by watching transactions enter a mempool and later confirm — every target returns
  "Insufficient data or no fee rate found" and always will. Filed as **micro-org#268**. The quote
  is instead backed by `getblockstats` `feerate_percentiles`, which work under `blocksonly` and
  are confirmed transactions rather than a forecast: over blocks 3,156,352-3,156,495 (53,590
  transactions) the median block's median feerate is 5 sat/vB and the p90 block's p90 is 36, so
  10,000 litoshis buys a ~141 vB spend about 70 sat/vB. The figure is unchanged; what it rests on
  is not. Bitcoin's node carries the same `blocksonly` posture, so BTC lands here too.
- `ltc:mainnet` is cold-started at record floor **3,154,639** (chain time 2026-08-05 07:08:34 UTC),
  so unclaimed addresses answer `history_unknown` — doc 35, "A derived number is only a balance
  with two proofs". This entry previously said 3,155,209, which is not the floor: it is where the
  live follower took over from the `backfill:3154639-3155208` stream, and the stream's name was
  read as the record's start. Measured in `indexer.blocks`: 1,882 rows, min 3,154,639, max
  3,156,520, `count == span`, so the range is contiguous with no holes. Re-read it before relying
  on it — the follower advances and a reorg or prune moves it.
- Settlement never makes the `freshlyDerived` claim, so a pinned treasury needs an
  operator-supplied `historyFromHeight` — doc 35, same section. Note that `deriveBalances` refuses
  on **any** watched row with a null claim, not just the one being asked about, so the two legacy
  LTC deposit rows need a claim before the aggregate can answer at all. Both were derived above
  the floor (heights ≈3,154,705 and ≈3,155,241), so claiming the floor for them is honest and no
  sub-floor backfill is required.
- No LTC entry in `LEDGER_ASSET_TOLERANCE`. Deliberate — absence means zero, which is the correct
  default and should stay zero unless a real drift argues otherwise.
- `foresight` refuses LTC stakes with a "not yet, and here is what is missing" message
  (`foresight/src/server.ts:794,846`). The DB rationale row is now stale: LTC *is* in
  `ON_CHAIN_ASSETS` and *is* priced.
- No Litecoin testnet3 node — testnet is `-regtest` only.

---

## 3. What each new chain needs

### 3.1 BTC — the cheapest of the three

Bitcoin is already an `AssetCode`, already has a `CHAINS` spec, and is already mapped in all four
pricing venues. `indexer/nodes/bitcoin.conf` already exists (rpcport 50001, `disablewallet=1`,
`blockfilterindex=1`, the same posture as Litecoin's). `indexer/src/bitcoin.ts:497 BitcoinWorker` is
family-dispatched and serves BTC unmodified.

What is missing is **configuration, not code**: `INDEXER_RPC_BTC_MAINNET`, an `INDEXER_CHAINS`
entry, a start height, a `SETTLEMENT_RPC_URLS.btc` entry, a `WALLET_FEE_QUOTES` figure measured
from `estimatesmartfee`, a pinned and booked treasury, and finally the `LEDGER_RECONCILE_ASSETS`
flip. Blocked only on the sync finishing.

### 3.2 DOGE — a UTXO chain that is not Litecoin

Dogecoin is family `bitcoin` and reuses `BitcoinWorker`, but three details differ and each is a
place a copy-paste from Litecoin produces a wrong address or a wrong key:

- **No segwit, no bech32.** Dogecoin addresses are base58: P2PKH version byte `0x1e` (addresses
  begin `D`) and P2SH version `0x16`. Litecoin's `ltc1q…` bech32 path must not be reached.
  `indexer/src/btcaddress.ts:35` types `BtcChain = 'btc' | 'ltc'` and its params table at :97-115
  is where this lands.
- **SLIP-0044 coin type 3** (BTC 0, LTC 2). `custody/src/hd.ts:66-72`.
- **~1 minute blocks**, so a confirmation count copied from Litecoin's 12 would be four times
  shallower in wall-clock terms than it looks.

Dogecoin also has no `estimatesmartfee` worth trusting at low fee rates and a much higher dust
threshold; `settlement/src/bitcoin.ts:548` is where the per-chain dust figure goes.

### 3.3 ETC — an EVM chain, and the generic EVM path already exists

This is the good news of the three. `indexer/src/evm.ts:439 EvmWorker` takes `family` as a field and
already serves both `'evm'` (ETH) and `'ember'` (Hearth); `settlement/src/evm.ts:422 evmChain()` is
likewise generic and reads the chain id from `eth_chainId` rather than from configuration;
`custody/src/chains.ts:65 isEvmFamily` and `:77 expectedEvmChainId` enforce the EIP-155 binding.
[29-native-assets](29-native-assets.md):105-110 records the precedent: a second EVM network is one
new asset code and one new spec, zero new families.

Two ETC-specific judgements, both of which must be written down in source rather than assumed:

- **Chain ids are 61 (mainnet) and 63 (Mordor testnet).**
- **Confirmation depth must be much deeper than Ethereum's.** ETC is a low-hashrate proof-of-work
  chain that has suffered real 51% attacks with reorgs thousands of blocks deep (2020). A depth
  copied from ETH would be a solvency hole rather than a latency preference. This is the single
  most consequential number in the whole track.
- **ETC is legacy gas, not EIP-1559** — it did not adopt London. [35](35-chain-solvency-invariant.md):104-116
  requires EIP-1559 chains to book gas from the receipt before being reconciled; ETC falls on the
  other side of that line, which should be recorded as a fact rather than left to be rediscovered.

Also: `indexer/src/custody.ts:432 CHAIN_READ_FAMILIES` reads EVM balances with `eth_getBalance`, so
ETC is observable for reconciliation **without** any of the UTXO derivation work that Litecoin
needed. ETC is the least work of the three per unit of capability.

### 3.4 Pricing, which gates everything

`contracts/packages/chain/src/index.ts:346-355` states the rule: **wire and prove the price sources
before widening `ON_CHAIN_ASSETS`.** `pricing/src/rates.ts:55-59` derives `MARKET_ASSETS` from
`ON_CHAIN_ASSETS`, and `pricing/src/sources.ts:96` asserts every market asset appears in all four
venue maps. BTC needs nothing. DOGE and ETC need five entries each, every one of them **measured
live rather than guessed** — Kraken's legacy X/Z naming is a recorded trap in this file (Litecoin's
key set is `['XLTCZUSD','LTCUSD']`, and Dogecoin on Kraken is historically `XDG`, not `DOGE`).

---

## 4. Order of work

The code order is not the sync order, because code can land ahead of a node and configuration
cannot land ahead of one.

0. **Fix `settlement`'s RPC authentication** (§2.1, micro-org#267). It is ahead of everything
   because it is not a Litecoin item at all: it is the one transport defect that will otherwise be
   rediscovered separately for BTC and again for DOGE. One line, and it unblocks every
   Bitcoin-family withdrawal the estate will ever build.
1. **Finish Litecoin** (§2). It is the only chain synced today, and it is the template that proves
   the path. Withdrawal wiring first, reconciliation last and gated on an observed run.
2. **`pricing` venue maps for DOGE and ETC** (§3.4), verified live. Must merge before 3.
3. **`contracts`: DOGE and ETC asset codes and specs** (§3.2, §3.3). Merging this reddens every
   consumer, which is the forcing function working; do not merge it on a Friday.
4. **The consumer sweep** — indexer, custody, wallet, settlement, ledger, sdk, hub-web,
   explorer-web, network-site, foresight. Parallelisable by repo once 3 has merged.
5. **Settle the indexer's storage cost** (§6, micro-org#253) — before BTC is followed, not after.
   Following BTC writes 4.05 GB/day into a Postgres volume with 268 GB free; together with LTC
   that is 52 days of headroom. This is the one step whose deadline is set by a disk rather than
   by a dependency.
6. **BTC configuration** the moment its sync completes (§3.1). ~31 days out at the current rate.
7. **DOGE and ETC node provisioning and configuration**, in the owner's stated sync order. DOGE is
   held behind BTC deliberately: they share a spindle and an uplink (§6).
8. **The pool** (§5) — `micro-pool` then `micro-pool-web` (§5.4). Depends on nodes, but on none
   of 1-7, so it can be built in parallel with them.

Steps 1-4 are code and can proceed today. Step 5 is code and is now the critical path, because
its deadline is a disk filling rather than a sync finishing. Steps 6-7 are blocked on syncs that
are days to weeks away.

---

## 5. Mining: what a browser can and cannot do

### 5.1 The arithmetic, stated once and plainly

The estate's own measured figure for the EMBER browser miner is **225 hashes per second per
thread** (`network-site/src/content/facts.ts:182-186`), for Homefire — a memory-hard function that
does roughly 8,450 sequential SHA-256 rounds per attempt (`hearth/docs/mining.md:189-191`). A bare
SHA-256d loop is far lighter, so a browser tab doing Bitcoin's proof-of-work would reach perhaps
10⁵-10⁶ hashes per second across all threads.

One current-generation Bitcoin ASIC does about 2×10¹⁴. The Bitcoin network does about 10²¹.

A browser tab is therefore on the order of **10⁻¹⁵ of the Bitcoin network**, and about
**one two-hundred-millionth of a single ASIC**. Its expected annual yield is a fraction of one
cent. Scrypt (LTC/DOGE) is the same story six or seven orders of magnitude down from its own ASICs;
Etchash (ETC) is not merely uncompetitive but impossible, because the DAG is four to five gigabytes
and no browser will allocate it — the estate already established the two-gibibyte ceiling for its
own 64 KiB pad at `hearth/docs/pow-parameters.md:111-113`.

**This is not a limitation that effort removes.** Any "browser mining" of these four chains that
paid users anything meaningful would be paying them out of subsidy, not out of block rewards their
hashing produced — an engagement grant wearing a pool's clothes.
[21-engagement-treasury](21-engagement-treasury.md):33-46 already refused exactly that class of
thing, on honesty grounds, when it rejected a consensus carve-out.

### 5.2 Why EMBER is different, and stays different

Homefire is memory-hard and deliberately ASIC-hostile, which is precisely why a laptop competes for
an EMBER block and why `hearth/docs/mining.md:263-264` can honestly say "GPUs and ASICs gain little
to nothing". Browser mining of EMBER is real: measured 2026-08-08, a key generated in the browser
got a valid template from `https://rpc.cloudsforge.online/mining/template` at height 6,777, and
`hearth/node/src/chain/header.js:240-270` verifies the returned `powSig` against that same
`coinbasePub`. **It is the estate's one genuinely distinctive first action and nothing in this
track may weaken it.** Merge-mining EMBER onto Scrypt was considered and rejected: it would hand
the chain to Litecoin ASICs, and it would make the apex hero headline — "Mine EMBER on the computer
you already own", `site/src/content/pages.ts:38`, asserted by a test — false.

### 5.3 What to build instead: a real pool

A pool for real hardware. Miners with ASICs and GPUs point at CloudsForge over Stratum, submit
shares against a difficulty we set, and are credited in ledger balances they can then spend
anywhere in the ecosystem. Nothing about it requires a claim that is not true.

**Nothing of this exists today.** Measured across all 66 repositories: zero hits for
`getblocktemplate`, `submitblock`, `getwork`, `stratum` (the single hit is
`hearth/node/src/mining.js:12-13` *denying* that it is a stratum server), `auxpow`, `ethash`,
`randomx`. There is no share concept anywhere — `hearth/node/src/chain/header.js:257` accepts only
a proof meeting the full block target, so there is no vardiff, no share target, no share
accounting. And there is no path from hashing to a ledger balance: the only mining credit in the
estate is direct EVM state (`hearth/node/src/chain/blockchain.js:376-386`) and the only ledger
credit is a confirmed deposit (`wallet/src/deposits.ts`).

So this is a new repository, `micro-pool`, and the shape is:

| Piece | What it is |
| --- | --- |
| Stratum v1 server | TCP; `mining.subscribe` / `authorize` / `set_difficulty` / `notify` / `submit`. v1 rather than v2 because v1 is what deployed hardware speaks |
| Template source | `getblocktemplate` against our own `bitcoind` / `litecoind` / `dogecoind`, and the EVM work path for ETC. One node per chain, all already on the host |
| Vardiff | Per-connection difficulty targeting a steady share rate. This is the piece the estate has no precedent for at all |
| Share validation | Recompute the header, check against the *share* target, and against the block target for a win. Reject stale by job id |
| Accounting | PPLNS over a sliding window. Shares are a debt record, not money |
| Payout | Credit the ledger, reusing the `credit_key` idempotency shape from `wallet/src/deposits.ts:580` rather than inventing a second one |
| Honesty surface | Published pool fee, published payout scheme, per-worker share history a miner can check against their own machine |
| `micro-pool-web` | The surface all of that is read through. §5.4 |

Two rules this repository inherits and must not bend. **Found blocks are the pool's revenue and the
miners' claim on it; the pool's own fee is disclosed on the page, in a number derived at runtime
from the same constant the accounting uses** — the estate's rule against unbacked numbers (32 §1.1)
applies here more sharply than anywhere, because this one is about money. And **`network-site` must
say, in its own voice, that browser mining is EMBER-only and why** — `copy.ts:517-523` already says
"None exists, and nothing in the protocol prevents one from being built", which is the honest
sentence to replace when one does exist.

### 5.4 The pool needs a surface, and it is not like the other surfaces

`micro-pool-web`, routed at `pool.cloudsforge.online` (and `pool-testnet.` under the estate's
one-label scheme). It is a new repository and a new entry in `deploy/compose`, the gateway registry
and `34-service-catalogue`.

It differs from every other public surface in the estate in one respect that shapes the whole
design: **its primary user arrives with a machine, not a browser.** A miner's first question is
"what do I point at you", their second is "is my hardware actually working", and their third — the
one that decides whether they stay — is "can I check that you counted my shares". Everything else
is secondary.

| Route | Public? | What it must do |
| --- | --- | --- |
| `/` | yes | The connection string, per chain, copyable in one click. Pool fee and payout scheme as numbers derived from the accounting's own constants, never typed. Current pool hashrate, connected workers, last block found — or a named hole if none has been |
| `/start` | yes | The actual commands for the actual common miners, per chain. This is documentation as product; a miner who has to guess the `-u` format leaves |
| `/workers` | account | Per-worker hashrate, share counts, accept/reject/stale rates, last-seen. The rejected and stale columns are not optional — hiding them is how pools lose trust |
| `/shares` | account | The miner's own share history, at enough resolution to reconcile against their machine's local log. §5.3's checkability requirement lands here |
| `/payouts` | account | Every payout, its shares, its window, and the ledger entry it created |
| `/blocks` | yes | Every block the pool has found, with its height, its value and its distribution. Empty until one is found, and honestly empty |

Three rules it inherits. **Every number is derived at runtime or bound by a test to the constant it
describes** (32 §1.1) — this surface is mostly numbers and most of them are about money, so the
rule bites hardest here. **Render a named hole, never a plausible screen over nothing** (32 §1.2) —
a new pool has no blocks, no luck history and no averages, and the empty states are the deliverable
until it does. And **no yield figure of any kind** until there is a measured one; "earn up to" is
the single most common lie in this product category and the estate has a rule against it already.

It is also the one surface in the estate with a genuine case for its own visual direction rather
than the shared spine's defaults. Every other frontend is a product page or an operator console;
this one is an instrument panel, read at a glance, often on a second monitor, by someone who is
comparing it against three other pools' dashboards. Monospace and density are the subject's own
vernacular, not a style choice. It should still consume `ui/packages/ui` for chrome, tokens and
accessibility floor — the estate does not need a seventeenth spine — but the data surfaces
themselves should be designed for the reading, not inherited from a marketing layout.

### 5.5 What this track does not claim

It does not claim a browser will ever mine Bitcoin. It does not claim the pool will be competitive
on fee against established pools on day one. It does not claim any yield figure — there is no
measured one, and 32 §1 forbids inventing it. And until the pool has found a block, the page must
say that too.

---

## 6. Risks

- **Naming an asset in `LEDGER_RECONCILE_ASSETS` before it can be observed freezes it permanently**
  (`indexer/src/custody.ts:133-135`). The flip is the last step of each chain, never the first.
- **Depositing before withdrawing works** is the shape of defect that costs money rather than
  trust. It is the state Litecoin is in today (§2.1) and the reason §4 puts withdrawal wiring
  first.
- **ETC's confirmation depth** (§3.3) is a solvency parameter dressed as a latency preference.
- **Dogecoin address handling** (§3.2) is where a Litecoin copy-paste silently produces an
  unspendable address.
- **A pool holds other people's expected revenue.** Share accounting that loses shares is
  indistinguishable, from the miner's side, from a pool that steals them. The share history has to
  be checkable by the miner against their own machine, which is a product requirement and not a
  nicety.
- **Disk, measured — and it is the indexer's Postgres, not the chain data.** The chains are fine:
  `/data` is 2.0 TB with 1.2 TB free, holding Bitcoin (697 GB), Dogecoin (112 GB), Litecoin and a
  1.9 GB ETC stub. The constraint is elsewhere. Docker's volume root is
  `/var/snap/docker/common/var-lib-docker`, which sits on `/dev/sda2` — **440 GB with 268 GB
  free** — and that is where the indexer database lives.

  Following `ltc:mainnet` cost **1541 MB over 751 blocks** between 2026-08-08 and 2026-08-09
  (indexer DB 2249 → 3790 MB), which is 2.05 MB per block, **6.3 KB per transaction**, indexes
  included. `watched_addresses` did not move from 245 across that window: the cost is a function
  of Litecoin's transaction volume, not of how many addresses the estate watches. Costing the
  nodes' own `getchaintxstats` at that rate:

  | chain | tx/day | Postgres/day | per year |
  |---|---|---|---|
  | `ltc:mainnet` | 173,726 | 1.07 GB | 391 GB |
  | `btc:mainnet` | 658,777 | **4.05 GB** | 1.48 TB |

  Both together fill the remaining 268 GB in **52 days**, and that is two chains of four. This
  gates §4: it has to be settled before BTC is followed, not after. The mechanism and the fix are
  in micro-org#253 — `bitcoin.ts` computes the watched set already and spends it gating the
  *event* rather than the *row*, and the selective source that `btcsource.ts` was designed around
  is built but unreferenced.
- **Dogecoin is 2.6 years behind, and syncing it competes with Bitcoin.** The node holds 112 GB
  with `txindex=1` and a config repaired on 2026-08-08, but its tip is height 5,008,594 dated
  2023-12-16 — roughly 1.37M blocks short. Bitcoin is at 75.3% (868,781 of 961,638) and gaining
  about 126 blocks/hour, so ~31 days out on its own. The two share one spindle and one uplink, so
  DOGE stays stopped until BTC is done. That is the stated order anyway (§4), but it is now a
  measured constraint rather than a preference.

---

## 7. Open decisions

1. **Pool fee.** Not chosen. It is a business decision, it must be a single constant the page
   derives from, and it should be chosen before the first miner connects rather than after.
2. **Payout asset.** Credit miners in the coin they mined, or convert to Shards at the pool's
   quoted rate? The former is honest and simple; the latter is what makes mining feed the
   ecosystem. Probably the former, with conversion offered rather than imposed.
3. **Minimum payout and who pays the withdrawal fee.** Every pool has this and every pool's users
   argue about it. Decide it in the open and publish it.
4. **Whether the pool mines EMBER too.** It could, and it would give the pool a chain where
   CloudsForge is not a marginal participant. But it competes directly with the browser miner for
   the same blocks, which is the one thing §5.2 says not to weaken.
