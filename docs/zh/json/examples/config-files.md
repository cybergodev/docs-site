---
sidebar_label: "配置文件处理"
title: "配置文件处理 - CyberGo JSON | 读取、修改与保存"
description: "CyberGo JSON 配置文件实战：LoadFromFile 加载、GetString/GetInt 读取嵌套值、Set/SetCreate 修改、SaveToFile 搭配 PrettyConfig 格式化原子保存、MergeJSON 合并默认与用户配置，覆盖配置加载、修改、保存与重载验证的完整生命周期。"
sidebar_position: 20
---

# 配置文件处理

本文演示如何用 CyberGo JSON 处理典型的配置文件场景：加载、读取嵌套值、修改、保存，以及合并默认配置与用户配置。

## 配置文件的完整生命周期

加载配置 → 读取嵌套值 → 修改 → 保存回文件 → 重载验证。示例使用临时文件确保可独立运行。

```go
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/cybergodev/json"
)

func main() {
	// 使用临时目录确保示例可独立运行
	tmpDir, err := os.MkdirTemp("", "cybergo-config-*")
	if err != nil {
		panic(err)
	}
	defer os.RemoveAll(tmpDir)

	configPath := filepath.Join(tmpDir, "config.json")

	// 写入初始配置文件
	initial := `{
        "server": {"host": "0.0.0.0", "port": 8080},
        "database": {"host": "localhost", "port": 5432, "name": "appdb"},
        "logging": {"level": "info"}
    }`
	if err := os.WriteFile(configPath, []byte(initial), 0644); err != nil {
		panic(err)
	}

	// 1. 从文件加载配置
	data, err := json.LoadFromFile(configPath)
	if err != nil {
		panic(err)
	}

	// 2. 读取嵌套值（支持可选默认值参数）
	fmt.Printf("服务地址: %s:%d\n", json.GetString(data, "server.host"), json.GetInt(data, "server.port"))
	fmt.Printf("数据库: %s/%s\n", json.GetString(data, "database.host"), json.GetString(data, "database.name"))
	fmt.Printf("日志级别: %s\n", json.GetString(data, "logging.level", "info"))

	// 3. 修改配置（修改现有值）
	data, err = json.Set(data, "server.port", 9090)
	if err != nil {
		panic(err)
	}
	data, err = json.Set(data, "logging.level", "debug")
	if err != nil {
		panic(err)
	}

	// 4. 保存回文件（格式化输出）
	if err := json.SaveToFile(configPath, data, json.PrettyConfig()); err != nil {
		panic(err)
	}

	// 5. 重新加载验证修改已持久化
	reloaded, err := json.LoadFromFile(configPath)
	if err != nil {
		panic(err)
	}
	fmt.Printf("重启后端口: %d\n", json.GetInt(reloaded, "server.port"))
	fmt.Printf("重启后日志: %s\n", json.GetString(reloaded, "logging.level"))
}
```

## 合并默认配置与用户配置

实际应用中常需将用户配置覆盖到内置默认值上，再补全缺失的嵌套路径。`MergeJSON` 执行**深度合并**（用户值优先），`SetCreate` 会自动创建尚不存在的中间路径。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	// 默认配置（内置）
	defaults := `{
        "server": {"host": "0.0.0.0", "port": 8080, "timeout": 30},
        "database": {"host": "localhost", "port": 5432, "pool": 10},
        "logging": {"level": "info", "format": "json"}
    }`

	// 用户配置（覆盖部分字段）
	userConfig := `{
        "server": {"port": 3000},
        "database": {"host": "db.prod.example.com"},
        "logging": {"level": "debug"}
    }`

	// 深度合并：用户配置覆盖默认值，默认值中未被覆盖的字段保留
	merged, err := json.MergeJSON(defaults, userConfig)
	if err != nil {
		panic(err)
	}
	fmt.Printf("端口: %d（用户覆盖）\n", json.GetInt(merged, "server.port"))
	fmt.Printf("超时: %d（默认保留）\n", json.GetInt(merged, "server.timeout"))
	fmt.Printf("数据库: %s:%d\n", json.GetString(merged, "database.host"), json.GetInt(merged, "database.port"))

	// 用 SetCreate 添加尚不存在的嵌套路径（自动创建中间对象）
	merged, err = json.SetCreate(merged, "features.metrics.enabled", true)
	if err != nil {
		panic(err)
	}
	merged, err = json.SetCreate(merged, "features.metrics.endpoint", "/metrics")
	if err != nil {
		panic(err)
	}

	fmt.Printf("指标开关: %v\n", json.GetBool(merged, "features.metrics.enabled"))
	fmt.Printf("指标端点: %s\n", json.GetString(merged, "features.metrics.endpoint"))
}

// 输出：
// 端口: 3000（用户覆盖）
// 超时: 30（默认保留）
// 数据库: db.prod.example.com:5432
// 指标开关: true
// 指标端点: /metrics
```

:::tip 提示
`MergeJSON` 是深度递归合并：对象键逐层合并，数组和标量值直接替换。需要合并多个配置源时可用 `MergeMany([]string{...})` 一次性合并。
:::

## 合并模式选型：MergeUnion / MergeIntersection / MergeDifference

`Config.MergeMode` 控制合并策略，默认 `MergeUnion`（并集，用户值覆盖默认值）。另两种模式服务于不同的配置管理问题：

| 模式 | 语义 | 典型配置场景 |
|------|------|--------------|
| `MergeUnion`（默认） | 取两对象全集，冲突时用户值优先 | 常规配置叠加：默认值打底 + 用户覆盖 |
| `MergeIntersection` | 只保留两边共有的键（值取用户侧） | 提取「用户实际改写了哪些共享配置」；多环境配置求同 |
| `MergeDifference` | 只保留基准侧（第一个参数）独有的键 | 找出「仍在使用默认值的配置项」，用于审计或生成配置文档 |

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	// 与上一节相同的默认/用户配置
	defaults := `{
        "server": {"host": "0.0.0.0", "port": 8080, "timeout": 30},
        "database": {"host": "localhost", "port": 5432, "pool": 10},
        "logging": {"level": "info", "format": "json"}
    }`
	user := `{
        "server": {"port": 3000},
        "database": {"host": "db.prod.example.com"},
        "logging": {"level": "debug"}
    }`

	// 交集：只保留两边都出现的键（嵌套对象递归求交，标量取用户值）
	interCfg := json.DefaultConfig()
	interCfg.MergeMode = json.MergeIntersection
	overridden, err := json.MergeJSON(defaults, user, interCfg)
	if err != nil {
		panic(err)
	}
	fmt.Println("[交集] 用户覆盖的端口:", json.GetInt(overridden, "server.port"))
	fmt.Println("[交集] 用户覆盖的库主机:", json.GetString(overridden, "database.host"))
	// 输出：
	// [交集] 用户覆盖的端口: 3000
	// [交集] 用户覆盖的库主机: db.prod.example.com

	// 差集：只保留默认配置中未被用户覆盖的键
	diffCfg := json.DefaultConfig()
	diffCfg.MergeMode = json.MergeDifference
	untouched, err := json.MergeJSON(defaults, user, diffCfg)
	if err != nil {
		panic(err)
	}
	fmt.Println("[差集] 仍是默认值的主机:", json.GetString(untouched, "server.host"))
	fmt.Println("[差集] 仍是默认值的超时:", json.GetInt(untouched, "server.timeout"))
	fmt.Println("[差集] 仍是默认值的连接池:", json.GetInt(untouched, "database.pool"))
	// 输出：
	// [差集] 仍是默认值的主机: 0.0.0.0
	// [差集] 仍是默认值的超时: 30
	// [差集] 仍是默认值的连接池: 10
}
```

:::tip 提示
`MergeMany` 同样读取 `cfg.MergeMode`（从左到右逐个合并）。并集模式的完整效果见上一节；两种非默认模式都是「以第一个参数为基准」视角：交集回答「改了什么」，差集回答「还有什么没改」。
:::

## 下一步

- [基础示例](./index) — 路径查询、修改、结构体编解码等基础用法
- [速查表](../getting-started/cheatsheet) — API 快速参考
- [路径表达式语法](../getting-started/path-syntax) — 完整路径语法（含切片、通配符）
- [辅助函数](../api-reference/helpers) — `MergeJSON`、`CompareJSON` 等工具函数
