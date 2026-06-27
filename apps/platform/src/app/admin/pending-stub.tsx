import Link from 'next/link'

// Shared empty-state for admin sections whose implementation is pending.
// Each stub page links to its own handoff brief so the delegated Claude
// session has a direct path in, and the admin (you) can see what's
// coming without guessing.

export function PendingStub({
  title,
  brief,
  eventualFeatures,
}: {
  title: string
  brief: string
  eventualFeatures: string[]
}) {
  return (
    <div className="space-y-6">
      <header>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          NOT YET IMPLEMENTED
        </span>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-stone-900">
          {title}
        </h1>
        <p className="text-sm text-stone-500 mt-2 max-w-2xl">
          This admin surface is scaffolded and reserved. Implementation lives in{' '}
          <code className="bg-stone-100 px-1.5 py-0.5 rounded text-[11px] font-mono">
            {brief}
          </code>
          .
        </p>
      </header>

      <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-6">
        <div className="text-[11px] text-stone-500 tracking-wider mb-4 font-semibold">
          WHEN BUILT, THIS PAGE WILL SHOW
        </div>
        <ul className="space-y-2.5 text-sm text-stone-700">
          {eventualFeatures.map((f, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-emerald-500 mt-1 leading-none">•</span>
              <span className="leading-snug">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-xs">
        <Link
          href="/"
          className="text-emerald-700 hover:text-emerald-800 hover:underline"
        >
          ← Back to admin overview
        </Link>
      </div>
    </div>
  )
}
