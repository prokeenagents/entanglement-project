/**
 * What of a Keen reply may reach the browser.
 *
 * Keen's error envelopes sometimes carry raw internals: a refused registration
 * redeem answered with the whole "Invalid `prisma.consumer.create()` invocation …
 * Unique constraint failed on the fields: (`email`,`consumer_contract`)" text.
 * Route handlers pass every upstream message through `publicMessage`, so a user
 * sees Keen's text only when it is a short, plain sentence, and the route's own
 * fallback otherwise. The full reply stays server-side.
 */

const INTERNAL_DETAIL = /prisma|invocation|constraint|exception|stack|\bsql\b|econn|enotfound|\bat \S+ \(|\.(ts|js):\d|[\r\n]/i;
const MAX_MESSAGE_LENGTH = 160;

/** Keen's message (a string, or the error shape's string[]) if fit to show a user, else `fallback`. */
export function publicMessage(raw: unknown, fallback: string): string {
    const text = Array.isArray(raw) ? raw.filter((part): part is string => typeof part === 'string').join(', ') : raw;

    if (typeof text !== 'string' || !text.trim() || text.length > MAX_MESSAGE_LENGTH || INTERNAL_DETAIL.test(text)) {
        return fallback;
    }

    return text.trim();
}

/** Keen's create fails on the (email, contract) unique key when the account already exists. */
export function isDuplicateAccount(reply: unknown): boolean {
    const detail = JSON.stringify(reply ?? '');
    return /unique constraint/i.test(detail) && /email/i.test(detail);
}

type UpstreamReply = { success?: unknown; status?: unknown; statusCode?: unknown; message?: unknown; error?: unknown };

/** The reply's status code: `status`, else `statusCode`, else 200/400 from `success`. */
export function upstreamStatus(reply: unknown): number {
    const { success, status, statusCode } = (reply ?? {}) as UpstreamReply;

    if (typeof status === 'number') {
        return status;
    }

    return typeof statusCode === 'number' ? statusCode : success === true ? 200 : 400;
}

/** The `{ success, status, message }` envelope the browser gets for a Keen reply. */
export function clientEnvelope(reply: unknown, fallback: string): { success: boolean; status: number; message: string } {
    const { success, message, error } = (reply ?? {}) as UpstreamReply;

    return { success: success === true, status: upstreamStatus(reply), message: publicMessage(message ?? error, fallback) };
}

/**
 * For pass-through routes (chat, profile): a successful reply goes out as-is — it
 * is the consumer's own data — and a failed one is reduced to a safe envelope.
 */
export function clientReply<T>(reply: T, fallback: string = 'The request could not be completed.'): T | { success: false; status: number; message: string } {
    if ((reply as UpstreamReply | null)?.success === true) {
        return reply;
    }

    return { ...clientEnvelope(reply, fallback), success: false };
}
