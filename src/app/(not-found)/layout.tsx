import type { ReactNode } from 'react';

/** Dedicated shell for the 404 area (nests inside the root layout). */
export default function Layout({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
