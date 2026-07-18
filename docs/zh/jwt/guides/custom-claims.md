---
sidebar_label: "自定义 Claims"
title: "自定义 Claims - CyberGo JWT | 业务声明接口"
description: "自定义 Claims 指南：实现 CustomClaims 接口定义业务专属声明字段，对比内置 Claims 与自定义类型的验证差异，演示 ValidateInto 与 RefreshInto 解析刷新用法。"
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

使用 `ValidateInto` 将令牌解析到自定义结构：

```go
myClaims := &MyClaims{}
result, valid, err := processor.ValidateInto(token, myClaims)
if err != nil {
    panic(err)
}
if valid {
    parsed := result.(*MyClaims)
    fmt.Println("UserID:", parsed.UserID)
    fmt.Println("Email:", parsed.Email)
}
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

## 验证差异

内置 `*Claims` 和自定义类型走不同的验证路径：

| 验证项 | `*Claims` | 自定义类型 |
|--------|-----------|------------|
| `Validate()` 方法 | ✅ | ✅ |
| 字符串长度限制（256 字符） | ✅ | ❌ |
| 数组大小限制（100 项） | ✅ | ❌ |
| 注入模式检测 | ✅ | ❌ |
| 控制字符过滤 | ✅ | ❌ |
| `Extra` 字段限制 | ✅ | 不适用 |
| 注册声明字符串清洗 | ✅ | ✅ |

:::warning 重要
自定义 Claims 的业务字段**不会**被深度验证。请在 `Validate()` 方法中自行实现所有必要的校验。
:::

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
- [API 参考 → Processor](../api-reference/processor#validateinto) — ValidateInto / RefreshInto 方法
- [高级示例](../examples/advanced) — 自定义 Claims 完整示例
