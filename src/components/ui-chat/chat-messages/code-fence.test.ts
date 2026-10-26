import { describe, expect, it } from 'vitest';

import { fenceBareCode, guessLanguage } from './code-fence';

const fence = (lang: string, body: string) => '```' + lang + '\n' + body + '\n```';

describe('fenceBareCode — leaves prose alone', () => {
    it('keeps plain prose unchanged', () => {
        const text = 'Hello! I can check your emails.\n\nHow can I help you today?';
        expect(fenceBareCode(text)).toBe(text);
    });

    it('keeps markdown lists, headings, quotes and tables unchanged', () => {
        const text = ['## Results', '', '- **Label:** undecided', '- Reason: the pipeline stopped.', '', '> a quote', '', '| a | b |', '|---|---|', '| 1 | 2 |'].join('\n');
        expect(fenceBareCode(text)).toBe(text);
    });

    it('keeps prose sentences that merely start with code-like words', () => {
        const text = 'If you want, I can draft the email.\nFor example, the offer could include insurance.\nReturn the form by Friday.';
        expect(fenceBareCode(text)).toBe(text);
    });

    it('keeps a single line with inline code unchanged', () => {
        const text = 'Run `npm install` and then `npm start`.';
        expect(fenceBareCode(text)).toBe(text);
    });

    it('does not touch code that is already fenced', () => {
        const text = 'Here it is:\n\n' + fence('js', 'const a = 1;\nconsole.log(a);') + '\n\nDone.';
        expect(fenceBareCode(text)).toBe(text);
    });

    it('does not touch an unclosed fence (a block still streaming in)', () => {
        const text = 'Here:\n\n```python\ndef f():\n    return 1';
        expect(fenceBareCode(text)).toBe(text);
    });

    it('keeps the Email Check report (label/reason lines) as prose', () => {
        const text = [
            'EMAIL CHECK RESULT (dry run — nothing was written to Gmail)',
            'Label: ai_success',
            'Reason: registered sender, quote obtained',
            'Quote: SP345807-2026',
            'Processed in 41s.'
        ].join('\n');
        expect(fenceBareCode(text)).toBe(text);
    });

    it('keeps bold key/value lines as prose', () => {
        const text = '**Label:** undecided\n**Reason:** The pipeline did not return a decision.';
        expect(fenceBareCode(text)).toBe(text);
    });

    it('keeps measurements written with "=" as prose', () => {
        const text = 'Weight = 20 kg\nVolume = 3 m3\nPallets = 2 EUR pallets';
        expect(fenceBareCode(text)).toBe(text);
    });

    it('keeps an email draft as prose', () => {
        const text = 'Dear Mr. Petrov,\n\nThank you for your inquiry. Please find our offer below.\nPrice: 207.05 EUR (incl. insurance)\n\nKind regards,\nAcme Logistics';
        expect(fenceBareCode(text)).toBe(text);
    });

    it('returns empty input as-is', () => {
        expect(fenceBareCode('')).toBe('');
    });
});

describe('fenceBareCode — fences bare code', () => {
    it('fences a whole answer that is JSON, pretty-printed', () => {
        const text = '{"label":"ai_success","quote":"SP345807-2026","price":207.05}';
        expect(fenceBareCode(text)).toBe(fence('json', JSON.stringify(JSON.parse(text), null, 2)));
    });

    it('fences a JSON paragraph between prose', () => {
        const json = '{\n  "subject": "Quote request",\n  "from": "ops@example.com"\n}';
        const text = 'Here is the payload:\n\n' + json + '\n\nSend it to the Email Check tool.';
        expect(fenceBareCode(text)).toBe('Here is the payload:\n\n' + fence('json', json) + '\n\nSend it to the Email Check tool.');
    });

    it('fences a JavaScript snippet', () => {
        const code = 'const total = items.reduce((sum, item) => sum + item.price, 0);\nconsole.log(total);';
        expect(fenceBareCode('Try this:\n\n' + code)).toBe('Try this:\n\n' + fence('javascript', code));
    });

    it('keeps a multi-paragraph function in ONE block', () => {
        const code = 'function add(a, b) {\n    return a + b;\n}\n\nfunction sub(a, b) {\n    return a - b;\n}';
        expect(fenceBareCode(code)).toBe(fence('javascript', code));
    });

    it('fences Python', () => {
        const code = 'def greet(name):\n    print(f"Hello {name}")\n\ngreet("Martin")';
        expect(fenceBareCode(code)).toBe(fence('python', code));
    });

    it('fences HTML', () => {
        const code = '<div class="offer">\n  <h1>Offer</h1>\n  <p>Price: 207 EUR</p>\n</div>';
        expect(fenceBareCode(code)).toBe(fence('html', code));
    });

    it('fences SQL', () => {
        const code = 'SELECT id, email\nFROM consumers\nWHERE confirmed = true;';
        expect(fenceBareCode(code)).toBe(fence('sql', code));
    });

    it('fences shell commands', () => {
        const code = '$ npm install\n$ npm run build';
        expect(fenceBareCode(code)).toBe(fence('bash', code));
    });
});

describe('guessLanguage', () => {
    it.each([
        ['{"a": 1}', 'json'],
        ['[1, 2, 3]', 'json'],
        ['<p>hi</p>\n<p>there</p>', 'html'],
        ['<?xml version="1.0"?>\n<root/>', 'xml'],
        ['SELECT * FROM t;', 'sql'],
        ['$ ls -la', 'bash'],
        ['import os\nprint(os.getcwd())', 'python'],
        ['const a = 1;', 'javascript'],
        ['interface A { b: string }\nconst x: A = { b: "c" };', 'typescript']
    ])('%s → %s', (code, lang) => {
        expect(guessLanguage(code)).toBe(lang);
    });
});
