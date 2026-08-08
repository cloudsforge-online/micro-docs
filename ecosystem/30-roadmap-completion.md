# 30 — Roadmap: completing what is unfinished

Written 2026-08-07.

**This is a plan, not a ledger.** [18-build-status](18-build-status.md) is the ledger: it records
what has been built, and it is corrected forwards rather than rewritten. This document records
what is *unfinished* and how to finish it. Nothing in it may be read as a statement that something
has been done.

**How it was produced, so the reader can price the confidence.** All 66 directories in the working
tree were studied, one agent per repository, and every finding was then re-checked adversarially —
against the source for a claim about code, and against the deployed hostnames with `curl -m 15`
for a claim about the live estate. Findings that did not survive the second pass were dropped or
narrowed, and the narrowings are recorded inline as **Correction** lines, because a corrected
finding is more useful than a deleted one. Where a claim rests on a measurement, the measurement's
date is given. Where something is not known, it says so.

This is one of three roadmap tracks written in the same session. The other two are
[32-roadmap-ui-and-content](32-roadmap-ui-and-content.md) (what is written, worded and wired on the
screens a stranger sees) and the ecosystem track (the capabilities one repository owes another).
This track is about unwired integrations, stubs, deployment gaps and capabilities that exist in
code and cannot be reached. Where an item depends on one of the other tracks, it says so rather
than restating it.

**"Done" means what [17-definition-of-done](17-definition-of-done.md) says it means.** Every item
below states its own definition of done; where the item is a service change, §2 of 17 also
applies, and where it is a deploy change, the standing rule is that a fix nothing asserts is a fix
that will be undone. Several items are therefore two-part: change the thing, then add the check
that stops it drifting back. That second half is not optional padding — the largest single class
of finding in this survey is a capability that was built, wired once, and then silently lost its
wiring because nothing measured it.

---

## 1. What must happen before anything else

Four facts govern the ordering of everything below, and they are worth stating plainly before the
phases begin.

**First: no account created on the live estate can sign in.** Registration is a dead end on both
networks. That is not a frontend problem and not an identity problem — both halves are correct.
Measured on the host 2026-08-07: on **mainnet** the verification mail genuinely sends (344 delivered
`account.verify_email` rows through Mailtrap) and the link inside it points at `http://localhost:4110`,
because `NOTIFY_PUBLIC_URL` is a literal in the compose file that no host-side value can override;
on **testnet** `SMTP_HOST` is empty, so nothing is sent at all. One compose line and one testnet
channel. Until it is closed, every user-facing journey in the estate is unreachable by anyone who is
not already an operator, so no other completion work can be demonstrated end to end. It is §2.

**Second: the event bus does not carry the money plane.** Four producers still sign a retired
signature scheme that their intended consumers reject by test, and the subscription table that
routes every topic is hand-typed in one shell script. Seeding subscriptions before fixing the
signatures would only convert silence into a permanent 401 retry loop, so the order within §3 is
load-bearing: signatures first, then subscriptions, then the assertion that a delivery landed.

**Third: nothing measures the estate.** Prometheus scrapes an empty target list, no service is
given an OTLP endpoint, no process emits the metrics twenty alert rules name, and the release gate
that was built to refuse a bad promotion has never been called by a pipeline. Every phase after
§4 is easier to verify once §4 is done, and several items in later phases are simply unverifiable
without it.

**Fourth, and stated so it is not mistaken for a gap: much of what looks unfinished was refused on
purpose.** [16-risks-and-open-decisions](16-risks-and-open-decisions.md) and 18-build-status
§§3.3a–3.3q record decisions the estate took deliberately and declined to reverse. Two findings in
this survey were narrowed for exactly that reason and are marked in place. Before adding anything
to this document, grep those two files; reporting a deliberate refusal as a gap is the main
failure mode available here.

### 1.1. Sequencing at a glance

| Phase | Name | Priority | Gate it opens |
| --- | --- | --- | --- |
| A (§2) | A stranger can create an account | P0 | Every user journey in the estate |
| B (§3) | The bus carries what it signs | P0 | Provisioning, notifications, audit, analytics |
| C (§4) | The estate can be measured | P0 | Every SLO, alert, error budget and the release gate |
| D (§5) | The data survives the building | P1 | Any claim that a restore is possible |
| E (§6) | Money can move once, end to end | P1 | Purchases, withdrawals, faucet, pricing |
| F (§7) | A paid world can be raised | P1 | The whole Worlds plane's paid journey |
| G (§8) | The empty rooms are seeded | P1 | Market, Foresight, Worlds having any content |
| H (§9) | Client-side dead ends | P1–P2 | Journeys that start and cannot be finished |
| I (§10) | Guards that keep it closed | P1–P3 | Every phase above staying fixed |
| J (§11) | Remaining P2 and P3 items | P2–P3 | — |

## 2. Phase A — a stranger can create an account

**P0. Nothing else in this document can be demonstrated end to end until this is closed.**

Registration works. The verification gate works. The notification template renders. The three
pieces do not meet, and each repository saw only its own half: identity reported that no channel
can deliver the verification link, and notify reported that every notification link points at
`http://localhost:4110`. They are the same defect.

### A1. Stop the monitor eating the mail quota; give testnet a channel

> ## ⚠ SECOND CORRECTION, 2026-08-07 — read this before the first one below
>
> The first correction fixed the SMTP half and got the *link* half wrong. Traced end-to-end
> through a real account (`savvaniss@yahoo.gr`, both networks) on the host:
>
> **`NOTIFY_PUBLIC_URL` does not build the verification link.** `IDENTITY_ACCOUNT_URL` does —
> `identity/src/emailVerification.ts:122` returns `${accountUrl}/account/verify#token=…`. And it
> is **correctly set on both networks**: `https://hub.cloudsforge.online` and
> `https://hub-testnet.cloudsforge.online`, read from the running identity containers. So the
> claim "every verification link points at localhost" was false, and the "one compose line on
> mainnet" fix was a fix to the wrong variable.
>
> `NOTIFY_PUBLIC_URL` is real but lesser: `notify/src/catalogue.ts:400` resolves *relative
> fallback* links against it, and `templates.ts` resolves app-route links against it. Those
> point at `localhost:4110`. That is a genuine defect in every non-verification notification —
> it is not what blocks registration. **Demoted from P0 to A3.**
>
> **What actually blocks registration is `beacon`.** Beacon's synthetic journeys register a
> throwaway account per run at `beacon+<hex>@beacon.test`, a domain that does not exist, and
> `notify` dutifully tries to mail it. Measured: **~95 registrations/hour, still running**, and
> **7,319 of mainnet's 7,398 user rows**. That exhausts the Mailtrap free tier's 250/day within
> minutes, after which every send — including a real visitor's — returns `SMTP 535`. Sends
> succeeded 89–165/day against ~2,280 attempts. `beacon/src/calls.ts:137` anticipates the row
> accumulation and even supplies the prune, but nothing suppresses the *mail*.
>
> **The relay itself is proven.** A test message on 2026-08-04 reached an external Yahoo inbox
> from `no-reply@mail.cloudsforge.online` with SPF, DKIM and DMARC all passing.
>
> **And nobody has ever verified an address.** 2,252 tokens issued on mainnet, 2,231 on testnet,
> **0 consumed** on either. Migration 13 (mainnet 2026-08-05 10:27) ends with `update users set
> email_verified_at = created_at where email_verified_at is null`, which grandfathered every
> pre-existing account — so `email_verified_at` equal to `created_at` means *back-filled*, not
> confirmed. Only 8 mainnet rows have `email_verified_at > created_at`. Tokens only start at
> 2026-08-06 20:33, ~34 hours after the migration, so registrations in that window issued none.

**Missing.** Isolation of beacon's synthetic mail from the real quota; an SMTP channel for
testnet, which alone has none; and one real end-to-end verification, which has never happened on
either network. **Mainnet's SMTP is configured, authenticated and externally deliverable; it needs
no credential work, and `IDENTITY_ACCOUNT_URL` needs no change.**

> **Correction, 2026-08-07, measured on the host after this document was first written.** The
> original text asserted that `SMTP_*` was unset on both networks. **That was wrong for mainnet.**
> `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` and `SMTP_FROM` are interpolations (`${SMTP_HOST:-}`,
> `:1221`–`:1226`) resolved from `compose/.env`, a committed symlink to `compose/estate/tokens.env`
> whose target is **gitignored, untracked and absent from history** (`:77`–`:86`). Grepping the
> working tree for them proves nothing about the running estate, and the survey should not have
> drawn a conclusion from their absence.
>
> Read from the running containers instead:
>
> | | mainnet `cloudsforge-estate-notify-1` | testnet `cf-testnet-notify-1` |
> | --- | --- | --- |
> | `SMTP_HOST` | `live.smtp.mailtrap.io` | *(empty)* |
> | `SMTP_USER` / `SMTP_PASS` | set | *(empty)* |
> | `SMTP_FROM` | `no-reply@mail.cloudsforge.online` | *(empty)* |
> | `NOTIFY_PUBLIC_URL` | `http://localhost:4110` | `http://localhost:4110` |
>
> **Mainnet email works.** `notify.deliveries` on mainnet holds 344 `sent` email rows, every one of
> them `account.verify_email`. So "no channel can deliver the verification link" was false there.
>
> What is true, and is the real defect, is the last row of that table: `NOTIFY_PUBLIC_URL` is a
> **literal** at `:1188` and `:1203`, not an interpolation, so no `--env-file`, no `tokens.env` and
> no host-side override can change it. Every link in the mail that does arrive points at
> `localhost:4110`. **On mainnet the mail sends and the link is unusable; on testnet the channel is
> off.** That is a P0 either way, but it is one compose line on mainnet, not a credential problem.
>
> **The delivery failures are not evidence of a defect.** The same table holds 4,343 `dead` and 545
> `undeliverable` rows, all `SMTP 535`. That is the Mailtrap **free tier's 250/day cap** rejecting a
> flood generated by an earlier agent session that mass-created accounts — roughly 1,900 attempts a
> day against 89–165 successful sends. It is self-inflicted load, now spent, not a broken relay.
> For the same reason the 7,355 mainnet and 5,299 testnet rows in `identity.users` are **not real
> users**: the estate has no organic volume yet.
>
> Three lessons that apply to every deploy-state and impact claim in documents 30–34, because this
> survey read the repository and not the host:
>
> 1. Where a value is an interpolation from an untracked secrets file, **absence from the tree is
>    not evidence of absence from the estate**. Check `docker exec <container> printenv`.
> 2. Distinguish **literals** in `docker-compose.estate.yml`, which the host cannot override, from
>    **interpolations**, which it decides. Only the first can be settled from the repository.
> 3. Read row counts and failure counts on these databases as **contaminated by agent runs**. Phrase
>    every defect by what it does to the first real visitor, not by how many accounts it affects.
>    Nothing here is an outage, because there is no traffic to interrupt; it is all cold start.

**Evidence.** Measured 2026-08-07 on testnet: `POST https://nimbus-testnet.cloudsforge.online/auth/register`
returns 202 `{"verificationRequired":true}` with no tokens; `POST /auth/login` with the correct
password returns 403 `{"code":"email_unverified"}`. `identity/src/users.ts` `signInRefusal` returns
`unverified` when `email_verified_at` is null and `identity/src/server.ts:1011` turns that into the
403. `notify/README.md:97` documents unset SMTP as "the email channel is simply unavailable" —
which is the testnet render's state, per the correction above.

**On `NOTIFY_PUBLIC_URL` — true as a fact, wrong as a diagnosis.** Everything in the paragraph
below is correct about the variable and incorrect about its consequence: it is *not* what builds
the verification link, so none of it explains why registration does not complete. Retained because
the defect it describes is real for every *other* notification link, and tracked as **A3**.

`deploy/compose/docker-compose.estate.yml:1188` and `:1203` set
`NOTIFY_PUBLIC_URL: http://localhost:4110` as a **literal, not an interpolation**, so no
`--env-file`, no `tokens.env` and no host-side override can change it. Every link notify builds
points at `localhost:4110` on both networks regardless of what SMTP does.
`notify/src/templates.ts:788` builds every link as
`new URL(path, baseUrl)` and the paths are hub-web app routes — `/wallet/activity`
(`templates.ts:262`), `/settings/security/devices` (`:86`), `/market/offers` (`:417`), `/billing`
(`:523`). `grep -rn NOTIFY_PUBLIC_URL deploy/` returns only those two compose lines.

**Steps.** Re-ordered by the second correction: the quota comes first, because until beacon stops
eating it no other step can be observed to work.

1. **Stop beacon's synthetic registrations reaching the email channel.** This is the whole of the
   mainnet fix and it costs no credentials. Specified in full in **§A1.1** below — it was designed
   against the real code and then deliberately left unimplemented, because the fix is a change to a
   live production service and that is a decision to take explicitly rather than in passing.
2. **Then re-measure the quota.** With ~2,280 synthetic sends/day removed, a 250/day free tier is
   ample for a cold-start estate. Only if it is not, move to a paid tier. Also add a send budget in
   `notify` that refuses and records rather than burning the allowance on retries —
   `deliveries.max_attempts` is 6, so one bad hour costs six times its own volume.
3. **Prune the accumulated rows**, which are monitor residue and not user mail. `beacon`'s own
   `src/calls.ts:137` supplies `delete from users where email like 'beacon+%';`. The failed
   `notify.deliveries` rows were deleted on 2026-08-07 — 4,938 on mainnet, 5,194 on testnet — and
   **they refill within minutes until step 1 lands**, which is the test of whether step 1 worked.
4. **Give testnet a channel.** Populate `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and
   `SMTP_FROM` in a way that survives `--env-file compose/testnet.env` **replacing** `.env` rather
   than adding to it — that replacement is the actual mechanism keeping testnet dark, so putting
   them in `tokens.env` will not reach it — or stand up the catch-all sink
   [22-browser-journeys](22-browser-journeys.md) §11.3 mentions and point testnet's `SMTP_HOST` at
   it. A sink is the better answer for testnet: it costs no quota and testnet mail has no business
   leaving the machine. Testnet's failures currently show as `undeliverable/no_transport`, which is
   the supported "this deployment does without email" mode, not a fault. Add the variables to
   `release-deploy.sh`'s guard list beside `CF_WEB_APEX` so a deploy without them fails loudly.
5. **Complete one verification, end to end, on each network** — the thing that has never once
   happened. `IDENTITY_ACCOUNT_URL` is already correct on both, so this is a test, not a change,
   and it is the only way to learn whether `/account/verify` on hub-web actually consumes the
   token: 4,483 have been issued and 0 consumed, and that number is equally consistent with "no
   real person has clicked" and "the page is broken". Do not assume the first.
6. Correct `notify/README.md`'s Configuration table, and replace identity's now-stale "blocked on
   notify" wording in its Known gaps.

**Effort.** S for step 1, which is the one that matters; M including the testnet channel.

**Unblocks.** Everything. Sign-in, the wallet, purchases, the Worlds journeys, every Beacon
journey that needs a user, and all of §6 through §9.

**Done when.** On both networks, `register → mail received → verify → login 200` completes for a
fresh address, and `deploy/scripts/estate-verify.sh` drives that whole sequence as a standing
check rather than an operator's memory. Per 17 §2, the check is the deliverable, not the config.

#### A1.1 — Suppress mail to reserved domains (**the first change to make, specified**)

**Status: designed, not implemented.** The design below was written against the real call sites and
verified to fit them. It is deliberately not applied: `notify` is a running production service on
two networks, and changing it is a decision to take on purpose.

**The rule, and why it is a standard rather than a deny-list.** Do not route email to an address
whose domain is reserved. RFC 2606 §2 and RFC 6761 §6 reserve `.test`, `.example`, `.invalid` and
`.localhost` so they can never resolve; RFC 2606 §3 reserves `example.com`, `.net` and `.org` for
documentation. A mail exchanger for any of them cannot exist. So this is not a policy *about
beacon* that the next monitor could sidestep by picking another name — it is the guarantee the DNS
root already makes, applied one layer earlier so the provider allowance is never spent proving it.
`deleted.invalid`, which identity's `deletion.ts` writes when it tombstones an address, and the 55
`example.test` rows both fall out of the same rule for free.

**Three edits, all in `notify`.**

| # | File | Change |
| --- | --- | --- |
| 1 | `src/reserved.ts` *(new)* | `isUndeliverableAddress(address): boolean` — case-fold the domain, strip a trailing dot, return true for the reserved TLDs and documentation domains above, and for an address with no `@` or an empty domain |
| 2 | `src/pipeline.ts`, `channelsAvailable` | Add `if (target.channel === 'email' && isUndeliverableAddress(target.address)) continue`. This is the load-bearing line: the route is never taken, so **no delivery row is written**, nothing is retried and nothing is dead-lettered |
| 3 | `src/email.ts`, `emailAdapter.send` | Backstop beside the existing `no_address` guard: return `failure('rejected', false, …)`. Permanent, not retryable — no number of attempts makes a reserved domain resolvable, and six of them is six units of an allowance real recipients share |

**One consequence that must be handled or the fix creates its own noise.** `reportUnaddressed`
(`pipeline.ts`) warns whenever email is configured and email is not among the available channels.
Edit 2 makes that condition true for every beacon notification — about 95 an hour — so it needs a
fourth line skipping the case where the user *has* an email target that is unroutable by standard.
Nothing failed there: there was never anybody at the other end, and counting it as `no_address`
would bury the real signal under synthetic volume at roughly ninety to one.

**What it deliberately does not do.** It suppresses the *channel*, not the notification.
`FLOOR_CHANNEL` is unconditional, so beacon's journeys still exercise ingest → notification →
in-app delivery and still assert on it. Blinding the monitor to fix its side effect would be a
worse trade than the one it replaces.

**Tests, which are the deliverable and not the config** (per 17 §8):

- `reserved.test.ts` — table test over `beacon+x@beacon.test`, `a@EXAMPLE.COM`, `a@sub.example.test`,
  `a@beacon.test.` (trailing dot), `a@deleted.invalid`, and the negatives `a@cloudsforge.online`,
  `a@yahoo.gr`, `a@testing.com` (must **not** match — `testing.com` is a real domain and a naive
  substring check would break it).
- `pipeline.test.ts` — a user whose only email target is `@beacon.test` gets `['in_app']` from
  `channelsAvailable`, no email delivery row is inserted, and `reportUnaddressed` does not warn.
- `email.test.ts` — the adapter returns `rejected` with `retryable: false` and **never calls the
  transport seam**, which is the assertion that proves no quota is spent.

**Rollout.** `pnpm test` in `notify`, push, then redeploy `notify` on both networks. Mainnet is the
one that matters; testnet has no transport to protect but the same rows to stop accumulating.

**Verify by measurement, not by reading.** Before the change, `deliveries` where `channel='email'`
grows continuously — 8 new `dead` rows appeared within ten minutes of the 2026-08-07 purge. After
it, that count must stay flat while `users` keeps climbing at ~95/hour. Then re-check
`sent` against the daily allowance: with ~2,280 synthetic sends/day removed, 250/day is ample for a
cold-start estate, and if it is not, *that* is the moment to buy a tier — not before.

**Related, already fixed, and worth knowing before touching this file.** `email.ts`'s `classify`
carries a comment (`#201`) recording that Mailtrap answers an exhausted daily allowance with
`535 5.7.8 … daily sending limit … retry in 19m21s` — a 5xx AUTH code for a *temporary* condition.
Classified on the digit it was permanent, which silently discarded 707 messages across both estates
on 2026-08-05, including verification links. It is now matched on the message text instead. So the
`dead/upstream_error` rows measured on 2026-08-07 are the *post-fix* behaviour: retried six times,
then buried. The retry classification is right; the volume being retried is what A1.1 removes.

### A2. Give an operator a way to complete a verification by hand

**Missing.** A route that exposes the pending-reset view and a sibling for pending email
verifications, so that when the channel is down there is a console for the fallback that
[07-dependency-map](07-dependency-map.md):318 already promises.

**Evidence.** `identity/src/passwordReset.ts:222` exports
`listPendingResets(sql: Db): Promise<PendingReset[]>`, documented at `:215-220` as "the operator's
view of who is waiting". `grep -rn listPendingResets` across the whole estate returns exactly one
hit: that definition. No route in `identity/src/server.ts` calls it, no test calls it, no other
repo calls it. There is no `listPendingVerifications` at all in
`identity/src/emailVerification.ts`. 07-dependency-map.md:318 nonetheless promises "an operator
hands the link over from the console".

**Steps.**

1. Add `GET /admin/pending-resets` behind `authenticateAdmin` — the same lane as
   `/admin/signing-keys` — returning `listPendingResets`.
2. Add `listPendingVerifications` over `email_verification_tokens` and
   `GET /admin/pending-verifications` returning `userId`, `email`, `handle`, `createdAt`,
   `expiresAt`, and never the token.
3. Add a resend-by-user-id admin route only if A1 stays open past this phase.
4. Document both rows in the README route table — or, if this is refused, delete the "operator
   hands the link over from the console" claim in 07 rather than leaving a promise with no console
   behind it.

**Effort.** S. **Unblocks.** Support for any locked-out user; a fallback for A1's channel.

**Done when.** An operator holding an admin token can enumerate who is stuck on both networks, and
the two routes appear in identity's README route table. Note that this is only half of an operator
answer: admin-web has no identity page, which is the ecosystem track's
`xc-four-internal-services-no-console` and is not restated here.

### A3. Make an organisation creatable

**Missing.** A create-organisation route. Two of the three permitted `kind` values, four of the
five membership roles and the at-least-one-owner invariant have no production path that can
exercise them.

**Evidence.** The schema allows three kinds —
`organisations_kind_chk check (kind in ('personal','team','project'))`
(`identity/src/migrations.ts:338`) — and memberships carry owner/admin/member/billing/read
(`:352`). The only INSERT into `organisations` in the repository is
`createPersonalOrganisation` (`identity/src/organisations.ts:111-126`), called inside registration.
`server.ts` registers `GET /organisations:1520`, `GET /organisations/:id/memberships:1525` and
`POST /organisations/:id/memberships:1535` — read, list and invite — and no `POST /organisations`.
`devportal-web/src/pages/organisations.tsx:73` tells the developer "An organisation is set up in
your CloudsForge account rather than on this page", and the account surface has no such action.

**Steps.**

1. Add `POST /organisations` behind `authenticateUser`: validate slug, name and
   `kind in ('team','project')`; insert the organisation and an accepted `owner` membership for
   the caller in one transaction, reusing the shape of `createPersonalOrganisation`; refuse a
   duplicate slug through `organisations_slug_uniq`.
2. Confirm the deletion orphan check (`organisationsOrphanedBy`, `organisations.ts:296`, which
   already excludes `kind='personal'`) covers the new rows.
3. Add the row to the README route table and point devportal-web's copy at the new action.

**Effort.** M. **Unblocks.** The developer platform's org model; team-scoped API keys.

**Done when.** A user can create a team organisation, is its owner, can invite a second member,
and the four unexercised roles have at least one test each.

## 3. Phase B — the bus carries what it signs

**P0. Do the three items in order. Seeding a subscription onto a producer that signs the retired
scheme converts a silent gap into a permanent retry loop, which is worse: it looks like traffic.**

### B1. Finish the signature migration in the six producers it missed

**Missing.** 18-build-status §3.3p repaired five producers by deleting their local signer and
delegating to `@cloudsforge/contracts-events`. Six repositories still carry the local
implementation: billing, custody, foresight, studio, nda and pricing.

**Evidence.** `billing/src/outbox.ts:109` declares
`const LEGACY_SIGNATURE_HEADER = 'x-cloudsforge-signature'` and sends it at `:308` together with
`x-event-id`. The same shape at `custody/src/outbox.ts:117,282`, `foresight/src/outbox.ts:148,313`,
`studio/src/outbox.ts:101,266`, `nda/src/outbox.ts:101,104,266` and `pricing/src/outbox.ts:101,266`.
The contract is `cf-signature: t=<seconds>,v1=<hmac over "seconds.body">` —
`contracts/packages/events/src/index.ts:1458` and `:1498`. Every consumer inbox verifies only that
form: `admin-api/src/server.ts:694-706` reads `SIGNATURE_HEADER` and returns 401 `bad_signature`
when it is absent, `analytics/src/ingest.ts:115` calls `verifyDelivery`, `activity/src/server.ts:23,422`
and `notify/src/server.ts:432-435` likewise. `emberkin/src/outbox.test.ts:88-91` asserts by name
that "the legacy `sha256=` form does NOT verify as a contract signature".

The cost is concrete and audit-shaped. `contracts/packages/events/src/audit.ts` marks
`billing.entitlement.granted`, `billing.entitlement.revoked`, `custody.export.requested` and
`custody.key.exported` as audited topics, and `deploy/scripts/estate-bootstrap.sh:981` runs
`subscribe_all admin-api http://admin-api:4000/v1/events $audited` — so those subscriptions exist
today and point at an inbox that will reject every delivery. The estate's tamper-evident audit of
record will never contain a custody key export or a billing entitlement change, and
`GET /v1/audit/verify` passes over the gap because a chain cannot detect a fact that was never
offered to it.

**Steps.**

1. Per repository, copy the shape `identity/src/outbox.ts:153-160` already landed: add
   `@cloudsforge/contracts-events` as `link:../contracts/packages/events` to `package.json` and
   the `/contracts` COPY to the Dockerfile (studio, foresight, custody and pricing have no such
   dependency at all; nda and billing already do), then delete the local `signEvent` /
   `verifyEventSignature` bodies and re-export `signDelivery`, `verifyDelivery`,
   `SIGNATURE_HEADER` and `EVENT_ID_HEADER` from the contract so the call sites need no change.
2. Send both headers for exactly one release where a legacy consumer still exists, then drop the
   legacy arm. `emberkin/src/outbox.ts:195-198` reports the scheme per delivery, so "no legacy
   deliveries observed" is a measurable condition rather than a guess.
3. Add each repo the two-way pin the repaired repos carry: `assert.equal(SIGNATURE_HEADER, 'cf-signature')`
   plus an assertion that a signature does not start with `sha256=` (cf. `ledger/src/topics.test.ts:341,348`).
4. Add the ratchet: a check in `org/tools` that greps every `*/src/outbox.ts` for the literal
   `x-cloudsforge-signature` on a producing path and fails estate CI on any hit. Without it this
   is the eleventh instance of a drift the estate has already repaired twice.
5. Replay the failed `outbox_deliveries` rows so the audit chain backfills rather than starting
   from the day of the fix.

**Order within the item.** custody and pricing first (money-adjacent topics with real consumers),
then billing, then studio, nda and foresight.

**Effort.** S per repository, L for the set including the replay and the ratchet.

**Unblocks.** B2 and B3 entirely; the audit mirror; analytics metrics 14 and 15; every consumer of
a money-plane topic.

**Done when.** No repository declares a local signature header on a producing path, the estate CI
grep is green and would fail on a reintroduction, and a signed delivery from each of the six
verifies against `admin-api`'s inbox in a test.

### B2. Seed the subscriptions from the classifier tables, not by hand

**Missing.** Rows in `event_subscriptions`. Not code: producers emit, consumers classify, and the
routing table between them is roughly thirty hand-typed lines in one shell script.

**Evidence.** `deploy/scripts/estate-bootstrap.sh:752` and `:756` are the only two
`subscribe … http://activity:4000/ingest` lines in the estate; `deploy/erasure/register.psv:78`
adds a third (`identity.user.deleted`). Against that, `activity/src/classify.ts` holds 61
classifier entries that exact-match `contracts/packages/events/src/index.ts` — the diff of key
sets is empty. notify is subscribed to three identity topics (`:818`, `:827`, `:852`) and carries
authored, tested rules for `billing.entitlement.granted|revoked`, `custody.export.requested`,
`custody.key.exported`, `market.listing.sold|offer.made|sale`, `mint.deploy.confirmed`,
`settlement.outbound.confirmed|failed`, `settlement.sweep.completed`,
`settlement.withdrawal.completed|stuck`, `trade.bot.paused` and eight wallet topics in
`notify/src/catalogue.ts`.

The script already knows how to do this properly. `subscribe_all <consumer> <url> <topics…>` at
`estate-bootstrap.sh:960` skips producers that are not deployed and names them, and it is already
used for admin-api (`:981`, topic list parsed from `contracts/packages/events/src/audit.ts` with a
floor of 26 so a broken parser fails loudly) and for analytics (`:1005`, parsed from
`analytics/src/catalogue.ts`). Two consumers get derived subscriptions and two get hand-typed
ones. That asymmetry is the whole defect.

**Steps.**

1. Add `subscribe_all activity http://activity:4000/ingest $registered` after `estate-bootstrap.sh:756`,
   deriving `$registered` from `contracts/packages/events` the way the admin-api branch parses the
   audit contract, with the same minimum-count floor. Delete the two hand-written lines it
   subsumes; `on conflict do nothing` keeps it idempotent against the rows
   `estate-verify.sh:390/576` already seed.
2. Do the same for notify, parsing the topic keys out of `notify/src/catalogue.ts` exactly as the
   analytics branch parses its catalogue.
3. Add the money-plane and worlds-plane edges that no classifier can derive because they are
   point-to-point rather than fan-out: `billing.entitlement.granted` and `.revoked` to
   `http://worlds:4000/v1/events`, `http://nda:4000/v1/events`, `http://tessera:4000/v1/events` and
   `http://emberkin:4000/v1/events`; `aetherholm.season.sealed` to worlds. The handlers exist —
   `worlds/src/provisioning.ts:60`, `emberkin/src/server.ts:19`, `tessera/src/inbound.ts:197`,
   `nda/src/server.ts:109-110` — and `grep -rn "worlds:4000/v1/events|entitlement.granted|season.sealed" deploy/`
   returns zero rows.
4. Add an estate-CI assertion that for every consumer with a classifier table,
   `|seeded subscriptions| == |classifier entries|` — the two-way ratchet
   `notify/src/topics.ts:30-40` already runs inside its own repo, lifted to the deploy boundary.

**Effort.** S for the script, M including the CI assertion.

**Unblocks.** The activity feed showing more than sign-ins ([09-release-roadmap](09-release-roadmap.md):213
makes "the activity feed shows events from at least six services" the P6 go/no-go); every
notification other than the three identity mails; the provisioning bridge in §7.

**Done when.** Each consumer's subscription count equals its classifier count on both networks,
CI fails if they diverge, and B3's assertions pass.

### B3. Assert that a delivery actually lands

**Missing.** Nothing asserts that a signed delivery reaches a consumer's store. The only analytics
checks in `estate-verify.sh` are `/livez` and `/readyz` (`:116-121`), and the assertion loop at
`:796-802` polls only activity's inbox. A subscription that exists and never delivers is, in that
file's own words, "the same outage with a tidier database".

**Evidence.** `deploy/scripts/estate-verify.sh:789-793` still reads that analytics' `/ingest`
"demands a scoped token the relay has no way to present … → 401". That is no longer true:
`analytics/src/server.ts:469-540` reads no bearer and verifies the MAC only, and
`estate-bootstrap.sh:983-1007` now subscribes it. The comment is stale in the direction that
suppresses a check.

**Steps.**

1. Replace the `estate-verify.sh:789-793` comment with the current fact.
2. Extend the existing poll loop to count
   `select count(*) from inbox where topic='identity.user.registered'` in the `analytics` database
   as it already does for activity, and additionally assert `select count(*) from events` is
   non-zero — which distinguishes "delivered" from "delivered and refused".
3. Add a second-producer assertion: a wallet or ledger fact reaching the activity feed, so
   "events from at least six services" becomes a measured check rather than a roadmap sentence.
4. Add a signed `billing.entitlement.granted` delivery that must produce a `provisions` row
   reaching `provisioned` in worlds within the sweep window. That is the end-to-end proof the
   worlds dossier records has never happened on this estate.

**Effort.** S. **Unblocks.** Confidence in B1 and B2 surviving the next deploy.

**Done when.** `estate-verify.sh` fails if any of the four assertions regress, on both networks.

## 4. Phase C — the estate can be measured

**P0. Nothing here adds a feature. Everything here decides whether any later claim about the
estate is checkable. Until C1 and C2 land, every dashboard, alert, SLO and error budget in the
estate is drawing from an empty source, and the release gate in
[09-release-roadmap](09-release-roadmap.md) is scoring a system it cannot see.**

### C1. Point the services at the collector

**Missing.** The variable that turns on OTLP export is not set for any application service.

**Evidence.** `deploy/compose/docker-compose.estate.yml` defines the shared `x-common-env` anchor
and the collector service, and `grep -n "OTEL_EXPORTER_OTLP_ENDPOINT" deploy/compose/docker-compose.estate.yml`
returns only the collector's own configuration, never a consumer. Every service's telemetry
library reads it: `libs/packages/telemetry/src/index.ts` treats an unset endpoint as "exporting
disabled" and returns a no-op, which is the correct behaviour for a library and the wrong state
for an estate. The result is that Tempo and Loki are running, provisioned and empty.

**Steps.**

1. Add `OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4317` and
   `OTEL_SERVICE_NAME: ${SERVICE_NAME}` to the `x-common-env` anchor in
   `deploy/compose/docker-compose.estate.yml`, and the equivalent anchor in the testnet compose
   file, so it is inherited rather than repeated per service.
2. Confirm the resource attributes the estate's Grafana dashboards join on
   (`service.name`, `deployment.environment`) are set from the same anchor; a trace that arrives
   with the wrong `service.name` is indistinguishable from no trace at all on those panels.
3. Assert it: extend `deploy/scripts/estate-verify.sh` to query Tempo for at least one trace whose
   `service.name` is `identity` within the last five minutes after the verify run's own requests,
   and fail if none is found.

**Effort.** S for the anchor, M with the assertion.

**Unblocks.** Every trace-linked panel; the `trace_id` correlation in 17 §2; C4; lantern's trace
deep links.

**Done when.** A request to a public hostname produces a trace visible in Tempo and a log line in
Loki carrying the same `trace_id`, and `estate-verify.sh` fails if that stops being true.

### C2. Give Prometheus something to scrape

**Missing.** The scrape target list is empty, and where targets are named elsewhere the port is
the wrong one.

**Evidence.** `deploy/telemetry/prometheus/targets/services.yaml` is literally `[]`. The estate
normalised every service to `PORT=4000` inside its network — visible throughout
`deploy/compose/docker-compose.estate.yml` and in every `subscribe` URL in
`estate-bootstrap.sh` — but the telemetry plane still addresses the pre-normalisation ports:
`deploy/telemetry/prometheus/prometheus.yml:98`, `deploy/telemetry/alertmanager/alertmanager.yml:118`,
`deploy/telemetry/otel-collector.env:24` and `deploy/Makefile:65` all name 4011 or 4010. So even
after the file-discovery list is populated, two of the three self-monitoring scrape jobs point at
closed ports.

**Steps.**

1. Generate `services.yaml` rather than writing it. The release manifest already enumerates every
   deployed service; add a target-file generator to `deploy/scripts/release-deploy.sh` that emits
   one entry per manifest service at `<service>:4000/metrics` with a `service` label, and have
   `estate-bootstrap.sh` run it. A hand-maintained target list is the same defect as B2.
2. Correct the four port literals to 4000.
3. Add the floor: fail the generator if it emits fewer targets than the manifest holds, mirroring
   the minimum-count discipline at `estate-bootstrap.sh:981`.
4. Add an `estate-verify.sh` assertion that `up == 1` for every generated target.

**Effort.** M.

**Unblocks.** All 20 alert rules; every Grafana dashboard in `deploy/telemetry/grafana`; C3; the
error-budget arithmetic; any statement about availability that is not an anecdote.

**Done when.** Prometheus reports a non-zero target count, `up` is 1 for each, and the alert rules
evaluate against series that exist.

### C3. Decide the SLOs and seed the error budgets

**Missing.** Alert rules exist; the objectives they are meant to protect do not. There is no seeded
SLO row anywhere in the estate, so "error budget" is currently a word in a document.

**Evidence.** [16-risks-and-open-decisions](16-risks-and-open-decisions.md) records the objectives
as an open decision rather than a settled one, and no bootstrap step inserts one.

**Steps.**

1. Set one objective per public surface — availability and p99 latency — and record them in
   `docs/ecosystem` next to the definition of done, not in a dashboard where they cannot be
   reviewed.
2. Seed them in `estate-bootstrap.sh` alongside the subscriptions, so a rebuilt estate has them.
3. Wire the burn-rate rules to the seeded objectives instead of to literals.

**Effort.** M. This is a decision before it is work; do not start it before C2, because an
objective chosen without data is a guess with a number attached.

**Unblocks.** The release gate; any honest answer to "is it up".

**Done when.** Each public surface has a stated objective, a rule that measures it, and a budget
that decreases when the objective is missed.

### C4. Make the Beacon gate run

**Missing.** The synthetic-journey gate is written and never invoked.

**Evidence.** `grep -rn "beacon" deploy/scripts/` returns no invocation from the deploy path, and
`deploy/scripts/release-deploy.sh` completes a release without consulting it. 17 §2 requires a
Beacon journey per service; the estate has journeys and no gate.

**Steps.**

1. Call the beacon runner from `release-deploy.sh` after `estate-verify.sh`, failing the release
   on a red journey, with an explicit `--no-gate` escape hatch recorded in the deploy log rather
   than an undocumented skip.
2. Add the four journeys the phases above make newly testable: register→verify→sign-in (§2),
   signed delivery→consumer store (§3), purchase→entitlement→provisioned world (§7).

**Effort.** M. **Unblocks.** The release gate having teeth; regression cover for phases A, B and F.

**Done when.** A deliberately broken sign-in fails a release, and the failure names the journey.

### C5. Publish the conformance results and give hearth-rpc a row

**Missing.** The conformance suite runs and its output goes nowhere a reader can reach; one target
cannot be resolved at all.

**Evidence.** The suite resolves targets from the service registry, and hearth-rpc has no registry
row, so the run aborts on that target rather than skipping it. The documented escape hatch is
`CONFORMANCE_URL_HEARTH_RPC`, which is a workaround, not a fix.

**Steps.**

1. Add the hearth-rpc registry row so the target resolves by the same path as every other, and keep
   `CONFORMANCE_URL_HEARTH_RPC` documented as an override rather than the mechanism.
2. Harden the runner to skip an unresolvable target with a named failure line instead of aborting
   the run, so one missing row cannot hide the other targets' results.
3. Publish the run output to a fixed path served by the docs surface and linked from
   [18-build-status](18-build-status.md), so conformance is a thing a stranger can check.

**Effort.** S. **Unblocks.** Any external claim about API conformance.

**Done when.** A full run covers every registry target including hearth-rpc, and its latest result
is reachable over HTTPS.

## 5. Phase D — the data survives the building

**P1, and the highest-consequence P1 in this document. It is placed after C only because a restore
that cannot be measured cannot be trusted, not because it is less urgent.**

### D1. Bring the backup runner up and prove a restore

**Missing.** The backup runner is defined and has never been started. 18-build-status §0 already
says it plainly: "One machine. No redundancy, no failover, and no backup that has ever been
restored."

**Evidence.** `deploy/compose/docker-compose.backup.yml:6` is the only reference to the backup
service anywhere in the deploy plane; no compose project includes that file, and
`deploy/scripts/release-deploy.sh` brings up `cloudsforge-estate` and `cf-testnet` only. There is
no off-host copy step in any script. The estate's own value of record — the ledger's double-entry
tables, custody's key material, the Hearth chain data — exists in exactly one place.

**Steps.**

1. Include `docker-compose.backup.yml` in the estate project and start it, so dumps begin
   accumulating on the host today. That alone changes the failure from total to partial.
2. Add the off-host copy. Until a copy leaves the machine, the backup protects against a bad
   migration and against nothing else.
3. Back up the Hearth chain data directory on both networks. A PoW chain with
   `net_peerCount` of `0x0` on mainnet has no second copy of its own history anywhere: if that
   volume is lost, chain 7411 ends, and every ledger row referencing an on-chain fact becomes
   unverifiable.
4. Restore one database into a scratch environment and record the date and the elapsed time in
   18-build-status. Until that line exists, the correct claim remains "no backup that has ever
   been restored".
5. Add the recurring proof: a monthly restore drill, and an `estate-verify.sh` assertion that the
   newest dump is younger than its schedule.

**Effort.** M for steps 1–3, M for the drill.

**Unblocks.** Every statement in the estate that presumes recoverability; D is a precondition for
treating any money-plane change in §6 as reversible.

**Done when.** A dated restore is recorded, a copy exists off the host, and staleness is alarmed.

## 6. Phase E — money can move once, end to end

**P1. Ordered so that the testnet path — where a mistake costs nothing — is made to work first,
and mainnet follows only where it is genuinely blocking.**

### E1. Reconcile the faucet's funding address

**Missing.** The address the seeder funds and the address the live faucet reports are different
addresses, and both hold zero.

**Evidence.** `deploy/compose/estate/tokens.env:33` names the funding address
`0xEa759184F8B36B304b6C68dbf3682567e81315c8`. The live testnet faucet reports its funding address
as `0x13611ABF07d309162D3c8FB8950BAE55C9C597Ef`. Queried against the testnet RPC, both return a
balance of `0x0`. So the mismatch is real and the faucet is unfunded either way — fixing the
mismatch alone dispenses nothing.

**Steps.**

1. Decide which address is the faucet's, and make the other reference follow it rather than
   patching both to a third value.
2. Fund it from a testnet coinbase; the mining coinbase on chain 7412 is the only source.
3. Add an `estate-verify.sh` assertion that the faucet's reported funding address matches
   `tokens.env` and that its balance exceeds one dispense.

**Effort.** S. **Unblocks.** Every testnet journey that needs a funded account: purchases,
withdrawals, world provisioning, wallet flows. This is the cheapest unblock in the document.

**Done when.** One address, funded, asserted, and a dispense succeeds against the live testnet.

### E2. Give the administered EMBER price a writer

**Missing.** The price is read from a table that nothing writes.

**Evidence.** The pricing service reads the administered rate and its aggregator requires
`PRICING_MIN_SOURCES` sources; the deployed value is 1, so a single source is authoritative, and
there is no route or job that inserts the administered row. `LEDGER_ASSET_TOLERANCE` is unset in
the estate compose environment, so the ledger's asset-drift guard runs on its default rather than
on a chosen figure.

**Steps.**

1. Add an admin-only write route for the administered rate, audited to admin-api like every other
   privileged write, and seed one row in `estate-bootstrap.sh`.
2. Set `PRICING_MIN_SOURCES` deliberately, with the chosen number recorded in
   [16-risks-and-open-decisions](16-risks-and-open-decisions.md); 1 is a decision, and should be
   written down as one or changed.
3. Set `LEDGER_ASSET_TOLERANCE` explicitly in the compose environment.

**Effort.** S. **Unblocks.** Any quoted price; E3's purchase path.

**Done when.** A price is written by a route, read by pricing, and the source count is a recorded
decision.

### E3. Connect the purchase route to a caller

**Missing.** `POST /purchases` has no caller. The route exists and no surface reaches it.

**Evidence.** A grep for the route across the `*-web` repositories and the SDK returns no call
site. Nothing in the estate can therefore complete a purchase through the supported path.

**Steps.**

1. Wire the purchase call into the SDK first, then the surface, so every future caller inherits
   the retry and idempotency behaviour rather than reimplementing it.
2. Pass an idempotency key scoped per account, not per request body.
3. Add the Beacon journey from C4: purchase → ledger entry → `billing.entitlement.granted` →
   provisioned.

**Effort.** M. Depends on E1 (a funded testnet account) and E2 (a price).

**Unblocks.** §7 entirely; the only revenue path the estate has.

**Done when.** A testnet purchase moves value in the ledger exactly once under a repeated call.

### E4. Give the custody token allowlist a writer

**Missing.** Custody enforces an allowlist of tokens it will hold; nothing adds entries to it.

**Evidence.** The allowlist is read on every custody path and has no insert route and no bootstrap
seed, so it is empty in the deployed estate and every token is refused by default.

**Steps.** Add an admin-only, audited write route; seed EMBER in `estate-bootstrap.sh`; assert a
non-empty allowlist in `estate-verify.sh`. Custody's audited topics only reach the audit mirror
after B1, so do B1 first or the writes will not be recorded.

**Effort.** S. **Unblocks.** Custody holding anything; withdrawals.

**Done when.** The allowlist is seeded on both networks and a refusal names the missing entry.

### E5. Give the policy engine a rule set

**Missing.** The policy engine evaluates an empty rule set, which means it permits by absence
rather than by decision.

**Steps.** Author the initial rules — limits per account, per asset and per window — seed them in
bootstrap, and add a test that an empty rule set is treated as deny rather than allow. An empty
allowlist that refuses (E4) and an empty rule set that permits are opposite defaults in adjacent
services; make them agree.

**Effort.** M. **Unblocks.** Any defensible limit on movement of value.

**Done when.** Rules are seeded, an over-limit movement is refused, and the refusal is audited.

### E6. Repair the settlement RPC credentials and the mint chain gate

**Missing.** Settlement drops the userinfo portion of its RPC URL, so a credentialed endpoint
authenticates as anonymous; mint's chain gate and `MINT_RPC_URLS` are configured such that the gate
cannot pass.

**Steps.** Preserve userinfo when normalising the RPC URL in settlement, or move the credential to
a header and delete the userinfo form entirely — the second is better, because a credential in a
URL reaches logs. Set `MINT_RPC_URLS` to the deployed Hearth endpoints per network and assert the
gate in `estate-verify.sh`.

**Note.** Mint's sweep loop retries without an endpoint indefinitely. That is a deliberate refusal
recorded at [18-build-status](18-build-status.md):859-863 and must not be "fixed" by adding a bail-out;
a named error type raised on the no-endpoint path is compatible with the refusal and is the change
to make if any is made.

**Effort.** S. **Unblocks.** Withdrawals; mint confirmations.

**Done when.** Settlement authenticates against a credentialed RPC and mint's gate passes on both
networks.

### E7. Set billing's admin-api URL and wallet's platform addresses

**Missing.** Billing has no `ADMIN_API_URL`, so its audit mirror has nowhere to go; wallet's
`platform_addresses` table is empty, so platform-owned addresses are indistinguishable from user
ones.

**Steps.** Add `ADMIN_API_URL` to billing's environment in both compose files; seed
`platform_addresses` in `estate-bootstrap.sh` from `tokens.env` so there is one source for the
addresses rather than two.

**Effort.** S. **Unblocks.** Billing's audit trail (with B1); correct labelling of platform flows.

**Done when.** A billing privileged write appears in admin-api, and wallet labels a platform
address as such.

### E8. Record the LTC decision rather than leaving it implicit

**Missing.** The LTC integration is a one-way door — value can enter and the exit path is not
built — and that asymmetry is not written down where a user could see it.

**Steps.** Either build the exit path or state the constraint on the surface that offers the
entrance and in [16-risks-and-open-decisions](16-risks-and-open-decisions.md). Do not leave it as
a fact only the code knows.

**Effort.** S to document, L to build. Documenting first is the correct order.

**Done when.** A user cannot enter that door without being told where it leads.

## 7. Phase F — a paid world can be raised

**P1. This phase is the estate's flagship journey and the one it has never completed once. It
depends on B2 for the entitlement subscription and on E3 for a purchase that can produce one.**

### F1. Populate the worlds title registry

**Missing.** The registry that maps a title to the service which provisions it holds one row, and
that row does not correspond to a deployed title.

**Evidence.** The registry is seeded in `estate-bootstrap.sh` with a single entry; the deployed
title services are emberkin, tessera, nda and aetherholm. `worlds/src/provisioning.ts:60` looks up
the row before it can provision, so an unregistered title fails at the first step with a lookup
miss rather than with a useful refusal.

**Steps.**

1. Seed one row per deployed title service in `estate-bootstrap.sh`, next to the subscription
   seeding so the two cannot diverge.
2. Correct or remove the existing row.
3. Make an unknown title return a named refusal rather than a lookup miss, so the next person sees
   the cause.
4. Assert in `estate-verify.sh` that every title service in the release manifest has a registry
   row.

**Effort.** S. **Unblocks.** Every provisioning path; F2 and F3 have no effect without it.

**Done when.** Each deployed title has a row, and a missing row fails the verify run.

### F2. Bridge entitlements into provisioning

**Missing.** `billing.entitlement.granted` has no subscription to any title service or to worlds,
so a granted entitlement never becomes a provisioned world.

**Evidence.** The handlers are written and waiting: `worlds/src/provisioning.ts:60`,
`emberkin/src/server.ts:19`, `tessera/src/inbound.ts:197`, `nda/src/server.ts:109-110`. The
subscription rows do not exist — this is the same defect as B2 §3 step 3, and the fix is one
place, not five.

**Steps.** Land B2 step 3. Then drive one entitlement through by hand on testnet and watch the
`provisions` row reach `provisioned`. Then add the Beacon journey.

**Effort.** S once B2 lands. **Unblocks.** The whole paid journey.

**Done when.** A granted entitlement produces a provisioned world within the sweep window, on
testnet, under a Beacon journey.

### F3. Reconcile the emberkin season-pass SKU

**Missing.** The SKU emberkin expects and the SKU billing sells are different strings, so even a
working bridge would grant an entitlement emberkin ignores.

**Steps.** Make one of the two authoritative — put the SKU in `@cloudsforge/contracts-money` and
have both read it — rather than correcting one literal to match the other, which is how they
diverged.

**Effort.** S. **Unblocks.** The first title with anything to sell.

**Done when.** Both sides read the SKU from the contract package and a test fails on divergence.

### F4. Publish studio's generated assets

**Missing.** Studio generates assets and does not publish them where the title services read from,
which is why tessera renders object sprites incorrectly.

**Evidence.** The tessera sprite defect's cause is upstream in studio, not in tessera. Fixing it
inside tessera would move the symptom without moving the cause.

**Steps.** Publish from studio to the shared asset path the title services already read, keep the
generated-asset manifest versioned, and add a consumer contract test in tessera against studio's
published manifest. This is cross-repo work; do not scope it as a tessera task.

**Effort.** M, cross-repo. **Unblocks.** Correct rendering in tessera and any later title that
consumes generated assets.

**Done when.** Tessera renders from a published studio manifest and a manifest change breaks the
consumer test rather than the screen.

### F5. Register nda's title and route it

**Missing.** nda has no title registry row (F1) and no gateway route, so it is not reachable from
outside even once provisioning works.

**Steps.** Add the route to `deploy/gateway/dynamic/public-api.yml` alongside its peers, add the
registry row in F1's seed, and add the hostname to the verify run's hostname sweep so a missing
route is caught.

**Effort.** S. **Unblocks.** nda being usable at all.

**Done when.** The hostname resolves, returns 200, and the title provisions.

### F6. Set tessera's community URL

**Missing.** `COMMUNITY_URL` is unset, so tessera renders a link to nowhere.

**Steps.** Set it in both compose files, or remove the link. An unset link that renders is worse
than an absent one.

**Effort.** S. **Done when.** The link resolves or does not exist.

### F7. Correct aetherholm's not-deployed claims

**Missing.** aetherholm's documentation states it is not deployed; it is deployed.

**Steps.** Correct the README and any route table that repeats it, in the estate's append-a-
correction style rather than by silent edit. A stale "not deployed" line is how a live surface
escapes the verify sweep.

**Effort.** S. **Done when.** The documentation matches the deployment, and the hostname is in the
verify sweep.

## 8. Phase G — the empty rooms are seeded

**P1. Three public surfaces render correctly and have nothing to render. Every item here is a
seed, not a feature.**

### G1. Turn the engagement treasury on

**Missing.** The engagement treasury is switched off in configuration, so the market surface's
engagement routes return empty and the incentives they express do not exist.

**Steps.** Set the treasury's enabling variable in both compose files, seed its opening balance
from `tokens.env` so there is one source of truth for the address, and assert a non-zero balance
in `estate-verify.sh`. Do this after E1, so the funding source exists on testnet.

**Effort.** S. **Unblocks.** Market's engagement surface having content.

**Done when.** The treasury reports a balance and an engagement route returns a non-empty body.

### G2. Seed market, Foresight and Worlds with first content

**Missing.** Market has no listings, Foresight has no markets, Worlds has no titles a visitor can
see. Each surface is live and empty, which reads to a stranger as broken rather than as new.

**Steps.**

1. Seed a small number of real rows in `estate-bootstrap.sh`, marked as seed data, on testnet
   first and mainnet only after the money plane in §6 works.
2. Give each empty state a written line saying what will appear there, so an empty surface states
   its own condition. This overlaps the UI track — see
   [32-roadmap-ui-and-content](32-roadmap-ui-and-content.md) — and the seeding half belongs here.
3. Assert non-empty on testnet in the verify run.

**Effort.** M. **Unblocks.** Any external visitor forming an accurate impression.

**Done when.** Each of the three surfaces returns content on testnet, and its empty state is
explanatory where it is still empty.

### G3. Clear the mainnet data residue

**Missing.** Mainnet carries rows left from pre-launch experimentation, including a worlds registry
entry that does not correspond to a deployed title.

**Steps.** Enumerate the residue before deleting any of it, record what was removed in
18-build-status, and remove it in one transaction per service. Do this after D1: no deletion on
mainnet before a backup exists.

**Effort.** S, gated on D1.

**Done when.** Mainnet holds no row that does not correspond to a deployed thing, and the removal
is recorded.

## 9. Phase H — client-side dead ends

**P1 to P2. Each item is a journey that a user can start and cannot finish. They are independent
of one another and of the phases above, so they can be done in any order and in parallel; they are
grouped only because they share a shape. Where an item is presentational rather than functional it
belongs to [32-roadmap-ui-and-content](32-roadmap-ui-and-content.md) and is not repeated here.**

| # | Surface | Dead end | Effort |
| --- | --- | --- | --- |
| H1 | hub-web | MFA enrolment starts and has no completion step, so a user who begins enrolling cannot finish or cancel | M |
| H2 | mint-web | The project-page editor blanks the page on a particular edit path, losing unsaved input | M |
| H3 | tessera-web | Build-and-place cannot complete: the place step has no reachable handler | M |
| H4 | wallet-extension | Points at the dead two-label testnet apex, so every testnet request fails to resolve | S |
| H5 | wallet-mobile | The Activity screen exists and is not reachable from any navigation path | S |
| H6 | emberkin, faucet | Static ten-minute tokens, so a session silently expires mid-journey with no refresh | S each |
| H7 | admin-web | The auth callback loops when the session is already present, so an operator cannot sign in twice | M |
| H8 | emberkin-web | `/readyz` returns 404, so the surface is unmonitorable by the estate's own convention | S |
| H9 | lantern-web | Request-id links are rendered without a target, so the correlation they promise does not work | S |
| H10 | sdk | A background deadline timer is not unref'd, so a Node process using the SDK does not exit | S |

**Priorities.** H4, H8 and H10 are P1: each breaks a contract the estate relies on elsewhere —
a resolvable hostname, a readiness probe, and a process that terminates. H1, H3 and H7 are P1
because they block a journey outright. H2, H5, H6 and H9 are P2.

**Steps, common to all ten.** Reproduce against the live hostname with `curl -m 15` or in the
browser first, so the fix is aimed at the deployed build and not at the source tree; fix; then add
the check that would have caught it. For H4 specifically the check is estate-wide: grep every
repository for the dead two-label `<surface>.testnet.` form and fail CI on any hit, because that
scheme is retired and any remaining reference is a latent H4.

**Unblocks.** Nothing downstream in this document depends on Phase H. That is the reason it sits
here and not higher: these are the most visible defects and the least blocking ones, and putting
them first is the most tempting mistake in this roadmap.

**Done when.** Each journey completes end to end on the deployed surface, and the two-label grep
is green in CI.

## 10. Phase I — the guards that keep it closed

**P1 to P3. Every item above can regress silently. These are the checks that turn a repair into a
property. Several are the second half of an item already listed; they are collected here so that
they are scheduled rather than assumed.**

### I1. Propagate the brand-chrome byte guard

**Missing.** The guard exists in exactly one surface.

**Evidence.** `tessera-web/test/brand-chrome.test.ts` already asserts the chrome bytes. No other
`*-web` repository carries it, so the property it protects holds in one place by test and
everywhere else by hope.

**Steps.** Move the test into the shared web template and propagate it to every `*-web`
repository, so a new surface inherits it. This is propagation, not authorship — the hard part is
already done.

**Effort.** S. **Priority.** P2.

### I2. Fix the `cfctl doctor` scope allowlist drift

**Missing.** The allowlist of scopes `cfctl doctor` checks has drifted from the scopes the estate
actually issues, so doctor reports healthy on a token that cannot do its job.

**Steps.** Derive the allowlist from `@cloudsforge/contracts-auth` rather than restating it, and
add a two-way assertion that the derived set equals the issued set.

**Effort.** S. **Priority.** P1 — a diagnostic that lies is worse than no diagnostic.

### I3. Stop the conformance runner aborting on a NUL byte

**Missing.** A NUL byte in a response body aborts the whole conformance run rather than failing
one case.

**Steps.** Treat a NUL byte as a case-level failure with a named reason. Pairs with C5.

**Effort.** S. **Priority.** P2.

### I4. Give the ui package a consumer check

**Missing.** The `ui` package's CI verifies the package builds and nothing verifies that a consumer
still compiles against it, and the footer audit it documents is manual.

**Steps.** Add one consumer build to `ui`'s CI — web-template is the right choice, because it is
the surface every other surface is generated from — and convert the footer audit into a test.

**Effort.** M. **Priority.** P2. **Unblocks.** Safe changes to the shared surface library, on
which the UI track depends.

### I5. Close the template drifts

**Missing.** Three drifts between the templates and the repositories generated from them:
`web-template`'s `useResource` dependency array does not track its inputs, so a changed input does
not refetch; `service-template` has no inbound event route, so every new service must hand-write
the one thing 17 §2 requires of all of them; and `service-template` still honours
`OUTBOX_ACCEPT_SECRETS`, a retired arm.

**Steps.** Fix `useResource`; add the inbound `/v1/events` route to `service-template` wired to
`verifyDelivery` and an inbox deduping on `(topic, event_id)`, so B1's defect cannot be
reintroduced by generation; delete the `OUTBOX_ACCEPT_SECRETS` arm.

**Effort.** M. **Priority.** P1 for the inbound route — it is the structural fix behind Phase B —
P2 for the other two.

### I6. Have worlds consume its own contract package

**Missing.** `@cloudsforge/contracts-worlds` is published and worlds does not consume it, so the
contract and the implementation are two independent statements of the same thing.

**Steps.** Depend on the package and derive the types from it; add the consumer contract test 17 §2
requires.

**Effort.** M. **Priority.** P2. Pairs with F1: a registry whose row shape is contract-checked
cannot drift the way F1's did.

### I7. Scope nda's idempotency keys and stop hub-api's cache pollution

**Missing.** nda's idempotency keys are not scoped per account, so two accounts can collide on a
key; hub-api's cursored cache is keyed without the cursor, so page two can serve page one.

**Steps.** Add the account to nda's key; add the cursor to hub-api's cache key; add a test for
each that fails on the old shape.

**Effort.** S each. **Priority.** P1 for nda — a cross-account collision is a correctness fault,
not a performance one — P2 for hub-api.

### I8. Fix the `$scheme` sitemaps

**Missing.** Sitemaps render a literal `$scheme` instead of `https`, so the URLs they publish are
malformed.

**Steps.** Substitute at render time; assert in a test that no emitted sitemap contains a `$`.

**Effort.** S. **Priority.** P3.

## 11. Phase J — remaining P2 and P3 items

**Nothing in this phase blocks anything else. It is listed so that it is not rediscovered as new.**

| # | Where | What is missing | Priority | Effort |
| --- | --- | --- | --- | --- |
| J1 | Hearth, mainnet | The mainnet risk gate as documented and as governed do not agree. This is a documentation and governance conflict, not live value at risk: resolve it by deciding which statement is the policy and correcting the other, in the estate's append-a-correction style | P2 | S |
| J2 | Several READMEs | Route tables that name retired routes or the dead two-label testnet form. Correct them at the same time as H4's grep, so one pass closes both | P2 | S |
| J3 | Several services | Retired static-token arms still present behind configuration that is no longer set. Delete the arms rather than leaving them unreachable; an unreachable branch is a future reachable branch | P2 | S |
| J4 | Estate | `18-build-status.md` still reads "Last verified: 2026-08-01" in its header while its body carries entries dated 2026-08-05. Re-verify and date it, or state the date of the last full sweep separately from the date of the last correction | P3 | S |
| J5 | Estate | Several repositories have no runbook, which 17 §2 requires. Generate a stub per service from the template and fill the on-call sections for the money plane first | P3 | M |

## 12. Considered and excluded

**These were surveyed, examined and deliberately left out. They are recorded with the reason so
that a future session does not spend its budget rediscovering them. Excluded is not the same as
unimportant: most of these are symptoms whose cause is already an item above, and fixing the
symptom would hide the cause.**

| Finding | Why it is not an item |
| --- | --- |
| hub-api's notifications tile renders nothing | Downstream of B2. The tile is correct; there are no notification rows because notify is subscribed to three topics. Fixing the tile would make an empty result look intentional |
| notify has no HTTP consumer for its own API | Same cause as above, and the surface work belongs to [32-roadmap-ui-and-content](32-roadmap-ui-and-content.md) |
| settlement's fee route has no live caller | Downstream of E3. The purchase path is the caller; it does not exist yet. Wiring a second caller first would make E3 harder |
| wallet's HTTP fee quoter is unwired | Same as above, same cause, same order |
| explorer-web and market-web emit `http` sitemaps | The same `$scheme` defect as I8; counted once, not three times |
| market-web's primary call to action goes nowhere | Presentational and content-shaped; it belongs to the UI track and is listed there |
| worlds-web shows mainnet registry residue | The residue is the item (G3), not the surface that faithfully renders it |
| service-template signature drift appears in four more repos | The template is the cause (I5); the four are the same defect counted again |
| wallet-desktop produces no artefact from CI | There is no consumer for a desktop artefact today, and building one would create a release surface nobody has asked to maintain. Reconsider when there is a user waiting for it |
| lantern's OTLP endpoint has no producer | True, and the cause is C1: no service exports at all. It is not a lantern defect |
| web-template's placeholder identity impersonates nothing | Examined and narrowed: the placeholder resolves to no real principal in any deployed configuration, so there is nothing to exploit today. Worth deleting when I5 touches the template, not worth a scheduled item |

**A note on the shape of this section.** The estate deliberately records gaps it has refused to
close — [18-build-status](18-build-status.md) §§3.3a–3.3q and
[16-risks-and-open-decisions](16-risks-and-open-decisions.md). Reporting one of those refusals as
an unfinished item is the most common way a survey of this estate goes wrong, and it happened
during the production of this document: mint's endpoint-free retry loop was collected as a defect
before the refusal at [18-build-status](18-build-status.md):859-863 was found. It is recorded in E6
as a refusal to be respected rather than as work to be scheduled. Anyone extending this roadmap
should grep those two documents before adding an item.

## 13. What this document does not know

Three things are stated as unknown rather than guessed.

First, the effort figures are S, M and L, not days. They order work; they do not estimate it.
Nothing in this estate has been measured against a delivery estimate, so a figure in days would be
a number with no evidence behind it.

Second, several items above are known to be missing and not known to be sufficient. E5's rule set,
C3's objectives and G2's seed content are decisions before they are tasks, and the correct first
step for each is to write the decision down where it can be argued with.

Third, this document has been checked against the working tree and against the live hostnames as
of 2026-08-07. It has not been checked against the running containers' environments beyond what
the compose files and the live responses reveal, so an item that reads as unset in
`docker-compose.estate.yml` could in principle be set by a host-level override. Where that matters
— C1, E7, F6 — the first step of the item is to confirm the deployed value before changing it.

