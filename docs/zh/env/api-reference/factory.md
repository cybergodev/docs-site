---
title: "ComponentFactory API - CyberGo env | 组件工厂"
description: "CyberGo env 库 ComponentFactory 组件工厂 API 完整参考，创建和管理 Loader 与 Parser 共享的组件实例，包括审计处理器、验证器、文件系统适配器和 RegisterParser 自定义解析器注册，提供组件生命周期控制 Close 和线程安全并发访问。"
---

# ComponentFactory API

`ComponentFactory` 创建和管理 Loader 与 Parser 共享的组件，提供清晰的生命周期管理。

## 类型定义

```go
type ComponentFactory struct {
    // 包含私有字段
}
```

**核心职责：**
- 创建共享的验证器、审计器和变量展开器
- 管理组件生命周期
- 支持自定义解析器访问内部组件

**线程安全：** ComponentFactory 的所有方法都是线程安全的。

---

## 方法

### Validator

```go
func (f *ComponentFactory) Validator() Validator
```

返回验证器组件，用于键名和值的验证。

```go
// 在自定义解析器中使用
validator := factory.Validator()

if err := validator.ValidateKey("MY_KEY"); err != nil {
    // 键名无效
}

if err := validator.ValidateValue("some value"); err != nil {
    // 值包含非法内容（如空字节、控制字符）
}
```

---

### Auditor

```go
func (f *ComponentFactory) Auditor() FullAuditLogger
```

返回审计日志组件，提供完整的审计日志功能。

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

返回变量展开器组件，用于 `${VAR}` 语法的变量展开。

```go
expander := factory.Expander()
expanded, err := expander.Expand("${BASE_URL}/api")
```

---

### Close

```go
func (f *ComponentFactory) Close() error
```

释放工厂持有的资源。关闭后不应再使用工厂及通过它创建的组件。

**行为：**
- 安全关闭，多次调用返回 nil
- 释放审计器资源
- 使用原子操作保证线程安全

```go
// 通常由 Loader 自动管理
loader, _ := env.New(cfg)
defer loader.Close()  // 自动关闭 ComponentFactory
```

---

### IsClosed

```go
func (f *ComponentFactory) IsClosed() bool
```

检查工厂是否已关闭。

```go
if factory.IsClosed() {
    // 工厂已关闭，不可使用
}
```

---

## 创建方式

### 自动创建（推荐）

Loader 创建时自动创建并管理 ComponentFactory：

```go
cfg := env.DefaultConfig()
loader, _ := env.New(cfg)
// Loader 内部自动创建 ComponentFactory
defer loader.Close()  // 自动关闭工厂
```

### 在自定义解析器中使用

注册自定义解析器时，通过 ComponentFactory 获取验证器和审计器：

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

// 定义自定义格式常量（建议使用 100+ 以避免冲突）
const FormatCustom env.FileFormat = 100

// 注册解析器
env.RegisterParser(FormatCustom, func(cfg env.Config, factory *env.ComponentFactory) (env.EnvParser, error) {
    return newCustomParser(cfg, factory), nil
})
```

---

## 生命周期管理

```text
Config 创建
     ↓
env.New(cfg)
     ↓
自动创建 ComponentFactory
     ↓
    ┌───────┼───────┐
    ↓       ↓       ↓
Validator  Auditor  Expander
    ↓       ↓       ↓
    └───────┼───────┘
            ↓
      Loader/Parser
            ↓
      Close() 释放
```

::: warning 注意
- 每个 Loader 通常拥有自己的 ComponentFactory
- 调用 Close() 后，所有通过该工厂创建的组件都不应再使用
- 工厂是线程安全的，可并发访问
:::

---

## 审计处理器工厂

### NewJSONAuditHandler

```go
func NewJSONAuditHandler(w io.Writer) *JSONAuditHandler
```

创建 JSON 格式的审计处理器，输出结构化日志。

**参数：**
- `w` - 输出目标（如 `os.Stdout`、文件）

```go
cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

**输出示例：**
```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","file":".env","success":true,"duration":1234567}
```

---

### NewLogAuditHandler

```go
func NewLogAuditHandler(logger *log.Logger) *LogAuditHandler
```

创建标准日志格式的审计处理器。

**参数：**
- `logger` - 标准 log.Logger 实例

```go
import "log"

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
cfg.AuditHandler = env.NewLogAuditHandler(logger)
```

**输出示例：**
```text
[AUDIT] 2024/01/15 10:30:00 load .env success (1.23ms)
```

---

### NewChannelAuditHandler

```go
func NewChannelAuditHandler(ch chan<- AuditEvent) *ChannelAuditHandler
```

创建通道审计处理器，用于异步处理审计事件。

**参数：**
- `ch` - 审计事件通道

```go
ch := make(chan env.AuditEvent, 100)
cfg.AuditHandler = env.NewChannelAuditHandler(ch)

// 异步处理审计事件
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

创建空操作审计处理器，用于禁用审计日志。

```go
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewNopAuditHandler() // 不记录任何日志
```

---

### NewCloseableChannelHandler

```go
func NewCloseableChannelHandler(bufferSize int) *CloseableChannelHandler
```

创建拥有自有缓冲通道的可关闭审计处理器。与 `ChannelAuditHandler` 接受外部通道不同，`CloseableChannelHandler` 创建并拥有自己的缓冲通道。调用 `Close()` 关闭处理器并关闭通道。使用 `Channel()` 接收事件。

**参数：**
- `bufferSize` - 缓冲通道大小

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

## 文件系统

### OSFileSystem

默认的文件系统实现，封装操作系统文件操作：

```go
type OSFileSystem struct{}
```

**实现接口：** `FileSystem`

```go
// 方法列表
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

全局默认文件系统实例。

---

### 使用自定义文件系统

在测试中模拟文件系统：

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

// 使用
cfg := env.TestingConfig()
cfg.FileSystem = &MockFileSystem{
    files: map[string]string{".env": "KEY=value"},
    env:   make(map[string]string),
}
```

---

## 格式检测

### DetectFormat

```go
func DetectFormat(filename string) FileFormat
```

根据文件扩展名检测格式。

**参数：**
- `filename` - 文件名或路径

**返回：**
- `FileFormat` - 检测到的格式

**检测规则：**

| 扩展名 | 返回格式 |
|--------|----------|
| `.env` | `FormatEnv` |
| `.json` | `FormatJSON` |
| `.yaml`, `.yml` | `FormatYAML` |
| 其他 | `FormatAuto` |

```go
format := env.DetectFormat("config.json")   // FormatJSON
format := env.DetectFormat("settings.yaml") // FormatYAML
format := env.DetectFormat("app.yml")       // FormatYAML
format := env.DetectFormat(".env")          // FormatEnv
format := env.DetectFormat(".env.local")    // FormatAuto (实际按 .env 处理)
format := env.DetectFormat("unknown.txt")   // FormatAuto
```

**在 LoadFiles 中的应用：**

```go
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
// 自动检测每个文件的格式并使用对应解析器
```

---

### FileFormat 常量

```go
const (
    FormatAuto  FileFormat = iota  // 自动检测
    FormatEnv                      // .env 格式
    FormatJSON                     // JSON 格式
    FormatYAML                     // YAML 格式
)
```

**自定义格式：**

```go
// 定义自定义格式常量（建议使用 100+ 的值避免冲突）
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

返回格式的字符串表示。

```go
fmt.Println(env.FormatJSON.String())  // "json"
fmt.Println(env.FormatYAML.String())  // "yaml"
fmt.Println(env.FormatEnv.String())   // "dotenv"
fmt.Println(env.FormatAuto.String())  // "auto"
fmt.Println(env.FileFormat(999).String())  // "unknown"
```

---

## 解析器注册

### RegisterParser

```go
func RegisterParser(format FileFormat, factory ParserFactory) error
```

注册自定义格式解析器。

**参数：**
- `format` - 文件格式常量
- `factory` - 解析器工厂函数

**返回：**
- `error` - 注册失败时返回错误

**错误情况：**
- 内置格式（FormatEnv、FormatJSON、FormatYAML）无法被覆盖
- 格式已注册

**注意事项：**
- 必须在调用 `env.New()` 之前注册
- 建议使用 100+ 的格式值避免与内置格式冲突
- 工厂函数应返回线程安全的解析器

```go
// 1. 定义自定义格式常量
const FormatTOML env.FileFormat = 100

// 2. 实现解析器接口
type TOMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *TOMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    // 实现 TOML 解析逻辑
    result := make(map[string]string)
    // ... 解析代码
    return result, nil
}

// 3. 注册解析器
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

// 4. 使用自定义格式
func main() {
    // 注册必须在 New 之前完成
    loader, _ := env.New(env.DefaultConfig())
    defer loader.Close()

    // 现在可以加载 .toml 文件
    loader.LoadFiles("config.toml")
}
```

---

### ForceRegisterParser

```go
func ForceRegisterParser(format FileFormat, factory ParserFactory) error
```

强制注册解析器，允许覆盖内置解析器。

**参数：**
- `format` - 文件格式常量
- `factory` - 解析器工厂函数

**返回：**
- `error` - 注册失败时返回错误（`factory` 为 nil 时）

::: danger 警告
谨慎使用。覆盖内置解析器可能引入安全漏洞，如果替换解析器未实现相同的安全检查（键验证、值验证、大小限制等）。

适用于以下高级场景：
- 为内置解析器添加自定义安全检查
- 实现格式扩展（如 HEREDOC、多行值）
- 使用模拟解析器进行测试
:::

```go
// 覆盖默认 .env 解析器（高级用途）
err := env.ForceRegisterParser(env.FormatEnv, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
    return &MyCustomEnvParser{
        validator: f.Validator(),
        auditor:   f.Auditor(),
    }, nil
})
```

---

### ParserFactory 类型

```go
type ParserFactory func(cfg Config, factory *ComponentFactory) (EnvParser, error)
```

解析器工厂函数签名。

**参数：**
- `cfg` - 配置对象，包含限制和安全设置
- `factory` - 组件工厂，可获取验证器和审计器

**返回：**
- `EnvParser` - 解析器实例
- `error` - 创建错误

---

### EnvParser 接口

```go
type EnvParser interface {
    Parse(r io.Reader, filename string) (map[string]string, error)
}
```

解析器必须实现的接口。

**参数：**
- `r` - 文件内容读取器
- `filename` - 文件名（用于错误信息）

**返回：**
- `map[string]string` - 解析后的键值对
- `error` - 解析错误

---

## 内置解析器

库内置三种格式解析器：

### DotEnv Parser

`.env` 格式解析器，支持：
- `KEY=value` 语法
- `export KEY=value` 语法
- 单引号 `'value'` 和双引号 `"value"`
- 变量展开 `${VAR}` 和 `${VAR:-default}`
- 注释 `#`

### JSON Parser

JSON 格式解析器，支持：
- 键值对对象
- 嵌套结构（扁平化处理）
- 数字、字符串、布尔值转换
- 数组（扁平化为 `KEY_0`, `KEY_1`...）

### YAML Parser

YAML 格式解析器，支持：
- 键值对
- 嵌套结构（扁平化处理）
- 多种标量类型
- 列表（扁平化为索引键）

---

## 完整示例

### 注册自定义解析器

```go
package main

import (
    "fmt"
    "io"
    "strings"

    "github.com/cybergodev/env"
)

// 自定义 INI 解析器
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

        // 跳过空行和注释
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

            // 添加 section 前缀
            if section != "" {
                key = section + "_" + key
            }

            // 验证键
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
    // 定义自定义格式
    const FormatINI env.FileFormat = 101

    // 注册解析器
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

    // 使用自定义格式
    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // 现在可以加载 .ini 文件
    // loader.LoadFiles("config.ini")

    fmt.Println("INI parser registered")
}
```

### 自定义文件系统

```go
package main

import (
    "fmt"
    "os"
    "strings"
    "time"

    "github.com/cybergodev/env"
)

// 内存文件系统（用于测试）
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

// MemoryFile 实现 env.File
type MemoryFile struct {
    reader *strings.Reader
}

func (f *MemoryFile) Read(p []byte) (n int, err error)  { return f.reader.Read(p) }
func (f *MemoryFile) Write(p []byte) (n int, err error) { return 0, os.ErrUnsupported }
func (f *MemoryFile) Close() error                      { return nil }
func (f *MemoryFile) Stat() (os.FileInfo, error)        { return nil, os.ErrUnsupported }
func (f *MemoryFile) Sync() error                       { return nil }

// MemoryFileInfo 实现 os.FileInfo
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

// 使用示例
func main() {
    // 创建内存文件系统
    fs := NewMemoryFileSystem()
    fs.files[".env"] = "APP_NAME=myapp\nPORT=8080\n"

    // 配置使用自定义文件系统
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

## 相关文档

- [接口定义](/zh/env/api-reference/interfaces) - 所有接口定义
- [自定义解析器](/zh/env/guides/custom-parser) - 自定义解析器指南
- [测试场景](/zh/env/guides/testing) - 使用自定义文件系统测试
