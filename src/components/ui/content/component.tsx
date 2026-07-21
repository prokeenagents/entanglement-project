import { HStack } from '@chakra-ui/react';
import { StackProps } from '@chakra-ui/react';

export const Component: React.FC<React.PropsWithChildren<StackProps>> = props => {
    const { children, ...rest } = props;
    return (
        <HStack w="full" overflowY="auto" {...rest}>
            {children}
        </HStack>
    );
};

Component.displayName = 'ContentUI';
