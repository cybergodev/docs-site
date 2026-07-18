---
sidebar_label: "Production Checklist"
title: "Production Checklist - CyberGo env | Pre-Deployment Security"
description: "CyberGo env production checklist: .env 600 perms + .gitignore, RequiredKeys/AllowedKeys validation, audit, SecureValue handling and performance tuning."
sidebar_position: 2
---

# Production Checklist

A checklist to review before deploying your application to production.

:::tip Security Concepts
For the security architecture and core features, see [Security Overview](/en/env/security/).
:::

## Pre-Deployment Checks

### File Security

- [ ] `.env.production` file exists
- [ ] File permissions are `600` or stricter
- [ ] Sensitive files are listed in `.gitignore`
- [ ] Config files contain no placeholders (e.g., `change-me`, `xxx`)

```bash
# Check permissions
ls -la .env.production
# Should show: -rw------- (600)

# Fix permissions
chmod 600 .env.production
```

### Configuration Validation

- [ ] All required keys are set
- [ ] Sensitive values are not empty
- [ ] Value formats are correct (URLs, ports, etc.)
- [ ] No hardcoded secrets

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{
    "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD",
    "API_KEY", "API_URL",
}
cfg.FailOnMissingFile = true
```

## Security Configuration Checks

### Audit Logging

- [ ] Audit logging is enabled
- [ ] Log directory is writable
- [ ] Log file permissions are correct

```go
auditFile, _ := os.OpenFile("/var/log/app/audit.log",
    os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)
```

### Sensitive Data Handling

- [ ] Sensitive values are retrieved with `GetSecure`
- [ ] `Close()` is called promptly to release resources
- [ ] Raw sensitive values are not logged

```go
secret := loader.GetSecure("DB_PASSWORD")
defer secret.Close()
log.Printf("Password length: %d", secret.Length())
```

### Access Control

- [ ] `AllowedKeys` whitelist is set (recommended)
- [ ] `ValidateValues` is enabled
- [ ] Size limits are configured appropriately

```go
cfg.AllowedKeys = []string{"APP_NAME", "DB_HOST", "API_KEY"}
cfg.ValidateValues = true
cfg.MaxVariables = 100
```

## Deployment-Time Checks

- [ ] Config files are loaded from a secure location
- [ ] Application validates configuration on startup
- [ ] Application refuses to start on configuration errors
- [ ] Sensitive information is not written to logs

## Post-Deployment Checks

- [ ] Application is running normally
- [ ] Audit logs are being written
- [ ] No sensitive information is leaking
- [ ] Monitoring is set up for configuration-related errors

## Quick Check Script

```bash
#!/bin/bash
# pre-deploy-check.sh

set -e

echo "=== Pre-deployment Config Check ==="

# Check file exists
[ -f ".env.production" ] || { echo "ERROR: .env.production not found"; exit 1; }

# Check permissions
PERMS=$(stat -c %a .env.production 2>/dev/null || stat -f %Lp .env.production)
[ "$PERMS" = "600" ] || [ "$PERMS" = "400" ] || echo "WARNING: permissions are $PERMS"

# Check placeholders
grep -qE "(change-?me|placeholder|xxx|YOUR_)" .env.production && \
    { echo "ERROR: Found placeholder values"; exit 1; }

# Check required keys
for key in DB_HOST DB_PORT DB_USER DB_PASSWORD API_KEY; do
    grep -q "^$key=" .env.production || { echo "ERROR: Missing $key"; exit 1; }
done

echo "=== All checks passed ==="
```

## Related Documentation

- [Security Overview](/en/env/security/) - Security architecture and core features
- [SecureValue API](/en/env/api-reference/secure-value) - Secure value handling
- [Constants & Errors](/en/env/api-reference/constants) - Forbidden keys list
