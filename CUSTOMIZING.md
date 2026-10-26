# Customizing the frontend

This app is a **starter**: a complete, production-shaped chat UI for Keen agents
that you are expected to re-skin and extend. Everything visual is token-driven,
so most rebrands touch a handful of files and no component code.

## 1. Try it without a backend (demo mode)

```bash
ENTANGLEMENT_DEMO=1 npm run dev
```

Demo mode serves fixture spaces, agents and conversations, and swaps the chat
WebSocket for an in-memory agent that streams realistic runs: thinking steps, a
tool call, a markdown answer. Type a prompt containing **"order"**, **"return"** or
**"check"** to trigger a tool call, and **"fail"** to see the error state. It is
hard-disabled in production builds (`src/utils/demo.ts`). The fixtures live in
`src/demo/fixtures.ts`.

## 2. Rebrand in five minutes: `src/theme/brand.config.ts`

| What | Where |
| --- | --- |
| Product name, tagline, "powered by" line | `BRAND.name`, `BRAND.tagline`, `BRAND.poweredBy` |
| Logo | Drop files in `public/brand/` and point `BRAND.logo.wordmark` / `.mark` at them. Set `invertInLight: false` if your logo is full color. |
| Accent color | `ACCENT`: paste a 50–950 scale for your brand color (500 is the main one). Buttons, links, focus rings, the user bubble, glows and the auth background all follow it. |
| Shape of buttons, cards, bubbles | `BRAND.shape`: `rounded` (default), `crisp`, `round` or `square`, or edit the `SHAPES` numbers. |
| Default light/dark | `BRAND.defaultColorMode`: `'dark'`, `'light'` or `'system'` |
| Empty-chat starter prompts | `BRAND.suggestedPrompts` |
| Typeface | `src/app/layout.tsx`: swap `Hanken_Grotesk` for any `next/font/google` family and keep the `--font-brand` variable. |

## 3. Go deeper: design tokens (`src/theme/tokens.ts`)

Components never use raw colors. They read **semantic tokens**, each defined
for both modes:

| Token | Used for |
| --- | --- |
| `bg.canvas` | the page background |
| `bg.panel` | cards, dialogs, menus |
| `bg.bar` / `bg.glass` | frosted sidebar, top bars, composer |
| `fg`, `fg.muted`, `fg.subtle` | text hierarchy |
| `border`, `border.emphasized` | lines |
| `brand.solid`, `brand.fg`, `brand.subtle`, `brand.border`, `brand.glow` | accent fills, text, tints |
| `shadows.card`, `shadows.pop`, `shadows.composer`, `shadows.glow` | elevation |
| `radii.control`, `radii.card`, `radii.panel`, `radii.bubble` | shape |

> Semantic tokens must be **nested** (`bg: { panel: … }`). Flat keys like
> `'bg.panel'` are silently ignored by Chakra.

Global CSS and the chat motion primitives (streaming caret, thinking dots,
shimmer) are in `src/theme/index.ts`.

## 4. Where things live

```
src/theme/                        brand config, tokens, Chakra system
src/components/ui/app-shell/      sidebar, mobile drawer, user menu, conversation rows
src/components/ui/surface/        the card primitive (Surface / LinkSurface / StatTile)
src/components/ui/page-header/    page title block, breadcrumbs, content column
src/components/ui/card-shell/     the frosted auth card
src/components/ui/hex-background/ the animated auth backdrop
src/components/ui-chat/
  chat-shell/                     connection + conversation state (useChat)
  chat-header/                    agent, status, steps toggle, rename/delete
  chat-messages/turns.ts          groups the stream into turns (steps + final answer)
  chat-messages/run-trace.tsx     the collapsible "worked for 4s · 3 steps" timeline
  chat-messages/markdown.tsx      answer typography (edit PROSE to restyle answers)
  chat-prompt/                    the composer
src/contexts/chat-list/           the shared conversation list (sidebar, home, agent page)
```

## 5. Common changes

- **Hide the agent's steps entirely:** don't render `<RunTrace>` in
  `chat-messages/component.tsx`. Steps are collapsed by default already, and the
  chat header's steps toggle lets each reader choose.
- **Change how a step looks:** `EVENT_META` in `run-trace.tsx` maps engine event
  names (`thinking`, `processing`, `progress`) to labels and icons.
- **Answer styling (tables, code, lists):** `PROSE` in `markdown.tsx`.
- **Different card look everywhere:** `Surface` in `components/ui/surface`.
- **Sidebar sections:** `components/ui/app-shell/sidebar.tsx`.
