---
title: "性能优化 - CyberGo env | 高并发读写调优"
description: "CyberGo env 库性能优化与高并发调优指南，详解 sync.RWMutex 读写锁实现的并发安全访问、sync.Pool 对象池复用策略、mlock 内存锁定使用模式与性能影响、大文件流式解析处理技巧，附基准测试数据对比与 LimitsConfig 安全参数配置建议。"
---

# 性能优化

env 库针对高性能场景进行了优化。本文档介绍并发安全、对象池、内存管理等性能相关特性。

## 并发安全

### 线程安全保证

`Loader` 的所有方法都是线程安全的：

```go
loader, _ := env.New(env.DefaultConfig())
defer loader.Close()

var wg sync.WaitGroup

// 并发读取
for i := 0; i < 100; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        loader.GetString("KEY")
    }()
}

// 并发写入
for i := 0; i < 100; i++ {
    wg.Add(1)
    go func(n int) {
        defer wg.Done()
        loader.Set(fmt.Sprintf("KEY_%d", n), "value")
    }(i)
}

wg.Wait()
```

### 包级函数线程安全

包级函数使用全局加载器，同样是线程安全的：

```go
var wg sync.WaitGroup

for i := 0; i < 100; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        env.GetString("KEY", "default")
    }()
}

wg.Wait()
```

### 内部实现

库使用分片存储（Sharded Storage）减少锁竞争：

```text
┌─────────────────────────────────────────┐
│          Loader（8 个分片）               │
├─────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐    ┌────────┐ │
│  │ Shard 0 │ │ Shard 1 │... │ Shard 7│ │
│  │  Lock   │ │  Lock   │    │  Lock  │ │
│  │  Data   │ │  Data   │    │  Data  │ │
│  └─────────┘ └─────────┘    └────────┘ │
└─────────────────────────────────────────┘
```

- 键根据哈希值分配到不同分片
- 每个分片有独立锁
- 减少锁竞争，提高并发性能

## 对象池

### 为什么使用对象池

频繁创建和销毁对象会增加 GC 压力：

```text
无对象池：
创建对象 → 使用 → GC回收 → 创建对象 → 使用 → GC回收 ...

有对象池：
创建对象 → 使用 → 放回池 → 获取 → 使用 → 放回池 ...
```

### SecureValue 池

`SecureValue` 对象使用池化管理：

```go
// 获取 SecureValue（可能从池中复用）
secret := env.GetSecure("API_KEY")

// 使用
value := secret.String()

// 释放回池
secret.Close()  // 或 secret.Release()
```

### 正确使用对象池

**及时释放：**

```go
func processData() {
    secret := env.GetSecure("SECRET")
    defer secret.Close()  // 确保释放

    // 使用 secret...
}
```

**不要持有引用：**

```go
// 错误：持有已释放对象的引用
var globalSecret *env.SecureValue

func init() {
    globalSecret = env.GetSecure("KEY")
    globalSecret.Close()  // 释放后对象被复用
}

func later() {
    // 危险：globalSecret 可能已被其他代码使用
    globalSecret.String()
}

// 正确：每次需要时获取
func getSecret() string {
    secret := env.GetSecure("KEY")
    defer secret.Close()
    return secret.String()
}
```

**检查关闭状态：**

```go
secret := env.GetSecure("KEY")

// 使用前检查
if secret.IsClosed() {
    // 对象已关闭，不可使用
}

// 使用后关闭
secret.Close()

// 关闭后检查
if secret.IsClosed() {
    // 已关闭
}
```

## 内存安全

### 内存锁定

启用内存锁定防止敏感数据交换到磁盘：

```go
// 检查平台支持
if env.IsMemoryLockSupported() {
    env.SetMemoryLockEnabled(true)
}
```

**平台支持：**

| 平台 | 支持 |
|------|------|
| Linux | ✅ |
| macOS | ✅ |
| Windows | ✅ |
| FreeBSD | ✅ |
| wasm | ❌ |

::: tip 详见
[SecureValue API - 内存锁定配置](/zh/env/api-reference/secure-value#内存锁定配置) 获取完整配置说明。
:::

### 严格模式

严格模式下，内存锁定失败会导致错误：

```go
env.SetMemoryLockStrict(true)

secret, err := env.NewSecureValueStrict("sensitive_data")
if err != nil {
    // 内存锁定失败
}
```

### 安全清零

`SecureValue` 关闭时自动清零内存：

```go
secret := env.GetSecure("PASSWORD")
// 内部存储: ['p', 'a', 's', 's', ...]

secret.Close()
// 内部存储: [0, 0, 0, 0, ...]
```

手动清零字节切片：

```go
sensitiveBytes := []byte("secret")
env.ClearBytes(sensitiveBytes)
// sensitiveBytes 现在全是 0
```

## 性能模式

### 初始化后只读

最高效的模式：启动时加载配置，运行时只读：

```go
var config *Config

func init() {
    env.Load(".env")

    config = &Config{}
    env.ParseInto(config)
}

// 任意 goroutine 安全读取
func getValue() string {
    return config.Key
}
```

### 动态配置刷新

需要动态更新配置时的模式：

```go
type ConfigManager struct {
    loader *env.Loader
    mu     sync.RWMutex
}

func (m *ConfigManager) Refresh() error {
    m.mu.Lock()
    defer m.mu.Unlock()

    return m.loader.LoadFiles(".env")
}

func (m *ConfigManager) Get(key string) string {
    m.mu.RLock()
    defer m.mu.RUnlock()

    return m.loader.GetString(key)
}
```

### 减少锁持有时间

```go
// 不推荐：在锁内执行耗时操作
func (l *Loader) ProcessValue(key string) {
    value := l.GetString(key)
    // 耗时操作...
    processValue(value)
}

// 推荐：快速读取，锁外处理
func ProcessValue(key string) {
    value := loader.GetString(key)  // 快速获取
    go processValue(value)          // 异步处理
}
```

### 批量操作

```go
// 一次性获取所有需要的值
func LoadAllConfig(loader *env.Loader) *Config {
    return &Config{
        Host:    loader.GetString("HOST"),
        Port:    loader.GetInt("PORT"),
        Debug:   loader.GetBool("DEBUG"),
        Timeout: loader.GetDuration("TIMEOUT"),
    }
}
```

### 避免频繁调用

```go
// 不推荐：每次请求都读取
func Handler(w http.ResponseWriter, r *http.Request) {
    apiKey := env.GetString("API_KEY")  // 每次请求都加锁
    // ...
}

// 推荐：启动时缓存
var apiKey string

func init() {
    env.Load(".env")
    apiKey = env.GetString("API_KEY")
}

func Handler(w http.ResponseWriter, r *http.Request) {
    // 直接使用缓存值
    // ...
}
```

## 性能影响

### 对象池收益

| 操作 | 无池 | 有池 |
|------|------|------|
| 分配次数 | N | ~常数 |
| GC 压力 | 高 | 低 |
| 延迟 | 不稳定 | 稳定 |

### 内存锁定开销

| 操作 | 无锁定 | 有锁定 |
|------|--------|--------|
| 创建 | ~100ns | ~1μs |
| 读取 | ~10ns | ~10ns |

## 基准测试

### 读取性能

```go
func BenchmarkConcurrentRead(b *testing.B) {
    loader, _ := env.New(env.DefaultConfig())
    loader.Set("KEY", "value")

    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            loader.GetString("KEY")
        }
    })
}
```

### 写入性能

```go
func BenchmarkConcurrentWrite(b *testing.B) {
    loader, _ := env.New(env.DefaultConfig())

    var i int64
    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            n := atomic.AddInt64(&i, 1)
            loader.Set(fmt.Sprintf("KEY_%d", n), "value")
        }
    })
}
```

### 混合读写

```go
func BenchmarkMixedReadWrite(b *testing.B) {
    loader, _ := env.New(env.DefaultConfig())
    loader.Set("KEY", "value")

    b.RunParallel(func(pb *testing.PB) {
        i := 0
        for pb.Next() {
            if i%10 == 0 {
                loader.Set("KEY", "new_value")
            } else {
                loader.GetString("KEY")
            }
            i++
        }
    })
}
```

## 注意事项

### 避免在锁内阻塞

```go
// 危险：可能导致死锁
func (l *Loader) BadMethod() {
    // 锁内调用可能阻塞的操作
    l.Set("KEY", computeValue())  // computeValue 可能很慢
}

// 安全：先计算，再设置
func GoodMethod() {
    value := computeValue()  // 锁外计算
    loader.Set("KEY", value)  // 快速设置
}
```

### Close 后的并发访问

```go
loader, _ := env.New(cfg)

// 启动 goroutine
go func() {
    time.Sleep(1 * time.Second)
    loader.GetString("KEY")  // 可能返回 ErrClosed
}()

loader.Close()  // 主 goroutine 关闭
```

### 全局加载器重置

```go
// 并发不安全：不要在运行时调用
env.ResetDefaultLoader()

// 安全：仅在测试或启动时调用
func init() {
    env.ResetDefaultLoader()
    env.Load(".env")
}
```

## 相关文档

- [SecureValue API](/zh/env/api-reference/secure-value) - 安全值处理和内存锁定
- [Loader API](/zh/env/api-reference/loader) - 加载器方法
- [测试场景](/zh/env/guides/testing) - 基准测试示例
