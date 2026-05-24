---
title: "生产检查清单 - HTML"
description: "CyberGo HTML 库生产环境部署安全检查清单，涵盖基础安全配置项（HighSecurityConfig 预设）、Processor 生命周期管理、审计与监控配置、上下文超时控制、错误处理最佳实践、资源管理和文件处理安全注意事项汇总，帮助确保上线前的安全合规。"
---

# 生产检查清单

## 基础配置

- [ ] 使用 `HighSecurityConfig()` 或自定义安全配置
- [ ] 设置合理的 `MaxInputSize`（根据业务需求）
- [ ] 设置 `ProcessingTimeout` 防止长时间阻塞
- [ ] 配置 `MaxDepth` 限制 DOM 深度
- [ ] 启用 `EnableSanitization` 进行内容清洗

## Processor 生命周期

- [ ] 使用 `defer p.Close()` 确保 Processor 正确释放
- [ ] 不要在关闭后继续使用 Processor
- [ ] 考虑使用单例 Processor 复用资源

```go
p, err := html.New(html.HighSecurityConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()
```

## 审计与监控

- [ ] 启用审计系统
- [ ] 配置合适的审计级别过滤
- [ ] 使用 `WriterAuditSink` 持久化审计日志
- [ ] 监控 `GetStatistics()` 中的错误计数
- [ ] 关注 `ErrInternalPanic` 错误和 `AuditEventPathTraversal` 审计事件

```go
auditFile, _ := os.OpenFile("audit.jsonl", os.O_APPEND|os.O_CREATE, 0644)
defer auditFile.Close()

cfg := html.HighSecurityConfig()
cfg.Audit.Sink = html.NewWriterAuditSink(auditFile)
```

## 上下文与超时

- [ ] 所有提取操作使用 `WithContext` 版本
- [ ] 设置合理的上下文超时
- [ ] 批量操作使用带取消的上下文

```go
ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
defer cancel()
result, err := html.ExtractWithContext(ctx, data)
```

## 错误处理

- [ ] 区分业务错误和安全错误
- [ ] 记录所有 `ErrInputTooLarge` 和 `ErrMaxDepthExceeded`
- [ ] 监控 `ErrInternalPanic` 频率
- [ ] 对 `ErrFileNotFound` 检查 `SafePath()` 而非原始错误信息

## 资源管理

- [ ] 批量操作不超过 10000 条/次
- [ ] 合理配置 `WorkerPoolSize`
- [ ] 定期调用 `ClearCache()` 释放缓存
- [ ] 监控内存使用和缓存命中率

## 文件处理

- [ ] 验证文件路径来源（防止用户控制路径）
- [ ] 限制文件读取目录
- [ ] 检查文件大小后再处理
