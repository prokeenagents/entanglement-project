import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
};

const launch = JSON.parse(readFileSync(new URL('../../.vscode/launch.json', import.meta.url), 'utf8')) as {
    configurations: Array<{ command?: string }>;
};

describe('dev scripts', () => {
    it('bind the Node inspector to loopback only, never the LAN', () => {
        const inspected = Object.entries(pkg.scripts).filter(([, command]) => command.includes('--inspect'));

        expect(inspected.length).toBeGreaterThan(0);
        for (const [name, command] of inspected) {
            expect(command, name).toMatch(/--inspect=127\.0\.0\.1:\d+/);
            expect(command, name).not.toContain('0.0.0.0');
        }
    });

    it('carry no stray dependencies', () => {
        expect(pkg.dependencies).not.toHaveProperty('i');
        expect(pkg.dependencies).not.toHaveProperty('npm');
    });

    it('every npm script the VS Code launch configs run exists', () => {
        for (const { command } of launch.configurations) {
            const script = command?.match(/^npm run (\S+)/)?.[1];
            if (script) {
                expect(pkg.scripts, `launch.json runs "npm run ${script}"`).toHaveProperty(script);
            }
        }
    });
});
