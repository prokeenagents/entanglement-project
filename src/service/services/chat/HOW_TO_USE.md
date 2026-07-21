# Chat SDK — How To Use

A pure-TypeScript integration guide. No React, no framework — just the SDK and your code.

## What you're working with

One class to know: **`ChatAPI`**. Everything else (`WSConnectAPI`, `ResponseAPI`, `SendRequest`, `TaskQueue`) is an internal layer; you should never need to import them.

```ts
import ChatAPI from './api';
```

That's the only import.

## The minimum end-to-end flow

```ts
import ChatAPI from './api';

const chat = new ChatAPI({
    spaceID:     'test-space',
    agentID:     'agent-one',
    userId:      'cmnbrajfm0000mz7wd39jj0r9',
    email:       'consumer@example.com',
    accessToken: '<consumer-jwt>'   // a REAL consumer access_token (verified per message)
    // url defaults to CHAT_SETTINGS.WS_URL, projectID defaults to spaceID — see settings.ts.
    // Pass url only to target a different relay; pass projectID only when it != spaceID.
});

chat.connect();

const cid = await chat.whenReady();
console.log('handshake done, cid:', cid);

const bundles = await chat.runFlow({
    chatId: 'chat-abc-123',
    prompt: 'hello'
});

console.log('flow complete, bundles:', bundles.size);
chat.disconnect();
```

One full conversation turn. The rest of this doc explains each step and what to add when "minimum" isn't enough.

---

## Step 1 — Instantiate

```ts
const chat = new ChatAPI({
    spaceID:     'test-space',
    agentID:     'agent-one',
    userId:      'cmnbrajfm0000mz7wd39jj0r9',
    email:       'consumer@example.com',
    accessToken: '<consumer-jwt>'   // a REAL consumer access_token (verified per message)
    // url defaults to CHAT_SETTINGS.WS_URL, projectID defaults to spaceID — see settings.ts.
    // Pass url only to target a different relay; pass projectID only when it != spaceID.
});
```

`ChatAPI` is a long-lived stateful object. One instance per chat session, scoped to ONE space with a fixed default identity (user + agent + project) and ONE access token. The constructor wires up the internal graph (transport, response routing, send/retry, task queue) but does NOT open the socket. That's deliberate — it gives you a window to subscribe to lifecycle events BEFORE the wire goes live.

| Option | What it does |
|---|---|
| `url` | *Optional.* The relay WebSocket endpoint. Defaults to `CHAT_SETTINGS.WS_URL` (`settings.ts`); pass only to target a different relay |
| `spaceID` | Space identifier (no per-call override) |
| `agentID` | **Default** agent — used by `runFlow()` when the per-call `agentId` is omitted |
| `userId` | **Default** user id — fills `userContext.userId` when the per-call `userId` is omitted. **MUST equal the access_token's `sub`** — the relay enforces it per message |
| `email` | **Default** user email — fills `userContext.email` when the per-call `email` is omitted; should match the consumer the token was minted for |
| `projectID` | *Optional.* Sourced into `chatContext.projectId`; **defaults to `spaceID`** (space id === project id). Pass only when they differ. Must be a **real deployed project id** — the engine loads the flow JSON from `…/storage/projects/<projectId>/`, so the id (or the `spaceID` it falls back to) must actually exist on the engine |
| `accessToken` | Consumer identity token (a real JWT, not a placeholder). Travels inside `userContext` and is **re-stamped on every run frame** — initial run + continuations + cloned children — because the relay verifies it **per message** (`verifyWithChain`) and enforces `token.sub === userId`. Never in the URL. Mint it via `POST /keen-api/auth/access_token` (consumer email + password + the matching `Origin` header). |

`url` and `projectID` are **optional** at construction — `url` defaults to `CHAT_SETTINGS.WS_URL` (`settings.ts`, the SDK's tunable constants) and `projectID` to `spaceID`. The identity fields `spaceID` / `agentID` / `userId` / `email` / `accessToken` are set ONCE. Four of them (`agentID` / `userId` / `email` / `projectID` — but NOT `spaceID` or `accessToken`) act as **defaults** that can be overridden on individual `runFlow()` calls. The defaults are also exposed as readonly fields on the instance (`chat.userId`, `chat.email`, `chat.projectID`, `chat.spaceID`, `chat.agentID`) so downstream UI / logging can read them without threading them through. To switch space or refresh the token, construct a new `ChatAPI` (and disconnect the old one). You hold this reference for the lifetime of the user's chat. Don't recreate it per message.

## Step 2 — Wire lifecycle subscriptions

```ts
chat.onStatus(s => console.log('status:', s));
chat.onSystem(text => console.log('system:', text));
```

Subscribe BEFORE you call `connect()`. If you subscribe later, you'll miss the `'connecting'` status and the `'open ws://...'` system message.

| Channel | What it fires for |
|---|---|
| `onStatus(s)` | `'disconnected'` → `'connecting'` → `'connected'` transitions on the WebSocket |
| `onSystem(text)` | Free-form transport narration: open, close (with code + reason), socket error, malformed inbound frame, welcome confirmation. Treat it like the SDK's `stderr` |

For a script that just sends one prompt and exits, you can skip both — but you'll be flying blind if anything fails. For anything that needs to know "am I connected" or debug a broken connection, wire them.

Optional at this step:

```ts
chat.onWelcome(({ correlationID }) => {
    console.log('relay assigned cid:', correlationID);
});
```

Fires once per connection when the relay's welcome frame arrives. The cid is also available via `await chat.whenReady()` or `chat.getCorrelationID()` — `onWelcome` is just the event form.

## Step 3 — Connect

```ts
chat.connect();
```

Synchronous, fire-and-forget. Returns immediately. What happens:

1. Constructs `new WebSocket(url)` — browser starts the TCP + WS handshake asynchronously.
2. Sets status to `'connecting'` — your `onStatus` handler fires synchronously.
3. Wires the four browser events (`onopen` / `onclose` / `onerror` / `onmessage`).
4. Returns. You have control back.

Some milliseconds later (async):
- Socket opens → status `'connected'` + `onSystem` `"open ws://..."`
- Relay sends welcome frame → SDK captures the cid + `onWelcome` fires + `onSystem` `"welcome — correlationID rly-xxx"`

Calling `connect()` twice is a no-op (idempotent). If the URL is malformed, the constructor throws internally and you'll see `onSystem` `"failed to construct WebSocket: ..."`.

## Step 4 — Wait until ready

```ts
const cid = await chat.whenReady();
```

`'connected'` status only means the WIRE is open. There's a second handshake — the relay's welcome frame, which carries the cid — and you need both to be done before sending. `whenReady()` collapses them into one Promise that resolves with the cid.

For production, wrap it with a timeout — if the relay never sends welcome (version mismatch, misconfig), the Promise hangs forever:

```ts
const cid = await Promise.race([
    chat.whenReady(),
    new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('welcome timeout')), 5000)
    )
]);
```

After `whenReady` resolves, you can call any send method.

## Step 5 — Run a flow

If you want to see the agent's progress (thinking, tokens, etc.), wire `onStream` first:

```ts
chat.onStream((event, data) => {
    console.log(`[${event}]`, data?.text ?? data?.data ?? data);
});
```

Then fire the flow:

```ts
const bundles = await chat.runFlow({
    chatId: 'chat-abc-123',
    prompt: 'hello, agent'
});
```

`chatId` is **required** — it's the conversation-thread key and every `chat_history` row stores it, so there's no sensible default. Everything else (`userId` / `email` / `projectId` / `agentId`) defaults to what you passed the constructor; pass an override field on the input to use a different identity for this single turn:

```ts
await chat.runFlow({
    chatId: 'chat-abc-123',
    prompt: 'switch agent for this turn only',
    agentId: 'agent-two'         // overrides ctor default for THIS call only
});
```

`space` and `accessToken` come from the constructor and cannot be overridden per call.

> **Browser cookies ride along on the first frame.** On the initial run (and ONLY the initial run), the SDK reads `document.cookie` and forwards the browser's JS-readable cookies in a `requestContext: { cookies }` block. The engine stores them at `cookieStorage:${cid}_${sid}`; script nodes read individual values via `system/cookies`. **`HttpOnly` cookies are invisible to `document.cookie`**, so they are NOT forwarded — only cookies your JS can read. The forwarded set is per-flow + per-chat and dies with the flow; there's nothing to opt into or pass — it's automatic, and you don't control it per call.

This one `await` runs the entire conversation turn end-to-end. Under the hood:

1. Heartbeat starts (every 20s — keeps engine dict/session TTLs alive while the flow runs).
2. Initial run frame sent (carrying `requestContext.cookies`). Transport retries up to 10× on socket failure.
3. Engine processes, returns the root `FlowTaskBundle` (metadata + first nodeTask).
4. Drain loop fires per-node calls, parallelises `parallelFlowTask` siblings and `parallelContextTask` clones, repeats until every bundle's `flowTask.completed === true`.
5. Heartbeat stops, bundle snapshot returned, internal state cleared.

The `bundles` map contains the final state of every flow in the tree, keyed by `${cid}_${sessionID}_${flowID}`. Mostly useful for inspection / debugging — the actual user-facing payload (model output, tokens) flows through `onStream` during the run.

### Failure handling

Wrap `runFlow` in a try/catch:

```ts
try {
    const bundles = await chat.runFlow({ chatId, prompt });
    // success
} catch (err) {
    console.error('flow failed:', err);
    // engine state already wiped — see below
}
```

Anything thrown inside `runFlow` (initial transport exhaustion, non-success envelope, per-node max retries, terminal error) triggers an internal `chat.sendCancel()` before re-throwing. That tells the engine to wipe `dict:${cid}_*` + `session:${cid}_*` + agent state + queued NATS messages for the cid. You don't need to call cancel yourself in the catch — by the time you handle the error, cleanup has already fired.

### Cancelling mid-flow

If the user clicks "stop":

```ts
chat.cancel();   // stops drain loop + sends cancel frame + clears local state
```

Single facade method. Engine wipes dict / session / agentState / NATS queue for the cid; your in-flight `runFlow` Promise rejects with `'TaskQueue cancelled'`.

## Step 6 — Next turn

For a multi-turn chat, just call `chat.runFlow(...)` again with the next prompt — **passing the same `chatId`** so the engine groups all turns under the same conversation in `chat_history`:

```ts
const chatId = 'chat-abc-123';

const turn1 = await chat.runFlow({ chatId, prompt: 'first message' });
const turn2 = await chat.runFlow({ chatId, prompt: 'second message' });
const turn3 = await chat.runFlow({ chatId, prompt: 'third message' });
```

`chatId` is the **chat-thread identity** — every turn that belongs to the same conversation must share it. (Internally the SDK still mints a fresh `sessionID` + `requestID` per turn — that's per-flow identity, not per-thread.) The connection-scoped `cid` stays stable for the WS lifetime; the engine joins them up with `chatId` to know which prior turns belong to this thread.

To start a fresh conversation, generate a new `chatId` and pass that instead. Don't try to run two turns concurrently on the same `chat` — `runFlow` rejects with "TaskQueue already running" if a previous call hasn't finished. Await each one.

## Step 7 — Disconnect

```ts
chat.disconnect();
```

Closes the WebSocket and rejects any pending `waitFor` promises. The relay's `handleDisconnect` fires `dispatcher.cancel(cid)` server-side, which wipes the engine's dict/session/agentState/queue for this cid. So even if you forget to call `sendCancel` first, dropping the connection cleans up.

After disconnect, the `ChatAPI` instance is no longer usable for the same connection. To reconnect, call `chat.connect()` again — but the cid will be a fresh one (new connection, new welcome).

---

## Channel reference

What flows where:

| Channel | When it fires | Typical use |
|---|---|---|
| `onStatus(s)` | Connection state transitions | UI gate ("connected" pill, disable Send when not connected) |
| `onRunning(running)` | `true` when a flow starts, `false` when it settles (success / throw / cancel) | Send-button gate, in-flight spinner |
| `onSystem(text)` | Transport narration (open, close, error, welcome, malformed frame) | Logging / telemetry |
| `onWelcome({correlationID})` | Once per connection, when relay sends welcome | Structured cid handoff (alternative to `whenReady`) |
| `onResponse(envelope, requestId)` | Every envelope reply from the server | Mostly internal; consumers rarely need it directly |
| `onStream(event, data)` | Engine progress events (thinking, processing, token, etc.) | Render model output, progress bars |

Each `chat.onX(...)` returns an `Unsubscribe` function — call it to detach the handler.

## Imperative API reference

```ts
chat.connect();                                  // open the socket
chat.disconnect();                               // close + cleanup
chat.isConnected();                              // boolean
chat.getStatus();                                // current ConnectStatus
chat.getCorrelationID();                         // current cid or null
chat.whenReady();                                // Promise<cid> resolves on welcome

chat.runFlow({ chatId, prompt, userId?, email?, projectId?, agentId? });
                                                 // run a full conversation turn
                                                 // chatId + prompt REQUIRED; rest default to ctor
chat.cancel();                                   // cancel the running flow
chat.isRunning();                                // boolean — is a flow in flight
chat.sendPing();                                 // heartbeat (TaskQueue does this for you)

// Readonly identity defaults (the ctor values, exposed for downstream UI/logging)
chat.userId  chat.email  chat.projectID  chat.spaceID  chat.agentID
```

That's the whole consumer-facing surface. If you find yourself reaching into `chat.wsConnectApi` or `chat.taskQueue`, ask whether ChatAPI should grow a delegator instead.

## Common patterns

### Wait for a single response without using runFlow

For ad-hoc message/response with no flow orchestration, build the full `InitialRunPayload` directly. Note this is rarely what you want — `runFlow` is the supported path.

```ts
const envelope = await chat.sendMessage({
    userContext: {
        userId: chat.userId,
        email: chat.email,
        accessToken: '<consumer-jwt>'   // a REAL consumer access_token (verified per message)
    },
    rootAgentContext: { agentId: chat.agentID, prompt: 'hello' },
    chatContext: { chatId: 'chat-abc-123', projectId: chat.projectID },
    flowContext: {
        // generateUUID(), not crypto.randomUUID(): randomUUID is secure-context-only
        // and this app serves over plain http in dev, where it is undefined.
        sessionId: generateUUID(),
        requestId: generateUUID()
    }
});
console.log('reply:', envelope);
```

This low-level path does NOT auto-attach cookies — only `runFlow` (via `TaskQueue`) reads `document.cookie` into `requestContext.cookies`. If you need them here, add the optional `requestContext: { cookies: readBrowserCookies() }` block yourself.

### Detect mid-session disconnect

```ts
chat.onStatus(s => {
    if (s === 'disconnected') {
        // socket dropped — disable UI, optionally trigger reconnect
    }
});
```

### Canonical Send-button gate

Both signals matter — connected AND not currently running:

```ts
let connected = false;
let running = false;

chat.onStatus(s => { connected = (s === 'connected'); render(); });
chat.onRunning(r => { running = r; render(); });

function render() {
    sendButton.disabled = !connected || running;
}
```

`onRunning(true)` fires the instant `runFlow()` is called; `onRunning(false)` fires when it settles (whether by success, throw, or `chat.cancel()`). No need to track your own boolean alongside the await.

### Inspect the bundle tree after runFlow

```ts
const bundles = await chat.runFlow(input);

for (const [key, bundle] of bundles) {
    console.log(key, 'completed:', bundle.flowTask.completed);
    for (const node of bundle.nodeTasks) {
        console.log('  ', node.id, 'ready:', node.ready);
    }
}
```

---

## What this SDK does NOT do

- **No automatic reconnect** — if the socket drops, you decide whether to call `connect()` again.
- **No token minting** — you supply a real consumer `access_token`; the SDK only carries + re-stamps it into `userContext` on every run frame. The relay verifies it per message (`verifyWithChain` + `token.sub === userId`). Mint it via `POST /keen-api/auth/access_token` (consumer email + password + the matching `Origin` header). It is NOT a dev no-op.
- **No cookie management** — the SDK forwards the browser's JS-readable cookies (`document.cookie`) once on the initial run (`requestContext.cookies`), nothing more: no setting, no refresh, no HttpOnly access (those are invisible to `document.cookie`), and the forwarded set is per-flow + per-chat (it dies with the flow on the engine side).
- **No message persistence** — pending `waitFor` promises reject on `disconnect()`. Messages in flight are lost.
- **No UI** — that's your job. The SDK gives you events and methods; you bind them to whatever rendering layer you want.
