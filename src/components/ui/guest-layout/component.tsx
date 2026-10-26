import { ContentUI } from '../content';
import { Footer } from '../footer';
import { PageShell } from '../page-shell';

/** Hex atmosphere + centered content + credit bar — every guest screen's frame. */
export const Component = ({ children }: React.PropsWithChildren) => (
    <PageShell>
        <ContentUI>{children}</ContentUI>
        <Footer />
    </PageShell>
);

Component.displayName = 'GuestLayout';
