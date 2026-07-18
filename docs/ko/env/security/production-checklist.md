---
sidebar_label: "프로덕션 체크리스트"
title: "프로덕션 체크리스트 - CyberGo env | 보안 배포 검사"
description: "CyberGo env 프로덕션 배포 보안 체크리스트로 .env 파일 600 권한과 .gitignore 보호, RequiredKeys/AllowedKeys 필수 키 검증, 감사 로그 활성화, SecureValue 처리, 성능 매개변수 튜닝을 다뤄 안전한 출시를 보장합니다."
sidebar_position: 2
---

# 프로덕션 체크리스트

프로덕션 환경에 애플리케이션을 배포하기 전 검사 목록입니다.

::: tip 보안 개념
보안 아키텍처와 핵심 기능은 [보안 개요](/ko/env/security/)를 참조하세요.
:::

## 배포 전 검사

### 파일 보안

- [ ] `.env.production` 파일 존재
- [ ] 파일 권한이 `600` 이상으로 제한됨
- [ ] 민감 파일이 `.gitignore`에 추가됨
- [ ] 구성 파일에 자리 표시자가 없음 (예: `change-me`, `xxx`)

```bash
# 권한 확인
ls -la .env.production
# 표시되어야 함: -rw------- (600)

# 권한 수정
chmod 600 .env.production
```

### 구성 검증

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

## 보안 구성 검사

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

- [ ] 민감 값에 `GetSecure`를 사용하여 가져오기
- [ ] `Close()`를 적절히 호출하여 리소스 해제
- [ ] 로그에 원본 민감 값을 출력하지 않음

```go
secret := loader.GetSecure("DB_PASSWORD")
defer secret.Close()
log.Printf("Password length: %d", secret.Length())
```

### 접근 제어

- [ ] `AllowedKeys` 허용 목록 설정 (권장)
- [ ] `ValidateValues` 활성화
- [ ] 적절한 크기 제한 설정

```go
cfg.AllowedKeys = []string{"APP_NAME", "DB_HOST", "API_KEY"}
cfg.ValidateValues = true
cfg.MaxVariables = 100
```

## 배포 시 검사

- [ ] 구성 파일을 보안 위치에서 로딩
- [ ] 애플리케이션 시작 시 구성 검증
- [ ] 구성 오류 시 애플리케이션 시작 거부
- [ ] 민감 정보를 로그에 출력하지 않음

## 배포 후 검사

- [ ] 애플리케이션이 정상 실행됨
- [ ] 감사 로그가 정상적으로 기록됨
- [ ] 민감 정보 유출 없음
- [ ] 구성 관련 오류 모니터링

## 빠른 검사 스크립트

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

- [보안 개요](/ko/env/security/) - 보안 아키텍처 및 핵심 기능
- [SecureValue API](/ko/env/api-reference/secure-value) - 보안 값 처리
- [상수 및 오류](/ko/env/api-reference/constants) - 금지 키 목록
