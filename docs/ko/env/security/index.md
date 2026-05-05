---
title: 보안 개요 - CyberGo env | 보안 아키텍처
description: CyberGo env 환경 변수 관리 라이브러리의 보안 아키텍처 전체 개요입니다. SecureValue 메모리 잠금 보호 메커니즘, 키-값 콘텐츠 검증 및 필터링 규칙, 금지 키 이름 목록, 설정 보안 수준 구성, 민감 데이터 자동 감지 및 감사 로그 추적 등 핵심 보안 기능을 다루어 Go 애플리케이션 환경 변수의 전체 수명 주기에서 안전성을 보장합니다.
---

# 보안 개요

환경 변수는 민감 정보를 자주 저장하므로 안전한 처리가 매우 중요합니다. 이 문서는 env 라이브러리의 보안 아키텍처와 핵심 기능을 개요합니다.

## 보안 아키텍처

```text
┌──────────────────────────────────────────────────────────────┐
│                         애플리케이션 계층                        │
├──────────────────────────────────────────────────────────────┤
│   SecureValue   │    마스크    │    초기화    │   메모리 잠금        │
├──────────────────────────────────────────────────────────────┤
│                          Loader 계층                            │
├──────────────────────────────────────────────────────────────┤
│     키 검증    │   값 검증   │   금지 키   │   크기 제한        │
├──────────────────────────────────────────────────────────────┤
│                          파싱 계층                              │
├──────────────────────────────────────────────────────────────┤
│    형식감지     │  확장검사  │       경로검증                  │
└──────────────────────────────────────────────────────────────┘
```

## 핵심 보안 기능

| 기능 | 설명 | 문서 |
|------|------|------|
| **SecureValue** | 민감 값 메모리 보호, 자동 초기화 | [SecureValue API](/ko/env/api-reference/secure-value) |
| **금지 키** | 시스템 핵심 변수 수정 방지 | [상수 및 오류](/ko/env/api-reference/constants#defaultforbiddenkeys) |
| **민감키감지** | 민감 설정 키 자동 감지 | [상수 및 오류](/ko/env/api-reference/constants#sensitivekeypatterns) |
| **값 검증** | 제어 문자, 널 바이트 등 감지 | [Config API](/ko/env/api-reference/config) |
| **감사 로그** | 완전한 작업 추적 | [컴포넌트 팩토리](/ko/env/api-reference/factory#감사 처리기 팩토리) |

## SecureValue 소개

민감 데이터의 경우 `GetString` 대신 `GetSecure`를 사용하세요:

```go
// 권장하지 않음
password := env.GetString("DB_PASSWORD")

// 권장함
secret := env.GetSecure("DB_PASSWORD")
defer secret.Close()
password := secret.String()
```

**핵심기능：**
- **메모리 잠금** - 디스크로 스왑 방지（Linux/macOS/FreeBSD）
- **자동초기화** - `Close()` 시 안전하게 메모리 초기화
- **마스크 표시** - `Masked()` 로그 출력에 사용
- **스레드 안전** - 지원동시 읽기

::: tip 완전한 API
자세한 내용 [SecureValue API](/ko/env/api-reference/secure-value)。
:::

## 키/값 검증

### 키 검증

기본 키 이름 규칙:`^[A-Za-z][A-Za-z0-9_]*$`

- 문자로 시작
- 문자, 숫자, 밑줄만 포함
- 길이가 `MaxKeyLength`를 초과하지 않음

### 금지 키

내장 금지 키가 시스템 핵심 변수 수정을 방지합니다:

| 카테고리 | 예시 | 위험 |
|------|------|------|
| 시스템 경로 | `PATH`, `LD_LIBRARY_PATH` | 명령/라이브러리 가로챔 |
| 동적 링크 | `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES` | 악성 라이브러리 주입 |
| Shell | `SHELL`, `IFS`, `BASH_ENV` | Shell 가로챔 |
| 언어 런타임 | `PYTHONPATH`, `NODE_PATH` | 모듈 가로챔 |

::: tip 전체 목록
완전한 금지 키 목록은 [DefaultForbiddenKeys](/ko/env/api-reference/constants#defaultforbiddenkeys)를 확인하세요.
:::

### 값 검증

값 검증을 활성화하여 잠재적 위험을 감지합니다:

```go
cfg := env.ProductionConfig()
cfg.ValidateValues = true  // 제어 문자, 널 바이트 등 감지
```

## 파일 보안 기본

### 파일권한

```bash
# 소유자만 읽기/쓰기 가능
chmod 600 .env

# 또는 더 엄격하게 (읽기 전용)
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

## 설정 보안 수준

| 프리셋 | 용도 | 특징 |
|------|------|------|
| `DevelopmentConfig()` | 개발 환경 | 완화된 제한, YAML 문법 지원 |
| `TestingConfig()` | 테스트 환경 | 기존 변수 덮어쓰기, 테스트 격리 |
| `ProductionConfig()` | 프로덕션 환경 | 엄격한 검증 + 감사 로그, 기존 변수 덮어쓰지 않음 |

```go
// 프로덕션 환경권장함설정
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AllowedKeys = []string{"APP_NAME", "PORT", "DB_HOST", "API_KEY"}
```

## 관련 문서

- [SecureValue API](/ko/env/api-reference/secure-value) - 안전값처리완전한 API
- [상수 및 오류](/ko/env/api-reference/constants) - 금지 키 전체 목록, 민감 키 패턴
- [프로덕션 체크리스트](/ko/env/security/production-checklist) - 출시 전 보안 점검
