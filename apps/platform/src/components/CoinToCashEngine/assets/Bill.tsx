import type { SVGProps } from 'react';

export type Denomination = 1 | 5 | 10 | 20 | 100;

// Banknote-style cards: white card, tinted inner frame, guilloche waves,
// corner numerals, big denomination, and a circular seal. Cards grow with
// their value — the $100 is the largest. Drawn centered on (0,0).
//
// One ink, one voice: every bill uses the same green, deepening as value
// climbs ($1 lightest -> $100 richest). Value is carried by size, position,
// and depth of ink — never by a second hue. The engine's blue stays the only
// other saturated color in the composition.
const BILL_SPEC: Record<
  Denomination,
  { w: number; h: number; accent: string; deep: string; tint: number }
> = {
  1: { w: 84, h: 40, accent: '#79C39A', deep: '#4E9A70', tint: 0.07 },
  5: { w: 100, h: 46, accent: '#57B384', deep: '#3B8A63', tint: 0.09 },
  10: { w: 116, h: 52, accent: '#38A26E', deep: '#2C7D55', tint: 0.11 },
  20: { w: 134, h: 58, accent: '#22915B', deep: '#1E6B45', tint: 0.13 },
  100: { w: 154, h: 66, accent: '#15803D', deep: '#14532D', tint: 0.17 },
};

interface BillProps extends SVGProps<SVGGElement> {
  denomination: Denomination;
}

export function Bill({ denomination, ...rest }: BillProps) {
  const { w, h, accent, deep, tint } = BILL_SPEC[denomination];
  // inner frame inset
  const ix = w / 2 - 5;
  const iy = h / 2 - 5;
  const iw = w - 10;
  const ih = h - 10;
  const sealR = h * 0.2;
  // keep the seal clear of the bottom-right corner numeral
  const sealX = w / 2 - 18 - sealR;

  return (
    <g {...rest}>
      {/* soft offset shadow — no filter, cheap to animate */}
      <rect
        x={-w / 2 + 3}
        y={-h / 2 + 5}
        width={w}
        height={h}
        rx={10}
        fill="#0F172A"
        opacity={0.07}
      />
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={10}
        fill="#FFFFFF"
        stroke="#E4E8EF"
        strokeWidth={1}
      />

      {/* tinted inner frame — ink density climbs with value */}
      <rect
        x={-ix}
        y={-iy}
        width={iw}
        height={ih}
        rx={6}
        fill={accent}
        opacity={tint}
      />
      <rect
        x={-ix}
        y={-iy}
        width={iw}
        height={ih}
        rx={6}
        fill="none"
        stroke={accent}
        strokeOpacity={0.35}
        strokeWidth={1}
      />

      {/* guilloche waves */}
      <g stroke={accent} strokeOpacity={0.22} strokeWidth={0.9} fill="none">
        <path
          d={`M ${-ix + 3} ${ih * 0.16} q ${iw * 0.24} ${-ih * 0.34} ${iw * 0.48} 0 t ${iw * 0.48} 0`}
        />
        <path
          d={`M ${-ix + 3} ${ih * 0.3} q ${iw * 0.24} ${-ih * 0.34} ${iw * 0.48} 0 t ${iw * 0.48} 0`}
        />
      </g>

      {/* USD wordmark — top center, letterspaced like banknote micro-type */}
      <text
        y={-iy + h * 0.19}
        textAnchor="middle"
        fontSize={h * 0.115}
        fontWeight={700}
        fill={deep}
        opacity={0.7}
        style={{ letterSpacing: '0.22em' }}
      >
        USD
      </text>

      {/* corner numerals */}
      <text
        x={-ix + 5}
        y={-iy + h * 0.19}
        fontSize={h * 0.15}
        fontWeight={700}
        fill={deep}
        opacity={0.85}
      >
        {denomination}
      </text>
      <text
        x={ix - 5}
        y={iy - h * 0.08}
        textAnchor="end"
        fontSize={h * 0.15}
        fontWeight={700}
        fill={deep}
        opacity={0.85}
      >
        {denomination}
      </text>

      {/* denomination */}
      <text
        x={-ix + 8}
        y={h * 0.15}
        fontSize={h * 0.38}
        fontWeight={800}
        fill="#1E293B"
        style={{ letterSpacing: '-0.02em' }}
      >
        {`$${denomination}`}
      </text>

      {/* seal */}
      <g transform={`translate(${sealX} 0)`}>
        <circle r={sealR} fill={accent} opacity={0.16} />
        <circle
          r={sealR}
          fill="none"
          stroke={deep}
          strokeOpacity={0.6}
          strokeWidth={1}
          strokeDasharray="1.6 1.6"
        />
        <text
          y={sealR * 0.5}
          textAnchor="middle"
          fontSize={sealR * 1.3}
          fontWeight={800}
          fill={deep}
          opacity={0.9}
        >
          $
        </text>
      </g>
    </g>
  );
}
