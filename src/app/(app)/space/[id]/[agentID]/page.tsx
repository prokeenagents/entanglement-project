import { Content } from './content';

// The conversation list comes from ChatListProvider (seeded server-side in the
// (app) layout), so this page only needs its route params.
export default async function Page({ params }: { params: Promise<{ id: string; agentID: string }> }) {
    const { id, agentID } = await params;

    return <Content spaceID={id} agentID={agentID} />;
}
