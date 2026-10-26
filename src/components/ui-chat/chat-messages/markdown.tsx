'use client';

import { isValidElement, memo, useMemo, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { Box, Button, HStack, Text } from '@chakra-ui/react';
import { LuCheck, LuCopy } from 'react-icons/lu';

import { fenceBareCode } from './code-fence';

/**
 * Agent answers are markdown. react-markdown renders to plain elements (no raw
 * HTML — it is not enabled, so model output can't inject markup) and the `prose`
 * styles below give them the brand's typography. Restyle answers by editing
 * PROSE — it's all in one place.
 *
 * Code always renders as a code block: fenced code as-is, and code an agent sent
 * WITHOUT a fence (a JSON payload, an HTML snippet, a few lines of JS) is fenced
 * first by `fenceBareCode` (see code-fence.ts). rehype-highlight colors the tokens
 * (highlight.js classes → the `code.*` theme tokens below), detecting the language
 * when the fence names none.
 */
const PROSE = {
    fontSize: '15px',
    lineHeight: '1.7',
    color: 'fg',
    wordBreak: 'break-word',
    '& > :first-child': { mt: 0 },
    '& > :last-child': { mb: 0 },
    '& p': { my: '3' },
    '& h1, & h2, & h3, & h4': { fontWeight: '700', letterSpacing: '-0.015em', lineHeight: '1.3', mt: '5', mb: '2' },
    '& h1': { fontSize: '1.35em' },
    '& h2': { fontSize: '1.2em' },
    '& h3': { fontSize: '1.08em' },
    '& strong': { fontWeight: '650', color: 'fg' },
    '& a': { color: 'brand.fg', textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: 'brand.border' },
    '& a:hover': { textDecorationColor: 'currentColor' },
    '& ul, & ol': { my: '3', pl: '6' },
    '& ul': { listStyleType: 'disc' },
    '& ol': { listStyleType: 'decimal' },
    '& li': { my: '1.5', pl: '1' },
    '& li::marker': { color: 'fg.subtle' },
    '& blockquote': { my: '4', pl: '4', borderLeftWidth: '3px', borderColor: 'brand.border', color: 'fg.muted' },
    '& hr': { my: '6', borderColor: 'border' },
    '& :not(pre) > code': { fontFamily: 'mono', fontSize: '0.87em', px: '1.5', py: '0.5', borderRadius: '6px', bg: 'bg.code', borderWidth: '1px', borderColor: 'border' },
    '& pre': { fontFamily: 'mono', fontSize: '13px', lineHeight: '1.6', overflowX: 'auto', maxH: '520px', overflowY: 'auto', p: '4', m: 0, bg: 'bg.code', color: 'code.fg' },
    '& pre code': { fontFamily: 'inherit', whiteSpace: 'pre', tabSize: 4 },
    // highlight.js token classes (rehype-highlight)
    '& .hljs-keyword, & .hljs-selector-tag, & .hljs-literal, & .hljs-built_in, & .hljs-type': { color: 'code.keyword' },
    '& .hljs-string, & .hljs-regexp, & .hljs-template-string, & .hljs-selector-attr': { color: 'code.string' },
    '& .hljs-number, & .hljs-symbol, & .hljs-bullet, & .hljs-variable.language_': { color: 'code.number' },
    '& .hljs-title, & .hljs-title.function_, & .hljs-title.class_, & .hljs-section': { color: 'code.title' },
    '& .hljs-attr, & .hljs-attribute, & .hljs-property, & .hljs-params, & .hljs-selector-class, & .hljs-selector-id': { color: 'code.attr' },
    '& .hljs-name, & .hljs-tag': { color: 'code.tag' },
    '& .hljs-comment, & .hljs-quote': { color: 'code.comment', fontStyle: 'italic' },
    '& .hljs-meta, & .hljs-doctag, & .hljs-punctuation': { color: 'code.meta' },
    '& .hljs-emphasis': { fontStyle: 'italic' },
    '& .hljs-strong': { fontWeight: '700' },
    '& .md-table': { my: '4', overflowX: 'auto', borderWidth: '1px', borderColor: 'border', borderRadius: 'control' },
    '& table': { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
    '& th': { textAlign: 'left', fontWeight: '600', fontSize: '12px', letterSpacing: '0.02em', color: 'fg.muted', bg: 'bg.muted' },
    '& th, & td': { px: '3', py: '2', borderBottomWidth: '1px', borderColor: 'border' },
    '& tr:last-of-type td': { borderBottomWidth: 0 }
} as const;

/** Readable names for the language label; anything else shows as written. */
const LANGUAGE_LABEL: Record<string, string> = {
    js: 'JavaScript',
    javascript: 'JavaScript',
    jsx: 'JSX',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    tsx: 'TSX',
    json: 'JSON',
    html: 'HTML',
    xml: 'XML',
    css: 'CSS',
    sql: 'SQL',
    bash: 'Shell',
    sh: 'Shell',
    shell: 'Shell',
    python: 'Python',
    py: 'Python',
    yaml: 'YAML',
    yml: 'YAML',
    markdown: 'Markdown',
    md: 'Markdown'
};

/** The fence language, read off the <code> element's `language-xxx` class. */
const languageOf = (children: React.ReactNode): string => {
    const className = isValidElement<{ className?: string }>(children) ? (children.props.className ?? '') : '';
    const language = className.match(/language-([\w+#-]+)/)?.[1] ?? '';

    return LANGUAGE_LABEL[language.toLowerCase()] ?? (language || 'Code');
};

/**
 * A code block: a header with the language and a Copy button (always visible —
 * copying code is the main thing people do with it), then the highlighted code.
 */
const CodeBlock = ({ children }: { children?: React.ReactNode }) => {
    const [copied, setCopied] = useState(false);

    const copy = (event: React.MouseEvent<HTMLButtonElement>) => {
        const text = event.currentTarget.closest('[data-code-block]')?.querySelector('pre')?.innerText ?? '';

        void navigator.clipboard?.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    return (
        <Box data-code-block my="4" borderWidth="1px" borderColor="border" borderRadius="control" overflow="hidden">
            <HStack justify="space-between" px="3" py="1" bg="bg.muted" borderBottomWidth="1px" borderColor="border">
                <Text fontSize="12px" fontWeight="500" color="fg.muted" fontFamily="mono">
                    {languageOf(children)}
                </Text>
                <Button size="xs" variant="ghost" color="fg.muted" gap="1.5" onClick={copy} aria-label="Copy code">
                    {copied ? <LuCheck /> : <LuCopy />}
                    {copied ? 'Copied' : 'Copy'}
                </Button>
            </HStack>
            <pre>{children}</pre>
        </Box>
    );
};

const COMPONENTS: Components = {
    a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    ),
    pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
    table: ({ children }) => (
        <div className="md-table">
            <table>{children}</table>
        </div>
    )
};

/** Highlight fenced code; guess the language when the fence names none. */
const REHYPE_PLUGINS: React.ComponentProps<typeof ReactMarkdown>['rehypePlugins'] = [[rehypeHighlight, { detect: true }]];

export const Markdown = memo(function Markdown({ text }: { text: string }) {
    const source = useMemo(() => fenceBareCode(text), [text]);

    return (
        <Box css={PROSE}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={REHYPE_PLUGINS} components={COMPONENTS}>
                {source}
            </ReactMarkdown>
        </Box>
    );
});
