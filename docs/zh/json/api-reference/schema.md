---
sidebar_label: "Schema 校验"
title: "Schema 校验 - CyberGo JSON | JSON Schema 验证指南"
description: "CyberGo JSON 内置 JSON Schema 校验：ValidateSchema 对照 Schema 返回全部 ValidationError，支持 Required/Properties 必填结构、Pattern/Format 字符串与语义格式、Minimum/Maximum 数值区间及 Enum/Const 枚举约束，经 NewSchema 规范创建启用区间限制，帮助开发者校验对象、字符串、数值与数组数据结构。"
sidebar_position: 50
---

# Schema 验证

json 库提供基于 JSON Schema 的数据验证能力：定义一个 `Schema` 描述数据应满足的结构与约束，再用 `ValidateSchema` 校验一段 JSON。这是当前版本**功能完备**的验证系统。

## ValidateSchema 函数

`ValidateSchema` 将 JSON 字符串与 `Schema` 对照校验，返回所有违反约束的列表：

```go
// 包级函数
func ValidateSchema(jsonStr string, schema *Schema, cfg ...Config) ([]ValidationError, error)

// Processor 方法
func (p *Processor) ValidateSchema(jsonStr string, schema *Schema, cfg ...Config) ([]ValidationError, error)
```

返回值语义：

| 返回值 | 含义 |
|--------|------|
| `([]ValidationError{}, nil)` | JSON 合法且**满足全部约束** |
| `([]ValidationError{...}, nil)` | JSON 可解析，但存在约束违反（切片非空） |
| `(nil, error)` | 解析或前置失败（如 JSON 非法、`schema` 为 nil、超限） |

::: tip 关键区分
约束违反通过**返回切片**表达（`error` 仍为 `nil`）；只有解析失败、`schema` 为 nil、超出大小限制等情况才会返回非 `nil` 的 `error`。因此检查「是否通过验证」应看 `len(errs) == 0`，而非 `err != nil`。
:::

## 基础示例：对象结构与必填字段

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	schema := &json.Schema{
		Type:     "object",
		Required: []string{"name", "email"},
		Properties: map[string]*json.Schema{
			"name":  {Type: "string"},
			"email": {Type: "string", Format: "email"},
			"age":   {Type: "number"},
		},
	}

	// 缺少必填字段 email
	data := `{"name":"Alice","age":30}`

	errs, err := json.ValidateSchema(data, schema)
	if err != nil {
		panic(err)
	}
	for _, e := range errs {
		fmt.Printf("%s: %s\n", e.Path, e.Message)
	}
	// 输出：email: required property 'email' is missing
}
```

## Schema 约束字段总览

`Schema` 支持的约束字段（按类别分组）：

| 类别 | 字段 | 类型 | 适用类型 | 说明 |
|------|------|------|----------|------|
| 结构 | `Type` | `string` | 所有 | 取值见下表 |
| 结构 | `Required` | `[]string` | object | 必须出现的属性名列表 |
| 结构 | `Properties` | `map[string]*Schema` | object | 各属性对应的子 Schema |
| 结构 | `Items` | `*Schema` | array | 元素对应的子 Schema |
| 结构 | `AdditionalProperties` | `bool` | object | `true` 允许额外属性，`false` 拒绝 |
| 字符串 | `MinLength` / `MaxLength` | `int` | string | 长度区间（按 rune 计数） |
| 字符串 | `Pattern` | `string` | string | 正则表达式 |
| 字符串 | `Format` | `string` | string | 语义格式（见[Format 值表](#支持的-format-值)） |
| 数值 | `Minimum` / `Maximum` | `float64` | number / integer | 取值区间 |
| 数值 | `ExclusiveMinimum` / `ExclusiveMaximum` | `bool` | number / integer | 排除边界值 |
| 数值 | `MultipleOf` | `float64` | number / integer | 必须为该值的倍数 |
| 数组 | `MinItems` / `MaxItems` | `int` | array | 元素数量区间 |
| 数组 | `UniqueItems` | `bool` | array | `true` 要求元素唯一 |
| 取值 | `Enum` | `[]any` | 所有 | 允许的枚举值列表 |
| 取值 | `Const` | `any` | 所有 | 必须等于该固定值 |
| 元信息 | `Title` / `Description` | `string` | — | 文档性元数据，不参与校验 |
| 元信息 | `Default` | `any` | — | 文档性元数据，不参与校验 |
| 元信息 | `Examples` | `[]any` | — | 文档性元数据，不参与校验 |

`Type` 支持的取值：`object`、`array`、`string`、`number`、`integer`、`boolean`、`null`。

::: tip "number" 与 "integer" 的选取
JSON 解析后所有数字（含整数）都是 `float64`；`"number"` 接受一切数字。`"integer"` 按 JSON Schema 语义接受**数学上为整数**的值——`1`、`1.0`、`1e2` 均通过，`1.5` 报 `expected type integer, got float64` 错误。`Minimum`/`Maximum`/`MultipleOf` 等数值约束对 `number` 与 `integer` 均生效。
:::

## 对象约束：Required / Properties / AdditionalProperties

`AdditionalProperties` 控制是否允许出现 `Properties` 中未声明的属性。直接用结构体字面量构造 `Schema` 时该字段默认为 `false`（拒绝额外属性）：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	schema := &json.Schema{
		Type:     "object",
		Required: []string{"name"},
		Properties: map[string]*json.Schema{
			"name":  {Type: "string"},
			"email": {Type: "string"},
		},
		// AdditionalProperties 未设置，结构体字面量默认 false → 拒绝额外属性
	}

	// "extra" 未在 Properties 中声明
	data := `{"name":"Alice","extra":"x"}`

	errs, err := json.ValidateSchema(data, schema)
	if err != nil {
		panic(err)
	}
	for _, e := range errs {
		fmt.Printf("%s: %s\n", e.Path, e.Message)
	}
	// 输出：extra: additional property 'extra' is not allowed
}
```

::: tip 允许额外属性
若要放行额外属性，把 `AdditionalProperties` 设为 `true`，或用 [`DefaultSchema()`](#schema-的创建方式) 构造（其默认 `AdditionalProperties` 为 `true`）。
:::

## 字符串约束：MinLength / MaxLength / Pattern / Format

`MinLength`、`MaxLength`、`Minimum`、`Maximum`、`MinItems`、`MaxItems` 等约束**只在通过 `NewSchema` 创建时才生效**（原因见[创建方式](#schema-的创建方式)）。下面用 `SchemaConfig` 的指针字段设置长度，并用 `Pattern` 限定为小写字母：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	nameCfg := json.DefaultSchemaConfig()
	nameCfg.Type = "string"
	minLen, maxLen := 3, 10
	nameCfg.MinLength = &minLen
	nameCfg.MaxLength = &maxLen
	nameCfg.Pattern = `^[a-z]+$`
	nameSchema := json.NewSchema(nameCfg)

	schema := &json.Schema{
		Type:     "object",
		Required: []string{"name"},
		Properties: map[string]*json.Schema{
			"name": nameSchema,
		},
	}

	// "AB"：长度不足且含大写字母
	data := `{"name":"AB"}`

	errs, err := json.ValidateSchema(data, schema)
	if err != nil {
		panic(err)
	}
	for _, e := range errs {
		fmt.Printf("%s: %s\n", e.Path, e.Message)
	}
	// 输出：
	// name: string length 2 is less than minimum 3
	// name: string 'AB' does not match pattern '^[a-z]+$'
}
```

`Pattern` 在首次校验时惰性编译并缓存，同一 `*Schema` 可安全用于并发校验。若正则本身非法，每次校验都会报告该编译错误。

## 数值约束：Minimum / Maximum / MultipleOf

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	ageCfg := json.DefaultSchemaConfig()
	ageCfg.Type = "number"
	minVal, maxVal := 0.0, 120.0
	ageCfg.Minimum = &minVal
	ageCfg.Maximum = &maxVal
	mult := 5.0
	ageCfg.MultipleOf = &mult
	ageSchema := json.NewSchema(ageCfg)

	schema := &json.Schema{
		Type: "object",
		Properties: map[string]*json.Schema{
			"age": ageSchema,
		},
	}

	// 148：超出上限 120，且不是 5 的倍数
	data := `{"age":148}`

	errs, err := json.ValidateSchema(data, schema)
	if err != nil {
		panic(err)
	}
	for _, e := range errs {
		fmt.Printf("%s: %s\n", e.Path, e.Message)
	}
	// 输出：
	// age: number 148 exceeds maximum 120
	// age: number 148 is not a multiple of 5
}
```

`ExclusiveMinimum` / `ExclusiveMaximum` 需配合 `Minimum` / `Maximum` 一并通过 `SchemaConfig`（同为指针字段）设置，用于把边界值本身排除在外。`MultipleOf` 采用浮点容差比较（epsilon 1e-9），`0.1 + 0.2` 这类 IEEE 754 精度场景不会误报。

## 数组约束：Items / MinItems / MaxItems / UniqueItems

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	tagsCfg := json.DefaultSchemaConfig()
	tagsCfg.Type = "array"
	minItems, maxItems := 1, 3
	tagsCfg.MinItems = &minItems
	tagsCfg.MaxItems = &maxItems
	tagsCfg.UniqueItems = true
	tagsCfg.Items = &json.Schema{Type: "string"}
	tagsSchema := json.NewSchema(tagsCfg)

	schema := &json.Schema{
		Type: "object",
		Properties: map[string]*json.Schema{
			"tags": tagsSchema,
		},
	}

	// 4 个元素（超过上限 3），且 "a" 重复
	data := `{"tags":["a","a","b","c"]}`

	errs, err := json.ValidateSchema(data, schema)
	if err != nil {
		panic(err)
	}
	for _, e := range errs {
		fmt.Printf("%s: %s\n", e.Path, e.Message)
	}
	// 输出：
	// tags: array length 4 exceeds maximum 3
	// tags[1]: duplicate item found: a
}
```

`Items` 指定每个元素需满足的子 Schema（上例限定为字符串）；`UniqueItems` 按「**动态类型 + 值**」联合判重——`[1, "1"]` 会被视为两个不同元素，仅真正重复的值报错。

::: tip 递归深度保护
`Schema` 是递归类型，校验时对递归深度做了上限保护（`DefaultMaxNestingDepth` = 200）。自引用 Schema（如 `s.Items = s`）不会导致栈溢出，超过上限会产出一条 `schema nesting exceeds maximum depth` 错误。
:::

## 枚举与常量：Enum / Const

`Enum` 限定取值必须命中其一；`Const` 限定必须等于某个固定值。两者均通过直接比较生效，无需经 `NewSchema` 创建：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	schema := &json.Schema{
		Type: "object",
		Properties: map[string]*json.Schema{
			"role":   {Enum: []any{"admin", "user", "guest"}},
			"status": {Const: "active"},
		},
	}

	// role 不在枚举内；status 符合常量
	data := `{"role":"superuser","status":"active"}`

	errs, err := json.ValidateSchema(data, schema)
	if err != nil {
		panic(err)
	}
	for _, e := range errs {
		fmt.Printf("%s: %s\n", e.Path, e.Message)
	}
	// 输出：role: value 'superuser' is not in allowed enum values: [admin user guest]
}
```

## 支持的 Format 值

`Format` 字段支持的语义格式（未知格式会被静默跳过：不报错，也不做该项校验）：

| Format | 校验规则 |
|--------|----------|
| `email` | 校验本地部分、域名、TLD 结构与长度 |
| `date` | `YYYY-MM-DD` |
| `date-time` | RFC3339 |
| `time` | `HH:MM:SS` |
| `uri` | 必须包含 `://` |
| `uuid` | UUID 正则匹配 |
| `ipv4` | 4 段，每段 0–255 |
| `ipv6` | `net.ParseIP` 解析通过且包含 `:` |

## ValidationError 类型

每条约束违反都是一个 `ValidationError`，携带出错的 JSON 路径与描述：

```go
type ValidationError struct {
    Path    string `json:"path"`    // 错误路径（如 "user.email"、"tags[1]"）
    Message string `json:"message"` // 错误消息
}

func (ve *ValidationError) Error() string
```

由于 `ValidateSchema` 返回的是 `[]ValidationError` 切片，直接遍历读取 `Path` / `Message` 即可；`Error()` 方法用于把单条错误格式化为字符串（如需记日志）。

## Schema 的创建方式

构造 `Schema` 有三种方式，**关键区别在于长度/区间类约束是否生效**：

```go
// 1) 直接字面量：Type/Required/Properties/Items/Pattern/Format/Enum/Const/
//    UniqueItems/MultipleOf 立即生效；但 MinLength/MaxLength/Minimum/Maximum/
//    MinItems/MaxItems/ExclusiveMinimum/ExclusiveMaximum 不生效（见下方说明）
schema := &json.Schema{Type: "string", Pattern: `^\d+$`}

// 2) NewSchema：通过 SchemaConfig 的指针字段设置约束，长度/区间类全部生效
cfg := json.DefaultSchemaConfig()
cfg.Type = "string"
minLen := 1
cfg.MinLength = &minLen
schema := json.NewSchema(cfg)

// 3) DefaultSchema：返回带默认值的 Schema（AdditionalProperties 为 true）
schema := json.DefaultSchema()
```

::: warning 长度/区间约束必须用 NewSchema
`MinLength`、`MaxLength`、`Minimum`、`Maximum`、`MinItems`、`MaxItems`、`ExclusiveMinimum`、`ExclusiveMaximum` 这一组约束依赖 `Schema` 内部不可外部设置的跟踪标志。直接在 `&json.Schema{...}` 字面量中给这些字段赋值**不会生效**；必须通过 `NewSchema`（或其弃用别名 `NewSchemaWithConfig`）并传入对应的**指针字段**（如 `cfg.MinLength = &v`）才会被启用。`Type`、`Required`、`Properties`、`Items`、`Pattern`、`Format`、`Enum`、`Const`、`UniqueItems`、`MultipleOf` 则不受此限制，字面量与 `NewSchema` 均生效。
:::

### NewSchema

签名：`func NewSchema(cfg SchemaConfig) *Schema`

`NewSchema` 是创建已配置 Schema 的**规范构造函数**（与库内其他 `New*(cfg)` 构造器命名一致）：经 `SchemaConfig` 的指针字段启用长度/区间类约束，自动初始化 `Properties` / `Required`，并处理 `AdditionalProperties` 的默认值。

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "string"
minLen := 1
cfg.MinLength = &minLen
schema := json.NewSchema(cfg)
```

### NewSchemaWithConfig

<Badge type="danger" text="已废弃" />

签名：`func NewSchemaWithConfig(cfg SchemaConfig) *Schema`

使用指定配置创建 Schema。

::: warning 已废弃
`NewSchemaWithConfig` 与 [`NewSchema`](#newschema) 完全等价（直接委托同一实现）——「WithConfig」后缀早于统一的 Config 约定，库内其他构造器均不带该后缀。新代码请使用 `NewSchema(cfg)`。`NewSchemaWithConfig` 在 v1 生命周期内保留、不会移除。
:::

```go
// 与 json.NewSchema(cfg) 完全等价
schema := json.NewSchemaWithConfig(cfg)
```

### DefaultSchema

签名：`func DefaultSchema() *Schema`

`DefaultSchema` 返回带默认值的 Schema：`Properties` 初始化为空 map、`Required` 初始化为空切片、`AdditionalProperties` 为 `true`（放行额外属性），适合作为逐步填充的起点。

### DefaultSchemaConfig

签名：`func DefaultSchemaConfig() SchemaConfig`

`DefaultSchemaConfig` 返回 `NewSchema` 的默认入参：仅 `AdditionalProperties` 预置为指向 `true` 的指针，其余字段为零值；在其上设置 `Type` 与各指针字段后即可创建 Schema。

两者产出一致：`DefaultSchema()` 等价于 `NewSchema(DefaultSchemaConfig())`——默认都放行额外属性。

### SchemaConfig 字段

`SchemaConfig` 的字段集与 `Schema` 一一对应；其中数值/布尔类约束为**指针类型**——`nil` 表示未设置该约束，只有传入非 `nil` 指针，`NewSchema` 才会启用对应约束（这正是长度/区间类约束必须走 `NewSchema` 的原因，见[上方警告](#schema-的创建方式)）。

| 字段                    | 类型                  | 说明                                                       |
| ----------------------- | --------------------- | ---------------------------------------------------------- |
| `Type`                  | `string`              | JSON 类型（同 `Schema.Type`）                              |
| `Properties`            | `map[string]*Schema`  | 各属性对应的子 Schema（nil 时初始化为空 map）              |
| `Items`                 | `*Schema`             | 数组元素对应的子 Schema                                    |
| `Required`              | `[]string`            | 必须出现的属性名列表（nil 时初始化为空切片）               |
| `MinLength`             | `*int`                | 最小长度（nil = 未设置）                                   |
| `MaxLength`             | `*int`                | 最大长度（nil = 未设置）                                   |
| `Minimum`               | `*float64`            | 最小值（nil = 未设置）                                     |
| `Maximum`               | `*float64`            | 最大值（nil = 未设置）                                     |
| `Pattern`               | `string`              | 正则表达式                                                 |
| `Format`                | `string`              | 语义格式                                                   |
| `AdditionalProperties`  | `*bool`               | 是否允许额外属性（nil 按 `true` 处理；`DefaultSchemaConfig` 预置为指向 `true` 的指针） |
| `MinItems`              | `*int`                | 最少元素数（nil = 未设置）                                 |
| `MaxItems`              | `*int`                | 最多元素数（nil = 未设置）                                 |
| `UniqueItems`           | `bool`                | 要求元素唯一                                               |
| `Enum`                  | `[]any`               | 允许的枚举值列表                                           |
| `Const`                 | `any`                 | 必须等于的固定值                                           |
| `MultipleOf`            | `*float64`            | 倍数约束（nil = 未设置）                                   |
| `ExclusiveMinimum`      | `*bool`               | 排除下边界（nil = 未设置）                                 |
| `ExclusiveMaximum`      | `*bool`               | 排除上边界（nil = 未设置）                                 |
| `Title`                 | `string`              | 标题（元信息）                                             |
| `Description`           | `string`              | 描述（元信息）                                             |
| `Default`               | `any`                 | 默认值（元信息）                                           |
| `Examples`              | `[]any`               | 示例值（元信息）                                           |

推荐始终通过 `NewSchema`（`func NewSchema(cfg SchemaConfig) *Schema`）创建已配置的 Schema——它是指针约束唯一可靠的启用途径，且会自动初始化 `Properties` / `Required` 并处理 `AdditionalProperties` 的默认值。

## Config 中的验证相关字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `EnableValidation` | `bool` | 已废弃：不被任何操作读取（校验默认始终执行，除非 `SkipValidation`），仅参与配置缓存键 |
| `ValidateInput` | `bool` | 已废弃：不被任何操作读取，设置后不改变行为 |
| `SkipValidation` | `bool` | 跳过非必要校验（仅用于可信输入） |

::: warning 已废弃的扩展字段
`Config.CustomValidators`（`[]Validator`）与 `Validator` 接口**已废弃**（源码标注 Deprecated）：已声明并参与配置克隆与缓存键计算，但验证器**从不被任何公开操作执行**。通过 `Config.CustomValidators`（或 `Config.AddValidator`）注册验证器不会影响任何操作的执行——操作不会被自定义验证器拒绝。两者在 v1 生命周期内保留：

```go
// 已废弃：已声明但从不执行，注册后对操作无影响
type Validator interface {
    Validate(jsonStr string) error
}
```

如需在操作前后做自定义校验，请使用已生效的 [Hooks 钩子](../extensions/hooks)（例如 `ValidationHook`）。
:::

## 相关

- [接口定义](./interfaces) - `Validator` 接口（已废弃）与 `Schema` 相关类型
- [类型定义](./types) - 核心类型（Config / Schema / Stats / AccessResult）
- [解析验证](./functions/parse) - Parse / Valid / ValidateSchema 函数
- [配置选项](./config) - 验证相关配置字段
- [Hooks 钩子](../extensions/hooks) - 已生效的操作前后拦截机制（含 `ValidationHook`）
