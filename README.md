# hc-cc-plugins

어느 환경에서든 이 플러그인 하나만 설치하면 원하는 Claude Code 환경을 갖출 수 있게 만든 개인용 플러그인입니다. 채팅 옆에 필요한 정보를 띄우고, 실수하기 쉬운 작업을 막아 줍니다.

## 구조

```
.claude-plugin/
  plugin.json        플러그인 정보
  marketplace.json   이 저장소를 마켓플레이스로 등록할 때 쓰는 목록 (플러그인 1개)
hooks/
  hooks.json         hooks 모듈 지정
  register.ts        모든 mod를 등록하는 진입 모듈
mods/<이름>/         mod별 코드와 테스트
types/index.d.ts     mod가 쓰는 상태($.state)의 타입
skills/  agents/  commands/   스킬, 서브에이전트, 슬래시 커맨드 (추가할 때 만듦)
```

- 플러그인 하나에는 hooks 모듈을 하나만 둘 수 있습니다. 그래서 각 mod는 `register`를 내보내고, `hooks/register.ts`가 이를 차례로 부릅니다.
- matcher 없는 같은 이벤트(`turn.step` 등)는 플러그인마다 한 번만 걸 수 있습니다. 여러 mod가 같은 이벤트를 써야 하면, 각 mod는 처리 함수를 `function` 선언으로 내보내고 `hooks/register.ts`에서 훅 하나로 묶습니다.
- 상태 키는 모두 `plugin: 'hc-cc-plugins'` 아래에 둡니다. mod끼리 키 이름이 겹치지 않게 하고, 새 키는 `types/index.d.ts`에 선언합니다.

## Mods

| Mod | 적용 범위 | 역할 |
|---|---|---|
| [`usage-panel`](mods/usage-panel) | 모든 프로젝트 | 사용량, subagent, 커밋, 질문 로그를 패널에 표시 |
| [`git-guard`](mods/git-guard) | 모든 프로젝트 | 명시적인 지시가 없는 `git commit`, `git push` 차단 |
| [`commit-trailer`](mods/commit-trailer) | 모든 프로젝트 | Claude가 만드는 커밋에 모델, effort, 연락처 trailer 추가 |
| [`choice-table`](mods/choice-table) | 모든 프로젝트 | 선택지를 줄 때 의견, 위험도, 작업량을 담은 표로 답하게 함 |

### usage-panel

세션이 시작되면 패널이 자동으로 열립니다. 닫은 뒤에는 `/usage-panel`로 다시 열 수 있습니다.

- 모델과 effort, 컨텍스트, 5시간·주간 한도, 비용
- Vite 개발 서버의 proxy preset(5173 포트)과 현재 브랜치
- 실행 중이거나 끝난 subagent. 누르면 해당 화면으로 이동합니다.
- 이번 세션에서 만든 워크트리별 커밋
- 질문 로그. 누르면 해당 질문 위치로 이동합니다.

### git-guard

가장 최근에 직접 입력한 메시지에 "커밋해줘", "푸시해줘", "커밋하고 푸시해줘" 같은 지시가 있어야 `git commit`과 `git push`를 허용합니다.

- 커밋과 푸시는 따로 판단합니다. "커밋해줘"만으로는 푸시할 수 없습니다.
- `커밋`, `commit`, `푸시`, `푸쉬`, `push` 바로 뒤에 하/해/할/합이 오면 어미와 상관없이 지시로 봅니다. 그래서 "합시다", "하죠", "하셈", "해주세요" 모두 통과합니다.
  - "하는", "해서", "해야", "하기", "하려", "하다가", "할 때", "한", "했"처럼 언급에 쓰는 형태는 지시로 보지 않습니다.
- "ㄱ", "고", "가자", "쳐", "남겨", "날려", "만들어", "부탁", "진행"도 지시로 봅니다. 예: "커밋 ㄱ", "커밋 날려줘"
- 단어가 든 문장이 `?`로 끝나면 질문으로 보고 차단합니다.
  - 단 "해줄래?", "해 줄 수 있어?", "해주시겠어요?" 같은 부탁은 지시로 봅니다.
- "하지 마", "말고", "don't" 같은 부정은 해당 단어에만 적용됩니다. "커밋하고 푸시는 하지 마"는 커밋만 허용합니다.
- "올려줘"는 "커밋하고 올려줘"처럼 커밋 뒤에 이어질 때만 푸시 지시로 봅니다. "버전 올려줘"는 푸시가 아닙니다.
- 영어는 "commit the fix", "please push"처럼 문장 맨 앞에 오는 명령문도 지시로 봅니다.
- 알림, 예약 작업, 다른 에이전트의 메시지도 지시로 보지 않습니다.
- `?` 없이 쓴 질문("커밋하면 어떻게 돼")은 통과합니다.

### commit-trailer

Claude가 Bash로 실행하는 `git commit`에 `--trailer`를 붙여 커밋 메시지 끝에 다음 두 줄을 남깁니다.

```
Coworked-By: Claude Opus 5.5 (high)
Contact: 홍길동 (gildong@example.com)
```

- 모델과 effort는 커밋을 실행한 루프의 마지막 모델 요청에서 읽습니다. subagent가 커밋하면 그 subagent의 값이 들어갑니다.
  - 모델을 아직 요청하지 않았다면 세션 모델과 `CLAUDE_EFFORT`를 씁니다. effort를 알 수 없으면 괄호를 생략합니다.
- 연락처는 커밋할 저장소의 `git config user.name`, `user.email`입니다. `git -C <경로> commit`이면 그 경로에서 읽고, 둘 다 비어 있으면 `Contact` 줄을 생략합니다.
- 사용자가 터미널에서 직접 하는 커밋에는 붙지 않습니다.
- Claude Code가 기본으로 붙이는 `Co-Authored-By` 줄을 없애려면 `~/.claude/settings.json`에 다음 설정을 넣습니다.

  ```json
  { "attribution": { "commit": "" } }
  ```

### choice-table

시스템 프롬프트 끝에 규칙을 하나 덧붙입니다. Claude가 고를 선택지를 줄 때 `1.`, `1)` 같은 목록 대신 항상 표로 답하게 하는 규칙입니다.

기본 열 (항상 넣음)

| 열 | 내용 |
|---|---|
| 선택지 | 짧은 이름. 추천하는 선택지에 ⭐ |
| 의견 | 그 선택지에 대한 Claude의 판단과 이유 |
| 위험도 | 낮음/중간/높음과 짧은 이유 |
| 작업량 | 작음/중간/큼과 무엇이 드는지 |

추가 열 (해당할 때만 넣음)

| 열 | 넣는 경우 |
|---|---|
| 되돌리기 | 쉬움/보통/어려움. 되돌리기 어려운 선택지(데이터 삭제, 배포, 외부 공개, 마이그레이션 등)가 섞여 있을 때 |
| 영향 범위 | 선택지마다 건드리는 파일, 모듈, 사용자가 다를 때 |
| 장점 / 단점 | 선택지가 비슷해서 의견 한 칸으로는 차이가 안 보일 때. 의견 열을 둘로 나눔 |
| 선행 조건 | 고르기 전에 필요한 라이브러리, 권한, 다른 작업이 있을 때 |
| 유지보수 부담 | 만든 뒤에도 계속 관리해야 하는 선택지가 섞여 있을 때 |

- 표 아래에는 무엇을 추천하는지 한두 줄로 씁니다.
- 차례대로 할 작업 단계나 답이 하나뿐인 설명은 평소처럼 씁니다.
- `AskUserQuestion` 대화창으로 물을 때는 본문이 가려질 수 있어서, 각 선택지 설명에 의견, 위험도, 작업량을 짧게 넣습니다.
- 규칙은 고정된 문구라 프롬프트 캐시를 깨지 않습니다. 열을 바꾸려면 `mods/choice-table/register.ts`의 `RULE`을 고칩니다.

## 설치

저장소를 받아 마켓플레이스로 등록한 뒤 플러그인을 설치합니다.

```sh
git clone https://github.com/gail5135/hc-cc-plugins.git ~/.claude/hc-cc-plugins
claude plugin marketplace add ~/.claude/hc-cc-plugins
claude plugin install hc-cc-plugins@hc-cc-plugins
```

설치한 뒤 Claude Code를 재시작하거나 `/reload-plugins`를 실행합니다.

플러그인은 등록한 폴더를 직접 읽으므로 폴더를 지우거나 옮기면 동작하지 않습니다.

### 갱신

원격에 올라간 변경을 받아 마켓플레이스를 갱신한 뒤 `/reload-plugins`를 실행합니다.

```sh
git -C ~/.claude/hc-cc-plugins pull
claude plugin marketplace update hc-cc-plugins
```

### mod를 따로 설치했던 경우 (0.1.x)

예전처럼 `usage-panel`, `git-guard`, `commit-trailer`를 따로 설치했다면, 먼저 셋을 지운 뒤 갱신하고 새 플러그인을 설치합니다. 갱신을 먼저 하면 예전 플러그인이 가리키던 폴더가 사라져 그 사이에 mod가 동작하지 않습니다.

```sh
claude plugin uninstall usage-panel@hc-cc-plugins
claude plugin uninstall git-guard@hc-cc-plugins
claude plugin uninstall commit-trailer@hc-cc-plugins
git -C ~/.claude/hc-cc-plugins pull
claude plugin marketplace update hc-cc-plugins
claude plugin install hc-cc-plugins@hc-cc-plugins
```

상태 키가 플러그인 이름 아래로 옮겨져서, 패널의 질문 로그처럼 세션에 쌓인 값은 한 번 초기화됩니다.

## 개발

```sh
claude plugin validate .   # 플러그인과 마켓플레이스 검증
claude plugin test .       # 모든 mod 테스트 (mod를 모두 올린 상태로 실행)
```
