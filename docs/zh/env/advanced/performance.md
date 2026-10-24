---
sidebar_label: "性能优化"
title: "性能优化 - CyberGo env | 高并发读写调优"
description: "CyberGo env 性能优化指南：从 32 分片锁与无锁单键读的并发模型、sync.Pool 复用 SecureValue 降低对象分配，到 mlock 内存锁定的开销权衡、临界区耗时的规避与审计开销的取舍，附并发读写基准测试。"
sidebar_position: 1
---

# 性能优化

env 的性能模型建立在三件事上：32 分片存储把锁竞争分散到 32 个独立锁上，单键读走不加 loader 级互斥锁的快路径，`SecureValue` 经 `sync.Pool` 复用。以下各节给出机制、实测收益与调优开关。

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

库使用分片存储（Sharded Storage）减少锁竞争。全部变量分布在 32 个分片中：

```text
┌──────────────────────────────────────────────┐
│              Loader (32 shards)              │
├──────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐        ┌──────────┐ │
│  │ Shard 0 │ │ Shard 1 │  ...   │ Shard 31 │ │
│  │  Lock   │ │  Lock   │        │   Lock   │ │
│  │  Data   │ │  Data   │        │   Data   │ │
│  └─────────┘ └─────────┘        └──────────┘ │
└──────────────────────────────────────────────┘
```

- 键经 `internal.HashKey` 定位分片（短键用乘法哈希，长键用 FNV-1a 采样）
- 每个分片有独立锁
- 不同分片的读写完全并行，锁竞争被分散到 32 个锁上

## 对象池

### 为什么使用对象池

频繁创建和销毁对象会增加 GC 压力：

```text
无对象池：
创建对象 → 使用 → GC 回收 → 创建对象 → 使用 → GC 回收 ...

有对象池：
创建对象 → 使用 → 放回池 → 获取 → 使用 → 放回池 ...
```

### SecureValue 池

`SecureValue` 对象使用池化管理：

```go
// 获取 SecureValue（池中有空闲对象时复用，否则新建）
secret := env.GetSecure("API_KEY")

// 使用（Reveal 返回明文，String/Masked 返回掩码）
value := secret.Reveal()

// 归还对象池
secret.Release()  // 清零、解锁并放回池；Close() 只清零，不放回池
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
// 错误：持有已归还对象池的引用
var globalSecret *env.SecureValue

func init() {
    globalSecret = env.GetSecure("KEY")
    globalSecret.Release()  // 清零并归还 sync.Pool
}

func later() {
    // 危险：该对象可能已被其他 goroutine 从池中取走并写入别的值
    // globalSecret 现在读到的是别人的数据
}

// 正确：每次需要时获取
func getSecret() string {
    secret := env.GetSecure("KEY")
    defer secret.Close()
    return secret.Reveal()
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

内存锁定阻止敏感页被换出到磁盘，需在启动时显式开启：

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
| 其他平台（FreeBSD/其他 BSD、Solaris、WASM 等） | ❌ |

::: tip 详见
[SecureValue API - 内存锁定配置](../api-reference/secure-value#内存锁定配置) 获取完整配置说明。
:::

### 严格模式

`SetMemoryLockStrict(true)` 只改变失败是否可观测：锁定失败时默认静默（值仍可用），开启 strict 后失败会向 stderr 打出告警。`NewSecureValueStrict` 返回错误的条件是「已启用内存锁定且锁定失败」，与 strict 开关无关。

```go
env.SetMemoryLockEnabled(true)
env.SetMemoryLockStrict(true)

secret, err := env.NewSecureValueStrict("sensitive_data")
if err != nil {
    // 已启用内存锁定，但 mlock/VirtualLock 调用失败
}
```

启用锁定但失败时，`Masked()` 显示 `[SECURE:N bytes lock-failed]`。非 Linux/macOS/Windows 平台上 `IsMemoryLockSupported()` 返回 false，锁定调用按 no-op 降级。

### 安全清零

`SecureValue` 关闭时自动清零内存：

```go
secret := env.GetSecure("PASSWORD")
// 内部存储：['p', 'a', 's', 's', ...]

secret.Close()
// 内部存储：[0, 0, 0, 0, ...]
```

手动清零字节切片：

```go
sensitiveBytes := []byte("secret")
env.ClearBytes(sensitiveBytes)
// sensitiveBytes 现在全是 0
```

## 性能模式

### 初始化后只读

读多写少时开销最低：启动阶段加载配置并映射到结构体，运行阶段只读该结构体，完全不触碰 loader。

```go
var config *Config

func init() {
    if err := env.Load(".env"); err != nil {
        panic(err)
    }

    config = &Config{}
    if err := env.ParseInto(config); err != nil {
        panic(err)
    }
}

// 任意 goroutine 安全读取
func getValue() string {
    return config.Key
}
```

### 动态配置刷新

需要热更新配置时，用一个自带的 RWMutex 保护「加载」与「读取」的先后关系：

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

`GetString` 走无锁快路径，单次开销很小。真正会拖住调用方的是**调用方自己**的锁：若在自有互斥锁内先取值、再做耗时处理，整个处理期间别的 goroutine 都拿不到这把锁。取值放锁内、处理放到锁外：

```go
// 不推荐：耗时处理占着调用方的锁
func (s *Service) ProcessValue(key string) {
    s.mu.Lock()
    value := s.loader.GetString(key)
    processValue(value)  // 耗时操作期间锁一直被持有
    s.mu.Unlock()
}

// 推荐：锁内只取值，锁外处理
func (s *Service) ProcessValue(key string) {
    s.mu.Lock()
    value := s.loader.GetString(key)
    s.mu.Unlock()

    processValue(value)
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

单键读不加 loader 级锁，但每次调用仍要做键名解析。高频路径上把配置值缓存到局部变量或结构体：

```go
// 不推荐：每次请求都重新查找键
func Handler(w http.ResponseWriter, r *http.Request) {
    apiKey := env.GetString("API_KEY")  // 每次请求都走一遍键解析
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

内存锁定（Linux 的 `mlock` / Windows 的 `VirtualLock`）只在创建 `SecureValue` 时产生一次额外的 syscall 开销，读取操作（`Reveal` / `String` / `Masked`）没有差异。建议让 `SecureValue` 小而短命：用完立即 `Close()` / `Release()` 归还对象池，避免长期持有大块锁定内存。

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

### 写路径的持锁窗口

`Set`、`Delete`、`Apply`、`LoadFiles` 都要拿 loader 的写锁，彼此串行；只有 `OverwriteExisting = true` 且未启用 `AutoApply` 时，`Set` 才走读锁快路径。因此批量导入应一次加载整份文件，而不是循环 `Set`：

```go
// 不推荐：每个键单独拿一次写锁；AutoApply 下还要各做一次 Setenv
for key, value := range values {
    loader.Set(key, value)
}

// 推荐：写入文件后一次加载，整批只拿一次写锁
if err := loader.LoadFiles("batch.env"); err != nil {
    return err
}
```

`computeValue()` 这类慢计算写在 `Set` 的参数位置时，会在进入 `Set` 之前求值完毕，不占用 loader 的锁；真正需要留意的是**调用方自己的锁**，见上一节。

### Close 后的并发访问

`GetString` 不返回 `error`，因此在 `Close()` 之后调用只会得到空字符串，不会报错：

```go
loader, _ := env.New(cfg)

// 启动 goroutine
go func() {
    time.Sleep(1 * time.Second)
    loader.GetString("KEY")  // 返回空字符串（GetString 不返回 error）
}()

loader.Close()  // 主 goroutine 关闭
```

### 全局加载器重置

`ResetDefaultLoader` 并发安全，返回关闭旧 loader 的 `error`，应检查处理。仍建议仅在测试或启动阶段调用：重置后到下一次 `Load` 之前，包级函数处于未初始化状态（返回 `ErrNotInitialized`），运行中重置会让依赖全局加载器的代码撞上这一窗口。

```go
// 并发安全，但建议仅在测试或启动阶段调用；返回的 error 应处理
if err := env.ResetDefaultLoader(); err != nil {
    fmt.Printf("重置默认加载器失败: %v\n", err)
}
env.Load(".env")
```

## 内部并发实现深读

以下是从源码层面整理的并发优化手段，可用于评估与调优。文中的量化数字（23.6% 原子操作热点、终结器约占创建成本 60%）来自 v1.2.2/v1.2.3 的基准测试与性能剖析（见 CHANGES.md）。

### 分片存储（secureMap）

所有变量以 `SecureValue` 形式存储在 32 个分片中，键经 `internal.HashKey` 定位分片（短键用乘法哈希，长键用 FNV-1a 采样），每个分片持有独立 `sync.RWMutex`。不同分片的读写完全并行。

### 批量写入的分桶

`secureMap.SetAll`/`secureMap.SetAllIfAbsent`（文件加载路径）将整批键值按分桶一次平坦分配，随后**每个分片只加锁一次**完成整批写入。已存在的键原地更新（复用 `SecureValue` 对象），省去对象池往返与额外分配。

### 读路径的锁优化

- **单键读取无锁化**：`Lookup`/`GetSecure` 以原子闭态标志绕过 loader 级读锁。高并发下 RWMutex 自身的读者计数就是瓶颈
- **`secureMap.Has` 零分配**：仅原子读取 closed 标志，不复制值字符串
- **`Get` 免二次加锁**：分片读锁已保证 `SecureValue` 数据稳定，省去对象级读锁（该锁曾是剖析中 23.6% 的原子操作热点）
- **`Set` 快路径**：`OverwriteExisting=true` 且未开 `AutoApply` 时只需读锁，并发 `Set` 不在 loader 互斥锁上串行

### 对象池与终结器

`SecureValue` 经 `sync.Pool` 复用。GC 终结器在对象**首次创建**时设置一次（约占创建成本 60%），池化循环不再重复支付这笔成本。覆盖已有键时原地重置，进一步减少分配。

### 近似快照语义

`Len` 用原子计数器 O(1) 返回。`Keys`/`All` 以原子计数估算容量，再逐分片加读锁遍历。因此并发写入下返回的是**近似值**，遍历期间其他修改不保证可见。需要精确快照时，由调用方在外部加同步。

### 审计开销

审计启用后，加载路径多出 `time.Now` 与事件构造的开销；未启用时这些成本完全规避。高频写入的场景建议只在 `ProductionConfig` 下开启审计，或改用 `ChannelAuditHandler` 异步消费。

## 相关文档

- [SecureValue API](../api-reference/secure-value) - 安全值处理和内存锁定
- [Loader API](../api-reference/loader) - 加载器方法
- [测试场景](../guides/testing) - 基准测试示例
