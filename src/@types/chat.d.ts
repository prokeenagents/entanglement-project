export {};

declare global {
    namespace App {
        namespace Chat {
            /**
             * The shape of the response envelope returned by ms-relay
             * for a completed run. Stream events (engine → user
             * progress) DO NOT include an envelope; their absence is
             * the marker we use to route a frame to the stream
             * terminal instead of the main log.
             */
            interface Envelope {
                success: boolean;
                code: string;
                message?: string;
                data?: unknown;
            }

            /**
             * Top-level frame shape received over the WebSocket from
             * ms-relay. 'event' identifies the kind of frame (run /
             * cancel responses use the same event name they were sent
             * with; stream events use names like 'thinking',
             * 'processing', 'progress', 'token', 'error').
             */
            interface InboundFrame {
                event: string;
                data: {
                    requestId?: string;
                    envelope?: Envelope;
                    text?: string;
                    [key: string]: unknown;
                };
            }

            // ─── CONTEXT BLOCKS ─────────────────────────────────────────────
            // The wire model is FLAT — each request/response groups identity
            // into named context blocks. There is NO `root` wrapper; the
            // tree-invariant contexts (userContext, rootFlowContext,
            // rootAgentContext) sit as siblings of the per-call flowContext
            // / nodeContext.

            /**
             * User identity — supplied by the client on the initial run
             * (form fields in dev; auth layer's validated JWT claims in
             * prod). Echoed in every flowTask + sent back by the client
             * on every per-node call. correlationToken takes over
             * verification once it lands.
             */
            interface UserContext {
                userId: string;
                email: string;
                /**
                 * Re-stamped onto every outbound run/continuation frame
                 * (the relay verifies it per-frame). Optional on the base
                 * type because the server-echoed userContext drops it.
                 */
                accessToken?: string;
            }

            /**
             * Chat identity — the conversation thread and the project that
             * defines its flow. Set by the client on the initial run and
             * propagated unchanged through every spawned child (parallel
             * context clones, runFlow children) so every history row can
             * be keyed back to the chat that produced it.
             *
             * chatId  — picker-assigned identifier of THIS chat thread
             *           (per-chat persistence key in the chat_history DB).
             * projectId — which project's flow JSON the engine loads to
             *           drive this run. Was previously hardcoded on both
             *           the flow-engine + llm-engine-2 RPC controllers;
             *           now sourced here.
             */
            interface ChatContext {
                chatId: string;
                /**
                 * projectId IS the space id (one id identifies both). The
                 * relay authorizes it against the token's `space` claim +
                 * the consumer contract's current spaces before dispatch
                 * (E3101 if not allowed). Propagated on every per-node frame.
                 */
                projectId: string;
            }

            /**
             * The tree root's flow identity — flowId, correlationId,
             * sessionId of the ROOT flow. Set ONCE in runInitialPayload
             * and threaded unchanged through every per-node call. Spawned
             * children carry the ORIGINAL tree's ids here even when their
             * own flowContext.flowId differs.
             */
            interface RootFlowContext {
                flowId: string;
                correlationId: string;
                sessionId: string;
                requestId: string;
            }

            /**
             * The agent + initial user prompt the run targets. agentId
             * client-supplied on the initial payload; prompt is the user's
             * input. Echoed in every flowTask but NOT carried back on
             * per-node requests — the engine resolves prompt via
             * agentStateMgr.getRootAgentPrompt(cid, agentId) and resolves
             * agentId itself via the treeContext:{cid} Dragonfly key
             * written at init.
             */
            interface RootAgentContext {
                agentId: string;
                prompt: string;
            }

            /**
             * Per-call flow identity. correlationId / sessionId / requestId
             * always present. flowId is optional — root flow reads it from
             * rootFlowContext.flowId, spawned children carry their OWN
             * flowId here. Spawn metadata (parentFlowId / parentSessionId /
             * contextNumber / contextPath) lives here too when present.
             * correlationToken is the per-call auth seal (slot reserved;
             * lands when auth.utils mints it on initial run).
             */
            interface FlowContext {
                correlationId: string;
                sessionId: string;
                requestId: string;
                flowId?: string;
                /**
                 * The dict-owning flow. A runFlow/jumpFlow child inherits its
                 * spawner's currentFlowId (engine-set) so it stays on the calling
                 * flow's dict. Forwarded verbatim on every per-node call.
                 */
                currentFlowId?: string;
                parentFlowId?: string;
                parentSessionId?: string;
                contextNumber?: number;
                contextPath?: string;
                correlationToken?: string;
            }

            /**
             * The bundle's own flowContext — same fields as the per-call
             * FlowContext plus the bundle-level `entry` + `completed`. flowId
             * is REQUIRED on the bundle (every flowTask has one).
             */
            interface FlowTaskFlowContext extends FlowContext {
                flowId: string;
                entry: string;
                completed: boolean;
            }

            /**
             * Which node to execute on a per-node call.
             */
            interface NodeContext {
                id: string;
                kind: string;
                initial?: boolean;
            }

            // ─── WIRE PAYLOADS ──────────────────────────────────────────────

            /**
             * Initial run payload — {event:'run', data:{requestId, payload}}
             * on the first frame. Client mints sessionId+requestId AND
             * supplies the full user + chat identity (form-fed in dev;
             * auth-validated in prod). Engine writes treeContext:{cid},
             * loads chatContext.projectId, replies with a rich FlowTask
             * carrying all six sibling contexts.
             */
            interface InitialRunPayload {
                userContext: { userId: string; email: string; accessToken: string };
                rootAgentContext: RootAgentContext;
                chatContext: ChatContext;
                flowContext: {
                    correlationId?: string;
                    sessionId: string;
                    requestId: string;
                };
                /**
                 * Request-scoped cookies forwarded on the initial run only.
                 * The engine writes them to cookieStorage:${cid}_${sid};
                 * script nodes read via system/cookies. Dies with the flow.
                 */
                requestContext?: {
                    cookies?: Record<string, string>;
                };
            }

            /**
             * Constructor options for ChatAPI. URL identifies the relay;
             * spaceID + agentID scope every run on this instance to a
             * single agent inside a single space — they're set once at
             * construction and reused for every runFlow() call, so the
             * consumer doesn't carry them per-message.
             *
             * For now these are hardcoded by the consumer at construction.
             * Once auth + UI selection land, the consumer mints a new
             * ChatAPI when the user picks a different agent.
             */
            interface ChatAPIOptions {
                /**
                 * Relay WebSocket endpoint. Optional — defaults to
                 * CHAT_SETTINGS.WS_URL. Pass only to point at a different
                 * relay per deployment.
                 */
                url?: string;
                spaceID: string;
                agentID: string;
                /**
                 * Default identity used when runFlow() doesn't override
                 * them. In dev this is the form-prefill set; in prod
                 * these come from the authenticated user + the agent
                 * picker.
                 */
                userId: string;
                email: string;
                /**
                 * Optional — defaults to spaceID (space id === project id).
                 * Pass only when they differ.
                 */
                projectID?: string;
                /**
                 * User identity token. Sent ONCE inside the initial run
                 * payload (never in the WS URL — keeps it out of proxy
                 * logs). Engine validates, returns a server-derived
                 * correlationToken in the bundle; every subsequent
                 * per-node call carries that token instead so the
                 * accessToken doesn't keep crossing the wire.
                 */
                accessToken: string;
                /**
                 * Cookies forwarded to script nodes on the initial run (they
                 * read values via `system/cookies`). Two shapes:
                 *
                 *  • a list of NAMES — `cookies: ['gconnect', 'locale']` — an
                 *    allow-list read from the BROWSER's `document.cookie`; only
                 *    those are forwarded (`[]` = none, omit = every JS-readable
                 *    cookie, the default). `HttpOnly` cookies are never visible
                 *    to `document.cookie`, so never forwarded.
                 *
                 *  • an explicit MAP — `cookies: { gconnect: '<token>' }` —
                 *    used AS-IS, needing no browser. This is how a HEADLESS
                 *    caller (a building agent running via the CLI) supplies a
                 *    cookie a real user's browser would otherwise carry.
                 */
                cookies?: string[] | Record<string, string>;
                /**
                 * Max parallelContext clones drained concurrently in one wave
                 * (the fan-out batch). Optional — defaults to
                 * CHAT_SETTINGS.CONTEXT_BATCH_SIZE. Raise it for more parallel
                 * requests; note the Keen server admits a bounded number at
                 * once, so above that the extra clones meet backpressure
                 * (retried) rather than more throughput. Honoured only when a
                 * positive integer — otherwise the default constant is used.
                 */
                contextBatchSize?: number;
            }

            /**
             * Identity + prompt the consumer hands to ChatAPI.runFlow /
             * TaskQueue.run for the first turn of a chat. chatId is REQUIRED
             * (no default) — the picker UI must supply it; everything else
             * defaults to the ChatAPI constructor's preset identity in dev.
             * The three flow ids (correlationId / sessionId / requestId)
             * are minted internally before InitialRunPayload is built.
             */
            interface RunFlowInput {
                chatId: string;
                prompt: string;
                userId?: string;
                email?: string;
                projectId?: string;
                agentId?: string;
            }

            /**
             * Server → client greeting frame sent by ms-relay on WS
             * connection. Carries the correlationID relay assigned to
             * this connection — persists for the WS lifetime, used as
             * the per-chat identifier the server tags engine → user
             * stream events with.
             *
             * NOTE: This is a relay-side wire concern (not in the
             * flow-engine's chat.d.ts). The relay still emits this
             * field as `correlationID` (uppercase D); preserved as-is
             * to match the relay's actual output.
             */
            interface WelcomePayload {
                correlationID: string;
            }

            /**
             * Subscriber for the welcome event. Fires once per WS
             * connection (immediately after relay sends the welcome
             * frame). After this fires, chat.getCorrelationID() is
             * guaranteed to return a string.
             */
            type WelcomeHandler = (payload: WelcomePayload) => void;

            /**
             * Per-node run payload — sent by the client for every NodeTask
             * after the initial bundle. Lean: userContext + rootFlowContext
             * + per-call flowContext + nodeContext. NO rootAgentContext
             * (engine resolves prompt via agentStateMgr.getRootAgentPrompt
             * and agentId via treeContext:{cid}).
             */
            interface NodeTaskRequest {
                userContext: UserContext;
                rootFlowContext: RootFlowContext;
                chatContext: ChatContext;
                flowContext: FlowContext;
                nodeContext: NodeContext;
                /**
                 * Per-call side-band. Polymorphic by content — meaning
                 * driven by which keys are present:
                 *   - `{ toolResponse: true, promptMarker }` on an
                 *     agentNode redispatch fired after a tool flow
                 *     finishes; llms-engine reads it to decide
                 *     "use tool's new prompt" vs "synthesize
                 *     'Invalid message'".
                 *   - `{ toolContext, agentNode }` on the START NODE
                 *     of a tool flow (seeded by the client from
                 *     flowTask.options when toolFlow:true). flow-engine
                 *     caches it at flow-start and auto-injects onto
                 *     every subsequent inner nodeTask so scriptNode
                 *     handlers can expose it as a `toolOptions` IVM
                 *     global.
                 */
                options?: Record<string, unknown>;
            }

            /**
             * Per-node response payload carried inside Envelope.data when
             * success: true. Lists the next NodeTasks the engine emitted
             * after executing this node.
             */
            interface NodeTaskResponse {
                flowContext: {
                    correlationId: string;
                    sessionId: string;
                    requestId: string;
                };
                nextNodeTasks: NodeTask[];
            }

            /**
             * Spawn-context payload — fired by TaskQueue for every copy of
             * a parallelContextTask. Each copy is a brand-new FlowTaskBundle
             * sharing the parent's correlationId + carrying its own
             * sessionId + flowId + options.context (the copy index).
             */
            interface ContextRunPayload {
                userContext: UserContext;
                rootFlowContext: RootFlowContext;
                rootAgentContext: RootAgentContext;
                chatContext: ChatContext;
                flowContext: {
                    correlationId: string;
                    sessionId: string;
                    requestId: string;
                    flowId: string;
                    parentFlowId: string;
                    contextNumber: number;
                    contextPath: string;
                    entry: string;
                };
            }

            /**
             * Outbound frame shape — discriminated by event.
             *
             *   run    — carries requestId + a payload (Initial,
             *            NodeTask, or ContextRun).
             *   cancel — carries the flow's correlationId only.
             *            The server tears down dict / session /
             *            agent state and purges queued messages for
             *            that cid; late responses arriving after the
             *            cancel are silently dropped client-side.
             *   ping   — heartbeat, no payload (relay derives the
             *            cid from the WebSocket itself).
             */
            type OutboundFrame =
                | {
                      event: 'run';
                      data: {
                          requestId: string;
                          payload: InitialRunPayload | NodeTaskRequest | ContextRunPayload;
                      };
                  }
                | {
                      event: 'cancel';
                      data: {
                          correlationId: string;
                      };
                  }
                | {
                      event: 'ping';
                      /**
                       * Heartbeat — relay derives the cid from the
                       * WebSocket itself, so the frame carries no
                       * payload. Sent every ~5s by TaskQueue while a
                       * run() is in flight to keep the engine's dict /
                       * session TTLs refreshed across idle gaps.
                       */
                      data: Record<string, never>;
                  };

            /**
             * Lifecycle state of a Connect instance.
             *
             * 'unauthorized' is reserved for the future relay-side auth
             * rejection: when the relay closes the WS with the
             * agreed-upon auth-failure close code (4401 by convention),
             * the client flips to this state instead of plain
             * 'disconnected' so consumer UIs can show the right
             * message ("invalid token", "session expired", etc.) and
             * skip auto-reconnect.
             */
            type ConnectStatus = 'disconnected' | 'connecting' | 'connected' | 'unauthorized';

            /**
             * Subscriber callbacks the Connect class fires.
             */
            type MessageHandler = (frame: InboundFrame) => void;
            type StatusHandler = (status: ConnectStatus) => void;
            type SystemHandler = (text: string) => void;

            /**
             * Function returned by Connect.on* subscribers. Call it
             * to detach the corresponding handler.
             */
            type Unsubscribe = () => void;

            /**
             * Configuration for one SendRequest instance.
             */
            interface SendRequestOptions {
                /**
                 * Maximum number of send attempts, including the
                 * first. Defaults to 10 — same value the client SDK
                 * retry contract specifies.
                 */
                maxRetries?: number;

                /**
                 * Wait (ms) between attempts when the previous attempt
                 * failed to reach an open socket. Linear, not
                 * exponential — keeps retry latency predictable.
                 * Defaults to 1000 ms.
                 */
                retryDelayMs?: number;

                /**
                 * Per-attempt hook the consumer can wire to its logger
                 * / UI. Fires before every attempt with whether the
                 * send call succeeded.
                 */
                onAttempt?: (info: { attempt: number; requestId: string; sent: boolean }) => void;
            }

            /**
             * Discriminated result returned by SendRequest.execute().
             * The 'attempts' field reports how many send attempts ran
             * (including the successful or final-failing one).
             */
            type SendResult =
                | { ok: true; requestId: string; attempts: number }
                | { ok: false; error: string; attempts: number };

            /**
             * Configuration for ResponseAPI.
             */
            interface ResponseAPIOptions {
                /**
                 * Default timeout (ms) for waitFor() when the caller
                 * does not pass one explicitly. After this elapses
                 * without a matching envelope arriving, the waitFor
                 * promise rejects. Defaults to 30000.
                 */
                defaultTimeoutMs?: number;
            }

            /**
             * Subscriber for response envelopes — fires whenever an
             * inbound frame carries an Envelope. The requestId is
             * pulled from frame.data.requestId; empty string when the
             * server did not include one.
             */
            type ResponseHandler = (envelope: Envelope, requestId: string) => void;

            /**
             * Subscriber for stream events — fires for inbound frames
             * WITHOUT an envelope (engine → user progress messages
             * such as thinking, processing, progress, token, error).
             * 'data' is the raw frame.data minus the envelope field
             * the routing already stripped.
             */
            type StreamEventHandler = (
                event: string,
                data: InboundFrame['data'],
                requestId?: string
            ) => void;

            /**
             * The metadata side of one flow execution. FLAT — six sibling
             * blocks: userContext, rootFlowContext, rootAgentContext,
             * chatContext (all tree-invariant; threaded unchanged from
             * start → end) + flowContext (this specific flowTask's
             * identity) + options.
             *
             * 'flowContext.completed' is CLIENT-DERIVED — TaskQueue sets
             * it true when the bundle's drain loop finds no more pending
             * nodes (all ready, none queued).
             */
            type FlowTask = {
                userContext: UserContext;
                rootFlowContext: RootFlowContext;
                rootAgentContext: RootAgentContext;
                chatContext: ChatContext;
                flowContext: FlowTaskFlowContext;
                options: Record<string, unknown>;
                /**
                 * Marks this flow as a tool dispatch. llms-engine sets
                 * it true on the spawned childFlow when a SYSTEM CALL
                 * resolved to a flow tool. The client SDK seeds the
                 * start node's `options` from `flowTask.options` when
                 * this is true — flow-engine takes it from there.
                 */
                toolFlow?: boolean;
            };

            /**
             * The unit TaskQueue stores. Server sends it as the
             * envelope payload for the initial run, every parallel
             * child, and every parallel-context copy. Client adds
             * to TaskQueue's Map keyed by
             *   `${flowContext.correlationId}_${flowContext.sessionId}_${flowContext.flowId}`
             */
            type FlowTaskBundle = {
                flowTask: FlowTask;
                nodeTasks: NodeTask[];
            };

            /**
             * Subscriber for TaskQueue state changes. Fires after
             * every meaningful mutation — node admitted, node
             * completed, parallel sub-flow registered, bundle
             * completed, queue cleared. Receives a snapshot of the
             * full bundle map (empty after clear).
             */
            type FlowUpdateHandler = (bundles: ReadonlyMap<string, FlowTaskBundle>) => void;

            /**
             * Subscriber for flow in-flight transitions. Fires `true`
             * the instant TaskQueue.run() starts and `false` when it
             * settles (success, throw, or cancel). Use this to gate
             * the Send button while a flow is in progress without
             * tracking your own boolean alongside `await runFlow(...)`.
             */
            type RunningHandler = (running: boolean) => void;

            /**
             * Node task — wire shape is `flowContext + nodeContext` +
             * optional `options`. The client's TaskQueue wraps this
             * with its own in-progress / ready / spawn-reference
             * state below.
             */
            type NodeTask = {
                /**
                 * Per-call flow identity for this NodeTask. correlationId
                 * / sessionId / requestId always present. Wire shape.
                 */
                flowContext: {
                    correlationId: string;
                    sessionId: string;
                    requestId: string;
                };

                /**
                 * Which node to execute (id + kind + initial). Wire shape.
                 */
                nodeContext: NodeContext;

                /**
                 * Per-call side-band carried on the wire. Polymorphic:
                 *   - `{ toolResponse: true, promptMarker }` on an
                 *     agentNode redispatch fired by llms-engine after
                 *     a tool flow completes (or when SYSTEM CALL
                 *     resolution failed and llms-engine wrote the
                 *     error message itself).
                 *   - `{ toolContext }` on a script-tool dispatch
                 *     (synthetic scriptNode, toolNode_<uuid> id).
                 *   - `{ toolContext, agentNode }` on the start node
                 *     of a tool flow (seeded from flowTask.options);
                 *     flow-engine caches + auto-injects to inner
                 *     nodes.
                 * Regular nodes leave this absent.
                 */
                options?: Record<string, unknown>;


                /**
                 * Is the node task still in progress.
                 * CLIENT-OWNED execution state — not on the wire.
                 */
                inProgress: boolean;

                /**
                 * Indicates is the node task ready - completed.
                 * CLIENT-OWNED execution state — not on the wire.
                 */
                ready: boolean;

                /**
                 * The response envelope THIS node received when it executed
                 * (stamped by TaskQueue right after its waitFor). Lets the
                 * harness show the exact per-node response on click. Undefined
                 * until the node has run.
                 */
                response?: Envelope;

                /**
                 * IDs of the next nodes the server expects us to
                 * resolve via per-node sends. The server's response
                 * for this node arrives with full NodeTask objects
                 * matching these IDs, which TaskQueue then pushes
                 * onto the bundle's nodeTasks for the drain loop to
                 * pick up.
                 */
                nextNodes?: Array<string>;

                /**
                 * Parallel sub-flows attached to this node.
                 *
                 * Inbound from the server: Array<FlowTaskBundle> —
                 * full bundles to spawn as siblings.
                 *
                 * After TaskQueue normalises: Array<string> — bundle
                 * ids (`${cid}_${sid}_${flowId}`) pointing into the queue's
                 * map. The original bundles are added to the map.
                 *
                 * The host node becomes ready only when every
                 * referenced bundle has flowTask.flowContext.completed === true.
                 */
                parallelFlowTask?: Array<FlowTaskBundle> | Array<string>;

                /**
                 * Parallel-context fan-out attached to this node.
                 *
                 * Inbound from the server:
                 *   { flowTask: FlowTaskBundle, total: number }
                 *   — TaskQueue clones the bundle 'total' times,
                 *     each clone gets fresh sessionId/requestId/flowId
                 *     and options.context = index. Each clone is
                 *     added to the queue's map.
                 *
                 * After TaskQueue normalises: Array<string> —
                 * bundle ids pointing into the queue's map. The
                 * total is implicit from array length.
                 *
                 * The host node becomes ready only when every
                 * referenced bundle has flowTask.flowContext.completed === true.
                 */
                parallelContextTask?:
                    | { flowTask: FlowTaskBundle; total: number }
                    | Array<string>;
            };
        }
    }
}
