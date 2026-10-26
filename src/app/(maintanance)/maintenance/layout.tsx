import { Suspense } from 'react';
import { GuestLayout } from '@/components/ui/guest-layout';

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

    return <GuestLayout>{children}</GuestLayout>;
}
