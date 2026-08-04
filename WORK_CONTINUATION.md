# RSLauncher 작업 인수인계

마지막 정리: 2026-08-04

이 문서는 컴퓨터 재부팅 후 RSLauncher 작업을 바로 이어가기 위한 메모입니다.

## 사용자가 마지막으로 요청한 작업

현재 Helios Launcher 기반인 RSLauncher의 내부 실행 기능은 유지하면서, 사용자가 처음 예시로 보여준 기존 RSLauncher와 같은 방향으로 UI를 다시 디자인한다.

- 기존 잔디 블록 로고를 그대로 사용한다.
- 기존 마인크래프트 산·호수 배경을 그대로 사용한다.
- 홈 화면은 좌측 하단 중심으로 구성한다.
- 큰 `RSLauncher` 제목, 작은 서버명, 계정 정보, 초록색 `게임 시작` 버튼, 설정 버튼을 배치한다.
- 로그인, 다운로드 진행, 설정 화면도 같은 디자인 언어로 통일한다.
- Microsoft 로그인, 게임 설치·실행, Java 자동 설치, Fabric·NeoForge 기능은 그대로 유지한다.
- UI 작업이 끝나면 테스트하고 새 Windows 설치 파일을 만든다.

사용자 요청으로 UI 작업은 일시 중단된 상태이며, 아직 UI 관련 소스 수정은 시작하지 않았다.

## 참고한 예시 런처

예시 런처 바로가기:

`C:\Users\c\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\RSLauncher.url`

바로가기 내용:

```ini
[InternetShortcut]
URL=snowfrost:///instances/RSLauncher/open
IconFile=C:\Users\c\AppData\Roaming/Snowfrost/data\icons\RSLauncher.ico
IconIndex=0
```

예시 홈 화면의 핵심 구성:

- 상단에 얇은 짙은 색 Windows 제목 표시줄
- 전체 화면에 산과 호수 마인크래프트 배경
- 왼쪽과 아래쪽에만 진한 검정 그라데이션
- 좌측 하단에 매우 큰 흰색 `RSLauncher` 제목
- 제목 아래에 작은 `RSLauncher` 서버명
- 마지막 플레이 정보와 초록색 원형 계정 아이콘, 사용자명
- 넓은 초록색 `게임 시작` 버튼
- 실행 버튼 오른쪽에 정사각형 설정 버튼
- 나머지 화면은 배경을 가리지 않고 최대한 비워둠

## 이미 준비된 디자인 파일

- 로고: `app/assets/images/RSIcon.png`
- Windows 아이콘: `app/assets/images/RSIcon.ico`
- 배경: `app/assets/images/RSBackground.png`

현재 배경은 예시 런처의 산·호수 배경과 동일하다. 로고는 잔디 블록 세 개와 식물·버섯이 있는 투명 배경 이미지다.

## UI 관련 주요 파일

- 전체 화면 템플릿: `app/app.ejs`
- 홈 화면: `app/landing.ejs`
- 로그인 방식 선택: `app/loginOptions.ejs`
- Microsoft 로그인 대기·결과: `app/login.ejs`, `app/waiting.ejs`
- 설정 화면: `app/settings.ejs`
- 공통 확인창: `app/overlay.ejs`
- 제목 표시줄: `app/frame.ejs`
- 전체 스타일: `app/assets/css/launcher.css`
- 홈 동작: `app/assets/js/scripts/landing.js`
- 화면 전환·창 버튼: `app/assets/js/scripts/uicore.js`, `app/assets/js/scripts/uibinder.js`

`launcher.css` 맨 아래에는 `RSLauncher Theme` 섹션이 이미 있다. 기존 Helios CSS를 대규모로 지우기보다 이 섹션을 확장해 덮어쓰는 방식이 안전하다. 기능 연결에 사용되는 기존 HTML ID는 가능한 한 유지한다.

## 권장 작업 순서

1. `app/landing.ejs`에 예시 화면용 제목, 서버명, 계정 메타 정보 영역을 추가한다.
2. `launcher.css`의 `RSLauncher Theme` 섹션에서 홈 화면 레이아웃을 좌측 하단형으로 완전히 재배치한다.
3. 기존 `launch_button`, `server_selection_button`, `settingsMediaButton`, `avatarContainer` ID를 유지해 현재 JavaScript 연결을 살린다.
4. 사용하지 않는 홈 화면의 SNS 버튼과 기존 서버 상태 영역은 숨기거나 간소화한다.
5. 로그인 선택 화면을 중앙 카드 또는 좌측 하단 패널 형태로 같은 디자인에 맞춘다.
6. 설정 화면을 짙은 반투명 패널과 초록색 강조색으로 통일한다.
7. 다운로드 중에는 게임 시작 버튼 자리에 진행률과 상태 문구가 자연스럽게 표시되도록 스타일링한다.
8. `npm run lint`로 검사한다.
9. `npm start`로 실행한 뒤 홈, 로그인, 설정, 오류 오버레이를 확인한다.
10. 완료 후 버전을 올리고 `npm run dist:win`으로 새 설치 파일을 만든다.

## 현재 런처 상태

- 프로젝트 경로: `C:\Users\c\Desktop\새 폴더\minecraft\Launcher`
- Git 브랜치: `main`
- UI 작업 전 마지막 루트 커밋: `814a846 feat: add NeoForge profile support`
- 현재 앱 버전: `1.0.3`
- GitHub: `https://github.com/rain10294/RSLauncher`
- GitHub Pages: `https://rain10294.github.io/RSLauncher/`
- 최신 공개 릴리스: `v1.0.3`
- 최신 설치 파일: `https://github.com/rain10294/RSLauncher/releases/download/v1.0.3/RSLauncher-setup-1.0.3.exe`

현재 `app/assets/config/launcher.json`:

```json
{
  "azureClientId": "ed3f9589-1bd1-4a5e-ada0-3feb339c2011",
  "distributionUrl": "",
  "updateUrl": ""
}
```

`distributionUrl`과 `updateUrl`은 아직 비어 있다.

## 이미 완료된 런처 기능

- Snowfrost 이름과 관련 문구 제거
- Microsoft Azure Client ID 설정
- 기존 버전 제거 후 새 버전을 설치하도록 NSIS 설정
- Fabric 프로필 실행 지원
- NeoForge 공식 설치 파일을 첫 실행 때 설치하는 사용자 정의 지원
- Java 요구 버전 기반 자동 설치 구조 유지
- Windows 설치 파일 v1.0.3 제작 및 공개 배포

NeoForge 관련 주요 파일:

- `app/assets/js/neoforgeinstaller.js`
- `app/assets/js/processbuilder.js`
- `app/assets/js/distromanager.js`

이 파일들의 동작은 UI 개편 중 건드리지 않는 것이 좋다.

## Pack Studio 상태

Pack Studio 경로:

`C:\Users\c\Desktop\새 폴더\minecraft\Launcher\profile-builder`

배포 주소:

`https://rslauncher-pack-studio.rain10294.chatgpt.site`

마지막 Pack Studio 커밋:

`620b89b Add live loader and Java version selection`

현재 Pack Studio 기능:

- 모드, 셰이더, 리소스팩, config, defaultconfigs, KubeJS, options 및 기타 파일 분류
- 여러 파일을 한 번에 넣어 `distribution.json`과 배포 ZIP 생성
- Fabric 또는 NeoForge 선택
- Fabric Meta와 NeoForged Maven에서 공식 버전 목록 자동 조회
- 마인크래프트 버전별 호환 로더 버전 선택
- `최신 목록 조회·적용` 버튼
- Java 8, 17, 21, 25 선택
- 선택한 Java가 없으면 런처 전용 폴더에 자동 설치한다는 안내

Pack Studio는 현재 Sites 프로젝트에 비공개 소유자 전용으로 배포되어 있다.

## 재시작 후 첫 확인 명령

```powershell
Set-Location 'C:\Users\c\Desktop\새 폴더\minecraft\Launcher'
git status --short
Get-Content -Raw WORK_CONTINUATION.md
```

그 다음 UI 작업을 재개하면 된다.

