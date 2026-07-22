import { API_CONFIG } from '@/configs/api.config';
import { PAGE_CONFIG } from '@/configs/page.config';

import type { EventHandler } from './types';

/**
 * `logout` — force the browser to sign out (the account was removed org-side).
 *
 * Stops the poll loop first (nothing more to receive), then clears the session and
 * redirects — awaiting the logout POST BEFORE navigating so /login can't bounce back
 * on a still-present cookie. `router` + `stop` come from the events context, not
 * module scope.
 */
export const logout: EventHandler<App.Events.LogoutEvent> = async (event, { router, stop, userId }) => {
    // Only sign out the consumer this event targets. The bus already routes it to
    // the matching browser (keyed by consumer id), so this is a belt-and-suspenders
    // check on the payload — if it isn't us, ignore it.
    if (event.consumerId !== userId) {
        return;
    }

    stop();

    try {
        await fetch(API_CONFIG.LOGOUT.URL, { method: 'POST', cache: 'no-store' });
    } catch {
        // Leaving anyway — a failed logout call shouldn't strand the user here.
    }

    router.replace(PAGE_CONFIG.LOGIN.URL);
    router.refresh();
};
