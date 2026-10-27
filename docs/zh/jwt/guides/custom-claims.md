---
sidebar_label: "自定义 Claims"
title: "自定义 Claims - CyberGo JWT | 业务声明接口"
description: "自定义 Claims 指南：实现 CustomClaims 接口定义业务专属声明字段，比较内置 Claims 与自定义类型在类型安全、创建时深度校验上的差异，并用完整示例演示 Create、ParseInto、RefreshInto 的用法与业务校验模板。"
sidebar_position: 20
---

# 自定义 Claims

内置的 [`Claims`](../api-reference/claims#claims) 结构覆盖了常见场景，但业务系统通常需要额外字段。通过实现 `CustomClaims` 接口可以定义自己的 Claims 结构。

## CustomClaims 接口

```go
type CustomClaims interface {
    GetRegisteredClaims() *RegisteredClaims
    Validate() error
}
```

只需实现两个方法：

| 方法 | 说明 |
|------|------|
| `GetRegisteredClaims()` | 返回标准 JWT 字段（iss、sub、aud 等） |
| `Validate()` | 自定义验证逻辑 |

## Extra 字段 vs 自定义类型

存储业务字段有两种方式：使用内置 [`Claims.Extra`](../api-reference/claims#claims) 字段，或定义自定义 Claims 类型。两者各有取舍，下表同时给出校验差异。

### 对比

| 维度 | 内置 `*Claims`（含 `Extra`） | 自定义 Claims 类型 |
|------|------------------------------|-------------------|
| 类型安全 | 否：`Extra` 值为 `any`，需类型断言 | 是：编译期类型检查 |
| IDE 补全 | 否：`Extra` 的 map 键无提示 | 是：字段自动补全 |
| 验证路径 | 只做 `Validate()` 与标准声明字符串清洗 | 同左 |
| 创建时深度校验 | 是：长度 ≤ 256 字节、数组 ≤ 100 项、注入模式、控制字符 | 否：仅 `Validate()` + 标准声明清洗 |
| `Extra` 字段限制 | 是：≤ 50 键、仅 `string`/`[]string` | 不适用 |
| 自定义验证 | 否：只能使用库内置规则 | 是：在 `Validate()` 中自由实现 |
| 嵌套结构 | 否：`Extra` 不支持嵌套 map | 是：任意结构体 |
| 适用场景 | 少量可选附加字段 | 核心业务字段、需自定义校验 |

深度字段校验只在令牌创建时执行。验证路径只调用 `Validate()`（必填字段）并清洗标准声明字符串。

### Extra 字段的限制

内置 `Claims.Extra` 是 `map[string]any`，Processor 在**创建令牌时**对其执行深度验证：

| 限制项 | 约束 |
|--------|------|
| 最大键数 | 50 个 |
| 允许的值类型 | 仅 `string` 和 `[]string` |
| 嵌套 map | 拒绝（返回 `ValidationError`） |
| 字符串值长度 | ≤ 256 字节（UTF-8 编码后） |
| 注入模式检测 | 与其他字符串字段一致 |

数组值经 `Parse` 回读后类型是 `[]any`，不是 `[]string`，读取时需要逐项断言。

```go
// ✅ 合法 — 仅 string 与 []string 值
claims := &jwt.Claims{
    UserID: "user1",
    Extra: map[string]any{
        "team_id": "team-abc",            // string
        "tags":    []string{"vip", "qa"}, // []string
    },
}

// ❌ 非法 — 嵌套 map 会被深度验证拒绝
claims = &jwt.Claims{
    Extra: map[string]any{
        "profile": map[string]any{"age": 30}, // ValidationError: nested maps not allowed
    },
}
```

::: tip 如何选择
- **少量、可选、扁平**的附加信息（如 `team_id`、`tags`）：用 `Extra`，由库内置深度验证，无需自己写校验。
- **核心业务字段**，或需要枚举、跨字段约束、类型安全的场景：定义自定义 Claims 类型，在 `Validate()` 中实现业务规则。

自定义结构体字段不被深度验证，需自行补充长度与注入检查，见下方[安全影响与校验模板](#安全影响与校验模板)。
:::

## 定义自定义 Claims

```go
type MyClaims struct {
    UserID string `json:"user_id"`
    Email  string `json:"email"`
    Role   string `json:"role"`
    jwt.RegisteredClaims
}

func (c *MyClaims) GetRegisteredClaims() *jwt.RegisteredClaims {
    return &c.RegisteredClaims
}

func (c *MyClaims) Validate() error {
    if c.UserID == "" {
        return errors.New("user_id is required")
    }
    if c.Email == "" {
        return errors.New("email is required")
    }
    return nil
}
```

:::tip 关键点
- 必须嵌入 `jwt.RegisteredClaims`
- `GetRegisteredClaims()` 返回嵌入字段的指针
- `Validate()` 在令牌创建和验证时都会被调用
:::

## 使用自定义 Claims

### 创建令牌

```go
claims := &MyClaims{
    UserID: "user123",
    Email:  "alice@example.com",
    Role:   "admin",
}
token, err := processor.Create(claims)
```

### 验证到自定义结构

使用 `ParseInto` 将令牌解析到自定义结构：

```go
myClaims := &MyClaims{}
result, err := processor.ParseInto(token, myClaims)
if err != nil {
    panic(err)
}
parsed := result.(*MyClaims)
fmt.Println("UserID:", parsed.UserID)
fmt.Println("Email:", parsed.Email)
```

### 刷新到自定义结构

使用 `RefreshInto` 刷新令牌并保持自定义字段：

```go
newToken, err := processor.RefreshInto(refreshToken, &MyClaims{})
if err != nil {
    panic(err)
}
```

:::warning 时序字段保护
`RefreshInto` 会自动恢复 Claims 的时序字段（`IssuedAt`、`ExpiresAt`、`ID`），即使操作失败也能保证恢复。
:::

## 复杂验证示例

自定义 Claims 的真正价值在于 `Validate()` 中实现业务规则。下面的示例演示必填校验、枚举值约束和跨字段约束：

```go
package main

import (
	"errors"
	"fmt"

	"github.com/cybergodev/jwt"
)

// AccountClaims 携带账户层级与设备配额的业务声明
type AccountClaims struct {
	UserID    string   `json:"user_id"`
	Tier      string   `json:"tier"`   // free | pro | enterprise
	Region    string   `json:"region"` // cn | us | eu
	DeviceIDs []string `json:"device_ids"`
	jwt.RegisteredClaims
}

// 各层级的最大设备数
var tierMaxDevices = map[string]int{
	"free":       2,
	"pro":        10,
	"enterprise": 100,
}

var allowedRegions = map[string]bool{"cn": true, "us": true, "eu": true}

func (c *AccountClaims) GetRegisteredClaims() *jwt.RegisteredClaims {
	return &c.RegisteredClaims
}

func (c *AccountClaims) Validate() error {
	// 1. 必填字段校验
	if c.UserID == "" {
		return errors.New("user_id is required")
	}

	// 2. 枚举值校验
	if _, ok := tierMaxDevices[c.Tier]; !ok {
		return fmt.Errorf("invalid tier %q: must be free, pro or enterprise", c.Tier)
	}
	if !allowedRegions[c.Region] {
		return fmt.Errorf("invalid region %q: must be cn, us or eu", c.Region)
	}

	// 3. 跨字段约束：设备数不能超过该层级配额
	if max := tierMaxDevices[c.Tier]; len(c.DeviceIDs) > max {
		return fmt.Errorf("tier %q allows at most %d devices, got %d",
			c.Tier, max, len(c.DeviceIDs))
	}

	return nil
}

func main() {
	cfg := jwt.DefaultConfig()
	cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
	processor, err := jwt.New(cfg)
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	// 合法规牌：pro 层级，3 台设备（≤ 10）
	valid := &AccountClaims{
		UserID:    "user123",
		Tier:      "pro",
		Region:    "cn",
		DeviceIDs: []string{"dev-1", "dev-2", "dev-3"},
	}
	_, err = processor.Create(valid)
	if err != nil {
		panic(err)
	}
	fmt.Println("Token created successfully")

	// 违法规牌：free 层级配 5 台设备（> 2）→ Validate() 拒绝
	_, err = processor.Create(&AccountClaims{
		UserID:    "user456",
		Tier:      "free",
		Region:    "us",
		DeviceIDs: []string{"d1", "d2", "d3", "d4", "d5"},
	})
	fmt.Println("Over-quota error:", err)
	// 输出：Over-quota error: invalid claims: tier "free" allows at most 2 devices, got 5
}
```

::: tip 错误包装
`Validate()` 返回的描述性错误会被 `ErrInvalidClaims` 包装。调用方既可用 `errors.Is(err, jwt.ErrInvalidClaims)` 判断类别，也可直接读取错误字符串获取业务细节。详见[错误处理](./error-handling#错误包装链)。
:::

## 验证差异

内置 `*Claims` 和自定义类型走两条不同的校验路径，完整对照见上方[对比](#对比)表。要点有两条。

**创建时**：内置 `*Claims` 执行深度校验（长度、数组规模、注入模式、控制字符）；自定义类型只执行 `Validate()` 与标准声明字符串清洗。

**验证时**：两者都只调用 `Validate()` 并清洗标准声明字符串，不重复深度校验。

:::warning 安全影响
自定义 Claims 的业务字段**不会**被深度验证。若恶意输入通过签名校验后被解析进自定义结构体，`<script>` 标签、SQL 片段、超长字符串等危险内容会原样存入令牌。此时内置 `*Claims` 的注入检测、256 字节长度限制、控制字符过滤均不生效。务必在 `Validate()` 中实现必要校验，否则令牌可能成为 XSS/SQL 注入的载体。
:::

### 安全影响与校验模板

下面的辅助函数复刻了内置深度验证的核心逻辑（长度上限、控制字符、注入子串），可在自定义 Claims 的 `Validate()` 中直接调用：

```go
package main

import (
	"errors"
	"fmt"
	"strings"
)

const maxClaimLength = 256 // 字节数（UTF-8），与库内置上限一致

// dangerousSubstrings 列出与库内置检测重叠的高危子串，可按业务增删。
var dangerousSubstrings = []string{
	"<script", "javascript:", "onerror=", "onload=",
	"drop table", "union select", "../", "/etc/passwd",
}

// validateField 校验自定义字段的长度、控制字符和常见注入模式。
func validateField(name, value string) error {
	if len(value) > maxClaimLength {
		return fmt.Errorf("%s exceeds maximum length of %d", name, maxClaimLength)
	}
	for i := 0; i < len(value); i++ {
		c := value[i]
		if c < 32 && c != '\t' && c != '\n' && c != '\r' {
			return fmt.Errorf("%s contains invalid control character", name)
		}
	}
	lower := strings.ToLower(value)
	for _, pattern := range dangerousSubstrings {
		if strings.Contains(lower, pattern) {
			return fmt.Errorf("%s contains suspicious pattern", name)
		}
	}
	return nil
}

type MyClaims struct {
	UserID     string `json:"user_id"`
	Department string `json:"department"`
}

func (c *MyClaims) Validate() error {
	if c.UserID == "" {
		return errors.New("user_id is required")
	}
	// 自定义字段不享受内置深度验证，手动补齐长度与注入检查
	if err := validateField("user_id", c.UserID); err != nil {
		return err
	}
	if err := validateField("department", c.Department); err != nil {
		return err
	}
	return nil
}

func main() {}
```

## 可选接口：RateLimitKeyer

自定义 Claims 可以实现 `RateLimitKeyer` 接口提供限流 key：

```go
func (c *MyClaims) RateLimitKey() string {
    return c.Email // 使用 Email 作为限流 key
}
```

限流 key 查找优先级：`Subject` → `*Claims.UserID` → `RateLimitKey()`。

## 下一步

- [API 参考 → 接口定义](../api-reference/interfaces#customclaims) — CustomClaims 完整定义
- [API 参考 → Processor](../api-reference/processor#parseinto) — ParseInto / RefreshInto 方法
- [高级示例](../examples/advanced) — 自定义 Claims 完整示例
