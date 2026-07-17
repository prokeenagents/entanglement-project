import { Container, Text } from '@chakra-ui/react';
import Content from './content';
import { checkPageAvailability } from '@/utils/auth';

export default function Page() {
    if (!checkPageAvailability()) {
        return (
            <Container maxW="3xl" py={20}>
                <Text>We are a little busy at the moment</Text>
            </Container>
        );
    }

    return <Content />;
}
