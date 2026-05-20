# 글의 씨앗 · Writing Seeds

떠오르는 글쓰기 주제를 음성·텍스트로 빠르게 담아두고, 나중에 Claude로 발전시키는 PWA.

## 주요 기능

- **음성 받아쓰기**: 한국어 음성 인식으로 곧장 메모
- **텍스트 입력**: 키보드로도 자유롭게
- **로컬 저장**: 모든 씨앗은 브라우저에 안전하게 보관
- **Claude 확장**: 짧은 메모를 핵심 주제 / 접근 각도 / 질문 / 첫 문장으로 발전
- **JSON 내보내기/가져오기**: 데이터 백업과 기기 간 이동
- **오프라인 동작**: 서비스 워커로 인터넷 없이도 메모 가능
- **PWA 설치**: 홈 화면에 추가하여 앱처럼 사용

## 사용법

1. **로컬에서 실행**
   ```
   cd writing-seeds
   python3 -m http.server 8000
   ```
   브라우저에서 `http://localhost:8000` 접속.
   
   ※ 음성 인식과 PWA 기능은 HTTPS 또는 localhost에서만 동작합니다.

2. **GitHub Pages 배포**
   - 기존 `RockyMarciano-1` 계정에 새 저장소를 만들고 파일을 올린 뒤
   - Settings → Pages → main 브랜치 활성화
   - `https://RockyMarciano-1.github.io/저장소이름/` 로 접속

3. **Claude 확장 기능을 쓰려면**
   - 우상단의 붉은 도장(設) 버튼 → API Key 입력 → 닫기
   - 키는 이 기기의 브라우저에만 저장되며 외부로 전송되지 않습니다 (호출 시 Anthropic API 외에는)

## 파일 구조

```
writing-seeds/
├── index.html      # UI와 스타일
├── app.js          # 로직 (음성, 저장, API 호출)
├── manifest.json   # PWA 매니페스트
├── sw.js           # 서비스 워커 (오프라인)
└── README.md
```

## 디자인 노트

한지(韓紙)와 먹의 분위기를 기반으로, 붉은 인장(印章)과 한자 한 글자가 포인트.
Noto Serif KR과 Cormorant Garamond의 조합. 차분한 색조 안에서 행위(녹음·확장)
순간에만 주묵(朱墨)의 붉은빛이 들어옵니다.

## 보안 메모

- `anthropic-dangerous-direct-browser-access: true` 헤더를 사용해 브라우저에서 직접 API를 호출합니다. 본인만 쓰는 개인 도구라면 충분하지만, 다른 사람과 공유하는 환경이라면 API 키 관리에 주의하세요.
- 더 안전하게 쓰려면 Cloudflare Workers 같은 곳에 작은 프록시를 두고 키를 서버 쪽에 두는 방식을 고려해볼 수 있습니다.
