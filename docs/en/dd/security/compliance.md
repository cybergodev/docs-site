---
sidebar_label: "Industry Compliance"
title: "Industry Compliance Configuration - CyberGo DD | HIPAA PCI-DSS Government"
description: "CyberGo DD industry-compliance logging configuration, detailing HIPAA medical, PCI-DSS financial-payment, and government-standard sensitive-data filtering rules, audit-log requirements, log-retention and rotation policies, and complete compliance configuration examples to help you build secure, reliable logging systems under strict compliance requirements."
sidebar_position: 2
---

# Industry Compliance Configuration

DD provides three industry-compliance preset configurations covering medical, financial, and government sensitive-data protection requirements.

## HIPAA Medical Compliance

### Applicable Scenarios

- Electronic Health Record (EHR) systems
- Hospital information management systems
- Telemedicine platforms
- Medical data research platforms

### Filtering Rules

`HealthcareConfig()` filters additionally on top of `DefaultSecureConfig()` (the full pattern set):

| Data Type | Pattern | Example |
|-----------|---------|---------|
| ICD-10 codes | Diagnostic-code format in log messages | `diagnosis=J18.9` |
| Medical Record Number (MRN) | Medical record identifier in log messages | `mrn=MRN-123456` |
| Health Insurance Claim Number (HICN) | HICN identifier in log messages | `hicn=123456789A` |
| Patient identifier | Patient identifier in log messages | `patient_id=PAT-123456` |

### Configuration Example

```go
func NewHIPAACompliantLogger() (*dd.Logger, error) {
    return dd.New(dd.Config{
        Level:    dd.LevelInfo,
        Format:   dd.FormatJSON,
        Security: dd.HealthcareConfig(),
        Targets: []dd.OutputTarget{
            dd.FileOutput("logs/hipaa-audit.json"),
        },
    })
}
```

### Audit Requirements

```go
// HIPAA requirements: security-event audit + integrity protection
integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(integrityCfg)

auditFile, _ := os.OpenFile("logs/hipaa-audit.json", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           auditFile,
    JSONFormat:       true,
    IncludeTimestamp: true,
    BufferSize:       2000,
    MinimumSeverity:  dd.AuditSeverityInfo,
    IntegritySigner:  signer,
})
```

## PCI-DSS Financial Compliance

### Applicable Scenarios

- Online payment systems
- Credit-card processing services
- Core banking systems
- E-commerce transaction platforms

### Filtering Rules

`FinancialConfig()` filters additionally on top of `DefaultSecureConfig()` (the full pattern set):

| Data Type | Pattern | Example |
|-----------|---------|---------|
| SWIFT code | International bank code in log messages | `swift=BOFAUS3N` |
| IBAN account | International bank account number in log messages | `iban=DE89370400440532013000` |
| CVV/CVC | Card verification code in log messages | `cvv=123` |
| Bank routing number | ABA routing number in log messages | `routing_number=021000021` |
| Bank account | Bank account number in log messages | `account_number=12345678` |

### Configuration Example

```go
func NewPCICompliantLogger() (*dd.Logger, error) {
    return dd.New(dd.Config{
        Level:    dd.LevelInfo,
        Format:   dd.FormatJSON,
        Security: dd.FinancialConfig(),
        Targets: []dd.OutputTarget{
            dd.FileOutput("logs/pci-audit.json"),
        },
    })
}
```

### Log Retention Policy

```go
fwCfg := dd.DefaultFileWriterConfig()
fwCfg.MaxSizeMB = 100    // 100MB per file
fwCfg.MaxAge = 365 * 24 * time.Hour // Keep 1 year (PCI-DSS requirement)
fwCfg.MaxBackups = 50    // Keep plenty of backups
fwCfg.Compress = true    // Compress old files to save space

fw, _ := dd.NewFileWriter("logs/pci-audit.json", fwCfg)
logger, _ := dd.New(dd.Config{
    Level:    dd.LevelInfo,
    Format:   dd.FormatJSON,
    Security: dd.FinancialConfig(),
    Targets:  []dd.OutputTarget{dd.CustomOutput(fw)},
})
```

## Government Standard

### Applicable Scenarios

- Government information systems
- Public service platforms
- Social-security management systems
- Tax processing systems

### Filtering Rules

`GovernmentConfig()` filters additionally on top of `DefaultSecureConfig()` (the full pattern set):

| Data Type | Pattern | Example |
|-----------|---------|---------|
| Passport number | Passport identifier in log messages | `passport_number=E12345678` |
| Driver's license number | Driver's license identifier in log messages | `dl_number=D123456789` |
| US Federal Tax ID (EIN) | EIN format in log messages | `12-3456789` |
| UK National Insurance Number | NINo format in log messages | `AB123456C` |
| Canadian Social Insurance Number | SIN format in log messages | `123 456 789` |
| Case number | Case identifier in log messages | `case_number=CR-2024-00123` |

### Configuration Example

```go
func NewGovernmentLogger() (*dd.Logger, error) {
    return dd.New(dd.Config{
        Level:    dd.LevelInfo,
        Format:   dd.FormatJSON,
        Security: dd.GovernmentConfig(),
        Targets: []dd.OutputTarget{
            dd.FileOutput("logs/gov-audit.json"),
        },
    })
}
```

## Compliance Comparison

| Dimension | HIPAA | PCI-DSS | Government |
|-----------|-------|---------|------------|
| Extra filter patterns | +4 | +5 | +6 |
| Log retention | 6 years | 1 year | As required |
| Integrity signing | Recommended | Required | Required |
| Audit logging | Required | Required | Required |
| Encrypted transmission | Required | Required | Recommended |

## Custom Compliance Configuration

When a preset does not fully meet your needs, you can compose custom configurations:

```go
// Add custom patterns
filter, _ := dd.NewCustomSensitiveDataFilter(
    // Custom medical-system-specific patterns
    `(?i)insurance_id\s*[:=]\s*\S+`,
    `(?i)prescription\s*[:=]\s*\S+`,
)

logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Security: &dd.SecurityConfig{
        SensitiveFilter: filter,
    },
    Targets: []dd.OutputTarget{dd.FileOutput("logs/custom.json")},
})
```

## Next Steps

- [Sensitive Data Filtering](../guides/sensitive-filtering) -- Filtering in depth
- [Audit Logging](../guides/audit-logging) -- Security audit integration
- [Production Checklist](./production-checklist) -- Pre-launch checks
- [API Reference - Security](../api-reference/security-audit/security) -- Security API documentation
