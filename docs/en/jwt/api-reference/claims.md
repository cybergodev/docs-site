---
title: "Claims - JWT API Reference"
description: "CyberGo JWT Claims API reference covering Claims built-in business fields (UserID, Username, Role, etc.), RegisteredClaims RFC 7519 standard claims, and deep validation constraints."
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

The Processor performs additional deep validation during token creation and validation (via the internal `validateClaims` function):

| Rule | Limit |
|------|-------|
| String field length | Max 256 characters |
| Array field size | Max 100 items |
| `Extra` field count | Max 50 keys |
| `Extra` value types | Only `string` and `[]string` allowed; nested maps and other types are rejected |
| Control characters | Characters other than tab, newline, and carriage return are rejected |
| Injection pattern detection | Rejected when containing HTML/SQL/path traversal patterns |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `GetRegisteredClaims` | `func (c *Claims) GetRegisteredClaims() *RegisteredClaims` | Returns the embedded standard fields |
| `Validate` | `func (c *Claims) Validate() error` | Checks that at least one of UserID or Username is non-empty |

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
