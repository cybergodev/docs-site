---
sidebar_label: "序列化"
title: "序列化 - CyberGo env | 多格式转换"
description: "CyberGo env 序列化指南，详解 .env、JSON、YAML 间的 Map 与结构体转换，含 Marshal/Unmarshal 函数族、Marshaler/Unmarshaler 自定义接口与 DetectFormat 自动检测，覆盖配置导出与格式迁移等实用场景。"
sidebar_position: 4
---

# 序列化

`env.Marshal` 把 map 或结构体导出为 `.env`、JSON、YAML 文本，`env.UnmarshalMap` / `env.UnmarshalStruct` 反向解析文本。

## 基本序列化

### Map 序列化

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	data := map[string]string{
		"APP_NAME":    "my-app",
		"APP_VERSION": "1.0.0",
		"DEBUG":       "true",
	}

	// 序列化为 .env 格式
	result, err := env.Marshal(data, env.FormatEnv)
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
	// 输出：
	// APP_NAME=my-app
	// APP_VERSION=1.0.0
	// DEBUG=true
}
```

### JSON 格式

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	data := map[string]string{
		"HOST": "localhost",
		"PORT": "8080",
	}

	// 序列化为 JSON
	result, err := env.Marshal(data, env.FormatJSON)
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
	// 输出：
	// {
	//   "HOST": "localhost",
	//   "PORT": 8080
	// }
}
```

### YAML 格式

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	data := map[string]string{
		"DATABASE_HOST": "localhost",
		"DATABASE_PORT": "5432",
		"DATABASE_NAME": "myapp",
	}

	// 序列化为 YAML
	result, err := env.Marshal(data, env.FormatYAML)
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
	// 输出：
	// DATABASE_HOST: localhost
	// DATABASE_NAME: myapp
	// DATABASE_PORT: "5432"
}
```

## 输出形态

Marshal 的输出不是「扁平键原样输出」：两种结构化格式都会改写键值，读懂这两条规则才能正确解读导出结果。

### JSON：下划线键重建嵌套对象

Marshal 到 JSON 时，含下划线的键按 `_` 拆分重建为嵌套对象（`DATABASE_HOST` → `{"DATABASE": {"HOST": ...}}`）；叶子值经类型推断还原，`"8080"` 回到 number、`"true"` 回到 bool。这条推断只接受能原样回写的规范写法：`"007"`、`"1.50"`、`"1e3"` 保持字符串，`"null"` 也保持字符串（JSON null 读回时会变成空串，转成 null 反而改变值）。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	data := map[string]string{
		"DATABASE_HOST": "localhost",
		"DATABASE_PORT": "5432",
		"DEBUG":         "true",
	}

	result, err := env.Marshal(data, env.FormatJSON)
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
	// 输出（键按字典序排序）：
	// {
	//   "DATABASE": {
	//     "HOST": "localhost",
	//     "PORT": 5432
	//   },
	//   "DEBUG": true
	// }
}
```

这与加载方向对称：加载 JSON 时嵌套对象被扁平化为 `DATABASE_HOST`，Marshal 回 JSON 时再按 `_` 拆回嵌套结构，往返后结构一致。

### YAML：标量加引号保往返

Marshal 到 YAML 时键保持扁平，但对读回时会被 YAML 强制转换类型的标量（数字、`true`/`false`、`null`/`~` 等）自动加双引号，保证 Marshal → Unmarshal 往返后值仍为字符串：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	data := map[string]string{
		"HOST":  "localhost",
		"PORT":  "8080",
		"DEBUG": "true",
	}

	result, err := env.Marshal(data, env.FormatYAML)
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
	// 输出（键按字典序排序）：
	// DEBUG: "true"
	// HOST: localhost
	// PORT: "8080"
}
```

这是 v1.2.3 起的行为：此前 `PORT: 8080` 不加引号，读回时会被 YAML 解析为数字，导致往返后类型漂移。

## 结构体序列化

### 基本序列化

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

type Config struct {
	Host  string `env:"HOST"`
	Port  int64  `env:"PORT"`
	Debug bool   `env:"DEBUG"`
}

func main() {
	cfg := Config{
		Host:  "localhost",
		Port:  8080,
		Debug: true,
	}

	// 序列化结构体为 .env 格式
	result, err := env.Marshal(cfg, env.FormatEnv)
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
	// 输出：
	// DEBUG=true
	// HOST=localhost
	// PORT=8080
}
```

### 嵌套结构体

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

type DatabaseConfig struct {
	Host string `env:"DB_HOST"`
	Port int64  `env:"DB_PORT"`
}

type AppConfig struct {
	Name     string `env:"APP_NAME"`
	Database DatabaseConfig
}

func main() {
	cfg := AppConfig{
		Name: "my-app",
		Database: DatabaseConfig{
			Host: "localhost",
			Port: 5432,
		},
	}

	result, err := env.Marshal(cfg, env.FormatEnv)
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
}
```

### MarshalStruct 函数

将结构体转换为 `map[string]string`：

```go
func MarshalStruct(v any) (map[string]string, error)
```

**参数：**
- `v` - 结构体指针或值

**返回：**
- `map[string]string` - 环境变量映射
- `error` - 序列化错误

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

type Config struct {
	Host  string `env:"HOST"`
	Port  int64  `env:"PORT"`
	Debug bool   `env:"DEBUG"`
}

func main() {
	cfg := Config{
		Host:  "localhost",
		Port:  8080,
		Debug: true,
	}

	// 转换为 map
	data, err := env.MarshalStruct(cfg)
	if err != nil {
		panic(err)
	}

	fmt.Printf("%+v\n", data)
	// 输出：map[DEBUG:true HOST:localhost PORT:8080]

	// 可用于导出到文件
	content, _ := env.Marshal(data, env.FormatEnv)
	fmt.Println(content)
}
```

## 反序列化

### Map 反序列化

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	// .env 格式字符串
	data := `
HOST=localhost
PORT=8080
DEBUG=true
`

	// 反序列化为 map
	result, err := env.UnmarshalMap(data, env.FormatEnv)
	if err != nil {
		panic(err)
	}

	fmt.Printf("%+v\n", result)
	// 输出：map[DEBUG:true HOST:localhost PORT:8080]
}
```

### JSON 反序列化

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	jsonData := `{
        "API_KEY": "secret123",
        "API_URL": "https://api.example.com",
        "TIMEOUT": "30"
    }`

	result, err := env.UnmarshalMap(jsonData, env.FormatJSON)
	if err != nil {
		panic(err)
	}

	fmt.Printf("%+v\n", result)
	// 输出：map[API_KEY:secret123 API_URL:https://api.example.com TIMEOUT:30]
}
```

### YAML 反序列化

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	yamlData := `
DATABASE_HOST: localhost
DATABASE_PORT: "5432"
DATABASE_USER: postgres
`

	result, err := env.UnmarshalMap(yamlData, env.FormatYAML)
	if err != nil {
		panic(err)
	}

	fmt.Printf("%+v\n", result)
	// 输出：map[DATABASE_HOST:localhost DATABASE_PORT:5432 DATABASE_USER:postgres]
}
```

## 结构体反序列化

### 从 Map 反序列化

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

type Config struct {
	Host string `env:"HOST"`
	Port int64  `env:"PORT"`
}

func main() {
	data := map[string]string{
		"HOST": "example.com",
		"PORT": "443",
	}

	var cfg Config
	err := env.UnmarshalInto(data, &cfg)
	if err != nil {
		panic(err)
	}

	fmt.Printf("%+v\n", cfg)
	// 输出：{Host:example.com Port:443}
}
```

### 从字符串反序列化

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

type ServerConfig struct {
	Host    string `env:"SERVER_HOST"`
	Port    int64  `env:"SERVER_PORT"`
	Enabled bool   `env:"ENABLED"`
}

func main() {
	envData := `
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
ENABLED=true
`

	var cfg ServerConfig
	err := env.UnmarshalStruct(envData, &cfg, env.FormatEnv)
	if err != nil {
		panic(err)
	}

	fmt.Printf("%+v\n", cfg)
	// 输出：{Host:0.0.0.0 Port:8080 Enabled:true}
}
```

## 自定义序列化

::: tip 两种自定义接口的生效范围
- **字段级**：结构体字段的自定义编解码，实现标准库 `encoding.TextMarshaler` / `encoding.TextUnmarshaler`（`MarshalText()` / `UnmarshalText([]byte)`）。当结构体被 `env.Marshal`/`env.UnmarshalInto` 处理时，逐字段逻辑会识别这两个接口。
- **顶层**：`env.Marshaler`（`MarshalEnv()`）与 `env.Unmarshaler`（`UnmarshalEnv(map[string]string)`）接口**仅在直接传给 `env.Marshal`/`env.MarshalStruct`/`env.UnmarshalInto` 的顶层值上生效**；若传入的是含该类型字段的外层结构体，则不会被调用。
:::

### 字段级：实现 encoding.TextMarshaler

```go
package main

import (
	"fmt"
	"strings"

	"github.com/cybergodev/env"
)

type LogLevel string

// 实现 encoding.TextMarshaler，作为结构体字段序列化时会被调用
func (l LogLevel) MarshalText() ([]byte, error) {
	return []byte(strings.ToUpper(string(l))), nil
}

type LogConfig struct {
	Level LogLevel `env:"LOG_LEVEL"`
}

func main() {
	cfg := LogConfig{
		Level: LogLevel("debug"),
	}

	result, err := env.Marshal(cfg, env.FormatEnv)
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
	// 输出：LOG_LEVEL=DEBUG
}
```

### 字段级：实现 encoding.TextUnmarshaler

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

type LogLevel string

// 实现 encoding.TextUnmarshaler，作为结构体字段反序列化时会被调用
func (l *LogLevel) UnmarshalText(text []byte) error {
	switch string(text) {
	case "debug", "info", "warn", "error":
		*l = LogLevel(text)
		return nil
	default:
		return fmt.Errorf("invalid log level: %s", string(text))
	}
}

type LogConfig struct {
	Level LogLevel `env:"LOG_LEVEL"`
}

func main() {
	data := map[string]string{
		"LOG_LEVEL": "info",
	}

	var cfg LogConfig
	err := env.UnmarshalInto(data, &cfg)
	if err != nil {
		panic(err)
	}

	fmt.Printf("Level: %s\n", cfg.Level)
	// 输出：Level: info
}
```

### 顶层：实现 env.Marshaler / env.Unmarshaler

当**直接**把一个类型的值传给 `env.Marshal` / `env.UnmarshalInto`（而非作为外层结构体的字段）时，`env.Marshaler` / `env.Unmarshaler` 接口会在该顶层值上生效：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

// 顶层类型直接实现 env.Marshaler
type EnvBlob string

func (e EnvBlob) MarshalEnv() ([]byte, error) {
	// 自定义整体序列化输出
	return []byte("APP_NAME=custom\nAPP_VERSION=2.0.0"), nil
}

func main() {
	// 直接序列化顶层值（不是外层结构体的字段）
	result, err := env.Marshal(EnvBlob(""), env.FormatEnv)
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
	// 输出：
	// APP_NAME=custom
	// APP_VERSION=2.0.0
}
```

## 格式检测

### 自动检测格式

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	// DetectFormat 只看扩展名：.json / .yaml / .yml / .env，其余返回 FormatAuto
	format := env.DetectFormat("config.json")
	fmt.Println(format.String()) // json

	format = env.DetectFormat("settings.yaml")
	fmt.Println(format.String()) // yaml

	format = env.DetectFormat(".env")
	fmt.Println(format.String()) // dotenv

	// UnmarshalMap 传 FormatAuto 时按内容检测，见下文规则表
	data := `{"KEY": "value"}`
	result, _ := env.UnmarshalMap(data, env.FormatAuto)
	fmt.Println(result)
}
```

## 实用场景

### 保存配置到文件

```go
package main

import (
	"github.com/cybergodev/env"
	"os"
)

func main() {
	cfg := map[string]string{
		"HOST": "localhost",
		"PORT": "8080",
	}

	// 序列化
	content, err := env.Marshal(cfg, env.FormatEnv)
	if err != nil {
		panic(err)
	}

	// 写入文件
	err = os.WriteFile(".env", []byte(content), 0600)
	if err != nil {
		panic(err)
	}
}
```

### 导出当前环境

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
	"os"
)

func main() {
	if err := env.Load(".env"); err != nil {
		panic(err)
	}

	// 获取所有环境变量
	all := env.All()

	// 导出为 JSON
	content, err := env.Marshal(all, env.FormatJSON)
	if err != nil {
		panic(err)
	}

	fmt.Println(content)

	// 或写入文件；导出的是配置快照，可能含密钥，权限用 0600
	if err := os.WriteFile("env-export.json", []byte(content), 0600); err != nil {
		panic(err)
	}
}
```

### 配置迁移

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
	"os"
)

func main() {
	// 读取 JSON 配置
	jsonContent, _ := os.ReadFile("config.json")

	// 解析 JSON
	data, err := env.UnmarshalMap(string(jsonContent), env.FormatJSON)
	if err != nil {
		panic(err)
	}

	// 转换为 .env 格式
	envContent, err := env.Marshal(data, env.FormatEnv)
	if err != nil {
		panic(err)
	}

	// 保存为 .env 文件（含密钥，权限用 0600）
	if err := os.WriteFile(".env", []byte(envContent), 0600); err != nil {
		panic(err)
	}

	fmt.Println("Config migrated from JSON to .env")
}
```

## 往返行为与格式自动检测

### `.env` 输出转义 `$`

`Marshal` 到 `.env`（`FormatEnv`）时，含 `$` 的值会整体加双引号，并把每个 `$` 写成 `\$`。读回时解析器得到的是一个字面 `$`，不会把它当作变量引用展开，因此 Marshal → 加载的往返是安全的（v1.3.0 起，SEC-009）：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	data := map[string]string{"PRICE": "100$USD"}

	out, err := env.Marshal(data, env.FormatEnv)
	if err != nil {
		panic(err)
	}
	fmt.Println(out)
	// 输出：PRICE="100\$USD"
}
```

含空格、`#`、单引号的值同样走这条加引号路径。不经 Marshal、手工拼接 `.env` 文本时没有这层保护：在默认 `ExpandVariables = true` 下，写进文件的 `$VAR` 会在加载时被展开。

### MarshalStruct 的字段取舍

结构体序列化时，**编组为空字符串的字段会被省略**（空字符串、nil 指针、空切片）；标量零值（`0`、`false`）**保留**，因为它们编组出来不是空字符串。读取侧用 `envDefault` 标签补默认值即可对齐。

### 键排序保证

`Marshal` 的输出键**始终按字典序排序**，与输入 map 的顺序或结构体字段顺序无关。同一份配置的输出因此稳定，便于 diff 与缓存。

### FormatAuto 内容检测规则

`UnmarshalMap`/`UnmarshalStruct` 传入 `FormatAuto` 时按**内容**（而非扩展名）检测格式，只检查首个有效行（空白行与 `#` 开头的行跳过）：

| 特征（按判定顺序） | 判定 |
|------|------|
| 全部为空白 | `.env` |
| 首字符为 `{` 或 `[` | JSON |
| 首个有效行以 `- ` 开头 | YAML |
| 首个有效行含 `": "`，且它在 `=` 之前（或该行没有 `=`） | YAML |
| 首个有效行含有 `=` | `.env` |
| 首个有效行形如 `KEY:`（冒号后只有空白） | YAML |
| 以上都不匹配 | `.env` |

判定依据是**同一行中哪个分隔符先出现**，而不是 `: ` 一律优先：`GREETING=hello: world` 的 `=` 在索引 8（第 9 个字符）、`": "` 在其后，判为 `.env`；`connection: host=db port=5432` 的 `": "` 在前，判为 YAML。

### IsMarshalError 辅助判断

<!-- check-code: skip -->
```go
if _, err := env.Marshal(data); err != nil {
	if env.IsMarshalError(err) {
		// 序列化错误：输入类型不支持或字段转换失败
	}
}
```

## 相关文档

- [包函数](../api-reference/functions) - Marshal、UnmarshalMap 等函数参考
- [多格式配置](./multi-format) - 多格式加载指南
- [结构体映射](./struct-mapping) - 结构体映射指南
