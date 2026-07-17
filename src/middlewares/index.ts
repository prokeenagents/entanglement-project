import { NextRequest, NextResponse } from 'next/server';
import { middleware as HeaderMiddleware } from './headers.middleware';

export async function stepMiddleware(request: NextRequest, middlewares: Array<(props: App.MiddlewareProps) => Promise<false | NextResponse<unknown>>>) {
    const collector: Record<string, string> = {};
    const { pathname, searchParams } = request.nextUrl;

    for (const middleware of middlewares) {
        const response = await middleware({
            request,
            collector,
            pathname,
            searchParams
        });

        if (!response) {
            continue;
        }

        /**
         * headers
         */
        HeaderMiddleware(request, response, collector);

        return response;
    }
}
