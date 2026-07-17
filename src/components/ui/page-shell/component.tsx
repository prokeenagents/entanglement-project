import { VStack } from '@chakra-ui/react';

export const Component: React.FC<React.PropsWithChildren> = props => {
    const { children } = props;
    return (
        <VStack w="full" bg={{ base: 'gray.100', _dark: 'gray.900' }} minH="dvh">
            {children}
        </VStack>
    );
};

Component.displayName = 'Header';
