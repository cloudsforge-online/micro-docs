# 25 — The self-custody wallet, on nine platforms

Windows, macOS, Linux, Android, iOS, Chrome, Firefox, Opera, and the CLI that already exists. One
signing core, one threat model, one set of art. This document is the design authority for all of
them.

It is written to be **buildable without touching the testnet deployment**, and §10 is the proof
rather than the promise.

---

## 1. The thing this is, and the thing it is not

CloudsForge already has a wallet. `micro-wallet` holds balances, `micro-custody` holds keys, and
the ledger is the truth about what you own. It is **custodial**, and it is good at what it does.

**This is not that.** This is the wallet where *you* hold the key and the platform cannot move your
money, sign for you, freeze you, or lose you. The two will sit next to each other in the same
product, and the single most dangerous thing this design can do is let a user confuse them.

The reason to build it is already written down as a principle rather than a feature:

> *A user can always leave with their assets.* Private-key access for a wallet you own is a product
> requirement. The safeguards are ours to design; the right is not ours to withhold.

A right that requires the platform's cooperation to exercise is not a right. Today the only way
out is a custodial export ceremony that the platform performs on your behalf. After this, there is
a wallet the platform never had the keys to.

### 1.1 The rule that keeps them apart

**Custodial and self-custody balances are never summed, never adjacent without labels, and never
share a colour.** A screen may show both. It may not show a total that spans them, because that
total is a lie about who can take it away from you.

This is the same class of rule as Sparks-is-not-an-asset-code: the moment two different things are
allowed to look like one thing, nothing downstream can tell them apart again.

---

## 2. The hardest constraint, discovered before designing

**The Rust core cannot be the signing core.** `hearth/rust/README.md` says so itself, and it is
worth quoting because a reasonable architect would otherwise reach for it first:

> Two modules would give the **wrong answer** if they were wired to a chain: `src/pow.rs` omits the
> coinbase public key from the PoW seed… `src/difficulty.rs` moves ±1 leading-zero bit per
> retarget; consensus is a 256-bit LWMA over the last 60 targets. […] nothing here should be cited
> as evidence of what a valid block is.

So the obvious cross-platform play — compile the Rust to WASM and ship it everywhere — produces a
wallet that disagrees with the network. **`hearth/node/` (JavaScript) is the authoritative
implementation**, and any core written for the clients is correct only insofar as it agrees with it
byte for byte.

That single fact determines §3.

---

## 3. One core, and the oracle that keeps it honest

**`micro-hearth-wallet-core`** — a new repository. Pure TypeScript, zero runtime dependencies on
anything platform-specific, no Node built-ins, no DOM. It must run unmodified inside a Tauri
webview, a React Native JSI context, and an MV3 service worker.

It owns exactly this:

| Concern | Detail |
| --- | --- |
| Mnemonics | BIP-39 generation, validation, and the wordlist |
| Derivation | BIP-32, BIP-44 at `m/44'/60'/0'/0/i` |
| Keys | secp256k1 — sign, recover, public key to address |
| Hashing | keccak256 |
| Encoding | RLP, EIP-55 checksummed addresses |
| Transactions | legacy and EIP-1559, signed under EIP-155 with chain id 7411 or 7412 |
| Keystore | the existing sealed format, unchanged |
| Messages | `personal_sign`, EIP-712 typed data |

**Why `m/44'/60'/…` and not a coin type of our own.** Hearth is EVM-compatible, so path 60 means a
Hearth seed phrase restores in MetaMask, Rabby, a Ledger, or any recovery tool a user already
trusts — and restores to the *same addresses*. A bespoke coin type would make CloudsForge the only
software on earth that can recover a CloudsForge seed, which is self-custody in name and captivity
in fact. The cost is that Hearth accounts and Ethereum accounts share a derivation path; that is a
cost worth paying and it is what every EVM chain already does.

### 3.1 The oracle

The core is **differentially tested against `hearth/node/src`**, which is the network's own
implementation:

- Every address the core derives is re-derived by `hearth/node/src/crypto/secp256k1.js`.
- Every transaction the core signs is re-encoded by `hearth/node/src/chain/transaction.js` and must
  produce an **identical byte string**, not an equivalent one.
- Every keccak digest is checked against `hearth/node/src/crypto/keccak.js`.
- A corpus of signed transactions is committed, and the suite fails if a signature changes — so a
  refactor that silently alters encoding cannot pass.

**A test that only checks the core against itself is a check that cannot fail**, and it is the
defect class this estate keeps finding. The node is the oracle precisely because it is not ours to
adjust when the test goes red.

### 3.2 What the core must never contain

No network calls. No storage. No UI. No logging of anything derived from a private key or a
mnemonic — enforced by a test that greps the built bundle for the mnemonic and the key of a known
vector and fails if either appears. `hearth/node/src/cli/wallet.js` already states the rule this
inherits: a private key is never printed, never logged, never written in the clear unless the user
asked with a flag whose name says what it does.

---

## 4. The platforms

Nine targets, three shells, one core.

| Target | Shell | Repository | Notes |
| --- | --- | --- | --- |
| Windows, macOS, Linux | **Tauri v2** | `micro-wallet-desktop` | Continues `hearth/app-desktop`, which is honest scaffolding today |
| Android, iOS | **React Native** | `micro-wallet-mobile` | Core runs in JS; secure storage is native |
| Chrome, Opera, Edge | **MV3** | `micro-wallet-extension` | Opera and Edge are Chromium — one build, three listings |
| Firefox | MV3 | `micro-wallet-extension` | Same source, separate manifest and signing |
| CLI | already exists | `hearth` | Gains BIP-39 via the core; keystore unchanged |

### 4.1 Desktop — finishing what exists

`hearth/app-desktop` is Tauri v2 and its README lists four defects with unusual precision. They are
the desktop work-list:

1. **`start_node`, `stop_node` and `node_running` have zero callers.** `frontendDist` points at
   `../../web`, static pages that know nothing about Tauri, so the app is the web wallet in a
   native window with no way to start a node.
2. **`node_entry()` cannot resolve in a bundle** — it is relative to the working directory, which
   does not exist inside a `.app` or `.msi`. It works from a dev checkout, which is why it looked
   fine.
3. **It assumes Node.js is on PATH** and bundles neither Node nor `node/` as a Tauri resource.
4. **No CI job builds it.**

Note what this means: **"press *Start your hearth* and you're mining" is the desktop app's whole
premise, and it has never once worked.** The wallet is the easy half. Shipping a node inside a
desktop bundle — sidecar binary, resource resolution, lifecycle, log surface, graceful stop — is
the hard half, and it is the reason desktop is phased ahead of mobile in §8.

### 4.2 Mobile — why React Native rather than Tauri mobile

Tauri v2 supports mobile, and using it everywhere is tempting. It is refused for two reasons:
Tauri's mobile support is materially younger than its desktop support, and — decisively — **iOS
forbids JIT and third-party browser engines**, so the webview story is Apple's and app review is
opinionated about crypto wallets. React Native has a deep, boring, well-trodden path through both
stores, and the core is plain TypeScript that runs in its JS context unmodified.

Keys never live in JS storage. Android uses the Keystore with `StrongBox` where available; iOS uses
the Secure Enclave and Keychain with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`. **Biometric
unlock gates the decryption of the seed, not merely the drawing of a screen** — a biometric check
that only hides a UI is theatre, and it is exactly this estate's recurring defect wearing a
fingerprint.

There is no node on mobile, and no mining. That is a deliberate refusal, not an omission: mobile
PoW drains a battery to produce nothing, and a wallet that cooks a phone is a wallet people delete.

### 4.3 Extensions — the part with an existing standard to obey

The extension is the dapp surface, and it interoperates or it is useless:

- **EIP-1193** for the provider interface.
- **EIP-6963** for multi-wallet discovery, so installing this does not fight MetaMask over
  `window.ethereum`. A wallet that wins that fight by force is a wallet users uninstall.
- **EIP-3085 / EIP-3326** so a dapp can propose adding or switching to Hearth 7411/7412.
- MV3 service worker, which **terminates when idle** — so no signing state may live in a module
  variable. Every unlock is explicit and every pending request survives a worker restart or is
  cleanly failed. This is the single most common source of extension bugs and it is a design
  constraint, not an implementation detail.

Firefox ships from the same source with its own manifest and AMO signing. Opera and Edge take the
Chrome build unchanged; they are separate listings, not separate products.

---

## 5. What a good wallet does

The functional bar, stated so it can be argued with:

**Accounts.** Create from a new mnemonic; restore from an existing one; derive multiple accounts
from one seed; import a raw key or a keystore file; watch-only addresses; hardware wallet support
(Ledger first) — deferred to phase 3 but designed for now, because retrofitting an external signer
into a codebase that assumes local keys is a rewrite.

**Money.** Balance and history; send with a fee estimate the user can override; receive with a QR
code and a checksummed address; address book; ENS-style names only if Hearth grows them, and not
faked until then.

**Tokens.** Detect and display ERC-20 balances; add by contract address; NFT display for ERC-721
and ERC-1155.

**Token deployment — the differentiator.** `micro-mint` already deploys real OpenZeppelin contracts,
testnet by default. The wallet gets the same capability **signed locally**: pick a template, set
name, symbol, supply and decimals, see the constructor arguments and the deployment cost, sign, and
watch it confirm. The templates come from `micro-mint`'s catalogue so there is one audited set
rather than two; the signature is the user's, so the platform is not in the custody path of a
contract the user owns.

**Dapp interaction.** Connect, sign, switch chain, and a transaction preview that **decodes the
call rather than showing a hex blob**. Unlimited-approval warnings, and a spend-allowance manager,
because approvals are how people actually lose money.

**Safety.** Explicit seed-phrase backup with verification; a duress-resistant reveal flow that does
not put the phrase on screen in one tap; auto-lock; **a phishing warning that names the origin**;
and a hard rule — the wallet never asks for the seed phrase after setup. Anything that does is not
this wallet, and the onboarding says so in those words.

**Chain.** Add and switch networks; a custom RPC; and on desktop the option to point at *your own
node*, which is the whole point of a chain you can mine on a laptop.

### 5.1 Prediction markets, natively — and why they fit self-custody exactly

Forge Foresight belongs in this wallet more naturally than anything else in §5, and the reason is
in the contract rather than in the pitch. `foresight/src/contracts/ForesightMarket.sol` is a real
deployed contract, and its staking path is **permissionless**:

```solidity
function stake(uint8 outcome) external payable   // :197
    _stakes[msg.sender][outcome] += msg.value;   // :205
function claim() external { _claim(msg.sender); } // :431
```

There is no allowlist, no operator mediation and no platform signature in that path. A user stakes
by sending value from **their own address**, the contract holds it, and `claim()` pays whoever
calls it. The platform deploys markets and acts as the oracle; it is not in the custody path of
anybody's stake. That is what "the service orchestrates; the contract is the custodian" means when
it is true rather than aspirational.

So the wallet gets Foresight as a **first-class surface, not a webview**:

- **Read positions straight from the chain.** `stakeOf(address)` (`:352`), `payoutOf(address)`
  (`:405`), `oddsBps(uint8)` (`:362`), `total()`, `distributable()` and `claimableFrom()` are all
  public views. The wallet needs no CloudsForge API to tell a user what they hold or what it is
  worth.
- **Stake and claim locally signed.** One payable call, one claim call, both from the user's key.
- **Odds are read at signing time and shown as they were.** A parimutuel's odds move with every
  stake including your own, so the confirmation screen states the pool as observed and does not
  imply the displayed odds are the settled ones. A wallet that shows a fixed payout on a
  parimutuel is lying, cheerfully.

**The property worth building for: positions survive the platform.** If every CloudsForge service
were switched off tomorrow, a user holding this wallet could still see their stake and still claim
their winnings, because both live in a contract and the wallet can talk to any Hearth node. That is
the strongest possible demonstration of the principle in §1 — and it is only true if the wallet
never routes these calls through the platform. **It must therefore be built to work with the
Foresight API entirely absent**, and tested that way.

The one thing the chain cannot supply is **discovery**: which markets exist and what question each
one asks. That comes from `micro-foresight`, and it degrades honestly — with the API reachable the
wallet browses and searches markets; without it, a user can still paste or scan a contract address
and interact fully. Discovery is a convenience; custody is not.

**Deliberately excluded from the first release:** creating a market. Market creation involves the
oracle role, category curation, the house seed and approval — that is operator machinery
(`21-engagement-treasury.md` §5), and putting it behind a self-custody key would either duplicate
it badly or grant powers the key was never meant to carry.

---

## 6. The assets

Every platform demands its own art in its own sizes, and store review rejects the wrong ones. The
set below is generated with **both models** — FLUX 2 Pro as the shipped reference, Qwen-Image 2512
into `candidates/` — following the rule already in force for `micro-brand`: challengers never
overwrite the reference.

| Group | Contents |
| --- | --- |
| **Mark** | The wallet mark, on light and dark, plus a monochrome cut for tray and favicon |
| **Desktop icons** | `.icns` (macOS, 16→1024), `.ico` (Windows, 16→256), Linux PNG set, tray icons in both polarities |
| **Mobile icons** | iOS from 20pt to 1024pt including App Store; Android legacy, adaptive foreground and background layers, monochrome for Material You, Play Store 512 |
| **Extension** | 16, 32, 48, 128; toolbar icons in both polarities; a badge overlay for a pending request |
| **Splash / launch** | iOS launch, Android 12+ splash, desktop window chrome |
| **Onboarding** | 7–9 illustrations: create, restore, back up the phrase, verify it, biometric unlock, first send, place a prediction, deploy a token |
| **Empty states** | No accounts, no tokens, no activity, no open positions, no dapps connected, offline |
| **Foresight** | Outcome marks for yes/no, a resolved mark, a voided mark, and a claimable badge — readable at list density and **distinguishable without colour**, since resolved-versus-voided decides whether money is a payout or a refund |
| **Store listings** | Screenshot frames per store, feature graphic (Play 1024×500), promotional tiles for three extension stores |
| **Security art** | The seed-phrase screen, the phishing warning, the approval warning — deliberately distinct from the friendly onboarding style, because a warning that looks like an illustration gets clicked through |

Assets live in **`micro-wallet-assets`** with a `MANIFEST.json`, mirroring the existing asset repos
so the same manifest-count-equals-file-count check applies. Icon sizes are **derived** by
downscaling from a single master per polarity, not generated per size — a diffusion model asked for
the same mark nine times returns nine different marks, and an app whose icon changes between sizes
looks broken.

---

## 7. Security model, stated plainly

The threat model is written out because a wallet's security claims are the product:

- **The platform is not trusted.** No CloudsForge service ever receives a mnemonic, a private key,
  or a decrypted keystore. This is testable and is tested: the estate's key-material body scan
  already sweeps roughly 498 routes across 29 servers, and the wallet's own suite greps its bundles.
- **The device is semi-trusted.** Keys sit in OS-provided secure storage and are decrypted for the
  duration of a signature. A rooted or jailbroken device is out of scope and the wallet says so
  rather than implying protection it cannot give.
- **The network is not trusted.** RPC responses are treated as hostile input. Balances shown are
  those a node reported; a confirmation is not final until the chain's own depth rule says so.
- **Analytics see nothing.** No address, no balance, no transaction. If telemetry cannot be built
  under that constraint, there is no telemetry.

**Two open questions, recorded rather than hidden.** Whether the first release accepts a
"CloudsForge cannot recover this for you" flow with no social recovery at all — recommended, since
account abstraction can add recovery later and a half-built recovery path is worse than an honest
absence. And whether iOS ships before Android; App Review is the longer pole and starting it early
surfaces refusals while there is time to answer them.

---

## 8. Phasing

Each phase ends with something a person can actually use.

1. **Core + oracle.** `micro-hearth-wallet-core` with BIP-39/32/44, signing, and the differential
   suite against `hearth/node`. Nothing user-facing. Everything downstream is wrong if this is.
2. **Extension, Chrome first.** The fastest path to a real user doing a real thing, and the surface
   that forces EIP-1193 and EIP-6963 to be right. Firefox and Opera follow from the same source.
3. **Desktop.** The Tauri app, with the four defects in §4.1 closed and the node genuinely bundled
   — the first time "start your hearth" is true.
4. **Mobile.** Android first (faster review, easier signing), then iOS.
5. **Foresight** (§5.1) — read, stake, claim. Sequenced *before* token deployment deliberately: it
   is a payable call and two view reads against a contract that already exists and is already
   tested, so it proves contract interaction and call decoding on easy ground. Token deployment
   proves the same machinery while also constructing bytecode, and doing the harder one first
   confuses two sources of failure.
6. **Token deployment**, across all shells, once the signing path is proven by ordinary sends.
7. **Hardware wallets**, and whichever of §7's open questions is still open.

Assets are generated at the **start** of phase 2, not the end: store listings gate submission, and
discovering that at submission time costs a week.

---

## 9. New repositories

| Repository | Owns |
| --- | --- |
| `micro-hearth-wallet-core` | Mnemonics, derivation, signing, encoding, keystore. The oracle suite. |
| `micro-wallet-extension` | Chrome, Firefox, Opera, Edge. The EIP-1193 provider. |
| `micro-wallet-desktop` | Tauri v2 for the three desktop platforms, and the bundled node. |
| `micro-wallet-mobile` | React Native for Android and iOS. |
| `micro-wallet-assets` | Every icon, illustration and store asset, in both model sets. |

Five repositories, none of them a service, none of them deployed by the estate's compose.

---

## 10. Why none of this can affect the testnet deployment

The owner's constraint was explicit, so here is the argument rather than the assurance:

1. **Every repository in §9 is new.** No existing repository is modified in phases 1–4. The one
   eventual exception is the `hearth` CLI gaining BIP-39 from the core (§4), which is additive, is
   not on the testnet path, and does not land before phase 3.
2. **Nothing is added to `docker-compose.estate.yml`.** These are clients. They are not services,
   they have no database, they are not in the registry's deployable set, and they consume no port
   from the derived block.
3. **The estate's four CI invariants are unaffected.** No new ledger account type, no new auth
   scope, no new event topic, no new route — so scope totality, topic reconciliation and the
   key-material body scan see nothing new. The wallet talks `eth_*` JSON-RPC to a Hearth node, an
   interface the chain already serves.
4. **The chain is read-only to this work.** `hearth/node` is the correctness oracle in §3.1, and an
   oracle is *read*. If the core and the node disagree, the core is wrong and the core changes.
   **Foresight is the same shape**: `ForesightMarket.sol` is consumed as a deployed ABI, not
   modified. The wallet calls `stake`, `claim` and the public views that already exist and are
   already covered by `contracts.test.ts`. No Solidity changes, so no redeploy, so nothing the
   testnet run depends on moves.
5. **The one shared resource is asset-generation capacity**, and that is a scheduling matter, not a
   correctness one. §8 puts asset generation in phase 2, after the testnet run.

The honest residual risk is **attention**, not architecture: five new repositories compete for
review with an estate that is mid-migration. That is a sequencing decision for the owner, and it is
why this document is a plan rather than a branch.
