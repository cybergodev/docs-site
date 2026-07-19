---
sidebar_label: "安全概述"
title: "安全概述 - CyberGo env | 安全架构"
description: "CyberGo env 安全架构概览，详解 SecureValue 内存锁定与自动清零、键值验证过滤控制字符与空字节、DefaultForbiddenKeys 禁止 PATH 与 LD_PRELOAD、IsSensitiveKey 自动检测、安全预设与审计追踪。"
sidebar_position: 1
---

# 安全概述

环境变量常存储敏感信息，安全处理至关重要。本文档概述 env 库的安全架构和核心特性。

## 安全架构

```text
┌──────────────────────────────────────────────────────────────┐
│                           应用层                              │
├──────────────────────────────────────────────────────────────┤
│   SecureValue   │    掩码    │    清零    │   内存锁定        │
├──────────────────────────────────────────────────────────────┤
│                          Loader 层                            │
├──────────────────────────────────────────────────────────────┤
│     键验证      │   值验证   │   禁止键   │   大小限制         │
├──────────────────────────────────────────────────────────────┤
│                           解析层                              │
├──────────────────────────────────────────────────────────────┤
│    格式检测     │  展开检查  │       路径验证                  │
└──────────────────────────────────────────────────────────────┘
```

## 核心安全特性

| 特性 | 说明 | 文档 |
|------|------|------|
| **SecureValue** | 敏感值内存保护、自动清零 | [SecureValue API](/zh/env/api-reference/secure-value) |
| **禁止键** | 防止修改系统关键变量 | [常量与错误](/zh/env/api-reference/constants#defaultforbiddenkeys) |
| **敏感键检测** | 自动识别敏感配置键 | [常量与错误](/zh/env/api-reference/constants#sensitivekeypatterns) |
| **值验证** | 检测控制字符、空字节等 | [Config API](/zh/env/api-reference/config) |
| **审计日志** | 完整操作追踪 | [组件工厂](/zh/env/api-reference/factory#审计处理器工厂) |

## SecureValue 简介

对于敏感数据，使用 `GetSecure` 而非 `GetString`：

```go
// 不推荐
password := env.GetString("DB_PASSWORD")

// 推荐
secret := env.GetSecure("DB_PASSWORD")
defer secret.Close()
password := secret.Reveal()  // 仅在需要明文时调用
```

**核心功能：**
- **内存锁定** - 防止交换到磁盘（Linux/macOS/Windows/FreeBSD）
- **自动清零** - `Close()` 时安全擦除内存
- **掩码显示** - `Masked()` 用于日志输出
- **线程安全** - 支持并发读取

::: tip 完整 API
详见 [SecureValue API](/zh/env/api-reference/secure-value)。
:::

## 键/值验证

### 键验证

默认键名规则：`^[A-Za-z][A-Za-z0-9_]*$`

- 以字母开头
- 只包含字母、数字、下划线
- 长度不超过 `MaxKeyLength`

### 禁止键

内置禁止键防止修改系统关键变量：

| 类别 | 示例 | 风险 |
|------|------|------|
| 系统路径 | `PATH`, `LD_LIBRARY_PATH` | 命令/库劫持 |
| 动态链接 | `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES` | 恶意库注入 |
| Shell | `SHELL`, `IFS`, `BASH_ENV` | Shell 劫持 |
| 语言运行时 | `PYTHONPATH`, `NODE_PATH` | 模块劫持 |

::: tip 完整列表
查看 [DefaultForbiddenKeys](/zh/env/api-reference/constants#defaultforbiddenkeys) 获取完整禁止键列表。
:::

### 值验证

启用值验证检测潜在危险：

```go
cfg := env.ProductionConfig()
cfg.ValidateValues = true  // 检测控制字符、空字节等
```

## 文件安全基础

### 文件权限

```bash
# 仅所有者可读写
chmod 600 .env

# 或更严格（只读）
chmod 400 .env
```

### Git 忽略

```bash
.env
.env.local
.env.*.local
*.pem
*.key
```

## 配置安全级别

| 预设 | 用途 | 特点 |
|------|------|------|
| `DevelopmentConfig()` | 开发环境 | 宽松限制、支持 YAML 语法 |
| `TestingConfig()` | 测试环境 | 覆盖已存在变量、测试隔离 |
| `ProductionConfig()` | 生产环境 | 严格验证 + 审计日志、不覆盖已存在变量 |

```go
// 生产环境推荐配置
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AllowedKeys = []string{"APP_NAME", "PORT", "DB_HOST", "API_KEY"}
```

## 相关文档

- [SecureValue API](/zh/env/api-reference/secure-value) - 安全值处理完整 API
- [常量与错误](/zh/env/api-reference/constants) - 禁止键完整列表、敏感键模式
- [生产检查清单](/zh/env/security/production-checklist) - 上线前安全检查
