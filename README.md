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
| Icons | react-icons |
| Crypto | `jose` (RS256 verify) + node `crypto` (AES-256-GCM) |

## Getting started

```bash
npm install
npm run dev-local   # TLS verification off — the Keen edge is https://localhost (self-signed)
npm run dev         # plain dev, if your Keen edge has a trusted cert
```

Both scripts open the Node inspector on `0.0.0.0:3210`.

The app must be reached on an **origin that is allow-listed on the Keen api_key**
(see `ORIGIN` in `src/service/services/keen/keen.ts`). Hitting it on a different
host/port fails Keen's `OriginGuard`.

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
| `(not-found)` | Catch-all |

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
  and then the global handler index.
- **Handler index** (`handlers/index.ts`) — dispatch by `event.type`, one file per
  handler. `App.Events.Event` is a **discriminated union** (`LogoutEvent`, targeted +
  carrying `consumerId`; `SpaceChangeEvent`, global + carrying `resource`), and the
  index is keyed by type to the matching member — so registering a handler under the
  wrong key is a compile error. The `logout` handler re-checks
  `event.consumerId === userId` (defense-in-depth — the bus already routed by id),
  then stops the loop, **awaits** the logout POST (so `/login` can't bounce back on a
  still-present cookie), and redirects. The `space-change` handler raises the notice
  dialog and is **not** terminal — it neither stops the loop nor navigates, so a user
  mid-conversation stays put. Add a reaction by extending `App.Events.Event`, dropping
  a handler file, and registering it here.

The webhook receiver (`src/app/api/keen-webhook/route.ts`) publishes a `logout`
event scoped to `consumer.id` for the org instructions `r_consumer_logout` /
`r_consumer_contract_changed` / `r_consumer_spaces_update`, so only the targeted
consumer's browser signs out. (Note: Keen specifies `r_consumer_logout` but does not
currently emit it — the branch is here and simply never fires.)

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
authenticating with `undefined` and failing every request silently.

> Don't move these into `next.config` — its `env` key string-inlines values into
> the **client** bundle, which would ship the secrets to the browser.
