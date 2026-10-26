import { defineSemanticTokens, defineTokens } from '@chakra-ui/react';

import { BRAND, RADII } from './brand.config';

/**
 * Raw design tokens. Values that come from the brand (accent, radii) are read from
 * `brand.config.ts`; the neutrals below are the Keen "Midnight" (dark) and
 * "Cool paper" (light) ramps. Components never use these hex values directly —
 * they read the SEMANTIC tokens in `semanticTokens`, so changing a value here
 * recolors the whole app in both modes.
 */

const toScale = (scale: Record<string | number, string>) => Object.fromEntries(Object.entries(scale).map(([key, value]) => [key, { value }]));

/** `color-mix` tint of the brand color — follows `brand.500` wherever it is changed. */
const brandAlpha = (percent: number) => `color-mix(in srgb, var(--chakra-colors-brand-500) ${percent}%, transparent)`;

export const tokens = defineTokens({
    colors: {
        brand: toScale(BRAND.accent)
    },
    fonts: {
        heading: { value: 'var(--font-brand), system-ui, -apple-system, sans-serif' },
        body: { value: 'var(--font-brand), system-ui, -apple-system, sans-serif' },
        mono: { value: 'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace' }
    },
    radii: {
        // Chakra's own recipes read l1 / l2 / l3 — mapping them to the brand shape
        // re-shapes every built-in component (buttons, inputs, menus, dialogs…).
        l1: { value: `calc(${RADII.control} * 0.66)` },
        l2: { value: RADII.control },
        l3: { value: RADII.card },
        control: { value: RADII.control },
        card: { value: RADII.card },
        panel: { value: RADII.panel },
        bubble: { value: RADII.bubble },
        pill: { value: RADII.pill }
    }
});

export const semanticTokens = defineSemanticTokens({
    colors: {
        // NB: nest semantic tokens (bg: { panel: … }) — flat 'bg.panel' keys are NOT expanded by Chakra.

        /* ---- surfaces ------------------------------------------------------ */
        bg: {
            // The page canvas — a flat atmosphere blue.
            DEFAULT: { value: { _light: '#e3ecfd', _dark: '#0b1322' } },
            canvas: { value: { _light: '#e3ecfd', _dark: '#0b1322' } },
            // Cards, list rows, dialogs, menus — anything that sits ON the canvas.
            panel: { value: { _light: '#ffffff', _dark: '#141a2b' } },
            elevated: { value: { _light: '#ffffff', _dark: '#141a2b' } },
            subtle: { value: { _light: 'rgba(255,255,255,0.60)', _dark: 'rgba(255,255,255,0.03)' } },
            muted: { value: { _light: 'rgba(20,30,55,0.05)', _dark: 'rgba(255,255,255,0.05)' } },
            emphasized: { value: { _light: 'rgba(20,30,55,0.09)', _dark: 'rgba(255,255,255,0.09)' } },
            // Frosted chrome: sidebar, top bars, the composer.
            bar: { value: { _light: 'rgba(255,255,255,0.62)', _dark: 'rgba(10,15,30,0.62)' } },
            glass: { value: { _light: 'rgba(255,255,255,0.60)', _dark: 'rgba(255,255,255,0.05)' } },
            glassHover: { value: { _light: 'rgba(255,255,255,0.86)', _dark: 'rgba(255,255,255,0.09)' } },
            chrome: { value: { _light: 'rgba(255,255,255,0.97)', _dark: 'rgba(12,18,34,0.96)' } },
            authCard: { value: { _light: 'rgba(255,255,255,0.78)', _dark: 'rgba(14,20,38,0.72)' } },
            code: { value: { _light: 'rgba(20,30,55,0.05)', _dark: 'rgba(0,0,0,0.28)' } }
        },

        /* ---- text ---------------------------------------------------------- */
        fg: {
            DEFAULT: { value: { _light: '#1b2333', _dark: '#E8E2D9' } },
            muted: { value: { _light: '#58637a', _dark: '#9a918a' } },
            subtle: { value: { _light: '#8a93a6', _dark: '#6b6259' } },
            inverted: { value: { _light: '#ffffff', _dark: '#0b1322' } }
        },

        /* ---- lines --------------------------------------------------------- */
        border: {
            DEFAULT: { value: { _light: 'rgba(20,30,55,0.10)', _dark: 'rgba(255,255,255,0.07)' } },
            muted: { value: { _light: 'rgba(20,30,55,0.06)', _dark: 'rgba(255,255,255,0.045)' } },
            subtle: { value: { _light: 'rgba(20,30,55,0.06)', _dark: 'rgba(255,255,255,0.045)' } },
            emphasized: { value: { _light: 'rgba(20,30,55,0.18)', _dark: 'rgba(255,255,255,0.12)' } }
        },

        /* ---- syntax highlighting (code blocks in answers — hljs classes) --- */
        code: {
            fg: { value: { _light: '#24292f', _dark: '#d6dde8' } },
            keyword: { value: { _light: '#cf222e', _dark: '#ff7b72' } },
            string: { value: { _light: '#0a3069', _dark: '#a5d6ff' } },
            number: { value: { _light: '#0550ae', _dark: '#79c0ff' } },
            title: { value: { _light: '#8250df', _dark: '#d2a8ff' } },
            attr: { value: { _light: '#953800', _dark: '#ffa657' } },
            tag: { value: { _light: '#116329', _dark: '#7ee787' } },
            comment: { value: { _light: '#6e7781', _dark: '#8b949e' } },
            meta: { value: { _light: '#57606a', _dark: '#a1a9b4' } }
        },

        /* ---- the brand palette (enables colorPalette="brand") -------------- */
        brand: {
            solid: { value: '{colors.brand.500}' },
            contrast: { value: '#ffffff' },
            fg: { value: { _light: '{colors.brand.600}', _dark: '{colors.brand.300}' } },
            muted: { value: { _light: brandAlpha(14), _dark: brandAlpha(20) } },
            subtle: { value: { _light: brandAlpha(8), _dark: brandAlpha(11) } },
            emphasized: { value: { _light: brandAlpha(22), _dark: brandAlpha(30) } },
            focusRing: { value: '{colors.brand.500}' },
            border: { value: { _light: brandAlpha(30), _dark: brandAlpha(38) } },
            glow: { value: brandAlpha(45) }
        }
    },
    shadows: {
        card: {
            value: {
                _light: '0 18px 44px -26px rgba(28,40,75,0.28), 0 0 0 1px rgba(20,30,55,0.04)',
                _dark: '0 18px 50px -24px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.02)'
            }
        },
        pop: {
            value: {
                _light: '0 30px 70px -32px rgba(28,40,75,0.30), 0 0 0 1px rgba(20,30,55,0.06)',
                _dark: '0 30px 80px -30px rgba(0,0,0,0.90), 0 0 0 1px rgba(255,255,255,0.04)'
            }
        },
        composer: {
            value: {
                _light: '0 4px 6px -1px rgba(28,40,75,0.06), 0 2px 4px -2px rgba(28,40,75,0.05), 0 0 0 1px rgba(23,99,207,0.05)',
                _dark: '0 -8px 40px -20px rgba(0,0,0,0.70), 0 0 0 1px rgba(23,99,207,0.06)'
            }
        },
        glow: {
            value: `0 0 0 1px ${brandAlpha(22)}, 0 8px 20px -12px ${brandAlpha(55)}`
        },
        // Chakra's own recipes (menus, popovers, dialogs) read these.
        md: { value: '{shadows.card}' },
        lg: { value: '{shadows.pop}' }
    },
    gradients: {
        brand: { value: 'linear-gradient(120deg, {colors.brand.500} 0%, {colors.brand.300} 100%)' }
    }
});
