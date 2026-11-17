import { expect, test } from 'claude-code/testing'
import { RULE, SECTION_ID } from '../register'

test('시스템 프롬프트 끝에 선택지 표 규칙을 session 섹션으로 붙인다', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'x', scope: 'shared' }] }))

  const { sections } = await $.prompt.compose({
    model: 'claude-opus-5-5',
    promptModel: 'claude-opus-5-5',
    surfaces: ['terminal'],
    tools: [],
    outputStyle: null,
    traits: [],
  })

  expect(sections.map(s => s.id)).toEqual(['intro', SECTION_ID])
  expect(sections.at(-1)).toEqual({ id: SECTION_ID, text: RULE, scope: 'session' })
})

test('기본 열과 추가 열을 모두 규칙에 담는다', () => {
  for (const column of ['의견', '위험도', '작업량', '되돌리기', '영향 범위', '장점 / 단점', '선행 조건', '유지보수 부담']) {
    expect(RULE).toContain(column)
  }
})
