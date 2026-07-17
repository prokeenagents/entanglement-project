export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // getKeen() creates the singleton and kicks off connect()'s retry loop
        // on first call (TLS bypass + fire-and-forget happen inside keen.ts).
        const { getKeen } = await import('@/service/services/keen/keen');

        getKeen();
    }
}
