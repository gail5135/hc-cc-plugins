import type { EngineInterface, Register } from 'claude-code'

// git 뒤의 전역 옵션(-C path, -c k=v 등)을 건너뛰어 commit 하위 명령을 찾는다. commit-tree 같은 다른 명령은 제외한다.
const GIT_COMMIT = /\bgit\b((?:\s+-\S+(?:\s+(?!commit\b)[^\s-]\S*)?)*)\s+commit(?![\w-])/g
const GIT_DIR = /(?:^|\s)-C\s+(?:'([^']*)'|"([^"]*)"|(\S+))/

const MAIN = 'main'

type Step = { model: string; effort?: string }

// 루프(메인, subagent)마다 마지막 모델 요청의 모델과 effort. 커밋한 루프의 값을 쓴다.
const steps = new Map<string, Step>()

const formatModel = (model: string) => {
  const match = /^claude-([a-z]+)-(\d+)-(\d+)/.exec(model)
  if (!match) return model

  const [, family = '', major, minor] = match

  return `Claude ${family.charAt(0).toUpperCase()}${family.slice(1)} ${major}.${minor}`
}

const quote = (text: string) => `'${text.replaceAll("'", `'\\''`)}'`

const gitConfig = async ($: EngineInterface, key: string, cwd: string | undefined) => {
  const ran = await $.process.run(['git', 'config', key], cwd === undefined ? {} : { cwd }).catch(() => undefined)

  return ran?.exitCode === 0 ? ran.stdout.trim() : ''
}

// 모델 요청 전이면 세션 모델과 엔진이 넘기는 CLAUDE_EFFORT를 쓴다.
const coworker = async ($: EngineInterface, agentId: string | undefined) => {
  const step = steps.get(agentId ?? MAIN)
  const model = step?.model ?? (await $.session.model().catch(() => ''))
  const effort = step ? step.effort : await $.env.get('CLAUDE_EFFORT').catch(() => undefined)

  return effort ? `${formatModel(model)} (${effort})` : formatModel(model)
}

const contact = async ($: EngineInterface, cwd: string | undefined) => {
  const [name, email] = await Promise.all([gitConfig($, 'user.name', cwd), gitConfig($, 'user.email', cwd)])
  if (!name && !email) return undefined

  return email ? `${name} (${email})`.trim() : name
}

export const register: Register = on => {
  on('turn.step', async function* ($, e, next) {
    steps.set(e.agentId ?? MAIN, { model: e.model, effort: e.effort === undefined ? undefined : String(e.effort) })

    return yield* next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const commits = [...e.command.matchAll(GIT_COMMIT)]
    if (commits.length === 0) return next(e)

    const by = await coworker($, e.agentId)
    let command = e.command

    // 뒤에서부터 끼워 넣어야 앞쪽 위치가 밀리지 않는다.
    for (const match of commits.reverse()) {
      const dir = GIT_DIR.exec(match[1] ?? '')
      const cwd = dir ? (dir[1] ?? dir[2] ?? dir[3]) : undefined
      const who = await contact($, cwd)
      const trailers = [`Coworked-By: ${by}`, ...(who ? [`Contact: ${who}`] : [])]
      const end = (match.index ?? 0) + match[0].length

      command = `${command.slice(0, end)} ${trailers.map(t => `--trailer ${quote(t)}`).join(' ')}${command.slice(end)}`
    }

    return next({ ...e, command })
  }).catch(($, e, next) => next(e))
}
