---
sidebar_label: "文件输出与轮换"
title: "文件输出与轮换 - CyberGo DD | 文件日志配置指南"
description: "CyberGo DD 文件输出与日志轮换配置指南，涵盖 FileWriter 大小轮换与时间清理策略、BufferedWriter 缓冲写入优化、MultiWriter 多目标分发、动态 Writer 管理以及生产环境最佳实践，帮助开发者构建高可靠性的文件日志系统。"
sidebar_position: 3
---

# 文件输出与轮换

DD 提供灵活的文件输出能力，支持自动轮换、缓冲写入和多目标分发，适合生产环境使用。

## 快速开始

### 基本文件输出

```go
package main

import (
    "log"

    "github.com/cybergodev/dd"
)

func main() {
    logger, err := dd.New(dd.Config{
        Targets: []dd.OutputTarget{
            dd.FileOutput("logs/app.log"),
        },
    })
    if err != nil {
        log.Fatal(err)
    }
    defer logger.Close()

    logger.Info("日志将写入文件") // 日志将写入 logs/app.log
}
```

### 控制台 + 文件双输出

```go
logger, err := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

## FileWriter 轮换配置

FileWriter 支持按大小自动轮换，按时间清理旧文件：

### 默认配置

```go
cfg := dd.DefaultFileWriterConfig()
// MaxSizeMB:   100   — 单文件最大 100MB
// MaxAge:      30 * 24 * time.Hour  — 保留 30 天
// MaxBackups:  10    — 最多保留 10 个备份
// Compress:    false — 不压缩
```

### 自定义轮换策略

```go
// 高流量服务：小文件、快速轮换
fwCfg := dd.DefaultFileWriterConfig()
fwCfg.MaxSizeMB = 50                // 50MB 轮换
fwCfg.MaxBackups = 20               // 保留 20 个备份
fwCfg.MaxAge = 7 * 24 * time.Hour   // 7 天清理
fwCfg.Compress = true      // 压缩旧文件

fw, err := dd.NewFileWriter("logs/app.log", fwCfg)
if err != nil {
    log.Fatal(err)
}
logger, err := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(fw)},
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### JSON 格式日志文件

```go
logger, err := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.json"),
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

轮换后的文件命名规则：

```text
logs/app.log           ← 当前日志
logs/app_log_1.log     ← 第一次轮换（最新的备份）
logs/app_log_2.log     ← 更早的备份
logs/app_log_1.log.gz  ← 启用 Compress 后旧备份会被压缩为 .gz
```

:::info 压缩与备份不并存
启用 `Compress` 后，压缩在轮换之后由单独 goroutine 异步进行；压缩完成时原 `.log` 备份会被**重命名**为 `.log.gz`，二者不会并存。
:::

## BufferedWriter 缓冲写入

在高吞吐场景下，使用 `BufferedWriter` 减少 I/O 次数：

```go
// 创建文件 Writer
fw, err := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
if err != nil {
    log.Fatal(err)
}

// 包装为缓冲 Writer
bwCfg := dd.DefaultBufferedWriterConfig()
// BufferSize: 1024  — 1KB 缓冲
// FlushTime:  100ms — 100ms 自动刷新

bw, err := dd.NewBufferedWriter(fw, bwCfg)
if err != nil {
    log.Fatal(err)
}

logger, err := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(bw)},
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close() // Close 时自动 Flush
```

### 调优建议

| 场景 | BufferSize | FlushTime | 说明 |
|------|-----------|-----------|------|
| 低延迟要求 | 512 | 50ms | 快速刷新，减少延迟 |
| 通用场景 | 1024 | 100ms | 默认值，平衡延迟与吞吐 |
| 高吞吐量 | 4096 | 500ms | 大缓冲，最大化吞吐 |
| 批处理任务 | 8192 | 1000ms | 最大缓冲，适合离线处理 |

:::warning 数据安全
BufferedWriter 在缓冲区半满（达 BufferSize/2）或定时器触发时刷新。程序异常退出可能导致缓冲区中的数据丢失。确保调用 `Close()` 或 `Flush()` 以保证数据完整。
:::

## MultiWriter 多目标分发

```go
// 同时写入文件和远程服务
fw, err := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
if err != nil {
    log.Fatal(err)
}
remote := &RemoteLogWriter{endpoint: "http://log-service/ingest"}

mw := dd.NewMultiWriter(fw, remote)

logger, err := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(mw)},
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

MultiWriter 将日志分发到所有 Writer，某个 Writer 失败不影响其他 Writer。

## 动态 Writer 管理

Logger 支持运行时添加和移除 Writer：

```go
// 运行时添加 Writer
fw, err := dd.NewFileWriter("logs/debug.log", dd.DefaultFileWriterConfig())
if err != nil {
    log.Fatal(err)
}
err = logger.AddWriter(fw)

// 运行时移除 Writer
err = logger.RemoveWriter(fw)

// 查询当前 Writer 数量
count := logger.WriterCount()
_ = count
```

:::tip 使用场景
动态 Writer 适合需要在运行时切换日志目标的场景，如：调试模式开启时添加详细日志文件，或磁盘空间不足时切换到远程日志服务。
:::

## 自定义 Writer

实现 `io.Writer` 接口即可创建自定义输出目标：

```go
// 网络日志发送器
type LogstashWriter struct {
    endpoint string
    client   *http.Client
}

func (w *LogstashWriter) Write(p []byte) (n int, err error) {
    resp, err := w.client.Post(w.endpoint, "application/json", bytes.NewReader(p))
    if err != nil {
        return 0, err
    }
    defer resp.Body.Close()
    return len(p), nil
}

// 使用自定义 Writer
logger, err := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.json"),
        dd.CustomOutput(&LogstashWriter{
            endpoint: "http://logstash:5044",
            client:   &http.Client{Timeout: 5 * time.Second},
        }),
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

## 生产环境推荐配置

```go
func NewProductionLogger() (*dd.Logger, error) {
    // 文件 Writer：中等轮换 + 压缩
    fwCfg := dd.DefaultFileWriterConfig()
    fwCfg.MaxSizeMB = 100
    fwCfg.MaxAge = 30 * 24 * time.Hour
    fwCfg.MaxBackups = 15
    fwCfg.Compress = true

    fw, err := dd.NewFileWriter("logs/app.json", fwCfg)
    if err != nil {
        return nil, err
    }

    // 缓冲包装
    bw, err := dd.NewBufferedWriter(fw, dd.DefaultBufferedWriterConfig())
    if err != nil {
        return nil, err
    }

    return dd.New(dd.Config{
        Level:  dd.LevelInfo,
        Format: dd.FormatJSON,
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.CustomOutput(bw),
        },
    })
}
```

## 下一步

- [结构化日志](./structured-logging) -- 字段与链式调用
- [敏感数据过滤](./sensitive-filtering) -- 自动脱敏
- [API 参考 - Writers](../api-reference/output-integration/writers) -- Writer 完整 API
- [性能优化](../advanced/performance) -- 性能调优建议
