import { Flex, type FlexProps } from '@chakra-ui/react';

/** Centers a guest screen's content (the auth card) in the remaining height. */
export const Component: React.FC<React.PropsWithChildren<FlexProps>> = props => {
    const { children, ...rest } = props;

    return (
        <Flex flex="1" w="full" direction="column" align="center" justify="center" px="4" py={{ base: '8', md: '12' }} {...rest}>
            {children}
        </Flex>
    );
};

Component.displayName = 'ContentUI';
