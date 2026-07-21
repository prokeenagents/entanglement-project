'use client';

import { useState } from 'react';
import { Button, HStack, Stack, Text, Textarea } from '@chakra-ui/react';

import { useChat } from '../chat-shell';

/**
 * The prompt box. Sends one turn per submit and clears.
 *
 * The Send gate is the SDK's canonical pair — connected AND not running. `running`
 * is not a local boolean: the SDK flips it the instant runFlow() starts and back
 * when it settles (success, throw, or cancel). It matters because a concurrent
 * runFlow is rejected outright with "TaskQueue already running" — one turn at a
 * time, per the protocol.
 */
export const Component: React.FC = () => {
    const { send, cancel, running, status } = useChat();
    const [prompt, setPrompt] = useState('');

    const connected = status === 'connected';
    const canSend = connected && !running && prompt.trim().length > 0;

    const submit = () => {
        if (!canSend) {
            return;
        }

        const next = prompt;
        setPrompt('');

        void send(next);
    };

    return (
        <Stack gap={2} w="full">
            <Textarea
                value={prompt}
                onChange={event => setPrompt(event.target.value)}
                // Enter sends, Shift+Enter makes a newline — the chat convention.
                onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        submit();
                    }
                }}
                placeholder={connected ? 'Message the agent…  (Enter to send, Shift+Enter for a newline)' : 'Connecting to the agent…'}
                disabled={!connected}
                autoresize
                maxH="40"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
            />

            <HStack justify="space-between">
                <Text fontSize="xs" color={connected ? 'fg.muted' : 'red.500'}>
                    {status}
                </Text>

                <HStack gap={2}>
                    {/* Only offered mid-run — the SDK's cancel is a no-op otherwise, and an
                        always-visible Cancel reads as "something to stop" when nothing is. */}
                    {running && (
                        <Button colorPalette="red" variant="outline" onClick={cancel}>
                            Cancel
                        </Button>
                    )}
                    <Button colorPalette="blue" onClick={submit} disabled={!canSend} loading={running} loadingText="Running">
                        Send
                    </Button>
                </HStack>
            </HStack>
        </Stack>
    );
};

Component.displayName = 'ChatPrompt';
