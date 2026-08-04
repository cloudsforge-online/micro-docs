# 28 — Deploying to the HP ProLiant

The practical runbook. [26](26-public-deployment.md) is the *design* — why the tunnel,
why two Compose projects, which surfaces are public. This is the order of commands,
what each one proves, and where it will stop.

Written 2026-08-04. Everything marked **verified** was run against the live estate on
that date. Everything marked **unverified** has never been executed on a ProLiant,
because there isn't one yet — that distinction is the most useful thing on this page.

---

## 0. Before you buy anything

**A 2-core Gen10 is below the floor. Get a Gen10 Plus.**

Measured, not guessed: the estate idles at **0.61 cores and 2.6 GiB** with 48 containers
up. Two environments side by side come to roughly **1.3 cores and 8 GiB** before any
load. The earlier "3.1 cores" figure was misleading — 2.14 of it was proof-of-work,
which this box will not be doing.

Budget **16 GiB** if you want both environments plus headroom for the chain's growth.

**x86 is the right architecture and you are already on it.** CI publishes `linux/amd64`
only, deliberately. If you ever move to Graviton or Ampere you must set
`platforms: linux/amd64,linux/arm64` on `org/.github/workflows/publish-image.yml`
*before* provisioning, or every image pull fails. On the ProLiant this simply does not
arise.

---

## 1. What you need before the first command

| | |
| --- | --- |
| OS | Any Linux with Docker Engine ≥ 24 and the Compose plugin |
| Domain | `cloudsforge.online` on Cloudflare, nameservers already delegated |
| Cloudflare | An account, and `cloudflared` installed on the server |
| Disk | The chain is append-only and never shrinks. Give `/var/lib/docker` its own volume |
| Access | Nothing inbound. No port forwarding, no static IP, no DMZ |

That last row is the point of the whole design: **the server makes outbound connections
only.** Your router stays closed.

---

## 2. Bring the estate up

```sh
git clone https://github.com/cloudsforge-online/micro-deploy deploy
cd deploy
# plus the sibling repos — see clone-all.sh

docker compose -f compose/docker-compose.estate.yml up -d
./scripts/estate-bootstrap.sh     # mints admin + service credentials into estate/tokens.env
./scripts/estate-up.sh            # brings everything up in the one order that works
./scripts/estate-verify.sh        # drives the seams no unit test can reach
```

**`estate-bootstrap.sh` is the one that must run first on a fresh box.** It performs the
admin UPDATE and mints the service tokens; nothing can authenticate to anything until it
has. It is safe to re-run — it looks up before it mints.

**`estate-verify.sh` is the gate, not the log.** If it fails, stop. It drives real HTTP
through the real gateway on the real certificate.

Verified: this sequence is what the live estate runs on today.

---

## 3. The gateway, and one trap

```sh
./scripts/gateway-reload.sh --validate   # render in a throwaway Traefik, touch nothing
./scripts/gateway-reload.sh              # validate, reload, then PROVE the reload took
./scripts/gateway-reload.sh --check      # prove only
```

**Never edit `gateway/dynamic/*` and assume it took effect.** On the development Mac the
file provider's `watch` does not fire at all — Colima mounts with `virtiofs`, which
forwards no inotify into the guest, and the gateway was found serving configuration 20
seconds after the file changed. `watch=true` is correct on Linux, so the ProLiant should
behave; `--check` is there precisely so you never have to take that on trust.

A `{{ if }}` inside a YAML *comment* took the entire dynamic directory down for three
minutes during development. `--validate` exists because of that. Use it.

---

## 4. Two environments on one box

Testnet and mainnet run as two Compose projects. The overlay is variables only:

```sh
# compose/testnet.env
CF_PROJECT=cf-testnet
CF_NET_PREFIX=cf-testnet
CF_PORT_BASE=5
CF_GATEWAY_PORT=10443
CF_GW_PORT_BASE=91
CF_TRAEFIK_ENV=traefik.testnet
```

Six variables give 45 ports with **zero overlap**. `docker compose config` renders
byte-identically to the committed file when the defaults are used, which is what proves
the parameterisation changed nothing.

Bring mainnet up with the defaults, testnet with `--env-file compose/testnet.env`.

---

## 5. The tunnel

Four generated configs — public and operator, per environment:

```
deploy/cloudflared/config.mainnet.public.yml
deploy/cloudflared/config.mainnet.operator.yml
deploy/cloudflared/config.testnet.public.yml
deploy/cloudflared/config.testnet.operator.yml
```

They are **generated** by `gen.py` from the surface registry, not hand-written, and five
CI checks guard the result — including that `cloudflared` refuses to start without a
catch-all rule, so the 404 rule stays last.

Decisions already made for you:

- **Utilities are not exposed at all.** Four of five have no authentication; Alertmanager's
  silence API alone would let an attacker mute every alarm.
- **Operator surfaces get a separate tunnel plus Cloudflare Access.**
- **`account` is unrouted** — it is phishing-shaped.
- `pay` and `vault` are public, because first-party token flows require it.

Unverified: no config here has ever been run through a real `cloudflared`, and no
testnet apex has ever been served.

---

## 6. Deploying from images, not from source

This is the part that only started working today. Until now nothing published a container
image anywhere, so the release path could not run at all.

```sh
cfctl release 2026.08.1              # write the manifest
cfctl release --verify 2026.08.1     # docker manifest inspect every entry
./scripts/release-deploy.sh 2026.08.1 --dry-run
./scripts/release-deploy.sh 2026.08.1
./scripts/release-deploy.sh --rollback
./scripts/release-deploy.sh --list
```

`release-deploy.sh` **changes nothing until every image in the manifest pulls.** That gate
is the reason publishing had to be fixed first: with no producer it rejected every service.

43 repos now publish to GHCR on every push to `main`, tagged `<version>`, `sha-<sha>` and
`main` — never `latest`, and a version tag is never moved once published. All confirmed
anonymously pullable.

**Prefer this over building on the server.** Building from source needs the full toolchain
and every sibling repo on the box, and it means the artefact you tested is not the artefact
you run.

---

## 7. Mining — the server does not mine

Decided by the owner on 2026-08-04: **the ProLiant runs the ecosystem and acts as a seed.
It does not mine.** Mining happens on the owner's Mac and PC, and block rewards follow
whoever mines.

Mining is **plain HTTPS**, not P2P — this was got wrong once and is worth stating plainly:

```
GET  https://rpc.<apex>/mining/template?pub=<65-byte uncompressed secp256k1 key>
POST https://rpc.<apex>/mining/submit
```

Both are routed through Traefik with rate limiting keyed on `Cf-Connecting-Ip`, and
`/mining/submit` enforces a proof-of-work verification budget. `/events`, `/mempool`,
`/info` and `/supply` are deliberately **not** published.

So your miners need **no open ports and no P2P socket**:

```sh
# on the Mac or PC
hearth-mine --node https://rpc.cloudsforge.online
# or run the desktop app in hearth/app-desktop
```

The key must be **65-byte uncompressed secp256k1**. A 64-byte signature is refused after
the work is done — that defect made every block the old browser miner ever found worthless.

Verified: a packaged desktop app mined live blocks and the balance landed on its own
keystore address.

---

## 8. P2P — the one thing the tunnel cannot carry as-is

Raw TCP gossip on **8646** cannot traverse an HTTP tunnel. Two ways out:

1. **WebSocket transport (preferred).** The node now speaks P2P over WebSocket on **8648**
   at `/p2p`, published as `p2p.<apex>`. This traverses the tunnel and keeps your
   residential IP private. Keepalive is 20 s ping / 70 s deadline — both parameters,
   because Cloudflare's idle timeout was assumed at ~100 s and **never measured against a
   real tunnel**. Check this once you have an account.
2. **Open 8646.** Simpler, and it exposes your home IP on the P2P layer. Only do this if
   you accept that.

A second seed on a cheap VPS remains the option if you want neither.

---

## 9. Go-live order

1. Hardware meets §0. **Gen10 Plus.**
2. `estate-bootstrap.sh`, `estate-up.sh`, `estate-verify.sh` all green.
3. `gateway-reload.sh --check` proves the gateway is serving current config.
4. Tunnel up; every public hostname answers on a real certificate. **No `curl -k`** — that
   flag once hid a gateway serving `CN=TRAEFIK DEFAULT CERT` that every browser refused
   while every check passed.
5. `beacon smoke` green (17/17) — the one tier that drives the real gateway and stubs
   nothing.
6. The release gate reaches a determinate verdict.
7. Only then point DNS at it.

---

## 10. What has never been tested

Stated plainly, because the rest of this page reads with more confidence than the
situation deserves:

- No ProLiant has been involved. Nothing here has run on the target hardware.
- No Cloudflare account, no tunnel, no `cloudflared` run against these configs.
- No load test anywhere. Every figure is idle-state.
- Disk growth unmeasured; the chain is append-only and the projection is arithmetic.
- No backup has ever been restored. **Chain data cannot be re-derived** — losing it is not
  like losing a cache. Decide the backup story before mainnet, not after.
- The testnet apex has never been served.
