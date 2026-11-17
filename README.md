# hc-cc-plugins

Claude Code를 쓸 때 채팅 옆에 필요한 정보를 띄우고, 실수하기 쉬운 작업을 막아 주는 개인용 mod 모음입니다.

## Mods

| Mod | 적용 범위 | 역할 |
|---|---|---|
| [`usage-panel`](mods/usage-panel) | 모든 프로젝트 | 사용량, subagent, 커밋, 질문 로그를 패널에 표시 |
| [`git-guard`](mods/git-guard) | 모든 프로젝트 | 명시적인 지시가 없는 `git commit`, `git push` 차단 |
| [`commit-trailer`](mods/commit-trailer) | 모든 프로젝트 | Claude가 만드는 커밋에 모델, effort, 연락처 trailer 추가 |

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

## 설치

저장소를 받아 마켓플레이스로 등록한 뒤 필요한 mod를 설치합니다.

```sh
git clone https://github.com/gail5135/hc-cc-plugins.git ~/.claude/hc-cc-plugins
claude plugin marketplace add ~/.claude/hc-cc-plugins

claude plugin install usage-panel@hc-cc-plugins
claude plugin install git-guard@hc-cc-plugins
claude plugin install commit-trailer@hc-cc-plugins
```

설치한 뒤 Claude Code를 재시작하거나 `/reload-plugins`를 실행합니다.

mod는 등록한 폴더를 직접 읽으므로 폴더를 지우거나 옮기면 동작하지 않습니다.

### 갱신

원격에 올라간 변경을 받아 마켓플레이스를 갱신한 뒤 `/reload-plugins`를 실행합니다.

```sh
git -C ~/.claude/hc-cc-plugins pull
claude plugin marketplace update hc-cc-plugins
```

## 개발

```sh
claude plugin validate .                # 마켓플레이스 검증
claude plugin validate mods/git-guard   # mod 검증
claude plugin test mods/git-guard       # mod 테스트
```
