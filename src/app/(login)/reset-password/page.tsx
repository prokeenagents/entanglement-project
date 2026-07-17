import { Text } from '@chakra-ui/react';
import Content from './content';
import { checkPageAvailability } from '@/utils/auth';
import { PageShell } from '@/components/ui/page-shell';

export default function Page() {
    const pageAvailable = checkPageAvailability();

    if (pageAvailable) {
        return (
            <PageShell>
                <Content />
            </PageShell>
        );
    }

    return (
        <PageShell>
            <Text>We are a little busy at the moment</Text>
        </PageShell>
    );
}
