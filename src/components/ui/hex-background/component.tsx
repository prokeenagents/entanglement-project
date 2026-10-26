'use client';

import { useEffect, useRef } from 'react';
import { Box } from '@chakra-ui/react';

import { useColorMode } from '../color-mode-toggle';

/**
 * The Keen "atmosphere": a honeycomb grid with slow waves of light rippling
 * across it. A fixed, non-interactive <canvas> behind the auth screens.
 *
 * The ripple color is read from the brand token (`--chakra-colors-brand-400`),
 * so it follows a rebrand automatically. Honors prefers-reduced-motion (draws a
 * static grid), caps the device pixel ratio at 2 and pauses when the tab is hidden.
 */

const HEX_SIZE = 30;
const GAP = 1;
const WAVE_INTERVAL = 300; // frames between waves (~5s @60fps)
const BAND = 60;
const FAINT = 0.1;
const ATTACK = 0.32;

type Hex = { x: number; y: number; b: number; ease: number; vary: number };
type Wave = { x: number; y: number; radius: number; speed: number; strength: number };

const readBrandRgb = (): [number, number, number] => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--chakra-colors-brand-400').trim();
    const hex = raw.replace('#', '');

    if (/^[0-9a-f]{6}$/i.test(hex)) {
        const n = parseInt(hex, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    return [40, 110, 210];
};

export const Component = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { colorMode } = useColorMode();

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        if (!container || !canvas || !ctx) {
            return;
        }

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const color = readBrandRgb();
        const intensity = colorMode === 'light' ? 0.55 : 0.85;

        let hexes: Hex[] = [];
        let waves: Wave[] = [];
        let frame = 0;
        let raf = 0;
        let width = 0;
        let height = 0;

        const colW = Math.sqrt(3) * HEX_SIZE;
        const rowH = 1.5 * HEX_SIZE;

        const build = () => {
            const cols = Math.ceil(width / colW) + 2;
            const rows = Math.ceil(height / rowH) + 2;
            hexes = [];

            for (let row = -1; row < rows; row++) {
                const offset = row & 1 ? colW / 2 : 0;

                for (let col = -1; col < cols; col++) {
                    hexes.push({ x: col * colW + offset, y: row * rowH, b: FAINT, ease: 0.008 + Math.random() * 0.02, vary: 0.82 + Math.random() * 0.3 });
                }
            }
        };

        const drawHex = (hex: Hex) => {
            const radius = HEX_SIZE - GAP;
            ctx.beginPath();

            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 180) * (60 * i - 90);
                const px = hex.x + radius * Math.cos(angle);
                const py = hex.y + radius * Math.sin(angle);

                if (i) {
                    ctx.lineTo(px, py);
                } else {
                    ctx.moveTo(px, py);
                }
            }

            ctx.closePath();
            ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${(hex.b * 0.18 * intensity).toFixed(3)})`;
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${(hex.b * 0.9 * intensity).toFixed(3)})`;
            ctx.stroke();
        };

        const drawStatic = () => {
            ctx.clearRect(0, 0, width, height);
            hexes.forEach(hex => {
                hex.b = FAINT * hex.vary;
                drawHex(hex);
            });
        };

        const resize = () => {
            const rect = container.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = rect.width;
            height = rect.height;
            canvas.width = Math.max(1, Math.floor(width * dpr));
            canvas.height = Math.max(1, Math.floor(height * dpr));
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            build();

            if (reduced) {
                drawStatic();
            }
        };

        const spawnWave = () => {
            waves.push({ x: Math.random() * width, y: Math.random() * height, radius: 0, speed: 1.2 + Math.random() * 1.5, strength: 0.5 + Math.random() * 0.5 });
        };

        const tick = () => {
            frame++;

            if (frame % WAVE_INTERVAL === 1) {
                spawnWave();
            }

            const maxRadius = Math.hypot(width, height) + BAND;
            waves = waves.filter(wave => {
                wave.radius += wave.speed;
                return wave.radius < maxRadius;
            });

            ctx.clearRect(0, 0, width, height);

            for (const hex of hexes) {
                let lit = 0;

                for (const wave of waves) {
                    const distance = Math.hypot(hex.x - wave.x, hex.y - wave.y);
                    lit = Math.max(lit, (1 - Math.abs(distance - wave.radius) / BAND) * wave.strength);
                }

                const target = (Math.max(0, lit) * 0.85 + FAINT) * hex.vary;
                hex.b += (target - hex.b) * (target > hex.b ? ATTACK : hex.ease);
                drawHex(hex);
            }

            raf = requestAnimationFrame(tick);
        };

        const onVisibility = () => {
            cancelAnimationFrame(raf);

            if (!document.hidden && !reduced) {
                raf = requestAnimationFrame(tick);
            }
        };

        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(container);
        document.addEventListener('visibilitychange', onVisibility);

        if (!reduced) {
            raf = requestAnimationFrame(tick);
        }

        return () => {
            cancelAnimationFrame(raf);
            observer.disconnect();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [colorMode]);

    return (
        <Box
            ref={containerRef}
            position="fixed"
            inset="0"
            zIndex="0"
            pointerEvents="none"
            aria-hidden="true"
            bg="bg.canvas"
            backgroundImage="radial-gradient(ellipse 1200px 1000px at 88% 12%, var(--chakra-colors-brand-subtle), transparent 62%), radial-gradient(ellipse 1000px 850px at 12% 88%, var(--chakra-colors-brand-subtle), transparent 60%)"
        >
            <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, display: 'block' }} />
            {/* soften the grid toward the edges so the card stays the focus */}
            <Box position="absolute" inset="0" bgImage="radial-gradient(circle at 50% 45%, transparent 0%, var(--chakra-colors-bg-canvas) 85%)" opacity="0.7" />
        </Box>
    );
};

Component.displayName = 'HexBackground';
