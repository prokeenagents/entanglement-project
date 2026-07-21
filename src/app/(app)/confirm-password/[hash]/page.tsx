import { Button, Container, Text } from '@chakra-ui/react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getKeen } from '@/service/services/keen/keen';
import { getAccessToken } from '@/utils/cookies';

const INVALID = 'This password-change link is invalid or has expired. Start again from your account page.';

function Panel({ message, children }: { message: string; children: React.ReactNode }) {
    return (
        <Container maxW="3xl" py={20}>
            <Text mb={4}>{message}</Text>
            {children}
        </Container>
    );
}

/**
 * The confirm link Keen emailed for a LOGGED-IN password change lands here as
 * /confirm-password/<hash>. SERVER component — it opens the sealed hash and redeems
 * through the connector (two-token: the session cookie + the app token), so nothing
 * sensitive ever touches the client.
 *
 * The redeem needs the live login (X-Access-Token), so a signed-out visitor is sent
 * to /login first. It redeems on GET (page load) like /set-password; an email client
 * that PREFETCHES the link would burn the single-use grant early — acceptable here
 * (move behind a confirm button if it bites).
 */
export default async function Page({ params }: { params: Promise<{ hash: string }> }) {
    const { hash } = await params;
    const accessToken = await getAccessToken();

    // redirect() throws NEXT_REDIRECT to navigate — keep it out of any try/catch.
    if (!accessToken) {
        redirect('/login');
    }

    const keen = getKeen();

    // Open + validate. null = bad key / tamper / wrong shape; expireIn is a ms deadline.
    const payload = keen.tools.getResetPasswordHashPayload(hash);

    if (!payload || payload.expireIn < new Date().getTime()) {
        return (
            <Panel message={INVALID}>
                <Button asChild variant="plain">
                    <Link href="/user">Back to account</Link>
                </Button>
            </Panel>
        );
    }

    const redeem = await keen.consumer.resetPasswordRedeem({ accessToken, hash, callbackSecret: payload.callbackSecret });

    if (redeem && (redeem as { success?: boolean }).success === true) {
        return (
            <Panel message="Your password has been changed.">
                <Button asChild>
                    <Link href="/user">Back to account</Link>
                </Button>
            </Panel>
        );
    }

    return (
        <Panel message={INVALID}>
            <Button asChild variant="plain">
                <Link href="/user">Back to account</Link>
            </Button>
        </Panel>
    );
}
