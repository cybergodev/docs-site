---
sidebar_label: "Sensitive Data Filtering"
title: "Sensitive Data Filtering - CyberGo DD | Auto-Redaction Guide"
description: "CyberGo DD sensitive-data filtering configuration guide, covering built-in filter patterns (passwords, API keys, credit cards, SSNs, JWTs, etc.), custom regex patterns, five security levels, industry-compliance presets (HIPAA, PCI-DSS, government standards), and filter statistics and monitoring, to help you build a compliant log-redaction solution."
sidebar_position: 4
---

# Sensitive Data Filtering

DD has built-in automatic sensitive-data filtering that replaces passwords, API keys, credit card numbers, and other sensitive information with `[REDACTED]` before logs are written, preventing leakage into logs.

## Quick Enable

```go
logger, err := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()

// The password field is redacted automatically
logger.InfoWith("user login",
    dd.String("username", "alice"),
    dd.String("password", "s3cr3t123"),    // Output: password=[REDACTED]
)
```

## Built-in Filter Patterns

`DefaultSecurityConfig()` enables basic filtering, covering the following sensitive information:

| Category | Matched Targets |
|----------|-----------------|
| Passwords | `password`, `passwd`, `pwd`, etc. fields |
| API Keys | `api_key`, `apikey`, `access_token`, etc. |
| Credit cards | Visa, MasterCard, and other card-number formats |
| SSN | US Social Security Number format |
| Phone numbers | Global phone-number formats (including international) |

`DefaultSecureConfig()` uses the **full pattern set** (all of basic plus the following common categories):

| Category | Matched Targets |
|----------|-----------------|
| Emails | email address format |
| IP addresses | IPv4/IPv6 addresses |
| JWT tokens | JWT format starting with `eyJ` |
| Connection strings | passwords inside database connection strings |

:::info Pattern Coverage
The table above only lists common-category examples. `DefaultSecurityConfig()` actually ships about 36 patterns; industry presets (e.g. `HealthcareConfig()`) can reach 71. They also cover AWS keys, Stripe/GitHub/Slack tokens, IBAN, multi-country tax IDs, Log4Shell, and more. See the source `internal/patterns.go` for the full pattern set.
:::

## Custom Filter Patterns

### Adding Custom Patterns

```go
filter := dd.NewEmptySensitiveDataFilter()

// Add custom regex patterns (with built-in ReDoS protection)
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

### Creating a Custom Filter From Scratch

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
`NewCustomSensitiveDataFilter` has built-in ReDoS validation. If a regex carries catastrophic backtracking risk, it returns an error. Use non-greedy matching and anchored patterns to avoid this.
:::

## Security Levels

DD provides five security levels, each with a corresponding preset configuration:

```go
// Get config by level
cfg := dd.SecurityConfigForLevel(dd.SecurityLevelStandard)
```

| Level | Description | Use Case |
|-------|-------------|----------|
| `SecurityLevelDevelopment` | Most permissive | Local development |
| `SecurityLevelBasic` | Basic filtering | Test environments |
| `SecurityLevelStandard` | Standard filtering | General production |
| `SecurityLevelStrict` | Strict filtering | High-security requirements |
| `SecurityLevelParanoid` | Most strict | Sensitive industries (finance/medical) |

## Industry-Compliance Presets

DD provides three industry-compliance configurations:

### HIPAA (Medical)

```go
cfg := dd.HealthcareConfig()
```

Extra filtering: ICD-10 codes, medical record numbers (MRN), health insurance claim numbers (HICN), patient identifiers.

### PCI-DSS (Financial Payments)

```go
cfg := dd.FinancialConfig()
```

Extra filtering: SWIFT codes, IBAN account numbers, CVV/CVC, bank routing numbers.

### Government Standard

```go
cfg := dd.GovernmentConfig()
```

Extra filtering: passport numbers, driver's license numbers, tax IDs, SSN variants.

### Complete Example

```go
// Medical system: HIPAA-compliant config
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

// Log messages with sensitive info are auto-redacted
logger.Info("patient record mrn=MRN123456 diagnosis=J18.9 updated")
// MRN and ICD-10 codes in the message match patterns and are redacted

// Structured fields are filtered by key-name sensitivity
logger.InfoWith("user login",
    dd.String("password", "s3cr3t123"),    // -> [REDACTED] (key name is sensitive)
    dd.String("department", "internal"),   // Normal output
)
```

## Filter Statistics

Monitor filter runtime state:

```go
filter := dd.NewSensitiveDataFilter()
stats := filter.GetFilterStats()
fmt.Printf("active goroutines: %d\n", stats.ActiveGoroutines)
fmt.Printf("filter pattern count: %d\n", stats.PatternCount)
fmt.Printf("total redactions: %d\n", stats.TotalRedactions)
fmt.Printf("timeout count: %d\n", stats.TotalTimeouts)
```

## Disabling Filtering

```go
// Use the Development security level (no sensitive-data filtering)
logger, err := dd.New(dd.Config{
    Security: dd.SecurityConfigForLevel(dd.SecurityLevelDevelopment),
})
if err != nil {
    log.Fatal(err)
}

// Or manually set an empty SensitiveFilter
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

:::warning Filtering Is Enabled by Default
`DefaultConfig()` enables basic sensitive-data filtering by default (`DefaultSecurityConfig()`). Even when the `Security` field is not set, the default security config is used. To disable filtering, you must explicitly set `SensitiveFilter` to `nil`.
:::

## Next Steps

- [Audit Logging](./audit-logging) -- Security event auditing
- [Industry Compliance Configuration](../security/compliance) -- HIPAA/PCI-DSS in depth
- [API Reference - Security](../api-reference/security-audit/security) -- Complete security API documentation
- [Production Checklist](../security/production-checklist) -- Pre-launch checks
