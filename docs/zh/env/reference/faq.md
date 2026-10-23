---
sidebar_label: "常见问题"
title: "常见问题 - CyberGo env | 环境变量常见问题"
description: "CyberGo env 常见问题解答，涵盖全局与实例模式选择、Load 单次初始化、JSON/YAML 嵌套键访问、GetSlice 泛型设计、线程安全并发访问、SecureValue 生命周期与 OverwriteExisting 覆盖策略等高频问题。"
sidebar_position: 2
---

# 常见问题

## 基础使用

### Load() 和 New() 应该选哪个？

**`env.Load()`**（全局模式）适合简单应用：一次加载，全局使用包级函数。它会自动将变量应用到 `os.Environ`。

**`env.New()`**（实例模式）适合测试和多配置场景：创建隔离实例，不自动应用，需要显式 `Close()`。

```go
// 简单应用 → 全局模式
env.Load(".env")
port := env.GetInt("PORT", 8080)

// 测试 / 多配置 → 实例模式
loader, _ := env.New(env.TestingConfig())
defer loader.Close()
port := loader.GetInt("PORT", 8080)
```

::: tip 选择建议
如果不确定，先用 `env.Load()`。当遇到测试隔离或多配置需求时，再切换到 `env.New()`。
:::

### 为什么 Load() 只能调用一次？

`Load()` 设置全局默认加载器（单例模式），重复调用返回 `ErrAlreadyInitialized`。这是设计决策：避免在运行时意外覆盖已加载的配置。

```go
// 第一次调用 — 成功
env.Load(".env")

// 第二次调用 — 返回错误
err := env.Load(".env.production")
// err == env.ErrAlreadyInitialized
```

**解决方案：**

```go
// 方案一：一次加载多个文件（推荐）
env.Load(".env", ".env.production")

// 方案二：需要重新初始化时先重置
env.ResetDefaultLoader()  // 主要用于测试
env.Load(".env.production")
```

### .env 文件不存在时会怎样？

默认行为：**静默跳过**，不报错。这是为了支持「有则加载，无则忽略」的灵活部署。

```go
// DefaultConfig — 文件不存在时静默跳过
env.Load(".env", ".env.local")
// 即使两个文件都不存在，也不会报错
```

如果希望文件不存在时报错（生产环境推荐）：

```go
cfg := env.ProductionConfig()
// FailOnMissingFile 默认为 true（仅 ProductionConfig）
loader, _ := env.New(cfg)
```

### 如何访问 JSON/YAML 的嵌套值？

JSON/YAML 的嵌套结构会被自动**扁平化**为下划线分隔的键名：

```json
{
  "database": {
    "host": "localhost",
    "port": 5432
  }
}
```

```text
存储为：DATABASE_HOST=localhost, DATABASE_PORT=5432
```

三种访问方式等价：

```go
host := env.GetString("DATABASE_HOST")  // 扁平化键名（推荐）
host := env.GetString("database.host")  // 点号路径
host := env.GetString("DATABASE.HOST")  // 大写点号路径
```

## 类型与泛型

### GetSlice 为什么是泛型函数而不是方法？

Go 不支持方法的类型参数。`GetSlice[T]` 必须是函数而非方法：

```go
// ❌ 方法方式 — 编译错误（Go 不支持）
// loader.GetSlice[int]("PORTS")

// ✅ 函数方式 — 可行
env.GetSliceFrom[int](loader, "PORTS")

// ✅ 包级函数
env.GetSlice[int]("PORTS")
```

### GetSlice 如何解析切片值？

按优先级搜索：

1. **索引键**（推荐）：`KEY_0`, `KEY_1`, `KEY_2`...
2. **逗号分隔**：`KEY=val1,val2,val3`

```bash
# 方式一：索引键
HOSTS_0=localhost
HOSTS_1=example.com

# 方式二：逗号分隔
HOSTS=localhost,example.com
```

```go
hosts := env.GetSlice[string]("HOSTS") // ["localhost", "example.com"]
```

### 支持哪些布尔值格式？

`GetBool` 不区分大小写，支持以下值：

| 真值 | 假值 |
|------|------|
| `true`, `1`, `yes`, `on`, `enabled` | `false`, `0`, `no`, `off`, `disabled` |

## 并发与线程安全

### 可以从多个 goroutine 同时调用 Get 吗？

**可以。** Loader 的所有方法都是线程安全的。库使用分片锁（sharded locks）优化高并发场景下的读写性能。

```go
// 安全的并发访问
var wg sync.WaitGroup
for i := 0; i < 100; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        _ = env.GetString("KEY") // 线程安全
    }()
}
wg.Wait()
```

### Loader.Close() 后调用 Get 会怎样？

返回零值，不 panic。Loader 在关闭后进入只读降级模式：

```go
loader, _ := env.New()
defer loader.Close()

val := loader.GetString("KEY") // 正常返回

// Close() 之后
val = loader.GetString("KEY")  // 返回 ""（零值）
err := loader.Set("KEY", "v")  // 返回 ErrClosed
```

## SecureValue

### Release 和 Close 有什么区别？

| 方法 | 清零内存 | 解锁内存 | 归还对象池 |
|------|:--------:|:--------:|:----------:|
| `Release()` | ✅ | ✅ | ✅ |
| `Close()` | ✅ | ✅ | ❌ |

**推荐使用 `Release()`**，它将对象归还到对象池，减少 GC 压力。`Close()` 适用于不需要池化的场景。

### SecureValue 被 GC 回收时会自动清零吗？

**会。** SecureValue 设置了 finalizer，在垃圾回收时自动清零内存。但建议显式调用 `Release()` 或 `Close()` 以确保及时清理，不要依赖 GC 的不确定时机。

```go
// ✅ 推荐：显式释放
sv := env.GetSecure("API_KEY")
defer sv.Release()

// ⚠️ 依赖 GC — 不推荐但安全
sv := env.GetSecure("API_KEY")
// 最终会被 GC 清零，但时机不确定
```

### 如何安全地记录日志？

使用 `Masked()` 或掩码工具函数，切勿直接输出 `Reveal()` 的值：

```go
sv := env.GetSecure("API_KEY")
defer sv.Release()

// ✅ 安全 — 掩码输出
log.Printf("API Key: %s", sv.Masked())    // [SECURE:32 bytes locked]
log.Printf("API Key: %s", sv)              // 同上（String() 返回 Masked()）

// ✅ 安全 — 掩码工具
masked := env.MaskValue("API_KEY", "sk-xxx") // [MASKED]（敏感键 → 固定掩码）
clean := env.SanitizeForLog(logMessage)       // 自动检测并掩码

// ❌ 危险 — 明文泄露
plaintext := sv.Reveal()
log.Printf("API Key: %s", plaintext) // 不要这样做
```

## 配置与验证

### 如何只加载特定前缀的变量？

使用 `Prefix` 字段过滤：

```go
cfg := env.DefaultConfig()
cfg.Prefix = "MYAPP_"  // 只加载 MYAPP_ 开头的变量
loader, _ := env.New(cfg)
loader.LoadFiles(".env")
```

```bash
# .env 文件内容
MYAPP_HOST=localhost    # ✅ 加载
MYAPP_PORT=8080         # ✅ 加载
OTHER_KEY=value         # ❌ 忽略（无 MYAPP_ 前缀）
```

### 如何防止配置覆盖？

`OverwriteExisting` 控制是否覆盖已存在的变量：

```go
// 默认：不覆盖（安全）
cfg := env.DefaultConfig()
cfg.OverwriteExisting = false

// 开发环境：允许覆盖
cfg := env.DevelopmentConfig()
// OverwriteExisting = true
```

### RequiredKeys 验证什么时候执行？

仅在显式调用 `Validate()` 时检查，不在加载时自动触发：

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
loader, _ := env.New(cfg)
loader.LoadFiles(".env")

// 显式验证
if err := loader.Validate(); err != nil {
    if errors.Is(err, env.ErrMissingRequired) {
        log.Fatal("缺少必需的环境变量")
    }
}
```

## 测试

### 如何在测试中隔离环境？

使用 `TestingConfig()` + 独立 Loader 实例：

```go
func TestConfig(t *testing.T) {
    cfg := env.TestingConfig()
    cfg.OverwriteExisting = true

    loader, err := env.New(cfg)
    if err != nil {
        t.Fatal(err)
    }
    defer loader.Close()

    // 每个测试独立，互不影响
    loader.Set("KEY", "test-value")
    val := loader.GetString("KEY")
    // 测试...
}
```

### 全局模式测试如何重置？

使用 `ResetDefaultLoader()`：

```go
func TestGlobalMode(t *testing.T) {
    // 清理上一个测试的状态
    env.ResetDefaultLoader()
    defer env.ResetDefaultLoader()

    env.Load(".env.test")
    // 测试...
}
```

::: tip 完整测试指南
详见 [测试场景](../guides/testing) 指南。
:::

## 安全与生命周期

### Close 后进程环境里的变量还在吗？

**在。** `Close()` 只清零内存副本，不 unset 此前应用到 `os.Environ` 的变量（这是刻意设计：进程环境可能已被子进程继承，回滚语义不可靠）。需要移除时在关闭前逐键 `Delete`——只有本 loader 写入的键才会被 unset。

### 如何防止配置文件读取进程中的机密？

配置文件来自不可信来源（用户上传、外部下发）时，若展开作用域允许 `${VAR}` 回退读取进程环境，存在机密被捕获进变量值的风险。`DefaultConfig()` 默认已是文件内作用域（`ExpansionFileOnly`），阻断该回退；此处显式声明仅作说明：

<!-- check-code: skip -->
```go
cfg := env.DefaultConfig()
cfg.ExpansionScope = env.ExpansionFileOnly // ${VAR} 仅解析文件内变量（默认已如此）
```

详见[变量展开 · 展开作用域](../guides/variable-expansion)。

### 值里的 `$` 读回来为什么变了？

默认开启变量展开时，`$VAR`/`${VAR}` 序列在加载期会被展开。若值本身含有美元符字面量（价格、模板字符串），请用 `cfg.ExpandVariables = false` 加载，或参见[序列化 · 往返陷阱](../guides/serialization)了解 `Marshal` 输出再读回的同类问题。

## 相关文档

- [快速开始](../getting-started/) — 5 分钟入门
- [速查表](../getting-started/cheatsheet) — 高频代码片段
- [错误处理](../guides/error-handling) — 哨兵错误与恢复策略
- [文件格式](./file-format) — .env/JSON/YAML 语法
