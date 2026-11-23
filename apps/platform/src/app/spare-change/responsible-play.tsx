// The page's responsible-gambling footer: who it's for, where it's legal, where to get help, and what the stories above are.
const sauce = 'var(--font-open-sauce), sans-serif'

export function ResponsiblePlay() {
  return (
    <footer className="flex max-w-md flex-col gap-2 text-sm leading-relaxed" style={{ fontFamily: sauce }}>
      <p className="m-0 font-bold">18+ only (21+ on some sites), and only where the site is legal in your state.</p>
      <p className="m-0">
        Gambling problem? Call{' '}
        <a href="tel:18004262537" className="font-bold underline">
          1-800-GAMBLER
        </a>
        .
      </p>
      <p className="m-0">Long shots miss far more often than they hit. Play only what you can afford to lose, set a limit before you start, and take a break when it stops being fun.</p>
      <p className="m-0 opacity-90">The tickets on this page are real results from other people, linked to their sources. They aren&apos;t typical, and they aren&apos;t ours.</p>
    </footer>
  )
}
