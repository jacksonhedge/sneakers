// Four drawings for the home page, one per thing the app does (pay, request, split, groups). Drawn here in the sticker look, not screenshots:
// cream cards, navy outlines and drops, the icon red and the shoes' blue. Every figure is play money and the names are made up.
export const RED = "#E03A3E";
export const CREAM = "#FFF3D6";
export const NAVY = "#0B1E3F";
export const BLUE = "#2B5FB4";

const card = (tilt: number) => ({
  background: CREAM,
  color: NAVY,
  border: `0.2rem solid ${NAVY}`,
  borderRadius: "1.5rem",
  boxShadow: `0.35rem 0.4rem 0 ${NAVY}`,
  transform: `rotate(${tilt}deg)`,
});

function Chip({
  letter,
  bg = NAVY,
  size = "2rem",
}: {
  letter: string;
  bg?: string;
  size?: string;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        background: bg,
        color: CREAM,
        fontSize: `calc(${size} * 0.45)`,
      }}
    >
      {letter}
    </span>
  );
}

/** A friend paid you back: the moment itself. */
export function PaidVisual() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto w-full max-w-[22rem] p-6"
      style={card(-3)}
    >
      <div className="flex items-center gap-3">
        <Chip letter="S" bg={RED} size="2.75rem" />
        <div className="leading-tight">
          <div className="text-lg font-bold">Sam paid you</div>
          <div className="text-sm opacity-70">Pizza night</div>
        </div>
      </div>
      <div className="mt-5 text-center text-[3.5rem] font-bold leading-none tracking-tight">
        $12.00
      </div>
      <div className="mt-5 flex justify-center">
        <span
          className="rounded-full px-4 py-1.5 text-sm font-bold"
          style={{ background: NAVY, color: CREAM }}
        >
          Play money
        </span>
      </div>
    </div>
  );
}

/** A request with a note that sounds like a person. */
export function RequestVisual() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex w-full max-w-[22rem] flex-col gap-3"
    >
      <div
        className="ml-auto max-w-[85%] px-5 py-3 text-base font-semibold"
        style={{
          ...card(2),
          borderRadius: "1.4rem 1.4rem 0.3rem 1.4rem",
          background: RED,
          color: CREAM,
        }}
      >
        You owe me $12.00. The pizza was great, the receipt is not.
      </div>
      <div
        className="max-w-[70%] px-5 py-3 text-base font-semibold"
        style={{ ...card(-2), borderRadius: "1.4rem 1.4rem 1.4rem 0.3rem" }}
      >
        On it.
      </div>
      <div
        className="ml-auto flex items-center gap-3 px-5 py-3"
        style={card(1)}
      >
        <span className="text-base font-bold">Pay $12.00</span>
        <Chip letter="✓" bg={BLUE} size="1.75rem" />
      </div>
    </div>
  );
}

/** One bill, four shares. */
export function SplitVisual() {
  const shares: [string, string][] = [
    ["J", "Jo"],
    ["M", "Max"],
    ["D", "Dee"],
    ["S", "Sam"],
  ];
  return (
    <div
      aria-hidden="true"
      className="mx-auto w-full max-w-[22rem] p-6"
      style={card(3)}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-bold">Dinner</span>
        <span className="text-2xl font-bold tracking-tight">$84.00</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {shares.map(([l, name], i) => (
          <div
            key={name}
            className="flex items-center gap-2 rounded-2xl px-3 py-2"
            style={{
              background: `${NAVY}12`,
              transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)`,
            }}
          >
            <Chip letter={l} bg={i === 3 ? RED : NAVY} size="1.9rem" />
            <span className="leading-tight">
              <span className="block text-sm font-bold">{name}</span>
              <span className="block text-sm opacity-70">$21.00</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** One shared tab for a trip. */
export function GroupVisual() {
  const rows: [string, string, string][] = [
    ["J", "Jo", "+ $40.00"],
    ["M", "Max", "− $25.00"],
    ["D", "Dee", "− $15.00"],
  ];
  return (
    <div
      aria-hidden="true"
      className="mx-auto w-full max-w-[22rem] p-6"
      style={card(-2)}
    >
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold">Beach weekend</span>
        <span
          className="rounded-full px-3 py-1 text-xs font-bold"
          style={{ background: BLUE, color: CREAM }}
        >
          4 friends
        </span>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {rows.map(([l, name, amount]) => (
          <div key={name} className="flex items-center gap-3">
            <Chip letter={l} size="2rem" />
            <span className="flex-1 text-base font-bold">{name}</span>
            <span className="text-base font-bold">{amount}</span>
          </div>
        ))}
      </div>
      <div
        className="mt-5 rounded-full py-2 text-center text-base font-bold"
        style={{
          background: RED,
          color: CREAM,
          boxShadow: `0.15rem 0.2rem 0 ${NAVY}`,
        }}
      >
        Settle up
      </div>
    </div>
  );
}
