'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { AUTH_API_CONFIG } from '@/configs/api.config';

/**
 * Dictation for the chat composer: record from the microphone, send the recording
 * to /api/speech-to-text (ElevenLabs Scribe, server-side), hand back the text.
 *
 *   start() → 'recording'  (asks for the microphone the first time)
 *   stop()  → 'transcribing' → onText(text) → 'idle'
 *   cancel()   drops the recording without transcribing it
 *
 * Recording stops on its own after MAX_SECONDS.
 */

export type DictationLanguage = 'en' | 'bg';
export type DictationState = 'idle' | 'recording' | 'transcribing';

/** Hard cap on one recording — matches the server's size limit with headroom. */
export const MAX_SECONDS = 300;

/** Container/codec preference; the first one the browser can record wins (Safari → mp4). */
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

const pickMimeType = (): string | undefined => {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
        return undefined;
    }

    return MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type));
};

/** A readable message for the ways getUserMedia / MediaRecorder fail. */
const describeMediaError = (err: unknown): string => {
    const name = (err as { name?: string })?.name;

    if (name === 'NotAllowedError' || name === 'SecurityError') {
        return 'Microphone access is blocked. Allow it in the browser’s site settings and try again.';
    }

    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        return 'No microphone was found.';
    }

    if (name === 'NotReadableError') {
        return 'The microphone is in use by another application.';
    }

    return 'Could not start recording.';
};

type Options = {
    language: DictationLanguage;
    /** Called with the transcript (never empty). */
    onText: (text: string) => void;
};

export function useDictation({ language, onText }: Options) {
    const [state, setState] = useState<DictationState>('idle');
    const [seconds, setSeconds] = useState(0);
    const [error, setError] = useState('');

    const recorder = useRef<MediaRecorder | null>(null);
    const stream = useRef<MediaStream | null>(null);
    const chunks = useRef<Blob[]>([]);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);
    /** Set by cancel(): the next onstop discards instead of transcribing. */
    const discard = useRef(false);

    // The latest callback/language, read when a recording ends (not when it started).
    const latest = useRef({ language, onText });
    useEffect(() => {
        latest.current = { language, onText };
    }, [language, onText]);

    const supported = typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';

    const release = useCallback(() => {
        if (timer.current) {
            clearInterval(timer.current);
            timer.current = null;
        }

        stream.current?.getTracks().forEach(track => track.stop());
        stream.current = null;
        recorder.current = null;
    }, []);

    // Never leave the microphone on after the composer goes away.
    useEffect(() => () => release(), [release]);

    const send = useCallback(async (audio: Blob) => {
        setState('transcribing');

        try {
            const form = new FormData();
            form.append('audio', audio, 'recording');
            form.append('language', latest.current.language);

            const response = await fetch(AUTH_API_CONFIG.SPEECH_TO_TEXT.URL, { method: 'POST', body: form });
            const reply = (await response.json().catch(() => ({}))) as { success?: boolean; text?: string; message?: string };

            if (!response.ok || !reply.success) {
                setError(reply.message ?? 'Speech-to-text failed. Please try again.');
                return;
            }

            const text = (reply.text ?? '').trim();

            if (!text) {
                setError('No speech was recognised. Try again a little closer to the microphone.');
                return;
            }

            latest.current.onText(text);
        } catch {
            setError('Speech-to-text is unreachable right now. Please try again.');
        } finally {
            setState('idle');
        }
    }, []);

    const stop = useCallback(() => {
        if (recorder.current && recorder.current.state !== 'inactive') {
            recorder.current.stop(); // → onstop
        }
    }, []);

    const start = useCallback(async () => {
        if (state !== 'idle') {
            return;
        }

        setError('');

        if (!supported) {
            setError('This browser can’t record audio.');
            return;
        }

        try {
            const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            const mimeType = pickMimeType();
            const instance = new MediaRecorder(media, mimeType ? { mimeType } : undefined);

            stream.current = media;
            recorder.current = instance;
            chunks.current = [];
            discard.current = false;

            instance.ondataavailable = event => {
                if (event.data.size > 0) {
                    chunks.current.push(event.data);
                }
            };

            instance.onstop = () => {
                const audio = new Blob(chunks.current, { type: instance.mimeType || mimeType || 'audio/webm' });
                const dropped = discard.current;

                release();
                chunks.current = [];

                if (dropped) {
                    setState('idle');
                    return;
                }

                void send(audio);
            };

            instance.start(250);
            setSeconds(0);
            setState('recording');

            const startedAt = Date.now();
            timer.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startedAt) / 1000);
                setSeconds(elapsed);

                if (elapsed >= MAX_SECONDS) {
                    stop();
                }
            }, 250);
        } catch (err) {
            release();
            setState('idle');
            setError(describeMediaError(err));
        }
    }, [state, supported, release, send, stop]);

    const cancel = useCallback(() => {
        discard.current = true;
        stop();
    }, [stop]);

    return { state, seconds, error, supported, start, stop, cancel, clearError: () => setError('') };
}
