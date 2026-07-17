import { NextRequest } from 'next/server';

export {};

declare global {
    /**
     * ================= PAYLOADS =============================
     */

    namespace App {
        interface MiddlewareProps {
            request: NextRequest;
            collector: Record<string, string>;
            pathname: string;
            searchParams: URLSearchParams;
        }
    }
}
