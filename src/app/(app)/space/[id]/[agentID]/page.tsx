import { getKeen } from '@/service/services/keen/keen';
import { Content } from './content';

export default async function Page({ params }: { params: Promise<{ id: string; agentID: string }> }) {
    const { id, agentID } = await params;

    const keen = getKeen();
    const consumerData = await keen.tools.getConsumerData();
    const chatListCall = consumerData.accessToken
        ? await keen.consumer.getChatList({
              accessToken: consumerData.accessToken || ''
          })
        : null;

    const chatList = chatListCall && chatListCall.success ? chatListCall.data.items : [];

    return <Content spaceID={id} agentID={agentID} chatList={chatList} />;
}
