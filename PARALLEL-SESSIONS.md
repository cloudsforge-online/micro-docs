# Running a second Claude session safely

You have spare Opus 5 capacity. My session limit has been the bottleneck all day, so a second
session is genuinely the highest-leverage thing you can add. This file is how to do it without two
sessions treading on each other.

Nothing here is theoretical: every conflict class listed below has actually bitten this programme
once already.

---

## The one rule

**One repository, one owner.** Two sessions never touch the same repo. Git will not save you —
both sessions commit to `main` and push, so the second push either rejects or silently overwrites
depending on timing.

---

## The map

### 🔴 Do not touch — I own these
| Repo | Why |
| --- | --- |
| `foresight` | agent building it now |
| `emberkin-assets` | agent generating art now |
| `org` | **the shared CI.** Every repo calls its reusable workflows. Two sessions editing it breaks all 32 at once. |
| `runtime`, `contracts`, `ui` | shared libraries — every service `link:`s them. A change ripples estate-wide. |
| `docs` | I keep the build-status ledger. Two writers = a ledger nobody trusts. |

If your session finds a bug in one of these, have it **report the bug rather than fix it**, and
tell me. That is the whole reason `org` accumulated twelve defects safely — one owner, tests, one
commit at a time.

### 🟢 Free — safe to take, fully isolated
Nothing exists for any of these yet, so a session starts clean:

| Repo | Notes | Good first pick? |
| --- | --- | --- |
| `faucet` | Testnet EMBER faucet. Ancestor: `stack/repos/hearth/tools/faucet`. Small. | ✅ **best starter** |
| `sdk` | Public developer SDK + CLI. Blocks P11. Library, no DB. | ✅ |
| `status-web` | Public status page, renders `beacon`'s redacted projection. | ✅ |
| `emberkin-web` | The game client. *Wait for the asset run to finish* — it consumes those images. | ⏳ later |
| `nda` | *Ninety Days After* game service. The largest remaining port. | heavy |
| `community`, `devplatform`, `admin-api`, `analytics` | New services | ok |
| `market-web`, `mint-web`, `trade-web`, `worlds-web`, `explorer-web`, `network-site`, `admin-web`, `devportal-web` | Frontends, mostly ports | ok |

### ⚠️ Shared resources — coordinate, don't collide
- **The Azure FLUX key** (`studio/.env.local`). Only one session generates images at a time; two
  will race the rate limit and spend twice. My asset agent has it now.
- **Docker Postgres ports.** My agents use 55440–55460. Tell yours to use **55470+**.
- **`gh` / the GitHub token.** Fine concurrently, except: don't have two sessions create the same
  repo or set the same secret at the same moment.

---

## Paste this at the top of the other session

> You are working on the CloudsForge microservices migration, in a second parallel session.
> Another session is running concurrently and owns other repositories.
>
> **Work ONLY in `/Users/savvaniss/dev/personal/cloudsforge-micro/<REPO>/`. Do not create,
> modify, commit or push anything in: `org`, `runtime`, `contracts`, `ui`, `docs`, `foresight`,
> `emberkin-assets`, or any repo other than your own.** If you find a bug in one of those, report
> it in your final message instead of fixing it.
>
> `/Users/savvaniss/dev/personal/stack/` is FROZEN — read for reference, never write.
>
> Read first, in this order:
> - `docs/ecosystem/18-build-status.md` — what actually exists (a ledger, not a plan)
> - `docs/ecosystem/03-repository-responsibilities.md` — what your repo owns
> - `docs/ecosystem/17-definition-of-done.md` — what done means
> - A finished sibling for house style: `beacon/` (369 tests) or `lantern/` (204)
> - `lantern/.github/workflows/ci.yml` and `lantern/Dockerfile` — **the proven CI template**
>
> Estate rules, all non-negotiable:
> - No `setInterval` — background work is a leased job claimed `FOR UPDATE SKIP LOCKED`.
> - No message broker — Postgres outbox → signed HTTP → inbox, deduped on `source_event_id`.
> - No service holds money; value movement is a `micro-ledger` entry. No `balance` column.
> - All money is `bigint`. A float near an amount is a defect.
> - Idempotency on mutating routes; the fingerprint **excludes** per-attempt fields like
>   `correlationId` (fingerprinting a trace id made honest retries 409 — see
>   `ledger/src/idempotency.test.ts`).
> - `/livez` static; `/readyz` real probes via `@cloudsforge/lifecycle`, hard vs soft split.
> - Strict TypeScript, ESM, Node ≥22, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
> - `node:test` only — no Jest, Mocha or Vitest.
> - Tests run against a **real Postgres**, using `beacon/src/testsupport.ts`'s mechanism exactly.
>   Your suite must read `<SERVICE>_TEST_DATABASE_URL` — CI exports that exact name and **fails the
>   build if the DB suite skipped**. Use Docker ports **55470+**.
> - `pnpm` never `npm`. `timeout` is unavailable (macOS).
> - **Never delete a CI run record.** **Never weaken a test or guard to get green** — if a guard
>   fires on correct code, fix its precision and verify both directions.
> - Verify every inherited claim against source and cite `path:line`. Several documents in this
>   estate have been found stale; one claim about a sibling service was simply false.
>
> Ship it: `git init -b main`, commit in house style (read `git -C ../beacon log -1 --format=%B`),
> then `gh repo create cloudsforge-online/micro-<REPO> --private --source=. --push`, then
> `gh secret set ESTATE_READ_TOKEN --repo cloudsforge-online/micro-<REPO> --body "$(gh auth token)"`
> — CI cannot check out the private sibling packages without it. Iterate until the run is green on
> the real runner and quote the run id.
>
> Commit early and often. Two agents have already been killed mid-build; the ones that had
> committed lost nothing, the one that had not nearly lost 134 generated images.

Replace `<REPO>` with one repo from the green list. **One repo per session.**

---

## When it finishes

Tell me which repo landed and its CI run id, and I will verify it independently and update the
ledger. I do not take a test count on trust — every repo so far has been re-run against a fresh
Postgres before being recorded as done, and that has already caught one agent's stale claim.
