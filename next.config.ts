import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    /* config options here */
    reactCompiler: true,
    // You load the dev server from the LAN IP (so the browser Origin matches the
    // ORIGIN allow-listed on the api_key). Next only trusts localhost for its
    // /_next/* dev resources by default, which is why the HMR websocket upgrade
    // gets refused — whitelist the LAN host so Fast Refresh works over it too.
    allowedDevOrigins: ['192.168.68.120'],
    experimental: {}
};

export default nextConfig;
