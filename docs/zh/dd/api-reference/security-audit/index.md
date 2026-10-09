---
sidebar_label: "概览"
title: "安全与审计 - CyberGo DD | API 概览"
description: "CyberGo DD 安全与审计 API 概览，涵盖 SensitiveDataFilter 敏感数据过滤、AuditLogger 异步审计日志和 IntegritySigner HMAC 完整性签名三大组件的功能定位与适用场景。"
sidebar_position: 1
---

# 安全与审计

DD 的安全体系由三个独立但互补的组件构成，覆盖从数据脱敏到审计追踪的完整链路。

## 组件概览

| 组件 | 职责 | 典型场景 |
|------|------|----------|
| [SensitiveDataFilter](./security) | 自动检测并脱敏日志中的敏感信息 | 防止密码、API Key、信用卡号泄露到日志 |
| [AuditLogger](./audit) | 异步记录安全相关事件 | 合规审计、安全分析、入侵检测 |
| [IntegritySigner](./integrity) | HMAC 签名防止日志篡改 | 日志防篡改、事后取证、合规存证 |

## 三者关系

```text
日志写入流程：

  Logger.InfoWith(...)
       │
       ├─→ SensitiveDataFilter ──→ 脱敏字段值（密码 → [REDACTED]）
       │         │
       │         └─→ AuditLogger ──→ 异步记录脱敏事件（哪条日志被过滤了什么）
       │
       └─→ 格式化输出

  AuditLogger（可选 IntegritySigner）──→ HMAC 签名审计事件（防篡改）
```

- **SensitiveDataFilter** 在日志写入**前**拦截敏感数据
- **AuditLogger** 异步记录安全事件，不影响主日志性能
- **IntegritySigner** **不在普通日志的写入路径上**：它仅对**审计事件**签名（通过 `AuditConfig.IntegritySigner` 接入），或由用户手动调用 `Sign`/`SignFields` 签名任意内容

## 快速选择

| 需求 | 推荐组件 |
|------|----------|
| 防止密码/密钥泄露 | [SensitiveDataFilter](./security) |
| 记录谁在何时做了什么 | [AuditLogger](./audit) |
| 确保日志未被篡改 | [IntegritySigner](./integrity) |
| 满足 HIPAA/PCI-DSS 合规 | 三者配合使用，见 [行业合规配置](../../guides/security/compliance) |

## 相关指南

- [敏感数据过滤](../../guides/security/sensitive-filtering) -- 自动脱敏配置教程
- [审计日志](../../guides/security/audit-logging) -- 安全审计实战指南
- [HMAC 签名实战](../../guides/security/integrity) -- 完整性签名进阶
- [行业合规配置](../../guides/security/compliance) -- HIPAA/PCI-DSS 预设方案
- [生产检查清单](../../guides/security/production-checklist) -- 上线安全检查

## 下一步

- [安全过滤](./security) -- SensitiveDataFilter 完整 API
- [审计日志](./audit) -- AuditLogger 完整 API
- [完整性签名](./integrity) -- IntegritySigner 完整 API
