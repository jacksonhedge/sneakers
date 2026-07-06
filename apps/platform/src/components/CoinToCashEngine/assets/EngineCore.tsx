import { useId, type ReactNode, type SVGProps } from 'react';

// The single focal point: 3 concentric blue-gradient rings on a dark navy
// isometric pedestal, with a soft glow behind and beneath. Drawn centered on
// (0,0) at the ring center; the pedestal hangs below.
//
// `mark` swaps the center glyph for a brand mark — one-line change.
interface EngineCoreProps extends SVGProps<SVGGElement> {
  mark?: ReactNode;
}

const RING_DEEP = '#1D4ED8';
const RING_MID = '#3B82F6';
const CORE_LIGHT = '#BFDBFE';
const GLOW = '#60A5FA';
const PEDESTAL_TOP = '#1B2440';
const PEDESTAL_SIDE = '#0B1220';
const PEDESTAL_BEVEL = '#33406B';

export function EngineCore({ mark, ...rest }: EngineCoreProps) {
  const uid = useId();
  const glowId = `ctc-glow-${uid}`;
  const ringId = `ctc-ring-${uid}`;
  const coreId = `ctc-core-${uid}`;
  const sideId = `ctc-side-${uid}`;
  const shadowId = `ctc-shadow-${uid}`;

  return (
    <g {...rest}>
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0%" stopColor={GLOW} stopOpacity={0.55} />
          <stop offset="55%" stopColor={GLOW} stopOpacity={0.22} />
          <stop offset="100%" stopColor={GLOW} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={shadowId}>
          <stop offset="0%" stopColor="#0F172A" stopOpacity={0.18} />
          <stop offset="100%" stopColor="#0F172A" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={ringId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={RING_MID} />
          <stop offset="100%" stopColor={RING_DEEP} />
        </linearGradient>
        <radialGradient id={coreId}>
          <stop offset="0%" stopColor="#EFF6FF" />
          <stop offset="100%" stopColor={CORE_LIGHT} />
        </radialGradient>
        <linearGradient id={sideId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={PEDESTAL_SIDE} />
          <stop offset="50%" stopColor={PEDESTAL_TOP} />
          <stop offset="100%" stopColor={PEDESTAL_SIDE} />
        </linearGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cy={112} rx={96} ry={17} fill={`url(#${shadowId})`} />

      {/* glow — pulsed by the timeline on each coin arrival */}
      <ellipse
        data-ctc-glow=""
        cy={22}
        rx={112}
        ry={86}
        fill={`url(#${glowId})`}
      />

      {/* pedestal: isometric puck (bottom ellipse + side wall + beveled top) */}
      <g>
        <ellipse cx={0} cy={90} rx={70} ry={24} fill={PEDESTAL_SIDE} />
        <rect x={-70} y={64} width={140} height={26} fill={`url(#${sideId})`} />
        <ellipse
          cx={0}
          cy={64}
          rx={70}
          ry={24}
          fill={PEDESTAL_TOP}
          stroke={PEDESTAL_BEVEL}
          strokeWidth={1.5}
        />
      </g>

      {/* concentric rings */}
      <circle r={47} fill="none" stroke={`url(#${ringId})`} strokeWidth={9} />
      <circle
        r={33}
        fill="none"
        stroke={`url(#${ringId})`}
        strokeWidth={9}
        opacity={0.85}
      />
      <circle r={20} fill={`url(#${coreId})`} />
      {mark ?? (
        <text
          y={7}
          textAnchor="middle"
          fontSize={20}
          fontWeight={800}
          fill={RING_DEEP}
        >
          $
        </text>
      )}

      {/* flash overlay — opacity-pulsed on coin arrival */}
      <g data-ctc-flash="" opacity={0}>
        <circle r={47} fill="none" stroke="#93C5FD" strokeWidth={9} />
        <circle r={33} fill="none" stroke="#BFDBFE" strokeWidth={9} />
      </g>

      {/* ripple ring — expands outward as each coin is consumed */}
      <circle
        data-ctc-ripple=""
        r={24}
        fill="none"
        stroke={RING_MID}
        strokeWidth={2.5}
        opacity={0}
      />
    </g>
  );
}
