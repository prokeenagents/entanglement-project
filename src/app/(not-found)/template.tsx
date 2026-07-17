import type { ReactNode } from 'react';

/** Re-mounts on each navigation into the 404 area (unlike the layout). */
export default function Template({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
