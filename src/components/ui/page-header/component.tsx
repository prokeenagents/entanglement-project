import Link from 'next/link';
import { Box, Container, Flex, HStack, Heading, Text, type ContainerProps } from '@chakra-ui/react';
import { LuChevronRight } from 'react-icons/lu';

/** The standard content column for non-chat pages. */
export const PageContainer = ({ children, ...rest }: ContainerProps) => (
    <Container maxW="6xl" px={{ base: '4', md: '8' }} pt={{ base: '6', md: '10' }} pb={{ base: '16', md: '20' }} {...rest}>
        {children}
    </Container>
);

type Crumb = { label: string; href?: string };

export const Breadcrumbs = ({ items }: { items: Crumb[] }) => (
    <HStack as="nav" aria-label="Breadcrumb" gap="1.5" fontSize="sm" color="fg.muted" mb="4" wrap="wrap">
        {items.map((item, index) => (
            <HStack key={`${item.label}-${index}`} gap="1.5">
                {index > 0 && <LuChevronRight size={14} aria-hidden="true" />}
                {item.href ? (
                    <Link href={item.href}>
                        <Text as="span" _hover={{ color: 'fg' }} transition="color 0.15s ease">
                            {item.label}
                        </Text>
                    </Link>
                ) : (
                    <Text as="span" color="fg" fontWeight="500" aria-current="page">
                        {item.label}
                    </Text>
                )}
            </HStack>
        ))}
    </HStack>
);

type PageHeaderProps = {
    eyebrow?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    /** Buttons on the right (stack below the title on mobile). */
    actions?: React.ReactNode;
    /** Leading visual — an avatar or icon. */
    media?: React.ReactNode;
    breadcrumbs?: Crumb[];
};

export const Component = ({ eyebrow, title, description, actions, media, breadcrumbs }: PageHeaderProps) => (
    <Box mb={{ base: '8', md: '10' }} className="kn-fade">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <Flex direction={{ base: 'column', md: 'row' }} align={{ base: 'stretch', md: 'flex-end' }} justify="space-between" gap={{ base: '5', md: '8' }}>
            <HStack gap="4" align="center" minW="0">
                {media}
                <Box minW="0">
                    {eyebrow && (
                        <Text fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="0.14em" color="brand.fg" mb="2">
                            {eyebrow}
                        </Text>
                    )}
                    <Heading as="h1" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="700" letterSpacing="-0.03em" lineHeight="1.15">
                        {title}
                    </Heading>
                    {description && (
                        <Text color="fg.muted" mt="2" fontSize={{ base: 'sm', md: 'md' }} lineHeight="1.6" maxW="2xl">
                            {description}
                        </Text>
                    )}
                </Box>
            </HStack>
            {actions && (
                <HStack gap="2" flexShrink={0} wrap="wrap">
                    {actions}
                </HStack>
            )}
        </Flex>
    </Box>
);

Component.displayName = 'PageHeader';
