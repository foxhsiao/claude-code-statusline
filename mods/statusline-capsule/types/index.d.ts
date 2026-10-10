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

// the parts that need the network (fetch, gh, the deploy URL); read apart from Info and at most once a minute
export type Remote = {
  branch: string
  defaultBranch: string
  isInMain: boolean
  pr: Pr | null
  deploy: Deploy | null
}

export type Limit = { pct: number; resetsAt: string | null }

export type Info = {
  model: string
  dir: string
  branch: string | null
  add: number
  del: number
  ahead: number
  behind: number
  hasUpstream: boolean
  acct: string | null
  ctx: number | null
  h5: Limit | null
  d7: Limit | null
}

declare module 'claude-code' {
  interface PluginState {
    'statusline-capsule': { info: Info | null; remote: Remote | null }
  }
}
