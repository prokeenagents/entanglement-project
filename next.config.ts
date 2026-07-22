import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    /* config options here */
    reactCompiler: true,
    // You load the dev server from the LAN IP (so the browser Origin matches the
    // ORIGIN allow-listed on the api_key). Next only trusts localhost for its
    // /_next/* dev resources by default, which is why the HMR websocket upgrade
    // gets refused — whitelist the LAN host so Fast Refresh works over it too.
    // Also allow ngrok tunnels (used to expose /api/keen-webhook to the GCP sandbox).
    // The free subdomain rotates on every ngrok restart, so a wildcard means you never
    // edit this again. NOTE: this only matters when you load the APP through the ngrok
    // URL in a browser — the webhook API route itself is not gated by allowedDevOrigins.
    allowedDevOrigins: ['192.168.68.120', '*.ngrok-free.app'],
    experimental: {}
};

export default nextConfig;
