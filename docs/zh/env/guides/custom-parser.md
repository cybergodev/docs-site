---
title: "自定义解析器 - CyberGo env | 扩展文件格式"
description: "CyberGo env 库自定义解析器开发完整指南，详解如何实现 EnvParser 接口创建自定义格式解析器，通过 RegisterParser 注册到 ComponentFactory 并集成到加载流程，包含 TOML 和 INI 解析器完整实现示例、错误处理模式与生产环境最佳实践。"
---

# 自定义解析器

本指南介绍如何创建和注册自定义文件格式解析器，扩展 env 库支持的配置格式。

## 解析器接口

### EnvParser

所有解析器必须实现此接口：

```go
type EnvParser interface {
    Parse(r io.Reader, filename string) (map[string]string, error)
}
```

**参数：**
- `r` - 文件内容读取器
- `filename` - 文件名（用于错误信息）

**返回：**
- `map[string]string` - 解析后的键值对
- `error` - 解析错误

---

## 创建自定义解析器

### 基本结构

```go
package myparser

import (
    "io"
    "github.com/cybergodev/env"
)

// 自定义解析器
type CustomParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

// 实现 EnvParser 接口
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    result := make(map[string]string)

    // 1. 读取内容（注意大小限制）
    content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize))
    if err != nil {
        return nil, err
    }

    // 2. 解析内容为键值对
    // ... 解析逻辑

    // 3. 验证结果
    for key := range result {
        if err := p.validator.ValidateKey(key); err != nil {
            return nil, err
        }
    }

    // 4. 返回结果
    return result, nil
}
```

### TOML 解析器示例

```go
package tomlparser

import (
    "fmt"
    "io"
    "strings"
    "time"

    "github.com/cybergodev/env"
)

// TOMLParser 解析 TOML 格式
type TOMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *TOMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    start := time.Now()

    // 限制读取大小
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

        // 跳过空行和注释
        if line == "" || strings.HasPrefix(line, "#") {
            continue
        }

        // 解析 section [section]
        if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
            currentSection = strings.Trim(line, "[]")
            continue
        }

        // 解析 key = value
        parts := strings.SplitN(line, "=", 2)
        if len(parts) != 2 {
            continue // 或返回错误
        }

        key := strings.TrimSpace(parts[0])
        value := strings.TrimSpace(parts[1])

        // 添加 section 前缀
        if currentSection != "" {
            key = currentSection + "_" + key
        }

        // 去除引号
        value = strings.Trim(value, "\"'")

        // 转大写
        key = strings.ToUpper(key)

        // 验证键
        if err := p.validator.ValidateKey(key); err != nil {
            _ = p.auditor.LogError(env.ActionParse, key, err.Error())
            return nil, fmt.Errorf("line %d: %w", lineNum+1, err)
        }

        result[key] = value
    }

    // 检查变量数量
    if len(result) > p.cfg.MaxVariables {
        return nil, fmt.Errorf("exceeds max variables: %d > %d", len(result), p.cfg.MaxVariables)
    }

    _ = p.auditor.LogWithDuration(env.ActionParse, "", "parsed TOML: "+filename, true, time.Since(start))
    return result, nil
}
```

### INI 解析器示例

```go
package iniparser

import (
    "fmt"
    "io"
    "strings"

    "github.com/cybergodev/env"
)

// INIParser 解析 INI 格式
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

        // 跳过空行和注释
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

            // 验证
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

## 注册解析器

### ParserFactory 类型

```go
type ParserFactory func(cfg Config, factory *ComponentFactory) (EnvParser, error)
```

工厂函数接收 Config 和 ComponentFactory，返回解析器实例。

**参数说明：**
- `cfg` - 配置对象，包含所有限制和安全设置
- `factory` - 组件工厂，可获取 Validator、Auditor 等组件

### RegisterParser 函数

```go
func RegisterParser(format FileFormat, factory ParserFactory) error
```

注册自定义格式解析器。

**参数：**
- `format` - 文件格式常量（建议使用 100+ 的值避免冲突）
- `factory` - 解析器工厂函数

**返回：**
- `error` - 注册失败时返回错误

**错误情况：**
- 内置格式（FormatEnv、FormatJSON、FormatYAML）无法被覆盖
- 格式已注册

**注意事项：**
- 必须在调用 `env.New()` 之前注册
- 建议在 `init()` 函数中注册

### 使用 ComponentFactory

通过 ComponentFactory 获取验证器和审计器：

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

    // ... 解析逻辑

    // 使用验证器验证键名
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

### 完整注册示例

```go
package main

import (
    "github.com/cybergodev/env"
)

// 1. 定义格式常量（建议使用 100+ 的值）
const (
    FormatTOML env.FileFormat = 100
    FormatINI  env.FileFormat = 101
    FormatXML  env.FileFormat = 102
)

// 2. 在 init 中注册
func init() {
    // 注册 TOML 解析器
    err := env.RegisterParser(FormatTOML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &TOMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
    if err != nil {
        panic(err) // 格式已注册或其他错误
    }

    // 注册 INI 解析器
    env.RegisterParser(FormatINI, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &INIParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
}

func main() {
    // 注册必须在 New 之前完成（已在 init 中完成）

    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // 现在可以加载 .toml 文件
    loader.LoadFiles("config.toml")
}
```

---

## 最佳实践

### 1. 遵守配置限制

```go
func (p *CustomParser) checkLimits(result map[string]string) error {
    // 检查变量数量
    if len(result) > p.cfg.MaxVariables {
        return fmt.Errorf("exceeds max variables: %d > %d", len(result), p.cfg.MaxVariables)
    }

    // 检查键和值长度
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

### 2. 使用验证器

```go
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    result := make(map[string]string)

    // ... 解析逻辑

    // 验证所有键
    for key := range result {
        if err := p.validator.ValidateKey(key); err != nil {
            return nil, fmt.Errorf("invalid key %q: %w", key, err)
        }
    }

    // 验证所有值（如果启用）
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

### 3. 提供有意义的错误

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

### 4. 记录审计日志

```go
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    start := time.Now()
    result := make(map[string]string)

    // ... 解析逻辑

    // 记录成功
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

## 完整示例

### 实现 XML 解析器

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

// XML 配置结构
type XMLConfig struct {
    XMLName xml.Name   `xml:"config"`
    Entries []XMLEntry `xml:"entry"`
}

type XMLEntry struct {
    Key   string `xml:"key,attr"`
    Value string `xml:",chardata"`
}

// XMLParser 解析 XML 格式
type XMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *XMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    start := time.Now()

    // 限制读取大小
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

        // 验证键长度
        if len(key) > p.cfg.MaxKeyLength {
            return nil, fmt.Errorf("key too long: %s", key)
        }

        // 验证键格式
        if err := p.validator.ValidateKey(key); err != nil {
            return nil, fmt.Errorf("invalid key %q: %w", key, err)
        }

        // 验证值长度
        if len(entry.Value) > p.cfg.MaxValueLength {
            return nil, fmt.Errorf("value too long for key: %s", key)
        }

        result[key] = entry.Value
    }

    // 检查变量数量
    if len(result) > p.cfg.MaxVariables {
        return nil, fmt.Errorf("too many variables: %d > %d", len(result), p.cfg.MaxVariables)
    }

    _ = p.auditor.LogWithDuration(env.ActionParse, "", "parsed XML: "+filename, true, time.Since(start))
    return result, nil
}

// 定义 XML 格式常量
const FormatXML env.FileFormat = 102

func init() {
    // 注册 XML 解析器
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

    // 加载 XML 配置
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

## 相关文档

- [ComponentFactory API](/zh/env/api-reference/factory) - ComponentFactory 和 RegisterParser
- [接口定义](/zh/env/api-reference/interfaces) - EnvParser 接口定义
- [Config API](/zh/env/api-reference/config) - 配置选项详解
- [多格式配置](/zh/env/guides/multi-format) - JSON/YAML 格式详解
