import { getKeen } from '@/service/services/keen/keen';
import KeenConnector from '@/service/services/keen/keen.connector';
import { AuthProvider } from '@/contexts/auth';
import { ConsumerProvider } from '@/contexts/consumer';
import { EventsProvider } from '@/contexts/events';
import { Suspense } from 'react';
import { Header } from '@/components/ui/header';
import { Footer } from '@/components/ui/footer';
import { ContentUI } from '@/components/ui/content';
import { PageShell } from '@/components/ui/page-shell';

export default function Layout(props: Readonly<Readonly<React.PropsWithChildren>>) {
    const { children } = props;
    const keen = getKeen();

    return (
        <Suspense fallback={null}>
            <ProviderShell keen={keen}>
                <PageShell>
                    <Header />
                    <ContentUI>{children}</ContentUI>
                    <Footer />
                </PageShell>
            </ProviderShell>
        </Suspense>
    );
}

async function ProviderShell(
    props: Readonly<
        Readonly<
            React.PropsWithChildren<{
                keen: KeenConnector;
            }>
        >
    >
) {
    const { children, keen } = props;
    const consumerData = await keen.tools.getConsumerData();

    // AuthProvider owns the mutable IDENTITY (the token payload); ConsumerProvider
    // owns the spaces / agents / chat; EventsProvider is the long-poll RECEIVER
    // (server→client push, e.g. force-logout). All seed from the one server fetch.
    return (
        <AuthProvider value={consumerData.tokenPayload}>
            <ConsumerProvider value={consumerData}>
                <EventsProvider>{children}</EventsProvider>
            </ConsumerProvider>
        </AuthProvider>
    );
}
