import { ContentUI } from '@/components/ui/content';
import { Footer } from '@/components/ui/footer';
import { PageShell } from '@/components/ui/page-shell';
import { Suspense } from 'react';

export default function Layout(props: Readonly<Readonly<React.PropsWithChildren>>) {
    const { children } = props;

    return (
        <Suspense fallback={null}>
            <ProviderShell>{children}</ProviderShell>
        </Suspense>
    );
}

async function ProviderShell(props: Readonly<Readonly<React.PropsWithChildren>>) {
    const { children } = props;

    return (
        <PageShell>
            <ContentUI>{children}</ContentUI>
            <Footer />
        </PageShell>
    );
}
