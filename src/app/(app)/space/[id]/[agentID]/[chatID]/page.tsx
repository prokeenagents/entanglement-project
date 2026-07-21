import { getKeen } from '@/service/services/keen/keen';
import { Content } from './content';

export default async function Page({ params }: { params: Promise<{ id: string; agentID: string; chatID: string }> }) {
    const { id, agentID, chatID } = await params;

    const keen = getKeen();
    const consumerData = await keen.tools.getConsumerData();

    return <Content spaceID={id} agentID={agentID} chatID={chatID} consumerData={consumerData} />;
}
