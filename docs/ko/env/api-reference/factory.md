---
title: ComponentFactory API - CyberGo env | 컴포넌트 팩토리
description: CyberGo env 라이브러리 ComponentFactory 컴포넌트 팩토리 API 참조 문서입니다. Loader와 Parser가 공유하는 컴포넌트 인스턴스의 생성 및 관리, 감사 처리기, 파일 시스템 어댑터, 커스텀 파서의 등록 관리를 다루며, 컴포넌트 수명 주기 제어와 종속성 주입 지원, 다중 인스턴스 격리 및 스레드 안전 동시 접근을 제공합니다.
---

# ComponentFactory API

`ComponentFactory`는 Loader와 Parser가 공유하는 컴포넌트를 생성하고 관리하며, 명확한 수명 주기 관리를 제공합니다.

## 타입 정의

```go
type ComponentFactory struct {
    // 포함된 개인 필드
}
```

**핵심 역할:**
- 공유 검증기, 감사기 및 변수 확장기 생성
- 컴포넌트 수명 주기 관리
- 커스텀 파서의 내부 컴포넌트 접근 지원

**스레드 안전:** ComponentFactory의 모든 메서드는 스레드 안전합니다.

---

## 메서드

### Validator

```go
func (f *ComponentFactory) Validator() Validator
```

키 이름과 값의 검증을 위한 검증기 컴포넌트를 반환합니다.

```go
// 커스텀 파서에서 사용
validator := factory.Validator()

if err := validator.ValidateKey("MY_KEY"); err != nil {
    // 키 이름이 유효하지 않음
}

if err := validator.ValidateValue("some value"); err != nil {
    // 값에 잘못된 콘텐츠가 포함됨 (예: 널 바이트, 제어 문자)
}
```

---

### Auditor

```go
func (f *ComponentFactory) Auditor() FullAuditLogger
```

완전한 감사 로그 기능을 제공하는 감사 로그 컴포넌트를 반환합니다.

```go
auditor := factory.Auditor()
_ = auditor.Log(env.ActionSet, "KEY", "value set", true)
_ = auditor.LogError(env.ActionSet, "KEY", "validation failed")
_ = auditor.LogWithFile(env.ActionLoad, "KEY", ".env", "loaded", true)
_ = auditor.LogWithDuration(env.ActionParse, "", "parsed", true, time.Since(start))
```

---

### Expander

```go
func (f *ComponentFactory) Expander() VariableExpander
```

`${VAR}` 문법의 변수 확장을 위한 변수 확장기 컴포넌트를 반환합니다.

```go
expander := factory.Expander()
expanded, err := expander.Expand("${BASE_URL}/api")
```

---

### Close

```go
func (f *ComponentFactory) Close() error
```

팩토리가 보유한 리소스를 해제합니다. 닫은 후에는 팩토리 및 팩토리를 통해 생성된 컴포넌트를 더 이상 사용해서는 안 됩니다.

**동작:**
- 안전하게 닫히며, 여러 번 호출해도 nil을 반환합니다
- 감사기 리소스 해제
- 원자적 연산으로 스레드 안전 보장

```go
// 보통 Loader에 의해 자동 관리됨
loader, _ := env.New(cfg)
defer loader.Close()  // ComponentFactory 자동 닫기
```

---

### IsClosed

```go
func (f *ComponentFactory) IsClosed() bool
```

팩토리가 닫혔는지 확인합니다.

```go
if factory.IsClosed() {
    // 팩토리가 닫혀 사용할 수 없습니다
}
```

---

## 생성 방법

### 자동 생성 (권장)

Loader 생성 시 ComponentFactory가 자동으로 생성되고 관리됩니다:

```go
cfg := env.DefaultConfig()
loader, _ := env.New(cfg)
// Loader 내부에서 ComponentFactory 자동 생성
defer loader.Close()  // 팩토리 자동 닫기
```

### 커스텀 파서에서 사용

커스텀 파서를 등록할 때 ComponentFactory를 통해 검증기와 감사기를 가져옵니다:

```go
type CustomParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func newCustomParser(cfg env.Config, factory *env.ComponentFactory) *CustomParser {
    return &CustomParser{
        cfg:       cfg,
        validator: factory.Validator(),
        auditor:   factory.Auditor(),
    }
}

// 커스텀 형식 상수 정의 (충돌을 피하기 위해 100+ 값 사용 권장)
const FormatCustom env.FileFormat = 100

// 파서 등록
env.RegisterParser(FormatCustom, func(cfg env.Config, factory *env.ComponentFactory) (env.EnvParser, error) {
    return newCustomParser(cfg, factory), nil
})
```

---

## 라이프사이클 관리

```text
Config 생성
     ↓
env.New(cfg)
     ↓
자동생성 ComponentFactory
     ↓
    ┌───────┼───────┐
    ↓       ↓       ↓
Validator  Auditor  Expander
    ↓       ↓       ↓
    └───────┼───────┘
            ↓
      Loader/Parser
            ↓
      Close() 해제
```

::: warning 참고
- 각 Loader는 일반적으로 자신의 ComponentFactory를 가집니다
- Close() 호출 후 해당 팩토리로 생성된 모든 컴포넌트를 더 이상 사용해서는 안 됩니다
- 팩토리는 스레드 안전하며 동시 접근 가능
:::

---

## 감사 처리기 팩토리

### NewJSONAuditHandler

```go
func NewJSONAuditHandler(w io.Writer) *JSONAuditHandler
```

JSON 형식의 감사 처리기를 생성하여 구조화된 로그를 출력합니다.

**매개변수：**
- `w` - 출력 대상 (예: `os.Stdout`, 파일)

```go
cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

**출력예제：**
```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","file":".env","success":true,"duration":1234567}
```

---

### NewLogAuditHandler

```go
func NewLogAuditHandler(logger *log.Logger) *LogAuditHandler
```

표준 로그 형식의 감사 처리기를 생성합니다.

**매개변수：**
- `logger` - 표준 log.Logger 인스턴스

```go
import "log"

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
cfg.AuditHandler = env.NewLogAuditHandler(logger)
```

**출력예제：**
```text
[AUDIT] 2024/01/15 10:30:00 load .env success (1.23ms)
```

---

### NewChannelAuditHandler

```go
func NewChannelAuditHandler(ch chan<- AuditEvent) *ChannelAuditHandler
```

비동기적으로 감사 이벤트를 처리하기 위한 채널 감사 처리기를 생성합니다.

**매개변수：**
- `ch` - 감사이벤트채널

```go
ch := make(chan env.AuditEvent, 100)
cfg.AuditHandler = env.NewChannelAuditHandler(ch)

// 비동기 처리감사이벤트
go func() {
    for event := range ch {
        fmt.Printf("Audit: %+v\n", event)
    }
}()
```

---

### NewNopAuditHandler

```go
func NewNopAuditHandler() *NopAuditHandler
```

감사 로그를 비활성화하기 위한 빈 작업 감사 처리기를 생성합니다.

```go
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewNopAuditHandler() // 어떤 로그도 기록하지 않음
```

---

## 파일 시스템

### OSFileSystem

운영 체제 파일 작업을 래핑하는 기본 파일 시스템 구현:

```go
type OSFileSystem struct{}
```

**구현인터페이스：** `FileSystem`

```go
// 메서드목록
func (fs OSFileSystem) Open(name string) (File, error)
func (fs OSFileSystem) OpenFile(name string, flag int, perm os.FileMode) (File, error)
func (fs OSFileSystem) Stat(name string) (os.FileInfo, error)
func (fs OSFileSystem) MkdirAll(path string, perm os.FileMode) error
func (fs OSFileSystem) Remove(name string) error
func (fs OSFileSystem) Rename(oldpath, newpath string) error
func (fs OSFileSystem) Getenv(key string) string
func (fs OSFileSystem) Setenv(key, value string) error
func (fs OSFileSystem) Unsetenv(key string) error
func (fs OSFileSystem) LookupEnv(key string) (string, bool)
```

---

### DefaultFileSystem

```go
var DefaultFileSystem FileSystem = OSFileSystem{}
```

전역 기본 파일 시스템 인스턴스.

---

### 커스텀 파일 시스템 사용

테스트에서 파일 시스템 모의:

```go
type MockFileSystem struct {
    files map[string]string
    env   map[string]string
}

func (m *MockFileSystem) Open(name string) (env.File, error) {
    content, ok := m.files[name]
    if !ok {
        return nil, os.ErrNotExist
    }
    return &MockFile{content: content}, nil
}

func (m *MockFileSystem) Getenv(key string) string {
    return m.env[key]
}

func (m *MockFileSystem) Setenv(key, value string) error {
    m.env[key] = value
    return nil
}

func (m *MockFileSystem) Unsetenv(key string) error {
    delete(m.env, key)
    return nil
}

func (m *MockFileSystem) LookupEnv(key string) (string, bool) {
    val, ok := m.env[key]
    return val, ok
}

func (m *MockFileSystem) OpenFile(name string, flag int, perm os.FileMode) (env.File, error) {
    return m.Open(name)
}

func (m *MockFileSystem) Stat(name string) (os.FileInfo, error) {
    if _, ok := m.files[name]; !ok {
        return nil, os.ErrNotExist
    }
    return nil, nil
}

func (m *MockFileSystem) MkdirAll(path string, perm os.FileMode) error {
    return nil
}

func (m *MockFileSystem) Remove(name string) error {
    delete(m.files, name)
    return nil
}

func (m *MockFileSystem) Rename(oldpath, newpath string) error {
    m.files[newpath] = m.files[oldpath]
    delete(m.files, oldpath)
    return nil
}

// 사용
cfg := env.TestingConfig()
cfg.FileSystem = &MockFileSystem{
    files: map[string]string{".env": "KEY=value"},
    env:   make(map[string]string),
}
```

---

## 포맷 감지

### DetectFormat

```go
func DetectFormat(filename string) FileFormat
```

파일 확장자로 형식을 감지합니다.

**매개변수：**
- `filename` - 파일 이름 또는 경로

**반환：**
- `FileFormat` - 감지된 형식

**감지규칙：**

| 확장자 | 반환 포맷 |
|--------|----------|
| `.env` | `FormatEnv` |
| `.json` | `FormatJSON` |
| `.yaml`, `.yml` | `FormatYAML` |
| 기타 | `FormatAuto` |

```go
format := env.DetectFormat("config.json")   // FormatJSON
format := env.DetectFormat("settings.yaml") // FormatYAML
format := env.DetectFormat("app.yml")       // FormatYAML
format := env.DetectFormat(".env")          // FormatEnv
format := env.DetectFormat(".env.local")    // FormatAuto (실제로는 .env로 처리)
format := env.DetectFormat("unknown.txt")   // FormatAuto
```

**LoadFiles에서의 활용:**

```go
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
// 각 파일의 형식을 자동 감지하여 해당 파서 사용
```

---

### FileFormat 상수

```go
const (
    FormatAuto  FileFormat = iota  // 자동감지
    FormatEnv                      // .env 형식
    FormatJSON                     // JSON 형식
    FormatYAML                     // YAML 형식
)
```

**커스텀형식：**

```go
// 커스텀 형식 상수 정의 (충돌을 피하기 위해 100+ 값 사용 권장)
const (
    FormatTOML  env.FileFormat = 100
    FormatINI   env.FileFormat = 101
    FormatXML   env.FileFormat = 102
)
```

---

### FileFormat.String

```go
func (f FileFormat) String() string
```

형식의 문자열 표현을 반환합니다.

```go
fmt.Println(env.FormatJSON.String())  // "json"
fmt.Println(env.FormatYAML.String())  // "yaml"
fmt.Println(env.FormatEnv.String())   // "dotenv"
fmt.Println(env.FormatAuto.String())  // "auto"
fmt.Println(env.FileFormat(999).String())  // "unknown"
```

---

## 파서 등록

### RegisterParser

```go
func RegisterParser(format FileFormat, factory ParserFactory) error
```

커스텀 형식 파서를 등록합니다.

**매개변수：**
- `format` - 파일형식상수
- `factory` - 파서 팩토리 함수

**반환：**
- `error` - 등록 실패 시 오류 반환

**오류 상황:**
- 내장형식（FormatEnv、FormatJSON、FormatYAML）덮어쓸 수 없음
- 형식이 이미 등록됨

**주의 사항:**
- `env.New()` 호출 전에 등록해야 함
- 내장 형식과 충돌하지 않도록 100+의 형식 값을 사용하는 것이 좋음
- 팩토리 함수는 스레드 안전한 파서를 반환해야 함

```go
// 1. 커스텀 형식 상수 정의
const FormatTOML env.FileFormat = 100

// 2. 구현파서인터페이스
type TOMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *TOMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    // TOML 파싱 구현 로직
    result := make(map[string]string)
    // ... 파싱 코드
    return result, nil
}

// 3. 파서 등록
err := env.RegisterParser(FormatTOML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
    return &TOMLParser{
        cfg:       cfg,
        validator: f.Validator(),
        auditor:   f.Auditor(),
    }, nil
})
if err != nil {
    panic(err)
}

// 4. 사용커스텀형식
func main() {
    // 등록은 반드시 New 이전에 완료되어야 함
    loader, _ := env.New(env.DefaultConfig())
    defer loader.Close()

    // 이제 .toml 파일을 로드할 수 있음
    loader.LoadFiles("config.toml")
}
```

---

### ForceRegisterParser

```go
func ForceRegisterParser(format FileFormat, factory ParserFactory) error
```

내장 파서를 덮어쓸 수 있도록 강제로 파서를 등록합니다.

**매개변수：**
- `format` - 파일형식상수
- `factory` - 파서 팩토리 함수

**반환：**
- `error` - 등록 실패 시 오류 반환（`factory`가 nil인 경우）

::: danger 경고
신중하게 사용하세요. 내장 파서를 덮어쓰면 교체 파서가 동일한 보안 검사를 구현하지 않은 경우 보안 취약점이 발생할 수 있습니다.

다음 고급 시나리오에 적합합니다:
- 내장 파서에 커스텀 보안 검사 추가
- 형식 확장 구현 (예: HEREDOC, 여러 줄 값)
- 모의 파서로 테스트
:::

```go
// 기본 .env 파서 덮어쓰기 (고급 용도)
err := env.ForceRegisterParser(env.FormatEnv, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
    return &MyCustomEnvParser{
        validator: f.Validator(),
        auditor:   f.Auditor(),
    }, nil
})
```

---

### ParserFactory 타입

```go
type ParserFactory func(cfg Config, factory *ComponentFactory) (EnvParser, error)
```

파서 팩토리 함수 서명.

**매개변수：**
- `cfg` - 설정 객체, 제한과 보안 설정 포함
- `factory` - 컴포넌트 팩토리, 검증기와 감사기 가져오기 가능

**반환：**
- `EnvParser` - 파서인스턴스
- `error` - 생성잘못됨

---

### EnvParser 인터페이스

```go
type EnvParser interface {
    Parse(r io.Reader, filename string) (map[string]string, error)
}
```

파서가 구현해야 하는 인터페이스.

**매개변수：**
- `r` - 파일 콘텐츠 읽기기
- `filename` - 파일 이름 (오류 정보에 사용)

**반환：**
- `map[string]string` - 파싱된 키-값 쌍
- `error` - 파싱 오류

---

## 내장 파서

라이브러리에 세 가지 형식 파서가 내장되어 있습니다:

### DotEnv 파서

`.env` 형식 파서, 지원 기능:
- `KEY=value` 문법
- `export KEY=value` 문법
- 작은따옴표 `'value'`와 큰따옴표 `"value"`
- 변수 확장 `${VAR}` 및 `${VAR:-default}`
- 주석 `#`

### JSON 파서

JSON 형식 파서, 지원 기능:
- 키-값 쌍 객체
- 중첩 구조 (평탄화 처리)
- 숫자, 문자열, 불리언 변환
- 배열 (`KEY_0`, `KEY_1`...으로 평탄화)

### YAML 파서

YAML 형식 파서, 지원 기능:
- 키-값 쌍
- 중첩 구조 (평탄화 처리)
- 다양한 스칼라 타입
- 목록 (인덱스 키로 평탄화)

---

## 완전한 예제

### 커스텀 파서 등록

```go
package main

import (
    "fmt"
    "io"
    "strings"

    "github.com/cybergodev/env"
)

// 커스텀 INI 파서
type INIParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *INIParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    content, err := io.ReadAll(r)
    if err != nil {
        return nil, err
    }

    result := make(map[string]string)
    lines := strings.Split(string(content), "\n")
    var section string

    for lineNum, line := range lines {
        line = strings.TrimSpace(line)

        // 빈 줄과 주석 건너뛰기
        if line == "" || strings.HasPrefix(line, ";") || strings.HasPrefix(line, "#") {
            continue
        }

        // Section [section]
        if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
            section = strings.Trim(line, "[]")
            continue
        }

        // Key=Value
        if idx := strings.Index(line, "="); idx > 0 {
            key := strings.TrimSpace(line[:idx])
            value := strings.TrimSpace(line[idx+1:])

            // section 접두사 추가
            if section != "" {
                key = section + "_" + key
            }

            // 검증키
            if err := p.validator.ValidateKey(key); err != nil {
                _ = p.auditor.LogError(env.ActionParse, key, err.Error())
                return nil, fmt.Errorf("line %d: %w", lineNum+1, err)
            }

            result[strings.ToUpper(key)] = value
        }
    }

    _ = p.auditor.Log(env.ActionParse, "", fmt.Sprintf("parsed %d variables from %s", len(result), filename), true)
    return result, nil
}

func main() {
    // 정의커스텀형식
    const FormatINI env.FileFormat = 101

    // 파서 등록
    err := env.RegisterParser(FormatINI, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &INIParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
    if err != nil {
        panic(err)
    }

    // 사용커스텀형식
    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // 이제 .ini 파일을 로드할 수 있음
    // loader.LoadFiles("config.ini")

    fmt.Println("INI parser registered")
}
```

### 커스텀 파일 시스템

```go
package main

import (
    "fmt"
    "os"
    "strings"
    "time"

    "github.com/cybergodev/env"
)

// 메모리 파일 시스템 (테스트용)
type MemoryFileSystem struct {
    files map[string]string
    env   map[string]string
}

func NewMemoryFileSystem() *MemoryFileSystem {
    return &MemoryFileSystem{
        files: make(map[string]string),
        env:   make(map[string]string),
    }
}

func (m *MemoryFileSystem) Open(name string) (env.File, error) {
    content, ok := m.files[name]
    if !ok {
        return nil, os.ErrNotExist
    }
    return &MemoryFile{reader: strings.NewReader(content)}, nil
}

func (m *MemoryFileSystem) OpenFile(name string, flag int, perm os.FileMode) (env.File, error) {
    return m.Open(name)
}

func (m *MemoryFileSystem) Stat(name string) (os.FileInfo, error) {
    content, ok := m.files[name]
    if !ok {
        return nil, os.ErrNotExist
    }
    return &MemoryFileInfo{name: name, size: int64(len(content))}, nil
}

func (m *MemoryFileSystem) MkdirAll(path string, perm os.FileMode) error {
    return nil
}

func (m *MemoryFileSystem) Remove(name string) error {
    delete(m.files, name)
    return nil
}

func (m *MemoryFileSystem) Rename(oldpath, newpath string) error {
    m.files[newpath] = m.files[oldpath]
    delete(m.files, oldpath)
    return nil
}

func (m *MemoryFileSystem) Getenv(key string) string {
    return m.env[key]
}

func (m *MemoryFileSystem) Setenv(key, value string) error {
    m.env[key] = value
    return nil
}

func (m *MemoryFileSystem) Unsetenv(key string) error {
    delete(m.env, key)
    return nil
}

func (m *MemoryFileSystem) LookupEnv(key string) (string, bool) {
    val, ok := m.env[key]
    return val, ok
}

// MemoryFile 구현 env.File
type MemoryFile struct {
    reader *strings.Reader
}

func (f *MemoryFile) Read(p []byte) (n int, err error)  { return f.reader.Read(p) }
func (f *MemoryFile) Write(p []byte) (n int, err error) { return 0, os.ErrUnsupported }
func (f *MemoryFile) Close() error                      { return nil }
func (f *MemoryFile) Stat() (os.FileInfo, error)        { return nil, os.ErrUnsupported }
func (f *MemoryFile) Sync() error                       { return nil }

// MemoryFileInfo 구현 os.FileInfo
type MemoryFileInfo struct {
    name string
    size int64
}

func (i *MemoryFileInfo) Name() string       { return i.name }
func (i *MemoryFileInfo) Size() int64        { return i.size }
func (i *MemoryFileInfo) Mode() os.FileMode  { return 0644 }
func (i *MemoryFileInfo) ModTime() time.Time { return time.Time{} }
func (i *MemoryFileInfo) IsDir() bool        { return false }
func (i *MemoryFileInfo) Sys() interface{}   { return nil }

// 사용예제
func main() {
    // 메모리 파일 시스템 생성
    fs := NewMemoryFileSystem()
    fs.files[".env"] = "APP_NAME=myapp\nPORT=8080\n"

    // 커스텀 파일 시스템 사용 설정
    cfg := env.TestingConfig()
    cfg.FileSystem = fs

    loader, _ := env.New(cfg)
    defer loader.Close()

    loader.LoadFiles(".env")

    fmt.Println(loader.GetString("APP_NAME"))  // myapp
    fmt.Println(loader.GetInt("PORT"))         // 8080
}
```

---

## 관련 문서

- [인터페이스정의](/ko/env/api-reference/interfaces) - 모든인터페이스정의
- [커스텀 파서](/ko/env/guides/custom-parser) - 커스텀 파서가이드
- [테스트 시나리오](/ko/env/guides/testing) - 커스텀 파일 시스템 테스트
