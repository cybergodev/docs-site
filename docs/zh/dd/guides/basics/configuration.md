---
sidebar_label: "配置详解"
title: "配置详解 - CyberGo DD | Config 结构体与预设方案"
description: "CyberGo DD 配置体系详解：DefaultConfig、DevelopmentConfig、JSONConfig、ProductionConfig 四种预设方案，Config 结构体全字段说明，多输出目标配置、JSON 格式定制与 Clone 深拷贝用法。"
sidebar_position: 2
---

# 配置详解

> 📖 **使用教程** · 完整 API 签名见 [配置 - Config 详解](../../api-reference/core/config)

DD 使用结构体配置（`Config`），支持 IDE 自动补全，无需链式调用或选项函数。本文覆盖全部配置字段和常见组合方案。

## 四种预设方案

| 预设 | 级别 | 格式 | 安全过滤 | 典型场景 |
|------|------|------|:--------:|----------|
| `DefaultConfig()` | Info | Text | ✅ 基础 | 生产默认 |
| `DevelopmentConfig()` | Debug | Text（简时间） | ✅ 基础 | 本地开发 |
| `JSONConfig()` | Debug | JSON（RFC3339） | ✅ 基础 | 日志聚合系统 |
| `ProductionConfig()` | Info | JSON（RFC3339） | ✅ 基础 | 生产环境（JSON 输出） |

:::warning 安全过滤默认开启
四种预设**均启用**基础敏感数据过滤（密码、API Key、信用卡号等）。即使开发模式也不关闭——以便尽早发现意外的敏感信息泄露。如需关闭，显式设置 `Security: &dd.SecurityConfig{}` 或使用 `SecurityLevelDevelopment`。
:::

## Config 全字段速览

```go
type Config struct {
    // ─── 基础 ───
    Level         LogLevel     // 日志级别（LevelDebug ~ LevelFatal）
    Format        LogFormat    // 输出格式（FormatText / FormatJSON）
    TimeFormat    string       // 时间格式（默认 ISO 8601）
    IncludeTime   bool         // 是否输出时间戳
    IncludeLevel  bool         // 是否输出日志级别

    // ─── 调用者信息 ───
    DynamicCaller bool         // 动态调用者检测（文件名:行号）
    FullPath      bool         // 使用完整文件路径（默认仅文件名）

    // ─── 输出目标 ───
    Targets       []OutputTarget // 输出目标列表（ConsoleOutput/FileOutput/CustomOutput）

    // ─── 格式定制 ───
    JSON          *JSONOptions // JSON 格式选项（字段名、缩进等）

    // ─── 安全 ───
    Security      *SecurityConfig       // 安全配置（过滤、速率限制）
    FieldValidation *FieldValidationConfig // 字段键命名校验

    // ─── 生命周期 ───
    FatalHandler      FatalHandler      // Fatal 时的自定义处理
    WriteErrorHandler WriteErrorHandler // 写入错误的回调
    LevelResolver     LevelResolver     // 动态级别解析（每次日志与级别判断时调用，nil 禁用）

    // ─── 扩展 ───
    ContextExtractors []ContextExtractor // Context 字段提取器
    Hooks             *HookRegistry      // 生命周期钩子
    Sampling          *SamplingConfig    // 日志采样

    // ─── 审计 ───
    Audit             *AuditConfig       // 安全审计日志
}
```

## 输出目标配置

使用 `ConsoleOutput()`、`FileOutput()`、`CustomOutput()` 构造输出目标：

```go
package main

import (
	"log"
	"os"
	"time"

	"github.com/cybergodev/dd"
)

func main() {
	cfg := dd.DefaultConfig()
	cfg.Targets = []dd.OutputTarget{
		dd.ConsoleOutput(),            // 控制台
		dd.FileOutput("logs/app.log"), // 文件（默认 100MB/10备份/30天）
		dd.CustomOutput(os.Stderr),    // 自定义 Writer
	}

	// 自定义文件轮换参数
	fileTarget := dd.FileOutput("logs/app.log")
	fileTarget.MaxSizeMB = 50              // 50MB 轮换
	fileTarget.MaxBackups = 5              // 保留 5 个备份
	fileTarget.MaxAge = 7 * 24 * time.Hour // 保留 7 天（MaxAge 是 time.Duration，必须带单位）

	logger, err := dd.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer logger.Close()
}
```

:::tip 零值 Config 陷阱
直接用 `dd.Config{Targets: ...}` 字面量会缺失时间戳、级别和调用者信息。始终以 `dd.DefaultConfig()` 为基础再修改字段。
:::

## JSON 格式定制

```go
cfg := dd.JSONConfig()

// 自定义 JSON 字段名
cfg.JSON = &dd.JSONOptions{
    PrettyPrint: true,
    Indent:      "  ",
    FieldNames: &dd.JSONFieldNames{
        Timestamp: "@timestamp",
        Level:     "severity",
        Message:   "msg",
        Caller:    "source",
        Fields:    "ctx",
    },
}
```

## 安全配置

```go
cfg := dd.DefaultConfig()

// 方案一：按安全等级（推荐）
cfg.Security = dd.SecurityConfigForLevel(dd.SecurityLevelStandard)

// 方案二：行业预设
cfg.Security = dd.HealthcareConfig()   // HIPAA
cfg.Security = dd.FinancialConfig()    // PCI-DSS
cfg.Security = dd.GovernmentConfig()   // 政府

// 方案三：自定义
cfg.Security = &dd.SecurityConfig{
    MaxMessageSize: 1024 * 1024, // 1MB
    SensitiveFilter: dd.NewSensitiveDataFilter(),
}
```

详见 [敏感数据过滤](../security/sensitive-filtering) 和 [安全概述](../security/)。

## 字段验证

```go
cfg := dd.DefaultConfig()
cfg.FieldValidation = dd.StrictSnakeCaseConfig()
// 所有字段键必须为 snake_case，否则向 stderr 输出诊断（字段仍会正常记录，日志方法不返回错误）
```

详见 [字段验证](../security/field-validation)。

## 日志采样

```go
cfg := dd.DefaultConfig()
cfg.Sampling = &dd.SamplingConfig{
    Enabled:    true,
    Initial:    100,            // 前 100 条始终记录
    Thereafter: 10,             // 之后每 10 条记录 1 条
    Tick:       time.Second,    // 每秒重置计数器
}
```

详见 [日志采样](../operations/sampling)。

## 钩子与审计

```go
// 钩子
registry := dd.NewHooksFromConfig(dd.HooksConfig{
    AfterLog: []dd.Hook{func(ctx context.Context, hc *dd.HookContext) error {
        // 发送到 metrics 系统
        return nil
    }},
})
cfg.Hooks = registry

// 审计
cfg.Audit = &dd.AuditConfig{
    Enabled:     true,
    Output:      auditFile,
    JSONFormat:  true,
    MinimumSeverity: dd.AuditSeverityWarning,
}
```

详见 [钩子系统](../operations/hooks) 和 [审计日志](../security/audit-logging)。

## Clone：配置深拷贝

`Clone()` 创建配置副本，便于基于同一基础派生不同配置：

```go
base := dd.DefaultConfig()
base.Format = dd.FormatJSON

// 派生 1：生产配置
prodCfg := base.Clone()
prodCfg.Level = dd.LevelInfo
prodCfg.Targets = []dd.OutputTarget{dd.FileOutput("logs/prod.log")}

// 派生 2：调试配置
debugCfg := base.Clone()
debugCfg.Level = dd.LevelDebug
debugCfg.Targets = []dd.OutputTarget{dd.ConsoleOutput()}

// base 未受影响
```

:::tip Clone 拷贝深度
深拷贝：JSON、Security、Hooks、Sampling、Audit、Targets 切片。浅拷贝：FatalHandler、WriteErrorHandler、FieldValidation（函数/指针共享）。ContextExtractors 切片拷贝但提取器实例共享。
:::

## 下一步

- [核心概念](./core-concepts) -- Logger 体系与处理管道
- [结构化日志](./structured-logging) -- 字段构造器与链式调用
- [API 参考 - 配置](../../api-reference/core/config) -- 完整字段文档
