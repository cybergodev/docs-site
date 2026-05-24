---
title: "变量展开 - CyberGo env 变量语法"
description: "CyberGo env 库变量展开语法指南，详解 ${VAR} 和 ${VAR:-default} 引用语法，涵盖嵌套默认值、:=赋值和 :?错误输出等条件展开模式，介绍循环引用检测、MaxExpansionDepth 深度限制与 ExpandVariables 开关控制，在 .env 文件中实现变量复用与动态值替换。"
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
| `${VAR:=default}` | 如果 VAR 不存在，使用 default（同 `:-`） |
| `${VAR:?error}` | 如果 VAR 不存在或为空，返回错误 |

---

## 语法详解

### `${VAR:-default}` - 使用默认值

最常见的默认值语法。当变量不存在时使用默认值，变量存在（即使值为空）则使用原值：

```bash
# 如果 LOG_LEVEL 不存在，使用 "info"
LOG_LEVEL=${LOG_LEVEL:-info}

# 如果 TIMEOUT 不存在，使用 "30s"
TIMEOUT=${TIMEOUT:-30s}

# 嵌套默认值
DB_HOST=${DB_HOST:-localhost}
DB_URL=${DB_HOST}:${DB_PORT:-5432}
# 如果 DB_HOST=localhost 且 DB_PORT 不存在
# DB_URL 展开为: localhost:5432
```

**使用场景：**
- 可选配置项的默认值
- 开发/生产环境统一配置

---

### `${VAR:=default}` - 使用默认值

行为与 `${VAR:-default}` 相同，当变量不存在时使用默认值：

```bash
# 如果 DEBUG 不存在，使用 "false"
DEBUG=${DEBUG:=false}

# 如果不存在则使用默认值
CACHE_TTL=${CACHE_TTL:=3600}
```

::: info 与 `:-` 的关系
`${VAR:=default}` 在本库中与 `${VAR:-default}` 行为完全相同。当变量不存在时，使用默认值作为展开结果。`:=` 不会将默认值写回变量存储。
:::

---

### `${VAR:?error}` - 错误提示

如果变量不存在或为空则返回错误：

```bash
# 如果 DATABASE_URL 不存在，加载失败并显示错误
DATABASE_URL=${DATABASE_URL:?Database URL is required}

# 如果 API_KEY 不存在，报错
API_KEY=${API_KEY:?API_KEY must be set}
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

### 单引号

单引号内的变量不展开：

```bash
# 不展开
LITERAL='${NO_EXPANSION}'
# 值为: ${NO_EXPANSION}

# 对比双引号
EXPANDED="${WILL_EXPAND}"
# 会展开 ${WILL_EXPAND}
```

---

## 嵌套展开

变量可以嵌套引用：

```bash
# 基础配置
APP_NAME=myapp
ENV=production

# 嵌套引用
DB_HOST=db.${ENV}.example.com
# 展开为: db.production.example.com

API_URL=https://${APP_NAME}.${ENV}.api.example.com
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

# 基础配置
APP_NAME=myapp
ENV=development
DEBUG=true

# 数据库配置
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-${APP_NAME}}
DB_URL=postgres://${DB_HOST}:${DB_PORT}/${DB_NAME}

# API 配置
API_BASE=https://api.${ENV}.example.com
API_URL=${API_BASE}/v1
API_KEY=${API_KEY:?API_KEY is required}

# 日志配置
LOG_LEVEL=${LOG_LEVEL:-info}

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

## 相关文档

- [快速开始](/zh/env/getting-started) - 基础使用
- [Config API](/zh/env/api-reference/config) - ExpandVariables 配置
- [常量与错误](/zh/env/api-reference/constants) - 展开深度限制
