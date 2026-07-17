import { Button, Container, Text } from '@chakra-ui/react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { checkPageAvailability } from '@/utils/auth';
import { getKeen } from '@/service/services/keen/keen';
import { PAGE_CONFIG } from '@/configs/page.config';

const INVALID_OR_EXPIRED = 'This password reset link is invalid or has expired. Please request a new one.';

/**
 * Server-safe error panel + a link back to login. Uses next/link (NOT useRouter,
 * which is client-only) so it renders inside this async SERVER component.
 */
function ErrorPanel({ message }: { message: string }) {
    return (
        <Container maxW="3xl" py={20}>
            <Text mb={4}>{message}</Text>
            <Button asChild variant="plain">
                <Link href={PAGE_CONFIG.LOGIN.URL}>Go Back</Link>
            </Button>
        </Container>
    );
}

/**
 * The reset link Keen emailed lands here as /set-password/<hash>. SERVER component,
 * so it does the whole thing on this side through the connector (which holds the
 * tenant secret) — no fetch, no client round-trip, no sensitive field ever leaving:
 *
 *   1. Open the sealed hash (validates it + lifts the callbackSecret).
 *   2. Redeem it — Keen applies the password argon-hashed in at claim time.
 *   3. Success → redirect to login. Any failure → the neutral invalid/expired page.
 *
 * `params` is a Promise in this Next, hence async + await. NOTE: this redeems on
 * GET (page load), so an email client that PREFETCHES the link would consume the
 * single-use grant before the user clicks. Acceptable here; if it bites, move the
 * redeem behind a confirm button (client POST to /api/set-password).
 */
export default async function Page({ params }: { params: Promise<{ hash: string }> }) {
    if (!checkPageAvailability()) {
        return <ErrorPanel message="We are a little busy at the moment" />;
    }

    const { hash } = await params;

    const keen = getKeen();

    // Open + validate. null = bad key / tamper / wrong shape; expireIn is a ms
    // deadline baked in at claim time.
    const payload = keen.tools.getResetPasswordHashPayload(hash);

    if (!payload || payload.expireIn < new Date().getTime()) {
        return <ErrorPanel message={INVALID_OR_EXPIRED} />;
    }

    // Redeem SERVER-SIDE with the callbackSecret lifted from the hash. redirect()
    // throws NEXT_REDIRECT to navigate, so it MUST stay outside any try/catch.
    const redeem = await keen.external.resetPasswordRedeem({ hash, callbackSecret: payload.callbackSecret });

    if (redeem && (redeem as { success?: boolean }).success === true) {
        // ?reset=success is a one-time flash: the login page reads it, shows
        // "password reset", then strips it from the URL. A header wouldn't survive
        // the redirect (the browser doesn't resend it on the follow-up request).
        redirect(`${PAGE_CONFIG.LOGIN.URL}?reset=success`);
    }

    return <ErrorPanel message={INVALID_OR_EXPIRED} />;
}
