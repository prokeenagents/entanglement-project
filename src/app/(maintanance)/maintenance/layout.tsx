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

    return <>{children}</>;
}
