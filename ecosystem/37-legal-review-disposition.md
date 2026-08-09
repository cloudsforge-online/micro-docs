# 37 — Legal review: what is unreviewed, what it exposes, and what a reader is currently told

**Nobody who has written a word of the published legal text is admitted to practise law anywhere,
and nothing in this document is legal advice.** This is a *disposition*, not a resolution: it
records the state of the estate's legal surface so that an admitted lawyer spends their hour on
the questions rather than on discovering the facts, and so that the next engineer who finds an
empty section finds a reason rather than a bug.

It is the written disposition asked for by
[micro-org#33](https://github.com/cloudsforge-online/micro-org/issues/33). **#33 stays open.** No
document in this repository can close it and no measurement in here is an answer to it. The same
holds for [#161](https://github.com/cloudsforge-online/micro-org/issues/161) and
[#165](https://github.com/cloudsforge-online/micro-org/issues/165).

Everything below was measured on **2026-08-10** against `micro-site`'s `src/content/legal.ts`,
`micro-identity`'s source, and the deployed pages. Per estate convention, files are named and line
numbers are not, because line numbers rot faster than the claims they support.

---

## 1. The position in one paragraph

The estate publishes three legal documents — terms, a privacy notice and a risk disclosure — and
**none of them has been reviewed by a lawyer.** Of 43 sections across the three, **16 are marked
`counsel` and carry deliberately empty bodies**, each with a drafting brief attached; the other 27
are `stated`, meaning they are descriptions of code that an engineer is competent to assert and can
be held to. Every page carries a notice, at the top, saying it is incomplete and must not be relied
on. That design is the estate's single best legal argument about its own condition and it is
enforced by tests. What it does **not** do is reduce the exposure, because the exposure does not
come from the sections that are missing — those are disclosed — but from three other places: a
`stated` section whose promise runs the opposite way to the code (§3.3), a `stated` section that
was true when written and is now false (§3.4), and the fact that **no user has ever agreed to any
of it** (§3.5).

---

## 2. What is unreviewed

### 2.1 The inventory, measured

| Page | Sections | `stated` | `counsel`, empty |
| --- | --- | --- | --- |
| `/terms` — Terms of service | 14 | 5 | **9** |
| `/privacy` — Privacy notice | 20 | 14 | **6** |
| `/risk` — Risk disclosure | 9 | 8 | **1** |
| **Total** | **43** | **27** | **16** |

The undrafted sections, by page. Each carries a brief in the source saying what belongs in it, so
the drafting is not reconstructed from scratch.

**`/terms`** — Who these terms are between · Eligibility, and where the service is offered ·
Regulatory status, and whether this service is authorised · Custody, and what it means that we hold
assets · Fees · **Acceptable use** · Risk · Liability, warranties and indemnities · Changes to these
terms.

**`/privacy`** — Who the data controller is · What personal data the platform holds, and why ·
Identity verification · Retention · Sharing, and transfers out of your territory · Your rights, and
how to exercise them.

**`/risk`** — The formal risk disclosure, in the form a regime requires.

### 2.2 Nothing claims sign-off, and the source says the opposite in writing

`site/src/content/legal.ts` carries a header block titled *"THIS NEEDS A LAWYER AND HAS NOT HAD
ONE"*:

> *Everything below is a description of code, written by an engineer, and it is accurate to source.
> It is NOT a data-protection notice: it establishes no lawful basis, grants no right, names no
> controller and makes no cross-border transfer assessment. … A custodial crypto service's privacy
> notice carries regulatory weight and this one has not been reviewed.*

There is no review record, no sign-off field, no counsel attribution and no version-of-terms
identifier anywhere in the estate. **That is the correct state to be in given the facts — the
failure mode to guard against is a future change that makes the pages *look* finished without a
lawyer having touched them.** See §5.

---

## 3. What a reader is currently told

### 3.1 The pages are reachable, and they announce their own incompleteness

The shared footer in `@cloudsforge/ui` links `/terms`, `/privacy` and `/risk` from every surface in
the estate. Each page renders a notice above its sections whenever any section is `counsel`. The
privacy notice's reads:

> *This document is incomplete. The sections marked below have not been drafted and nothing on this
> page should be relied on as a data-protection notice.*

and the terms' the same with *"as the terms of an agreement"*. Each `counsel` section renders with
its own visible outstanding marker rather than being hidden.

### 3.2 The written sections are engineering facts, and they are unusually candid

The `stated` sections do not read like marketing. `/risk` tells a reader that the operator can move
the assets it holds for them, that there are no backups, that there is no insurance and no
compensation scheme, that the platform is the counterparty to every conversion, and that
*"there are conditions under which you cannot take your assets out, and they do not depend on
anything you did."* `/privacy` states that activity history is kept indefinitely, that account
deletion does not yet reach every service, and that there is no identity verification and no age
check. This is the part of the surface that is working, and it should be defended.

### 3.3 One operative sentence runs the wrong way against the code

`/terms` → *Withdrawal and export*, status `stated`, live, no outstanding marker:

> *The safeguards around key export — what must be confirmed, and what is recorded when it happens
> — are ours to design. **The right itself is not ours to withhold.***

The estate has, live today: an automatic per-asset reconciliation freeze that halts every
withdrawal in an asset with no human involved and **no manual clear route in any service**; an
operator subject freeze in `policy`; a per-wallet freeze reachable by any admin *or any service
principal*; and a global withdrawal kill switch. The full inventory is in
[micro-org#165](https://github.com/cloudsforge-online/micro-org/issues/165).

**This is not a missing right — it is an affirmative representation pointing the opposite way to
the software, in the section a reader would look at first.** It is honest engineering written as an
aspiration on a page that functions as a contract. Two consequences for whoever drafts the
acceptable use policy: it must be amended **in the same change**, and until then a freeze should be
treated as unauthorised — prefer restoring service over holding the line, and record why any freeze
was necessary at the time.

### 3.4 Two sentences that were true when written and are not now

**(a) Cookies — corrected in a pull request, not yet in what is served.** The privacy notice carries
a `stated` section headed *"There are no cookies, on any CloudsForge site"*, and
[#165](https://github.com/cloudsforge-online/micro-org/issues/165) recorded the absence of a cookie
policy as correct on the strength of it. The shared design system sets `cf_consent_analytics` on the
registrable domain and injects a Google Analytics tag on acceptance. All three — the cookie name,
the tag URL and the sentence denying both — were measured inside a single deployed bundle served
from the public apex on 2026-08-09.

The one correction to the issue title is worth carrying forward: **Google Analytics loads only
after a reader presses Accept.** Consent Mode v2 is primed denied on boot and the tag is injected
from the Accept handler alone. So the mechanism is honest and the *sentence* was the defect. The fix
rewrites the notice rather than removing the analytics, and holds it there with a test that reads
the design system's own source. Tracked as
[#313](https://github.com/cloudsforge-online/micro-org/issues/313); the change is
`cloudsforge-online/micro-site#6`, open and unmerged, so **as of today the deployed page still
denies the cookie it sets.**

**(b) Mail — still uncorrected on the page.** `/privacy` says *"No mail provider is configured at
present"*, and the `Sharing, and transfers out of your territory` brief repeats it. A third-party
SMTP processor is in production use and has carried at least 344 messages, each addressed to a
subject's email address; the evidence is in #33's own thread, read from the running container rather
than from the repository. **This document does not fix that sentence** — see §8 — but a reader is
currently told there is one fewer recipient of their personal data than there is.

### 3.5 Nothing records that any user ever agreed to any of it

`POST /auth/register` in `micro-identity` takes an email, a password and a handle. The string
`terms` does not occur anywhere in `identity/src` — zero occurrences, measured 2026-08-10. There is
no acceptance checkbox, no acceptance timestamp, no terms version stored against an account and no
re-acceptance flow anywhere in the estate.

**This is the finding that most changes the character of the other three.** The published documents
are notices, not an agreement. Anything the estate wants to *rely on* — a freeze right, a liability
cap, a governing law — has no route to a user today even if counsel drafted it tomorrow.

---

## 4. What the exposure is

### 4.1 Authorisation — the one a document cannot fix

Two limbs are engaged on their face, and neither depends on there being an exchange venue, which
there is not:

- **Custody and administration of crypto-assets on behalf of clients.** For a managed wallet the
  platform generates and keeps the private key, decryption is server-side with no customer input,
  and the BIP-39 passphrase is deliberately empty. There is no customer-held secret anywhere in the
  managed path. The self-custody stack is genuinely outside this and the two must not be reasoned
  about together.
- **Exchange of crypto-assets for other crypto-assets, as principal.** The platform quotes a
  two-sided price with a spread it sets and is itself the counterparty; the user's side moves
  against a clearing account, not another user.

The argument that most narrowed this has weakened. It used to be that the only live asset was a
valueless private chain with no external holders; **Litecoin's receive path is now open**, which
points the custody limb at a public, market-priced asset. Nothing has been credited in it and no
treasury is pinned, so the platform can today take custody of an asset it has no configured route to
return. Transitional cover expired by 1 July 2026, so there is none now.

The recommendation in [#161](https://github.com/cloudsforge-online/micro-org/issues/161) is the
highest-value item on this whole surface and it is an engineering decision, not a drafting one:
**making the wallet non-custodial and removing the principal conversion plausibly removes both
limbs, and is very likely cheaper than authorisation.** Each additional public chain wired in is a
decision taken ahead of the answer. **Put that trade-off to counsel before commissioning any
drafting, because the answer determines whether the drafting is needed at all.**

### 4.2 Data protection

The controller is not named. No lawful basis is established for any category. The transfer position
now has at least three recipients — the CDN in the path of every request, an external SMTP relay
(§3.4b), and Google conditional on a reader's acceptance (§3.4a) — and no transfer assessment
exists for any of them.

`Your rights, and how to exercise them` is empty **for a reason that should not be papered over**:
erasure is honoured by `identity` and by almost nothing downstream, and there is no route for
access, rectification or portability anywhere in the estate. A section promising rights the software
cannot deliver would be worse than the silence it replaces. **The fix for that section is code, not
prose.**

### 4.3 Enforcement without a published rule

There is no acceptable use policy; the phrase occurs in exactly one place estate-wide, as the title
of an empty `counsel` section. Meanwhile the freeze machinery in §3.3 runs every day. The asymmetry
is the part worth internalising: **the estate can stop people getting their money out and mostly
cannot act against a specific bad actor** — account suspension exists as schema, refusal logic and
types with no writer at any interface. That absence is
[recorded as a deliberate decision](https://github.com/cloudsforge-online/micro-org/issues/316), not
a bug, and it should stay that way until the policy, the notification, the audit row and the appeal
route exist.

One drafting note that will not be obvious to a lawyer reaching for boilerplate: **a narrow,
criteria-bound, notice-and-appeal freeze clause is genuinely stronger here than a broad one.** A
broad discretionary term is the paradigm unfair term, is typically struck out against the consumer
while the rest of the contract survives, and leaves the position worse than silence because it
demonstrates the drafter turned their mind to it.

### 4.4 Missing is disclosed; false is represented

Worth stating as a principle, because it decides priority across all four issues. A `counsel`
section with an empty body and a visible marker is a **disclosure**: a reader is told the thing does
not exist. A `stated` sentence that is wrong is a **representation**. The first is a governance debt
that only counsel can retire. The second is a defect any engineer can fix today, and it should never
queue behind the first. That is why #313 was worked ahead of #33, #165 and #161, and why §3.4b is
flagged here rather than left in a thread.

---

## 5. The controls that are working, and must not be softened

Five, in order of how much damage their removal would do:

1. **`counsel` sections cannot acquire body text**, `stated` sections cannot be empty, and neither
   page may lose its incomplete-document notice while anything is outstanding — all enforced by
   `site/test/legal.test.ts`. The marker cannot be quietly dropped ahead of the drafting.
2. **No entity, address, governing law or jurisdiction may be invented.** They are absent because
   they are undetermined, and CI keeps them absent.
3. **The page-level incomplete notice is deliberately not subtle.** A reader is entitled to know the
   terms they are looking at are unfinished.
4. **Every digit in published copy is registered against a source** and recomputed from the estate,
   so a number on a legal page cannot drift silently.
5. **New, 2026-08-09:** the privacy notice's cookie and analytics claims are now checked against
   `@cloudsforge/ui`'s own source rather than against `micro-site`'s, which is where the behaviour
   actually lives (`micro-site#6`). The old check was green *and correct* and still missed §3.4a,
   because the scan stopped at the repository boundary and the cookie is set by a linked sibling
   package.

**The pressure these controls exist to resist is the wish for the pages to look finished.** Anyone
proposing to remove a marker, fill a `counsel` body without counsel, or relax a test to make a page
read better is proposing to trade the estate's best legal argument for tidiness.

---

## 6. What only an admitted lawyer can do

The question set is already written and should not be re-derived: eleven questions for counsel are
recorded on #33, spanning authorisation, place of establishment, the key-material disclosure
question, controller and lawful basis, rights, retention, transfers, the custody characterisation on
insolvency, AML/KYC, consumer terms, and stablecoins. #161 carries the authorisation analysis and
#165 the enforcement one.

**What this estate must not do:** draft any of the sixteen `counsel` sections in-house; publish
anything that implies a review happened; or soften a control in §5 to make a page read as complete.
Writing a plausible paragraph is worse than leaving the hole, because a reader has no way to tell
the difference and the paragraph will outlive everyone who knew.

---

## 7. How the issues relate

| Issue | What it actually is | Who can close it | Blocks |
| --- | --- | --- | --- |
| **#313** cookies vs the notice | **A code defect** — a live published inaccuracy. The only one of the five an engineer can finish | Engineering, on merge of `micro-site#6` | Nothing. It blocked nothing and should never have queued behind the others |
| **#161** may the platform custody at all | The prior question. Part legal, but its cheapest answer is a **design change** | Admitted counsel; or the owner, by choosing the non-custodial design | #33 Q1, and the value of every §4.1 limb. Each new public chain raises the cost of being wrong |
| **#33** the notice has never been seen by a lawyer | The **governance parent**. The other legal issues are instances of it | Owner + counsel only | The 16 `counsel` sections, all of them |
| **#165** no acceptable use policy | A **drafting** ticket, downstream of #161 and of #33's jurisdiction question | Counsel drafts; owner publishes | #316 |
| **#316** do not build the suspension write-path | A **decision already taken**, recorded so nobody helpfully closes it by adding a button | Owner, once #165's four preconditions exist | Nothing. It is the brake, not the load |

**#316 settles the engineering half of #165 and none of the drafting half.** #165 asks for a
published rule; #316 answers the different question of what to build in the meantime, and answers it
*don't* — because adding a suspend endpoint before there is a published rule converts a documented
gap into a live enforcement capability with none of the controls, which is strictly worse than
today's position. The two are complementary and neither duplicates the other. #316 also does not
touch the asset-freeze machinery, which is the half of §3.3 that is fully live.

**The order that wastes least of a lawyer's time:** #161's design question first, because a
non-custodial answer removes work from #33 and #165 both; then #33's Q2, where the operator is
established, because every other data-protection and consumer answer depends on it; then #165's
drafting, with `/terms` → *Withdrawal and export* amended in the same change; then #316 unblocks on
its own terms.

---

## 8. What this document does not know, and deliberately did not do

- **It states no legal conclusion.** Every characterisation in §4 is an engineer's reading of code
  against a regime, and an admitted lawyer's answer supersedes it entirely.
- **It did not amend the "No mail provider is configured" sentence** in `/privacy` (§3.4b). The
  evidence for the correction is a container inspection in a thread, and re-pinning a published
  claim against something this session did not measure itself is precisely how the cookies sentence
  came to be false. It needs its own change, with its own measurement.
- **It does not know where the operator is established**, and neither does any repository in the
  estate. That is not an oversight in this document; it is undetermined, and CI enforces that it
  stays unstated rather than guessed.
- **It does not record any user's acceptance**, because there is none to record (§3.5).
- **The banner promises more than the interface delivers.** The consent banner tells a reader
  *"you can change your mind at any time"*; `revokeConsent` is exported by `@cloudsforge/ui` and
  called by none of the surfaces that render the banner. Withdrawal today means clearing site data.
  That is a `micro-ui` change and is not in `micro-site#6`.
