---
sidebar_label: "全局 Logger"
title: "全局 Logger - CyberGo DD | 默认日志记录器使用指南"
description: "CyberGo DD 全局 Logger 模式详解：Default() 懒初始化、SetDefault() 替换、InitDefault() 带错误处理的初始化方法，以及包级便捷函数 dd.Info() 与实例方法 logger.Info() 的选择策略。"
sidebar_position: 3
---

# 全局 Logger

DD 提供一个进程级的全局 Logger，所有**包级便捷函数**（`dd.Info()`、`dd.Errorf()` 等）都委托给它。这是最简单的使用方式——零配置即可开始记录日志。

## 两种使用模式对比

| 模式 | 代码示例 | 适用场景 |
|------|----------|----------|
| **全局 Logger** | `dd.Info("hello")` | 脚本、小型项目、快速原型 |
| **实例 Logger** | `logger, _ := dd.New(cfg); logger.Info("hello")` | 需要自定义配置、多 Logger 实例、依赖注入 |

全局 Logger 本质上就是一个由 `sync.Once` 保护的单例 `*Logger`，首次调用时自动创建。

## 包级便捷函数

所有标准日志方法都有对应的包级版本，直接操作全局 Logger：

```go
package main

import "github.com/cybergodev/dd"

func main() {
	// 基础日志
	dd.Debug("调试信息")
	dd.Info("服务启动")
	dd.Warn("内存使用率偏高")
	dd.Error("请求失败")
	// dd.Fatal("致命错误")  // ⚠️ 会调用 os.Exit(1)

	// 格式化
	username := "alice"
	dd.Infof("用户 %s 已登录", username)

	// 结构化日志
	dd.InfoWith("请求处理完成",
		dd.String("method", "GET"),
		dd.Int("status", 200),
	)

	// 字段链式传递
	dd.WithFields(dd.String("service", "api")).
		Info("服务就绪")

	// 级别控制
	dd.SetLevel(dd.LevelDebug)
	if dd.IsDebugEnabled() {
		dd.Debug("debug 已启用")
	}
}
```

:::tip 全部包级函数
基础（`Debug/Info/Warn/Error/Fatal`）、格式化（`Debugf/Infof/...`）、结构化（`DebugWith/InfoWith/...`）、通用级别（`Log/Logf/LogWith`）、字段链（`WithFields/WithField`）、级别查询（`IsLevelEnabled/IsDebugEnabled/...`）、采样（`SetSampling/GetSampling`）、输出管理（`AddWriter/RemoveWriter/WriterCount`）、生命周期（`Flush`）。
:::

## 全局 Logger 初始化

### Default()：懒初始化

`dd.Default()` 返回全局 Logger，首次调用时用 `DefaultConfig()` 自动创建：

```go
// 首次调用 → 自动创建（sync.Once 保证线程安全）
logger := dd.Default()
logger.Info("hello") // 等价于 dd.Info("hello")
```

### InitDefault()：自定义配置

在程序启动时用自定义配置初始化全局 Logger：

```go
package main

import (
	"log"

	"github.com/cybergodev/dd"
)

func main() {
	cfg := dd.DefaultConfig()
	cfg.Level = dd.LevelDebug
	cfg.Format = dd.FormatJSON

	if err := dd.InitDefault(cfg); err != nil {
		log.Fatalf("初始化日志失败: %v", err)
	}

	// 此后所有包级函数使用上述配置
	dd.Info("全局 Logger 已初始化")
}
```

:::warning InitDefault 会替换旧实例
如果全局 Logger 已存在（如已被 `Default()` 自动创建），`InitDefault()` 会**关闭旧实例**并替换为新实例。旧实例的关闭在后台 goroutine 中延迟执行（100ms），以等待进行中的写操作完成。
:::

### SetDefault()：直接替换

用已创建的 Logger 实例替换全局 Logger：

```go
logger, _ := dd.New(dd.DevelopmentConfig())
dd.SetDefault(logger)

// 此后包级函数使用新 Logger
dd.Info("使用自定义 Logger")
```

## 错误处理

全局 Logger 初始化失败时会自动降级为 stderr 输出（不会 panic）。通过以下函数检测初始化状态：

```go
logger := dd.Default()

if err := dd.DefaultInitError(); err != nil {
    // Logger 运行在降级模式（输出到 stderr）
    log.Printf("警告：全局 Logger 初始化失败: %v", err)
}

// 或者一次性获取 Logger 和错误
logger, err := dd.DefaultWithErr()
if err != nil {
    log.Printf("降级模式: %v", err)
}
```

## 与实例 Logger 的配合

全局 Logger 和实例 Logger 可以共存。常见模式是在 `main` 中初始化全局 Logger，同时在需要 DI 的地方使用接口：

```go
// main.go
func main() {
    cfg := dd.DefaultConfig()
    cfg.Format = dd.FormatJSON
    _ = dd.InitDefault(cfg)
    defer dd.Flush()
}

// service.go — 使用接口实现可测试性
type Service struct {
    logger dd.LogProvider // 接口，可 mock
}

func NewService(logger dd.LogProvider) *Service {
    return &Service{logger: logger}
}

// 使用全局 Logger 创建 Service
svc := NewService(dd.Default())
```

:::tip 依赖注入推荐接口
`dd.LogProvider` 是最完整的日志接口，适合依赖注入。更精简的接口：`dd.CoreLogger`（仅日志方法）、`dd.LevelLogger`（+ 级别管理）、`dd.ConfigurableLogger`（+ 配置与生命周期）。详见 [接口定义](../api-reference/core/interfaces)。
:::

## 下一步

- [配置详解](../guides/basics/configuration) -- Config 结构体全字段说明
- [速查表](./cheatsheet) -- 常用 API 速查
- [接口定义](../api-reference/core/interfaces) -- Logger 接口层次
