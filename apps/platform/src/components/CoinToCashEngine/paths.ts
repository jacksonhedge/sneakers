// Shared coordinate space for the whole composition. Every asset, resting
// position, and motion path lives in this one viewBox so layout and animation
// can never drift apart.
export const VIEWBOX = { width: 900, height: 600 } as const;

// Each coin type flies from ITS OWN tile into the engine core along its own
// bezier. All four are also rendered as dotted blue connectors converging on
// the engine. Start points must match COIN_TILES below.
export const COIN_PATHS = {
  penny: 'M 100 468 C 175 535 258 505 314 440 C 356 392 384 362 428 338',
  nickel: 'M 198 514 C 280 545 355 465 428 338',
  dime: 'M 274 446 C 330 452 392 402 428 338',
  quarter: 'M 172 390 C 262 404 344 384 428 338',
} as const;

// Bills travel this bezier from behind the engine up toward the top-right.
// Rendered invisibly — it exists purely as a motion guide.
export const OUTPUT_PATH =
  'M 436 318 C 494 258 540 248 596 214 C 668 170 748 128 830 62';

export const ENGINE_CENTER = { x: 430, y: 335 } as const;

import type { CoinType } from './assets/Coin';
import type { Denomination } from './assets/Bill';

// Input cluster: scattered tiles with slight isometric offsets.
// `hideOnMobile` tiles drop out below 640px to simplify the composition.
export const COIN_TILES: ReadonlyArray<{
  coin: CoinType;
  x: number;
  y: number;
  hideOnMobile?: boolean;
}> = [
  { coin: 'penny', x: 100, y: 468 },
  { coin: 'nickel', x: 198, y: 514 },
  { coin: 'dime', x: 274, y: 446, hideOnMobile: true },
  { coin: 'quarter', x: 172, y: 390, hideOnMobile: true },
];

// Resting positions for the output stack, ascending along OUTPUT_PATH.
// Used for the static (reduced-motion / pre-hydration) frame.
export const BILL_SLOTS: ReadonlyArray<{
  denomination: Denomination;
  x: number;
  y: number;
  opacity: number;
}> = [
  { denomination: 1, x: 512, y: 248, opacity: 1 },
  { denomination: 5, x: 580, y: 220, opacity: 1 },
  { denomination: 10, x: 648, y: 188, opacity: 1 },
  { denomination: 20, x: 720, y: 148, opacity: 0.95 },
  { denomination: 100, x: 798, y: 98, opacity: 0.75 },
];

// One lane = one coin flying in + one bill flying out. Lanes fire on a
// fixed stagger, so LANES.length * LANE_STAGGER is the full loop period.
export const LANES: ReadonlyArray<{ coin: CoinType; bill: Denomination }> = [
  { coin: 'penny', bill: 1 },
  { coin: 'nickel', bill: 5 },
  { coin: 'dime', bill: 10 },
  { coin: 'quarter', bill: 20 },
  { coin: 'nickel', bill: 100 },
];

export const LANE_STAGGER = 2.0;
export const COIN_TRAVEL = 2.1;
export const BILL_TRAVEL = 5.2;
export const LOOP_PERIOD = LANES.length * LANE_STAGGER; // 10s
