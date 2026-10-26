'use client';

import { useEffect } from 'react';
import { Box, HStack, IconButton, Menu, Portal, Spinner, Text, chakra } from '@chakra-ui/react';
import { LuCheck, LuChevronDown, LuMic, LuSquare, LuX } from 'react-icons/lu';

import { Tooltip } from '@/components/ui/tooltip';
import { type DictationLanguage, type DictationState, MAX_SECONDS, useDictation } from '@/hooks/dictation';
import { usePersistentState } from '@/hooks/persistent-state';

/** How each language is named in the menu — in English and in itself. */
export const DICTATION_LANGUAGES: Record<DictationLanguage, { name: string; native: string }> = {
    en: { name: 'English', native: 'English' },
    bg: { name: 'Bulgarian', native: 'Български' }
};

const clock = (total: number) => `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;

/** The language half of the dictation button: "EN ▾". */
const LanguageTrigger = chakra('button', {
    base: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5',
        h: 'full',
        pl: '1.5',
        pr: '2',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.02em',
        color: 'fg.muted',
        cursor: 'pointer',
        borderLeftWidth: '1px',
        borderColor: 'border',
        transition: 'color 0.15s ease, background 0.15s ease',
        _hover: { color: 'fg', bg: 'bg.muted' },
        _expanded: { color: 'fg', bg: 'bg.muted' },
        _disabled: { opacity: 0.5, cursor: 'not-allowed' }
    }
});

/**
 * Voice input for the composer — ONE control, so it's clear the language is the
 * language you SPEAK (not the chat's): `[🎤 | EN ▾]`. The mic half records; the
 * language half opens "Speech-to-text language". While recording it turns into a
 * running clock (max MAX_SECONDS) with discard and stop. The transcript (ElevenLabs
 * Scribe, via /api/speech-to-text) lands in the message box for the person to review
 * and send — it is never sent on its own.
 */
export const Dictation = ({ onText, onStateChange }: { onText: (text: string) => void; onStateChange?: (state: DictationState, language: DictationLanguage) => void }) => {
    // English until the person picks; the pick is remembered. A constant default
    // keeps the server render and hydration in step.
    const [language, setLanguage] = usePersistentState<DictationLanguage>('chat.dictationLanguage', 'en');
    const dictation = useDictation({ language, onText });
    const { name } = DICTATION_LANGUAGES[language];

    // Lets the composer show "Listening in English…" / "Transcribing…" inside the message box.
    useEffect(() => {
        onStateChange?.(dictation.state, language);
    }, [dictation.state, language, onStateChange]);

    const recording = dictation.state === 'recording';
    const transcribing = dictation.state === 'transcribing';

    return (
        <HStack gap="2">
            {dictation.error && (
                <Text fontSize="xs" color="fg.error" maxW="260px" truncate title={dictation.error} display={{ base: 'none', md: 'block' }}>
                    {dictation.error}
                </Text>
            )}

            {recording ? (
                <HStack gap="1.5" px="2" h="8" borderRadius="control" bg="rgba(239, 68, 68, 0.12)" color="red.500" aria-live="polite">
                    <Box w="8px" h="8px" borderRadius="full" bg="red.500" className="kn-pulse" />
                    <Text fontSize="xs" fontWeight="600" fontFamily="mono" minW="9">
                        {clock(dictation.seconds)}
                    </Text>
                    <Tooltip content="Discard recording">
                        <IconButton aria-label="Discard recording" size="2xs" variant="ghost" color="red.500" onClick={dictation.cancel}>
                            <LuX />
                        </IconButton>
                    </Tooltip>
                    <Tooltip content="Stop and transcribe">
                        <IconButton aria-label="Stop and transcribe" size="2xs" colorPalette="red" onClick={dictation.stop}>
                            <LuSquare fill="currentColor" size={10} />
                        </IconButton>
                    </Tooltip>
                </HStack>
            ) : (
                <HStack gap="0" h="8" borderWidth="1px" borderColor="border" borderRadius="control" overflow="hidden" role="group" aria-label="Dictation">
                    <Tooltip content={transcribing ? 'Transcribing…' : `Dictate in ${name} — typed into the box (up to ${MAX_SECONDS / 60} min)`}>
                        <IconButton
                            aria-label={transcribing ? 'Transcribing' : `Dictate in ${name}`}
                            size="sm"
                            h="full"
                            borderRadius="0"
                            variant="ghost"
                            color="fg.muted"
                            disabled={transcribing}
                            onClick={() => {
                                dictation.clearError();
                                void dictation.start();
                            }}
                        >
                            {transcribing ? <Spinner size="xs" /> : <LuMic />}
                        </IconButton>
                    </Tooltip>

                    <Menu.Root positioning={{ placement: 'top-end', gutter: 8 }}>
                        <Menu.Trigger asChild>
                            <LanguageTrigger type="button" aria-label={`Speech-to-text language: ${name}. Change`} disabled={transcribing}>
                                {language.toUpperCase()}
                                <LuChevronDown size={12} />
                            </LanguageTrigger>
                        </Menu.Trigger>
                        <Portal>
                            <Menu.Positioner>
                                <Menu.Content minW="230px">
                                    <Menu.ItemGroup>
                                        <Menu.ItemGroupLabel>
                                            <Text fontSize="xs" fontWeight="600" color="fg.muted">
                                                Speech-to-text language
                                            </Text>
                                            <Text fontSize="11px" fontWeight="400" color="fg.subtle">
                                                The language you will speak in
                                            </Text>
                                        </Menu.ItemGroupLabel>
                                        {(Object.keys(DICTATION_LANGUAGES) as DictationLanguage[]).map(code => (
                                            <Menu.Item key={code} value={code} onSelect={() => setLanguage(code)}>
                                                <Text flex="1">
                                                    {DICTATION_LANGUAGES[code].name}
                                                    {code !== 'en' && (
                                                        <Text as="span" color="fg.subtle">
                                                            {' · '}
                                                            {DICTATION_LANGUAGES[code].native}
                                                        </Text>
                                                    )}
                                                </Text>
                                                {code === language && <LuCheck />}
                                            </Menu.Item>
                                        ))}
                                    </Menu.ItemGroup>
                                </Menu.Content>
                            </Menu.Positioner>
                        </Portal>
                    </Menu.Root>
                </HStack>
            )}
        </HStack>
    );
};
