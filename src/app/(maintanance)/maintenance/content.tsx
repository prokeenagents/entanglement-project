'use client';

import { StatusCard } from '@/components/ui/status-card';

/** Shown while the Keen connection isn't ready (see proxy/page/*). */
export default function Content() {
    return (
        <StatusCard tone="maintenance" title="We'll be right back" message="The service is starting up or under maintenance. This usually takes less than a minute." actionLabel="Try again" reload />
    );
}
