/**
 * 📚 자료실 샘플: "AI 앱개발 풀스택 코스" (노션 커리큘럼 페이지를 자료실 에디터 형식으로 옮긴 것)
 * 노션 이미지 2장은 노션 보안 정책 때문에 가져오지 못해 "이미지 자리" 인용 상자로 표시함 → 에디터에서 직접 올리면 됨
 * 쓰임: scripts/seed-library-sample.mts
 */
type Node = Record<string, unknown>;
type Inline = Node | string;

const inl = (x: Inline): Node => (typeof x === "string" ? { type: "text", text: x } : x);
const b = (text: string): Node => ({ type: "text", text, marks: [{ type: "bold" }] });
const L = (href: string, text = href): Node => ({
  type: "text",
  text,
  marks: [{ type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer" } }],
});
const p = (...c: Inline[]): Node => (c.length ? { type: "paragraph", content: c.map(inl) } : { type: "paragraph" });
const h = (level: number, text: string): Node => ({ type: "heading", attrs: { level }, content: [inl(text)] });
const hr: Node = { type: "horizontalRule" };
const code = (text: string): Node => ({ type: "codeBlock", attrs: { language: null }, content: [inl(text)] });
const quote = (text: string): Node => ({ type: "blockquote", content: [p(text)] });
/** 목록 한 줄: 첫 인자는 글(문자열 또는 글 조각 배열), 나머지는 그 아래 블록 */
const li = (first: Inline | Inline[], ...children: Node[]): Node => ({
  type: "listItem",
  content: [Array.isArray(first) ? p(...first) : p(first), ...children],
});
const ol = (...items: Node[]): Node => ({ type: "orderedList", content: items });
const ul = (...items: Node[]): Node => ({ type: "bulletList", content: items });
const toggle = (summary: Inline | Inline[], ...children: Node[]): Node => ({
  type: "details",
  attrs: { open: true },
  content: [
    { type: "detailsSummary", content: (Array.isArray(summary) ? summary : [summary]).map(inl) },
    { type: "detailsContent", content: children.length ? children : [p()] },
  ],
});
const imageSlot = (what: string) => quote(`🖼 이미지 자리: ${what} — 노션 원본 이미지를 내려받아 여기에 올려 주세요`);

const PATH_FIX = (tool: string) => [
  li(`powershell 종료 후 powershell을 재실행한 후, ${tool}를 입력 후 엔터를 치면 정상적으로 ${tool === "claude" ? "claude code" : "codex"}가 실행되는 것을 확인한다.`),
  li("만일 PATH 입력 필요 등의 에러 발생(환경 변수 설정 필요 상태) 시, 내 PC > 로컬디스크 > 사용자 폴더 > 내 이름명 폴더 > .local 폴더 > bin 폴더 > 해당 경로 전체 복사(위 경로창 클릭)한다."),
  li("작업표시줄 하단 검색창에 ‘시스템 환경 변수 편집’을 입력하고 앱을 실행한다. 이후 하단 ‘환경 변수’를 클릭한 후 사용자 변수 중 PATH를 더블 클릭한 후 새로 만들기를 누른 후 복사한 경로를 붙여 넣기하고 확인 버튼을 눌러준다."),
];
const MAC_OPEN = "macOS 사용자의 경우, 터미널을 열고(command + N) 복사한 명령어를 붙여넣고 실행한다.";
const WIN_OPEN = "윈도우 사용자의 경우, 작업표시줄 하단 powershell을 검색한 후 복사한 명령어를 붙여넣고 실행한다.";
const status = p(b("상태 :"), " ✅ 완료");

/* ---------- 1회차 ---------- */
const week1 = [
  h(3, "1회차 — 설치하고 세팅하기"),
  toggle(
    [b("주제 :"), " AI로 개발 환경 세팅하기"],
    p(b("내용 :")),
    ol(
      li(
        "서비스 구조 이해",
        toggle("기본 개념", imageSlot("서비스 구조도")),
        toggle("예시) FRONT-END & BACK-END", imageSlot("FRONT-END & BACK-END 로그인 흐름 예시")),
      ),
      li(
        "AI 툴 설치",
        toggle(
          "Git (코드관리도구)",
          ol(
            li(["브라우저(크롬 등)에서 git(", L("https://git-scm.com/"), ")을 검색한다."]),
            li(["접속 후, 자신의 운영체제에 맞게 설치(", L("https://git-scm.com/install/mac"), ")한다."]),
            li(MAC_OPEN),
            li(WIN_OPEN),
          ),
        ),
        toggle(
          "클로드 코드 (desktop 버전 아닌 cli 설치, 컴퓨터 내 전역 사용 위함)",
          ol(
            li(["먼저, 클로드 서비스 자체 회원가입(", L("https://claude.com/ko"), ")을 진행한다. (권장 플랜 : 프로)"]),
            li("브라우저(크롬 등)에서 ‘클로드 코드 닥스’를 검색한다."),
            li("Claude Code Docs 접속 후, 개요 내 Native Install을 찾아 OS에 맞는 명령어를 복사한다."),
            li(
              MAC_OPEN,
              ol(
                li("터미널 종료 후 터미널을 재실행한 후, claude를 입력 후 엔터를 치면 정상적으로 claude code가 실행되는 것을 확인한다."),
                li([
                  "만일 command-not-found 등의 에러 발생 시, 에러 메시지를 그대로 복사해 구글 등에 검색해 해결 방법을 제시한 블로그 등을 참조한다. (예. ",
                  L("https://sooncoding.tistory.com/402"),
                  ")",
                ]),
                li("claude code가 정상적으로 실행되면, 이후 과정을 엔터로 계속 진행하며 마무리한다."),
              ),
            ),
            li(
              "윈도우 사용자의 경우, 64비트 운영체제 사용자만 가능하며 작업표시줄 하단 powershell을 검색한 후 복사한 명령어를 붙여넣고 실행한다.",
              ol(...PATH_FIX("claude")),
            ),
          ),
        ),
        toggle(
          "커서(desktop 버전 설치해도 무방)",
          ol(
            li(["브라우저(크롬 등)에서 ‘커서’를 검색(", L("https://cursor.com/ko/home"), ") 하고, 자신의 운영체제에 맞는 데스크톱 앱을 다운로드 받는다."]),
            li("macOS 사용자의 경우, Finder에서 자신의 개인 폴더(/Users) 내 Developer라는 폴더를 생성한다."),
            li("Developer 폴더 내 자신의 가칭 프로젝트명으로 별도의 새로운 폴더를 하나 생성한다."),
            li("Cursor를 실행한 후, open folder에서 생성한 프로젝트 폴더를 오픈한다."),
          ),
        ),
        toggle(
          "코덱스 (desktop 버전 아닌 cli 설치, 컴퓨터 내 전역 사용 위함)",
          ol(
            li(["먼저, ChatGPT 서비스 자체 회원가입(", L("https://chatgpt.com/"), ")을 진행한다. (권장 플랜 : 프로)"]),
            li(["브라우저(크롬 등)에서 ‘openai codex cli’를 검색(", L("https://learn.chatgpt.com/docs/codex/cli"), ")한다."]),
            li("스크롤 다운 후 Install Codex에서 자신의 운영체제에 맞는 명령어를 복사한다."),
            li(
              MAC_OPEN,
              ol(
                li("Start Codex라는 질문이 뜨면 y를 누르고 엔터를 치면 설치가 완료된다. 평소의 터미널에서는 codex라는 명령어로 실행 가능하다."),
                li("최초 설치 시, 이후 과정을 엔터로 계속 진행하며 마무리한다."),
              ),
            ),
            li(WIN_OPEN, ol(...PATH_FIX("codex"))),
          ),
        ),
      ),
      li(
        "개발 툴 설치",
        toggle(
          "공통",
          ol(
            li(
              "비주얼 스튜디오 코드",
              ol(
                li(["브라우저(크롬 등)에서 ‘비주얼스튜디오 코드’를 검색(", L("https://code.visualstudio.com/"), ") 하고, 자신의 운영체제에 맞는 데스크톱 앱을 다운로드 받는다."]),
                li(
                  "macOS 사용자의 경우, Finder에서 자신의 개인 폴더(/Users) 내 Developer라는 폴더를 생성한다. Developer 폴더 내에서 VSCode 앱을 압축해제 및 실행 후, 회원가입/로그인을 진행한다. 윈도우 사용자의 경우, 경로 지정을 크게 신경쓸 필요는 없다. (기억은 필수)",
                ),
                li("Developer 폴더 내 자신의 가칭 프로젝트명으로 별도의 새로운 폴더를 하나 생성한다."),
                li("VSCode를 실행한 후, open folder에서 생성한 프로젝트 폴더를 오픈한다."),
                li("(선택) VSCode 좌측 Extension 통해 Cluade Code for VSCode, Codex 등을 설치한다."),
                li("VSCode 내 터미널 오픈 후, 클로드 코드, 코덱스 등 자신이 필요한 AI툴을 호출한다."),
              ),
            ),
            li(
              "Android Studio : 플레이스토어 앱 빌드용 프로그램",
              ol(li(["브라우저(크롬 등)에서 ‘안드로이드 스튜디오’를 검색(", L("https://developer.android.com/studio?hl=ko"), ")하고, 파일을 다운로드 받는다."])),
            ),
            li(
              "Flutter : 앱 개발용 프레임워크",
              ol(
                li(["flutter install manually라고 검색하거나, ", L("https://docs.flutter.dev/install/manual"), " 에 접속한다."]),
                li("자신의 운영체제에 맞는 파일을 다운로드 받는다."),
                li("macOS 사용자의 경우, Finder에서 자신의 개인 폴더(/Users) 내 Developer라는 폴더를 생성한다. Developer 폴더 내에서 다운로드 받은 파일을 압축해제한다."),
                li("Developer 폴더 내 자신의 가칭 프로젝트명으로 별도의 새로운 폴더를 하나 생성한다."),
                li("커서 등을 활용해 해당 폴더를 open folder를 통해 열어준다."),
                li(
                  "flutter 기본 세팅을 완료한 후, 기존 md파일들을 VSCode 등에서 docs 등 이름의 신규 폴더에 모두 넣고, stitch 등에서 만든 기본 디자인을 내보내기 > mcp > claude code 등으로 생성한 stitch mcp 결과값을 넣고 제작해달라고 명령한다.",
                ),
              ),
            ),
          ),
        ),
        toggle(
          "Mac",
          ol(
            li(
              "Xcode : iOS 앱 빌드용 프로그램",
              ol(
                li("App Store에서 Xcode를 검색 후 다운로드, apple 계정을 활용해 로그인한다."),
                li("아이폰 16프로맥스(6.9인치), 아이폰 11프로맥스(6.5인치) 시뮬레이터를 다운로드 받아둔다."),
              ),
            ),
          ),
        ),
      ),
    ),
    p(b("과제 :")),
    ul(li("나에게 필요한 AI/개발 툴 설치를 완료한다")),
  ),
  status,
];

/* ---------- 2회차 ---------- */
const BLUEPRINT = `# 역할
당신은 20년 경력의 시니어 프로덕트 스트래티지스트입니다.
Lean Startup 방법론과 Y Combinator의 검증 프레임워크에 익숙합니다.
2010년 이후 다수의 스타트업을 창업해 exit한 경험이 3번이나 있습니다.

# 컨텍스트
비개발자가 Flutter 앱을 개발하기 위한 최상위 전략 문서를 작성합니다.
이 문서는 이후 모든 산출물(유저 스토리, IA, DB, API, PRD)의 근거가 됩니다.

# 입력
서비스 아이디어: 5W 1H에 충실하게 한 줄 이상 작성. 자세할 수록 좋음.
서비스명: 앱/웹서비스명.
고객: 이 서비스를 주로 쓰면 좋겠다고 생각하는 타깃. 자세할 수록 좋음.
경쟁사: 기존 경쟁사, 참고할 만한 기업/서비스명을 언급. 없으면 추론으로.
서비스 제공 국가: 한국

# 작업 (Chain-of-Thought 강제 실행)
다음 순서대로 사고한 뒤 출력하세요. 각 단계는 이전 단계의 결과에 근거해야 합니다.
1단계. 해결하려는 문제(Problem)를 3개로 분해
2단계. 각 문제의 페인 강도(상/중/하)와 발생 빈도(상/중/하) 평가
3단계. 타겟 고객 페르소나를 디테일하게 정의
4단계. 핵심 가치 제안(UVP)을 25자 이내 한 문장으로 작성
5단계. 비즈니스 모델 (수익 구조, 가격, 단위경제)
6단계. 최소 기능 가설(MVP Hypothesis) 도출
7단계. 6개월 내 검증 가능한 핵심 지표(North Star Metric) 1개 + 보조 지표 3개

# 출력 형식 (Markdown)
## 1. 서비스 한 줄 정의
## 2. 문제 정의 (표: 문제 / 페인 강도 / 빈도 / 근거)
## 3. 타겟 고객 (인구통계, 행동, 페인 포인트, Jobs to be done을 최대한 추론 필요하며, 동시에 근거 제시 필수)
## 4. 가치 제안 (UVP)
## 5. 비즈니스 모델
 - 수익 모델 / 가격 정책 / 단위 경제 (CAC, LTV 가설)
## 6. MVP 가설
## 7. 성공 지표 (NSM + 보조 지표)
## 8. 가장 위험한 가정 3개 (Riskiest Assumptions)

# 제약 조건
- "사용자에게 가치를 제공한다" 같은 모호하고 추상적 표현 금지
- 모든 항목에 숫자, 행동, 또는 검증 방법을 포함
- 페르소나는 가상의 이름과 구체적 상황을 부여
- Flutter 구현 난이도를 고려해 MVP 범위를 좁힐 것 `;

const USER_STORY = `# 역할
당신은 애자일 스크럼 환경에서 7년 이상 일한 시니어 PM입니다.
INVEST 원칙과 MoSCoW 우선순위 분류에 능숙합니다.

# 작업
블루프린트에서 정의한 1차 타겟의 JTBD를 기준으로 사용자 스토리를 도출합니다.

1단계. 1차 타겟의 핵심 여정(Onboarding → Activation → Retention → Revenue) 4단계 분해
2단계. 각 단계별 사용자 스토리 작성 (As a / I want / So that 형식)
3단계. MoSCoW 분류 적용
 - Must (MVP 필수): 가치 제안 실현에 직결되는 스토리만
 - Should (1차 업데이트): 핵심 경험 강화
 - Could (선택): 차별화, 나중에 가능
 - Won't (이번엔 안 함): 명시적으로 제외
4단계. 각 Must/Should 스토리에 Acceptance Criteria (AC) 3개씩 추가
5단계. INVEST 체크리스트로 자가 검증 후 통과한 것만 남김

# 출력 형식 (Markdown 표)

## 사용자 스토리 목록
| ID | 단계 | 스토리 | 우선순위 | Acceptance Criteria | INVEST 체크 |
|---|---|---|---|---|---|
| US-001 | Activation | As a ..., I want ..., so that ... | Must | 1. ... / 2. ... / 3. ... | I:O N:O V:O E:O S:O T:O |

## 제외된 스토리 (Won't, 사유 명시)
| ID | 스토리 | 제외 사유 |

# 제약 조건
- Must는 최대 12개로 제한 (그 이상이면 MVP가 아님)
- 모든 스토리는 Flutter 1인 개발 기준 2~5일 내 구현 가능한 크기
- 기술 구현 표현(예: "API를 호출한다") 금지, 사용자 관점 언어만 사용`;

const IA = `# 역할
당신은 복잡도가 높은 앱(예: 핀테크 앱, 플랫폼 앱)의 IA를 설계한 경험이 있는 시니어 정보 아키텍트입니다. 카카오뱅크, 토스 수준의 IA 문서 양식에 익숙합니다.

# 참고 양식 (Few-shot)
다음 컬럼 구조를 반드시 따릅니다.
| 분류 | Depth1 | Depth2 | Depth3 | 기능 |

- 분류 : 기능의 유형, 큰 카테고리
- Depth1,2,3 : 화면
 - 예: 홈 화면 : 홈 화면 - Depth1
 - 예: 설정 속 프로필 입력 화면 : 설정 - Depth1, 프로필 입력 화면 - Depth2
- 표로 표시 하면
 | 분류 | Depth1 | Depth2 | Depth3 | 기능 |
 | 메인 | 홈화면 | | | |
 | 설정 | 설정 | | | |
 | 설정 | 설정 | 프로필 입력 | | | |

추가 예시 (카카오뱅크 IA 일부):
| 메인 | 내계좌 | 예적금 | | 보유대표계좌 노출 |
| 메인 | 내계좌 | 대출 | | 가입상품 노출 |
| 상품/서비스 | 전체 | | | 광고 노출 (인디케이터) |
| 상품/서비스 | 예금/적금 | 입출금통장 | | POP (상품상세 안내) |

# 작업
1단계. 앱의 최상위 분류(메인 탭, 또는 글로벌 영역) 도출 — 보통 3~5개
2단계. 각 분류 아래 Depth1을 사용자 스토리 기준으로 매핑(화면으로 정의)
3단계. Depth2, Depth3은 필요한 경우에만 작성 (불필요한 깊이 금지)
4단계. 기능 컬럼에 화면의 핵심 기능을 1줄로 명시 (예: "POP 노출", "리스트 노출", "반응형 UI 적용", "푸시 알림 트리거") 참고로, 화면에 존재하는 기능을 행으로 구분해서 작성하지 않음. (예 : 홈화면 | | | • 리스트 • 반응형 UI | 와 같이 불릿으로 구분해서 작성)
5단계. 모든 Must/Should 사용자 스토리가 1개 이상의 IA 항목으로 커버되는지 자가 검증

# 출력 형식
## 정보구조도

| 분류 | Depth1 | Depth2 | Depth3 | 기능 |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

## 커버리지 매트릭스
| 사용자 스토리 ID | 대응 IA 경로 |
| US-001 | 분류 > Depth1 > Depth2 |

## 누락/중복 검토
- 누락된 스토리: [있으면 명시]
- 중복된 경로: [있으면 명시]

# 제약 조건
- 빈 칸은 공백으로 두지 말고 셀을 생략 (마크다운 표 정렬 유지)
- Depth는 최대 3까지만 (그 이상은 사용성 저하)
- 화면 이름은 명사형, 기능은 동사형 또는 명사구
- Flutter 라우팅 구조와 1:1 매핑 가능하도록 작성`;

const PRD = `# 역할
당신은 화면 단위 PRD 작성에 능숙한 시니어 PM이자 UX 라이터입니다.
Flutter 1인 개발자가 그대로 구현할 수 있는 수준의 디테일을 작성합니다.

# 입력
[블루프린트 + 사용자 스토리 + IA + DB 설계 + API 설계 전체]
작성 대상 화면: [IA에서 선택한 1개 화면명 또는 "전체 화면 일괄"]

# 작업 (Chain-of-Thought + Use Case 검증)
1단계. 화면의 목적과 진입 경로 정의
2단계. 화면 구성 요소(UI 컴포넌트) 분해
3단계. 화면 상태(State) 정의: 초기 / 로딩 / 성공 / 빈 데이터 / 에러
4단계. 인터랙션 정의 (사용자 액션 → 시스템 반응 → API/DB 호출)
5단계. 유즈케이스 작성 (정상 / 예외 / 엣지)
6단계. 유즈케이스로 PRD 자가 검증: 모든 인터랙션이 유즈케이스로 커버되는가
7단계. 누락된 경우 PRD 보강

# 출력 형식 (화면별로 반복)

## 화면 PRD: [화면명]

### 1. 개요
- 화면 ID: SCR-001
- IA 경로: 분류 > Depth1 > Depth2
- 대응 사용자 스토리: US-001, US-002
- 목적: (1~2문장)
- 진입 경로: (어디서 어떻게 오는가)
- 이탈 경로: (어디로 나가는가)

### 2. 화면 구성 요소
| 컴포넌트 ID | 종류 | 내용 | 데이터 소스 | 상호작용 |
| C-01 | AppBar | 타이틀 + 뒤로가기 | - | onTap: pop |
| C-02 | List | 게시물 카드 | API-003 GET /posts | onTap: 상세 이동 |

### 3. 화면 상태
| 상태 | 트리거 | 화면 표시 |
| 초기 | 진입 시 | 스켈레톤 UI |
| 로딩 | API 호출 중 | 로딩 인디케이터 |
| 성공 | 200 응답 | 리스트 표시 |
| 빈 데이터 | data.length=0 | Empty State 일러스트 + CTA |
| 에러 | 4xx/5xx | 토스트 + 재시도 버튼 |

### 4. 인터랙션 플로우
| 사용자 액션 | 시스템 반응 | 호출 API | DB 변화 |
| 화면 진입 | 리스트 로드 | API-003 | - |
| 게시물 탭 | 상세 화면 이동 | - | - |
| 좋아요 탭 | 좋아요 토글 | API-007 | likes++ |

### 5. 유즈케이스 (검증용)
#### UC-01: 정상 - 리스트 로딩 성공
- 전제: 사용자가 로그인 상태, 네트워크 정상
- 단계: 화면 진입 → API-003 호출 → 200 응답 → 리스트 렌더
- 기대 결과: 게시물 카드가 시간 역순으로 정렬되어 표시

#### UC-02: 예외 - 네트워크 오류
- 전제: 사용자 네트워크 끊김
- 단계: 화면 진입 → API 호출 실패
- 기대 결과: "연결을 확인해주세요" 토스트 + 재시도 버튼

#### UC-03: 엣지 - 데이터 0건
- 전제: 가입 직후 사용자
- 기대 결과: Empty State + "첫 게시물 작성" CTA

#### UC-04: 엣지 - 데이터 1만 건 이상
- 전제: 헤비 유저
- 기대 결과: 페이지네이션 또는 무한 스크롤, 메모리 누수 방지

### 6. 카피 (Copy Deck)
| 위치 | 텍스트 | 톤 |

### 7. 자가 검증 체크리스트
- [ ] 모든 인터랙션이 유즈케이스로 커버됨
- [ ] 모든 상태(초기/로딩/성공/빈/에러)에 화면이 정의됨
- [ ] API 호출 실패 시 사용자에게 다음 행동이 제공됨
- [ ] Flutter 구현 시 1~3일 내 완료 가능한 범위

# 제약 조건
- 컴포넌트 ID는 화면 내에서 고유
- 모든 텍스트는 카피 덱에 명시 (실제 문구)
- 유즈케이스는 정상 1개 + 예외 1개 이상 + 엣지 2개 이상 필수
- Flutter Material/Cupertino 위젯명을 함께 제안하면 가산점`;

const week2 = [
  h(3, "2회차 — 기획하고 디자인하기"),
  toggle(
    [b("주제 :"), " AI로 앱 기획과 디자인하기"],
    p(b("내용 :")),
    toggle(
      "MVP의 개념",
      toggle(
        "개념",
        ol(
          li(
            "의미 : MVP(Minimum Viable Product, 최소 기능 제품)는 시장에 제품을 전부 완성해서 출시하기 전, 고객이 가장 원하는 핵심 가치만을 담아 최소한의 자원으로 제작하는 프로토타입입니다. 이를 통해 시장 반응을 먼저 확인하고 제품을 개선(Pivot)합니다.",
          ),
          li(
            "유의 사항 : 처음부터 많은 기능을 구현하고, 완벽함을 추구하면 개발 기간과 비용이 증가하거나, 본질을 잃어버릴 수 있습니다. 토스의 송금하기 기능처럼, 유저에게 전달하고 싶은 본질적 핵심 기능만 구현하기 위한 노력이 필요합니다.",
          ),
        ),
      ),
    ),
    toggle(
      "Frontend + Backend 조합 및 추가 개념",
      ol(
        li("추천 : Flutter + Supabase Edge Functions"),
        li(
          "상태관리",
          code(
            "플러터 앱이 빠르게 구동되게 하고 싶어. 앱 개발 시 상태관리는 Riverpod 기반으로 구성하고, \n변경된 필드만 구독해 해당 위젯만 리빌드되도록 설계해줘. 모든 정적 위젯은 const로 선언하고,\n화면은 변경 단위별로 위젯을 분리해서 리빌드 범위를 최소화해줘.",
          ),
        ),
        li(
          "오류 쉽게 확인하기",
          ol(
            li("AI에게 오류를 찾을 수 있도록 로그 심어달라고 명령하고 작업 진행"),
            li("터미널에서 로그를 복사해 채팅창에 붙여넣고, 이 문제 해결해달라고 명령하기"),
            li("로그 + 현재상황 + 기대결과 포함해 수정 요청하기"),
          ),
        ),
      ),
    ),
    toggle(
      "Github 연동하기",
      ol(
        li(
          "가입하고 Repository 생성하기",
          ol(
            li(["Github을 검색(", L("https://github.com/"), ")하고 회원가입/로그인을 진행한다."]),
            li("Create repository > Repository name 작성 > Create repository로 생성"),
          ),
        ),
        li(
          "최초 commit해보기 (각자 화면에서)",
          code(
            'echo "# {{repository name}}" >> README.md\ngit init\ngit add README.md\ngit commit -m "first commit"\ngit branch -M main\ngit remote add origin https://github.com/{{username}}/{{repository name}}.git\ngit push -u origin main',
          ),
        ),
        li(
          "개발 문서 commit해보기 (각자 화면에서)",
          code("git remote add origin https://github.com/{{username}}/{{repository name}}.git\ngit branch -M main\ngit push -u origin main"),
        ),
      ),
    ),
    toggle(
      "기획안 제작",
      ol(
        li("클로드를 사용해 진행한다."),
        li(
          "공유된 블루프린트, 유저스토리, IA 문서를 자신이 해결하고 싶은 문제에 대입해 변경한다.",
          toggle(
            "기본 기획안",
            ol(
              li("블루프린트 - 서비스 컨셉, 목적, 비즈니스 모델을 한 페이지로 정리", code(BLUEPRINT)),
              li("유저스토리 - MVP 설계를 위한 구조화", code(USER_STORY)),
              li("IA - 유저스토리를 화면 단위 정보 구조도로 구체화", code(IA)),
            ),
          ),
        ),
        li(
          "위 3가지 문서를 프롬프트에 입력해 결과물을 뽑고, 최종적으로 PRD를 제작한다.",
          toggle("최종 기획안", ul(li("PRD - 개발 기본 문서를 기반으로 화면 단위 PRD를 설계")), code(PRD)),
        ),
      ),
    ),
    toggle(
      "디자인 제작",
      ol(
        li([
          "getdesign.md (",
          L("https://getdesign.md/"),
          "), oh-my-design (",
          L("https://oh-my-design.kr/"),
          "), designmd.ai(",
          L("https://designmd.ai/"),
          ") 등의 사이트 등을 통해 희망하는 디자인 시스템을 선택한 후, 클립보드로 복사하기를 누른다.",
        ]),
        li([
          "Stitch 등의 서비스에 내 디자인으로 시작하기, ",
          L("http://design.md/", "design.md"),
          " 붙여넣기 등을 활용해 flutter로 모바일 앱을 만든다 등의 명령어로 다음 단계로 넘어간 후, 상위 기획안 문서들을 추가 입력한 후 결과물로 나오는 앱 디자인을 확인한다.",
        ]),
        li(
          "기존 md파일들을 VSCode 등에서 docs 등 이름의 신규 폴더에 모두 넣고, stitch 등에서 만든 기본 디자인을 내보내기 > mcp > claude code 등으로 생성한 stitch mcp 결과값을 넣고 제작해달라고 명령한다.",
        ),
        li("디자인이 마음에 들지 않을 경우, 내보내기 > figma 변환 > 복사 및 붙여넣기를 통해 피그마 등을 통해 추가 작업을 진행할 수 있다."),
      ),
    ),
    p(b("과제 :")),
    ul(li("앱 기획 및 디자인 파일 제작 완료")),
  ),
  status,
];

/* ---------- 3회차 ---------- */
const WEATHER = `Supabase Edgefunction을 활용해 외부 API 호출 및 JSON 반환 구조를 만들어줘.
처리흐름: Supabase Edgefunction에서 기상청API 호출 -> 응답값 gemini 가공 -> 구조화된 JSON 반환
Supabase Edgefunction에서 함수를 만들 때 각 단계 (API호출, 좌표 변환, 응답 매팅, Gemini 호출, 에러 처리)를
별도 함수로 분리하고, 함수 상단 주석에 "다른 API로 바꿀 때 달라지는 지점"을 반드시 한 줄로 설명해줘.

1) 기상청 단기예보 API호출
- 위경도는 서울 기본값을 활용하며 기상청에서 활용하는 좌표 값으로 변환 필수
- 응답값에서 기온, 하늘상태, 강수형태를 추출하고 사람이 읽는 라벨로 매핑해줘.
2) Gemini 가공
- 기상청 단기예보에서 받은 응답값을 활용해 오늘 입을 옷을 추천하고, 반드시 JSON스키마로 출력해줘.
- JSON에 필수적으로 포함되어야 하는 값 : 날씨, 온도, 추천 옷차림(남자, 여자 기준)
3) 에러처리
- 기상청 4xx / 5xx 에러 응답 혹은 빈값 응답 시 어떤 에러인지 알 수 있게 코드와 메시지로 응답해줘.
- 기상청 응답이 일정시간 (예: 3초) 내 오지 않으면 요청을 중단하고 타임아웃 전용 에러코드와 메시지로 응답해줘.
4) 플러터
- 플러터는 비동기로 JSON값을 받아서 화면 표시만 담당하면서 pull to refresh 갱신 허용해줘.`;

const APP_ADS = `Firebase Hosting 사용해서 AdMob용 app-ads.txt 파일을 호스팅하려고 해.
아래 순서대로 진행해줘 :
1. 현재 디렉토리에 \`app-ads-hosting\` 폴더 만들고 이동
2. \`firebase init hosting\` 실행
- public directory : public
- single-page app : No
- Github 자동 빌드 : No
3. public 폴더 안에 app-ads.txt 파일 생성
- 내용 : google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0 (참고: pub-XXXXXXXXXXXXXXXX는 내 AdMob Publisher ID로 교체 필수)
4. firebase.json에 루트("/") 접속 시 리디렉션 설정은 하지 마. app-ads.txt 파일만 서빙하면 되.
5. firebase deploy -- only hosting 실행
6. 배포 완료 후 호스팅된 URL(https://PROJECT_ID.web.app/app-ads.txt)을 알려줘.
이 URL을 브라우저에서 접속해서 내용이 정상 출력되는지 확인할 수 있게 해줘. `;

const week3 = [
  h(3, "3회차 — 개발하고 연동하기"),
  toggle(
    [b("주제:"), " 본격적으로 개발하기"],
    p(b("내용:")),
    toggle(
      "외부 API 연동하기",
      ol(
        li(
          "API란?",
          ol(
            li(
              "Application Programming Interface의 약자로, 서로 다른 소프트웨어 시스템들이 서로 통신하고 데이터를 주고받을 수 있도록 돕는 연결 규칙. 따라서 URL(주소값)로 호출하는 것이 기본.",
            ),
            li("Supabase 사용 시 로그인/회원가입 후 New project > 프로젝트명, 지역, 비밀번호 입력만 하고 완료한다."),
            li("Claude에 Supabase DB를 활용할 것이라고 명령하고, 기본 세팅을 완료한다. (MCP로 진행해도 됨)"),
            li("환경변수(설정) 값인 Supabase 주소와 anon 키 값을 VSCode의 .env 파일 내 복사해 붙여넣기 해준다."),
            li(
              "예) 기상청API를 기반으로 제미나이로 가공한 날씨 데이터를 내 서비스에서 활용하고 싶다면?",
              ol(
                li("기상청API로 검색한 주소의 웹사이트에서 회원가입하고 필요한 API값을 개인 카톡 등에 복사 붙여넣기해 둔다."),
                li("구글AI스튜디오에 회원가입하고 제미나이와 관련한 API값을 개인 카톡 등에 복사 붙여넣기해 둔다."),
              ),
              code(WEATHER),
            ),
            li("Edge Function Secret키 필요 시 Claude에 시크릿키값 설정 어떤 것이 필요한지 물어본 후, 요구하는 키 이름과 값을 각각 설정하면 된다."),
            li(
              "Supabase Edgefunction 수동 사용 시 Deploy a new function > Functions 내 index.ts파일을 찾아 VSCode에 동일 파일명에 복사+붙여넣기 한다. 저장 시에는 Edgefunction configuration 내 이름값을 통일시키는 것이 중요하다.",
            ),
            li("이 단계가 마무리되면, 앱 빌드(flutter run)해보고 실제로 데이터가 뜨는지 확인해볼 수 있다."),
          ),
        ),
      ),
    ),
    toggle(
      "구글 파이어베이스 연동하기",
      code(
        "플러터 앱에 google_mobile_ads 패키지 설치하고 AdMob SDK 초기화한 뒤 메인 화면 하단에\n배너광고 추가해줘. 개발 환경이므로 광고단위 ID는 반드시 Google 공식 테스트 ID와 테스트 App ID를\n사용하고, Info.plist와 AndroidManifest.xml에 App ID 메타데이터까지 추가해줘.",
      ),
      ul(
        li(
          "app-ads.txt 파일 생성 및 호스팅 설정",
          ol(
            li("Firebase console에서 신규 프로젝트 생성"),
            li("프로젝트 폴더에서 CLI 설치 (명령어 : npm install -g firebase-tools)"),
            li("터미널에서 firebase login (명령어 : firebase login)"),
            li("AI에게 app-ads.txt 기본 설정"),
          ),
          code(APP_ADS),
          ol(li("앱스토어 (앱 정보 → 마케팅URL) / 구글 플레이스토어 (연락처 정보 → 웹사이트)에 URL 등록")),
        ),
        li(
          "주의사항 : 개발 환경에서 광고 단위 ID는 테스트 ID를 사용해야 함. 실제 ID 사용 시 계정 자체가 영구 정지될 수 있으므로, 첫 배포까지 테스트 ID 유지 후 추후 AI에게 실 ID로 교체하는 것이 안전함.",
        ),
      ),
    ),
    toggle(
      "푸시 알림 기능 구현하기",
      code(
        "Firebase Cloud Messaging(FCM) 기반 푸시 알림 기능을 구현해줘. 포그라운드/백그라운드/종료\n상태 모두 수신 처리하고, 토픽 구독 및 개별 토큰 발송 모두 지원해줘. 권한요청은 iOS/Android\n13+ 대응, 푸시 알림을 탭할 때 딥링크로 특정 화면을 라우팅, 수신 데이터는 Notifier로 상태 관리해\nUI에 즉시 반영해야해.",
      ),
      ul(li("구글 파이어베이스 콘솔로 이동 > 새 파이어베이스 프로젝트 만들기 선택 > 프로젝트 생성")),
      code("푸시를 만들기 위해서 파이어베이스 콘솔에서 새로운 프로젝트를 만들었어.\n직접 파이어베이스 프로젝트(bind-app-2026)를 연동해줘. flutterfire configure"),
      code("(패키지 설치)\nflutter pub add firebase_core firebase_messaging 패키지가 있는지 확인하고, 없으면 추가해줘."),
      code("FCM 푸시 알림 초기화 코드 구현해줘"),
      ul(
        li("푸시 토큰이 정상적으로 발급 됐다면, 안드로이드는 더 이상 진행할 것이 없고, iOS 경우 애플 개발자 계정에서 로그인 후, 인증서/ID 및 프로파일을 클릭한다."),
        li(
          "없다면 Certificates를 발행한 후, Identifier > App > App ID > Capability에서 Bundle ID(모르는 경우 AI한테 물어보면 됩니다)를 넣어주고, Push Notifications를 선택하면 ID 생성이 완료된다.",
        ),
        li(
          "이후 Key 메뉴에 들어가, Push Notifications과 Sign in with Apple(로그인 기능 구현 예정 시)를 선택 후 생성 후 다운로드 받는다. 이 때, 샌드박스용 하나, 프로덕션용 하나씩 두벌을 만들며, 파일명도 이를 유추할 수 있도록 만든다.",
        ),
        li(
          "다시 구글 파이어베이스 콘솔로 돌아와서 프로젝트 설정 > 클라우드 메시징으로 진입한 뒤, Apple 앱 구성 내 APNs 인증키 영역 내 다운로드 받은 문서를 업로드(샌드박스용, 프로덕션용)하고 애플 개발자 계정에서 부여 받은 팀ID 값을 입력한다.",
        ),
        li("Xcode로 돌아와 Runner > Signing & Capability 탭에서 Push Notification 항목이 보이는지 확인한다."),
      ),
      code("(테스트 시)\niOS 푸시 토큰 발급 가능한 상황인지 확인해줘. Firebase 콘솔에서 테스트 푸시를 보낼 예정이야."),
      ul(
        li(
          "구글 파이어베이스 콘솔에 프로젝트 내 Messaging 메뉴가 생성됐다면, Firebase 알림 메시지를 클릭하면, 양식에 맞게 입력해 캠페인을 등록한 후 메시지를 전송해 볼 수 있다.",
        ),
        li(
          "푸시 기획 및 운영 시 주의사항",
          ul(li("디바이스 토큰은 알림 권한을 허용한 사람에게만 발급된다."), li("토픽(특정 조건, 20대 여성 등)은 그룹 채팅방을 만드는 것과 동일하다.")),
        ),
      ),
    ),
    p(b("과제 :")),
    ul(li("MVP 구현 후 메인 화면 캡쳐해 제출하기")),
  ),
  status,
];

export const SAMPLE = {
  title: "AI 앱개발 풀스택 코스",
  icon: "📱",
  doc: {
    type: "doc",
    content: [
      h(2, "커리큘럼 구성"),
      p("기획의 시작부터 앱/웹서비스 개발, 배포까지 한번에 진행하는 5주차 코스입니다."),
      hr,
      ...week1,
      hr,
      ...week2,
      hr,
      ...week3,
      hr,
    ],
  },
};
