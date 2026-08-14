# 38 — The combined view: one frontend estate, two networks

**Status when written:** deployed with release **2026.08.37** (2026-08-14). This document records
the topology that replaced the duplicated-frontend model doc 26 describes, the owner's decision
that drove it, and the parts of the old model that deliberately survive.

Decision record: micro-org#459 end to end. The owner's instruction, verbatim in intent: *"we
should be able to shut down the testnet ecosystem after, and everything works from the new
combined view."*

## What a user sees

One set of surfaces, on the mainnet hostnames. Every page carries a **Mainnet | Testnet**
switcher in the shared bar. On surfaces with in-app context (explorer, network-site's chain
panels, hub) the switcher swaps the **data** in place; everywhere else it is a navigation
control. Testnet data always wears the amber band — *"TESTNET — coins and balances here have no
value"* — keyed to the network being **viewed**, not the hostname, because under the combined
view the address bar alone can no longer carry that truth.

One account. One login. The session minted at the portal is valid against both networks' services.

## The topology

| Layer | Mainnet | Testnet |
|---|---|---|
| Frontends (19 bundles) | serve both networks | **retired** — non-`/v1` requests on `*-testnet` hostnames and the testnet apex answer **302** to the mainnet sibling, same path |
| Public `/v1` APIs | as before | **alive on the same `-testnet` hostnames** — the combined view's cross-estate reads depend on them |
| Identity | **the** identity — mints for both estates | retired; nothing trusts it |
| Money tier (chain, indexer, wallet, pool, settlement, custody, ledger, faucet…) | as before | **alive** — testnet survives as a data plane |
| Gateways / tunnel | unchanged | unchanged (serving APIs + redirects) |

The 302 rather than 301 is deliberate while the retirement beds in: a cached permanent redirect
is the one thing that cannot be rolled back.

## The security model that makes one identity safe

Sharing an identity across estates shares more than logins: receiving services authorise by
**scope**, so without a counter-measure a testnet service token carrying `ledger:post` would
pass at the mainnet ledger — a testnet compromise reaching mainnet money writes.

The counter-measure is the **`net` claim**, and its asymmetry is the design:

- **Service tokens carry `net`** (`identity/src/tokens.ts`), naming the estate they were minted
  for. Every service's verifier is armed via `AUTH_EXPECTED_NETWORK` on the common-env anchor
  (`@cloudsforge/runtime-auth`, `VerifierOptions.expectedNetwork`, env fallback documented at the
  constructor): a verified token naming the other estate is a deterministic 401 `wrong_network`.
- **User tokens deliberately carry no claim.** A person is one account with per-network data;
  their token must cross. This was caught as a defect before it shipped — the first version
  stamped user tokens too, which would have 401'd every signed-in reader the moment they touched
  the switcher (micro-identity#20 records it).
- Absent claims are tolerated by the verifier — the rollout property that let the gate arm one
  release before the claims flowed, and the reason the migration had no flag-day.

Cross-estate **service credentials**: the 19 testnet services exchange at the mainnet identity
(`https://nimbus.cloudsforge.online`, `POST /service-tokens/exchange`) with credentials
provisioned in the mainnet `service_credentials` table under label `testnet`. The `iss` claim
string is identical on both estates by construction (`http://identity:4000`), so only the JWKS
and exchange URLs moved (`CF_IDENTITY_JWKS_URL` / `CF_IDENTITY_URL` in `compose/testnet.env`).

**The `net` on an exchanged token comes from the credential row, never from the minting
deployment.** `service_credentials.network` (identity migration 14, release 2026.08.38) names the
estate each credential mints for, read the same way the service name is and for the same reason —
a caller must not be able to name its own estate. This was the combined view's first live defect:
for the hours between .37 and .38 the shared identity stamped its own `IDENTITY_NETWORK` on every
exchange, so testnet custody refused testnet settlement ("token minted for network mainnet, this
deployment is testnet") in a remint loop, while the same token would have *passed* at the mainnet
ledger — both directions of wrong at once. Null `network` falls back to the deployment's own,
which is what every pre-combined-view credential meant, so mainnet's rows needed no backfill.

## Why the flip was one deploy, not two

Once testnet services trust the mainnet keys, a token the **testnet** identity mints fails
verification at testnet's own services. The testnet portal therefore could not mint a usable
login for even a minute after the trust switch — so the frontends could not outlive it. The
same testnet deploy that flips trust (`CF_IDENTITY_*`) also retires the frontends
(`CF_WEB_RETIRED=true` → the priority-550 redirect routers in `gateway/dynamic/estate-web.yml`).
`compose/testnet.env` carries both flags side by side with this reasoning inline.

## What deliberately survives of the old model

- **The `-testnet` hostnames.** They serve the APIs and the redirects. Old links, bookmarks and
  mails land on the mainnet sibling with the path intact.
- **The testnet money tier**, untouched. A switcher with no testnet data behind it would be a
  control that lies.
- **The write asymmetry.** The old "writes stay hostname-pinned" rule died with the testnet
  hostnames, and its replacement is recorded in `hub-web/src/lib/viewed.ts`: a write follows the
  VIEWED network, the amber band is the guard, and there is no path where a testnet-marked
  screen moves real value.
- **The no-persistence invariant.** The viewed network is in-memory, per tab, defaulting to the
  hostname. `explorer-web/src/lib/network.ts` holds the scar tissue that mandates this, and its
  storage-free test still passes untouched.

## Rollback

`runbooks/runbook-combined-view-rollback.md` in micro-deploy. In one line: remove
`CF_WEB_RETIRED` and the `CF_IDENTITY_*` lines from `compose/testnet.env`, redeploy testnet, and
the estate is back to doc 26's two-frontend model — the testnet identity's database was retired,
not deleted, and the 302s were never cached as permanent.

## Corrections to older documents

- **Doc 26** gains a dated pointer here; its two-environment frontend model is historical.
- Comments inside surfaces describing "two deployments of this bundle on two hostnames" remain
  true of the bundle's *capability* (the code still resolves per hostname) and stale as a
  description of what is *deployed*; they are corrected as touched, per the estate's practice.
