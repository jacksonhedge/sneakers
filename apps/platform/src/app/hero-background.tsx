import Image from 'next/image'

/**
 * Shared hero background: the glowing-shoes photo brought subtly to life.
 *
 * Three GPU-cheap, CSS-only layers (see globals.css → "Hero background
 * ambient motion"): a slow Ken Burns drift on the photo, a glow that
 * breathes over the shoes, and a fog/light wash drifting across. All freeze
 * under prefers-reduced-motion. Pure decoration, so the whole thing is
 * aria-hidden and pointer-events-none.
 *
 * Renders absolutely positioned at -z-10, so any host <main> just needs to
 * be `relative` (and ideally `isolate`/`overflow-hidden`) with its own
 * content at z-0 or above.
 */
export function HeroBackground() {
  return (
    <div
      className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
      aria-hidden
    >
      <Image
        src="/hero-bg.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover hero-kenburns"
      />
      {/* Warm glow breathing over the shoes */}
      <div className="hero-glow" />
      {/* Soft fog/light drift */}
      <div className="hero-fog" />
    </div>
  )
}
