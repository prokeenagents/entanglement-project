'use client';

import { Center, Heading, Stack, Text, type StackProps } from '@chakra-ui/react';

type EmptyStateProps = StackProps & {
    icon: React.ReactNode;
    title: string;
    description?: React.ReactNode;
    action?: React.ReactNode;
};

/** Nothing here yet — say why, and offer the next step. */
export const Component = ({ icon, title, description, action, ...rest }: EmptyStateProps) => (
    <Stack align="center" textAlign="center" gap="3" py="14" px="6" borderWidth="1px" borderStyle="dashed" borderColor="border.emphasized" borderRadius="card" bg="bg.subtle" {...rest}>
        <Center w="12" h="12" borderRadius="control" bg="brand.subtle" color="brand.fg" borderWidth="1px" borderColor="brand.border" mb="1">
            {icon}
        </Center>
        <Heading as="h3" fontSize="md" fontWeight="600">
            {title}
        </Heading>
        {description && (
            <Text color="fg.muted" fontSize="sm" maxW="sm" lineHeight="1.6">
                {description}
            </Text>
        )}
        {action && <Stack pt="2">{action}</Stack>}
    </Stack>
);

Component.displayName = 'EmptyState';
