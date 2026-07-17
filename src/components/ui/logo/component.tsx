import { Box, Text, HStack } from '@chakra-ui/react';

export const Component: React.FC = () => {
    return (
        <HStack w="40px" h="40px" bg="cyan.500" borderRadius="md" gap="0" justifyContent="center" alignItems="center">
            <Box width="50%" h="50%" borderRadius="1250px" bg="cyan.700" position="relative" left="10%"></Box>
            <Box width="50%" h="50%" borderRadius="1250px" bg="cyan.500" position="relative" right="10%" boxSizing="border-box" borderWidth="3px" borderColor="blue.50"></Box>
        </HStack>
    );
};

Component.displayName = 'Logo';
