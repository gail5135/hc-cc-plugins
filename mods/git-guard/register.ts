import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const lastPrompt = atom({ plugin: 'hc-cc-plugins', key: 'lastPrompt' } as const, '')

// git 뒤의 전역 옵션(-C path, -c k=v 등)을 건너뛰어 하위 명령을 찾는다.
const GIT_PUSH = /\bgit\b(?:\s+-\S+(?:\s+(?!push\b)[^\s-]\S*)?)*\s+push\b/

// 영어 단어 앞에 다른 영문자가 붙은 경우(repush, recommit 등)는 제외한다.
const PUSH_WORD = /푸시|푸쉬|(?<![a-z])push(?![a-z])/gi
const COMMIT_WORD = /커밋|(?<![a-z])commit(?![a-z])/gi

// 단어 바로 뒤에 붙는 조사와 '좀'
const PARTICLE = String.raw`\s*(?:을|를|도|까지|만|은|는)?\s*(?:좀\s*)?`

// 단어 바로 뒤에 하/해/할/합이 오면 어미(합시다, 하죠, 하셈, 해주세요…)와 상관없이 지시로 본다.
// 언급에 쓰이는 형태(하는, 해서, 해야, 하기, 하려, 하다가, 한, 할 때, 했…)는 빠진다.
const ORDER_TAIL = new RegExp(
  `^${PARTICLE}(?:하(?!는|기|려|다)|해(?!서|야)|할(?!\\s*때)|합|ㄱ|고+(?![가-힣])|가자|쳐|남겨|날려|만들어|부탁|진행)` +
    String.raw`|^\s+(?:this|it|please|now)\b`,
  'i',
)

// 단어가 든 문장이 ?로 끝나면 질문이다. 단 '해줄래?', '해 줄 수 있어?' 같은 부탁은 지시로 본다.
const SENTENCE = /^[^.!?\n]*[.!?\n]?/
const REQUEST_QUESTION = /줄래|주실래|주시겠|줄\s*수|할래/

const isQuestion = (after: string) => {
  const sentence = after.match(SENTENCE)?.[0] ?? ''
  return sentence.endsWith('?') && !REQUEST_QUESTION.test(sentence)
}

// 단어 바로 뒤에 오면 그 단어를 금지하는 말
const NEGATED_TAIL = new RegExp(`^${PARTICLE}(?:하지\\s*(?:마|말)|말고|말아|금지|안\\s*해|하면\\s*안)`, 'i')
const NEGATED_HEAD = /(?:don't|do\s+not|never|no)\s+$/i

// 커밋 뒤에 이어지는 '올려줘'는 푸시 지시다('커밋해서 올려줘', '커밋하고 올려줘').
const COMMIT_THEN_UPLOAD = /^\s*(?:하고|해서|한\s*(?:다음|뒤|후)에?|후에?|,|and)?\s*올려\s*(?:줘|주세요|달라)/

const BARE = /^\s*(?:please\s+)?(?:푸시|푸쉬|push)\s*[.!]?\s*$/i
// 영어 문장은 맨 앞에 오면 명령문이다('please push'). 한국어가 섞인 문장은 제외한다.
const ENGLISH_LEAD = /^\s*(?:please\s+)?$/i
const ENGLISH_WORD = /^[a-z]/i
const HANGUL = /[가-힣ㄱ-ㅎ]/

const USER_ORIGINS = new Set(['composer', 'bridge', 'sdk'])

type Occurrence = { word: string; before: string; after: string }

const occurrences = (pattern: RegExp, prompt: string): Occurrence[] =>
  [...prompt.matchAll(pattern)].map(match => {
    const start = match.index ?? 0
    return { word: match[0], before: prompt.slice(0, start), after: prompt.slice(start + match[0].length) }
  })

const isNegated = ({ before, after }: Occurrence) =>
  NEGATED_TAIL.test(after) || NEGATED_HEAD.test(before)

const isOrderedAt = ({ word, before, after }: Occurrence): boolean =>
  !isQuestion(after) &&
  (ORDER_TAIL.test(after) || (ENGLISH_WORD.test(word) && ENGLISH_LEAD.test(before) && !HANGUL.test(after)))

const isPushOrdered = (prompt: string): boolean => {
  if (BARE.test(prompt)) return true

  // 푸시를 지시하거나 금지한 곳 중 마지막 것을 따른다.
  // '푸시해줘. 아 잠깐 푸시는 하지 마'는 금지이고, '푸시하지 마. 아니 그냥 푸시해줘'는 지시다.
  const decided = occurrences(PUSH_WORD, prompt).filter(at => isNegated(at) || isOrderedAt(at)).at(-1)
  if (decided !== undefined) return !isNegated(decided)

  return occurrences(COMMIT_WORD, prompt).some(({ after }) => COMMIT_THEN_UPLOAD.test(after) && !isQuestion(after))
}

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    // 사용자가 직접 입력한 메시지만 지시로 인정한다. 알림, 예약 작업, 다른 에이전트의 메시지는 제외한다.
    const isTyped = !e.isMeta && !e.command && USER_ORIGINS.has(e.origin.kind)
    await update($, lastPrompt, () => (isTyped ? e.text : ''))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!GIT_PUSH.test(e.command) || isPushOrdered(await read($, lastPrompt))) return next(e)

    return {
      deny: 'git-guard: 가장 최근 사용자 메시지에 명시적인 푸시 지시가 없어서 git push를 차단했습니다. 사용자에게 "푸시해줘"처럼 직접 지시해 달라고 요청하세요.',
    }
  }).catch(($, e, next) => (next.called ? next(e) : { deny: `${$.plugin.name}: 가드 실행에 실패했습니다.` }))
}
