---
sidebar_label: "安全概述"
title: "安全概述 - CyberGo env | 安全架构"
description: "CyberGo env 安全架构概览：SecureValue 的内存锁定与自动清零、键值验证过滤控制字符与空字节、DefaultForbiddenKeys 拦截 PATH 与 LD_PRELOAD、IsSensitiveKey 敏感键检测、日志脱敏工具与审计追踪。"
sidebar_position: 1
---

# 安全概述

env 的安全设计分三层：应用层的 `SecureValue` 负责内存锁定与清零，Loader 层做键/值验证并拦截禁止键，解析层限制展开作用域与文件路径。审计日志独立记录写操作，供合规与溯源使用。

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
| **SecureValue** | 敏感值内存保护、自动清零 | [SecureValue API](../api-reference/secure-value) |
| **禁止键** | 防止修改系统关键变量 | [常量与错误](../api-reference/constants#defaultforbiddenkeys) |
| **敏感键检测** | 自动识别敏感配置键，日志脱敏工具 | [敏感数据脱敏](./data-masking) |
| **值验证** | 检测控制字符、空字节等 | [Config API](../api-reference/config) |
| **审计日志** | 记录写操作与安全事件 | [组件工厂](../api-reference/factory#审计处理器工厂) |

## SecureValue 简介

对于敏感数据，使用 `GetSecure` 而非 `GetString`：

```go
// 不推荐
plainPassword := env.GetString("DB_PASSWORD")

// 推荐
secret := env.GetSecure("DB_PASSWORD")
defer secret.Release()       // 清零并归还对象池
password := secret.Reveal()  // 仅在需要明文时调用
```

**核心功能：**
- **内存锁定**：防止交换到磁盘，仅 Linux/macOS/Windows 支持；其余平台 `IsMemoryLockSupported()` 返回 false，锁定尝试失败、错误保存在该值上（`Masked()` 显示 `lock-failed`），`SecureValue` 仍可用
- **自动清零**：`Release()` / `Close()` 时安全擦除内存
- **掩码显示**：`Masked()` 用于日志输出
- **线程安全**：支持并发读取

::: tip 完整 API
详见 [SecureValue API](../api-reference/secure-value)。
:::

## 日志安全

`SecureValue` 保护的是**内存中**的敏感值。日志、错误信息和调试输出是另一条泄露路径，env 为此提供一组独立的脱敏工具函数，无需依赖 Loader：

- `IsSensitiveKey` 自动检测密码、密钥、令牌等敏感键名
- `MaskValue` / `MaskKey` 对值和键名脱敏后再输出
- `SanitizeForLog` 扫描日志字符串中的 `key=value` 与 `key: value` 模式并掩码值

```go
// 日志中安全输出配置，避免泄露明文
log.Printf("加载配置：%s", env.MaskValue("DB_PASSWORD", password))
// 输出：加载配置：[MASKED]

log.Printf("连接参数：%s", env.SanitizeForLog("user=admin password=s3cret"))
// 输出：连接参数：user=admin password=[MASKED]
```

::: tip 完整指南
脱敏工具的完整用法详见 [敏感数据脱敏](./data-masking)。
:::

## 键/值验证

### 键验证

默认键名须匹配 `^[A-Za-z][A-Za-z0-9_]*$`：

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
| Windows 系统 | `COMSPEC`, `PATHEXT`, `SYSTEMROOT`, `WINDIR` | 命令解释器/系统路径劫持 |

::: tip 完整列表
查看 [DefaultForbiddenKeys](../api-reference/constants#defaultforbiddenkeys) 获取完整禁止键列表。
:::

### 值验证

值校验分两层：一是内置验证器**始终执行**的基础校验（值长度上限、控制字符与空字节拒绝、`ValidateUTF8` 开启时的 UTF-8 检查），任何写入路径都绕不过；二是 `ValidateValues` 开关，只对未实现基础校验能力的自定义验证器起作用——关闭时这类验证器会完全跳过值校验。

```go
cfg := env.ProductionConfig()
cfg.ValidateValues = true // 自定义验证器无基础校验能力时才需要关注
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
| `DevelopmentConfig()` | 开发环境 | `OverwriteExisting=true`、允许 YAML 语法、文件上限放宽到 10 MB |
| `TestingConfig()` | 测试环境 | `OverwriteExisting=true`、`FailOnMissingFile=false`、文件上限 64 KB 与 50 个变量 |
| `ProductionConfig()` | 生产环境 | `FailOnMissingFile=true`、`OverwriteExisting=false`、开启值验证与审计 |

```go
// 生产环境推荐配置
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AllowedKeys = []string{"APP_NAME", "PORT", "DB_HOST", "API_KEY"}
```

## 展开作用域隔离

`DefaultConfig()` 默认把展开作用域设为 `ExpansionFileOnly`：变量展开只解析文件内引用，阻断对进程环境（云凭证、令牌等）的回退读取与捕获（SEC-03）。确实需要传统 dotenv 的「先文件、后进程」回退语义时，改设 `ExpansionScope: ExpansionFileThenProcess`。配置方式与攻击场景详见[变量展开 · 展开作用域](../guides/variable-expansion)。

## 相关文档

- [SecureValue API](../api-reference/secure-value) - 安全值处理完整 API
- [内存锁定](./memory-locking) - mlock 内存保护完整指南
- [常量与错误](../api-reference/constants) - 禁止键完整列表、敏感键模式
- [生产检查清单](./production-checklist) - 上线前安全检查
