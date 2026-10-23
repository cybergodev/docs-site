---
sidebar_label: "变量展开"
title: "变量展开 - CyberGo env | ${VAR} 引用与默认值语法"
description: "CyberGo env 变量展开语法指南，详解 ${VAR} 与 ${VAR:-default} 引用、${VAR:=default} 默认值、${VAR:?error} 必填校验、$VAR 简写、循环引用检测与 MaxExpansionDepth 深度限制，实现配置复用与动态值替换。"
sidebar_position: 3
---

# 变量展开

env 库支持在配置文件中使用变量引用，实现配置复用和动态值替换。

## 启用变量展开

```go
cfg := env.DefaultConfig()
cfg.ExpandVariables = true  // 默认启用

loader, _ := env.New(cfg)
loader.LoadFiles(".env")
```

## 基本语法

### 简单引用

```bash
# 引用其他变量
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1
# API_URL 展开为: https://api.example.com/v1

# 简写语法
HOST=localhost
URL=$HOST:8080
# URL 展开为: localhost:8080
```

### 默认值语法

| 语法 | 说明 |
|------|------|
| `${VAR:-default}` | 如果 VAR 不存在，使用 default |
| `${VAR:=default}` | 如果 VAR 不存在，使用 default 并写回该变量 |
| `${VAR:?error}` | 如果 VAR 不存在或为空，返回错误 |

::: warning 自引用限制
`:-`、`:=`、`:?` 引用的变量必须与被赋值的键**不同**。形如 `KEY=${KEY:-default}` 的自引用会被识别为循环引用，加载时报 `ErrExpansionDepth` 错误。为某键设置默认值请直接赋值字面量（`KEY=default`），或引用其他变量（见下方示例）。
:::

---

## 语法详解

### `${VAR:-default}` - 使用默认值

最常见的默认值语法。当变量不存在时使用默认值，变量存在（即使值为空）则使用原值：

```bash
# HOST 已定义，使用其值
HOST=localhost
PRIMARY_HOST=${HOST:-127.0.0.1}
# PRIMARY_HOST 展开为: localhost

# TIMEOUT 未定义时使用默认值 "30s"
TIMEOUT_VALUE=${TIMEOUT:-30s}
# TIMEOUT_VALUE 展开为: 30s

# 嵌套默认值
DB_HOST=localhost
DB_URL=${DB_HOST}:${DB_PORT:-5432}
# DB_HOST=localhost 且 DB_PORT 未定义时
# DB_URL 展开为: localhost:5432
```

**使用场景：**
- 可选配置项的默认值
- 开发/生产环境统一配置

---

### `${VAR:=default}` - 使用默认值并写回

与 `${VAR:-default}` 的区别在于：`:=` 会把展开后的默认值**赋值写回**该变量——写回后对同一文件内的后续引用可见，并出现在加载后的 map 中；而已存在的变量（文件内或进程环境）不会被重新赋值。

```bash
# ASSIGNED 未定义时被写回为 "created"，B 展开为 "created"
B=${ASSIGNED:=created}
# 结果：B="created" 且 ASSIGNED="created"
```

::: info 与 `:-` 的关系
`${VAR:-default}` 仅返回默认值、不写回变量；`${VAR:=default}` 在变量不存在时既返回默认值，又把该默认值**赋值写回**变量存储（写回后对同一文件内的后续引用、`Get`/`Apply` 均可见，按键名排序确定性处理）。若变量已存在（无论来自文件内还是进程环境），`:=` 不会重新赋值，行为退化为返回原值。
:::

---

### `${VAR:?error}` - 错误提示

如果变量不存在或为空则返回错误：

```bash
# 如果 DATABASE_URL 未定义，加载失败并显示错误
DB_URL=${DATABASE_URL:?Database URL is required}

# 如果 API_TOKEN 未定义，报错
AUTH_TOKEN=${API_TOKEN:?API_TOKEN must be set}
```

**使用场景：**
- 必需配置项验证
- 早期失败，避免运行时错误

---

## 转义

### 转义美元符号

使用 `$$` 表示字面量 `$`：

```bash
# 价格配置
PRICE=$$99.99
# 展开为: $99.99

# 包含 $ 的字符串
MESSAGE=Price is $$100
# 展开为: Price is $100
```

### 引号与展开

变量展开发生在引号剥离之后的统一后处理阶段，**单引号与双引号都不影响变量展开**。例如 `SINGLE='${BASE}'`（`BASE=hello`）展开后的值为 `hello`，与双引号行为一致；若被引用的变量未定义（如 `LITERAL='${NO_EXPANSION}'`），结果为空字符串，而非保留 `${NO_EXPANSION}` 字面量。

单引号与双引号的区别仅在**字面解析**：双引号处理 `\n`、`\t` 等转义序列，单引号原样保留（不转义）。

::: warning 注意
不要用引号来"禁止展开"。如需保留 `${VAR}` 字面量，请使用以下方式：
:::

```bash
# 方式一：转义美元符号（$$ 展开为字面 $）
LITERAL='$${NO_EXPANSION}'
# 值为: ${NO_EXPANSION}
```

```go
// 方式二：关闭全局变量展开
cfg := env.DefaultConfig()
cfg.ExpandVariables = false
```

---

## 嵌套展开

变量可以嵌套引用：

```bash
# 基础配置（避免使用内置禁止键 ENV，改用 DEPLOY_ENV）
APP_NAME=myapp
DEPLOY_ENV=production

# 嵌套引用
DB_HOST=db.${DEPLOY_ENV}.example.com
# 展开为: db.production.example.com

API_URL=https://${APP_NAME}.${DEPLOY_ENV}.api.example.com
# 展开为: https://myapp.production.api.example.com
```

---

## 循环检测

库自动检测循环引用并返回错误：

```bash
# 循环引用（错误）
A=${B}
B=${A}

# 加载时会返回 ErrExpansionDepth 错误
```

---

## 展开深度限制

默认最大展开深度为 5，硬性上限为 20：

```go
cfg := env.DefaultConfig()
cfg.MaxExpansionDepth = 10  // 自定义深度
```

| 常量 | 值 | 说明 |
|------|---|------|
| `DefaultMaxExpansionDepth` | 5 | 默认值（公开 API） |

::: info 提示
硬性上限为 20（内部限制）。配置的 `MaxExpansionDepth` 不能超过此限制。
:::

---

## 完整示例

```bash
# .env 文件

# 基础配置（避免使用内置禁止键 ENV）
APP_NAME=myapp
DEPLOY_ENV=development
DEBUG=true

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${APP_NAME}
DB_URL=postgres://${DB_HOST}:${DB_PORT}/${DB_NAME}

# API 配置
API_BASE=https://api.${DEPLOY_ENV}.example.com
API_URL=${API_BASE}/v1

# 日志配置
LOG_LEVEL=info

# 价格（转义）
PRICE=$$99.99
```

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/env"
)

func main() {
	cfg := env.DefaultConfig()
	cfg.ExpandVariables = true

	loader, err := env.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer loader.Close()

	err = loader.LoadFiles(".env")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("DB_URL:", loader.GetString("DB_URL"))
	fmt.Println("API_URL:", loader.GetString("API_URL"))
	fmt.Println("PRICE:", loader.GetString("PRICE"))
}
```

---

## 展开作用域（安全隔离）

`ParsingConfig.ExpansionScope` 控制 `${VAR}` 引用可解析的作用域。`ExpansionFileThenProcess` 是 Go `iota` 枚举的**零值**（`= iota` 这一句），但用户实际运行时走 `DefaultConfig()`——`New()` 会对零值 `Config` 套用 `DefaultConfig()`，而 `DefaultConfig()` 显式把 `ExpansionScope` 设为 `ExpansionFileOnly`（SEC-003，默认阻断 `${VAR}` 回退读进程环境）。因此**运行时默认 = FileOnly**：「零值」与「DefaultConfig 默认」是两回事。

| 取值 | 行为 | 适用场景 |
|------|------|----------|
| `ExpansionFileOnly`（运行时默认） | 仅文件内变量可见；进程环境引用展开为空字符串 | 默认行为；防止机密探测（SEC-03） |
| `ExpansionFileThenProcess`（枚举零值） | 先查文件内变量，缺失时回退进程环境 | 仅当显式设置，用于可信配置文件、传统 dotenv 语义 |

<!-- check-code: skip -->
```go
cfg := env.DefaultConfig()
// DefaultConfig 默认已是 ExpansionFileOnly，此处为显式声明
cfg.ExpansionScope = env.ExpansionFileOnly
loader, _ := env.New(cfg)
```

::: warning SEC-03
`DefaultConfig()` 默认把展开作用域设为 `ExpansionFileOnly`——`${VAR}` 引用仅在文件内解析，阻断对进程环境的回退读取。若你的应用会加载外部提供的配置文件，请保持这一默认值，不要显式改回 `ExpansionFileThenProcess`。
:::

注意：`ExpansionScope` 是枚举而非布尔字段，即使 `Config` 只设置了这一个字段，`IsZero()` 也会正确识别其为已初始化的配置，不会被默认值静默覆盖。但需区分「枚举零值」与「DefaultConfig 默认值」：`ExpansionFileThenProcess` 是枚举零值，`DefaultConfig()` 显式设为 `ExpansionFileOnly`，两者并不相同。

## 相关文档

- [快速开始](../getting-started/) - 基础使用
- [Config API](../api-reference/config) - ExpandVariables 配置
- [常量与错误](../api-reference/constants) - 展开深度限制
