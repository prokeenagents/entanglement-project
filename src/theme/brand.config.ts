/**
 * ============================================================================
 *  BRAND CONFIG — the first file to edit when you make this app your own.
 * ============================================================================
 *
 * Everything brand-shaped the UI reads lives here: the product name, the logo
 * files, the accent palette, the corner radii (the "shape" of buttons, cards,
 * inputs and chat bubbles), the fonts' CSS variables and the starter prompts.
 *
 * The rest of the design system (`src/theme/*`) derives from these values, so a
 * rebrand is usually: swap the logo files in `public/brand/`, change `accent`,
 * pick a `shape`, and adjust the copy. See CUSTOMIZING.md for the long version.
 */

/**
 * The accent scale. 500 is the main brand color (buttons, links, focus rings);
 * the lighter/darker steps are used for hovers, tints and gradients. Generate a
 * full scale for your own color with any palette tool (e.g. uicolors.app) and
 * paste it here.
 */
const ACCENT = {
    50: '#edf5ff',
    100: '#d8e8ff',
    200: '#afd0ff',
    300: '#7aaeff',
    400: '#4389f5',
    500: '#1763cf',
    600: '#1250aa',
    700: '#103f86',
    800: '#11376f',
    900: '#0f274a',
    950: '#07172d'
} as const;

/**
 * Corner radius presets. `control` = buttons + inputs, `card` = panels + cards,
 * `bubble` = chat bubbles + composer. Pick one via `shape` below, or edit the
 * numbers directly.
 */
const SHAPES = {
    /** Soft, friendly — the Keen default. */
    rounded: { control: '12px', card: '16px', panel: '22px', bubble: '18px', pill: '999px' },
    /** Tighter, more corporate. */
    crisp: { control: '6px', card: '8px', panel: '12px', bubble: '10px', pill: '6px' },
    /** Pills everywhere. */
    round: { control: '999px', card: '24px', panel: '28px', bubble: '24px', pill: '999px' },
    /** Hard edges. */
    square: { control: '0px', card: '0px', panel: '0px', bubble: '0px', pill: '0px' }
} as const;

export const BRAND = {
    /** Product name — header, tab title, auth screens. */
    name: 'Keen Agents',

    /** One-liner under the name on auth / picker screens. */
    tagline: 'Your AI agents, in one place.',

    /** Credit line in the sidebar + auth footer. Set to '' to hide it. */
    poweredBy: 'Powered by Keen Agents',

    /**
     * Logo files, served from /public. The wordmark is shown where there is room
     * (auth card, expanded sidebar); the mark is the square icon for tight spots.
     *
     * The shipped Keen art is WHITE on transparent, so `invertInLight: true`
     * turns it black on the light theme. Set it to false if your logo is already
     * full-color.
     */
    logo: {
        wordmark: '/brand/wordmark.png',
        mark: '/brand/mark.webp',
        wordmarkAspect: 1520 / 547,
        invertInLight: true
    },

    accent: ACCENT,

    /** Which SHAPES preset the whole UI uses. */
    shape: 'rounded' as keyof typeof SHAPES,

    /** The color mode a first-time visitor gets: 'dark' | 'light' | 'system'. */
    defaultColorMode: 'dark' as 'dark' | 'light' | 'system',

    /**
     * Starter prompts on an empty conversation. Generic on purpose — replace them
     * with prompts that fit your agents (or drive them from Front Agent Settings).
     */
    suggestedPrompts: [
        { title: 'What can you do?', prompt: 'What can you help me with? Give me a short overview.' },
        { title: 'Summarize a topic', prompt: 'Summarize the key points of our last conversation.' },
        { title: 'Draft something', prompt: 'Help me draft a short, friendly email to a customer.' },
        { title: 'Walk me through it', prompt: 'Walk me through how you would solve this step by step.' }
    ]
} as const;

export const RADII = SHAPES[BRAND.shape];
