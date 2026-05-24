---
title: "Compliance Config - CyberGo DD | HIPAA & PCI-DSS"
description: "CyberGo DD compliance config: HIPAA healthcare, PCI-DSS payment, and government standards for filtering, audit, retention, and rotation policies."
---

# Industry Compliance Configuration

DD provides three industry compliance preset configurations covering sensitive data protection requirements for healthcare, financial, and government sectors.

## HIPAA Healthcare Compliance

### Applicable Scenarios

- Electronic Health Record (EHR) systems
- Hospital Information Management Systems
- Telemedicine platforms
- Medical data research platforms

### Filtering Rules

`HealthcareConfig()` adds the following filters on top of default security rules:

| Data Type | Pattern | Example |
|-----------|---------|---------|
| ICD-10 Codes | Diagnosis code format in log messages | `diagnosis=J18.9` |
| Medical Record Number (MRN) | Medical record identifiers in log messages | `mrn=MRN-123456` |
| Health Insurance Claim Number (HICN) | HICN identifiers in log messages | `hicn=123456789A` |
| Patient Identifier | Patient identifiers in log messages | `patient_id=PAT-123456` |

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
// HIPAA requires: security event auditing + integrity protection
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
- Credit card processing services
- Core banking systems
- E-commerce transaction platforms

### Filtering Rules

`FinancialConfig()` adds the following filters on top of default security rules:

| Data Type | Pattern | Example |
|-----------|---------|---------|
| SWIFT Code | International bank code in log messages | `swift=BOFAUS3N` |
| IBAN Account | International bank account number in log messages | `iban=DE89370400440532013000` |
| CVV/CVC | Card verification code in log messages | `cvv=123` |
| Bank Routing Number | ABA routing number in log messages | `routing_number=021000021` |
| Bank Account Number | Bank account number in log messages | `account_number=12345678` |

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
fwCfg.MaxAge = 365 * 24 * time.Hour // Retain for 1 year (PCI-DSS requirement)
fwCfg.MaxBackups = 50    // Keep enough backups
fwCfg.Compress = true    // Compress old files to save space

fw, _ := dd.NewFileWriter("logs/pci-audit.json", fwCfg)
logger, _ := dd.New(dd.Config{
    Level:    dd.LevelInfo,
    Format:   dd.FormatJSON,
    Security: dd.FinancialConfig(),
    Targets:  []dd.OutputTarget{dd.CustomOutput(fw)},
})
```

## Government Standards

### Applicable Scenarios

- Government information systems
- Public service platforms
- Social security management systems
- Tax processing systems

### Filtering Rules

`GovernmentConfig()` adds the following filters on top of default security rules:

| Data Type | Pattern | Example |
|-----------|---------|---------|
| Passport Number | Passport number in log messages | `passport_number=E12345678` |
| Driver's License Number | Driver's license number in log messages | `dl_number=D123456789` |
| US Federal Tax ID (EIN) | EIN format in log messages | `12-3456789` |
| UK National Insurance Number | NINo format in log messages | `AB123456C` |
| Canada Social Insurance Number | SIN format in log messages | `123 456 789` |
| Case Number | Case number in log messages | `case_number=CR-2024-00123` |

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
| Extra Filter Patterns | +4 | +5 | +6 |
| Log Retention | 6 years | 1 year | Per regulation |
| Integrity Signing | Recommended | Required | Required |
| Audit Logging | Required | Required | Required |
| Encrypted Transmission | Required | Required | Recommended |

## Custom Compliance Configuration

When preset configurations don't fully meet your needs, you can combine custom settings:

```go
// Add custom patterns
filter, _ := dd.NewCustomSensitiveDataFilter(
    // Custom patterns specific to your healthcare system
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

- [Sensitive Data Filtering](../guides/sensitive-filtering) -- Filtering feature details
- [Audit Logging](../guides/audit-logging) -- Security audit integration
- [Production Checklist](./production-checklist) -- Pre-launch checks
- [API Reference - Security](../api-reference/security) -- Security API documentation
