---
sidebar_label: "生产检查清单"
title: "生产检查清单 - CyberGo env | 安全上线检查"
description: "CyberGo env 生产部署安全检查清单，涵盖 .env 文件 600 权限与 .gitignore 保护、RequiredKeys/AllowedKeys 必需键验证、审计日志启用、SecureValue 处理与性能参数调优，保障上线即安全。"
sidebar_position: 2
---

# 生产检查清单

将应用部署到生产环境前的检查清单。

::: tip 安全概念
安全架构和核心特性详见 [安全概述](/zh/env/security/)。
:::

## 部署前检查

### 文件安全

- [ ] `.env.production` 文件存在
- [ ] 文件权限为 `600` 或更严格
- [ ] 敏感文件已添加到 `.gitignore`
- [ ] 配置文件不含占位符（如 `change-me`、`xxx`）

```bash
# 检查权限
ls -la .env.production
# 应显示: -rw------- (600)

# 修复权限
chmod 600 .env.production
```

### 配置验证

- [ ] 所有必需键已设置
- [ ] 敏感值不为空
- [ ] 值格式正确（URL、端口等）
- [ ] 无硬编码密钥

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{
    "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD",
    "API_KEY", "API_URL",
}
cfg.FailOnMissingFile = true
```

## 安全配置检查

### 审计日志

- [ ] 审计日志已启用
- [ ] 日志目录可写
- [ ] 日志文件权限正确

```go
auditFile, _ := os.OpenFile("/var/log/app/audit.log",
    os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)
```

### 敏感数据处理

- [ ] 敏感值使用 `GetSecure` 获取
- [ ] 及时调用 `Close()` 释放资源
- [ ] 日志不输出原始敏感值

```go
secret := loader.GetSecure("DB_PASSWORD")
defer secret.Close()
log.Printf("Password length: %d", secret.Length())
```

### 访问控制

- [ ] 设置 `AllowedKeys` 白名单（推荐）
- [ ] 启用 `ValidateValues`
- [ ] 合理设置大小限制

```go
cfg.AllowedKeys = []string{"APP_NAME", "DB_HOST", "API_KEY"}
cfg.ValidateValues = true
cfg.MaxVariables = 100
```

## 部署时检查

- [ ] 配置文件从安全位置加载
- [ ] 应用启动时验证配置
- [ ] 配置错误时应用拒绝启动
- [ ] 敏感信息不输出到日志

## 部署后检查

- [ ] 应用正常运行
- [ ] 审计日志正常写入
- [ ] 无敏感信息泄露
- [ ] 监控配置相关错误

## 快速检查脚本

```bash
#!/bin/bash
# pre-deploy-check.sh

set -e

echo "=== Pre-deployment Config Check ==="

# 检查文件存在
[ -f ".env.production" ] || { echo "ERROR: .env.production not found"; exit 1; }

# 检查权限
PERMS=$(stat -c %a .env.production 2>/dev/null || stat -f %Lp .env.production)
[ "$PERMS" = "600" ] || [ "$PERMS" = "400" ] || echo "WARNING: permissions are $PERMS"

# 检查占位符
grep -qE "(change-?me|placeholder|xxx|YOUR_)" .env.production && \
    { echo "ERROR: Found placeholder values"; exit 1; }

# 检查必需键
for key in DB_HOST DB_PORT DB_USER DB_PASSWORD API_KEY; do
    grep -q "^$key=" .env.production || { echo "ERROR: Missing $key"; exit 1; }
done

echo "=== All checks passed ==="
```

## 相关文档

- [安全概述](/zh/env/security/) - 安全架构与核心特性
- [SecureValue API](/zh/env/api-reference/secure-value) - 安全值处理
- [常量与错误](/zh/env/api-reference/constants) - 禁止键列表
