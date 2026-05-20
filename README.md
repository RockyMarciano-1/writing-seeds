# 글의 씨앗 · Writing Seeds

떠오르는 글쓰기 주제를 음성·텍스트로 빠르게 담아두고, GitHub에 자동 저장하며, Claude로 발전시키는 PWA.

## 설정 순서

### 1. 데이터 저장용 GitHub 저장소 만들기
- github.com 로그인 → New repository
- 이름 예: `writing-seeds-data`
- **Private** 선택 권장 (개인 글감 보호)
- README 추가 체크 (빈 저장소면 초기 파일이 없어 PUT만으로도 동작하지만, 깔끔하게 시작하려면 추가)
- Create

### 2. GitHub Personal Access Token 발급
1. github.com → 프로필 → Settings
2. Developer settings → Personal access tokens → **Tokens (classic)**
3. Generate new token (classic)
4. Note: `writing-seeds`
5. Expiration: **No expiration**
6. 권한: **repo** 체크 (전체)
7. Generate → `ghp_...` 토큰 복사 (이 화면 벗어나면 다시 못 봄)

### 3. 앱 배포 (GitHub Pages)
- 코드용 별도 저장소(예: `writing-seeds`) 만들기 — 이건 public이어도 OK
- index.html / app.js / manifest.json / sw.js 업로드
- Settings → Pages → main 브랜치 활성화
- `https://RockyMarciano-1.github.io/writing-seeds/` 접속

### 4. 앱에서 설정 입력
- 우상단 붉은 도장(設) 버튼
- **Anthropic API Key**: `sk-ant-...`
- **GitHub 사용자명**: `RockyMarciano-1`
- **저장소 이름**: `writing-seeds-data` (데이터용 repo)
- **파일 경로**: `seeds.json` (기본값 그대로 OK)
- **GitHub Token**: `ghp_...`
- 저장하고 닫기

## 동작 방식

- **씨앗 심기 / 삭제 / 확장** → 1.5초 후 GitHub에 자동 푸시
- **앱 시작 시** → GitHub에서 최신본 자동 로드
- **상단 좌측 표시등**: 회색(로컬) / 황금색(동기화 중) / 녹색(완료) / 적색(오류)
- **씨앗방 화면 상단**:
  - `↻ GitHub 동기화` — 수동으로 푸시
  - `↓ GitHub에서 불러오기` — 다른 기기에서 만든 데이터 가져오기

## 새 기기에서 쓸 때

1. 앱 URL 접속
2. 설정 → 같은 GitHub 정보 + 토큰 입력 → 저장
3. 자동으로 GitHub에서 데이터 불러옴 (혹은 `↓ GitHub에서 불러오기`)

## 보안 메모

- 토큰과 API 키는 **코드에 절대 들어가지 않고**, 각 기기의 brower localStorage에만 저장됨
- 데이터 저장소를 private으로 두면 토큰이 노출되어도 일반 공개되지 않음
- 토큰이 의심되면 GitHub에서 즉시 폐기 후 새로 발급
