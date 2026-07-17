import { Container, Text } from '@chakra-ui/react';
import Content from './content';
import { checkPageAvailability } from '@/utils/auth';

/**
 * `searchParams` is a Promise in this Next. We read the one-time success flags the
 * set-password (`?reset=success`) and confirmation (`?registration=success`) redeems
 * set on their redirects, and hand them to Content — which shows the matching
 * message then strips the param from the URL.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ reset?: string; registration?: string }> }) {
    if (!checkPageAvailability()) {
        return (
            <Container>
                <Text>We are a little busy at the moment</Text>
            </Container>
        );
    }

    const { reset, registration } = await searchParams;

    return <Content resetSuccess={reset === 'success'} registrationSuccess={registration === 'success'} />;
}
