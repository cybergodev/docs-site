---
sidebar_label: "生产检查清单"
title: "生产检查清单 - CyberGo env | 安全上线检查"
description: "CyberGo env 生产部署安全检查清单，涵盖 .env 文件 600 权限与 .gitignore 保护、RequiredKeys/AllowedKeys 必需键验证、审计日志启用、SecureValue 处理与性能参数调优，保障上线即安全。"
sidebar_position: 4
---

# 生产检查清单

将应用部署到生产环境前逐项确认以下检查项。每项都对应一类已知的上线风险，未通过的项应在发布前处理。

::: tip 安全概念
安全架构和核心特性见 [安全概述](./)。
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
auditFile, err := os.OpenFile("/var/log/app/audit.log",
    os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
if err != nil {
    log.Fatalf("打开审计日志失败: %v", err)
}
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)
```

<!-- autocorrect-disable — 容器标题 `::: warning 「…」` 的空格是 markdown-it-container 语法的一部分，删除空格会让 type 解析失败。 -->
::: warning 「已启用」≠「已落盘」
<!-- autocorrect-enable -->
- [ ] `ProductionConfig()` 默认 `AuditEnabled = true`，但未配置 `AuditHandler` 时审计事件只写入 stderr 的 `[AUDIT]` 标准日志。上线后确认审计日志文件确实在增长。
:::

### 敏感数据处理

- [ ] 敏感值使用 `GetSecure` 获取
- [ ] 用完调用 `Release()` 释放（清零并归还对象池）；`Close()` 只清零，不归还池
- [ ] 日志不输出原始敏感值

```go
secret := loader.GetSecure("DB_PASSWORD")
defer secret.Release()
log.Printf("Password length: %d", secret.Length())
```

### 访问控制

- [ ] 设置 `AllowedKeys` 白名单（推荐）
- [ ] 启用 `ValidateValues`
- [ ] 检查大小限制：`ProductionConfig()` 的 `MaxFileSize` 为 64 KB、`MaxVariables` 为 50；配置规模超出时按需调高
- [ ] 配置文件路径全部为**相对路径**：`Filenames` 拒绝绝对路径、UNC 路径、URL 编码 `%` 与 `..` 目录穿越
- [ ] 配置来源不可信时设置 `ExpansionScope: ExpansionFileOnly`，阻止 .env 展开读取进程环境机密（SEC-03）
- [ ] 审计 handler 不要接 `os.Stdout`：`loader.Close()` 会关闭处理器，并连带关闭底层 writer

```go
cfg.AllowedKeys = []string{"APP_NAME", "DB_HOST", "API_KEY"}
cfg.ValidateValues = true
cfg.MaxVariables = 50 // ProductionConfig 默认即为 50，键更多时才调高
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

```bash
# 健康检查：确认应用存活
curl -fsS http://localhost:8080/healthz > /dev/null && echo "OK: health check passed"

# 确认审计日志确实落盘（而不是只有 stderr 的 [AUDIT] 兜底输出）
tail -n 5 /var/log/app/audit.log
```

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

- [安全概述](./) - 安全架构与核心特性
- [SecureValue API](../api-reference/secure-value) - 安全值处理
- [常量与错误](../api-reference/constants) - 禁止键列表与默认限制
