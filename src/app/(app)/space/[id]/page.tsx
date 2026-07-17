import { Content } from './content';

// Server Component: the keen connector + its cache are a server-only singleton
// (created in instrumentation.ts, populated over NATS), so read the space list
// HERE and pass it down. Making this a client component would lose access to
// getKeen() entirely — the connector never exists in the browser.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    return <Content spaceID={id} />;
}
