import { Content } from './content';

export default async function Page({ params }: { params: Promise<{ id: string; agentID: string }> }) {
    const { id, agentID } = await params;

    return <Content spaceID={id} agentID={agentID} />;
}
