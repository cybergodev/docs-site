---
title: "커스텀 파서 - CyberGo env | 파일 형식 확장"
description: "CyberGo env 커스텀 파서 가이드로 EnvParser 인터페이스를 구현해 RegisterParser로 등록하며, TOML·INI 파서 전체 예제와 모범 사례를 제공합니다."
---

# 커스텀 파서

이 가이드는 커스텀 파일 형식 파서를 생성하고 등록하여 env 라이브러리가 지원하는 구성 형식을 확장하는 방법을 소개합니다.

## 파서 인터페이스

### EnvParser

모든 파서는 이 인터페이스를 구현해야 합니다:

```go
type EnvParser interface {
    Parse(r io.Reader, filename string) (map[string]string, error)
}
```

**매개변수:**
- `r` - 파일 내용 리더
- `filename` - 파일 이름 (오류 메시지에 사용)

**반환값:**
- `map[string]string` - 파싱된 키-값 쌍
- `error` - 파싱 오류

---

## 커스텀 파서 생성

### 기본 구조

```go
package myparser

import (
    "io"
    "strings"

    "github.com/cybergodev/env"
)

// 커스텀 파서
type CustomParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

// EnvParser 인터페이스 구현
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    result := make(map[string]string)

    // 1. 내용 읽기 (크기 제한 주의)
    content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize))
    if err != nil {
        return nil, err
    }

    // 2. 내용을 키-값 쌍으로 파싱
    for _, line := range strings.Split(string(content), "\n") {
        line = strings.TrimSpace(line)
        if line == "" || strings.HasPrefix(line, "#") {
            continue
        }
        idx := strings.Index(line, "=")
        if idx <= 0 {
            continue
        }
        result[strings.TrimSpace(line[:idx])] = strings.TrimSpace(line[idx+1:])
    }

    // 3. 결과 검증
    for key := range result {
        if err := p.validator.ValidateKey(key); err != nil {
            return nil, err
        }
    }

    // 4. 결과 반환
    return result, nil
}
```

### TOML 파서 예시

```go
package tomlparser

import (
    "fmt"
    "io"
    "strings"
    "time"

    "github.com/cybergodev/env"
)

// TOMLParser는 TOML 형식을 파싱합니다
type TOMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *TOMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    start := time.Now()

    // 읽기 크기 제한
    content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize+1))
    if err != nil {
        return nil, err
    }
    if int64(len(content)) > p.cfg.MaxFileSize {
        return nil, fmt.Errorf("file exceeds size limit")
    }

    result := make(map[string]string)
    lines := strings.Split(string(content), "\n")

    var currentSection string

    for lineNum, line := range lines {
        line = strings.TrimSpace(line)

        // 빈 줄 및 주석 건너뛰기
        if line == "" || strings.HasPrefix(line, "#") {
            continue
        }

        // section [section] 파싱
        if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
            currentSection = strings.Trim(line, "[]")
            continue
        }

        // key = value 파싱
        parts := strings.SplitN(line, "=", 2)
        if len(parts) != 2 {
            continue // 또는 오류 반환
        }

        key := strings.TrimSpace(parts[0])
        value := strings.TrimSpace(parts[1])

        // section 접두사 추가
        if currentSection != "" {
            key = currentSection + "_" + key
        }

        // 따옴표 제거
        value = strings.Trim(value, "\"'")

        // 대문자로 변환
        key = strings.ToUpper(key)

        // 키 검증
        if err := p.validator.ValidateKey(key); err != nil {
            _ = p.auditor.LogError(env.ActionParse, key, err.Error())
            return nil, fmt.Errorf("line %d: %w", lineNum+1, err)
        }

        result[key] = value
    }

    // 변수 수량 확인
    if len(result) > p.cfg.MaxVariables {
        return nil, fmt.Errorf("exceeds max variables: %d > %d", len(result), p.cfg.MaxVariables)
    }

    _ = p.auditor.LogWithDuration(env.ActionParse, "", "parsed TOML: "+filename, true, time.Since(start))
    return result, nil
}
```

### INI 파서 예시

```go
package iniparser

import (
    "fmt"
    "io"
    "strings"

    "github.com/cybergodev/env"
)

// INIParser는 INI 형식을 파싱합니다
type INIParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *INIParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize+1))
    if err != nil {
        return nil, err
    }

    result := make(map[string]string)
    lines := strings.Split(string(content), "\n")

    var currentSection string

    for lineNum, line := range lines {
        line = strings.TrimSpace(line)

        // 빈 줄 및 주석 건너뛰기
        if line == "" || strings.HasPrefix(line, ";") || strings.HasPrefix(line, "#") {
            continue
        }

        // Section
        if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
            currentSection = strings.Trim(line, "[]")
            continue
        }

        // Key=Value
        if idx := strings.Index(line, "="); idx > 0 {
            key := strings.TrimSpace(line[:idx])
            value := strings.TrimSpace(line[idx+1:])

            if currentSection != "" {
                key = currentSection + "_" + key
            }

            // 검증
            if err := p.validator.ValidateKey(strings.ToUpper(key)); err != nil {
                return nil, fmt.Errorf("line %d: %w", lineNum+1, err)
            }

            result[strings.ToUpper(key)] = value
        }
    }

    return result, nil
}
```

---

## 파서 등록

### ParserFactory 타입

```go
type ParserFactory func(cfg Config, factory *ComponentFactory) (EnvParser, error)
```

팩토리 함수는 Config와 ComponentFactory를 받아 파서 인스턴스를 반환합니다.

**매개변수 설명:**
- `cfg` - 구성 객체, 모든 제한 및 보안 설정 포함
- `factory` - 컴포넌트 팩토리, Validator, Auditor 등의 컴포넌트 접근 가능

### RegisterParser 함수

```go
func RegisterParser(format FileFormat, factory ParserFactory) error
```

커스텀 형식 파서를 등록합니다.

**매개변수:**
- `format` - 파일 형식 상수 (충돌을 피하기 위해 100+ 값 사용 권장)
- `factory` - 파서 팩토리 함수

**반환값:**
- `error` - 등록 실패 시 오류 반환

**오류 상황:**
- 내장 형식 (FormatEnv, FormatJSON, FormatYAML)은 덮어쓸 수 없음
- 형식이 이미 등록됨

**주의 사항:**
- `env.New()` 호출 전에 등록해야 함
- `init()` 함수에서 등록하는 것을 권장

### ComponentFactory 사용

ComponentFactory를 통해 검증기와 감사기를 가져옵니다:

```go
type SecureParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func NewSecureParser(cfg env.Config, factory *env.ComponentFactory) (env.EnvParser, error) {
    return &SecureParser{
        cfg:       cfg,
        validator: factory.Validator(),
        auditor:   factory.Auditor(),
    }, nil
}

func (p *SecureParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    result := make(map[string]string)

    // ... 파싱 로직

    // 검증기로 키 이름 검증
    for key := range result {
        if err := p.validator.ValidateKey(key); err != nil {
            _ = p.auditor.Log(env.ActionParse, key, "invalid key", false)
            return nil, err
        }
    }

    _ = p.auditor.Log(env.ActionParse, "", "parse completed", true)
    return result, nil
}
```

### 완전한 등록 예시

```go
package main

import (
    "github.com/cybergodev/env"
)

// 1. 형식 상수 정의 (100+ 값 사용 권장)
const (
    FormatTOML env.FileFormat = 100
    FormatINI  env.FileFormat = 101
    FormatXML  env.FileFormat = 102
)

// 2. init에서 등록
func init() {
    // TOML 파서 등록
    err := env.RegisterParser(FormatTOML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &TOMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
    if err != nil {
        panic(err) // 형식이 이미 등록되었거나 기타 오류
    }

    // INI 파서 등록
    env.RegisterParser(FormatINI, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &INIParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
}

func main() {
    // 등록은 New 전에 완료되어야 함 (init에서 이미 완료)

    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // 이제 .toml 파일을 로딩할 수 있음
    loader.LoadFiles("config.toml")
}
```

---

## 모범 사례

### 1. 구성 제한 준수

```go
func (p *CustomParser) checkLimits(result map[string]string) error {
    // 변수 수량 확인
    if len(result) > p.cfg.MaxVariables {
        return fmt.Errorf("exceeds max variables: %d > %d", len(result), p.cfg.MaxVariables)
    }

    // 키 및 값 길이 확인
    for key, value := range result {
        if len(key) > p.cfg.MaxKeyLength {
            return fmt.Errorf("key too long: %s", key)
        }
        if len(value) > p.cfg.MaxValueLength {
            return fmt.Errorf("value too long for: %s", key)
        }
    }

    return nil
}
```

### 2. 검증기 사용

```go
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    result := make(map[string]string)

    // ... 파싱 로직

    // 모든 키 검증
    for key := range result {
        if err := p.validator.ValidateKey(key); err != nil {
            return nil, fmt.Errorf("invalid key %q: %w", key, err)
        }
    }

    // 모든 값 검증 (활성화된 경우)
    if p.cfg.ValidateValues {
        for key, value := range result {
            if err := p.validator.ValidateValue(value); err != nil {
                return nil, fmt.Errorf("invalid value for %q: %w", key, err)
            }
        }
    }

    return result, nil
}
```

### 3. 의미 있는 오류 제공

```go
type CustomParseError struct {
    File    string
    Line    int
    Content string
    Err     error
}

func (e *CustomParseError) Error() string {
    if e.Line > 0 {
        return fmt.Sprintf("%s:%d: %s: %v", e.File, e.Line, e.Content, e.Err)
    }
    return fmt.Sprintf("%s: %s: %v", e.File, e.Content, e.Err)
}

func (e *CustomParseError) Unwrap() error {
    return e.Err
}
```

### 4. 감사 로그 기록

```go
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    start := time.Now()
    result := make(map[string]string)

    // ... 파싱 로직

    // 성공 기록
    _ = p.auditor.LogWithDuration(
        env.ActionParse,
        "",
        fmt.Sprintf("parsed %d variables", len(result)),
        true,
        time.Since(start),
    )

    return result, nil
}
```

---

## 전체 예시

### XML 파서 구현

```go
package main

import (
    "encoding/xml"
    "fmt"
    "io"
    "strings"
    "time"

    "github.com/cybergodev/env"
)

// XML 구성 구조체
type XMLConfig struct {
    XMLName xml.Name   `xml:"config"`
    Entries []XMLEntry `xml:"entry"`
}

type XMLEntry struct {
    Key   string `xml:"key,attr"`
    Value string `xml:",chardata"`
}

// XMLParser는 XML 형식을 파싱합니다
type XMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *XMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    start := time.Now()

    // 읽기 크기 제한
    content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize+1))
    if err != nil {
        return nil, err
    }
    if int64(len(content)) > p.cfg.MaxFileSize {
        _ = p.auditor.LogError(env.ActionParse, "", "file exceeds size limit")
        return nil, fmt.Errorf("file exceeds size limit: %d > %d", len(content), p.cfg.MaxFileSize)
    }

    var xmlConfig XMLConfig
    if err := xml.Unmarshal(content, &xmlConfig); err != nil {
        _ = p.auditor.LogError(env.ActionParse, "", "xml parse error: "+err.Error())
        return nil, fmt.Errorf("xml parse error: %w", err)
    }

    result := make(map[string]string)

    for _, entry := range xmlConfig.Entries {
        key := strings.ToUpper(entry.Key)

        // 키 길이 검증
        if len(key) > p.cfg.MaxKeyLength {
            return nil, fmt.Errorf("key too long: %s", key)
        }

        // 키 형식 검증
        if err := p.validator.ValidateKey(key); err != nil {
            return nil, fmt.Errorf("invalid key %q: %w", key, err)
        }

        // 값 길이 검증
        if len(entry.Value) > p.cfg.MaxValueLength {
            return nil, fmt.Errorf("value too long for key: %s", key)
        }

        result[key] = entry.Value
    }

    // 변수 수량 확인
    if len(result) > p.cfg.MaxVariables {
        return nil, fmt.Errorf("too many variables: %d > %d", len(result), p.cfg.MaxVariables)
    }

    _ = p.auditor.LogWithDuration(env.ActionParse, "", "parsed XML: "+filename, true, time.Since(start))
    return result, nil
}

// XML 형식 상수 정의
const FormatXML env.FileFormat = 102

func init() {
    // XML 파서 등록
    env.RegisterParser(FormatXML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &XMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
}

func main() {
    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // XML 설정 로딩
    /*
    <?xml version="1.0"?>
    <config>
        <entry key="DATABASE_HOST">localhost</entry>
        <entry key="DATABASE_PORT">5432</entry>
    </config>
    */
    loader.LoadFiles("config.xml")

    fmt.Println(loader.GetString("DATABASE_HOST"))  // localhost
    fmt.Println(loader.GetInt("DATABASE_PORT"))     // 5432
}
```

---

## 관련 문서

- [ComponentFactory API](/ko/env/api-reference/factory) - ComponentFactory 및 RegisterParser
- [인터페이스 정의](/ko/env/api-reference/interfaces) - EnvParser 인터페이스 정의
- [Config API](/ko/env/api-reference/config) - 구성 옵션 상세
- [다중 형식 구성](/ko/env/guides/multi-format) - JSON/YAML 형식 상세
