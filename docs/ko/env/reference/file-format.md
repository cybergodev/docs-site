---
title: "파일 형식 - CyberGo env | .env/JSON/YAML 구문"
description: "CyberGo env 구성 파일 형식 참조로 .env·JSON·YAML 구문 규칙, 주석, 데이터 타입, UTF-8 인코딩, DetectFormat 자동 감지를 상세히 설명합니다."
---

# 파일 형식

env 라이브러리는 다양한 구성 파일 형식을 지원합니다: `.env`, JSON 및 YAML.

## .env 형식

### 기본 구문

```bash
# 주석
KEY=value

# 값에 등호 포함
URL=https://example.com?foo=bar

# 빈 줄은 무시됨

# 잘못됨: 키에 공백 불가
# MY KEY=value
```

### 따옴표

```bash
# 큰따옴표: 공백 유지, 이스케이프 지원
MESSAGE="Hello World"
PATH="/usr/local/bin"

# 작은따옴표: 그대로 유지, 이스케이프 없음
LITERAL='no ${expansion} here'

# 따옴표 없음
SIMPLE=value

# 빈 값
EMPTY=
EMPTY=""
EMPTY=''
```

### 이스케이프 문자

큰따옴표에서 이스케이프 지원:

```bash
# 줄바꿈
MULTILINE="line1\nline2"

# 탭
TABBED="col1\tcol2"

# 따옴표
QUOTED="He said \"Hello\""

# 백슬래시
PATH="C:\\Users\\name"

# 달러 기호
PRICE="Price: \$100"
```

### 변수 확장

`ExpandVariables` 활성화 후 지원:

```bash
# 다른 변수 참조
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1

# 간단한 구문
URL=$BASE_URL/path

# 기본값
HOST=${HOST:-localhost}
PORT=${PORT:-8080}

# 중첩 확장
SERVICE=${CLUSTER:-default}-${REGION:-us-east}
```

### export 구문

`AllowExportPrefix` 활성화 후 지원:

```bash
# Bash 스타일 내보내기
export KEY=value
export ANOTHER="quoted value"
```

### YAML 스타일

`AllowYamlSyntax` 활성화 후 지원:

```bash
# YAML 스타일 키-값 쌍
KEY: value
ANOTHER: "quoted value"
```

### 여러 줄 값

```bash
# 큰따옴표 내 줄바꿈
PRIVATE_KEY="-----BEGIN KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END KEY-----"

# \n 이스케이프 사용
LINES="line1\nline2\nline3"
```

## JSON 형식

### 기본 구조

```json
{
    "APP_NAME": "my-app",
    "APP_VERSION": "1.0.0",
    "DEBUG": true,
    "PORT": 8080
}
```

### 중첩 객체

중첩 객체는 평탄화됩니다:

```json
{
    "database": {
        "host": "localhost",
        "port": 5432
    }
}
```

결과:

```text
DATABASE_HOST=localhost
DATABASE_PORT=5432
```

### 배열

배열은 인덱스 키로 평탄화됩니다:

```json
{
    "ALLOWED_HOSTS": ["localhost", "example.com"],
    "PORTS": [80, 443, 8080]
}
```

결과:

```text
ALLOWED_HOSTS_0=localhost
ALLOWED_HOSTS_1=example.com
PORTS_0=80
PORTS_1=443
PORTS_2=8080
```

::: tip 배열 요소 접근
`GetSlice[T]` 함수 또는 점 경로를 사용하여 인덱스 키에 접근:
```go
hosts := env.GetSlice[string]("ALLOWED_HOSTS")
port0 := env.GetInt("PORTS_0")  // 80
```
자세한 내용은 [GetSlice 문서](/ko/env/api-reference/functions#getslice-t)를 참조하세요.
:::

### 타입 변환 옵션

```go
cfg := env.DefaultConfig()

// null을 빈 문자열로 변환
cfg.JSONNullAsEmpty = true

// 숫자를 문자열로 변환
cfg.JSONNumberAsString = true

// 불리언 값을 문자열로 변환
cfg.JSONBoolAsString = true
```

### 깊이 제한

```go
cfg.JSONMaxDepth = 10  // 최대 중첩 깊이
```

## YAML 형식

### 기본 구조

```yaml
APP_NAME: my-app
APP_VERSION: "1.0.0"
DEBUG: true
PORT: 8080
```

### 중첩 구조

```yaml
database:
  host: localhost
  port: 5432
  credentials:
    user: admin
    password: secret
```

평탄화 결과:

```text
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_CREDENTIALS_USER=admin
DATABASE_CREDENTIALS_PASSWORD=secret
```

### 목록

목록은 인덱스 키로 평탄화됩니다:

```yaml
allowed_hosts:
  - localhost
  - example.com
  - api.example.com
```

결과:

```text
ALLOWED_HOSTS_0=localhost
ALLOWED_HOSTS_1=example.com
ALLOWED_HOSTS_2=api.example.com
```

### 여러 줄 문자열

```yaml
# 리터럴 블록 (줄바꿈 유지)
description: |
  Line 1
  Line 2
  Line 3

# 폴딩 블록 (줄바꿈이 공백으로 변환)
summary: >
  This is a long
  summary that will
  be on one line.
```

### 타입 변환 옵션

```go
cfg := env.DefaultConfig()

cfg.YAMLNullAsEmpty = true
cfg.YAMLNumberAsString = true
cfg.YAMLBoolAsString = true
cfg.YAMLMaxDepth = 10
```

## 형식 감지

### 자동 감지

```go
// 확장자로 감지
format := env.DetectFormat("config.json")   // FormatJSON
format = env.DetectFormat("settings.yaml")  // FormatYAML
format = env.DetectFormat(".env")           // FormatEnv

// 일치하는 확장자가 없으면 FormatAuto 반환 (기본적으로 .env 파서 사용)
format = env.DetectFormat("config")  // FormatAuto
```

### 형식 상수

```go
const (
    FormatAuto  FileFormat = iota  // 자동 감지
    FormatEnv                      // .env 형식
    FormatJSON                     // JSON 형식
    FormatYAML                     // YAML 형식
)
```

### 형식 문자열

```go
format := env.FormatJSON
fmt.Println(format.String())  // 출력: json
```

## 모범 사례

### 형식 선택

| 시나리오 | 권장 형식 |
|------|----------|
| 간단한 구성 | `.env` |
| 복잡한 중첩 구성 | JSON 또는 YAML |
| 다른 도구와 공유 | JSON |
| 가독성 우선 | YAML |
| Docker/K8s 환경 | `.env` |

### 파일 명명

```bash
.env              # 기본 구성
.env.local        # 로컬 덮어쓰기 (커밋하지 않음)
.env.development  # 개발 환경
.env.staging      # 스테이징 환경
.env.production   # 프로덕션 환경
.env.test         # 테스트 환경
```

### 혼합 사용

```go
// 다양한 형식을 혼합하여 사용 가능
loader.LoadFiles(
    "base.env",           // 기본 구성
    "database.json",      // 데이터베이스 구성
    "secrets.yaml",       # 민감 구성
    ".env.local",         // 로컬 덮어쓰기
)
```

### Git 무시

```bash
# 민감 구성 무시
.env.local
.env.*.local
.env.production
secrets.yaml

# 템플릿 유지
!.env.example
```

## 관련 문서

- [다중 형식 구성](/ko/env/guides/multi-format) - 다중 형식 로딩 가이드
- [ComponentFactory API](/ko/env/api-reference/factory) - DetectFormat 함수 참조
- [Config API](/ko/env/api-reference/config) - JSON/YAML 파싱 옵션
