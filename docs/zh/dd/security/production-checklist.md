---
title: "生产检查清单 - CyberGo DD | 安全上线检查"
description: "CyberGo DD 日志库生产环境部署前的完整安全检查清单，涵盖基础配置项验证、敏感数据过滤规则启用与测试验证、审计日志开关确认、文件轮换策略设置、HMAC 完整性签名配置和性能基准调优等关键检查项目，确保日志系统安全可靠且合规上线运行。"
---

# 生产检查清单

上线前请逐项检查以下安全配置，确保日志系统安全可靠。

## 基础配置

- [ ] **日志级别** -- 生产环境设置为 `LevelInfo` 或更高
- [ ] **输出格式** -- 使用 `FormatJSON` 便于日志采集和分析
- [ ] **文件轮换** -- 配置合理的大小限制和保留策略
- [ ] **缓冲刷新** -- 确保程序退出前调用 `Flush()` 或 `Close()`

```go
logger, _ := dd.New(dd.Config{
    Level:  dd.LevelInfo,
    Format: dd.FormatJSON,
})
defer logger.Close()
```

## 安全过滤

- [ ] **启用敏感数据过滤** -- 使用 `DefaultSecurityConfig()` 或更高
- [ ] **自定义模式** -- 根据业务添加特定敏感字段模式
- [ ] **过滤统计监控** -- 定期检查过滤统计，发现异常

```go
logger.SetSecurityConfig(dd.DefaultSecurityConfig())
```

## 文件安全

- [ ] **日志目录权限** -- 设置合理的目录和文件权限（如 `0600`）
- [ ] **路径验证** -- 确保日志路径不可被用户输入控制
- [ ] **符号链接** -- 生产环境禁止符号链接
- [ ] **磁盘空间** -- 配置轮换策略防止磁盘写满

## 审计与完整性

- [ ] **审计日志** -- 启用审计日志记录安全事件
- [ ] **完整性签名** -- 启用 HMAC 签名确保日志不可篡改
- [ ] **审计日志独立存储** -- 审计日志与业务日志分开存储

```go
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer audit.Close()

cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
```

## 性能

- [ ] **采样策略** -- 高吞吐场景考虑启用日志采样
- [ ] **缓冲写入** -- 使用 `BufferedWriter` 减少 I/O 次数
- [ ] **异步输出** -- 确认写入不阻塞业务逻辑
- [ ] **内存监控** -- 监控日志相关内存使用

## 生命周期

- [ ] **优雅关闭** -- 使用 `Shutdown(ctx)` 而非 `Close()`
- [ ] **超时设置** -- 设置合理的关闭超时（推荐 5-10 秒）
- [ ] **全局日志记录器** -- 通过 `SetDefault()` 替换而非重复创建

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
logger.Shutdown(ctx)
```

## 合规检查

- [ ] **HIPAA** -- 医疗行业使用 `HealthcareConfig()`
- [ ] **PCI-DSS** -- 金融行业使用 `FinancialConfig()`
- [ ] **GDPR** -- 确保不记录个人身份信息（PII）
- [ ] **数据保留** -- 配置符合法规的日志保留期限

## 监控告警

- [ ] **写入错误** -- 配置 `SetWriteErrorHandler` 监控写入失败
- [ ] **过滤协程** -- 监控 `ActiveFilterGoroutines()` 数量
- [ ] **审计统计** -- 定期检查审计事件统计
- [ ] **错误码告警** -- 对 `PATH_TRAVERSAL`、`REDOS_PATTERN` 等安全错误码告警

```go
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    metrics.WriteErrors.Inc()
    alert("日志写入失败: " + err.Error())
})
```

## 下一步

- [安全概述](./) -- 安全特性总览
- [安全过滤 API](../api-reference/security) -- 配置参考
- [性能优化](../advanced/performance) -- 性能调优
