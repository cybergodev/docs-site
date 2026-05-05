---
title: 프로덕션 체크리스트 - CyberGo env | 보안 출시 점검
description: CyberGo env 라이브러리 프로덕션 환경 배포 전 보안 점검 완전 체크리스트입니다. 설정 파일 권한 관리, 키-값 검증 규칙 구성, 감사 로그 활성화 확인, 민감 데이터 보안 처리 방식, 오류 처리 전략 및 성능 보안 매개변수 튜닝 등 핵심 보안 점검 항목을 다루어 Go 애플리케이션이 프로덕션 환경에서 지속적으로 안전하고 안정적으로 실행되도록 보장합니다.
---

# 프로덕션 체크리스트

애플리케이션을 프로덕션 환경에 배포하기 전의 점검 체크리스트입니다.

::: tip 보안 개념
보안 아키텍처와 핵심 기능에 대한 자세한 내용은 [보안 개요](/ko/env/security/)。
:::

## 배포 전 점검

### 파일 보안

- [ ] `.env.production` 파일 존재
- [ ] 파일 권한이 `600` 또는 더 엄격함
- [ ] 민감 파일이 `.gitignore`에 추가됨
- [ ] 설정 파일에 자리 표시자가 없음 (예: `change-me`, `xxx`)

```bash
# 권한 확인
ls -la .env.production
# 표시되어야 함: -rw------- (600)

# 권한 수정
chmod 600 .env.production
```

### 설정 검증

- [ ] 모든 필수 키가 설정됨
- [ ] 민감 값이 비어 있지 않음
- [ ] 값 형식이 올바름 (URL, 포트 등)
- [ ] 하드코딩된 키 없음

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{
    "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD",
    "API_KEY", "API_URL",
}
cfg.FailOnMissingFile = true
```

## 보안 설정 점검

### 감사 로그

- [ ] 감사 로그가 활성화됨
- [ ] 로그 디렉토리가 쓰기 가능함
- [ ] 로그 파일 권한이 올바름

```go
auditFile, _ := os.OpenFile("/var/log/app/audit.log",
    os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)
```

### 민감 데이터 처리

- [ ] 민감 값은 `GetSecure`로 가져옴
- [ ] 적시에 `Close()`를 호출하여 리소스 해제
- [ ] 로그에 원래 민감 값을 출력하지 않음

```go
secret := loader.GetSecure("DB_PASSWORD")
defer secret.Close()
log.Printf("Password length: %d", secret.Length())
```

### 접근 제어

- [ ] `AllowedKeys` 화이트리스트 설정 (권장)
- [ ] `ValidateValues` 활성화
- [ ] 적절한 크기 제한 설정

```go
cfg.AllowedKeys = []string{"APP_NAME", "DB_HOST", "API_KEY"}
cfg.ValidateValues = true
cfg.MaxVariables = 100
```

## 배포 시 점검

- [ ] 설정 파일이 안전한 위치에서 로드됨
- [ ] 애플리케이션 시작 시 설정 검증
- [ ] 설정 오류 시 애플리케이션이 시작을 거부함
- [ ] 민감 정보가 로그에 출력되지 않음

## 배포 후 점검

- [ ] 애플리케이션이 정상적으로 실행됨
- [ ] 감사 로그가 정상적으로 기록됨
- [ ] 민감 정보 유출 없음
- [ ] 설정 관련 오류 모니터링

## 빠른 점검 스크립트

```bash
#!/bin/bash
# pre-deploy-check.sh

set -e

echo "=== Pre-deployment Config Check ==="

# 파일 존재 확인
[ -f ".env.production" ] || { echo "ERROR: .env.production not found"; exit 1; }

# 권한 확인
PERMS=$(stat -c %a .env.production 2>/dev/null || stat -f %Lp .env.production)
[ "$PERMS" = "600" ] || [ "$PERMS" = "400" ] || echo "WARNING: permissions are $PERMS"

# 자리 표시자 확인
grep -qE "(change-?me|placeholder|xxx|YOUR_)" .env.production && \
    { echo "ERROR: Found placeholder values"; exit 1; }

# 필수 키 확인
for key in DB_HOST DB_PORT DB_USER DB_PASSWORD API_KEY; do
    grep -q "^$key=" .env.production || { echo "ERROR: Missing $key"; exit 1; }
done

echo "=== All checks passed ==="
```

## 관련 문서

- [보안 개요](/ko/env/security/) - 보안 아키텍처와 핵심 기능
- [SecureValue API](/ko/env/api-reference/secure-value) - 안전값처리
- [상수 및 오류](/ko/env/api-reference/constants) - 금지 키 목록
