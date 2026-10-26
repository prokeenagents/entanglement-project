'use client';

import { useCallback, useRef, useState } from 'react';
import { Box, HStack, IconButton, Text, Textarea } from '@chakra-ui/react';
import { LuArrowUp, LuSquare } from 'react-icons/lu';

import { Tooltip } from '@/components/ui/tooltip';
import { useChat } from '../chat-shell';
import type { DictationLanguage, DictationState } from '@/hooks/dictation';
import { DICTATION_LANGUAGES, Dictation } from './dictation';

const STATUS: Record<App.Chat.ConnectStatus, { label: string; color: string }> = {
    connected: { label: 'Connected', color: 'green.500' },
    connecting: { label: 'Connecting…', color: 'orange.400' },
    disconnected: { label: 'Disconnected', color: 'fg.subtle' },
    unauthorized: { label: 'Session expired — sign in again', color: 'red.500' }
};

/**
 * The composer — a frosted panel that sends one turn per submit and clears.
 *
 * The Send gate is the SDK's canonical pair — connected AND not running. `running`
 * is not a local boolean: the SDK flips it the instant runFlow() starts and back
 * when it settles (success, throw, or cancel). It matters because a concurrent
 * runFlow is rejected outright with "TaskQueue already running" — one turn at a
 * time, per the protocol. You CAN keep typing while a turn runs; the send button
 * turns into Stop until it settles.
 */
export const Component = ({ agentName }: { agentName?: string }) => {
    const { send, cancel, running, status } = useChat();
    const [prompt, setPrompt] = useState('');
    const field = useRef<HTMLTextAreaElement>(null);
    const [dictating, setDictating] = useState<{ state: DictationState; language: DictationLanguage }>({ state: 'idle', language: 'en' });
    const onDictationChange = useCallback((state: DictationState, language: DictationLanguage) => setDictating({ state, language }), []);

    /**
     * Dictated text drops into the message box — joined to whatever is already
     * typed — as a preview to read, edit and send. It is never sent on its own.
     * The caret goes to the end, ready to keep typing or dictate the next bit.
     */
    const addDictation = (text: string) => {
        setPrompt(current => (current.trim() ? `${current.trimEnd()} ${text}` : text));

        requestAnimationFrame(() => {
            const el = field.current;

            if (el) {
                el.focus();
                el.setSelectionRange(el.value.length, el.value.length);
            }
        });
    };

    const connected = status === 'connected';
    const canSend = connected && !running && prompt.trim().length > 0;
    const state = STATUS[status];

    const submit = () => {
        if (!canSend) {
            return;
        }

        const next = prompt;
        setPrompt('');

        void send(next);
    };

    return (
        <Box>
            <Box
                borderWidth="1px"
                borderColor="border.emphasized"
                borderRadius="bubble"
                bg="bg.glass"
                backdropFilter="blur(30px) saturate(180%)"
                boxShadow="composer"
                px="3"
                pt="2.5"
                pb="2"
                transition="border-color 0.18s ease, box-shadow 0.18s ease"
                _focusWithin={{ borderColor: 'brand.border', boxShadow: 'composer, 0 0 26px var(--chakra-colors-brand-subtle)' }}
            >
                <Textarea
                    ref={field}
                    value={prompt}
                    onChange={event => setPrompt(event.target.value)}
                    // Enter sends, Shift+Enter makes a newline — the chat convention.
                    onKeyDown={event => {
                        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            submit();
                        }
                    }}
                    placeholder={
                        dictating.state === 'recording'
                            ? `Listening in ${DICTATION_LANGUAGES[dictating.language].name}… click ■ to finish`
                            : dictating.state === 'transcribing'
                              ? 'Transcribing…'
                              : connected
                                ? `Message ${agentName ?? 'the agent'}…`
                                : 'Connecting to the agent…'
                    }
                    aria-label="Message"
                    // Typing (and dictating) stay possible while the socket reconnects; only Send waits for it.
                    autoresize
                    rows={1}
                    maxH="40"
                    variant="flushed"
                    border="0"
                    bg="transparent"
                    px="1.5"
                    py="1.5"
                    fontSize="15px"
                    lineHeight="1.55"
                    resize="none"
                    _focusVisible={{ boxShadow: 'none', outline: 'none' }}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                />

                <HStack justify="space-between" mt="1.5" gap="3">
                    <HStack gap="2" pl="1.5" minW="0">
                        <Box
                            w="7px"
                            h="7px"
                            borderRadius="full"
                            bg={state.color}
                            boxShadow={connected ? '0 0 8px var(--chakra-colors-green-500)' : undefined}
                            flexShrink={0}
                            className={status === 'connecting' ? 'kn-pulse' : undefined}
                        />
                        <Text fontSize="xs" color="fg.muted" truncate>
                            {running ? `${agentName ?? 'The agent'} is working…` : state.label}
                        </Text>
                    </HStack>

                    <HStack gap="3">
                        <Text fontSize="xs" color="fg.subtle" display={{ base: 'none', md: 'block' }}>
                            <Box as="kbd" fontFamily="body">
                                Enter
                            </Box>{' '}
                            to send ·{' '}
                            <Box as="kbd" fontFamily="body">
                                Shift + Enter
                            </Box>{' '}
                            new line
                        </Text>
                        {/* Dictation is a plain HTTP call — independent of the chat socket, so it works while connecting too. */}
                        <Dictation onText={addDictation} onStateChange={onDictationChange} />
                        {/* Mid-run the button becomes Stop — the SDK's cancel is a no-op otherwise. */}
                        {running ? (
                            <Tooltip content="Stop generating">
                                <IconButton aria-label="Stop generating" size="sm" borderRadius="control" variant="outline" onClick={cancel}>
                                    <LuSquare fill="currentColor" size={12} />
                                </IconButton>
                            </Tooltip>
                        ) : (
                            <IconButton
                                aria-label="Send message"
                                size="sm"
                                borderRadius="control"
                                disabled={!canSend}
                                onClick={submit}
                                bgImage={canSend ? 'linear-gradient(135deg, var(--chakra-colors-brand-400), var(--chakra-colors-brand-500))' : undefined}
                                boxShadow={canSend ? '0 4px 14px -2px var(--chakra-colors-brand-glow)' : 'none'}
                            >
                                <LuArrowUp />
                            </IconButton>
                        )}
                    </HStack>
                </HStack>
            </Box>
        </Box>
    );
};

Component.displayName = 'ChatPrompt';
