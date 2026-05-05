---
title: 파일 포맷 - CyberGo env | .env/JSON/YAML 문법
description: CyberGo env 환경 변수 관리 라이브러리에서 지원하는 설정 파일 포맷 완전 참조 문서입니다. .env 키-값 쌍 형식, JSON 객체 형식, YAML 계층 형식의 문법 규칙, 주석 방법, 데이터 타입 지원, 인코딩 처리 및 자동 포맷 감지 메커니즘을 상세히 설명하여 Go 개발자가 각 형식의 설정 파일을 올바르게 작성하고 관리할 수 있도록 돕습니다.
---

# 파일 포맷

env 라이브러리는 `.env`, JSON, YAML 등 다양한 설정 파일 형식을 지원합니다.

## .env 포맷

### 기본 문법

```bash
# 주석
KEY=value

# 값에 등호 포함
URL=https://example.com?foo=bar

# 빈 줄은 무시됨

# 유효하지 않음: 키에 공백 불가
# MY KEY=value
```

### 따옴표

```bash
# 큰따옴표: 공백 유지, 이스케이프 지원
MESSAGE="Hello World"
PATH="/usr/local/bin"

# 작은따옴표: 있는 그대로 유지, 이스케이프 없음
LITERAL='no ${expansion} here'

# 따옴표 없음
SIMPLE=value

# 빈 값
EMPTY=
EMPTY=""
EMPTY=''
```

### 이스케이프문자

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

활성화 `ExpandVariables` 후 지원:

```bash
# 다른 변수 참조
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1

# 간단한 문법
URL=$BASE_URL/path

# 기본값
HOST=${HOST:-localhost}
PORT=${PORT:-8080}

# 중첩 확장
SERVICE=${CLUSTER:-default}-${REGION:-us-east}
```

### export 문법

활성화 `AllowExportPrefix` 후 지원:

```bash
# Bash 스타일 내보내기
export KEY=value
export ANOTHER="quoted value"
```

### YAML 스타일

활성화 `AllowYamlSyntax` 후 지원:

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

## JSON 포맷

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

결과：

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

결과：

```text
ALLOWED_HOSTS_0=localhost
ALLOWED_HOSTS_1=example.com
PORTS_0=80
PORTS_1=443
PORTS_2=8080
```

::: tip 배열 요소 접근
`GetSlice[T]` 함수 또는 점 표기 경로로 인덱스 키에 접근:
```go
hosts := env.GetSlice[string]("ALLOWED_HOSTS")
port0 := env.GetInt("PORTS_0")  // 80
```
자세한 내용 [GetSlice 문서](/ko/env/api-reference/functions#getslice-t)。
:::

### 타입 변환 옵션

```go
cfg := env.DefaultConfig()

// null 값을 빈 문자열로 변환
cfg.JSONNullAsEmpty = true

// 숫자 변환 문자열
cfg.JSONNumberAsString = true

// 불리언 변환 문자열
cfg.JSONBoolAsString = true
```

### 깊이 제한

```go
cfg.JSONMaxDepth = 10  // 최대 중첩 깊이
```

## YAML 포맷

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

평탄화 결과：

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

결과：

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

# 폴드 블록 (줄바꿈이 빈칸으로 변환)
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

## 포맷 감지

### 자동 감지

```go
// 확장자로 감지
format := env.DetectFormat("config.json")   // FormatJSON
format = env.DetectFormat("settings.yaml")  // FormatYAML
format = env.DetectFormat(".env")           // FormatEnv

// 매칭되는 확장자가 없으면 FormatAuto 반환 (기본 .env 파서 사용)
format = env.DetectFormat("config")  // FormatAuto
```

### 포맷 상수

```go
const (
    FormatAuto  FileFormat = iota  // 자동감지
    FormatEnv                      // .env 형식
    FormatJSON                     // JSON 형식
    FormatYAML                     // YAML 형식
)
```

### 포맷 문자열

```go
format := env.FormatJSON
fmt.Println(format.String())  // 출력: json
```

## 모범 사례

### 포맷 선택

| 시나리오 | 권장 포맷 |
|------|----------|
| 간단한 설정 | `.env` |
| 복잡한 중첩 설정 | JSON 또는 YAML |
| 다른 도구와 공유 | JSON |
| 가독성 우선 | YAML |
| Docker/K8s 환경 | `.env` |

### 파일 이름 지정

```bash
.env              # 기본 설정
.env.local        # 로컬 덮어쓰기 (커밋하지 않음)
.env.development  # 개발 환경
.env.staging      # 사전 릴리스 환경
.env.production   # 프로덕션 환경
.env.test         # 테스트 환경
```

### 혼합 사용

```go
// 다양한 형식을 혼합하여 사용할 수 있습니다
loader.LoadFiles(
    "base.env",           // 기본 설정
    "database.json",      // 데이터베이스 설정
    "secrets.yaml",       // 민감 설정
    ".env.local",         // 로컬 덮어쓰기
)
```

### Git 무시

```bash
# 민감 설정 무시
.env.local
.env.*.local
.env.production
secrets.yaml

# 템플릿 유지
!.env.example
```

## 관련 문서

- [다중 형식 설정](/ko/env/guides/multi-format) - 다중 형식 로드 가이드
- [ComponentFactory API](/ko/env/api-reference/factory) - DetectFormat 함수 참조
- [Config API](/ko/env/api-reference/config) - JSON/YAML 파싱 옵션
