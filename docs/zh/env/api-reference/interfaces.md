---
title: "接口定义 - CyberGo env | 核心接口层次"
description: "CyberGo env 库接口类型定义完整参考文档，采用细粒度接口设计支持依赖注入和灵活组合，包括 Validator 验证器、FullAuditLogger 审计处理器、EnvParser 解析器、EnvStorage 安全存储和 FileSystem 文件系统适配器等核心接口的详细说明与用法。"
---

# 接口定义

env 库使用细粒度接口设计，支持依赖注入和灵活组合。

## 核心接口

### EnvLoader

完整的加载器接口，组合所有子接口：

```go
type EnvLoader interface {
    EnvFileLoader
    EnvGetter
    EnvSetter
    EnvApplicator
    EnvCloser
}
```

---

### EnvFileLoader

文件加载接口：

```go
type EnvFileLoader interface {
    LoadFiles(filenames ...string) error
}
```

**用途：** 仅需要加载文件能力的场景。

```go
func loadConfig(loader env.EnvFileLoader) error {
    return loader.LoadFiles(".env")
}
```

---

### EnvGetter

读取访问接口：

```go
type EnvGetter interface {
    GetString(key string, defaultValue ...string) string
    Lookup(key string) (string, bool)
    Keys() []string
    All() map[string]string
}
```

**用途：** 只读配置访问（最小接口）。

```go
func readConfig(getter env.EnvGetter) {
    host := getter.GetString("HOST", "localhost")
    value, exists := getter.Lookup("API_KEY")
    keys := getter.Keys()
}
```

::: warning 注意
`GetInt`、`GetBool`、`GetDuration`、`GetSecure`、`Len` **不是** `EnvGetter` 接口的一部分。
这些方法在 `*Loader` 类型上实现，但不在最小接口中。

如需完整读取能力，请直接使用 `*Loader` 类型：

```go
func readFullConfig(loader *env.Loader) {
    port := loader.GetInt("PORT", 8080)      // ✓ 可用
    debug := loader.GetBool("DEBUG", false)  // ✓ 可用
    count := loader.Len()                     // ✓ 可用
}
```
:::

---

### EnvSetter

写入访问接口：

```go
type EnvSetter interface {
    Set(key, value string) error
    Delete(key string) error
}
```

**用途：** 仅需要设置/删除能力的场景。

```go
func updateConfig(setter env.EnvSetter) error {
    if err := setter.Set("KEY", "value"); err != nil {
        return err
    }
    return setter.Delete("TEMP_KEY")
}
```

---

### EnvApplicator

应用到系统环境接口：

```go
type EnvApplicator interface {
    Apply() error
}
```

**用途：** 将加载的变量应用到 `os.Environ`。

```go
func applyToSystem(applicator env.EnvApplicator) error {
    return applicator.Apply()
}
```

---

### EnvCloser

资源释放接口：

```go
type EnvCloser interface {
    Close() error
}
```

**用途：** 释放加载器资源。

---

## 验证接口

### Validator

组合验证接口：

```go
type Validator interface {
    KeyValidator
    ValueValidator
    RequiredValidator
}
```

::: tip 注意
`Validator` 通过嵌入 `RequiredValidator` 提供 `ValidateRequired` 方法。仅实现 `KeyValidator` 的自定义验证器在调用 `ValidateRequired` 时会返回 `ErrValidateRequiredUnsupported`。
:::

---

### RequiredValidator

必需键验证接口：

```go
type RequiredValidator interface {
    ValidateRequired(keys map[string]bool) error
}
```

验证所有必需的键是否存在。

---

### KeyValidator

键验证接口：

```go
type KeyValidator interface {
    ValidateKey(key string) error
}
```

验证键名是否符合规则（长度、格式、禁止键等）。

---

### ValueValidator

值验证接口：

```go
type ValueValidator interface {
    ValidateValue(value string) error
}
```

验证值是否安全（无空字节、控制字符等）。

---

## 审计接口

### AuditLogger

最小审计日志接口（`internal.AuditLogger` 的别名）：

```go
type AuditLogger interface {
    LogError(action AuditAction, key, errMsg string) error
}
```

**用途：** 最小化接口，便于实现自定义审计日志器。如需完整审计能力，请使用 `FullAuditLogger`。

---

### FullAuditLogger

扩展审计日志接口，提供完整的审计日志功能：

```go
type FullAuditLogger interface {
    AuditLogger
    Log(action AuditAction, key, reason string, success bool) error
    LogWithFile(action AuditAction, key, file, reason string, success bool) error
    LogWithDuration(action AuditAction, key, reason string, success bool, duration time.Duration) error
    Close() error
}
```

**用途：** 完整审计日志能力。`ComponentFactory.Auditor()` 返回此接口。

**方法说明：**

| 方法 | 用途 |
|------|------|
| `LogError` | 记录错误事件（继承自 AuditLogger） |
| `Log` | 记录一般审计事件 |
| `LogWithFile` | 记录包含文件信息的事件 |
| `LogWithDuration` | 记录包含耗时的事件 |
| `Close` | 关闭审计日志 |

---

### AuditHandler

审计处理器接口（用于 Config.AuditHandler 配置）：

```go
type AuditHandler interface {
    Log(event AuditEvent) error
    Close() error
}
```

**用途：** 实现此接口可自定义审计事件处理方式。与 `AuditLogger` 接口不同，`AuditHandler` 需要 `Log` 和 `Close` 两个方法，用于接收处理审计事件和释放资源。

**内置实现：**
- `JSONAuditHandler` - 输出 JSON 格式日志
- `LogAuditHandler` - 使用标准 log 包输出
- `ChannelAuditHandler` - 发送到通道
- `CloseableChannelHandler` - 拥有自有缓冲通道的可关闭处理器
- `NopAuditHandler` - 空操作处理器

---

## 变量展开接口

### VariableExpander

变量展开接口：

```go
type VariableExpander interface {
    Expand(s string) (string, error)
}
```

**用途：** 自定义变量展开逻辑，支持 `${VAR}`、`${VAR:-default}` 等语法。

```go
expanded, err := expander.Expand("${BASE_URL}/api")
```

---

## 解析接口

### EnvParser

解析器接口：

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

**用途：** 自定义文件格式解析器。

---

## 存储接口

### EnvStorage

环境变量存储接口：

```go
type EnvStorage interface {
    Get(key string) (string, bool)
    Set(key, value string)
    Delete(key string)
    Keys() []string
    Len() int
    ToMap() map[string]string
    Clear()
}
```

**用途：** 自定义存储后端。

**方法说明：**

| 方法 | 用途 |
|------|------|
| `Get` | 获取值，返回值和是否存在 |
| `Set` | 设置键值对 |
| `Delete` | 删除键 |
| `Keys` | 返回所有键名 |
| `Len` | 返回键值对数量 |
| `ToMap` | 返回所有键值对的副本 |
| `Clear` | 清空所有数据 |

---

## 序列化接口

### Marshaler

自定义序列化接口：

```go
type Marshaler interface {
    MarshalEnv() ([]byte, error)
}
```

**用途：** 自定义类型的序列化。

```go
type LogLevel string

func (l LogLevel) MarshalEnv() ([]byte, error) {
    return []byte(string(l)), nil
}

// 使用
level := LogLevel("debug")
env.Marshal(level)  // 调用 MarshalEnv
```

---

### Unmarshaler

自定义反序列化接口：

```go
type Unmarshaler interface {
    UnmarshalEnv(data map[string]string) error
}
```

**用途：** 自定义类型的反序列化。

```go
type Config struct {
    Host string
    Port int
}

func (c *Config) UnmarshalEnv(data map[string]string) error {
    c.Host = data["HOST"]
    port, _ := strconv.Atoi(data["PORT"])
    c.Port = port
    return nil
}

// 使用
var cfg Config
env.UnmarshalInto(data, &cfg)  // 调用 UnmarshalEnv
```

---

## 文件系统接口

### FileSystem

文件系统抽象接口：

```go
type FileSystem interface {
    Open(name string) (File, error)
    OpenFile(name string, flag int, perm os.FileMode) (File, error)
    Stat(name string) (os.FileInfo, error)
    MkdirAll(path string, perm os.FileMode) error
    Remove(name string) error
    Rename(oldpath, newpath string) error
    Getenv(key string) string
    Setenv(key, value string) error
    Unsetenv(key string) error
    LookupEnv(key string) (string, bool)
}
```

**用途：** 测试时模拟文件系统。

```go
type MockFileSystem struct {
    files map[string]string
    env   map[string]string
}

// MockFile 实现 env.File 接口（用于测试）
type MockFile struct {
    reader *strings.Reader
}

func (f *MockFile) Read(p []byte) (n int, err error)   { return f.reader.Read(p) }
func (f *MockFile) Write(p []byte) (n int, err error)  { return 0, os.ErrUnsupported }
func (f *MockFile) Close() error                       { return nil }
func (f *MockFile) Stat() (os.FileInfo, error)         { return nil, os.ErrUnsupported }
func (f *MockFile) Sync() error                        { return nil }

func (m *MockFileSystem) Open(name string) (env.File, error) {
    content, ok := m.files[name]
    if !ok {
        return nil, os.ErrNotExist
    }
    return &MockFile{reader: strings.NewReader(content)}, nil
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

func (m *MockFileSystem) MkdirAll(path string, perm os.FileMode) error { return nil }
func (m *MockFileSystem) Remove(name string) error                     { delete(m.files, name); return nil }
func (m *MockFileSystem) Rename(oldpath, newpath string) error {
    m.files[newpath] = m.files[oldpath]
    delete(m.files, oldpath)
    return nil
}

func (m *MockFileSystem) Getenv(key string) string            { return m.env[key] }
func (m *MockFileSystem) Setenv(key, value string) error      { m.env[key] = value; return nil }
func (m *MockFileSystem) Unsetenv(key string) error           { delete(m.env, key); return nil }
func (m *MockFileSystem) LookupEnv(key string) (string, bool) { val, ok := m.env[key]; return val, ok }

// 使用
cfg := env.TestingConfig()
cfg.FileSystem = &MockFileSystem{
    files: map[string]string{".env": "KEY=value"},
    env:   make(map[string]string),
}
```

---

### File

文件接口：

```go
type File interface {
    io.Reader
    io.Writer
    io.Closer
    Stat() (os.FileInfo, error)
    Sync() error
}
```

**方法说明：**

| 方法 | 用途 |
|------|------|
| `Read` | 读取数据 |
| `Write` | 写入数据 |
| `Close` | 关闭文件 |
| `Stat` | 获取文件信息 |
| `Sync` | 同步到磁盘 |

---

### DefaultFileSystem

默认文件系统实现：

```go
var DefaultFileSystem FileSystem = OSFileSystem{}
```

使用真实的操作系统文件系统和环境变量：

```go
cfg := env.DefaultConfig()
cfg.FileSystem = env.DefaultFileSystem  // 默认值
```

---

## 审计处理器

### JSONAuditHandler

输出 JSON 格式审计日志：

```go
func NewJSONAuditHandler(w io.Writer) *JSONAuditHandler
```

**参数：**
- `w` - 输出目标（如 `os.Stdout`、文件）

```go
handler := env.NewJSONAuditHandler(os.Stdout)
```

**输出示例：**
```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","key":"API_KEY","success":true}
```

---

### LogAuditHandler

使用标准 log 包输出：

```go
func NewLogAuditHandler(logger *log.Logger) *LogAuditHandler
```

**参数：**
- `logger` - 标准 log.Logger 实例

```go
import "log"

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
handler := env.NewLogAuditHandler(logger)
```

**输出示例：**
```text
[AUDIT] 2024/01/15 10:30:00 load .env success
```

---

### ChannelAuditHandler

发送到通道：

```go
func NewChannelAuditHandler(ch chan<- AuditEvent) *ChannelAuditHandler
```

**参数：**
- `ch` - 审计事件通道

```go
ch := make(chan env.AuditEvent, 100)
handler := env.NewChannelAuditHandler(ch)

// 异步处理
go func() {
    for event := range ch {
        processAuditEvent(event)
    }
}()
```

---

### NopAuditHandler

空操作处理器（丢弃所有事件）：

```go
func NewNopAuditHandler() *NopAuditHandler
```

```go
handler := env.NewNopAuditHandler()
```

---

## 审计类型

### AuditAction

操作类型常量：

```go
type AuditAction = internal.Action

const (
    ActionLoad       AuditAction = "load"        // 文件加载
    ActionParse      AuditAction = "parse"       // 解析操作
    ActionGet        AuditAction = "get"         // 变量读取
    ActionSet        AuditAction = "set"         // 变量设置
    ActionDelete     AuditAction = "delete"      // 变量删除
    ActionValidate   AuditAction = "validate"    // 验证操作
    ActionExpand     AuditAction = "expand"      // 变量展开
    ActionSecurity   AuditAction = "security"    // 安全事件
    ActionError      AuditAction = "error"       // 错误事件
    ActionFileAccess AuditAction = "file_access" // 文件访问
)
```

---

### AuditEvent

审计事件结构：

```go
type AuditEvent = internal.Event
```

**字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `Timestamp` | `time.Time` | 时间戳 |
| `Action` | `AuditAction` | 操作类型 |
| `Key` | `string` | 键名（已掩码） |
| `File` | `string` | 文件名 |
| `Reason` | `string` | 原因/描述 |
| `Success` | `bool` | 是否成功 |
| `Masked` | `bool` | 是否已掩码 |
| `Details` | `string` | 详情 |
| `Duration` | `int64` | 耗时（纳秒） |

---

## ComponentFactory

组件工厂，管理共享组件：

```go
type ComponentFactory struct {
    // 包含私有字段
}
```

### 方法

```go
func (f *ComponentFactory) Validator() Validator
func (f *ComponentFactory) Auditor() FullAuditLogger
func (f *ComponentFactory) Expander() VariableExpander
func (f *ComponentFactory) Close() error
func (f *ComponentFactory) IsClosed() bool
```

**用途：** 内部使用，创建 Loader 时自动管理。详见 [ComponentFactory API](/zh/env/api-reference/factory)。

---

## 完整示例

### 实现自定义审计处理器

```go
package main

import (
    "fmt"
    "time"

    "github.com/cybergodev/env"
)

// 自定义审计处理器
type CustomAuditHandler struct {
    events []env.AuditEvent
}

func (h *CustomAuditHandler) Log(event env.AuditEvent) error {
    h.events = append(h.events, event)
    return nil
}

func (h *CustomAuditHandler) Close() error {
    return nil
}

func main() {
    cfg := env.ProductionConfig()
    cfg.AuditEnabled = true
    handler := &CustomAuditHandler{}
    cfg.AuditHandler = handler

    loader, _ := env.New(cfg)
    defer loader.Close()
    // 使用 loader...

    // 查看审计事件
    for _, event := range handler.events {
        fmt.Printf("%s: %s - %s\n", event.Action, event.Key, event.Reason)
    }
}
```

### 使用细粒度接口

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

// 只需要读取能力
func printConfig(getter env.EnvGetter) {
    for _, key := range getter.Keys() {
        value, _ := getter.Lookup(key)
        fmt.Printf("%s = %s\n", key, value)
    }
}

// 只需要写入能力
func setDefaults(setter env.EnvSetter) error {
    return setter.Set("DEFAULT_KEY", "default_value")
}

// 只需要加载能力
func loadConfig(loader env.EnvFileLoader) error {
    return loader.LoadFiles(".env")
}

func main() {
    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // 使用细粒度接口
    loadConfig(loader)
    setDefaults(loader)
    printConfig(loader)
}
```

## 相关文档

- [Loader API](/zh/env/api-reference/loader) - Loader 实例方法
- [ComponentFactory API](/zh/env/api-reference/factory) - 组件工厂
- [自定义解析器](/zh/env/guides/custom-parser) - 自定义解析器指南
