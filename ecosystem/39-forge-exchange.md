# 39 — Forge Exchange: an AMM on Hearth, and what has to be true before it opens

**Status when written:** planned. Nothing is deployed on either network, no repository serves it,
and the hostname the registry reserves resolves nowhere on purpose. Written 2026-08-14.

**Status 2026-08-15:** the first three sentences above are no longer true, and the last one still
is. Phases A, B, C and D are **all met**; **the full set is live on testnet 7412 with one funded,
traded pool, and a wallet that is not ours has completed the whole cycle through it from the browser
extension** (blocks 17022–17034). Nothing is on mainnet, no frontend serves it, and
`exchange.<apex>` still resolves nowhere — which is why §6's phase table, not this line, is where
the state is kept. Read that table first: it carries what each gate proved and what each did not.

The deployment note is [`deploy/docs/hearth-exchange.md`](https://github.com/cloudsforge-online/micro-deploy/blob/main/docs/hearth-exchange.md)
— addresses, reserves, the four failures already paid for, and how to run the seeder. This document
stays the plan; that one is the record of what is on the chain.

**Design authority** for Forge Exchange. Where it disagrees with
[`hearth/docs/evm-spec.md` §7](https://github.com/cloudsforge-online/hearth/blob/main/docs/evm-spec.md),
that document wins on the contracts and this one wins on the product, the liquidity and the order
of work. Where it disagrees with **35** on what a chain owes before its coin is credited, **35**
wins — that invariant is the reason §4 of this document is as long as it is.

Decision record: the owner's instruction to plan the exchange and put it in the ecosystem, with
liquidity coming from the project's own mining rather than from a sale.

---

## 0. The thing itself, in one paragraph

A decentralised exchange written as contracts on Hearth: pools that hold EMBER against other
coins, priced by a constant product rather than by an order book, swappable from any wallet with
no account, no listing and no venue holding the coins. It is not Forge Trade. Forge Trade runs a
strategy on a customer's behalf against a price feed, over balances this platform is custodying;
Forge Exchange would custody nothing, and the code that moves the pool would be public and
unprivileged.

---

## 1. What already exists, and this is more than the page implies

The first draft of the marketing page said *"none of it is built. There is no repository."* That
was wrong in the direction this estate keeps failing in — understatement, which nobody
investigates — and it was wrong by one `ls`:

| Piece | Where | State |
| --- | --- | --- |
| `WEMBER` (WETH9 port), `HearthV2Factory`, `HearthV2Pair`, `HearthV2Router02`, `HearthV2ERC20`, `Multicall3` | `hearth/contracts/src/` | **written**, solc 0.8.26, shanghai target, 22 build-level assertions |
| Libraries — `Math`, `UQ112x112`, `TransferHelper`, `HearthV2Library` | `hearth/contracts/src/libraries/` | all `internal`, so nothing needs library linking at deploy time |
| The end-to-end proof | `hearth/node/test/dex.js` | **167/167.** Deploys the contracts, checks `pairCodeHash()` against the router's compiled constant, lands the pair at the `CREATE2` address `pairFor` derives off-chain, mints the first liquidity, swaps, swaps back through the native-EMBER path, exercises `permit` in both low-s and flipped-v forms, removes liquidity with permit, and checks the logs **and the bloom** |
| The chain underneath | `hearth/node/` | mainnet chain id 7411 at `rpc.cloudsforge.online`, testnet 7412 at `rpc-testnet.cloudsforge.online`, both mining |
| A way to deploy arbitrary bytecode | `hearth` CLI (`node/bin/hearth.js` — `deploy`, `send`, `call`, `trace`) | present |
| A wallet that signs for Hearth | `micro-hearth-wallet-core`, `micro-wallet-extension` | present |

Two things follow, and they are the reason this document exists at all rather than a phase list.

**First, the hard half is done.** `dex.js` is not a unit test; it is the phase-7 gate of the EVM
specification, and it is the strongest single statement anyone has made about this project's
interpreter. Running audited industrial bytecode compiled by people who had never heard of our EVM
exercises `CREATE2`, deep `CALL` chains, `ecrecover`, `SSTORE` refunds, memory expansion,
revert-with-reason and the 63/64 rule *in combination* — a swap costs 112,456 gas against
mainnet's ~150,000, which is a claim about correctness, not about thrift.

**Second, everything a person would touch is missing.** Nothing is deployed to either chain, there
is no pool holding anything, no frontend, no repository for one, no bridged or wrapped asset to
trade against, and no liquidity. The gap between "the contracts run" and "a stranger can swap" is
the whole of this plan, and none of it is contract work.

### 1.1 What `dex.js` deliberately does not prove

Stated because a green run must not be read as more than it is, and because the file itself says
so: Uniswap V2 contains no `DELEGATECALL`, never reaches `SELFDESTRUCT`, never touches the bn128
precompiles, and never re-enters through a flash swap's `hearthV2Call`. Those rest on the
conformance vectors alone. The first contract to exercise `DELEGATECALL` on Hearth will be a proxy
somebody else deploys — which is an argument for the estate deploying one deliberately, on
testnet, before a stranger does it by accident.

---

## 2. The contracts, and the three traps in deploying them

Uniswap V2 rather than V3, settled in `evm-spec.md` §7 and not reopened here: far simpler,
thoroughly audited, thoroughly understood, and its maths need no concentrated-liquidity tick
machinery. The cost is capital efficiency, which matters to a venue with competitive market makers
and does not matter to a venue whose liquidity is its own.

**Trap 1 — the init code hash.** `HearthV2Library.pairFor` derives pair addresses from a
hard-coded `INIT_CODE_HASH` rather than asking the factory. A mismatch does not error: the router
looks for pools at addresses where none exist and returns empty quotes. The hash the router is
compiled with today is `0x46b4122ae9db4a03c913cfbed4e6321064741545c60aafe3ed9410be7657a537`, and
the factory exposes `pairCodeHash()` for exactly this comparison. **Compare them against the live
factory before a single unit of liquidity is added**, on each network, and record the result in the
deployment note. `dex.js` already does this in-process, which is why it belongs in the deployment
runbook too.

**Trap 2 — `feeToSetter` must never be a deployer EOA.** It controls where protocol fees go, with
no timelock and no two-step handover anywhere in V2: whoever holds that key redirects the fee
switch in one transaction. It has to be a multisig **from the moment the factory is deployed**,
because moving it later requires the very key you are trying to stop relying on. **The estate has
no multisig contract today** — nothing in `hearth/contracts/src/` is one, and `micro-mint` can
deploy only three committed ERC-20 variants (`fixed`, `mintable`, `foundry`), so it cannot deploy
one either. Writing, testing and deploying a minimal *m*-of-*n* is therefore a prerequisite of the
factory, not a follow-up, and it is the first genuinely new Solidity this project would own.

The trap has a second mouth, found in phase E and recorded as
[hearth#25](https://github.com/cloudsforge-online/hearth/issues/25): the switch can be **deleted**
as well as redirected. `setFeeToSetter(address(0))` succeeded, and after it the role does not exist
rather than belonging to someone else — same unrecoverable cost as above, reachable by pasting a
truncated address into a proposal. The factory now refuses zero there, and still allows it in
`setFeeTo`, where zero is what "fee off" means.

**Trap 3 — the estate cannot read its own contracts.** `micro-explorer-web` reads
`micro-indexer`'s REST routes rather than `eth_*`, and has no contract disassembly; the
EVM-aware explorer that did have it stayed behind in `hearth/` when the surface moved out on
2026-08-04. Hearth's `tools/explorer-api/` (Etherscan-compatible) and `tools/verify/`
(`forge verify-contract`-compatible) exist and are tested, and neither is deployed. A DEX whose
pools cannot be inspected by the project's own explorer is a DEX that asks for trust, so one of
those two has to ship with it.

---

## 3. The liquidity comes out of mining

No sale, no issuance, no round. The estate mines EMBER on two hosts — the app host and the chain
host, two coinbase addresses since 2026-08-10 — and mines BTC and LTC (with DOGE merge-mined under
AuxPoW) through `micro-pool`. The plan is that the first side of the first pool is EMBER the
project's own miners have already earned, and that each pool is thereafter topped up from the
mining income of the coin it trades.

Three things this obliges the plan to say out loud:

1. **Project-owned liquidity takes the impermanent loss.** If EMBER moves against the paired asset,
   the pool ends up holding more of the losing side, and the project eats the difference. That is
   acceptable when the aim is a functioning market rather than a return, and it must be stated
   wherever the liquidity is described, because "the project seeds it" reads to most people as
   "the project cannot lose".
2. **A thin pool is a worse product than no pool.** The first swap into an underfunded pool moves
   the price so far that the quote looks like a bug. There is a minimum below which opening is
   dishonest; naming that number is an open question (§7).
3. **Mining income is not free money.** It is the same income the estate is currently using to
   prove solvency of custodial balances. Diverting it into a pool has to be booked, not assumed —
   which is where **35** applies.

---

## 4. The wrapped-asset problem, which is the actual hard part

The product one-liner is "swap EMBER for Bitcoin". Hearth cannot hold Bitcoin. So the Bitcoin in
the pool is a token on Hearth that somebody promises is worth a Bitcoin, and the entire honesty of
this product rests on what that promise is and who is making it.

**Say it plainly: it is a receipt this project issues against coins it is holding.** Not a
trustless bridge, not "wrapped BTC" in the sense of a third-party attested reserve. `evm-spec.md`
§9 already puts bridges out of scope for v1 with one sentence — *"every bridge is a liability; not
until the chain has proven itself"* — and this plan does not reopen that. It proposes something
smaller and more defensible, and requires it to be labelled as what it is:

| | What it is | Who you trust |
| --- | --- | --- |
| EMBER, WEMBER | the chain's own asset | the chain |
| A wrapped BTC/LTC/DOGE receipt | an ERC-20 on Hearth issued 1:1 against coins in `micro-custody`, redeemable through the existing withdrawal path | **this project** |

**25** §1 argues that letting a user confuse custodial with self-custody is the most dangerous
thing a design can do, and that argument applies here with the volume turned up: a self-custody
wallet swapping into a token that is a custodial IOU is exactly the confusion that document is
about. The mitigations are not optional and are not cosmetic:

- The reserve must be **checkable on the chain by a stranger, without asking us** — the addresses
  holding the backing published, the issued supply readable from the token, and the two comparable
  by anyone. **35**'s chain-solvency invariant is the existing machinery for this and already
  demands an observable balance, two coverage proofs, a pinned *and booked* treasury and a
  `byLabelPrefix` breakdown crossing to the ledger. A wrapped asset that cannot satisfy 35 must not
  be issued, and 35's own trap applies: naming an asset for reconciliation before it can be
  observed freezes it permanently.
- The redemption path must exist and be exercised before issuance, not after. The estate's
  withdrawal path for LTC and BTC builds and broadcasts today; DOGE does not have the same
  coverage.
- Every surface that offers the token says whose promise it is, in the sentence that offers it —
  not in a linked disclosure.

**The alternative worth costing before committing:** open with **EMBER-only pairs** — EMBER
against assets already native to Hearth, including anything `micro-mint` issues — and no wrapped
coins at all. That version needs no custody integration, satisfies 35 trivially, ships far sooner,
and is a real exchange for the coin this project actually mines. It is also, honestly, a smaller
product than the page describes, and the page will have to describe it accurately if that is the
route taken.

---

## 5. What a user would see, and what the estate already says about it

- **Registry:** `exchange` is a declared surface in `@cloudsforge/ui` (`surfaces.ts`) with
  `servesUi: false`. It is a `service`, not a `product`, so the marketing grid stays at six cards
  and no seventh accent is invented; it shares the gold accent block with `create` and `pool`. A
  frontend, if one ships, earns its own accent by the documented dE procedure.
- **Routing:** `micro-deploy`'s `EXPECTED_UNROUTED` carries an `exchange` entry — the estate
  declaring, in the file its own CI checks in both directions, that nothing is behind that name on
  purpose. The moment a router appears, that entry must be deleted in the same commit.
- **The page:** `cloudsforge.online/products/exchange`, with a **Planned, not deployed** chip that
  is *derived*: `micro-site`'s `estate-stages.test.ts` fails the build if the key ever appears in
  the estate's compose file, in the smoke tier or in the public tunnel, and separately opens
  `hearth/contracts/src` and `hearth/node/test/dex.js` to keep the page's "the contracts are
  written" claim true. The chip cannot move because the plan feels closer; only because something
  ran.
- **The button:** there isn't one. `products.tsx` renders the outbound link only for a surface the
  registry says serves a UI.

---

## 6. Phases, and the gate on each

Relative order, no dates — the repository policy on estimates is in the README, and the reason a
plan document must not carry them is that a date is the one claim about the future nothing here can
check.

| Phase | Deliverable | Gate |
| --- | --- | --- |
| **A. Multisig** ✅ | a minimal *m*-of-*n* in `hearth/contracts/src/`, with its own tests | signers rotate and a threshold change succeeds on the in-process harness — **met**, see below |
| **B. Readability** ✅ | deploy `tools/explorer-api` or teach `micro-explorer-web` `eth_*`, plus `tools/verify` | a stranger can read a deployed contract's source and its calls without our help — **met**, see below |
| **C. Testnet deployment** ✅ | WEMBER, factory, router, Multicall3 on 7412, `feeToSetter` = the phase-A multisig | `pairCodeHash()` matches the router's constant, recorded in the deployment note — **met** |
| **D. Testnet market** ✅ | one EMBER pair seeded from testnet mining, swapped both ways by a wallet that is not ours | a full cycle — add, swap, swap back, remove — from the browser extension — **met**, blocks 17022–17034, see below |
| **E. Read-through** ✅ | the contracts and the deployment read by somebody who did not write them | findings recorded and closed, in public — **met**, two of them, hearth#25 and hearth#26, see below |
| **F. Mainnet, EMBER-only** ✅ | the same set on 7411, seeded from the two miners | the estate's own solvency reporting books the seeded liquidity — **met**, entry `01a007bc-bb37-7000-8f87-361426a1e9ff`, 24,750.590760 EMBER measured at block 39010, see below |
| **G. Wrapped assets** ✅ | one wrapped coin, issued against custody, satisfying **35** in full | a stranger can compare issued supply to reserves on-chain, and a redemption completes — **met on 7412**, `fLTC` at `0x5ff590f4…2f02`, and mainnet **refused** on a measured reserve of zero, see below |
| **H. Surface** ✅ | a frontend, a router entry, the `EXPECTED_UNROUTED` deletion, the site chip moving on its own | `beacon` drives a swap through the real gateway — **met**, `0x5383d15c…1164`, `status 0x1`, see below |

Phases A and B are prerequisites in the strict sense: neither is exchange work, both are cheap
relative to the rest, and skipping either produces a deployment that cannot be handed to anybody.

### Phase A, done

`hearth/contracts/src/HearthMultisig.sol`, gated by `hearth/node/test/multisig.js` — 143 checks on
the in-process EVM, run in CI's `contracts` job. The gate's two named conditions are the fifth and
sixth groups of that suite: a signer confirms a proposal to threshold, is rotated out with
`replaceOwner`, and the proposal falls back below threshold and stops executing; then
`changeRequirement(3)` executes and binds a proposal that already had two confirmations under the
old threshold.

Four decisions in that contract diverge from the Gnosis wallet it resembles, each argued in the
source. The one that matters here is that `confirmationCount` walks the live owner list on every
read instead of keeping a tally, which is what makes a rotated-out signer's vote stop counting the
moment they are removed rather than at some later reconciliation.

It also drives a real `HearthV2Factory` end to end: the deploying EOA is refused with the factory's
own `FORBIDDEN` throughout, the wallet sets `feeTo` at full threshold, and `feeToSetter` is handed
to a successor multisig — the operation §2's trap 2 says cannot be recovered if the holder is a key
we do not control. Gas for that handover is 88,384.

Phase C consumes this: the multisig is deployed **first**, and its address is the constructor
argument to the factory. It cannot be retrofitted, which is why it is not phase Z.

### Phase D, done — and this section is the record of how the second half was closed

**The mechanical half, first.** One pair, EMBER against a Forge Create token, seeded out of testnet
mining and put through a full cycle at block 16792 by `deploy/scripts/hearth-dex-seed.js`:

| | |
| --- | --- |
| forward swap | filled at **exactly** the quoted 1,239.348445 FTEST |
| reverse swap | filled at **exactly** the quoted 24.851047 EMBER |
| round trip cost | 0.148952 EMBER — the 0.30% fee, charged twice, as it should be |
| *k* | rose on both legs |
| withdrawal | 3,181.980515 LP burned; price held at ~50 FTEST/EMBER across a proportional exit |

**That was not the gate**, and this document said so for a day. The gate says *"swapped both ways by
a wallet that is not ours"* and *"a full cycle … from the browser extension"*, and every transaction
in the table above was signed by the key that is also the chain's coinbase. A script is not a user:
it builds calldata the router expects because the same author wrote both, whereas the extension has
its own encoder, its own gas estimation and its own idea of a deadline, and *those* are what a
stranger's swap goes through.

**Closed on 2026-08-15, blocks 17022–17034**, by `wallet-extension/test/e2e/exchange.test.ts` — six
tests, seven transactions, none of them signed by anything this repository can sign with.

*Three keys, on two machines, and the separation is the point:*

| | | |
| --- | --- | --- |
| **coinbase** | `0x91a1…1d33` | the house. Mines the chain, deployed the exchange, seeded the pool. On the chain host. |
| **funder** | `0x41Fb…c80E` | generated on the developer's Mac, never on a chain-host disk. Given 60 EMBER by `deploy/scripts/hearth-fund.js` — a plain transfer, which is all that script can do. |
| **trader** | `0xc40b…522D` | created by the extension during onboarding *in that test run*, from a phrase nothing else ever saw. Funded with 12 EMBER by the funder. **The test never holds its private key and cannot sign for it.** |

*What it did, all of it through `eth_sendTransaction` on an EIP-6963 provider with a human-shaped
click on each approval window:*

| block | gas | operation |
| --- | --- | --- |
| 17022 | 120,268 | `swapExactETHForTokens` — 4 EMBER → **199.191327 FTEST**, exactly the quote |
| 17024 | 46,407 | `approve` the router for the token |
| 17026 | 146,785 | `addLiquidityETH` — 99.595663 FTEST + 1.995969 EMBER → 14.098822 LP |
| 17028 | 46,407 | `approve` the router to sell |
| 17030 | 112,569 | `swapExactTokensForETH` — 99.595663 FTEST → **1.989005 EMBER**, exactly the quote |
| 17032 | 46,196 | `approve` the router for the LP token |
| 17034 | 179,067 | `removeLiquidityETH` — 14.098822 LP → 99.644671 FTEST + 1.994990 EMBER |

*What the numbers say, beyond "it did not revert":*

- **Both swaps filled at exactly the quoted amount**, and the quote itself was checked against the
  constant product computed independently from `getReserves()` at a pinned block before either trade
  was sent. A router that disagreed with its own reserves would have stopped the run before it spent
  anything.
- ***k* rose on both legs.** The 0.30% is charged twice and stays in the pool, which is the whole
  economics of the thing; a round trip that returned more than it took would be a broken market, not
  a generous one.
- **The position earned while it was open.** 99.595663 FTEST went in and **99.644671** came out —
  0.049008 FTEST of fee accrued to the trader *as a liquidity provider* from the reverse swap that
  happened while they held it. That is the first time in this project's history that a fee has been
  paid to somebody other than the house.
- **The round trip cost the trader about 0.017 EMBER**, against 0.018 of fees charged, the
  difference being their own LP share coming back — the arithmetic an AMM is supposed to produce.
- **The senders were recovered from the signatures**, by `hearth/node/src/chain/transaction.js` —
  the network's own decoder — from the raw bytes the extension put on the wire, captured by the
  pass-through recorder the wallet's suite already uses. `eth_getTransactionByHash`'s `from` field
  was deliberately not used: the node fills it in by doing the recovery, so trusting it would be
  circular. All seven recovered to `0xc40b…522D`.

*What is still not proved, stated so nobody has to guess:* the run was sequential, so no second
trade arrived between a quote and its settlement. Slippage under contention is a phase-H property —
it needs a frontend and more than one person — and the earlier version of this section was right
that a single-participant pool cannot show it. What phase D asked for, and now has, is that a second
implementation of the client, holding a key we do not, can complete the whole cycle.

Reproducing it needs no chain-host access:

```
HEARTH_RPC_URL=https://rpc-testnet.cloudsforge.online/ HEARTH_CHAIN_ID=7412 \
HEARTH_COINBASE_KEY=~/.cloudsforge/ember-testnet/e2e-funder.json \
HEARTH_DEX_ROUTER=0xba2b9db822e1f2ec3039fe474644b8405268a9b4 \
HEARTH_DEX_TOKEN=0x71550efb54bcaccbe84df3efcc3529eae4be8a32 \
node --import tsx --test --test-concurrency=1 --test-timeout=900000 test/e2e/exchange.test.ts
```

The honest claim is now **"the market works"**, for one pair, one trader and one client.

**And it is a gate rather than an anecdote.** A cycle run once by hand proves the day it ran; the
same six tests now run on every pull request to `micro-wallet-extension`, against a market the CI job
stands up itself — `hearth/contracts` compiled with the pinned solc, the pool's token taken from
micro-mint's committed catalogue, and both `hearth-dex-deploy.js` and `hearth-dex-seed.js` invoked
from `micro-deploy` rather than reimplemented in the test repository, so a change to how the estate
deploys an exchange breaks the wallet's CI instead of drifting quietly away from it. The suite refuses
to invent a market: with no deployment file to read it throws, so a chain without a pool fails the run
rather than skipping the only tests that trade. First green run, 2026-08-15: **39 tests, 0 failures**,
the same four operations at 120,268 / 146,785 / 112,569 / 179,067 gas — gas identical to testnet's,
which is what one expects from identical bytecode and is worth recording as the check that it is.

What CI does *not* reproduce is the key separation. Its chain is minutes old and has exactly one
funded account, so there the funder is the coinbase; the trader is still generated inside the
extension, and the test asserts the three addresses differ rather than assuming it, which is why that
assertion is a test. **"A wallet that is not ours" stays proved by the testnet run above**, and CI
proves the browser half of it continuously.

### Phase E, done — and the second finding is one this document had asserted was impossible

The gate is *"findings recorded and closed, in public"*. Two findings,
[hearth#25](https://github.com/cloudsforge-online/hearth/issues/25) and
[hearth#26](https://github.com/cloudsforge-online/hearth/issues/26), both fixed in
[hearth#27](https://github.com/cloudsforge-online/hearth/pull/27), merged and closed on 2026-08-15.

**Who did the reading, said plainly, because the deliverable says "somebody who did not write
them".** Slither 0.11.6 against solc 0.8.26 under this repository's own settings — `--optimize
--optimize-runs 999999 --evm-version shanghai`, since a contract analysed under different settings
is a different contract — 139 results across 34 files, every High and Medium walked line by line,
plus a re-read of the two contracts this project actually owns. **That is a tool and a re-read, not
a bought audit**, and the difference decides what this phase is worth: an analyser does not share
the author's assumptions, which is most of the value; it also cannot tell you a design is wrong,
which is most of what an audit is for. Nearly every High and Medium is a structural false positive
of a faithful V2 port — the `lock` modifier reads as reentrancy, the balance-before/after design
that makes fee-on-transfer tokens work reads as an unchecked transfer, `block.timestamp % 2**32`
reads as timestamp dependence, and the pair's own LP `transferFrom` reverts rather than returning
false. Of the two that were real, one is the kind of thing a linter mentions in passing — a
parameter with no zero check, listed beside dozens of harmless ones, where the consequence is the
finding and no detector knows the consequence — and the other is invisible to any tool, because it
is a sentence in a docstring being false.

**#25 — one mistyped proposal could delete the fee switch.** `setFeeToSetter(address(0))` succeeded.
After it, no key on earth calls `setFeeTo` or `setFeeToSetter` again: the role is not stolen, it
stops existing, and §2's trap 2 prices the recovery — a new factory, a new router, every pool
migrated. V2 has no acceptance step, so the mistake is one transaction wide and permanent, and a
truncated or empty address pasted into a multisig proposal lands on exactly zero. Fixed with two
`require`s, in the constructor and in the setter. `setFeeTo` still accepts zero, because there zero
is the meaningful "fee off" state; the asymmetry is the point and the tests assert both halves of it.

**#26 — a signer rotated out under suspicion brought their old votes back with them.** The phase A
section above says `confirmationCount` walking the live owner set is *what makes a rotated-out
signer's vote stop counting the moment they are removed*. It stops counting. It was never erased —
the flag was hidden behind the owner walk, and re-adding that address made every confirmation it had
left on a still-pending proposal count again, with the returning signer sending nothing and never
being shown what they now confirm. The rotate-out-and-back case is exactly the one a multisig holding
`feeToSetter` exists for. A confirmation now records the epoch it was given in and counts only within
its confirmer's current tenure; joining takes the next epoch, which is strictly higher than anything
confirmed before it. **Per-owner, not one global cutoff** — a single counter would discard *all*
outstanding confirmations on any owner change, un-confirming a signer who did not go anywhere and
making routine rotations expensive enough to avoid, which is the wrong incentive on this contract.
`confirmedBy` keeps its selector and return type, so nothing off-chain changes.

**Both fixes are regression tests before they are fixes**, each run against the old bytecode first
and failed there — `✗ the confirmation carol gave in her previous tenure is not a confirmation`,
`✗ so the proposal did not gain a vote by her walking back in`, `✗ carol is not "already confirmed",
so she can confirm again` — and all of it replayed through Hearth's own EVM rather than a foreign
one. Green on the fixed source: 28/28 contract build checks, **195/195** in `node/test/multisig.js`,
**167/167** in `node/test/dex.js`, all three in CI on every pull request.

**The deployment was read too, live on 7412, and it reads clean:** `factory.feeToSetter()` is the
multisig `0x51faced7…e4f8` and not an EOA, `feeTo()` is zero, the wallet is 2-of-3 with
`transactionCount()` still 0, `router.factory()` is the documented factory, `router.WETH()` equals
`router.WEMBER()`, and the one pair's address recomputed by CREATE2 from the router's hard-coded
`INIT_CODE_HASH` matches the deployed pair exactly — trap 1, checked against the chain rather than
against the deployment note. Nothing to remediate on-chain, which is what makes both findings
pre-mainnet changes and not incidents.

**Three things this phase deliberately did not turn into findings.** That all three testnet multisig
keys sit on one host is a real weakness and is already written down, in `deploy/docs/hearth-exchange.md`
§3 and in §7's question 3 below; `hearth-dex-deploy.js` refuses to generate owner keys on mainnet and
demands `HEARTH_DEX_OWNERS`, so it cannot be repeated there by accident. Filing it again would be
noise. Whether an outside audit is bought before phase F is question 6 below, and it is about money,
not about code.

**What testnet is running is the bytecode from before all this.** `INIT_CODE_HASH` is unchanged at
`0x46b4122a…7a537` — `bytecodeHash: 'none'` means editing the factory cannot perturb the pair — so
the router's constant still holds and the deployed market is not wrong. But the factory's and the
multisig's own bytecode did change (the wallet grew 8,777 → 8,915 bytes), and **the 7412 deployment
predates both fixes**. Phase F deploys from `main`, not from a copy of what is live.

### Phase B, done

Two services from `hearth/tools/`, deployed by `compose/docker-compose.hearth-devkit.yml` and routed
at `rpc.<apex>` — `Path(/api)` for the Etherscan-compatible index, `Path(/verify)`, `/contracts` and
`/compilers` for the verifier. `explorer.<apex>` was the obvious home and was unavailable: testnet
web hostnames are retired, so `explorer-testnet.<apex>` 302s to the combined view and would have
shadowed any router placed there.

The gate is "a stranger can read a deployed contract's source and its calls without our help", and
both halves were measured before the phase was called done:

- **its calls** — the index followed 7412 to head 16820 with lag 0 and returned the pool's entire
  history over `/api`: the 250,000 FTEST seed at 16753, the swap out at 16763, the swap back at
  16767, the `removeLiquidity` at 16771, the second cycle at 16785. That question — *every*
  transaction touching an address — is the one a JSON-RPC node cannot answer at all.
- **its source** — the verifier recompiled the Forge Create token and returned `matchType: "exact"`
  with `metadataMatched` true. With `HEARTH_VERIFY_URL` set, the index's `getsourcecode` went from
  `"Contract source code not verified"` to 37,989 bytes of Solidity and an 18-entry ABI.
  `constructorArgumentsVerified` is **`0`**, and correctly so: the submission carried no creation
  transaction, so the arguments are recorded and not checked. Re-submitting with `--tx` once the
  index reaches the deployment block flips it.

**Verifying once covers every Forge Create token ever sold — after a defect, found by testing the
claim rather than restating it.** The reasoning is sound: the verifier matches on *runtime*
bytecode, and runtime bytecode carries no constructor arguments, so every token a paid order
deploys is the same bytes with different arguments. `deploy/scripts/hearth-verify-submit.mjs` builds
the input, walking the import graph and inlining all 11 sources, because mint's build resolves
OpenZeppelin through a callback that a verifier compiling in a sandbox does not have.

The software did not do it. NEFELI (`0xf0f009AB…`) and FTEST (`0x71550efb…`) return byte-identical
`eth_getCode` — 1,859 bytes each, diffed — and asking the deployed verifier for NEFELI's source
answered `"Contract source code not verified"`, because `tools/verify` kept one record per address
and every lookup keyed on the address alone. The claim was true about the chain and false about the
service, in this document and in `docker-compose.hearth-devkit.yml`'s header.

[hearth#24](https://github.com/cloudsforge-online/hearth/pull/24) makes it true. Each verified
record is indexed by the code deployed at it, under two keys — the code's hash, and the hash of the
code with its `immutable` slots zeroed, which is what lets a token with 8 decimals resolve against
one with 18. A lookup for an unverified address reads its code and tries both, and a hit returns the
twin's source, compiler and ABI with `twinOf` naming the origin, its own immutable values, and **no
constructor arguments** — those being precisely the part that differs per deployment. A directly
verified record always wins over a derived one, and `/contracts` still lists only submissions.

Deployed the same day, and measured through Cloudflare rather than through the container. Asking for
NEFELI — an address nobody ever submitted — now returns `HearthMatchType: twin-exact`, `HearthTwinOf:
0x71550efb…`, the same 37,989 bytes of source and the same 18-entry ABI as FTEST. The verifier
logged `runtime index backfilled {indexed: 1, pending: 1}` at boot, so the record that predates the
index was picked up without anyone re-submitting it.

One more gap closed with it: `GET /contract/0x…`, which the verifier documents on its own home page,
was never routed and fell through to the RPC as `{"code":-32600,"message":"JSON-RPC requires POST"}`.
It is the one `PathPrefix` on that host — the address *is* the path, so no exact term can name it —
and it carries what the Etherscan shape cannot: `twinOf`, the immutable values read out of the
deployed code, and a `constructorArgumentsNote` saying why the arguments are absent rather than
missing.

### Phase F, done — a mainnet market, and the entry that says where the coin went

**The deployment.** Five contracts on chain 7411, in the order §2 requires, from `main` rather than
from a copy of what testnet is running — `git diff` over `node/src/chain/transaction.js` and
`node/src/crypto/` between the pinned image and `main` is empty, so the signing code that produced
these transactions is the signing code in the repository.

| | address | block | gas |
| --- | --- | --- | --- |
| `HearthMultisig` | `0x39b1743338c9d356030480e484cb1078456c290c` | 38840 | 2,257,657 |
| `WEMBER` | `0xdae7f901bc0ea6cb8a77c160e355007981e351e1` | 38841 | 682,499 |
| `HearthV2Factory` | `0x8e41e083cd664a5d65d047198338e5f110ee883f` | 38843 | 2,907,275 |
| `HearthV2Router02` | `0x74a991fedb2e09aa23faffa9bdf4ca5dbbeb0527` | 38845 | 4,591,711 |
| `Multicall3` | `0xe1636b08ff1edde24b2642a3cb388d4e97dfe0bc` | 38847 | 843,792 |

Every check re-read from the chain afterwards: `pairCodeHash()` equals the router's constant
`0x46b4122a…7a537` (§2 trap 1); `feeToSetter()` is the multisig, set in the factory's constructor
and never held by an EOA for a single block (§2 trap 2); `feeTo()` is unset, so the whole 0.30%
accrues to liquidity providers; the wallet is 2-of-3; `router.factory()`, `router.WETH()` and
`router.WEMBER()` all point where they should; `multicall3.getChainId()` returns 7411.

**The market.** One pair against a Forge Create token — `FXR`, "Forge Exchange Reference",
`0x5ad2f3c60ce75ff7b4c1f533d351dde4db9ec8f9`, deployed at 38849 from `micro-mint`'s own generated
contract source so it is byte-identical to what a paid order produces and inherits phase B's
verification for free.

| | |
| --- | --- |
| seeded, block 38853 | 25,000 EMBER / 1,000,000 FXR — the entire supply, opening price 1 EMBER = 40 FXR |
| LP minted | 158,113.883008, all of it the estate's; 1000 wei burned to `address(0)` on the first mint |
| forward swap | 100 EMBER filled at **exactly** the quoted 3,972.159029 FXR |
| reverse swap | filled at **exactly** the quoted 99.403272 EMBER |
| round trip | cost 0.596727 EMBER — the 0.30% fee, charged twice, and *k* rose on both legs |
| withdrawal, block 38861 | 1,581.138830 LP burned, 1% of the position, returned proportionally |
| after all of it | 24,750.590760 EMBER / 990,000.000000 FXR, 1 EMBER = 39.999045 FXR |

**§7.2 is answered in practice: 25,000 EMBER.** The question was the depth below which a pool is a
worse product than no pool, and the number was chosen against the one order size the estate can
predict — a Forge Create purchase, ~100 EMBER. That swap filled 0.696% below mid, of which 0.30% is
the fee, so the price impact a real buyer meets is about four tenths of a percent. After a full
round trip and a 1% withdrawal the mid price is 39.999045 against the 40 it opened at, 0.0024%
away. Below roughly 5,000 EMBER the same order moves the mid by more than 2% and the quote starts
to look like a bug, which is §3's warning made numeric.

**§7.3 is not answered, and phase F shipped anyway.** The mainnet wallet is 2-of-3 over the miner
coinbase and two keys generated for the testnet deployment, all three of them files on the chain
host at mode 0600. Two of three keys on one filesystem is a threshold in the contract and not in
the world: whoever has root there has quorum. What that quorum can do is bounded — `feeToSetter`
sets `feeTo` and nothing else, it cannot touch reserves, and the LP tokens are held by the deployer
EOA, not the wallet — so the exposure is the protocol fee switch, not the liquidity. It is recorded
here rather than left implicit because the phase-A section claims a multisig, and on mainnet today
that claim is about the code, not about the key custody. Fixing it means deciding who signs and on
what devices, then `replaceOwner` from the current threshold.

**The gate: the estate's books now say where the coin is.** `deploy/scripts/hearth-dex-book.js`
posts one entry, and the design decision inside it is what the gate was really asking for:

```
DEBIT   platform/EMBER/reserved   (asset)    the position: owned, illiquid
CREDIT  platform/EMBER/treasury   (equity)   mining income, now recognised
```

**Not `custody`, and the pair is not registered with the indexer.** `ledger/src/reconcile.ts`
compares exactly `(type = 'asset', subject = 'custody')` against every address the indexer watches
under `deposit:`/`treasury:`, and EMBER's tolerance is zero. An AMM reserve is a number nobody
controls — it moves in the same block a stranger swaps — so putting it on either side of an
equality with no slack would freeze every EMBER withdrawal on the estate the first time somebody
traded, and the freeze would be *correct*. [35](35-chain-solvency-invariant.md) G1 calls the
opposite mistake, an address watched but not booked, "an invented insolvency"; this is its mirror
image. The script asserts it rather than asserting about it: it reads `custody/EMBER` before and
after and fails if the number moved, and the service token it mints carries `ledger:post` and
`ledger:read` only — the indexer scope is the one power it exists to refuse.

The amount is the estate's **claim**, `reserveEMBER × lpHeld ÷ lpTotalSupply`, read at one block
with the head taken either side and the whole read repeated if it moved. Not "what was sent to
`addLiquidity`", because the seeding run removes part of the position on purpose and a stranger's
swap changes the split immediately — and because a claim is recomputable by anyone with an RPC
endpoint, which is the property **35** is built on. Every input is in the entry's metadata.

The entry that closed the gate is `01a007bc-bb37-7000-8f87-361426a1e9ff`, recorded 2026-08-15
23:23:24Z: **24,750.590760116509394297 EMBER** into `platform/EMBER/reserved` against
`platform/EMBER/treasury`, measured at block 39010 with `reserveEmber`, `lpHeld`, `lpTotalSupply`,
`lpHolder`, `contributedEmber` and `contributedAtBlock` all in its metadata, so the arithmetic can
be redone from the chain without trusting the script. `custody/EMBER` read 79,724.826387545 EMBER
before it and 79,724.826387545 after; the last EMBER reconciliation is clean at drift 0 and no
asset is frozen. Re-running the script is a no-op — `hearth-dex-book:7411:<pair>:seed` is the
idempotency key, so the position cannot be booked twice by a second operator repeating the runbook.

This required a new entry kind. `treasury_spend` is a payment to somebody and the pool pays nobody;
`conversion` is one asset becoming another at a rate and liquidity puts *both* sides in;
`transfer` needs two subjects who each still hold what they held. So `liquidity_seed` was appended
to `ENTRY_KINDS` (micro-contracts#13, `@cloudsforge/contracts-money` 1.3.0, one accepted
`.length` break), admitted to `journal_entries_kind_chk` by ledger migration 17 (micro-ledger#20),
and released as 2026.08.54. The ledger's own test asserts the SQL list and the tuple are equal in
both directions, so the two halves cannot ship apart — and before the release the running service
answered the entry with `400 unknown entry kind: liquidity_seed`, which is the constraint working.

It then refused a second time, and that refusal is worth recording too. The script first posted
under `originatingService: 'deploy'` and got `403 missing required authority: attribution to
'deploy' (this token was minted for 'wallet')`. There is no `deploy` principal, and inventing one
so a hand-run script could sign its own byline would have been the wrong repair: an entry's
originating service is a claim about who moved the money, and the ledger is right to hold a token
to the service it was minted for. The entry posts under `wallet` — the service that already debits
and credits the estate's own chain positions, and what `ember-seed.js` books the mining income
under for the same reason.

What this does **not** do is track the position. It books the opening claim once, and a heavily
traded pool will drift from it; closing that gap is proof-of-reserves work, phase G.

### Phase H, done — and the gate is a measurement, not a screenshot

The deliverable was four things and the gate was one, and the four are the easy half.

`micro-exchange-web` is the frontend: pools, a swap page, and the constant-product arithmetic
re-run in the browser against what the pair contract actually holds. It has no service behind it
and never will — the whole data source is four numbers in a pair contract, so anything in front of
them could only be a cache with an opinion. `deploy/gateway/dynamic/estate-web.yml` carries
`cf-web-exchange` and, deliberately, a `# REMOVED: cf-api-exchange` line beside it so the next
reader greps and finds the answer rather than the absence. `deploy/scripts/surface-routes.py` no
longer lists `exchange` in `EXPECTED_UNROUTED`, and that deletion is the mechanism working rather
than a tidy-up: the entry had promised in its own text that it would be "deleted in the same commit
that adds the router", the check fails on a stale entry in BOTH directions, and leaving the line in
place would have failed the deploy that made it untrue.

The chip moved on its own, which was the point of writing it that way. `site/src/content/stages.ts`
had `exchange` as the only entry its `planned` list has ever carried, and it sat there for two
days. It did not leave because somebody remembered: micro-deploy added the router, declared the
service and deleted the `EXPECTED_UNROUTED` entry in one commit, and three independent assertions
went red on the next run. The chip reads `Running in-house` in the bundle currently served from
`cloudsforge.online/products`. It does **not** read `Open to the public`, and §7 below is not where
that is decided — see "what is still owner-only" at the end of this section.

**The gate.** `beacon` has two DEX journeys now, in `beacon/src/browser/dexjourneys.ts`. BJ-DEX-01
asserts the pool page holds what the pair contract holds, to the smallest unit, reading the chain
itself rather than the page it was rendered on. BJ-DEX-02 is the gate: it finds a pool with the
native coin on one side, chooses the token to receive **from the pair itself** rather than from a
constant, connects, types an amount a reader would type, presses Swap, signs what the page built,
and then reads the receipt off the node.

On 2026-08-16 it went green in 46 seconds against testnet through the estate's own gateway:

```
pass  browser.bj-dex-02  46160ms  A swap signed in the browser reaches the chain and the receipt says it succeeded
```

The transaction is `0x5383d15cea5805242e6e180d6f7c6ac481f6d193058a0cc898097bf37f031164`, signed by
`0xb0024e054619868e78D7Cb16D46F97571d6102F2`, executed by the testnet router
`0xba2b9db822e1f2ec3039fe474644b8405268a9b4` against pair
`0xd439a085d812b21de4b179fafe00281de50733a0`, `status 0x1`, spending exactly the 0.001 EMBER typed
into "Amount to pay". Testnet and not mainnet because `deploy/scripts/hearth-fund.js` caps mainnet
funding at zero by policy, and a journey that signs needs a funded key; on a deployment with no
`BEACON_DEX_KEY` the journey SKIPS, loudly, naming the variable, rather than falling back to
checking that a browser which cannot sign says it cannot sign.

**Three defects stood between the journey and that measurement, and all three were in the harness.**
They are recorded because each one is the same shape — a monitor that reported a working product
broken, or a broken one working:

1. The estate was serving an `exchange-web` bundle whose `DEPLOYMENTS` table knew only chain 7411,
   so testnet had no deployment and `/pools` listed nothing. That one *was* in a published bundle:
   `micro-exchange-web`'s CI had gone red on the commit that added 7412, no image was ever cut, and
   the estate ran the older one for four hours with nothing saying so. Fixed in 2026.08.57.
2. The injected provider was handed to Playwright's `addInitScript` as a **function**. Playwright
   serialises those with `toString()`, and `tsx`/esbuild's `keepNames` had already rewritten the
   closure to call `__name` — a helper that exists in the runner and in no page. The injection died
   on a `ReferenceError`, `window.ethereum` was never assigned, and the swap page said, quite
   correctly, that no wallet was installed. It is source text now, which nothing transpiles.
3. The journey's own clock called two successful swaps failures. The tier's 120-second deadline
   expired over `0xe52a2974…8207` (block 18188) and a 120-second receipt poll gave up on
   `0x11a647bb…b2eb` 83 seconds before it mined in block 18199. EMBER testnet's intervals between
   blocks 18185 and 18200 were 7, 15, 42, 79, 19, 13, 12, 14, 6, 59, 28, 132, 16, 83 and 75
   seconds — a mean near 40 with a tail past two minutes. The poll is five minutes now and the
   journey declares a `deadlineMs` of seven, the only journey in the catalogue that overrides the
   tier default.

Shipped in 2026.08.59. The injected provider is not interception: it supplies an input the
environment owed — a browser wallet, which is an extension the monitor's Chromium has none of — and
every request the page makes as a result goes to the real gateway and the real node.

**What is still owner-only.** `exchange.cloudsforge.online` has no public DNS record and no tunnel
ingress rule. Both are actions in the Cloudflare dashboard: the running tunnel is
`cloudflared tunnel run --token-file`, so its ingress arrives from the dashboard over the API and no
file in any repository here can add a rule. Until they exist the gate is driven against the
gateway's own address with an `--add-host`, which is what the run above did, and the estate's
scheduled browser runner cannot reach the surface at all. `estate-browser.sh` already declares both
the `exchange` and `chain` addresses and prints, before each run, whether `BEACON_DEX_KEY` is set —
so on the day the record exists, nothing needs editing to start measuring it continuously.

### Phase G, done — and the headline is that mainnet refused itself

The gate has two halves and they were closed in opposite directions. On the test network a receipt
exists, publishes its backing, attests it against a named Litecoin block, and has had a redemption
walked end to end. On the main network **nothing was deployed**, because the reserve was measured at
zero and §4 above says a wrapped asset that cannot satisfy **35** must not be issued. The refusal is
in the deployment script, not in a reviewer's judgement, and it is the more important half.

**The measurement, which anybody can repeat.** Three platform-controlled Litecoin addresses back
this receipt: two treasury-purpose and one pool-purpose. Per-user *deposit* addresses are
deliberately excluded — coin in a user's deposit address is that user's, and counting it as backing
would be pledging other people's money. The pool address is deliberately *included*, because
pool-mined coin is platform-controlled coin and leaving it out would understate nothing and
overstate the platform's discipline.

```
litecoin-cli scantxoutset start '["addr(ltc1qswwly0reyr85mr9xjx4ujtep5q7nndmulpmmnq)",
                                  "addr(ltc1qc4uhej2g2tc2ytqc5qczxmfyun87gctafnjghp)",
                                  "addr(ltc1qtkkwej6dwp0m58k99ckac76qp4agyu3pr0pqvp)"]'
```

That walks the whole UTXO set — about 53.8 million outputs, two to four minutes — and needs no
wallet, no import, no index of ours and no permission. It is the one reading that requires nothing
of us, which is what §4 means by *checkable on the chain by a stranger, without asking us*. Four
separate runs on four different days returned **0.00000000 LTC**, at heights 3161006, 3161011,
3161016, 3161026 and 3161029. No platform-controlled Litecoin address has ever received a litoshi.

So the honest statement is not "the bridge is not ready yet". It is: **there is nothing to back a
Litecoin receipt with, and the contract is built to refuse rather than to promise.**

**What is on 7412.** Two contracts, both `hearth/contracts/src/ForgeReceipt.sol`:

| | Address | Issuer | Attested reserve | Supply |
| --- | --- | --- | --- | --- |
| `fLTC` — Forge Receipt: Litecoin | `0x5ff590f4f6f29711706f485d9350666d2f8e2f02`, block 19411 | the phase-A multisig `0x51faced7…e4f8`, 2-of-3 | **0**, at Litecoin height 3161026, ref `0x13526539…d325` | 0 |
| `dEMBER` — Forge Receipt Drill: EMBER | `0x197f3dcb648abda5b7c678af5ac4d8042fcc8e6d`, block 19386 | the deployer EOA `0x91a11854…1d33` | 8907.039785 EMBER at chain height 19387 | 0 |

`fLTC`'s issuer is the multisig because a reserve figure one key can publish alone is a reserve
figure one key can lie about alone. Both of its issuer actions went through the full proposal
round — submit, an independent confirmation, execute — as proposals 0 and 1, mined in blocks 19417
and 19423.

**The drill, and why it is not a fiction.** §4 requires the redemption path to be *exercised before
issuance, not after*. On `fLTC` that clause is unfalsifiable: a truthful reserve of zero means it
can never mint, so it can never burn. The tempting shortcut — attest a fictional testnet reserve —
was rejected outright, because it is precisely the on-chain lie this contract exists to make
expensive, told on the one artifact whose entire value is that its attestations are true.

So the rehearsal was run on a receipt whose custodian is *legible*: `dEMBER` is backed by EMBER held
at an address on the same chain, so its reserve settles with one `eth_getBalance` and nothing is
taken on our word. The full lifecycle ran live:

1. `setReserveAddresses` published the custodian.
2. `attest` committed to 8907.039785 EMBER — **a tenth** of what the custodian held, not most of it.
   An attestation is a floor the issuer commits to and it has to stay true after the drill spends
   real coin paying the redemption out; understating costs nothing, overstating is the whole failure
   this contract prevents.
3. `issue` minted 2226.759946 dEMBER to a *different* key — `0xf88f0c5a…2db5`. A redemption from the
   issuer's own balance never touches `_transfer` and proves nothing about a stranger holding it.
4. That holder was funded 1 EMBER for gas. A receipt whose holder cannot afford the transaction that
   redeems it is a receipt with a hidden gate.
5. `redeem` **burned first**, then recorded: supply 2226759946290179767084 → 0, redemption 0 queued.
6. The payout went out for real — 2226.759946 EMBER in `0xfc08d74d38b0dba86531741577f067dff6645c9fe436cff327120165c8ddfdf0`
   — and `settleRedemption` recorded *that* hash. A settled txid nobody can look up is a settled
   txid nobody should believe.
7. `unsettledRedemptions()` is zero, and the custodian still held 86918.063887 EMBER — above the
   8907.039785 it had attested, so paying the redemption did not quietly falsify the attestation
   that authorised it.

**The refusal, demonstrated rather than described.** On both contracts, on the live chain, an
`eth_call` of `issue()` for one unit past the attested reserve reverts with `EXCEEDS_RESERVE`. On
`fLTC`, where the reserve is zero, that means every possible issuance reverts. The contract has no
pause, no freeze, no blacklist and no upgrade path, and its on-chain `statement()` says in the token
itself that it is a receipt rather than a trustless bridge.

**What a stranger does with this, in four steps and no help from us:** read `reserveAddresses()`;
read `attestation()` for a reserve, a Litecoin height and that block's hash; run the `scantxoutset`
above themselves at that block; compare the answer to `totalSupply()`. Today both are zero and the
contract refuses to make the second one larger.

**Two estate findings surfaced by the measurement**, neither of them exchange work, both filed:

1. The LTC treasury is registered in custody and settlement but has **no row at all** in
   `indexer.watched_addresses` — so the balance the solvency invariant would read is a balance
   nothing is watching.
2. A second treasury-purpose LTC address exists that nothing ever pinned into settlement, and the
   pool-purpose address confirms the previously-flagged **35** hazard: pool-mined coin sits outside
   the `deposit:,treasury:` prefix set reconciliation sweeps, so it is invisible to the invariant.

**What phase G does not claim.** There is no mainnet receipt, no Litecoin in reserve, and therefore
no LTC market on the exchange. The next thing is not code: it is coin arriving at a published
address. On the day it does, the same script re-run lifts the refusal by itself.

---

## 7. Open questions, which the owner decides

1. **EMBER-only first, or wait for a wrapped asset?** §4 costs both. The recommendation here is
   EMBER-only through phase F, with the marketing page corrected to match, and the wrapped coin
   treated as a separate decision made with the solvency machinery in front of you.
2. **The minimum opening depth**, below which a pool is a worse product than no pool.
3. **Who holds the multisig keys**, and on what devices. Two of the three obvious answers are the
   same person on two machines, which is not a multisig.
4. **Whether this changes the legal surface.** **37** records that no lawyer has ever seen the
   published terms, and that 16 sections are deliberately empty pending counsel. A venue where
   strangers swap assets is a materially different thing to describe than a backtester, and this is
   the point at which the empty sections stop being a tidy debt.
5. **Fee switch on or off.** V2's protocol fee is off by default; turning it on redirects a share
   of every swap to `feeTo`, and doing that on a project-owned pool is a transfer from one pocket
   to another until third-party liquidity exists.
6. **Whether an outside audit is bought before phase F**, and if so of what. Phase E was a static
   analyser and a re-read, and it found two real defects in the two contracts this project wrote
   itself while finding nothing in the V2 port — which is the expected shape, the port being the
   audited part. What that buys is a judgement on the new code and on the deployment procedure;
   what it costs is money against a mainnet pool whose whole opening depth is in §3. This is the
   last phase where the answer is cheap to act on.

---

## 8. What this document does not know

- Whether anyone other than this project would ever provide liquidity. Every number in §3 assumes
  not, which is the safe assumption and possibly the permanent one.
- What the chain does under contract load. Hearth's mainnet had 21 transactions in its first four
  days; an AMM is the first thing that would put sustained state-trie churn through it, and the
  block interval, the difficulty response and the mempool have never seen that.
- Whether `micro-pricing` or an on-chain oracle should publish the EMBER price the rest of the
  estate reads once a pool exists. A pool is a price feed, and a thin pool is a manipulable one;
  wiring the estate's own valuations to it without a TWAP would be a mistake made cheaply.
