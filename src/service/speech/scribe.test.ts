import { describe, expect, it, vi } from 'vitest';

import { MAX_AUDIO_BYTES, ScribeError, parseLanguage, transcribe, validateAudio } from './scribe';

const audio = (bytes = 1000, type = 'audio/webm') => new Blob([new Uint8Array(bytes)], { type });

const okReply = (body: Record<string, unknown>) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('parseLanguage', () => {
    it.each([
        ['en', 'en'],
        ['bg', 'bg'],
        ['EN', 'en'],
        ['auto', null],
        [undefined, null],
        ['', null]
    ])('%s → %s', (input, expected) => {
        expect(parseLanguage(input as string | undefined)).toBe(expected);
    });

    it('rejects a language the app does not offer', () => {
        expect(() => parseLanguage('de')).toThrow(ScribeError);
    });
});

describe('validateAudio', () => {
    it('accepts browser recordings', () => {
        expect(() => validateAudio(audio(1000, 'audio/webm;codecs=opus'))).not.toThrow();
        expect(() => validateAudio(audio(1000, 'audio/mp4'))).not.toThrow();
        expect(() => validateAudio(audio(1000, 'audio/ogg'))).not.toThrow();
    });

    it('rejects an empty recording', () => {
        expect(() => validateAudio(audio(0))).toThrow(/empty/i);
    });

    it('rejects a recording over the size limit', () => {
        expect(() => validateAudio(audio(MAX_AUDIO_BYTES + 1))).toThrow(/too long|too large/i);
    });

    it('rejects something that is not audio', () => {
        expect(() => validateAudio(audio(1000, 'application/pdf'))).toThrow(/audio/i);
    });
});

describe('transcribe', () => {
    it('sends the recording to Scribe with the key, model and language', async () => {
        const fetcher = vi.fn().mockResolvedValue(okReply({ text: ' Здравей ', language_code: 'bul', language_probability: 0.9, audio_duration_secs: 1.5 }));

        const result = await transcribe({ audio: audio(), language: 'bg' }, { apiKey: 'sk_test', fetcher });

        expect(fetcher).toHaveBeenCalledTimes(1);
        const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://api.elevenlabs.io/v1/speech-to-text');
        expect(init.method).toBe('POST');
        expect(new Headers(init.headers).get('xi-api-key')).toBe('sk_test');

        const form = init.body as FormData;
        expect(form.get('model_id')).toBe('scribe_v2');
        expect(form.get('language_code')).toBe('bg');
        expect(form.get('tag_audio_events')).toBe('false');
        expect(form.get('file')).toBeInstanceOf(Blob);

        expect(result).toEqual({ text: 'Здравей', languageCode: 'bul', durationSecs: 1.5 });
    });

    it('lets Scribe detect the language when none is given', async () => {
        const fetcher = vi.fn().mockResolvedValue(okReply({ text: 'hi', language_code: 'eng' }));

        await transcribe({ audio: audio(), language: null }, { apiKey: 'sk_test', fetcher });

        const form = (fetcher.mock.calls[0] as [string, RequestInit])[1].body as FormData;
        expect(form.has('language_code')).toBe(false);
    });

    it('fails clearly when the key is not configured', async () => {
        await expect(transcribe({ audio: audio(), language: 'en' }, { apiKey: '', fetcher: vi.fn() })).rejects.toThrow(/not configured/i);
    });

    it('surfaces an ElevenLabs error without leaking the key', async () => {
        const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: { status: 'invalid_api_key', message: 'Invalid API key' } }), { status: 401 }));

        const error = await transcribe({ audio: audio(), language: 'en' }, { apiKey: 'sk_secret', fetcher }).catch(err => err as ScribeError);

        expect(error).toBeInstanceOf(ScribeError);
        expect((error as ScribeError).status).toBe(502);
        expect((error as ScribeError).message).not.toContain('sk_secret');
    });

    it('maps a rate limit to 429', async () => {
        const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 429 }));

        const error = await transcribe({ audio: audio(), language: 'en' }, { apiKey: 'sk_test', fetcher }).catch(err => err as ScribeError);

        expect((error as ScribeError).status).toBe(429);
    });
});
