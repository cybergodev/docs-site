---
sidebar_label: "Claims"
title: "Claims - CyberGo JWT | Claim Structs"
description: "The built-in CyberGo JWT Claims struct carries UserID, Username, Role, permissions, scopes, and Extra plus RFC 7519 RegisteredClaims, with validation limits."
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

Built-in Claims structure containing common business fields and standard JWT fields.

<Badge type="info" text="struct" />

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `UserID` | `string` | User ID |
| `Username` | `string` | Username |
| `Role` | `string` | Role |
| `Permissions` | `[]string` | Permission list |
| `Scopes` | `[]string` | Scope list |
| `Extra` | `map[string]any` | Custom extension fields |
| `SessionID` | `string` | Session ID |
| `ClientID` | `string` | Client ID |
| `RegisteredClaims` | `RegisteredClaims` | Standard JWT fields |

### Validation Rules

The `Validate()` method checks that at least one of `UserID` or `Username` is non-empty.

Deep field validation runs only when a token is created. The validation path calls `Validate()` (required fields) and sanitizes the standard claim strings. The deep rules are:

| Rule | Limit |
|------|-------|
| String field length | At most 256 bytes after UTF-8 encoding; about 85 Chinese characters, or 256 ASCII characters |
| Array field size | Max 100 items |
| `Extra` field count | Max 50 keys |
| `Extra` value types | Only `string` and `[]string` allowed; nested maps and other types are rejected |
| Control characters | Characters other than tab, newline, and carriage return are rejected |
| Injection pattern detection | Rejected when containing HTML/SQL/path traversal patterns |

Array values in `Extra` read back from `Parse` as `[]any`, not the `[]string` that was written. Read them with a `[]any` assertion, then convert each item to `string`.

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `GetRegisteredClaims` | `func (c *Claims) GetRegisteredClaims() *RegisteredClaims` | Returns the embedded standard fields |
| `Validate` | `func (c *Claims) Validate() error` | Checks that at least one of UserID or Username is non-empty |
| `MarshalJSON` | `func (c *Claims) MarshalJSON() ([]byte, error)` | Implements `json.Marshaler`; field order and `omitempty` behavior match `encoding/json` |
| `UnmarshalJSON` | `func (c *Claims) UnmarshalJSON(data []byte) error` | Implements `json.Unmarshaler`; runs a fast scan first and falls back to `encoding/json` when needed |
| `AppendJSON` | `func (c *Claims) AppendJSON(dst []byte) ([]byte, error)` | Advanced API; appends the encoding to `dst` and returns the extended slice |
| `UnmarshalFastJSON` | `func (c *Claims) UnmarshalFastJSON(data []byte) error` | Advanced API; runs the fast scan over a decoded JWT payload |

`MarshalJSON` / `UnmarshalJSON` are called automatically by `encoding/json` and by the library's signing and parsing pipelines; regular business code rarely needs to call them.

::: info Advanced Use Only
`AppendJSON` and `UnmarshalFastJSON` are Advanced APIs intended for allocation-sensitive paths. `AppendJSON` produces the same bytes as `json.Marshal(*Claims)` and only appends — it never rewrites existing bytes in `dst`. When `UnmarshalFastJSON` returns a non-nil error, the caller must re-decode with `encoding/json`; the receiver's contents are undefined at that point. Regular code should use `MarshalJSON` / `UnmarshalJSON` instead.
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

Standard JWT registered claims (RFC 7519).

<Badge type="info" text="struct" />

### Fields

| Field | Type | JSON Tag | Description |
|-------|------|----------|-------------|
| `Issuer` | `string` | `iss` | Issuer |
| `Subject` | `string` | `sub` | Subject |
| `Audience` | `StringOrSlice` | `aud` | Audience |
| `ExpiresAt` | `NumericDate` | `exp` | Expiration time |
| `NotBefore` | `NumericDate` | `nbf` | Not-before time |
| `IssuedAt` | `NumericDate` | `iat` | Issued-at time |
| `ID` | `string` | `jti` | Token ID |
| `TokenType` | `string` | `token_type` | Token type (`access` or `refresh`; see [Token Type Constants](./types#token-type-constants)) |
