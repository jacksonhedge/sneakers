import { useId, type SVGProps } from 'react';

export type CoinType = 'penny' | 'nickel' | 'dime' | 'quarter';

// Flat-vector US coins with a metal-sheen gradient, raised rim, inset border,
// and stamped denomination. Drawn centered on (0,0) so GSAP's motion-path
// alignment and static placement both work from a simple translate.
const COIN_SPEC: Record<
  CoinType,
  {
    r: number;
    label: string;
    light: string; // sheen top-left
    face: string; // base metal
    dark: string; // shading bottom-right
    edge: string; // coin edge (outermost)
    stamp: string; // denomination + inset ring
    reeded: boolean;
  }
> = {
  penny: {
    r: 15,
    label: '1¢',
    light: '#D5A97E',
    face: '#AA7C4F',
    dark: '#87603C',
    edge: '#745233',
    stamp: '#67482B',
    reeded: false,
  },
  nickel: {
    r: 17,
    label: '5¢',
    light: '#E7EAEE',
    face: '#C3C7CD',
    dark: '#989FA9',
    edge: '#848B96',
    stamp: '#6B7280',
    reeded: false,
  },
  dime: {
    r: 12,
    label: '10¢',
    light: '#F0F2F5',
    face: '#D5DAE1',
    dark: '#A8B0BC',
    edge: '#939CA9',
    stamp: '#727C8A',
    reeded: true,
  },
  quarter: {
    r: 20,
    label: '25¢',
    light: '#EBEDF1',
    face: '#C7CCD4',
    dark: '#9AA2AE',
    edge: '#868E9B',
    stamp: '#68717F',
    reeded: true,
  },
};

interface CoinProps extends SVGProps<SVGGElement> {
  type: CoinType;
}

export function Coin({ type, ...rest }: CoinProps) {
  const s = COIN_SPEC[type];
  const uid = useId();
  const metalId = `coin-metal-${uid}`;

  // Thin specular crescent along the top-left of the rim.
  const hr = s.r - 2.4;
  const a1 = (215 * Math.PI) / 180;
  const a2 = (295 * Math.PI) / 180;
  const crescent = `M ${(Math.cos(a1) * hr).toFixed(2)} ${(Math.sin(a1) * hr).toFixed(2)} A ${hr} ${hr} 0 0 1 ${(Math.cos(a2) * hr).toFixed(2)} ${(Math.sin(a2) * hr).toFixed(2)}`;

  return (
    <g {...rest}>
      <defs>
        <linearGradient id={metalId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={s.light} />
          <stop offset="45%" stopColor={s.face} />
          <stop offset="100%" stopColor={s.dark} />
        </linearGradient>
      </defs>

      {/* coin edge */}
      <circle r={s.r} fill={s.edge} />
      {s.reeded && (
        <circle
          r={s.r - 0.7}
          fill="none"
          stroke={s.stamp}
          strokeWidth={1.4}
          strokeDasharray="1 1.6"
        />
      )}

      {/* raised face with metal sheen */}
      <circle r={s.r - 1.7} fill={`url(#${metalId})`} />

      {/* inset border between rim and field */}
      <circle
        r={s.r - 4.2}
        fill="none"
        stroke={s.stamp}
        strokeOpacity={0.35}
        strokeWidth={0.8}
      />

      {/* specular crescent */}
      <path
        d={crescent}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity={0.55}
        strokeWidth={1.1}
        strokeLinecap="round"
      />

      {/* stamped denomination */}
      <text
        y={s.r * 0.32}
        textAnchor="middle"
        fontSize={s.r * 0.72}
        fontWeight={800}
        fill={s.stamp}
        style={{ letterSpacing: '-0.03em' }}
      >
        {s.label}
      </text>
    </g>
  );
}
