# 광명고등학교 영단어 시스템

고등학교 영단어 학습/시험 웹 서비스입니다. 학생은 구글 계정으로 로그인해 랭킹, 자율 학습, 모의 시험,
그리고 선생님이 진행하는 감독 시험(단어 테스트)에 응시할 수 있습니다. 선생님은 관리자 페이지에서
단어장과 시험을 직접 관리합니다.

배포 주소: https://kmhswords.yestar.dev

## 주요 기능

- **랭킹**: 오늘 응시한 단어 모의 시험 중 최고 점수 기준 실시간 순위
- **단어장 / 단어 외우기**: 단어장 열람, 단어를 하나씩 넘기며 학습 (채점·랭킹 반영 없음)
- **단어 발음 듣기**: 단어가 등록되면 Cloud Function이 Google Cloud TTS로 mp3를 미리 만들어 두어,
  모든 기기에서 같은 음성으로 재생 (감독 시험 화면에는 노출하지 않음)
- **단어 모의 시험**: 학생이 원할 때마다 자율적으로 응시하는 연습 시험
- **단어 테스트**: 선생님이 개설하는 감독 시험 — 실명 응시, **CheckStar**가 탭 전환/창 포커스
  이탈/전체화면 이탈을 감지해 자동 실격 처리
- **관리자 페이지**: 단어장 CRUD(일괄 가져오기 포함), 시험 생성 및 실시간 모니터링, 엑셀 결과
  다운로드, 선생님 가입 승인, 다크 모드

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프론트엔드 | Vite, React, TypeScript, React Router, Zustand, Tailwind CSS |
| 백엔드 | Firebase (Auth, Firestore, Cloud Functions, Storage) |
| 배포 | Cloudflare Workers (정적 자산 호스팅) |

채점·리더보드 등 위변조가 우려되는 로직은 전부 Cloud Functions(서버)에서만 처리하며, Firestore 보안
규칙으로 클라이언트의 직접 쓰기를 차단합니다.

## 시작하기

### 1. 사전 준비

- Node.js 20 이상
- Firebase 프로젝트 (Auth: Google 로그인 활성화 / Firestore / Storage / Blaze 요금제)
- 같은 GCP 프로젝트에서 [Cloud Text-to-Speech API](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com) 사용 설정 (단어 발음용)
- Firebase CLI (`npm i -g firebase-tools`)

### 2. 설치

```bash
npm install
cd functions && npm install && cd ..
```

### 3. 환경 변수 설정

`.env.example`을 `.env`로 복사한 뒤, 각 값을 **본인의 Firebase 콘솔**(프로젝트 설정 → 일반 → 내
앱)에서 발급받은 값으로 채워주세요. 저장소에는 실제 키를 포함하지 않았습니다.

```bash
cp .env.example .env
```

```
VITE_FIREBASE_API_KEY=          # Firebase 콘솔에서 발급받은 값 입력
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GOOGLE_HD=                 # 선택: 특정 구글 워크스페이스 도메인으로 로그인 제한
```

`.firebaserc`의 `default` 프로젝트 ID도 본인의 Firebase 프로젝트 ID로 변경해주세요.

### 4. 로컬 개발

```bash
npm run dev
```

### 5. 최초 관리자(슈퍼 관리자) 등록

Firebase 콘솔에서 서비스 계정 키(JSON)를 발급받아 로컬에 내려받은 뒤:

```bash
GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json" npm run bootstrap-admin
```

### 6. 단어 데이터 시딩 (선택)

```bash
GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json" npm run seed
```

### 7. 배포

```bash
# Firestore·Storage 규칙 / Cloud Functions
firebase deploy --only firestore:rules,storage,functions

# 프론트엔드 (Cloudflare Workers)
npm run deploy
```

Cloudflare Workers로 배포하려면 `wrangler.toml`의 `name`/도메인을 본인 환경에 맞게 수정하고,
`npx wrangler login`으로 먼저 로그인해주세요.

## 폴더 구조

```
src/                학생·교사 프론트엔드 (React)
functions/           Cloud Functions (채점, 랭킹 집계, 관리자 승인 등 서버 로직)
scripts/             관리자 부트스트랩 / 단어 시딩용 1회성 스크립트
firestore.rules      Firestore 접근 제어 규칙
```
