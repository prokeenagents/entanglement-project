import { NextRequest, NextResponse } from 'next/server';

import { MAX_AUDIO_BYTES, ScribeError, parseLanguage, transcribe } from '@/service/speech/scribe';
import { getAccessToken } from '@/utils/cookies';

/**
 * POST /api/speech-to-text — dictation for the chat composer.
 *
 * multipart/form-data: `audio` (the browser's recording), `language` ('en' | 'bg' |
 * 'auto'). Answers `{ success, text, languageCode }`. The ElevenLabs key stays on
 * this server (service/speech/scribe.ts); the proxy only lets signed-in consumers
 * reach this route, and the handler checks the session again.
 */
export const runtime = 'nodejs';

/** Multipart overhead on top of the audio itself. */
const BODY_LIMIT = MAX_AUDIO_BYTES + 64 * 1024;

const fail = (status: number, message: string) => NextResponse.json({ success: false, status, message }, { status });

export async function POST(request: NextRequest) {
    if (!(await getAccessToken())) {
        return fail(401, 'No session.');
    }

    // Refuse an oversized upload before reading it into memory.
    if (Number(request.headers.get('content-length') ?? 0) > BODY_LIMIT) {
        return fail(413, 'The recording is too long. Keep it under five minutes.');
    }

    let form: FormData;

    try {
        form = await request.formData();
    } catch {
        return fail(400, 'Expected multipart form data with an "audio" file.');
    }

    const audio = form.get('audio');

    if (!(audio instanceof Blob)) {
        return fail(400, 'Missing the "audio" recording.');
    }

    try {
        const language = parseLanguage(String(form.get('language') ?? ''));
        const transcript = await transcribe({ audio, language });

        return NextResponse.json({ success: true, text: transcript.text, languageCode: transcript.languageCode, durationSecs: transcript.durationSecs });
    } catch (err) {
        if (err instanceof ScribeError) {
            return fail(err.status, err.message);
        }

        console.log(`[scribe] unexpected: ${(err as Error).message}`);
        return fail(500, 'Speech-to-text failed. Please try again.');
    }
}
