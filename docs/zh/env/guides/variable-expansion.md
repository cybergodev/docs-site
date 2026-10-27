---
sidebar_label: "变量展开"
title: "变量展开 - CyberGo env | ${VAR} 引用与默认值语法"
description: "CyberGo env 变量展开语法指南，详解 ${VAR} 与 ${VAR:-default} 引用、${VAR:=default} 默认值、${VAR:?error} 必填校验、$VAR 简写、循环引用检测与 MaxExpansionDepth 深度限制，实现配置复用与动态值替换。"
sidebar_position: 3
---

# 变量展开

变量展开让 `.env` 文件中的值可以引用同文件内的其他变量，把重复的配置片段合成一处定义。

## 启用变量展开

```go
cfg := env.DefaultConfig()
cfg.ExpandVariables = true  // 可省略，DefaultConfig 已开启；此处显式写出

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
| `${VAR:-default}` | VAR 未定义时使用 default；已定义（含空串）时保留原值，不写回 |
| `${VAR:=default}` | VAR 未定义时使用 default 并写回该变量；已定义时不写回 |
| `${VAR:?error}` | VAR 未定义或值为空时返回错误 |

::: warning 自引用限制
`:-`、`:=`、`:?` 引用的变量必须与被赋值的键**不同**。形如 `KEY=${KEY:-default}` 的自引用按循环引用处理，加载时报匹配 `ErrExpansionDepth` 的错误。为某键设置默认值，直接赋值字面量（`KEY=default`），或引用其他变量（示例见「语法详解」）。
:::

---

## 语法详解

### `${VAR:-default}` - 使用默认值

变量未定义时返回 default；变量已定义（即使值为空字符串）时返回原值：

```bash
# HOST 已定义，使用其值
HOST=localhost
PRIMARY_HOST=${HOST:-127.0.0.1}
# PRIMARY_HOST 展开为: localhost

# TIMEOUT 未定义时使用默认值 "30s"
TIMEOUT_VALUE=${TIMEOUT:-30s}
# TIMEOUT_VALUE 展开为: 30s

# 默认值里可以引用其他变量
DB_HOST=localhost
DB_URL=${DB_HOST}:${DB_PORT:-5432}
# DB_HOST=localhost 且 DB_PORT 未定义时
# DB_URL 展开为: localhost:5432
```

**使用场景：**
- 可选配置项的默认值
- 开发与生产环境共用的配置模板

---

### `${VAR:=default}` - 使用默认值并写回

`:=` 与 `:-` 的区别在于写回：变量未定义时，`:=` 把默认值同时返回给引用处，并写进变量存储。写回的值对同一文件内后续被处理的键可见（按排序顺序），也出现在加载后的 map 中。变量已定义时不写回，行为等同于返回原值。

```bash
# ASSIGNED 未定义时被写回为 "created"，B 展开为 "created"
B=${ASSIGNED:=created}
# 结果：B="created" 且 ASSIGNED="created"
```

::: info 与 `:-` 的关系
`:-` 只返回默认值，从不写回。`:=` 的写回只发生在引用解析不到该变量时；变量已定义（含空串）则退化为 `:-` 的行为。写回的默认值本身也会先展开。
:::

---

### `${VAR:?error}` - 错误提示

变量未定义或值为空字符串时返回错误，加载失败：

```bash
# DATABASE_URL 未定义时加载失败
DB_URL=${DATABASE_URL:?Database URL is required}

# API_TOKEN 未定义或为空时加载失败
AUTH_TOKEN=${API_TOKEN:?API_TOKEN must be set}
```

错误类型为 `*ExpansionError`（`Kind == ExpansionRequiredKind`），`errors.Is(err, env.ErrExpansionDepth)` 对它返回 false。冒号后的提示文本不会进入错误消息；`Error()` 输出中的键名一律掩码为 `[MASKED]`（SEC-005，不区分是否敏感键），原始键名保留在 `Key` 字段，供 `errors.As` 之后的程序内判断。

**使用场景：**
- 必需配置项校验
- 尽早失败，避免错误推迟到运行时

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

**单引号的值不参与变量展开**，与 bash 的单引号语义一致。`PASSWORD='my$ecret'` 加载后就是字面文本 `my$ecret`；`SINGLE='${BASE}'` 加载后是字面文本 `${BASE}`，不会替换成 `BASE` 的值。

双引号与无引号的值照常展开：`GREET="hello $NAME"`（`NAME=world`）展开后为 `hello world`。

引号还影响**字面解析**：双引号处理 `\n`、`\r`、`\t` 转义与 `\"`、`\\`，单引号原样保留反斜杠序列。

::: warning 注意
保留 `${VAR}` 字面量有三种写法：

```bash
# 方式一：单引号（整个值不展开）
LITERAL='${NO_EXPANSION}'
# 值为: ${NO_EXPANSION}
```

```bash
# 方式二：双引号或无引号，用 $$ 转义美元符号
LITERAL="$${NO_EXPANSION}"
# 值为: ${NO_EXPANSION}
```

```go
// 方式三：关闭全局变量展开
cfg := env.DefaultConfig()
cfg.ExpandVariables = false
```
:::

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

引用成环时（如 `A=${B}` 与 `B=${A}`），加载返回匹配 `ErrExpansionDepth` 的错误。自引用 `KEY=${KEY}`、`KEY=${KEY:-default}` 同样按循环处理。

```bash
# 循环引用（错误）
A=${B}
B=${A}

# 加载时会返回匹配 ErrExpansionDepth 的错误
```

---

## 展开深度限制

默认最大展开深度为 5，硬性上限为 20。`MaxExpansionDepth` 设为超过 20 的值会让 `Config.Validate()` 返回 `ValidationError`（`Field == "MaxExpansionDepth"`），`New()` 随之失败：

```go
cfg := env.DefaultConfig()
cfg.MaxExpansionDepth = 10  // 自定义深度，取值 1–20
```

| 常量 | 值 | 说明 |
|------|---|------|
| `DefaultMaxExpansionDepth` | 5 | 默认值（公开 API） |

::: info 提示
硬性上限 20 是内部限制（`internal.HardMaxExpansionDepth`）。配置的 `MaxExpansionDepth` 超过它不会自动截断，而是配置校验失败。
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

`ParsingConfig.ExpansionScope` 决定 `${VAR}` 能从哪里取值，有两个取值：

| 取值 | 行为 | 适用场景 |
|------|------|----------|
| `ExpansionFileOnly`（运行时默认） | 只解析文件内定义的变量；未定义的引用展开为空字符串 | 默认行为，阻断借配置文件探测进程环境中的机密（SEC-03） |
| `ExpansionFileThenProcess`（枚举零值） | 先查文件内变量，缺失时回退读进程环境 | 需显式设置；用于可信配置文件、沿用传统 dotenv 语义 |

两个容易混淆的点：

1. **枚举零值不是运行时默认值。** `ExpansionFileThenProcess` 是 `iota` 枚举的零值，但 `New()` 收到零值 `Config` 时会换成 `DefaultConfig()`，而 `DefaultConfig()` 显式设 `ExpansionScope = ExpansionFileOnly`。所以 `env.New(env.Config{})` 的实际作用域是 FileOnly。
2. **只设置部分字段的 `Config` 不会被当成零值。** v1.3.0 起 `Config.IsZero()` 覆盖全部字段（含 `ExpansionScope` 这类枚举），这类配置不会被静默替换成 `DefaultConfig()`。但 `New()` 随后会调用 `Config.Validate()`：未设置的必需限制（`MaxFileSize` 等）仍为零，校验失败，`New()` 返回包装了 `ErrInvalidConfig` 的错误。自定义配置始终从 `env.DefaultConfig()` 或某个预设开始改。

<!-- check-code: skip -->
```go
cfg := env.DefaultConfig()
// DefaultConfig 默认已是 ExpansionFileOnly，此处为显式声明
cfg.ExpansionScope = env.ExpansionFileOnly
loader, _ := env.New(cfg)
```

::: warning SEC-03
`DefaultConfig()` 默认把展开作用域设为 `ExpansionFileOnly`：`${VAR}` 引用只在文件内解析，不回退读进程环境。应用会加载外部提供的配置文件时保持这一默认值，不要改成 `ExpansionFileThenProcess`。
:::

## 相关文档

- [快速开始](../getting-started/) - 基础使用
- [Config API](../api-reference/config) - ExpandVariables 配置
- [常量与错误](../api-reference/constants) - 展开深度限制
