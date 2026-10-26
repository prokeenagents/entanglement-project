'use client';

import { Toaster as ChakraToaster, Portal, Spinner, Stack, Toast, createToaster } from '@chakra-ui/react';

/**
 * App-wide toasts. Fire from anywhere with
 *   toaster.create({ type: 'error', title: 'Could not rename the chat.' })
 * <Toaster /> is mounted once in the (app) layout.
 */
export const toaster = createToaster({
    placement: 'bottom-end',
    pauseOnPageIdle: true,
    max: 3
});

export const Toaster = () => (
    <Portal>
        <ChakraToaster toaster={toaster} insetInline={{ mdDown: '4' }}>
            {toast => (
                <Toast.Root width={{ md: 'sm' }} borderRadius="card" boxShadow="pop">
                    {toast.type === 'loading' ? <Spinner size="sm" color="brand.solid" /> : <Toast.Indicator />}
                    <Stack gap="1" flex="1" maxWidth="100%">
                        {toast.title && <Toast.Title>{toast.title}</Toast.Title>}
                        {toast.description && <Toast.Description>{toast.description}</Toast.Description>}
                    </Stack>
                    {toast.action && <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>}
                    {toast.closable && <Toast.CloseTrigger />}
                </Toast.Root>
            )}
        </ChakraToaster>
    </Portal>
);
