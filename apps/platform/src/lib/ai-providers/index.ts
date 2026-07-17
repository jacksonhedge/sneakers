import { anthropicAdapter } from './anthropic'
import { openaiAdapter } from './openai'
import { googleAdapter } from './google'
import { xaiAdapter } from './xai'
import { moonshotAdapter } from './moonshot'
import type { ChatAdapter } from './types'

const ADAPTERS: Record<ChatAdapter['provider'], ChatAdapter> = {
  anthropic: anthropicAdapter,
  openai: openaiAdapter,
  google: googleAdapter,
  xai: xaiAdapter,
  moonshot: moonshotAdapter,
}

export function getAdapter(provider: ChatAdapter['provider']): ChatAdapter {
  return ADAPTERS[provider]
}

export * from './types'
