/**
 * Agents often answer with code WITHOUT a markdown fence — a JSON payload, an
 * HTML snippet, a few lines of JavaScript. Rendered as markdown that becomes a
 * paragraph of run-together text. `fenceBareCode` finds those stretches and wraps
 * them in a fence (with a guessed language), so they render as a code block.
 *
 * Conservative by design — prose must never be fenced:
 *   - fenced code (``` / ~~~), including an unclosed fence still streaming in, is
 *     passed through untouched;
 *   - markdown structure (headings, lists, quotes, tables) is never code;
 *   - a paragraph is code only when MOST of its lines look like code, and a single
 *     line is never fenced (inline code is the markdown way for that) — except a
 *     whole answer that parses as JSON.
 * Consecutive code paragraphs merge into one block, so a function with blank lines
 * inside stays whole. Pure and cheap: it runs on every streamed token.
 */

const FENCE = /^\s{0,3}(```|~~~)/;

/** Share of a paragraph's lines that must look like code. */
const CODE_LINE_RATIO = 0.6;

/** Markdown structure — never code. */
const MARKDOWN_LINE = /^\s{0,3}(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\|)/;

/** Signals that a single line is code. Each is specific enough not to fire on prose. */
const CODE_LINE: RegExp[] = [
    /[;{}[\]]\s*$/, // ends a statement or opens / closes a block
    /^\s*[}\])]/, // closes a block
    /^\s*<\/?[a-zA-Z][\w-]*(\s[^>]*)?\/?>/, // an HTML / XML tag
    /^\s*<\?xml/,
    /^\s*(const|let|var)\s+[\w$[{]/, // JS declarations
    /^\s*(export\s+)?(async\s+)?function\s*[\w$]*\s*\(/,
    /^\s*(export\s+)?(default\s+)?(class|interface|type|enum)\s+\w+/,
    /^\s*import\s+[\w{*'"]/,
    /^\s*from\s+[\w.]+\s+import\s/,
    /^\s*(def|class)\s+\w+.*:\s*$/, // Python blocks
    /^\s*(if|elif|else|for|while|try|except|with)\b.*:\s*$/,
    /^\s*return\s+[^\s].*[;)\]}'"\w]\s*$/,
    /^\s*print\(/,
    /^\s*(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+(TABLE|INDEX|VIEW)|ALTER\s+TABLE|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|JOIN|LIMIT)\b/, // SQL (upper-case only)
    /^\s*\$\s+\S/, // a shell prompt
    /^\s*"[^"]+"\s*:/, // a JSON key
    /=>/, // arrow functions
    // An assignment whose value reads like code (one token, a quoted string, or a
    // statement end) — not 'Weight = 20 kg'.
    /^\s*[\w$.[\]]+\s*=\s*([^\s=][^\s]*|['"`].*['"`]|.*[;{([]\s*)$/,
    /^\s*[\w$.]+\([^)]*\)\s*;?\s*$/, // a bare call: console.log(x)
    /^\s{2,}\S/ // indented continuation (only counts inside an already code-like paragraph)
];

/** Indentation alone isn't a signal on its own — it only supports other code lines. */
const WEAK_SIGNAL = CODE_LINE[CODE_LINE.length - 1];

/** A prose sentence: several words ending in sentence punctuation, no code symbols. */
const PROSE_LINE = /^[^;{}=<>]*\b\w+\s+\w+\s+\w+\b[^;{}=<>]*[.!?:]["')\]]?\s*$/;

const isCodeLine = (line: string): 'strong' | 'weak' | null => {
    if (!line.trim() || PROSE_LINE.test(line)) {
        return null;
    }

    if (CODE_LINE.some(pattern => pattern !== WEAK_SIGNAL && pattern.test(line))) {
        return 'strong';
    }

    return WEAK_SIGNAL.test(line) ? 'weak' : null;
};

const parsesAsJson = (text: string): boolean => {
    const trimmed = text.trim();

    if (!/^[[{]/.test(trimmed)) {
        return false;
    }

    try {
        JSON.parse(trimmed);
        return true;
    } catch {
        return false;
    }
};

const isCodeParagraph = (paragraph: string): boolean => {
    const lines = paragraph.split('\n').filter(line => line.trim());

    if (lines.length === 0 || lines.some(line => MARKDOWN_LINE.test(line))) {
        return false;
    }

    if (parsesAsJson(paragraph) && lines.length > 1) {
        return true;
    }

    if (lines.length < 2) {
        return false;
    }

    const verdicts = lines.map(isCodeLine);
    const strong = verdicts.filter(verdict => verdict === 'strong').length;
    const coded = verdicts.filter(Boolean).length;

    return strong >= 1 && coded / lines.length >= CODE_LINE_RATIO;
};

/**
 * A paragraph that continues an open code block: every line looks like code. Lets a
 * short trailing paragraph (a single call like `greet("Martin")`) stay in the block
 * it belongs to, where on its own it would be left as prose.
 */
const continuesCode = (paragraph: string): boolean => {
    const lines = paragraph.split('\n').filter(line => line.trim());

    return lines.length > 0 && !lines.some(line => MARKDOWN_LINE.test(line)) && lines.every(line => isCodeLine(line) === 'strong');
};

/** Best-effort language for a block — drives syntax highlighting and the label. */
export const guessLanguage = (code: string): string => {
    const trimmed = code.trim();

    if (parsesAsJson(trimmed)) {
        return 'json';
    }

    if (/^<\?xml/.test(trimmed)) {
        return 'xml';
    }

    if (/^<[a-zA-Z!]/.test(trimmed)) {
        return 'html';
    }

    if (/^\s*(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+(TABLE|INDEX|VIEW)|ALTER\s+TABLE|WITH)\b/m.test(trimmed) && !/[{}]/.test(trimmed)) {
        return 'sql';
    }

    if (/^\s*\$\s+\S/m.test(trimmed)) {
        return 'bash';
    }

    if (/^\s*(def|class)\s+\w+.*:\s*$/m.test(trimmed) || (/^\s*(import|from)\s+\w/m.test(trimmed) && !/[;{}]|\bfrom\s+['"]/.test(trimmed)) || /^\s*print\(/m.test(trimmed)) {
        return 'python';
    }

    if (/^\s*(interface|type|enum)\s+\w+|:\s*(string|number|boolean)\b|<\w+>\(/m.test(trimmed)) {
        return 'typescript';
    }

    return 'javascript';
};

/** Pretty-print a one-line JSON blob; leave formatted JSON as the agent wrote it. */
const formatJson = (code: string): string => (code.includes('\n') ? code : JSON.stringify(JSON.parse(code), null, 2));

const wrap = (code: string): string => {
    const language = guessLanguage(code);
    const body = language === 'json' ? formatJson(code.trim()) : code.replace(/^\n+|\n+$/g, '');

    return '```' + language + '\n' + body + '\n```';
};

/** Split prose (outside fences) into paragraphs and fence the code ones. */
const fenceProse = (prose: string): string => {
    const paragraphs = prose.split(/(\n{2,})/); // keep the separators
    const out: string[] = [];
    let run: string[] = []; // consecutive code paragraphs (+ the separators between them)

    const flush = () => {
        if (run.length) {
            // Drop a trailing separator from the run; it goes back outside the fence.
            const trailing = /^\n+$/.test(run[run.length - 1]) ? run.pop()! : '';
            out.push(wrap(run.join('')), trailing);
            run = [];
        }
    };

    for (const part of paragraphs) {
        if (/^\n+$/.test(part)) {
            (run.length ? run : out).push(part);
            continue;
        }

        if (isCodeParagraph(part) || (run.length > 0 && continuesCode(part))) {
            run.push(part);
        } else {
            flush();
            out.push(part);
        }
    }

    flush();

    return out.join('');
};

export function fenceBareCode(text: string): string {
    if (!text.trim()) {
        return text;
    }

    // A whole answer that is JSON — the most common bare-code reply.
    if (parsesAsJson(text)) {
        return wrap(text);
    }

    // Walk the lines, passing fenced blocks through and fencing code in the prose between them.
    const lines = text.split('\n');
    const out: string[] = [];
    let prose: string[] = [];
    let inFence: string | null = null;

    const flushProse = () => {
        if (prose.length) {
            out.push(fenceProse(prose.join('\n')));
            prose = [];
        }
    };

    for (const line of lines) {
        const marker = line.match(FENCE)?.[1] ?? null;

        if (inFence) {
            out.push(line);

            if (marker === inFence) {
                inFence = null;
            }

            continue;
        }

        if (marker) {
            flushProse();
            inFence = marker;
            out.push(line);
            continue;
        }

        prose.push(line);
    }

    flushProse();

    return out.join('\n');
}
