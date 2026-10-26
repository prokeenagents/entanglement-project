export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // getKeen() creates the singleton and kicks off connect()'s retry loop
        // on first call (TLS bypass + fire-and-forget happen inside keen.ts).
        const { getKeen } = await import('@/service/services/keen/keen');

        try {
            getKeen();
        } catch (err) {
            // Next only LOGS an instrumentation error and keeps serving, so a deployed
            // instance without its Keen config would pass the health check while every
            // page fails. In production exit instead — Cloud Run then never routes to
            // it. Dev keeps running: demo mode needs no Keen config at all.
            if (process.env.NODE_ENV === 'production') {
                console.error(err);
                process.exit(1);
            }

            throw err;
        }
    }
}
