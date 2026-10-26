/**
 * Date helpers for lists of conversations. Rendered on the server AND the
 * client, so anything built from `Date.now()` can differ by a tick between the
 * two — put `suppressHydrationWarning` on the element that shows it.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });

/** "just now", "12 min. ago", "yesterday", "3 days ago", or a date for older. */
export function formatRelative(iso: string, now: number = Date.now()): string {
    const diff = new Date(iso).getTime() - now;
    const abs = Math.abs(diff);

    if (abs < MINUTE) {
        return 'just now';
    }

    if (abs < HOUR) {
        return relative.format(Math.round(diff / MINUTE), 'minute');
    }

    if (abs < DAY) {
        return relative.format(Math.round(diff / HOUR), 'hour');
    }

    if (abs < 7 * DAY) {
        return relative.format(Math.round(diff / DAY), 'day');
    }

    return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

/** Seconds → "4s" / "1m 12s" — the run trace's "worked for" label. */
export function formatDuration(ms: number): string {
    const seconds = Math.max(0, Math.round(ms / 1000));

    if (seconds < 60) {
        return `${seconds}s`;
    }

    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

const BUCKETS = ['Today', 'Yesterday', 'Previous 7 days', 'Previous 30 days', 'Older'] as const;

/** Bucket items by how recently they changed — the sidebar's "Today / Yesterday / …". */
export function groupByRecency<T>(items: T[], getDate: (item: T) => string, now: number = Date.now()): { label: string; items: T[] }[] {
    const startOfToday = new Date(now).setHours(0, 0, 0, 0);

    const bucketOf = (iso: string) => {
        const time = new Date(iso).getTime();

        if (time >= startOfToday) {
            return 0;
        }

        if (time >= startOfToday - DAY) {
            return 1;
        }

        if (time >= startOfToday - 7 * DAY) {
            return 2;
        }

        if (time >= startOfToday - 30 * DAY) {
            return 3;
        }

        return 4;
    };

    return BUCKETS.map((label, index) => ({ label, items: items.filter(item => bucketOf(getDate(item)) === index) })).filter(group => group.items.length > 0);
}

/** "Good morning" / "Good afternoon" / "Good evening". */
export function greeting(now: Date = new Date()): string {
    const hour = now.getHours();

    if (hour < 12) {
        return 'Good morning';
    }

    return hour < 18 ? 'Good afternoon' : 'Good evening';
}
