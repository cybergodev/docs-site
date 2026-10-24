---
sidebar_label: "Production Checklist"
title: "Production Checklist - CyberGo env | Security Launch Check"
description: "Production checklist for CyberGo env security: .env 600 permissions, .gitignore, RequiredKeys/AllowedKeys, audit logging, SecureValue and expansion scope."
sidebar_position: 4
---

# Production Checklist

Run through this list before deploying an application that uses env.

:::tip Security concepts
For the security architecture and built-in defaults, see [Security Overview](./).
:::

## Pre-deployment Checks

### File Security

- [ ] `.env.production` file exists
- [ ] File permissions are `600` or stricter
- [ ] Sensitive files added to `.gitignore`
- [ ] Configuration files contain no placeholders (e.g., `change-me`, `xxx`)

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
auditFile, err := os.OpenFile("/var/log/app/audit.log",
    os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
if err != nil {
    log.Fatalf("failed to open audit log: %v", err)
}
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)
```

:::warning "Enabled" is not "persisted"
`ProductionConfig()` sets `AuditEnabled = true`. With no `AuditHandler` configured, audit events go to the stderr `[AUDIT]` log instead of a file. After launch, confirm that the audit log file is actually growing.
:::

### Sensitive Data Handling

- [ ] Sensitive values read with `GetSecure`
- [ ] `Release()` called promptly (it zeroes the value and returns it to the pool; `Close()` does not return to the pool)
- [ ] Logs do not contain raw sensitive values

```go
secret := loader.GetSecure("DB_PASSWORD")
defer secret.Release()
log.Printf("Password length: %d", secret.Length())
```

### Access Control

- [ ] `AllowedKeys` whitelist set (recommended)
- [ ] `ValidateValues` enabled
- [ ] Size limits appropriate for your configuration
- [ ] Configuration file paths are all **relative** — `Filenames` rejects absolute paths, UNC paths, URL-encoded `%`, and `..` traversal
- [ ] `ExpansionScope: ExpansionFileOnly` set for untrusted configuration sources, so `.env` expansion cannot capture process secrets (SEC-03)
- [ ] Audit handler is not connected to `os.Stdout` — `loader.Close()` closes the handler and, with it, the underlying writer

```go
cfg.AllowedKeys = []string{"APP_NAME", "DB_HOST", "API_KEY"}
cfg.ValidateValues = true
cfg.MaxVariables = 50 // ProductionConfig defaults to 50; raise only if you have more keys
```

## At Deployment Checks

- [ ] Configuration files loaded from a secure location
- [ ] Application validates configuration at startup
- [ ] Application refuses to start on configuration error
- [ ] No sensitive information in logs

## Post-deployment Checks

- [ ] Application runs normally
- [ ] Audit logs are being written
- [ ] No sensitive information leaked
- [ ] Monitoring covers configuration-related errors

```bash
# Health check: confirm the application is alive
curl -fsS http://localhost:8080/healthz > /dev/null && echo "OK: health check passed"

# Confirm the audit log file is actually receiving lines (not just the stderr [AUDIT] fallback)
tail -n 5 /var/log/app/audit.log
```

## Pre-deploy Check Script

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

# Check for placeholders
grep -qE "(change-?me|placeholder|xxx|YOUR_)" .env.production && \
    { echo "ERROR: Found placeholder values"; exit 1; }

# Check required keys
for key in DB_HOST DB_PORT DB_USER DB_PASSWORD API_KEY; do
    grep -q "^$key=" .env.production || { echo "ERROR: Missing $key"; exit 1; }
done

echo "=== All checks passed ==="
```

## Related Documentation

- [Security Overview](./) - security architecture and built-in defaults
- [SecureValue API](../api-reference/secure-value) - secure value handling
- [Constants & Errors](../api-reference/constants) - forbidden keys list
