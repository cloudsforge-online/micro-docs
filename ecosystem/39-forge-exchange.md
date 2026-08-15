# 39 — Forge Exchange: an AMM on Hearth, and what has to be true before it opens

**Status when written:** planned. Nothing is deployed on either network, no repository serves it,
and the hostname the registry reserves resolves nowhere on purpose. Written 2026-08-14.

**Status 2026-08-15:** the first three sentences above are no longer true, and the last one still
is. Phases A, C and D are done and phase B is deployed; **the full set is live on testnet 7412 with
one funded, traded pool.** Nothing is on mainnet, no frontend serves it, and `exchange.<apex>` still
resolves nowhere — which is why §6's phase table, not this line, is where the state is kept. Read
that table first: it now carries what each gate proved and, for phase D, the half of its gate that
is **not** met.

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
| **D. Testnet market** ⚠ | one EMBER pair seeded from testnet mining, swapped both ways by a wallet that is not ours | a full cycle — add, swap, swap back, remove — from the browser extension — **half met**, see below |
| **E. Read-through** | the contracts and the deployment read by somebody who did not write them | findings recorded and closed, in public |
| **F. Mainnet, EMBER-only** | the same set on 7411, seeded from the two miners | the estate's own solvency reporting books the seeded liquidity |
| **G. Wrapped assets** | one wrapped coin, issued against custody, satisfying **35** in full | a stranger can compare issued supply to reserves on-chain, and a redemption completes |
| **H. Surface** | a frontend, a router entry, the `EXPECTED_UNROUTED` deletion, the site chip moving on its own | `beacon` drives a swap through the real gateway |

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

### Phase D, HALF met — and the missing half is the half that matters

The mechanical half is done and measured. One pair, EMBER against a Forge Create token, seeded out
of testnet mining and put through a full cycle at block 16792:

| | |
| --- | --- |
| forward swap | filled at **exactly** the quoted 1,239.348445 FTEST |
| reverse swap | filled at **exactly** the quoted 24.851047 EMBER |
| round trip cost | 0.148952 EMBER — the 0.30% fee, charged twice, as it should be |
| *k* | rose on both legs |
| withdrawal | 3,181.980515 LP burned; price held at ~50 FTEST/EMBER across a proportional exit |

The gate does not say that. It says **"swapped both ways by a wallet that is not ours"** and
**"a full cycle … from the browser extension"**, and neither has happened. Every transaction above
was signed by `deploy/scripts/hearth-dex-seed.js` with the key that is also the chain's coinbase.
That is not a technicality:

- **A script is not a user.** It builds calldata the router expects because the same author wrote
  both. The extension has its own encoder, its own gas estimation and its own idea of a deadline,
  and *those* are what a stranger's swap goes through. Phase H is where the frontend is built, but
  the extension exists today and can call a router today — the gate was written to catch exactly the
  class of defect that only appears when a second implementation talks to the contracts.
- **One wallet cannot observe slippage against itself.** Every measurement above is a pool with a
  single participant, so nothing in it has been exposed to a second trade arriving between quote and
  settlement — which is the one thing an AMM's users actually experience.

So phase D is recorded as ⚠ rather than ✅, and closing it needs no new contract work: a second
funded key, the browser extension pointed at 7412, and the four operations run from it. Until then
the honest claim is **"the contracts work"**, not **"the market works"**.

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

Phase B stays ✅ on its own gate, which one verified contract already met. The line to watch is
NEFELI's: until the devkit pin moves to an image carrying that change,
`getsourcecode&address=0xf0f009AB…` still answers `"Contract source code not verified"`, and the
sentence in bold above is a claim about the pull request rather than about the testnet.

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
