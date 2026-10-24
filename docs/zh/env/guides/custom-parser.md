---
sidebar_label: "自定义解析器"
title: "自定义解析器 - CyberGo env | 扩展文件格式"
description: "CyberGo env 自定义解析器指南，实现 EnvParser 接口的 Parse 方法并通过 RegisterParser 注册，借助 ComponentFactory 获取 Validator 与 Auditor，附 TOML、INI 与 XML 解析器完整示例与最佳实践。"
sidebar_position: 8
---

# 自定义解析器

`EnvParser` 接口负责把一种文件格式解析成 `map[string]string`。实现该接口并通过 `RegisterParser` 注册，即可让 env 库解析内置三种格式之外的文件。

## 解析器接口

### EnvParser

每个解析器都必须实现这一个方法：

```go
type EnvParser interface {
    Parse(r io.Reader, filename string) (map[string]string, error)
}
```

**参数：**
- `r` - 文件内容读取器
- `filename` - 文件名，仅用于错误信息与审计描述

**返回：**
- `map[string]string` - 解析后的键值对，键需经 `KeyValidator.ValidateKey` 校验
- `error` - 解析错误；返回非 nil 时整次加载失败

---

## 创建自定义解析器

### 基本结构

```go
package myparser

import (
	"io"
	"strings"

	"github.com/cybergodev/env"
)

// 自定义解析器
type CustomParser struct {
	cfg       env.Config
	validator env.Validator
	auditor   env.FullAuditLogger
}

// 实现 EnvParser 接口
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
	result := make(map[string]string)

	// 1. 读取内容，LimitReader 把长度硬截断到 MaxFileSize
	//    （超限部分被静默丢弃；要显式报错请参考下方 TOML 示例的 +1 读法）
	content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize))
	if err != nil {
		return nil, err
	}

	// 2. 解析内容为键值对
	for _, line := range strings.Split(string(content), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.Index(line, "=")
		if idx <= 0 {
			continue
		}
		result[strings.TrimSpace(line[:idx])] = strings.TrimSpace(line[idx+1:])
	}

	// 3. 验证结果
	for key := range result {
		if err := p.validator.ValidateKey(key); err != nil {
			return nil, err
		}
	}

	// 4. 返回结果
	return result, nil
}
```

### TOML 解析器示例

```go
package tomlparser

import (
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/cybergodev/env"
)

// TOMLParser 解析 TOML 格式
type TOMLParser struct {
	cfg       env.Config
	validator env.Validator
	auditor   env.FullAuditLogger
}

func (p *TOMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
	start := time.Now()

	// 限制读取大小
	content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize+1))
	if err != nil {
		return nil, err
	}
	if int64(len(content)) > p.cfg.MaxFileSize {
		return nil, fmt.Errorf("file exceeds size limit")
	}

	result := make(map[string]string)
	lines := strings.Split(string(content), "\n")

	var currentSection string

	for lineNum, line := range lines {
		line = strings.TrimSpace(line)

		// 跳过空行和注释
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// 解析 section [section]
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			currentSection = strings.Trim(line, "[]")
			continue
		}

		// 解析 key = value
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue // 无 '=' 的行（如 TOML 数组表写法）跳过，不计入结果
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		// 添加 section 前缀
		if currentSection != "" {
			key = currentSection + "_" + key
		}

		// 去除引号
		value = strings.Trim(value, "\"'")

		// 转大写
		key = strings.ToUpper(key)

		// 验证键
		if err := p.validator.ValidateKey(key); err != nil {
			_ = p.auditor.LogError(env.ActionParse, key, err.Error())
			return nil, fmt.Errorf("line %d: %w", lineNum+1, err)
		}

		result[key] = value
	}

	// 检查变量数量
	if len(result) > p.cfg.MaxVariables {
		return nil, fmt.Errorf("exceeds max variables: %d > %d", len(result), p.cfg.MaxVariables)
	}

	_ = p.auditor.LogWithDuration(env.ActionParse, "", "parsed TOML: "+filename, true, time.Since(start))
	return result, nil
}
```

### INI 解析器示例

```go
package iniparser

import (
	"fmt"
	"io"
	"strings"

	"github.com/cybergodev/env"
)

// INIParser 解析 INI 格式
type INIParser struct {
	cfg       env.Config
	validator env.Validator
	auditor   env.FullAuditLogger
}

func (p *INIParser) Parse(r io.Reader, filename string) (map[string]string, error) {
	// 限制读取大小，超限拒绝（与 TOML/XML 示例一致）
	content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize+1))
	if err != nil {
		return nil, err
	}
	if int64(len(content)) > p.cfg.MaxFileSize {
		return nil, env.ErrFileTooLarge
	}

	result := make(map[string]string)
	lines := strings.Split(string(content), "\n")

	var currentSection string

	for lineNum, line := range lines {
		line = strings.TrimSpace(line)

		// 跳过空行和注释
		if line == "" || strings.HasPrefix(line, ";") || strings.HasPrefix(line, "#") {
			continue
		}

		// Section
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			currentSection = strings.Trim(line, "[]")
			continue
		}

		// Key=Value
		if idx := strings.Index(line, "="); idx > 0 {
			key := strings.TrimSpace(line[:idx])
			value := strings.TrimSpace(line[idx+1:])

			if currentSection != "" {
				key = currentSection + "_" + key
			}

			// 验证
			if err := p.validator.ValidateKey(strings.ToUpper(key)); err != nil {
				return nil, fmt.Errorf("line %d: %w", lineNum+1, err)
			}

			result[strings.ToUpper(key)] = value
		}
	}

	return result, nil
}
```

---

## 注册解析器

### ParserFactory 类型

```go
type ParserFactory func(cfg Config, factory *ComponentFactory) (EnvParser, error)
```

工厂函数接收 Config 和 ComponentFactory，返回解析器实例。`New()` 用当前 Config 与它自己构建的工厂调用每个已注册的工厂函数；工厂返回 error 会让 `New()` 直接失败，工厂内 panic 会被捕获并转成创建错误。

**参数说明：**
- `cfg` - 配置对象，包含所有限制和安全设置
- `factory` - 组件工厂，可获取 Validator、Auditor 等组件

### RegisterParser 函数

```go
func RegisterParser(format FileFormat, factory ParserFactory) error
```

注册自定义格式解析器。

**参数：**
- `format` - 文件格式常量（`FileFormat` 是 `int` 别名，自定义格式建议取 100 以上，避开内置的 0–3）
- `factory` - 解析器工厂函数

**返回：**
- `error` - 注册失败时返回错误

**错误情况：**
- `format` 为 `FormatEnv`、`FormatJSON`、`FormatYAML` 之一：拒绝覆盖内置解析器
- 该格式号已注册过
- `factory` 为 nil

**注册时机与冲突规则：**
- Loader 在 `New()` 时快照解析器注册表，必须在调用 `env.New()` 之前注册；已创建的 Loader 不受后续注册影响
- 放在 `init()` 里注册可以保证这一点
- `ForceRegisterParser` 不受「已注册」限制，用于替换内置解析器或重复注册

### 使用 ComponentFactory

`*ComponentFactory` 提供 `Validator()` 与 `Auditor()`，解析器应在工厂函数里取到它们并存成字段，不要自己新建：

```go
type SecureParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func NewSecureParser(cfg env.Config, factory *env.ComponentFactory) (env.EnvParser, error) {
    return &SecureParser{
        cfg:       cfg,
        validator: factory.Validator(),
        auditor:   factory.Auditor(),
    }, nil
}

func (p *SecureParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    result := make(map[string]string)

    // ... 解析逻辑

    // 使用验证器验证键名
    for key := range result {
        if err := p.validator.ValidateKey(key); err != nil {
            _ = p.auditor.Log(env.ActionParse, key, "invalid key", false)
            return nil, err
        }
    }

    _ = p.auditor.Log(env.ActionParse, "", "parse completed", true)
    return result, nil
}
```

### 完整注册示例

<!-- check-code: skip -->
```go
package main

import (
    "github.com/cybergodev/env"
)

// 1. 定义格式常量（建议使用 100+ 的值）
const (
    FormatTOML env.FileFormat = 100
    FormatINI  env.FileFormat = 101
    FormatXML  env.FileFormat = 102
)

// 2. 在 init 中注册
func init() {
    // 注册 TOML 解析器
    err := env.RegisterParser(FormatTOML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &TOMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
    if err != nil {
        panic(err) // 格式已注册或其他错误
    }

    // 注册 INI 解析器
    if err := env.RegisterParser(FormatINI, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &INIParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    }); err != nil {
        panic(err) // 例如 101 已被注册
    }
}

func main() {
    // 注册必须在 New 之前完成（已在 init 中完成）。
    //
    // 重要限制：LoadFiles 不会按 .toml 扩展名自动路由到上面的
    // TOMLParser。DetectFormat 只识别 .env/.json/.yaml/.yml，其他
    // 扩展名返回 FormatAuto；未给 FormatAuto 注册解析器时，加载器
    // 回退到内置 dotenv 解析器。要让 LoadFiles 实际调用 TOMLParser，
    // 需用 ForceRegisterParser 覆盖 FormatEnv，并把文件命名为 *.env：
    err := env.ForceRegisterParser(env.FormatEnv, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &TOMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
    if err != nil {
        panic(err)
    }

    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // 文件扩展名须为 .env（内容为 TOML 格式）才会路由到覆盖后的解析器
    if err := loader.LoadFiles("config.env"); err != nil {
        panic(err)
    }
}
```

::: warning LoadFiles 路由限制
`RegisterParser` 注册的自定义格式号（如 `FormatTOML = 100`）**不会被 `LoadFiles` 按文件扩展名命中**。`LoadFiles` 用 `DetectFormat(filename)` 的结果去查解析器表，而 `DetectFormat` 只认识 `.env` / `.json` / `.yaml` / `.yml` 四种扩展名，其余扩展名一律返回 `FormatAuto`。只注册 100 号解析器时，`.toml` 文件会命中 `FormatAuto` 条目；该条目未注册，于是回退到内置 dotenv 解析器按行解析。

加载自定义格式文件有三条路径：

1. **`.env` 扩展名 + `ForceRegisterParser`**（推荐）：把自定义格式文件命名为 `*.env`，用 `env.ForceRegisterParser(env.FormatEnv, ...)` 覆盖内置 dotenv 解析器。实现里要保留键名、值、大小等安全校验，否则会绕过库的默认防护。
2. **注册到 `FormatAuto`**：`env.RegisterParser(env.FormatAuto, factory)` 后，所有未知扩展名的文件都会走该解析器，文件名可以保持 `.toml`、`.conf` 等原样。
3. **手动调用解析器**：自行打开文件得到 `io.Reader`，构造解析器实例并调用 `parser.Parse(reader, filename)` 拿到 `map[string]string`，再用 `loader.Set` 逐条写入。解析器内部的 `validator`/`auditor` 来自 `*ComponentFactory`，而该类型没有公开构造函数，手动路径下只能改用不依赖它们的实现。
:::

---

## 最佳实践

### 1. 遵守配置限制

```go
func (p *CustomParser) checkLimits(result map[string]string) error {
    // 检查变量数量
    if len(result) > p.cfg.MaxVariables {
        return fmt.Errorf("exceeds max variables: %d > %d", len(result), p.cfg.MaxVariables)
    }

    // 检查键和值长度
    for key, value := range result {
        if len(key) > p.cfg.MaxKeyLength {
            return fmt.Errorf("key too long: %s", key)
        }
        if len(value) > p.cfg.MaxValueLength {
            return fmt.Errorf("value too long for: %s", key)
        }
    }

    return nil
}
```

### 2. 使用验证器

```go
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    result := make(map[string]string)

    // ... 解析逻辑

    // 验证所有键
    for key := range result {
        if err := p.validator.ValidateKey(key); err != nil {
            return nil, fmt.Errorf("invalid key %q: %w", key, err)
        }
    }

    // 验证所有值（`ValidateValues = true` 时；DefaultConfig 与各预设均为 true）
    if p.cfg.ValidateValues {
        for key, value := range result {
            if err := p.validator.ValidateValue(value); err != nil {
                return nil, fmt.Errorf("invalid value for %q: %w", key, err)
            }
        }
    }

    return result, nil
}
```

### 3. 提供有意义的错误

错误消息会进入日志与调用方，因此不要把原始行内容整行回显：含敏感值的行先用 `env.MaskSensitiveInString` 处理，再放进 `Content`。

```go
type CustomParseError struct {
    File    string
    Line    int
    Content string // 经脱敏处理的行内容，不含明文机密
    Err     error
}

func (e *CustomParseError) Error() string {
    if e.Line > 0 {
        return fmt.Sprintf("%s:%d: %s: %v", e.File, e.Line, e.Content, e.Err)
    }
    return fmt.Sprintf("%s: %s: %v", e.File, e.Content, e.Err)
}

func (e *CustomParseError) Unwrap() error {
    return e.Err
}
```

### 4. 记录审计日志

```go
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    start := time.Now()
    result := make(map[string]string)

    // ... 解析逻辑

    // 记录成功
    _ = p.auditor.LogWithDuration(
        env.ActionParse,
        "",
        fmt.Sprintf("parsed %d variables", len(result)),
        true,
        time.Since(start),
    )

    return result, nil
}
```

---

## 完整示例

### 实现 XML 解析器

```go
package main

import (
	"encoding/xml"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/cybergodev/env"
)

// XML 配置结构
type XMLConfig struct {
	XMLName xml.Name   `xml:"config"`
	Entries []XMLEntry `xml:"entry"`
}

type XMLEntry struct {
	Key   string `xml:"key,attr"`
	Value string `xml:",chardata"`
}

// XMLParser 解析 XML 格式
type XMLParser struct {
	cfg       env.Config
	validator env.Validator
	auditor   env.FullAuditLogger
}

func (p *XMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
	start := time.Now()

	// 限制读取大小
	content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize+1))
	if err != nil {
		return nil, err
	}
	if int64(len(content)) > p.cfg.MaxFileSize {
		_ = p.auditor.LogError(env.ActionParse, "", "file exceeds size limit")
		return nil, fmt.Errorf("file exceeds size limit: %d > %d", len(content), p.cfg.MaxFileSize)
	}

	var xmlConfig XMLConfig
	if err := xml.Unmarshal(content, &xmlConfig); err != nil {
		_ = p.auditor.LogError(env.ActionParse, "", "xml parse error: "+err.Error())
		return nil, fmt.Errorf("xml parse error: %w", err)
	}

	result := make(map[string]string)

	for _, entry := range xmlConfig.Entries {
		key := strings.ToUpper(entry.Key)

		// 验证键长度
		if len(key) > p.cfg.MaxKeyLength {
			return nil, fmt.Errorf("key too long: %s", key)
		}

		// 验证键格式
		if err := p.validator.ValidateKey(key); err != nil {
			return nil, fmt.Errorf("invalid key %q: %w", key, err)
		}

		// 验证值长度
		if len(entry.Value) > p.cfg.MaxValueLength {
			return nil, fmt.Errorf("value too long for key: %s", key)
		}

		result[key] = entry.Value
	}

	// 检查变量数量
	if len(result) > p.cfg.MaxVariables {
		return nil, fmt.Errorf("too many variables: %d > %d", len(result), p.cfg.MaxVariables)
	}

	_ = p.auditor.LogWithDuration(env.ActionParse, "", "parsed XML: "+filename, true, time.Since(start))
	return result, nil
}

// 定义 XML 格式常量
const FormatXML env.FileFormat = 102

func init() {
	// 注册 XML 解析器
	env.RegisterParser(FormatXML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
		return &XMLParser{
			cfg:       cfg,
			validator: f.Validator(),
			auditor:   f.Auditor(),
		}, nil
	})
}

func main() {
	// LoadFiles 不会按 .xml 扩展名自动路由到 XML 解析器：DetectFormat
	// 只识别 .env/.json/.yaml/.yml。这里用 ForceRegisterParser 覆盖
	// FormatEnv，文件以 .env 扩展名加载（内容为 XML 格式）：
	err := env.ForceRegisterParser(env.FormatEnv, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
		return &XMLParser{
			cfg:       cfg,
			validator: f.Validator(),
			auditor:   f.Auditor(),
		}, nil
	})
	if err != nil {
		panic(err)
	}

	cfg := env.DefaultConfig()
	loader, _ := env.New(cfg)
	defer loader.Close()

	/*
	   config.env 文件内容（XML 格式）：
	   <?xml version="1.0"?>
	   <config>
	       <entry key="DATABASE_HOST">localhost</entry>
	       <entry key="DATABASE_PORT">5432</entry>
	   </config>
	*/
	if err := loader.LoadFiles("config.env"); err != nil {
		panic(err)
	}

	fmt.Println(loader.GetString("DATABASE_HOST")) // localhost
	fmt.Println(loader.GetInt("DATABASE_PORT"))    // 5432
}
```

---

## 覆盖内置解析器（ForceRegisterParser）

`RegisterParser` 出于安全考虑**拒绝**覆盖三个内置格式（`FormatEnv`、`FormatJSON`、`FormatYAML`），对同一自定义格式重复注册也返回错误。需要替换内置解析器时用 `ForceRegisterParser`，常见场景是给 `.env` 增加多行值语法扩展、附加自定义安全检查，或在测试中注入 mock 解析器：

<!-- check-code: skip -->
```go
err := env.ForceRegisterParser(env.FormatEnv, func(cfg env.Config, factory *env.ComponentFactory) (env.EnvParser, error) {
    return &MyCustomEnvParser{
        validator: factory.Validator(),
        auditor:   factory.Auditor(),
    }, nil
})
```

::: warning 安全警告
替换实现若缺少键名校验、值校验、大小限制等安全检查，库的默认防护就全部失效。只在你的解析器完整实现了等价检查时使用 `ForceRegisterParser`。
:::

**注册时机**：`New()` 构造 Loader 时快照解析器注册表，因此 `RegisterParser` / `ForceRegisterParser` 必须在 `env.New()` 之前完成；已创建的 Loader 不受后续注册影响。

## 相关文档

- [ComponentFactory API](../api-reference/factory) - ComponentFactory 和 RegisterParser
- [接口定义](../api-reference/interfaces) - EnvParser 接口定义
- [Config API](../api-reference/config) - 配置选项详解
- [多格式配置](./multi-format) - JSON/YAML 格式详解
