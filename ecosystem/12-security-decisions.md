# 12 — Security decisions

The authoritative security record for the programme. Every major decision, with the context that
forced it, the alternatives rejected, the threat it addresses, the risk that remains, and how the
control is verified continuously rather than asserted once.

The estate holds customer funds across five chains and custodies the private keys for them. That
single fact sets the bar: a control that cannot be verified is not a control, and a residual risk
that is not written down is a surprise waiting to happen.

Read [00-current-state.md](00-current-state.md) §3.5 for the measured starting position.

---

## SD-01 · Authentication remains RS256 with a single audience

**Decision.** Keep the existing model: RS256 JWTs, `aud: cloudsforge`, `iss` = the configured
issuer, JWKS at `/.well-known/jwks.json`, 15-minute access tokens, 30-day rotating refresh
tokens with family reuse detection. Add an OIDC-conformant façade for third parties in P11,
without changing the internal mechanism.

**Context.** `platform/services/nimbus/src/tokens.ts`, `keys.ts`, `exchange.ts`. The private JWK
is stored AES-256-GCM encrypted under a scrypt-derived key (`keyEnvelope.ts`), with a full
`active | published | retired` rotation state machine and a 20-minute publish window. Refresh
tokens are opaque 32-byte values stored SHA-256 only, rotated with a `family_id`, with a
10-second grace window so concurrent browser tabs do not burn a family.

**Rationale.** This is better than most production identity code and there is no defect to fix.
Six services independently verify against JWKS with no shared session store, which is what makes
the estate horizontally scalable at the auth layer even though it is not elsewhere.

**Alternatives rejected.**
- *Full internal OIDC.* Adds discovery, consent, `nonce`, and three more grant types to solve a
  problem — third-party clients — that does not exist internally. It becomes necessary in P11 and
  is added there, as a façade, so the internal path keeps its smaller surface.
- *Opaque tokens with introspection.* Turns identity into a synchronous dependency of every
  request in twenty-five services. Rejected on availability grounds.

**Threat model.** A stolen access token is usable for at most 15 minutes. A stolen refresh token
is single-use; replaying it burns the entire family and signs the real user out, which is a
detection mechanism as well as a containment one.

**Residual risk.** A token stolen from browser storage is usable until expiry; there is no
proof-of-possession binding. Accepted for now; DPoP is an open decision in
[16-risks-and-open-decisions.md](16-risks-and-open-decisions.md).

**Verification.** Beacon journeys `identity.signin`, `identity.handoff`. A test asserting JWKS is
deterministically ordered across replicas (the split-brain fix, SD-14). Token TTLs asserted in CI.

**Phase.** P3 (extraction), P11 (OIDC façade).

---

## SD-02 · MFA is introduced, and is mandatory for privilege rather than for everyone

**Decision.** TOTP and WebAuthn as first-class factors, plus single-use recovery codes.
**Mandatory** for: accounts holding the `admin` role, accounts with an active developer
credential, and accounts whose portfolio exceeds a configurable value. **Prompted, not forced,**
for everyone else. Removing the last active factor requires re-authentication and emits a
critical notification that cannot be suppressed.

**Context.** There is no MFA anywhere in the estate today — no TOTP, no WebAuthn, no recovery
codes. There are also no session or device records, so a user cannot see or revoke anything.

**Rationale.** Forcing MFA on every account of a consumer crypto product at the point of
introduction locks out the users who most need help and generates support load that the estate
has no team to absorb. Forcing it where the blast radius is large — operators, developers, large
balances — buys most of the protection for a fraction of the disruption.

**Alternatives rejected.**
- *SMS as a primary factor.* SIM-swap is the dominant attack against crypto accounts. SMS is
  offered only as a delivery channel for critical alerts, never as an authentication factor.
- *Email as a second factor.* The email account is usually the recovery path already; using it as
  a factor makes one compromise sufficient.

**Threat model.** Credential stuffing, phishing, and password reuse. WebAuthn is the only factor
here that resists phishing, so it is the one the UI recommends first.

**Residual risk.** TOTP is phishable. Users who choose it are protected against stuffing and
reuse but not against a convincing proxy. Accepted, because refusing TOTP would mean many users
having no second factor at all.

**Verification.** A journey enrolling and using each factor. A test asserting the last-factor
rule. An alert if the proportion of admin accounts without MFA is ever non-zero.

**Phase.** P6.

---

## SD-03 · Authorisation has four layers, deliberately

**Decision.** Four distinct mechanisms, each answering a different question:

| Layer | Question | Owner | Example |
| --- | --- | --- | --- |
| Platform role | Is this person staff? | `identity` | `admin` |
| Organisation role | What may they do inside this org? | `identity` | `owner`, `billing`, `member` |
| Entitlement | What have they bought or earned? | `billing` | a season pass, an API plan |
| Policy decision | Should this specific action, right now, be allowed? | `policy` | this withdrawal, from this device, to this address |

**Context.** Today there is one mechanism: a `roles text[]` column containing `player` or
`admin`, carried in the token. There is no organisation concept, entitlements are Bearer-only so
no service can read them, and the only genuine policy layer in the estate is custody's purpose
gate.

**Rationale.** Collapsing these produces one of two failures. Put entitlements in the token and
they cannot be revoked until it expires. Put contextual risk in roles and every risk signal
becomes a schema migration. Keeping them separate means a token stays small and cacheable, an
entitlement revocation takes effect immediately, and a risk rule ships without touching identity.

**Alternatives rejected.**
- *One permissions service.* Attractive, and it makes every read in the platform depend on a
  synchronous call to a service that must never be down. Rejected on availability.
- *Entitlements in the JWT.* Rejected because a refund must remove access now, not in 15 minutes.

**Threat model.** Privilege escalation via a stale token; a revoked purchase still granting
access; an operator acting beyond their role.

**Residual risk.** Four mechanisms is four places to get authorisation wrong. Mitigated by
`@cloudsforge/auth` providing one middleware that consults all four in a fixed order, so a
service cannot accidentally consult only one.

**Verification.** Negative tests per layer: an expired entitlement denies; a demoted role denies
on the next request; a policy `deny` blocks even with a valid role.

**Phase.** P5 (policy), P6 (organisations, entitlement API).

---

## SD-04 · Account recovery is deliberately slow at the last resort

**Decision.** Three tiers, increasing in friction:

1. **Password reset** — email token, 30-minute TTL, single use, SHA-256 at rest, link built from
   the configured public URL and **never from the request `Host` header**. Spending it revokes
   every refresh family. This exists and is correct; it is retained unchanged.
2. **MFA recovery codes** — single-use, shown once, regenerable, and their use emits a critical
   notification.
3. **Full account recovery** (lost password *and* lost every factor) — a manual, evidence-based
   process with a **mandatory 7-day hold**, notification to every channel on the account at the
   start and end of the hold, a cancel link that any of those channels can trigger, and
   **withdrawals frozen for 7 days after recovery completes.**

**Context.** `nimbus/src/passwordReset.ts` already gets the hard parts right — including
answering `202` *before* doing any work, so the endpoint is not a timing oracle for whether an
email exists. Tier 3 does not exist at all today.

**Rationale.** Account recovery is the single most abused support channel in crypto. Every
control on the account is worth exactly as much as the recovery path behind it. The 7-day hold
plus the post-recovery withdrawal freeze means that a successful social-engineering attack still
does not move money before the real owner has had a week of notifications to object.

**Alternatives rejected.**
- *Instant support-driven recovery.* This is how consumer crypto accounts are actually stolen.
- *No recovery at all.* Defensible for a pure self-custody product and wrong here, because the
  platform holds custodial balances a user cannot otherwise reach.

**Threat model.** An attacker with the email account, or with enough personal information to
convince a support agent.

**Residual risk.** A patient attacker who also controls the notification channels can wait out
the hold. Mitigated by requiring notification to *all* channels and by the withdrawal freeze.

**Verification.** A rehearsed recovery exercise per quarter. A test asserting the freeze applies.
An alert on any recovery completing without the full hold elapsing.

**Phase.** P6.

---

## SD-05 · The shared service tokens are replaced by scoped, short-lived service identity

**Decision.** Retire `PAY_SERVICE_TOKEN` and `KEYVAULT_SERVICE_TOKEN`. Identity issues RS256
service tokens with `sub=service:<name>`, a 10-minute TTL, and explicit scopes. Every ledger
posting and every signing request records the calling service.

**Scopes:** `ledger:read` · `ledger:post` · `ledger:reserve` · `wallet:read` ·
`wallet:provision` · `custody:sign:deposit` · `custody:sign:treasury` · `custody:sign:deployer` ·
`billing:grant` · `billing:read` · `pricing:read` · `indexer:read` · `notify:send` ·
`policy:decide`.

**Context.** `forge-pay/services/pay/src/routes/internal.ts` — one shared secret, and holding it
grants read, debit, credit and liquidation over **every user's money**, with `userId` as a
request parameter rather than a token claim. The service's own comments acknowledge this. Three
containers hold it. `forge-keyvault/src/auth.ts` is the same shape for custody: any holder can
mint a treasury address, sweep every deposit into it, then drain it via a `purpose:'treasury'`
transfer. That last chain is documented as a residual risk in `signing.ts` source comments.

**Rationale.** The `userId`-as-parameter design is *correct* — a settlement running an hour after
the user has left has no user token to forward. The defect is not the shape; it is that the
authorisation is one bearer string with no identity, no scope and no expiry. Nimbus already signs
RS256 and every service already fetches its JWKS, so scoped service tokens cost almost nothing to
introduce.

**Alternatives rejected.**
- *mTLS between services.* Gives transport identity, not action scope, and adds certificate
  lifecycle management for a single-host deployment. Network segmentation (SD-13) covers the
  transport concern.
- *Per-service static secrets.* Better than one shared secret, and still unexpiring, unscoped,
  and invisible in an audit trail.

**Threat model.** A compromise of any one service currently escalates to total control of all
customer funds. With scopes, a compromised `trade` can charge fees and cannot mint, cannot sign,
and cannot read another user's wallet.

**Residual risk.** A compromised service can still do everything within its scope, for as long as
it holds a valid token. Scope minimisation and the 10-minute TTL bound it.

**Verification.** A CI check that no service reads a variable named `*_SERVICE_TOKEN`. A test per
service asserting it is refused on a scope it should not hold. Every ledger entry carries
`originating_service`, and a dashboard panel shows postings by service — a service posting
something it never posted before is visible.

**Phase.** P4 (ledger and wallet), P5 (custody).

---

## SD-06 · Key material: envelope encryption stays, key versioning is added, the vault is frozen

**Decision.** Keep AES-256-GCM with per-address scrypt-derived data keys. **Add a key version to
the envelope and a re-encryption pass**, which is what makes the master secret rotatable.
**Freeze the container-per-address vault design** — it is not changed, and custody is declared
permanently single-replica.

**Context.** `forge-keyvault/src/crypto.ts`: blob format `v1:base64(iv||tag||ct)`, data key =
`scryptSync(masterSecret, "kv:v1:<address>", 32)`. `CURRENT_VERSION = 1`, there is no v2 branch
and no re-encryption pass, so **`KEYVAULT_MASTER_SECRET` cannot be rotated** — changing it makes
every custodied key undecryptable. The salt is the address rather than random, and scrypt runs at
default cost. Storage is a per-address Docker volume `kv-<shortAddr>` inside a per-address
`alpine` holder container with `NetworkMode: none`, driven over a read-write Docker socket by a
process running as **root**.

**Rationale for versioning.** "A compromise is unrecoverable" is not an acceptable property for a
custody system. Versioning is a small, well-understood change: write `v2:` blobs under a new
derivation, decrypt either version, and run a background re-encryption job. Until that exists,
every other custody control is standing on a secret that can never be changed.

**Rationale for freezing the vault.** It is correct for what it does — an attacker with database
access gets ciphertext and nothing else, and the holder containers have no network. It is also
what blocks any multi-host deployment, and rewriting it is a project of its own with a fresh set
of unknowns in the most dangerous part of the estate. The decision is to write down that custody
does not replicate rather than to discover it during a migration.

**Alternatives rejected.**
- *HSM or cloud KMS.* The right long-term answer for the master secret and an open decision in
  [16](16-risks-and-open-decisions.md). Rejected *now* because it changes the trust model and the
  deployment story simultaneously, and the estate has more urgent gaps.
- *Rewriting the vault to a plain encrypted store.* Would remove the root-plus-socket risk. Also
  removes a working, tested isolation property, during the phase where custody is already gaining
  HD derivation. Sequenced after, not during.
- *Raising scrypt cost and randomising the salt in place.* Cannot be done without the versioning
  this decision introduces, which is a further argument for it.

**Threat model.** Database exfiltration (defeated by encryption). Host compromise (**not**
defeated — root plus a read-write Docker socket means an RCE in custody is total custody loss).

**Residual risk — the largest accepted risk in the estate.** Custody runs as root with the Docker
socket mounted. It is accepted because the isolation it buys is real, the fix requires a host GID
and volume-ownership change that has already been attempted, and the compensating controls are
network isolation (SD-13), no outbound dependencies (SD-13), and the smallest route surface in
the estate. It is recorded in the debt register below with the condition that would force it to
change.

**Verification.** A test that decrypts a `v1` blob after the master secret has been rotated to a
new value with re-encryption complete. Boot-time refusal on placeholder secrets, which already
exists and is asserted in CI. A quarterly rotation rehearsal on staging.

**Phase.** P5.

---

## SD-07 · Private-key export is a user right, gated by a one-way lifecycle transition

**Decision.** A user may export the private key or recovery phrase of any managed wallet they
own. **Export is not a read; it is a state transition.** The wallet moves `active → exported` and
that transition is irreversible.

**The ceremony, in order:**

| # | Gate | Why this gate |
| --- | --- | --- |
| 1 | Re-authenticate with password | Proves the session was not merely left open |
| 2 | MFA challenge | Proves possession, not just knowledge |
| 3 | `policy.decide('custody.key.export')` | Account age, device trust, recent recovery, velocity |
| 4 | **24-hour cooling-off**, with a cancel link | The only control that defeats a live social-engineering call |
| 5 | Critical notification on every channel, at request and at expiry | The real owner learns even if the attacker holds the session |
| 6 | Second MFA challenge at redemption | The attacker must still hold the factor a day later |
| 7 | Single-use, short-TTL, origin-bound reveal token | Not replayable, not linkable, not shareable |
| 8 | Delivered once, never logged, never in a cacheable response | — |
| 9 | Wallet → `exported`; platform stops sweeping it into treasury | The platform stops treating it as custodial |
| 10 | Export recorded in the user's security log and the operator audit trail | Visible after the fact, to both parties |

**Formats.** Encrypted UTC/JSON keystore **by default** — it is the only format safe to save to
disk. Also offered: BIP-39 mnemonic (HD-derived wallets only), raw private key hex, WIF for
Bitcoin, XRP family seed.

**Context.** Today the user has no access to their own key at all. The only export path is
`POST /admin/keys/:address/reveal`, which is an administrator surface (SD-08). Existing addresses
are one flat random key each with **no HD derivation, no seed, no mnemonic** — which is why
[04-domain-model.md](04-domain-model.md) §3.3 keeps two key schemes permanently and why a
recovery phrase can only be offered for wallets created after P5.

**Rationale.** [01-product-vision.md](01-product-vision.md) principle 2: a user can always leave
with their assets. The safeguards are ours to design; the right is not ours to withhold. Making
export a state transition rather than a read is what keeps the platform honest afterwards — an
exported key is a key two parties hold, and continuing to sweep deposits from it into a platform
treasury would be indefensible.

**Alternatives rejected.**
- *No export.* Makes the platform the permanent owner of a user's assets. Rejected on principle.
- *Instant export behind MFA alone.* MFA is a defence against remote credential theft, not
  against a user on the phone with someone impersonating support. The 24-hour hold is the only
  control in the list that works while the user is actively being deceived.
- *Export without changing wallet state.* Cheaper, and it lets the platform keep treating a
  now-shared key as sole-custody. That is a reconciliation break waiting to happen and a
  misrepresentation to the user.

**Threat model.** Social engineering of the user; session hijack; a malicious insider using the
user-facing path. The cooling-off and the multi-channel notification address the first two; the
audit trail and the absence of any operator ability to complete the ceremony address the third.

**Residual risk.** A user who exports a key and does not understand what `exported` means. This
is a documentation and copy problem as much as a security one, and P6 treats the plain-language
guidance as a deliverable rather than an afterthought.

**Verification.** A journey covering the happy path, the cancel path, and cooling-off expiry.
A test asserting an `exported` wallet is excluded from sweep candidate selection. A response-body
scan (SD-16) proving no other route returns key material.

**Phase.** Designed P5, shipped P6, behind a per-user flag enabled progressively.

---

## SD-08 · `POST /admin/keys/:address/reveal` is deleted

**Decision.** Delete the route. Replace it with a two-operator break-glass procedure that cannot
be invoked from the admin console.

**Context.** `forge-keyvault/src/routes/admin.ts`. It accepts any address, decrypts it, and
returns `{address, chain, network, privateKey}` in plaintext — for **any** address including
every customer deposit key, in whatever native form was stored. The only gate is a Nimbus admin
JWT. The only mitigation is a `key_reveals` row and a `log.warn`. There is no approval, no rate
limit, no scoping, no per-address restriction, and no bulk protection: a loop over
`GET /admin/keys` followed by this route exfiltrates the entire custody estate.

Nimbus additionally proxies it, behind `NIMBUS_VAULT_REVEAL_PROXY` which defaults to false — a
flag that reduces exposure without changing the primitive.

**Rationale.** This is a total-exfiltration primitive reachable by a single compromised or
coerced administrator account, in a system that at the time of writing has **no MFA on
administrator accounts at all**. No amount of auditing makes that acceptable; an audit row tells
you afterwards that every key is gone. Deletion is the only proportionate response.

**The replacement.** A break-glass recovery procedure for the genuine cases — a customer who has
lost access and whose wallet predates HD derivation, or a disaster-recovery scenario:

- Requires **two named operators**, each authenticating with a hardware token.
- Requires a **signed incident record** naming the affected address, the customer, the reason and
  the ticket, created before the procedure begins.
- Runs from an **offline tool against a database backup**, not against the live service, and not
  from any web surface.
- Emits an alert to **every** administrator and a critical notification to the affected customer.
- Is **rehearsed quarterly**, and the rehearsal is a phase gate in P5.

**Alternatives rejected.**
- *Keep it, add rate limiting and per-address approval.* Retains a route on a network-reachable
  service that returns plaintext keys. The bar for that route existing at all is not met by
  making it slower.
- *Keep it for disaster recovery only.* Disaster recovery does not need a live HTTP endpoint; it
  needs a documented offline procedure and a backup. Those are strictly better.

**Threat model.** A compromised administrator credential; a coerced or malicious operator; an
attacker who reaches the admin surface through Nimbus's proxy.

**Residual risk.** The break-glass procedure still exists, because a custody system with no
recovery path strands customers. It is bounded by two-person control, hardware tokens, offline
execution and mandatory notification.

**Verification.** A test asserting the route returns 404. The response-body scan (SD-16). The
quarterly rehearsal, with its result recorded.

**Phase.** P5. **Irreversible** — this deletion is on the "cannot be rolled back" list in
[10-migration-strategy.md](10-migration-strategy.md), and the break-glass runbook ships in the
same release, not after it.

---

## SD-09 · The signing policy stays inside custody and is never delegated

**Decision.** Custody's authorisation for a signature is decided **inside custody**, by code that
is not reachable over the network. The policy service is an *additional* gate, never a
replacement.

**The gates, in the order they run** (`forge-keyvault/src/signing.ts`, `routes/vault.ts`):

1. **Purpose gate** — a `deposit`-purpose key can sign exactly one shape, `sweep`. A `treasury`
   key can sign `transfer`. A `deployer` key can sign zero-value contract creation only.
2. **Binding check** — five fields (`address`, `chain`, `network`, `userId`, `orderId`) must
   match the stored row. A caller cannot restate a key as something else.
3. **Chain-id resolution** — a generic `evm` chain is refused outright, because a signature
   without a chain id is valid on every EVM chain.
4. **Treasury pin** — for `deposit` sweeps, the destination is chosen **by the vault**, not by
   the caller, and must equal the pinned treasury for that chain and network.
5. **Only then is the key decrypted.**

Per-family shape allowlists: EVM has a field allowlist, exactly one fee model, and a
`gasLimit × maxFee` ceiling; Solana permits only SPL mint-creation instructions and refuses
Transfer, Approve, SetAuthority, Burn and CloseAccount; Bitcoin accepts PSBTs only and every
input's `witnessUtxo.script` must belong to the signing address, SIGHASH_ALL only; XRP accepts
`Payment` only, with a field allowlist, a bound `Account`, a fee ceiling, a mandatory
`LastLedgerSequence`, and `tfPartialPayment` refused.

**Rationale.** This is the best-designed component in the estate and the reason the shared-token
weakness (SD-05) has not already been catastrophic: even holding the token, a caller cannot make
a deposit key send funds anywhere except the pinned treasury. It is a *policy*, not a signing
oracle, and that distinction is what makes custody defensible.

**Why it is not moved to the policy service.** A signing policy enforced by a remote call is a
signing policy an attacker can bypass by reaching the signer directly, or by making the policy
service unavailable and hoping for fail-open. The gate must be co-located with the key.

**Additions in this programme.** A **signing audit table** — today a *successful* `/sign` records
nothing at all, only refusals are logged. Per-user authorisation — `row.userId` is currently
compared to nothing (`routes/vault.ts`). Rate limiting — there is none. Network binding for
XRP — testnet and mainnet currently share a seed and address, so one signed Payment is
submittable on either. Output policies for Bitcoin and Solana, which are specified in source
comments and not built, leaving both chains unable to sweep or withdraw.

**Residual risk.** A holder of `custody:sign:treasury` can still move treasury funds to any
destination, because a withdrawal must be payable to any address a user names. This is
irreducible and is bounded by treasury float policy: `PAY_TREASURY_TARGET_<COIN>` defaults to
zero, so the treasury holds only what a pending withdrawal requires.

**Verification.** The existing signing tests, extended to Bitcoin PSBT and Solana. Negative tests
per gate: a deposit key attempting a transfer, a mismatched binding, a generic `evm` chain, a
sweep to an unpinned address. A test that a successful sign writes an audit row.

**Phase.** P5.

---

## SD-10 · Financial limits and transaction approval

**Decision.** Policy-gated controls on money movement, fail-closed:

| Control | Rule | Fail mode |
| --- | --- | --- |
| Withdrawal threshold | Above a per-asset value, requires MFA re-challenge | Closed |
| New destination | First withdrawal to an unseen address holds 24h unless the address is on the trusted list | Closed |
| Trusted addresses | Adding one is itself a 24-hour, notified operation | Closed |
| Velocity | Per-user, per-asset, per-window caps | Closed |
| Reconciliation drift | Drift beyond per-chain tolerance **freezes withdrawals for that asset automatically** | Closed |
| Manual ledger adjustment | Two operators, mandatory reason code, audit event | Closed |
| Deposit caps on young chains | Per-user cap on EMBER until the chain has depth | Closed |
| Rate limits, soft caps | Advisory | Open, with an alert |

**Context.** None of this exists. `PAY_WITHDRAWALS_ENABLED` defaults to **true** while
`PAY_SWEEP_ENABLED` defaults to **false**, so a fresh deployment accepts withdrawals it cannot
fund, holds them for an hour, and refunds them. That is safe — nothing is ever signed — and it is
not a control, it is an accident that happens to be harmless.

**Rationale.** The automatic freeze on reconciliation drift is the most important line in the
table. It is the control that turns "the ledger disagrees with the chain" from a silent, growing
loss into a stopped system and a page.

**Residual risk.** Fail-closed controls create availability risk: a policy service outage stops
withdrawals. This is the correct trade for a custodial platform and is stated on the status page
rather than hidden.

**Verification.** Injected-drift tests proving the freeze applies to the correct asset only, and
only that asset. A test that a manual adjustment with one approver is refused.

**Phase.** P5 (policy), P7 (reconciliation freeze).

---

## SD-11 · Administrative access

**Decision.** MFA mandatory for the `admin` role. Every privileged operator action writes an
`audit_event` **in the same transaction as the change**, mirrored to `admin-api` in a hash-chained
tamper-evident log. Emergency freeze may be **set by one** operator and **cleared only by two**.

**Context.** `platform/apps/admin` currently offers user listing and role change, vault key
listing and reveal, price setting and withdrawal abandonment. There is no MFA. Audit is
`log.warn({audit: …})` — a log line, which is sampled, expires, and can be lost under load.
Nimbus's admin proxies forward the operator's own bearer token rather than a service secret,
which is a genuinely good decision: Pay and custody record *which* administrator acted.

**Rationale.** Asymmetric freeze authority is the important detail. An operator who suspects
compromise must be able to stop the system alone and immediately; restarting it should require a
second person who was not the one who panicked, or who was not the attacker.

**Alternatives rejected.** *Audit as structured logs into Loki.* Logs are sampled and expire by
design (SD-15). An audit record that can be dropped under load is not an audit record.

**Verification.** A test that clearing a freeze with one approver is refused. Hash-chain
continuity verified nightly; a break is a P0 alert. An alert on any admin account without MFA.

**Phase.** P13, except MFA-for-admins which lands with MFA in P6.

---

## SD-12 · Secrets are per-service, and rotation is designed per secret type

**Decision.** Each service declares the variables it needs; the deployment provides exactly those
and no others. `env_file: .env` fan-out is banned and the ban is asserted in CI. Docker secrets
or SOPS follow once per-service files are in place.

**Context.** `docker-compose.yml` uses `env_file: .env` on eight services, handing each container
**all 64 variables**. The game container holds `KEYVAULT_MASTER_SECRET`. The marketing site's
neighbours hold `PAY_SERVICE_TOKEN`. The blast radius of any single container compromise is
total.

**Rotation, by type:**

| Secret | Rotatable | Procedure |
| --- | --- | --- |
| `NIMBUS_KEY_SECRET` | Yes | Re-wrap signing keys; the `active/published/retired` machine already supports overlap |
| Service tokens | Yes, automatically | 10-minute TTL; rotation is expiry (SD-05) |
| Database passwords | Yes | Dual credentials during the window |
| `KEYVAULT_MASTER_SECRET` | **Not today** | Requires SD-06 versioning first. Until then, a compromise is unrecoverable |
| SMTP, RPC provider keys | Yes | Provider-side, no coordination needed |
| `LANTERN_TOKEN` / `BEACON_TOKEN` | Yes | Break-glass; rotate on operator departure |

**Rationale.** This is the highest-severity item in the estate relative to its cost. Splitting an
env file is an afternoon; the risk it removes is total compromise from any one of eight
containers.

**Verification.** A CI check enumerating each service's declared variables against what the
compose file provides, failing on any extra. A test that custody refuses to boot on a placeholder
secret — this already exists and is deliberately fail-closed.

**Phase.** P1 (split), P2 (secrets manager), P5 (master secret versioning).

---

## SD-13 · Network segmentation, and the two locks on `/internal`

**Decision.** Three networks: `edge` (gateway and frontends), `app` (services), `vault` (custody,
ledger, settlement). **Custody is reachable only from `vault`, and makes outbound calls to
nothing but `policy`.** The `/internal` refusal moves from a hand-written cloudflared path rule to
gateway policy, and the CI invariant moves with it.

**Context.** Today everything sits on one flat bridge network with plaintext HTTP, so anything on
the bridge can reach `forge-keyvault:4005` and `pay:4003/internal`. Two locks currently keep
`/internal` off the internet: loopback binding in compose, and a cloudflared rule that returns
404 for `pay.<apex>/internal/*` **before** the rule that routes the hostname. Both are asserted
in CI, because a previous configuration published 4003 on all interfaces and forwarded the
hostname with no path filter — `https://pay.<apex>/internal/charge` was live on the public
internet with one guessed token as the only protection.

**Rationale.** Custody having no outbound dependencies is a deliberate design property, not an
accident: it is why the indexer is a separate service (AD-07) rather than custody talking to
twelve RPC providers. A service that calls nothing cannot be pivoted through.

**Residual risk.** Plaintext HTTP within `app`. Accepted for a single-host deployment where the
network namespace is the boundary; revisited if the estate ever spans hosts, which is a stated
trigger in [16](16-risks-and-open-decisions.md).

**Verification.** The existing CI assertions, updated to the gateway mechanism rather than
deleted. A connectivity test asserting that a container on `app` cannot open a socket to custody.

**Phase.** P2.

---

## SD-14 · Availability controls that are security controls

Three defects are recorded here rather than only in [00](00-current-state.md), because their
consequence is security, not merely uptime.

- **Nimbus's split-brain signing key.** On a fresh database two replicas each generate a keypair
  with a different random `kid`; `onConflictDoNothing()` conflicts on nothing (the PK is `kid`),
  both rows insert, and `getJwks()` does `select().limit(1)` with **no `ORDER BY`**. JWKS is then
  nondeterministic across replicas: a consumer caches one key and rejects tokens minted by the
  other. Fixed by an advisory-locked bootstrap, deterministic ordering, and publishing all
  non-retired keys.
- **Bare `fetch` in Nimbus's two admin proxies** (`routes/vault.ts`, `routes/pay.ts`) has
  no total-request timeout on undici, so a hung custody service pins the identity service
  indefinitely — a denial of service on authentication for the entire estate, reachable by making
  one downstream slow.
- **`/health` is a static literal** used as a readiness gate across the estate. A replica whose
  database is unreachable reports healthy and 503s every request while the load balancer keeps
  feeding it.

**Phase.** P1 (the `fetch` timeout), P2 (readiness), P2/P3 (signing key).

---

## SD-15 · Audit is a first-class write, distinct from logs and from activity

**Decision.** Every service writes `audit_event` rows in the same transaction as the change they
describe. Audit is not derived from logs, and logs are not derived from audit.

**Actions that MUST produce an audit event:**

| Domain | Actions |
| --- | --- |
| Identity | Role change, MFA enrol/remove, password change, session revoke, recovery start/complete, organisation membership change |
| Custody | Address minted, **every signature**, every refusal, treasury mint, treasury pin/rotate, export requested/cancelled/completed, break-glass invoked |
| Ledger | Manual adjustment, reversal, reconciliation freeze/unfreeze, account freeze |
| Wallet | External wallet verified/revoked, trusted address added, withdrawal above threshold |
| Billing | Entitlement grant/revoke, refund, payout |
| Policy | Every `deny`, `challenge` and `review` decision |
| Admin | Every operator action, feature flag change, broadcast |
| Developer | Key created/rotated/revoked, OAuth client created, scope change |

**Rationale.** Logs are sampled, redacted and expire in 7 to 30 days by design. Activity records
are a user-facing narrative and are written from the event bus, so they are eventually consistent
and may be filtered. Neither can answer "who did what, to whose data, and was it allowed" months
later under dispute. Only a transactional, append-only, hash-chained record can.

**Verification.** A test per action asserting the audit row exists and is in the same transaction
— specifically, that rolling back the change also rolls back the audit row, and that committing
one commits both. Nightly hash-chain verification.

**Phase.** P5 onward, per service as it is built.

---

## SD-16 · Continuous security verification

Controls that are checked by machines, continuously, rather than reviewed by people
occasionally.

| Check | What it proves | Where |
| --- | --- | --- |
| **Response-body scan** across every route in every service | **No route in the estate can return private key material** | CI, every service |
| Secret-hygiene grep | No `.env` tracked, no `sk-` tokens, no placeholder secrets | CI, every repo (exists today) |
| `/internal` routing assertion | No hostname routes an `/internal` path | CI (exists today) |
| Env-var declaration check | No container receives a variable it does not use | CI |
| Scope negative tests | Each service is refused on scopes it should not hold | CI, per service |
| Signing gate negative tests | Deposit key cannot transfer; unpinned destination refused | CI, custody |
| Trial balance = 0 | The ledger cannot be silently unbalanced | Continuous, alerting |
| Hash-chain continuity | The audit log has not been tampered with | Nightly |
| Dependency and secret scanning, push protection | Supply chain and leaked credentials | Org level — **all currently off** |
| Break-glass rehearsal | The recovery path works | Quarterly |
| Restore drill | The backup is a backup | Quarterly |

**Note.** All nine product repositories are **public**. Secret scanning and push protection are
therefore the difference between a mistaken commit being caught and a mistaken commit being
published, and they are currently disabled at the organisation level.

---

## SD-17 · Backups are not backups until they are restored

**Decision.** Scheduled, encrypted, off-host backups of every database and every custody volume,
with **quarterly restore drills** that are the actual acceptance criterion.

**Context.** `infra/backup.sh` dumps every database and every `kv-*` custody volume. It is **not
scheduled** and it **writes locally**. A backup on the same disk as the thing it backs up is not
a backup.

**Custody backups are the sharp case.** They contain encrypted key material, and their security
depends entirely on `KEYVAULT_MASTER_SECRET` being stored separately from them. A backup and its
master secret in the same place is a plaintext key store with extra steps.

**Verification.** A restore drill that stands up the estate from backup on clean infrastructure
and passes the Beacon journey suite. Anything less measures that a file exists.

**Phase.** P13.

---

## Security debt register

Every knowingly accepted risk, and the condition that forces it to be revisited.

| # | Accepted risk | Why accepted | Revisit when |
| --- | --- | --- | --- |
| SDR-01 | Custody runs as root with a read-write Docker socket | The isolation it provides is real; the fix requires host GID and volume-ownership changes already attempted and abandoned | The estate moves to more than one host, or a container-escape CVE affects the runtime |
| SDR-02 | Custody is a single replica, permanently | Container-per-address custody has no multi-host story | An HSM or KMS design replaces the vault |
| SDR-03 | `KEYVAULT_MASTER_SECRET` is unrotatable | No key versioning exists yet | **Immediately** — this is SD-06, P5. Until then, treat any custody host compromise as unrecoverable |
| SDR-04 | Plaintext HTTP between services | Single host, network namespace is the boundary | The estate spans hosts, or a service is exposed outside the `app` network |
| SDR-05 | A `custody:sign:treasury` holder can move treasury funds anywhere | Withdrawals must be payable to arbitrary addresses | Never resolvable; bounded by keeping the treasury float at zero |
| SDR-06 | TOTP is phishable | Refusing it leaves many users with no second factor | WebAuthn adoption exceeds a stated threshold |
| SDR-07 | Access tokens are bearer, not proof-of-possession | DPoP adds complexity across 25 services | Token theft appears in a real incident |
| SDR-08 | Legacy flat-random keys cannot offer a recovery phrase | They were generated without an HD seed and cannot be retrofitted | Never resolvable; surfaced honestly in the UI |
| SDR-09 | The break-glass procedure still exists | A custody system with no recovery path strands customers | Two-person control is ever bypassed |
| SDR-10 | Policy fail-closed creates availability risk on withdrawals | Correct trade for a custodial platform | Policy availability falls below its SLO |
| SDR-11 | Org security defaults are off on nine **public** repositories | Nothing but inattention | **Immediately** — P2 |
| SDR-12 | No KYC/AML | Not currently required at this scale | A jurisdiction, a threshold, or a fiat on-ramp says otherwise. Seams are designed in P13 |
