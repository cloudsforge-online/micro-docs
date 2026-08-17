# 40 — Forge Journal: a publication the estate can be found through

**Status when written:** built and not deployed. `micro-journal-web` exists, its suite is green
(105 tests, no skips), five articles are written and every page renders to a file. Nothing is on
either network, no DNS record exists, and `journal.<apex>` resolves nowhere. Written 2026-08-17.

**Design authority** for Forge Journal. Where it disagrees with
[**32** roadmap-ui-and-content](32-roadmap-ui-and-content.md) about the estate's public copy, this
document wins on the publication and 32 wins everywhere else. Where it disagrees with
[**38** combined-view](38-combined-view.md) about hostnames and the network switch, **38 wins** —
this surface is inside that topology, not beside it.

Decision record: the owner's instruction to "plan and create the ecosystem advance public blog
functionality, search engine friendly and all needed functionality", with five non-technical
articles chosen by the writer, and the new surface added to the site map.

---

## 0. The thing itself, in one paragraph

A public archive of plain-language writing about crypto, the chain and this ecosystem, served from
`journal.<apex>` as static HTML: one real file per address, each with its own title, description,
share card and `Article` JSON-LD, plus an RSS feed and a sitemap generated from the same content.
It has no account, no gate, no comment box and no service behind it. It exists so that somebody who
has never heard of CloudsForge can arrive from a search result, read something genuinely useful, and
only then discover there is an estate here.

---

## 1. Why the estate needs one, stated as a gap rather than as a wish

Every public surface this estate serves is a **tool**. Forge Market, Foresight, the pool console,
the explorer, the account: each is reached by somebody who already knows CloudsForge exists. The
marketing site is the only exception, and it has eleven addresses, all of which say *what we sell*.

Nothing here answers a question a stranger is actually typing. "How do people lose crypto." "Is a
seed phrase the same as a password." "Why does the price moving make me feel like this." Those are
the queries that precede the ones a product page answers, by months, and the estate is absent from
all of them.

That is the gap. It is not a branding gap and it is not solved by more copy on the home page: a
person with that question does not go to a company's home page, they go to a search engine, and a
company home page is not what it returns.

**The second reason is narrower and is about trust.** Several things this estate does are hard to
explain and easy to mistrust — running its own chain, mining its own liquidity, holding customer
coins in custody. The honest version of each is a long paragraph, and there is nowhere on a product
page for a long paragraph. There is one in an article.

---

## 2. What it is not

Stating these first, because each was a real option and each would have made a different product.

**It is not a CMS.** No database, no admin panel, no draft state, no editor. Every article is a
typed TypeScript module under `src/content/articles/`. Publishing is a merge; the history of an
article is a diff; a broken article is a failed build rather than a bad page. The cost is that a
non-engineer cannot publish, and that cost is accepted — see §5.

**It is not a client-rendered blog.** This is the decision the whole surface turns on and §4 is the
argument.

**It is not a newsroom.** No press releases, no "we are excited to announce". A release note belongs
in the changelog and a status incident belongs on the status page. An article that is really an
announcement teaches a reader that the archive is marketing, which is the one thing that would make
it worthless for the job in §1.

**It is not neutral, and it says so on every page.** The disclosure lives in the shell rather than
on the articles that happen to mention CloudsForge, because a per-article notice is the one somebody
forgets on the fourth article.

**It gives no advice.** Nothing here tells anybody what to buy, promises what a coin will do, or
puts a number on a return. The line matters more than it looks: the moment a page does any of those,
a piece of plain-language explanation has become an unlicensed solicitation, published by a company
that operates a custody service. `test/content.test.ts` reads every sentence of every article for
nine patterns, and `.github/workflows/ci.yml` repeats the check so that deleting the test does not
silently delete the rule.

---

## 3. The corpus as it stands

Five articles, chosen to cover the funnel from "never touched it" to "have been here a year", and
written to be readable by somebody who owns nothing.

| Published | Article | Topics |
| --- | --- | --- |
| 2026-07-28 | Crypto, explained without the crypto words | Starting out |
| 2026-08-04 | Why we built our own chain, and what it is actually for | Hearth · The ecosystem |
| 2026-08-11 | A tour of CloudsForge, for people who have not been here before | The ecosystem · Starting out |
| 2026-08-14 | The healthy way to hold crypto | Living with it |
| 2026-08-16 | Nine ways people lose crypto, and how not to be one of them | Staying safe · Starting out |

Five topics, and every one of them has articles — `populatedTags()` derives the topic list from the
corpus, so an empty topic page cannot be published. The topics are `starting-out`, `staying-safe`,
`hearth`, `ecosystem`, `living-with-it`.

**"The healthy way to hold crypto" is the one that justifies the set.** It is about sleep,
attention and mood, it names no product, and it is the article most likely to be read by somebody
who would never click a CloudsForge advertisement. An archive of five explainers about our own
chain would be a documentation site with a serif font.

### 3.1 The claim register, which is the part that will age

Two of the five articles state numbers about this estate — a chain id, a block time, a confirmation
depth, how many Sparks are in an EMBER. A reader has no way to check any of them, and they are
printed by the people who run the chain.

`src/content/claims.ts` records each one with the upstream symbol it came from, and
`test/content.test.ts` makes the rule mechanical: **any sentence that names CloudsForge, Hearth,
EMBER, a Spark or a Forge product and also contains a digit must be a registered claim.** A citation
names a file and a constant, never a line number — micro-site records four red builds caused by line
numbers that had moved, every one of them a stale position rather than a wrong value.

The register is deliberately a **subset** of micro-site's, cited to the same upstream symbols, and a
test cross-checks the two. Two registers that drift are worse than one, because each looks
authoritative on its own page.

---

## 4. Prerendering, which is the whole architecture

Everything else in this document is a choice. This one is a requirement, and it is worth being
precise about why, because the obvious alternative — the SPA every other frontend in this estate
is — fails in a way that is invisible in a browser.

A client-rendered archive hands a link-preview fetcher (Slack, LinkedIn, X, iMessage, WhatsApp —
**none of which run scripts**) one identical document for every address: the site's title, the
site's description, the site's card. Every article shared anywhere looks like every other. It hands
a crawler a `<title>` that belongs to the site rather than the piece, and a body that is an empty
`<div id="root">`.

micro-site documents that exact limitation in its own `index.html` and lives with it, because a
marketing site has eleven addresses and every one of them is reached by somebody who already knows
the brand. An editorial surface cannot live with it, because *being reached by strangers is the
entire job*.

So `scripts/prerender.ts` runs after `vite build`: it walks every address the router has, renders
each through `StaticRouter`, splices the result into vite's shell, and writes a real file — plus
`feed.xml`, `sitemap.xml` and `robots.txt`. Fifteen pages and three machine-readable files today.

**The file set IS the route set.** `nginx.conf` therefore enumerates nothing:
`try_files $uri $uri/index.html $uri/ =404`, with `error_page 404 /404.html`. This is *stricter*
than an enumeration, which is the point: `/a/an-article-never-written` answers a real 404. With the
usual SPA fallback it would answer 200, be indexed as a duplicate of the archive, and make every
typo in every shared link a page that "works".

### 4.1 The absolute URLs, and why no hostname is baked in

A canonical link, an `og:url`, the RSS channel link and every JSON-LD `@id` must be absolute — a
relative `og:image` is dropped by most unfurlers, so it is not a style preference. And no host is
known when the file is written.

Every absolute URL is written to disk as the literal `__CF_ORIGIN__` and substituted per request by
`sub_filter` in nginx with `https://$host`. One image serves the archive on any hostname it is
published on, telling a crawler the truth about where the page was fetched from.

Four lines are load-bearing and each has a test:

* `sub_filter_once off` — ON is the default and replaces only the FIRST match, shipping the other
  eleven placeholders in an article raw.
* `sub_filter_types text/html text/xml application/xml application/rss+xml text/plain` — the default
  is `text/html` alone, so the feed and the sitemap would ship placeholders.
* **the absence of `gzip_static`** — a pre-compressed file passes through the filter untouched, so
  every crawler that accepts gzip, which is all of them, would receive the placeholder.
* **the scheme is the literal `https`, not `$scheme`.** This document said `$scheme://$host` when it
  was written and that was wrong; the image probe in CI caught it on 2026-08-17. TLS ends at
  Cloudflare, cloudflared speaks plain HTTP to the gateway and the gateway speaks plain HTTP to the
  container, so `$scheme` is `http` for every reader who ever arrives over https — and a canonical
  of `http://journal.<apex>/…` names a URL that 301s, which a search engine treats as a different
  address and discards. `X-Forwarded-Proto` is no remedy: `deploy/gateway/` sets no
  `forwardedHeaders.trustedIPs`, so Traefik overwrites the header with its own entrypoint's scheme.
  The HOST stays per-request, which is the half that was ever in question.

One more thing the same probe found, recorded here because it is a property of the route table
rather than of the file: **a directory with no `index.html` in it must not be matched at all.**
`dist/a/` is such a directory — the articles live one level below it and nothing is published at
`/a` — and a `$uri/` element in the `try_files` chain matched it, so `/a` answered 301 and `/a/`
answered 403. Neither says "there is nothing here", and a crawler follows both. The chain is
`try_files $uri $uri/index.html =404` and nothing is lost: a trailing-slash request is served by the
second element, and the first cannot match a directory, because nginx decides "this element is a
directory test" from the literal trailing slash at config-parse time and not from what the variable
expands to.

Baking a hostname in at build time fails in the direction that does not look like a failure: the
testnet archive would tell every crawler its articles really live on the mainnet host.

### 4.2 The second archive must not compete with the first — and it never gets the chance

Every article is byte-identical on both networks — there is no chain data in an essay — so two
archives would not be similar pages, they would be the same page at two addresses. Left alone a
search engine picks a canonical and suppresses the other, and which one it picks is not ours to
decide.

`nginx.conf` maps `$host` to an environment label and, on every non-mainnet hostname, serves
`Disallow: /` and 404s both `/sitemap.xml` and `/feed.xml`. A subscriber who found the feed on the
testnet copy would be subscribed to something that can be taken down without notice.

**CORRECTION, 2026-08-17.** The paragraph above described the container correctly and the ESTATE
wrongly, and the first draft of this document (and its §6 and §7) went on to ask for a served
testnet archive that cannot exist. There is no second archive. The estate retired every testnet
FRONTEND hostname in the combined-view work of doc 38: the gateway's `cf-retired-web-sub` router,
at priority 550, matches `^[a-z0-9-]+-testnet\.cloudsforge\.online$` — excluding only the
`servesUi: false` service hostnames — and answers **302 to the mainnet host**. It is matched before
any per-surface router, so a request for `journal-testnet.cloudsforge.online` is redirected at the
gateway and never reaches this container at all.

So the container's non-mainnet logic is defence in depth for a request the estate does not deliver.
It stays, for two reasons: it is the only thing that would still be right if the retirement router
were ever narrowed, and it is provable in CI — the image probe fetches `/robots.txt` with a
`journal-testnet.` Host header and asserts `Disallow: /` on a container it booted itself. What it is
not is an observation about the live estate, and reading it as one is what produced the wrong DNS
ask in §6.

*(A detail worth not copying: nginx does not process backslash escapes in a quoted string, so
`return 200 'Disallow: /\n'` emits a literal backslash and an n. The version of this on exchange-web
has that bug in it, harmlessly. Here the robots body is written across real lines and a CI rule
refuses the escape.)*

### 4.3 The rest of the search-engine surface

* **Per-page head.** Title, description, canonical, `og:*`, `twitter:*` and JSON-LD, built from the
  page's own subject. The article page builds its head from the article and the topic page from the
  topic; forty addresses sharing the archive's head is the most likely SEO failure here and it looks
  like nothing at all in a browser.
* **Per-article artwork.** Each article has its own `hero.png` and its own 1200×630 `card.png` under
  `public/articles/<slug>/`, generated with the HTML/CSS asset pipeline. The card is the picture in
  every link preview that article will ever get, at a URL quoted in markup that has already been
  posted — a 404 there is a grey box in Slack for years, so CI asserts every one reaches `dist`.
* **`Article` JSON-LD** per article, `BreadcrumbList` on the deep pages, `WebSite` on the archive.
* **RSS** at `/feed.xml`, served as `application/rss+xml` (some readers refuse `text/xml`).
* **A sitemap** with one entry per article and per populated topic, each carrying a `lastmod` from
  that article's own front matter — which is why it is generated by the build rather than composed
  in nginx like every other surface's: nginx cannot know the corpus.
* **`/search` is in `robots.txt`'s `Disallow` and out of the sitemap.** A search page generates a
  near-infinite set of thin near-duplicate addresses; indexing them dilutes the archive.
* **No clock in the build.** Every date comes from front matter and every timestamp is midnight UTC.
  Two builds of one commit are byte-identical, so a rebuilt image stays comparable to the one CI
  tested and a deploy does not look like new content to a feed reader — which is how a subscriber
  learns to stop opening the feed.

---

## 5. What this costs, said plainly

**A non-engineer cannot publish.** Writing an article means adding a typed module and opening a PR.
For a five-article archive published by the people who build the estate this is not a constraint; at
thirty articles and an outside writer it would be, and the answer then is a small editor that emits
the same module and opens the same PR — *not* a database. The moment the words leave git, the
history of an article stops being a diff and a page can change without a commit.

**There is no scheduling.** An article is published when the release carrying it is deployed. There
is no `publishedAt` in the future that quietly appears; a future date would simply render as a
future date.

**There are no comments.** Comments on an archive published by a custody operator are a moderation
obligation with no owner. The public square that answers this is Forge Agora, which is a service
with a report queue, and it is a different document.

**Nothing is personalised and nothing is measured per reader.** The bundle fetches nothing, reads no
API and holds no session logic outside one named file. Readership will be visible in gateway logs
and nowhere else, on purpose.

---

## 6. Where it sits in the estate

`journal` is a `surface` row in the design system's registry (`micro-ui`), not a product:

* **`inSwitcher: false`.** The switcher is where a person chooses a PRODUCT, and a seventh entry
  would demand a seventh PRODUCT accent clearing the dE 30 adjacency gate against the other six. The
  registry records twice that such a hue does not exist. Discoverability is solved where it is
  actually solved — the footer's Platform column, which every bundle mounts, and the marketing
  site's map.
* **`servesUi: true`, `viewsAnyNetwork: true`.** The second flag is not about the data; an article
  is identical on both networks. It is about what the Testnet button does. Without it a reader who
  presses Testnet mid-article is thrown out of the piece and onto Forge Network's testnet page —
  the exact defect the owner reported about other surfaces. With it the chrome switches in place and
  the reader stays where they were.
* **Bronze `#ae7b3d`**, scored as one of a pair rather than picked alone; the sweep and the four
  gates it had to clear are recorded in `tokens.css`.

Estate registration, all of which is required before this is reachable:

1. `deploy/` compose services on both networks, and a gateway router per hostname.
2. Deletion from `EXPECTED_UNROUTED`, and the witness row in `deploy/scripts/surface-routes.py`.
3. Regenerated `deploy/cloudflared/*.yml`.
4. **DNS, which only the owner can create.** One record matters: `journal.cloudsforge.online`, a
   proxied CNAME to `<tunnel-id>.cfargotunnel.com` on `cf-mainnet-public`. A second,
   `journal-testnet.cloudsforge.online` on `cf-testnet-public`, is optional and buys one thing —
   per §4.2 that hostname serves nothing, it 302s to mainnet at the gateway, so the record exists
   only so a guessed or pasted testnet link redirects instead of failing to resolve. The generated
   `cloudflared` config carries the ingress entry either way; without the record it is inert.
5. A tile, a description and a site-map entry on micro-site, with the mainnet and testnet links.

---

## 7. Definition of done

1. `journal.cloudsforge.online/a/nine-ways-people-lose-crypto` returns 200 **cold**, with the
   headline in the HTML source of the first response.
2. `journal-testnet.cloudsforge.online/a/nine-ways-people-lose-crypto` answers **302 to the mainnet
   address** — it is a retired frontend hostname like every other, per §4.2, and there is no second
   archive to check. The container's own `Disallow: /` on a non-mainnet Host header stays an
   invariant, proven by the image probe in CI rather than by a live fetch.
3. `/a/an-essay-nobody-wrote` returns **404** with the designed page under it, and so do `/a` and
   `/a/` — a directory that is not an address is not a redirect.
4. `/feed.xml` validates and contains no `__CF_ORIGIN__`; `/sitemap.xml` lists thirteen addresses
   and does not list `/search`. Every absolute URL in all three machine-readable files, and in every
   article's head, begins `https://` and names the host it was fetched from.
5. Pasting an article link into Slack shows that article's own card and that article's own title.
6. Forge Journal appears in the footer of every bundle, in micro-site's product map, and in the
   site map — with working mainnet and testnet links.
7. `cfctl release --verify` finds the `journal-web` image, and `deploy/scripts/surface-routes.py`
   reports no unrouted surface.

---

## 8. What this document does not know

* **Whether anybody reads it.** There is no measurement plan here beyond gateway logs, and the
  honest expectation for a five-article archive on a new hostname is months before a search engine
  sends anybody at all. An archive that is judged at four weeks will be judged as a failure.
* **Whether five articles is enough to be treated as a publication** rather than as a content
  marketing page. It probably is not; the number that is, is not known.
* **Who writes the sixth.** The corpus is currently written by one author row, and the register in
  §3.1 is the only machinery that would catch a second writer contradicting the first.
* **Whether internal cross-linking should be added by hand or derived.** No article body currently
  contains a single link, which is a real and unclaimed SEO lever — the machinery exists and
  validates any link that appears, and nothing yet uses it.
