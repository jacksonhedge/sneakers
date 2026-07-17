import type { ChatAdapter, ChatRequest, ChatResult } from './types'
import { chatWithOpenAICompatible } from './openai'

/**
 * Moonshot (Kimi) adapter — uses the `openai` SDK pointed at Moonshot's
 * OpenAI-compatible endpoint, same pattern as the xAI adapter.
 */
export const moonshotAdapter: ChatAdapter = {
  provider: 'moonshot',
  async chat(req: ChatRequest): Promise<ChatResult> {
    return chatWithOpenAICompatible({
      ...req,
      baseURL: 'https://api.moonshot.ai/v1',
    })
  },
}
