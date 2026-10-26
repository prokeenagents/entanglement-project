import { getKeen } from '@/service/services/keen/keen';
import KeenConnector from '@/service/services/keen/keen.connector';
import { AuthProvider } from '@/contexts/auth';
import { ChatListProvider } from '@/contexts/chat-list';
import { ConsumerProvider } from '@/contexts/consumer';
import { EventsProvider } from '@/contexts/events';
import { NoticeProvider } from '@/contexts/notice';
import { Suspense } from 'react';
import { AppShell } from '@/components/ui/app-shell';
import { Toaster } from '@/components/ui/toaster';
import { DEMO_CHATS } from '@/demo/fixtures';

// Every page under (app) is per-consumer and reads the Keen connector, so it is
// never prerendered at build time: the build has no Keen config (on Cloud Run the
// secrets arrive from Secret Manager only when an instance starts) and must never
// open a connection to Keen from the build workers.
export const dynamic = 'force-dynamic';

export default function Layout(props: Readonly<Readonly<React.PropsWithChildren>>) {
    const { children } = props;
    const keen = getKeen();

    return (
        <Suspense fallback={null}>
            <ProviderShell keen={keen}>
                <AppShell>{children}</AppShell>
                <Toaster />
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
    const chatList = await readChatList(keen, consumerData);

    // AuthProvider owns the mutable IDENTITY (the token payload); ConsumerProvider
    // owns the spaces / agents / chat; ChatListProvider the conversation list the
    // sidebar + pages share; EventsProvider is the long-poll RECEIVER (server→client
    // push, e.g. force-logout). All seed from the server fetches above.
    //
    // NoticeProvider sits ABOVE EventsProvider on purpose: the events loop hands
    // `notice.show` to every handler, so the dialog must already be mounted.
    return (
        <AuthProvider value={consumerData.tokenPayload}>
            <ConsumerProvider value={consumerData}>
                <ChatListProvider initial={chatList}>
                    <NoticeProvider>
                        <EventsProvider>{children}</EventsProvider>
                    </NoticeProvider>
                </ChatListProvider>
            </ConsumerProvider>
        </AuthProvider>
    );
}

/**
 * The consumer's conversations, read here (two-token call — server only) so the
 * sidebar paints with them. A failure degrades to an empty list; the client
 * re-reads on the next turn anyway.
 */
async function readChatList(keen: KeenConnector, consumerData: Keen.ConsumerData): Promise<Keen.ChatListItem[]> {
    if (consumerData.demo) {
        return DEMO_CHATS;
    }

    if (!consumerData.accessToken) {
        return [];
    }

    const reply = await keen.consumer.getChatList({ accessToken: consumerData.accessToken });

    return reply && reply.success ? reply.data.items : [];
}
