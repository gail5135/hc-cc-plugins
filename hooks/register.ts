import type { Register } from 'claude-code'
import { register as choiceTable } from '../mods/choice-table/register'
import { register as commitTrailer, rememberStep } from '../mods/commit-trailer/register'
import { register as gitGuard } from '../mods/git-guard/register'
import { recordEffort, register as usagePanel } from '../mods/usage-panel/register'

// 플러그인 하나에는 hooks 모듈이 하나뿐이라, 여기서 각 mod를 차례로 등록한다.
export const register: Register = (on, options) => {
  usagePanel(on, options)
  gitGuard(on, options)
  commitTrailer(on, options)
  choiceTable(on, options)

  // matcher 없는 turn.step은 플러그인마다 한 번만 걸 수 있어 여러 mod의 처리를 여기서 묶는다.
  on('turn.step', async function* ($, e, next) {
    rememberStep(e)
    await recordEffort($, e)

    return yield* next(e)
  })
}
