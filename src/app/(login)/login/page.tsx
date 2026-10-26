import { StatusCard } from '@/components/ui/status-card';
import Content from './content';
import { checkPageAvailability } from '@/utils/auth';

// checkPageAvailability() reads the live Keen connector — never prerender this page.
export const dynamic = 'force-dynamic';

/**
 * `searchParams` is a Promise in this Next. We read the one-time success flags the
 * set-password (`?reset=success`) and confirmation (`?registration=success`) redeems
 * set on their redirects, and hand them to Content — which shows the matching
 * message then strips the param from the URL.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ reset?: string; registration?: string }> }) {
    if (!checkPageAvailability()) {
        return <StatusCard tone="maintenance" title="We're a little busy" message="Sign-in is temporarily unavailable. Please try again in a moment." actionLabel="Try again" reload />;
    }

    const { reset, registration } = await searchParams;

    return <Content resetSuccess={reset === 'success'} registrationSuccess={registration === 'success'} />;
}
