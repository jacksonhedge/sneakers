import type { AgentModel, Venue } from './types'

export const CATALOG: AgentModel[] = [
  {
    id: 'updown', name: 'Up/Down', color: 'updown', emoji: '🎢', by: 'Sneakers Labs',
    perf30d: 14.6, runners: 2340, priceCents: null, included: true, featured: false,
    status: 'live', kind: 'prompt',
    description: 'The flagship. Trades every Bitcoin and crypto up/down market on Kalshi and Polymarket - 5 and 15-minute windows, both directions. Included with your Sneakers plan.',
  },
  {
    id: 'longshot', name: 'Longshot v3', color: 'green', emoji: '🐎', by: 'you',
    perf30d: 9.4, runners: 1, priceCents: null, mine: true, status: 'private', kind: 'prompt',
    description: 'Your model. Trades 5 & 15-minute crypto windows, favoring longshots priced 10-35c with momentum confirmation. Max 5% of bankroll per trade.',
  },
  {
    id: 'oddsjam', name: 'OddsJam', color: 'oddsjam', brand: 'oddsjam', by: 'OddsJam',
    perf30d: null, runners: 0, priceCents: 1999, priceLabel: 'From $1 per day',
    featured: true, status: 'live', kind: 'connected',
    tagline: 'The best sports/predictions agent',
    description: 'The best sports & predictions agent. Powered by OddsJam\'s live odds data across every major sportsbook and prediction market - finds +EV lines and trades them for you.',
  },
  {
    id: 'gambly', name: 'Gambly', color: 'gambly', brand: 'gambly', by: 'Gambly.com',
    perf30d: null, runners: 0, priceCents: 1499, featured: true, status: 'live', kind: 'connected',
    tagline: 'Gambly.com\'s official agent',
    description: 'Gambly.com\'s official trading agent. Brings Gambly\'s picks and community signal straight to your bankroll - it plays, you watch the balance.',
  },
  {
    id: 'wave', name: 'Wave Rider', color: 'blue', emoji: '🏄', by: 'Sneakers Labs',
    perf30d: 18.2, runners: 1204, priceCents: 999, status: 'live', kind: 'prompt',
    description: 'Rides momentum across consecutive 5-minute windows. Enters on book imbalance, exits into strength. Best in trending sessions.',
  },
  {
    id: 'drift', name: 'Overnight Drift', color: 'purple', emoji: '🦉', by: 'Sneakers Labs',
    perf30d: 11.7, runners: 862, priceCents: 499, status: 'live', kind: 'prompt',
    description: 'Trades the quiet hours - fades overreactions on low-liquidity overnight windows when spreads widen.',
  },
  {
    id: 'sniper', name: 'Cent Sniper', color: 'gold', emoji: '🎯', by: '@quantfrat',
    perf30d: 8.9, runners: 315, priceCents: 299, status: 'live', kind: 'prompt',
    description: 'Hunts mispriced 1-5c tails minutes before settle. Small size, high frequency, strict loss ceiling.',
  },
  {
    id: 'news', name: 'News Reactor', color: 'red', emoji: '🗞️', by: 'community',
    perf30d: null, runners: 0, priceCents: null, status: 'review', kind: 'prompt',
    description: 'Reacts to headline momentum within seconds. Currently in review — subscribable once it clears the vetting run.',
  },
]

export function marketplaceModels(models: AgentModel[]): AgentModel[] {
  return models
    .filter(m => !m.mine)
    .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
}

export const VENUE_META: Record<Venue, { label: string; abbr: string; bg: string }> = {
  kalshi:     { label: 'Kalshi',     abbr: 'K',  bg: '#2FD37A' },
  polymarket: { label: 'Polymarket', abbr: 'P',  bg: '#8fb0ff' },
  prophetx:   { label: 'ProphetX',   abbr: 'Px', bg: '#e3c56b' },
}
