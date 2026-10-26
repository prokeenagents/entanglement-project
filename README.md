# Entanglement

A partner-side consumer app for the **Keen Agents** platform. It owns the end-user
experience — registration, login (with OTP), password reset, and browsing the
agent spaces a consumer is entitled to — while Keen owns identity, tenancy, and
the agents themselves.

Entanglement is a *partner integration reference*: everything it does over the
wire is what a third-party partner's backend would do with an `api_key`, an
`application_token`, and a per-tenant certificate.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| UI | Chakra UI v3 (emotion) — **no Tailwind, no shadcn/ui** |
| Forms | react-hook-form + zod |
| Icons | react-icons (Lucide set) |
| Markdown | react-markdown + remark-gfm (agent answers; raw HTML off) |
| Theme | `src/theme/*` — brand config + semantic tokens, dark/light via next-themes |
| Crypto | `jose` (RS256 verify) + node `crypto` (AES-256-GCM) |

## Getting started

```bash
npm install
npm run dev-local   # TLS verification off — the Keen edge is https://localhost (self-signed)
npm run dev         # plain dev, if your Keen edge has a trusted cert
```

Both scripts open the Node inspector on `127.0.0.1:3210` (this machine only — the
inspector gives full control of the process and its secrets, so never bind it to the LAN).

**No Keen sandbox handy?** Run the UI against fixtures and a simulated agent:

```bash
ENTANGLEMENT_DEMO=1 npm run dev     # dev-only; ignored in production builds
```

To rebrand the app (logo, colors, button shapes, fonts, starter prompts) see
[`CUSTOMIZING.md`](./CUSTOMIZING.md).

The app must be reached on an **origin that is allow-listed on the Keen api_key**
(see `ORIGIN` in `src/service/services/keen/keen.ts`). Hitting it on a different
host/port fails Keen's `OriginGuard`.

## Running against a Keen sandbox

The site is **inert until Keen WAKEs it** — a WAKE is the only channel that
delivers the signing certificate, so before it the connector holds no cert, mints
no application token, and `isReady` stays `false` (`[BOOT] Application activated:
false`, `keen.connector.ts`). Full setup:

**1. Wire the api_key in the Keen admin.** For the partner api_key you'll use,
bind a **client**, a **certificate** and a **consumer contract**, allow-list this
app's public **origin**, and set the api_key's **webhook URL** to this site's
`https://<public-host>/api/keen-webhook/<KEEN_WEBHOOK_SECRET>` — the inbound channel
Keen POSTs to. Keen does not sign webhooks, so the secret in the URL is what keeps
strangers from posting forged certificates or logouts; generate it with
`openssl rand -hex 32` and put the same value in `.env.local`. The **certificate must
have a shared secret key** (Certificates → Generate): the site refuses a certificate
without one, because Keen would seal sessions with a public default key.

**2. Expose the site with an ngrok tunnel** so the webhook can reach it:

```bash
ngrok http 3000                       # → https://<id>.ngrok-free.app
```

Use that ngrok URL as **both** the webhook target (step 1) and `KEEN_ORIGIN` (the
page's origin — what the relay's `OriginGuard` allow-lists). Do **not** route the
chat WebSocket through ngrok: a free tunnel 503s a browser WS upgrade, so `KEEN_WS`
points straight at the relay's own domain (only inbound webhooks ride the tunnel).

**3. Fill `.env.local`** (`cp .env.example .env.local`, then edit):

```
KEEN_HOST=https://<sandbox-host>            # the Keen edge (dev: https://localhost)
KEEN_WS=wss://<sandbox-host>/ws-keen        # the relay — NEVER ngrok
KEEN_ORIGIN=https://<id>.ngrok-free.app     # the allow-listed page origin
KEEN_CLIENT_ID=…   KEEN_CLIENT_SECRET=…
KEEN_API_KEY_ID=…  KEEN_API_KEY_SECRET=…
```

`readKeenConfig()` runs at connector **construction** (the `globalThis.__keenConnector`
singleton in `keen.ts`), so any `.env.local` change needs a **full dev-server
restart** — Fast Refresh won't rebuild it.

**4. Run it:**

```bash
npm install
npm run dev-local     # TLS verification off for the self-signed https://localhost edge
```

**5. WAKE it from the Keen admin** (the api_key's detail page → **Wake**). Keen
POSTs to `/api/keen-webhook/<secret>`:

- `{ "synch-data": "r_cert", result: { cert, key } }` → `connector.acceptCertificate()`
  (only while a certificate redeem the connector started is outstanding)
  — the public cert plus the shared secret it signs with; **the only channel that
  carries `key`**.
- `{ "synch-data": ["r_api_keys", "r_consumer_policy", "r_json", …] }` → the
  connector re-fetches its **caches** (`keen.cache.ts`: space list, consumer
  contract, consumer policy, agent front-settings) so reads are served locally.

Once the cert **and** an application token are both held the connector flips
`active = true` (`[BOOT] Application activated: true`) and the chat + resource
routes work. Later admin edits keep the caches fresh through the same webhook:
`r_space`/`r_agent` re-pull the space list, `r_consumer_policy` the contract +
policy, `r_agent_front_settings`/`r_json` the front settings; the consumer-logout
kinds force a re-login. A WAKE re-runs the whole delivery, so it's also the way to
re-sync a site that started before its api_key was fully wired.

> **"Certificate signer not available"** on the Keen side means the sandbox couldn't
> load the cert's private key (a stale cert-store mount) — not a fault here; the
> site simply never receives a usable cert to activate with.

## Architecture

### The Keen connector — a server-only singleton

`getKeen()` (`src/service/services/keen/keen.ts`) returns one `KeenConnector` for
the whole Node process. It's created by Next's `instrumentation.ts` hook at server
startup and stashed on `globalThis.__keenConnector`, because Next bundles
instrumentation separately from route handlers and dev HMR re-evaluates modules —
a module-level `new` would hand each bundle its own instance.

`connect()` is fire-and-forget and retries every 2s forever; callers guard on
`connector.isReady`.

> **This never exists in the browser.** `getKeen()` and everything hanging off it
> (cache, tools, crypto) is server-only. Read it in a Server Component / Route
> Handler / Server Action and pass serializable data down — a `'use client'`
> component can never call it.

Sub-modules:

| File | Role |
| --- | --- |
| `keen.connector.ts` | connect/retry, certificate + secret key, `seal`/`open` |
| `keen.crypto.ts` | AES-256-GCM seal/open — a **byte-mirror** of the Keen services' `token-crypto.ts` |
| `keen.tools.ts` | Read/verify: token payload, consumer spaces, consumer data, OTP/registration/reset hashes |
| `keen.cache.ts` | In-memory cache (space list, google connect, consumer contract) |
| `keen.resources.ts` | Fetches that populate the cache |
| `keen.external.ts` | Registration / reset-password claim + redeem legs |
| `types/keen.d.ts` | The ambient `Keen.*` namespace |

### Sealed hashes (AES-256-GCM)

Every sensitive payload Keen mints is **sealed**, not base64-encoded: the access
token's inner claims, the OTP hash, the reset-password hash, and the registration
hash. `keen.crypto.ts` mirrors the platform exactly:

- key = HKDF-SHA256 over the certificate's per-tenant `secret_key`
- domain-separated by purpose: `keen/consumer-<purpose>/v1`
  (`token` / `otp` / `reset-password` / `registration`)
- wire layout: `base64url(iv[12] || tag[16] || ciphertext)`

`open()` **must** use the same purpose the platform sealed with, or it throws.
The registration hash carries the most PII of any flow (name, gender, dob, email
and the argon password hash) and rides an emailed URL — which is exactly why it
is sealed rather than readable.

The access token keeps `origin` + `clientId` in the clear: the server needs
`origin` to find the certificate *before* it can open anything. That's safe — the
whole token is RS256-signed, so the claims can't be tampered with, and repointing
`origin` at another tenant just selects a certificate that can neither verify the
signature nor open the seal.

### Session

Tokens live in **httpOnly cookies** (`access_token`, `refresh_token` — see
`src/utils/cookies.ts`). Browser JS never reads them; server routes read them and
forward the access token to Keen. Read them with `getAccessToken()` /
`getRefreshToken()` (async — Next 16's `cookies()` returns a Promise).

`keen.tools.getConsumerData()` is the one-shot server snapshot: both tokens, the
decoded token payload, the spaces the consumer is entitled to (the token's `space`
claim ∩ the cached space list), and every agent across those spaces.

### Request gating

`src/proxy.ts` runs on every request, resolves the session from the cookies, and
delegates to `proxy/api/*` or `proxy/page/*`, each split into guest vs auth rules.

Email-link landing pages carry a `/<hash>` segment, so they never match a config
URL exactly and are prefix-allowed in `proxy-page-guest.ts` — `/set-password/` and
`/confirmation/`. **If you add another emailed link, allow it there or every link
307s to `/login`.**

### Routes

| Group | Purpose |
| --- | --- |
| `(app)` | Authenticated — home, `user` (account page), `space/[id]`, `space/[id]/[agentID]`, `space/[id]/[agentID]/[chatID]` (live chat) |
| `(login)` | `login` (+ OTP), `reset-password`, `set-password/[hash]` |
| `(registration)` | `registration`, `confirmation/[hash]` |
| `(maintanance)` | Shown when the connector isn't ready |
| `global-not-found.tsx` | Real 404 for unmatched URLs |

`src/app/api/*` are Route Handlers — the only place the browser talks to the
server about auth (`login`, `otp`, `logout`, `registration`, `reset-password`,
`set-password`), the two-token `chat/*` proxies (`list`, `history`, `search`,
`title`, `delete`), the two-token `consumer/*` proxies (`profile` read + `update`
write — backing the `/user` account page), and `refresh`, plus the Keen
`keen-webhook` / `keen-callback` receivers.

The `/user` account page reads the profile server-side (`GET /api/consumer/profile`
→ Keen's new `GET /v1/consumer/profile`) to **prefill** the form, and saves via
`POST /api/consumer/update` as a partial update. Email + password aren't editable
there (email is the identity; password has its own reset flow).

### Consumer context

`(app)/layout.tsx` fetches `getConsumerData()` on the **server** and provides it
through `ConsumerProvider` (`src/contexts/consumer`). Client components read it
with `useConsumer()` — no round-trip, no re-fetch. It's provided **once** at the
`(app)` layout; nested layouts must not re-provide it.

### Auth identity & the account page

`(app)/layout.tsx` seeds two client contexts from the one server fetch:
`ConsumerProvider` (spaces / agents / chat) and `AuthProvider`
(`src/contexts/auth`), which holds the decoded token payload — the signed-in
identity — as mutable state. The token is the source of truth: the provider
re-seeds *during render* whenever the server re-renders the layout (a navigation or
`router.refresh()`), using React's "reset state on a prop change" pattern rather
than an effect, so a client-side patch lives only until the next server render.

`useAuth()` exposes `{ identity, updateIdentity, checkAndRefreshToken }`.
`updateIdentity` patches the identity optimistically — the header shows a saved name
the instant the `/user` page commits, without waiting for a round-trip — and the next
server render reconciles it against the authoritative token.

`checkAndRefreshToken()` resolves to a live access token, or `null` when the session
is genuinely over. It **cannot** be purely client-side: both tokens are httpOnly
cookies and `getTokenPayload` opens an AES seal server-side, so the browser can
neither read the refresh token nor decode `exp`. So it POSTs `/api/refresh`, which
reads the httpOnly refresh cookie, calls `keen.consumer.rotateToken()`, re-mints the
cookies, and returns the fresh token — including the relay's `statusCode: 100`
"still valid" fast path, where nothing is re-minted and the current token is handed
back. The relay decides whether a rotation is due, so this is cheap to call
unconditionally.

It also holds an **in-flight guard**: a rotation *spends* the refresh token (the relay
swaps it in its allow-list), so two concurrent calls would send an already-spent one
and take a false 401 — a spurious logout. Concurrent callers share one request.

`ChatShell` calls it on a **5-minute interval** while a chat is open and pushes the
result onto the live client with `setAccessToken()` — no reconnect, since the socket
is bound to the cid, not the token. It ticks whenever a client exists rather than
only while a turn is running: an idle thread is exactly the case that would otherwise
start its next send with `E3002`. A `null` is left alone — clearing the token would
turn a recoverable state into a broken one; the logout event owns the sign-out path.

The `/user` account page (`(app)/user`) composes two forms:

- **`ProfileForm`** edits first/last name, gender, and date of birth. The access
  token doesn't carry those, so the page reads them server-side
  (`GET /api/consumer/profile` → Keen's `GET /v1/consumer/profile`) to **prefill**,
  and saves via `POST /api/consumer/update` as a **partial** update — a field left
  blank is unchanged, not wiped. On success the connector re-mints the session
  cookie (so the next render's token carries the new name) while
  `updateIdentity({ username })` patches the header immediately. Email is the
  account identity — shown, never editable here.
- **`PasswordForm`** is a logged-in password change, and the CLAIM leg of a two-leg
  flow: `POST /api/consumer/reset-password` (the live session is the proof of
  identity — no current-password prompt) makes Keen email a confirm link to
  `/confirm-password/<hash>`. Success here means "check your email", not "password
  changed". That confirm page is a Server Component that opens the AES-256-GCM
  **sealed** hash (purpose `reset-password`) and redeems it two-token, so nothing
  sensitive ever touches the client.

### Server→client events (long polling)

Keen pushes org-side changes — a consumer deleted, its contract or its spaces
changed — to the app as **webhooks**, but those land on the *server*, not in the
user's browser. A long-poll channel bridges the gap so the right browser reacts.

- **`EventBus`** (`src/service/events/event-bus.ts`) — an in-memory, per-process
  singleton on `globalThis.__eventBus` (stashed like the Keen connector so it
  survives dev HMR). `publish(key, event)` wakes every parked poll for that key or
  queues the event when none is parked; `wait(key, timeoutMs)` parks until an event
  arrives or the timeout elapses. Keys are **a consumer id** for a targeted event, or
  the reserved **`GLOBAL_EVENT_KEY`** (`'global_info'`) for a broadcast — consumer ids
  are cuids, so the reserved key can never collide with one. `waitAny(keys[], ms)`
  parks on several keys with ONE waiter, detached from all of them on settle; racing
  two `wait()` calls instead would leave the loser parked, piling an orphan onto the
  broadcast key on every re-poll. It's single-node: behind multiple instances a
  webhook on instance A can't wake a poll parked on instance B — back it with shared
  pub/sub (Redis) to scale out. Fine for the single-node boilerplate.
- **`GET /api/events`** (`export const dynamic = 'force-dynamic'`) — the browser
  holds this open. The route reads the caller's own consumer id (the access token's
  verified `sub`) and parks ~25s on **both** that consumer's key and the broadcast
  key, then returns the events (or `[]` on timeout so the client re-polls at once).
  Targeted events still can't cross users — the key comes from the verified token,
  never the request — while the broadcast key carries only what is safe for everyone
  (a "spaces changed, re-read them" ping with no payload).
- **`EventsProvider` / `useEvents`** (`src/contexts/events`) — the RECEIVER, mounted
  **once** in `(app)/layout.tsx`. It runs a single poll loop for the whole signed-in
  session (`AbortController`, re-poll immediately on a normal return, ~3s backoff on
  transport error, stop on 401) and fans each event out to component `subscribe()`rs
  and then the global handler index. The loop pauses while the tab is hidden (the held
  poll is aborted) and a returning tab calls `router.refresh()` before polling again —
  see "Deploying to Cloud Run" for why.
- **Handler index** (`handlers/index.ts`) — dispatch by `event.type`, one file per
  handler. `App.Events.Event` is a **discriminated union** (`LogoutEvent`, targeted +
  carrying `consumerId`; `SpaceChangeEvent`, global + carrying `resource`;
  `AgentFrontSettingsChangeEvent`, global, payload-free), and the
  index is keyed by type to the matching member — so registering a handler under the
  wrong key is a compile error. The `logout` handler re-checks
  `event.consumerId === userId` (defense-in-depth — the bus already routed by id),
  then stops the loop, **awaits** the logout POST (so `/login` can't bounce back on a
  still-present cookie), and redirects. The `space-change` handler raises the notice
  dialog and is **not** terminal — it neither stops the loop nor navigates, so a user
  mid-conversation stays put. Add a reaction by extending `App.Events.Event`, dropping
  a handler file, and registering it here.

The webhook receiver (`src/app/api/keen-webhook/[secret]/route.ts`) publishes a `logout`
event scoped to `consumer.id` for the org instructions `r_consumer_logout` /
`r_consumer_contract_changed` / `r_consumer_spaces_update`, so only the targeted
consumer's browser signs out. (Note: Keen specifies `r_consumer_logout` but does not
currently emit it — the branch is here and simply never fires.)

### Agent Front Settings (org → partner config)

Each Keen agent carries a partner-facing config blob — **Front Agent Settings** —
edited org-side (ms-ui) as rows of `{fieldId, fieldType, required, valid, value}`.
It is the partner twin of the agent's runtime settings: the org's script engine
never sees THIS channel, and this site never sees the runtime one.

Delivery is **notify-then-fetch**. A save org-side fires the
`r_agent_front_settings` webhook (no payload); the receiver re-fetches the
settings for **every agent slug this site has actually used** (the connector
cache's keys) via the relay's tenancy-scoped
`GET /keen-api/resources/agent-front-settings?agentId=<slug>` — scoped by Keen to
agents inside THIS partner's contract spaces — and only THEN publishes the global
`agent-front-settings-change` event, so anything reading from here on sees the new
values, never the stale cache.

Reading a value — **always by field name**, server-side via the connector:

```ts
const keen = globalThis.__keenConnector;
const welcome = await keen.frontSettings.get('my-agent', 'welcome-message');
const [a, b] = await keen.frontSettings.getMany('my-agent', 'title', 'theme');
const ok = await keen.frontSettings.has('my-agent', 'theme');
```

`keen.frontSettings` (`src/service/services/keen/keen.front-settings.ts`) is
cache-first with a self-priming miss (fetch → cache; afterwards the webhook keeps
that agent fresh), skips rows stamped `valid: false` (saved before passing
validation — same rule Keen's own engine applies), treats `''` as "agent has no
settings", and never throws — a broken or unavailable blob reads as `undefined`.
There is deliberately **no `all()`**: naming every consumed field keeps each
dependency greppable before the org renames one. Browser components read through
`GET /api/agent-front-settings?agentId=<slug>` (session-gated, registered in
`AUTH_API_CONFIG`) and get the raw `jsonSettings` string. The cache is in-memory
on the connector (single-node, like the event bus): a process restart just costs
one re-fetch on the next read.

For `r_space` / `r_agent` — a space, or one of the agents in it, was mutated org-side
— the receiver **awaits `getSpaceList()` before publishing** a global `space-change`
event: announcing first would have every browser re-render off the still-stale
connector cache and miss the very change being announced.

**The notice dialog.** `space-change` surfaces through `NoticeProvider`
(`src/contexts/notice`), which owns the one blocking dialog and hands out `show()`.
It's a context because the caller isn't a component — an event handler is a plain
function with no render of its own — so `notice` rides the handler context next to
`router` / `stop` / `userId`, and the provider is mounted **above** `EventsProvider`.
The dialog is closable **only by the X or OK** (`closeOnInteractOutside` and
`closeOnEscape` both off — Chakra defaults them on), and a second `show()` replaces
the current notice rather than queueing.

**Why force-logout and not a soft refresh:** a consumer's entitlements — the spaces
it may see — live in the access token's `space` claim, and there's no way to update
that in place; only a fresh login re-mints the token. So when spaces or the contract
change org-side, forcing a re-login is the reliable way to pick up the new
entitlement.

### Chat

A consumer talks to an agent over a **WebSocket to the Keen relay**, driven by the
raw-source SDK in `src/service/services/chat` — a port of the reference ChatSDK,
not yet an npm package, so it's self-contained with zero project imports. `ChatAPI`
sends the initial prompt, receives the root flow bundle, and drives every node —
sequential, parallel, tool sub-flows — to a terminal state.

- **Transport** is `KEEN_WS` when set, threaded server→client as `consumer.wsUrl`
  and passed as `ChatAPIOptions.url`; otherwise `CHAT_SETTINGS.WS_URL`
  (`src/service/services/chat/settings.ts`, the SDK's default). It must point at the
  **relay's own reachable address** — `localhost` in the browser is the browser's
  machine, not the server — and match the scheme (`ws://` on plain http, `wss://`
  behind TLS). Behind nginx the public path is `/ws-keen`.
- **The WS host does NOT have to be the page's host.** The `Origin` header on a
  WebSocket upgrade is the **page's** origin, not the `wss://` host — so what the
  relay's `OriginGuard` allow-lists is wherever the page is served from (which should
  equal `KEEN_ORIGIN`). A working combination in practice: the page served through a
  tunnel while `KEEN_WS` points straight at the sandbox's own domain. A non-allow-listed
  origin is silently dropped and looks like a dead server (WS close 1006), never an
  auth error.
- **Don't put a browser WebSocket through a free ngrok tunnel.** It forwards HTTPS
  fine but 503s the upgrade — a browser WS can't send `ngrok-skip-browser-warning`.
  Point `KEEN_WS` at the relay's real domain and leave the tunnel for inbound
  webhooks.
- **The answer arrives on `onStream` `token` events**, not from `runFlow()`'s
  return value (that resolves to the flow-tree snapshot, for inspection). Progress
  events (`thinking` / `processing` / …) surface as their own rows so a long run
  reads as progress rather than a frozen screen.
- **Run with the agent SLUG** (`agent.agentId`), never the row id (a cuid) — the
  relay rejects the cuid with `E3101`.
- **One turn at a time** — a concurrent `runFlow` is rejected with "TaskQueue
  already running", so the prompt gates Send on `running`.
- **`ChatAPIOptions` also takes `cookies`** — forwarded to script nodes (read via
  `system/cookies`) on the initial run. A list of NAMES filters the browser's
  `document.cookie` (`[]` = none, omit = every JS-readable cookie; `HttpOnly` ones
  are never visible so never sent), or an explicit `{ name: value }` MAP is used
  as-is with no browser — how a headless / CLI caller (a building agent) supplies a
  cookie a real user's browser would otherwise carry.
- **…and `contextBatchSize`** — the max parallelContext clones drained per fan-out
  wave (defaults to `CHAT_SETTINGS.CONTEXT_BATCH_SIZE`; only a positive integer is
  honoured). The Keen server admits a bounded number at once, so above that the
  extra clones meet backpressure (retried) rather than more throughput.
- **An undeliverable frame fails fast** — a frame larger than
  `CHAT_SETTINGS.MAX_FRAME_BYTES` (the relay→engine NATS `max_payload`) can never
  cross the hop, so the SDK rejects it as non-retryable (`FatalSendError`) instead
  of a continuation retrying it forever.

The UI is `src/components/ui-chat`:

| Component | Role |
| --- | --- |
| `chat-shell` | Owns the `ChatAPI` lifecycle (effect + ref, never render); exposes `useChat()` → `{ chatID, status, running, messages, send, cancel }` |
| `chat-messages` | Persisted history (last 50, one HTTP fetch) + this session's live turns |
| `chat-prompt` | Textarea + Send / Cancel |

- **Tool calls** — the orchestrator writes `<SYSTEM CALL>…</SYSTEM CALL>` into its
  own token stream; `chat-messages/system-call.tsx` parses that fence into a
  labelled chip. It renders what the LLM *wrote*, not whether the engine *accepted*
  it — a view, not routing truth.
- **Cancel** wipes the engine's state for the run (dict / session / agentState /
  queue) via the relay cancel frame. A cancelled turn persists as
  `"… :: Canceled ::"` and reloads as a quiet **Canceled.** row — any real partial
  answer is kept above it.
- **Streaming cost is bounded** — the live `messages` array is a 50-item sliding
  window (FIFO), so a token in a long session costs no more than in a short one.

**Managing chats** — the agent page (`space/[id]/[agentID]`) lists the consumer's
chats: **Continue** resumes one, **Start new conversation** mints a fresh `chatID`,
**double-clicking** a row's title renames it (`chat.setTitle`, committed on
Enter/blur — a blank or unchanged value is a no-op so an untitled chat never saves
its id as a title), and **Delete** archives it (soft-delete via `chat/delete`,
owner-scoped upstream). Both edits are optimistic against a local copy of the
server-fetched list, which already excludes archived chats, so the next mount agrees
with no refresh.

### Styling

Chakra UI v3 over emotion. `src/components/ui/provider.tsx` wraps `ChakraProvider`
in `EmotionCacheProvider` — an SSR style registry (`cache.compat = true` +
`useServerInsertedHTML`) that flushes emotion's styles into `<head>`. Without it
emotion streams `<style>` nodes inline into the body during SSR while the client
injects via the stylesheet, and hydration fails. Don't remove it.

## Configuration

Keen credentials are read from the **environment** by `readKeenConfig()` in
`src/service/services/keen/keen.ts`: `KEEN_HOST`, `KEEN_ORIGIN`, `KEEN_CLIENT_ID`,
`KEEN_CLIENT_SECRET`, `KEEN_API_KEY_ID`, `KEEN_API_KEY_SECRET`, plus the optional
`KEEN_WS` (the chat WebSocket endpoint — falls back to `CHAT_SETTINGS.WS_URL` when
unset). They're unprefixed
(no `NEXT_PUBLIC_`), so they're **server-only** — Next never bundles them to the
browser, which is what a client secret needs.

Real values live in `.env.local` (gitignored — never committed); `.env.example`
is the committed template of key names. To start:

```bash
cp .env.example .env.local   # then fill in the secrets
```

`readKeenConfig()` throws at startup if any var is missing, rather than
authenticating with `undefined` and failing every request silently. In production
`instrumentation.ts` then exits the process (Next alone would only log it and keep
serving a broken site); in dev it keeps running so demo mode still works.

> Don't move these into `next.config` — its `env` key string-inlines values into
> the **client** bundle, which would ship the secrets to the browser.

## Deploying to Cloud Run

The full walkthrough (domain mapping, the Keen side, pitfalls) is in
[`DEPLOYING.md`](./DEPLOYING.md); this section records this site's own settings.

The site runs on Cloud Run as `entanglement-demo` (`SERVICE` in `cli/config.sh`), built from the `Dockerfile`
(standalone Next server, `node:24-slim`, non-root). Same scheme as the docs site, with
secrets added. All settings sit in `cli/config.sh`.

**The address.** With `DOMAIN` empty (the default) the site lives on Cloud Run's own
deterministic URL, `https://<service>-<project number>.<region>.run.app`, and
`deploy.sh` sets `KEEN_ORIGIN` to it. Set `DOMAIN` to serve under a custom name:
`deploy.sh` then maps it and publishes the DNS record (`PROJECT_DNS` / `DNS_ZONE`); the
parent domain must be verified in Search Console first (`DEPLOYING.md`). Once a domain
is set, hand out only that address: the relay drops a browser WebSocket from any
origin but `KEEN_ORIGIN`, and the service keeps answering on its run.app URLs too.

| Script | When |
| --- | --- |
| `cli/secrets.sh` | First time, and whenever a secret is rotated. Pushes the secret values from the local env file into Secret Manager (a new version only when the value changed). |
| `cli/deploy.sh` | First time, after a rotation, a `DOMAIN` change, or when an env value / runtime setting changes. APIs, Artifact Registry, the service account and its access to each secret, build + deploy with the full config, then (with a `DOMAIN`) domain + DNS. Idempotent. |
| `cli/redeploy.sh` | Every code update. Rebuilds the image and rolls a new revision; keeps everything `deploy.sh` set. Zero downtime. |

The service is public through `--no-invoker-iam-check` (like the docs site): the org
policy `iam.allowedPolicyMemberDomains` refuses an `allUsers` invoker binding, so
`--allow-unauthenticated` only warns and the site answers 403.

All three need `gcloud auth login` with rights in your `PROJECT_SVC` project (`cli/config.sh` — fill in your own ids first; the scripts refuse to run on the placeholders). The env file
defaults to `.env` in the repo root (`ENV_FILE=/path ./cli/deploy.sh` to use another);
it is read on your machine only.

**Secrets never enter the image.** `.dockerignore` and `.gcloudignore` exclude every
`.env*` file — this matters, because `next build` copies `.env` into
`.next/standalone`. The build itself needs no Keen config: the `(app)` layout is
`force-dynamic`, so nothing that reads the connector is prerendered. At runtime:

- `KEEN_CLIENT_SECRET`, `KEEN_API_KEY_SECRET`, `KEEN_WEBHOOK_SECRET` and
  `ELEVENLABS_API_KEY` come from **Secret Manager** (`<service>-*`, one region). The
  service runs as its own account `<service>-run`, which may read exactly these secrets (the role is
  granted on each secret, not on the project). Cloud Run reads them when an instance
  starts and hands them to `node server.js` as env vars. Each is pinned to a version
  number, never `latest`, so a rotation is always an explicit `secrets.sh` +
  `deploy.sh`.
- `ELEVENLABS_API_KEY` is optional: while it is empty in the env file, `secrets.sh`
  skips it and `deploy.sh` deploys without it — dictation then answers 503 "not
  configured", everything else works. Add the key, run `secrets.sh` + `deploy.sh`.
- `KEEN_HOST`, `KEEN_WS`, `KEEN_CLIENT_ID`, `KEEN_API_KEY_ID` (and optionally
  `ELEVENLABS_STT_MODEL`) are plain env vars — addresses and ids, useless without the
  secrets. `KEEN_ORIGIN` is NOT taken from the env file: `deploy.sh` sets it to the
  site's address (`site_url` in `cli/config.sh`); the local value is for local runs.

Rotating `KEEN_CLIENT_SECRET` also signs every user out of Google Connect: the
encrypted Google refresh-token cookie is keyed from it.

**At most one instance, scaled to zero when nobody is on the site**
(`--max-instances 1 --min-instances 0 --cpu-throttling --cpu-boost --concurrency 1000`).

- One instance, never two: the connector's token, certificate and caches live in
  process memory, and so does the webhook → long-poll event bus — a second instance
  would receive webhooks meant for the first.
- Request-based billing: Cloud Run bills (and gives CPU) only while a request is open.
  Every **visible** tab holds one `/api/events` long poll, so the instance runs exactly
  while someone has the site in front of them, and the connector's background work
  gets CPU then. A **hidden** tab aborts its poll and pauses until it is visible again
  (`contexts/events/events.tsx`) — otherwise one forgotten tab would keep the instance
  billed around the clock. The chat itself is unaffected: its WebSocket goes from the
  browser straight to the Keen relay (`KEEN_WS`), not through Cloud Run.
- What a paused tab can miss: nothing targeted while the instance lives (the bus
  queues a consumer's events until its next poll), but a broadcast goes to whichever
  tab polls first, and an instance that scaled to zero meanwhile starts with an empty
  queue. A returning tab therefore calls `router.refresh()` before it polls again — the
  server re-renders spaces, agents and settings from its webhook-fed cache.
- Cold start: the first visitor after an idle spell is held by the proxy for up to 10s
  (`waitForAppReady` in `utils/demo.ts`) while the connector boots — token, certificate,
  then the contract / policy / space-list reads (`isActivated`). Only if that fails do
  they see the maintenance page.
- High concurrency because every visible tab holds a long poll for up to 25s.

**The certificate during a rollout.** The new revision's connector redeems a
certificate code and Keen answers with an `r_cert` webhook — which can land on the old
revision while traffic is still switching. `tryActivate()` therefore redeems a fresh
code after ~16s without a certificate.

**Keen side** (the api_key's Webhook record): its webhook URL must be
`<site>/api/keen-webhook/<KEEN_WEBHOOK_SECRET>` and its origin must be `<site>`.
Without the webhook the
connector never receives its certificate and the site stays on the maintenance page.
**Google Connect:** the Google OAuth client (its id is an agent setting) must list
`<site>/api/google/callback` as an authorized redirect URI.
