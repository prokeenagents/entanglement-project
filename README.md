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
| `(app)` | Authenticated — home, `space/[id]`, `space/[id]/[agentID]`, `space/[id]/[agentID]/[chatID]` (live chat) |
| `(login)` | `login` (+ OTP), `reset-password`, `set-password/[hash]` |
| `(registration)` | `registration`, `confirmation/[hash]` |
| `(maintanance)` | Shown when the connector isn't ready |
| `(not-found)` | Catch-all |

`src/app/api/*` are Route Handlers — the only place the browser talks to the
server about auth (`login`, `otp`, `logout`, `registration`, `reset-password`,
`set-password`), the two-token `chat/*` proxies (`list`, `history`, `search`,
`title`, `delete`) and `refresh`, plus the Keen `keen-webhook` / `keen-callback`
receivers.

### Consumer context

`(app)/layout.tsx` fetches `getConsumerData()` on the **server** and provides it
through `ConsumerProvider` (`src/contexts/consumer`). Client components read it
with `useConsumer()` — no round-trip, no re-fetch. It's provided **once** at the
`(app)` layout; nested layouts must not re-provide it.

### Chat

A consumer talks to an agent over a **WebSocket to the Keen relay**, driven by the
raw-source SDK in `src/service/services/chat` — a port of the reference ChatSDK,
not yet an npm package, so it's self-contained with zero project imports. `ChatAPI`
sends the initial prompt, receives the root flow bundle, and drives every node —
sequential, parallel, tool sub-flows — to a terminal state.

- **Transport** is `CHAT_CONFIG.WS_URL` (`src/configs/chat.config.ts`). It must
  point at the **same host the page is served on** — `localhost` in the browser is
  the browser's machine, not the server — and use `ws://` on plain http, `wss://`
  behind TLS. A bad origin is silently dropped by the relay's `OriginGuard` and
  looks like a dead server (WS close 1006), never an auth error.
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

### Styling

Chakra UI v3 over emotion. `src/components/ui/provider.tsx` wraps `ChakraProvider`
in `EmotionCacheProvider` — an SSR style registry (`cache.compat = true` +
`useServerInsertedHTML`) that flushes emotion's styles into `<head>`. Without it
emotion streams `<style>` nodes inline into the body during SSR while the client
injects via the stylesheet, and hydration fails. Don't remove it.

## Configuration

Keen credentials are read from the **environment** by `readKeenConfig()` in
`src/service/services/keen/keen.ts`: `KEEN_HOST`, `KEEN_ORIGIN`, `KEEN_CLIENT_ID`,
`KEEN_CLIENT_SECRET`, `KEEN_API_KEY_ID`, `KEEN_API_KEY_SECRET`. They're unprefixed
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
