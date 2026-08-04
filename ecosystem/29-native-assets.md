# 29 — Ten coins, natively: the deposit on-ramp

Somebody arrives holding BTC, or USDT, and wants to bet on a market. They must not be told to go
and buy EMBER first. This document is the design authority for holding the ten assets people
actually arrive with, and for the one question that follows immediately afterwards — what a
prediction market's pool is denominated in when the accounts feeding it are not.

**This is an on-ramp, not a trading feature.** Nothing here is about giving anyone a reason to
speculate on BTC inside CloudsForge. It is about removing the step where a stranger with money is
asked to convert it before the platform will talk to them, because that step is where they leave.

---

## 1. The premise this was commissioned on, and how much of it was already built

The brief for this document said the accounting and the address shape exist but "the chain
integrations do not". **That was true some months ago and it is substantially false today**, and
starting from it would have produced a plan to build things that already work. The audit below is
the first section rather than an appendix for that reason.

| Claim | Verdict | Where |
| --- | --- | --- |
| `AssetCode` is `EMBER \| BTC \| ETH \| SOL \| XRP` plus retired `SHARD` | **True** | `contracts/packages/chain/src/index.ts:49` |
| Five `ChainFamily` values, each with `confirmations` and `reorgAlarmDepth` | **True** — the type is at `:24`, the per-asset values in `CHAINS` at `:191` | `contracts/packages/chain/src/index.ts:24`, `:163-177`, `:191` |
| The ledger is multi-asset | **True** — the account key is `(subject, asset_code, purpose)`, unique | `ledger/src/migrations.ts:136-143` |
| Custody provisions per-user deposit addresses, schemes `flat_random` and `hd_bip44` | **True** | `custody/src/server.ts:111-113`, `custody/src/keys.ts:170` |
| "Custody's schemes are secp256k1-shaped; Solana is ed25519" | **False.** Custody derives ed25519 under SLIP-0010, hand-written and checked against the published vectors, and Solana's hardened-only path `m/44'/501'/i'/0'` is already the one Solana wallets use | `custody/src/hd.ts:59-62`, `:75-79`, `:111-147`, `:171-179` |
| "Only EMBER is indexed" | **Misleading in both directions.** The *estate compose leaves `INDEXER_CHAINS` unset, so the indexer follows no chain at all* — that is a deployment fact, not a capability one. In code, three of five families are built: EVM (serving both `eth` and `ember`), Bitcoin and Solana. Only XRP is a stub | `deploy/compose/docker-compose.estate.yml:977`, `indexer/src/index.ts:130-137`, `indexer/src/worker.ts:100-126` |
| "The chain integrations do not exist" | **False.** Deposit indexing, reorg repair, per-family signing policies, UTXO coin selection, withdrawal and sweep planning all exist for EVM, Bitcoin and Solana | `indexer/src/{evm,bitcoin,solana}.ts`, `custody/src/signing.ts`, `settlement/src/{evm,bitcoin,solana}.ts` |

Two further things exist that the brief did not mention and that change the shape of this design
completely:

1. **The indexer already extracts token movements on both token-bearing families.** ERC-20
   `Transfer` logs are decoded with the ERC-721 case correctly excluded
   (`indexer/src/evm.ts:177-178`, `:320-334`), SPL balances are diffed per owner from
   `postTokenBalances` (`indexer/src/solana.ts:291-315`), and both are stored as
   `asset_kind = 'token'` with the contract or mint address in `token_address`, under a database
   constraint that the two agree (`indexer/src/migrations.ts:267-270`).
2. **A coin↔coin conversion already exists, priced, double-entry and idempotent.**
   `wallet/src/money.ts:258` converts between any two chain assets at a scaled-integer rate from
   `micro-pricing`, rounding down always, refusing a conversion that would round to zero
   ("taking the input and crediting nothing is not a rounding error, it is a confiscation").

So the honest statement of the gap is much narrower and much sharper than "build ten chains":

> **The pipeline exists and is exercised by nobody. Tokens are indexed and then deliberately
> discarded one step before they become money. XRP is the one missing family. Tron is the one
> missing family that ten coins would add.**

The discard is one clause and it is the most important line in this document:

```ts
if (payload.assetKind !== 'native') {
  return { kind: 'ignored', reason: 'token_deposit_unsupported' }
}
```
— `wallet/src/deposits.ts:541-546`

Its comment is right about why: the amount is denominated in a token whose decimals the service
does not know, and crediting it as the native asset "would be off by a factor of 10¹² for a
six-decimal stablecoin". That is the whole of §4.

---

## 2. Ten coins, six families — the set, and why these ten

Cost is per **family**, not per coin. The set below is chosen for what people actually send to a
betting account, not for market capitalisation, and the ordering column is adoption.

| # | Asset | Family | Native or token | State of the family today |
| --- | --- | --- | --- | --- |
| 1 | **USDT** | evm (Ethereum), tron, evm (BSC) | ERC-20 / TRC-20 / BEP-20 contract | Indexed as a movement, refused as a credit |
| 2 | **USDC** | evm (Ethereum), solana | ERC-20 / SPL mint | Same, both sides |
| 3 | **BTC** | bitcoin | native | **Built end to end** |
| 4 | **ETH** | evm | native | **Built end to end** |
| 5 | **BNB** | evm (BSC) | native | EVM code path; a second EVM *network* the model cannot yet name |
| 6 | **SOL** | solana | native | **Built end to end** |
| 7 | **XRP** | xrp | native | Custody signs it; the indexer and settlement do not speak it |
| 8 | **TRX** | tron | native | Nothing |
| 9 | **DOGE** | bitcoin-derived | native | Bitcoin's *shape*, not Bitcoin's *code* — see below |
| 10 | **LTC** | bitcoin-derived | native | Same |

**Ten coins is six families and roughly four real integrations.** ETH, USDT-ERC20, USDC-ERC20 and
BNB are one family; DOGE and LTC share Bitcoin's transaction structure; USDT-TRC20 and TRX are one
family that does not exist here at all.

**What is deliberately excluded, and why.** ADA and TON both appear in most top-ten lists. Each is
a seventh and eighth chain family — a new address encoding, a new signing curve or scheme, a new
follower, a new reorg model, a new withdrawal adapter — for deposit volume that, on a prediction
market, is a rounding error next to USDT. TON in particular has an account model with bounceable
addresses and message-based transfers that resembles nothing already here. They are not refused
forever; they are refused until someone can point at demand.

**What "Bitcoin-family" does and does not buy.** DOGE and LTC use Bitcoin's transaction and script
structure, so `settlement/src/bitcoin.ts`'s coin selection, its vsize arithmetic
(`settlement/src/bitcoin.ts:141`) and custody's PSBT output pin
(`custody/src/signing.ts:722-741`) generalise. What does **not** generalise is the transport: the
indexer's Bitcoin worker reads Esplora, and the Esplora ecosystem is thin-to-absent for Dogecoin.
The address encodings differ (different version bytes, different bech32 HRPs, Dogecoin has no
widely-used segwit), the dust thresholds differ, and Dogecoin's fee policy is a different animal
from Bitcoin's. Call it **half an integration each**, not a configuration change, and do not let a
plan assume otherwise.

**The four EVM networks are not four families but they are not free either.** The model is
currently a bijection: `CHAINS` is a `Record<AssetCode, ChainSpec>` and each spec carries one
`family`, one `confirmations`, one `chainId` pair (`contracts/packages/chain/src/index.ts:191`).
BSC is EVM-compatible, but it is a different chain id, a different block time, a different
confirmation depth and a different explorer. Adding it means either a second asset code with its
own spec (fine, that is what BNB is) or a notion of *network within family* that the type does not
have. Prefer the former: `BNB` is an asset code with `family: 'evm'` and its own chain ids.

---

## 3. The first milestone: prove the whole pipeline on **BTC**

Before any of §2 generalises, one non-EMBER asset must go all the way round:
**deposit → confirm → credit → stake → win → withdraw → sweep → reconcile.** Bitcoin is the one to
do it with, and the choice is not obvious, so here is the argument.

The three candidates were ETH, BTC and USDT-ERC20.

**ETH is the cheapest and proves the least.** It runs on the same worker as EMBER —
`indexer/src/index.ts:130-137` constructs `EvmWorker` for both, and `FAMILY_NOTES.ember` says
Hearth is "served by the EVM worker" with a different chain id and depth. An ETH round trip
therefore demonstrates that the EMBER code path works with different constants in it. That is
worth something and it is not worth a milestone.

**USDT-ERC20 has the most adoption and the most simultaneous unknowns.** It needs the ledger's
`TOKEN:` asset codes wired end to end, a canonical token registry that does not exist, a decimals
source, a fourth custody signing shape (§5.2), and a solution to the gas-at-the-deposit-address
problem — five new things at once, on a path nobody has yet walked once.

**BTC proves the generalisation itself.** It is a different family in every dimension that matters:
UTXO rather than accounts, so an address's balance is not a number the chain will tell you; no
chain id, so the network binding is carried by the WIF (`custody/src/chains.ts:120-125`); a sweep
whose fee is proportional to input count; a reorg repair that cannot re-read a balance and must
walk to a common ancestor (`indexer/src/worker.ts:105-112`); replace-by-fee, which has no EVM
analogue at all. Every component for it is written. **And it is the coin the owner named first**,
which for an adoption feature is not a trivial consideration.

So: **BTC first, USDT-ERC20 second.** BTC is the engineering choice and USDT is the adoption one,
and the one-phase delay buys a pipeline that is known to work before the hardest asset class is
laid on top of it.

Two things must be settled inside that milestone rather than after it.

**BTC's confirmation depth is 3** (`contracts/packages/chain/src/index.ts:224`). EMBER is 60, ETH
is 12, SOL is 32, XRP is 1. Three is roughly thirty minutes and is below what most custodians use
for Bitcoin; it is also, notably, far below the caution the same file applies to the platform's own
chain. This is not a bug — it is a value nobody has revisited — but crediting a large deposit at
three confirmations is a decision, and it should be made deliberately, ideally as a
value-dependent depth rather than one constant. **Flagged for the owner (§9).**

**Sweeping is planned and never signed, on every chain.** `settlement/src/jobs.ts:69-70`: the
`chain.sweep` job "writes `planned` rows and never signs". Whether the outbound job then carries a
planned sweep all the way to broadcast is the last untested link in the loop above, and the
milestone is not complete until a satoshi has actually moved from a user's deposit address into the
treasury and the ledger's reconciliation has agreed with the chain about it afterwards.

---

## 4. A token is not a coin, and must never become an `AssetCode`

This is the most consequential structural decision in the document, and getting it wrong is
irreversible in the ordinary way — once balances exist under the wrong asset code, correcting it
means restating money.

**The temptation.** Add `USDT` and `USDC` to `AssetCode`. It reads naturally, every consumer type
widens automatically, the ledger accepts it, `chainSpec('USDT')` answers.

**Why it is wrong.** `AssetCode` is one-to-one with `ChainSpec`
(`contracts/packages/chain/src/index.ts:191`), and a `ChainSpec` has exactly one family, one
confirmation depth, one decimals and one explorer. USDT has none of those as a single value: it is a
contract at `0xdAC17…` on Ethereum with 6 decimals, a different contract on Tron with 6, a
different contract on BSC with **18**, and a different mint on Solana. A single `USDT` asset code
forces a decimals, and the wrong decimals on a stablecoin is a balance wrong by 10¹². It also
silently asserts that a USDT balance is one thing, when a deposit on Tron cannot be withdrawn on
Ethereum without a bridge the platform is not and must never become.

**The shape that already exists and is right.** `contracts/packages/money/src/index.ts:56` and
`:66`:

```ts
export type TokenAssetCode = `TOKEN:${string}`
export type LedgerAssetCode = AssetCode | 'USD' | TokenAssetCode
```

and `assetDecimals(assetCode, tokenDecimals?)` at `:86` already refuses to answer for a `TOKEN:`
without being told the decimals, because "decimals are chosen at deploy time". The ledger is
therefore *already* able to hold a stablecoin balance correctly. Nothing in the money contract needs
to change.

**The decisions that follow, and they are not optional:**

1. **A `TOKEN:` urn names chain, network and contract.** `TOKEN:eth:mainnet:0xdac17f958d…`. Two
   deployments of the same brand are two ledger assets, permanently.
2. **"USDT" is a display grouping, never a code.** The frontend shows one row called USDT with a
   network selector, exactly as every exchange does. The ledger, the reconciliation and the
   withdrawal path see only the specific `TOKEN:` code. The estate has this rule already in another
   costume — "a Spark is a display denomination of EMBER, and must never become a second asset
   code" (`contracts/packages/chain/src/index.ts`, the Sparks section) — and this is the same rule.
3. **The token registry is an allowlist, refusing by default.** The indexer reports every ERC-20
   `Transfer` that touches a watched address, and a great many of those are worthless tokens
   airdropped at addresses specifically to appear in wallets. Crediting whatever arrives turns a
   spam airdrop into a balance the platform owes. The registry maps `TOKEN:` urn → symbol,
   decimals, display name, and **an operator has to put each one there.** Anything not on it stays
   `token_deposit_unsupported` — the current behaviour, which is correct as a default and wrong only
   as a permanent state.
4. **Decimals come from the registry and are checked against the contract**, not read from one
   place. `decimals()` is an `eth_call` the indexer can already make — `tokenstate.ts` exists for
   exactly this class of read, and it does the head-hash check before trusting the answer.

`wallet/src/deposits.ts:541-546` then becomes: token deposits of registered assets are credited to
the `TOKEN:` account at the *native chain's* confirmation depth, and everything else is still
ignored with a reason.

---

## 5. The traps, named before they are discovered

### 5.1 XRP: an account does not exist until it is funded

An XRP account carries a **base reserve**. Until it is met the account does not exist on the ledger
and cannot receive. The estate already knows this — `indexer/src/worker.ts:120-125` names it as one
of XRP's two traps — but custody's HD derivation nonetheless mints a *distinct classic address per
user* (`custody/src/hd.ts:198-206`, coin type 144). Every one of those is an account the platform
must fund out of its own money before a user can deposit into it, and the reserve is locked for as
long as the account exists.

**The standard answer is one platform account plus destination tags**, and it is structurally
different from every other chain here: N users share one address and are distinguished by an integer
in the payment. That is not a configuration change to the deposit model, it is a second deposit
model, and it collides with a schema that assumes otherwise —
`wallet/src/migrations.ts:313` indexes deposit assignments on `(chain, network, address_key)` and
the credit path resolves an incoming movement to a user by address alone
(`wallet/src/deposits.ts`, the assignment lookup). A tag-based XRP would need the assignment key to
be `(chain, network, address_key, tag)` and the indexer's XRP worker would have to carry
`DestinationTag` into the movement.

It is worth doing anyway, because the alternative is a reserve per user forever. But it is a
**schema change to the wallet and a new field on the movement**, and it should be planned as one
rather than discovered when XRP is switched on.

Note also what the HD scheme already fixes: XRP has no network byte, so a flat-random family seed
produces one address valid on both networks — the live defect at 00-current-state §3.5. Custody
refuses `flat_random` for XRP outright (`custody/src/keys.ts:175-186`) and derives the network into
the BIP-44 coin type instead. Do not undo that when the tag model arrives.

### 5.2 An ERC-20 deposit arrives at an address holding no ETH — and custody cannot sign the sweep anyway

This is the trap that catches almost everyone once, and here it has a second half that is worse
than the first.

**The first half, which is the famous one.** A per-user deposit address derived at
`m/44'/60'/0'/0/i` holds zero ETH. A USDT transfer to it succeeds — the sender pays the gas — and
now the platform holds a token balance at an address that cannot pay for a transaction. Sweeping it
requires pushing gas in first. That part is fine: the treasury's EVM shape is `'transfer'`
(`custody/src/gates.ts:38-42`), whose destination the caller names, so a gas top-up from treasury to
a deposit address is already a signable operation.

**The second half, which is specific to this codebase and is not fine.** The sweep out of the
deposit address is EVM shape `'sweep'`, and `assertSweep` pins `tx.to` to the treasury address
character for character (`custody/src/signing.ts:302-323`) and then delegates everything else to
`assertTransfer`, which requires **empty calldata**: `` `data` must be empty on a value transfer ``
(`custody/src/signing.ts:251-252`, reached via `:327`).

An ERC-20 sweep is `transfer(address,uint256)` calldata sent **to the token contract**. Its `to` is
not the treasury, and its `data` is not empty. **Custody cannot sign an ERC-20 sweep under any
existing shape, and it should not be made to by loosening one** — the pin is the entire security
property of the sweep shape, and a shape that permits calldata to a caller-named contract is a
signing oracle over a customer's deposit key.

**What custody must gain:** a fourth EVM shape, `token_sweep`, which admits exactly
`transfer(address,uint256)`, requires `value == 0`, requires the token contract to be one the
service's own registry names, and pins the **recipient argument inside the calldata** to the
treasury the vault chose. The pin moves from the `to` field into the ABI decode; everything else
about the discipline is unchanged. The Solana equivalent is the same shape of problem —
`SolanaPolicy`'s `sweep` admits exactly one native System `Transfer`
(`custody/src/signing.ts:379-382`), so an SPL token sweep is likewise unsignable today, and an SPL
deposit additionally needs an Associated Token Account that must be rent-funded before the deposit
can even arrive.

### 5.3 Solana rent, and the account that must exist before the money does

A Solana account below the rent-exemption minimum is reclaimed. For native SOL the platform's
exposure is a per-address minimum; for SPL tokens it is worse, because the deposit address needs an
**Associated Token Account per mint**, created and rent-funded by somebody, before a USDC transfer
to it will succeed at all. This is the ERC-20 gas problem moved earlier in time: with ERC-20 the
money arrives and then cannot leave; with SPL the money cannot arrive.

Custody's Solana instruction allowlist admits `createAccount` only under the `mint` shape and only
for an account of exactly SPL-mint size assigned to the token program
(`custody/src/signing.ts:549-555`). Creating an ATA is a different instruction to a different
program, and it is not signable today.

### 5.4 UTXO sweeping, and dust that is economically unspendable

A per-user Bitcoin address that receives many small deposits produces many small UTXOs, and a sweep
consuming them pays a fee proportional to input count: `vsizeOf` charges 41 vbytes plus 27 witness
bytes per input (`settlement/src/bitcoin.ts:141-143`). Below roughly 68 vbytes × fee rate, an input
costs more to spend than it is worth, and the platform is holding a balance it cannot move.

The coin selection already handles the *output* side correctly — change below the dust threshold is
given to the miner rather than created, with the reasoning written down
(`settlement/src/bitcoin.ts:246-290`). What is not handled is the *accumulation* side: a minimum
deposit below which a Bitcoin deposit will be credited but can never be swept economically. That
minimum is a policy number, it belongs in `micro-policy` beside the withdrawal floors that already
exist per asset (`policy/src/actions.ts:61-64`, where "an asset absent from this table is refused
rather than defaulted"), and it must be shown to the user at the deposit screen rather than
discovered in a reconciliation report.

### 5.5 Confirmation depth is already per-asset, and that is the part that is right

The concern that EMBER's 60 would be reused everywhere does not apply: the depths are per-asset and
were chosen individually — EMBER 60, ETH 12, BTC 3, SOL 32, XRP 1
(`contracts/packages/chain/src/index.ts:197`, `:214`, `:224`, `:233`, `:248`) — and every consumer
reads them rather than restating them, which the indexer's header
(`indexer/src/chains.ts:4-10`) and the wallet's re-check
(`wallet/src/deposits.ts`, `isConfirmed` on the credit path) both enforce. Solana additionally
requires **finality and depth together, never either alone** (`indexer/src/worker.ts:113-119`),
which is the correct treatment of a chain whose finality is not a depth.

Three things this design must not break:

1. **A token has no depth of its own.** A USDT-ERC20 deposit is credited at Ethereum's depth,
   because that is the chain whose reorg could retract it. When BNB/BSC arrives with its own spec,
   a BEP-20 must take BSC's depth and not Ethereum's — which is an argument for deriving a token's
   depth from its chain rather than storing one on the token.
2. **BTC at 3 should be revisited** (§3).
3. **The reorg alarm must stay below the credit depth** in every new spec. The property the estate
   relies on is that a reorg deep enough to retract a *confirmed* movement is always deep enough to
   have halted the chain first (`indexer/src/evm.ts` header). A new asset whose alarm depth is set
   at or above its credit depth quietly removes that guarantee.

---

## 6. The unit of account: what a parimutuel pool is denominated in

This is the crux, and it does not have a comfortable answer.

### 6.1 The constraint, from the contract rather than from the pitch

Foresight is parimutuel by deliberate choice — "odds are the pool ratio; payout is pro-rata"
(`19-new-products.md` §2.2). The contract is the custodian and the pool is a single integer:

```solidity
function stake(uint8 outcome) external payable {   // :197
    _stakes[msg.sender][outcome] += msg.value;      // :205
    pool[outcome] += msg.value;                     // :206
```
— `foresight/src/contracts/ForesightMarket.sol`

`pool[outcome]` is one `uint256` of wei. **There is nowhere to put an asset code.** A mixed-asset
pool is not a feature that has not been built; it is not expressible in the thing that holds the
money. And even if a field were added, pro-rata across assets whose relative prices moved between
stake and settlement is not a parimutuel — it is an FX book with a prediction market attached, and
whoever staked the asset that appreciated takes money from whoever staked the one that did not, for
reasons unrelated to the event.

The alternative — one market per asset — fragments liquidity, which for a parimutuel is not a
degradation but a kill: thin pools mean grotesque odds, which mean nobody stakes, which means
thinner pools.

### 6.2 The resolution

**The account stays native. The market is denominated in one unit. Conversion happens at the moment
of staking, quoted, and never before.**

- A user who deposits BTC holds BTC. The ledger's account key is `(subject, asset_code, purpose)`
  and is unique (`ledger/src/migrations.ts:136-143`), so per-asset balances are what the ledger
  already is. **Nobody is ever forced to convert in order to hold.** That is the owner's
  requirement and it is met exactly.
- A market's pool is EMBER, because the contract's unit is `msg.value` and the contract is the
  custodian. This is not a preference; it is the only thing the deployed contract can be.
- The stake screen quotes the conversion explicitly — *0.0100 BTC → 4,132 EMBER at $X, rate
  recorded* — and the conversion machinery it needs already exists: `wallet/src/money.ts:258`,
  priced by `micro-pricing`, double-entry, rounding down, idempotent on a key that deliberately
  **excludes the rate** so that a retry is not a second trade at a moved market.
- **Precedent, not invention.** `micro-billing` was migrated to exactly this shape today: the
  catalogue is durable in US cents, the ledger is posted in EMBER, the rate is read per purchase and
  recorded on the row that used it, and an unreadable rate refuses the purchase rather than guessing
  (`billing/src/pricingclient.ts`, commit `2fe6d81`). One authority for the rate; the row says which
  answer it got. A stake is the same join with a different pair of units.

### 6.3 What a winner sees — where the billing analogy breaks

Billing converts once, at one instant, for a price the customer has just agreed. A bet converts in,
**sits for days or weeks**, and then converts out. If the interface says "you staked 0.01 BTC and
won 0.02 BTC", the platform has sold an FX guarantee it does not hold: if EMBER/BTC moves while the
market is open, the platform eats the difference on every winning position, in the same direction,
at the same time. That is an unhedged book against its own users and it is how a small product dies
in a volatile week.

So the rule is:

> **Once staked, a position is EMBER-denominated and is displayed in EMBER.** The stake screen shows
> both units and the rate. Everything after it — the position, the odds, the projected payout, the
> settled payout — is EMBER and only EMBER. Converting a payout back to BTC is a **second, separate,
> explicitly quoted action** the user takes if they want it, at the conversion spread that already
> exists as R7 (`15-monetisation-model.md:85`).

Said plainly at the stake screen, in these words rather than in a footnote: *staking converts your
BTC to EMBER. Your winnings are paid in EMBER. You are no longer exposed to BTC on this stake.* A
user who wants to keep BTC exposure keeps their BTC and does not stake it. This is honest, it is
what every parimutuel with a house currency does, and it is the only version in which the platform
is not quietly running a currency desk.

### 6.4 The unresolved problem underneath, which is not technical

**EMBER's rate is administered.** `pricing/src/rates.ts:55` — `ADMINISTERED_ASSETS = ['EMBER']`,
because Hearth has no exchange listing, and the market-priced set is derived as everything else
(`:57-58`) so the two can never overlap. `16-risks-and-open-decisions.md:242` states the consequence
without softening it: *"EMBER has no market price during the plan, so nothing EMBER-denominated is
real money."*

Under §6.2, **every stake is a conversion out of an asset with a market price into an asset whose
price the platform sets**, and every payout is the reverse. That is a governance problem, not an
engineering one, and no arrangement of code fixes it. It is the single largest unresolved risk in
this design and it goes to the owner (§9) with two named alternatives:

- **Denominate markets in USD, settle the pool in EMBER** — billing's exact shape. Odds and payouts
  are quoted in a unit a stranger can price. The pool arithmetic is still wei, so this is a display
  and accounting decision rather than a contract change, and it does not remove the administered
  rate — it makes it visible on every screen instead of invisible in every balance.
- **Pool a stablecoin instead of EMBER** — a `ForesightMarket` variant taking an ERC-20 rather than
  `msg.value`. This removes the administered rate from the crux entirely and is the answer with the
  best claim to being right. It costs a second audited contract, and it needs a stablecoin that
  exists **on Hearth**, which today none does. That is a bridge or an issuance decision and it is
  well outside this document.

### 6.5 The gap nobody has noticed: a custodial user cannot stake at all

`custody/src/gates.ts:35`:

```ts
const SIGNABLE_PURPOSES: ReadonlySet<string> = new Set(['deployer', 'treasury', 'deposit'])
```

`user` is not in it. Foresight's staking route is a **stake intent** — it returns the `to`, `data`
and `value` a wallet needs and "not one wei passes through here"
(`foresight/src/server.ts:576-636`) — which is exactly right for the self-custody wallet described
in [25](25-wallet-clients.md) §5.1, and which a custodial balance cannot use, because there is no
key the platform will sign that stake with.

**So the on-ramp this document exists to build currently terminates one step before the product it
is an on-ramp to.** A user deposits BTC, converts to EMBER, and then cannot place a bet with it.

Three ways out, with a recommendation:

1. **Widen custody's `user` purpose to sign contract calls.** *Refused.* It creates a shape whose
   destination and calldata the caller chooses, over a customer's key — the precise property SD-09
   gate 1 exists to prevent, and the reason the three existing shapes are disjoint.
2. **Give each user an on-chain EMBER address and stake from it.** Honest, and it is really
   self-custody wearing a custodial label; the user's key would still be custody's, so it inherits
   (1)'s problem in a different place.
3. **Stake from a platform address and mirror per-user shares in the ledger.** *Recommended.* This
   is what "custodial" already means everywhere else in the estate, the pattern already exists for
   the house seed (`21-engagement-treasury.md` §5, and `foresight/src/server.ts:519` already serves
   a house-stake disclosure), and it is the only option that lets a user with BTC actually bet.

Option 3 carries an obligation that must be written into the design rather than bolted on: the
platform's aggregate stake is one position on-chain, so a user's share exists **only** in the
ledger. That must be disclosed in the same words as the house seed's disclosure, the ledger must
reconcile the aggregate against the chain position, and the difference from a self-custody stake —
which survives the platform being switched off, [25](25-wallet-clients.md) §5.1 — must be stated on
the screen where the user chooses. Two products that look identical and have opposite failure modes
is the §8 problem in its purest form.

---

## 7. Custodying ten assets is a regulatory posture, not an engineering one

[25](25-wallet-clients.md) §1 argues that the most dangerous thing that design can do is let a user
confuse the custodial wallet with the self-custody one. **This multiplies that surface by ten and
adds three exposures that are new in kind, not in degree.**

**The register today.** SDR-12: no KYC/AML, "not currently required at this scale", revisited when
"a jurisdiction, a threshold, or a fiat on-ramp says otherwise"
(`12-security-decisions.md:683`). R-51: custodial holdings create regulatory exposure, high
likelihood and high impact, unresolved by the plan
(`16-risks-and-open-decisions.md:99`). §2.5: no fiat, permanently — the invoice and provider stack
was deleted rather than deferred (`:159-167`).

Nothing here proposes touching fiat, and §2.5 stays intact. What changes is everything else:

1. **Scale is the trigger, and this is a scale feature.** SDR-12's own condition is a threshold.
   An on-ramp that works is an on-ramp that raises custodied value, which is the event that makes
   the deferred question live. Building it means accepting that §2.6 is likely to need answering
   sooner rather than later, and the honest thing is to say so now.
2. **Stablecoins are centrally freezable, and this is the exposure people forget.** The issuers of
   USDT and USDC can and do blacklist addresses. A swept balance sitting in a platform treasury
   address can be frozen by a third party, at which point the ledger shows an asset the platform
   cannot move while still owing the user the liability. The mitigating machinery exists —
   `asset_freezes` is a real table and exceeding reconciliation tolerance freezes withdrawals for
   that asset (`ledger/src/migrations.ts:573-580`) — but the *scenario* is not one the estate has
   named, and the correct response to it is a business decision, not an automated one.
3. **Deposits from sanctioned addresses arrive whether or not anyone is screening.** With EMBER
   only, the platform's counterparties are its own users. With BTC and USDT the platform accepts
   value from arbitrary addresses on public chains with well-developed attribution. Screening is
   not proposed here; **knowing that the choice is now being made** is.

Concretely, and as the minimum this document asks for: a per-asset enable switch that an operator
turns on deliberately (the token registry of §4 is already this shape), the withdrawal floors and
velocity limits that `micro-policy` already applies per asset
(`policy/src/actions.ts:61-64`), and the wallet-confusion rule from
[25](25-wallet-clients.md) §1.1 restated per asset: **custodial and self-custody balances of the
same coin are never summed, never adjacent without labels, and never share a colour.**

---

## 8. Phasing

Each phase ends with something a user can do, and no phase begins before the one under it has been
proved by an actual movement of money rather than by a test.

| Phase | What lands | Why here |
| --- | --- | --- |
| **1** | **BTC end to end.** Indexer following `btc`, deposit address, credit, conversion, stake, settle, withdraw, sweep, reconcile. Custodial staking (§6.5) resolved and built | §3. The pipeline is proved on the family least like EMBER, using components that all already exist |
| **2** | **The token path, on USDT-ERC20.** Token registry, `TOKEN:` credit path replacing `wallet/src/deposits.ts:541-546`, `token_sweep` custody shape, gas top-up for deposit addresses, decimals verified on-chain | The largest single on-ramp, laid on a pipeline known to work |
| **3** | **USDC-ERC20 and ETH.** Registry entries and RPC wiring; no new code paths | Free, once phase 2 exists. Ship them together |
| **4** | **SOL and USDC-SPL.** ATA rent funding, ATA creation shape in custody, SPL sweep shape | The indexer half already exists (`indexer/src/solana.ts:291-315`); the custody half does not |
| **5** | **BNB and BSC-resident USDT/USDC.** `BNB` asset code with its own spec, second EVM network | One new spec, one new RPC, zero new families — but see §2 on the bijection |
| **6** | **XRP.** Indexer worker, settlement adapter, and the destination-tag deposit model with its schema change | The only family with a stub. Do it once, properly, with tags rather than reserved accounts |
| **7** | **USDT-TRC20 and TRX.** A sixth family from nothing | The single largest real-world stablecoin rail, and the most expensive item here. Justified by measured demand from phases 2–3, not before |
| **8** | **DOGE and LTC.** Bitcoin-derived, with their own transports and encodings | Half an integration each. Last because they are the least-used of the ten on a betting account |

Assets 1–6 cover, by any reasonable measure, the overwhelming majority of what people would actually
send. Phases 7 and 8 complete the ten and should be re-justified when they are reached.

---

## 9. What this document does not decide

Each of these needs the owner, and each is written so that a yes or a no is a complete answer.

1. **What a market is denominated in.** §6 recommends EMBER pools with conversion at stake time,
   because it is what the deployed contract can do. The alternatives — USD-denominated display over
   an EMBER pool, or a stablecoin-pooled contract variant — are both live and the second is
   arguably better. **This is the largest open question and everything else in §6 is downstream of
   it.**
2. **Whether the administered EMBER rate is acceptable as the hinge of every stake.** §6.4. Not a
   technical question and not one this document can answer.
3. **How a custodial user stakes.** §6.5 recommends a pooled platform position mirrored in the
   ledger, with the house-seed disclosure applied. It changes what "the contract is the custodian"
   means for custodial users and the owner should say so out loud before it is built.
4. **BTC's confirmation depth.** 3 today. Whether to raise it, and whether depth should vary with
   value.
5. **Whether a minimum deposit is enforced per asset**, and at what number, given §5.4's
   unspendable-dust floor.
6. **Whether Tron is worth a sixth family.** Phase 7 exists on the argument that USDT-TRC20 is a
   large real-world rail. That is true in the world and unproven for this platform.
7. **Whether §7's regulatory posture changes.** This document does not propose changing SDR-12 or
   §2.5. It states that building this makes the question live sooner.

---

## 10. What could not be verified

Stated rather than asserted, because this directory has repeatedly carried claims that were true
once:

- **No RPC endpoint for any external chain is configured anywhere in the estate.** The compose
  leaves `INDEXER_CHAINS` unset deliberately (`deploy/compose/docker-compose.estate.yml:977`). So
  every statement here that a family is "built" means *the code exists and its tests pass*, not
  that it has ever followed a real chain. **The Bitcoin, Solana and EVM workers have, as far as
  this document can establish, never indexed a mainnet block.** Phase 1 exists to find out what
  that costs.
- **Whether a planned sweep is carried to broadcast has not been observed**, only read
  (`settlement/src/jobs.ts:69-70`, `settlement/src/outbound.ts:300-306`).
- **Token decimals on BSC-resident USDT (18, against 6 elsewhere)** is stated from general
  knowledge, not from a contract this document read. It is the kind of fact §4's on-chain
  verification exists to catch, and it should be checked before phase 5 rather than trusted here.
- **Esplora coverage for Dogecoin and Litecoin** was not surveyed. §2 assumes it is thin for DOGE;
  if that is wrong, phase 8 is cheaper than stated.
- The **XRP base reserve's current value** was not looked up. The argument in §5.1 depends only on
  there being one, not on its size.
