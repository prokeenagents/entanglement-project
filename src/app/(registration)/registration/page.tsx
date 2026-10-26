import { StatusCard } from '@/components/ui/status-card';
import Content from './content';
import { checkPageAvailability } from '@/utils/auth';

// checkPageAvailability() reads the live Keen connector — never prerender this page.
export const dynamic = 'force-dynamic';

export default function Page() {
    if (!checkPageAvailability()) {
        return <StatusCard tone="maintenance" title="We're a little busy" message="Sign-up is temporarily unavailable. Please try again in a moment." actionLabel="Try again" reload />;
    }

    return <Content />;
}
