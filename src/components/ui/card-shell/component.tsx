import { Card, HStack, Separator, VStack } from '@chakra-ui/react';

export const Component: React.FC<
    React.PropsWithChildren<{
        title?: string;
        description?: string;
    }>
> = props => {
    const { children, title, description } = props;

    return (
        <Card.Root maxW="md" variant="elevated">
            {(title || description) && (
                <>
                    <Card.Header mb="4">
                        <HStack gap="1" justifyContent="space-between">
                            <VStack alignItems="flex-start" gap="0">
                                {title && <Card.Title>{title}</Card.Title>}
                                {description && <Card.Description>{description}</Card.Description>}
                            </VStack>
                        </HStack>
                    </Card.Header>
                    <Separator />
                </>
            )}

            <Card.Body>{children}</Card.Body>
        </Card.Root>
    );
};

Component.displayName = 'Footer';
