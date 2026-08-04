# RSLauncher 화이트리스트 서비스

Cloudflare Workers + D1로 동작하는 서버별 런처 화이트리스트 관리자입니다.

## 동작 방식

- 관리자 사이트는 Cloudflare Secret에 설정한 비밀번호로 로그인합니다.
- 마인크래프트 Java 아이디를 입력하면 Mojang 프로필 API로 UUID를 조회해 D1에 저장합니다.
- 런처는 플레이 버튼을 누를 때 `POST /api/v1/check`로 현재 계정 UUID를 검사합니다.
- 화이트리스트를 추가하거나 삭제해도 런처를 다시 배포할 필요가 없습니다.
- 등록된 전체 UUID 목록은 외부에 공개하지 않습니다.

## 처음 배포

이 폴더에서 아래 순서로 실행합니다.

```powershell
npm install
npx wrangler login
npm run deploy
npm run db:migrate:remote
npm run secrets:configure
```

`npm run secrets:configure`를 실행하면 원하는 비밀번호를 두 번 숨김 입력합니다. 비밀번호는 8자 이상이어야 합니다. 평문 비밀번호는 소스나 GitHub에 저장하지 않으며, 해시만 Cloudflare Secret에 들어갑니다.

배포가 끝나면 Wrangler가 표시하는 `https://rslauncher-whitelist.<계정>.workers.dev` 주소가 관리자 사이트이자 API 기본 주소입니다.

## 로컬 테스트

```powershell
npm install
npm run db:migrate:local
npm test
npm run dev
```

로컬 관리자 로그인을 시험하려면 `.dev.vars`에 `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`을 넣을 수 있습니다. `.dev.vars`는 Git에서 제외됩니다.

## 런처 검사 요청

```http
POST /api/v1/check
Content-Type: application/json

{
  "serverId": "cobblemon",
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38afcb"
}
```

허용된 계정은 `allowed: true`, 미등록 계정은 `allowed: false`를 받습니다. `serverId`에는 관리자 사이트에 표시되는 서버 코드를 사용합니다.
