import { describe, expect, test } from 'claude-code/testing'

const CASES: [prompt: string, command: string, isAllowed: boolean][] = [
  // 커밋은 막지 않는다
  ['버튼 색 고쳐줘', 'git commit -m "x"', true],
  ['커밋할까?', 'git commit -m "x"', true],
  ['푸시해줘', 'git -C /repo commit -m x', true],

  ['버튼 색 고쳐줘', 'git push', false],
  ['푸시', 'git push', true],
  ['커밋해줘', 'git push', false],
  ['커밋하셈', 'git push', false],
  ['커밋하고 푸시해줘', 'git add . && git commit -m "x" && git push', true],
  ['커밋해줘', 'git add . && git commit -m "x" && git push', false],
  ['커밋하고 올려줘', 'git push origin develop', true],
  ['푸시해줘', 'git -C /repo push', true],
  ['버튼 고쳐줘', 'git -C /repo push', false],
  ['푸시하셈', 'git push', true],
  ['푸시 좀 하셈', 'git push', true],
  ['커밋하고 푸시하셈', 'git add . && git commit -m "x" && git push', true],
  ['푸시하지 마셈', 'git push', false],
  ['버튼 고쳐줘', 'git status', true],
  ['버튼 고쳐줘', 'git log --grep push', true],
  ['버튼 고쳐줘', 'git pull', true],

  // 표기 변형
  ['푸쉬해줘', 'git push', true],
  ['커밋하고 푸쉬해줘', 'git commit -m "x" && git push', true],
  ['이거 push해줘', 'git push', true],

  // 짧은 말투와 다른 동사
  ['푸시 ㄱ', 'git push', true],
  ['푸시 고고', 'git push', true],
  ['커밋 푸시 ㄱ', 'git commit -m "x" && git push', true],
  ['푸시할래?', 'git push', true],
  ['푸시 날려줘', 'git push', true],
  ['푸시 진행해줘', 'git push', true],

  // 어미에 상관없이 하/해/할/합으로 이어지면 지시
  ['푸시하죠', 'git push', true],
  ['푸시해주실래요?', 'git push', true],
  ['푸시해 줄 수 있어?', 'git push', true],
  ['푸시해줘. 근데 이거 왜 이래?', 'git push', true],

  // 의문문과 과거·연결형은 언급
  ['푸시할까?', 'git push', false],
  ['푸시했어?', 'git push', false],
  ['푸시했어', 'git push', false],
  ['커밋하고 푸시 차이가 뭐야?', 'git push', false],
  ['푸시하기 전에 테스트 돌려줘', 'git push', false],
  ['푸시할 때 규칙 알려줘', 'git push', false],

  // 지시가 아닌 언급은 계속 차단
  ['푸시하는 법 알려줘', 'git push', false],
  ['푸시해서 생긴 버그 봐줘', 'git push', false],
  ['푸시해야 하나?', 'git push', false],
  ['push 권한 있어?', 'git push', false],
  ['please push', 'git push', true],
  ['push it', 'git push', true],

  // 부정은 푸시에만 적용
  ['커밋하고 푸시는 하지 마', 'git push', false],
  ['커밋해줘, 푸시는 말고', 'git push', false],
  ['커밋하지 말고 푸시만 해줘', 'git push', true],
  ["commit this but don't push", 'git push', false],

  // 여러 번 나오면 마지막 지시나 금지를 따른다
  ['푸시 안 해도 돼', 'git push', false],
  ['푸시해줘. 아 잠깐 푸시는 하지 마', 'git push', false],
  ['푸시하지 마. 아니 그냥 푸시해줘', 'git push', true],

  // 올려줘는 커밋과 이어질 때만 푸시 지시
  ['버전 올려줘', 'git push', false],
  ['PR 올려줘', 'git push', false],
  ['커밋해서 올려줘', 'git push', true],
]

describe('git push 차단', () => {
  for (const [prompt, command, isAllowed] of CASES) {
    test(`"${prompt}" → ${command} → ${isAllowed ? '허용' : '차단'}`, async ($, on) => {
      on('prompt.submit', (_, e) => ({ text: e.text }))
      on('tool.call', () => ({ result: {} }))

      await $.prompt.submit({ text: prompt, wait: false, origin: { kind: 'composer' } })
      const ran = await $.tool.call({ tool: 'Bash', command })

      expect(ran.deny === undefined).toBe(isAllowed)
    })
  }
})

test('시스템이 넣은 메시지는 지시로 인정하지 않는다', async ($, on) => {
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('tool.call', () => ({ result: {} }))

  await $.prompt.submit({ text: '푸시해줘', isMeta: true, wait: false, origin: { kind: 'composer' } })
  const ran = await $.tool.call({ tool: 'Bash', command: 'git push' })

  expect(ran.deny).toBeDefined()
})

test('작업 알림에 담긴 문구는 지시로 인정하지 않는다', async ($, on) => {
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('tool.call', () => ({ result: {} }))

  await $.prompt.submit({ text: '푸시해줘', wait: false, origin: { kind: 'task-notification' } })
  const ran = await $.tool.call({ tool: 'Bash', command: 'git push' })

  expect(ran.deny).toBeDefined()
})
