'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { Coin } from './assets/Coin';
import { Bill } from './assets/Bill';
import { EngineCore } from './assets/EngineCore';
import { useReducedMotion } from './useReducedMotion';
import {
  VIEWBOX,
  COIN_PATHS,
  OUTPUT_PATH,
  ENGINE_CENTER,
  COIN_TILES,
  BILL_SLOTS,
  LANES,
  LANE_STAGGER,
  COIN_TRAVEL,
  BILL_TRAVEL,
  LOOP_PERIOD,
} from './paths';

gsap.registerPlugin(MotionPathPlugin);

const TILE = 60;
const PATH_BLUE = '#93C5FD';

interface CoinToCashEngineProps {
  className?: string;
  /** Max rendered width in px; fills its container by default. */
  size?: number;
}

export function CoinToCashEngine({ className, size }: CoinToCashEngineProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (reduced || !root) return;

    const ctx = gsap.context(() => {
      const outputPath = root.querySelector<SVGPathElement>('[data-ctc-output]');
      if (!outputPath) return;

      // The static output stack belongs to the reduced-motion frame; the
      // animated stack is formed by staggered bills mid-flight.
      gsap.to('[data-ctc-slot]', { autoAlpha: 0, duration: 0.6, ease: 'power1.out' });

      // The engine idles with a slow breath so the page never feels frozen
      // between arrivals. Breathing runs on opacity; arrival pulses own scale,
      // so the two never fight over a property.
      gsap.fromTo(
        '[data-ctc-glow]',
        { opacity: 0.78 },
        { opacity: 1, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut' },
      );

      // Paths rest dimmed and brighten while their coin is in flight.
      gsap.set('[data-ctc-input]', { opacity: 0.45 });

      // Small pre-launch beat: the coin gathers itself before it flies.
      const LAUNCH_DELAY = 0.45;

      LANES.forEach((lane, i) => {
        const coin = root.querySelector(`[data-ctc-coin="${i}"]`);
        const bill = root.querySelector(`[data-ctc-bill="${i}"]`);
        // each coin type launches from its own tile along its own path
        const inputPath = root.querySelector<SVGPathElement>(
          `[data-ctc-input="${lane.coin}"]`,
        );
        if (!coin || !bill || !inputPath) return;

        const tl = gsap.timeline({ repeat: -1, delay: i * LANE_STAGGER });

        const arrive = LAUNCH_DELAY + COIN_TRAVEL;

        // Coin: fade in at its tile, gather (anticipation dip), ride its
        // bezier into the core, shrinking hard and dissolving into the glow.
        tl.set(coin, { opacity: 0, scale: 1, transformOrigin: '50% 50%' }, 0)
          .to(coin, { opacity: 1, duration: 0.25, ease: 'power1.out' }, 0)
          .to(coin, { scale: 0.9, duration: 0.22, ease: 'power1.in' }, 0.12)
          .to(coin, { scale: 1, duration: 0.16, ease: 'power2.out' }, 0.34)
          .to(
            coin,
            {
              duration: COIN_TRAVEL,
              ease: 'power2.inOut',
              motionPath: {
                path: inputPath,
                align: inputPath,
                alignOrigin: [0.5, 0.5],
              },
            },
            LAUNCH_DELAY,
          )
          .to(coin, { scale: 0.22, duration: 1.0, ease: 'power2.in' }, arrive - 1.0)
          .to(coin, { opacity: 0, duration: 0.22, ease: 'power1.in' }, arrive - 0.22);

        // The coin's own path brightens for the duration of its flight.
        tl.to(inputPath, { opacity: 1, duration: 0.35, ease: 'power1.out' }, LAUNCH_DELAY)
          .to(inputPath, { opacity: 0.45, duration: 0.7, ease: 'power1.in' }, arrive);

        // Engine pulse + ripple: the "consumed" beat as each coin lands.
        tl.fromTo(
          '[data-ctc-glow]',
          { scale: 1, transformOrigin: '50% 50%' },
          { scale: 1.18, duration: 0.14, repeat: 1, yoyo: true, ease: 'power2.out' },
          arrive - 0.12,
        )
          .fromTo(
            '[data-ctc-flash]',
            { opacity: 0 },
            { opacity: 0.85, duration: 0.14, repeat: 1, yoyo: true, ease: 'power1.out' },
            arrive - 0.12,
          )
          .fromTo(
            '[data-ctc-ripple]',
            { opacity: 0.7, scale: 0.6, transformOrigin: '50% 50%' },
            { opacity: 0, scale: 2.3, duration: 0.55, ease: 'power2.out' },
            arrive - 0.05,
          );

        // Bill: emerge from behind the engine, scale up along the output
        // bezier, then dissolve near the top edge.
        const t0 = arrive + 0.1;
        tl.set(bill, { opacity: 0, scale: 0.25, transformOrigin: '50% 50%' }, 0)
          .to(
            bill,
            {
              duration: BILL_TRAVEL,
              ease: 'power1.inOut',
              motionPath: {
                path: outputPath,
                align: outputPath,
                alignOrigin: [0.5, 0.5],
              },
            },
            t0,
          )
          .to(bill, { opacity: 1, duration: 0.45, ease: 'power1.out' }, t0)
          .to(bill, { scale: 1, duration: BILL_TRAVEL * 0.8, ease: 'power2.out' }, t0)
          .to(
            bill,
            { opacity: 0, duration: BILL_TRAVEL * 0.22, ease: 'power1.in' },
            t0 + BILL_TRAVEL * 0.78,
          );

        // Pad each lane to the shared loop period so every lane repeats on
        // the same cadence — this is what makes the loop seamless.
        tl.repeatDelay(LOOP_PERIOD - tl.duration());
      });
    }, root);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <div
      ref={rootRef}
      className={['font-sans', className].filter(Boolean).join(' ')}
      style={size ? { maxWidth: size } : undefined}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        className="h-auto w-full"
      >
        {/* dotted connectors: each tile -> engine (double as coin motion paths) */}
        {COIN_TILES.map(({ coin, hideOnMobile }) => (
          <path
            key={coin}
            data-ctc-input={coin}
            d={COIN_PATHS[coin]}
            fill="none"
            stroke={PATH_BLUE}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray="0.5 9"
            className={hideOnMobile ? 'max-sm:hidden' : undefined}
          />
        ))}
        {/* invisible motion guide: engine -> output stack */}
        <path data-ctc-output="" d={OUTPUT_PATH} fill="none" stroke="none" />

        {/* input cluster tiles */}
        {COIN_TILES.map(({ coin, x, y, hideOnMobile }) => (
          <g
            key={coin}
            transform={`translate(${x} ${y})`}
            className={hideOnMobile ? 'max-sm:hidden' : undefined}
          >
            <rect
              x={-TILE / 2 + 3}
              y={-TILE / 2 + 6}
              width={TILE}
              height={TILE}
              rx={14}
              fill="#0F172A"
              opacity={0.07}
            />
            <rect
              x={-TILE / 2}
              y={-TILE / 2}
              width={TILE}
              height={TILE}
              rx={14}
              fill="#FFFFFF"
              stroke="#E4E8EF"
              strokeWidth={1}
            />
            <Coin type={coin} />
          </g>
        ))}

        {/* static output stack (reduced-motion / resting frame) */}
        {BILL_SLOTS.map(({ denomination, x, y, opacity }) => (
          <g
            key={denomination}
            data-ctc-slot=""
            transform={`translate(${x} ${y})`}
            opacity={opacity}
          >
            <Bill denomination={denomination} />
          </g>
        ))}

        {/* flying bills — behind the engine so they emerge from it */}
        {LANES.map(({ bill }, i) => (
          <g key={i} data-ctc-bill={i} opacity={0}>
            <Bill denomination={bill} />
          </g>
        ))}

        {/* flying coins */}
        {LANES.map(({ coin }, i) => (
          <g
            key={i}
            data-ctc-coin={i}
            opacity={0}
            className={
              coin === 'dime' || coin === 'quarter' ? 'max-sm:hidden' : undefined
            }
          >
            <Coin type={coin} />
          </g>
        ))}

        {/* engine core — the focal point, drawn above the bill spawn point */}
        <g transform={`translate(${ENGINE_CENTER.x} ${ENGINE_CENTER.y})`}>
          <EngineCore />
        </g>
      </svg>
    </div>
  );
}

export default CoinToCashEngine;
