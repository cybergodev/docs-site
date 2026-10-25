---
sidebar_label: "Claims"
title: "Claims - CyberGo JWT | 内置声明结构"
description: "Claims 是 CyberGo JWT 的内置声明结构，包含 UserID、Username、Role、权限列表、作用域、会话与客户端标识、Extra 扩展字段，并嵌入 RFC 7519 注册声明。本页说明各字段类型、创建时的深度校验规则与长度上限、Extra 数组值的回读类型，以及主要方法签名。"
sidebar_position: 40
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

深度字段校验只在令牌创建时执行。验证路径只调用 `Validate()`（必填字段）并清洗标准声明字符串。深度校验规则如下：

| 规则 | 限制 |
|------|------|
| 字符串字段长度 | 不超过 256 字节（UTF-8 编码后）；中文约 85 字，英文约 256 字符 |
| 数组字段大小 | 最大 100 项 |
| `Extra` 字段数 | 最大 50 个键 |
| `Extra` 值类型 | 仅允许 `string`、`[]string`，嵌套 map 和其他类型拒绝 |
| 控制字符 | 除 tab、换行、回车外的控制字符拒绝 |
| 注入模式检测 | 包含 HTML/SQL/路径遍历等危险模式时拒绝 |

`Extra` 的数组值经 `Parse` 回读为 `[]any`，而不是写入时的 `[]string`。读取时应按 `[]any` 断言，再逐项转换为 `string`。

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `GetRegisteredClaims` | `func (c *Claims) GetRegisteredClaims() *RegisteredClaims` | 返回嵌入的标准字段 |
| `Validate` | `func (c *Claims) Validate() error` | 检查 UserID 或 Username 至少有一个非空 |
| `MarshalJSON` | `func (c *Claims) MarshalJSON() ([]byte, error)` | 实现 `json.Marshaler`，字段顺序与 `omitempty` 行为同 `encoding/json` |
| `UnmarshalJSON` | `func (c *Claims) UnmarshalJSON(data []byte) error` | 实现 `json.Unmarshaler`，先走快速扫描，必要时回退到 `encoding/json` |
| `AppendJSON` | `func (c *Claims) AppendJSON(dst []byte) ([]byte, error)` | 高级 API，把编码追加到 `dst` 并返回扩展后的切片 |
| `UnmarshalFastJSON` | `func (c *Claims) UnmarshalFastJSON(data []byte) error` | 高级 API，对解码后的 JWT 载荷运行快速扫描 |

`MarshalJSON` / `UnmarshalJSON` 由 `encoding/json` 与库的签名、解析管道自动调用，常规业务代码无需直接调用。

::: info 仅供高级用法
`AppendJSON` 与 `UnmarshalFastJSON` 属于高级 API（Advanced API），供分配敏感路径使用。`AppendJSON` 的字节输出与 `json.Marshal(*Claims)` 一致，只追加、不改写 `dst` 中的已有字节。`UnmarshalFastJSON` 返回非 nil 错误时，调用方有义务用 `encoding/json` 重新解码，此时接收者内容状态未定义。常规代码应改用 `MarshalJSON` / `UnmarshalJSON`。
:::

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
