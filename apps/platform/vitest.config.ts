import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/app/agent/lib/**/*.test.ts'],
    environment: 'node',
  },
})
