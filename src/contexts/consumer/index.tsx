'use client';

import { createContext, useContext } from 'react';

/**
 * Client-side access to the signed-in consumer's snapshot.
 *
 * The data is produced on the SERVER by `keen.tools.getConsumerData()` (httpOnly
 * cookies + the server-only keen cache) inside `(app)/layout.tsx`, then handed to
 * this provider as a serializable prop. Client components read it with
 * `useConsumer()` — no server call, no re-fetch.
 *
 * SECURITY: whatever is put in `value` is serialized into the client bundle. The
 * `accessToken` / `refreshToken` on `Keen.ConsumerData` are httpOnly cookies —
 * only include them here if the browser genuinely needs them (it usually does
 * not; server routes read the cookies directly). Prefer stripping them in the
 * layout and providing only `consumerSpaces` / `agents` / `tokenPayload`.
 */
const ConsumerContext = createContext<Keen.ConsumerData | null>(null);

export function ConsumerProvider({ value, children }: { value: Keen.ConsumerData; children: React.ReactNode }) {
    return <ConsumerContext.Provider value={value}>{children}</ConsumerContext.Provider>;
}

/**
 * Read the consumer snapshot. Throws if used outside a <ConsumerProvider>, so a
 * missing provider is a loud dev-time error rather than a silent null.
 */
export function useConsumer(): Keen.ConsumerData {
    const ctx = useContext(ConsumerContext);
    if (ctx === null) {
        throw new Error('useConsumer must be used within a <ConsumerProvider>');
    }
    return ctx;
}
