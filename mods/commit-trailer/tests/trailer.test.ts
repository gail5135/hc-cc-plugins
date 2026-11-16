import { describe, expect, test } from 'claude-code/testing'

const STEP = { turnId: 't', index: 0, model: 'claude-opus-5-5', messageCount: 1 }
const CONTACT = `--trailer 'Contact: 홍길동 (gildong@example.com)'`

type Env = Parameters<Parameters<typeof test>[1]>

// git config 값과 Bash로 넘어간 명령을 기록한다.
const setup = ($: Env[0], on: Env[1], config: Record<string, string> = {}, envEffort?: string) => {
  const ran: string[] = []
  const cwds: (string | undefined)[] = []
  const values: Record<string, string> = { 'user.name': '홍길동', 'user.email': 'gildong@example.com', ...config }

  on('session.model', () => ({ value: 'claude-opus-5-5[1m]' }))
  on('env.get', () => ({ value: envEffort }) as never)
  on('process.run', (_, e) => {
    cwds.push(e.init?.cwd)
    const value = values[e.argv.at(-1) ?? ''] ?? ''

    return {
      value: {
        exitCode: value ? 0 : 1,
        stdout: value ? `${value}\n` : '',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  on('turn.step', async function* (_, e) {
    yield { kind: 'text', index: 0, text: 'x' } as never

    return { turnId: e.turnId, index: e.index, answer: 'x', toolUses: [] } as never
  })
  on('tool.call', (_, e) => {
    if (e.tool === 'Bash') ran.push(e.command)

    return { result: {} }
  })

  const step = async (extra: Record<string, unknown>) => {
    for await (const _ of $.turn.step({ ...STEP, ...extra } as never)) void _
  }

  return { ran, cwds, step }
}

test('메인 루프의 모델과 effort, git 사용자를 trailer로 붙인다', async ($, on) => {
  const { ran, step } = setup($, on)
  await step({ effort: 'high' })

  await $.tool.call({ tool: 'Bash', command: 'git commit -m "x"' })

  expect(ran[0]).toBe(`git commit --trailer 'Coworked-By: Claude Opus 5.5 (high)' ${CONTACT} -m "x"`)
})

test('subagent의 커밋에는 그 subagent의 모델과 effort를 쓴다', async ($, on) => {
  const { ran, step } = setup($, on)
  await step({ effort: 'high' })
  await step({ model: 'claude-sonnet-5-5', effort: 'low', agentId: 'a1' })

  await $.tool.call({ tool: 'Bash', command: 'git commit -m x', agentId: 'a1' } as never)

  expect(ran[0]).toContain(`'Coworked-By: Claude Sonnet 5.5 (low)'`)
})

test('모델 요청 전에는 세션 모델과 CLAUDE_EFFORT를 쓴다', async ($, on) => {
  const { ran } = setup($, on, {}, 'medium')

  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })

  expect(ran[0]).toContain(`'Coworked-By: Claude Opus 5.5 (medium)'`)
})

test('effort를 모르면 괄호를 붙이지 않는다', async ($, on) => {
  const { ran, step } = setup($, on)
  await step({})

  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })

  expect(ran[0]).toContain(`'Coworked-By: Claude Opus 5.5' `)
})

test('git -C 경로의 저장소에서 사용자 정보를 읽는다', async ($, on) => {
  const { ran, cwds, step } = setup($, on)
  await step({ effort: 'high' })

  await $.tool.call({ tool: 'Bash', command: 'git -C /repo commit -m x' })

  expect(cwds).toEqual(['/repo', '/repo'])
  expect(ran[0]).toBe(`git -C /repo commit --trailer 'Coworked-By: Claude Opus 5.5 (high)' ${CONTACT} -m x`)
})

test('한 명령에 커밋이 여러 번 있으면 모두 붙인다', async ($, on) => {
  const { ran, step } = setup($, on)
  await step({ effort: 'high' })

  await $.tool.call({ tool: 'Bash', command: 'git add . && git commit -m a && git commit --amend --no-edit' })

  expect(ran[0]?.match(/--trailer 'Coworked-By/g)).toHaveLength(2)
})

test('작은따옴표가 든 이름도 셸에서 깨지지 않게 감싼다', async ($, on) => {
  const { ran, step } = setup($, on, { 'user.name': "O'Neil" })
  await step({ effort: 'high' })

  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })

  expect(ran[0]).toContain(`--trailer 'Contact: O'\\''Neil (gildong@example.com)'`)
})

test('git 사용자 정보가 없으면 Contact를 붙이지 않는다', async ($, on) => {
  const { ran, step } = setup($, on, { 'user.name': '', 'user.email': '' })
  await step({ effort: 'high' })

  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })

  expect(ran[0]).toBe(`git commit --trailer 'Coworked-By: Claude Opus 5.5 (high)' -m x`)
})

describe('커밋이 아닌 명령은 그대로 둔다', () => {
  for (const command of ['git status', 'git log --grep commit', 'git commit-tree HEAD^{tree}', 'echo commit']) {
    test(command, async ($, on) => {
      const { ran } = setup($, on)

      await $.tool.call({ tool: 'Bash', command })

      expect(ran[0]).toBe(command)
    })
  }
})
