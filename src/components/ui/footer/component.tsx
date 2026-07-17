import { HStack, Text } from '@chakra-ui/react';

export const Component: React.FC = () => {
    const year = new Date().getFullYear();

    return (
        <HStack w="full" h="30px" bg="white" position="fixed" bottom="0" left="0" shadow="sm" justifyContent="center" zIndex="docked">
            <Text fontSize="sm">
                {year} ® Empowered by <strong>KeenAgents</strong>
            </Text>
        </HStack>
    );
};

Component.displayName = 'Footer';
