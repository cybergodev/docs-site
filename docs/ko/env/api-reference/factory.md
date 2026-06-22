---
title: "ComponentFactory API - CyberGo env | 컴포넌트 팩토리"
description: "CyberGo env ComponentFactory API 참조로 감사 핸들러·검증기·파일 시스템 어댑터를 생성하고 커스텀 파서를 등록하며 Close로 수명 주기를 관리합니다."
---

# ComponentFactory API

`ComponentFactory`는 Loader와 Parser가 공유하는 컴포넌트를 생성하고 관리하며, 명확한 수명 주기 관리를 제공합니다.

## 유형 정의

```go
type ComponentFactory struct {
    // 개인 필드 포함
}
```

**핵심 책임:**
- 공유 검증기, 감사기 및 변수 확장기 생성
- 컴포넌트 수명 주기 관리
- 사용자 정의 파서의 내부 컴포넌트 접근 지원

**스레드 안전:** ComponentFactory의 모든 메서드는 스레드 안전합니다.

---

## 메서드

### Validator

```go
func (f *ComponentFactory) Validator() Validator
```

검증기 컴포넌트를 반환하며, 키 이름과 값의 검증에 사용합니다.

```go
// 사용자 정의 파서에서 사용
validator := factory.Validator()

if err := validator.ValidateKey("MY_KEY"); err != nil {
    // 키 이름이 유효하지 않음
}

if err := validator.ValidateValue("some value"); err != nil {
    // 값에 잘못된 내용이 포함됨 (예: 널 바이트, 제어 문자)
}
```

---

### Auditor

```go
func (f *ComponentFactory) Auditor() FullAuditLogger
```

감사 로그 컴포넌트를 반환하며, 전체 감사 로그 기능을 제공합니다.

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

변수 확장기 컴포넌트를 반환하며, `${VAR}` 구문의 변수 확장에 사용합니다.

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
- 안전한 닫기, 여러 번 호출해도 nil 반환
- 감사기 리소스 해제
- 원자 연산을 사용하여 스레드 안전 보장

```go
// 일반적으로 Loader가 자동 관리
loader, _ := env.New(cfg)
defer loader.Close()  // ComponentFactory도 자동으로 닫힘
```

---

### IsClosed

```go
func (f *ComponentFactory) IsClosed() bool
```

팩토리가 닫혔는지 확인합니다.

```go
if factory.IsClosed() {
    // 팩토리가 닫혀 사용할 수 없음
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
defer loader.Close()  // 팩토리도 자동으로 닫힘
```

### 사용자 정의 파서에서 사용

사용자 정의 파서를 등록할 때, ComponentFactory를 통해 검증기와 감사기를 가져올 수 있습니다:

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

// 사용자 정의 형식 상수 정의 (충돌 방지를 위해 100+ 사용 권장)
const FormatCustom env.FileFormat = 100

// 파서 등록
env.RegisterParser(FormatCustom, func(cfg env.Config, factory *env.ComponentFactory) (env.EnvParser, error) {
    return newCustomParser(cfg, factory), nil
})
```

---

## 수명 주기 관리

```text
Config 생성
     ↓
env.New(cfg)
     ↓
ComponentFactory 자동 생성
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

:::warning 참고
- 각 Loader는 일반적으로 자체 ComponentFactory를 소유
- Close()를 호출한 후 해당 팩토리를 통해 생성된 모든 컴포넌트를 더 이상 사용해서는 안 됨
- 팩토리는 스레드 안전하며, 동시 접근 가능
:::

---

## 감사 핸들러 팩토리

### NewJSONAuditHandler

```go
func NewJSONAuditHandler(w io.Writer) *JSONAuditHandler
```

JSON 형식의 감사 핸들러를 생성하며, 구조화된 로그를 출력합니다.

**매개변수:**
- `w` - 출력 대상 (예: `os.Stdout`, 파일)

```go
cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

**출력 예:**
```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","file":".env","success":true,"duration_ns":1234567}
```

---

### NewLogAuditHandler

```go
func NewLogAuditHandler(logger *log.Logger) *LogAuditHandler
```

표준 로그 형식의 감사 핸들러를 생성합니다.

**매개변수:**
- `logger` - 표준 log.Logger 인스턴스

```go
import "log"

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
cfg.AuditHandler = env.NewLogAuditHandler(logger)
```

**출력 예:**
```text
[AUDIT] 2024/01/15 10:30:00 load .env success (1.23ms)
```

---

### NewChannelAuditHandler

```go
func NewChannelAuditHandler(ch chan<- AuditEvent) *ChannelAuditHandler
```

채널 감사 핸들러를 생성하며, 감사 이벤트를 비동기적으로 처리합니다.

**매개변수:**
- `ch` - 감사 이벤트 채널

```go
ch := make(chan env.AuditEvent, 100)
cfg.AuditHandler = env.NewChannelAuditHandler(ch)

// 감사 이벤트 비동기 처리
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

아무 작업도 수행하지 않는 감사 핸들러를 생성하며, 감사 로그를 비활성화합니다.

```go
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewNopAuditHandler() // 어떤 로그도 기록하지 않음
```

---

### NewCloseableChannelHandler

```go
func NewCloseableChannelHandler(bufferSize int) *CloseableChannelHandler
```

자체 버퍼 채널을 가진 닫기 가능한 감사 핸들러를 생성합니다. `ChannelAuditHandler`가 외부 채널을 받는 것과 달리, `CloseableChannelHandler`는 자체 버퍼 채널을 생성하고 소유합니다. `Close()`를 호출하면 핸들러를 닫고 채널을 닫습니다. `Channel()`을 사용하여 이벤트를 수신합니다.

**매개변수:**
- `bufferSize` - 버퍼 채널 크기

```go
handler := env.NewCloseableChannelHandler(64)
defer handler.Close()

go func() {
    for event := range handler.Channel() {
        fmt.Printf("Audit: %+v\n", event)
    }
}()
```

---

## 파일 시스템

### OSFileSystem

기본 파일 시스템 구현으로, 운영 체제 파일 작업을 래핑합니다:

```go
type OSFileSystem struct{}
```

**구현 인터페이스:** `FileSystem`

```go
// 메서드 목록
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

전역 기본 파일 시스템 인스턴스입니다.

---

### 사용자 정의 파일 시스템 사용

테스트에서 파일 시스템 모킹:

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

## 형식 감지

### DetectFormat

```go
func DetectFormat(filename string) FileFormat
```

파일 확장자로 형식을 감지합니다.

**매개변수:**
- `filename` - 파일 이름 또는 경로

**반환값:**
- `FileFormat` - 감지된 형식

**감지 규칙:**

| 확장자 | 반환 형식 |
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

**LoadFiles에서의 적용:**

```go
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
// 각 파일의 형식을 자동으로 감지하고 해당 파서를 사용
```

---

### FileFormat 상수

```go
const (
    FormatAuto  FileFormat = iota  // 자동 감지
    FormatEnv                      // .env 형식
    FormatJSON                     // JSON 형식
    FormatYAML                     // YAML 형식
)
```

**사용자 정의 형식:**

```go
// 사용자 정의 형식 상수 정의 (충돌 방지를 위해 100+ 값 사용 권장)
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

사용자 정의 형식 파서를 등록합니다.

**매개변수:**
- `format` - 파일 형식 상수
- `factory` - 파서 팩토리 함수

**반환값:**
- `error` - 등록 실패 시 오류 반환

**오류 발생 경우:**
- 내장 형식(FormatEnv, FormatJSON, FormatYAML)은 덮어쓸 수 없음
- 형식이 이미 등록된 경우

**주의 사항:**
- `env.New()`를 호출하기 전에 등록해야 함
- 내장 형식과의 충돌을 방지하기 위해 100+ 형식 값을 사용하는 것을 권장
- 팩토리 함수는 스레드 안전한 파서를 반환해야 함

```go
package main

import (
    "io"

    "github.com/cybergodev/env"
)

// 1. 사용자 정의 형식 상수 정의
const FormatTOML env.FileFormat = 100

// 2. 파서 인터페이스 구현
type TOMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *TOMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    // TOML 파싱 로직 구현
    result := make(map[string]string)
    // ... 파싱 코드
    return result, nil
}

// 3. 사용 전 실행되도록 init()에서 파서 등록
func init() {
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
}

// 4. 사용자 정의 형식 사용
func main() {
    // 등록은 init()에서 완료됨 (main보다 먼저 실행)
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

파서를 강제로 등록하며, 내장 파서를 덮어쓸 수 있습니다.

**매개변수:**
- `format` - 파일 형식 상수
- `factory` - 파서 팩토리 함수

**반환값:**
- `error` - 등록 실패 시 오류 반환 (`factory`가 nil인 경우)

:::danger 경고
신중하게 사용하세요. 내장 파서를 덮어쓰면 대체 파서가 동일한 보안 검사(키 검증, 값 검증, 크기 제한 등)를 구현하지 않은 경우 보안 취약점이 발생할 수 있습니다.

다음과 같은 고급 시나리오에 적합합니다:
- 내장 파서에 사용자 정의 보안 검사 추가
- 형식 확장 구현 (예: HEREDOC, 여러 줄 값)
- 테스트용 모킹 파서 사용
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

### ParserFactory 유형

```go
type ParserFactory func(cfg Config, factory *ComponentFactory) (EnvParser, error)
```

파서 팩토리 함수 서명입니다.

**매개변수:**
- `cfg` - 설정 객체, 제한 및 보안 설정 포함
- `factory` - 컴포넌트 팩토리, 검증기 및 감사기에 접근 가능

**반환값:**
- `EnvParser` - 파서 인스턴스
- `error` - 생성 오류

---

### EnvParser 인터페이스

```go
type EnvParser interface {
    Parse(r io.Reader, filename string) (map[string]string, error)
}
```

파서가 구현해야 하는 인터페이스입니다.

**매개변수:**
- `r` - 파일 내용 리더
- `filename` - 파일 이름 (오류 메시지용)

**반환값:**
- `map[string]string` - 파싱된 키-값 쌍
- `error` - 파싱 오류

---

## 내장 파서

라이브러리에 세 가지 형식의 파서가 내장되어 있습니다:

### DotEnv 파서

`.env` 형식 파서, 지원 기능:
- `KEY=value` 구문
- `export KEY=value` 구문
- 작은따옴표 `'value'` 및 큰따옴표 `"value"`
- 변수 확장 `${VAR}` 및 `${VAR:-default}`
- 주석 `#`

### JSON 파서

JSON 형식 파서, 지원 기능:
- 키-값 쌍 객체
- 중첩 구조 (평면화 처리)
- 숫자, 문자열, 부울값 변환
- 배열 (`KEY_0`, `KEY_1`...으로 평면화)

### YAML 파서

YAML 형식 파서, 지원 기능:
- 키-값 쌍
- 중첩 구조 (평면화 처리)
- 다양한 스칼라 유형
- 리스트 (인덱스 키로 평면화)

---

## 전체 예제

### 사용자 정의 파서 등록

```go
package main

import (
    "fmt"
    "io"
    "strings"

    "github.com/cybergodev/env"
)

// 사용자 정의 INI 파서
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

        // 빈 행 및 주석 건너뛰기
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

            // 키 검증
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
    // 사용자 정의 형식 정의
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

    // 사용자 정의 형식 사용
    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // 이제 .ini 파일을 로드할 수 있음
    // loader.LoadFiles("config.ini")

    fmt.Println("INI parser registered")
}
```

### 사용자 정의 파일 시스템

```go
package main

import (
    "errors"
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

// MemoryFile은 env.File 구현
type MemoryFile struct {
    reader *strings.Reader
}

func (f *MemoryFile) Read(p []byte) (n int, err error)  { return f.reader.Read(p) }
func (f *MemoryFile) Write(p []byte) (n int, err error) { return 0, errors.ErrUnsupported }
func (f *MemoryFile) Close() error                      { return nil }
func (f *MemoryFile) Stat() (os.FileInfo, error)        { return nil, errors.ErrUnsupported }
func (f *MemoryFile) Sync() error                       { return nil }

// MemoryFileInfo는 os.FileInfo 구현
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

// 사용 예제
func main() {
    // 메모리 파일 시스템 생성
    fs := NewMemoryFileSystem()
    fs.files[".env"] = "APP_NAME=myapp\nPORT=8080\n"

    // 사용자 정의 파일 시스템 사용 설정
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

- [인터페이스 정의](/ko/env/api-reference/interfaces) - 모든 인터페이스 정의
- [사용자 정의 파서](/ko/env/guides/custom-parser) - 사용자 정의 파서 가이드
- [테스트 시나리오](/ko/env/guides/testing) - 사용자 정의 파일 시스템을 사용한 테스트
