# adelie_web

**남극캠퍼스.ai**: 강사 아델리와 학생 아델리가 남극 빙붕 위에 펭귄으로 모여 AI를 함께 공부하는 실시간 가상 공간입니다.

- 공부 캠프 구역: 집중 개인석 · 스탠딩석 · 카페석. 둘레는 빙하와 남극 동물이 사는 풍경이에요.
- 실시간 접속과 출석부, 공부 시간을 보여줘요.
- 말풍선 대화와 `@닉네임` 태그를 쓸 수 있어요.
- 1:1 비밀 대화는 신청하고 상대가 수락하면 시작돼요. 대화 중인 두 펭귄만 내용을 볼 수 있어요.
- 신고가 서로 다른 2명 이상에게서 들어오면 관리자에게 알림이 가고, 관리자가 퇴장시킬 수 있어요.
- 날씨가 매시간 바뀌어요: 맑음, 함박눈, 눈보라, 오로라 밤, 해무, 다이아몬드 더스트.

## 실행

```bash
npm install && (cd functions && npm install)
npm run dev          # Next(3000) + Firebase 에뮬레이터(Auth·Realtime Database·Functions, 관리 화면 4000)
npm run test:rules   # 보안 규칙 검증
npm run test:room    # 접속·이동·자리·말풍선 흐름 검증
npm run test:dm      # 비밀 대화·신고·관리자 흐름 검증 (Cloud Functions 포함)
```

http://localhost:3000 에서 Google로 로그인해 입장해요. 에뮬레이터에서는 가짜 계정 선택 창이 떠요(Java 필요).
관리자 지정: 에뮬레이터 관리 화면(또는 운영 콘솔)의 Realtime Database에서 `users/{uid}/role`을 `"admin"`으로 바꿔요.

## 구조

| 경로 | 내용 |
|---|---|
| `src/app` | 입장 화면(`/`), 스터디룸(`/office`) |
| `src/components/office` | 맵·풍경 그림, 아바타, 입력창, 비밀 대화, 관리자 패널, 날씨 |
| `src/lib` | Firebase 연결: 계정(`account`), 스터디룸(`room`), 비밀 대화(`dm`), 신고·관리자(`moderation`) |
| `src/shared` | 맵·공통 타입·길찾기·날씨 |
| `firebase/` | Realtime Database 보안 규칙 (Firestore는 쓰지 않아 잠가 둠) |
| `functions/` | Cloud Functions: 신고 스냅샷·관리자 공개 기준, 끝난 비밀 대화 메시지 정리 |
| `scripts` | 검증 스크립트 |
| `docs/ROADMAP.md` | 구현 로드맵과 결정 사항 |
