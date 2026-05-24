---
title: "输出目标 - CyberGo DD | FileWriter、BufferedWriter、MultiWriter"
description: "CyberGo DD 输出目标完整 API 文档，包括 FileWriter 文件自动轮换（支持按大小和时间轮换）、BufferedWriter 高性能缓冲写入（可配置缓冲区大小和刷新间隔）和 MultiWriter 多目标并行输出，满足从开发调试到生产部署的各类日志输出场景需求。"
---

# 输出目标

DD 提供 3 种输出写入器，支持文件轮换、缓冲写入和多目标输出。

## FileWriter

带自动轮换的文件写入器。

### 创建

```go
func NewFileWriter(path string, cfg FileWriterConfig) (*FileWriter, error)
```

```go
// 使用默认配置
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 自定义配置
cfg := dd.DefaultFileWriterConfig()
cfg.MaxSizeMB = 50
fw, _ := dd.NewFileWriter("logs/app.log", cfg)
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

验证文件写入器配置的合法性。

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | 写入数据（实现 io.Writer） |
| `Close` | `() error` | 关闭文件写入器 |

### 文件轮换

FileWriter 支持按以下条件自动轮换：

- 文件大小超过限制（默认 100MB）
- 文件年龄超过最大保留天数（默认 30 天）
- 备份文件数量超过限制（默认 10 个）

```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 写入时自动轮换
fw.Write([]byte("日志内容\n"))

// 轮换后生成文件：
// logs/app.log      (当前)
// logs/app.log.1    (上一个备份)
// logs/app.log.2    (更早的备份)
```

:::tip 安全特性
FileWriter 内置路径遍历防护，拒绝 `..`、符号链接等不安全路径。
:::

## BufferedWriter

带缓冲的写入器，减少系统调用次数。

### 创建

```go
func NewBufferedWriter(w io.Writer, cfg BufferedWriterConfig) (*BufferedWriter, error)
```

```go
// 使用默认配置
bw, _ := dd.NewBufferedWriter(os.Stdout, dd.DefaultBufferedWriterConfig())

// 自定义配置
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 4096
bw, _ := dd.NewBufferedWriter(os.Stdout, cfg)
```

### BufferedWriterConfig

缓冲写入器配置。

```go
type BufferedWriterConfig struct {
    BufferSize int            // 缓冲区大小（字节，默认 1024 即 1KB）
    FlushTime  time.Duration  // 定时刷新间隔（默认 100ms）
}
```

### 默认配置

```go
func DefaultBufferedWriterConfig() BufferedWriterConfig
```

### Validate

```go
func (c BufferedWriterConfig) Validate() error
```

验证缓冲写入器配置的合法性。

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | 写入缓冲区 |
| `Flush` | `() error` | 刷新缓冲到底层 Writer |
| `Close` | `() error` | 刷新并关闭 |

```go
cfg := dd.DefaultBufferedWriterConfig()
cfg.BufferSize = 8192
bw, _ := dd.NewBufferedWriter(file, cfg)
bw.Write([]byte("日志行\n"))
bw.Flush()  // 确保写入磁盘
defer bw.Close()  // Close 自动 Flush
```

## MultiWriter

多写入器管理，同时写入多个目标。

### 创建

```go
func NewMultiWriter(writers ...io.Writer) *MultiWriter
```

```go
mw := dd.NewMultiWriter(os.Stdout, fileWriter)
```

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Write` | `(p []byte) (int, error)` | 写入所有目标 |
| `AddWriter` | `(w io.Writer) error` | 动态添加写入目标 |
| `RemoveWriter` | `(w io.Writer) error` | 动态移除写入目标 |
| `Close` | `() error` | 关闭所有写入器 |

```go
mw := dd.NewMultiWriter(console, file)

// 动态管理
mw.AddWriter(anotherFile)
mw.RemoveWriter(console)

// 关闭所有底层写入器
mw.Close()
```

:::warning 错误处理
MultiWriter 采用"尽力写入"策略：某个 Writer 失败不影响其他 Writer。错误通过 `MultiWriterError` 返回。
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

- [配置](./config) -- Config 输出目标配置（OutputTarget）
- [Logger](./logger) -- AddWriter / RemoveWriter
- [安全过滤](./security) -- 路径安全防护
