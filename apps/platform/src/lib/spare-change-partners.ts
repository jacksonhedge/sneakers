// The sites shown around the Spare Change Millionaire page: a logo, where a tap goes, and how old someone must be there.
// `href` is the ONE place each link lives. They are plain test links to each site's own front page for now: swap in the real
// partner link for a site here when there is one, and nothing else on the page needs to change.
// `minAge` is only what the tile shows (a small "21+" tag); who may be SENT to a site is decided by SITE_MIN_AGE in spare-change-core.ts.
// Logos are the files in public/SneakersLogos/partners. `tile` is the color behind a logo that has a see-through or white edge.

export interface Partner {
  key: string
  name: string
  logo: string
  href: string
  tile: string
  /** Fill the tile edge to edge (a logo that is already a full square) or sit inside it with a margin. */
  fit: 'cover' | 'contain'
  minAge: number
}

const partner = (key: string, name: string, file: string, href: string, tile: string, fit: Partner['fit'], minAge = 18): Partner => ({ key, name, logo: `/SneakersLogos/partners/${file}`, href, tile, fit, minAge })

export const PARTNERS: readonly Partner[] = [
  partner('prophetx', 'ProphetX', 'prophetx.png', 'https://www.prophetx.co/', '#3FD6A3', 'cover'),
  partner('kalshi', 'Kalshi', 'kalshi.png', 'https://kalshi.com/', '#00D395', 'cover'),
  partner('polymarket', 'Polymarket', 'polymarket.png', 'https://polymarket.com/', '#2E5CFF', 'cover'),
  partner('draftkings', 'DraftKings', 'draftkings_sb.png', 'https://www.draftkings.com/', '#0B0B0B', 'contain', 21),
  partner('fanduel', 'FanDuel', 'fanduel_sb.png', 'https://www.fanduel.com/', '#0A53C6', 'cover', 21),
  partner('prizepicks', 'PrizePicks', 'prizepicks.png', 'https://www.prizepicks.com/', '#FFFFFF', 'contain'),
  partner('underdog', 'Underdog', 'underdog.png', 'https://underdogfantasy.com/', '#FFFFFF', 'contain'),
]

/** Only an https link to the site's own address is ever put on the page. */
export const partnerLinkOk = (p: Partner): boolean => {
  try {
    return new URL(p.href).protocol === 'https:'
  } catch {
    return false
  }
}
