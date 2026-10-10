export type Checks = 'pass' | 'fail' | 'pending' | 'none'

export type Pr = {
  number: number
  state: 'OPEN' | 'MERGED' | 'CLOSED'
  isDraft: boolean
  checks: Checks
}

export type Deploy = {
  status: 'current' | 'behind' | 'unknown' | 'error'
  deployed: string | null
  main: string | null
}

export type Ship = {
  branch: string
  defaultBranch: string
  dirty: number
  ahead: number | null
  behind: number | null
  hasUpstream: boolean
  isInMain: boolean
  pr: Pr | null
  deploy: Deploy | null
}

declare module 'claude-code' {
  interface PluginState {
    'ship-band': { ship: Ship | null }
  }
}
