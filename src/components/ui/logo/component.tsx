'use client';

import { chakra } from '@chakra-ui/react';

import { BRAND } from '@/theme/brand.config';

/**
 * The brand logo, read from BRAND.logo (brand.config.ts).
 *
 *   <Logo />                      the wordmark (default, where there is room)
 *   <Logo variant="mark" />       the square icon (rails, avatars, tight spots)
 *
 * The shipped Keen art is white-on-transparent, so on the light theme it is
 * filtered to a deep slate — set `BRAND.logo.invertInLight = false` for a
 * full-color logo.
 */
const LIGHT_FILTER = 'brightness(0) saturate(100%) invert(11%) sepia(17%) saturate(1200%) hue-rotate(178deg) brightness(94%) contrast(95%)';

type LogoProps = {
    variant?: 'wordmark' | 'mark';
    /** Rendered height in px. */
    height?: number;
};

export const Component = (props: LogoProps) => {
    const { variant = 'wordmark', height = 28 } = props;
    const isMark = variant === 'mark';
    const width = isMark ? height : Math.round(height * BRAND.logo.wordmarkAspect);

    return (
        <chakra.img
            src={isMark ? BRAND.logo.mark : BRAND.logo.wordmark}
            alt={BRAND.name}
            width={width}
            height={height}
            display="block"
            flexShrink={0}
            objectFit="contain"
            draggable={false}
            css={BRAND.logo.invertInLight ? { _light: { filter: LIGHT_FILTER } } : undefined}
            style={{ width, height }}
        />
    );
};

Component.displayName = 'Logo';
