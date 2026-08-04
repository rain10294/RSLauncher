# RSLauncher

RSLauncher는 [Helios Launcher](https://github.com/dscalzi/HeliosLauncher)를 기반으로 만든 Minecraft Java Edition 런처입니다. Microsoft 계정 인증, Java 자동 관리, 게임 파일 검증, 서버별 배포 인덱스와 자동 접속을 지원합니다.

Pack Studio에서 Minecraft 1.21.1용 Fabric 0.19.2 또는 NeoForge 21.1.248 프로필을 만들 수 있습니다. NeoForge 프로필은 첫 실행 시 공식 설치기를 자동으로 실행하며 이후에는 설치된 파일을 재사용합니다.

- 공식 페이지: <https://github.com/rain10294/RSLauncher>
- Windows 설치파일: <https://github.com/rain10294/RSLauncher/releases/latest>
- 개인정보 처리 안내: [PRIVACY.md](PRIVACY.md)

## 개발 실행

Node.js 22가 필요합니다. Helios 공식 개발 환경과 동일한 버전을 권장합니다.

```powershell
npm install
npm start
```

Windows 설치 파일은 다음 명령으로 생성합니다.

```powershell
npm run dist:win
```

결과물은 `dist/RSLauncher-setup-현재버전.exe`에 생성됩니다.

## 운영 설정

`app/assets/config/launcher.json`에서 다음 값을 설정합니다.

- `azureClientId`: Microsoft Entra 앱 등록의 Application (client) ID
- `distributionUrl`: 운영용 Helios `distribution.json`의 HTTPS 주소
- `updateUrl`: RSLauncher 전용 업데이트 서버의 HTTPS 주소. 비워두면 자동 업데이트가 꺼집니다.

동일한 값은 빌드/실행 환경 변수 `RSLAUNCHER_AZURE_CLIENT_ID`, `RSLAUNCHER_DISTRIBUTION_URL`, `RSLAUNCHER_UPDATE_URL`로도 주입할 수 있습니다. 환경 변수가 설정 파일보다 우선합니다.

RSLauncher 업데이트 서버가 준비되기 전에는 `updateUrl`을 비워두세요. 이 상태에서는 자동 업데이트 메뉴와 네트워크 확인이 비활성화되며, 원본 Helios 업데이트를 내려받지 않습니다.

기본 번들 배포 인덱스는 Fabric 1.21.1/Loader 0.19.2와 RSLauncher 서버 주소를 포함한 실행 가능한 베이스 프로필입니다. 실제 Cobblemon 모드팩을 배포하려면 운영 인덱스에 모드, 리소스팩, 설정 파일을 `FabricMod` 또는 `File` 모듈로 추가하세요.

현재 저장소의 번들 배포 인덱스에는 개발용 `localhost` 주소가 포함되어 있습니다. 다른 사용자에게 배포하기 전에는 모드·셰이더 파일과 `distribution.json`을 공개 HTTPS 호스팅에 올리고 URL을 교체해야 합니다.

Microsoft 인증 앱 등록과 승인은 Helios의 [Microsoft Authentication 문서](https://github.com/dscalzi/HeliosLauncher/blob/master/docs/MicrosoftAuth.md)를 따릅니다.

## 라이선스와 출처

이 프로젝트는 MIT 라이선스의 Helios Launcher를 수정한 파생 프로젝트입니다. 원저작자 Daniel D. Scalzi의 저작권 고지와 [LICENSE.txt](LICENSE.txt)를 유지합니다. RSLauncher는 Microsoft, Mojang Studios 또는 Minecraft의 공식 제품이 아닙니다.
