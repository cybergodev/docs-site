---
sidebar_label: "Sensitive Data Filtering"
title: "Sensitive Data Filtering - CyberGo DD | Redaction"
description: "CyberGo DD sensitive data filtering: built-in patterns, custom regex, five security levels, HIPAA/PCI-DSS/government presets, and redaction statistics."
sidebar_position: 4
---

# Sensitive Data Filtering

DD has built-in automatic sensitive data filtering that replaces passwords, API keys, credit card numbers, and other sensitive information with `[REDACTED]` before logs are written, preventing sensitive data from leaking into logs.

## Quick Enable

```go
logger, err := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()

// password field automatically redacted
logger.InfoWith("user login",
    dd.String("username", "alice"),
    dd.String("password", "s3cr3t123"),    // output: password=[REDACTED]
)
```

## Built-in Filtering Patterns

`DefaultSecurityConfig()` enables basic filtering covering the following sensitive information:

| Category | Matching Targets |
|----------|-----------------|
| Passwords | `password`, `passwd`, `pwd`, and similar fields |
| API Keys | `api_key`, `apikey`, `access_token`, etc. |
| Credit Cards | Visa, MasterCard, and other card number formats |
| SSN | US Social Security Number format |
| Phone Numbers | Global phone number formats (including international) |

`DefaultSecureConfig()` adds the following on top of the basics:

| Category | Matching Targets |
|----------|-----------------|
| Emails | Email address format |
| IP Addresses | IPv4/IPv6 addresses |
| JWT Tokens | JWT format starting with `eyJ` |
| Connection Strings | Passwords in database connection strings |

## Custom Filtering Patterns

### Adding Custom Patterns

```go
filter := dd.NewEmptySensitiveDataFilter()

// Add custom regex patterns (built-in ReDoS protection)
_ = filter.AddPattern(`(?i)credit_card\s*[:=]\s*\d+`)
_ = filter.AddPattern(`(?i)phone\s*[:=]\s*\d{11}`)

logger, err := dd.New(dd.Config{
    Security: &dd.SecurityConfig{
        SensitiveFilter: filter,
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### Creating a Custom Filter from Scratch

```go
filter, err := dd.NewCustomSensitiveDataFilter(
    `(?i)secret_key\s*[:=]\s*\S+`,
    `(?i)private_token\s*[:=]\s*\S+`,
)
if err != nil {
    log.Fatal(err) // Regex safety validation failed
}
```

:::warning ReDoS Protection
`NewCustomSensitiveDataFilter` has built-in ReDoS validation. If a regex pattern poses a catastrophic backtracking risk, it will return an error. Use non-greedy matching and anchored patterns to avoid this issue.
:::

## Security Levels

DD provides five security levels, each with a corresponding preset configuration:

```go
// Get configuration by level
cfg := dd.SecurityConfigForLevel(dd.SecurityLevelStandard)
```

| Level | Description | Use Case |
|-------|-------------|----------|
| `SecurityLevelDevelopment` | Most lenient | Local development |
| `SecurityLevelBasic` | Basic filtering | Test environments |
| `SecurityLevelStandard` | Standard filtering | General production |
| `SecurityLevelStrict` | Strict filtering | High-security requirements |
| `SecurityLevelParanoid` | Most strict | Sensitive industries like finance/healthcare |

## Industry Compliance Presets

DD provides three industry compliance configurations:

### HIPAA (Healthcare)

```go
cfg := dd.HealthcareConfig()
```

Additional filtering: ICD-10 codes, Medical Record Numbers (MRN), Health Insurance Claim Numbers (HICN), patient identifiers.

### PCI-DSS (Financial Payments)

```go
cfg := dd.FinancialConfig()
```

Additional filtering: SWIFT codes, IBAN account numbers, CVV/CVC, bank routing numbers.

### Government Standards

```go
cfg := dd.GovernmentConfig()
```

Additional filtering: Passport numbers, driver's license numbers, tax IDs, SSN variants.

### Complete Example

```go
// Healthcare system: using HIPAA compliance configuration
logger, err := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.HealthcareConfig(),
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/hipaa-audit.json"),
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()

// Log messages containing sensitive info are automatically redacted
logger.Info("patient record mrn=MRN-123456 diagnosis=J18.9 updated")
// MRN and ICD-10 code patterns in the message are redacted

// Structured fields are filtered by key-name sensitivity
logger.InfoWith("user login",
    dd.String("password", "s3cr3t123"),    // → [REDACTED] (sensitive key)
    dd.String("department", "internal medicine"), // normal output
)
```

## Filtering Statistics

Monitor the filter's operational status:

```go
filter := dd.NewSensitiveDataFilter()
stats := filter.GetFilterStats()
fmt.Printf("active goroutines: %d\n", stats.ActiveGoroutines)
fmt.Printf("filter patterns: %d\n", stats.PatternCount)
fmt.Printf("total redactions: %d\n", stats.TotalRedactions)
fmt.Printf("timeouts: %d\n", stats.TotalTimeouts)
```

## Disabling Filtering

```go
// Use SecurityLevelDevelopment (no sensitive data filtering)
logger, err := dd.New(dd.Config{
    Security: dd.SecurityConfigForLevel(dd.SecurityLevelDevelopment),
})
if err != nil {
    log.Fatal(err)
}

// Or manually set SensitiveFilter to nil
logger, err = dd.New(dd.Config{
    Security: &dd.SecurityConfig{
        SensitiveFilter: nil,
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

:::warning Filtering Enabled by Default
`DefaultConfig()` enables basic sensitive data filtering by default (`DefaultSecurityConfig()`). When the `Security` field is not set, the default security configuration is also used. To disable filtering, you must explicitly set `SensitiveFilter` to `nil`.
:::

## Next Steps

- [Audit Logging](./audit-logging) -- Security event auditing
- [Industry Compliance Configuration](../security/compliance) -- HIPAA/PCI-DSS details
- [API Reference - Security](../api-reference/security-audit/security) -- Security API complete documentation
- [Production Checklist](../security/production-checklist) -- Pre-launch checks
