/**
 * ElevenLabs Scribe — speech-to-text for the chat composer (English + Bulgarian).
 *
 * SERVER-ONLY: the API key (`ELEVENLABS_API_KEY`) never reaches the browser. The
 * browser records audio and posts it to /api/speech-to-text, which calls
 * `transcribe()` here; ElevenLabs answers with the transcript.
 *
 *   POST https://api.elevenlabs.io/v1/speech-to-text
 *   xi-api-key: <key>      multipart: model_id, file, [language_code], tag_audio_events
 *
 * The key should be RESTRICTED in the ElevenLabs dashboard to "Speech to Text"
 * access only — it can't do anything else if it leaks.
 */

const ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text';

/** Scribe v2 — the current model. Override with ELEVENLABS_STT_MODEL. */
const DEFAULT_MODEL = 'scribe_v2';

/** The languages the composer offers. `null` = let Scribe detect it. */
export const LANGUAGES = ['en', 'bg'] as const;
export type SpeechLanguage = (typeof LANGUAGES)[number];

/** Five minutes of browser opus audio is ~2.5 MB; this leaves headroom and bounds what we forward. */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** How long one transcription may take before we give up. */
const TIMEOUT_MS = 60_000;

export class ScribeError extends Error {
    /** The HTTP status our route answers with. */
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'ScribeError';
        this.status = status;
    }
}

/** 'en' | 'bg' → that language; '' / 'auto' / missing → null (detect). Anything else is refused. */
export function parseLanguage(value: string | null | undefined): SpeechLanguage | null {
    const normalized = (value ?? '').trim().toLowerCase();

    if (!normalized || normalized === 'auto') {
        return null;
    }

    if ((LANGUAGES as readonly string[]).includes(normalized)) {
        return normalized as SpeechLanguage;
    }

    throw new ScribeError(400, `Unsupported language "${normalized}". Use one of: ${LANGUAGES.join(', ')}.`);
}

/** Refuse what isn't a usable recording before spending a request on it. */
export function validateAudio(audio: Blob): void {
    if (audio.size === 0) {
        throw new ScribeError(400, 'The recording is empty.');
    }

    if (audio.size > MAX_AUDIO_BYTES) {
        throw new ScribeError(413, 'The recording is too long. Keep it under five minutes.');
    }

    // Browsers send audio/webm (Chrome, Firefox), audio/mp4 (Safari) or audio/ogg.
    // `video/webm` shows up when a recorder mislabels an audio-only stream.
    if (!/^(audio\/|video\/webm)/.test(audio.type)) {
        throw new ScribeError(415, 'Expected an audio recording.');
    }
}

export type TranscribeInput = {
    audio: Blob;
    language: SpeechLanguage | null;
};

export type Transcript = {
    text: string;
    /** ISO-639-3 as Scribe reports it, e.g. 'eng', 'bul'. */
    languageCode: string;
    durationSecs: number | null;
};

type ScribeReply = {
    text?: string;
    language_code?: string;
    audio_duration_secs?: number;
    detail?: { message?: string } | string;
};

type Options = {
    apiKey?: string;
    model?: string;
    /** Injectable for tests. */
    fetcher?: typeof fetch;
};

/** A file extension Scribe can sniff, from the recording's MIME type. */
const extensionFor = (type: string) => (type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('wav') ? 'wav' : 'webm');

export async function transcribe(input: TranscribeInput, options: Options = {}): Promise<Transcript> {
    const apiKey = options.apiKey ?? process.env.ELEVENLABS_API_KEY ?? '';
    const model = options.model ?? process.env.ELEVENLABS_STT_MODEL ?? DEFAULT_MODEL;
    const fetcher = options.fetcher ?? fetch;

    if (!apiKey) {
        throw new ScribeError(503, 'Speech-to-text is not configured on this server (ELEVENLABS_API_KEY).');
    }

    validateAudio(input.audio);

    const form = new FormData();
    form.append('model_id', model);
    form.append('file', input.audio, `recording.${extensionFor(input.audio.type)}`);
    // Dictation wants words, not "(laughter)" / "(music)" markers.
    form.append('tag_audio_events', 'false');

    if (input.language) {
        form.append('language_code', input.language);
    }

    let response: Response;

    try {
        response = await fetcher(ENDPOINT, {
            method: 'POST',
            headers: { 'xi-api-key': apiKey },
            body: form,
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
    } catch (err) {
        throw new ScribeError(504, `Speech-to-text did not respond (${(err as Error).name}).`);
    }

    const reply = (await response.json().catch(() => ({}))) as ScribeReply;

    if (!response.ok) {
        // Log the provider's reason server-side; the browser gets a plain message. The
        // key is never part of either.
        const reason = typeof reply.detail === 'string' ? reply.detail : (reply.detail?.message ?? 'no detail');
        console.log(`[scribe] HTTP ${response.status}: ${reason}`);

        if (response.status === 429) {
            throw new ScribeError(429, 'Speech-to-text is busy right now. Try again in a moment.');
        }

        throw new ScribeError(502, 'Speech-to-text failed. Please try again.');
    }

    return {
        text: (reply.text ?? '').trim(),
        languageCode: reply.language_code ?? '',
        durationSecs: typeof reply.audio_duration_secs === 'number' ? reply.audio_duration_secs : null
    };
}
