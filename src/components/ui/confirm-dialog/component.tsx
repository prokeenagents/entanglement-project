'use client';

import { Button, CloseButton, Dialog, Portal, Text } from '@chakra-ui/react';

type ConfirmDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: React.ReactNode;
    confirmLabel?: string;
    /** Red confirm button — for deletes and other irreversible actions. */
    destructive?: boolean;
    loading?: boolean;
    onConfirm: () => void;
};

/** A focused yes / no question. Used before anything that can't be undone. */
export const Component = (props: ConfirmDialogProps) => {
    const { open, onOpenChange, title, description, confirmLabel = 'Confirm', destructive, loading, onConfirm } = props;

    return (
        <Dialog.Root open={open} onOpenChange={details => onOpenChange(details.open)} role="alertdialog" placement="center" motionPreset="slide-in-bottom">
            <Portal>
                <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
                <Dialog.Positioner px="4">
                    <Dialog.Content bg="bg.panel" borderWidth="1px" borderColor="border" borderRadius="panel" boxShadow="pop" maxW="420px">
                        <Dialog.Header pb="2">
                            <Dialog.Title fontSize="lg" fontWeight="700" letterSpacing="-0.01em">
                                {title}
                            </Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <Text color="fg.muted" fontSize="sm" lineHeight="1.6">
                                {description}
                            </Text>
                        </Dialog.Body>
                        <Dialog.Footer gap="2">
                            <Dialog.ActionTrigger asChild>
                                <Button variant="ghost" disabled={loading}>
                                    Cancel
                                </Button>
                            </Dialog.ActionTrigger>
                            <Button colorPalette={destructive ? 'red' : 'brand'} loading={loading} onClick={onConfirm}>
                                {confirmLabel}
                            </Button>
                        </Dialog.Footer>
                        <Dialog.CloseTrigger asChild>
                            <CloseButton size="sm" />
                        </Dialog.CloseTrigger>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
};

Component.displayName = 'ConfirmDialog';
