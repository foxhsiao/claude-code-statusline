export type Limit = { pct: number; resetsAt: string | null }

export type Info = {
  model: string
  dir: string
  branch: string | null
  add: number
  del: number
  acct: string | null
  ctx: number | null
  h5: Limit | null
  d7: Limit | null
}

declare module 'claude-code' {
  interface PluginState {
    'statusline-capsule': { info: Info | null }
  }
}
