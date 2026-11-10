// A drawing of the app, not a screenshot: the Pay screen with a play-money send, in the same cream-and-navy sticker look as the headline.
const RED = '#E03A3E'
const CREAM = '#FFF3D6'
const NAVY = '#0B1E3F'

export function Phone({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`sneakers-phone relative mx-auto w-[min(15.5rem,62vw)] select-none ${className}`}
      style={{
        aspectRatio: '9 / 18.5',
        background: NAVY,
        borderRadius: '2.4rem',
        padding: '0.55rem',
        boxShadow: `0.5rem 0.6rem 0 ${NAVY}66`,
        transform: 'rotate(6deg)',
      }}
    >
      <div className="flex h-full flex-col overflow-hidden" style={{ background: CREAM, borderRadius: '1.9rem', color: NAVY }}>
        <div className="mx-auto mt-2 h-[0.9rem] w-[34%] rounded-full" style={{ background: NAVY }} />
        <div className="flex items-center justify-between px-4 pt-3 text-[0.62rem] font-semibold">
          <span>Pay</span>
          <span className="rounded-full px-2 py-[0.15rem]" style={{ background: NAVY, color: CREAM }}>
            Play money
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 pt-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold" style={{ background: RED, color: CREAM }}>
            S
          </span>
          <span className="text-[0.7rem] font-semibold leading-tight">
            Sam
            <span className="block text-[0.58rem] font-normal opacity-70">@sam</span>
          </span>
        </div>
        <div className="px-4 pt-5 text-center">
          <div className="text-[2.6rem] font-bold leading-none tracking-tight">$12.00</div>
          <div className="mt-2 text-[0.65rem] opacity-70">Pizza night</div>
        </div>
        <div className="mx-4 mt-6 rounded-full py-2 text-center text-[0.78rem] font-bold" style={{ background: RED, color: CREAM, boxShadow: `0.12rem 0.16rem 0 ${NAVY}` }}>
          Pay Sam
        </div>
        <div className="mx-4 mt-3 rounded-2xl px-3 py-2 text-[0.6rem] leading-snug" style={{ background: `${NAVY}12` }}>
          <span className="font-semibold">Sam got $12.00</span> · just now
        </div>
        <div className="mx-4 mt-5 text-[0.58rem] font-semibold opacity-60">Recent</div>
        {[
          ['Jo', 'Rides home', '$8.50'],
          ['Max', 'Rent split', '$310.00'],
          ['Dee', 'Coffee', '$4.25'],
        ].map(([who, note, amount]) => (
          <div key={who} className="mx-4 mt-2 flex items-center gap-2 text-[0.62rem]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full text-[0.6rem] font-bold" style={{ background: NAVY, color: CREAM }}>
              {who[0]}
            </span>
            <span className="flex-1 font-semibold leading-tight">
              {who}
              <span className="block text-[0.55rem] font-normal opacity-70">{note}</span>
            </span>
            <span className="font-semibold">{amount}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
