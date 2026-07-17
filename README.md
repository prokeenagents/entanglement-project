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
| `(app)` | Authenticated — home, `space/[id]`, `space/[id]/[agentID]` |
| `(login)` | `login` (+ OTP), `reset-password`, `set-password/[hash]` |
| `(registration)` | `registration`, `confirmation/[hash]` |
| `(maintanance)` | Shown when the connector isn't ready |
| `(not-found)` | Catch-all |

`src/app/api/*` are Route Handlers — the only place the browser talks to the
server about auth (`login`, `otp`, `logout`, `registration`, `reset-password`,
`set-password`) plus the Keen `keen-webhook` / `keen-callback` receivers.

### Consumer context

`(app)/layout.tsx` fetches `getConsumerData()` on the **server** and provides it
through `ConsumerProvider` (`src/contexts/consumer`). Client components read it
with `useConsumer()` — no round-trip, no re-fetch. It's provided **once** at the
`(app)` layout; nested layouts must not re-provide it.

### Styling

Chakra UI v3 over emotion. `src/components/ui/provider.tsx` wraps `ChakraProvider`
in `EmotionCacheProvider` — an SSR style registry (`cache.compat = true` +
`useServerInsertedHTML`) that flushes emotion's styles into `<head>`. Without it
emotion streams `<style>` nodes inline into the body during SSR while the client
injects via the stylesheet, and hydration fails. Don't remove it.

## Configuration

Keen credentials currently live in `KEEN_CONFIG` in
`src/service/services/keen/keen.ts` — host, origin, client id/secret, api_key
id/secret.

> ⚠️ **These are real secrets in source.** They are dev credentials against a
> local Keen edge, but committing them bakes them into git history. Move them to
> environment variables before this repo is pushed anywhere public.
