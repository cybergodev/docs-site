---
sidebar_label: "변수 확장"
title: "변수 확장 - CyberGo env | 구문 가이드"
description: "CyberGo env 변수 확장 구문 가이드로 ${VAR}와 ${VAR:-default} 참조, ${VAR:=default} 기본값, ${VAR:?error} 필수 검증, $VAR 단축, 순환 참조 감지와 MaxExpansionDepth 제한으로 설정 재사용을 구현합니다."
sidebar_position: 4
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

::: warning 자기 참조 제한
`:-`, `:=`, `:?`가 참조하는 변수는 대입되는 키와 달라야 합니다. `KEY=${KEY:-default}` 형태의 자기 참조는 순환 참조로 간주되어 로드 시 `ErrExpansionDepth` 오류가 발생합니다. 키에 기본값을 설정하려면 리터럴을 직접 대입(`KEY=default`)하거나 다른 변수를 참조하세요(아래 예시 참고).
:::

---

## 구문 상세

### `${VAR:-default}` - 기본값 사용

가장 일반적인 기본값 구문입니다. 변수가 없을 때 기본값을 사용하고, 변수가 존재하면(비어 있어도) 원래 값을 사용합니다:

```bash
# HOST가 정의되어 있으면 해당 값 사용
HOST=localhost
PRIMARY_HOST=${HOST:-127.0.0.1}
# PRIMARY_HOST 확장 결과: localhost

# TIMEOUT이 없으면 기본값 "30s" 사용
TIMEOUT_VALUE=${TIMEOUT:-30s}
# TIMEOUT_VALUE 확장 결과: 30s

# 중첩 기본값
DB_HOST=localhost
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
DEBUG_VALUE=${DEBUG:=false}

# CACHE_TTL이 없으면 기본값 사용
CACHE_TTL_VALUE=${CACHE_TTL:=3600}
```

::: info `:-`과의 관계
`${VAR:=default}`는 이 라이브러리에서 `${VAR:-default}`와 완전히 동일하게 동작합니다. 변수가 없을 때 기본값을 확장 결과로 사용합니다. `:=`는 기본값을 변수 저장소에 다시 기록하지 않습니다.
:::

---

### `${VAR:?error}` - 오류 메시지

변수가 없거나 비어 있으면 오류를 반환합니다:

```bash
# DATABASE_URL이 없으면 로딩 실패 및 오류 표시
DB_URL=${DATABASE_URL:?Database URL is required}

# API_TOKEN이 없으면 오류 발생
AUTH_TOKEN=${API_TOKEN:?API_TOKEN must be set}
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

### 따옴표와 확장

변수 확장은 따옴표 제거 후의 통합 후처리 단계에서 일어나며, **작은따옴표와 큰따옴표 모두 변수 확장에 영향을 주지 않습니다**. 예를 들어 `SINGLE='${BASE}'`(`BASE=hello`)는 확장 후 값이 `hello`가 되며 큰따옴표와 동일하게 동작합니다. 참조된 변수가 정의되어 있지 않은 경우(예: `LITERAL='${NO_EXPANSION}'`), 결과는 빈 문자열이 되며 `${NO_EXPANSION}` 리터럴이 유지되지 않습니다.

작은따옴표와 큰따옴표의 차이는 **리터럴 파싱**에만 있습니다. 큰따옴표는 `\n`, `\t` 등의 이스케이프 시퀀스를 처리하지만, 작은따옴표는 원문을 그대로 보존합니다 (이스케이프 없음).

::: warning 참고
따옴표로 "확장 금지"를 지정하지 마세요. `${VAR}` 리터럴을 유지하려면 다음 방법을 사용하세요:
:::

```bash
# 방법 1: 달러 기호 이스케이프 ($$는 리터럴 $로 확장)
LITERAL='$${NO_EXPANSION}'
# 값: ${NO_EXPANSION}
```

```go
// 방법 2: 전역 변수 확장 비활성화
cfg := env.DefaultConfig()
cfg.ExpandVariables = false
```

---

## 중첩 확장

변수를 중첩하여 참조할 수 있습니다:

```bash
# 기본 설정 (내장 금지 키 ENV 대신 DEPLOY_ENV 사용)
APP_NAME=myapp
DEPLOY_ENV=production

# 중첩 참조
DB_HOST=db.${DEPLOY_ENV}.example.com
# 확장 결과: db.production.example.com

API_URL=https://${APP_NAME}.${DEPLOY_ENV}.api.example.com
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

# 기본 설정 (내장 금지 키 ENV 사용 회피)
APP_NAME=myapp
DEPLOY_ENV=development
DEBUG=true

# 데이터베이스 설정
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${APP_NAME}
DB_URL=postgres://${DB_HOST}:${DB_PORT}/${DB_NAME}

# API 설정
API_BASE=https://api.${DEPLOY_ENV}.example.com
API_URL=${API_BASE}/v1

# 로그 설정
LOG_LEVEL=info

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

- [빠른 시작](/ko/env/getting-started/) - 기본 사용법
- [Config API](/ko/env/api-reference/config) - ExpandVariables 구성
- [상수 및 오류](/ko/env/api-reference/constants) - 확장 깊이 제한
