---
sidebar_label: "安装"
title: "安装 - CyberGo DD | 环境要求与集成"
description: "CyberGo DD 日志库安装指南，涵盖 Go 版本要求、go get 安装、Go Module 集成、CI/CD 配置建议以及常见安装问题排查，帮助开发者快速将 DD 集成到项目中。"
sidebar_position: 1
---

# 安装

## 环境要求

| 要求 | 版本 |
|------|------|
| Go | ≥ 1.25 |
| 操作系统 | Linux / macOS / Windows |

:::tip Go 版本说明
DD 使用了 Go 1.25 的部分特性。如果你的项目使用旧版 Go，请先升级工具链：`go env -w GOTOOLCHAIN=go1.25.0+auto`。
:::

## 快速安装

```bash
go get github.com/cybergodev/dd
```

## Go Module 集成

在你的项目根目录执行：

```bash
# 初始化模块（如果还没有 go.mod）
go mod init your-project

# 添加 DD 依赖
go get github.com/cybergodev/dd
```

导入包：

```go
import "github.com/cybergodev/dd"
```

验证安装：

```go
package main

import "github.com/cybergodev/dd"

func main() {
	dd.Info("DD 安装成功！")
}
```

## 版本管理

### 指定版本

```bash
# 安装特定版本
go get github.com/cybergodev/dd@v1.0.0

# 升级到最新版本
go get github.com/cybergodev/dd@latest
```

### 依赖管理

```bash
# 整理依赖（清理未使用的、添加缺失的）
go mod tidy

# 查看当前依赖版本
go list -m github.com/cybergodev/dd
```

## CI/CD 集成

在 GitHub Actions 中使用 DD：

```yaml
steps:
  - uses: actions/setup-go@v5
    with:
      go-version: '1.25'
  - uses: actions/checkout@v4
  - run: go mod download
  - run: go build ./...
```

:::warning 私有仓库
如果 DD 部署在私有 Git 服务器上，请配置 GOPRIVATE 环境变量：

```bash
go env -w GOPRIVATE=github.com/cybergodev/*
```
:::

## 常见问题

### `go get` 报错 `module not found`

确认 Go 版本 ≥ 1.25，并检查网络代理设置：

```bash
go env -w GOPROXY=https://goproxy.cn,direct
```

### 编译报错 `undefined: dd.xxx`

执行 `go mod tidy` 同步依赖，然后重新编译。

## 下一步

- [快速开始](./) -- 5 分钟入门指南
- [全局 Logger](./global-logger) -- 包级便捷函数使用模式
- [核心概念](../guides/basics/core-concepts) -- 理解 DD 架构
