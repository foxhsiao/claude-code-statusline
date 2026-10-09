export type Info = {
  model: string
  dir: string
  branch: string | null
  add: number
  del: number
  acct: string | null
  ctx: number | null
  h5: number | null
  d7: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'statusline-capsule': { info: Info | null }
  }
}
