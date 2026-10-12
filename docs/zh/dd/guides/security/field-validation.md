---
sidebar_label: "字段验证"
title: "字段验证 - CyberGo DD | 字段键命名规范与安全校验"
description: "CyberGo DD 字段验证功能详解：snake_case、camelCase、PascalCase、kebab-case 命名约定校验，三种验证模式（关闭/警告/严格），内置 Log4Shell 注入防护与同形异义字符检测。"
sidebar_position: 3
---

# 字段验证

> 📖 **使用教程** · 完整 API 签名见 [结构化字段 - Field 构造器](../../api-reference/core/fields)

DD 的字段验证子系统在日志写入前对结构化字段的**键名**进行命名约定校验和安全防护。它能防止字段键不一致导致的日志解析困难，并拦截通过字段键注入的恶意内容。

## 验证模式

| 模式 | 常量 | 行为 |
|------|------|------|
| 关闭（默认） | `FieldValidationNone` | 不校验，所有键均接受 |
| 警告 | `FieldValidationWarn` | 不合规范的键输出 stderr 警告，日志仍写入 |
| 严格 | `FieldValidationStrict` | 不合规范的键输出 stderr 错误，日志仍写入 |

:::warning 日志方法不返回错误
由于日志方法（`InfoWith` 等）不返回 error，验证失败只能通过 stderr 输出提示。严格模式**不会阻止日志写入**，但会在 stderr 明确报错。
:::

## 命名约定

| 约定 | 常量 | 示例 |
|------|------|------|
| 任意（默认） | `NamingConventionAny` | 不校验命名风格 |
| snake_case | `NamingConventionSnakeCase` | `user_id`、`created_at` |
| camelCase | `NamingConventionCamelCase` | `userId`、`createdAt` |
| PascalCase | `NamingConventionPascalCase` | `UserId`、`CreatedAt` |
| kebab-case | `NamingConventionKebabCase` | `user-id`、`created-at` |

## 快速启用

### 方案一：预设配置

```go
package main

import (
	"log"

	"github.com/cybergodev/dd"
)

func main() {
	cfg := dd.DefaultConfig()
	cfg.FieldValidation = dd.StrictSnakeCaseConfig()
	// 等价于：
	// &dd.FieldValidationConfig{
	//     Mode:                     dd.FieldValidationStrict,
	//     Convention:               dd.NamingConventionSnakeCase,
	//     AllowCommonAbbreviations: true,
	//     EnableSecurityValidation: true,
	// }

	logger, err := dd.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer logger.Close()

	logger.InfoWith("用户操作",
		dd.String("user_id", "123"),    // ✅ 符合 snake_case
		dd.String("userName", "alice"), // ⚠️ 不符合，stderr 输出错误
	)
}
```

### 方案二：自定义配置

```go
cfg := dd.DefaultConfig()
cfg.FieldValidation = &dd.FieldValidationConfig{
    Mode:                     dd.FieldValidationWarn,
    Convention:               dd.NamingConventionCamelCase,
    AllowCommonAbbreviations: true,
    EnableSecurityValidation: true,
}
```

### 方案三：运行时动态切换

```go
// 启用严格 snake_case
logger.SetFieldValidation(dd.StrictSnakeCaseConfig())

// 关闭验证
logger.SetFieldValidation(nil)

// 查询当前配置
fv := logger.GetFieldValidation()
```

## 常见缩写豁免

启用 `AllowCommonAbbreviations: true`（预设默认开启）后，以下缩写即使不完全匹配命名约定也予以放行：

| 缩写 | 说明 |
|------|------|
| `id`、`url`、`uri`、`ip` | 基础标识 |
| `http`、`https`、`api` | 协议与接口 |
| `json`、`xml`、`html`、`sql` | 数据格式 |
| `tcp`、`udp`、`ssl`、`tls` | 网络协议 |
| `jwt`、`oauth` | 认证 |
| `*_id`、`*_url`、`*_api` 等后缀 | 以缩写结尾的组合（如 `user_id`） |

## 安全验证

`EnableSecurityValidation: true`（预设默认开启）在命名约定之前执行以下安全检查：

| 检查项 | 拦截内容 | 说明 |
|--------|----------|------|
| Log4Shell 检测 | `${jndi:ldap://...}` | 防止 JNDI 注入攻击通过日志键传播 |
| 同形异义字符 | Cyrillic `а` 替代 Latin `a` | 防止视觉欺骗攻击 |
| 过长 UTF-8 编码 | 非最短形式编码 | 防止绕过安全过滤 |

:::danger 零值陷阱
直接使用 `&dd.FieldValidationConfig{Mode: dd.FieldValidationStrict}` 而不设置 `EnableSecurityValidation` 时，安全验证为 `false`（零值），会**静默跳过**安全检查。始终使用 `DefaultFieldValidationConfig()` 或预设函数（`StrictSnakeCaseConfig()` 等），它们将此字段设为 `true`。
:::

## 多约定混合项目

如果项目同时有 Go 后端（snake_case）和 JavaScript 前端（camelCase）日志，可以分 Logger 使用不同约定：

```go
// 后端 Logger：snake_case
backendCfg := dd.DefaultConfig()
backendCfg.FieldValidation = dd.StrictSnakeCaseConfig()
backendLogger, _ := dd.New(backendCfg)

// 前端日志聚合 Logger：camelCase
frontendCfg := dd.DefaultConfig()
frontendCfg.FieldValidation = dd.StrictCamelCaseConfig()
frontendLogger, _ := dd.New(frontendCfg)
```

## 验证规则细节

每种命名约定的具体校验规则：

| 约定 | 规则 |
|------|------|
| snake_case | 小写字母 + 数字 + 下划线；**首字符必须为小写字母**（不能是数字或 `_`）；不以 `_` 结尾；无连续 `__` |
| camelCase | 字母 + 数字；首字符为小写字母 |
| PascalCase | 字母 + 数字；首字符为大写字母 |
| kebab-case | 小写字母 + 数字 + 连字符；**首字符必须为小写字母**（不能是数字或 `-`）；不以 `-` 结尾；无连续 `--` |

## 下一步

- [完整性签名](./integrity) -- HMAC 防篡改
- [结构化日志](../basics/structured-logging) -- 字段构造器与链式调用
- [配置详解](../basics/configuration) -- Config 结构体全字段
- [安全概述](../security/) -- 完整安全功能导览
