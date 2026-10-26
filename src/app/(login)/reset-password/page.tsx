import Content from './content';
import { checkPageAvailability } from '@/utils/auth';
import { StatusCard } from '@/components/ui/status-card';

// checkPageAvailability() reads the live Keen connector — never prerender this page.
export const dynamic = 'force-dynamic';

// The (login) layout already provides the guest shell — render only the card here.
export default function Page() {
    if (!checkPageAvailability()) {
        return <StatusCard tone="maintenance" title="We're a little busy" message="Password reset is temporarily unavailable. Please try again in a moment." actionLabel="Try again" reload />;
    }

    return <Content />;
}
