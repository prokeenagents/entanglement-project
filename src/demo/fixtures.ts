/**
 * Demo-mode fixture data (see utils/demo.ts). Pure data — safe to import from the
 * server (getConsumerData) and the client (the in-memory chat store).
 *
 * Shaped exactly like the real Keen payloads so every screen renders the same way
 * it will against a live sandbox.
 */

const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

const agent = (id: string, spaceId: string, displayName: string, agentId: string, active = true): Keen.SpaceListCacheAgent => ({
    id,
    createdAt: iso(60 * 24 * 30),
    updatedAt: iso(60 * 24 * 2),
    displayName,
    agentId,
    startFlow: 'main',
    startNode: 'start',
    active,
    spaceId
});

export const DEMO_SPACES: Keen.SpaceListCacheResult[] = [
    {
        id: 'space-support',
        createdAt: iso(60 * 24 * 90),
        updatedAt: iso(60 * 24 * 3),
        title: 'Customer Support',
        description: 'Agents that handle customer questions, order issues, returns and account help.',
        agents: [
            agent('agent-orders', 'space-support', 'Order Assistant', 'order-assistant'),
            agent('agent-returns', 'space-support', 'Returns Specialist', 'returns-specialist'),
            agent('agent-billing', 'space-support', 'Billing Helper', 'billing-helper')
        ]
    },
    {
        id: 'space-sales',
        createdAt: iso(60 * 24 * 60),
        updatedAt: iso(60 * 24 * 1),
        title: 'Sales & Growth',
        description: 'Qualify leads, prepare offers and answer product questions for prospects.',
        agents: [agent('agent-offers', 'space-sales', 'Offer Agent', 'offer-agent'), agent('agent-leads', 'space-sales', 'Lead Qualifier', 'lead-qualifier')]
    },
    {
        id: 'space-internal',
        createdAt: iso(60 * 24 * 40),
        updatedAt: iso(60 * 5),
        title: 'Internal Knowledge',
        description: 'Company policies, IT help and onboarding answers for the team.',
        agents: [
            agent('agent-hr', 'space-internal', 'HR Policy Guide', 'hr-policy-guide'),
            agent('agent-it', 'space-internal', 'IT Helpdesk', 'it-helpdesk'),
            agent('agent-legacy', 'space-internal', 'Legacy Wiki Bot', 'legacy-wiki-bot', false)
        ]
    }
];

export const DEMO_TOKEN_PAYLOAD: Keen.AccessTokenPayload = {
    sub: 'demo-user',
    username: 'Alex Morgan',
    email: 'alex@example.com',
    space: DEMO_SPACES.map(space => space.id).join(','),
    jti: 'demo',
    consumerContractKey: 'demo',
    origin: 'http://localhost:3000',
    clientId: 'demo'
};

export const DEMO_PROFILE: Keen.ConsumerProfile = {
    firstName: 'Alex',
    lastName: 'Morgan',
    gender: 'other',
    dobDay: '14',
    dobMonth: '6',
    dobYear: '1992',
    email: DEMO_TOKEN_PAYLOAD.email
};

export const DEMO_CONSUMER_DATA: Keen.ConsumerData = {
    accessToken: 'demo-access-token',
    tokenPayload: DEMO_TOKEN_PAYLOAD,
    consumerSpaces: DEMO_SPACES,
    agents: DEMO_SPACES.flatMap(space => space.agents),
    demo: true
};

const TOOL_REPLY = `Let me look that order up for you.
<SYSTEM CALL>
!*action
use tool flow
!*tool
Order Lookup
!*context
{ "orderId": "1234", "fields": ["status", "carrier", "eta"] }
</SYSTEM CALL>
Order **#1234** shipped yesterday and is **out for delivery** today.

| Detail | Value |
| --- | --- |
| Carrier | DHL Express |
| Last scan | 07:48, 12 km away |
| ETA | Today, 16:00–18:00 |

Want me to text you the live tracking link?`;

export const DEMO_CHATS: Keen.ChatListItem[] = [
    { chatId: 'demo-chat-1', title: 'Where is order #1234?', agentId: 'order-assistant', createdAt: iso(35), updatedAt: iso(12) },
    { chatId: 'demo-chat-2', title: 'Return for a damaged lamp', agentId: 'returns-specialist', createdAt: iso(60 * 5), updatedAt: iso(60 * 4) },
    { chatId: 'demo-chat-3', title: 'Invoice for March', agentId: 'billing-helper', createdAt: iso(60 * 26), updatedAt: iso(60 * 25) },
    { chatId: 'demo-chat-4', title: 'Enterprise offer for Acme', agentId: 'offer-agent', createdAt: iso(60 * 24 * 3), updatedAt: iso(60 * 24 * 3) },
    { chatId: 'demo-chat-5', title: null, agentId: 'order-assistant', createdAt: iso(60 * 24 * 9), updatedAt: iso(60 * 24 * 9) },
    { chatId: 'demo-chat-6', title: 'Parental leave policy', agentId: 'hr-policy-guide', createdAt: iso(60 * 24 * 20), updatedAt: iso(60 * 24 * 20) }
];

/** History per chat — NEWEST FIRST, like the real history surface. */
export const DEMO_HISTORY: Record<string, Keen.ChatHistoryItem[]> = {
    'demo-chat-1': [
        {
            id: 'h1-2',
            prompt: 'Great — and can you check where order #1234 is right now?',
            response: TOOL_REPLY,
            responseType: 'text',
            agentId: 'order-assistant',
            createdAt: iso(12)
        },
        {
            id: 'h1-1',
            prompt: 'Hi! I placed an order last week and I have not heard anything since.',
            response: 'Hi Alex, sorry for the silence. I can check that for you right away.\n\nCould you share the **order number**? It starts with `#` and is in your confirmation email.',
            responseType: 'text',
            agentId: 'order-assistant',
            createdAt: iso(35)
        }
    ],
    'demo-chat-2': [
        {
            id: 'h2-1',
            prompt: 'The lamp from my last order arrived with a cracked shade. Can I return it?',
            response:
                "I'm sorry it arrived damaged. Yes, damaged items qualify for a **free return**:\n\n1. I generate a prepaid label and email it to you.\n2. Drop the parcel at any partner point within 14 days.\n3. The refund lands 3–5 business days after the first scan.\n\nShall I start the return?",
            responseType: 'text',
            agentId: 'returns-specialist',
            createdAt: iso(60 * 4)
        }
    ],
    'demo-chat-3': [
        {
            id: 'h3-1',
            prompt: 'Can you resend my invoice for March?',
            response: 'Pending... :: Canceled ::',
            responseType: 'text',
            agentId: 'billing-helper',
            createdAt: iso(60 * 25)
        }
    ],
    'demo-chat-4': [
        {
            id: 'h4-1',
            prompt: 'Prepare an enterprise offer for Acme, 250 seats.',
            response: 'The pricing service did not answer in time. Please try again in a moment.',
            responseType: 'error',
            agentId: 'offer-agent',
            createdAt: iso(60 * 24 * 3)
        }
    ]
};
