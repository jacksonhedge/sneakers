'use client'

import { useReducer } from 'react'

// ── Constants ──────────────────────────────────────────────────────────────────
export const PASSWORD_MIN = 8
export const NAME_MIN = 2

// ── Types ──────────────────────────────────────────────────────────────────────
export type Track = 'unknown' | 'login' | 'signup'
export type StepId = 'email' | 'password' | 'name' | 'venues' | 'confirm' | 'loginPassword'
export type Values = { email: string; password: string; name: string; venues: string[] }

// ── Orders ─────────────────────────────────────────────────────────────────────
export const SIGNUP_ORDER: StepId[] = ['email', 'password', 'name', 'venues', 'confirm']
export const LOGIN_ORDER: StepId[] = ['email', 'loginPassword']

// ── State ─────────────────────────────────────────────────────────────────────
interface FlowState {
  track: Track
  index: number
  values: Values
  visited: StepId[]
}

const initialValues: Values = { email: '', password: '', name: '', venues: [] }

function initialState(entry: 'login' | 'signup'): FlowState {
  // Track ALWAYS starts as 'unknown', regardless of entry.
  // Entry is only a hint for copy; the email existence-check (Task 3) decides the branch via setTrack.
  const track: Track = 'unknown'
  const order = orderFor(track) // always SIGNUP_ORDER for unknown
  const firstStep = order[0]
  return {
    track,
    index: 0,
    values: initialValues,
    visited: [firstStep],
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────
type Action =
  | { type: 'SET'; field: keyof Values; value: string | string[] }
  | { type: 'SET_TRACK'; track: Track }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'GO_TO'; step: StepId }

// ── Pure helpers ───────────────────────────────────────────────────────────────

/** Validate a single step against the current values. Exported for testing. */
export function canAdvanceStep(step: StepId, values: Values): boolean {
  switch (step) {
    case 'email': {
      const at = values.email.indexOf('@')
      if (at < 1) return false // must have non-empty local part before @
      const domain = values.email.slice(at + 1)
      // Domain must have a dot with at least one character after it (a TLD)
      const dot = domain.lastIndexOf('.')
      return dot > 0 && dot < domain.length - 1
    }
    case 'password':
      return values.password.length >= PASSWORD_MIN
    case 'name':
      return values.name.trim().length >= NAME_MIN
    case 'venues':
      return true
    case 'confirm':
      return true
    case 'loginPassword':
      return values.password.length >= 1
  }
}

function orderFor(track: Track): StepId[] {
  return track === 'login' ? LOGIN_ORDER : SIGNUP_ORDER
}

/** Pure reducer — exported for testing without React. */
export function reducer(state: FlowState, action: Action): FlowState {
  const order = orderFor(state.track)

  switch (action.type) {
    case 'SET': {
      const values = { ...state.values, [action.field]: action.value }
      return { ...state, values }
    }

    case 'SET_TRACK': {
      const newTrack = action.track
      const newOrder = orderFor(newTrack)
      // setTrack is called by Task 3 after the email existence check resolves
      // the branch.  Both orders share 'email' at index 0, so after resolving
      // we advance to index 1 (the first post-email step in the resolved order).
      // We clamp to the last valid index to be safe.
      const newIndex = Math.min(state.index + 1, newOrder.length - 1)
      // Rebuild visited: include all steps from the new order up to and
      // including the new index so back()/goTo() can reach email.
      const newVisited = newOrder.slice(0, newIndex + 1)
      return { ...state, track: newTrack, index: newIndex, visited: newVisited }
    }

    case 'NEXT': {
      const currentStep = order[state.index]
      if (!canAdvanceStep(currentStep, state.values)) return state
      const nextIndex = state.index + 1
      if (nextIndex >= order.length) return state // already at last step
      const nextStep = order[nextIndex]
      const visited = state.visited.includes(nextStep)
        ? state.visited
        : [...state.visited, nextStep]
      return { ...state, index: nextIndex, visited }
    }

    case 'BACK': {
      if (state.index === 0) return state
      return { ...state, index: state.index - 1 }
    }

    case 'GO_TO': {
      if (!state.visited.includes(action.step)) return state // guard forward jumps
      const targetIndex = order.indexOf(action.step)
      if (targetIndex === -1) return state // step not in active order
      return { ...state, index: targetIndex }
    }

    default:
      return state
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface OnboardingFlow {
  step: StepId
  track: Track
  values: Values
  index: number
  order: StepId[]
  canAdvance: boolean
  set(field: keyof Values, value: string | string[]): void
  setTrack(track: Track): void
  next(): void
  back(): void
  goTo(step: StepId): void
}

export function useOnboardingFlow(entry: 'login' | 'signup'): OnboardingFlow {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(entry))

  const order = orderFor(state.track)
  const step = order[state.index]

  return {
    step,
    track: state.track,
    values: state.values,
    index: state.index,
    order,
    canAdvance: canAdvanceStep(step, state.values),
    set(field, value) {
      dispatch({ type: 'SET', field, value })
    },
    setTrack(track) {
      dispatch({ type: 'SET_TRACK', track })
    },
    next() {
      dispatch({ type: 'NEXT' })
    },
    back() {
      dispatch({ type: 'BACK' })
    },
    goTo(step) {
      dispatch({ type: 'GO_TO', step })
    },
  }
}
