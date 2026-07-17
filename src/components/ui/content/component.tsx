import { HStack } from '@chakra-ui/react';

export const Component: React.FC<React.PropsWithChildren> = props => {
    const { children } = props;
    return (
        <HStack w="full" overflowY="auto">
            {children}
        </HStack>
    );
};

Component.displayName = 'ContentUI';
