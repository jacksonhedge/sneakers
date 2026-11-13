import Image from "next/image";
import { PhoneButtons } from "./phone-buttons";
// A drawing of an iPhone showing the app's Pay screen with a play-money send. Every size is in em, and the whole phone scales from one
// width (15.5rem, less on a narrow screen), so it keeps its proportions. Drawn, not a screenshot; the names and amounts are made up.
const RED = "#E03A3E";
const CREAM = "#FFF3D6";
const NAVY = "#0B1E3F";
const TITANIUM =
  "linear-gradient(145deg, #e3e0d8 0%, #9b978e 22%, #cfccc4 48%, #8a867e 74%, #d6d3cb 100%)";
const SYSTEM =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif';

// The side keys sit on the frame's outer edge: [side, top, height] in em.
const KEYS: ["left" | "right", number, number][] = [
  ["left", 6.6, 1.5], // action button
  ["left", 9.4, 2.7], // volume up
  ["left", 12.7, 2.7], // volume down
  ["right", 10, 4.4], // power
];

function StatusBar() {
  return (
    <div
      className="relative flex items-center justify-between"
      style={{
        height: "2.7em",
        padding: "0.2em 1.55em 0",
        fontSize: "0.8em",
        fontWeight: 600,
        color: NAVY,
      }}
    >
      <span style={{ letterSpacing: "-0.01em" }}>9:41</span>
      <span className="flex items-center" style={{ gap: "0.3em" }}>
        <svg width="1.15em" height="0.75em" viewBox="0 0 18 12" fill={NAVY}>
          <rect x="0" y="8" width="3" height="4" rx="0.8" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="0.8" />
          <rect x="10" y="3" width="3" height="9" rx="0.8" />
          <rect x="15" y="0" width="3" height="12" rx="0.8" />
        </svg>
        <svg
          width="1.05em"
          height="0.78em"
          viewBox="0 0 17 12"
          fill="none"
          stroke={NAVY}
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M1.2 4.4a10 10 0 0 1 14.6 0" />
          <path d="M3.8 7.1a6.3 6.3 0 0 1 9.4 0" />
          <circle cx="8.5" cy="10.2" r="1.1" fill={NAVY} stroke="none" />
        </svg>
        <svg width="1.7em" height="0.8em" viewBox="0 0 27 12" fill="none">
          <rect
            x="0.6"
            y="0.6"
            width="22.8"
            height="10.8"
            rx="3.2"
            stroke={NAVY}
            strokeOpacity="0.45"
            strokeWidth="1.2"
          />
          <rect
            x="2.2"
            y="2.2"
            width="19.6"
            height="7.6"
            rx="1.8"
            fill={NAVY}
          />
          <path d="M25 4v4a2 2 0 0 0 0-4z" fill={NAVY} fillOpacity="0.45" />
        </svg>
      </span>
    </div>
  );
}

export function Phone({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`sneakers-phone relative mx-auto select-none ${className}`}
      style={{
        fontSize: "calc(min(15.5rem, 62vw) / 15.5)",
        width: "15.5em",
        aspectRatio: "9 / 19.5",
        transform: "rotate(6deg)",
        fontFamily: SYSTEM,
        filter: "drop-shadow(0 1.4em 1.6em rgba(11, 30, 63, 0.45))",
      }}
    >
      {KEYS.map(([side, top, height]) => (
        <span
          key={`${side}-${top}`}
          className="absolute"
          style={{
            [side]: "-0.16em",
            top: `${top}em`,
            width: "0.22em",
            height: `${height}em`,
            background: TITANIUM,
            borderRadius: "0.1em",
          }}
        />
      ))}
      {/* Titanium frame, then the black bezel, then the glass. */}
      <div
        className="absolute inset-0"
        style={{
          background: TITANIUM,
          borderRadius: "2.9em",
          padding: "0.32em",
        }}
      >
        <div
          className="relative h-full w-full"
          style={{
            background: "#05070c",
            borderRadius: "2.6em",
            padding: "0.36em",
          }}
        >
          <div
            className="relative flex h-full w-full flex-col overflow-hidden"
            style={{ background: CREAM, borderRadius: "2.25em", color: NAVY }}
          >
            <StatusBar />
            {/* The Dynamic Island. */}
            <span
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                top: "0.62em",
                width: "5.2em",
                height: "1.5em",
                background: "#05070c",
                borderRadius: "1em",
              }}
            />

            <div
              className="flex items-center justify-between"
              style={{ padding: "0.5em 1.3em 0", fontSize: "0.8em" }}
            >
              <span style={{ fontSize: "1.4em", lineHeight: 1 }}>‹</span>
              <span style={{ fontWeight: 700 }}>Pay</span>
              {/* The app's own sticker wordmark, where the old badge was. */}
              <Image src="/sneakers-wordmark-sticker.svg" alt="Sneakers" width={1950} height={374} style={{ height: "1.15em", width: "auto" }} />
            </div>

            <div
              className="flex flex-col items-center"
              style={{ paddingTop: "1.5em" }}
            >
              <span
                className="flex items-center justify-center font-bold"
                style={{
                  width: "3.4em",
                  height: "3.4em",
                  borderRadius: "50%",
                  background: RED,
                  color: CREAM,
                  fontSize: "1.15em",
                  boxShadow: `0.12em 0.16em 0 ${NAVY}`,
                }}
              >
                S
              </span>
              <span
                style={{
                  marginTop: "0.55em",
                  fontSize: "0.95em",
                  fontWeight: 700,
                }}
              >
                Sam
              </span>
              <span style={{ fontSize: "0.7em", opacity: 0.6 }}>@sam</span>
              <span
                style={{
                  marginTop: "1em",
                  fontSize: "3.1em",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                }}
              >
                $12.00
              </span>
              <span
                style={{
                  marginTop: "0.7em",
                  background: `${NAVY}14`,
                  borderRadius: "99em",
                  padding: "0.28em 0.9em",
                  fontSize: "0.75em",
                  fontWeight: 600,
                }}
              >
                Pizza night
              </span>
            </div>

            <PhoneButtons />

            {/* Home indicator. */}
            <span
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                bottom: "0.5em",
                width: "5.4em",
                height: "0.3em",
                background: NAVY,
                borderRadius: "99em",
                opacity: 0.85,
              }}
            />
            {/* A faint glass reflection. */}
            <span
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(115deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 32%)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
