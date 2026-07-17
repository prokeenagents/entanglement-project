import { Button, Container, Text } from '@chakra-ui/react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { checkPageAvailability } from '@/utils/auth';
import { getKeen } from '@/service/services/keen/keen';
import { PAGE_CONFIG } from '@/configs/page.config';

const INVALID_OR_EXPIRED = 'This registration link is invalid or has expired. Please register again.';

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
 * The verification link Keen emailed lands here as /confirmation/<hash>. Same shape
 * as /set-password — a SERVER component that does the whole thing through the
 * connector (which holds the tenant secret), just hitting the REGISTRATION endpoint:
 *
 *   1. Open the sealed registration hash (validates it + lifts the callbackSecret).
 *   2. Redeem it — Keen creates the account from the details baked in at claim time.
 *   3. Success → redirect to login. Any failure → the neutral invalid/expired page.
 *
 * `params` is a Promise in this Next, hence async + await. NOTE: this redeems on
 * GET (page load), so an email client that PREFETCHES the link would consume the
 * single-use grant before the user clicks. Acceptable here; if it bites, move the
 * redeem behind a confirm button (client POST to a /api/confirmation route).
 */
export default async function Page({ params }: { params: Promise<{ hash: string }> }) {
    if (!checkPageAvailability()) {
        return <ErrorPanel message="We are a little busy at the moment" />;
    }

    const { hash } = await params;

    const keen = getKeen();

    // Open + validate. null = bad key / tamper / wrong shape; expireIn is a ms
    // deadline baked in at claim time.
    const payload = keen.tools.getRegistrationHashPayload(hash);

    if (!payload || payload.expireIn < new Date().getTime()) {
        return <ErrorPanel message={INVALID_OR_EXPIRED} />;
    }

    // Redeem SERVER-SIDE with the callbackSecret lifted from the hash. redirect()
    // throws NEXT_REDIRECT to navigate, so it MUST stay outside any try/catch.
    const redeem = await keen.external.registrationRedeem({ hash, callbackSecret: payload.callbackSecret });

    if (redeem && (redeem as { success?: boolean }).success === true) {
        // ?registration=success is a one-time flash — the login page shows
        // "account created" then strips it from the URL.
        redirect(`${PAGE_CONFIG.LOGIN.URL}?registration=success`);
    }

    return <ErrorPanel message={INVALID_OR_EXPIRED} />;
}
