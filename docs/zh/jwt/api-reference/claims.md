---
title: "Claims - CyberGo JWT | 内置声明结构"
description: "Claims 是 CyberGo JWT 内置声明结构，含 UserID、Username、Role、权限、作用域等业务字段与 RFC 7519 RegisteredClaims，附带字段长度、数组大小与注入模式验证约束。"
---

# Claims

## Claims

```go
type Claims struct {
    UserID      string         `json:"user_id,omitempty"`
    Username    string         `json:"username,omitempty"`
    Role        string         `json:"role,omitempty"`
    Permissions []string       `json:"permissions,omitempty"`
    Scopes      []string       `json:"scopes,omitempty"`
    Extra       map[string]any `json:"extra,omitempty"`
    SessionID   string         `json:"session_id,omitempty"`
    ClientID    string         `json:"client_id,omitempty"`
    RegisteredClaims
}
```

内置 Claims 结构，包含常用业务字段和标准 JWT 字段。

<Badge type="info" text="struct" />

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `UserID` | `string` | 用户 ID |
| `Username` | `string` | 用户名 |
| `Role` | `string` | 角色 |
| `Permissions` | `[]string` | 权限列表 |
| `Scopes` | `[]string` | 作用域列表 |
| `Extra` | `map[string]any` | 自定义扩展字段 |
| `SessionID` | `string` | 会话 ID |
| `ClientID` | `string` | 客户端 ID |
| `RegisteredClaims` | `RegisteredClaims` | 标准 JWT 字段 |

### 验证规则

`Validate()` 方法检查 `UserID` 或 `Username` 至少有一个非空。

Processor 在令牌创建和验证时会执行额外的深度验证（通过内部 `validateClaims` 函数）：

| 规则 | 限制 |
|------|------|
| 字符串字段长度 | 最大 256 字符 |
| 数组字段大小 | 最大 100 项 |
| `Extra` 字段数 | 最大 50 个键 |
| `Extra` 值类型 | 仅允许 `string`、`[]string`，嵌套 map 和其他类型拒绝 |
| 控制字符 | 除 tab、换行、回车外的控制字符拒绝 |
| 注入模式检测 | 包含 HTML/SQL/路径遍历等危险模式时拒绝 |

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `GetRegisteredClaims` | `func (c *Claims) GetRegisteredClaims() *RegisteredClaims` | 返回嵌入的标准字段 |
| `Validate` | `func (c *Claims) Validate() error` | 检查 UserID 或 Username 至少有一个非空 |

---

## RegisteredClaims

```go
type RegisteredClaims struct {
    Issuer    string        `json:"iss,omitempty"`
    Subject   string        `json:"sub,omitempty"`
    Audience  StringOrSlice `json:"aud,omitempty"`
    ExpiresAt NumericDate   `json:"exp"`
    NotBefore NumericDate   `json:"nbf"`
    IssuedAt  NumericDate   `json:"iat"`
    ID        string        `json:"jti,omitempty"`
    TokenType string        `json:"token_type,omitempty"`
}
```

标准 JWT 注册声明（RFC 7519）。

<Badge type="info" text="struct" />

### 字段

| 字段 | 类型 | JSON Tag | 说明 |
|------|------|----------|------|
| `Issuer` | `string` | `iss` | 签发者 |
| `Subject` | `string` | `sub` | 主题 |
| `Audience` | `StringOrSlice` | `aud` | 受众 |
| `ExpiresAt` | `NumericDate` | `exp` | 过期时间 |
| `NotBefore` | `NumericDate` | `nbf` | 生效时间 |
| `IssuedAt` | `NumericDate` | `iat` | 签发时间 |
| `ID` | `string` | `jti` | 令牌 ID |
| `TokenType` | `string` | `token_type` | 令牌类型（`access` 或 `refresh`，见 [TokenType 常量](./types#令牌类型常量)） |
