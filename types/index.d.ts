// git-guard
export type LastPrompt = string

// usage-panel
export type UsageWindow = { kind: string; percentUsed: number; resetsAt?: string }

// url은 원격 저장소의 웹 커밋 페이지. 원격이 없거나 주소를 읽지 못하면 없다.
export type CommitGroup = { branch: string; commits: { hash: string; subject: string; url?: string }[] }

export type AskedQuestion = { id: string; text: string }

export type AgentRow = { id: string; type: string; description: string; status: string }

export type UsageSnapshot = {
  contextTokens?: number
  contextWindow: number
  contextPercent?: number
  rateLimits: UsageWindow[]
  costUsd?: number
  measuredAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'hc-cc-plugins': {
      // git-guard
      lastPrompt: LastPrompt
      // usage-panel
      snapshot: Shaped<UsageSnapshot | null>; questionPage: number | null; effortLevel: string; modelName: string; devServer: string; gitBranch: string; utcOffsetMinutes: number | null; agents: Shaped<AgentRow[]>; commitGroups: Shaped<CommitGroup[]>; questions: Shaped<AskedQuestion[]> }
  }
}
