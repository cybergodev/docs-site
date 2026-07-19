---
sidebar_label: "输出目标"
title: "输出目标 - CyberGo DD | FileWriter、BufferedWriter、MultiWriter"
description: "CyberGo DD 输出目标 API：FileWriter 按文件大小自动轮换并按时间清理旧备份、BufferedWriter 高性能缓冲写入（可配置缓冲区与刷新间隔）与 MultiWriter 多目标并行输出，满足从开发到生产的各类日志输出场景需求，助力构建可靠的日志系统。"
sidebar_position: 1
---

# 输出目标

DD 提供 3 种输出写入器，支持文件轮换、缓冲写入和多目标输出。

## FileWriter

带自动轮换的文件写入器。

### 创建

```go
func NewFileWriter(path string, cfg FileWriterConfig) (*FileWriter, error)
```

路径会经内部路径安全校验（路径遍历、null 字节、overlong UTF-8），随后 `cfg.Validate()` 校验数量上限，再对零/负值回退默认配置。返回错误的情况：

- 路径类：`ErrEmptyFilePath` / `ErrNullByte` / `ErrPathTooLong`（>4096 字节）/ `ErrPathTraversal` / `ErrInvalidPath` / `ErrOverlongEncoding`
- 配置类：`ErrMaxSizeExceeded`（`MaxSizeMB > 10240`）/ `ErrMaxBackupsExceeded`（`MaxBackups > 1000`）
- I/O 类：目录创建失败（包装为 `failed to create directory: …`）或文件打开失败（包装为 `failed to open file …: %w`，包含 `ErrSymlinkNotAllowed` / `ErrHardlinkNotAllowed`）

<!-- check-code: skip -->
```go
// 使用默认配置
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 自定义配置
cfg := dd.DefaultFileWriterConfig()
cfg.MaxSizeMB = 50
fw, _ = dd.NewFileWriter("logs/app.log", cfg)
```

### FileWriterConfig

文件写入器配置。

```go
type FileWriterConfig struct {
    MaxSizeMB  int            // 文件大小上限 MB（默认 100）
    MaxAge     time.Duration  // 旧文件保留时长（默认 30 天）
    MaxBackups int            // 保留备份数量（默认 10）
    Compress   bool           // 是否 gzip 压缩（默认 false）
}
```

### 默认配置

```go
func DefaultFileWriterConfig() FileWriterConfig
```

默认值：100MB 大小限制、30 天保留、10 个备份文件。

### Validate

```go
func (c FileWriterConfig) Validate() error
```

验证文件写入器配置的合法性。返回错误的情况：

- `MaxSizeMB` 超过 10240（返回 `ErrMaxSizeExceeded`）
- `MaxBackups` 超过 1000（返回 `ErrMaxBackupsExceeded`）

负数值不会触发 Validate 错误；其中零或负值的 `MaxSizeMB` 会在应用默认值时回退到 100MB，而 `MaxBackups` / `MaxAge` 的负值保持原样（详见下方「默认值应用规则」）。

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | 写入数据（实现 `io.Writer`）；写入前检查大小触发轮换，已关闭返回 `os.ErrClosed` |
| `SetOnRotateCallback` | `(fn func(path string))` | 设置文件轮换成功后的回调 |
| `Close` | `() error` | 停止清理 goroutine 并关闭底层文件；多次调用安全（CAS 守卫） |

### 轮换回调

```go
func (fw *FileWriter) SetOnRotateCallback(fn func(path string))
```

设置一个在文件轮换**成功后**调用的回调函数。回调参数 `path` 为当前日志文件的基准路径（`NewFileWriter` 构造时经路径规范化后存储的路径——对绝对路径输入通常等于入参，对相对路径会被解析为绝对路径）：此时旧日志已被归档为备份文件，新文件已在该路径重新打开。设置时会取内部互斥锁以避免与正在进行的轮换竞争。

:::info 内部用途
该方法主要供 `Logger` 内部使用——当 `FileWriter` 作为 Logger 的输出目标时，Logger 通过它触发 `HookOnRotate` 钩子事件（详见[钩子系统](../security-audit/hooks)）。普通用户通常无需手动调用；若需自定义轮换后的行为，也可直接设置。
:::

<!-- check-code: skip -->
```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 设置轮换回调：每次轮换后打印当前文件路径
fw.SetOnRotateCallback(func(path string) {
    fmt.Println("日志已轮换，当前文件：", path)
})

// 当文件超过 MaxSizeMB 触发轮换后，回调被调用
fw.Write([]byte("日志内容\n"))
```

### 文件轮换与清理

FileWriter 的轮换与清理按两条独立路径运行：

- **轮换（rotation）**：在 `Write` 调用中检查当前文件大小，超过 `MaxSizeMB`（默认 100MB）时触发——旧文件重命名为备份、新文件以 `O_EXCL` 重新打开（防符号链接 TOCTOU），随后 `internal.RotateBackups` 按 `MaxBackups` 截断备份链，`Compress=true` 时由独立 goroutine 对备份做 gzip 压缩。
- **清理（cleanup）**：仅当 `MaxAge > 0` 且 `MaxBackups > 0` 时启动后台 goroutine，每小时扫描一次，调用 `internal.CleanupOldFiles` 删除超过 `MaxAge`（默认 30 天）的旧备份。

:::tip 默认值应用规则
零值或负值的 `MaxSizeMB` 一律回退到 100MB。`MaxAge`/`MaxBackups` 的组合规则：① 两者均为 0 → 启用完整默认（30 天 + 10 个，启动清理 goroutine）；② 仅设 `MaxBackups` → 仅按数量截断备份链，`MaxAge=0` 不启动清理 goroutine；③ 仅设 `MaxAge` → `MaxBackups` 回退到默认 10。
:::

<!-- check-code: skip -->
```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 写入时若超过 MaxSizeMB 会自动触发轮换
fw.Write([]byte("日志内容\n"))

// 轮换后生成文件：
// logs/app.log       (当前文件)
// logs/app_log_1.log (最新备份)
// logs/app_log_2.log (更早的备份)
// 启用 Compress 后旧备份会被异步压缩为 logs/app_log_1.log.gz
```

:::tip 安全特性
FileWriter 内置路径遍历、null 字节、符号链接、硬链接与 overlong UTF-8 防护；新文件以 `O_EXCL` 打开以防 TOCTOU 攻击。
:::

## BufferedWriter

带缓冲的写入器，减少系统调用次数。

### 创建

```go
func NewBufferedWriter(w io.Writer, cfg BufferedWriterConfig) (*BufferedWriter, error)
```

构造时先拒绝 `nil` 底层 writer（`ErrNilWriter`），再调用 `cfg.Validate()`，最后对 `BufferSize` 小于默认（1KB）的值钳制为默认值，对 `FlushTime <= 0` 钳制为 100ms。返回错误的情况：

- `ErrNilWriter`：`w == nil`
- `ErrBufferSizeTooLarge`：`BufferSize > 10MB`（由 `Validate` 返回）
- 配置非法：`BufferSize < 0` 或 `FlushTime < 0`（由 `Validate` 返回）

<!-- check-code: skip -->
```go
// 使用默认配置
bw, _ := dd.NewBufferedWriter(os.Stdout, dd.DefaultBufferedWriterConfig())

// 自定义配置
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 4096
bw, _ = dd.NewBufferedWriter(os.Stdout, cfg)
```

### BufferedWriterConfig

缓冲写入器配置。

```go
type BufferedWriterConfig struct {
    BufferSize int            // 缓冲区大小（字节，默认 1024 即 1KB，上限 10MB）
    FlushTime  time.Duration  // 定时刷新间隔（默认 100ms）
}
```

### 默认配置

```go
func DefaultBufferedWriterConfig() BufferedWriterConfig
```

默认值：1KB 缓冲区、100ms 刷新间隔。

### Validate

```go
func (c BufferedWriterConfig) Validate() error
```

验证缓冲写入器配置的合法性。返回错误的情况：

- `BufferSize` 为负数
- `BufferSize` 超过 10MB（返回 `ErrBufferSizeTooLarge`）
- `FlushTime` 为负数

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | 写入缓冲；当已缓冲字节 ≥ `BufferSize/2` 时自动 flush |
| `Flush` | `() error` | 显式刷新缓冲到底层 Writer |
| `Close` | `() error` | 先 flush 缓冲、停后台 goroutine，再关闭底层 Writer（若实现 `io.Closer`） |

后台 goroutine 以 `FlushTime` 为周期检查：仅当缓冲非空且距上次 flush ≥ `FlushTime` 时触发自动 flush。多次调用 `Close` 安全（CAS 守卫）；已关闭时 `Write` 返回 `os.ErrClosed`。

<!-- check-code: skip -->
```go
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 8192
bw, _ := dd.NewBufferedWriter(file, cfg)
bw.Write([]byte("日志行\n"))
_ = bw.Flush()      // 显式刷新到底层
defer bw.Close()    // Close 会先 Flush 再关闭底层 Writer
```

## MultiWriter

多写入器管理，同时写入多个目标。

### 创建

```go
func NewMultiWriter(writers ...io.Writer) *MultiWriter
```

`nil` writer 在构造时被静默忽略。返回值永不为 `nil`（构造不报错）。

<!-- check-code: skip -->
```go
mw := dd.NewMultiWriter(os.Stdout, fileWriter)
```

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | 写入所有目标（见下方错误策略） |
| `AddWriter` | `(w io.Writer) error` | 动态添加目标（重复 writer 静默接受） |
| `RemoveWriter` | `(w io.Writer) error` | 动态移除目标 |
| `Close` | `() error` | 关闭所有底层 `io.Closer`（标准流除外） |

`AddWriter` 返回错误的情况：`ErrNilMultiWriter`（接收者为 `nil`）/ `ErrNilWriter`（参数为 `nil`）/ `ErrMaxWritersExceeded`（已注册 ≥ 100 个）。
`RemoveWriter` 返回错误的情况：`ErrNilMultiWriter` / `ErrWriterNotFound`。

<!-- check-code: skip -->
```go
mw := dd.NewMultiWriter(console, file)

// 动态管理
_ = mw.AddWriter(anotherFile)
_ = mw.RemoveWriter(console)

// 关闭所有底层写入器（os.Stdout 等标准流不会被关闭）
_ = mw.Close()
```

### 错误类型

`Write` 失败时返回的错误由两个公开类型承载（定义在 `errors.go`）：

```go
// 单个 writer 的错误
type WriterError struct {
    Index  int       // 该 writer 在 MultiWriter 中的下标
    Writer io.Writer // 出错的 writer
    Err    error     // 底层错误
}

// 多 writer 错误聚合（Write 返回 *MultiWriterError）
type MultiWriterError struct {
    Errors []WriterError
}
```

两个类型的方法：

| 类型 | 方法 | 说明 |
|------|------|------|
| `*WriterError` | `Error() string` | 形如 `writer[i]: <err>`；`Err` 为 nil 时显示 unknown error |
| `*WriterError` | `Unwrap() error` | 返回 `Err`，供 `errors.Is` 链式匹配 |
| `*MultiWriterError` | `Error() string` | 单条错误直接返回；多条拼接为 `multiple writer errors: [...]` |
| `*MultiWriterError` | `Unwrap() []error` | 返回所有 `WriterError.Err`，供 `errors.As` / `errors.Is` |
| `*MultiWriterError` | `HasErrors() bool` | 是否收集到错误 |
| `*MultiWriterError` | `ErrorCount() int` | 错误数量 |
| `*MultiWriterError` | `FirstError() error` | 第一条错误（`*WriterError`），无则 `nil` |

### 错误策略

`Write` 采用「尽力写入」：单个 writer 失败不影响其他 writer。底层 writer 的错误汇集到 `MultiWriterError`，实现 `Unwrap() []error` 供 `errors.As`/`errors.Is` 使用。全部失败时返回 `(0, *MultiWriterError)`；部分失败时返回 `(pLen, *MultiWriterError)`；写入字节数不足记为 short write 错误。

:::warning 单 writer 优化
当底层仅有一个 writer 时，`Write` 走快路径直接转发，错误原样返回，不包装为 `MultiWriterError`。
:::

## 组合使用

```go
// 文件 + 缓冲 + 多目标
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
bw, _ := dd.NewBufferedWriter(fw, dd.DefaultBufferedWriterConfig())
mw := dd.NewMultiWriter(os.Stdout, bw)

logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.CustomOutput(mw)},
})
defer logger.Close()  // 自动刷新缓冲并关闭文件
```

## 下一步

- [配置](../core/config) -- Config 输出目标配置（OutputTarget）
- [Logger](../core/logger) -- AddWriter / RemoveWriter
- [安全过滤](../security-audit/security) -- 路径安全防护
