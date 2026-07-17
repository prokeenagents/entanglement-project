<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Entanglement — working rules

A partner-side consumer app for the Keen Agents platform. See `README.md` for the
architecture. This file is the short list of things that are easy to get wrong.

## Types live in `@types`, never inline

All application types go in `src/@types/*.d.ts` under the ambient
`App.<Domain>.<Type>` namespace — never declared inline in a component or a
service. Keen platform types go in `src/service/services/keen/types/keen.d.ts`
under the ambient `Keen.*` namespace. Both are global; no import needed.

The **only** exception is `z.infer<typeof schema>` in `src/@schema/*`, where the
schema is the source of truth.

## The Keen connector is server-only

`getKeen()` and everything under it (`cache`, `tools`, `crypto`, `resources`) is a
server singleton on `globalThis.__keenConnector`, created by `instrumentation.ts`.
It **does not exist in the browser**.

- Read it in a Server Component / Route Handler / Server Action.
- Pass only **serializable** data across to `'use client'` components (plain
  objects/arrays — no class instances, Maps, or functions).
- A client component that needs server data gets it as a prop or from
  `useConsumer()` — never by importing `getKeen`.
- Adding a method to the connector? A stale `globalThis` singleton survives Fast
  Refresh — **fully restart `next dev`**, or you'll get "x is not a function".

## Don't hand-roll `<Suspense fallback={null}>`

Next's `loading.tsx` file convention already wraps each segment's page in a
Suspense boundary. **The nearest boundary wins** — a manual
`<Suspense fallback={null}>` in a layout swallows the page's suspend and renders a
blank screen, and `loading.tsx` never fires. Prefer `loading.tsx`. If a boundary
is genuinely needed, give it a real fallback.

## Provide `ConsumerProvider` once

`(app)/layout.tsx` provides it for the whole authenticated tree. Context flows
down — a nested layout that re-provides it just shadows the outer one and calls
`getConsumerData()` again for nothing.

## Don't remove `EmotionCacheProvider`

`components/ui/provider.tsx` wraps `ChakraProvider` in an emotion SSR registry
(`cache.compat = true` + `useServerInsertedHTML`). Without it, emotion streams
`<style>` nodes inline into the body on the server while the client injects via
the stylesheet → hydration mismatch. It is load-bearing.

## UI is Chakra UI v3 — nothing else

No Tailwind, no shadcn/ui, no Radix. Component libraries built on those (AI
Elements, prompt-kit, …) are not drop-in here; build with Chakra primitives or
port the markup. Icons come from `react-icons`.

## Sealed hashes: purpose must match

`keen.crypto.ts` is a **byte-mirror** of the platform's `token-crypto.ts`. `open()`
must use the exact purpose the platform sealed with (`token` / `otp` /
`reset-password` / `registration`) or it throws. If the platform's crypto changes,
this file changes with it.

## New emailed link? Allow it in the guest proxy

Email-link pages carry a `/<hash>` segment, so they never match a `page.config`
URL exactly. `proxy/page/proxy-page-guest.ts` prefix-allows `/set-password/` and
`/confirmation/`. Add yours there or every link 307s to `/login`.

## Server Components can't set cookies

Only Route Handlers and Server Actions can. A server page that needs to signal a
one-time outcome uses a query flag (`/login?reset=success`) which the client
captures into state and strips with `router.replace`.

## Secrets

`KEEN_CONFIG` in `src/service/services/keen/keen.ts` holds real dev credentials
(client secret, api_key secret). They're committed. Move them to env vars before
this repo goes anywhere public.

## Git

No husky hooks here. Commit format: `<ADD|UPDATE|FIX|DELETE>: message`.
No `Co-Authored-By`. **The repo has no remote — do not add one.**
