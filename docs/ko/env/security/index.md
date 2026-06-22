---
title: "보안 개요 - CyberGo env | 보안 아키텍처"
description: "CyberGo env 보안 아키텍처 개요로 SecureValue 메모리 잠금, 키 검증, 금지 키 목록, IsSensitiveKey 자동 감지, 보안 프리셋과 감사 추적을 설명합니다."
---

# 보안 개요

환경 변수는 민감 정보를 저장하는 경우가 많아, 보안 처리가 매우 중요합니다. 이 문서는 env 라이브러리의 보안 아키텍처와 핵심 기능을 개요합니다.

## 보안 아키텍처

```text
┌──────────────────────────────────────────────────────────────┐
│                          애플리케이션 계층                      │
├──────────────────────────────────────────────────────────────┤
│   SecureValue   │    마스킹    │    영값 초기화    │   메모리 잠금   │
├──────────────────────────────────────────────────────────────┤
│                          Loader 계층                          │
├──────────────────────────────────────────────────────────────┤
│     키 검증      │   값 검증   │   금지 키   │   크기 제한       │
├──────────────────────────────────────────────────────────────┤
│                          파싱 계층                             │
├──────────────────────────────────────────────────────────────┤
│    형식 감지     │  확장 검사  │       경로 검증                 │
└──────────────────────────────────────────────────────────────┘
```

## 핵심 보안 기능

| 기능 | 설명 | 문서 |
|------|------|------|
| **SecureValue** | 민감 값 메모리 보호, 자동 영값 초기화 | [SecureValue API](/ko/env/api-reference/secure-value) |
| **금지 키** | 시스템 핵심 변수 수정 방지 | [상수 및 오류](/ko/env/api-reference/constants#defaultforbiddenkeys) |
| **민감 키 감지** | 민감 설정 키 자동 식별 | [상수 및 오류](/ko/env/api-reference/constants#sensitivekeypatterns) |
| **값 검증** | 제어 문자, 널 바이트 등 감지 | [Config API](/ko/env/api-reference/config) |
| **감사 로그** | 전체 작업 추적 | [컴포넌트 팩토리](/ko/env/api-reference/factory) |

## SecureValue 소개

민감 데이터의 경우 `GetString` 대신 `GetSecure`를 사용하세요:

```go
// 비권장
password := env.GetString("DB_PASSWORD")

// 권장
secret := env.GetSecure("DB_PASSWORD")
defer secret.Close()
password := secret.Reveal()  // 평문이 필요할 때만 호출
```

**핵심 기능:**
- **메모리 잠금** - 디스크 스왑 방지 (Linux/macOS/FreeBSD)
- **자동 영값 초기화** - `Close()` 시 보안 메모리 삭제
- **마스킹 표시** - `Masked()`는 로그 출력에 사용
- **스레드 안전** - 동시 읽기 지원

::: tip 전체 API
자세한 내용은 [SecureValue API](/ko/env/api-reference/secure-value)를 참조하세요.
:::

## 키/값 검증

### 키 검증

기본 키 이름 규칙: `^[A-Za-z][A-Za-z0-9_]*$`

- 문자로 시작
- 문자, 숫자, 밑줄만 포함
- 길이가 `MaxKeyLength`를 초과하지 않음

### 금지 키

내장 금지 키로 시스템 핵심 변수 수정을 방지합니다:

| 범주 | 예시 | 위험 |
|------|------|------|
| 시스템 경로 | `PATH`, `LD_LIBRARY_PATH` | 명령/라이브러리 가로채기 |
| 동적 링크 | `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES` | 악성 라이브러리 주입 |
| Shell | `SHELL`, `IFS`, `BASH_ENV` | Shell 가로채기 |
| 언어 런타임 | `PYTHONPATH`, `NODE_PATH` | 모듈 가로채기 |

::: tip 전체 목록
[DefaultForbiddenKeys](/ko/env/api-reference/constants#defaultforbiddenkeys)에서 전체 금지 키 목록을 확인하세요.
:::

### 값 검증

값 검증을 활성화하여 잠재적 위험을 감지합니다:

```go
cfg := env.ProductionConfig()
cfg.ValidateValues = true  // 제어 문자, 널 바이트 등 감지
```

## 파일 보안 기초

### 파일 권한

```bash
# 소유자만 읽기/쓰기
chmod 600 .env

# 또는 더 엄격 (읽기 전용)
chmod 400 .env
```

### Git 무시

```bash
.env
.env.local
.env.*.local
*.pem
*.key
```

## 구성 보안 수준

| 프리셋 | 용도 | 특징 |
|------|------|------|
| `DevelopmentConfig()` | 개발 환경 | 완화된 제한, YAML 구문 지원 |
| `TestingConfig()` | 테스트 환경 | 기존 변수 덮어쓰기, 테스트 격리 |
| `ProductionConfig()` | 프로덕션 환경 | 엄격한 검증 + 감사 로그, 기존 변수 덮어쓰지 않음 |

```go
// 프로덕션 환경 권장 구성
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AllowedKeys = []string{"APP_NAME", "PORT", "DB_HOST", "API_KEY"}
```

## 관련 문서

- [SecureValue API](/ko/env/api-reference/secure-value) - 보안 값 처리 전체 API
- [상수 및 오류](/ko/env/api-reference/constants) - 금지 키 전체 목록, 민감 키 패턴
- [프로덕션 체크리스트](/ko/env/security/production-checklist) - 배포 전 보안 검사
