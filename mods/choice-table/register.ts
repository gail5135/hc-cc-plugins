import type { Register } from 'claude-code'

export const SECTION_ID = 'hc-cc-plugins:choice-table'

// 매 요청의 시스템 프롬프트 끝(session 쪽)에 붙는다. 캐시가 유지되도록 문구는 고정한다.
export const RULE = `# 선택지는 표로 제시

사용자가 고를 수 있게 둘 이상의 선택지(방법, 설계안, 도구, 다음 작업 등)를 줄 때는 \`1.\`, \`1)\`, 글머리표 목록 대신 항상 Markdown 표로 준다.

기본 열 (항상 넣는다)
- 선택지: 짧은 이름. 추천하는 선택지에는 ⭐를 붙인다.
- 의견: 이 선택지에 대한 판단과 그 이유
- 위험도: 낮음/중간/높음과 짧은 이유
- 작업량: 작음/중간/큼과 무엇이 드는지
- 되돌리기: 쉬움/보통/어려움

추가 열 (해당할 때만 넣는다)
- 영향 범위: 선택지마다 건드리는 파일, 모듈, 사용자가 다를 때
- 장점 / 단점: 선택지가 비슷해서 의견 한 칸으로는 차이가 안 보일 때 (의견 열을 둘로 나눈다)
- 선행 조건: 고르기 전에 필요한 라이브러리, 권한, 다른 작업이 있을 때
- 유지보수 부담: 만든 뒤에도 계속 관리해야 하는 선택지가 섞여 있을 때

표 아래에는 무엇을 추천하는지 한두 줄로 쓴다.

이 규칙은 고를 선택지를 줄 때만 적용한다. 차례대로 할 작업 단계나 답이 하나뿐인 설명은 평소대로 쓴다.
AskUserQuestion 도구로 물을 때는 그 대화창에 본문이 보이지 않을 수 있으므로, 각 option의 description에 의견, 위험도, 작업량을 짧게 담는다.`

export const register: Register = on => {
  on('prompt.compose', async ($, e, next) => {
    const { sections } = await next(e)

    return { sections: [...sections, { id: SECTION_ID, text: RULE, scope: 'session' }] }
  })
}
