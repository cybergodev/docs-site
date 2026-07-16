---
sidebar_label: "生产检查清单"
title: "生产检查清单 - CyberGo JSON | 安全部署"
description: "CyberGo JSON 生产部署安全清单：SecurityConfig 配置、资源限制、输入验证、错误处理、监控告警与性能安全平衡，确保生产环境可靠运行。"
sidebar_position: 3
---

# 生产检查清单

部署到生产环境前，请确认以下安全项目。

## 配置检查

### 资源限制

- [ ] 设置 `MaxNestingDepthSecurity` 防止深度嵌套攻击
- [ ] 设置 `MaxJSONSize` 限制单个值大小
- [ ] 设置 `MaxMemory` 限制总内存使用

```go
cfg := json.DefaultConfig()
cfg.MaxNestingDepthSecurity = 50
cfg.MaxJSONSize = 10 * 1024 * 1024
cfg.MaxMemory = 100 * 1024 * 1024
```

## 输入验证

### 必填字段

- [ ] 验证所有必填字段存在
- [ ] 验证字段类型正确

```go
// 自定义验证器示例
type RequiredFieldValidator struct{}

func (v *RequiredFieldValidator) Validate(jsonStr string) error {
    // 检查必填字段是否存在
    return nil
}

cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&RequiredFieldValidator{}}
```

### 格式验证

- [ ] 验证邮箱格式
- [ ] 验证 URL 格式
- [ ] 验证自定义格式

```go
// 自定义格式验证器
type EmailValidator struct{}

func (v *EmailValidator) Validate(jsonStr string) error {
    var data map[string]any
    if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
        return nil
    }
    email, _ := data["email"].(string)
    matched, _ := regexp.MatchString(`^\w+@\w+\.\w+$`, email)
    if !matched {
        return errors.New("invalid email format")
    }
    return nil
}

cfg := json.DefaultConfig()
cfg.CustomValidators = append(cfg.CustomValidators, &EmailValidator{})
```

### 范围验证

- [ ] 验证数值范围
- [ ] 验证字符串长度
- [ ] 验证数组长度

```go
// 使用 Schema 进行范围验证
schema := &json.Schema{
    Type: "object",
    Properties: map[string]*json.Schema{
        "age":  {Type: "number", Minimum: 0, Maximum: 100},
        "name": {Type: "string", MinLength: 1, MaxLength: 255},
    },
}
```

## 敏感数据处理

### 过滤敏感字段

- [ ] 过滤密码字段
- [ ] 过滤令牌字段
- [ ] 过滤其他敏感数据

```go
// 使用 Hook 过滤敏感字段
type SensitiveFilterHook struct {
    fields map[string]bool
}

func (h *SensitiveFilterHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *SensitiveFilterHook) After(ctx json.HookContext, result any, err error) (any, error) {
    if m, ok := result.(map[string]any); ok {
        for field := range h.fields {
            delete(m, field)
        }
    }
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&SensitiveFilterHook{fields: map[string]bool{
    "password": true,
    "token":    true,
    "api_key":  true,
    "secret":   true,
}})
```

### 日志脱敏

- [ ] 日志中不记录敏感数据
- [ ] 错误消息不包含敏感信息

## 错误处理

### 安全的错误响应

- [ ] 不暴露内部错误细节
- [ ] 使用通用错误消息
- [ ] 记录详细错误到日志

```go
if err != nil {
    log.Error("详细错误", "error", err)
    return errors.New("操作失败，请稍后重试")
}
```

## 监控与审计

### 性能监控

- [ ] 监控解析时间
- [ ] 监控内存使用
- [ ] 设置告警阈值

```go
// 使用 Hook 监控性能
type MetricsHook struct{}

func (h *MetricsHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *MetricsHook) After(ctx json.HookContext, result any, err error) (any, error) {
    log.Info("operation", "op", ctx.Operation)
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&MetricsHook{})
```

### 审计日志

- [ ] 记录关键操作
- [ ] 记录异常输入
- [ ] 定期审查日志

## 测试覆盖

### 安全测试

- [ ] 深度嵌套测试
- [ ] 大文件处理测试
- [ ] 无效输入测试
- [ ] 边界条件测试

### 性能测试

- [ ] 并发处理测试
- [ ] 大数据量测试
- [ ] 内存泄漏测试

## 快速检查命令

```bash
# 检查敏感字段
grep -r "password\|token\|secret" --include="*.go"

# 检查硬编码配置
grep -r "MaxNestingDepthSecurity\|MaxMemory" --include="*.go"

# 运行安全测试
go test -run Security ./...
```

## 检查清单模板

```go
// 生产配置模板
func ProductionConfig() json.Config {
    cfg := json.SecurityConfig()

    // 资源限制（SecurityConfig 已预设安全默认值）
    cfg.MaxMemory = 100 * 1024 * 1024

    // 自定义验证器
    cfg.CustomValidators = []json.Validator{&RequiredFieldValidator{}}

    // 审计 Hook
    cfg.Hooks = []json.Hook{&AuditHook{logger: prodLogger}}

    return cfg
}
```

## 相关

- [安全概述](./)
- [Config 配置](../api-reference/config)
