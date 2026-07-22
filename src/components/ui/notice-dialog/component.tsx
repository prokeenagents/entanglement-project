'use client';

import { Button, CloseButton, Dialog, Portal, Text } from '@chakra-ui/react';

/**
 * A blocking notice — title, optional detail, one OK button and an X.
 *
 * DELIBERATELY hard to dismiss by accident: `closeOnInteractOutside` and
 * `closeOnEscape` are both off, so a stray click on the backdrop or a reflexive
 * Escape does nothing. The only two ways out are the X and OK. That is the point —
 * it announces something that happened server-side, and the user should register it
 * rather than swipe it away without reading.
 *
 * `role="alertdialog"` (not the default `dialog`) so screen readers announce it as
 * an interruption and focus lands inside it.
 */
export const Component: React.FC<{
    open: boolean;
    title: string;
    message?: string;
    onClose: () => void;
}> = props => {
    const { open, title, message, onClose } = props;

    return (
        <Dialog.Root
            open={open}
            onOpenChange={details => {
                // Fires for the X (Dialog.CloseTrigger). The two dismissal routes we
                // turned off can never reach here.
                if (!details.open) {
                    onClose();
                }
            }}
            role="alertdialog"
            placement="center"
            closeOnInteractOutside={false}
            closeOnEscape={false}
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content>
                        <Dialog.Header>
                            <Dialog.Title>{title}</Dialog.Title>
                        </Dialog.Header>

                        {message && (
                            <Dialog.Body>
                                <Text>{message}</Text>
                            </Dialog.Body>
                        )}

                        <Dialog.Footer>
                            <Button onClick={onClose}>OK</Button>
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

Component.displayName = 'NoticeDialog';
