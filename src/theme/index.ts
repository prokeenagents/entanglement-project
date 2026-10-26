import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

import { semanticTokens, tokens } from './tokens';

/**
 * The Chakra system for the whole app. Tokens + brand values come from
 * `tokens.ts` / `brand.config.ts`; this file holds the global CSS and the small
 * set of motion primitives the chat surface uses.
 *
 * `html { colorPalette: 'brand' }` makes the brand color the DEFAULT palette, so
 * a plain <Button> is already on-brand; pass `colorPalette="red"` etc. to opt out.
 */
const config = defineConfig({
    globalCss: {
        html: {
            colorPalette: 'brand',
            bg: 'bg.canvas',
            color: 'fg',
            textRendering: 'optimizeLegibility'
        },
        body: {
            minH: '100dvh',
            bg: 'bg.canvas',
            color: 'fg',
            fontFamily: 'body'
        },
        '::selection': {
            bg: 'brand.500',
            color: 'white'
        },
        '*::-webkit-scrollbar': { w: '8px', h: '8px' },
        '*::-webkit-scrollbar-thumb': { bg: 'bg.emphasized', borderRadius: 'full' },
        '*::-webkit-scrollbar-thumb:hover': { bg: 'brand.500' },
        '*::-webkit-scrollbar-track': { bg: 'transparent' },

        /* ---- motion primitives (used by the chat surface) ---------------- */
        '.kn-caret': {
            _motionReduce: { animation: 'none' },
            display: 'inline-block',
            w: '2px',
            h: '1.05em',
            ml: '2px',
            verticalAlign: '-2px',
            borderRadius: '1px',
            bg: 'brand.500',
            animation: 'knCaret 1s steps(1) infinite'
        },
        '.kn-dots': { display: 'inline-flex', gap: '3px', alignItems: 'center' },
        '.kn-dots i': {
            _motionReduce: { animation: 'none' },
            w: '4px',
            h: '4px',
            borderRadius: 'full',
            bg: 'brand.fg',
            display: 'block',
            animation: 'knBlink 1.2s infinite ease-in-out'
        },
        '.kn-dots i:nth-of-type(2)': { animationDelay: '.18s' },
        '.kn-dots i:nth-of-type(3)': { animationDelay: '.36s' },
        '.kn-shimmer': {
            _motionReduce: { animation: 'none' },
            backgroundImage: 'linear-gradient(90deg, var(--chakra-colors-brand-fg) 0%, var(--chakra-colors-brand-200) 45%, var(--chakra-colors-brand-fg) 90%)',
            backgroundSize: '200% 100%',
            backgroundClip: 'text',
            color: 'transparent',
            animation: 'knShimmer 2s linear infinite'
        },
        '.kn-rise': { animation: 'knRise .45s cubic-bezier(.2,.7,.2,1)', _motionReduce: { animation: 'none' } },
        '.kn-fade': { animation: 'knFade .5s cubic-bezier(.2,.7,.2,1)', _motionReduce: { animation: 'none' } },
        '.kn-pulse': { animation: 'knPulse 2s ease-in-out infinite', _motionReduce: { animation: 'none' } }
    },
    theme: {
        tokens,
        semanticTokens,
        keyframes: {
            knCaret: { '50%': { opacity: 0 } },
            knBlink: {
                '0%, 80%, 100%': { opacity: 0.25, transform: 'translateY(0)' },
                '40%': { opacity: 1, transform: 'translateY(-2px)' }
            },
            knShimmer: { to: { backgroundPosition: '-200% 0' } },
            // transform-only: content is never hidden by a throttled animation
            knRise: { from: { transform: 'translateY(10px)' }, to: { transform: 'none' } },
            knFade: { from: { transform: 'translateY(8px) scale(.99)', opacity: 0.4 }, to: { transform: 'none', opacity: 1 } },
            knPulse: { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.45 } }
        }
    }
});

export const system = createSystem(defaultConfig, config);
