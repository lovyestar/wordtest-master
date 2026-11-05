# 영단어

[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF.svg?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4.svg?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20·%20Firestore%20·%20Functions-FFCA28.svg?logo=firebase&logoColor=black)](https://firebase.google.com)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-F38020.svg?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)

### 고등학교 영단어 학습 · 감독 시험 웹 서비스 (with CheckStar)

https://wordtest.example.com

---

* #### Features
    * 단어장 열람 / 단어 외우기 (플래시카드, 채점·랭킹 미반영)
    * 단어 발음 듣기 (미리 합성한 음성, 모든 기기 동일)
    * 단어 모의 시험 + 실시간 랭킹
    * 단어 테스트 — 선생님이 개설하는 감독 시험
    * **CheckStar** — 화면 이탈 자동 감지 및 실격 처리, 근거 기록
    * 관리자 페이지 (단어장 CRUD, 시험 모니터링, 엑셀 다운로드, 선생님 가입 승인)
* #### Stack
    * Frontend: Vite, React, TypeScript, React Router, Zustand, Tailwind CSS
    * Backend: Firebase (Auth, Firestore, Cloud Functions, Storage)
    * Hosting: Cloudflare Workers (정적 자산)

---

온라인 시험은 학생이 다른 탭을 열어 단어를 찾아보는 순간부터 의미가 없어집니다.  
감독 시험을 브라우저에서 치르면 다음과 같은 우회가 생깁니다.

* 탭 전환, 창 최소화, 다른 프로그램으로 이동
* 전체화면 해제
* 뒤로 가기 (Chromebook의 이전 페이지 키)
* 두 개의 창으로 동시에 응시

그리고 막는 것만큼 중요한 게 **"정말 했는지"를 선생님이 확인할 수 있는 근거**입니다.

*CheckStar*는 시험 화면에서 이탈 이벤트를 감시하다가, 감지되는 즉시 응시를 취소하고  
그 순간의 상태와 직전 행동을 서버 시각과 함께 남깁니다.

---

### CheckStar

| 감지 대상 | 이벤트 | 기록되는 사유 |
|---|---|---|
| 탭 전환, 창 최소화 | `visibilitychange` | `visibility_hidden` |
| 다른 창으로 포커스 이동 | `window blur` | `blur` |
| 전체화면 해제 | `fullscreenchange` | `fullscreen_exit` |
| 뒤로 가기 | `popstate` | `navigate_away` |
| 새로고침 | `PerformanceNavigationTiming` | `page_reload` (기록만, 실격 아님) |

이벤트를 놓쳐도 잡을 수 있도록 0.5초마다, 그리고 `focus` / `pageshow` 때 상태를 다시 확인합니다.  
실격이 되면 서버 응답을 기다리지 않고 화면부터 즉시 잠급니다.

```tsx
// WordTestRun.tsx
const disqualify = useCallback(async (type: ViolationType) => {
  if (disqualifiedRef.current || submittedRef.current || !attemptPath) return
  disqualifiedRef.current = true
  setLocalDisqualified(type) // 서버 쓰기와 무관하게 화면 즉시 잠금

  const detail = recorderRef.current?.snapshot(indexRef.current + 1)
  await Promise.allSettled([
    updateDoc(doc(db, attemptPath), { status: 'disqualified', disqualifiedReason: type }),
    addDoc(collection(db, attemptPath, 'violations'), { type, at: serverTimestamp(), detail }),
  ])
}, [attemptPath])
```

한 번에 하나의 창에서만 응시할 수 있고(`activeSessionToken`), 남은 시간은 서버가 기록한 시작 시각 기준으로 계산합니다.

---

### 감지 근거

관리자 페이지의 시험 모니터링에서 응시자마다 **감지 근거**를 열 수 있습니다.

* 발생 시각 (서버 기준, 학생이 수정 불가)
* 시험 경과 시간, 풀던 문항 번호
* 페이지 / 포커스 / 전체화면 / 네트워크 상태, 기기 종류
* 직전 행동 기록 (탭 이동 키, 뒤로 가기, 창 크기 변경 등)
* 실격 후 시험 화면으로 돌아오기까지 걸린 시간
* 위 내용을 한국어 요약으로 정리한 **근거 텍스트 복사**

```text
0.9초 전  뒤로 가기 (Chromebook 이전 페이지 키 등)   (history back)
0.0초 전  실격 처리됨
```

입력한 답이나 일반 글자 키는 기록하지 않습니다. 단축키 조합과 `Tab`, `Escape` 같은 이름 있는 키만 남깁니다.

> 모든 감시는 브라우저 이벤트에 기반합니다. 개발자 도구, 다른 기기 사용, 클라이언트 코드 조작은 막을 수 없고,
> 알림 팝업 등으로 포커스가 빠지면 실격될 수 있습니다. 그래서 차단보다 **기록과 확인**에 무게를 둡니다.

---

### 보안 구조

채점, 랭킹 집계처럼 위변조가 우려되는 로직은 전부 Cloud Functions(서버)에서만 처리합니다.  
Firestore 보안 규칙은 응시 문서에 대해 학생이 바꿀 수 있는 필드를 `status`(`in_progress` → `disqualified`만),
`disqualifiedAt`, `disqualifiedReason`, `activeSessionToken`으로 제한하고, 점수와 답안은 서버만 쓸 수 있습니다.  
`violations`는 추가만 가능한 기록입니다.

---

### 시작하기

#### 사전 준비

* Node.js 22
* Firebase 프로젝트 (Auth: Google 로그인 / Firestore / Storage / Blaze 요금제)
* 같은 GCP 프로젝트에서 [Cloud Text-to-Speech API](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com) 사용 설정
* Firebase CLI (`npm i -g firebase-tools`)

#### 설치

```bash
npm install
cd functions && npm install && cd ..
```

#### 환경 변수

`.env.example`을 `.env`로 복사한 뒤, **본인의 Firebase 콘솔**(프로젝트 설정 → 일반 → 내 앱)에서 발급받은 값으로 채웁니다.  
`.firebaserc`의 `default` 프로젝트 ID도 변경해주세요.

```bash
cp .env.example .env
```

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GOOGLE_HD=                 # 선택: 특정 구글 워크스페이스 도메인으로 로그인 제한
```

#### 실행

```bash
npm run dev
```

#### 최초 관리자 등록 / 단어 시딩

서비스 계정 키(JSON)를 로컬에 내려받은 뒤 실행합니다.

```bash
GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json" npm run bootstrap-admin
GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json" npm run seed   # 선택
```

#### 배포

```bash
# Firestore·Storage 규칙 / Cloud Functions
firebase deploy --only firestore:rules,storage,functions

# 프론트엔드 (Cloudflare Workers) — wrangler.toml의 name/도메인을 먼저 수정
npx wrangler login
npm run deploy
```

---

### 폴더 구조

```
src/            학생·교사 프론트엔드 (React)
  lib/            시험 출제, 근거 수집(violationEvidence) 등
  pages/WordTest/ 학생 응시 화면 (CheckStar 감시)
  pages/Teacher/  관리자 · 시험 모니터링 · 감지 근거
functions/      Cloud Functions (채점, 랭킹 집계, 단어 발음 합성, 관리자 승인)
scripts/        관리자 부트스트랩 / 단어 시딩용 1회성 스크립트
firestore.rules Firestore 접근 제어 규칙
```
