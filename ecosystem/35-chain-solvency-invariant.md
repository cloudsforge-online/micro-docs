# 35 — The chain solvency invariant, and how to make EMBER functional

## What this is

Written 2026-08-08, out of an incident: EMBER withdrawals were frozen on live mainnet from
2026-08-05 to 2026-08-08 and every withdrawal in the asset was refused. Nobody was short of coin.
The platform held **more** on chain than it owed. The freeze was arithmetic, not insolvency.

This is a plan, not a ledger. It states the one invariant the estate's chain economics rest on,
enumerates every way the estate can currently break it — with the evidence for each — and sequences
the work that makes EMBER a chain the estate can actually operate.

## The invariant

> **For every reconciled on-chain asset, the sum of the ledger's `custody` asset balances equals the
> sum of the balances the indexer observes across the addresses it watches.**

Both sides must measure the same thing: *all coin the platform controls on this chain*. Not "coin
customers are owed" on one side and "all coin" on the other. That mismatch is the entire incident.

`ledger/src/reconcile.ts:257` reads the left side as `totalFor(tx, 'asset', assetCode, 'custody')`
— every purpose under the `custody` subject. `indexer/src/custody.ts` reads the right side as the
sum over `watched_addresses` carrying a platform label prefix (`deposit:,treasury:`). The
difference is `computeDrift` (`contracts/packages/money:1075`), and `withinTolerance`
(`money:1090`) compares its magnitude, so a discrepancy in **either** direction freezes.

Two consequences that are easy to miss and both matter:

* **EMBER has no tolerance entry, which means zero, not infinity.** `ledger/src/env.ts:149` is
  explicit: "an asset absent from the map gets zero tolerance, not infinity". A single wei of
  unexplained difference freezes every EMBER withdrawal estate-wide.
* **Only an exactly-clean run lifts a freeze.** So any defect that produces drift is not a blip; it
  is a payments outage that persists until someone books the difference by hand.

The invariant is therefore not an accounting nicety. It is the thing standing between a wei of
sloppiness and an estate that cannot pay anybody.

## Restating the invariant correctly, because the obvious reading is wrong

The tempting reading is "the ledger's customer liabilities should equal the chain's balance". It is
wrong, and following it produces the incident in reverse.

Coin the platform controls is not all owed to customers. A treasury float, a faucet float, seeded
coin, and gas yet to be burned are all real coin at addresses the platform holds, with no customer
behind them. They belong on the asset side of the ledger with an **equity** counterpart, not a
liability one — the precedent is `engagementAccount()` at `money:330`, "the platform's own money
earmarked, not revenue and not a user liability".

So the correct statement is the one at the top: *all coin the platform controls*, on both sides.
Every address the indexer watches must have a ledger position from the moment it is watched, and
every on-chain movement of platform-controlled coin must be journalled.

## How the estate breaks it today

Each of these is a real path to a frozen asset. Evidence, not conjecture, for each.

### G1 — An address can be registered with the indexer without ever being booked *(the incident)*

`settlement/src/treasury.ts:361 registerTreasuryWithIndexer` tells the indexer a treasury is
platform-held. It does not tell the ledger anything. Its own header advertises the property that
makes this bite:

> registering an address that has been accumulating swept coin for months makes its **entire**
> balance visible on the very next observation — there is no history to replay.

The entire balance includes float the ledger has never booked. On mainnet the treasury was pinned
at 2026-08-05 12:39:37 and registered at 12:40:11, and the reconciliation went to
`drift −25000020999999996000` and froze.

The header is worth reading in full because it closed the *opposite* defect — swept coin invisible,
**positive** drift — and reasoned carefully about that direction. Nothing was wrong with that
reasoning. It simply did not consider that the address being added might hold coin the ledger had
never heard of. `deploy/scripts/ember-seed.js:415-424` had, and named it in advance:

> Watching it would add its balance to one side of that comparison and nothing to the other, and
> every reconciliation from then on would record a non-zero drift and FREEZE EMBER — **an invented
> insolvency**.

The seeder honoured its own warning by leaving the faucet float unregistered. That workaround is
available to a seed script and not to settlement, which must register the treasury: sweeps move
**customer** coin into it, and an unwatched treasury on a swept estate hides the very loss
reconciliation exists to catch (`settlement/src/migrations.ts:367-372`).

**Status: repaired by hand on mainnet 2026-08-08, unrepaired in code.** The next chain, the next
rotation, testnet, and any rebuild reproduce it exactly.

### G2 — The same hazard for every future chain, and LTC is already loaded

Litecoin mainnet indexing is live (`INDEXER_CHAINS=ember:mainnet,ltc:mainnet`). `settlement.treasuries`
holds exactly one row, `ember/mainnet`. The moment an operator pins an LTC treasury, G1 fires again
for LTC on an estate where nobody is expecting it.

### G3 — `estate-verify` posted unbacked money into a zero-tolerance asset

The deposit drill posts a balanced `deposit_credited` of 1000 wei debiting custody, with no coin on
any chain behind it. That is drift, and it froze EMBER on 2026-08-05 — the incident record names
"synthetic `deposit_credited` rows posted directly to `POST /entries` by a test harness against the
live mainnet estate".

**Status: fixed.** The drill unwinds itself through `POST /entries/:id/reverse`
(micro-deploy#1). Residue: four test users hold 1000 wei each of liability from earlier runs, and
those users have since been deleted by the drill's own tombstone test.

### G4 — Gas: not currently a defect, and worth knowing why

Every confirmed outbound burns a fee out of a watched address. `settlement/src/fees.ts:133` books it
as `treasury_spend`, debiting `(platform, ASSET, payout_due)` expense and crediting
`(custody, ASSET, available)`. The amount is `outbound_transactions.fee`, fixed at planning time as
`gasPrice × TRANSFER_GAS` (`settlement/src/evm.ts:550`) and signed into the transaction — so on a
legacy-gas EVM chain the platform pays *exactly* what was booked. The mainnet arithmetic confirms
it: treasury 25.000021 − 0.9 paid − 0.000021 gas = 24.1 exactly.

**This holds only because EMBER prices gas the legacy way.** On an EIP-1559 chain the effective gas
price is decided in the block, `effectiveGasPrice ≤ maxFeePerGas`, and the booked estimate would
exceed the burn on nearly every transaction. At zero tolerance that is a freeze per payment. Any
EIP-1559 chain must book from the receipt (`gasUsed × effectiveGasPrice`) before it is reconciled.

### G5 — Sweeps are demand-triggered, and that is correct

Worth recording because it looks like a defect and is not. `settlement/src/sweeps.ts` sweeps only
"whatever queued withdrawals cannot be covered, plus a float only if an operator has asked for one
by name, and nothing else moves" — because moving coin from a deposit address to the treasury moves
it into the blast radius of the signing credential. So the 0.900021 EMBER still sitting in an
unswept deposit address on mainnet is the design working, not a stuck job.

A sweep is invariant-neutral: deposit and treasury are both watched, so the observed total does not
change, and the gas is booked by G4.

### G6 — LTC is indexed but not reconciled

`LEDGER_RECONCILE_ASSETS=SHARD,EMBER`. LTC deposits would be credited with no solvency check behind
them at all. That is the quiet version of this whole class of bug: not a freeze, but no answer to
"is this backed?".

### G7 — Coin arriving at a watched address from outside the estate

Mining rewards, an airdrop, or anyone sending coin to a treasury address raises the observed total
with no ledger counterpart. Measured on 2026-08-08: the observed total did not move by one wei over
three minutes with `cf-miner-mainnet` running, so rewards do not land in a watched address today.
This is a property of the current miner configuration, not a guarantee.

## The plan

Ordered so that each step is independently landable and testable, and so that nothing merges to
main before it has run on testnet.

### Step 1 — Register and book as one operation *(settlement)*

Make `registerTreasuryWithIndexer` book what it starts watching.

1. Read the treasury address's on-chain balance at a confirmed height **before** calling
   `indexer.watch`.
2. Watch it.
3. Post one entry — debit `(custody, ASSET, available)` asset, credit `(platform, ASSET, treasury)`
   equity — for **that address's own balance**, with an idempotency key derived from the address
   key.
4. Record the entry id on the `treasuries` row. Registration is not complete until it is present,
   and the recurring job retries until it is.

**Book the address's balance, never "the drift".** This is the design's whole safety property. The
drift is an aggregate that a genuine shortfall also moves; booking it would make the estate paper
over exactly the loss the check exists to find. Booking a specific address's measured balance is a
measurement, and if the books were already wrong before registration they stay wrong afterwards and
the freeze still fires for the real reason.

**Refuse to sweep into a treasury that is not yet booked** (`assertSweepable`). Without this, a
sweep landing between watch and book inflates the treasury with customer coin that is already
booked against its deposit address, and step 3 double-counts it.

### Step 2 — A regression test that fails today

Register a watched address holding platform coin with no ledger position, run reconciliation, assert
`clean`. Against the estate as it stands this fails with `drift_exceeded`, which is the point. A fix
that nothing asserts is a fix that will be undone.

### Step 3 — Prove it on testnet before mainnet

Bring testnet up, pin and register a treasury from scratch, confirm the opening entry posts and the
first reconciliation is `indexer/clean, drift=0`. This is the step that distinguishes "the tests
pass" from "the estate works", and testnet exists for exactly this.

### Step 4 — Extend reconciliation to LTC *(G6)*

Only after step 3. `LEDGER_RECONCILE_ASSETS=SHARD,EMBER,LTC` plus an LTC treasury pinned and booked
by step 1's path.

### Step 5 — Make the freeze message name its own cause

The indexer's answer already carries `addresses` and `labelPrefixes` precisely so an operator can
see what was summed — those two fields are what identified the unbooked treasury during the
incident. Having the reconciliation failure and `estate-verify` print the observed total broken down
by label prefix beside the ledger total turns a day of investigation into a glance.

## What this plan deliberately does not do

**It does not net platform equity out of the comparison.** That reading — compare
`custody − platform equity` against the chain — is arithmetically equivalent while the equity
account is correct, and silently wrong the moment it is not. It also changes the meaning of the
estate's central solvency number, which is not a change to make while repairing an incident.

**It does not stop watching the treasury.** That was the first fix proposed during the incident and
it is wrong: sweeps move customer coin into the treasury, so un-watching it blinds the check to real
loss. It would have cleared the freeze by disabling the check that raised it.

**It does not add a tolerance to EMBER.** A tolerance is not a comfort margin
(`ledger/src/env.ts:160`). Every defect above is a discrepancy about real coin with a real cause,
and each one is fixable at its cause.

## Cross-references

* cloudsforge-online/micro-org#247 — the incident, diagnosis and manual repair (closed)
* cloudsforge-online/micro-org#248 — the structural defect, G1
* cloudsforge-online/micro-org#249 — the CI break found while opening the repairs
* `deploy/scripts/ember-seed.js:415-424` — the failure, predicted in advance
* `settlement/src/treasury.ts:361` — where step 1 lands

---

## What steps 1–3 actually found

*Appended 2026-08-08. The plan above stands as written; this records what the estate did when it
was carried out, because two defects sat between "the code is right" and "the estate works" and
neither was visible from the source alone.*

### The treasury custody hands back was not the platform's

Step 1 needs a treasury address. Custody chose one with a query over `purpose` and `status` — and
`purpose: 'treasury'` means "an address the platform owns", not "the address deposits sweep into".
On the live testnet stack the only two treasury-purpose keys on `ember/testnet` belonged to
`foresight` (its house seed) and the `faucet` (its funding address), both of them legitimately
minted. So `POST /v1/admin/treasuries/ember/testnet/mint` answered `200 reused: true` with
foresight's house seed, and settlement pins whatever custody returns: one operator call would have
pinned it, and every user deposit would have swept into another service's float.

Step 1 makes that worse rather than better, which is the part worth keeping in mind when reading
the plan above. Booking the pinned address's balance as platform equity means the faucet's funding
address would have been booked as equity and then dripped away — a growing NEGATIVE drift, and
every EMBER withdrawal frozen. The same failure as the incident, arrived at from the other side.

Both routes that *choose* a treasury — the rotation-candidate query and the pin — now require the
derived binding `cloudsforge:treasury` / `treasury:<chain>:<network>`. Minting a platform-owned
address is deliberately untouched, because foresight and the faucet are entitled to one.
cloudsforge-online/micro-org#250, shipped in 2.5.1.

### The route the runbook names had never worked

With the treasury mintable, step 3 still could not run:
`POST /v1/treasuries/ember/testnet/provision` answered 500 with
`missing required authority: role:admin`.

Custody's admin mint requires `role:admin`, which no service token carries, so settlement forwards
the *operator's* bearer token per request — and says so in a comment at the call site. The shared
HTTP client applied its own service token after merging per-request headers, so that forwarded
credential was silently replaced by one that could never be accepted. The route could only ever
return 500, on both estates, since it was written.

This is a general shape rather than one call site: a seam whose entire purpose is "present this
other credential for this one call" did not express it, and three other call sites in the estate
are safe only because of how their clients happen to be constructed. Precedence is now accept
default → client `headers` → client `token` → per-request `headers`.
cloudsforge-online/micro-org#251, shipped in 2.5.2.

### What this says about step 3

Step 3 is written above as the step that "distinguishes the tests pass from the estate works", and
that claim survived contact. Neither defect was reachable from any repository's own suite: the
first needed a database holding *another service's* treasury key, which only a running estate has,
and the second needed a peer that actually enforces `role:admin`. Both were found within an hour of
running the path on testnet, and both were in code that had been green for months.
