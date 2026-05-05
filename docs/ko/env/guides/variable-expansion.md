---
title: 변수 확장 - CyberGo env 변수 문법
description: CyberGo env 라이브러리 변수 확장 문법 완전 사용 가이드입니다. ${VAR} 및 ${VAR:-default} 변수 참조 문법, 중첩 기본값 설정, 조건부 확장 제어, 순환 참조 자동 감지 및 재귀 깊이 제한을 지원하여 .env 설정 파일에서 변수 재사용과 동적 값 치환을 구현하고 Go 프로젝트의 중복 설정 항목을 효과적으로 줄입니다.
---

# 변수 확장

env 라이브러리는 설정 파일에서 변수 참조를 지원하여 설정 재사용과 동적 값 치환을 구현합니다.

## 변수 확장 활성화

```go
cfg := env.DefaultConfig()
cfg.ExpandVariables = true  // 기본활성화

loader, _ := env.New(cfg)
loader.LoadFiles(".env")
```

## 기본 문법

### 단순 참조

```bash
# 참조기타변수
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1
# API_URL 확장 결과: https://api.example.com/v1

# 단축 문법
HOST=localhost
URL=$HOST:8080
# URL 확장 결과: localhost:8080
```

### 기본값 문법

| 문법 | 설명 |
|------|------|
| `${VAR:-default}` | VAR이 없으면 default 사용 |
| `${VAR:=default}` | VAR이 없으면 default 사용 (`:-`과 동일) |
| `${VAR:?error}` | VAR이 없거나 비어 있으면 오류 반환 |

---

## 문법 상세

### `${VAR:-default}` - 사용기본값

가장 일반적인 기본값 문법입니다. 변수가 존재하지 않을 때 기본값을 사용하고, 변수가 존재하면 (값이 비어 있어도) 원래 값을 사용합니다:

```bash
# LOG_LEVEL이 없으면 "info" 사용
LOG_LEVEL=${LOG_LEVEL:-info}

# TIMEOUT이 없으면 "30s" 사용
TIMEOUT=${TIMEOUT:-30s}

# 중첩기본값
DB_HOST=${DB_HOST:-localhost}
DB_URL=${DB_HOST}:${DB_PORT:-5432}
# DB_HOST=localhost이고 DB_PORT가 없으면
# DB_URL 확장 결과: localhost:5432
```

**사용 시나리오：**
- 선택적 설정 항목의 기본값
- 개발/프로덕션 환경 통합 설정

---

### `${VAR:=default}` - 사용기본값

동작은 `${VAR:-default}`와 동일하며, 변수가 존재하지 않을 때 기본값을 사용합니다:

```bash
# DEBUG가 없으면 "false" 사용
DEBUG=${DEBUG:=false}

# 존재하지 않으면 기본값 사용
CACHE_TTL=${CACHE_TTL:=3600}
```

::: info `:-`와의 관계
이 라이브러리에서 `${VAR:=default}`는 `${VAR:-default}`와 완전히 동일하게 동작합니다. 변수가 존재하지 않을 때 기본값을 확장 결과로 사용합니다. `:=`는 기본값을 변수 저장소에 다시 기록하지 않습니다.
:::

---

### `${VAR:?error}` - 잘못됨팁

변수가 존재하지 않거나 비어 있으면 오류를 반환합니다:

```bash
# DATABASE_URL이 없으면 로드 실패 및 오류 표시
DATABASE_URL=${DATABASE_URL:?Database URL is required}

# API_KEY가 없으면 오류 발생
API_KEY=${API_KEY:?API_KEY must be set}
```

**사용 시나리오：**
- 필수 설정 항목 검증
- 조기 실패로 런타임 오류 방지

---

## 이스케이프

### 이스케이프 달러 기호

`$$`를 사용하여 리터럴 `$`를 표시합니다:

```bash
# 가격 설정
PRICE=$$99.99
# 확장 결과: $99.99

# 포함 $ 의문자열
MESSAGE=Price is $$100
# 확장 결과: Price is $100
```

### 작은따옴표

작은따옴표 안의 변수는 확장되지 않습니다:

```bash
# 확장 안 함
LITERAL='${NO_EXPANSION}'
# 값: ${NO_EXPANSION}

# 큰따옴표와 비교
EXPANDED="${WILL_EXPAND}"
# 확장됨 ${WILL_EXPAND}
```

---

## 중첩 확장

변수는 중첩 참조할 수 있습니다:

```bash
# 기본 설정
APP_NAME=myapp
ENV=production

# 중첩참조
DB_HOST=db.${ENV}.example.com
# 확장 결과: db.production.example.com

API_URL=https://${APP_NAME}.${ENV}.api.example.com
# 확장 결과: https://myapp.production.api.example.com
```

---

## 순환 감지

라이브러리가 순환 참조를 자동으로 감지하고 오류를 반환합니다:

```bash
# 순환 참조 (오류)
A=${B}
B=${A}

# 로드 시 ErrExpansionDepth 오류 반환
```

---

## 확장 깊이 제한

기본 최대 확장 깊이는 5이며, 하드 상한은 20입니다:

```go
cfg := env.DefaultConfig()
cfg.MaxExpansionDepth = 10  // 커스텀 깊이
```

| 상수 | 값 | 설명 |
|------|---|------|
| `DefaultMaxExpansionDepth` | 5 | 기본값（공개 API） |

::: info 팁
하드 상한은 20입니다 (내부 제한). 설정의 `MaxExpansionDepth`는 이 제한을 초과할 수 없습니다.
:::

---

## 완전한 예제

```bash
# .env 파일

# 기본 설정
APP_NAME=myapp
ENV=development
DEBUG=true

# 데이터베이스 설정
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-${APP_NAME}}
DB_URL=postgres://${DB_HOST}:${DB_PORT}/${DB_NAME}

# API 설정
API_BASE=https://api.${ENV}.example.com
API_URL=${API_BASE}/v1
API_KEY=${API_KEY:?API_KEY is required}

# 로그설정
LOG_LEVEL=${LOG_LEVEL:-info}

# 가격 (이스케이프)
PRICE=$$99.99
```

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/env"
)

func main() {
    cfg := env.DefaultConfig()
    cfg.ExpandVariables = true

    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    err = loader.LoadFiles(".env")
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("DB_URL:", loader.GetString("DB_URL"))
    fmt.Println("API_URL:", loader.GetString("API_URL"))
    fmt.Println("PRICE:", loader.GetString("PRICE"))
}
```

---

## 관련 문서

- [빠른 시작](/ko/env/getting-started) - 기본 사용
- [Config API](/ko/env/api-reference/config) - ExpandVariables 설정
- [상수 및 오류](/ko/env/api-reference/constants) - 확장 깊이 제한
