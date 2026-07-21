import { HomeContent } from './content';

// Server Component: the keen connector + its cache are a server-only singleton
// (created in instrumentation.ts, populated over NATS), so read the space list
// HERE and pass it down. Making this a client component would lose access to
// getKeen() entirely — the connector never exists in the browser.
export default async function Home() {
    return (
        <>
            <HomeContent />
        </>
    );
}
