'use client';

import { useSyncExternalStore } from 'react';
import { IconButton, type IconButtonProps } from '@chakra-ui/react';
import { useTheme } from 'next-themes';
import { LuMoon, LuSun } from 'react-icons/lu';

import { Tooltip } from '../tooltip';

const subscribe = () => () => {};

/** True after hydration — the theme is only known in the browser. */
const useMounted = () =>
    useSyncExternalStore(
        subscribe,
        () => true,
        () => false
    );

/** Light / dark state from next-themes, safe to read during SSR (defaults to dark). */
export function useColorMode() {
    const { resolvedTheme, setTheme } = useTheme();
    const mounted = useMounted();
    const colorMode: 'light' | 'dark' = mounted && resolvedTheme === 'light' ? 'light' : 'dark';

    return {
        colorMode,
        mounted,
        toggle: () => setTheme(colorMode === 'light' ? 'dark' : 'light')
    };
}

export const Component = (props: Omit<IconButtonProps, 'aria-label'>) => {
    const { colorMode, toggle } = useColorMode();
    const label = colorMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode';

    return (
        <Tooltip content={label}>
            <IconButton aria-label={label} variant="ghost" size="sm" color="fg.muted" onClick={toggle} {...props}>
                {colorMode === 'light' ? <LuMoon /> : <LuSun />}
            </IconButton>
        </Tooltip>
    );
};

Component.displayName = 'ColorModeToggle';
