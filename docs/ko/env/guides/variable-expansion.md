---
title: "변수 확장 - CyberGo env 변수 구문"
description: "CyberGo env 라이브러리 변수 확장 구문 가이드, ${VAR} 및 ${VAR:-default} 참조 구문을 상세히 설명하며, 중첩 기본값, := 할당 및 :? 오류 출력 등 조건부 확장 모드를 다루고, 순환 참조 감지, MaxExpansionDepth 깊이 제한 및 ExpandVariables 스위치 제어를 소개하여 .env 파일에서 변수 재사용과 동적 값 치환을 구현합니다."
---

# 변수 확장

env 라이브러리는 구성 파일에서 변수 참조를 지원하여 설정 재사용과 동적 값 치환을 구현합니다.

## 변수 확장 활성화

```go
cfg := env.DefaultConfig()
cfg.ExpandVariables = true  // 기본적으로 활성화

loader, _ := env.New(cfg)
loader.LoadFiles(".env")
```

## 기본 구문

### 간단한 참조

```bash
# 다른 변수 참조
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1
# API_URL 확장 결과: https://api.example.com/v1

# 단축 구문
HOST=localhost
URL=$HOST:8080
# URL 확장 결과: localhost:8080
```

### 기본값 구문

| 구문 | 설명 |
|------|------|
| `${VAR:-default}` | VAR이 없으면 default 사용 |
| `${VAR:=default}` | VAR이 없으면 default 사용 (`:-`과 동일) |
| `${VAR:?error}` | VAR이 없거나 비어 있으면 오류 반환 |

---

## 구문 상세

### `${VAR:-default}` - 기본값 사용

가장 일반적인 기본값 구문입니다. 변수가 없을 때 기본값을 사용하고, 변수가 존재하면(비어 있어도) 원래 값을 사용합니다:

```bash
# LOG_LEVEL이 없으면 "info" 사용
LOG_LEVEL=${LOG_LEVEL:-info}

# TIMEOUT이 없으면 "30s" 사용
TIMEOUT=${TIMEOUT:-30s}

# 중첩 기본값
DB_HOST=${DB_HOST:-localhost}
DB_URL=${DB_HOST}:${DB_PORT:-5432}
# DB_HOST=localhost이고 DB_PORT가 없으면
# DB_URL 확장 결과: localhost:5432
```

**사용 시나리오:**
- 선택적 구성 항목의 기본값
- 개발/프로덕션 환경 통합 설정

---

### `${VAR:=default}` - 기본값 사용

`${VAR:-default}`와 동일하게 동작하며, 변수가 없을 때 기본값을 사용합니다:

```bash
# DEBUG가 없으면 "false" 사용
DEBUG=${DEBUG:=false}

# 없으면 기본값 사용
CACHE_TTL=${CACHE_TTL:=3600}
```

::: info `:-`과의 관계
`${VAR:=default}`는 이 라이브러리에서 `${VAR:-default}`와 완전히 동일하게 동작합니다. 변수가 없을 때 기본값을 확장 결과로 사용합니다. `:=`는 기본값을 변수 저장소에 다시 기록하지 않습니다.
:::

---

### `${VAR:?error}` - 오류 메시지

변수가 없거나 비어 있으면 오류를 반환합니다:

```bash
# DATABASE_URL이 없으면 로딩 실패 및 오류 표시
DATABASE_URL=${DATABASE_URL:?Database URL is required}

# API_KEY가 없으면 오류 발생
API_KEY=${API_KEY:?API_KEY must be set}
```

**사용 시나리오:**
- 필수 구성 항목 검증
- 조기 실패로 런타임 오류 방지

---

## 이스케이프

### 달러 기호 이스케이프

`$$`를 사용하여 리터럴 `$`를 나타냅니다:

```bash
# 가격 설정
PRICE=$$99.99
# 확장 결과: $99.99

# $가 포함된 문자열
MESSAGE=Price is $$100
# 확장 결과: Price is $100
```

### 작은따옴표

작은따옴표 안의 변수는 확장되지 않습니다:

```bash
# 확장 안 됨
LITERAL='${NO_EXPANSION}'
# 값: ${NO_EXPANSION}

# 큰따옴표와 비교
EXPANDED="${WILL_EXPAND}"
# ${WILL_EXPAND}가 확장됨
```

---

## 중첩 확장

변수를 중첩하여 참조할 수 있습니다:

```bash
# 기본 설정
APP_NAME=myapp
ENV=production

# 중첩 참조
DB_HOST=db.${ENV}.example.com
# 확장 결과: db.production.example.com

API_URL=https://${APP_NAME}.${ENV}.api.example.com
# 확장 결과: https://myapp.production.api.example.com
```

---

## 순환 감지

라이브러리는 순환 참조를 자동으로 감지하고 오류를 반환합니다:

```bash
# 순환 참조 (오류)
A=${B}
B=${A}

# 로딩 시 ErrExpansionDepth 오류 반환
```

---

## 확장 깊이 제한

기본 최대 확장 깊이는 5이며, 하드 상한선은 20입니다:

```go
cfg := env.DefaultConfig()
cfg.MaxExpansionDepth = 10  // 커스텀 깊이
```

| 상수 | 값 | 설명 |
|------|---|------|
| `DefaultMaxExpansionDepth` | 5 | 기본값 (공개 API) |

::: info
하드 상한선은 20 (내부 제한)입니다. 구성의 `MaxExpansionDepth`는 이 제한을 초과할 수 없습니다.
:::

---

## 전체 예시

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

# 로그 설정
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

- [빠른 시작](/ko/env/getting-started) - 기본 사용법
- [Config API](/ko/env/api-reference/config) - ExpandVariables 구성
- [상수 및 오류](/ko/env/api-reference/constants) - 확장 깊이 제한
